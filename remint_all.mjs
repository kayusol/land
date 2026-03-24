// remint_all.mjs — 全新铸造：60块地 + 198使徒 + 200钻头 + 挖矿 + 拍卖
import { ethers } from 'ethers'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'

const ADDR = {
  ring:     '0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',
  land:     '0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  drill:    '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  apostle:  '0x767E1082A32a52949FB6613B5fF403f10D2426f3',
  mining:   '0x48eCa05c37E9F7c4F9CA05124c05cC6a145C9aaC',  // MiningV2
  auction:  '0x6dfAEDBD161f99d655a818AF23377344FB16db1a',
  init:     '0x78707C585E3C28D6f861b9b3Ef14b0e665f52a7B',
}

const p = new ethers.JsonRpcProvider(RPC)
const w = new ethers.Wallet(PK, p)
console.log('Wallet:', w.address)
console.log('Balance:', ethers.formatEther(await p.getBalance(w.address)), 'BNB\n')

const sleep = ms => new Promise(r=>setTimeout(r,ms))

// 带重试的交易发送
async function sendTx(contract, fn, args, label='') {
  for(let r=0;r<6;r++){
    try{
      const nonce = await p.getTransactionCount(w.address, 'pending')
      const tx = await contract[fn](...args, {nonce, gasLimit:500000})
      process.stdout.write(`  ${label||fn}: ${tx.hash.slice(0,10)}...`)
      const rc = await tx.wait()
      if(rc.status===0) throw new Error('reverted')
      process.stdout.write(' ✅\n')
      await sleep(1000)
      return rc
    }catch(e){
      const m=(e.message||'').toLowerCase()
      if(m.includes('nonce')||m.includes('already')){await sleep(2000+r*1000);continue}
      if(m.includes('rate')||m.includes('429')){await sleep(4000*(r+1));continue}
      if(r<3 && m.includes('revert')){
        console.log(`  ⚠ ${label} revert: ${e.reason||e.message.slice(0,50)}, retry ${r+1}`)
        await sleep(2000);continue
      }
      throw e
    }
  }
  throw new Error(`${label} failed after retries`)
}

// ABIs
const LAND_ABI = ['function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external','function isApprovedForAll(address,address) view returns(bool)','function operators(address) view returns(bool)','function setOperator(address,bool) external']
const APO_ABI  = ['function nextId() view returns(uint256)','function mint(address,uint8,uint8) external returns(uint256)','function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external','function isApprovedForAll(address,address) view returns(bool)','function operators(address) view returns(bool)']
const DRL_ABI  = ['function nextId() view returns(uint256)','function mint(address,uint8,uint8) external returns(uint256)','function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external','function isApprovedForAll(address,address) view returns(bool)']
const MINE_ABI = ['function startMining(uint256,uint256,uint256) external','function slotCount(uint256) view returns(uint256)','function pendingRewards(uint256) view returns(uint256[5])']
const AUC_ABI  = ['function createAuction(uint256,uint128,uint128,uint64) external','function auctions(uint256) view returns(address,uint128,uint128,uint64,uint64)']
const INIT_ABI = ['function batchMint(int16[],int16[],uint80[],address) external','function owner() view returns(address)']
const RING_ABI = ['function approve(address,uint256) external returns(bool)','function balanceOf(address) view returns(uint256)']

const land  = new ethers.Contract(ADDR.land,   LAND_ABI, w)
const apo   = new ethers.Contract(ADDR.apostle, APO_ABI, w)
const drl   = new ethers.Contract(ADDR.drill,   DRL_ABI, w)
const mine  = new ethers.Contract(ADDR.mining,  MINE_ABI, w)
const auc   = new ethers.Contract(ADDR.auction, AUC_ABI, w)
const init  = new ethers.Contract(ADDR.init,    INIT_ABI, w)
const ring  = new ethers.Contract(ADDR.ring,    RING_ABI, w)

