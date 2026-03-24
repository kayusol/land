/**
 * relist.mjs — 重新挂单：使徒/钻头/土地
 * 扫描 wallet 中所有未挂单的 NFT 挂到市场
 */
import { ethers } from 'ethers'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545'
const ADDR = {
  ring:'0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',
  land:'0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  drill:'0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  apostle:'0x3D06422b6623b422c4152cd53231f0F45232197A',
  mining:'0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  auction:'0x6dfAEDBD161f99d655a818AF23377344FB16db1a',
}

const p=new ethers.JsonRpcProvider(RPC)
const w=new ethers.Wallet(PK,p)
console.log('Wallet:', w.address)

const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function send(c,fn,args){
  for(let r=0;r<6;r++){
    try{
      const tx=await c[fn](...args)
      process.stdout.write('  ↗ '+tx.hash.slice(0,12)+'...')
      await tx.wait(); process.stdout.write(' ✓\n')
      await sleep(1200); return tx
    }catch(e){
      const m=(e.message||'').toLowerCase()
      if((m.includes('rate')||m.includes('429'))&&r<5){await sleep(2000*(2**r));continue}
      throw e
    }
  }
}

const APO_ABI=['function nextId() view returns(uint256)','function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external']
const DRL_ABI=['function nextId() view returns(uint256)','function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external']
const LND_ABI=['function ownerOf(uint256) view returns(address)','function setApprovalForAll(address,bool) external']
const MNG_ABI=['function slotCount(uint256) view returns(uint256)']
const AUC_ABI=['function auctions(uint256) view returns(address,uint128,uint128,uint64,uint64)','function createAuction(uint256,uint128,uint128,uint64) external']
const E20_ABI=['function approve(address,uint256) external returns(bool)']

const apoC=new ethers.Contract(ADDR.apostle,APO_ABI,w)
const drlC=new ethers.Contract(ADDR.drill,DRL_ABI,w)
const lndC=new ethers.Contract(ADDR.land,LND_ABI,w)
const mngC=new ethers.Contract(ADDR.mining,MNG_ABI,w)
const aucC=new ethers.Contract(ADDR.auction,AUC_ABI,w)
const ring=new ethers.Contract(ADDR.ring,E20_ABI,w)

const apoTotal=Number(await apoC.nextId())-1
const drlTotal=Number(await drlC.nextId())-1
console.log(`使徒总数: ${apoTotal}, 钻头总数: ${drlTotal}`)

// 授权
await send(apoC,'setApprovalForAll',[ADDR.auction,true])
await send(drlC,'setApprovalForAll',[ADDR.auction,true])
await send(lndC,'setApprovalForAll',[ADDR.auction,true])
await send(ring,'approve',[ADDR.auction,ethers.parseEther('999999')])
console.log('授权完成')

const DUR=3*24*3600 // 3天

// ── 使徒挂单（最多60个，跳过已挂/在挖矿的）──
let apoAuc=0
console.log('\n挂使徒...')
for(let id=1;id<=apoTotal&&apoAuc<60;id++){
  try{
    const own=await apoC.ownerOf(id)
    if(own.toLowerCase()!==w.address.toLowerCase()) continue
    const auc=await aucC.auctions(id)
    if(auc[4]>0n) continue
    const sp=3+(id%5) // 3-7 RING
    await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther('1'),DUR])
    apoAuc++
    if(apoAuc%10===0) console.log(`  使徒已挂 ${apoAuc} 个`)
  }catch(e){console.log(`  APO#${id}: ${e.reason||e.shortMessage||e.message}`)}
}
console.log(`使徒挂单: ${apoAuc}`)

// ── 钻头挂单（最多60个）──
let drlAuc=0
console.log('\n挂钻头...')
for(let id=1;id<=drlTotal&&drlAuc<60;id++){
  try{
    const own=await drlC.ownerOf(id)
    if(own.toLowerCase()!==w.address.toLowerCase()) continue
    const auc=await aucC.auctions(id)
    if(auc[4]>0n) continue
    const tier=(id%5)+1
    const sp=2+tier
    await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther('1'),DUR])
    drlAuc++
    if(drlAuc%10===0) console.log(`  钻头已挂 ${drlAuc} 个`)
  }catch(e){console.log(`  DRL#${id}: ${e.reason||e.shortMessage||e.message}`)}
}
console.log(`钻头挂单: ${drlAuc}`)

// ── 土地挂单（10-15块）──
let lndAuc=0
console.log('\n挂土地...')
const LAND_IDS=[]
for(let x=0;x<=9;x++) for(let y=0;y<=4;y++) LAND_IDS.push(x*100+y+1)
for(let x=10;x<=19;x++) LAND_IDS.push(x*100+1)

for(const id of LAND_IDS){
  if(lndAuc>=12) break
  try{
    const own=await lndC.ownerOf(id)
    if(own.toLowerCase()!==w.address.toLowerCase()) continue
    const slots=Number(await mngC.slotCount(id))
    if(slots>0) continue
    const auc=await aucC.auctions(id)
    if(auc[4]>0n) continue
    const sp=5+(id%8)
    await send(aucC,'createAuction',[id,ethers.parseEther(String(sp)),ethers.parseEther('1'),DUR])
    lndAuc++
    console.log(`  土地#${id}: ${sp}→1 RING`)
  }catch(e){console.log(`  LND#${id}: ${e.reason||e.shortMessage||e.message}`)}
}

console.log(`\n完成！使徒${apoAuc} + 钻头${drlAuc} + 土地${lndAuc}`)
