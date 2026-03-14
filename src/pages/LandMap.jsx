import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RESOURCE_COLORS, RESOURCE_NAMES, RESOURCE_ICONS } from '../constants/contracts.js'

const GRID = 100, CELL = 8
const seed = (x,y,i) => (((x*137+y*97)*(3+i*4)+10*(i+1))%100)+5
const hex2r = (h,a) => { const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return `rgba(${r},${g},${b},${a})` }

export default function LandMap() {
  const cvs = useRef(null)
  const [zoom,setZoom] = useState(1)
  const [pan,setPan] = useState({x:0,y:0})
  const [drag,setDrag] = useState(null)
  const [moved,setMoved] = useState(false)
  const [sel,setSel] = useState(null)
  const allRates = useRef(null)
  if (!allRates.current) {
    const d={}
    for(let x=0;x<GRID;x++) for(let y=0;y<GRID;y++) d[x*100+y+1]=Array.from({length:5},(_,i)=>seed(x,y,i))
    allRates.current=d
  }

  const draw = useCallback(()=>{
    const c=cvs.current; if(!c) return
    const ctx=c.getContext('2d'), W=c.width, H=c.height
    ctx.clearRect(0,0,W,H)
    ctx.fillStyle='#020408'; ctx.fillRect(0,0,W,H)
    const cell=CELL*zoom, ox=pan.x+W/2-(GRID*cell)/2, oy=pan.y+H/2-(GRID*cell)/2
    for(let x=0;x<GRID;x++) for(let y=0;y<GRID;y++) {
      const cx=ox+x*cell, cy=oy+y*cell
      if(cx+cell<0||cy+cell<0||cx>W||cy>H) continue
      const rates=allRates.current[x*100+y+1]
      if(rates){ const mx=rates.indexOf(Math.max(...rates)); ctx.fillStyle=hex2r(RESOURCE_COLORS[mx],0.28); }
      else ctx.fillStyle='#0a0e18'
      ctx.fillRect(cx,cy,cell-0.5,cell-0.5)
      if(sel?.x===x&&sel?.y===y){ ctx.strokeStyle='#00ff88'; ctx.lineWidth=1.5; ctx.strokeRect(cx+0.5,cy+0.5,cell-1.5,cell-1.5); ctx.fillStyle='rgba(0,255,136,0.08)'; ctx.fillRect(cx,cy,cell,cell) }
    }
    // Grid lines
    if(zoom>1.8){
      ctx.strokeStyle='rgba(0,255,136,0.06)'; ctx.lineWidth=0.5
      for(let x=0;x<=GRID;x++){ctx.beginPath();ctx.moveTo(ox+x*cell,oy);ctx.lineTo(ox+x*cell,oy+GRID*cell);ctx.stroke()}
      for(let y=0;y<=GRID;y++){ctx.beginPath();ctx.moveTo(ox,oy+y*cell);ctx.lineTo(ox+GRID*cell,oy+y*cell);ctx.stroke()}
    }
    // Coord labels
    if(zoom>4){
      ctx.fillStyle='rgba(0,255,136,0.4)'; ctx.font=`${Math.min(cell*0.26,9)}px "Share Tech Mono",monospace`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      for(let x=0;x<GRID;x++) for(let y=0;y<GRID;y++){
        const cx=ox+x*cell,cy=oy+y*cell
        if(cx>W||cy>H||cx+cell<0||cy+cell<0) continue
        ctx.fillText(`${x},${y}`,cx+cell/2,cy+cell/2)
      }
    }
    // Border
    ctx.strokeStyle='rgba(0,255,136,0.25)'; ctx.lineWidth=1
    ctx.strokeRect(ox,oy,GRID*cell,GRID*cell)
    // Corner decorations
    const sz=8, corners=[[ox,oy],[ox+GRID*cell,oy],[ox,oy+GRID*cell],[ox+GRID*cell,oy+GRID*cell]]
    corners.forEach(([cx,cy])=>{ ctx.fillStyle='#00ff88'; ctx.fillRect(cx-1,cy-1,3,3) })
  },[zoom,pan,sel])

  useEffect(()=>{draw()},[draw])
  useEffect(()=>{
    const fn=()=>{ const c=cvs.current; if(!c) return; c.width=c.parentElement.offsetWidth; c.height=c.parentElement.offsetHeight; draw() }
    fn(); window.addEventListener('resize',fn); return()=>window.removeEventListener('resize',fn)
  },[draw])

  const toCell=(px,py)=>{
    const c=cvs.current; if(!c) return null
    const rect=c.getBoundingClientRect(), cell=CELL*zoom
    const ox=pan.x+c.width/2-(GRID*cell)/2, oy=pan.y+c.height/2-(GRID*cell)/2
    const gx=Math.floor((px-rect.left-ox)/cell), gy=Math.floor((py-rect.top-oy)/cell)
    return(gx<0||gx>=GRID||gy<0||gy>=GRID)?null:{x:gx,y:gy}
  }
  const onDown=(e)=>{setDrag({ox:e.clientX-pan.x,oy:e.clientY-pan.y});setMoved(false)}
  const onMove=(e)=>{
    if(!drag) return
    const dx=Math.abs(e.clientX-(drag.ox+pan.x)), dy=Math.abs(e.clientY-(drag.oy+pan.y))
    if(dx>3||dy>3) setMoved(true)
    setPan({x:e.clientX-drag.ox,y:e.clientY-drag.oy})
  }
  const onUp=(e)=>{
    if(drag&&!moved){ const cell=toCell(e.clientX,e.clientY); if(cell){ const id=cell.x*100+cell.y+1; setSel({...cell,id,rates:allRates.current[id]}) } }
    setDrag(null)
  }
  const onWheel=(e)=>{e.preventDefault();setZoom(z=>Math.max(0.5,Math.min(12,z*(e.deltaY<0?1.15:0.87))))}

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 110px)'}}>
      <div className="page-head">
        <div><div className="page-title">WORLD MAP</div><div className="page-sub">// 10000 PARCELS · 100×100 GRID · CLICK TO INSPECT</div></div>
        <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
          {RESOURCE_COLORS.map((c,i)=>(
            <span key={i} style={{display:'flex',alignItems:'center',gap:5,fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text2)'}}>
              <span style={{width:8,height:8,background:c,display:'inline-block',opacity:0.7}}/> {RESOURCE_NAMES[i].toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <div style={{flex:1,position:'relative',border:'1px solid var(--border)',overflow:'hidden',background:'#020408'}}>
        <canvas ref={cvs} style={{display:'block',width:'100%',height:'100%',cursor:drag?'crosshair':'default'}}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp} onWheel={onWheel}
        />

        {/* Status bar */}
        <div style={{position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center',gap:8,background:'rgba(2,4,8,0.9)',padding:'5px 14px',border:'1px solid var(--border)',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text2)'}}>
          <span className="blink" style={{width:4,height:4,background:'var(--green)',display:'inline-block'}} />
          PREVIEW MODE &nbsp;·&nbsp; DEPLOY CONTRACTS FOR LIVE DATA
        </div>

        {/* Zoom controls */}
        <div style={{position:'absolute',bottom:14,right:14,display:'flex',flexDirection:'column',gap:3}}>
          {[['+',()=>setZoom(z=>Math.min(12,z*1.3))],['−',()=>setZoom(z=>Math.max(0.5,z*0.77))],['⊡',()=>{setZoom(1);setPan({x:0,y:0})}]].map(([l,fn])=>(
            <button key={l} onClick={fn} className="btn" style={{width:28,height:28,padding:0,fontSize:l==='⊡'?10:16,justifyContent:'center',clipPath:'none'}}>{l}</button>
          ))}
          <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text2)',textAlign:'center',marginTop:3}}>{(zoom*100).toFixed(0)}%</div>
        </div>

        {/* Land inspector */}
        {sel&&(
          <div className="fade-up panel" style={{position:'absolute',bottom:14,left:14,padding:14,minWidth:190,background:'rgba(8,12,20,0.95)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--green)'}}>#{String(sel.id).padStart(5,'0')}</span>
              <button onClick={()=>setSel(null)} style={{background:'none',border:'none',color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font-mono)',fontSize:12}}>×</button>
            </div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text2)',marginBottom:10}}>COORD: ({sel.x}, {sel.y})</div>
            {sel.rates&&sel.rates.map((r,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                <span style={{fontSize:12,width:16}}>{['🪙','🌲','💧','🔥','⛰'][i]}</span>
                <div style={{flex:1,height:2,background:'var(--bg0)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(r/200)*100}%`,background:RESOURCE_COLORS[i]}} />
                </div>
                <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:RESOURCE_COLORS[i],minWidth:22,textAlign:'right'}}>{r}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
