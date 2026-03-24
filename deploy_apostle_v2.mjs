// deploy_apostle_v2.mjs
import { ethers } from 'ethers'
import { readFileSync } from 'fs'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-2-s1.binance.org:8545'
const RING = '0x41550a11B94ee1c78898FEaae0617AAC3E155ec6'
const OLD_APOSTLE = '0x3D06422b6623b422c4152cd53231f0F45232197A'
const BLINDBOX   = '0x77AAB7a9CD934D9aEc5fE60b15DbFbCDe5BC6252'
const MINING     = '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2'

const p = new ethers.JsonRpcProvider(RPC)
const w = new ethers.Wallet(PK, p)
console.log('Deployer:', w.address)

// 编译
const { execSync } = await import('child_process')
console.log('Compiling...')
try {
  execSync('npx hardhat compile --no-typechain 2>&1', {cwd: process.cwd(), stdio:'pipe'})
} catch(e) {
  // try solc directly
}

// 读取 ABI + bytecode（需要先编译）
// 如果没有 hardhat 就用 solc
let abi, bytecode
try {
  const artifact = JSON.parse(readFileSync('artifacts/contracts/ApostleV2.sol/ApostleV2.json','utf8'))
  abi = artifact.abi
  bytecode = artifact.bytecode
  console.log('Artifact loaded')
} catch(e) {
  console.log('No artifact, compiling with solc...')
  const result = execSync(`solc --abi --bin --optimize contracts/ApostleV2.sol 2>&1`, {encoding:'utf8'})
  const abiMatch = result.match(/ApostleV2\nABI\n([\s\S]+?)\n\n/)
  const binMatch  = result.match(/ApostleV2\nBinary:\n([0-9a-f]+)/)
  if (!abiMatch || !binMatch) { console.log('COMPILE FAIL:', result.slice(0,500)); process.exit(1) }
  abi = JSON.parse(abiMatch[1])
  bytecode = '0x' + binMatch[1]
}

console.log('Deploying ApostleV2...')
const factory = new ethers.ContractFactory(abi, bytecode, w)
const contract = await factory.deploy(RING)
await contract.waitForDeployment()
const addr = await contract.getAddress()
console.log('ApostleV2 deployed:', addr)

// 设置 operator：让 blindbox 和 mining 可以操作
const c = new ethers.Contract(addr, ['function setOperator(address,bool) external','function mint(address,uint8,uint8) external returns(uint256)'], w)
await (await c.setOperator(BLINDBOX, true)).wait()
console.log('BlindBox operator set')
await (await c.setOperator(MINING, true)).wait()
console.log('Mining operator set')
await (await c.setOperator(w.address, true)).wait()
console.log('Deployer operator set')

// 迁移旧使徒数据：读取旧合约，为每个已有使徒重新铸造
console.log('Migrating old apostles...')
const oldApo = new ethers.Contract(OLD_APOSTLE, [
  'function nextId() view returns(uint256)',
  'function ownerOf(uint256) view returns(address)',
  'function attrs(uint256) view returns(uint8,uint8)'
], p)
const total = Number(await oldApo.nextId()) - 1
console.log('Old apostles:', total)
let migrated = 0
for(let id=1; id<=Math.min(total,200); id++) {
  try {
    const owner = await oldApo.ownerOf(id)
    const [str, elem] = await oldApo.attrs(id)
    await (await c.mint(owner, str, elem)).wait()
    migrated++
    if(migrated % 10 === 0) console.log(`Migrated ${migrated}...`)
  } catch(e) {}
}
console.log(`\nDone! ApostleV2: ${addr}`)
console.log('Update CONTRACTS.apostle in src/constants/contracts.js')