// encodeAttr: 5个uint16打包成uint80
function encodeAttr(g,wo,wa,f,s){
  return(BigInt(g)|(BigInt(wo)<<16n)|(BigInt(wa)<<32n)|(BigInt(f)<<48n)|(BigInt(s)<<64n))
}

// 地块资源属性 — 有意义的速率值，修复后每天产出公式:
// output = rate * strength / 50 tokens/day
// rate=50, strength=50 → 50 tokens/day ✅
// 使用 Perlin-like 分布，5x5=25块不同组合 × 4 = 100块
function makeAttr(x, y) {
  // 用位置生成有地理感的资源分布（和前端Perlin一致）
  function noise(cx, cy, seed) {
    let h = (cx*1619+cy*31337+seed*6791)^0xdeadbeef
    h = Math.imul(h^(h>>>16), 0x45d9f3b)|0
    h = Math.imul(h^(h>>>16), 0x45d9f3b)|0
    return ((h^(h>>>16))>>>0)/0xffffffff
  }
  const rates = []
  for(let e=0;e<5;e++){
    // 多频叠加（和前端噪声一致）
    const v = noise(x/20+e*3.7, y/20+e*2.3, 42+e*137)*0.5
            + noise(x/8+e*1.3,  y/8+e*1.7,  142+e*137)*0.3
            + noise(x/4+e*0.7,  y/4+e*0.9,  242+e*137)*0.2
    // 映射到 10-120 范围（修复后每天产出12-144 tokens）
    rates.push(Math.max(10, Math.min(120, Math.floor(v * 130))))
  }
  return encodeAttr(...rates)
}

// ── 地块布局 ─────────────────────────────────────────────────────────────
// 原版地图布局：土地按区块分布，每个大陆约60块用于挖矿+拍卖
// 铸造60块地 (x=0-11, y=0-4) 共60块
const LAND_COORDS = []
for(let x=0;x<12;x++) for(let y=0;y<5;y++) LAND_COORDS.push([x,y])
// landId = x*100 + y + 1
const toLandId = (x,y) => x*100+y+1

// ── STEP 0: 检查初始化合约是否是owner ──────────────────────────────────
console.log('='.repeat(55))
console.log('EvoLand BSC — 全新铸造脚本')
console.log('='.repeat(55))
const initOwner = await init.owner()
const isInitOwner = initOwner.toLowerCase() === w.address.toLowerCase()
console.log('Init owner:', initOwner)
console.log('We are owner:', isInitOwner)
if(!isInitOwner) { console.log('❌ 不是LandInitializer的owner'); process.exit(1) }

// 检查已铸造地块 — 用 multicall 批量查询
console.log('\n[1/6] 检查已铸造地块...')
const ZERO = '0x0000000000000000000000000000000000000000'
const landIface = new ethers.Interface(['function ownerOf(uint256) view returns(address)'])
const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11'
const mcIface = new ethers.Interface(['function tryAggregate(bool,(address,bytes)[]) view returns((bool,bytes)[])'])
const mc = new ethers.Contract(MULTICALL, mcIface, p)

const mintedLands = [], unmintedLands = []
const BATCH_CHECK = 30
for(let i=0;i<LAND_COORDS.length;i+=BATCH_CHECK){
  const batch = LAND_COORDS.slice(i,i+BATCH_CHECK)
  const calls = batch.map(([x,y])=>[ADDR.land, landIface.encodeFunctionData('ownerOf',[toLandId(x,y)])])
  const results = await mc.tryAggregate(false, calls).catch(()=>batch.map(()=>([false,'0x'])))
  batch.forEach(([x,y],j)=>{
    const id=toLandId(x,y)
    if(results[j][0]) mintedLands.push({x,y,id})
    else unmintedLands.push({x,y,id})
  })
}
console.log(`  已铸造: ${mintedLands.length}, 待铸造: ${unmintedLands.length}`)

