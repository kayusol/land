// src/pages/ApostlePage.jsx — 使徒详情+繁殖系统
import { useState, useEffect, useCallback } from 'react'
import { usePublicClient, useAccount, useWalletClient } from '../contexts/WalletContext.jsx'
import { formatEther, encodeFunctionData } from 'viem'
import { CONTRACTS } from '../constants/contracts'
import { APO_EGG_GIF, ELEM_SVGS, ELEMS } from '../constants/images'
import './ApostlePage.css'

const APO_ABI = [
  {type:'function',name:'nextId',inputs:[],outputs:[{type:'uint256'}],stateMutability:'view'},
  {type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view'},
  {type:'function',name:'attrs',inputs:[{name:'id',type:'uint256'}],
    outputs:[
      {name:'strength',type:'uint8'},{name:'element',type:'uint8'},{name:'gender',type:'uint8'},
      {name:'gen',type:'uint16'},{name:'genes',type:'uint64'},{name:'birthTime',type:'uint64'},
      {name:'cooldown',type:'uint64'},{name:'motherId',type:'uint32'},{name:'fatherId',type:'uint32'}
    ],stateMutability:'view'},
  {type:'function',name:'isAdult',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'bool'}],stateMutability:'view'},
  {type:'function',name:'growthProgress',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'uint8'}],stateMutability:'view'},
  {type:'function',name:'breed',inputs:[{name:'maleId',type:'uint256'},{name:'femaleId',type:'uint256'}],outputs:[{type:'uint256'}],stateMutability:'nonpayable'},
  {type:'function',name:'breedFee',inputs:[],outputs:[{type:'uint256'}],stateMutability:'view'},
  {type:'function',name:'isApprovedForAll',inputs:[{name:'owner',type:'address'},{name:'op',type:'address'}],outputs:[{type:'bool'}],stateMutability:'view'},
  {type:'function',name:'setApprovalForAll',inputs:[{name:'op',type:'address'},{name:'v',type:'bool'}],outputs:[],stateMutability:'nonpayable'},
]
const ERC20_ABI=[{type:'function',name:'approve',inputs:[{name:'s',type:'address'},{name:'a',type:'uint256'}],outputs:[{type:'bool'}],stateMutability:'nonpayable'}]

const GENDER_ICON = ['♂️', '♀️']
const GENDER_NAME = ['雄', '雌']
const GENDER_COLOR = ['#60a0ff', '#ff80c0']

function fmtAddr(a) { return a ? a.slice(0,6)+'…'+a.slice(-4) : '' }
function fmtTime(ts) {
  const t = Number(ts); if(t===0) return '无'
  const d = new Date(t*1000)
  return d.toLocaleDateString('zh-CN')+' '+d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})
}
function timeLeft(ts) {
  const left = Number(ts)*1000 - Date.now(); if(left<=0) return null
  const h=Math.floor(left/3600000), m=Math.floor(left%3600000/60000)
  return h>0?`${h}h${m}m`:`${m}m`
}
function ElemIcon({i,size=14}){
  return <img src={ELEM_SVGS[i]} alt={ELEMS[i].name} style={{width:size,height:size,verticalAlign:'middle'}}/>
}

