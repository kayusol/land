// src/contexts/WalletContext.jsx
// 统一钱包状态管理：直接读 window.ethereum，同时兼容 wagmi hooks
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useConnect, useDisconnect, useAccount as useWagmiAccount } from 'wagmi'
import { bscTestnet } from '../config/wagmi.js'

const WalletCtx = createContext(null)

const BSC_HEX = '0x' + bscTestnet.id.toString(16)

export function WalletProvider({ children }) {
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState(0)
  const [pending, setPending] = useState(false)
  const { connect, connectors } = useConnect()

  // 同步 window.ethereum 状态
  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return
    eth.request({ method: 'eth_accounts' }).then(a => { if(a[0]) setAddress(a[0]) }).catch(()=>{})
    eth.request({ method: 'eth_chainId' }).then(id => setChainId(parseInt(id,16))).catch(()=>{})
    const onAcc = a => { setAddress(a[0]||'') }
    const onChain = id => setChainId(parseInt(id,16))
    eth.on('accountsChanged', onAcc)
    eth.on('chainChanged', onChain)
    return () => { eth.removeListener('accountsChanged', onAcc); eth.removeListener('chainChanged', onChain) }
  }, [])

  const connectWallet = useCallback(async () => {
    const eth = window.ethereum
    if (!eth) { alert('请先安装 MetaMask'); return }
    setPending(true)
    try {
      // 先用 window.ethereum 直接请求（最可靠）
      const accs = await eth.request({ method: 'eth_requestAccounts' })
      setAddress(accs[0] || '')
      // 切链
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_HEX }] })
      } catch(e) {
        if (e.code === 4902) {
          await eth.request({ method: 'wallet_addEthereumChain', params: [{
            chainId: BSC_HEX, chainName: 'BSC Testnet',
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'],
            blockExplorerUrls: ['https://testnet.bscscan.com'],
          }]})
        }
      }
      const id = await eth.request({ method: 'eth_chainId' })
      setChainId(parseInt(id, 16))
      // 同时通知 wagmi（让 useWalletClient 等 hooks 正常工作）
      if (connectors[0]) {
        try { connect({ connector: connectors[0] }) } catch {}
      }
    } catch(e) {
      console.error('connect wallet error:', e)
    } finally { setPending(false) }
  }, [connect, connectors])

  const disconnectWallet = useCallback(() => {
    setAddress('')
  }, [])

  const value = {
    address,
    chainId,
    isConnected: !!address,
    isCorrectChain: chainId === bscTestnet.id,
    isPending: pending,
    connectWallet,
    disconnectWallet,
  }

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be inside WalletProvider')
  return ctx
}
