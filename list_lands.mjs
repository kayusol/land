// list_lands.mjs — 把钱包里的土地全部挂到市场
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
const AUC_ABI  = [{ type:'function',name:'createAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'},{name:'sp',type:'uint128'},{name:'ep',type:'uint128'},{name:'dur',type:'uint64'}],outputs:[],stateMutability:'nonpayable' }]
const CHK_ABI  = [{ type:'function',name:'getAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'}],outputs:[{components:[{name:'nftContract',type:'address'},{name:'seller',type:'address'},{name:'startPrice',type:'uint128'},{name:'endPrice',type:'uint128'},{name:'duration',type:'uint64'},{name:'startedAt',type:'uint64'}],type:'tuple'}],stateMutability:'view' }]

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function sendTx(to, abi, fn, args) {
  const data = encodeFunctionData({ abi, functionName: fn, args })
  // 每次都获取最新 nonce，避免 nonce 冲突
  const nonce = await pc.getTransactionCount({ address: account.address, blockTag: 'pending' })
  const gas = await pc.estimateGas({ account: account.address, to, data }).catch(() => 200_000n)
  const hash = await wc.sendTransaction({ to, data, gas: gas * 130n / 100n, nonce })
  const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 120000 })
  if (receipt.status === 'reverted') throw new Error('reverted')
  await sleep(300)
  return hash
}

async function main() {
  console.log('账户:', account.address)

  // 扫描所有土地，找在钱包里的
  console.log('\n扫描土地...')
  const allIds = []
  for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) allIds.push(x * 100 + y + 1)
  // 只扫 x=0-39 范围（已知铸造区域）
  const scanIds = allIds.filter(id => Math.floor((id-1)/100) < 40)

  const ownerRes = await pc.multicall({
    contracts: scanIds.map(id => ({ address: LAND, abi: OWN_ABI, functionName: 'ownerOf', args: [BigInt(id)] })),
    allowFailure: true
  })
  const walletIds = scanIds.filter((_, i) => ownerRes[i]?.result?.toLowerCase() === DEPLOYER.toLowerCase())
  console.log('钱包里的土地:', walletIds.length, '块')
  if (!walletIds.length) { console.log('没有土地需要挂单'); return }

  // 授权
  console.log('\n检查授权...')
  const isAppr = await pc.readContract({ address: LAND, abi: APPR_ABI, functionName: 'isApprovedForAll', args: [DEPLOYER, NFT_AUC] })
  if (!isAppr) {
    console.log('授权中...')
    await sendTx(LAND, APPR_ABI, 'setApprovalForAll', [NFT_AUC, true])
    console.log('✅ 授权完成')
  } else { console.log('✅ 已授权') }

  // 挂单（起拍8 RING，底价1 RING，30天）
  const SP = parseEther('8'), EP = parseEther('1'), DUR = BigInt(30 * 24 * 3600)
  console.log('\n开始挂单...')
  let listed = 0, skipped = 0

  for (const id of walletIds) {
    // 确认还在钱包里（实时检查）
    const owner = await pc.readContract({ address: LAND, abi: OWN_ABI, functionName: 'ownerOf', args: [BigInt(id)] }).catch(() => null)
    if (!owner || owner.toLowerCase() !== DEPLOYER.toLowerCase()) { skipped++; continue }
    // 检查是否已挂单
    const auc = await pc.readContract({ address: NFT_AUC, abi: CHK_ABI, functionName: 'getAuction', args: [LAND, BigInt(id)] }).catch(() => null)
    if (auc?.startedAt > 0n) { process.stdout.write(`⏭${id} `); skipped++; continue }
    process.stdout.write(`\n  挂单 #${id}...`)
    try {
      await sendTx(NFT_AUC, AUC_ABI, 'createAuction', [LAND, BigInt(id), SP, EP, DUR])
      process.stdout.write('✅')
      listed++
    } catch(e) {
      process.stdout.write('❌ ' + e.message?.slice(0, 40))
    }
  }

  console.log(`\n\n=== 完成 ===`)
  console.log(`挂单: ${listed} 块  跳过: ${skipped} 块`)
}

main().catch(e => { console.error('错误:', e.message); process.exit(1) })
