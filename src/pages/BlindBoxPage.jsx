import { useState } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { formatEther } from 'viem'
import { CONTRACTS } from '../constants/contracts'
import { BLINDBOX_ABI, ERC20_ABI } from '../constants/abi'
import './BlindBoxPage.css'

const ELEM_NAMES = ['⛏️金', '🪵木', '💧水', '🔥火', '🪨土']

function BoxCard({ type, price, onBuy, buying, lastResult }) {
  const isApostle = type === 'apostle'
  return (
    <div className={`box-card ${type}`}>
      <div className="box-glow" />
      <div className="box-icon">{isApostle ? '👤' : '⚙️'}</div>
      <div className="box-name">{isApostle ? '使徒盲盒' : '钻头盲盒'}</div>
      <div className="box-desc">
        {isApostle
          ? '随机获得一名使徒 NFT\n力量 1–100，元素随机'
          : '随机获得一个钻头 NFT\n等级 1–5，亲和随机'}
      </div>
      <div className="box-price">
        <span className="price-label">价格</span>
        <span className="price-val">{price ? parseFloat(formatEther(price)).toFixed(2) : '…'} RING</span>
      </div>

      {lastResult && (
        <div className="box-result">
          ✅ 获得 #{lastResult.tokenId} —
          {isApostle
            ? ` 力量 ${lastResult.attr1}，${ELEM_NAMES[lastResult.attr2] ?? '?'}`
            : ` ${'★'.repeat(lastResult.attr1)}${'☆'.repeat(5 - lastResult.attr1)}，${ELEM_NAMES[lastResult.attr2] ?? '?'}`}
        </div>
      )}

      <div className="box-btns">
        <button
          className="buy-btn single"
          onClick={() => onBuy(type, 1)}
          disabled={buying === type + '1'}
        >
          {buying === type + '1' ? '开启中…' : '购买 × 1'}
        </button>
        <button
          className="buy-btn batch"
          onClick={() => onBuy(type, 5)}
          disabled={buying === type + '5'}
        >
          {buying === type + '5' ? '开启中…' : '购买 × 5'}
        </button>
      </div>
    </div>
  )
}

export default function BlindBoxPage() {
  const { address, isConnected } = useAccount()
  const [buying, setBuying] = useState(null)
  const [results, setResults] = useState({})
  const [txHash, setTxHash] = useState(null)

  const { writeContractAsync } = useWriteContract()
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const { data: apostlePrice } = useReadContract({
    address: CONTRACTS.blindbox,
    abi: BLINDBOX_ABI,
    functionName: 'apostleBoxPrice',
  })
  const { data: drillPrice } = useReadContract({
    address: CONTRACTS.blindbox,
    abi: BLINDBOX_ABI,
    functionName: 'drillBoxPrice',
  })

  async function handleBuy(type, count) {
    if (!address) return alert('请先连接钱包')
    const key = type + count
    setBuying(key)
    try {
      const price = type === 'apostle' ? apostlePrice : drillPrice
      const totalCost = price * BigInt(count)

      // 1. Approve RING
      await writeContractAsync({
        address: CONTRACTS.ring,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.blindbox, totalCost],
      })

      // 2. Buy box
      let tx
      if (count === 1) {
        tx = await writeContractAsync({
          address: CONTRACTS.blindbox,
          abi: BLINDBOX_ABI,
          functionName: type === 'apostle' ? 'buyApostleBox' : 'buyDrillBox',
          args: [],
        })
      } else {
        tx = await writeContractAsync({
          address: CONTRACTS.blindbox,
          abi: BLINDBOX_ABI,
          functionName: type === 'apostle' ? 'buyApostleBoxBatch' : 'buyDrillBoxBatch',
          args: [BigInt(count)],
        })
      }
      setTxHash(tx)
      setResults(p => ({ ...p, [type]: { tokenId: '?', attr1: '?', attr2: 0 } }))
    } catch (e) {
      alert(e.shortMessage || e.message)
    } finally {
      setBuying(null)
    }
  }

  return (
    <div className="blindbox-page">
      <div className="bb-header">
        <h2>🎁 神秘盲盒</h2>
        <p>使用 RING 开启盲盒，随机获得使徒或钻头 NFT</p>
      </div>

      {!isConnected && (
        <div className="connect-prompt">请先连接钱包</div>
      )}

      {isConnected && (
        <div className="bb-grid">
          <BoxCard
            type="apostle"
            price={apostlePrice}
            onBuy={handleBuy}
            buying={buying}
            lastResult={results.apostle}
          />
          <BoxCard
            type="drill"
            price={drillPrice}
            onBuy={handleBuy}
            buying={buying}
            lastResult={results.drill}
          />
        </div>
      )}

      <div className="bb-info">
        <div className="bb-info-card">
          <h3>📋 合约信息</h3>
          <div className="info-row">
            <span>BlindBox 合约</span>
            <a href={`https://testnet.bscscan.com/address/${CONTRACTS.blindbox}`} target="_blank" rel="noreferrer">
              {CONTRACTS.blindbox.slice(0, 8)}…{CONTRACTS.blindbox.slice(-6)}
            </a>
          </div>
          <div className="info-row">
            <span>RING 合约</span>
            <a href={`https://testnet.bscscan.com/address/${CONTRACTS.ring}`} target="_blank" rel="noreferrer">
              {CONTRACTS.ring.slice(0, 8)}…{CONTRACTS.ring.slice(-6)}
            </a>
          </div>
        </div>

        <div className="bb-info-card">
          <h3>🎲 概率说明</h3>
          <div className="prob-grid">
            <div className="prob-item">
              <span className="prob-label">使徒力量</span>
              <span className="prob-val">1 ~ 100 均匀随机</span>
            </div>
            <div className="prob-item">
              <span className="prob-label">钻头等级</span>
              <span className="prob-val">⭐×1~5 均匀随机</span>
            </div>
            <div className="prob-item">
              <span className="prob-label">元素属性</span>
              <span className="prob-val">⛏️木💧🔥🪨 各20%</span>
            </div>
          </div>
        </div>
      </div>

      {txHash && (
        <div className="bb-tx">
          最近交易：
          <a href={`https://testnet.bscscan.com/tx/${txHash}`} target="_blank" rel="noreferrer">
            {txHash.slice(0, 12)}… 查看 ↗
          </a>
        </div>
      )}
    </div>
  )
}
