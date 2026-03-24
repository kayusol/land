// fix_and_list.mjs — 修复授权并挂市场单子
import { ethers } from 'ethers'

const PK='0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const NFT_AUC='0xe489Fd17B4aBF3b22482Bf0f09193f9902f1fd22'
const C={
  ring:'0x3fa38920EED345672dF7FF916b5EbE4f095822aE',
  land:'0x889DCe5b3934D56f3814f93793F8e1f8710249ea',
  drill:'0x782827AdA353d4f958964e1E10D5d940e4B38409',
  apostle:'0xbBce394d561E67bA9C0720d3aD56b25bC12Ee4f0',
  mining:'0x5A9963394e9EeA042b9eCBB0389B0cC587cbcBB4',
  oldAuc:'0xfACc3eaD5EA9Ec5F2fe56568918b21Fb3b899284',
}
const RPCS=['https://api.zan.top/bsc-testnet','https://bsc-testnet-rpc.publicnode.com']
let p,w
for(const rpc of RPCS){
  try{
    const _p=new ethers.JsonRpcProvider(rpc)
    await Promise.race([_p.getBlockNumber(),new Promise((_,r)=>setTimeout(()=>r(new Error),5000))])
    p=_p;w=new ethers.Wallet(PK,p);console.log('RPC:',rpc);break
  }catch{console.log('fail:',rpc)}
}
let nonce=await p.getTransactionCount(w.address,'pending')
console.log('Balance:',ethers.formatEther(await p.getBalance(w.address)),'BNB | Nonce:',nonce)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

const ABI={
  nftAuc:[
    'function createAuction(address,uint256,uint128,uint128,uint64) external',
    'function getAuction(address,uint256) view returns (tuple(address nftContract,address seller,uint128 startPrice,uint128 endPrice,uint64 duration,uint64 startedAt))',
    'function cancelAuction(address,uint256) external',
    'function bid(address,uint256,uint256) external',
    'function currentPrice(address,uint256) view returns (uint256)',
  ],
  apostle:[
    'function operators(address) view returns (bool)',
    'function setOperator(address,bool) external',
    'function isApprovedForAll(address,address) view returns (bool)',
    'function setApprovalForAll(address,bool) external',
    'function ownerOf(uint256) view returns (address)',
    'function nextId() view returns (uint256)',
  ],
  drill:[
    'function operators(address) view returns (bool)',
    'function setOperator(address,bool) external',
    'function isApprovedForAll(address,address) view returns (bool)',
    'function setApprovalForAll(address,bool) external',
    'function ownerOf(uint256) view returns (address)',
    'function nextId() view returns (uint256)',
  ],
  land:[
    'function isApprovedForAll(address,address) view returns (bool)',
    'function setApprovalForAll(address,bool) external',
    'function ownerOf(uint256) view returns (address)',
  ],
  mining:['function slotCount(uint256) view returns (uint256)'],
  oldAuc:['function auctions(uint256) view returns (address,uint128,uint128,uint64,uint64)'],
  ring:['function approve(address,uint256) external returns (bool)'],
}
const cAuc=new ethers.Contract(NFT_AUC,ABI.nftAuc,w)
const cApo=new ethers.Contract(C.apostle,ABI.apostle,w)
const cDrl=new ethers.Contract(C.drill,ABI.drill,w)
const cLand=new ethers.Contract(C.land,ABI.land,w)
const cMining=new ethers.Contract(C.mining,ABI.mining,p)
const cOldAuc=new ethers.Contract(C.oldAuc,ABI.oldAuc,p)
const cRing=new ethers.Contract(C.ring,ABI.ring,w)

async function send(contract,fn,args,label,gas=400000){
  try{
    const t=await contract[fn](...args,{nonce:nonce++,gasLimit:gas,gasPrice:ethers.parseUnits('10','gwei')})
    process.stdout.write(`  ${label}: ${t.hash.slice(0,10)}...`)
    await Promise.race([t.wait(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('to')),45000))])
    process.stdout.write(' ✅\n');return true
  }catch(e){
    const m=(e.message||'').toLowerCase()
    if(m.includes('to')){process.stdout.write(' ⏱\n');nonce=await p.getTransactionCount(w.address,'pending').catch(()=>nonce);return true}
    nonce=await p.getTransactionCount(w.address,'pending').catch(()=>nonce)
    console.log(`  ⚠ ${label}: ${e.reason||e.message.slice(0,80)}`);return false
  }
}

