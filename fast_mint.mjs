// fast_mint.mjs — 快速批量铸造（广播所有tx后统一等待确认）
import { ethers } from 'ethers'
import { writeFileSync } from 'fs'

const PK = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPCS = ['https://api.zan.top/bsc-testnet','https://bsc-testnet-rpc.publicnode.com','https://data-seed-prebsc-1-s2.binance.org:8545']
const ADDR = {
  ring:'0x3fa38920EED345672dF7FF916b5EbE4f095822aE',
  gold:'0x5E4b633ae293ec4e000B5934D68997E45D8Bc0B9',wood:'0xD91824b6130DdEf7ffd6b07C1AeFD1ebA60A3b37',
  water:'0x2FFac338404fadd6c551AcED8197E781Ffa6205C',fire:'0xc2d43F4655320227DaeaA0475E3254C83892D487',
  soil:'0x865607c7d948655a32da9bE40c70A16Ecae35572',land:'0x889DCe5b3934D56f3814f93793F8e1f8710249ea',
  drill:'0x782827AdA353d4f958964e1E10D5d940e4B38409',apostle:'0xbBce394d561E67bA9C0720d3aD56b25bC12Ee4f0',
  mining:'0x5A9963394e9EeA042b9eCBB0389B0cC587cbcBB4',auction:'0xfACc3eaD5EA9Ec5F2fe56568918b21Fb3b899284',
  init:'0x43Fb229f526CB3F55727F5ff881B37B69A6af0B8',
  blindbox:'0xF65669cd9D26BDCb57517586Aa0D252d3A13dE80',referral:'0xe5Ce03D51DDc7598646054480b4D37aEb21B0962',
}

let p, w
for(const rpc of RPCS){
  try{
    const _p=new ethers.JsonRpcProvider(rpc)
    await Promise.race([_p.getBlockNumber(),new Promise((_,r)=>setTimeout(()=>r(new Error),5000))])
    p=_p; w=new ethers.Wallet(PK,p); console.log('RPC:',rpc); break
  }catch{ console.log('fail:',rpc) }
}
if(!p){process.exit(1)}

const bal=await p.getBalance(w.address)
console.log('Balance:',ethers.formatEther(bal),'BNB')
let nonce=await p.getTransactionCount(w.address,'pending')
console.log('Nonce:',nonce,'\n')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

const ABI={
  init:['function batchMint(int16[] xs,int16[] ys,uint80[] attrs,address to) external'],
  land:['function ownerOf(uint256) view returns (address)','function isApprovedForAll(address,address) view returns (bool)','function setApprovalForAll(address,bool) external'],
  drill:['function mint(address,uint8,uint8) external returns (uint256)','function nextId() view returns (uint256)','function isApprovedForAll(address,address) view returns (bool)','function setApprovalForAll(address,bool) external'],
  apostle:['function mint(address,uint8,uint8) external returns (uint256)','function nextId() view returns (uint256)','function isApprovedForAll(address,address) view returns (bool)','function setApprovalForAll(address,bool) external'],
  mining:['function startMining(uint256,uint256,uint256) external','function slotCount(uint256) view returns (uint256)','function pendingRewards(uint256) view returns (uint256[5])'],
  auction:['function createAuction(uint256,uint128,uint128,uint64) external','function auctions(uint256) view returns (address,uint128,uint128,uint64,uint64)'],
  ring:['function approve(address,uint256) external returns (bool)'],
}
const cInit=new ethers.Contract(ADDR.init,ABI.init,w)
const cLand=new ethers.Contract(ADDR.land,ABI.land,w)
const cDrill=new ethers.Contract(ADDR.drill,ABI.drill,w)
const cApo=new ethers.Contract(ADDR.apostle,ABI.apostle,w)
const cMining=new ethers.Contract(ADDR.mining,ABI.mining,w)
const cAuction=new ethers.Contract(ADDR.auction,ABI.auction,w)
const cRing=new ethers.Contract(ADDR.ring,ABI.ring,w)

// 广播tx，不等confirm，返回promise列表
async function broadcast(contract,fn,args,label,gas=500000){
  try{
    const t=await contract[fn](...args,{nonce:nonce++,gasLimit:gas,gasPrice:ethers.parseUnits('10','gwei')})
    process.stdout.write(`  ${label}: ${t.hash.slice(0,10)}...\n`)
    return t.wait()
  }catch(e){
    const m=(e.message||'').toLowerCase()
    if(m.includes('nonce')||m.includes('already')){
      nonce=await p.getTransactionCount(w.address,'pending').catch(()=>nonce)
      return null
    }
    console.log(`  ⚠ ${label}: ${e.reason||e.message.slice(0,60)}`)
    return null
  }
}

