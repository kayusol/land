import React from 'react'
import { useWallet } from '../contexts/WalletContext.jsx'
import './TopNav.css'

function WalletBtn() {
  const { address, isConnected, isCorrectChain, isPending, connectWallet, disconnectWallet } = useWallet()
  const short = a => a ? a.slice(0,6)+'…'+a.slice(-4) : ''

  async function handleSwitchChain() {
    try {
      await window.ethereum?.request({ method:'wallet_switchEthereumChain', params:[{chainId:'0x61'}] })
    } catch(e) {
      if (e.code === 4902) {
        await window.ethereum?.request({ method:'wallet_addEthereumChain', params:[{
          chainId:'0x61', chainName:'BSC Testnet',
          nativeCurrency:{name:'BNB',symbol:'BNB',decimals:18},
          rpcUrls:['https://bsc-testnet-rpc.publicnode.com'],
          blockExplorerUrls:['https://testnet.bscscan.com'],
        }]})
      }
    }
  }

  if (!isConnected) return (
    <button className="nav-connect-btn" onClick={connectWallet} disabled={isPending}>
      {isPending ? '连接中...' : '连接钱包'}
    </button>
  )
  if (!isCorrectChain) return (
    <button className="nav-connect-btn warn" onClick={handleSwitchChain}>⚠ 切换BSC</button>
  )
  return (
    <button className="nav-connect-btn connected" onClick={disconnectWallet} title="点击断开">
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
          <span className="nav-logo-main">哥伦布大陆</span>
          <span className="nav-logo-sub">COLUMBUS LAND</span>
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
      <div className="nav-right"><WalletBtn /></div>
    </nav>
  )
}
