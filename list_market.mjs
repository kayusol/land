// list_market.mjs — 给使徒/钻头/土地各挂拍卖单子到市场
import { ethers } from 'ethers'

const PK='0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const ADDR={
  ring:'0x3fa38920EED345672dF7FF916b5EbE4f095822aE',
  land:'0x889DCe5b3934D56f3814f93793F8e1f8710249ea',
  drill:'0x782827AdA353d4f958964e1E10D5d940e4B38409',
  apostle:'0xbBce394d561E67bA9C0720d3aD56b25bC12Ee4f0',
  mining:'0x5A9963394e9EeA042b9eCBB0389B0cC587cbcBB4',
  auction:'0xfACc3eaD5EA9Ec5F2fe56568918b21Fb3b899284',
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
console.log('Nonce:',nonce,'| Balance:',ethers.formatEther(await p.getBalance(w.address)),'BNB\n')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))

const ABI={
  nft:['function ownerOf(uint256) view returns (address)',
       'function isApprovedForAll(address,address) view returns (bool)',
       'function setApprovalForAll(address,bool) external',
       'function nextId() view returns (uint256)'],
  land:['function ownerOf(uint256) view returns (address)',
        'function isApprovedForAll(address,address) view returns (bool)',
        'function setApprovalForAll(address,bool) external'],
  mining:['function slotCount(uint256) view returns (uint256)'],
  auction:['function createAuction(uint256,uint128,uint128,uint64) external',
           'function auctions(uint256) view returns (address,uint128,uint128,uint64,uint64)'],
  ring:['function approve(address,uint256) external returns (bool)'],
}
const cApo=new ethers.Contract(ADDR.apostle,ABI.nft,w)
const cDrl=new ethers.Contract(ADDR.drill,ABI.nft,w)
const cLand=new ethers.Contract(ADDR.land,ABI.land,w)
const cMining=new ethers.Contract(ADDR.mining,ABI.mining,w)
const cAuction=new ethers.Contract(ADDR.auction,ABI.auction,w)
const cRing=new ethers.Contract(ADDR.ring,ABI.ring,w)

async function sendOne(contract,fn,args,label,gas=500000){
  for(let r=0;r<5;r++){
    try{
      const t=await contract[fn](...args,{nonce:nonce++,gasLimit:gas,gasPrice:ethers.parseUnits('10','gwei')})
      process.stdout.write(`  ${label}: ${t.hash.slice(0,10)}...`)
      await Promise.race([t.wait(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),40000))])
      process.stdout.write(' ✅\n'); return true
    }catch(e){
      const m=(e.message||'').toLowerCase()
      if(m.includes('timeout')){process.stdout.write(' ⏱\n');nonce=await p.getTransactionCount(w.address,'pending').catch(()=>nonce);return true}
      if(m.includes('nonce')||m.includes('already')){nonce=await p.getTransactionCount(w.address,'pending').catch(()=>nonce);console.log(`  ⤷ ${label} nonce跳过`);return false}
      if(r<3){await sleep(3000*(r+1));nonce=await p.getTransactionCount(w.address,'pending').catch(()=>nonce);continue}
      console.log(`  ⚠ ${label}: ${e.reason||e.message.slice(0,60)}`);return false
    }
  }
  return false
}

async function ensureApproval(nftContract,nftAddr,label){
  const ok=await nftContract.isApprovedForAll(w.address,ADDR.auction).catch(()=>false)
  if(!ok){
    console.log(`  授权 ${label}→auction...`)
    await sendOne(nftContract,'setApprovalForAll',[ADDR.auction,true],`${label}授权`)
  }
}
async function isOnAuction(id){
  const a=await cAuction.auctions(id).catch(()=>null)
  return a&&Number(a[4])>0
}

// ring approve auction（大额）
await sendOne(cRing,'approve',[ADDR.auction,ethers.parseEther('9999999')],'ring→auction')

// ── 1. 挂 30 个使徒（id 151-220，这些没在挖矿）
console.log('\n[1] 挂使徒拍卖...')
await ensureApproval(cApo,ADDR.apostle,'apostle')
const apoNext=Number(await cApo.nextId())-1
let apoListed=0
// 使用 id 151-220 这批（挖矿用的是1-150）
for(let id=151;id<=Math.min(220,apoNext)&&apoListed<30;id++){
  const owner=await cApo.ownerOf(id).catch(()=>null)
  if(!owner||owner.toLowerCase()!==w.address.toLowerCase()) continue
  if(await isOnAuction(id)){console.log(`  使徒#${id}已在拍卖，跳过`);continue}
  // 价格：1-5 RING随机，底价0.5，3天
  const sp=ethers.parseEther(String((1+Math.floor(id%10)*0.5).toFixed(1)))
  const ep=ethers.parseEther('0.5')
  const ok=await sendOne(cAuction,'createAuction',[BigInt(id),sp,ep,BigInt(3*24*3600)],`使徒#${id} 起拍${ethers.formatEther(sp)}RING`)
  if(ok) apoListed++
}
console.log(`  ✅ 挂出 ${apoListed} 个使徒`)

// ── 2. 挂 30 个钻头（id 151-220）
console.log('\n[2] 挂钻头拍卖...')
await ensureApproval(cDrl,ADDR.drill,'drill')
const drlNext=Number(await cDrl.nextId())-1
let drlListed=0
for(let id=151;id<=Math.min(220,drlNext)&&drlListed<30;id++){
  const owner=await cDrl.ownerOf(id).catch(()=>null)
  if(!owner||owner.toLowerCase()!==w.address.toLowerCase()) continue
  if(await isOnAuction(id)){console.log(`  钻头#${id}已在拍卖，跳过`);continue}
  const sp=ethers.parseEther(String((0.5+Math.floor(id%5)*0.3).toFixed(1)))
  const ep=ethers.parseEther('0.1')
  const ok=await sendOne(cAuction,'createAuction',[BigInt(id),sp,ep,BigInt(3*24*3600)],`钻头#${id} 起拍${ethers.formatEther(sp)}RING`)
  if(ok) drlListed++
}
console.log(`  ✅ 挂出 ${drlListed} 个钻头`)

// ── 3. 补挂土地（找持有中且不在挖矿/拍卖的地块）
console.log('\n[3] 挂土地拍卖...')
await ensureApproval(cLand,ADDR.land,'land')
// 扫描所有60块地
const COORDS=[]
for(let x=0;x<12;x++) for(let y=0;y<5;y++) COORDS.push([x,y])
let landListed=0
for(const [x,y] of COORDS){
  if(landListed>=20) break
  const id=x*100+y+1
  const owner=await cLand.ownerOf(id).catch(()=>null)
  if(!owner||owner.toLowerCase()!==w.address.toLowerCase()) continue
  if(await isOnAuction(id)){continue}
  const slots=Number(await cMining.slotCount(id).catch(()=>0n))
  if(slots>0){continue} // 挖矿中的不挂
  const sp=ethers.parseEther(String(3+Math.floor(id%12)))
  const ep=ethers.parseEther('1')
  const ok=await sendOne(cAuction,'createAuction',[BigInt(id),sp,ep,BigInt(3*24*3600)],`土地#${id} 起拍${ethers.formatEther(sp)}RING`)
  if(ok) landListed++
  await sleep(200)
}
console.log(`  ✅ 挂出 ${landListed} 块土地`)

console.log('\n✅ 全部完成！刷新市场页面查看。')
