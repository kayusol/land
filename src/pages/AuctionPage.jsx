import React, { useState, useEffect } from 'react'
import { useAccount, usePublicClient, useWalletClient } from '../contexts/WalletContext.jsx'

import { formatEther, getContract, maxUint256 } from 'viem'
import { CONTRACTS, RES_EMOJIS, RES_COLORS, LAND_COLORS, isDeployed } from '../constants/contracts.js'
import { LAND_ABI, AUCTION_ABI, ERC20_ABI } from '../constants/abi.js'
import { useToast } from '../contexts/ToastContext.jsx'

function decodeRates(attr80) {
  const n = BigInt(attr80)
  return Array.from({length:5}, (_,i) => Number((n >> BigInt(i*16)) & 0xFFFFn))
}

// 仿原版市场 - 3D土地方块卡片
function LandCard3D({ item, onBid, txKey }) {
  const mt = item.rates.indexOf(Math.max(...item.rates))
  const tc = LAND_COLORS[mt]
  const isMine = useAccount().address?.toLowerCase() === item.seller.toLowerCase()
  const pct = (t, a) => Math.min(100, ((t - a.sa) / a.dur) * 100)
  const tick = Math.floor(Date.now()/1000)
  const rem = a => {
    const s = a.dur-(tick-a.sa); if(s<=0) return '已结束'
    const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60)
    return d>0?`${d}天${h}时`:h>0?`${h}时${m}分`:`${m}分钟`
  }

  return (
    <div style={{
      background:'#0f1929',
      border:'1px solid rgba(255,255,255,0.07)',
      borderRadius:12, overflow:'hidden',
      transition:'transform .2s, box-shadow .2s',
      cursor:'pointer',
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.45)'}}
    onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}
    >
      {/* 顶部坐标+编号 */}
      <div style={{display:'flex',justifyContent:'space-between',padding:'7px 12px',background:'rgba(0,0,0,0.2)'}}>
        <span style={{
          background:'#4ade80',color:'#0a1020',
          fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:20,
        }}>No. {item.id}</span>
        <span style={{fontSize:11,color:'#475569',fontFamily:'monospace'}}>
          {item.x},{item.y}
        </span>
      </div>

      {/* 3D土地方块图 (CSS模拟) */}
      <div style={{
        height:140, display:'flex',alignItems:'center',justifyContent:'center',
        background:`radial-gradient(ellipse at center, ${tc}18 0%, transparent 70%)`,
        position:'relative',
      }}>
        {/* 模拟原版橙色3D方块 */}
        <div style={{position:'relative',width:90,height:90}}>
          {/* 顶面 */}
          <div style={{
            position:'absolute',top:0,left:15,
            width:60,height:30,
            background:`linear-gradient(135deg, ${tc}dd, ${tc}88)`,
            transform:'skewX(-20deg)',
            borderRadius:'2px 8px 2px 2px',
          }}/>
          {/* 正面 */}
          <div style={{
            position:'absolute',top:28,left:0,
            width:60,height:55,
            background:`linear-gradient(180deg, ${tc}aa, ${tc}66)`,
            borderRadius:'0 0 4px 4px',
          }}/>
          {/* 右侧面 */}
          <div style={{
            position:'absolute',top:28,left:58,
            width:30,height:55,
            background:`linear-gradient(180deg, ${tc}77, ${tc}44)`,
            transform:'skewY(20deg)',
            borderRadius:'0 0 4px 0',
          }}/>
        </div>
      </div>

      {/* 价格+操作 */}
      <div style={{padding:'10px 14px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:8}}>
          <div>
            <div style={{fontSize:10,color:'#334155',marginBottom:2}}>⏱ {rem(item)}</div>
            <div style={{fontSize:20,fontWeight:800,color:'#fbbf24',fontFamily:'Rajdhani,monospace',lineHeight:1}}>
              {parseFloat(formatEther(item.price)).toFixed(2)}
            </div>
            <div style={{fontSize:10,color:'#334155'}}>RING</div>
          </div>
          {isMine ? (
            <span className="tag tag-green" style={{fontSize:10}}>我的上架</span>
          ) : (
            <button className="btn btn-primary btn-sm"
              onClick={()=>onBid(item)}
              disabled={!!txKey}
            >
              {txKey==='b'+item.id?<span className="spin-anim">◌</span>:null} 购买
            </button>
          )}
        </div>
        {/* 资源小条 */}
        <div style={{display:'flex',gap:3}}>
          {item.rates.map((r,i)=>(
            <div key={i} style={{
              flex:r, height:3,
              background:RES_COLORS[i],
              borderRadius:2,
              opacity:0.4+(r/255)*0.6,
            }}/>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AuctionPage() {
  const { address } = useAccount()
  const pub = usePublicClient()
  const { data: wal } = useWalletClient()
  const { toast } = useToast()
  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(false)
  const [txKey, setTxKey]   = useState('')
  const [tick, setTick]     = useState(Math.floor(Date.now()/1000))
  const [filterEl, setFilterEl] = useState('')
  const dep = isDeployed('auction')

  useEffect(()=>{
    const t=setInterval(()=>setTick(Math.floor(Date.now()/1000)),5000)
    return ()=>clearInterval(t)
  },[])

  const load = async () => {
    if (!pub||!dep) return
    setLoading(true)
    try {
      const aC = getContract({address:CONTRACTS.auction,abi:AUCTION_ABI,client:pub})
      const lC = getContract({address:CONTRACTS.land,abi:LAND_ABI,client:pub})
      const f   = await pub.createContractEventFilter({address:CONTRACTS.auction,abi:AUCTION_ABI,eventName:'AuctionCreated',fromBlock:0n})
      const evs = await pub.getFilterLogs({filter:f})
      const items = (await Promise.all(evs.map(async ev=>{
        const id=Number(ev.args.id)
        try {
          const a=await aC.read.auctions([BigInt(id)])
          if (!a.startedAt||a.startedAt===0n) return null
          const price=await aC.read.currentPrice([BigInt(id)])
          const [x,y]=await lC.read.decodeId([BigInt(id)])
          const attr=await lC.read.resourceAttr([BigInt(id)])
          return {id,x:Number(x),y:Number(y),seller:a.seller,sp:a.startPrice,ep:a.endPrice,dur:Number(a.duration),sa:Number(a.startedAt),price,rates:decodeRates(attr)}
        } catch {return null}
      }))).filter(Boolean).sort((a,b)=>b.sa-a.sa)
      setList(items)
    } catch(e){toast.err('加载失败',e.message?.slice(0,60))}
    finally {setLoading(false)}
  }
  useEffect(()=>{load()},[dep])

  const bid = async item => {
    if (!wal) {toast.err('请先连接钱包','');return}
    setTxKey('b'+item.id)
    try {
      const rc=getContract({address:CONTRACTS.ring,abi:ERC20_ABI,client:wal})
      const aC=getContract({address:CONTRACTS.auction,abi:AUCTION_ABI,client:wal})
      const allow=await pub.readContract({address:CONTRACTS.ring,abi:ERC20_ABI,functionName:'allowance',args:[address,CONTRACTS.auction]})
      if (allow<item.price) {
        const h=await rc.write.approve([CONTRACTS.auction,maxUint256])
        await pub.waitForTransactionReceipt({hash:h})
      }
      const h=await aC.write.bid([BigInt(item.id),item.price])
      await pub.waitForTransactionReceipt({hash:h})
      toast.ok('竞拍成功！',`地块 #${item.id} 已归您所有`)
      load()
    } catch(e){toast.err('竞拍失败',e.message?.slice(0,80))}
    finally {setTxKey('')}
  }

  const EL_FILTERS = ['全部','GOLD','WOOD','WATER','FIRE','SOIL']

  return (
    <div style={{height:'100%',display:'flex',overflow:'hidden',background:'linear-gradient(180deg,#0d1a2e 0%,#0a1020 100%)'}}>
      {/* 左侧筛选 */}
      <div style={{
        width:160,flexShrink:0,
        padding:'12px 14px',
        borderRight:'1px solid rgba(255,255,255,0.06)',
        background:'rgba(8,14,28,0.5)',
        overflowY:'auto',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <span style={{fontSize:12,color:'#94a3b8',fontWeight:600}}>筛选</span>
          <button className="btn btn-xs" style={{fontSize:10,padding:'2px 6px'}}>重置筛选项</button>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#475569',marginBottom:6,fontWeight:600}}>土地类型</div>
          {['普通','保留地','神秘地'].map(t=>(
            <label key={t} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,cursor:'pointer',fontSize:12,color:'#64748b'}}>
              <input type="radio" name="ltype" style={{accentColor:'#4ade80'}}/>{t}
            </label>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#475569',marginBottom:6,fontWeight:600}}>元素类型</div>
          {['GOLD','WOOD','WATER','FIRE','SOIL'].map(t=>(
            <label key={t} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,cursor:'pointer',fontSize:12,color:filterEl===t?'#4ade80':'#64748b'}}>
              <input type="radio" name="el" style={{accentColor:'#4ade80'}} onChange={()=>setFilterEl(t)}/>{t}
            </label>
          ))}
        </div>
        <div>
          <div style={{fontSize:11,color:'#475569',marginBottom:6,fontWeight:600}}>价格</div>
          <div style={{display:'flex',gap:4,alignItems:'center'}}>
            <input placeholder="最小" style={{width:50,padding:'3px 5px',fontSize:11,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:4,color:'#94a3b8'}}/>
            <span style={{color:'#334155'}}>→</span>
            <input placeholder="最大" style={{width:50,padding:'3px 5px',fontSize:11,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:4,color:'#94a3b8'}}/>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* 顶部 Tab+排序 */}
        <div style={{
          display:'flex',alignItems:'center',gap:6,
          padding:'8px 16px',
          borderBottom:'1px solid rgba(255,255,255,0.06)',
          flexShrink:0, flexWrap:'wrap',
        }}>
          {['全部','首售','转售'].map((t,i)=>(
            <button key={i} className={`tab-item${i===0?' active':''}`}>{t}</button>
          ))}
          <div style={{marginLeft:'auto',display:'flex',gap:8}}>
            <select className="btn btn-xs"><option>价格</option><option>时间</option><option>元素</option></select>
            <select className="btn btn-xs"><option>升序</option><option>降序</option></select>
            <button className="btn btn-xs" onClick={load} disabled={loading}>
              {loading?<span className="spin-anim">◌</span>:'↻'} 刷新
            </button>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
          {!dep ? (
            <div className="notice-bar"><span className="notice-icon">⚠</span>合约未部署，请填写 src/constants/contracts.js</div>
          ) : loading ? (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14}}>
              {[...Array(8)].map((_,i)=><div key={i} className="skeleton" style={{height:260}}/>)}
            </div>
          ) : list.length===0 ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:300,gap:12}}>
              <div style={{fontSize:56,opacity:0.18}}>🏛</div>
              <div style={{fontSize:14,color:'#475569'}}>暂无拍卖</div>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:14}}>
              {list.map(a=>(
                <LandCard3D key={a.id} item={a} onBid={bid} txKey={txKey}/>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
