import { ethers } from 'ethers'

const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'
const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'
const p = new ethers.JsonRpcProvider(RPC)

const C = {
  ring:'0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',
  land:'0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  drill:'0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  apostle:'0x767E1082A32a52949FB6613B5fF403f10D2426f3',
  mining:'0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  auction:'0x6dfAEDBD161f99d655a818AF23377344FB16db1a',
  blindbox:'0x77AAB7a9CD934D9aEc5fE60b15DbFbCDe5BC6252',
  referral:'0xdefE1Df8a0F2bd91e6F2d88E564BDD511Ce87b1c',
  gold:'0xbFaEb7b0BeD3684051F8d087717009eEd131C69f',
  wood:'0x138C98Ca717917C584D878028bB02fB0BAc6E2c4',
  water:'0x3618bCa0A8B4a56E1cC57b6B6F4e145104f4ea49',
  fire:'0x3fb8134A6FFedc5bc467179905955fbE25780B33',
  soil:'0xedAED55F28480839C5417D54160a1E0dDA7E9f13',
}

const ERC20 = ['function balanceOf(address) view returns(uint256)','function name() view returns(string)']
const LAND_ABI = ['function ownerOf(uint256) view returns(address)','function resourceAttr(uint256) view returns(uint80)']
const APO_ABI = ['function nextId() view returns(uint256)','function attrs(uint256) view returns(uint8,uint8,uint8,uint16,uint64,uint64,uint64,uint32,uint32)','function ownerOf(uint256) view returns(address)','function isAdult(uint256) view returns(bool)','function growthProgress(uint256) view returns(uint8)','function breedFee() view returns(uint256)','function GROWTH_TIME() view returns(uint256)']
const DRL_ABI = ['function nextId() view returns(uint256)','function attrs(uint256) view returns(uint8,uint8)','function ownerOf(uint256) view returns(address)']
const MINE_ABI = ['function slotCount(uint256) view returns(uint256)','function slots(uint256,uint256) view returns(uint256,uint256,uint256)','function pendingRewards(uint256) view returns(uint256[5])','function MAX_APOSTLES_PER_LAND() view returns(uint256)','function apostleOnLand(uint256) view returns(uint256)']
const AUC_ABI = ['function auctions(uint256) view returns(address,uint128,uint128,uint64,uint64)','function currentPrice(uint256) view returns(uint256)']
const BB_ABI = ['function apostleBoxPrice() view returns(uint256)','function drillBoxPrice() view returns(uint256)']
const REF_ABI = ['function getRates() view returns(uint256[5])','function bound(address) view returns(bool)','function totalEarned(address,address) view returns(uint256)']

const ring=new ethers.Contract(C.ring,ERC20,p)
const land=new ethers.Contract(C.land,LAND_ABI,p)
const apo=new ethers.Contract(C.apostle,APO_ABI,p)
const drl=new ethers.Contract(C.drill,DRL_ABI,p)
const mine=new ethers.Contract(C.mining,MINE_ABI,p)
const auc=new ethers.Contract(C.auction,AUC_ABI,p)
const bb=new ethers.Contract(C.blindbox,BB_ABI,p)
const ref=new ethers.Contract(C.referral,REF_ABI,p)
const goldC=new ethers.Contract(C.gold,ERC20,p)
const woodC=new ethers.Contract(C.wood,ERC20,p)
const waterC=new ethers.Contract(C.water,ERC20,p)
const fireC=new ethers.Contract(C.fire,ERC20,p)
const soilC=new ethers.Contract(C.soil,ERC20,p)

const ELEM=['金','木','水','火','土']
function decodeAttr(a){const b=BigInt(a);return[Number(b&0xffffn),Number((b>>16n)&0xffffn),Number((b>>32n)&0xffffn),Number((b>>48n)&0xffffn),Number((b>>64n)&0xffffn)]}
function fmt(v,d=4){return Number(ethers.formatEther(v)).toFixed(d)}

const SEP='═'.repeat(50)
console.log(SEP)
console.log('  EvoLand BSC 完整流程审查')
console.log(SEP)