// 噪声函数
function noiseVal(cx,cy,seed){
  let h=(cx*1619+cy*31337+seed*6791)^0xdeadbeef
  h=Math.imul(h^(h>>>16),0x45d9f3b)|0
  h=Math.imul(h^(h>>>16),0x45d9f3b)|0
  return((h^(h>>>16))>>>0)/0xffffffff
}
function makeAttr(x,y){
  const r=[]
  for(let e=0;e<5;e++){
    const v=noiseVal(x/20+e*3.7,y/20+e*2.3,42+e*137)*0.5
            +noiseVal(x/8+e*1.3,y/8+e*1.7,142+e*137)*0.3
            +noiseVal(x/4+e*0.7,y/4+e*0.9,242+e*137)*0.2
    r.push(Math.max(10,Math.min(120,Math.floor(v*130))))
  }
  return BigInt(r[0])|(BigInt(r[1])<<16n)|(BigInt(r[2])<<32n)|(BigInt(r[3])<<48n)|(BigInt(r[4])<<64n)
}
const COORDS=[]
for(let x=0;x<12;x++) for(let y=0;y<5;y++) COORDS.push([x,y])

// ── STEP 1: 补铸剩余地块
console.log('=== [1/5] 检查并补铸地块 ===')
{
  const promises=[]
  for(let i=0;i<COORDS.length;i+=10){
    const batch=COORDS.slice(i,i+10)
    // 检查第一块是否已铸
    const [x0,y0]=batch[0]
    const id0=x0*100+y0+1
    const owner=await cLand.ownerOf(id0).catch(()=>null)
    if(owner&&owner!=='0x0000000000000000000000000000000000000000'){
      console.log(`  批次#${Math.floor(i/10)+1} 已铸造，跳过`)
      continue
    }
    const xs=batch.map(([x])=>x),ys=batch.map(([,y])=>y),attrs=batch.map(([x,y])=>makeAttr(x,y))
    const p2=await broadcast(cInit,'batchMint',[xs,ys,attrs,w.address],`地块批次#${Math.floor(i/10)+1}`,3000000)
    if(p2) promises.push(p2)
    await sleep(200)
  }
  if(promises.length>0){
    console.log(`  等待 ${promises.length} 批地块确认...`)
    await Promise.allSettled(promises)
    console.log('  ✅ 地块铸造确认完毕')
  }else{ console.log('  ✅ 地块已全部铸造') }
}

// ── STEP 2: 补铸剩余使徒
console.log('\n=== [2/5] 补铸使徒 ===')
{
  const apoStart=Number(await cApo.nextId())
  if(apoStart>200){ console.log(`  已有 ${apoStart-1} 个使徒，跳过`) }
  else{
    console.log(`  从 #${apoStart} 开始广播...`)
    const promises=[]
    for(let i=apoStart;i<=200;i++){
      const str=30+((i-1)%14)*5, elem=(i-1)%5
      const p2=await broadcast(cApo,'mint',[w.address,str,elem],`使徒#${i}`)
      if(p2) promises.push(p2)
      if(i%20===0) await sleep(300) // 每20笔小暂停
    }
    console.log(`  广播完毕，等待 ${promises.length} 笔确认...`)
    await Promise.allSettled(promises)
    const finalNext=Number(await cApo.nextId())
    console.log(`  ✅ 使徒 nextId=${finalNext}（已有${finalNext-1}个）`)
  }
}

// ── STEP 3: 铸造200钻头
console.log('\n=== [3/5] 铸造钻头 ===')
{
  const drlStart=Number(await cDrill.nextId())
  if(drlStart>200){ console.log(`  已有 ${drlStart-1} 个钻头，跳过`) }
  else{
    console.log(`  从 #${drlStart} 开始广播...`)
    const promises=[]
    for(let i=drlStart;i<=200;i++){
      const tier=((i-1)%5)+1, aff=(i-1)%5
      const p2=await broadcast(cDrill,'mint',[w.address,tier,aff],`钻头#${i}`)
      if(p2) promises.push(p2)
      if(i%20===0) await sleep(300)
    }
    console.log(`  广播完毕，等待 ${promises.length} 笔确认...`)
    await Promise.allSettled(promises)
    const finalNext=Number(await cDrill.nextId())
    console.log(`  ✅ 钻头 nextId=${finalNext}（已有${finalNext-1}个）`)
  }
}

