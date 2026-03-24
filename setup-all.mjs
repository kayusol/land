/**
 * setup-all.mjs — 完整初始化：使徒+钻头挖矿+市场挂单
 */
import { ethers } from 'ethers'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545'

const ADDR = {
  ring:    '0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',
  land:    '0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  drill:   '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  apostle: '0x3D06422b6623b422c4152cd53231f0F45232197A',
  mining:  '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  auction: '0x6dfAEDBD161f99d655a818AF23377344FB16db1a',
}

const provider = new ethers.JsonRpcProvider(RPC)
const wallet   = new ethers.Wallet(PK, provider)
console.log('🔑', wallet.address)
const bal = await provider.getBalance(wallet.address)
console.log('💰', ethers.formatEther(bal), 'tBNB\n')

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function send(c, fn, args, opts={}) {
  for (let r=0; r<6; r++) {
    try {
      const tx = await c[fn](...args, ...(Object.keys(opts).length?[opts]:[]))
      process.stdout.write(`  ↗ ${tx.hash.slice(0,14)}...`)
      await tx.wait(); process.stdout.write(' ✓\n')
      await sleep(1500); return tx
    } catch(e) {
      const m=(e.message||'').toLowerCase()
      if((m.includes('rate')||m.includes('429'))&&r<5){
        const w=2000*(2**r); console.log(`\n  ⚠ 限速 ${w}ms`); await sleep(w); continue
      }
      throw e
    }
  }
}

const APO_ABI = [
  'function mint(address to,uint8 strength,uint8 element) external returns(uint256)',
  'function setApprovalForAll(address op,bool v) external',
  'function nextId() view returns(uint256)',
  'function ownerOf(uint256) view returns(address)',
]
const DRL_ABI = [
  'function mint(address to,uint8 tier,uint8 affinity) external returns(uint256)',
  'function setApprovalForAll(address op,bool v) external',
  'function nextId() view returns(uint256)',
  'function ownerOf(uint256) view returns(address)',
]
const LND_ABI = [
  'function setApprovalForAll(address op,bool v) external',
  'function ownerOf(uint256) view returns(address)',
  'function isApprovedForAll(address o,address op) view returns(bool)',
]
const MNG_ABI = [
  'function startMining(uint256 landId,uint256 apostleId,uint256 drillId) external',
  'function slotCount(uint256 landId) view returns(uint256)',
]
const AUC_ABI = [
  'function createAuction(uint256 id,uint128 start,uint128 end,uint64 dur) external',
  'function auctions(uint256 id) view returns(address,uint128,uint128,uint64,uint64)',
]
const E20_ABI = [
  'function approve(address s,uint256 a) external returns(bool)',
]

const apoC = new ethers.Contract(ADDR.apostle, APO_ABI, wallet)
const drlC = new ethers.Contract(ADDR.drill,   DRL_ABI, wallet)
const lndC = new ethers.Contract(ADDR.land,    LND_ABI, wallet)
const mngC = new ethers.Contract(ADDR.mining,  MNG_ABI, wallet)
const aucC = new ethers.Contract(ADDR.auction, AUC_ABI, wallet)
const ring = new ethers.Contract(ADDR.ring,    E20_ABI, wallet)

// 检查当前状态
const apoNext = Number(await apoC.nextId())
const drlNext = Number(await drlC.nextId())
console.log(`当前 apostle nextId: ${apoNext}`)
console.log(`当前 drill   nextId: ${drlNext}\n`)

// ── 1. 铸造使徒（补充到30个）────────────────────────────────────────
const APOSTLE_TARGET = 30
const apoMissing = Math.max(0, APOSTLE_TARGET - (apoNext - 1))
console.log(`[1] 铸造 ${apoMissing} 个使徒（补至 ${APOSTLE_TARGET} 个）...`)
const apoIds = []
// 已有的 IDs
for (let i=1; i<apoNext; i++) apoIds.push(i)
// 铸造新的
for (let i=0; i<apoMissing; i++) {
  const idx = apoNext - 1 + i
  const strength = 30 + (idx * 7) % 64  // 30-93
  const element  = idx % 5              // 金木水火土
  try {
    await send(apoC, 'mint', [wallet.address, strength, element])
    apoIds.push(apoNext + i)
    console.log(`  ✅ 使徒 #${apoNext+i} 力量${strength} ${['金','木','水','火','土'][element]}`)
  } catch(e) { console.log(`  ⚠ 使徒铸造失败: ${e.reason||e.shortMessage||e.message}`) }
}

