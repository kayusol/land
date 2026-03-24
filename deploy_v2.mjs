// deploy_v2.mjs — 部署 ApostleV2 并迁移数据
import { ethers } from 'ethers'
import { readFileSync } from 'fs'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'
const RING        = '0x41550a11B94ee1c78898FEaae0617AAC3E155ec6'
const OLD_APOSTLE = '0x3D06422b6623b422c4152cd53231f0F45232197A'
const BLINDBOX    = '0x77AAB7a9CD934D9aEc5fE60b15DbFbCDe5BC6252'
const MINING      = '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2'

const p = new ethers.JsonRpcProvider(RPC)
const w = new ethers.Wallet(PK, p)
console.log('Deployer:', w.address)
console.log('Balance:', ethers.formatEther(await p.getBalance(w.address)), 'BNB')

const artifact = JSON.parse(readFileSync('artifacts/contracts/ApostleV2.sol/ApostleV2.json','utf8'))
const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, w)

console.log('Deploying ApostleV2...')
const contract = await factory.deploy(RING)
await contract.waitForDeployment()
const addr = await contract.getAddress()
console.log('✅ ApostleV2 deployed:', addr)

const c = new ethers.Contract(addr, artifact.abi, w)
const sleep = ms => new Promise(r=>setTimeout(r,ms))

// 授权
console.log('Setting operators...')
await (await c.setOperator(BLINDBOX, true)).wait(); await sleep(1200)
await (await c.setOperator(MINING, true)).wait();   await sleep(1200)
await (await c.setOperator(w.address, true)).wait(); await sleep(1200)
console.log('Operators set')

// 读旧合约，迁移使徒
const oldApo = new ethers.Contract(OLD_APOSTLE, [
  'function nextId() view returns(uint256)',
  'function ownerOf(uint256) view returns(address)',
  'function attrs(uint256) view returns(uint8 strength, uint8 element)'
], p)
const total = Number(await oldApo.nextId()) - 1
console.log('Migrating', total, 'apostles...')

let ok=0, fail=0
for(let id=1; id<=total; id++){
  try{
    const [own, at] = await Promise.all([oldApo.ownerOf(id), oldApo.attrs(id)])
    await (await c.mint(own, at.strength, at.element)).wait()
    ok++; await sleep(800)
    if(ok%10===0) console.log(`  ${ok}/${total}...`)
  }catch(e){ fail++; console.log(`  skip #${id}: ${e.reason||e.message}`) }
}
console.log(`\nMigrated: ${ok} ok, ${fail} skipped`)
console.log('\n========================================')
console.log('ApostleV2 address:', addr)
console.log('Update contracts.js:')
console.log(`  apostle: '${addr}',`)
console.log('========================================')