// ── STEP 4: 授权 + 挖矿(前30块) + 拍卖(后30块)
console.log('\n=== [4/5] 授权 + 挖矿 + 拍卖 ===')
{
  // 授权（幂等）
  const [l2m,a2m,d2m]=await Promise.all([
    cLand.isApprovedForAll(w.address,ADDR.mining).catch(()=>false),
    cApo.isApprovedForAll(w.address,ADDR.mining).catch(()=>false),
    cDrill.isApprovedForAll(w.address,ADDR.mining).catch(()=>false),
  ])
  const authTxs=[]
  if(!l2m){const p2=await broadcast(cLand,'setApprovalForAll',[ADDR.mining,true],'land→mining');if(p2)authTxs.push(p2)}
  if(!a2m){const p2=await broadcast(cApo,'setApprovalForAll',[ADDR.mining,true],'apo→mining');if(p2)authTxs.push(p2)}
  if(!d2m){const p2=await broadcast(cDrill,'setApprovalForAll',[ADDR.mining,true],'drl→mining');if(p2)authTxs.push(p2)}
  {const p2=await broadcast(cRing,'approve',[ADDR.auction,ethers.parseEther('999999')],'ring→auction');if(p2)authTxs.push(p2)}
  if(authTxs.length>0){await Promise.allSettled(authTxs);console.log('  ✅ 授权完成')}
  else{console.log('  ✅ 授权已就绪')}

  // 挖矿：前30块，每块5槽
  let minedSlots=0
  const mineTxs=[]
  let apoIdx=1,drlIdx=1
  for(const [x,y] of COORDS.slice(0,30)){
    const landId=x*100+y+1
    const existing=Number(await cMining.slotCount(landId).catch(()=>0n))
    for(let s=existing;s<5&&apoIdx<=150;s++){
      const p2=await broadcast(cMining,'startMining',[landId,apoIdx,drlIdx],`挖矿地#${landId}使#${apoIdx}`)
      if(p2){mineTxs.push(p2);minedSlots++}
      apoIdx++;drlIdx++
      await sleep(150)
    }
  }
  if(mineTxs.length>0){
    console.log(`  广播 ${mineTxs.length} 笔挖矿，等待确认...`)
    await Promise.allSettled(mineTxs)
  }
  console.log(`  ✅ 挖矿槽位 ${minedSlots} 个`)

  // 拍卖：后30块
  let aucCount=0
  const aucTxs=[]
  for(let i=0;i<30;i++){
    const [x,y]=COORDS[30+i]
    const landId=x*100+y+1
    const auc=await cAuction.auctions(landId).catch(()=>null)
    if(auc&&Number(auc[4])>0){console.log(`  地块#${landId}已在拍卖，跳过`);continue}
    const owner=await cLand.ownerOf(landId).catch(()=>null)
    if(!owner||owner.toLowerCase()!==w.address.toLowerCase()){
      console.log(`  地块#${landId}非本地址，跳过`);continue
    }
    const sp=ethers.parseEther(String(5+(i%16))),ep=ethers.parseEther('1'),dur=BigInt(7*24*3600)
    const p2=await broadcast(cAuction,'createAuction',[landId,sp,ep,dur],`拍卖地#${landId}`)
    if(p2){aucTxs.push(p2);aucCount++}
    await sleep(150)
  }
  if(aucTxs.length>0){
    console.log(`  广播 ${aucTxs.length} 笔拍卖，等待确认...`)
    await Promise.allSettled(aucTxs)
  }
  console.log(`  ✅ 挂拍地块 ${aucCount} 个`)
}

// ── STEP 5: 验证 + 写入 contracts.js
console.log('\n=== [5/5] 验证 + 写入 ===')
await sleep(3000)
const r1=await cMining.pendingRewards(1).catch(()=>[0n,0n,0n,0n,0n])
console.log('地块#1 产出(3s):', r1.map(x=>Number(ethers.formatEther(x)).toFixed(8)).join(' '))
const apoFinal=Number(await cApo.nextId())-1
const drlFinal=Number(await cDrill.nextId())-1
console.log(`使徒:${apoFinal} 钻头:${drlFinal}`)

const js=`export const CONTRACTS = {
  ring:        '${ADDR.ring}',
  gold:        '${ADDR.gold}',
  wood:        '${ADDR.wood}',
  water:       '${ADDR.water}',
  fire:        '${ADDR.fire}',
  soil:        '${ADDR.soil}',
  land:        '${ADDR.land}',
  drill:       '${ADDR.drill}',
  apostle:     '${ADDR.apostle}',
  mining:      '${ADDR.mining}',
  auction:     '${ADDR.auction}',
  initializer: '${ADDR.init}',
  referral:    '${ADDR.referral}',
  blindbox:    '${ADDR.blindbox}',
}
export const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'
export const PANCAKE_ROUTER = '0xD99D1c33F9fC3444f8101754aBC46c52416550d1'
export const WBNB = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd'
`
writeFileSync('src/constants/contracts.js',js)
console.log('\n✅ contracts.js 已更新！')
console.log('✅ 全部完成！')
