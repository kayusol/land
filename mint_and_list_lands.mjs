// mint_and_list_lands.mjs — 铸造100块新土地并批量挂单
import { createWalletClient, createPublicClient, http, encodeFunctionData } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const PK = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const bscTestnet = {
  id:97, name:'BSC Testnet',
  nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},
  rpcUrls:{default:{http:['https://bsc-testnet-rpc.publicnode.com']}},
  contracts:{multicall3:{address:'0xcA11bde05977b3631167028862bE2a173976CA11'}}
}
const account = privateKeyToAccount(PK)
const wc = createWalletClient({account,chain:bscTestnet,transport:http('https://bsc-testnet-rpc.publicnode.com')})
const pc = createPublicClient({chain:bscTestnet,transport:http('https://bsc-testnet-rpc.publicnode.com')})

const LAND    = '0x889DCe5b3934D56f3814f93793F8e1f8710249ea'
const NFT_AUC = '0xe489Fd17B4aBF3b22482Bf0f09193f9902f1fd22'
const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'

const LAND_MINT_ABI=[{type:'function',name:'mint',inputs:[{name:'to',type:'address'},{name:'x',type:'int16'},{name:'y',type:'int16'},{name:'attr',type:'uint80'}],outputs:[],stateMutability:'nonpayable'}]
const OWN_ABI=[{type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view'}]
const APPR_ABI=[{type:'function',name:'setApprovalForAll',inputs:[{name:'op',type:'address'},{name:'v',type:'bool'}],outputs:[],stateMutability:'nonpayable'},{type:'function',name:'isApprovedForAll',inputs:[{name:'owner',type:'address'},{name:'op',type:'address'}],outputs:[{type:'bool'}],stateMutability:'view'}]
const AUC_ABI=[{type:'function',name:'createAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'},{name:'sp',type:'uint128'},{name:'ep',type:'uint128'},{name:'dur',type:'uint64'}],outputs:[],stateMutability:'nonpayable'},{type:'function',name:'getAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'}],outputs:[{components:[{name:'nftContract',type:'address'},{name:'seller',type:'address'},{name:'startPrice',type:'uint128'},{name:'endPrice',type:'uint128'},{name:'duration',type:'uint64'},{name:'startedAt',type:'uint64'}],type:'tuple'}],stateMutability:'view'}]

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 随机生成土地属性：5种资源各20-80
function randAttr(x, y) {
  const seed = (x * 137 + y * 31337) ^ 0xdeadbeef
  function rng(s) {
    let v = (s ^ 0xdeadbeef) >>> 0
    v = Math.imul(v ^ (v>>>16), 0x45d9f3b) >>> 0
    v = Math.imul(v ^ (v>>>16), 0x45d9f3b) >>> 0
    return ((v ^ (v>>>16)) >>> 0) / 0xffffffff
  }
  const vals = [0,1,2,3,4].map(i => Math.floor(20 + rng(seed + i * 1000) * 60))
  let attr = 0n
  for (let i = 0; i < 5; i++) attr |= BigInt(vals[i]) << BigInt(i * 16)
  return attr
}

async function sendTx(to, abi, fn, args) {
  const data = encodeFunctionData({abi, functionName: fn, args})
  for (let r = 0; r < 3; r++) {
    try {
      const gas = await pc.estimateGas({account: account.address, to, data}).catch(() => 300_000n)
      const hash = await wc.sendTransaction({to, data, gas: gas * 130n / 100n})
      const receipt = await pc.waitForTransactionReceipt({hash, timeout: 120000})
      if (receipt.status === 'reverted') throw new Error('reverted')
      await sleep(600)
      return hash
    } catch(e) {
      const m = (e.message||'').toLowerCase()
      if ((m.includes('rate')||m.includes('429')||m.includes('nonce')) && r < 2) {await sleep(3000*(r+1));continue}
      throw e
    }
  }
}