// ── 使徒卡片 ─────────────────────────────────────────────────────────────
function ApostleCard({apo, isMe, onBreed, onDetail}) {
  const adult = apo.isAdult
  const coolLeft = timeLeft(apo.cooldown)
  const inMining = apo.inMining
  const progress = apo.growth || 0
  return (
    <div className="ap-card" onClick={()=>onDetail&&onDetail(apo)}
      style={{borderColor: isMe?(adult?GENDER_COLOR[apo.gender]+'88':'#7040c088'):'#2a1a40'}}>
      <div className="ap-card-img-wrap" style={{background:`linear-gradient(135deg,${ELEMS[apo.element].color}22,#0a0814)`}}>
        <img src={APO_EGG_GIF} alt="apostle" className="ap-card-img"
          style={adult?{filter:`hue-rotate(${apo.element*72}deg) saturate(1.5)`}:{opacity:.7}}/>
        {!adult&&<div className="ap-growth-bar"><div style={{width:`${progress}%`,background:'#c090ff',height:'100%',borderRadius:2}}/></div>}
        <div className="ap-card-badge" style={{background:adult?GENDER_COLOR[apo.gender]+'cc':'#60408088'}}>
          {adult?GENDER_ICON[apo.gender]+GENDER_NAME[apo.gender]:`🥚 ${progress}%`}
        </div>
        {inMining&&<div className="ap-card-mining">⛏️</div>}
      </div>
      <div className="ap-card-body">
        <div className="ap-card-id">#{apo.id} <span className="ap-card-gen">G{apo.gen}</span></div>
        <div style={{fontSize:'.7rem',color:ELEMS[apo.element].color}}>
          <ElemIcon i={apo.element} size={11}/>{ELEMS[apo.element].name} · 力量{apo.strength}
        </div>
        {/* 所有者标识 — 核心改动：每张卡片都显示是谁的 */}
        {isMe
          ? <div style={{fontSize:'.62rem',color:'#52c462',marginTop:2}}>⭐ 我的</div>
          : <div style={{fontSize:'.62rem',color:'#5040a0',marginTop:2,fontFamily:'monospace'}}>{fmtAddr(apo.owner)}</div>
        }
        {coolLeft&&<div style={{fontSize:'.65rem',color:'#f0a040'}}>⏳ 冷却{coolLeft}</div>}
        {adult&&isMe&&!inMining&&!coolLeft&&(
          <button className="ap-breed-btn" onClick={e=>{e.stopPropagation();onBreed(apo)}}>💕 繁殖</button>
        )}
      </div>
    </div>
  )
}

