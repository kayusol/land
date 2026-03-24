import React, { useState, useEffect, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient } from '../contexts/WalletContext.jsx'

import { parseEther, getContract, formatEther } from 'viem'
import {
  CONTRACTS, RES_NAMES_ZH, RES_NAMES_EN,
  RES_EMOJIS, RES_COLORS, isDeployed,
} from '../constants/contracts.js'
import { LAND_ABI, AUCTION_ABI, MINING_ABI } from '../constants/abi.js'
import { useToast } from '../contexts/ToastContext.jsx'
import './LandPanel.css'

const TYPE_ZH = ['黄金大陆', '木材森林', '水源绿洲', '火焰熔岩', '土地荒原']
const CONTINENT = 'BSC 测试网 (Testnet)'

function ResCircle({ i, val, isTop }) {
  const COLORS = ['#f59e0b','#22c55e','#06b6d4','#ef4444','#a78bfa']
  const ICONS  = ['🪙','🌲','💧','🔥','⛰']
  return (
    <div className={`lp-res-item${isTop?' lp-res-top':''}`}>
      <div className="lp-res-circle"
        style={{
          background: `${COLORS[i]}18`,
          border: `2.5px solid ${isTop ? COLORS[i] : COLORS[i]+'44'}`,
          boxShadow: isTop ? `0 0 12px ${COLORS[i]}44` : 'none',
        }}
      >
        <span style={{fontSize:18}}>{ICONS[i]}</span>
      </div>
      <div className="lp-res-label" style={{color: COLORS[i]}}>{RES_NAMES_EN[i].toUpperCase()}</div>
      <div className="lp-res-val">{val}</div>
      <div className="lp-res-zh">{RES_NAMES_ZH[i]}</div>
    </div>
  )
}

