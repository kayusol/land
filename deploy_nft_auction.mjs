// deploy_nft_auction.mjs — 部署通用NFT拍卖合约 + 挂使徒/钻头/土地单子
import { ethers } from 'ethers'
import { readFileSync, writeFileSync } from 'fs'

const PK='0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const CONTRACTS={
  ring:'0x3fa38920EED345672dF7FF916b5EbE4f095822aE',
  land:'0x889DCe5b3934D56f3814f93793F8e1f8710249ea',
  drill:'0x782827AdA353d4f958964e1E10D5d940e4B38409',
  apostle:'0xbBce394d561E67bA9C0720d3aD56b25bC12Ee4f0',
  mining:'0x5A9963394e9EeA042b9eCBB0389B0cC587cbcBB4',
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

// 部署 NFTAuction
const art=JSON.parse(readFileSync('artifacts/contracts/NFTAuction.sol/NFTAuction.json','utf8'))
const factory=new ethers.ContractFactory(art.abi,art.bytecode,w)
console.log('\n部署 NFTAuction...')
const c=await factory.deploy(CONTRACTS.ring,{nonce:nonce++,gasLimit:2000000,gasPrice:ethers.parseUnits('10','gwei')})
process.stdout.write('  部署中: '+c.target+'...')
await c.waitForDeployment()
const NFT_AUC=await c.getAddress()
console.log(' ✅',NFT_AUC)
await sleep(1000)

const ABI={
  nftAuc:art.abi,
  nft:[
    'function ownerOf(uint256) view returns (address)',
    'function isApprovedForAll(address,address) view returns (bool)',
    'function setApprovalForAll(address,bool) external',
    'function nextId() view returns (uint256)',
    'function operators(address) view returns (bool)',
    'function setOperator(address,bool) external',
  ],
  mining:['function slotCount(uint256) view returns (uint256)'],
  ring:['function approve(address,uint256) external returns (bool)'],
  oldAuc:[
    'function auctions(uint256) view returns (address,uint128,uint128,uint64,uint64)',
  ]
}

const cNftAuc=new ethers.Contract(NFT_AUC,ABI.nftAuc,w)
const cApo=new ethers.Contract(CONTRACTS.apostle,ABI.nft,w)
const cDrl=new ethers.Contract(CONTRACTS.drill,ABI.nft,w)
const cLand=new ethers.Contract(CONTRACTS.land,ABI.nft,w)
const cMining=new ethers.Contract(CONTRACTS.mining,ABI.mining,p)
const cRing=new ethers.Contract(CONTRACTS.ring,ABI.ring,w)
const cOldAuc=new ethers.Contract('0xfACc3eaD5EA9Ec5F2fe56568918b21Fb3b899284',ABI.oldAuc,p)

async function sendOne(contract,fn,args,label,gas=500000){
  for(let r=0;r<5;r++){
    try{
      const t=await contract[fn](...args,{nonce:nonce++,gasLimit:gas,gasPrice:ethers.parseUnits('10','gwei')})
      process.stdout.write(`  ${label}: ${t.hash.slice(0,10)}...`)
      await Promise.race([t.wait(),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),40000))])
      process.stdout.write(' ✅\n');return true
    }catch(e){
      const m=(e.message||'').toLowerCase()
      if(m.includes('timeout')){process.stdout.write(' ⏱\n');nonce=await p.getTransactionCount(w.address,'pending').catch(()=>nonce);return true}
      if(m.includes('nonce')||m.includes('already')){nonce=await p.getTransactionCount(w.address,'pending').catch(()=>nonce);console.log(`  ⤷ ${label} nonce跳过`);return false}
      if(r<3){await sleep(2000*(r+1));nonce=await p.getTransactionCount(w.address,'pending').catch(()=>nonce);continue}
      console.log(`  ⚠ ${label}: ${e.reason||e.message.slice(0,80)}`);return false
    }
  }
  return false
}

// 授权三种NFT给新拍卖合约
console.log('\n授权 NFT → NFTAuction...')
// apostle: 设为 operator（走快速路径）
const apoIsOp=await cApo.operators(NFT_AUC).catch(()=>false)
if(!apoIsOp) await sendOne(cApo,'setOperator',[NFT_AUC,true],'apostle→NFTAuc operator')
// drill: 设为 operator
const drlIsOp=await cDrl.operators(NFT_AUC).catch(()=>false)
if(!drlIsOp) await sendOne(cDrl,'setOperator',[NFT_AUC,true],'drill→NFTAuc operator')
// land: setApprovalForAll
const landOk=await cLand.isApprovedForAll(w.address,NFT_AUC).catch(()=>false)
if(!landOk) await sendOne(cLand,'setApprovalForAll',[NFT_AUC,true],'land→NFTAuc')
// ring approve 大额
await sendOne(cRing,'approve',[NFT_AUC,ethers.parseEther('9999999')],'ring→NFTAuc')
console.log('  ✅ 授权完成')