// ── 繁殖弹窗 ─────────────────────────────────────────────────────────────
function BreedModal({myApo, onClose, apostles, pc, address, wc, onDone}) {
  const [partner, setPartner] = useState(null)
  const [msg, setMsg] = useState('')
  const [breedFee, setBreedFee] = useState(null)
  const isMale = myApo.gender === 0
  // 繁殖候选：只用自己的使徒配对
  const candidates = apostles.filter(a=>
    a.id!==myApo.id &&
    a.owner?.toLowerCase()===address?.toLowerCase() &&
    a.gender!==myApo.gender &&
    a.isAdult &&
    Number(a.cooldown)*1000<Date.now()
  )
  useEffect(()=>{
    if(!pc) return
    pc.readContract({address:CONTRACTS.apostle,abi:APO_ABI,functionName:'breedFee'})
      .then(f=>setBreedFee(f)).catch(()=>{})
  },[pc])
  async function doBreed() {
    if(!wc||!partner) return
    const maleId=isMale?myApo.id:partner.id, femaleId=isMale?partner.id:myApo.id
    setMsg('检查授权...')
    try{
      if(breedFee>0n){
        setMsg(`授权 ${formatEther(breedFee)} RING 繁殖费...`)
        const h=await wc.sendTransaction({to:CONTRACTS.ring,data:encodeFunctionData({abi:ERC20_ABI,functionName:'approve',args:[CONTRACTS.apostle,breedFee]})})
        await pc.waitForTransactionReceipt({hash:h})
      }
      setMsg('繁殖中...')
      const h=await wc.sendTransaction({to:CONTRACTS.apostle,data:encodeFunctionData({abi:APO_ABI,functionName:'breed',args:[BigInt(maleId),BigInt(femaleId)]})})
      await pc.waitForTransactionReceipt({hash:h})
      setMsg('🎉 繁殖成功！新使徒正在孵化...')
      setTimeout(()=>{onClose();onDone&&onDone()},2000)
    }catch(e){setMsg('❌ '+(e.shortMessage||e.message))}
  }
  return (
    <div className="ap-modal-bg" onClick={onClose}>
      <div className="ap-modal" onClick={e=>e.stopPropagation()}>
        <div className="ap-modal-head">
          <span>💕 繁殖 — {GENDER_ICON[myApo.gender]}{GENDER_NAME[myApo.gender]}使徒 #{myApo.id}</span>
          <button onClick={onClose}>✕</button>
        </div>
        {msg&&<div className="ap-modal-msg">{msg}</div>}
        {!partner?(
          <>
            <div style={{padding:'.6rem 1rem .3rem',fontSize:'.78rem',color:'#9070d0'}}>
              选择我的{isMale?'雌':'雄'}使徒配对（已成年、无冷却）：
            </div>
            {candidates.length===0
              ?<div style={{padding:'1.5rem',textAlign:'center',color:'#5040a0'}}>
                  暂无可配对的{isMale?'雌':'雄'}使徒<br/>
                  <span style={{fontSize:'.72rem'}}>需要已成年（孵化7天后）且无冷却期</span>
               </div>
              :<div className="ap-modal-grid">
                {candidates.map(a=>(
                  <div key={a.id} className="ap-modal-item" onClick={()=>setPartner(a)}>
                    <img src={APO_EGG_GIF} style={{width:38,height:38,filter:`hue-rotate(${a.element*72}deg) saturate(1.5)`}}/>
                    <div style={{fontSize:'.72rem',color:'#c090ff'}}>#{a.id} G{a.gen}</div>
                    <div style={{fontSize:'.65rem',color:ELEMS[a.element].color}}>
                      <ElemIcon i={a.element} size={11}/>{ELEMS[a.element].name} 力{a.strength}
                    </div>
                  </div>
                ))}
               </div>
            }
          </>
        ):(
          <div style={{padding:'1rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:'1.5rem',justifyContent:'center',marginBottom:'1rem'}}>
              <div style={{textAlign:'center'}}>
                <img src={APO_EGG_GIF} style={{width:56,height:56,filter:`hue-rotate(${myApo.element*72}deg) saturate(1.5)`}}/>
                <div style={{fontSize:'.75rem',color:'#c090ff'}}>#{myApo.id} {GENDER_ICON[myApo.gender]}</div>
                <div style={{fontSize:'.68rem',color:ELEMS[myApo.element].color}}>力{myApo.strength} G{myApo.gen}</div>
              </div>
              <div style={{fontSize:'1.5rem',color:'#c090ff'}}>💕</div>
              <div style={{textAlign:'center'}}>
                <img src={APO_EGG_GIF} style={{width:56,height:56,filter:`hue-rotate(${partner.element*72}deg) saturate(1.5)`}}/>
                <div style={{fontSize:'.75rem',color:'#c090ff'}}>#{partner.id} {GENDER_ICON[partner.gender]}</div>
                <div style={{fontSize:'.68rem',color:ELEMS[partner.element].color}}>力{partner.strength} G{partner.gen}</div>
              </div>
            </div>
            <div style={{background:'#16121e',borderRadius:10,padding:'.7rem',marginBottom:'1rem',fontSize:'.75rem',color:'#9080b0'}}>
              <div>后代代数：<b style={{color:'#c090ff'}}>G{Math.max(myApo.gen,partner.gen)+1}</b></div>
              <div>预计力量：<b style={{color:'#f0c040'}}>{Math.floor((myApo.strength+partner.strength)/2-15)} ~ {Math.min(Math.floor((myApo.strength+partner.strength)/2+15),100)}</b></div>
              <div>元素：<b style={{color:ELEMS[myApo.element].color}}>{ELEMS[myApo.element].name}</b> 或 <b style={{color:ELEMS[partner.element].color}}>{ELEMS[partner.element].name}</b></div>
              <div>繁殖费：<b style={{color:'#f0c040'}}>{breedFee?formatEther(breedFee):'1'} RING</b></div>
              <div style={{color:'#6050a0',marginTop:4}}>孵化期：7天后成年</div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="ap-btn-primary" onClick={doBreed}>✅ 确认繁殖</button>
              <button className="ap-btn-secondary" onClick={()=>setPartner(null)}>← 重选</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 主页面 ─────────────────────────────────────────────────────────────
export default function ApostlePage() {
  const pc=usePublicClient(), {address}=useAccount(), {data:wc}=useWalletClient()
  const [apostles, setApostles] = useState([])
  const [loading,  setLoading]  = useState(true)
  // 默认显示「我的」；未连接钱包自动切回「全部」
  const [filter,   setFilter]   = useState('mine')
  const [breedApo, setBreedApo] = useState(null)
  const [detailApo,setDetailApo]= useState(null)

  useEffect(()=>{ setFilter(address?'mine':'all') },[address])

  const load = useCallback(async()=>{
    if(!pc){setLoading(false);return}
    setLoading(true)
    try{
      const nextId = await pc.readContract({address:CONTRACTS.apostle,abi:APO_ABI,functionName:'nextId'})
      const total = Number(nextId)-1
      if(total<=0){setApostles([]);setLoading(false);return}
      const BATCH=50, items=[]
      for(let s=1;s<=total;s+=BATCH){
        const ids=Array.from({length:Math.min(BATCH,total-s+1)},(_,i)=>s+i)
        const [attrRes,ownerRes,adultRes,growthRes]=await Promise.all([
          pc.multicall({contracts:ids.map(id=>({address:CONTRACTS.apostle,abi:APO_ABI,functionName:'attrs',args:[BigInt(id)]})),allowFailure:true}),
          pc.multicall({contracts:ids.map(id=>({address:CONTRACTS.apostle,abi:[{type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view'}],functionName:'ownerOf',args:[BigInt(id)]})),allowFailure:true}),
          pc.multicall({contracts:ids.map(id=>({address:CONTRACTS.apostle,abi:APO_ABI,functionName:'isAdult',args:[BigInt(id)]})),allowFailure:true}),
          pc.multicall({contracts:ids.map(id=>({address:CONTRACTS.apostle,abi:APO_ABI,functionName:'growthProgress',args:[BigInt(id)]})),allowFailure:true}),
        ])
        ids.forEach((id,i)=>{
          const a=attrRes[i]?.result; if(!a) return
          const owner=ownerRes[i]?.result
          const inMining=owner?.toLowerCase()===CONTRACTS.mining.toLowerCase()
          items.push({
            id, owner,
            strength:Number(a[0]), element:Number(a[1]), gender:Number(a[2]),
            gen:Number(a[3]), genes:a[4], birthTime:a[5], cooldown:a[6],
            motherId:Number(a[7]), fatherId:Number(a[8]),
            isAdult:adultRes[i]?.result??false,
            growth:Number(growthRes[i]?.result??0),
            inMining, landId:0n,
            isMe:owner?.toLowerCase()===address?.toLowerCase()||inMining,
          })
        })
      }
      setApostles(items)
    }catch(e){console.error(e)}
    setLoading(false)
  },[pc,address])
  useEffect(()=>{load()},[load])

  const filtered = apostles.filter(a=>{
    if(filter==='mine')   return a.owner?.toLowerCase()===address?.toLowerCase()||a.inMining
    if(filter==='male')   return a.gender===0&&a.isAdult
    if(filter==='female') return a.gender===1&&a.isAdult
    if(filter==='egg')    return !a.isAdult
    if(filter==='adult')  return a.isAdult
    return true
  })
  const myCount=apostles.filter(a=>a.isMe).length

  return (
    <div className="ap-root">
      <div className="ap-header">
        <h1 className="ap-title">🧙 使徒</h1>
        <div className="ap-stats">
          <span className="ap-stat-tag" style={{color:'#f0c040'}}>总计: {apostles.length}</span>
          {address&&<span className="ap-stat-tag" style={{color:'#52c462'}}>我的: {myCount}</span>}
          <span className="ap-stat-tag" style={{color:'#52c462'}}>成体: {apostles.filter(a=>a.isAdult).length}</span>
          <span className="ap-stat-tag" style={{color:'#c090ff'}}>孵化中: {apostles.filter(a=>!a.isAdult).length}</span>
        </div>
      </div>
      <div className="ap-info-card">
        <div className="ap-info-row">
          <span>🥚 铸造后孵化</span><span>→</span>
          <span>⏳ 7天成年</span><span>→</span>
          <span>💕 雄♂+雌♀繁殖</span><span>→</span>
          <span>🧬 后代代数+1</span>
        </div>
        <div style={{fontSize:'.72rem',color:'#4030a0',marginTop:6,textAlign:'center'}}>
          使徒大厅显示链上所有使徒 · 绿色「⭐ 我的」= 属于当前钱包 · 默认显示我的
        </div>
      </div>
      <div className="ap-filters">
        {[['mine','⭐ 我的'],['all','全部'],['adult','已成体'],['egg','孵化中'],['male','♂ 雄'],['female','♀ 雌']].map(([v,l])=>(
          <button key={v} className={`ap-filter-btn${filter===v?' on':''}`} onClick={()=>setFilter(v)}>{l}</button>
        ))}
        <button className="ap-filter-btn" style={{marginLeft:'auto'}} onClick={load}>🔄</button>
      </div>
      {filter==='mine'&&!address&&(
        <div style={{textAlign:'center',color:'#5040a0',padding:'2rem',fontSize:'.85rem'}}>请先连接钱包查看你的使徒</div>
      )}
      {loading
        ?<div className="ap-loading"><span className="ap-spin"/>加载中...</div>
        :filtered.length===0
          ?<div className="ap-empty">{filter==='mine'&&address?'你还没有使徒，去盲盒页购买吧':'暂无使徒'}</div>
          :<div className="ap-grid">
            {filtered.map(a=>(
              <ApostleCard key={a.id} apo={a} isMe={a.isMe}
                onBreed={()=>setBreedApo(a)} onDetail={setDetailApo}/>
            ))}
           </div>
      }
      {detailApo&&(
        <div className="ap-modal-bg" onClick={()=>setDetailApo(null)}>
          <div className="ap-modal" onClick={e=>e.stopPropagation()}>
            <div className="ap-modal-head">
              <span>使徒 #{detailApo.id}</span>
              <button onClick={()=>setDetailApo(null)}>✕</button>
            </div>
            <div style={{padding:'1rem',display:'flex',gap:'1rem'}}>
              <img src={APO_EGG_GIF} style={{width:90,height:90,filter:`hue-rotate(${detailApo.element*72}deg) saturate(1.5)`,borderRadius:10}}/>
              <div style={{flex:1,display:'flex',flexDirection:'column',gap:6,fontSize:'.78rem',color:'#9080b0'}}>
                <div><b style={{color:'#c090ff'}}>#{detailApo.id}</b> — G{detailApo.gen} 代</div>
                <div>{GENDER_ICON[detailApo.gender]} {GENDER_NAME[detailApo.gender]} · <ElemIcon i={detailApo.element} size={12}/>{ELEMS[detailApo.element].name}系 · 力量{detailApo.strength}</div>
                <div style={{color:detailApo.isAdult?'#52c462':'#c090ff'}}>
                  {detailApo.isAdult?'✅ 已成年':'🥚 孵化中 '+detailApo.growth+'%'}
                </div>
                <div>持有者：<span style={{fontFamily:'monospace',fontSize:'.72rem',color:detailApo.isMe?'#52c462':'#7060a0'}}>
                  {detailApo.isMe?'⭐ 我的':fmtAddr(detailApo.owner)}
                </span></div>
                <div>生日：{fmtTime(detailApo.birthTime)}</div>
                {Number(detailApo.cooldown)*1000>Date.now()&&(
                  <div style={{color:'#f0a040'}}>⏳ 繁殖冷却：{timeLeft(detailApo.cooldown)}</div>
                )}
                {detailApo.motherId>0&&<div>母亲：使徒 #{detailApo.motherId}</div>}
                {detailApo.fatherId>0&&<div>父亲：使徒 #{detailApo.fatherId}</div>}
                <div style={{color:'#4030a0',fontSize:'.65rem'}}>基因：0x{BigInt(detailApo.genes).toString(16).padStart(16,'0')}</div>
              </div>
            </div>
            {detailApo.isAdult&&detailApo.isMe&&Number(detailApo.cooldown)*1000<Date.now()&&(
              <div style={{padding:'0 1rem 1rem'}}>
                <button className="ap-btn-primary" style={{width:'100%'}}
                  onClick={()=>{setDetailApo(null);setBreedApo(detailApo)}}>💕 去繁殖</button>
              </div>
            )}
          </div>
        </div>
      )}
      {breedApo&&(
        <BreedModal myApo={breedApo} apostles={apostles}
          onClose={()=>setBreedApo(null)} pc={pc} address={address} wc={wc} onDone={load}/>
      )}
    </div>
  )
}
