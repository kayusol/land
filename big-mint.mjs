/**
 * big-mint.mjs — 铸造200个使徒+200个钻头，60块地各放5使徒5钻头，剩余挂单
 */
import { ethers } from 'ethers'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'

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
  for (let r=0; r<8; r++) {
    try {
      const tx = await c[fn](...args, ...(Object.keys(opts).length?[opts]:[]))
      process.stdout.write(`  ↗ ${tx.hash.slice(0,12)}...`)
      const rc = await tx.wait()
      if(rc.status===0) throw new Error('reverted')
      process.stdout.write(' ✓\n')
      await sleep(1200); return rc
    } catch(e) {
      const m=(e.message||'').toLowerCase()
      if((m.includes('rate')||m.includes('429')||m.includes('limit'))&&r<7){
        const w=2000*(2**Math.min(r,4)); console.log(`\n  ⚠ 限速 ${w/1000}s`); await sleep(w); continue
      }
      throw e
    }
  }
}

const APO_ABI=['function mint(address to,uint8 strength,uint8 element) external returns(uint256)','function setApprovalForAll(address op,bool v) external','function nextId() view returns(uint256)','function ownerOf(uint256) view returns(address)']
const DRL_ABI=['function mint(address to,uint8 tier,uint8 affinity) external returns(uint256)','function setApprovalForAll(address op,bool v) external','function nextId() view returns(uint256)','function ownerOf(uint256) view returns(address)']
const LND_ABI=['function setApprovalForAll(address op,bool v) external','function ownerOf(uint256) view returns(address)']
const MNG_ABI=['function startMining(uint256 landId,uint256 apostleId,uint256 drillId) external','function slotCount(uint256 landId) view returns(uint256)']
const AUC_ABI=['function createAuction(uint256 id,uint128 start,uint128 end,uint64 dur) external','function auctions(uint256 id) view returns(address,uint128,uint128,uint64,uint64)']
const E20_ABI=['function approve(address s,uint256 a) external returns(bool)']

const apoC=new ethers.Contract(ADDR.apostle,APO_ABI,wallet)
const drlC=new ethers.Contract(ADDR.drill,DRL_ABI,wallet)
const lndC=new ethers.Contract(ADDR.land,LND_ABI,wallet)
const mngC=new ethers.Contract(ADDR.mining,MNG_ABI,wallet)
const aucC=new ethers.Contract(ADDR.auction,AUC_ABI,wallet)
const ring=new ethers.Contract(ADDR.ring,E20_ABI,wallet)

const apoNext=Number(await apoC.nextId())
const drlNext=Number(await drlC.nextId())
console.log(`使徒 nextId=${apoNext}（已有 ${apoNext-1} 个）`)
console.log(`钻头 nextId=${drlNext}（已有 ${drlNext-1} 个）\n`)

// ── 1. 铸造使徒到200个 ────────────────────────────────────────────────
const APO_TARGET=200
const apoMint=Math.max(0,APO_TARGET-(apoNext-1))
console.log(`[1/4] 铸造 ${apoMint} 个使徒...`)
for(let i=0;i<apoMint;i++){
  const idx=apoNext+i-1
  const str=30+(idx*7)%64
  const elem=idx%5
  try{
    await send(apoC,'mint',[wallet.address,str,elem])
    if((i+1)%10===0) console.log(`  ✅ 已铸 ${apoNext+i} 个使徒`)
  }catch(e){console.log(`  ⚠ #${apoNext+i}: ${e.reason||e.message}`)}
}
console.log(`  ✅ 使徒铸造完成 (共 ${APO_TARGET} 个)\n`)

// ── 2. 铸造钻头到200个 ────────────────────────────────────────────────
const DRL_TARGET=200
const drlMint=Math.max(0,DRL_TARGET-(drlNext-1))
console.log(`[2/4] 铸造 ${drlMint} 个钻头...`)
for(let i=0;i<drlMint;i++){
  const idx=drlNext+i-1
  const tier=(idx%5)+1
  const aff=idx%5
  try{
    await send(drlC,'mint',[wallet.address,tier,aff])
    if((i+1)%10===0) console.log(`  ✅ 已铸 ${drlNext+i} 个钻头`)
  }catch(e){console.log(`  ⚠ #${drlNext+i}: ${e.reason||e.message}`)}
}
console.log(`  ✅ 钻头铸造完成 (共 ${DRL_TARGET} 个)\n`)

// ── 3. 授权 + 60块土地各放5使徒5钻头（共用150个）────────────────────
console.log('[3/4] 开启挖矿（每块地最多5使徒+5钻头）...')
await send(apoC,'setApprovalForAll',[ADDR.mining,true])
await send(drlC,'setApprovalForAll',[ADDR.mining,true])
await send(lndC,'setApprovalForAll',[ADDR.mining,true])
console.log('  ✅ 授权完成')

// 所有已铸造土地ID（x=0-9,y=0-4 + x=0-19,y=0）
const LAND_IDS=[]
for(let x=0;x<=9;x++) for(let y=0;y<=4;y++) LAND_IDS.push(x*100+y+1)
for(let x=10;x<=19;x++) LAND_IDS.push(x*100+1)

let apoUsed=0,drlUsed=0,totalSlots=0
const SLOTS_PER_LAND=5
const MINE_LANDS=LAND_IDS.slice(0,60)  // 最多60块

