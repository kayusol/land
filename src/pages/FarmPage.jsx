import { useState } from 'react'
import { useAccount } from '../contexts/WalletContext.jsx'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { CONTRACTS } from '../constants/contracts'
import { ERC20_ABI } from '../constants/abi'
import './FarmPage.css'

// PancakeSwap LP 矿池 (testnet 演示地址 — 实际需创建 LP pair)
const POOLS = [
  { id: 0, name: 'RING-BNB LP', apy: '120%', tvl: '加载中', pairAddr: null },
  { id: 1, name: 'RING-GOLD LP', apy: '80%',  tvl: '加载中', pairAddr: null },
  { id: 2, name: 'RING-WOOD LP', apy: '75%',  tvl: '加载中', pairAddr: null },
  { id: 3, name: 'RING-HHO LP',  apy: '70%',  tvl: '加载中', pairAddr: null },
  { id: 4, name: 'RING-FIRE LP', apy: '65%',  tvl: '加载中', pairAddr: null },
  { id: 5, name: 'RING-SIOO LP', apy: '60%',  tvl: '加载中', pairAddr: null },
]

function PoolRow({ pool }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const { address } = useAccount()

  return (
    <div className={`pool-row ${open ? 'expanded' : ''}`}>
      <div className="pool-header" onClick={() => setOpen(!open)}>
        <span className="pool-name">{pool.name}</span>
        <span className="pool-apy">APY {pool.apy}</span>
        <span className="pool-tvl">TVL {pool.tvl}</span>
        <span className="pool-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="pool-body">
          <div className="pool-notice">
            ⚠️ LP矿池需先在 PancakeSwap 添加流动性获得LP Token，再质押此处。
            <br />
            <a
              href={`https://pancake.kiemtienonline360.com/#/add/BNB/${CONTRACTS.ring}`}
              target="_blank" rel="noreferrer"
              className="pancake-link"
            >
              前往 PancakeSwap 添加流动性 ↗
            </a>
          </div>
          <div className="pool-inputs">
            <input
              type="number"
              placeholder="输入LP数量"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="pool-input"
            />
            <button className="pool-btn stake" disabled>质押 (开发中)</button>
            <button className="pool-btn unstake" disabled>解除</button>
            <button className="pool-btn claim" disabled>领取</button>
          </div>
          <div className="pool-info-row">
            <span>RING 合约: </span>
            <a href={`https://testnet.bscscan.com/address/${CONTRACTS.ring}`} target="_blank" rel="noreferrer">
              {CONTRACTS.ring.slice(0,8)}…{CONTRACTS.ring.slice(-6)}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FarmPage() {
  return (
    <div className="farm-page">
      <div className="farm-header">
        <h2>🌾 流动性挖矿</h2>
        <p>质押LP Token获得RING奖励</p>
      </div>
      <div className="pool-list">
        {POOLS.map(p => <PoolRow key={p.id} pool={p} />)}
      </div>
    </div>
  )
}
