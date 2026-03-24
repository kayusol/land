// full_migrate.mjs — 完整迁移：取消拍卖→停止挖矿→放入新合约→重新挂拍卖
import { ethers } from 'ethers'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'

const ADDR = {
  land:    '0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  apostle: '0x767E1082A32a52949FB6613B5fF403f10D2426f3',
  drill:   '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  auction: '0x6dfAEDBD161f99d655a818AF23377344FB16db1a',
  oldMine: '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  newMine: '0x48eCa05c37E9F7c4F9CA05124c05cC6a145C9aaC',
}

const p = new ethers.JsonRpcProvider(RPC)
const w = new ethers.Wallet(PK, p)
console.log('Wallet:', w.address)

const AUC_ABI  = ['function auctions(uint256) view returns(address,uint128,uint128,uint64,uint64)','function cancelAuction(uint256) external','function createAuction(uint256,uint128,uint128,uint64) external']
const LAND_ABI = ['function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external','function isApprovedForAll(address,address) view returns(bool)']
const OLD_ABI  = ['function slotCount(uint256) view returns(uint256)','function slots(uint256,uint256) view returns(uint256,uint256,uint256)','function stopMining(uint256,uint256) external']
const NEW_ABI  = ['function startMining(uint256,uint256,uint256) external','function slotCount(uint256) view returns(uint256)','function pendingRewards(uint256) view returns(uint256[5])']

const auc     = new ethers.Contract(ADDR.auction, AUC_ABI, w)
const land    = new ethers.Contract(ADDR.land, LAND_ABI, w)
const oldMine = new ethers.Contract(ADDR.oldMine, OLD_ABI, w)
const newMine = new ethers.Contract(ADDR.newMine, NEW_ABI, w)

const sleep = ms => new Promise(r=>setTimeout(r,ms))

async function tx(contract, fn, args, label) {
  for(let r=0;r<5;r++){
    try{
      const nonce = await p.getTransactionCount(w.address, 'pending')
      const t = await contract[fn](...args, {nonce, gasLimit:350000})
      process.stdout.write(`  ${label}: ${t.hash.slice(0,10)}...`)
      await t.wait(); process.stdout.write('✅\n'); await sleep(1500)
      return true
    }catch(e){
      const m=(e.message||'').toLowerCase()
      if(m.includes('nonce')||m.includes('already')){await sleep(2000);continue}
      if(m.includes('rate')||m.includes('429')){await sleep(5000*(r+1));continue}
      console.log(`\n  ⚠ ${label}: ${e.reason||e.message.slice(0,70)}`)
      return false
    }
  }
  return false
}

// STEP 1: 扫描有活跃槽位的地块
const KNOWN = [1,4,5,101,102,103,104,105,201,202,203,204,403,405,504,602,605,704,803]
const toMigrate = []  // [{landId, apoId, drlId, hadAuction, aStart, aEnd, aDur}]

console.log('\n[1] 扫描状态...')
for(const id of KNOWN){
  const cnt = Number(await oldMine.slotCount(id).catch(()=>0n))
  if(cnt===0) continue
  const slots = []
  for(let i=0;i<cnt;i++){
    const s = await oldMine.slots(id,i)
    slots.push({apoId:s[0], drlId:s[1]})
  }
  // 检查是否在拍卖
  const a = await auc.auctions(id).catch(()=>null)
  const inAuction = a && Number(a[4])>0
  console.log(` 地块#${id}: ${cnt}槽 ${inAuction?'[拍卖中]':'[无拍卖]'}`)
  toMigrate.push({landId:id, slots, inAuction, aStart:a?a[1]:0n, aEnd:a?a[2]:0n, aDur:a?a[3]:0n})
}
console.log('需迁移地块:', toMigrate.length)

// STEP 2: 确保 land 对拍卖合约有授权（用于重新挂）
if(!await land.isApprovedForAll(w.address, ADDR.auction)){
  await tx(land,'setApprovalForAll',[ADDR.auction,true],'land→auc授权')
}
if(!await land.isApprovedForAll(w.address, ADDR.oldMine)){
  await tx(land,'setApprovalForAll',[ADDR.oldMine,true],'land→oldMine授权')
}

let ok=0, fail=0
const reAuction = []  // 需要重新挂拍卖的地块

console.log('\n[2] 迁移...')
for(const {landId, slots, inAuction, aStart, aEnd, aDur} of toMigrate){
  console.log(`\n地块#${landId} (${slots.length}槽${inAuction?', 需先取消拍卖':''})`)

  // 如果在拍卖中，先取消
  if(inAuction){
    const cancelled = await tx(auc,'cancelAuction',[landId],`取消拍卖#${landId}`)
    if(!cancelled){fail+=slots.length;continue}
    reAuction.push({landId, aStart, aEnd, aDur})
  }

  // 逐个迁移槽位
  for(const {apoId, drlId} of slots){
    const stopped = await tx(oldMine,'stopMining',[landId,apoId],`stop#${apoId}`)
    if(!stopped){fail++;continue}
    const started = await tx(newMine,'startMining',[landId,apoId,drlId],`start#${apoId}`)
    if(started) ok++; else fail++
  }
}

// STEP 3: 重新挂拍卖
console.log('\n[3] 重新挂拍卖...')
for(const {landId, aStart, aEnd, aDur} of reAuction){
  // 剩余时间继续（用原参数）
  await tx(auc,'createAuction',[landId, aStart, aEnd, aDur], `重挂#${landId}`)
}

// STEP 4: 验证
console.log('\n[4] 验证产出...')
await sleep(6000)
for(const {landId} of toMigrate){
  const cnt = Number(await newMine.slotCount(landId).catch(()=>0n))
  if(cnt===0) continue
  const r = await newMine.pendingRewards(landId)
  const total = r.reduce((s,x)=>s+Number(ethers.formatEther(x)),0)
  console.log(` 地块#${landId}(${cnt}槽): total=${total.toFixed(6)} tokens`)
}

console.log(`\n=== 完成 迁移${ok}成功 ${fail}失败 ===`)
console.log('新合约:', ADDR.newMine)