async function main() {
  console.log('账户:', account.address)
  const bal = await pc.getBalance({address: account.address})
  console.log('BNB余额:', Number(bal)/1e18)

  // ── 1. 确定需要铸造哪些地块 ──────────────────────────────────────
  // 已有 x=0-11, y=0-4 (60块)
  // 新增：
  //   区域A: x=12-19, y=0-4  → 8×5=40块
  //   区域B: x=0-11,  y=5-9  → 12×5=60块
  // 合计100块新地

  const toMint = []
  // 区域A
  for (let x = 12; x <= 19; x++) for (let y = 0; y <= 4; y++) toMint.push({x, y})
  // 区域B
  for (let x = 0;  x <= 11; x++) for (let y = 5; y <= 9; y++) toMint.push({x, y})

  console.log(`\n[1/3] 准备铸造 ${toMint.length} 块土地...`)

  // 检查哪些已存在（跳过）
  const ids = toMint.map(({x,y}) => x*100+y+1)
  const ownerRes = await pc.multicall({
    contracts: ids.map(id => ({address:LAND, abi:OWN_ABI, functionName:'ownerOf', args:[BigInt(id)]})),
    allowFailure: true
  })
  const need = toMint.filter((_, i) => !ownerRes[i]?.result || ownerRes[i].result === '0x0000000000000000000000000000000000000000')
  console.log(`  需要铸造: ${need.length} 块，已存在: ${toMint.length - need.length} 块`)

  // 铸造
  let minted = 0
  for (const {x, y} of need) {
    const id = x*100+y+1
    const attr = randAttr(x, y)
    process.stdout.write(`  铸造土地 #${id} (${x},${y})...`)
    try {
      await sendTx(LAND, LAND_MINT_ABI, 'mint', [DEPLOYER, x, y, attr])
      process.stdout.write(' ✅\n')
      minted++
    } catch(e) {
      process.stdout.write(` ❌ ${e.message?.slice(0,50)}\n`)
    }
  }
  console.log(`  铸造完成：${minted} 块`)

  // ── 2. 授权 NFTAuction ──────────────────────────────────────────
  console.log('\n[2/3] 检查授权...')
  const isAppr = await pc.readContract({address:LAND, abi:APPR_ABI, functionName:'isApprovedForAll', args:[DEPLOYER, NFT_AUC]}).catch(()=>false)
  if (!isAppr) {
    console.log('  授权 Land → NFTAuction...')
    await sendTx(LAND, APPR_ABI, 'setApprovalForAll', [NFT_AUC, true])
    console.log('  ✅ 授权完成')
  } else {
    console.log('  ✅ 已授权')
  }

  // ── 3. 批量挂单 ─────────────────────────────────────────────────
  console.log('\n[3/3] 批量挂单...')
  const allNew = [...toMint.map(({x,y})=>x*100+y+1)]

  // 检查当前owner + 是否已挂单
  const ownerRes2 = await pc.multicall({
    contracts: allNew.map(id => ({address:LAND, abi:OWN_ABI, functionName:'ownerOf', args:[BigInt(id)]})),
    allowFailure: true
  })
  const aucRes = await pc.multicall({
    contracts: allNew.map(id => ({address:NFT_AUC, abi:AUC_ABI, functionName:'getAuction', args:[LAND, BigInt(id)]})),
    allowFailure: true
  })

  let listed = 0
  for (let i = 0; i < allNew.length; i++) {
    const id = allNew[i]
    const owner = ownerRes2[i]?.result
    if (!owner || owner.toLowerCase() !== DEPLOYER.toLowerCase()) {
      console.log(`  ⏭ #${id} 不在我的钱包，跳过`)
      continue
    }
    const auc = aucRes[i]?.result
    if (auc && Number(auc.startedAt) > 0) {
      console.log(`  ⏭ #${id} 已挂单，跳过`)
      continue
    }
    // 定价：起拍5 RING，底价1 RING，3天荷兰拍
    const sp = BigInt(5e18.toString())
    const ep = BigInt(1e18.toString())
    const dur = BigInt(3*24*3600)
    process.stdout.write(`  挂单 #${id}...`)
    try {
      await sendTx(NFT_AUC, AUC_ABI, 'createAuction', [LAND, BigInt(id), sp, ep, dur])
      process.stdout.write(' ✅\n')
      listed++
    } catch(e) {
      process.stdout.write(` ❌ ${e.message?.slice(0,50)}\n`)
    }
  }

  console.log(`\n=== 完成 ===`)
  console.log(`铸造: ${minted} 块 | 挂单: ${listed} 块`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