// 批量铸造未铸造的地块（每批10块）
if(unmintedLands.length > 0){
  console.log(`  铸造 ${unmintedLands.length} 块地...`)
  const BATCH = 10
  for(let i=0;i<unmintedLands.length;i+=BATCH){
    const batch = unmintedLands.slice(i, i+BATCH)
    const xs = batch.map(l=>l.x)
    const ys = batch.map(l=>l.y)
    const attrs = batch.map(l=>makeAttr(l.x,l.y))
    try{
      await sendTx(init,'batchMint',[xs,ys,attrs,w.address],`批量铸地#${i/BATCH+1}`)
    }catch(e){
      console.log('  ⚠ 批量铸造失败，单块铸造...')
      for(const {x,y} of batch){
        await sendTx(init,'batchMint',[[x],[y],[makeAttr(x,y)],w.address],`地(${x},${y})`).catch(e2=>console.log('    ⚠',e2.reason||e2.message.slice(0,40)))
      }
    }
  }
}
console.log('  ✅ 地块铸造完成')

// ── STEP 2: 铸造使徒（增量，跳过已有） ──────────────────────────────────
console.log('\n[2/6] 铸造使徒...')
const APO_TARGET = 60  // 新铸60个（够用）
const apoNextId = Number(await apo.nextId())
const apoMint = Math.max(0, APO_TARGET - (apoNextId-1))
console.log(`  当前:${apoNextId-1}个, 目标:${APO_TARGET}个, 需铸:${apoMint}个`)
// 铸造：strength多样化 (30-95)，element循环分布
for(let i=0;i<apoMint;i++){
  const idx = apoNextId+i-1
  const str = 30 + Math.floor((idx%13)*5)   // 30,35,40,...,90,95,30...
  const elem = idx%5
  // gender: 偶数=雄♂(0), 奇数=雌♀(1) — 修复全是♀的问题
  // 注意: ApostleV2.mint() 内部生成gender，我们无法控制
  await sendTx(apo,'mint',[w.address,str,elem],`使徒${apoNextId+i}`).catch(e=>console.log('  ⚠',e.reason||e.message.slice(0,40)))
}
console.log('  ✅ 使徒铸造完成')

// ── STEP 3: 铸造钻头（增量） ────────────────────────────────────────────
console.log('\n[3/6] 铸造钻头...')
const DRL_TARGET = 60
const drlNextId = Number(await drl.nextId())
const drlMint = Math.max(0, DRL_TARGET - (drlNextId-1))
console.log(`  当前:${drlNextId-1}个, 目标:${DRL_TARGET}个, 需铸:${drlMint}个`)
for(let i=0;i<drlMint;i++){
  const idx = drlNextId+i-1
  const tier = (idx%5)+1    // 1-5星循环
  const aff  = idx%5        // 元素循环
  await sendTx(drl,'mint',[w.address,tier,aff],`钻头${drlNextId+i}`).catch(e=>console.log('  ⚠',e.reason||e.message.slice(0,40)))
}
console.log('  ✅ 钻头铸造完成')

// ── STEP 4: 授权 ────────────────────────────────────────────────────────
console.log('\n[4/6] 授权...')
if(!await apo.isApprovedForAll(w.address, ADDR.mining))
  await sendTx(apo,'setApprovalForAll',[ADDR.mining,true],'使徒→mining授权')
if(!await drl.isApprovedForAll(w.address, ADDR.mining))
  await sendTx(drl,'setApprovalForAll',[ADDR.mining,true],'钻头→mining授权')
if(!await land.isApprovedForAll(w.address, ADDR.auction))
  await sendTx(land,'setApprovalForAll',[ADDR.auction,true],'地块→auction授权')
if(!await land.isApprovedForAll(w.address, ADDR.mining))
  await sendTx(land,'setApprovalForAll',[ADDR.mining,true],'地块→mining授权')
console.log('  ✅ 全部授权完成')

// ── STEP 5: 开挖矿 (30块地 × 5使徒 = 150槽) ────────────────────────────
console.log('\n[5/6] 开挖矿...')
const MINE_LANDS = LAND_COORDS.slice(0,30).map(([x,y])=>toLandId(x,y))
let apoUsed=0, drlUsed=0, totalMining=0

