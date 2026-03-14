import { useState } from 'react'
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther } from 'viem'
import { CONTRACTS, RESOURCE_TOKENS } from '../constants/contracts'
import { ERC20_ABI, LAND_ABI, DRILL_ABI, APOSTLE_ABI, MINING_ABI } from '../constants/abi'
import { useMyLands, useMyDrills, useMyApostles } from '../hooks/useMyNFTs'
import { useTokenBalances } from '../hooks/useTokenBalances'
import './AssetsPage.css'

const TABS = [
  { key: 'token',   label: '💰 代币' },
  { key: 'land',    label: '🗺 地块' },
  { key: 'apostle', label: '👤 使徒' },
  { key: 'drill',   label: '⚙️ 钻头' },
  { key: 'claim',   label: '📥 领取' },
]

function TokenTab() {
  const { balances, isLoading } = useTokenBalances()
  const allSymbols = ['RING', 'GOLD', 'WOOD', 'HHO', 'FIRE', 'SIOO']
  const tokenAddrs = {
    RING: CONTRACTS.ring,
    GOLD: CONTRACTS.gold,
    WOOD: CONTRACTS.wood,
    HHO:  CONTRACTS.water,
    FIRE: CONTRACTS.fire,
    SIOO: CONTRACTS.soil,
  }

  return (
    <div className="token-list">
      {isLoading && <p className="loading">⏳ 加载余额…</p>}
      {allSymbols.map(sym => (
        <div key={sym} className="token-row">
          <div className="token-icon">{sym === 'RING' ? '💍' : RESOURCE_TOKENS.find(t=>t.symbol===sym)?.icon ?? '🪙'}</div>
          <div className="token-info">
            <span className="token-name">{sym}</span>
            <a
              className="token-addr"
              href={`https://testnet.bscscan.com/address/${tokenAddrs[sym]}`}
              target="_blank" rel="noreferrer"
            >
              {tokenAddrs[sym]?.slice(0,6)}…{tokenAddrs[sym]?.slice(-4)}
            </a>
          </div>
          <div className="token-balance">{balances[sym]?.formatted ?? '—'}</div>
        </div>
      ))}
    </div>
  )
}

function LandTab() {
  const myIds = useMyLands()
  const { data: attrData } = useReadContracts({
    contracts: myIds.map(id => ({
      address: CONTRACTS.land,
      abi: LAND_ABI,
      functionName: 'resourceAttr',
      args: [BigInt(id)],
    })),
  })

  if (myIds.length === 0) return <div className="empty-state">你还没有地块。去市场竞拍吧！</div>

  return (
    <div className="nft-grid">
      {myIds.map((id, i) => {
        const attr = attrData?.[i]?.result ?? 0n
        const g = Number((attr >> 0n) & 0xFFFFn)
        const w = Number((attr >> 16n) & 0xFFFFn)
        const wa = Number((attr >> 32n) & 0xFFFFn)
        const f = Number((attr >> 48n) & 0xFFFFn)
        const s = Number((attr >> 64n) & 0xFFFFn)
        const dom = [g,w,wa,f,s].indexOf(Math.max(g,w,wa,f,s))
        const colors = ['#f59e0b','#22c55e','#3b82f6','#ef4444','#a78bfa']
        return (
          <div key={id} className="nft-card" style={{borderTop: `3px solid ${colors[dom]}`}}>
            <div className="nft-id">地块 #{id}</div>
            <div className="land-attrs">
              <span>⛏️ {g}</span>
              <span>🪵 {w}</span>
              <span>💧 {wa}</span>
              <span>🔥 {f}</span>
              <span>🪨 {s}</span>
            </div>
            <a
              href={`https://testnet.bscscan.com/token/${CONTRACTS.land}?a=${id}`}
              target="_blank" rel="noreferrer"
              className="view-link"
            >BSCScan ↗</a>
          </div>
        )
      })}
    </div>
  )
}

