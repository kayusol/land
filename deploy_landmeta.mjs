// deploy_landmeta.mjs
import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'
import { readFileSync } from 'fs'

const PK = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const account = privateKeyToAccount(PK)
const wc = createWalletClient({ account, chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })
const pc = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })
const LAND = '0x889DCe5b3934D56f3814f93793F8e1f8710249ea'

const art = JSON.parse(readFileSync('./artifacts/contracts/LandMeta.sol/LandMeta.json', 'utf8'))

async function main() {
  console.log('Deployer:', account.address)
  const hash = await wc.deployContract({ abi: art.abi, bytecode: art.bytecode, args: [LAND] })
  console.log('tx:', hash)
  const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 120000 })
  console.log('LandMeta deployed:', receipt.contractAddress)
}
main().catch(e => { console.error(e.message); process.exit(1) })
