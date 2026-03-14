import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { CONTRACTS } from '../constants/contracts'
import { AUCTION_ABI, ERC20_ABI } from '../constants/abi'
import { useAuctions } from '../hooks/useAuctions'
import './MarketPage.css'

const RESOURCE_NAMES = ['GOLD', 'WOOD', 'HHO', 'FIRE', 'SIOO']
const ELEMENT_ICONS = ['⛏️', '🪵', '💧', '🔥', '🪨']

function LandCard({ auction }) {
  const { address } = useAccount()
  const [buying, setBuying] = useState(false)
  const [hash, setHash] = useState(null)

  const { writeContractAsync: approve } = useWriteContract()
  const { writeContractAsync: bid } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash })

  const timeLeft = Math.max(0, auction.endsAt - Math.floor(Date.now() / 1000))
  const hours = Math.floor(timeLeft / 3600)
  const mins = Math.floor((timeLeft % 3600) / 60)

  async function handleBuy() {
    if (!address) return alert('请先连接钱包')
    setBuying(true)
    try {
      const price = parseEther(auction.currentPrice)
      // 1. Approve RING
      const approveTx = await approve({
        address: CONTRACTS.ring,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.auction, price],
      })
      // 2. Bid
      const tx = await bid({
        address: CONTRACTS.auction,
        abi: AUCTION_ABI,
        functionName: 'bid',
        args: [BigInt(auction.id), price],
      })
      setHash(tx)
    } catch (e) {
      alert(e.shortMessage || e.message)
    } finally {
      setBuying(false)
    }
  }

  // dominant element (fake from id)
  const elemIdx = auction.id % 5

  return (
    <div className="land-card">
      <div className="land-card-map" data-elem={elemIdx}>
        <div className="land-iso">
          <svg viewBox="0 0 120 80" className="iso-svg">
            <polygon points="60,5 110,30 60,55 10,30" fill={`hsl(${elemIdx * 72},60%,35%)`} opacity="0.9"/>
            <polygon points="10,30 60,55 60,75 10,50" fill={`hsl(${elemIdx * 72},50%,22%)`}/>
            <polygon points="110,30 60,55 60,75 110,50" fill={`hsl(${elemIdx * 72},50%,28%)`}/>
            <text x="60" y="33" textAnchor="middle" fontSize="18" fill="white">{ELEMENT_ICONS[elemIdx]}</text>
            <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#aaa">#{auction.id}</text>
          </svg>
        </div>
      </div>
      <div className="land-card-info">
        <div className="land-card-id">地块 #{auction.id} <span className="elem-badge">{ELEMENT_ICONS[elemIdx]} {RESOURCE_NAMES[elemIdx]}</span></div>
        <div className="land-card-price">
          <span className="price-now">{parseFloat(auction.currentPrice).toFixed(3)} RING</span>
          <span className="price-range">{auction.startPrice}→{auction.endPrice}</span>
        </div>
        <div className="land-card-time">⏱ {hours}h {mins}m 剩余</div>
        <button
          className="buy-btn"
          onClick={handleBuy}
          disabled={buying || isSuccess}
        >
          {isSuccess ? '✅ 已购买' : buying ? '处理中…' : '立即购买'}
        </button>
      </div>
    </div>
  )
}

export default function MarketPage() {
  const { auctions, isLoading } = useAuctions()
  const [filter, setFilter] = useState('all')

  const displayed = filter === 'all'
    ? auctions
    : auctions.filter(a => a.id % 5 === parseInt(filter))

  return (
    <div className="market-page">
      <aside className="market-sidebar">
        <h3>筛选</h3>
        <div className="filter-group">
          <label>元素类型</label>
          {[['all','全部'],['0','⛏️ 金'],['1','🪵 木'],['2','💧 水'],['3','🔥 火'],['4','🪨 土']].map(([v,l]) => (
            <button
              key={v}
              className={`filter-btn ${filter === v ? 'active' : ''}`}
              onClick={() => setFilter(v)}
            >{l}</button>
          ))}
        </div>
        <div className="filter-group">
          <label>合约信息</label>
          <div className="contract-info">
            <span>拍卖合约</span>
            <a href={`https://testnet.bscscan.com/address/${CONTRACTS.auction}`} target="_blank" rel="noreferrer">
              {CONTRACTS.auction.slice(0, 6)}…{CONTRACTS.auction.slice(-4)}
            </a>
          </div>
        </div>
      </aside>

      <main className="market-main">
        <div className="market-header">
          <h2>🏛 土地市场</h2>
          <span className="auction-count">{auctions.length} 个拍卖中</span>
        </div>

        {isLoading && <div className="loading-spinner">⏳ 加载链上数据…</div>}

        {!isLoading && displayed.length === 0 && (
          <div className="empty-state">暂无进行中的拍卖</div>
        )}

        <div className="land-grid">
          {displayed.map(a => (
            <LandCard key={a.id} auction={a} />
          ))}
        </div>
      </main>
    </div>
  )
}
