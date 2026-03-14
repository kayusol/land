import { useEffect, useRef, useState } from 'react'
import { usePublicClient, useAccount } from 'wagmi'
import { CONTRACTS } from '../constants/contracts'
import './WorldMap.css'

// 仅包含地图 multicall 用到的函数，避免人类可读 ABI 中 "function name()..." 触发 viem 的 'name' in fragment 报错
const LAND_MAP_ABI = [
  { type: 'function', name: 'resourceAttr', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'uint80' }], stateMutability: 'view' },
  { type: 'function', name: 'ownerOf', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
]
const AUCTION_MAP_ABI = [
  { type: 'function', name: 'auctions', inputs: [{ name: 'id', type: 'uint256' }], outputs: [
    { name: 'seller', type: 'address' }, { name: 'startPrice', type: 'uint128' }, { name: 'endPrice', type: 'uint128' },
    { name: 'duration', type: 'uint64' }, { name: 'startedAt', type: 'uint64' },
  ], stateMutability: 'view' },
]

const W = 100, H = 100
const CELL = 10
const MAP_PX = W * CELL
const MAP_PY = H * CELL
const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
// 一万块地分五区，每区 2000 块，用最亮纯色
const REGION_SIZE = 20
const BRIGHTEST_COLORS = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff8800'] // 最亮：黄/绿/青/品红/橙
const OPAQUE = 'ff'

function regionForCell(x) {
  return Math.min(4, Math.floor(x / REGION_SIZE))
}

function dominantElement(attr) {
  if (!attr && attr !== 0n) return 0
  const a = BigInt(attr)
  const vals = [
    Number(a & 0xFFFFn),
    Number((a >> 16n) & 0xFFFFn),
    Number((a >> 32n) & 0xFFFFn),
    Number((a >> 48n) & 0xFFFFn),
    Number((a >> 64n) & 0xFFFFn),
  ]
  return vals.indexOf(Math.max(...vals))
}

function getElementValues(id, attr) {
  if (attr != null && attr !== undefined) {
    const a = BigInt(attr)
    return [
      Number(a & 0xFFFFn),
      Number((a >> 16n) & 0xFFFFn),
      Number((a >> 32n) & 0xFFFFn),
      Number((a >> 48n) & 0xFFFFn),
      Number((a >> 64n) & 0xFFFFn),
    ]
  }
  const n = Number(id)
  return [
    (n * 7 + 1) % 100,
    (n * 11 + 3) % 100,
    (n * 13 + 5) % 100,
    (n * 17 + 7) % 100,
    (n * 19 + 9) % 100,
  ]
}

