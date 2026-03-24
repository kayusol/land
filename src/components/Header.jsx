import React, { useState, useEffect } from 'react'
import { bscTestnet } from '../config/wagmi.js'

const BSC_HEX = '0x' + bscTestnet.id.toString(16)

function WalletBtn() {
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState('')
  const [pending, setPending] = useState(false)
  const short = a => a ? a.slice(0,6)+'…'+a.slice(-4) : ''

  useEffect(() => {
    const eth = window.ethereum; if (!eth) return
    eth.request({ method: 'eth_accounts' }).then(a => { if(a[0]) setAddress(a[0]) }).catch(()=>{})
    eth.request({ method: 'eth_chainId' }).then(id => setChainId(id)).catch(()=>{})
    const onAcc = a => setAddress(a[0]||'')
    const onChain = id => setChainId(id)
    eth.on('accountsChanged', onAcc); eth.on('chainChanged', onChain)
    return () => { eth.removeListener('accountsChanged', onAcc); eth.removeListener('chainChanged', onChain) }
  }, [])

  async function connect() {
    const eth = window.ethereum; if (!eth) { alert('请安装 MetaMask'); return }
    setPending(true)
    try {
      const a = await eth.request({ method: 'eth_requestAccounts' }); setAddress(a[0]||'')
      try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{chainId: BSC_HEX}] }) }
      catch(e) { if(e.code===4902) await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: BSC_HEX, chainName: 'BSC Testnet', nativeCurrency: {name:'BNB',symbol:'BNB',decimals:18}, rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'], blockExplorerUrls: ['https://testnet.bscscan.com'] }] }) }
      setChainId(await eth.request({ method: 'eth_chainId' }))
    } catch(e) { console.error(e) } finally { setPending(false) }
  }

  if (!address) return <button onClick={connect} disabled={pending} style={{padding:'5px 14px',borderRadius:4,border:'1px solid var(--primary)',background:'none',color:'var(--primary)',fontFamily:'inherit',fontSize:11,cursor:'pointer'}}>{pending?'连接中...':'连接钱包'}</button>
  if (chainId !== BSC_HEX) return <button onClick={async()=>{try{await window.ethereum?.request({method:'wallet_switchEthereumChain',params:[{chainId:BSC_HEX}]})}catch{}}} style={{padding:'5px 14px',borderRadius:4,border:'1px solid #f59e0b',background:'none',color:'#f59e0b',fontFamily:'inherit',fontSize:11,cursor:'pointer'}}>⚠ 切换BSC</button>
  return <button onClick={()=>setAddress('')} title="点击断开" style={{padding:'5px 14px',borderRadius:4,border:'1px solid var(--green)',background:'none',color:'var(--green)',fontFamily:'inherit',fontSize:11,cursor:'pointer'}}>{short(address)}</button>
}
  if (!isRight) return (
    <button onClick={()=>switchChain({chainId:bscTestnet.id})} style={{padding:'5px 14px',borderRadius:4,border:'1px solid #f59e0b',background:'none',color:'#f59e0b',fontFamily:'inherit',fontSize:11,cursor:'pointer'}}>
      ⚠ 切换BSC
    </button>
  )
  return (
    <button onClick={()=>disconnect()} title="点击断开" style={{padding:'5px 14px',borderRadius:4,border:'1px solid var(--green)',background:'none',color:'var(--green)',fontFamily:'inherit',fontSize:11,cursor:'pointer'}}>
      {short(address)}
    </button>
  )
}

export default function Header({ pages, current, onChange }) {
  return (
    <header style={{
      height:56, display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 20px', background:'rgba(2,4,8,0.95)',
      borderBottom:'1px solid var(--border)',
      backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:200,
    }}>
      {/* Logo */}
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{position:'relative'}}>
          <svg width="32" height="32" viewBox="0 0 32 32" style={{filter:'drop-shadow(0 0 6px rgba(0,255,136,0.5))'}}>
            <rect width="32" height="32" fill="var(--bg0)"/>
            <rect x="1" y="1" width="30" height="30" fill="none" stroke="var(--green3)" strokeWidth="0.5" opacity="0.5"/>
            <polygon points="16,4 24,9 24,23 16,28 8,23 8,9" fill="none" stroke="var(--green)" strokeWidth="1.5"/>
            <circle cx="16" cy="16" r="3" fill="var(--green)"/>
            {[0,1,2,3].map(i=>{
              const a=i*90*(Math.PI/180), x2=16+8*Math.cos(a), y2=16+8*Math.sin(a)
              return <line key={i} x1="16" y1="16" x2={x2} y2={y2} stroke="var(--green)" strokeWidth="0.8" opacity="0.4"/>
            })}
          </svg>
          <div className="blink" style={{position:'absolute',top:1,right:1,width:4,height:4,background:'var(--green)',opacity:0.8}} />
        </div>
        <div>
          <div style={{fontFamily:'var(--font-display)',fontSize:13,color:'var(--green)',letterSpacing:'0.15em',lineHeight:1.1}}>EVOLUTION LAND</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text2)',letterSpacing:'0.2em'}}>BSC_TESTNET :: V2.0</div>
        </div>
      </div>

      {/* Nav (center, desktop) */}
      <nav style={{display:'flex',gap:2,position:'absolute',left:'50%',transform:'translateX(-50%)'}} className="desktop-nav">
        {pages.map(p=>(
          <button key={p.id} onClick={()=>onChange(p.id)} style={{
            background:'none', border:'none',
            borderBottom:`2px solid ${current===p.id?'var(--green)':'transparent'}`,
            padding:'6px 14px', color:current===p.id?'var(--green)':'var(--text2)',
            fontFamily:'var(--font-display)', fontSize:9, letterSpacing:'0.12em', textTransform:'uppercase',
            cursor:'pointer', transition:'all 0.15s',
          }}>
            {p.icon} {p.label}
          </button>
        ))}
      </nav>

      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <WalletBtn />
      </div>
    </header>
  )
}