export default function LandPanel({ land, onClose }) {
  const { address } = useAccount()
  const pub = usePublicClient()
  const { data: wal } = useWalletClient()
  const { toast } = useToast()
  const { x, y, tokenId, attr } = land

  const [chain, setChain]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [showAuction, setShowAuction] = useState(false)
  const [aForm, setAForm]   = useState({ start: '10', end: '1', days: '7' })
  const [tx, setTx]         = useState('')

  const isDepl = isDeployed('land')

  const fetchChain = useCallback(async () => {
    if (!pub || !isDepl) return
    setLoading(true)
    try {
      const lc = getContract({ address: CONTRACTS.land, abi: LAND_ABI, client: pub })
      const owner = await lc.read.ownerOf([BigInt(tokenId)])
      const raw   = await lc.read.resourceAttr([BigInt(tokenId)])
      const n     = BigInt(raw)
      const rates = Array.from({length:5}, (_,i) => Number((n >> BigInt(i*16)) & 0xFFFFn))
      let slots=[], pending=[]
      if (isDeployed('mining')) {
        const mc  = getContract({ address: CONTRACTS.mining, abi: MINING_ABI, client: pub })
        const cnt = Number(await mc.read.slotCount([BigInt(tokenId)]))
        const sd  = await Promise.all(Array.from({length:cnt},(_,i) => mc.read.slots([BigInt(tokenId),BigInt(i)])))
        slots     = sd.map(s=>({apo:Number(s.apostleId),drill:Number(s.drillId),t:Number(s.startTime)}))
        const rw  = await mc.read.pendingRewards([BigInt(tokenId)])
        pending   = Array.from(rw).map(r=>parseFloat(formatEther(r)))
      }
      setChain({ owner, rates, slots, pending })
    } catch {}
    finally { setLoading(false) }
  }, [tokenId, pub, isDepl])

  useEffect(()=>{ fetchChain() },[fetchChain])

  const isMine = !!(address && chain?.owner?.toLowerCase() === address?.toLowerCase())
  const rates  = chain?.rates ?? attr.rates
  const maxVal = Math.max(...rates, 1)

  const doAuction = async () => {
    if (!wal) return
    setTx('auction')
    try {
      const lc = getContract({address:CONTRACTS.land,abi:LAND_ABI,client:wal})
      const ac = getContract({address:CONTRACTS.auction,abi:AUCTION_ABI,client:wal})
      const ok = await pub.readContract({address:CONTRACTS.land,abi:LAND_ABI,functionName:'getApproved',args:[BigInt(tokenId)]})
      if (ok.toLowerCase() !== CONTRACTS.auction.toLowerCase()) {
        const h = await lc.write.approve([CONTRACTS.auction, BigInt(tokenId)])
        await pub.waitForTransactionReceipt({hash:h})
      }
      const h = await ac.write.createAuction([BigInt(tokenId),parseEther(aForm.start),parseEther(aForm.end),BigInt(Number(aForm.days)*86400)])
      await pub.waitForTransactionReceipt({hash:h})
      toast.ok('拍卖创建成功', `地块 #${tokenId} 已上架`)
      setShowAuction(false)
    } catch(e){ toast.err('操作失败', e.message?.slice(0,80)) }
    finally { setTx('') }
  }

  const doClaim = async () => {
    if (!wal) return
    setTx('claim')
    try {
      const mc = getContract({address:CONTRACTS.mining,abi:MINING_ABI,client:wal})
      const h  = await mc.write.claim([BigInt(tokenId)])
      await pub.waitForTransactionReceipt({hash:h})
      toast.ok('领取成功', '资源已到账')
      fetchChain()
    } catch(e){ toast.err('操作失败', e.message?.slice(0,80)) }
    finally { setTx('') }
  }

  return (
    <div className="lp">
      {/* 返回栏 */}
      <div className="lp-topbar">
        <button className="lp-back" onClick={onClose}>← 后退</button>
      </div>

      {/* ═══ 属性区 ═══ */}
      <div className="lp-sec">
        <div className="lp-sec-hd">属性 <span className="lp-help">ⓘ</span></div>
        <div className="lp-attr-row">
          <div className="lp-attr">
            <div className="lp-attr-lbl">类型</div>
            <div className="lp-attr-val">{TYPE_ZH[attr.mainType]}</div>
          </div>
          <div className="lp-attr">
            <div className="lp-attr-lbl">坐标</div>
            <div className="lp-attr-val" style={{fontFamily:'monospace'}}>{x}, {y}</div>
          </div>
          <div className="lp-attr">
            <div className="lp-attr-lbl">大陆</div>
            <div className="lp-attr-val">{CONTINENT}</div>
          </div>
        </div>
        <div className="lp-owner-row">
          <span className="lp-owner-lbl">所有者</span>
          {loading ? <span style={{color:'#334155',fontSize:11}}>加载中...</span>
          : chain?.owner
            ? isMine
              ? <span className="lp-mine">🙋 我的地块</span>
              : <span className="lp-addr">{chain.owner.slice(0,12)}...{chain.owner.slice(-6)}</span>
            : <span style={{color:'#22c55e',fontSize:11}}>⬡ 尚未铸造（预览）</span>}
        </div>
      </div>

      {/* ═══ 信息区 ═══ */}
      <div className="lp-sec">
        <div className="lp-sec-hd">信息</div>
        <div className="lp-info-grid">
          {/* 左: 头像/图片占位 */}
          <div className="lp-info-avatar">
            <div className="lp-avatar-box">🗺</div>
          </div>
          {/* 右: 介绍+链接 */}
          <div className="lp-info-right">
            <div className="lp-info-lbl">介绍</div>
            <div className="lp-info-empty">空空如也</div>
            <div className="lp-info-lbl" style={{marginTop:8}}>链接</div>
            <div className="lp-info-empty">空空如也</div>
          </div>
        </div>
      </div>

      {/* ═══ 元素区 ═══ */}
      <div className="lp-sec">
        <div className="lp-sec-hd">元素 <span className="lp-help">ⓘ</span></div>
        {/* 5个圆形图标排成一行 */}
        <div className="lp-res-row">
          {rates.map((val, i) => (
            <ResCircle key={i} i={i} val={val} isTop={val===maxVal&&val>0} />
          ))}
        </div>
      </div>

      {/* ═══ 使徒工牌 ═══ */}
      <div className="lp-sec">
        <div className="lp-sec-hd">使徒工牌</div>
        {!isDeployed('mining') ? (
          <div className="lp-empty-state">⚠ 合约未部署</div>
        ) : loading ? (
          <div className="lp-empty-state">加载中...</div>
        ) : !chain || chain.slots.length === 0 ? (
          <div className="lp-empty-state">暂无使徒在此挖矿</div>
        ) : (
          <div className="lp-slots">
            {chain.slots.map((s,i) => (
              <div key={i} className="lp-slot">
                <div className="lp-slot-avatar">🧙</div>
                <div className="lp-slot-info">
                  <div>使徒 #{s.apo}</div>
                  {s.drill>0 && <div style={{color:'#60a5fa',fontSize:11}}>⛏ 钻头 #{s.drill}</div>}
                  <div style={{color:'#334155',fontSize:10}}>{new Date(s.t*1000).toLocaleDateString('zh-CN')}</div>
                </div>
                {isMine && <button className="btn btn-danger btn-xs" disabled={!!tx} onClick={()=>{}}>撤回</button>}
              </div>
            ))}
          </div>
        )}

        {/* 待领取 */}
        {chain?.pending?.some(v=>v>0.0001) && (
          <div className="lp-pending">
            <div style={{fontSize:11,color:'#4ade80',marginBottom:6}}>待领取 Pending</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {chain.pending.map((v,i) => v>0.0001 && (
                <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontSize:16}}>{RES_EMOJIS[i]}</span>
                  <span style={{color:RES_COLORS[i],fontWeight:700,fontSize:13}}>{v.toFixed(4)}</span>
                </div>
              ))}
            </div>
            {isMine && (
              <button className="btn btn-primary btn-sm" style={{marginTop:8}} onClick={doClaim} disabled={!!tx}>
                {tx==='claim'&&<span className="spin-anim">◌</span>} 领取
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══ 钻头工牌 ═══ */}
      <div className="lp-sec">
        <div className="lp-sec-hd">钻头工牌</div>
        <div className="lp-empty-state">暂无钻头</div>
      </div>

      {/* ═══ 交易历史 ═══ */}
      <div className="lp-sec">
        <div className="lp-sec-hd">交易历史</div>
        <div className="lp-trade-hd">
          <span>BIDER</span><span>CLAIM TIME</span><span>PRICE</span>
        </div>
        <div className="lp-empty-state">暂无交易记录</div>
      </div>

      {/* ═══ 操作区 ═══ */}
      {address && isDepl && (
        <div className="lp-sec">
          {isMine ? (
            <>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <button className="btn btn-sm" onClick={()=>setShowAuction(a=>!a)}>
                  🏛 {showAuction?'收起':'上架拍卖'}
                </button>
                <button className="btn btn-sm">⛏ 派遣使徒</button>
              </div>
              {showAuction && (
                <div className="lp-form-box">
                  <div className="lp-form-title">荷兰拍卖 Dutch Auction</div>
                  {[['起拍价 (RING)','start'],['底价 (RING)','end'],['持续天数','days']].map(([l,k])=>(
                    <div key={k} className="form-group" style={{marginBottom:8}}>
                      <label style={{fontSize:11,color:'#475569',marginBottom:3,display:'block'}}>{l}</label>
                      <input type="number" value={aForm[k]} onChange={e=>setAForm(f=>({...f,[k]:e.target.value}))} />
                    </div>
                  ))}
                  <div style={{display:'flex',gap:8,marginTop:6}}>
                    <button className="btn btn-sm" onClick={()=>setShowAuction(false)}>取消</button>
                    <button className="btn btn-primary btn-sm" onClick={doAuction} disabled={!!tx}>
                      {tx==='auction'&&<span className="spin-anim">◌</span>} 创建拍卖
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : chain?.owner ? (
            <button className="btn btn-gold btn-sm">💰 竞拍此地 Bid</button>
          ) : null}
        </div>
      )}
    </div>
  )
}
