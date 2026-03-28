// mint_drills.mjs — 铸造300个钻头并挂到市场（修复nonce问题）
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'

const PK = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const account = privateKeyToAccount(PK)
const wc = createWalletClient({ account, chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })
const pc = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })

const DRL     = '0x782827AdA353d4f958964e1E10D5d940e4B38409'
const NFT_AUC = '0xe489Fd17B4aBF3b22482Bf0f09193f9902f1fd22'
const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'

const NEXT_ABI = [{ type:'function',name:'nextId',inputs:[],outputs:[{type:'uint256'}],stateMutability:'view' }]
const OWN_ABI  = [{ type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view' }]
const MINT_ABI = [{ type:'function',name:'mint',inputs:[{name:'to',type:'address'},{name:'tier',type:'uint8'},{name:'affinity',type:'uint8'}],outputs:[{type:'uint256'}],stateMutability:'nonpayable' }]
const ATT_ABI  = [{ type:'function',name:'attrs',inputs:[{name:'id',type:'uint256'}],outputs:[{name:'tier',type:'uint8'},{name:'affinity',type:'uint8'}],stateMutability:'view' }]
const OP_ABI   = [
  { type:'function',name:'operators',inputs:[{name:'a',type:'address'}],outputs:[{type:'bool'}],stateMutability:'view' },
  { type:'function',name:'setOperator',inputs:[{name:'a',type:'address'},{name:'v',type:'bool'}],outputs:[],stateMutability:'nonpayable' },
]
const AUC_ABI  = [{ type:'function',name:'createAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'},{name:'sp',type:'uint128'},{name:'ep',type:'uint128'},{name:'dur',type:'uint64'}],outputs:[],stateMutability:'nonpayable' }]
const CHK_ABI  = [{ type:'function',name:'getAuction',inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'}],outputs:[{components:[{name:'nftContract',type:'address'},{name:'seller',type:'address'},{name:'startPrice',type:'uint128'},{name:'endPrice',type:'uint128'},{name:'duration',type:'uint64'},{name:'startedAt',type:'uint64'}],type:'tuple'}],stateMutability:'view' }]

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 本地nonce管理 - 避免每次查链
let currentNonce = null
async function getNonce() {
  if (currentNonce === null) {
    currentNonce = await pc.getTransactionCount({ address: account.address, blockTag: 'pending' })
  }
  return currentNonce
}

async function sendTx(to, abi, fn, args) {
  const data = encodeFunctionData({ abi, functionName: fn, args })
  for (let r = 0; r < 3; r++) {
    try {
      const nonce = await getNonce()
      const gas = await pc.estimateGas({ account: account.address, to, data }).catch(() => 200_000n)
      const hash = await wc.sendTransaction({ to, data, gas: gas*130n/100n, nonce })
      currentNonce = nonce + 1  // 本地递增
      const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 60000 })
      if (receipt.status === 'reverted') throw new Error('reverted')
      await sleep(200)
      return hash
    } catch(e) {
      const m = (e.message||'').toLowerCase()
      if (r < 2 && (m.includes('nonce') || m.includes('rate') || m.includes('429'))) {
        // nonce错误时从链上重新获取
        currentNonce = await pc.getTransactionCount({ address: account.address, blockTag: 'pending' })
        await sleep(2000*(r+1))
        continue
      }
      throw e
    }
  }
}

// 铸造计划：300个，按比例分配星级和元素
const MINT_PLAN = []
const DIST = [[1,120],[2,80],[3,60],[4,30],[5,10]]
DIST.forEach(([tier, count]) => {
  for (let i = 0; i < count; i++) MINT_PLAN.push({ tier, affinity: i % 5 })
})

// 按星级定价
const PRICES = {
  1: { sp: parseEther('0.5'), ep: parseEther('0.1') },
  2: { sp: parseEther('1'),   ep: parseEther('0.2') },
  3: { sp: parseEther('2'),   ep: parseEther('0.4') },
  4: { sp: parseEther('4'),   ep: parseEther('0.8') },
  5: { sp: parseEther('8'),   ep: parseEther('1.5') },
}
const DUR = BigInt(30 * 24 * 3600)

