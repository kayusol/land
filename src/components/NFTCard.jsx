import React from 'react'
import { RESOURCE_ICONS, RESOURCE_COLORS, RESOURCE_NAMES } from '../constants/contracts.js'

const base = {
  background:'var(--bg1)', border:'1px solid var(--border)',
  padding:14, cursor:'pointer', transition:'all 0.2s', position:'relative', overflow:'hidden',
  clipPath:'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
}

export function LandCard({ tokenId, x, y, rates, selected, onClick, children }) {
  return (
    <div style={{...base, borderColor:selected?'var(--green)':'var(--border)', boxShadow:selected?'0 0 20px rgba(0,255,136,0.15)':'none'}} onClick={onClick}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,var(--green3),transparent)'}} />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--green)'}}>#{String(tokenId).padStart(5,'0')}</span>
        <span className="tag tag-green">LAND</span>
      </div>
      {rates&&rates.map((r,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,marginBottom:5}}>
          <span style={{width:16,textAlign:'center'}}>{['🪙','🌲','💧','🔥','⛰'][i]}</span>
          <div style={{flex:1,height:2,background:'var(--bg0)',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${(r/200)*100}%`,background:RESOURCE_COLORS[i],transition:'width 0.3s'}} />
          </div>
          <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:RESOURCE_COLORS[i],minWidth:24,textAlign:'right'}}>{r}</span>
        </div>
      ))}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text2)'}}>({x},{y})</span>
        {children}
      </div>
    </div>
  )
}

export function DrillCard({ tokenId, tier, affinity, selected, onClick, children }) {
  return (
    <div style={{...base,borderColor:selected?'var(--cyan)':'var(--border)'}} onClick={onClick}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,var(--cyan2),transparent)'}} />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--cyan)'}}>#{String(tokenId).padStart(4,'0')}</span>
        <span className="tag tag-cyan">DRILL</span>
      </div>
      <div style={{textAlign:'center',padding:'10px 0'}}>
        <div style={{fontSize:32,lineHeight:1,filter:'drop-shadow(0 0 6px rgba(0,212,255,0.4))'}}>⛏</div>
        <div style={{fontFamily:'var(--font-mono)',fontSize:14,marginTop:8,letterSpacing:2}}>
          <span style={{color:'var(--gold)'}}>{Array(tier).fill('■').join('')}</span>
          <span style={{color:'var(--text3)'}}>{Array(5-tier).fill('□').join('')}</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginTop:8}}>
        {[['TIER',tier,'var(--gold)'],['AFF.',`${['🪙','🌲','💧','🔥','⛰'][affinity]}`,RESOURCE_COLORS[affinity]],['BOOST',`+${tier*20}%`,'var(--green)']].map(([l,v,c])=>(
          <div key={l} style={{textAlign:'center'}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text2)'}}>{l}</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,color:c,marginTop:2}}>{v}</div>
          </div>
        ))}
      </div>
      {children&&<div style={{marginTop:12}}>{children}</div>}
    </div>
  )
}

export function ApostleCard({ tokenId, strength, element, selected, onClick, children }) {
  const pct = strength
  return (
    <div style={{...base,borderColor:selected?'var(--gold)':'var(--border)'}} onClick={onClick}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,var(--gold2),transparent)'}} />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--gold)'}}>#{String(tokenId).padStart(4,'0')}</span>
        <span className="tag tag-gold">APOSTLE</span>
      </div>
      <div style={{textAlign:'center',padding:'10px 0'}}>
        <div style={{fontSize:32,lineHeight:1}}>🧙</div>
        <div style={{marginTop:8,padding:'0 16px'}}>
          <div style={{height:3,background:'var(--bg0)',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,var(--gold2),var(--gold))',transition:'width 0.3s'}} />
          </div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--gold)',marginTop:4,textAlign:'right'}}>{strength}/100</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginTop:6}}>
        {[['STR',strength,'var(--gold)'],['EL.',`${['🪙','🌲','💧','🔥','⛰'][element]}`,RESOURCE_COLORS[element]],['EFF',`${(strength/50*100).toFixed(0)}%`,'var(--cyan)']].map(([l,v,c])=>(
          <div key={l} style={{textAlign:'center'}}>
            <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text2)'}}>{l}</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,color:c,marginTop:2}}>{v}</div>
          </div>
        ))}
      </div>
      {children&&<div style={{marginTop:12}}>{children}</div>}
    </div>
  )
}
