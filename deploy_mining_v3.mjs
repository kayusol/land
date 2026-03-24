// deploy_mining_v3.mjs — 部署带 adminStop 的 MiningSystemV2
import { ethers } from 'ethers'
import { readFileSync } from 'fs'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'
const C = {
  land:'0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  drill:'0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  apostle:'0x767E1082A32a52949FB6613B5fF403f10D2426f3',
  gold:'0xbFaEb7b0BeD3684051F8d087717009eEd131C69f',
  wood:'0x138C98Ca717917C584D878028bB02fB0BAc6E2c4',
  water:'0x3618bCa0A8B4a56E1cC57b6B6F4e145104f4ea49',
  fire:'0x3fb8134A6FFedc5bc467179905955fbE25780B33',
  soil:'0xedAED55F28480839C5417D54160a1E0dDA7E9f13',
  oldMine1:'0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  oldMine2:'0x48eCa05c37E9F7c4F9CA05124c05cC6a145C9aaC',
  blindbox:'0x77AAB7a9CD934D9aEc5fE60b15DbFbCDe5BC6252',
}
const p = new ethers.JsonRpcProvider(RPC)
const w = new ethers.Wallet(PK, p)
console.log('Deployer:', w.address)
const sleep = ms => new Promise(r=>setTimeout(r,ms))

const artifact = JSON.parse(readFileSync('artifacts/contracts/MiningV2.sol/MiningSystemV2.json','utf8'))
const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, w)

console.log('\n[1] 部署 MiningSystemV2 (带 adminStop)...')
const mine = await factory.deploy(C.land, C.drill, C.apostle, [C.gold,C.wood,C.water,C.fire,C.soil])
await mine.waitForDeployment()
const addr = await mine.getAddress()
console.log('✅ MiningSystemV2:', addr)

// 设置 minters
const ERC20=['function setMinter(address,bool) external']
console.log('\n[2] 设置资源 minters...')
for(const [name,tok] of [['GOLD',C.gold],['WOOD',C.wood],['HHO',C.water],['FIRE',C.fire],['SIOO',C.soil]]){
  const t=new ethers.Contract(tok,ERC20,w)
  await (await t.setMinter(addr,true)).wait(); await sleep(800)
  console.log(' ✅',name)
}

// 设置 operators
const OP=['function setOperator(address,bool) external']
console.log('\n[3] 设置 NFT operators...')
for(const [name,tok] of [['ApostleV2',C.apostle],['Drill',C.drill],['Land',C.land]]){
  const t=new ethers.Contract(tok,OP,w)
  await (await t.setOperator(addr,true)).wait(); await sleep(800)
  console.log(' ✅',name)
}

// 用 adminStop 迁移旧合约使徒
const MINE1_ABI=['function slotCount(uint256) view returns(uint256)','function slots(uint256,uint256) view returns(uint256,uint256,uint256)','function adminStop(uint256,uint256,address) external']
const NEW_ABI=['function startMining(uint256,uint256,uint256) external','function pendingRewards(uint256) view returns(uint256[5])','function slotCount(uint256) view returns(uint256)']
const APO_ABI=['function ownerOf(uint256) view returns(address)']

const mine1=new ethers.Contract(C.oldMine1,MINE1_ABI,w)
const mine2=new ethers.Contract(C.oldMine2,MINE1_ABI,w)
const newM=new ethers.Contract(addr,NEW_ABI,w)
const apo=new ethers.Contract(C.apostle,APO_ABI,p)

// 授权新合约
const APO2=['function setApprovalForAll(address,bool) external','function isApprovedForAll(address,address) view returns(bool)']
const apoW=new ethers.Contract(C.apostle,APO2,w)
if(!await apoW.isApprovedForAll(w.address,addr)){
  await (await apoW.setApprovalForAll(addr,true)).wait(); await sleep(800)
  console.log('\n[4] ✅ ApostleV2 授权新合约')
}
const DRL2=['function setApprovalForAll(address,bool) external','function isApprovedForAll(address,address) view returns(bool)']
const drlW=new ethers.Contract(C.drill,DRL2,w)
if(!await drlW.isApprovedForAll(w.address,addr)){
  await (await drlW.setApprovalForAll(addr,true)).wait(); await sleep(800)
  console.log('[4] ✅ Drill 授权新合约')
}

// 已知有槽位的地块
const LANDS=[1,4,5,101,102,103,104,105,201,202,203,204,403,405,504,602,605,704,803]
let ok=0,fail=0

console.log('\n[5] 用 adminStop 迁移旧合约...')
for(const mine_c of [mine1, mine2]){
  for(const landId of LANDS){
    const cnt=Number(await mine_c.slotCount(landId).catch(()=>0n))
    if(cnt===0) continue
    const slots=[]
    for(let i=0;i<cnt;i++){
      const s=await mine_c.slots(landId,i)
      slots.push({apoId:s[0],drlId:s[1]})
    }
    console.log(` 地块#${landId}: ${cnt}槽`)
    for(const {apoId,drlId} of slots){
      try{
        // adminStop 归还给 deployer
        const nonce=await p.getTransactionCount(w.address,'pending')
        const t1=await mine_c.adminStop(landId,apoId,w.address,{nonce,gasLimit:300000})
        await t1.wait(); await sleep(1200)
        // 放入新合约
        const nonce2=await p.getTransactionCount(w.address,'pending')
        const t2=await newM.startMining(landId,apoId,drlId,{nonce:nonce2,gasLimit:300000})
        await t2.wait(); await sleep(1200)
        console.log(`  ✅ 使徒#${apoId} 迁移成功`)
        ok++
      }catch(e){
        console.log(`  ⚠ 使徒#${apoId}: ${e.reason||e.message.slice(0,60)}`)
        fail++
      }
    }
  }
}

// 验证产出
console.log('\n[6] 验证产出...')
await sleep(8000)
let verified=0
for(const id of LANDS){
  const cnt=Number(await newM.slotCount(id).catch(()=>0n))
  if(cnt===0) continue
  const r=await newM.pendingRewards(id)
  const total=r.reduce((s,x)=>s+Number(ethers.formatEther(x)),0)
  if(total>0) console.log(` ✅ 地块#${id}(${cnt}槽): ${total.toFixed(4)} tokens`)
  else console.log(` 地块#${id}(${cnt}槽): 刚迁移，继续积累...`)
  verified++
}

console.log('\n═'.repeat(50))
console.log('MiningSystemV2 (带adminStop):', addr)
console.log('迁移:', ok, '成功,', fail, '失败')
console.log('更新 contracts.js: mining:', "'"+addr+"'")
console.log('═'.repeat(50))
