import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useAccount, useWalletClient } from '../contexts/WalletContext.jsx'
import { formatEther, encodeFunctionData, parseEther } from 'viem'
import { CONTRACTS } from '../constants/contracts'
import './UpgradePage.css'

const UPGRADE_ADDR = '0xd8083a57b479bb920d52f0db2257936023b49ea7'

const ERC20_ABI = [
  { type:'function', name:'balanceOf', inputs:[{name:'a',type:'address'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'allowance', inputs:[{name:'o',type:'address'},{name:'s',type:'address'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'approve', inputs:[{name:'s',type:'address'},{name:'a',type:'uint256'}], outputs:[{type:'bool'}], stateMutability:'nonpayable' },
]
const APO_ABI = [
  { type:'function', name:'attrs', inputs:[{name:'id',type:'uint256'}], outputs:[{name:'strength',type:'uint8'},{name:'element',type:'uint8'},{name:'gender',type:'uint8'},{name:'gen',type:'uint16'},{name:'genes',type:'uint64'},{name:'birthTime',type:'uint64'},{name:'cooldown',type:'uint64'},{name:'motherId',type:'uint32'},{name:'fatherId',type:'uint32'}], stateMutability:'view' },
  { type:'function', name:'ownerOf', inputs:[{name:'id',type:'uint256'}], outputs:[{type:'address'}], stateMutability:'view' },
  { type:'function', name:'nextId', inputs:[], outputs:[{type:'uint256'}], stateMutability:'view' },
]
const DRL_ABI = [
  { type:'function', name:'attrs', inputs:[{name:'id',type:'uint256'}], outputs:[{name:'tier',type:'uint8'},{name:'affinity',type:'uint8'}], stateMutability:'view' },
  { type:'function', name:'ownerOf', inputs:[{name:'id',type:'uint256'}], outputs:[{type:'address'}], stateMutability:'view' },
  { type:'function', name:'nextId', inputs:[], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'isApprovedForAll', inputs:[{name:'o',type:'address'},{name:'s',type:'address'}], outputs:[{type:'bool'}], stateMutability:'view' },
  { type:'function', name:'setApprovalForAll', inputs:[{name:'op',type:'address'},{name:'v',type:'bool'}], outputs:[], stateMutability:'nonpayable' },
]
const UPGRADE_ABI = [
  { type:'function', name:'upgradeApostle', inputs:[{name:'apostleId',type:'uint256'},{name:'currentStar',type:'uint8'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'mergedrills', inputs:[{name:'drillIds',type:'uint256[3]'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'chargeLand', inputs:[{name:'landId',type:'uint256'},{name:'element',type:'uint8'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'chargeCountdown', inputs:[{name:'landId',type:'uint256'}], outputs:[{type:'uint256'}], stateMutability:'view' },
]
const LAND_ABI = [
  { type:'function', name:'ownerOf', inputs:[{name:'id',type:'uint256'}], outputs:[{type:'address'}], stateMutability:'view' },
  { type:'function', name:'getRate', inputs:[{name:'id',type:'uint256'},{name:'res',type:'uint8'}], outputs:[{type:'uint16'}], stateMutability:'view' },
  { type:'function', name:'isApprovedForAll', inputs:[{name:'o',type:'address'},{name:'s',type:'address'}], outputs:[{type:'bool'}], stateMutability:'view' },
  { type:'function', name:'setApprovalForAll', inputs:[{name:'op',type:'address'},{name:'v',type:'bool'}], outputs:[], stateMutability:'nonpayable' },
]

const ELEM_NAMES  = ['金','木','水','火','土']
const ELEM_COLORS = ['#f59e0b','#22c55e','#3b82f6','#ef4444','#a78bfa']
const ELEM_TOKENS = ['GOLD','WOOD','HHO','FIRE','SIOO']
const ELEM_ADDRS  = () => [CONTRACTS.gold, CONTRACTS.wood, CONTRACTS.water, CONTRACTS.fire, CONTRACTS.soil]
const fmtR = (w, dp=2) => w ? Number(formatEther(w)).toFixed(dp) : '0'
const APO_COSTS  = [0, 100, 200, 400, 800]
const DRILL_COSTS = [0, 300, 600, 1200, 2400]
const LAND_COSTS  = [500, 2000, 8000]
const GRADE_NAMES = ['C级','B级','A级','S级']
function getGrade(r){ return r>=80?3:r>=60?2:r>=40?1:0 }
function getStar(s){ return s<=30?1:s<=50?2:s<=70?3:s<=85?4:5 }

// ── 通用：扫描钱包持有的 NFT ──────────────────────────────────────────
async function scanMyNFTs(pc, address, contract, abi) {
  const nextId = Number(await pc.readContract({ address: contract, abi, functionName: 'nextId' }))
  const BATCH = 50, myIds = []
  for (let s = 1; s < nextId; s += BATCH) {
    const ids = Array.from({ length: Math.min(BATCH, nextId-s) }, (_, i) => s+i)
    const res = await pc.multicall({
      contracts: ids.map(id => ({ address: contract, abi: [{ type:'function', name:'ownerOf', inputs:[{name:'id',type:'uint256'}], outputs:[{type:'address'}], stateMutability:'view' }], functionName:'ownerOf', args:[BigInt(id)] })),
      allowFailure: true
    })
    ids.forEach((id, i) => { if (res[i]?.result?.toLowerCase() === address.toLowerCase()) myIds.push(id) })
  }
  return myIds
}

// ── Tab 1：使徒升星 ───────────────────────────────────────────────────
function ApostleUpgradeTab({ pc, address, wc }) {
  const [myApos, setMyApos]   = useState([])  // [{id, strength, element}]
  const [selId,  setSelId]    = useState('')
  const [elemBal, setElemBal] = useState(0n)
  const [msg,    setMsg]      = useState({ text:'', ok:true })
  const [busy,   setBusy]     = useState(false)
  const [loading,setLoading]  = useState(false)

  // 扫描钱包里的使徒
  useEffect(() => {
    if (!pc || !address) return
    setLoading(true)
    scanMyNFTs(pc, address, CONTRACTS.apostle, APO_ABI).then(async ids => {
      const attrRes = await pc.multicall({
        contracts: ids.map(id => ({ address:CONTRACTS.apostle, abi:APO_ABI, functionName:'attrs', args:[BigInt(id)] })),
        allowFailure: true
      })
      const list = ids.map((id, i) => {
        const a = attrRes[i]?.result
        return a ? { id, strength: Number(a[0]), element: Number(a[1]) } : null
      }).filter(Boolean).filter(x => getStar(x.strength) < 5)  // 过滤已满星
      setMyApos(list)
      if (list.length > 0 && !selId) setSelId(String(list[0].id))
    }).finally(() => setLoading(false))
  }, [pc, address])

  const apo = myApos.find(a => String(a.id) === selId) || null
  const star = apo ? getStar(apo.strength) : 0
  const cost = apo ? APO_COSTS[star] : 0

  useEffect(() => {
    if (!apo || !pc || !address) return
    pc.readContract({ address: ELEM_ADDRS()[apo.element], abi: ERC20_ABI, functionName: 'balanceOf', args: [address] })
      .then(b => setElemBal(b)).catch(() => setElemBal(0n))
  }, [apo, pc, address])

  async function doUpgrade() {
    if (!wc || !apo) return
    const costWei = parseEther(String(cost))
    if (elemBal < costWei) { setMsg({ text:`元素不足！需要 ${cost}，当前 ${fmtR(elemBal)}`, ok:false }); return }
    setBusy(true)
    try {
      const elemAddr = ELEM_ADDRS()[apo.element]
      const allow = await pc.readContract({ address:elemAddr, abi:ERC20_ABI, functionName:'allowance', args:[address, UPGRADE_ADDR] })
      if (allow < costWei) {
        setMsg({ text:'授权元素...', ok:true })
        const h = await wc.sendTransaction({ to:elemAddr, data:encodeFunctionData({ abi:ERC20_ABI, functionName:'approve', args:[UPGRADE_ADDR, costWei*10n] }) })
        await pc.waitForTransactionReceipt({ hash:h })
      }
      setMsg({ text:'升星中...', ok:true })
      const h = await wc.sendTransaction({ to:UPGRADE_ADDR, data:encodeFunctionData({ abi:UPGRADE_ABI, functionName:'upgradeApostle', args:[BigInt(apo.id), star] }) })
      await pc.waitForTransactionReceipt({ hash:h })
      setMsg({ text:`✅ 使徒 #${apo.id} 升星成功！${star}★ → ${star+1}★`, ok:true })
      // 刷新列表
      const newApos = myApos.map(a => a.id === apo.id ? { ...a, strength: Math.min(a.strength+15, 100) } : a)
      setMyApos(newApos.filter(x => getStar(x.strength) < 5))
    } catch(e) { setMsg({ text:'❌ '+(e.shortMessage||e.message), ok:false }) }
    finally { setBusy(false) }
  }

  return (
    <div className="up-section">
      <div className="up-section-title">🧙 使徒升星</div>
      <div className="up-desc">消耗与使徒同属性的元素 token 提升力量。每升一星力量+15，5星为满级。</div>
      <table className="up-cost-table"><thead><tr><th>星级</th><th>力量</th><th>消耗</th></tr></thead>
        <tbody>
          {[[1,'1-30',100],[2,'31-50',200],[3,'51-70',400],[4,'71-85',800]].map(([s,r,c])=>(
            <tr key={s}><td>{s}★</td><td>{r}</td><td>{c} 元素</td></tr>
          ))}
        </tbody>
      </table>
      {loading ? <div className="up-loading">扫描使徒中...</div> : myApos.length === 0 ? (
        <div className="up-empty">钱包中无可升星的使徒（5星已满级）</div>
      ) : (
        <div className="up-form">
          <div>
            <div className="up-label">选择使徒</div>
            <select className="up-select" value={selId} onChange={e => setSelId(e.target.value)}>
              {myApos.map(a => (
                <option key={a.id} value={String(a.id)}>
                  #{a.id} — {getStar(a.strength)}★ {ELEM_NAMES[a.element]}系 力量{a.strength}
                </option>
              ))}
            </select>
          </div>
          {apo && (
            <div className="up-info-grid">
              <div className="up-info-card"><div className="up-info-label">力量</div><div className="up-info-value" style={{color:'#c0a0ff'}}>{apo.strength}</div></div>
              <div className="up-info-card"><div className="up-info-label">星级</div><div className="up-info-value">{'★'.repeat(star)}</div></div>
              <div className="up-info-card"><div className="up-info-label">属性</div><div className="up-info-value" style={{color:ELEM_COLORS[apo.element]}}>{ELEM_NAMES[apo.element]}系</div></div>
              <div className="up-info-card"><div className="up-info-label">{ELEM_TOKENS[apo.element]} 余额</div><div className="up-info-value">{fmtR(elemBal)}</div></div>
              <div className="up-info-card"><div className="up-info-label">升星消耗</div><div className="up-info-value">{cost} {ELEM_TOKENS[apo.element]}</div></div>
            </div>
          )}
          {msg.text && <div className={`up-msg ${msg.ok?'ok':'err'}`}>{msg.text}</div>}
          <button className="up-btn up-btn-primary" onClick={doUpgrade} disabled={busy||!apo||!address}>
            {busy ? '处理中...' : `⬆️ 升星 (消耗 ${cost} ${apo?ELEM_TOKENS[apo.element]:'元素'})`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab 2：钻头合成 ───────────────────────────────────────────────────
function DrillMergeTab({ pc, address, wc }) {
  const [myDrills, setMyDrills] = useState([])  // [{id, tier, affinity}]
  const [selIds,   setSelIds]   = useState(['', '', ''])
  const [elemBal,  setElemBal]  = useState(0n)
  const [msg,      setMsg]      = useState({ text:'', ok:true })
  const [busy,     setBusy]     = useState(false)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!pc || !address) return
    setLoading(true)
    scanMyNFTs(pc, address, CONTRACTS.drill, DRL_ABI).then(async ids => {
      const attrRes = await pc.multicall({
        contracts: ids.map(id => ({ address:CONTRACTS.drill, abi:DRL_ABI, functionName:'attrs', args:[BigInt(id)] })),
        allowFailure: true
      })
      const list = ids.map((id, i) => {
        const a = attrRes[i]?.result
        return a ? { id, tier: Number(a[0]), affinity: Number(a[1]) } : null
      }).filter(Boolean).filter(x => x.tier < 5)  // 5星不能再合成
      setMyDrills(list)
    }).finally(() => setLoading(false))
  }, [pc, address])

  const drillData = selIds.map(sid => myDrills.find(d => String(d.id) === sid) || null)
  const allValid = drillData.every(Boolean) &&
    drillData[0].tier === drillData[1].tier && drillData[1].tier === drillData[2].tier &&
    drillData[0].affinity === drillData[1].affinity && drillData[1].affinity === drillData[2].affinity &&
    new Set(selIds).size === 3  // 三个不同的钻头

  const tier = drillData[0]?.tier || 0
  const aff  = drillData[0]?.affinity || 0
  const cost = allValid ? DRILL_COSTS[tier] : 0

  useEffect(() => {
    if (!allValid || !pc || !address) return
    pc.readContract({ address: ELEM_ADDRS()[aff], abi: ERC20_ABI, functionName: 'balanceOf', args: [address] })
      .then(b => setElemBal(b)).catch(() => setElemBal(0n))
  }, [allValid, aff, pc, address])

  // 按星级+属性分组，方便用户找到同类钻头
  const groupedOptions = (slotIdx) => {
    const otherSel = selIds.filter((_, i) => i !== slotIdx)
    return myDrills.filter(d => !otherSel.includes(String(d.id)))
  }

  async function doMerge() {
    if (!wc || !allValid) return
    const costWei = parseEther(String(cost))
    if (elemBal < costWei) { setMsg({ text:`元素不足！需要 ${cost}`, ok:false }); return }
    setBusy(true)
    try {
      const isAppr = await pc.readContract({ address:CONTRACTS.drill, abi:DRL_ABI, functionName:'isApprovedForAll', args:[address, UPGRADE_ADDR] })
      if (!isAppr) {
        setMsg({ text:'授权钻头...', ok:true })
        const h = await wc.sendTransaction({ to:CONTRACTS.drill, data:encodeFunctionData({ abi:DRL_ABI, functionName:'setApprovalForAll', args:[UPGRADE_ADDR, true] }) })
        await pc.waitForTransactionReceipt({ hash:h })
      }
      const elemAddr = ELEM_ADDRS()[aff]
      const allow = await pc.readContract({ address:elemAddr, abi:ERC20_ABI, functionName:'allowance', args:[address, UPGRADE_ADDR] })
      if (allow < costWei) {
        setMsg({ text:'授权元素...', ok:true })
        const h = await wc.sendTransaction({ to:elemAddr, data:encodeFunctionData({ abi:ERC20_ABI, functionName:'approve', args:[UPGRADE_ADDR, costWei*10n] }) })
        await pc.waitForTransactionReceipt({ hash:h })
      }
      setMsg({ text:'合成中...', ok:true })
      const ids = selIds.map(id => BigInt(id))
      const h = await wc.sendTransaction({ to:UPGRADE_ADDR, data:encodeFunctionData({ abi:UPGRADE_ABI, functionName:'mergedrills', args:[ids] }) })
      await pc.waitForTransactionReceipt({ hash:h })
      setMsg({ text:`✅ 合成成功！3个${tier}★ → 1个${tier+1}★钻头`, ok:true })
      // 移除已合成的钻头
      setMyDrills(prev => prev.filter(d => !selIds.includes(String(d.id))))
      setSelIds(['','',''])
    } catch(e) { setMsg({ text:'❌ '+(e.shortMessage||e.message), ok:false }) }
    finally { setBusy(false) }
  }

  return (
    <div className="up-section">
      <div className="up-section-title">⛏️ 钻头合成</div>
      <div className="up-desc">选3个相同星级+相同属性的钻头合成高一星。5星钻头产出加成×1.5。</div>
      <table className="up-cost-table"><thead><tr><th>目标</th><th>材料</th><th>消耗元素</th></tr></thead>
        <tbody>
          {[[2,1,300],[3,2,600],[4,3,1200],[5,4,2400]].map(([to,from,c])=>(
            <tr key={to}><td>{to}★</td><td>3个{from}★同属性</td><td>{c}</td></tr>
          ))}
        </tbody>
      </table>
      {loading ? <div className="up-loading">扫描钻头中...</div> : myDrills.length < 3 ? (
        <div className="up-empty">至少需要3个相同星级+属性的钻头才能合成</div>
      ) : (
        <div className="up-form">
          {[0,1,2].map(i => (
            <div key={i}>
              <div className="up-label">钻头 {i+1}</div>
              <select className="up-select" value={selIds[i]} onChange={e => {
                const ns = [...selIds]; ns[i] = e.target.value; setSelIds(ns)
              }}>
                <option value="">— 选择钻头 —</option>
                {groupedOptions(i).map(d => (
                  <option key={d.id} value={String(d.id)}>
                    #{d.id} — {'★'.repeat(d.tier)} {ELEM_NAMES[d.affinity]}系
                  </option>
                ))}
              </select>
            </div>
          ))}
          {allValid && (
            <div className="up-info-grid">
              <div className="up-info-card"><div className="up-info-label">合成目标</div><div className="up-info-value">{'★'.repeat(tier+1)} {ELEM_NAMES[aff]}系</div></div>
              <div className="up-info-card"><div className="up-info-label">消耗元素</div><div className="up-info-value">{cost} {ELEM_TOKENS[aff]}</div></div>
              <div className="up-info-card"><div className="up-info-label">元素余额</div><div className="up-info-value">{fmtR(elemBal)}</div></div>
            </div>
          )}
          {!allValid && selIds.some(s => s) && (
            <div className="up-msg err">3个钻头需星级相同、属性相同，且各不相同</div>
          )}
          {msg.text && <div className={`up-msg ${msg.ok?'ok':'err'}`}>{msg.text}</div>}
          <button className="up-btn up-btn-primary" onClick={doMerge} disabled={busy||!allValid||!address}>
            {busy ? '处理中...' : '🔨 合成升星'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Tab 3：地块充能 ───────────────────────────────────────────────────
function LandChargeTab({ pc, address, wc }) {
  const [myLands,  setMyLands]  = useState([])  // [{id, rates:[]}]
  const [selId,    setSelId]    = useState('')
  const [selElem,  setSelElem]  = useState(0)
  const [countdown,setCountdown]= useState(0n)
  const [elemBals, setElemBals] = useState([0n,0n,0n,0n,0n])
  const [msg,      setMsg]      = useState({ text:'', ok:true })
  const [busy,     setBusy]     = useState(false)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!pc || !address) return
    setLoading(true)
    // 扫描持有的土地
    const allIds = []
    for (let x = 0; x < 12; x++) for (let y = 0; y < 5; y++) allIds.push(x*100+y+1)
    pc.multicall({
      contracts: allIds.map(id => ({ address:CONTRACTS.land, abi:LAND_ABI, functionName:'ownerOf', args:[BigInt(id)] })),
      allowFailure: true
    }).then(async ownerRes => {
      const myIds = allIds.filter((_, i) => ownerRes[i]?.result?.toLowerCase() === address.toLowerCase())
      if (!myIds.length) { setMyLands([]); setLoading(false); return }
      // 批量读取属性
      const rateReqs = myIds.flatMap(id => [0,1,2,3,4].map(r => ({ address:CONTRACTS.land, abi:LAND_ABI, functionName:'getRate', args:[BigInt(id), r] })))
      const rateRes = await pc.multicall({ contracts: rateReqs, allowFailure: true })
      const list = myIds.map((id, i) => ({
        id, rates: [0,1,2,3,4].map(r => Number(rateRes[i*5+r]?.result ?? 0))
      }))
      setMyLands(list)
      if (list.length > 0 && !selId) setSelId(String(list[0].id))
    }).finally(() => setLoading(false))
  }, [pc, address])

  const land = myLands.find(l => String(l.id) === selId) || null

  useEffect(() => {
    if (!land || !pc || !address) return
    Promise.all([
      ...ELEM_ADDRS().map(a => pc.readContract({ address:a, abi:ERC20_ABI, functionName:'balanceOf', args:[address] }).catch(()=>0n)),
      pc.readContract({ address:UPGRADE_ADDR, abi:UPGRADE_ABI, functionName:'chargeCountdown', args:[BigInt(land.id)] }).catch(()=>0n)
    ]).then(res => {
      setElemBals(res.slice(0,5))
      setCountdown(res[5])
    })
  }, [land, pc, address])

  const currentRate = land?.rates[selElem] ?? 0
  const grade = getGrade(currentRate)
  const cost  = LAND_COSTS[Math.min(grade, 2)]

  async function doCharge() {
    if (!wc || !land) return
    if (countdown > 0n) { setMsg({ text:`冷却中，还需 ${Math.ceil(Number(countdown)/86400)} 天`, ok:false }); return }
    if (grade >= 3) { setMsg({ text:'该元素已达S级，无法充能', ok:false }); return }
    const costWei = parseEther(String(cost))
    if (elemBals[selElem] < costWei) { setMsg({ text:`${ELEM_TOKENS[selElem]} 不足！需要 ${cost}`, ok:false }); return }
    setBusy(true)
    try {
      const elemAddr = ELEM_ADDRS()[selElem]
      const allow = await pc.readContract({ address:elemAddr, abi:ERC20_ABI, functionName:'allowance', args:[address, UPGRADE_ADDR] })
      if (allow < costWei) {
        setMsg({ text:'授权元素...', ok:true })
        const h = await wc.sendTransaction({ to:elemAddr, data:encodeFunctionData({ abi:ERC20_ABI, functionName:'approve', args:[UPGRADE_ADDR, costWei*10n] }) })
        await pc.waitForTransactionReceipt({ hash:h })
      }
      const landAppr = await pc.readContract({ address:CONTRACTS.land, abi:LAND_ABI, functionName:'isApprovedForAll', args:[address, UPGRADE_ADDR] })
      if (!landAppr) {
        setMsg({ text:'授权土地...', ok:true })
        const h = await wc.sendTransaction({ to:CONTRACTS.land, data:encodeFunctionData({ abi:LAND_ABI, functionName:'setApprovalForAll', args:[UPGRADE_ADDR, true] }) })
        await pc.waitForTransactionReceipt({ hash:h })
      }
      setMsg({ text:'充能中...', ok:true })
      const h = await wc.sendTransaction({ to:UPGRADE_ADDR, data:encodeFunctionData({ abi:UPGRADE_ABI, functionName:'chargeLand', args:[BigInt(land.id), selElem] }) })
      await pc.waitForTransactionReceipt({ hash:h })
      setMsg({ text:`✅ 土地 #${land.id} ${ELEM_NAMES[selElem]}系 +20 充能成功！`, ok:true })
      setMyLands(prev => prev.map(l => l.id === land.id
        ? { ...l, rates: l.rates.map((r,i) => i===selElem ? r+20 : r) } : l))
    } catch(e) { setMsg({ text:'❌ '+(e.shortMessage||e.message), ok:false }) }
    finally { setBusy(false) }
  }

  return (
    <div className="up-section">
      <div className="up-section-title">🏡 地块充能</div>
      <div className="up-desc">消耗元素提升地块属性值 +20。每90天可充能一次。</div>
      <table className="up-cost-table"><thead><tr><th>等级</th><th>属性</th><th>消耗</th></tr></thead>
        <tbody>
          <tr><td>C→B</td><td>&lt;40</td><td>500 元素</td></tr>
          <tr><td>B→A</td><td>40-59</td><td>2,000 元素</td></tr>
          <tr><td>A→S</td><td>60-79</td><td>8,000 元素</td></tr>
        </tbody>
      </table>
      {loading ? <div className="up-loading">扫描地块中...</div> : myLands.length === 0 ? (
        <div className="up-empty">钱包中无地块</div>
      ) : (
        <div className="up-form">
          <div>
            <div className="up-label">选择地块</div>
            <select className="up-select" value={selId} onChange={e => setSelId(e.target.value)}>
              {myLands.map(l => (
                <option key={l.id} value={String(l.id)}>
                  #{l.id} — {[0,1,2,3,4].map(r=>`${['金','木','水','火','土'][r]}:${l.rates[r]}`).join(' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="up-label">选择充能元素</div>
            <div className="up-elem-btns">
              {ELEM_NAMES.map((n, i) => (
                <button key={i} className={`up-btn ${selElem===i?'up-btn-primary':'up-btn-secondary'}`}
                  style={{ borderColor: ELEM_COLORS[i]+'66' }}
                  onClick={() => setSelElem(i)}>
                  {n}系 {land ? land.rates[i] : ''}
                </button>
              ))}
            </div>
          </div>
          {land && (
            <div className="up-info-grid">
              <div className="up-info-card"><div className="up-info-label">当前属性</div><div className="up-info-value" style={{color:ELEM_COLORS[selElem]}}>{currentRate}</div></div>
              <div className="up-info-card"><div className="up-info-label">等级</div><div className="up-info-value">{GRADE_NAMES[grade]}</div></div>
              <div className="up-info-card"><div className="up-info-label">消耗元素</div><div className="up-info-value">{grade<3?cost:'MAX'}</div></div>
              <div className="up-info-card"><div className="up-info-label">{ELEM_TOKENS[selElem]} 余额</div><div className="up-info-value">{fmtR(elemBals[selElem])}</div></div>
              {countdown>0n && <div className="up-info-card"><div className="up-info-label">冷却剩余</div><div className="up-info-value" style={{color:'#f0c040'}}>{Math.ceil(Number(countdown)/86400)}天</div></div>}
            </div>
          )}
          {msg.text && <div className={`up-msg ${msg.ok?'ok':'err'}`}>{msg.text}</div>}
          <button className="up-btn up-btn-primary" onClick={doCharge}
            disabled={busy||!land||grade>=3||countdown>0n||!address}>
            {busy ? '处理中...' : `⚡ 充能 (${cost} ${ELEM_TOKENS[selElem]})`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────
const TABS = [
  { k:'apostle', label:'🧙 使徒升星' },
  { k:'drill',   label:'⛏️ 钻头合成' },
  { k:'land',    label:'🏡 地块充能' },
]

export default function UpgradePage() {
  const pc = usePublicClient()
  const { address } = useAccount()
  const { data: wc } = useWalletClient()
  const [tab, setTab] = useState('apostle')

  if (!address) return (
    <div style={{ padding:32, textAlign:'center', color:'#5040a0' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>请先连接钱包
    </div>
  )

  return (
    <div className="up-root">
      <div className="up-header">
        <h1 className="up-title">⬆️ 升级系统</h1>
        <p className="up-subtitle">从下拉列表选择你的 NFT 直接升级，无需输入 ID</p>
      </div>
      <div className="up-tabs">
        {TABS.map(t => (
          <button key={t.k} className={`up-tab${tab===t.k?' on':''}`} onClick={() => setTab(t.k)}>{t.label}</button>
        ))}
      </div>
      {tab==='apostle' && <ApostleUpgradeTab pc={pc} address={address} wc={wc} />}
      {tab==='drill'   && <DrillMergeTab    pc={pc} address={address} wc={wc} />}
      {tab==='land'    && <LandChargeTab    pc={pc} address={address} wc={wc} />}
    </div>
  )
}
