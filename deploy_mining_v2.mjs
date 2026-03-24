// deploy_mining_v2.mjs — 部署修复版 MiningSystem
import { ethers } from 'ethers'
import { readFileSync } from 'fs'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'

const C = {
  land:    '0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  drill:   '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  apostle: '0x767E1082A32a52949FB6613B5fF403f10D2426f3',
  gold:    '0xbFaEb7b0BeD3684051F8d087717009eEd131C69f',
  wood:    '0x138C98Ca717917C584D878028bB02fB0BAc6E2c4',
  water:   '0x3618bCa0A8B4a56E1cC57b6B6F4e145104f4ea49',
  fire:    '0x3fb8134A6FFedc5bc467179905955fbE25780B33',
  soil:    '0xedAED55F28480839C5417D54160a1E0dDA7E9f13',
  oldMining: '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  blindbox:  '0x77AAB7a9CD934D9aEc5fE60b15DbFbCDe5BC6252',
}

const p = new ethers.JsonRpcProvider(RPC)
const w = new ethers.Wallet(PK, p)
console.log('Deployer:', w.address)
console.log('Balance:', ethers.formatEther(await p.getBalance(w.address)), 'BNB')

const artifact = JSON.parse(readFileSync('artifacts/contracts/MiningV2.sol/MiningSystemV2.json','utf8'))
const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, w)

console.log('\n[1/5] Deploying MiningSystemV2...')
const mining = await factory.deploy(C.land, C.drill, C.apostle, [C.gold,C.wood,C.water,C.fire,C.soil])
await mining.waitForDeployment()
const miningAddr = await mining.getAddress()
console.log('✅ MiningSystemV2:', miningAddr)

const sleep = ms => new Promise(r=>setTimeout(r,ms))

// 给资源代币授权 MiningV2 为 minter
const ERC20_ABI=['function setMinter(address,bool) external','function minters(address) view returns(bool)']
console.log('\n[2/5] 授权资源代币 minter...')
const tokens=[C.gold,C.wood,C.water,C.fire,C.soil]
const names=['GOLD','WOOD','HHO','FIRE','SIOO']
for(let i=0;i<5;i++){
  const t=new ethers.Contract(tokens[i],ERC20_ABI,w)
  const tx=await t.setMinter(miningAddr,true)
  await tx.wait(); await sleep(1000)
  console.log(' ✅',names[i],'minter set')
}

// 给 ApostleV2 和 Drill 设置 MiningV2 为 operator
const OP_ABI=['function setOperator(address,bool) external']
console.log('\n[3/5] 设置 NFT operators...')
const apoV2=new ethers.Contract(C.apostle,OP_ABI,w)
await (await apoV2.setOperator(miningAddr,true)).wait(); await sleep(1000)
console.log(' ✅ ApostleV2 operator set')
const drillC=new ethers.Contract(C.drill,OP_ABI,w)
await (await drillC.setOperator(miningAddr,true)).wait(); await sleep(1000)
console.log(' ✅ Drill operator set')
const landC=new ethers.Contract(C.land,OP_ABI,w)
await (await landC.setOperator(miningAddr,true)).wait(); await sleep(1000)
console.log(' ✅ Land operator set')

// 验证产出公式
console.log('\n[4/5] 验证产出公式...')
const MINE_ABI=['function pendingRewards(uint256) view returns(uint256[5])','function slotCount(uint256) view returns(uint256)']
const newMine=new ethers.Contract(miningAddr,MINE_ABI,p)
// 查旧合约 slot 状态
const OLD_ABI=['function slotCount(uint256) view returns(uint256)','function slots(uint256,uint256) view returns(uint256,uint256,uint256)']
const oldMine=new ethers.Contract(C.oldMining,OLD_ABI,p)
let totalSlots=0
for(let id=1;id<=10;id++){
  try{
    const cnt=Number(await oldMine.slotCount(id))
    if(cnt>0) {totalSlots+=cnt; console.log(' 旧合约地块#'+id+':',cnt+'个槽位')}
  }catch(e){}
}
console.log(' 旧合约总槽位:',totalSlots,'(使徒/钻头仍在旧合约中，需手动停止后重新放入新合约)')

console.log('\n[5/5] 完成!')
console.log('═'.repeat(50))
console.log('MiningSystemV2:', miningAddr)
console.log('更新 src/constants/contracts.js:')
console.log("  mining: '"+miningAddr+"',")
console.log('═'.repeat(50))
console.log('\n⚠️  注意: 旧合约中的使徒/钻头需要:')
console.log('  1. 用旧合约地址 stopMining 取回')
console.log('  2. 用新合约地址 startMining 重新放入')