// ── 2. 铸造钻头（补充到30个）────────────────────────────────────────
const DRILL_TARGET = 30
const drlMissing = Math.max(0, DRILL_TARGET - (drlNext - 1))
console.log(`\n[2] 铸造 ${drlMissing} 个钻头（补至 ${DRILL_TARGET} 个）...`)
const drlIds = []
for (let i=1; i<drlNext; i++) drlIds.push(i)
for (let i=0; i<drlMissing; i++) {
  const idx = drlNext - 1 + i
  const tier     = (idx % 5) + 1  // 1-5星
  const affinity = idx % 5
  try {
    await send(drlC, 'mint', [wallet.address, tier, affinity])
    drlIds.push(drlNext + i)
    console.log(`  ✅ 钻头 #${drlNext+i} ${'★'.repeat(tier)} ${['金','木','水','火','土'][affinity]}`)
  } catch(e) { console.log(`  ⚠ 钻头铸造失败: ${e.reason||e.shortMessage||e.message}`) }
}

// ── 3. 授权挖矿合约 ─────────────────────────────────────────────────
console.log('\n[3] 授权...')
await send(apoC, 'setApprovalForAll', [ADDR.mining, true])
await send(drlC, 'setApprovalForAll', [ADDR.mining, true])
await send(lndC, 'setApprovalForAll', [ADDR.mining, true])
console.log('  ✅ 三项授权完成')

// ── 4. 地块1-50 尽量开挖矿（每块一个使徒+一个钻头）──────────────────
console.log('\n[4] 开启挖矿...')
// 地块 tokenId: col*100+row+1, 铸造的是 x=0-9,y=0-4 和 x=0-19,y=0
// tokenId = x*100+y+1
const LAND_IDS = []
// x=0-9, y=0-4 (50块)
for (let x=0; x<=9; x++) for (let y=0; y<=4; y++) LAND_IDS.push(x*100+y+1)
// x=10-19, y=0 (10块，额外)
for (let x=10; x<=19; x++) LAND_IDS.push(x*100+0+1)

let miningPairs = [] // {landId, apostleId, drillId}
let apoIdx=0, drlIdx=0
const fullApoIds = Array.from({length:30},(_,i)=>i+1)
const fullDrlIds = Array.from({length:30},(_,i)=>i+1)

for (const landId of LAND_IDS) {
  // 检查地块是否已在挖矿
  try {
    const cnt = Number(await mngC.slotCount(landId))
    if (cnt > 0) { console.log(`  地块 #${landId} 已在挖矿 ✅`); continue }
  } catch(e) { continue }

  // 检查地块 owner
  try {
    const own = await lndC.ownerOf(landId)
    if (own.toLowerCase() !== wallet.address.toLowerCase()) continue
  } catch(e) { continue }

  if (apoIdx >= fullApoIds.length || drlIdx >= fullDrlIds.length) break

  const apostleId = fullApoIds[apoIdx]
  const drillId   = fullDrlIds[drlIdx]

  // 检查使徒/钻头是否还在 wallet（没被托管）
  try {
    const aOwn = await apoC.ownerOf(apostleId)
    if (aOwn.toLowerCase() !== wallet.address.toLowerCase()) { apoIdx++; continue }
    const dOwn = await drlC.ownerOf(drillId)
    if (dOwn.toLowerCase() !== wallet.address.toLowerCase()) { drlIdx++; continue }
  } catch(e) { apoIdx++; drlIdx++; continue }

  try {
    await send(mngC, 'startMining', [landId, apostleId, drillId])
    miningPairs.push({landId, apostleId, drillId})
    apoIdx++; drlIdx++
    console.log(`  ✅ 地块 #${landId} ← 使徒#${apostleId} + 钻头#${drillId}`)
  } catch(e) {
    console.log(`  ⚠ 地块 #${landId}: ${e.reason||e.shortMessage||e.message}`)
    apoIdx++; drlIdx++
  }
}
console.log(`\n  共开启 ${miningPairs.length} 块地挖矿`)

