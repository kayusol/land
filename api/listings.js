// api/listings.js — 直接 multicall getAuction 扫描活跃挂单
// 不依赖事件日志（合约未正确emit事件），直接读链上状态
import { createPublicClient, http } from 'viem'
import { bscTestnet } from 'viem/chains'

const pc = createPublicClient({ chain: bscTestnet, transport: http('https://bsc-testnet-rpc.publicnode.com') })

const NFT_AUC = '0xe489Fd17B4aBF3b22482Bf0f09193f9902f1fd22'
const OLD_AUC = '0xfACc3eaD5EA9Ec5F2fe56568918b21Fb3b899284'
const APOSTLE = '0xbBce394d561E67bA9C0720d3aD56b25bC12Ee4f0'
const DRILL   = '0x782827AdA353d4f958964e1E10D5d940e4B38409'
const LAND    = '0x889DCe5b3934D56f3814f93793F8e1f8710249ea'

const NFT_AUC_ABI = [{
  type: 'function', name: 'getAuction',
  inputs: [{ name: 'nft', type: 'address' }, { name: 'id', type: 'uint256' }],
  outputs: [{ components: [
    { name: 'nftContract', type: 'address' },
    { name: 'seller',      type: 'address' },
    { name: 'startPrice',  type: 'uint128' },
    { name: 'endPrice',    type: 'uint128' },
    { name: 'duration',    type: 'uint64'  },
    { name: 'startedAt',   type: 'uint64'  },
  ], type: 'tuple' }],
  stateMutability: 'view'
}]

const OLD_AUC_ABI = [{
  type: 'function', name: 'auctions',
  inputs: [{ name: 'id', type: 'uint256' }],
  outputs: [
    { name: 'seller',     type: 'address' },
    { name: 'startPrice', type: 'uint128' },
    { name: 'endPrice',   type: 'uint128' },
    { name: 'duration',   type: 'uint64'  },
    { name: 'startedAt',  type: 'uint64'  },
  ],
  stateMutability: 'view'
}]

const NEXT_ABI = [{ type: 'function', name: 'nextId', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }]

// 已知土地范围（x=0-99, y=0-99 但只铸造了部分）
const LAND_IDS = []
for (let x = 0; x < 100; x++) for (let y = 0; y < 100; y++) LAND_IDS.push(x * 100 + y + 1)

let cache = null, cacheTime = 0
const TTL = 3 * 60 * 1000  // 3分钟

async function fetchListings() {
  const now = Date.now()
  if (cache && now - cacheTime < TTL) return cache

  // 获取使徒和钻头的总数
  const [apoNext, drlNext] = await Promise.all([
    pc.readContract({ address: APOSTLE, abi: NEXT_ABI, functionName: 'nextId' }).catch(() => 1n),
    pc.readContract({ address: DRILL,   abi: NEXT_ABI, functionName: 'nextId' }).catch(() => 1n),
  ])
  const apoIds = Array.from({ length: Number(apoNext) - 1 }, (_, i) => i + 1)
  const drlIds = Array.from({ length: Number(drlNext) - 1 }, (_, i) => i + 1)

  console.log(`Scanning: ${apoIds.length} apostles, ${drlIds.length} drills, ${LAND_IDS.length} land slots`)

  const BATCH = 200
  const apostleIds = [], drillIds = [], landIds = [], oldLandIds = []

  // 扫使徒
  for (let s = 0; s < apoIds.length; s += BATCH) {
    const batch = apoIds.slice(s, s + BATCH)
    const res = await pc.multicall({
      contracts: batch.map(id => ({ address: NFT_AUC, abi: NFT_AUC_ABI, functionName: 'getAuction', args: [APOSTLE, BigInt(id)] })),
      allowFailure: true
    })
    batch.forEach((id, i) => {
      const a = res[i]?.result
      if (a && a.startedAt > 0n) apostleIds.push(id)
    })
  }

  // 扫钻头
  for (let s = 0; s < drlIds.length; s += BATCH) {
    const batch = drlIds.slice(s, s + BATCH)
    const res = await pc.multicall({
      contracts: batch.map(id => ({ address: NFT_AUC, abi: NFT_AUC_ABI, functionName: 'getAuction', args: [DRILL, BigInt(id)] })),
      allowFailure: true
    })
    batch.forEach((id, i) => {
      const a = res[i]?.result
      if (a && a.startedAt > 0n) drillIds.push(id)
    })
  }

  // 扫土地（新合约）
  for (let s = 0; s < LAND_IDS.length; s += BATCH) {
    const batch = LAND_IDS.slice(s, s + BATCH)
    const res = await pc.multicall({
      contracts: batch.map(id => ({ address: NFT_AUC, abi: NFT_AUC_ABI, functionName: 'getAuction', args: [LAND, BigInt(id)] })),
      allowFailure: true
    })
    batch.forEach((id, i) => {
      const a = res[i]?.result
      if (a && a.startedAt > 0n) landIds.push(id)
    })
  }

  // 扫土地（旧合约）
  for (let s = 0; s < LAND_IDS.length; s += BATCH) {
    const batch = LAND_IDS.slice(s, s + BATCH)
    const res = await pc.multicall({
      contracts: batch.map(id => ({ address: OLD_AUC, abi: OLD_AUC_ABI, functionName: 'auctions', args: [BigInt(id)] })),
      allowFailure: true
    })
    batch.forEach((id, i) => {
      const a = res[i]?.result
      // 旧合约 auctions 返回 [seller, startPrice, endPrice, duration, startedAt]
      const startedAt = Array.isArray(a) ? a[4] : a?.startedAt
      if (startedAt > 0n) oldLandIds.push(id)
    })
  }

  const result = { apostleIds, drillIds, landIds, oldLandIds, scannedAt: now }
  console.log(`Active: apostles=${apostleIds.length} drills=${drillIds.length} lands=${landIds.length + oldLandIds.length}`)

  cache = result
  cacheTime = now
  return result
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const data = await fetchListings()
    res.status(200).json({ ok: true, ...data })
  } catch(e) {
    console.error('listings error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
}
