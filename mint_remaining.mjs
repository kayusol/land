// mint_remaining.mjs — 铸造剩余未铸造土地并挂单
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
  const nonce = await pc.getTransactionCount({ address: account.address, blockTag: 'pending' })
  const gas = await pc.estimateGas({ account: account.address, to, data }).catch(() => 200_000n)
  const hash = await wc.sendTransaction({ to, data, gas: gas*130n/100n, nonce })
  const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 120000 })
  if (receipt.status === 'reverted') throw new Error('reverted')
  await sleep(300)
  return hash
}

async function main() {
  console.log('账户:', account.address)
  const bal = await pc.getBalance({ address: account.address })
  console.log('BNB:', (Number(bal)/1e18).toFixed(4))

  // 扫描 x=0-39, y=0-9
  const scanIds = []; for(let x=0;x<40;x++) for(let y=0;y<10;y++) scanIds.push(x*100+y+1)
  console.log('\n扫描...')
  const ownerRes = await pc.multicall({
    contracts: scanIds.map(id => ({ address: LAND, abi: OWN_ABI, functionName: 'ownerOf', args: [BigInt(id)] })),
    allowFailure: true
  })
  const unmintedIds = scanIds.filter((_,i) => {
    const o = ownerRes[i]?.result?.toLowerCase()
    return !o || o === '0x0000000000000000000000000000000000000000'
  })
  const walletIds = scanIds.filter((_,i) => ownerRes[i]?.result?.toLowerCase() === DEPLOYER.toLowerCase())
  console.log('未铸造:', unmintedIds.length, '  在钱包:', walletIds.length)

  // 检查授权
  const isAppr = await pc.readContract({ address: LAND, abi: APPR_ABI, functionName: 'isApprovedForAll', args: [DEPLOYER, NFT_AUC] })
  if (!isAppr) {
    console.log('授权中...')
    await sendTx(LAND, APPR_ABI, 'setApprovalForAll', [NFT_AUC, true])
    console.log('✅ 授权完成')
  }

  // 铸造未铸造的
  const SP = parseEther('8'), EP = parseEther('1'), DUR = BigInt(30*24*3600)
  let minted=0, listed=0, errors=0

  if (unmintedIds.length > 0) {
    console.log('\n--- 铸造 ---')
    for (const id of unmintedIds) {
      const x = Math.floor((id-1)/100)
      const y = (id-1) % 100
      process.stdout.write(`#${id}(${x},${y})...`)
      try {
        await sendTx(LAND, MINT_ABI, 'mint', [DEPLOYER, x, y, makeAttr(x,y)])
        process.stdout.write('✅ ')
        minted++
      } catch(e) {
        process.stdout.write('❌ ')
        errors++
      }
    }
    console.log(`\n铸造: ${minted} 成功, ${errors} 失败`)
  }

  // 把钱包里所有地（铸造的+新铸造的）挂单
  console.log('\n--- 挂单 ---')
  // 重新扫描钱包
  const ownerRes2 = await pc.multicall({
    contracts: scanIds.map(id => ({ address: LAND, abi: OWN_ABI, functionName: 'ownerOf', args: [BigInt(id)] })),
    allowFailure: true
  })
  const toListIds = scanIds.filter((_,i) => ownerRes2[i]?.result?.toLowerCase() === DEPLOYER.toLowerCase())
  console.log('待挂单:', toListIds.length, '块')

  for (const id of toListIds) {
    const auc = await pc.readContract({ address: NFT_AUC, abi: CHK_ABI, functionName: 'getAuction', args: [LAND, BigInt(id)] }).catch(()=>null)
    if (auc?.startedAt > 0n) { process.stdout.write(`⏭${id} `); continue }
    process.stdout.write(`\n  挂单#${id}...`)
    try {
      await sendTx(NFT_AUC, AUC_ABI, 'createAuction', [LAND, BigInt(id), SP, EP, DUR])
      process.stdout.write('✅')
      listed++
    } catch(e) { process.stdout.write('❌'+e.message?.slice(0,30)) }
  }

  console.log(`\n\n=== 完成 ===  铸造:${minted} 挂单:${listed}`)
}

main().catch(e => { console.error('错误:', e.message); process.exit(1) })
