import React from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'

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

      {/* RainbowKit connect */}
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus={{ smallScreen:'avatar', largeScreen:'full' }}
        />
      </div>
    </header>
  )
}