// ── 修复授权（逐一确认）
console.log('\n=== 修复授权 ===')

// apostle: setOperator + setApprovalForAll 双保险
const apoIsOp=await cApo.operators(NFT_AUC).catch(()=>false)
if(!apoIsOp){
  await send(cApo,'setOperator',[NFT_AUC,true],'apostle setOperator(NFTAuc)')
  await sleep(2000)
}
const apoIsAppr=await cApo.isApprovedForAll(w.address,NFT_AUC).catch(()=>false)
if(!apoIsAppr){
  await send(cApo,'setApprovalForAll',[NFT_AUC,true],'apostle setApprovalForAll(NFTAuc)')
  await sleep(2000)
}
// drill
const drlIsOp=await cDrl.operators(NFT_AUC).catch(()=>false)
if(!drlIsOp){
  await send(cDrl,'setOperator',[NFT_AUC,true],'drill setOperator(NFTAuc)')
  await sleep(2000)
}
const drlIsAppr=await cDrl.isApprovedForAll(w.address,NFT_AUC).catch(()=>false)
if(!drlIsAppr){
  await send(cDrl,'setApprovalForAll',[NFT_AUC,true],'drill setApprovalForAll(NFTAuc)')
  await sleep(2000)
}
// land
const landIsAppr=await cLand.isApprovedForAll(w.address,NFT_AUC).catch(()=>false)
if(!landIsAppr){
  await send(cLand,'setApprovalForAll',[NFT_AUC,true],'land setApprovalForAll(NFTAuc)')
  await sleep(2000)
}
// ring
await send(cRing,'approve',[NFT_AUC,ethers.parseEther('9999999')],'ring approve NFTAuc')
await sleep(1000)

// 验证授权
const [v1,v2,v3,v4,v5]=await Promise.all([
  cApo.operators(NFT_AUC),
  cApo.isApprovedForAll(w.address,NFT_AUC),
  cDrl.operators(NFT_AUC),
  cDrl.isApprovedForAll(w.address,NFT_AUC),
  cLand.isApprovedForAll(w.address,NFT_AUC),
])
console.log('验证授权:')
console.log('  apostle operator:',v1,'| isApprovedForAll:',v2)
console.log('  drill   operator:',v3,'| isApprovedForAll:',v4)
console.log('  land    isApprovedForAll:',v5)
if(!v2&&!v1){console.log('❌ apostle 授权失败，退出');process.exit(1)}

// ── 挂使徒（30个，id 152-220）
console.log('\n=== 挂使徒 ===')
const apoNext=Number(await cApo.nextId())-1
let apoListed=0
for(let id=152;id<=Math.min(220,apoNext)&&apoListed<30;id++){
  const owner=await cApo.ownerOf(id).catch(()=>null)
  if(!owner||owner.toLowerCase()!==w.address.toLowerCase()) continue
  try{
    const a=await cAuc.getAuction(C.apostle,BigInt(id))
    if(Number(a.startedAt)>0){console.log(`  使徒#${id}已在拍卖`);apoListed++;continue}
  }catch{}
  // staticCall 验证
  try{
    await cAuc.createAuction.staticCall(C.apostle,BigInt(id),ethers.parseEther('2'),ethers.parseEther('0.5'),BigInt(3*24*3600))
  }catch(e){console.log(`  使徒#${id} staticCall失败:`,e.reason||e.message.slice(0,60));continue}
  const sp=ethers.parseEther(String((1+(id%10)*0.5).toFixed(1)))
  const ep=ethers.parseEther('0.3')
  const ok=await send(cAuc,'createAuction',[C.apostle,BigInt(id),sp,ep,BigInt(3*24*3600)],`使徒#${id} ${ethers.formatEther(sp)}R`)
  if(ok) apoListed++
}
console.log(`  ✅ 挂出 ${apoListed} 个使徒`)