async function main() {
  console.log('账户:', account.address)
  const bal = await pc.getBalance({ address: account.address })
  console.log('BNB余额:', (Number(bal)/1e18).toFixed(4))

  // 初始化本地nonce
  currentNonce = await pc.getTransactionCount({ address: account.address, blockTag: 'pending' })
  console.log('起始nonce:', currentNonce)

  // 授权检查
  const isOp = await pc.readContract({ address: DRL, abi: OP_ABI, functionName: 'operators', args: [NFT_AUC] }).catch(() => false)
  if (!isOp) {
    console.log('授权 Drill→NFTAuction...')
    await sendTx(DRL, OP_ABI, 'setOperator', [NFT_AUC, true])
    console.log('✅ 授权完成')
  } else { console.log('✅ 已授权') }

  const startNextId = Number(await pc.readContract({ address: DRL, abi: NEXT_ABI, functionName: 'nextId' }))
  console.log(`\n计划铸造: ${MINT_PLAN.length} 个 (1★×120 2★×80 3★×60 4★×30 5★×10)`)
  console.log(`当前nextId: ${startNextId}`)

  // === 铸造 ===
  console.log('\n=== 铸造中 ===')
  let minted = 0, errors = 0
  for (const { tier, affinity } of MINT_PLAN) {
    try {
      await sendTx(DRL, MINT_ABI, 'mint', [DEPLOYER, tier, affinity])
      minted++
      if (minted % 30 === 0) {
        process.stdout.write(`\r  ${minted}/${MINT_PLAN.length} 已铸造...   `)
      }
    } catch(e) {
      errors++
      if (errors <= 5) process.stdout.write(`\n  ❌ tier${tier}: ${e.message?.slice(0,50)}\n`)
    }
  }
  console.log(`\n铸造: ${minted} 成功  ${errors} 失败`)

  // === 挂单 ===
  console.log('\n=== 挂单 ===')
  const endNextId = Number(await pc.readContract({ address: DRL, abi: NEXT_ABI, functionName: 'nextId' }))
  const allIds = Array.from({ length: endNextId-1 }, (_, i) => i+1)
  const BATCH = 100, walletIds = [], attrMap = {}

  for (let s = 0; s < allIds.length; s += BATCH) {
    const batch = allIds.slice(s, s+BATCH)
    const [ownerRes, attrRes] = await Promise.all([
      pc.multicall({ contracts: batch.map(id=>({address:DRL,abi:OWN_ABI,functionName:'ownerOf',args:[BigInt(id)]})), allowFailure:true }),
      pc.multicall({ contracts: batch.map(id=>({address:DRL,abi:ATT_ABI,functionName:'attrs',args:[BigInt(id)]})), allowFailure:true }),
    ])
    batch.forEach((id, i) => {
      if (ownerRes[i]?.result?.toLowerCase() === DEPLOYER.toLowerCase()) {
        walletIds.push(id)
        const a = attrRes[i]?.result
        if (a) attrMap[id] = { tier: Number(a[0]) }
      }
    })
  }
  console.log(`钱包钻头: ${walletIds.length} 个`)

  let listed = 0
  for (const id of walletIds) {
    const auc = await pc.readContract({ address: NFT_AUC, abi: CHK_ABI, functionName: 'getAuction', args: [DRL, BigInt(id)] }).catch(()=>null)
    if (auc?.startedAt > 0n) continue
    const tier = attrMap[id]?.tier || 1
    const { sp, ep } = PRICES[tier] || PRICES[1]
    try {
      await sendTx(NFT_AUC, AUC_ABI, 'createAuction', [DRL, BigInt(id), sp, ep, DUR])
      listed++
      if (listed % 20 === 0) process.stdout.write(`\r  ${listed}/${walletIds.length} 已挂单...   `)
    } catch(e) { process.stdout.write(`\n  ❌ #${id}: ${e.message?.slice(0,40)}\n`) }
  }

  const finalBal = await pc.getBalance({ address: account.address })
  console.log(`\n\n=== 完成 ===`)
  console.log(`铸造: ${minted}  挂单: ${listed}`)
  console.log(`剩余BNB: ${(Number(finalBal)/1e18).toFixed(4)}`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