function ApostleTab() {
  const myIds = useMyApostles()
  const { data: attrData } = useReadContracts({
    contracts: myIds.map(id => ({
      address: CONTRACTS.apostle,
      abi: APOSTLE_ABI,
      functionName: 'attrs',
      args: [BigInt(id)],
    })),
  })
  const ELEM = ['⛏️金','🪵木','💧水','🔥火','🪨土']
  if (myIds.length === 0) return <div className="empty-state">你还没有使徒。去盲盒开箱！</div>
  return (
    <div className="nft-grid">
      {myIds.map((id, i) => {
        const [str, elem] = attrData?.[i]?.result ?? [0,0]
        return (
          <div key={id} className="nft-card">
            <div className="nft-id">使徒 #{id}</div>
            <div className="nft-attrs">
              <div>💪 力量: {str}</div>
              <div>🔮 元素: {ELEM[elem] ?? '?'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DrillTab() {
  const myIds = useMyDrills()
  const { data: attrData } = useReadContracts({
    contracts: myIds.map(id => ({
      address: CONTRACTS.drill,
      abi: DRILL_ABI,
      functionName: 'attrs',
      args: [BigInt(id)],
    })),
  })
  const ELEM = ['⛏️金','🪵木','💧水','🔥火','🪨土']
  if (myIds.length === 0) return <div className="empty-state">你还没有钻头。去盲盒开箱！</div>
  return (
    <div className="nft-grid">
      {myIds.map((id, i) => {
        const [tier, aff] = attrData?.[i]?.result ?? [0,0]
        return (
          <div key={id} className="nft-card">
            <div className="nft-id">钻头 #{id}</div>
            <div className="nft-attrs">
              <div>⭐ 等级: {'★'.repeat(tier)}{'☆'.repeat(5-tier)}</div>
              <div>🔮 亲和: {ELEM[aff] ?? '?'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ClaimTab() {
  const myLands = useMyLands()
  const [claiming, setClaiming] = useState({})
  const [hashes, setHashes] = useState({})
  const { writeContractAsync } = useWriteContract()

  const { data: pendingData } = useReadContracts({
    contracts: myLands.map(id => ({
      address: CONTRACTS.mining,
      abi: MINING_ABI,
      functionName: 'pendingRewards',
      args: [BigInt(id)],
    })),
    query: { refetchInterval: 15_000 },
  })

  const NAMES = ['GOLD','WOOD','HHO','FIRE','SIOO']

  async function claim(landId) {
    setClaiming(p => ({ ...p, [landId]: true }))
    try {
      const tx = await writeContractAsync({
        address: CONTRACTS.mining,
        abi: MINING_ABI,
        functionName: 'claim',
        args: [BigInt(landId)],
      })
      setHashes(p => ({ ...p, [landId]: tx }))
    } catch (e) {
      alert(e.shortMessage || e.message)
    } finally {
      setClaiming(p => ({ ...p, [landId]: false }))
    }
  }

  if (myLands.length === 0) return <div className="empty-state">你还没有地块，无法领取挖矿收益</div>

  return (
    <div className="claim-list">
      {myLands.map((id, i) => {
        const rewards = pendingData?.[i]?.result ?? [0n,0n,0n,0n,0n]
        const hasReward = rewards.some(r => r > 0n)
        return (
          <div key={id} className="claim-row">
            <div className="claim-land">地块 #{id}</div>
            <div className="claim-rewards">
              {NAMES.map((n, j) => (
                <span key={n} className={rewards[j] > 0n ? 'reward-has' : 'reward-zero'}>
                  {n}: {parseFloat(formatEther(rewards[j])).toFixed(4)}
                </span>
              ))}
            </div>
            <button
              className="claim-btn"
              disabled={!hasReward || claiming[id]}
              onClick={() => claim(id)}
            >
              {claiming[id] ? '领取中…' : hashes[id] ? '✅ 已领取' : '领取收益'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function AssetsPage() {
  const { isConnected } = useAccount()
  const [tab, setTab] = useState('token')

  if (!isConnected) {
    return (
      <div className="assets-page">
        <div className="connect-prompt">请先连接钱包查看资产</div>
      </div>
    )
  }

  return (
    <div className="assets-page">
      <div className="assets-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>
      <div className="assets-content">
        {tab === 'token'   && <TokenTab />}
        {tab === 'land'    && <LandTab />}
        {tab === 'apostle' && <ApostleTab />}
        {tab === 'drill'   && <DrillTab />}
        {tab === 'claim'   && <ClaimTab />}
      </div>
    </div>
  )
}
