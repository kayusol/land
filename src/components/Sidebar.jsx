import React from 'react'

export default function Sidebar({ pages, current, onChange }) {
  return (
    <aside style={{
      width:170, flexShrink:0, background:'rgba(8,12,20,0.7)',
      borderRight:'1px solid var(--border)',
      display:'flex', flexDirection:'column', padding:'14px 0',
      position:'sticky', top:56, height:'calc(100vh - 56px)',
      backdropFilter:'blur(8px)',
    }}>
      {/* Scan line decoration */}
      <div style={{position:'absolute',top:0,right:0,bottom:0,width:1,background:'linear-gradient(180deg,var(--green3),transparent 40%,transparent 60%,var(--green3))',opacity:0.3}} />

      <div style={{flex:1,display:'flex',flexDirection:'column',gap:2,padding:'0 8px'}}>
        {pages.map((p,i)=>{
          const active = current===p.id
          return (
            <button key={p.id} onClick={()=>onChange(p.id)} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
              background:active?'rgba(0,255,136,0.07)':'transparent',
              border:`1px solid ${active?'var(--border2)':'transparent'}`,
              color:active?'var(--green)':'var(--text2)',
              fontFamily:'var(--font-display)', fontSize:9, letterSpacing:'0.12em',
              textTransform:'uppercase', cursor:'pointer', transition:'all 0.15s',
              clipPath:active?'polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px))':'none',
              textAlign:'left', width:'100%',
            }}
            onMouseEnter={e=>{if(!active){e.currentTarget.style.color='var(--text1)';e.currentTarget.style.background='rgba(0,255,136,0.03)'}}}
            onMouseLeave={e=>{if(!active){e.currentTarget.style.color='var(--text2)';e.currentTarget.style.background='transparent'}}}
            >
              <span style={{fontSize:14,width:18,textAlign:'center',flexShrink:0}}>{p.icon}</span>
              <span style={{flex:1}}>{p.label}</span>
              {active&&<span className="blink" style={{width:4,height:4,background:'var(--green)',flexShrink:0}} />}
            </button>
          )
        })}
      </div>

      <div style={{padding:'12px 16px 6px',borderTop:'1px solid var(--border)'}}>
        <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text3)',letterSpacing:'0.1em'}}>// SYS: ONLINE</div>
        <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--green3)',letterSpacing:'0.1em',marginTop:3}}>{'> CHAIN: BSC_97'}</div>
      </div>
    </aside>
  )
}