// ─── 1. 代币余额 ───────────────────────────────────────
console.log('\n【1】代币余额')
const ringBal=await ring.balanceOf(DEPLOYER)
const goldBal=await goldC.balanceOf(DEPLOYER)
const woodBal=await woodC.balanceOf(DEPLOYER)
console.log('  RING:',fmt(ringBal,2))
console.log('  GOLD:',fmt(goldBal,4),'WOOD:',fmt(woodBal,4))

// ─── 2. 地块资源审查 ──────────────────────────────────
console.log('\n【2】地块资源（前8块）')
let mintedCount=0
for(let id=1;id<=8;id++){
  try{
    const owner=await land.ownerOf(id)
    const attr=await land.resourceAttr(id)
    const v=decodeAttr(attr)
    const dom=v.indexOf(Math.max(...v))
    const mine_flag=owner.toLowerCase()===DEPLOYER.toLowerCase()?'我的':'他人'
    console.log(`  #${id}[${mine_flag}]: ${ELEM.map((e,i)=>e+v[i]).join(' ')} → 主:${ELEM[dom]}`)
    mintedCount++
  }catch(e){console.log(`  #${id}: 未铸造`)}
}

// ─── 3. 挖矿流程完整性 ────────────────────────────────
console.log('\n【3】挖矿状态（前5块已铸造地块）')
for(let id=1;id<=8;id++){
  try{
    await land.ownerOf(id)
    const cnt=Number(await mine.slotCount(id))
    if(cnt===0){console.log(`  地块#${id}: 空置`);continue}
    const rewards=await mine.pendingRewards(id)
    const totalReward=rewards.map(r=>fmt(r,6))
    console.log(`  地块#${id}: ${cnt}/5槽 | 待领: 金${totalReward[0]} 木${totalReward[1]} 水${totalReward[2]} 火${totalReward[3]} 土${totalReward[4]}`)
    for(let i=0;i<cnt;i++){
      const s=await mine.slots(id,i)
      const age=Math.floor((Date.now()/1000-Number(s[2]))/3600)
      console.log(`    槽${i}: 使徒#${s[0]} 钻头#${s[1]===0n?'无':s[1]} (已挖${age}h)`)
    }
  }catch(e){}
}

// ─── 4. ApostleV2 使徒审查 ────────────────────────────
console.log('\n【4】ApostleV2 使徒（抽样10个）')
const apoNext=Number(await apo.nextId())-1
const breedFee=await apo.breedFee()
const growthTime=Number(await apo.GROWTH_TIME())
console.log(`  总量:${apoNext} | 繁殖费:${fmt(breedFee,1)} RING | 成年:${growthTime/86400}天`)
// 统计成年/孵化/在矿
let adultCnt=0,miningCnt=0,eggCnt=0
const sampleIds=[1,10,20,50,100,150,190,198]
for(const id of sampleIds){
  if(id>apoNext) continue
  const at=await apo.attrs(id)
  const adult=await apo.isAdult(id)
  const progress=Number(await apo.growthProgress(id))
  const onLand=Number(await mine.apostleOnLand(id))
  const status=onLand>0?`⛏地块#${onLand}`:adult?'✅成年':'🥚'+progress+'%'
  console.log(`  #${id}: 力${at[0]} ${ELEM[at[1]]}系 ${at[2]===0?'♂':'♀'} G${at[3]} | ${status}`)
  if(adult) adultCnt++; else eggCnt++
  if(onLand>0) miningCnt++
}
// 批量统计
let totalAdult=0,totalMining=0
for(let id=1;id<=Math.min(apoNext,20);id++){
  const adult=await apo.isAdult(id)
  const onLand=Number(await mine.apostleOnLand(id))
  if(adult) totalAdult++
  if(onLand>0) totalMining++
}
console.log(`  前20个统计: 成年${totalAdult} 挖矿中${totalMining} 孵化中${20-totalAdult}`)

