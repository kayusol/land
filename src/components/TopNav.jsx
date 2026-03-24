import React from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { bscTestnet } from '../config/wagmi.js'
import './TopNav.css'

function WalletBtn() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const isRight = chainId === bscTestnet.id
  const short = a => a ? a.slice(0,6)+'…'+a.slice(-4) : ''

  if (!isConnected) return (
    <button className="nav-connect-btn" onClick={()=>connect({connector:connectors[0]})}>
      连接钱包
    </button>
  )
  if (!isRight) return (
    <button className="nav-connect-btn warn" onClick={()=>switchChain({chainId:bscTestnet.id})}>
      ⚠ 切换到BSC
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
          <button
            key={p.id}
            className={`nav-link${current === p.id ? ' active' : ''}`}
            onClick={() => onChange(p.id)}
          >
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
