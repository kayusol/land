// mint_all_map.mjs — 铸造整个地图 (100x100=10000块) 并挂单
// 分批处理，可中断续跑（自动跳过已铸造的）
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'
import { writeFileSync, readFileSync, existsSync } from 'fs'

const PK = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const account = privateKeyToAccount(PK)
const wc = createWalletClient({ account, chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })
const pc = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })

const LAND    = '0x889DCe5b3934D56f3814f93793F8e1f8710249ea'
const NFT_AUC = '0xe489Fd17B4aBF3b22482Bf0f09193f9902f1fd22'
const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'
const PROGRESS_FILE = './mint_progress.json'

const OWN_ABI  = [{ type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view' }]
const APPR_ABI = [
  { type:'function',name:'isApprovedForAll',inputs:[{name:'o',type:'address'},{name:'s',type:'address'}],outputs:[{type:'bool'}],stateMutability:'view' },
  { type:'function',name:'setApprovalForAll',inputs:[{name:'op',type:'address'},{name:'v',type:'bool'}],outputs:[],stateMutability:'nonpayable' }
]
const MINT_ABI = [{ type:'function',name:'mint',inputs:[{name:'to',type:'address'},{name:'x',type:'int16'},{name:'y',type:'int16'},{name:'attr',type:'uint80'}],outputs:[],stateMutability:'nonpayable' }]
const AUC_ABI  = [{ type:'function',name:'createAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'},{name:'sp',type:'uint128'},{name:'ep',type:'uint128'},{name:'dur',type:'uint64'}],outputs:[],stateMutability:'nonpayable' }]
const CHK_ABI  = [{ type:'function',name:'getAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'}],outputs:[{components:[{name:'nftContract',type:'address'},{name:'seller',type:'address'},{name:'startPrice',type:'uint128'},{name:'endPrice',type:'uint128'},{name:'duration',type:'uint64'},{name:'startedAt',type:'uint64'}],type:'tuple'}],stateMutability:'view' }]

const sleep = ms => new Promise(r => setTimeout(r, ms))

function makeAttr(x, y) {
  const rng = (s) => { let v=((x*137+y*31+s*97)^0xdeadbeef)>>>0; v=Math.imul(v^(v>>>16),0x45d9f3b)>>>0; return((v^(v>>>16))>>>0)/0xffffffff }
  let a=0n
  for(let i=0;i<5;i++) a |= BigInt(Math.floor(30 + rng(i+1)*41)) << BigInt(i*16)
  return a
}

async function sendTx(to, abi, fn, args) {
  const data = encodeFunctionData({ abi, functionName: fn, args })
  for (let r = 0; r < 3; r++) {
    try {
      const nonce = await pc.getTransactionCount({ address: account.address, blockTag: 'pending' })
      const gas = await pc.estimateGas({ account: account.address, to, data }).catch(() => 200_000n)
      const hash = await wc.sendTransaction({ to, data, gas: gas*130n/100n, nonce })
      const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 60000 })
      if (receipt.status === 'reverted') throw new Error('reverted')
      await sleep(200)
      return hash
    } catch(e) {
      const m = (e.message||'').toLowerCase()
      if (r < 2 && (m.includes('nonce')||m.includes('rate')||m.includes('429'))) { await sleep(2000*(r+1)); continue }
      throw e
    }
  }
}

