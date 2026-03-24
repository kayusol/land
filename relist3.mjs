/**
 * relist3.mjs — ownerOf 扫描挂单
 */
import { ethers } from 'ethers'
const PK='0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC='https://data-seed-prebsc-2-s1.binance.org:8545'
const ADDR={ring:'0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',land:'0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',drill:'0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',apostle:'0x3D06422b6623b422c4152cd53231f0F45232197A',mining:'0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',auction:'0x6dfAEDBD161f99d655a818AF23377344FB16db1a'}
const p=new ethers.JsonRpcProvider(RPC),w=new ethers.Wallet(PK,p)
const me=w.address.toLowerCase()
console.log('Wallet:',me)
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function send(c,fn,args){for(let r=0;r<6;r++){try{const tx=await c[fn](...args);process.stdout.write('  ↗'+tx.hash.slice(0,10)+'...');await tx.wait();process.stdout.write('✓\n');await sleep(1200);return tx}catch(e){if((e.message||'').toLowerCase().includes('rate')&&r<5){await sleep(2000*(2**r));continue}throw e}}}

// multicall provider for batch ownerOf
const iface={ownerOf:new ethers.Interface(['function ownerOf(uint256) view returns(address)']),auctions:new ethers.Interface(['function auctions(uint256) view returns(address,uint128,uint128,uint64,uint64)']),nextId:new ethers.Interface(['function nextId() view returns(uint256)'])}

async function batchOwnerOf(contract,ids){
  // batch via provider.call in parallel groups of 10
  const BATCH=10; const results=[]
  for(let i=0;i<ids.length;i+=BATCH){
    const chunk=ids.slice(i,i+BATCH)
    const res=await Promise.all(chunk.map(id=>p.call({to:contract,data:iface.ownerOf.encodeFunctionData('ownerOf',[id])}).then(r=>{try{return iface.ownerOf.decodeFunctionResult('ownerOf',r)[0].toLowerCase()}catch{return null}}).catch(()=>null)))
    results.push(...res); await sleep(100)
  }
  return results
}
async function batchAuctions(ids){
  const BATCH=10; const results=[]
  for(let i=0;i<ids.length;i+=BATCH){
    const chunk=ids.slice(i,i+BATCH)
    const res=await Promise.all(chunk.map(id=>p.call({to:ADDR.auction,data:iface.auctions.encodeFunctionData('auctions',[id])}).then(r=>{try{const d=iface.auctions.decodeFunctionResult('auctions',r);return d[4]>0n}catch{return false}}).catch(()=>false)))
    results.push(...res); await sleep(100)
  }
  return results
}

const apoC=new ethers.Contract(ADDR.apostle,['function nextId() view returns(uint256)','function setApprovalForAll(address,bool) external'],w)
const drlC=new ethers.Contract(ADDR.drill,  ['function nextId() view returns(uint256)','function setApprovalForAll(address,bool) external'],w)
const lndC=new ethers.Contract(ADDR.land,   ['function setApprovalForAll(address,bool) external'],w)
const aucC=new ethers.Contract(ADDR.auction,['function createAuction(uint256,uint128,uint128,uint64) external'],w)
const ring=new ethers.Contract(ADDR.ring,   ['function approve(address,uint256) external returns(bool)'],w)

await send(apoC,'setApprovalForAll',[ADDR.auction,true])
await send(drlC,'setApprovalForAll',[ADDR.auction,true])
await send(lndC,'setApprovalForAll',[ADDR.auction,true])
await send(ring,'approve',[ADDR.auction,ethers.parseEther('999999')])
console.log('授权完成')

const apoTotal=Number(await apoC.nextId())-1
const drlTotal=Number(await drlC.nextId())-1
console.log(`使徒总数:${apoTotal} 钻头总数:${drlTotal}`)
const DUR=BigInt(3*24*3600)

// 扫描使徒
console.log('\n扫描使徒 owner...')
const apoIds=Array.from({length:apoTotal},(_,i)=>i+1)
const apoOwners=await batchOwnerOf(ADDR.apostle,apoIds)
const myApoIds=apoIds.filter((_,i)=>apoOwners[i]===me)
console.log(`我的使徒: ${myApoIds.length}`)
const apoAucked=await batchAuctions(myApoIds)
const apoToList=myApoIds.filter((_,i)=>!apoAucked[i])
console.log(`待挂单: ${apoToList.length}`)
let apoCount=0
for(const id of apoToList.slice(0,60)){
  try{const sp=3+((id-1)%5);await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther('1'),DUR]);apoCount++;if(apoCount%10===0)console.log(`  使徒已挂${apoCount}`)}
  catch(e){console.log(`  APO#${id}:${e.reason||e.shortMessage}`)}
}
console.log(`使徒挂单: ${apoCount}`)

// 扫描钻头
console.log('\n扫描钻头 owner...')
const drlIds=Array.from({length:drlTotal},(_,i)=>i+1)
const drlOwners=await batchOwnerOf(ADDR.drill,drlIds)
const myDrlIds=drlIds.filter((_,i)=>drlOwners[i]===me)
console.log(`我的钻头: ${myDrlIds.length}`)
const drlAucked=await batchAuctions(myDrlIds)
const drlToList=myDrlIds.filter((_,i)=>!drlAucked[i])
console.log(`待挂单: ${drlToList.length}`)
let drlCount=0
for(const id of drlToList.slice(0,60)){
  try{const tier=((id-1)%5)+1,sp=1+tier;await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther('1'),DUR]);drlCount++;if(drlCount%10===0)console.log(`  钻头已挂${drlCount}`)}
  catch(e){console.log(`  DRL#${id}:${e.reason||e.shortMessage}`)}
}
console.log(`钻头挂单: ${drlCount}`)

// 扫描土地
console.log('\n扫描土地...')
const LAND_IDS=[]
for(let x=0;x<=9;x++) for(let y=0;y<=4;y++) LAND_IDS.push(x*100+y+1)
for(let x=10;x<=19;x++) LAND_IDS.push(x*100+1)
const lndOwners=await batchOwnerOf(ADDR.land,LAND_IDS)
const myLndIds=LAND_IDS.filter((_,i)=>lndOwners[i]===me)
console.log(`我的土地(在wallet): ${myLndIds.length}`)
const lndAucked=await batchAuctions(myLndIds)
const lndToList=myLndIds.filter((_,i)=>!lndAucked[i])
let lndCount=0
for(const id of lndToList.slice(0,12)){
  try{const sp=5+(id%8);await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther('1'),DUR]);lndCount++;console.log(`  土地#${id}:${sp}→1 RING`)}
  catch(e){console.log(`  LND#${id}:${e.reason||e.shortMessage}`)}
}
console.log(`\n完成! 使徒${apoCount} + 钻头${drlCount} + 土地${lndCount}`)
