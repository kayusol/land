// mint100.mjs — 铸造100块土地 (x=20-29, y=0-9) 并挂到市场
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'

const PK = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const account = privateKeyToAccount(PK)
const wc = createWalletClient({ account, chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })
const pc = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })

const LAND    = '0x889DCe5b3934D56f3814f93793F8e1f8710249ea'
const NFT_AUC = '0xe489Fd17B4aBF3b22482Bf0f09193f9902f1fd22'
const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'

const MINT_ABI = [{ type:'function',name:'mint',inputs:[{name:'to',type:'address'},{name:'x',type:'int16'},{name:'y',type:'int16'},{name:'attr',type:'uint80'}],outputs:[],stateMutability:'nonpayable' }]
const OWN_ABI  = [{ type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view' }]
const APPR_ABI = [
  { type:'function',name:'isApprovedForAll',inputs:[{name:'o',type:'address'},{name:'s',type:'address'}],outputs:[{type:'bool'}],stateMutability:'view' },
  { type:'function',name:'setApprovalForAll',inputs:[{name:'op',type:'address'},{name:'v',type:'bool'}],outputs:[],stateMutability:'nonpayable' }
]
const AUC_ABI  = [{ type:'function',name:'createAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'},{name:'sp',type:'uint128'},{name:'ep',type:'uint128'},{name:'dur',type:'uint64'}],outputs:[],stateMutability:'nonpayable' }]
const CHK_ABI  = [{ type:'function',name:'getAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'}],outputs:[{components:[{name:'nftContract',type:'address'},{name:'seller',type:'address'},{name:'startPrice',type:'uint128'},{name:'endPrice',type:'uint128'},{name:'duration',type:'uint64'},{name:'startedAt',type:'uint64'}],type:'tuple'}],stateMutability:'view' }]

const sleep = ms => new Promise(r => setTimeout(r, ms))

function makeAttr(x, y) {
  // 每种资源值 30-70，确保5个值打包后不超过 uint80 (max ~1.2e24)
  // uint80 = 16位 × 5种，每种最大 65535，这里用 30-70 安全范围
  const rng = (s) => { let v=((x*137+y*31+s*97)^0xdeadbeef)>>>0; v=Math.imul(v^(v>>>16),0x45d9f3b)>>>0; return((v^(v>>>16))>>>0)/0xffffffff }
  let a=0n
  for(let i=0;i<5;i++){
    const val = BigInt(Math.floor(30 + rng(i+1) * 41))  // 30-70，安全范围
    a |= val << BigInt(i*16)
  }
  return a
}

async function sendTx(to, abi, fn, args) {
  const data = encodeFunctionData({ abi, functionName: fn, args })
  for (let r = 0; r < 3; r++) {
    try {
      const gas = await pc.estimateGas({ account: account.address, to, data }).catch(() => 300_000n)
      const hash = await wc.sendTransaction({ to, data, gas: gas*130n/100n })
      const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 120000 })
      if (receipt.status === 'reverted') throw new Error('reverted')
      await sleep(600)
      return hash
    } catch(e) {
      const m = (e.message||'').toLowerCase()
      if ((m.includes('rate')||m.includes('429')||m.includes('nonce')) && r<2) { await sleep(3000*(r+1)); continue }
      throw e
    }
  }
}

async function main() {
  console.log('账户:', account.address)
  const bal = await pc.getBalance({ address: account.address })
  console.log('BNB余额:', (Number(bal)/1e18).toFixed(4))

  const lands = []
  for (let x=20;x<=29;x++) for (let y=0;y<=9;y++) lands.push({x,y})
  console.log(`\n目标: 铸造${lands.length}块土地 x=20-29,y=0-9`)

  // 阶段1: 铸造
  console.log('\n--- 阶段1: 铸造 ---')
  let minted=0, skipped=0
  for (const {x,y} of lands) {
    const id = x*100+y+1
    const owner = await pc.readContract({address:LAND,abi:OWN_ABI,functionName:'ownerOf',args:[BigInt(id)]}).catch(()=>null)
    const exists = owner && owner !== '0x0000000000000000000000000000000000000000'
    if (exists) { process.stdout.write(`⏭#${id} `); skipped++; continue }
    process.stdout.write(`\n  铸造#${id}(${x},${y})...`)
    try {
      await sendTx(LAND, MINT_ABI, 'mint', [DEPLOYER, x, y, makeAttr(x,y)])
      process.stdout.write('✅')
      minted++
    } catch(e) { process.stdout.write('❌'+e.message?.slice(0,30)) }
  }
  console.log(`\n铸造完成: 新铸造${minted} 已存在${skipped}`)

  // 阶段2: 授权
  console.log('\n--- 阶段2: 授权 ---')
  const isAppr = await pc.readContract({address:LAND,abi:APPR_ABI,functionName:'isApprovedForAll',args:[DEPLOYER,NFT_AUC]}).catch(()=>false)
  if (!isAppr) {
    console.log('  授权Land→NFTAuction...')
    await sendTx(LAND, APPR_ABI, 'setApprovalForAll', [NFT_AUC, true])
    console.log('  ✅ 授权完成')
  } else { console.log('  ✅ 已授权') }

  // 阶段3: 挂单
  console.log('\n--- 阶段3: 挂单 ---')
  const SP = parseEther('8'), EP = parseEther('1'), DUR = BigInt(30*24*3600)
  let listed=0, lskip=0
  for (const {x,y} of lands) {
    const id = x*100+y+1
    const owner = await pc.readContract({address:LAND,abi:OWN_ABI,functionName:'ownerOf',args:[BigInt(id)]}).catch(()=>null)
    const valid = owner && owner !== '0x0000000000000000000000000000000000000000'
    if (!valid||owner.toLowerCase()!==DEPLOYER.toLowerCase()) { lskip++; continue }
    const auc = await pc.readContract({address:NFT_AUC,abi:CHK_ABI,functionName:'getAuction',args:[LAND,BigInt(id)]}).catch(()=>null)
    if (auc?.startedAt>0n) { process.stdout.write(`⏭#${id} `); lskip++; continue }
    process.stdout.write(`\n  挂单#${id}(${x},${y}) 8→1RING...`)
    try {
      await sendTx(NFT_AUC, AUC_ABI, 'createAuction', [LAND, BigInt(id), SP, EP, DUR])
      process.stdout.write('✅')
      listed++
    } catch(e) { process.stdout.write('❌'+e.message?.slice(0,30)) }
  }

  console.log(`\n\n=== 完成 ===`)
  console.log(`铸造: ${minted}块  挂单: ${listed}块  跳过: ${skipped+lskip}块`)
}

main().catch(e => { console.error('错误:', e.message); process.exit(1) })