async function main() {
  console.log('账户:', account.address)
  const bal = await pc.getBalance({ address: account.address })
  console.log('BNB余额:', (Number(bal)/1e18).toFixed(4))

  // 读取进度文件（支持中断续跑）
  let progress = { mintedIds: [], listedIds: [] }
  if (existsSync(PROGRESS_FILE)) {
    try { progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')) } catch {}
    console.log(`继续上次进度: 已铸造${progress.mintedIds.length} 已挂单${progress.listedIds.length}`)
  }
  const mintedSet = new Set(progress.mintedIds)
  const listedSet = new Set(progress.listedIds)

  // 生成全部 10000 个坐标 (x=0-99, y=0-99)
  const allLands = []
  for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) allLands.push({ x, y, id: x*100+y+1 })
  console.log(`全地图: ${allLands.length} 块`)

  // 预扫描：批量检查哪些已铸造（分批 multicall）
  console.log('\n扫描已铸造状态...')
  const BATCH = 200
  for (let s = 0; s < allLands.length; s += BATCH) {
    const batch = allLands.slice(s, s+BATCH)
    const res = await pc.multicall({
      contracts: batch.map(l => ({ address: LAND, abi: OWN_ABI, functionName: 'ownerOf', args: [BigInt(l.id)] })),
      allowFailure: true
    })
    batch.forEach((l, i) => {
      const o = res[i]?.result?.toLowerCase()
      if (o && o !== '0x0000000000000000000000000000000000000000') mintedSet.add(l.id)
    })
    process.stdout.write(`\r  已扫描 ${Math.min(s+BATCH, allLands.length)}/${allLands.length}...`)
  }
  const toMint = allLands.filter(l => !mintedSet.has(l.id))
  console.log(`\n待铸造: ${toMint.length} 块  已铸造: ${mintedSet.size} 块`)

  // 授权
  const isAppr = await pc.readContract({ address: LAND, abi: APPR_ABI, functionName: 'isApprovedForAll', args: [DEPLOYER, NFT_AUC] })
  if (!isAppr) {
    console.log('授权中...')
    await sendTx(LAND, APPR_ABI, 'setApprovalForAll', [NFT_AUC, true])
    console.log('✅ 授权完成')
  }

  // 铸造
  if (toMint.length > 0) {
    console.log('\n=== 开始铸造 ===')
    let minted = 0, errors = 0
    const startTime = Date.now()
    for (const { x, y, id } of toMint) {
      try {
        await sendTx(LAND, MINT_ABI, 'mint', [DEPLOYER, x, y, makeAttr(x, y)])
        mintedSet.add(id)
        minted++
        // 每50块保存进度
        if (minted % 50 === 0) {
          progress.mintedIds = [...mintedSet]
          writeFileSync(PROGRESS_FILE, JSON.stringify(progress))
          const elapsed = (Date.now()-startTime)/1000
          const rate = minted/elapsed
          const remaining = (toMint.length-minted)/rate
          process.stdout.write(`\r  已铸造 ${minted}/${toMint.length} | 速度 ${rate.toFixed(1)}块/s | 剩余约 ${Math.ceil(remaining/60)} 分钟   `)
        }
      } catch(e) {
        errors++
        if (errors % 10 === 0) console.log(`\n  ⚠️ 已有${errors}个错误`)
      }
    }
    progress.mintedIds = [...mintedSet]
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress))
    console.log(`\n铸造完成: ${minted} 成功 ${errors} 失败`)
  }

  // 挂单（起拍8R→底价1R，30天）
  console.log('\n=== 开始挂单 ===')
  const SP = parseEther('8'), EP = parseEther('1'), DUR = BigInt(30*24*3600)
  // 找在钱包里但未挂单的
  let listed = 0
  for (let s = 0; s < allLands.length; s += BATCH) {
    const batch = allLands.slice(s, s+BATCH)
    const ownerRes = await pc.multicall({
      contracts: batch.map(l => ({ address: LAND, abi: OWN_ABI, functionName: 'ownerOf', args: [BigInt(l.id)] })),
      allowFailure: true
    })
    const walletBatch = batch.filter((_,i) => ownerRes[i]?.result?.toLowerCase() === DEPLOYER.toLowerCase())

    for (const { id } of walletBatch) {
      if (listedSet.has(id)) continue
      const auc = await pc.readContract({ address: NFT_AUC, abi: CHK_ABI, functionName: 'getAuction', args: [LAND, BigInt(id)] }).catch(()=>null)
      if (auc?.startedAt > 0n) { listedSet.add(id); continue }
      try {
        await sendTx(NFT_AUC, AUC_ABI, 'createAuction', [LAND, BigInt(id), SP, EP, DUR])
        listedSet.add(id); listed++
        if (listed % 50 === 0) {
          progress.listedIds = [...listedSet]
          writeFileSync(PROGRESS_FILE, JSON.stringify(progress))
          process.stdout.write(`\r  已挂单 ${listed}...`)
        }
      } catch {}
    }
  }
  progress.listedIds = [...listedSet]
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress))

  const finalBal = await pc.getBalance({ address: account.address })
  console.log(`\n=== 全部完成 ===`)
  console.log(`铸造总量: ${mintedSet.size} 块`)
  console.log(`挂单总量: ${listedSet.size} 块`)
  console.log(`剩余BNB: ${(Number(finalBal)/1e18).toFixed(4)}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
