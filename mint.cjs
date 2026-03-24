/**
 * mint.cjs - 直接用私钥发交易，绕过前端钱包
 * 运行: node mint.cjs
 * 需要: npm install ethers (v6)
 */
const { ethers } = require('ethers')

// ── 配置 ──────────────────────────────────────────────────────
// 从 .env 或直接填入私钥（部署者私钥）
const PRIVATE_KEY = process.env.PRIVATE_KEY || 'YOUR_DEPLOYER_PRIVATE_KEY_HERE'
const RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545'

const ADDR = {
  ring:        '0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',
  gold:        '0xbFaEb7b0BeD3684051F8d087717009eEd131C69f',
  wood:        '0x138C98Ca717917C584D878028bB02fB0BAc6E2c4',
  water:       '0x3618bCa0A8B4a56E1cC57b6B6F4e145104f4ea49',
  fire:        '0x3fb8134A6FFedc5bc467179905955fbE25780B33',
  soil:        '0xedAED55F28480839C5417D54160a1E0dDA7E9f13',
  land:        '0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  drill:       '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  apostle:     '0x3D06422b6623b422c4152cd53231f0F45232197A',
  mining:      '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  auction:     '0x6dfAEDBD161f99d655a818AF23377344FB16db1a',
  initializer: '0x78707C585E3C28D6f861b9b3Ef14b0e665f52a7B',
  router:      '0xD99D1c33F9fC3444f8101754aBC46c52416550d1',
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function sendTx(contract, fn, args, opts = {}) {
  for (let retry = 0; retry < 5; retry++) {
    try {
      const tx = await contract[fn](...args, opts)
      console.log(`  tx: ${tx.hash}`)
      const rc = await tx.wait()
      await sleep(1500)
      return rc
    } catch (e) {
      const msg = e.message || ''
      if (msg.includes('rate') || msg.includes('429') || msg.includes('limit')) {
        const wait = 3000 * Math.pow(2, retry)
        console.log(`  ⚠ 限速，等待 ${wait}ms 后重试...`)
        await sleep(wait)
        continue
      }
      throw e
    }
  }
}

function encodeAttr(g, w, wa, f, s) {
  return (BigInt(g) | (BigInt(w)<<16n) | (BigInt(wa)<<32n) | (BigInt(f)<<48n) | (BigInt(s)<<64n))
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC)
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider)
  console.log('🔑 钱包:', wallet.address)
  const bal = await provider.getBalance(wallet.address)
  console.log('💰 余额:', ethers.formatEther(bal), 'tBNB\n')

  // ── 先检查合约 owner ──────────────────────────────────────
  const ownerABI = ['function owner() view returns (address)']
  const initC = new ethers.Contract(ADDR.initializer, ownerABI, provider)
  const initOwner = await initC.owner()
  console.log('📋 LandInitializer.owner:', initOwner)
  console.log('📋 你的地址:              ', wallet.address)
  if (initOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error('❌ 你不是 LandInitializer 的 owner，无法调用 batchMint!')
    console.error('   需要用部署时的私钥，或者检查 .env 文件')
    process.exit(1)
  }
  console.log('✅ owner 验证通过\n')

  // ABIs
  const INIT_ABI = ['function batchMint(int16[] xs, int16[] ys, uint80[] attrs, address to) external']
  const NFT_ABI  = [
    'function mint(address to, uint8 a, uint8 b) external returns (uint256)',
    'function setApprovalForAll(address op, bool v) external',
  ]
  const ERC20_ABI = [
    'function approve(address s, uint256 a) external returns (bool)',
    'function setMinter(address m, bool v) external',
    'function mint(address to, uint256 a) external',
  ]
  const MINING_ABI  = ['function startMining(uint256 landId, uint256 apostleId, uint256 drillId) external']
  const AUCTION_ABI = ['function createAuction(uint256 id, uint128 start, uint128 end, uint64 dur) external']
  const ROUTER_ABI  = [
    'function addLiquidity(address tA,address tB,uint256 aA,uint256 aB,uint256 mA,uint256 mB,address to,uint256 dl) external returns(uint256,uint256,uint256)',
    'function addLiquidityETH(address t,uint256 amt,uint256 minT,uint256 minE,address to,uint256 dl) external payable returns(uint256,uint256,uint256)',
  ]

  const init    = new ethers.Contract(ADDR.initializer, INIT_ABI, wallet)
  const apoC    = new ethers.Contract(ADDR.apostle,     NFT_ABI,  wallet)
  const drillC  = new ethers.Contract(ADDR.drill,       NFT_ABI,  wallet)
  const landC   = new ethers.Contract(ADDR.land,        NFT_ABI,  wallet)
  const miningC = new ethers.Contract(ADDR.mining,      MINING_ABI,  wallet)
  const aucC    = new ethers.Contract(ADDR.auction,     AUCTION_ABI, wallet)
  const ringC   = new ethers.Contract(ADDR.ring,        ERC20_ABI,   wallet)
  const router  = new ethers.Contract(ADDR.router,      ROUTER_ABI,  wallet)

  // ── 1. 铸造 20 块土地（分2批）────────────────────────────
  console.log('[1/6] 铸造 20 块土地...')
  for (let batch = 0; batch < 2; batch++) {
    const xs = [], ys = [], attrs = []
    for (let i = batch*10; i < batch*10+10; i++) {
      xs.push(i); ys.push(0)
      const s = i * 137
      attrs.push(encodeAttr((s*3+10)%100+5,(s*7+20)%100+5,(s*11+30)%100+5,(s*13+40)%100+5,(s*17+50)%100+5))
    }
    await sendTx(init, 'batchMint', [xs, ys, attrs, wallet.address])
    console.log(`  ✅ 第${batch+1}批（地块 #${batch*10+1}-#${batch*10+10}）`)
  }

  // ── 2. 铸造 10 个使徒 ─────────────────────────────────────
  console.log('\n[2/6] 铸造 10 个使徒...')
  for (let i = 0; i < 10; i++) {
    await sendTx(apoC, 'mint', [wallet.address, 30+i*7, i%5])
    console.log(`  ✅ 使徒 #${i+1}`)
  }

  // ── 3. 铸造 10 个钻头 ─────────────────────────────────────
  console.log('\n[3/6] 铸造 10 个钻头...')
  for (let i = 0; i < 10; i++) {
    await sendTx(drillC, 'mint', [wallet.address, (i%5)+1, i%5])
    console.log(`  ✅ 钻头 #${i+1}`)
  }

  // ── 4. 授权 + 地块1-5开挖矿 ──────────────────────────────
  console.log('\n[4/6] 地块1-5开挖矿...')
  await sendTx(apoC,  'setApprovalForAll', [ADDR.mining, true])
  await sendTx(drillC,'setApprovalForAll', [ADDR.mining, true])
  await sendTx(landC, 'setApprovalForAll', [ADDR.mining, true])
  for (let i = 0; i < 5; i++) {
    try {
      await sendTx(miningC, 'startMining', [i+1, i+1, i+1])
      console.log(`  ✅ 地块 #${i+1} 开挖`)
    } catch(e) { console.log(`  ⚠ 地块 #${i+1}: ${e.reason||e.message}`) }
  }

  // ── 5. 地块6-10挂拍卖 ─────────────────────────────────────
  console.log('\n[5/6] 地块6-10挂拍卖...')
  await sendTx(landC,'setApprovalForAll', [ADDR.auction, true])
  await sendTx(ringC,'approve', [ADDR.auction, ethers.parseEther('100000')])
  const SP = [10,8,12,6,15], EP = [2,1,3,1,2], DUR = 3*24*3600
  for (let i = 0; i < 5; i++) {
    try {
      await sendTx(aucC, 'createAuction', [i+6, ethers.parseEther(String(SP[i])), ethers.parseEther(String(EP[i])), DUR])
      console.log(`  ✅ 地块 #${i+6} 拍 ${SP[i]}→${EP[i]} RING`)
    } catch(e) { console.log(`  ⚠ 地块 #${i+6}: ${e.reason||e.message}`) }
  }

  // ── 6. 加流动性 ───────────────────────────────────────────
  console.log('\n[6/6] 加流动性...')
  const RING_PP = ethers.parseEther('200'), RES_PP = ethers.parseEther('1000')
  const dl = BigInt(Math.floor(Date.now()/1000) + 1800)
  const resAddrs = [ADDR.gold,ADDR.wood,ADDR.water,ADDR.fire,ADDR.soil]
  const resNames = ['GOLD','WOOD','HHO','FIRE','SIOO']
  await sendTx(ringC,'approve',[ADDR.router, ethers.parseEther('1200')])
  for (let i = 0; i < 5; i++) {
    const resC = new ethers.Contract(resAddrs[i], ERC20_ABI, wallet)
    try {
      await sendTx(resC, 'setMinter', [wallet.address, true])
      await sendTx(resC, 'mint',      [wallet.address, RES_PP])
      await sendTx(resC, 'approve',   [ADDR.router, RES_PP])
      await sendTx(router,'addLiquidity',[ADDR.ring,resAddrs[i],RING_PP,RES_PP,0n,0n,wallet.address,dl])
      console.log(`  ✅ RING-${resNames[i]} LP`)
    } catch(e) { console.log(`  ⚠ RING-${resNames[i]}: ${e.reason||e.message}`) }
  }
  try {
    await sendTx(ringC,'approve',[ADDR.router, ethers.parseEther('100')])
    await sendTx(router,'addLiquidityETH',[ADDR.ring,ethers.parseEther('100'),0n,0n,wallet.address,dl],{ value: ethers.parseEther('0.05') })
    console.log('  ✅ RING-BNB LP')
  } catch(e) { console.log(`  ⚠ RING-BNB: ${e.reason||e.message}`) }

  console.log('\n🎉 全部完成！')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