export default function WorldMap() {
  const canvasRef = useRef(null)
  const publicClient = usePublicClient()
  const { address } = useAccount()

  const [attrs,    setAttrs]    = useState({})
  const [owners,   setOwners]   = useState({})
  const [auctions, setAuctions] = useState({})
  const [selected, setSelected] = useState(null)
  const [status,   setStatus]   = useState('正在从链上加载地图数据…')
  const [minted,   setMinted]   = useState(0)
  const [zoom,     setZoom]     = useState(1)
  const [pan,      setPan]      = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const panStartRef = useRef(null)
  const didDragRef = useRef(false)

  // Load land data
  useEffect(() => {
    let cancelled = false
    async function load() {
      setStatus('正在从链上加载地图数据…')
      try {
        // First check how many lands exist by scanning nextId or totalSupply
        // LandNFT is ERC721 — scan first 500 tokenIds in batches
        const BATCH = 100
        const TOTAL = 10000
        const newAttrs  = {}
        const newOwners = {}
        const newAuctions = {}
        let totalMinted = 0

        for (let start = 1; start <= TOTAL && !cancelled; start += BATCH) {
          const ids = Array.from({ length: Math.min(BATCH, TOTAL - start + 1) }, (_, i) => start + i)
          const [attrRes, ownerRes, aucRes] = await Promise.all([
            publicClient.multicall({ contracts: ids.map(id => ({
              address: CONTRACTS.land, abi: LAND_MAP_ABI,
              functionName: 'resourceAttr', args: [BigInt(id)],
            })), allowFailure: true }),
            publicClient.multicall({ contracts: ids.map(id => ({
              address: CONTRACTS.land, abi: LAND_MAP_ABI,
              functionName: 'ownerOf', args: [BigInt(id)],
            })), allowFailure: true }),
            publicClient.multicall({ contracts: ids.map(id => ({
              address: CONTRACTS.auction, abi: AUCTION_MAP_ABI,
              functionName: 'auctions', args: [BigInt(id)],
            })), allowFailure: true }),
          ])

          ids.forEach((id, i) => {
            const owner = ownerRes[i]?.result
            if (owner && owner !== '0x0000000000000000000000000000000000000000') {
              newOwners[id] = owner
              newAttrs[id]  = attrRes[i]?.result ?? 0n
              totalMinted++
            }
            const auc = aucRes[i]?.result
            if (auc && auc[4] && auc[4] > 0n) newAuctions[id] = true
          })
        }

        if (cancelled) return
        setAttrs(newAttrs)
        setOwners(newOwners)
        setAuctions(newAuctions)
        setMinted(totalMinted)
        setStatus(totalMinted === 0 ? '链上暂无已铸造地块' : null)
      } catch (e) {
        console.error('map load error', e)
        if (!cancelled) setStatus('加载失败: ' + e.message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [publicClient])

  // 限制 pan 不超出地图范围
  const clampPan = (p, z) => {
    const w = MAP_PX / z
    const h = MAP_PY / z
    return {
      x: Math.max(0, Math.min(MAP_PX - w, p.x)),
      y: Math.max(0, Math.min(MAP_PY - h, p.y)),
    }
  }

  // Draw canvas（带缩放平移）
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const p = clampPan(pan, zoom)
    ctx.save()
    ctx.setTransform(zoom, 0, 0, zoom, -p.x * zoom, -p.y * zoom)
    ctx.clearRect(0, 0, MAP_PX, MAP_PY)

    ctx.fillStyle = '#060d18'
    ctx.fillRect(0, 0, MAP_PX, MAP_PY)
    ctx.strokeStyle = '#0e1a2b'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= W; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, MAP_PY); ctx.stroke()
    }
    for (let y = 0; y <= H; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(MAP_PX, y * CELL); ctx.stroke()
    }

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        const id = x * 100 + y + 1
        const owner = owners[id]
        const attr = attrs[id]
        const vals = getElementValues(id, owner ? attr : null)
        let color
        if (owner) {
          const isAuction = auctions[id]
          const isMe = address && owner.toLowerCase() === address.toLowerCase()
          const elem = dominantElement(attr)
          color = BRIGHTEST_COLORS[elem] + OPAQUE
          if (isAuction) color = '#ffff00' + OPAQUE
          if (isMe) color = '#00ff88' + OPAQUE
        } else {
          color = BRIGHTEST_COLORS[regionForCell(x)] + OPAQUE
        }
        ctx.fillStyle = color
        ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2)
        const cx = x * CELL + CELL / 2
        const cy = y * CELL + CELL / 2
        const dominantVal = vals[vals.indexOf(Math.max(...vals))]
        ctx.font = 'bold 6px sans-serif'
        ctx.fillStyle = 'rgba(0,0,0,0.85)'
        ctx.fillText(String(Math.min(99, dominantVal)), cx, cy)

        if (selected === id) {
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1.5
          ctx.strokeRect(x * CELL + 0.75, y * CELL + 0.75, CELL - 1.5, CELL - 1.5)
        }
      }
    }
    ctx.restore()
  }, [attrs, owners, auctions, selected, address, zoom, pan])

  // 将屏幕坐标转为地图格子 (grid x, y)
  function clientToCell(clientX, clientY) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const bx = ((clientX - rect.left) / rect.width) * canvas.width
    const by = ((clientY - rect.top) / rect.height) * canvas.height
    const p = clampPan(pan, zoom)
    const wx = bx / zoom + p.x
    const wy = by / zoom + p.y
    const cx = Math.floor(wx / CELL)
    const cy = Math.floor(wy / CELL)
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) return null
    return { x: cx, y: cy, id: cx * 100 + cy + 1 }
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return
    didDragRef.current = false
    setDragging(true)
    panStartRef.current = { clientX: e.clientX, clientY: e.clientY, panX: pan.x, panY: pan.y }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function onWheel(e) {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const bx = ((e.clientX - rect.left) / rect.width) * canvas.width
      const by = ((e.clientY - rect.top) / rect.height) * canvas.height
      const p = clampPan(pan, zoom)
      const wx = bx / zoom + p.x
      const wy = by / zoom + p.y
      const factor = e.deltaY > 0 ? 1 / 1.15 : 1.15
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
      const newPanX = wx - bx / newZoom
      const newPanY = wy - by / newZoom
      setPan(clampPan({ x: newPanX, y: newPanY }, newZoom))
      setZoom(newZoom)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [zoom, pan])

  useEffect(() => {
    function onMove(e) {
      if (!panStartRef.current) return
      didDragRef.current = true
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scale = canvas.width / rect.width
      const dx = (e.clientX - panStartRef.current.clientX) * scale / zoom
      const dy = (e.clientY - panStartRef.current.clientY) * scale / zoom
      setPan(clampPan({
        x: panStartRef.current.panX - dx,
        y: panStartRef.current.panY - dy,
      }, zoom))
    }
    function onUp() {
      panStartRef.current = null
      setDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [zoom])

  function handleMouseLeave() {
    if (panStartRef.current) setDragging(false)
    panStartRef.current = null
  }

  function handleCanvasClick(e) {
    if (didDragRef.current) return
    const cell = clientToCell(e.clientX, e.clientY)
    if (cell) setSelected(cell.id)
  }

  function handleZoomIn() {
    setZoom(z => Math.min(MAX_ZOOM, z * 1.25))
  }

  function handleZoomOut() {
    setZoom(z => Math.max(MIN_ZOOM, z / 1.25))
  }

  function handleZoomReset() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const selAttr  = selected ? (attrs[selected] ?? 0n) : null
  const selOwner = selected ? owners[selected] : null
  const decAttr  = (a, shift) => a != null ? Number((BigInt(a) >> BigInt(shift)) & 0xFFFFn) : 0
  const selX = selected != null ? Math.floor((selected - 1) / 100) : null
  const selY = selected != null ? (selected - 1) % 100 : null

  const ELEM_ITEMS = [
    { key: 'GOLD',  icon: '🪙', val: decAttr(selAttr, 0) },
    { key: 'WOOD',  icon: '🪵', val: decAttr(selAttr, 16) },
    { key: 'WATER', icon: '💧', val: decAttr(selAttr, 32) },
    { key: 'FIRE',  icon: '🔥', val: decAttr(selAttr, 48) },
    { key: 'SOIL',  icon: '🪨', val: decAttr(selAttr, 64) },
  ]

  return (
    <div className="world-map-page">
      <div className="map-subnav">
        <button type="button" className="map-subnav-item active">地圖</button>
        <button type="button" className="map-subnav-item">熔爐</button>
      </div>
      <div className="map-topbar">
        <span className="map-title">世界地圖</span>
        <span className="map-stat">已铸造 <b>{minted}</b> / 10000 块地</span>
        <span className="map-regions">五区（各 2000 块）</span>
        {minted === 0 && (
          <span className="map-hint">⚠️ 链上暂无地块 — 需先运行铸地脚本</span>
        )}
      </div>

      <div className="map-content">
        <div className="map-wrap">
          {status && <div className="map-overlay">{status}</div>}
          <canvas
            ref={canvasRef}
            width={MAP_PX}
            height={MAP_PY}
            className="map-canvas"
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          />
          <div className="map-zoom-controls">
            <button type="button" className="map-zoom-btn" onClick={handleZoomIn} title="放大">+</button>
            <button type="button" className="map-zoom-btn" onClick={handleZoomOut} title="缩小">−</button>
            <button type="button" className="map-zoom-btn" onClick={handleZoomReset} title="重置">⟲</button>
          </div>
        </div>

        {selected != null && (
          <>
            <div className="map-detail-backdrop" onClick={() => setSelected(null)} aria-hidden="true" />
            <aside className="map-detail">
            <button type="button" className="map-detail-back" onClick={() => setSelected(null)}>← 後退</button>
            <div className="map-detail-title">屬性</div>

            <section className="map-detail-section">
              <div className="map-detail-section-title">屬性</div>
              <div className="map-detail-row"><span className="detail-label">類型</span><span>普通地</span></div>
              <div className="map-detail-row"><span className="detail-label">坐標</span><span>{selX}.{selY}</span></div>
              <div className="map-detail-row"><span className="detail-label">大陸</span><span>BSC 测试网</span></div>
              <div className="map-detail-row">
                <span className="detail-label">所有權</span>
                <span className="detail-address">
                  {selOwner ? (
                    <a href={`https://testnet.bscscan.com/address/${selOwner}`} target="_blank" rel="noreferrer">
                      {selOwner.slice(0, 10)}…{selOwner.slice(-8)}
                    </a>
                  ) : '未铸造'}
                </span>
              </div>
            </section>

            <section className="map-detail-section">
              <div className="map-detail-section-title">信息</div>
              <div className="map-detail-row"><span className="detail-label">介紹</span><span className="detail-empty">空空如也</span></div>
              <div className="map-detail-row"><span className="detail-label">連結</span><span className="detail-empty">空空如也</span></div>
            </section>

            <section className="map-detail-section">
              <div className="map-detail-section-title">元素</div>
              <div className="map-detail-elements">
                {ELEM_ITEMS.map(({ key, icon, val }) => (
                  <div key={key} className="map-detail-elem">
                    <span className="elem-icon">{icon}</span>
                    <span className="elem-name">{key}</span>
                    <span className="elem-val">{selOwner ? val : '—'}</span>
                  </div>
                ))}
              </div>
            </section>

            {auctions[selected] && (
              <div className="map-detail-auction">🔨 拍卖中</div>
            )}

            <section className="map-detail-section">
              <div className="map-detail-section-title">钻头工作区</div>
              <div className="map-detail-slots">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={`drill-${i}`} className="detail-slot" title="钻头槽位" />
                ))}
              </div>
            </section>

            <section className="map-detail-section">
              <div className="map-detail-section-title">使徒工作区</div>
              <div className="map-detail-slots">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={`apostle-${i}`} className="detail-slot" title="使徒槽位" />
                ))}
              </div>
            </section>
          </aside>
          </>
        )}
      </div>

      <div className="map-bottom">
        <div className="map-legend">
          {[['#ffff00','拍卖中'],['#00ff88','我的地块'],
            ['#ffff00','区1'],['#00ff00','区2'],['#00ffff','区3'],['#ff00ff','区4'],['#ff8800','区5']
          ].map(([c,l]) => (
            <div key={l} className="legend-item">
              <span style={{ background: c }} />{l}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
