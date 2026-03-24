// api/lands.js — 土地数据后端索引
// 返回所有已铸造土地的坐标和资源属性，带内存缓存
import { createPublicClient, http } from 'viem'

const bscTestnet = {
  id: 97, name: 'BSC Testnet',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://bsc-testnet-rpc.publicnode.com'] } },
}
const pc = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })

const LAND    = '0x889DCe5b3934D56f3814f93793F8e1f8710249ea'
const MINING  = '0x5A9963394e9EeA042b9eCBB0389B0cC587cbcBB4'
const DEPLOY_BLOCK = 97519000n
const CHUNK   = 45000n

const LAND_ABI = [
  { type:'function', name:'totalSupply',   inputs:[], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'tokenByIndex',  inputs:[{name:'i',type:'uint256'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'resourceAttr',  inputs:[{name:'tokenId',type:'uint256'}], outputs:[{type:'uint80'}], stateMutability:'view' },
  { type:'function', name:'getTokenId',    inputs:[{name:'x',type:'int16'},{name:'y',type:'int16'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'event',    name:'Transfer',      inputs:[{indexed:true,name:'from',type:'address'},{indexed:true,name:'to',type:'address'},{indexed:true,name:'tokenId',type:'uint256'}] },
]
const MINING_ABI = [
  { type:'function', name:'slotCount', inputs:[{name:'landId',type:'uint256'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'getSlot',   inputs:[{name:'landId',type:'uint256'},{name:'slot',type:'uint256'}], outputs:[{name:'apostleId',type:'uint256'},{name:'drillId',type:'uint256'},{name:'startTime',type:'uint256'}], stateMutability:'view' },
]

let cache = null, cacheTime = 0
const TTL = 10 * 60 * 1000  // 10分钟

async function getLogs(address, event, from, to) {
  const logs = []
  for (let f = from; f <= to; f += CHUNK) {
    const t = f + CHUNK - 1n > to ? to : f + CHUNK - 1n
    try { logs.push(...await pc.getLogs({ address, event, fromBlock: f, toBlock: t })) } catch {}
  }
  return logs
}

async function fetchLands() {
  const now = Date.now()
  if (cache && now - cacheTime < TTL) return cache

  const latest = await pc.getBlockNumber()

  // 获取所有铸造的 land token ID（通过 Transfer from 零地址）
  const mintLogs = await getLogs(LAND, LAND_ABI[4], DEPLOY_BLOCK, latest)
  const mintedIds = [...new Set(
    mintLogs
      .filter(e => e.args.from === '0x0000000000000000000000000000000000000000')
      .map(e => Number(e.args.tokenId))
  )].sort((a,b)=>a-b)

  if (!mintedIds.length) { cache = { lands: [], scannedAt: now }; cacheTime = now; return cache }

  // 批量读取资源属性和挖矿槽数
  const BATCH = 100
  const lands = []
  for (let i = 0; i < mintedIds.length; i += BATCH) {
    const batch = mintedIds.slice(i, i + BATCH)
    const [raRes, slRes] = await Promise.all([
      pc.multicall({ contracts: batch.map(id=>({ address:LAND, abi:LAND_ABI, functionName:'resourceAttr', args:[BigInt(id)] })), allowFailure:true }),
      pc.multicall({ contracts: batch.map(id=>({ address:MINING, abi:MINING_ABI, functionName:'slotCount', args:[BigInt(id)] })), allowFailure:true }),
    ])
    batch.forEach((id, j) => {
      const ra  = raRes[j]?.result ?? 0n
      const sl  = Number(slRes[j]?.result ?? 0n)
      // 解码资源属性（每16位一种资源：gold,wood,water,fire,soil）
      const b = BigInt(ra)
      const resources = [
        Number(b & 0xffffn),
        Number((b >> 16n) & 0xffffn),
        Number((b >> 32n) & 0xffffn),
        Number((b >> 48n) & 0xffffn),
        Number((b >> 64n) & 0xffffn),
      ]
      // 坐标：tokenId = x*100+y+1（按铸造脚本逆推）
      const col = (id - 1) % 100
      const row = Math.floor((id - 1) / 100)
      lands.push({ id, col, row, resources, miningSlots: sl })
    })
  }

  cache = { lands, total: lands.length, scannedAt: now }
  cacheTime = now
  return cache
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=60')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  try {
    const data = await fetchLands()
    res.status(200).json({ ok: true, ...data })
  } catch(e) {
    console.error('lands error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
}
