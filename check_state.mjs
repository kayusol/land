// check_state.mjs — 查清楚当前链上状态
import { ethers } from 'ethers'

const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'
const p = new ethers.JsonRpcProvider(RPC)
const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'

const OLD_MINE = '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2'
const NEW_MINE = '0x48eCa05c37E9F7c4F9CA05124c05cC6a145C9aaC'
const APOSTLE  = '0x767E1082A32a52949FB6613B5fF403f10D2426f3'
const DRILL    = '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe'

const MINE_ABI = ['function slotCount(uint256) view returns(uint256)','function slots(uint256,uint256) view returns(uint256,uint256,uint256)']
const NFT_ABI  = ['function ownerOf(uint256) view returns(address)','function isApprovedForAll(address,address) view returns(bool)']

const oldMine = new ethers.Contract(OLD_MINE, MINE_ABI, p)
const newMine = new ethers.Contract(NEW_MINE, MINE_ABI, p)
const apo     = new ethers.Contract(APOSTLE, NFT_ABI, p)
const drl     = new ethers.Contract(DRILL, NFT_ABI, p)

console.log('=== 旧合约活跃槽位 ===')
let oldSlots = []
for(let id=1; id<=1000; id++){
  const cnt = Number(await oldMine.slotCount(id).catch(()=>0n))
  if(cnt>0){
    for(let i=0;i<cnt;i++){
      const s = await oldMine.slots(id,i)
      oldSlots.push({landId:id, apoId:Number(s[0]), drlId:Number(s[1])})
    }
  }
}
console.log('旧合约剩余槽位:', oldSlots.length)
oldSlots.forEach(s=>console.log(` 地块#${s.landId} 使徒#${s.apoId} 钻头#${s.drlId}`))

console.log('\n=== 新合约活跃槽位 ===')
let newSlots = []
for(let id=1; id<=1000; id++){
  const cnt = Number(await newMine.slotCount(id).catch(()=>0n))
  if(cnt>0){
    for(let i=0;i<cnt;i++){
      const s = await newMine.slots(id,i)
      newSlots.push({landId:id, apoId:Number(s[0]), drlId:Number(s[1])})
    }
  }
}
console.log('新合约槽位:', newSlots.length)
newSlots.forEach(s=>console.log(` 地块#${s.landId} 使徒#${s.apoId} 钻头#${s.drlId}`))

console.log('\n=== 检查剩余使徒所有权 ===')
for(const {apoId, drlId} of oldSlots.slice(0,5)){
  const apoOwner = await apo.ownerOf(apoId).catch(()=>'error')
  const drlOwner = drlId ? await drl.ownerOf(drlId).catch(()=>'error') : 'N/A'
  console.log(` 使徒#${apoId} owner:${apoOwner===OLD_MINE?'旧合约':apoOwner===DEPLOYER?'deployer':apoOwner.slice(0,8)}`)
  if(drlId) console.log(` 钻头#${drlId} owner:${drlOwner===OLD_MINE?'旧合约':drlOwner===DEPLOYER?'deployer':drlOwner.slice(0,8)}`)
}

// 检查授权状态
const apoApprOld = await apo.isApprovedForAll(DEPLOYER, OLD_MINE)
const apoApprNew = await apo.isApprovedForAll(DEPLOYER, NEW_MINE)
const drlApprNew = await drl.isApprovedForAll(DEPLOYER, NEW_MINE)
console.log('\n=== 授权状态 ===')
console.log('ApostleV2 → OldMine:', apoApprOld)
console.log('ApostleV2 → NewMine:', apoApprNew)
console.log('Drill → NewMine:', drlApprNew)