// ── 5. 未用于挖矿的使徒/钻头/土地 挂上市场 ───────────────────────────
console.log('\n[5] 挂拍卖市场...')
await send(lndC, 'setApprovalForAll', [ADDR.auction, true])
await send(apoC, 'setApprovalForAll', [ADDR.auction, true])
await send(drlC, 'setApprovalForAll', [ADDR.auction, true])
await send(ring, 'approve', [ADDR.auction, ethers.parseEther('999999')])

const DUR = 3*24*3600  // 3天

// 挂剩余土地（x=10-19,y=0 + 部分已有地块）
const AUCTION_LANDS = []
// 检查 x=10-19,y=0 的地块
for (let x=10; x<=19; x++) {
  const id = x*100+1
  try {
    const own = await lndC.ownerOf(id)
    if (own.toLowerCase()===wallet.address.toLowerCase()) {
      const auc = await aucC.auctions(id)
      if (auc[4]===0n) AUCTION_LANDS.push(id)
    }
  } catch(e) {}
}
// 也把部分 x=0-9,y=0-4 没在挖矿的地块挂上去
for (let x=0; x<=9; x++) {
  for (let y=0; y<=4; y++) {
    const id = x*100+y+1
    try {
      const cnt = Number(await mngC.slotCount(id))
      if (cnt===0) {
        const own = await lndC.ownerOf(id)
        if (own.toLowerCase()===wallet.address.toLowerCase()) {
          const auc = await aucC.auctions(id)
          if (auc[4]===0n) AUCTION_LANDS.push(id)
        }
      }
    } catch(e) {}
  }
}

console.log(`  准备挂 ${AUCTION_LANDS.length} 块土地...`)
let landAucCount=0
for (const id of AUCTION_LANDS.slice(0,15)) {  // 最多15块
  const sp = 5 + (id % 10)   // 5-14 RING
  const ep = 1 + (id % 3)    // 1-3 RING
  try {
    await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther(String(ep)),DUR])
    landAucCount++
    console.log(`  ✅ 土地 #${id} ${sp}→${ep} RING`)
  } catch(e) { console.log(`  ⚠ 土地 #${id}: ${e.reason||e.shortMessage||e.message}`) }
}

// 挂剩余使徒（没有被挖矿托管的）
let apoAucCount=0
for (let aid=apoIdx+1; aid<=30 && apoAucCount<10; aid++) {
  try {
    const own = await apoC.ownerOf(aid)
    if (own.toLowerCase()!==wallet.address.toLowerCase()) continue
    const sp = 3 + (aid%5)
    const ep = 1
    await send(aucC,'createAuction',[aid,ethers.parseEther(String(sp)),ethers.parseEther(String(ep)),DUR])
    apoAucCount++
    console.log(`  ✅ 使徒 #${aid} ${sp}→${ep} RING`)
  } catch(e) { console.log(`  ⚠ 使徒 #${aid}: ${e.reason||e.shortMessage||e.message}`) }
}

// 挂剩余钻头
let drlAucCount=0
for (let did=drlIdx+1; did<=30 && drlAucCount<10; did++) {
  try {
    const own = await drlC.ownerOf(did)
    if (own.toLowerCase()!==wallet.address.toLowerCase()) continue
    const sp = 2 + (did%4)
    const ep = 1
    await send(aucC,'createAuction',[did,ethers.parseEther(String(sp)),ethers.parseEther(String(ep)),DUR])
    drlAucCount++
    console.log(`  ✅ 钻头 #${did} ${sp}→${ep} RING`)
  } catch(e) { console.log(`  ⚠ 钻头 #${did}: ${e.reason||e.shortMessage||e.message}`) }
}

console.log(`\n🎉 完成！`)
console.log(`  挖矿中: ${miningPairs.length} 块地`)
console.log(`  市场土地: ${landAucCount} 个`)
console.log(`  市场使徒: ${apoAucCount} 个`)
console.log(`  市场钻头: ${drlAucCount} 个`)
