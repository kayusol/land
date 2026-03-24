import React, { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { bscTestnet } from '../config/wagmi.js'
import './TopNav.css'

function WalletBtn() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const [showError, setShowError] = useState(false)
  const isRight = chainId === bscTestnet.id
  const short = a => a ? a.slice(0,6)+'…'+a.slice(-4) : ''

  async function handleConnect() {
    setShowError(false)
    // 优先 metaMask connector，其次 injected target=metaMask，最后通用 injected
    const order = ['metaMask', 'injected']
    const sorted = [...connectors].sort((a,b) => {
      const ai = order.indexOf(a.id), bi = order.indexOf(b.id)
      return (ai===-1?99:ai) - (bi===-1?99:bi)
    })
    const c = sorted[0]
    if (!c) { alert('未找到钱包，请安装 MetaMask'); return }
    try {
      connect({ connector: c, chainId: bscTestnet.id })
    } catch(e) {
      setShowError(true)
    }
  }

  if (!isConnected) return (
    <button className="nav-connect-btn" onClick={handleConnect} disabled={isPending}>
      {isPending ? '连接中...' : '连接钱包'}
    </button>
  )
  if (!isRight) return (
    <button className="nav-connect-btn warn" onClick={()=>switchChain({chainId:bscTestnet.id})}>
      ⚠ 切换BSC
    </button>
  )
  return (
    <button className="nav-connect-btn connected" onClick={()=>disconnect()} title="点击断开">
      {short(address)}
    </button>
  )
}

export default function TopNav({ pages, current, onChange }) {
  return (
    <nav className="top-nav">
      <div className="nav-logo">
        <div className="nav-logo-icon">🌐</div>
        <div className="nav-logo-text">
          <span className="nav-logo-main">进化星球</span>
          <span className="nav-logo-sub">BSC TESTNET</span>
        </div>
      </div>
      <div className="nav-links">
        {pages.map(p => (
          <button key={p.id} className={`nav-link${current===p.id?' active':''}`} onClick={()=>onChange(p.id)}>
            <span className="nl-icon">{p.icon}</span>
            <span className="nl-label">{p.zh}</span>
          </button>
        ))}
      </div>
      <div className="nav-right">
        <WalletBtn />
      </div>
    </nav>
  )
}
