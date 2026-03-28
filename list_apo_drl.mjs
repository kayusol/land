// list_apo_drl.mjs — 把钱包里所有使徒和钻头挂到市场
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'

const PK = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const account = privateKeyToAccount(PK)
const wc = createWalletClient({ account, chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })
const pc = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })

const APO     = '0xbBce394d561E67bA9C0720d3aD56b25bC12Ee4f0'
const DRL     = '0x782827AdA353d4f958964e1E10D5d940e4B38409'
const NFT_AUC = '0xe489Fd17B4aBF3b22482Bf0f09193f9902f1fd22'
const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'

const OWN_ABI  = [{ type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view' }]
const NEXT_ABI = [{ type:'function',name:'nextId',inputs:[],outputs:[{type:'uint256'}],stateMutability:'view' }]
const APO_ABI  = [{ type:'function',name:'attrs',inputs:[{name:'id',type:'uint256'}],outputs:[{name:'strength',type:'uint8'},{name:'element',type:'uint8'}],stateMutability:'view' }]
const DRL_ABI  = [{ type:'function',name:'attrs',inputs:[{name:'id',type:'uint256'}],outputs:[{name:'tier',type:'uint8'},{name:'affinity',type:'uint8'}],stateMutability:'view' }]
const OP_ABI   = [
  { type:'function',name:'operators',inputs:[{name:'a',type:'address'}],outputs:[{type:'bool'}],stateMutability:'view' },
  { type:'function',name:'setOperator',inputs:[{name:'a',type:'address'},{name:'v',type:'bool'}],outputs:[],stateMutability:'nonpayable' },
]
const AUC_ABI  = [{ type:'function',name:'createAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'},{name:'sp',type:'uint128'},{name:'ep',type:'uint128'},{name:'dur',type:'uint64'}],outputs:[],stateMutability:'nonpayable' }]
const CHK_ABI  = [{ type:'function',name:'getAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'}],outputs:[{components:[{name:'nftContract',type:'address'},{name:'seller',type:'address'},{name:'startPrice',type:'uint128'},{name:'endPrice',type:'uint128'},{name:'duration',type:'uint64'},{name:'startedAt',type:'uint64'}],type:'tuple'}],stateMutability:'view' }]

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function sendTx(to, abi, fn, args) {
  const data = encodeFunctionData({ abi, functionName: fn, args })
  const nonce = await pc.getTransactionCount({ address: account.address, blockTag: 'pending' })
  const gas = await pc.estimateGas({ account: account.address, to, data }).catch(() => 200_000n)
  const hash = await wc.sendTransaction({ to, data, gas: gas * 130n / 100n, nonce })
  const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 120000 })
  if (receipt.status === 'reverted') throw new Error('reverted')
  await sleep(300)
  return hash
}

async function scanWallet(contract, abi, nextAbi) {
  const nextId = Number(await pc.readContract({ address: contract, abi: nextAbi, functionName: 'nextId' }))
  const total = nextId - 1
  const BATCH = 100, myIds = []
  for (let s = 1; s <= total; s += BATCH) {
    const batch = Array.from({ length: Math.min(BATCH, total - s + 1) }, (_, i) => s + i)
    const res = await pc.multicall({ contracts: batch.map(id => ({ address: contract, abi: OWN_ABI, functionName: 'ownerOf', args: [BigInt(id)] })), allowFailure: true })
    batch.forEach((id, i) => { if (res[i]?.result?.toLowerCase() === DEPLOYER.toLowerCase()) myIds.push(id) })
  }
  return myIds
}

async function ensureOperator(contract) {
  const isOp = await pc.readContract({ address: contract, abi: OP_ABI, functionName: 'operators', args: [NFT_AUC] }).catch(() => false)
  if (!isOp) {
    console.log('  setOperator...')
    await sendTx(contract, OP_ABI, 'setOperator', [NFT_AUC, true])
    console.log('  ✅')
  } else { console.log('  ✅ 已授权') }
}