// ── 挂使徒（id 151-200，30个）
console.log('\n[1] 挂使徒...')
const apoNext=Number(await cApo.nextId())-1
let apoListed=0
for(let id=151;id<=Math.min(210,apoNext)&&apoListed<30;id++){
  const owner=await cApo.ownerOf(id).catch(()=>null)
  if(!owner||owner.toLowerCase()!==w.address.toLowerCase()) continue
  // 检查是否已在新拍卖
  try{const a=await cNftAuc.getAuction(CONTRACTS.apostle,id);if(a.startedAt>0n){console.log(`  使徒#${id}已在拍卖`);continue}}catch{}
  const sp=ethers.parseEther(String((1+(id%10)*0.5).toFixed(1)))
  const ep=ethers.parseEther('0.5')
  const ok=await sendOne(cNftAuc,'createAuction',[CONTRACTS.apostle,BigInt(id),sp,ep,BigInt(3*24*3600)],`使徒#${id} ${ethers.formatEther(sp)}RING`)
  if(ok) apoListed++
}
console.log(`  ✅ 挂出 ${apoListed} 个使徒`)

// ── 挂钻头（id 151-200，30个）
console.log('\n[2] 挂钻头...')
const drlNext=Number(await cDrl.nextId())-1
let drlListed=0
for(let id=151;id<=Math.min(210,drlNext)&&drlListed<30;id++){
  const owner=await cDrl.ownerOf(id).catch(()=>null)
  if(!owner||owner.toLowerCase()!==w.address.toLowerCase()) continue
  try{const a=await cNftAuc.getAuction(CONTRACTS.drill,id);if(a.startedAt>0n){console.log(`  钻头#${id}已在拍卖`);continue}}catch{}
  const sp=ethers.parseEther(String((0.5+(id%5)*0.3).toFixed(1)))
  const ep=ethers.parseEther('0.1')
  const ok=await sendOne(cNftAuc,'createAuction',[CONTRACTS.drill,BigInt(id),sp,ep,BigInt(3*24*3600)],`钻头#${id} ${ethers.formatEther(sp)}RING`)
  if(ok) drlListed++
}
console.log(`  ✅ 挂出 ${drlListed} 个钻头`)

// ── 挂土地（找没在旧拍卖、没在挖矿的地块）
console.log('\n[3] 挂土地...')
const COORDS=[]
for(let x=0;x<12;x++) for(let y=0;y<5;y++) COORDS.push([x,y])
let landListed=0
for(const [x,y] of COORDS){
  if(landListed>=20) break
  const id=x*100+y+1
  const owner=await cLand.ownerOf(id).catch(()=>null)
  if(!owner||owner.toLowerCase()!==w.address.toLowerCase()) continue
  // 检查旧拍卖
  const oldAuc=await cOldAuc.auctions(id).catch(()=>null)
  if(oldAuc&&Number(oldAuc[4])>0) continue
  // 检查新拍卖
  try{const a=await cNftAuc.getAuction(CONTRACTS.land,id);if(a.startedAt>0n) continue}catch{}
  // 检查挖矿
  const slots=Number(await cMining.slotCount(id).catch(()=>0n))
  if(slots>0) continue
  const sp=ethers.parseEther(String(3+(id%10)))
  const ep=ethers.parseEther('1')
  const ok=await sendOne(cNftAuc,'createAuction',[CONTRACTS.land,BigInt(id),sp,ep,BigInt(3*24*3600)],`土地#${id} ${ethers.formatEther(sp)}RING`)
  if(ok) landListed++
  await sleep(100)
}
console.log(`  ✅ 挂出 ${landListed} 块土地`)

// ── 更新 contracts.js 加入 nftAuction 地址
const cjs=readFileSync('src/constants/contracts.js','utf8')
const updated=cjs.replace(
  "export const DEPLOYER",
  `export const NFT_AUCTION_ADDR = '${NFT_AUC}'\nexport const DEPLOYER`
)
writeFileSync('src/constants/contracts.js',updated)
console.log('\n✅ contracts.js 已更新，新增 NFT_AUCTION_ADDR =',NFT_AUC)
console.log('✅ 全部完成！')
