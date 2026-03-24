// deploy_v3.mjs — 全新部署所有合约 + 铸造游戏数据
import { ethers } from 'ethers'
import { readFileSync } from 'fs'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPCS = [
  'https://api.zan.top/bsc-testnet',
  'https://bsc-testnet-rpc.publicnode.com',
  'https://data-seed-prebsc-1-s2.binance.org:8545',
  'https://data-seed-prebsc-1-s1.binance.org:8545',
]

// 找一个可用的 RPC
let p, w
for(const rpc of RPCS){
  try{
    const _p = new ethers.JsonRpcProvider(rpc)
    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),6000))])
    p = _p; w = new ethers.Wallet(PK, p)
    console.log('RPC OK:', rpc); break
  }catch(e){ console.log('RPC fail:', rpc, e.message.slice(0,30)) }
}
if(!p){ console.error('所有RPC均不可用'); process.exit(1) }

console.log('Deployer:', w.address)
const bal = await p.getBalance(w.address)
console.log('Balance:', ethers.formatEther(bal), 'BNB\n')

const sleep = ms => new Promise(r=>setTimeout(r,ms))
let nonce = await p.getTransactionCount(w.address, 'pending')

async function deploy(name, ...args) {
  const art = JSON.parse(readFileSync(`artifacts/contracts/EvoLandV2.sol/${name}.json`,'utf8'))
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, w)
  for(let r=0;r<8;r++){
    try{
      const c = await factory.deploy(...args, {nonce: nonce++, gasLimit:5000000})
      process.stdout.write(`  Deploy ${name}: ${c.target||''}...`)
      await c.waitForDeployment()
      const addr = await c.getAddress()
      process.stdout.write(` ${addr} ✅\n`)
      await sleep(1500)
      return new ethers.Contract(addr, art.abi, w)
    }catch(e){
      nonce = await p.getTransactionCount(w.address,'pending').catch(()=>nonce)
      const m=(e.message||'').toLowerCase()
      if(m.includes('econnreset')||m.includes('timeout')||m.includes('network')){
        console.log(`  RPC异常，等待重试 (${r+1}/8)...`)
        await sleep(5000*(r+1)); continue
      }
      if(r<4){await sleep(3000*(r+1));continue}
      throw e
    }
  }
  throw new Error(`Deploy ${name} failed`)
}

async function tx(contract, fn, args, label) {
  for(let r=0;r<8;r++){
    try{
      const t = await contract[fn](...args, {nonce: nonce++, gasLimit:500000})
      process.stdout.write(`  ${label}: ${t.hash.slice(0,10)}...`)
      await t.wait()
      process.stdout.write('✅\n')
      await sleep(800)
      return true
    }catch(e){
      nonce = await p.getTransactionCount(w.address,'pending').catch(()=>nonce)
      const m=(e.message||'').toLowerCase()
      if(m.includes('econnreset')||m.includes('timeout')||m.includes('network')){
        await sleep(5000*(r+1)); continue
      }
      if(m.includes('rate')||m.includes('429')){await sleep(5000*(r+1));continue}
      if(r<4){await sleep(2000*(r+1));continue}
      console.log(`\n  ⚠ ${label}: ${e.reason||e.message.slice(0,60)}`)
      return false
    }
  }
  return false
}

// ── 1. 部署所有合约 ──────────────────────────────────────────────────────────
console.log('='.repeat(55))
console.log('[1/5] 部署合约...')
const ring  = await deploy('RingToken')
const gold  = await deploy('GoldToken')
const wood  = await deploy('WoodToken')
const water = await deploy('WaterToken')
const fire  = await deploy('FireToken')
const soil  = await deploy('SoilToken')
const land  = await deploy('LandNFT')
const drill = await deploy('DrillNFT')
const apo   = await deploy('ApostleNFT', await ring.getAddress())
const mining= await deploy('MiningSystem', await land.getAddress(), await drill.getAddress(), await apo.getAddress(),
  [await gold.getAddress(),await wood.getAddress(),await water.getAddress(),await fire.getAddress(),await soil.getAddress()])
