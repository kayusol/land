import React, { useState, useEffect } from 'react'
import './TopNav.css'

const BSC_TESTNET = {
  chainId: '0x61',
  chainName: 'BSC Testnet',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'],
  blockExplorerUrls: ['https://testnet.bscscan.com'],
}

function WalletBtn() {
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState('')
  const [pending, setPending] = useState(false)
  const short = a => a ? a.slice(0,6)+'…'+a.slice(-4) : ''
  const isRight = chainId === '0x61'

  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return
    // 恢复已连接状态
    eth.request({ method: 'eth_accounts' }).then(acc => {
      if (acc[0]) setAddress(acc[0])
    }).catch(() => {})
    eth.request({ method: 'eth_chainId' }).then(id => setChainId(id)).catch(() => {})
    const onAccounts = accs => setAddress(accs[0] || '')
    const onChain = id => setChainId(id)
    eth.on('accountsChanged', onAccounts)
    eth.on('chainChanged', onChain)
    return () => { eth.removeListener('accountsChanged', onAccounts); eth.removeListener('chainChanged', onChain) }
  }, [])

  async function connect() {
    const eth = window.ethereum
    if (!eth) { alert('请先安装 MetaMask 钱包扩展'); return }
    setPending(true)
    try {
      const accs = await eth.request({ method: 'eth_requestAccounts' })
      setAddress(accs[0] || '')
      // 切换到 BSC 测试网
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x61' }] })
      } catch(e) {
        if (e.code === 4902) {
          await eth.request({ method: 'wallet_addEthereumChain', params: [BSC_TESTNET] })
        }
      }
      const id = await eth.request({ method: 'eth_chainId' })
      setChainId(id)
    } catch(e) {
      console.error('connect error', e)
    } finally { setPending(false) }
  }

  async function switchChain() {
    const eth = window.ethereum
    if (!eth) return
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x61' }] })
    } catch(e) {
      if (e.code === 4902) await eth.request({ method: 'wallet_addEthereumChain', params: [BSC_TESTNET] })
    }
  }

  function disconnect() { setAddress('') }

  if (!address) return (
    <button className="nav-connect-btn" onClick={connect} disabled={pending}>
      {pending ? '连接中...' : '连接钱包'}
    </button>
  )
  if (!isRight) return (
    <button className="nav-connect-btn warn" onClick={switchChain}>⚠ 切换BSC</button>
  )
  return (
    <button className="nav-connect-btn connected" onClick={disconnect} title="点击断开">
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
      <div className="nav-right"><WalletBtn /></div>
    </nav>
  )
}
