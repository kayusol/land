import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useAccount, useWalletClient } from '../contexts/WalletContext.jsx'
import { useLang } from '../contexts/LangContext.jsx'
import { formatEther, encodeFunctionData, parseEther } from 'viem'
import { CONTRACTS } from '../constants/contracts'
import { ELEMS, landImgUrl } from '../constants/images'
import './RentalPage.css'

const RENTAL_ADDR = '0x7fb3cdf115552721b3f19f06592c07c83f6c7858'
const RING_ABI = [
  { type:'function', name:'balanceOf', inputs:[{name:'a',type:'address'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'allowance', inputs:[{name:'o',type:'address'},{name:'s',type:'address'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'approve', inputs:[{name:'s',type:'address'},{name:'a',type:'uint256'}], outputs:[{type:'bool'}], stateMutability:'nonpayable' },
]
const LAND_ABI = [
  { type:'function', name:'ownerOf', inputs:[{name:'id',type:'uint256'}], outputs:[{type:'address'}], stateMutability:'view' },
  { type:'function', name:'getRate', inputs:[{name:'id',type:'uint256'},{name:'res',type:'uint8'}], outputs:[{type:'uint16'}], stateMutability:'view' },
  { type:'function', name:'isApprovedForAll', inputs:[{name:'o',type:'address'},{name:'s',type:'address'}], outputs:[{type:'bool'}], stateMutability:'view' },
  { type:'function', name:'setApprovalForAll', inputs:[{name:'op',type:'address'},{name:'v',type:'bool'}], outputs:[], stateMutability:'nonpayable' },
]
const RENTAL_ABI = [
  { type:'function', name:'depositAmount', inputs:[], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'listForRent', inputs:[{name:'landId',type:'uint256'},{name:'listPrice',type:'uint256'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'unlist', inputs:[{name:'landId',type:'uint256'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'rent', inputs:[{name:'landId',type:'uint256'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'endRental', inputs:[{name:'landId',type:'uint256'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'expireRental', inputs:[{name:'landId',type:'uint256'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'listings', inputs:[{name:'landId',type:'uint256'}], outputs:[{name:'landOwner',type:'address'},{name:'listPrice',type:'uint256'},{name:'active',type:'bool'}], stateMutability:'view' },
  { type:'function', name:'getRental', inputs:[{name:'landId',type:'uint256'}], outputs:[{components:[{name:'tenant',type:'address'},{name:'landOwner',type:'address'},{name:'startTime',type:'uint256'},{name:'endTime',type:'uint256'},{name:'deposit',type:'uint256'}],type:'tuple'}], stateMutability:'view' },
  { type:'function', name:'timeRemaining', inputs:[{name:'landId',type:'uint256'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'getListedLands', inputs:[{name:'offset',type:'uint256'},{name:'limit',type:'uint256'}], outputs:[{name:'ids',type:'uint256[]'},{name:'info',type:'tuple[]'}], stateMutability:'view' },
]

const fmtR = (w, dp=2) => w ? Number(formatEther(w)).toFixed(dp) : '0'
const fmtDay = (s, lang) => {
  const d = Math.floor(Number(s) / 86400)
  const h = Math.floor((Number(s) % 86400) / 3600)
  return lang === 'zh'
    ? (d > 0 ? `${d}天${h}小时` : `${h}小时`)
    : (d > 0 ? `${d}d ${h}h` : `${h}h`)
}

function MarketTab({ pc, address, wc }) {
  const { t, lang } = useLang()
  const [listings, setListings] = useState([])
  const [deposit, setDeposit] = useState(50n * BigInt(1e18))
  const [ringBal, setRingBal] = useState(0n)
  const [msg, setMsg] = useState({ text: '', ok: true })
  const [busy, setBusy] = useState(null)

  const load = useCallback(async () => {
    if (!pc || !RENTAL_ADDR) return
    try {
      const dep = await pc.readContract({ address: RENTAL_ADDR, abi: RENTAL_ABI, functionName: 'depositAmount' }).catch(() => 50n * BigInt(1e18))
      setDeposit(dep)
      const [ids] = await pc.readContract({ address: RENTAL_ADDR, abi: RENTAL_ABI, functionName: 'getListedLands', args: [0n, 50n] }).catch(() => [[], []])
      if (!ids?.length) { setListings([]); return }
      const details = await Promise.all(ids.map(async id => {
        const [rates, rental, remaining] = await Promise.all([
          Promise.all([0,1,2,3,4].map(r => pc.readContract({ address: CONTRACTS.land, abi: LAND_ABI, functionName: 'getRate', args: [id, r] }).catch(() => 0))),
          pc.readContract({ address: RENTAL_ADDR, abi: RENTAL_ABI, functionName: 'getRental', args: [id] }).catch(() => null),
          pc.readContract({ address: RENTAL_ADDR, abi: RENTAL_ABI, functionName: 'timeRemaining', args: [id] }).catch(() => 0n),
        ])
        return { id: Number(id), rates: rates.map(Number), rental, remaining }
      }))
      setListings(details)
      if (address) {
        const bal = await pc.readContract({ address: CONTRACTS.ring, abi: RING_ABI, functionName: 'balanceOf', args: [address] }).catch(() => 0n)
        setRingBal(bal)
      }
    } catch (e) { console.error(e) }
  }, [pc, address])
  useEffect(() => { load() }, [load])

  async function doRent(landId) {
    if (!wc || !address) { setMsg({ text: t('请先连接钱包','Please connect wallet'), ok: false }); return }
    if (ringBal < deposit) { setMsg({ text: t(`RING 不足！需要 ${fmtR(deposit)} RING`,`Insufficient RING! Need ${fmtR(deposit)} RING`), ok: false }); return }
    setBusy(landId)
    try {
      const allow = await pc.readContract({ address: CONTRACTS.ring, abi: RING_ABI, functionName: 'allowance', args: [address, RENTAL_ADDR] })
      if (allow < deposit) {
        setMsg({ text: t('授权 RING...','Approving RING...'), ok: true })
        const h = await wc.sendTransaction({ to: CONTRACTS.ring, data: encodeFunctionData({ abi: RING_ABI, functionName: 'approve', args: [RENTAL_ADDR, deposit * 2n] }) })
        await pc.waitForTransactionReceipt({ hash: h })
      }
      setMsg({ text: t('租赁中...','Renting...'), ok: true })
      const h = await wc.sendTransaction({ to: RENTAL_ADDR, data: encodeFunctionData({ abi: RENTAL_ABI, functionName: 'rent', args: [BigInt(landId)] }) })
      await pc.waitForTransactionReceipt({ hash: h })
      setMsg({ text: t(`✅ 成功租赁土地 #${landId}！有效期90天`,`✅ Rented Land #${landId}! Valid 90 days`), ok: true })
      load()
    } catch (e) { setMsg({ text: '❌ ' + (e.shortMessage || e.message), ok: false }) }
    finally { setBusy(null) }
  }

  if (!RENTAL_ADDR) return (
    <div className="rp-empty">{t('租赁合约尚未部署','Rental contract not deployed')}<br/>
      <span style={{fontSize:'.75rem'}}>{t('管理员需先部署 LandRental.sol','Admin must deploy LandRental.sol first')}</span>
    </div>
  )

  return (
    <div>
      <div className="rp-section">
        <div className="rp-section-title">🏪 {t('可租赁地块','Available Lands')}</div>
        <div className="rp-desc">
          {t('缴纳','Pay')} <strong style={{color:'#c090ff'}}>{fmtR(deposit)} RING</strong> {t('押金 → 获得该地块3个月使用权','deposit → get 3-month usage rights')}
          · {t('挖矿产出','Mining output')} <strong style={{color:'#52c462'}}>70%</strong> {t('归你','to you')}
          · <strong style={{color:'#f0c040'}}>30%</strong> {t('归土地持有者','to land owner')}
          · {t('到期后押金返还（扣1 RING损耗费）','Deposit refunded on expiry (minus 1 RING fee)')}
        </div>
        {msg.text && <div className={`rp-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
        {address && <div style={{fontSize:'.75rem',color:'#5040a0',marginBottom:12}}>
          {t('你的 RING 余额：','Your RING balance:')}<span style={{color:'#c090ff'}}>{fmtR(ringBal)}</span>
        </div>}
      </div>
      {listings.length === 0 ? (
        <div className="rp-empty">{t('暂无可租赁地块','No lands available for rent')}</div>
      ) : (
        <div className="rp-grid">
          {listings.map(l => {
            const isRented = l.remaining > 0n
            const isMyRental = l.rental?.tenant?.toLowerCase() === address?.toLowerCase()
            return (
              <div key={l.id} className="rp-card">
                <img src={landImgUrl(l.id)} alt="land" style={{width:'100%',height:80,objectFit:'cover',borderRadius:8}}/>
                <div className="rp-card-title">{t('土地','Land')} #{l.id}</div>
                <div className="rp-card-info">
                  {l.rates.map((r, i) => r > 0 && (
                    <span key={i} style={{color: ELEMS[i].color, marginRight: 6}}>
                      {lang==='zh'?ELEMS[i].name:ELEMS[i].nameEn}: {r}
                    </span>
                  ))}
                </div>
                {isRented ? (
                  <>
                    <div className="rp-card-status rented">📌 {t('租用中','Rented')}</div>
                    <div className="rp-timer">⏱ {t('剩余','Remaining')} {fmtDay(l.remaining, lang)}</div>
                    {isMyRental && (
                      <button className="rp-btn rp-btn-danger" onClick={async () => {
                        const h = await wc.sendTransaction({ to: RENTAL_ADDR, data: encodeFunctionData({ abi: RENTAL_ABI, functionName: 'endRental', args: [BigInt(l.id)] }) })
                        await pc.waitForTransactionReceipt({ hash: h }); load()
                      }}>{t('提前结束（返还押金）','End Early (refund deposit)')}</button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="rp-card-status available">✅ {t('可租赁','Available')}</div>
                    <div style={{fontSize:'.72rem',color:'#4a3a7a'}}>{t('押金：','Deposit:')}{fmtR(deposit)} RING · {t('租期90天','90-day lease')}</div>
                    <button className="rp-btn rp-btn-primary" onClick={() => doRent(l.id)} disabled={busy === l.id || !address}>
                      {busy === l.id ? t('处理中...','Processing...') : `🏡 ${t('立即租赁','Rent Now')}`}
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MyListingsTab({ pc, address, wc }) {
  const { t } = useLang()
  const [landId, setLandId] = useState('')
  const [listPrice, setListPrice] = useState('0')
  const [msg, setMsg] = useState({ text: '', ok: true })
  const [busy, setBusy] = useState(false)

  async function doList() {
    if (!wc || !landId) { setMsg({ text: t('请输入土地ID','Enter land ID'), ok: false }); return }
    if (!RENTAL_ADDR) { setMsg({ text: t('租赁合约未部署','Rental contract not deployed'), ok: false }); return }
    setBusy(true)
    try {
      const id = BigInt(landId)
      const owner = await pc.readContract({ address: CONTRACTS.land, abi: LAND_ABI, functionName: 'ownerOf', args: [id] }).catch(() => null)
      if (!owner || owner.toLowerCase() !== address.toLowerCase()) { setMsg({ text: t('不是你的土地','Not your land'), ok: false }); setBusy(false); return }
      const isAppr = await pc.readContract({ address: CONTRACTS.land, abi: LAND_ABI, functionName: 'isApprovedForAll', args: [address, RENTAL_ADDR] })
      if (!isAppr) {
        setMsg({ text: t('授权土地合约...','Approving land contract...'), ok: true })
        const h = await wc.sendTransaction({ to: CONTRACTS.land, data: encodeFunctionData({ abi: LAND_ABI, functionName: 'setApprovalForAll', args: [RENTAL_ADDR, true] }) })
        await pc.waitForTransactionReceipt({ hash: h })
      }
      setMsg({ text: t('挂单中...','Listing...'), ok: true })
      const price = listPrice ? parseEther(listPrice) : 0n
      const h = await wc.sendTransaction({ to: RENTAL_ADDR, data: encodeFunctionData({ abi: RENTAL_ABI, functionName: 'listForRent', args: [id, price] }) })
      await pc.waitForTransactionReceipt({ hash: h })
      setMsg({ text: t(`✅ 土地 #${landId} 已挂出租赁！`,`✅ Land #${landId} listed for rent!`), ok: true })
      setLandId('')
    } catch (e) { setMsg({ text: '❌ ' + (e.shortMessage || e.message), ok: false }) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <div className="rp-section">
        <div className="rp-section-title">🏠 {t('挂出我的土地供租赁','List My Land for Rent')}</div>
        <div className="rp-desc">
          {t('挂出地块后你的土地将由租户使用，你获得：租户挖矿产出的','After listing, tenant uses your land. You earn:')} <strong style={{color:'#f0c040'}}>30%</strong> {t('+ 月租金（如设置）+ ','+ monthly rent (if set) + ')}
          <strong style={{color:'#c090ff'}}>1 RING</strong> {t('损耗费。土地在租期内无法取回，但租期结束后自动归还。','wear fee. Land locked during lease, auto-returned after expiry.')}
        </div>
        <div className="rp-form">
          <div>
            <div className="rp-label">{t('土地 ID','Land ID')}</div>
            <input className="rp-input" type="number" min="1" placeholder={t('输入你持有的土地ID','Enter your land ID')} value={landId} onChange={e => setLandId(e.target.value)} />
          </div>
          <div>
            <div className="rp-label">{t('月租金（RING，选填，0=仅靠产出分成）','Monthly rent (RING, optional, 0=output share only)')}</div>
            <input className="rp-input" type="number" min="0" step="0.1" placeholder="0" value={listPrice} onChange={e => setListPrice(e.target.value)} />
          </div>
          {msg.text && <div className={`rp-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
          <button className="rp-btn rp-btn-primary" onClick={doList} disabled={busy || !address || !landId}>
            {busy ? t('处理中...','Processing...') : `📋 ${t('挂出租赁','List for Rent')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RentalPage() {
  const pc = usePublicClient()
  const { address } = useAccount()
  const { data: wc } = useWalletClient()
  const { t } = useLang()
  const [tab, setTab] = useState('market')

  return (
    <div className="rp-root">
      <div className="rp-header">
        <h1 className="rp-title">🏘 {t('土地租赁市场','Land Rental Market')}</h1>
        <p className="rp-subtitle">{t('无需购买地块，缴押金即可挖矿 · 地主获得被动收入','No purchase needed — pay deposit to mine · Landowners earn passive income')}</p>
      </div>
      <div className="rp-tabs">
        <button className={`rp-tab${tab==='market'?' on':''}`} onClick={() => setTab('market')}>🏪 {t('可租地块','Available')}</button>
        <button className={`rp-tab${tab==='mylist'?' on':''}`} onClick={() => setTab('mylist')}>🏠 {t('挂出我的地块','List My Land')}</button>
      </div>
      {tab === 'market'  && <MarketTab     pc={pc} address={address} wc={wc} />}
      {tab === 'mylist'  && <MyListingsTab pc={pc} address={address} wc={wc} />}
    </div>
  )
}
