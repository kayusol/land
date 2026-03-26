// deploy_mining_v3.mjs — 部署新版 MiningSystemV3
import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync, writeFileSync } from 'fs'

const PK = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const bscTestnet = { id:97, name:'BSC Testnet', nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18}, rpcUrls:{default:{http:['https://bsc-testnet-rpc.publicnode.com']}} }
const account = privateKeyToAccount(PK)
const wc = createWalletClient({ account, chain:bscTestnet, transport:http('https://bsc-testnet-rpc.publicnode.com') })
const pc = createPublicClient({ chain:bscTestnet, transport:http('https://bsc-testnet-rpc.publicnode.com') })

const CONTRACTS = {
  gold:'0x5E4b633ae293ec4e000B5934D68997E45D8Bc0B9',
  wood:'0xD91824b6130DdEf7ffd6b07C1AeFD1ebA60A3b37',
  water:'0x2FFac338404fadd6c551AcED8197E781Ffa6205C',
  fire:'0xc2d43F4655320227DaeaA0475E3254C83892D487',
  soil:'0x865607c7d948655a32da9bE40c70A16Ecae35572',
  land:'0x889DCe5b3934D56f3814f93793F8e1f8710249ea',
  drill:'0x782827AdA353d4f958964e1E10D5d940e4B38409',
  apostle:'0xbBce394d561E67bA9C0720d3aD56b25bC12Ee4f0',
}

const SET_MINTER_ABI=[{type:'function',name:'setMinter',inputs:[{name:'a',type:'address'},{name:'v',type:'bool'}],outputs:[]}]

async function main() {
  console.log('Deployer:', account.address)
  const bal = await pc.getBalance({address:account.address})
  console.log('BNB:', Number(bal)/1e18)

  // 读取新编译的 MiningSystemV3 artifact
  const art = JSON.parse(readFileSync('./artifacts/contracts/MiningV2.sol/MiningSystemV3.json','utf8'))
  const elements = [CONTRACTS.gold, CONTRACTS.wood, CONTRACTS.water, CONTRACTS.fire, CONTRACTS.soil]

  console.log('\n[1/3] 部署 MiningSystemV3...')
  const h = await wc.deployContract({
    abi: art.abi,
    bytecode: art.bytecode,
    args: [CONTRACTS.land, CONTRACTS.drill, CONTRACTS.apostle, elements]
  })
  console.log('  tx:', h)
  const r = await pc.waitForTransactionReceipt({hash:h, timeout:120000})
  const miningAddr = r.contractAddress
  console.log('  ✅ MiningSystemV3:', miningAddr)

  // setMinter：5种资源 token 授权新 Mining 合约可以 mint
  console.log('\n[2/3] 设置 minter 权限...')
  const tokenNames = ['GOLD','WOOD','HHO','FIRE','SIOO']
  const tokenAddrs = elements
  for (let i=0;i<5;i++) {
    const h2 = await wc.writeContract({address:tokenAddrs[i], abi:SET_MINTER_ABI, functionName:'setMinter', args:[miningAddr, true]})
    await pc.waitForTransactionReceipt({hash:h2})
    console.log(`  ✅ ${tokenNames[i]} setMinter OK`)
  }

  // 充值初始奖励池
  console.log('\n[3/3] 充值初始奖励池 (每种资源 60000)...')
  const MINT_ABI=[{type:'function',name:'mint',inputs:[{name:'to',type:'address'},{name:'amount',type:'uint256'}],outputs:[]}]
  const AMOUNT = BigInt(60000) * BigInt(1e18)
  for (let i=0;i<5;i++) {
    const h3 = await wc.writeContract({address:tokenAddrs[i], abi:MINT_ABI, functionName:'mint', args:[miningAddr, AMOUNT]})
    await pc.waitForTransactionReceipt({hash:h3})
    console.log(`  ✅ ${tokenNames[i]} 充值 60000`)
  }

  console.log('\n=== 部署完成 ===')
  console.log('新 Mining 地址:', miningAddr)
  console.log('\n请更新 src/constants/contracts.js:')
  console.log(`  mining: '${miningAddr}',`)
  writeFileSync('./deployed_mining_v3.json', JSON.stringify({mining:miningAddr},null,2))
}

main().catch(e=>{console.error(e.message||e);process.exit(1)})
