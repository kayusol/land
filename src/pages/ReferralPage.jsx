import { useEffect, useState, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from '../contexts/WalletContext.jsx'
import { useLang } from '../contexts/LangContext.jsx'
import { encodeFunctionData, formatEther } from 'viem'
import { CONTRACTS, RESOURCE_TOKENS, RESOURCE_ICONS } from '../constants/contracts'
import './ReferralPage.css'

const LEVEL_RATES  = ['5%', '3%', '2%', '1%', '0.5%']
const LEVEL_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32', '#60a5fa', '#a78bfa']
const RES_SYMS     = ['GOLD', 'WOOD', 'HHO', 'FIRE', 'SIOO']
const REF_ABI = [
  { type:'function', name:'bound',       inputs:[{name:'u',type:'address'}], outputs:[{type:'bool'}],      stateMutability:'view' },
  { type:'function', name:'referrer',    inputs:[{name:'u',type:'address'}], outputs:[{type:'address'}],   stateMutability:'view' },
  { type:'function', name:'getRates',    inputs:[],                          outputs:[{type:'uint256[5]'}], stateMutability:'view' },
  { type:'function', name:'totalEarned', inputs:[{name:'u',type:'address'},{name:'t',type:'address'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'bind',        inputs:[{name:'ref',type:'address'}], outputs:[], stateMutability:'nonpayable' },
]

export default function ReferralPage() {
  const {address,isConnected}=useAccount(), {data:wc}=useWalletClient(), pc=usePublicClient()
  const {t}=useLang()
  const [inputRef,setInputRef]=useState(''), [isBound,setIsBound]=useState(false)
  const [myRef,setMyRef]=useState(''), [rates,setRates]=useState([])
  const [earnings,setEarnings]=useState([]), [msg,setMsg]=useState('')
  const [busy,setBusy]=useState(false)

  const load=useCallback(async()=>{
    if(!address||!pc)return
    try{
      const [bound,referrer,ratesRaw]=await Promise.all([
        pc.readContract({address:CONTRACTS.referral,abi:REF_ABI,functionName:'bound',args:[address]}).catch(()=>false),
        pc.readContract({address:CONTRACTS.referral,abi:REF_ABI,functionName:'referrer',args:[address]}).catch(()=>''),
        pc.readContract({address:CONTRACTS.referral,abi:REF_ABI,functionName:'getRates'}).catch(()=>[]),
      ])
      setIsBound(bound);setMyRef(referrer);setRates(ratesRaw)
      const earns=await Promise.all(RESOURCE_TOKENS.map(addr=>pc.readContract({address:CONTRACTS.referral,abi:REF_ABI,functionName:'totalEarned',args:[address,addr]}).catch(()=>0n)))
      setEarnings(earns)
    }catch(e){console.error(e)}
  },[address,pc])
  useEffect(()=>{load()},[load])

  async function handleBind(){
    if(!inputRef?.startsWith('0x')||inputRef.length!==42){setMsg(t('❌ 请输入有效的 0x 地址','❌ Enter a valid 0x address'));return}
    if(!wc){setMsg(t('❌ 请先连接钱包','❌ Connect wallet first'));return}
    setBusy(true);setMsg(t('绑定中...','Binding...'))
    try{
      const h=await wc.sendTransaction({to:CONTRACTS.referral,data:encodeFunctionData({abi:REF_ABI,functionName:'bind',args:[inputRef]})})
      await pc.waitForTransactionReceipt({hash:h})
      setMsg(t('✅ 绑定成功！','✅ Bound successfully!'));setInputRef('');load()
    }catch(e){setMsg('❌ '+(e.shortMessage||e.message))}
    finally{setBusy(false)}
  }

  function copyLink(){
    navigator.clipboard.writeText(`${window.location.origin}?ref=${address}`)
      .then(()=>setMsg(t('✅ 邀请链接已复制！','✅ Link copied!')))
  }

  if(!isConnected)return(
    <div className="referral-page"><div className="connect-prompt">{t('请先连接钱包','Please connect wallet')}</div></div>
  )

  return(
    <div className="referral-page">
      <div className="ref-section">
        <h2>🤝 {t('邀请系统','Referral System')}</h2>
        <p className="ref-desc">{t('邀请好友游玩，他们挖矿时你自动获得收益（5级奖励链）','Invite friends — earn automatically when they mine (5-level chain)')}</p>
        <div className="ref-link-box">
          <input readOnly value={`${window.location.origin}?ref=${address}`} className="ref-link-input"/>
          <button className="copy-btn" onClick={copyLink}>📋 {t('复制','Copy')}</button>
        </div>
      </div>

      {msg&&(
        <div style={{margin:'0 0 12px',padding:'8px 16px',fontSize:'.82rem',borderRadius:8,
          color:msg.startsWith('✅')?'#52c462':'#f06070',background:'#0a0818',border:'1px solid #1a1040'}}>
          {msg}
        </div>
      )}

      {!isBound&&(
        <div className="ref-section">
          <h3>{t('绑定邀请人','Bind Referrer')}</h3>
          <div className="bind-row">
            <input className="ref-input" placeholder={t('输入邀请人钱包地址 0x...','Enter referrer wallet address 0x...')}
              value={inputRef} onChange={e=>setInputRef(e.target.value)}/>
            <button className="bind-btn" onClick={handleBind} disabled={busy}>
              {busy?t('处理中...','Processing...'):t('确认绑定','Confirm Bind')}
            </button>
          </div>
        </div>
      )}

      {isBound&&(
        <div className="ref-section bound-info">
          <h3>✅ {t('已绑定','Bound')}</h3>
          <p>{t('我的邀请人：','My Referrer:')}<code>{myRef?.slice(0,10)}…{myRef?.slice(-6)}</code></p>
        </div>
      )}

      <div className="ref-section">
        <h3>{t('奖励率','Reward Rates')}</h3>
        <div className="level-rates">
          {LEVEL_RATES.map((r,i)=>(
            <div key={i} className="level-rate-card" style={{borderLeft:`3px solid ${LEVEL_COLORS[i]}`}}>
              <span className="level-num">L{i+1}</span>
              <span className="level-rate">{rates[i]?(Number(rates[i])/100).toFixed(1)+'%':r}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ref-section">
        <h3>📊 {t('累计获得的邀请收益','Total Referral Earnings')}</h3>
        <div className="earnings-grid">
          {RES_SYMS.map((sym,i)=>(
            <div key={i} className="earning-card">
              <span className="earning-icon">{RESOURCE_ICONS[i]}</span>
              <span className="earning-sym">{sym}</span>
              <span className="earning-val">{parseFloat(formatEther(earnings[i]||0n)).toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
