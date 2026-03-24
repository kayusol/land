/**
 * relist2.mjs — 用 tokenOfOwnerByIndex 找真正在 wallet 的 NFT 来挂单
 */
import { ethers } from 'ethers'
const PK='0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC='https://data-seed-prebsc-1-s1.binance.org:8545'
const ADDR={ring:'0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',land:'0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',drill:'0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',apostle:'0x3D06422b6623b422c4152cd53231f0F45232197A',mining:'0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',auction:'0x6dfAEDBD161f99d655a818AF23377344FB16db1a'}
const p=new ethers.JsonRpcProvider(RPC), w=new ethers.Wallet(PK,p)
console.log('Wallet:',w.address)

const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function send(c,fn,args){
  for(let r=0;r<6;r++){
    try{const tx=await c[fn](...args);process.stdout.write('  ↗ '+tx.hash.slice(0,12)+'...');await tx.wait();process.stdout.write(' ✓\n');await sleep(1200);return tx}
    catch(e){if((e.message||'').toLowerCase().includes('rate')&&r<5){await sleep(2500*(2**r));continue}throw e}
  }
}

const E721=['function balanceOf(address) view returns(uint256)','function tokenOfOwnerByIndex(address,uint256) view returns(uint256)','function setApprovalForAll(address,bool) external']
const AUC=['function auctions(uint256) view returns(address,uint128,uint128,uint64,uint64)','function createAuction(uint256,uint128,uint128,uint64) external']
const E20=['function approve(address,uint256) external returns(bool)']

const apoC=new ethers.Contract(ADDR.apostle,E721,w)
const drlC=new ethers.Contract(ADDR.drill,E721,w)
const lndC=new ethers.Contract(ADDR.land,E721,w)
const aucC=new ethers.Contract(ADDR.auction,AUC,w)
const ring=new ethers.Contract(ADDR.ring,E20,w)

// 授权
await send(apoC,'setApprovalForAll',[ADDR.auction,true])
await send(drlC,'setApprovalForAll',[ADDR.auction,true])
await send(lndC,'setApprovalForAll',[ADDR.auction,true])
await send(ring,'approve',[ADDR.auction,ethers.parseEther('999999')])
console.log('授权完成')

async function getOwnedIds(contract, label){
  const bal = Number(await contract.balanceOf(w.address))
  console.log(`${label} 持有: ${bal}`)
  const ids=[]
  for(let i=0;i<bal;i++) ids.push(Number(await contract.tokenOfOwnerByIndex(w.address,i)))
  return ids
}

const DUR=BigInt(3*24*3600)

// 使徒
console.log('\n扫描使徒...')
const apoIds = await getOwnedIds(apoC,'使徒')
let apoAuc=0
for(const id of apoIds){
  if(apoAuc>=60)break
  try{
    const auc=await aucC.auctions(id)
    if(auc[4]>0n){console.log(`  使徒#${id} 已挂单`);continue}
    const sp=3+((id-1)%5)
    await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther('1'),DUR])
    apoAuc++; if(apoAuc%10===0)console.log(`  已挂${apoAuc}个`)
  }catch(e){console.log(`  APO#${id}: ${e.reason||e.message}`)}
}
console.log(`使徒挂单: ${apoAuc}`)

// 钻头
console.log('\n扫描钻头...')
const drlIds = await getOwnedIds(drlC,'钻头')
let drlAuc=0
for(const id of drlIds){
  if(drlAuc>=60)break
  try{
    const auc=await aucC.auctions(id)
    if(auc[4]>0n){console.log(`  钻头#${id} 已挂单`);continue}
    const tier=((id-1)%5)+1, sp=1+tier
    await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther('1'),DUR])
    drlAuc++; if(drlAuc%10===0)console.log(`  已挂${drlAuc}个`)
  }catch(e){console.log(`  DRL#${id}: ${e.reason||e.message}`)}
}
console.log(`钻头挂单: ${drlAuc}`)

// 土地
console.log('\n扫描土地...')
const lndIds = await getOwnedIds(lndC,'土地')
let lndAuc=0
for(const id of lndIds){
  if(lndAuc>=12)break
  try{
    const auc=await aucC.auctions(id)
    if(auc[4]>0n){console.log(`  土地#${id} 已挂单`);continue}
    const sp=5+(id%8)
    await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther('1'),DUR])
    lndAuc++; console.log(`  土地#${id}: ${sp}→1 RING`)
  }catch(e){console.log(`  LND#${id}: ${e.reason||e.message}`)}
}
console.log(`\n完成! 使徒${apoAuc} + 钻头${drlAuc} + 土地${lndAuc}`)
