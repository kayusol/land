// migrate_mining.mjs — 从旧 MiningSystem 迁移到 MiningSystemV2
import { ethers } from 'ethers'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'
const OLD_MINING = '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2'
const NEW_MINING = '0x48eCa05c37E9F7c4F9CA05124c05cC6a145C9aaC'
const APOSTLE    = '0x767E1082A32a52949FB6613B5fF403f10D2426f3'
const DRILL      = '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe'

const p = new ethers.JsonRpcProvider(RPC)
const w = new ethers.Wallet(PK, p)
console.log('Deployer:', w.address)

const OLD_ABI = [
  'function slotCount(uint256) view returns(uint256)',
  'function slots(uint256,uint256) view returns(uint256,uint256,uint256)',
  'function stopMining(uint256,uint256) external',
  'function pendingRewards(uint256) view returns(uint256[5])',
]
const NEW_ABI = [
  'function startMining(uint256,uint256,uint256) external',
  'function slotCount(uint256) view returns(uint256)',
  'function pendingRewards(uint256) view returns(uint256[5])',
]
const APO_ABI = [
  'function ownerOf(uint256) view returns(address)',
  'function setApprovalForAll(address,bool) external',
  'function isApprovedForAll(address,address) view returns(bool)',
]
const DRL_ABI = [
  'function ownerOf(uint256) view returns(address)',
  'function setApprovalForAll(address,bool) external',
  'function isApprovedForAll(address,address) view returns(bool)',
]
const LAND_ABI = ['function ownerOf(uint256) view returns(address)']

const oldMine = new ethers.Contract(OLD_MINING, OLD_ABI, w)
const newMine = new ethers.Contract(NEW_MINING, NEW_ABI, w)
const apo = new ethers.Contract(APOSTLE, APO_ABI, w)
const drl = new ethers.Contract(DRILL, DRL_ABI, w)
const land = new ethers.Contract('0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073', LAND_ABI, w)
const sleep = ms => new Promise(r=>setTimeout(r,ms))

// 扫描旧合约所有活跃槽位
console.log('\n[1/4] 扫描旧合约活跃槽位...')
const activeLands = []
for(let id=1; id<=1000; id++) {
  try {
    const cnt = Number(await oldMine.slotCount(id))
    if(cnt > 0) {
      const slots = []
      for(let i=0; i<cnt; i++) {
        const s = await oldMine.slots(id, i)
        slots.push({apostleId: s[0], drillId: s[1], startTime: s[2]})
      }
      activeLands.push({landId: id, slots})
      console.log(' 地块#'+id+': '+cnt+'个槽位')
    }
  } catch(e) {}
}
console.log('总计:', activeLands.reduce((s,l)=>s+l.slots.length,0), '个活跃槽位')

if(activeLands.length === 0) {
  console.log('无需迁移，退出')
  process.exit(0)
}

// 授权新合约操作使徒/钻头
console.log('\n[2/4] 授权新合约...')
if(!await apo.isApprovedForAll(w.address, NEW_MINING)) {
  await (await apo.setApprovalForAll(NEW_MINING, true)).wait()
  await sleep(1000)
  console.log(' ✅ ApostleV2 授权 MiningV2')
}
if(!await drl.isApprovedForAll(w.address, NEW_MINING)) {
  await (await drl.setApprovalForAll(NEW_MINING, true)).wait()
  await sleep(1000)
  console.log(' ✅ Drill 授权 MiningV2')
}

// 从旧合约 stop，然后在新合约 start
console.log('\n[3/4] 迁移槽位...')
let migratedCount = 0
for(const {landId, slots} of activeLands) {
  // 检查土地所有权（stopMining 要求土地所有者）
  let landOwner
  try { landOwner = await land.ownerOf(landId) } catch(e) { continue }
  
  for(const {apostleId, drillId} of slots) {
    console.log(` 迁移: 地块#${landId} 使徒#${apostleId} 钻头#${drillId===0n?'无':drillId}`)
    try {
      // 1. 从旧合约取回
      const stopTx = await oldMine.stopMining(landId, apostleId)
      await stopTx.wait(); await sleep(1200)
      console.log('   ✅ 从旧合约取回')
      
      // 2. 放入新合约
      const startTx = await newMine.startMining(landId, apostleId, drillId)
      await startTx.wait(); await sleep(1200)
      console.log('   ✅ 放入新合约')
      migratedCount++
    } catch(e) {
      console.log('   ⚠ 失败:', e.reason || e.message.slice(0,60))
    }
  }
}

// 验证产出
console.log('\n[4/4] 验证新合约产出...')
await sleep(3000)  // 等3秒有点产出
for(const {landId} of activeLands.slice(0,3)) {
  try {
    const rewards = await newMine.pendingRewards(landId)
    const nonZero = rewards.filter(r=>r>0n)
    if(nonZero.length > 0) {
      console.log(' 地块#'+landId+' 有产出:', rewards.map(r=>ethers.formatEther(r)).join(' '))
    } else {
      console.log(' 地块#'+landId+': 刚开始，需要等待...')
    }
  } catch(e) {}
}

console.log('\n迁移完成! 共迁移', migratedCount, '个槽位到 MiningSystemV2')
console.log('新合约地址:', NEW_MINING)
