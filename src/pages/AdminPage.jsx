import React, { useState } from 'react'
import { useAccount, useWalletClient, usePublicClient } from '../contexts/WalletContext.jsx'
import { parseEther, encodeFunctionData } from 'viem'
import { CONTRACTS, NFT_AUCTION_ADDR, DEPLOYER } from '../constants/contracts'
import './AdminPage.css'

const sleep = ms => new Promise(r => setTimeout(r, ms))

const ABI = {
  apostleMint: [{ name:'mint', type:'function', stateMutability:'nonpayable', inputs:[{name:'to',type:'address'},{name:'strength',type:'uint8'},{name:'element',type:'uint8'}], outputs:[{type:'uint256'}] }],
  drillMint:   [{ name:'mint', type:'function', stateMutability:'nonpayable', inputs:[{name:'to',type:'address'},{name:'tier',type:'uint8'},{name:'affinity',type:'uint8'}], outputs:[{type:'uint256'}] }],
  erc20Mint:   [{ name:'mint', type:'function', stateMutability:'nonpayable', inputs:[{name:'to',type:'address'},{name:'amount',type:'uint256'}], outputs:[] }],
  erc20Bal:    [{ name:'balanceOf', type:'function', stateMutability:'view', inputs:[{name:'a',type:'address'}], outputs:[{type:'uint256'}] }],
  setApprAll:  [{ name:'setApprovalForAll', type:'function', stateMutability:'nonpayable', inputs:[{name:'operator',type:'address'},{name:'approved',type:'bool'}], outputs:[] }],
  isApprAll:   [{ name:'isApprovedForAll', type:'function', stateMutability:'view', inputs:[{name:'owner',type:'address'},{name:'operator',type:'address'}], outputs:[{type:'bool'}] }],
  setOperator: [{ name:'setOperator', type:'function', stateMutability:'nonpayable', inputs:[{name:'a',type:'address'},{name:'v',type:'bool'}], outputs:[] }],
  operators:   [{ name:'operators', type:'function', stateMutability:'view', inputs:[{name:'a',type:'address'}], outputs:[{type:'bool'}] }],
  startMining: [{ name:'startMining', type:'function', stateMutability:'nonpayable', inputs:[{name:'landId',type:'uint256'},{name:'apostleId',type:'uint256'},{name:'drillId',type:'uint256'}], outputs:[] }],
  nftAucCreate:[{ name:'createAuction', type:'function', stateMutability:'nonpayable', inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'},{name:'sp',type:'uint128'},{name:'ep',type:'uint128'},{name:'dur',type:'uint64'}], outputs:[] }],
  getAuction:  [{ name:'getAuction', type:'function', stateMutability:'view', inputs:[{name:'nft',type:'address'},{name:'id',type:'uint256'}], outputs:[{components:[{name:'nftContract',type:'address'},{name:'seller',type:'address'},{name:'startPrice',type:'uint128'},{name:'endPrice',type:'uint128'},{name:'duration',type:'uint64'},{name:'startedAt',type:'uint64'}],type:'tuple'}] }],
  pendingRew:  [{ name:'pendingRewards', type:'function', stateMutability:'view', inputs:[{name:'l',type:'uint256'}], outputs:[{type:'uint256[5]'}] }],
  nextId:      [{ name:'nextId', type:'function', stateMutability:'view', inputs:[], outputs:[{type:'uint256'}] }],
  ownerOf:     [{ name:'ownerOf', type:'function', stateMutability:'view', inputs:[{name:'id',type:'uint256'}], outputs:[{type:'address'}] }],
  slotCount:   [{ name:'slotCount', type:'function', stateMutability:'view', inputs:[{name:'landId',type:'uint256'}], outputs:[{type:'uint256'}] }],
  drillAttrs:  [{ name:'attrs', type:'function', stateMutability:'view', inputs:[{name:'id',type:'uint256'}], outputs:[{name:'tier',type:'uint8'},{name:'affinity',type:'uint8'}] }],
}

async function sendTx(wc, pc, to, abi, fn, args) {
  const data = encodeFunctionData({ abi, functionName: fn, args })
  for (let r = 0; r < 3; r++) {
    try {
      const gas = await pc.estimateGas({ account: wc.account, to, data }).catch(() => 500_000n)
      const hash = await wc.sendTransaction({ to, data, gas: gas * 130n / 100n })
      const receipt = await pc.waitForTransactionReceipt({ hash, timeout: 120_000 })
      if (receipt.status === 'reverted') throw new Error('reverted')
      await sleep(500)
      return hash
    } catch(e) {
      const m = (e.message || '').toLowerCase()
      if ((m.includes('rate') || m.includes('429') || m.includes('nonce')) && r < 2) { await sleep(3000*(r+1)); continue }
      throw e
    }
  }
}

export default function AdminPage() {
  const { address } = useAccount()
  const { data: wc } = useWalletClient()
  const pc = usePublicClient()
  const [logs, setLogs] = useState([])
  const [busy, setBusy] = useState(false)

  // 铸造参数
  const [mintCount, setMintCount] = useState({ apo: 5, drl: 5 })

  // 使徒挂单参数
  const [apoListCount, setApoListCount] = useState('10')
  const [apoStartPrice, setApoStartPrice] = useState('3')
  const [apoEndPrice, setApoEndPrice] = useState('0.5')

  // 钻头挂单参数（分星级定价）
  const [drlListCount, setDrlListCount] = useState('10')
  const [drlStartPrice, setDrlStartPrice] = useState('1')
  const [drlEndPrice, setDrlEndPrice] = useState('0.2')

  // 土地挂单参数
  const [landListCount, setLandListCount] = useState('10')
  const [landStartPrice, setLandStartPrice] = useState('10')
  const [landEndPrice, setLandEndPrice] = useState('1')

  const isAdmin = address?.toLowerCase() === DEPLOYER.toLowerCase()

  function log(msg, type = 'info') {
    setLogs(p => [...p, { msg, type, t: new Date().toLocaleTimeString() }])
    setTimeout(() => { const el = document.getElementById('alog'); if (el) el.scrollTop = el.scrollHeight }, 40)
  }

  // ── 铸造使徒 ─────────────────────────────────────────────────────
  async function mintApostles() {
    if (!wc) return; setBusy(true); setLogs([])
    try {
      const n = Number(mintCount.apo)
      log(`🧙 铸造 ${n} 个使徒...`)
      const startId = Number(await pc.readContract({ address: CONTRACTS.apostle, abi: ABI.nextId, functionName: 'nextId' }))
      for (let i = 0; i < n; i++) {
        const str = 30 + (i % 14) * 5
        const elem = i % 5
        await sendTx(wc, pc, CONTRACTS.apostle, ABI.apostleMint, 'mint', [address, str, elem])
        log(`  ✅ 使徒 #${startId+i} 力量${str} ${'金木水火土'[elem]}`, 'success')
      }
      log('🎉 铸造完成！', 'success')
    } catch(e) { log('❌ ' + (e.shortMessage || e.message), 'error') }
    setBusy(false)
  }

  // ── 铸造钻头 ─────────────────────────────────────────────────────
  async function mintDrills() {
    if (!wc) return; setBusy(true); setLogs([])
    try {
      const n = Number(mintCount.drl)
      log(`⛏️ 铸造 ${n} 个钻头...`)
      const startId = Number(await pc.readContract({ address: CONTRACTS.drill, abi: ABI.nextId, functionName: 'nextId' }))
      for (let i = 0; i < n; i++) {
        const tier = (i % 5) + 1
        const aff = i % 5
        await sendTx(wc, pc, CONTRACTS.drill, ABI.drillMint, 'mint', [address, tier, aff])
        log(`  ✅ 钻头 #${startId+i} ${'★'.repeat(tier)} ${'金木水火土'[aff]}`, 'success')
      }
      log('🎉 铸造完成！', 'success')
    } catch(e) { log('❌ ' + (e.shortMessage || e.message), 'error') }
    setBusy(false)
  }

  // ── 通用授权检查 ──────────────────────────────────────────────────
  async function ensureApproval(type) {
    if (type === 'apostle') {
      const op = await pc.readContract({ address: CONTRACTS.apostle, abi: ABI.operators, functionName: 'operators', args: [NFT_AUCTION_ADDR] }).catch(() => false)
      if (!op) { log('  授权 Apostle...'); await sendTx(wc, pc, CONTRACTS.apostle, ABI.setOperator, 'setOperator', [NFT_AUCTION_ADDR, true]) }
      else log('  ✅ Apostle 已授权', 'success')
    } else if (type === 'drill') {
      const op = await pc.readContract({ address: CONTRACTS.drill, abi: ABI.operators, functionName: 'operators', args: [NFT_AUCTION_ADDR] }).catch(() => false)
      if (!op) { log('  授权 Drill...'); await sendTx(wc, pc, CONTRACTS.drill, ABI.setOperator, 'setOperator', [NFT_AUCTION_ADDR, true]) }
      else log('  ✅ Drill 已授权', 'success')
    } else if (type === 'land') {
      const appr = await pc.readContract({ address: CONTRACTS.land, abi: ABI.isApprAll, functionName: 'isApprovedForAll', args: [address, NFT_AUCTION_ADDR] }).catch(() => false)
      if (!appr) { log('  授权 Land...'); await sendTx(wc, pc, CONTRACTS.land, ABI.setApprAll, 'setApprovalForAll', [NFT_AUCTION_ADDR, true]) }
      else log('  ✅ Land 已授权', 'success')
    }
  }

  // ── 批量挂使徒 ────────────────────────────────────────────────────
  async function listApostles() {
    if (!wc) return; setBusy(true); setLogs([])
    try {
      const n = Number(apoListCount) || 10
      const sp = parseEther(apoStartPrice || '3')
      const ep = parseEther(apoEndPrice || '0.5')
      log(`🧙 批量挂使徒 最多${n}个，起拍${apoStartPrice}→底价${apoEndPrice} RING`)
      await ensureApproval('apostle')
      const apoNext = Number(await pc.readContract({ address: CONTRACTS.apostle, abi: ABI.nextId, functionName: 'nextId' }))
      let listed = 0
      for (let id = 1; id < apoNext && listed < n; id++) {
        const owner = await pc.readContract({ address: CONTRACTS.apostle, abi: ABI.ownerOf, functionName: 'ownerOf', args: [BigInt(id)] }).catch(() => null)
        if (!owner || owner.toLowerCase() !== address.toLowerCase()) continue
        const existing = await pc.readContract({ address: NFT_AUCTION_ADDR, abi: ABI.getAuction, functionName: 'getAuction', args: [CONTRACTS.apostle, BigInt(id)] }).catch(() => null)
        if (existing?.startedAt > 0n) { log(`  ⏭ 使徒#${id} 已挂单`); continue }
        await sendTx(wc, pc, NFT_AUCTION_ADDR, ABI.nftAucCreate, 'createAuction', [CONTRACTS.apostle, BigInt(id), sp, ep, BigInt(3*24*3600)])
        log(`  ✅ 使徒 #${id} 起拍${apoStartPrice} RING`, 'success')
        listed++
      }
      log(`🎉 使徒挂单完成：${listed}个`, 'success')
    } catch(e) { log('❌ ' + (e.shortMessage || e.message), 'error') }
    setBusy(false)
  }

  // ── 批量挂钻头 ────────────────────────────────────────────────────
  async function listDrills() {
    if (!wc) return; setBusy(true); setLogs([])
    try {
      const n = Number(drlListCount) || 10
      log(`⛏️ 批量挂钻头 最多${n}个，起拍${drlStartPrice}→底价${drlEndPrice} RING`)
      await ensureApproval('drill')
      const drlNext = Number(await pc.readContract({ address: CONTRACTS.drill, abi: ABI.nextId, functionName: 'nextId' }))
      let listed = 0
      for (let id = 1; id < drlNext && listed < n; id++) {
        const owner = await pc.readContract({ address: CONTRACTS.drill, abi: ABI.ownerOf, functionName: 'ownerOf', args: [BigInt(id)] }).catch(() => null)
        if (!owner || owner.toLowerCase() !== address.toLowerCase()) continue
        const existing = await pc.readContract({ address: NFT_AUCTION_ADDR, abi: ABI.getAuction, functionName: 'getAuction', args: [CONTRACTS.drill, BigInt(id)] }).catch(() => null)
        if (existing?.startedAt > 0n) { log(`  ⏭ 钻头#${id} 已挂单`); continue }
        // 按星级动态定价
        const attrs = await pc.readContract({ address: CONTRACTS.drill, abi: ABI.drillAttrs, functionName: 'attrs', args: [BigInt(id)] }).catch(() => null)
        const tier = attrs ? Number(attrs[0]) : 1
        const tierMul = [0, 1, 2, 4, 8, 16][tier] || 1
        const sp = parseEther((parseFloat(drlStartPrice) * tierMul).toFixed(2))
        const ep = parseEther((parseFloat(drlEndPrice) * tierMul).toFixed(2))
        await sendTx(wc, pc, NFT_AUCTION_ADDR, ABI.nftAucCreate, 'createAuction', [CONTRACTS.drill, BigInt(id), sp, ep, BigInt(3*24*3600)])
        log(`  ✅ 钻头 #${id} ${'★'.repeat(tier)} 起拍${Number(sp)/1e18} RING`, 'success')
        listed++
      }
      log(`🎉 钻头挂单完成：${listed}个`, 'success')
    } catch(e) { log('❌ ' + (e.shortMessage || e.message), 'error') }
    setBusy(false)
  }

  // ── 批量挂土地 ────────────────────────────────────────────────────
  async function listLands() {
    if (!wc) return; setBusy(true); setLogs([])
    try {
      const n = Number(landListCount) || 10
      const sp = parseEther(landStartPrice || '10')
      const ep = parseEther(landEndPrice || '1')
      log(`🏡 批量挂土地 最多${n}块，起拍${landStartPrice}→底价${landEndPrice} RING`)
      await ensureApproval('land')
      let listed = 0
      for (let x = 0; x < 12 && listed < n; x++) {
        for (let y = 0; y < 5 && listed < n; y++) {
          const id = x*100+y+1
          const owner = await pc.readContract({ address: CONTRACTS.land, abi: ABI.ownerOf, functionName: 'ownerOf', args: [BigInt(id)] }).catch(() => null)
          if (!owner || owner.toLowerCase() !== address.toLowerCase()) continue
          const slots = Number(await pc.readContract({ address: CONTRACTS.mining, abi: ABI.slotCount, functionName: 'slotCount', args: [BigInt(id)] }).catch(() => 0n))
          if (slots > 0) { log(`  ⏭ 土地#${id} 挖矿中`); continue }
          const existing = await pc.readContract({ address: NFT_AUCTION_ADDR, abi: ABI.getAuction, functionName: 'getAuction', args: [CONTRACTS.land, BigInt(id)] }).catch(() => null)
          if (existing?.startedAt > 0n) { log(`  ⏭ 土地#${id} 已挂单`); continue }
          await sendTx(wc, pc, NFT_AUCTION_ADDR, ABI.nftAucCreate, 'createAuction', [CONTRACTS.land, BigInt(id), sp, ep, BigInt(3*24*3600)])
          log(`  ✅ 土地 #${id} 起拍${landStartPrice} RING`, 'success')
          listed++
        }
      }
      log(`🎉 土地挂单完成：${listed}块`, 'success')
    } catch(e) { log('❌ ' + (e.shortMessage || e.message), 'error') }
    setBusy(false)
  }

  // ── 充值奖励池 ────────────────────────────────────────────────────
  async function fundRewardPool() {
    if (!wc) return; setBusy(true); setLogs([])
    try {
      log('💰 检查挖矿奖励池...')
      const tokens = [
        {sym:'GOLD',addr:CONTRACTS.gold},{sym:'WOOD',addr:CONTRACTS.wood},
        {sym:'HHO',addr:CONTRACTS.water},{sym:'FIRE',addr:CONTRACTS.fire},{sym:'SIOO',addr:CONTRACTS.soil},
      ]
      const landIds = []; for(let x=0;x<12;x++) for(let y=0;y<5;y++) landIds.push(x*100+y+1)
      const totals = [0n,0n,0n,0n,0n]
      for(const id of landIds){
        try{ const r=await pc.readContract({address:CONTRACTS.mining,abi:ABI.pendingRew,functionName:'pendingRewards',args:[BigInt(id)]}); r.forEach((v,i)=>{totals[i]+=v}) }catch{}
      }
      log(`📊 总待领: ${tokens.map((t,i)=>`${t.sym}:${(Number(totals[i])/1e18).toFixed(0)}`).join(', ')}`)
      const MIN = parseEther('50000')
      for(let i=0;i<5;i++){
        const needed = totals[i]*2n + MIN
        const cur = await pc.readContract({address:tokens[i].addr,abi:ABI.erc20Bal,functionName:'balanceOf',args:[CONTRACTS.mining]}).catch(()=>0n)
        if(cur >= needed){ log(`  ✅ ${tokens[i].sym} 充足(${(Number(cur)/1e18).toFixed(0)})`, 'success'); continue }
        const amt = needed - cur
        log(`  🪙 Mint ${(Number(amt)/1e18).toFixed(0)} ${tokens[i].sym}...`)
        await sendTx(wc, pc, tokens[i].addr, ABI.erc20Mint, 'mint', [CONTRACTS.mining, amt])
        log(`  ✅ ${tokens[i].sym} 充值完成`, 'success')
      }
      log('🎉 奖励池充值完成！', 'success')
    } catch(e) { log('❌ ' + (e.shortMessage || e.message), 'error') }
    setBusy(false)
  }

  if (!address) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:12,color:'var(--text-dim)'}}>
      <div style={{fontSize:48,opacity:.3}}>🛠</div><p>请先连接钱包</p>
    </div>
  )
  if (!isAdmin) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:12}}>
      <div style={{fontSize:48,opacity:.3}}>🔒</div>
      <p style={{color:'var(--text-dim)'}}>仅管理员可访问</p>
    </div>
  )

  const inp = (v,set,placeholder,type='number') => (
    <input type={type} value={v} onChange={e=>set(e.target.value)} placeholder={placeholder}
      style={{width:'80px',background:'#0a0818',border:'1px solid #2a1a5a',borderRadius:6,color:'#c0b0e0',padding:'4px 8px',fontSize:'.82rem',textAlign:'center'}}/>
  )

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🛠 管理员工具</h1>
        <p style={{fontSize:'.75rem',color:'#52c462'}}>✅ {address?.slice(0,10)}…</p>
        <p style={{fontSize:'.68rem',color:'#5040a0'}}>手续费收款：拍卖4% + 挖矿地主费10% → 均进此钱包</p>
      </div>

      {/* 铸造 */}
      <div className="admin-section">
        <div className="admin-section-title">🎁 铸造 NFT</div>
        <div className="admin-grid">
          <div className="admin-card">
            <div className="ac-title">🧙 使徒</div>
            <div className="ac-desc">力量30-95，5元素循环</div>
            <div className="ac-row"><label>数量</label>{inp(mintCount.apo, v=>setMintCount(p=>({...p,apo:v})), '5')}</div>
            <button className="admin-btn-sm" onClick={mintApostles} disabled={busy}>铸造使徒</button>
          </div>
          <div className="admin-card">
            <div className="ac-title">⛏️ 钻头</div>
            <div className="ac-desc">1-5星，5元素亲和循环</div>
            <div className="ac-row"><label>数量</label>{inp(mintCount.drl, v=>setMintCount(p=>({...p,drl:v})), '5')}</div>
            <button className="admin-btn-sm" onClick={mintDrills} disabled={busy}>铸造钻头</button>
          </div>
        </div>
      </div>

      {/* 批量挂单 — 三个独立工具 */}
      <div className="admin-section">
        <div className="admin-section-title">🏛 批量挂单（各自独立操作）</div>
        <div className="admin-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))'}}>
          {/* 使徒挂单 */}
          <div className="admin-card">
            <div className="ac-title">🧙 批量挂使徒</div>
            <div className="ac-desc">自动跳过已挂单的</div>
            <div className="ac-row"><label>数量上限</label>{inp(apoListCount, setApoListCount, '10')}</div>
            <div className="ac-row"><label>起拍(RING)</label>{inp(apoStartPrice, setApoStartPrice, '3')}</div>
            <div className="ac-row"><label>底价(RING)</label>{inp(apoEndPrice, setApoEndPrice, '0.5')}</div>
            <button className="admin-btn-sm" onClick={listApostles} disabled={busy}>挂使徒</button>
          </div>

          {/* 钻头挂单 */}
          <div className="admin-card">
            <div className="ac-title">⛏️ 批量挂钻头</div>
            <div className="ac-desc">按星级自动倍增定价<br/>1★×1 2★×2 3★×4 4★×8 5★×16</div>
            <div className="ac-row"><label>数量上限</label>{inp(drlListCount, setDrlListCount, '10')}</div>
            <div className="ac-row"><label>1★起拍(RING)</label>{inp(drlStartPrice, setDrlStartPrice, '1')}</div>
            <div className="ac-row"><label>1★底价(RING)</label>{inp(drlEndPrice, setDrlEndPrice, '0.2')}</div>
            <button className="admin-btn-sm" onClick={listDrills} disabled={busy}>挂钻头</button>
          </div>

          {/* 土地挂单 */}
          <div className="admin-card">
            <div className="ac-title">🏡 批量挂土地</div>
            <div className="ac-desc">跳过挖矿中和已挂单的</div>
            <div className="ac-row"><label>数量上限</label>{inp(landListCount, setLandListCount, '10')}</div>
            <div className="ac-row"><label>起拍(RING)</label>{inp(landStartPrice, setLandStartPrice, '10')}</div>
            <div className="ac-row"><label>底价(RING)</label>{inp(landEndPrice, setLandEndPrice, '1')}</div>
            <button className="admin-btn-sm" onClick={listLands} disabled={busy}>挂土地</button>
          </div>

          {/* 充值奖励池 */}
          <div className="admin-card" style={{border:'1px solid #f0a04044'}}>
            <div className="ac-title" style={{color:'#f0c040'}}>💰 充值奖励池</div>
            <div className="ac-desc">Mint 资源 token 到 Mining 合约<br/>用户才能正常领取挖矿收益</div>
            <button className="admin-btn-sm" style={{background:'linear-gradient(135deg,#806010,#404000)'}}
              onClick={fundRewardPool} disabled={busy}>充值奖励池</button>
          </div>
        </div>
      </div>

      {/* 日志 */}
      {logs.length > 0 && (
        <div className="admin-log" id="alog">
          <div className="log-title">操作日志 ({logs.length})</div>
          {logs.map((l,i) => (
            <div key={i} className={`log-line log-${l.type}`}>
              <span className="log-t">{l.t}</span>
              <span>{l.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