const auction= await deploy('LandAuction', await land.getAddress(), await ring.getAddress())
const init  = await deploy('LandInitializer', await land.getAddress(), await auction.getAddress(), await ring.getAddress())
const bb    = await deploy('BlindBox', await apo.getAddress(), await drill.getAddress(), await ring.getAddress())
const ref   = await deploy('ReferralSystem')

const ADDR = {
  ring:    await ring.getAddress(),
  gold:    await gold.getAddress(),
  wood:    await wood.getAddress(),
  water:   await water.getAddress(),
  fire:    await fire.getAddress(),
  soil:    await soil.getAddress(),
  land:    await land.getAddress(),
  drill:   await drill.getAddress(),
  apostle: await apo.getAddress(),
  mining:  await mining.getAddress(),
  auction: await auction.getAddress(),
  init:    await init.getAddress(),
  blindbox:await bb.getAddress(),
  referral:await ref.getAddress(),
}
console.log('\n合约地址汇总:')
Object.entries(ADDR).forEach(([k,v])=>console.log(`  ${k.padEnd(10)}: ${v}`))

// ── 2. 授权配置 ──────────────────────────────────────────────────────────────
console.log('\n[2/5] 授权配置...')
// 资源代币 → mining 为 minter
for(const [name,c] of [['GOLD',gold],['WOOD',wood],['HHO',water],['FIRE',fire],['SIOO',soil]]){
  await tx(c,'setMinter',[ADDR.mining,true],`${name}→mining`)
}
// NFT → operator 授权
await tx(land, 'setOperator',[ADDR.init,true],'land→init')
await tx(land, 'setOperator',[ADDR.auction,true],'land→auction')
await tx(land, 'setOperator',[ADDR.mining,true],'land→mining')
await tx(apo,  'setOperator',[ADDR.mining,true],'apo→mining')
await tx(apo,  'setOperator',[ADDR.blindbox,true],'apo→blindbox')
await tx(drill,'setOperator',[ADDR.mining,true],'drl→mining')
await tx(drill,'setOperator',[ADDR.blindbox,true],'drl→blindbox')
// deployer → 合约授权
await tx(land, 'setApprovalForAll',[ADDR.auction,true],'land setAll→auction')
await tx(land, 'setApprovalForAll',[ADDR.mining,true],'land setAll→mining')
await tx(apo,  'setApprovalForAll',[ADDR.mining,true],'apo setAll→mining')
await tx(drill,'setApprovalForAll',[ADDR.mining,true],'drl setAll→mining')
// ring approve auction (for bid fee handling)
await tx(ring, 'approve',[ADDR.auction, ethers.parseEther('999999')],'ring→auction approve')
console.log('  ✅ 授权完成')

// ── 3. 铸造60块地 ─────────────────────────────────────────────────────────────
console.log('\n[3/5] 铸造60块地（Perlin资源分布，速率10-120）...')

// Perlin-like 噪声生成资源属性（与前端完全一致）
function noiseVal(cx,cy,seed){
  let h=(cx*1619+cy*31337+seed*6791)^0xdeadbeef
  h=Math.imul(h^(h>>>16),0x45d9f3b)|0
  h=Math.imul(h^(h>>>16),0x45d9f3b)|0
  return((h^(h>>>16))>>>0)/0xffffffff
}
function makeAttr(x,y){
  const rates=[]
  for(let e=0;e<5;e++){
    const v=noiseVal(x/20+e*3.7,y/20+e*2.3,42+e*137)*0.5
            +noiseVal(x/8+e*1.3,y/8+e*1.7,142+e*137)*0.3
            +noiseVal(x/4+e*0.7,y/4+e*0.9,242+e*137)*0.2
    rates.push(Math.max(10,Math.min(120,Math.floor(v*130))))
  }
  return(BigInt(rates[0])|(BigInt(rates[1])<<16n)|(BigInt(rates[2])<<32n)|(BigInt(rates[3])<<48n)|(BigInt(rates[4])<<64n))
}

