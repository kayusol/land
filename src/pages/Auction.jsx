import React, { useState, useEffect } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { formatEther, parseEther, getContract, maxUint256 } from 'viem'
import { CONTRACTS, RESOURCE_COLORS, isDeployed } from '../constants/contracts.js'
import { LAND_ABI, AUCTION_ABI, ERC20_ABI } from '../constants/abi.js'
import { useToast } from '../contexts/ToastContext.jsx'

function decodeRates(attr80){
  const n=BigInt(attr80); return Array.from({length:5},(_,i)=>Number((n>>BigInt(i*16))&0xFFFFn))
}

export default function Auction() {
  const { address } = useAccount()
  const pub = usePublicClient()
  const { data:wal } = useWalletClient()
  const { toast } = useToast()
  const [list,setList]=useState([])
  const [loading,setLoading]=useState(false)
  const [txKey,setTxKey]=useState('')
  const [now,setNow]=useState(Math.floor(Date.now()/1000))
  const dep = isDeployed('auction')

  useEffect(()=>{const t=setInterval(()=>setNow(Math.floor(Date.now()/1000)),5000);return()=>clearInterval(t)},[]
  )

  const load = async()=>{
    if(!pub||!dep) return
    setLoading(true)
    try{
      const aC=getContract({address:CONTRACTS.auction,abi:AUCTION_ABI,client:pub})
      const lC=getContract({address:CONTRACTS.land,abi:LAND_ABI,client:pub})
      const f=await pub.createContractEventFilter({address:CONTRACTS.auction,abi:AUCTION_ABI,eventName:'AuctionCreated',fromBlock:0n})
      const evs=await pub.getFilterLogs({filter:f})
      const items=(await Promise.all(evs.map(async ev=>{
        const id=Number(ev.args.id)
        try{
          const a=await aC.read.auctions([id])
          if(a.startedAt===0n) return null
          const price=await aC.read.currentPrice([id])
          const [x,y]=await lC.read.decodeId([id])
          const attr=await lC.read.resourceAttr([id])
          return{id,x:Number(x),y:Number(y),seller:a.seller,sp:a.startPrice,ep:a.endPrice,dur:Number(a.duration),sa:Number(a.startedAt),price,rates:decodeRates(attr)}
        }catch{return null}
      }))).filter(Boolean).sort((a,b)=>b.sa-a.sa)
      setList(items)
    }catch(e){toast.err('Load Failed',e.message?.slice(0,80))}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[dep])

  const bid = async(item)=>{
    if(!wal){toast.err('Connect Wallet','');return}
    setTxKey('b'+item.id)
    try{
      const rc=getContract({address:CONTRACTS.ring,abi:ERC20_ABI,client:wal})
      const aC=getContract({address:CONTRACTS.auction,abi:AUCTION_ABI,client:wal})
      const allow=await pub.readContract({address:CONTRACTS.ring,abi:ERC20_ABI,functionName:'allowance',args:[address,CONTRACTS.auction]})
      if(allow<item.price){
        const h=await rc.write.approve([CONTRACTS.auction,maxUint256]); await pub.waitForTransactionReceipt({hash:h})
      }
      const h=await aC.write.bid([BigInt(item.id),item.price]); await pub.waitForTransactionReceipt({hash:h})
      toast.ok('Land Acquired!',`#${item.id} is now yours`); load()
    }catch(e){toast.err('Bid Failed',e.message?.slice(0,100))}
    finally{setTxKey('')}
  }

  const pct=a=>Math.min(100,((now-a.sa)/a.dur)*100)
  const rem=a=>{
    const s=a.dur-(now-a.sa); if(s<=0) return 'ENDED'
    const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60)
    return d>0?`${d}D ${h}H`:h>0?`${h}H ${m}M`:`${m}M`
  }

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">LAND AUCTION</div><div className="page-sub">// DUTCH AUCTION · PRICE DROPS OVER TIME · PAY IN RING</div></div>
        <button className="btn" onClick={load} disabled={loading}>{loading?<span className="spin">◌</span>:'↻'} REFRESH</button>
      </div>
      {!dep?(
        <div className="panel deploy-notice"><span className="tag tag-gold">⚠ NOT DEPLOYED</span><p>Fill contract addresses in <code>src/constants/contracts.js</code></p></div>
      ):loading?(
        <div className="grid-3">{Array.from({length:8}).map((_,i)=><div key={i} className="panel skeleton" style={{height:240}}/>)}</div>
      ):list.length===0?(
        <div className="empty-state"><div className="empty-icon">◉</div><h3>NO ACTIVE AUCTIONS</h3><p>// no lands listed for sale right now</p></div>
      ):(
        <div className="grid-3">
          {list.map(a=>(
            <div key={a.id} className="panel" style={{padding:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--green)'}}>#{String(a.id).padStart(5,'0')}</span>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text2)',marginLeft:8}}>({a.x},{a.y})</span>
                </div>
                <span className="tag tag-dim">{rem(a)}</span>
              </div>

              {/* Rates */}
              <div style={{marginBottom:12}}>
                {a.rates.map((r,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                    <span style={{fontSize:11,width:16}}>{['🪙','🌲','💧','🔥','⛰'][i]}</span>
                    <div style={{flex:1,height:2,background:'var(--bg0)',overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${(r/200)*100}%`,background:RESOURCE_COLORS[i]}}/>
                    </div>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:RESOURCE_COLORS[i],minWidth:22,textAlign:'right'}}>{r}</span>
                  </div>
                ))}
              </div>

              {/* Price track */}
              <div style={{marginBottom:12}}>
                <div style={{height:3,background:'var(--bg0)',position:'relative',overflow:'visible',marginBottom:6}}>
                  <div style={{position:'absolute',height:'100%',width:`${pct(a)}%`,background:'rgba(0,255,136,0.25)'}}/>
                  <div style={{position:'absolute',left:`${pct(a)}%`,top:'50%',transform:'translate(-50%,-50%)',width:7,height:7,background:'var(--green)',boxShadow:'0 0 6px var(--green)',transition:'left 0.5s'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text2)'}}>
                  <span>{parseFloat(formatEther(a.sp)).toFixed(1)} R</span>
                  <span>{parseFloat(formatEther(a.ep)).toFixed(1)} R</span>
                </div>
              </div>

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontFamily:'var(--font-display)',fontSize:18,color:'var(--gold)',letterSpacing:'0.05em'}}>{parseFloat(formatEther(a.price)).toFixed(2)}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text2)'}}>RING</div>
                </div>
                {address?.toLowerCase()!==a.seller.toLowerCase()&&(
                  <button className="btn btn-primary" style={{fontSize:10}} onClick={()=>bid(a)} disabled={!!txKey}>{txKey==='b'+a.id?<span className="spin">◌</span>:null} BUY</button>
                )}
                {address?.toLowerCase()===a.seller.toLowerCase()&&<span className="tag tag-cyan">YOUR LISTING</span>}
              </div>

              <div style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--text3)',marginTop:10,borderTop:'1px solid var(--border)',paddingTop:8}}>SELLER: {a.seller.slice(0,8)}...{a.seller.slice(-4)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
