import { createWalletClient, createPublicClient, http, encodeFunctionData, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'

const account = privateKeyToAccount('0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf')
const wc = createWalletClient({ account, chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })
const pc = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })

const DRL     = '0x782827AdA353d4f958964e1E10D5d940e4B38409'
const NFT_AUC = '0xe489Fd17B4aBF3b22482Bf0f09193f9902f1fd22'
const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'

const OWN  = [{ type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view' }]
const ATT  = [{ type:'function',name:'attrs',inputs:[{name:'id',type:'uint256'}],outputs:[{name:'tier',type:'uint8'},{name:'affinity',type:'uint8'}],stateMutability:'view' }]
const NEXT = [{ type:'function',name:'nextId',inputs:[],outputs:[{type:'uint256'}],stateMutability:'view' }]
const CHK  = [{ type:'function',name:'getAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'}],outputs:[{components:[{name:'nftContract',type:'address'},{name:'seller',type:'address'},{name:'startPrice',type:'uint128'},{name:'endPrice',type:'uint128'},{name:'duration',type:'uint64'},{name:'startedAt',type:'uint64'}],type:'tuple'}],stateMutability:'view' }]
const AUC  = [{ type:'function',name:'createAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'},{name:'sp',type:'uint128'},{name:'ep',type:'uint128'},{name:'dur',type:'uint64'}],outputs:[],stateMutability:'nonpayable' }]

const sleep = ms => new Promise(r => setTimeout(r, ms))
const PRICES = {
  1: { sp: parseEther('0.5'), ep: parseEther('0.1') },
  2: { sp: parseEther('1'),   ep: parseEther('0.2') },
  3: { sp: parseEther('2'),   ep: parseEther('0.4') },
  4: { sp: parseEther('4'),   ep: parseEther('0.8') },
  5: { sp: parseEther('8'),   ep: parseEther('1.5') },
}
const DUR = BigInt(30 * 24 * 3600)

async function main() {
  // 从已确认 nonce 开始，本地递增
  let nonce = await pc.getTransactionCount({ address: account.address })
  console.log('起始nonce:', nonce)

  async function sendTx(to, abi, fn, args) {
    const data = encodeFunctionData({ abi, functionName: fn, args })
    const gas = await pc.estimateGas({ account: account.address, to, data }).catch(() => 200_000n)
    const hash = await wc.sendTransaction({ to, data, gas: gas * 130n / 100n, nonce })
    nonce++
    const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 60000 })
    if (receipt.status === 'reverted') throw new Error('reverted')
    await sleep(100)
    return hash
  }

  // 扫描钱包里的钻头
  const nextId = Number(await pc.readContract({ address: DRL, abi: NEXT, functionName: 'nextId' }))
  const ids = Array.from({ length: nextId - 1 }, (_, i) => i + 1)
  const BATCH = 100, walletIds = [], attrMap = {}

  console.log('扫描', nextId-1, '个钻头...')
  for (let s = 0; s < ids.length; s += BATCH) {
    const batch = ids.slice(s, s + BATCH)
    const [ownerRes, attrRes] = await Promise.all([
      pc.multicall({ contracts: batch.map(id => ({ address: DRL, abi: OWN, functionName: 'ownerOf', args: [BigInt(id)] })), allowFailure: true }),
      pc.multicall({ contracts: batch.map(id => ({ address: DRL, abi: ATT, functionName: 'attrs', args: [BigInt(id)] })), allowFailure: true }),
    ])
    batch.forEach((id, i) => {
      if (ownerRes[i]?.result?.toLowerCase() === DEPLOYER.toLowerCase()) {
        walletIds.push(id)
        const a = attrRes[i]?.result
        if (a) attrMap[id] = { tier: Number(a[0]) }
      }
    })
  }
  console.log('钱包钻头:', walletIds.length, '个')

  let listed = 0, skip = 0, errors = 0
  console.log('开始挂单...')
  for (const id of walletIds) {
    // 检查是否已挂单
    const auc = await pc.readContract({ address: NFT_AUC, abi: CHK, functionName: 'getAuction', args: [DRL, BigInt(id)] }).catch(() => null)
    if (auc?.startedAt > 0n) { skip++; continue }
    const tier = attrMap[id]?.tier || 1
    const { sp, ep } = PRICES[tier] || PRICES[1]
    try {
      await sendTx(NFT_AUC, AUC, 'createAuction', [DRL, BigInt(id), sp, ep, DUR])
      listed++
      if (listed % 30 === 0) process.stdout.write(`\r  ${listed}/${walletIds.length} 已挂单...   `)
    } catch(e) {
      errors++
      // nonce错误时从链上重取
      if (e.message?.toLowerCase().includes('nonce')) {
        nonce = await pc.getTransactionCount({ address: account.address })
      }
      if (errors <= 3) process.stdout.write(`\n  ERR#${id}: ${e.message?.slice(0, 50)}\n`)
    }
  }

  const bal = await pc.getBalance({ address: account.address })
  console.log(`\n\n=== 完成 ===`)
  console.log(`挂单: ${listed}  跳过已挂: ${skip}  错误: ${errors}`)
  console.log(`剩余BNB: ${(Number(bal)/1e18).toFixed(4)}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