for(const landId of MINE_LANDS){
  // 检查地块是否属于我
  try{ const o=await lndC.ownerOf(landId); if(o.toLowerCase()!==wallet.address.toLowerCase()) continue }
  catch(e){ continue }

  // 已有多少槽位
  let existSlots=0
  try{ existSlots=Number(await mngC.slotCount(landId)) }catch(e){}
  
  const slotsNeeded=SLOTS_PER_LAND-existSlots
  if(slotsNeeded<=0){ console.log(`  地块 #${landId} 已满 (${existSlots}/5) ✅`); continue }

  for(let s=0;s<slotsNeeded;s++){
    const apoId=apoUsed+1
    const drlId=drlUsed+1
    if(apoId>APO_TARGET||drlId>DRL_TARGET) break
    // 检查是否在wallet
    try{
      const ao=await apoC.ownerOf(apoId)
      const doo=await drlC.ownerOf(drlId)
      if(ao.toLowerCase()!==wallet.address.toLowerCase()||doo.toLowerCase()!==wallet.address.toLowerCase()){
        apoUsed++;drlUsed++;continue
      }
    }catch(e){apoUsed++;drlUsed++;continue}
    
    try{
      await send(mngC,'startMining',[landId,apoId,drlId])
      apoUsed++;drlUsed++;totalSlots++
      if(totalSlots%10===0) console.log(`  ✅ 已开 ${totalSlots} 个槽位`)
    }catch(e){
      console.log(`  ⚠ 地块#${landId}槽${s}: ${e.reason||e.shortMessage||e.message}`)
      apoUsed++;drlUsed++
    }
  }
}
console.log(`\n  ✅ 挖矿完成：${totalSlots} 个槽位，${Math.ceil(totalSlots/5)} 块地\n`)

// ── 4. 剩余使徒/钻头/土地挂拍卖市场 ──────────────────────────────────
console.log('[4/4] 挂拍卖市场...')
await send(lndC,'setApprovalForAll',[ADDR.auction,true])
await send(apoC,'setApprovalForAll',[ADDR.auction,true])
await send(drlC,'setApprovalForAll',[ADDR.auction,true])
await send(ring,'approve',[ADDR.auction,ethers.parseEther('999999')])
console.log('  ✅ 授权完成')

const DUR=3*24*3600

// ── 4a. 土地：挂10-12块未在挖矿的地块 ───────────────────────────────
let landAuc=0
for(const landId of LAND_IDS){
  if(landAuc>=12) break
  try{
    const o=await lndC.ownerOf(landId)
    if(o.toLowerCase()!==wallet.address.toLowerCase()) continue
    const slots=Number(await mngC.slotCount(landId))
    if(slots>0) continue  // 挖矿中跳过
    const auc=await aucC.auctions(landId)
    if(auc[4]>0n) continue  // 已挂
    const sp=5+(landId%8)  // 5-12 RING
    const ep=1+(landId%3)  // 1-3 RING
    await send(aucC,'createAuction',[landId,ethers.parseEther(String(sp)),ethers.parseEther(String(ep)),DUR])
    landAuc++
    console.log(`  🏡 土地 #${landId}: ${sp}→${ep} RING`)
  }catch(e){console.log(`  ⚠ 土地#${landId}: ${e.reason||e.shortMessage||e.message}`)}
}
console.log(`  ✅ 土地挂单 ${landAuc} 个`)

// ── 4b. 剩余使徒挂单（最多40个）────────────────────────────────────
let apoAuc=0
for(let id=apoUsed+1;id<=APO_TARGET&&apoAuc<40;id++){
  try{
    const o=await apoC.ownerOf(id)
    if(o.toLowerCase()!==wallet.address.toLowerCase()) continue
    const auc=await aucC.auctions(id)
    if(auc[4]>0n) continue
    const tier=((id-1)%5)+1
    const sp=2+tier  // 3-7 RING
    const ep=1
    await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther(String(ep)),DUR])
    apoAuc++
    if(apoAuc%10===0) console.log(`  🧙 已挂使徒 ${apoAuc} 个`)
  }catch(e){console.log(`  ⚠ 使徒#${id}: ${e.reason||e.shortMessage||e.message}`)}
}
console.log(`  ✅ 使徒挂单 ${apoAuc} 个`)

// ── 4c. 剩余钻头挂单（最多40个）────────────────────────────────────
let drlAuc=0
for(let id=drlUsed+1;id<=DRL_TARGET&&drlAuc<40;id++){
  try{
    const o=await drlC.ownerOf(id)
    if(o.toLowerCase()!==wallet.address.toLowerCase()) continue
    const auc=await aucC.auctions(id)
    if(auc[4]>0n) continue
    const tier=((id-1)%5)+1
    const sp=1+tier  // 2-6 RING
    const ep=1
    await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther(String(ep)),DUR])
    drlAuc++
    if(drlAuc%10===0) console.log(`  ⛏️  已挂钻头 ${drlAuc} 个`)
  }catch(e){console.log(`  ⚠ 钻头#${id}: ${e.reason||e.shortMessage||e.message}`)}
}
console.log(`  ✅ 钻头挂单 ${drlAuc} 个`)

console.log('\n🎉 全部完成！')
console.log(`  挖矿: ${totalSlots} 槽位`)
console.log(`  市场: 土地${landAuc}+使徒${apoAuc}+钻头${drlAuc}`)
