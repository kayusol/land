import React, { useState, useEffect } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { parseEther, getContract } from 'viem'
import { CONTRACTS, RES_EMOJIS, RES_COLORS, LAND_COLORS, RES_NAMES_ZH, isDeployed } from '../constants/contracts.js'
import { LAND_ABI, AUCTION_ABI } from '../constants/abi.js'
import { useToast } from '../contexts/ToastContext.jsx'
import ResourceBar from '../components/ResourceBar.jsx'

const ZERO = '0x0000000000000000000000000000000000000000'

function decodeRates(attr80) {
  const n = BigInt(attr80)
  return Array.from({ length: 5 }, (_, i) => Number((n >> BigInt(i * 16)) & 0xFFFFn))
}

function LandCard({ land, onSell }) {
  const mainType = land.rates.indexOf(Math.max(...land.rates))
  const topColor  = LAND_COLORS[mainType] || LAND_COLORS[0]
  const icons      = ['🏆','🌿','💧','🔥','🌋']
  return (
    <div style={{
      background: '#1a2540',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, overflow: 'hidden',
      transition: 'box-shadow 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* 色块头部 */}
      <div style={{
        height: 62, background: topColor,
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 26, opacity: 0.65 }}>{icons[mainType]}</span>
        <div style={{ position: 'absolute', top: 6, left: 8 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 10,
            color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.45)',
            padding: '1px 6px', borderRadius: 4,
          }}>#{String(land.tokenId).padStart(5, '0')}</span>
        </div>
        <div style={{ position: 'absolute', top: 6, right: 8 }}>
          <span style={{
            fontSize: 10, color: 'rgba(255,255,255,0.75)', background: 'rgba(0,0,0,0.45)',
            padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace',
          }}>({land.x},{land.y})</span>
        </div>
      </div>

      {/* 资源 */}
      <div style={{ padding: '10px 12px' }}>
        {land.rates.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{RES_EMOJIS[i]}</span>
            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (r / 255) * 100)}%`, background: RES_COLORS[i], borderRadius: 2 }} />
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: RES_COLORS[i],
              minWidth: 28, textAlign: 'right', fontFamily: 'Rajdhani, monospace',
            }}>{r}</span>
          </div>
        ))}
        <button
          className="btn btn-sm"
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => onSell(land)}
        >
          🏛 上架拍卖 List
        </button>
      </div>
    </div>
  )
}

export default function MyLands() {
  const { address } = useAccount()
  const pub = usePublicClient()
  const { data: wal } = useWalletClient()
  const { toast } = useToast()
  const [lands,   setLands]   = useState([])
  const [loading, setLoading] = useState(false)
  const [sellTarget, setSellTarget] = useState(null)
  const [form, setForm] = useState({ start: '10', end: '1', days: '7' })
  const [tx, setTx]     = useState(false)
  const dep = isDeployed('land')

  const load = async () => {
    if (!address || !pub || !dep) return
    setLoading(true)
    try {
      const lc = getContract({ address: CONTRACTS.land, abi: LAND_ABI, client: pub })
      const f1 = await pub.createContractEventFilter({ address: CONTRACTS.land, abi: LAND_ABI, eventName: 'Transfer', args: { to: address }, fromBlock: 0n })
      const rcv = await pub.getFilterLogs({ filter: f1 })
      const ids = new Set(rcv.map(e => Number(e.args.tokenId)))
      const f2 = await pub.createContractEventFilter({ address: CONTRACTS.land, abi: LAND_ABI, eventName: 'Transfer', args: { from: address }, fromBlock: 0n })
      const snt = await pub.getFilterLogs({ filter: f2 })
      snt.forEach(e => ids.delete(Number(e.args.tokenId)))
      const items = await Promise.all([...ids].map(async id => {
        const [x, y] = await lc.read.decodeId([BigInt(id)])
        const attr   = await lc.read.resourceAttr([BigInt(id)])
        return { tokenId: id, x: Number(x), y: Number(y), rates: decodeRates(attr) }
      }))
      setLands(items)
    } catch (e) { toast.err('加载失败', e.message?.slice(0, 60)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [address])

  const createAuction = async () => {
    if (!wal || !sellTarget) return
    setTx(true)
    try {
      const lc = getContract({ address: CONTRACTS.land, abi: LAND_ABI, client: wal })
      const ac = getContract({ address: CONTRACTS.auction, abi: AUCTION_ABI, client: wal })
      const approved = await pub.readContract({ address: CONTRACTS.land, abi: LAND_ABI, functionName: 'getApproved', args: [BigInt(sellTarget.tokenId)] })
      if (approved.toLowerCase() !== CONTRACTS.auction.toLowerCase()) {
        const h = await lc.write.approve([CONTRACTS.auction, BigInt(sellTarget.tokenId)])
        await pub.waitForTransactionReceipt({ hash: h })
      }
      const h = await ac.write.createAuction([
        BigInt(sellTarget.tokenId),
        parseEther(form.start), parseEther(form.end),
        BigInt(Number(form.days) * 86400),
      ])
      await pub.waitForTransactionReceipt({ hash: h })
      toast.ok('拍卖创建成功', `地块 #${sellTarget.tokenId} 已上架`)
      setSellTarget(null); load()
    } catch (e) { toast.err('操作失败', e.message?.slice(0, 80)) }
    finally { setTx(false) }
  }

  if (!address) return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="nc-state"><div className="nc-icon">🏔</div><h3>请先连接钱包</h3><p>Connect your wallet to view your lands</p></div>
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ResourceBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>我的地块</h2>
            <p style={{ fontSize: 12, color: '#334155' }}>My Lands · {lands.length} 块</p>
          </div>
          <button className="btn btn-sm" onClick={load} disabled={loading}>
            {loading ? <span className="spin-anim">◌</span> : '↻'} 刷新
          </button>
        </div>

        {!dep ? (
          <div className="notice-bar"><span className="notice-icon">⚠</span>合约未部署，请填写 src/constants/contracts.js</div>
        ) : loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14 }}>
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 200 }} />)}
          </div>
        ) : lands.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏔</div>
            <h4>暂无地块</h4>
            <p>前往拍卖市场购买地块，开始挖矿赚取资源</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14 }}>
            {lands.map(l => <LandCard key={l.tokenId} land={l} onSell={setSellTarget} />)}
          </div>
        )}
      </div>

      {sellTarget && (
        <div className="modal-overlay" onClick={() => setSellTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>创建拍卖</h3>
              <button className="modal-close" onClick={() => setSellTarget(null)}>×</button>
            </div>
            <p style={{ fontSize: 12, color: '#475569', marginBottom: 14 }}>
              地块 #{sellTarget.tokenId} · ({sellTarget.x}, {sellTarget.y}) · 荷兰拍卖
            </p>
            {[['起拍价 (RING)', 'start'], ['底价 (RING)', 'end'], ['持续天数', 'days']].map(([l, k]) => (
              <div key={k} className="form-group">
                <label>{l}</label>
                <input type="number" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="modal-foot">
              <button className="btn" onClick={() => setSellTarget(null)}>取消</button>
              <button className="btn btn-primary" onClick={createAuction} disabled={tx}>
                {tx ? <span className="spin-anim">◌</span> : null} 创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