// ── 挂钻头（30个，id 152-220）
console.log('\n=== 挂钻头 ===')
const drlNext=Number(await cDrl.nextId())-1
let drlListed=0
for(let id=152;id<=Math.min(220,drlNext)&&drlListed<30;id++){
  const owner=await cDrl.ownerOf(id).catch(()=>null)
  if(!owner||owner.toLowerCase()!==w.address.toLowerCase()) continue
  try{
    const a=await cAuc.getAuction(C.drill,BigInt(id))
    if(Number(a.startedAt)>0){console.log(`  钻头#${id}已在拍卖`);drlListed++;continue}
  }catch{}
  try{
    await cAuc.createAuction.staticCall(C.drill,BigInt(id),ethers.parseEther('1'),ethers.parseEther('0.1'),BigInt(3*24*3600))
  }catch(e){console.log(`  钻头#${id} staticCall失败:`,e.reason||e.message.slice(0,60));continue}
  const sp=ethers.parseEther(String((0.5+(id%5)*0.3).toFixed(1)))
  const ep=ethers.parseEther('0.1')
  const ok=await send(cAuc,'createAuction',[C.drill,BigInt(id),sp,ep,BigInt(3*24*3600)],`钻头#${id} ${ethers.formatEther(sp)}R`)
  if(ok) drlListed++
}
console.log(`  ✅ 挂出 ${drlListed} 个钻头`)

// ── 挂土地（20个，找空闲地块）
console.log('\n=== 挂土地 ===')
const COORDS=[]
for(let x=0;x<12;x++) for(let y=0;y<5;y++) COORDS.push([x,y])
let landListed=0
for(const [x,y] of COORDS){
  if(landListed>=20) break
  const id=x*100+y+1
  const owner=await cLand.ownerOf(id).catch(()=>null)
  if(!owner||owner.toLowerCase()!==w.address.toLowerCase()) continue
  // 旧拍卖检查
  const oldA=await cOldAuc.auctions(id).catch(()=>null)
  if(oldA&&Number(oldA[4])>0) continue
  // 新拍卖检查
  try{
    const a=await cAuc.getAuction(C.land,BigInt(id))
    if(Number(a.startedAt)>0){console.log(`  土地#${id}已在新拍卖`);landListed++;continue}
  }catch{}
  // 挖矿检查
  const slots=Number(await cMining.slotCount(id).catch(()=>0n))
  if(slots>0) continue
  try{
    await cAuc.createAuction.staticCall(C.land,BigInt(id),ethers.parseEther('5'),ethers.parseEther('1'),BigInt(3*24*3600))
  }catch(e){console.log(`  土地#${id} staticCall失败:`,e.reason||e.message.slice(0,60));continue}
  const sp=ethers.parseEther(String(3+(id%10)))
  const ep=ethers.parseEther('1')
  const ok=await send(cAuc,'createAuction',[C.land,BigInt(id),sp,ep,BigInt(3*24*3600)],`土地#${id} ${ethers.formatEther(sp)}R`)
  if(ok) landListed++
}
console.log(`  ✅ 挂出 ${landListed} 块土地`)

// ── 更新 contracts.js
import { readFileSync, writeFileSync } from 'fs'
const cjs=readFileSync('src/constants/contracts.js','utf8')
if(!cjs.includes('NFT_AUCTION_ADDR')){
  const updated=cjs.replace(
    'export const DEPLOYER',
    `export const NFT_AUCTION_ADDR = '${NFT_AUC}'\nexport const DEPLOYER`
  )
  writeFileSync('src/constants/contracts.js',updated)
  console.log('\n✅ contracts.js 已更新，写入 NFT_AUCTION_ADDR')
} else {
  console.log('\n✅ NFT_AUCTION_ADDR 已存在于 contracts.js')
}
console.log('\n🎉 全部完成！')
console.log('NFTAuction:', NFT_AUC)