async function listNFTs(contract, ids, label, getPriceFn) {
  let listed = 0, skipped = 0
  for (const id of ids) {
    const auc = await pc.readContract({ address: NFT_AUC, abi: CHK_ABI, functionName: 'getAuction', args: [contract, BigInt(id)] }).catch(() => null)
    if (auc?.startedAt > 0n) { process.stdout.write(`⏭${id} `); skipped++; continue }
    const { sp, ep } = await getPriceFn(id)
    process.stdout.write(`\n  挂单${label}#${id} ${Number(sp)/1e18}→${Number(ep)/1e18}R...`)
    try {
      await sendTx(NFT_AUC, AUC_ABI, 'createAuction', [contract, BigInt(id), sp, ep, BigInt(30 * 24 * 3600)])
      process.stdout.write('✅')
      listed++
    } catch(e) { process.stdout.write('❌' + e.message?.slice(0, 30)) }
  }
  return { listed, skipped }
}

async function main() {
  console.log('账户:', account.address)

  // ── 使徒 ──
  console.log('\n=== 扫描使徒 ===')
  const apoIds = await scanWallet(APO, APO_ABI, NEXT_ABI)
  console.log('钱包使徒:', apoIds.length, '个')

  if (apoIds.length > 0) {
    console.log('授权使徒...')
    await ensureOperator(APO)

    // 读取使徒属性（力量决定价格）
    const apoAttrs = await pc.multicall({ contracts: apoIds.map(id => ({ address: APO, abi: APO_ABI, functionName: 'attrs', args: [BigInt(id)] })), allowFailure: true })
    const apoAttrMap = {}
    apoIds.forEach((id, i) => { apoAttrMap[id] = apoAttrs[i]?.result })

    const { listed: apoListed } = await listNFTs(APO, apoIds, '使徒', async (id) => {
      const a = apoAttrMap[id]
      const str = a ? Number(a[0]) : 50
      // 力量越高价格越高：1-30→1R 31-50→2R 51-70→3R 71-85→5R 86-100→8R
      const sp = str <= 30 ? parseEther('1') : str <= 50 ? parseEther('2') : str <= 70 ? parseEther('3') : str <= 85 ? parseEther('5') : parseEther('8')
      const ep = parseEther('0.3')
      return { sp, ep }
    })
    console.log(`\n使徒挂单完成: ${apoListed}个`)
  }

  // ── 钻头 ──
  console.log('\n=== 扫描钻头 ===')
  const drlIds = await scanWallet(DRL, DRL_ABI, NEXT_ABI)
  console.log('钱包钻头:', drlIds.length, '个')

  if (drlIds.length > 0) {
    console.log('授权钻头...')
    await ensureOperator(DRL)

    const drlAttrs = await pc.multicall({ contracts: drlIds.map(id => ({ address: DRL, abi: DRL_ABI, functionName: 'attrs', args: [BigInt(id)] })), allowFailure: true })
    const drlAttrMap = {}
    drlIds.forEach((id, i) => { drlAttrMap[id] = drlAttrs[i]?.result })

    const { listed: drlListed } = await listNFTs(DRL, drlIds, '钻头', async (id) => {
      const a = drlAttrMap[id]
      const tier = a ? Number(a[0]) : 1
      // 星级定价: 1★→0.5R 2★→1R 3★→2R 4★→4R 5★→8R
      const prices = [0n, parseEther('0.5'), parseEther('1'), parseEther('2'), parseEther('4'), parseEther('8')]
      const sp = prices[tier] || parseEther('0.5')
      const ep = parseEther('0.1')
      return { sp, ep }
    })
    console.log(`\n钻头挂单完成: ${drlListed}个`)
  }

  console.log('\n=== 全部完成 ===')
}

main().catch(e => { console.error('错误:', e.message); process.exit(1) })