// 铸造 60 块地 (x=0-11, y=0-4) 共 60 块
const LAND_COORDS=[]
for(let x=0;x<12;x++) for(let y=0;y<5;y++) LAND_COORDS.push([x,y])
const toLandId=(x,y)=>x*100+y+1

// 每批 10 块
const BATCH=10
for(let i=0;i<LAND_COORDS.length;i+=BATCH){
  const batch=LAND_COORDS.slice(i,i+BATCH)
  const xs=batch.map(([x])=>x)
  const ys=batch.map(([,y])=>y)
  const attrs=batch.map(([x,y])=>makeAttr(x,y))
  await tx(init,'batchMint',[xs,ys,attrs,w.address],`地块批次#${Math.floor(i/BATCH)+1}`)
}
console.log('  ✅ 60块地铸造完成')

// ── 4. 铸造200使徒 + 200钻头 ─────────────────────────────────────────────────
console.log('\n[4/5] 铸造使徒+钻头...')
// 使徒: 力量分布多样（30-95），元素循环
for(let i=0;i<200;i++){
  const str=30+Math.floor((i%14)*5)  // 30,35,...,95 循环
  const elem=i%5
  await tx(apo,'mint',[w.address,str,elem],`使徒#${i+1}`).catch(()=>{})
}
console.log('  ✅ 200个使徒铸造完成')
// 钻头: 等级循环1-5, 元素循环
for(let i=0;i<200;i++){
  const tier=(i%5)+1; const aff=i%5
  await tx(drill,'mint',[w.address,tier,aff],`钻头#${i+1}`).catch(()=>{})
}
console.log('  ✅ 200个钻头铸造完成')

// ── 5. 开挖矿(前30块) + 挂拍卖(后30块) ────────────────────────────────────
console.log('\n[5/5] 开挖矿+挂拍卖...')
// 前30块地 每块最多5使徒+5钻头
let apoIdx=1, drlIdx=1, minedSlots=0
const MINE_LANDS=LAND_COORDS.slice(0,30).map(([x,y])=>toLandId(x,y))
for(const landId of MINE_LANDS){
  for(let s=0;s<5;s++){
    if(apoIdx>200||drlIdx>200) break
    await tx(mining,'startMining',[landId,apoIdx,drlIdx],`挖矿地#${landId}使#${apoIdx}`).catch(()=>{})
    apoIdx++; drlIdx++; minedSlots++
  }
}
console.log(`  ✅ 开启 ${minedSlots} 个挖矿槽位`)

// 后30块地 挂拍卖（7天，价格5-20 RING下降到1 RING）
const AUC_LANDS=LAND_COORDS.slice(30,60).map(([x,y])=>toLandId(x,y))
const DUR=BigInt(7*24*3600)
let aucCount=0
for(let i=0;i<AUC_LANDS.length;i++){
  const sp=ethers.parseEther(String(5+(i%16)))  // 5-20 RING
  const ep=ethers.parseEther('1')
  await tx(auction,'createAuction',[AUC_LANDS[i],sp,ep,DUR],`拍卖地#${AUC_LANDS[i]}`).catch(()=>{})
  aucCount++
}
console.log(`  ✅ 挂拍 ${aucCount} 块地`)

// ── 验证产出 ─────────────────────────────────────────────────────────────────
console.log('\n验证...')
await sleep(5000)
const r1=await mining.pendingRewards(toLandId(0,0)).catch(()=>[0n,0n,0n,0n,0n])
console.log('地块#1 pending(5s):', r1.map(x=>Number(ethers.formatEther(x)).toFixed(6)).join(' '))

// ── 输出最终合约地址 ─────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(55))
console.log('✅ 全部完成！前端 contracts.js 更新为:')
console.log('='.repeat(55))
const contractsJs=`export const CONTRACTS = {
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
export const DEPLOYER = '${w.address}'
export const PANCAKE_ROUTER = '0xD99D1c33F9fC3444f8101754aBC46c52416550d1'
export const WBNB = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd'
`
// 写入前端文件
import { writeFileSync } from 'fs'
writeFileSync('src/constants/contracts.js', contractsJs)
console.log('✅ src/constants/contracts.js 已更新！')
console.log(contractsJs)
