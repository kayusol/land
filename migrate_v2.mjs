// migrate_v2.mjs — 稳健版：顺序执行，手动管理nonce
import { ethers } from 'ethers'

const PK   = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC  = 'https://data-seed-prebsc-2-s1.binance.org:8545'
const OLD  = '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2'
const NEW  = '0x48eCa05c37E9F7c4F9CA05124c05cC6a145C9aaC'
const APO  = '0x767E1082A32a52949FB6613B5fF403f10D2426f3'
const DRL  = '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe'

const p = new ethers.JsonRpcProvider(RPC)
const w = new ethers.Wallet(PK, p)

const OLD_ABI = ['function slotCount(uint256) view returns(uint256)','function slots(uint256,uint256) view returns(uint256,uint256,uint256)','function stopMining(uint256,uint256) external']
const NEW_ABI = ['function startMining(uint256,uint256,uint256) external','function slotCount(uint256) view returns(uint256)','function pendingRewards(uint256) view returns(uint256[5])']
const NFT_ABI = ['function ownerOf(uint256) view returns(address)']

const oldMine = new ethers.Contract(OLD, OLD_ABI, w)
const newMine = new ethers.Contract(NEW, NEW_ABI, w)
const apo = new ethers.Contract(APO, NFT_ABI, p)

const sleep = ms => new Promise(r=>setTimeout(r,ms))

// 已知有槽位的地块（从check_state.mjs输出）
const LANDS = [1,4,5,101,102,103,104,105,201,202,203,204,403,405,504,602,605,704,803]

async function safeTx(contract, fn, args, label) {
  for(let retry=0; retry<5; retry++){
    try{
      const nonce = await p.getTransactionCount(w.address, 'pending')
      const tx = await contract[fn](...args, {nonce, gasLimit: 300000})
      process.stdout.write(`  [${label}] ${tx.hash.slice(0,12)}...`)
      await tx.wait()
      process.stdout.write(' ✅\n')
      await sleep(1500)
      return true
    }catch(e){
      const msg=(e.message||'').toLowerCase()
      if(msg.includes('nonce')||msg.includes('already')){
        await sleep(2000); continue
      }
      if(msg.includes('rate')||msg.includes('429')){
        await sleep(5000*(retry+1)); continue
      }
      console.log(`  ⚠ ${label}: ${e.reason||e.message.slice(0,60)}`)
      return false
    }
  }
  return false
}

console.log('=== MiningSystem 迁移 旧→新 ===')
let ok=0, fail=0

for(const landId of LANDS){
  let cnt
  try{ cnt=Number(await oldMine.slotCount(landId)) }
  catch(e){ continue }
  if(cnt===0) continue

  console.log(`\n地块#${landId}: ${cnt}个槽位`)
  // 逆序读取（stop后数组会compact）
  const toMigrate = []
  for(let i=0;i<cnt;i++){
    const s = await oldMine.slots(landId, i)
    toMigrate.push({apoId:s[0], drlId:s[1]})
  }

  for(const {apoId, drlId} of toMigrate){
    // 检查使徒是否还在旧合约
    let apoOwner
    try{ apoOwner = await apo.ownerOf(apoId) }catch(e){fail++;continue}
    if(apoOwner.toLowerCase() !== OLD.toLowerCase()){
      console.log(`  使徒#${apoId} 不在旧合约(${apoOwner.slice(0,8)}), 跳过`)
      fail++; continue
    }

    // 1. stop from old
    const stopped = await safeTx(oldMine, 'stopMining', [landId, apoId], `stop#${apoId}`)
    if(!stopped){fail++;continue}

    // 2. start in new
    const started = await safeTx(newMine, 'startMining', [landId, apoId, drlId], `start#${apoId}`)
    if(started) ok++; else fail++
  }
}

console.log(`\n=== 完成 ===`)
console.log(`成功迁移: ${ok}`)
console.log(`失败: ${fail}`)

// 验证产出
console.log('\n=== 验证新合约产出 ===')
await sleep(5000)
for(const id of LANDS){
  const cnt = Number(await newMine.slotCount(id).catch(()=>0n))
  if(cnt===0) continue
  const r = await newMine.pendingRewards(id)
  console.log(`地块#${id}(${cnt}槽): ${r.map(x=>ethers.formatEther(x).slice(0,8)).join(' ')}`)
}
