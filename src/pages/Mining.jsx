import React, { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { formatEther, getContract } from 'viem'
import { CONTRACTS, RES_NAMES_ZH, RES_EMOJIS, RES_COLORS, LAND_COLORS, isDeployed } from '../constants/contracts.js'
import { LAND_ABI, DRILL_ABI, APOSTLE_ABI, MINING_ABI } from '../constants/abi.js'
import { useToast } from '../contexts/ToastContext.jsx'
import ResourceBar from '../components/ResourceBar.jsx'

function decodeRates(attr80) {
  const n = BigInt(attr80)
  return Array.from({ length: 5 }, (_, i) => Number((n >> BigInt(i * 16)) & 0xFFFFn))
}

export default function Mining() {
  const { address } = useAccount()
  const pub = usePublicClient()
  const { data: wal } = useWalletClient()
  const { toast } = useToast()
  const [lands,    setLands]    = useState([])
  const [apostles, setApostles] = useState([])
  const [drills,   setDrills]   = useState([])
  const [active,   setActive]   = useState(null)
  const [slots,    setSlots]    = useState([])
  const [pending,  setPending]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [txKey,    setTxKey]    = useState('')
  const [modal,    setModal]    = useState({ show: false, apo: '', drill: '0' })
  const dep = isDeployed('land')

  const getOwned = async (addr, abi) => {
    const f1  = await pub.createContractEventFilter({ address: addr, abi, eventName: 'Transfer', args: { to: address }, fromBlock: 0n })
    const rcv = await pub.getFilterLogs({ filter: f1 })
    const ids = new Set(rcv.map(e => Number(e.args.tokenId)))
    const f2  = await pub.createContractEventFilter({ address: addr, abi, eventName: 'Transfer', args: { from: address }, fromBlock: 0n })
    const snt = await pub.getFilterLogs({ filter: f2 })
    snt.forEach(e => ids.delete(Number(e.args.tokenId)))
    return [...ids]
  }

  const loadAll = useCallback(async () => {
    if (!address || !pub || !dep) return
    setLoading(true)
    try {
      const [lids, aids, dids] = await Promise.all([
        getOwned(CONTRACTS.land,    LAND_ABI),
        getOwned(CONTRACTS.apostle, APOSTLE_ABI),
        getOwned(CONTRACTS.drill,   DRILL_ABI),
      ])
      const lc = getContract({ address: CONTRACTS.land,    abi: LAND_ABI,    client: pub })
      const ac = getContract({ address: CONTRACTS.apostle, abi: APOSTLE_ABI, client: pub })
      const dc = getContract({ address: CONTRACTS.drill,   abi: DRILL_ABI,   client: pub })
      const [ls, as, ds] = await Promise.all([
        Promise.all(lids.map(async id => {
          const [x, y] = await lc.read.decodeId([BigInt(id)])
          const a      = await lc.read.resourceAttr([BigInt(id)])
          return { tokenId: id, x: Number(x), y: Number(y), rates: decodeRates(a) }
        })),
        Promise.all(aids.map(async id => {
          const a = await ac.read.attrs([BigInt(id)])
          return { tokenId: id, strength: Number(a.strength), element: Number(a.element) }
        })),
        Promise.all(dids.map(async id => {
          const a = await dc.read.attrs([BigInt(id)])
          return { tokenId: id, tier: Number(a.tier), affinity: Number(a.affinity) }
        })),
      ])
      setLands(ls); setApostles(as); setDrills(ds)
    } catch (e) { toast.err('加载失败', e.message?.slice(0, 60)) }
    finally { setLoading(false) }
  }, [address, pub, dep])

  const loadSlots = useCallback(async (landId) => {
    if (!landId || !pub || !isDeployed('mining')) return
    try {
      const mc  = getContract({ address: CONTRACTS.mining, abi: MINING_ABI, client: pub })
      const cnt = Number(await mc.read.slotCount([BigInt(landId)]))
      const sd  = await Promise.all(Array.from({ length: cnt }, (_, i) => mc.read.slots([BigInt(landId), BigInt(i)])))
      setSlots(sd.map(s => ({ apo: Number(s.apostleId), drill: Number(s.drillId), t: Number(s.startTime) })))
      const rw = await mc.read.pendingRewards([BigInt(landId)])
      setPending(Array.from(rw).map(r => parseFloat(formatEther(r))))
    } catch { setSlots([]); setPending([]) }
  }, [pub])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (active) loadSlots(active.tokenId) }, [active, loadSlots])

  const doStart = async () => {
    if (!wal || !active) return
    setTxKey('start')
    try {
      const mc  = getContract({ address: CONTRACTS.mining,  abi: MINING_ABI,  client: wal })
      const ac  = getContract({ address: CONTRACTS.apostle, abi: APOSTLE_ABI, client: wal })
      let h = await ac.write.setApprovalForAll([CONTRACTS.mining, true])
      await pub.waitForTransactionReceipt({ hash: h })
      const dId = BigInt(modal.drill)
      if (dId !== 0n) {
        const dc = getContract({ address: CONTRACTS.drill, abi: DRILL_ABI, client: wal })
        h = await dc.write.setApprovalForAll([CONTRACTS.mining, true])
        await pub.waitForTransactionReceipt({ hash: h })
      }
      h = await mc.write.startMining([BigInt(active.tokenId), BigInt(modal.apo), dId])
      await pub.waitForTransactionReceipt({ hash: h })
      toast.ok('开始挖矿', `使徒 #${modal.apo} 已出发`)
      setModal({ show: false, apo: '', drill: '0' })
      loadSlots(active.tokenId)
    } catch (e) { toast.err('操作失败', e.message?.slice(0, 80)) }
    finally { setTxKey('') }
  }

  const doStop = async (apoId) => {
    if (!wal || !active) return
    setTxKey('s' + apoId)
    try {
      const mc = getContract({ address: CONTRACTS.mining, abi: MINING_ABI, client: wal })
      const h  = await mc.write.stopMining([BigInt(active.tokenId), BigInt(apoId)])
      await pub.waitForTransactionReceipt({ hash: h })
      toast.ok('撤回成功', `使徒 #${apoId} 已返回`)
      loadSlots(active.tokenId)
    } catch (e) { toast.err('操作失败', e.message?.slice(0, 80)) }
    finally { setTxKey('') }
  }

  const doClaim = async () => {
    if (!wal || !active) return
    setTxKey('claim')
    try {
      const mc = getContract({ address: CONTRACTS.mining, abi: MINING_ABI, client: wal })
      const h  = await mc.write.claim([BigInt(active.tokenId)])
      await pub.waitForTransactionReceipt({ hash: h })
      toast.ok('领取成功', '资源已到账')
      loadSlots(active.tokenId)
    } catch (e) { toast.err('操作失败', e.message?.slice(0, 80)) }
    finally { setTxKey('') }
  }

  if (!address) return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <div className="nc-state"><div className="nc-icon">⛏</div><h3>请先连接钱包</h3></div>
    </div>
  )
  if (!dep) return (
    <div style={{ padding: 24 }}>
      <div className="notice-bar"><span className="notice-icon">⚠</span>合约未部署，请填写 src/constants/contracts.js</div>
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ResourceBar />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '185px 1fr', overflow: 'hidden', minHeight: 0 }}>

        {/* 左侧地块列表 */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', padding: '0 4px 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>选择地块 Select</div>
          {loading ? <div className="skeleton" style={{ height: 64 }} /> :
           lands.length === 0 ? <p style={{ fontSize: 12, color: '#1e2a3a', padding: '0 4px' }}>暂无地块</p> :
           lands.map(l => {
             const mt = l.rates.indexOf(Math.max(...l.rates))
             const isActive = active?.tokenId === l.tokenId
             return (
               <div key={l.tokenId}
                 onClick={() => setActive(l)}
                 style={{
                   background: isActive ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.02)',
                   border: `1px solid ${isActive ? 'rgba(74,222,128,0.28)' : 'rgba(255,255,255,0.05)'}`,
                   borderRadius: 8, padding: '8px 10px', cursor: 'pointer', transition: 'all 0.15s',
                 }}
               >
                 <div style={{ fontFamily: 'monospace', fontSize: 11, color: isActive ? '#4ade80' : '#64748b' }}>
                   #{String(l.tokenId).padStart(5,'0')}
                 </div>
                 <div style={{ fontSize: 10, color: '#2d3748', marginTop: 1 }}>({l.x},{l.y})</div>
                 <div style={{ display: 'flex', gap: 2, marginTop: 5, alignItems: 'flex-end', height: 14 }}>
                   {l.rates.map((r, i) => (
                     <div key={i} style={{
                       width: 8, background: RES_COLORS[i],
                       opacity: 0.35 + (r / 255) * 0.65,
                       height: Math.max(2, (r / 255) * 14), borderRadius: 1,
                     }} />
                   ))}
                 </div>
               </div>
             )
           })}
        </div>

        {/* 右侧挖矿详情 */}
        <div style={{ overflowY: 'auto', padding: 20 }}>
          {!active ? (
            <div className="empty-state">
              <div className="empty-icon">⛰</div>
              <h4>请选择一块地</h4>
              <p>选择左侧地块，管理使徒和钻头</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>地块 #{String(active.tokenId).padStart(5,'0')}</h2>
                  <p style={{ fontSize: 12, color: '#334155' }}>坐标 ({active.x},{active.y}) · {slots.length}/5 插槽使用</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" onClick={doClaim}
                    disabled={!!txKey || pending.every(v => v < 0.0001)}>
                    {txKey==='claim' ? <span className="spin-anim">◌</span> : null} 领取资源
                  </button>
                  <button className="btn btn-primary btn-sm"
                    onClick={() => setModal({ show: true, apo: '', drill: '0' })}
                    disabled={slots.length >= 5}>
                    + 派遣使徒
                  </button>
                </div>
              </div>

              {/* 待领取 */}
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>待领取 Pending</div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {pending.map((v, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 18 }}>{RES_EMOJIS[i]}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: RES_COLORS[i], lineHeight: 1 }}>{v.toFixed(4)}</div>
                        <div style={{ fontSize: 10, color: '#2d3748' }}>{RES_NAMES_ZH[i]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 使徒插槽 */}
              <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>挖矿中的使徒</div>
              {slots.length === 0 ? (
                <p style={{ fontSize: 12, color: '#1e2a3a' }}>暂无使徒在此挖矿，点击「派遣使徒」开始</p>
              ) : slots.map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8, marginBottom: 8,
                }}>
                  <span style={{ fontSize: 22 }}>🧙</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>使徒 #{s.apo}</div>
                    {s.drill > 0 && <div style={{ fontSize: 11, color: '#60a5fa' }}>⛏ 配备钻头 #{s.drill}</div>}
                    <div style={{ fontSize: 10, color: '#1e2a3a' }}>开始: {new Date(s.t * 1000).toLocaleString('zh-CN')}</div>
                  </div>
                  <button className="btn btn-danger btn-xs" onClick={() => doStop(s.apo)} disabled={!!txKey}>
                    {txKey === 's'+s.apo ? <span className="spin-anim">◌</span> : '撤回'}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 派遣弹窗 */}
      {modal.show && (
        <div className="modal-overlay" onClick={() => setModal(m => ({ ...m, show: false }))}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>派遣使徒挖矿</h3>
              <button className="modal-close" onClick={() => setModal(m => ({ ...m, show: false }))}>×</button>
            </div>
            <div className="form-group">
              <label>选择使徒 Select Apostle</label>
              <select value={modal.apo} onChange={e => setModal(m => ({ ...m, apo: e.target.value }))}>
                <option value="">-- 请选择使徒 --</option>
                {apostles.map(a => (
                  <option key={a.tokenId} value={a.tokenId}>
                    #{a.tokenId} · 力量 {a.strength} · {['黄金','木材','水源','火焰','土地'][a.element]} 属性
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>选择钻头（可选）Select Drill</label>
              <select value={modal.drill} onChange={e => setModal(m => ({ ...m, drill: e.target.value }))}>
                <option value="0">不配备钻头</option>
                {drills.map(d => (
                  <option key={d.tokenId} value={d.tokenId}>
                    #{d.tokenId} · {d.tier}星 · {['黄金','木材','水源','火焰','土地'][d.affinity]}亲和 +{d.tier*20}%
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setModal(m => ({ ...m, show: false }))}>取消</button>
              <button className="btn btn-primary" onClick={doStart} disabled={!modal.apo || txKey === 'start'}>
                {txKey === 'start' ? <span className="spin-anim">◌</span> : null} 派遣出发
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