// ─── 5. 钻头审查 ──────────────────────────────────────
console.log('\n【5】钻头（抽样5个）')
const drlNext=Number(await drl.nextId())-1
console.log(`  总量:${drlNext}`)
for(const id of [1,50,100,150,200]){
  if(id>drlNext) continue
  const at=await drl.attrs(id)
  const owner=await drl.ownerOf(id).catch(()=>'[托管中]')
  const inMine=owner==='[托管中]'?'⛏挖矿':'空闲'
  console.log(`  #${id}: ${'★'.repeat(Number(at[0]))} ${ELEM[Number(at[1])]}系 | ${inMine}`)
}

// ─── 6. 拍卖市场审查 ──────────────────────────────────
console.log('\n【6】拍卖市场')
let aucActive=0
for(let id=1;id<=20;id++){
  try{
    const a=await auc.auctions(id)
    if(Number(a[4])===0) continue
    const price=await auc.currentPrice(id)
    const elapsed=Math.floor(Date.now()/1000-Number(a[4]))
    const pct=Math.min(100,Math.floor(elapsed/Number(a[3])*100))
    console.log(`  地块#${id}: ${fmt(a[1],1)}→${fmt(a[2],1)} RING | 当前:${fmt(price,3)} RING | 进度${pct}%`)
    aucActive++
  }catch(e){}
}
console.log(`  活跃拍卖: ${aucActive}个`)

// ─── 7. 盲盒流程 ──────────────────────────────────────
console.log('\n【7】盲盒')
const apoBoxPrice=await bb.apostleBoxPrice()
const drlBoxPrice=await bb.drillBoxPrice()
console.log(`  使徒盲盒: ${fmt(apoBoxPrice,1)} RING`)
console.log(`  钻头盲盒: ${fmt(drlBoxPrice,1)} RING`)
console.log(`  Deployer余额${fmt(ringBal,1)} RING, 可买使徒${Math.floor(Number(ethers.formatEther(ringBal))/Number(ethers.formatEther(apoBoxPrice)))}个`)

// ─── 8. 邀请系统 ──────────────────────────────────────
console.log('\n【8】邀请系统')
const rates=await ref.getRates()
console.log(`  奖励链: ${rates.map(r=>Number(r)/100+'%').join(' → ')}`)
const bound=await ref.bound(DEPLOYER)
console.log(`  Deployer已绑定: ${bound}`)
const goldEarned=await ref.totalEarned(DEPLOYER,C.gold)
console.log(`  累计GOLD邀请收益: ${fmt(goldEarned,4)}`)

// ─── 9. 产出计算验证 ──────────────────────────────────
console.log('\n【9】挖矿产出计算验证（地块#1槽0）')
try{
  const slotCnt=Number(await mine.slotCount(1))
  if(slotCnt>0){
    const s=await mine.slots(1,0)
    const landAttr=decodeAttr(await land.resourceAttr(1))
    const apoAt=await apo.attrs(s[0])
    const elapsed=Math.floor(Date.now()/1000-Number(s[2]))
    // 公式: rate * strength/50 * boost * elapsed / 86400
    const baseRate=landAttr[apoAt[1]] // 主元素对应的landRate
    const strength=Number(apoAt[0])
    const theoreticalPerDay=baseRate*strength/50
    const theoreticalNow=theoreticalPerDay*elapsed/86400
    const actualRewards=await mine.pendingRewards(1)
    const actualMain=Number(ethers.formatEther(actualRewards[apoAt[1]]))
    console.log(`  使徒#${s[0]}: 力量${strength} ${ELEM[apoAt[1]]}系`)
    console.log(`  地块该元素速率: ${baseRate}/天`)
    console.log(`  理论每天产出: ${theoreticalPerDay.toFixed(2)} (含所有槽)`)
    console.log(`  已挖${Math.floor(elapsed/3600)}h, 理论累计: ${theoreticalNow.toFixed(4)}`)
    console.log(`  实际待领(${ELEM[apoAt[1]]}): ${actualMain.toFixed(4)}`)
    const diff=Math.abs(theoreticalNow-actualMain)
    console.log(`  误差: ${diff.toFixed(4)} (${diff<1?'正常':'⚠需检查'})`)
  }else{console.log('  地块#1无挖矿中')}
}catch(e){console.log('  产出验证错误:',e.message.slice(0,60))}

console.log('\n'+SEP)
console.log('  审查完成')
console.log(SEP)
