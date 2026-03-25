// deploy_upgrade_rental.mjs
// 部署 UpgradeSystem + LandRental 合约
// 用法: node deploy_upgrade_rental.mjs

import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { privateKeyFromAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'
import fs from 'fs'
import path from 'path'

// 读取部署私钥（用环境变量或从 hardhat.config.cjs 读取）
// 注意：在生产环境中永远不要硬编码私钥
const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) {
  console.error('❌ 请设置环境变量 PRIVATE_KEY')
  process.exit(1)
}

// 合约地址（已部署的）
const CONTRACTS = {
  ring:    '0x3fa38920EED345672dF7FF916b5EbE4f095822aE',
  gold:    '0x5E4b633ae293ec4e000B5934D68997E45D8Bc0B9',
  wood:    '0xD91824b6130DdEf7ffd6b07C1AeFD1ebA60A3b37',
  water:   '0x2FFac338404fadd6c551AcED8197E781Ffa6205C',
  fire:    '0xc2d43F4655320227DaeaA0475E3254C83892D487',
  soil:    '0x865607c7d948655a32da9bE40c70A16Ecae35572',
  land:    '0x889DCe5b3934D56f3814f93793F8e1f8710249ea',
  drill:   '0x782827AdA353d4f958964e1E10D5d940e4B38409',
  apostle: '0xbBce394d561E67bA9C0720d3aD56b25bC12Ee4f0',
}

async function main() {
  console.log('=== 部署 UpgradeSystem + LandRental ===\n')
  
  // 读取编译产物
  const upgradeArtifact = JSON.parse(fs.readFileSync('./artifacts/contracts/UpgradeSystem.sol/UpgradeSystem.json', 'utf8'))
  const rentalArtifact  = JSON.parse(fs.readFileSync('./artifacts/contracts/LandRental.sol/LandRental.json',  'utf8'))

  const account = privateKeyFromAccount(`0x${PRIVATE_KEY.replace('0x', '')}`)
  const walletClient = createWalletClient({ account, chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })
  const publicClient = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })

  const elementTokens = [CONTRACTS.gold, CONTRACTS.wood, CONTRACTS.water, CONTRACTS.fire, CONTRACTS.soil]

  // 1. 部署 UpgradeSystem
  console.log('📦 部署 UpgradeSystem...')
  const upgradeHash = await walletClient.deployContract({
    abi: upgradeArtifact.abi,
    bytecode: upgradeArtifact.bytecode,
    args: [elementTokens, CONTRACTS.apostle, CONTRACTS.drill, CONTRACTS.land],
  })
  const upgradeReceipt = await publicClient.waitForTransactionReceipt({ hash: upgradeHash })
  const upgradeAddr = upgradeReceipt.contractAddress
  console.log(`✅ UpgradeSystem 已部署: ${upgradeAddr}`)

  // 2. 部署 LandRental
  console.log('\n📦 部署 LandRental...')
  const rentalHash = await walletClient.deployContract({
    abi: rentalArtifact.abi,
    bytecode: rentalArtifact.bytecode,
    args: [CONTRACTS.land, CONTRACTS.ring],
  })
  const rentalReceipt = await publicClient.waitForTransactionReceipt({ hash: rentalHash })
  const rentalAddr = rentalReceipt.contractAddress
  console.log(`✅ LandRental 已部署: ${rentalAddr}`)

  // 3. 授权 UpgradeSystem 为 Apostle/Drill/Land 的 Operator
  console.log('\n🔑 设置 UpgradeSystem Operator 权限...')
  const SET_OP_ABI = [{ type:'function', name:'setOperator', inputs:[{name:'a',type:'address'},{name:'v',type:'bool'}], outputs:[] }]
  
  for (const [name, addr] of [['Apostle', CONTRACTS.apostle], ['Drill', CONTRACTS.drill], ['Land', CONTRACTS.land]]) {
    const h = await walletClient.writeContract({ address: addr, abi: SET_OP_ABI, functionName: 'setOperator', args: [upgradeAddr, true] })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log(`  ✅ ${name} Operator 已授权`)
  }

  console.log('\n🎉 部署完成！请更新前端文件中的合约地址：')
  console.log(`\nsrc/pages/UpgradePage.jsx:`)
  console.log(`  const UPGRADE_ADDR = '${upgradeAddr}'`)
  console.log(`\nsrc/pages/RentalPage.jsx:`)
  console.log(`  const RENTAL_ADDR = '${rentalAddr}'`)
  console.log(`\n或者在 src/constants/contracts.js 中添加：`)
  console.log(`  upgrade: '${upgradeAddr}',`)
  console.log(`  rental: '${rentalAddr}',`)
}

main().catch(e => { console.error(e); process.exit(1) })