// 重新读取当前使徒/钻头数量
const apoNow = Number(await apo.nextId())-1
const drlNow = Number(await drl.nextId())-1
console.log(`  可用: 使徒${apoNow}个, 钻头${drlNow}个`)

for(const landId of MINE_LANDS){
  // 检查土地是我们的（跳过非自己的）
  let owner
  try{ owner=await land.ownerOf(landId) }catch(e){continue}
  if(owner.toLowerCase()!==w.address.toLowerCase()) continue

  // 检查已有槽位
  const existCnt = Number(await mine.slotCount(landId).catch(()=>0n))
  const need = 5 - existCnt
  if(need<=0){ console.log(`  地块#${landId}: 已满`); totalMining+=5; continue }

  for(let s=0;s<need;s++){
    const apoId = apoUsed+1
    const drlId = drlUsed+1
    if(apoId>apoNow||drlId>drlNow){ console.log('  使徒/钻头不足，停止'); break }

    // 确认使徒是我们的
    try{
      const ao=await apo.ownerOf(apoId)
      if(ao.toLowerCase()!==w.address.toLowerCase()){apoUsed++;drlUsed++;s--;continue}
    }catch(e){apoUsed++;drlUsed++;s--;continue}

    await sendTx(mine,'startMining',[landId,apoId,drlId],`挖矿地#${landId}使#${apoId}`).catch(e=>{
      console.log(`  ⚠ 地#${landId}: ${e.reason||e.message.slice(0,40)}`)
    })
    apoUsed++; drlUsed++; totalMining++
  }
}
console.log(`  ✅ 开启 ${totalMining} 个挖矿槽位`)

// ── STEP 6: 剩余30块地挂拍卖 ────────────────────────────────────────────
console.log('\n[6/6] 挂拍卖...')
const AUC_LANDS = LAND_COORDS.slice(30,60).map(([x,y])=>toLandId(x,y))
const DUR = BigInt(7*24*3600)  // 7天
const RING_BAL = await ring.balanceOf(w.address)
await ring.approve(ADDR.auction, RING_BAL).then(tx=>tx.wait()).catch(()=>{})
let aucCount=0

for(let i=0;i<AUC_LANDS.length;i++){
  const landId = AUC_LANDS[i]
  let owner
  try{ owner=await land.ownerOf(landId) }catch(e){continue}
  if(owner.toLowerCase()!==w.address.toLowerCase()) continue

  // 检查是否已经在拍卖
  const a=await auc.auctions(landId).catch(()=>null)
  if(a&&Number(a[4])>0){ aucCount++; continue }

  // 价格梯度 5-20 RING
  const sp = ethers.parseEther(String(5 + (i%16)))
  const ep = ethers.parseEther('1')
  await sendTx(auc,'createAuction',[landId,sp,ep,DUR],`拍卖地#${landId}`).catch(e=>{
    console.log(`  ⚠ 地#${landId}: ${e.reason||e.message.slice(0,40)}`)
  })
  aucCount++
}
console.log(`  ✅ 挂拍 ${aucCount} 块地`)

// ── 验证 ────────────────────────────────────────────────────────────────
console.log('\n='.repeat(55))
console.log('验证结果')
console.log('='.repeat(55))
await sleep(5000)
const testIds = [toLandId(0,0), toLandId(1,0), toLandId(2,0)]
for(const id of testIds){
  const cnt = Number(await mine.slotCount(id).catch(()=>0n))
  if(cnt===0) continue
  const r = await mine.pendingRewards(id)
  const tot = r.reduce((s,x)=>s+Number(ethers.formatEther(x)),0)
  console.log(`地块#${id}(${cnt}槽): 累计=${tot.toFixed(6)} tokens`)
}
console.log('\n✅ 重新铸造完成！')
console.log('新 Mining 合约:', ADDR.mining)
