// reset_and_remint.mjs — 一步解决：取消拍卖→从旧合约取回所有使徒→新合约开挖矿→重新挂拍卖
import { ethers } from 'ethers'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'
const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'

const ADDR = {
  land:    '0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  apostle: '0x767E1082A32a52949FB6613B5fF403f10D2426f3',
  drill:   '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  auction: '0x6dfAEDBD161f99d655a818AF23377344FB16db1a',
  oldMine: '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  newMine: '0x48eCa05c37E9F7c4F9CA05124c05cC6a145C9aaC',
  init:    '0x78707C585E3C28D6f861b9b3Ef14b0e665f52a7B',
  ring:    '0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',
}
const p = new ethers.JsonRpcProvider(RPC)
const w = new ethers.Wallet(PK, p)

const sleep = ms => new Promise(r=>setTimeout(r,ms))
let nonce = await p.getTransactionCount(w.address, 'pending')

async function tx(contract, fn, args, label) {
  for(let r=0;r<5;r++){
    try{
      const t = await contract[fn](...args, {nonce: nonce++, gasLimit:400000})
      process.stdout.write(`  ${label}: ${t.hash.slice(0,10)}...`)
      await t.wait()
      process.stdout.write('✅\n')
      await sleep(800)
      return true
    }catch(e){
      nonce = await p.getTransactionCount(w.address,'pending')
      const m=(e.message||'').toLowerCase()
      if(m.includes('rate')||m.includes('429')){await sleep(4000*(r+1));continue}
      if(r<3){await sleep(1500*(r+1));continue}
      console.log(`  ⚠ ${label}: ${e.reason||e.message.slice(0,60)}`)
      return false
    }
  }
  return false
}

// ABIs
const LAND_ABI=['function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external','function isApprovedForAll(address,address) view returns(bool)']
const APO_ABI=['function nextId() view returns(uint256)','function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external','function isApprovedForAll(address,address) view returns(bool)']
const DRL_ABI=['function nextId() view returns(uint256)','function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external','function isApprovedForAll(address,address) view returns(bool)']
const OLD_ABI=['function slotCount(uint256) view returns(uint256)','function slots(uint256,uint256) view returns(uint256,uint256,uint256)','function stopMining(uint256,uint256) external']
const NEW_ABI=['function startMining(uint256,uint256,uint256) external','function slotCount(uint256) view returns(uint256)','function pendingRewards(uint256) view returns(uint256[5])']
const AUC_ABI=['function auctions(uint256) view returns(address,uint128,uint128,uint64,uint64)','function cancelAuction(uint256) external','function createAuction(uint256,uint128,uint128,uint64) external']

const land   = new ethers.Contract(ADDR.land,    LAND_ABI, w)
const apo    = new ethers.Contract(ADDR.apostle,  APO_ABI, w)
const drl    = new ethers.Contract(ADDR.drill,    DRL_ABI, w)
const oldM   = new ethers.Contract(ADDR.oldMine,  OLD_ABI, w)
const newM   = new ethers.Contract(ADDR.newMine,  NEW_ABI, w)
const auc    = new ethers.Contract(ADDR.auction,  AUC_ABI, w)

console.log('='.repeat(55))
console.log('  Reset & Remint — 全套重置脚本')
console.log('='.repeat(55))
console.log('nonce start:', nonce)

// ── STEP 1: 扫描所有活跃拍卖，取消并记录参数 ─────────────────────────
console.log('\n[1/5] 扫描并取消拍卖...')
const savedAuctions = []  // 记录原参数，稍后重建
// 扫描1-1000（用multicall批量）
const MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11'
const mcIface = new ethers.Interface(['function tryAggregate(bool,(address,bytes)[]) view returns((bool,bytes)[])'])
const aucIface = new ethers.Interface(['function auctions(uint256) view returns(address,uint128,uint128,uint64,uint64)'])
const mc = new ethers.Contract(MULTICALL, mcIface, p)

// 分批扫描所有地块的拍卖（1-500）
const activeLandAucs = []
for(let base=1;base<=500;base+=50){
  const ids=Array.from({length:50},(_,i)=>base+i)
  const calls=ids.map(id=>[ADDR.auction, aucIface.encodeFunctionData('auctions',[id])])
  const res=await mc.tryAggregate(false,calls).catch(()=>ids.map(()=>[false,'0x']))
  ids.forEach((id,j)=>{
    if(!res[j][0]) return
    const d=aucIface.decodeFunctionResult('auctions',res[j][1])
    if(Number(d[4])>0) activeLandAucs.push({id, seller:d[0], sp:d[1], ep:d[2], dur:d[3], startedAt:d[4]})
  })
}
console.log(`  找到 ${activeLandAucs.length} 个活跃拍卖`)

// 取消所有拍卖（只取消 seller=deployer 的）
for(const {id,seller,sp,ep,dur} of activeLandAucs){
  if(seller.toLowerCase()!==DEPLOYER.toLowerCase()) continue
  const ok = await tx(auc,'cancelAuction',[id],`取消拍卖#${id}`)
  if(ok) savedAuctions.push({id, sp, ep, dur})
}
console.log(`  已取消 ${savedAuctions.length} 个拍卖，地块回到 deployer`)

// ── STEP 2: 扫描旧合约所有活跃槽位并 stopMining ──────────────────────
console.log('\n[2/5] 从旧合约取回所有使徒...')
// 扫描旧合约活跃槽位（用multicall批量查 slotCount）
const mineIface = new ethers.Interface(['function slotCount(uint256) view returns(uint256)'])
const activeMineLands = []
for(let base=1;base<=1000;base+=100){
  const ids=Array.from({length:100},(_,i)=>base+i)
  const calls=ids.map(id=>[ADDR.oldMine, mineIface.encodeFunctionData('slotCount',[id])])
  const res=await mc.tryAggregate(false,calls).catch(()=>ids.map(()=>[false,'0x']))
  ids.forEach((id,j)=>{
    if(!res[j][0]) return
    const cnt=Number(mineIface.decodeFunctionResult('slotCount',res[j][1])[0])
    if(cnt>0) activeMineLands.push({id,cnt})
  })
}
console.log(`  旧合约活跃地块: ${activeMineLands.length} 个`)

// 读取所有槽位详情
const slotsToMigrate = []  // [{landId, apoId, drlId}]
for(const {id,cnt} of activeMineLands){
  for(let i=0;i<cnt;i++){
    const s=await oldM.slots(id,i).catch(()=>null)
    if(s) slotsToMigrate.push({landId:id, apoId:s[0], drlId:s[1]})
  }
}
console.log(`  共 ${slotsToMigrate.length} 个槽位需迁移`)

// 执行 stopMining（现在拍卖已取消，地块是 deployer 的了）
let freedCount=0
for(const {landId,apoId,drlId} of slotsToMigrate){
  // 检查土地 owner 是否是 deployer
  const owner=await land.ownerOf(landId).catch(()=>'')
  if(owner.toLowerCase()!==DEPLOYER.toLowerCase()){
    console.log(`  ⚠ 地块#${landId} owner不是deployer(${owner.slice(0,10)}), 跳过`)
    continue
  }
  const ok=await tx(oldM,'stopMining',[landId,apoId],`取回使徒#${apoId}(地块#${landId})`)
  if(ok) freedCount++
}
console.log(`  成功取回 ${freedCount} 个使徒`)
