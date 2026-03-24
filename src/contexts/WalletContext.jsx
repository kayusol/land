// src/contexts/WalletContext.jsx
// 统一钱包状态 — window.ethereum 直接连接，同步到 wagmi
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createWalletClient, custom, createPublicClient, http } from 'viem'
import { bscTestnet } from '../config/wagmi.js'

const WalletCtx = createContext(null)
const BSC_HEX = '0x' + bscTestnet.id.toString(16)

const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://bsc-testnet-rpc.publicnode.com'),
})

export function WalletProvider({ children }) {
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState(0)
  const [pending, setPending] = useState(false)
  const walletClientRef = useRef(null)

  // 恢复已连接状态
  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return
    eth.request({ method: 'eth_accounts' }).then(accs => {
      if (accs[0]) { setAddress(accs[0]); makeWalletClient() }
    }).catch(() => {})
    eth.request({ method: 'eth_chainId' }).then(id => setChainId(parseInt(id, 16))).catch(() => {})
    const onAccounts = accs => { setAddress(accs[0] || ''); if (accs[0]) makeWalletClient() }
    const onChain = id => setChainId(parseInt(id, 16))
    eth.on('accountsChanged', onAccounts)
    eth.on('chainChanged', onChain)
    return () => { eth.removeListener('accountsChanged', onAccounts); eth.removeListener('chainChanged', onChain) }
  }, [])

  function makeWalletClient() {
    if (!window.ethereum) return null
    walletClientRef.current = createWalletClient({
      chain: bscTestnet,
      transport: custom(window.ethereum),
    })
    return walletClientRef.current
  }

  const connectWallet = useCallback(async () => {
    const eth = window.ethereum
    if (!eth) { alert('请先安装 MetaMask 钱包'); return }
    setPending(true)
    try {
      const accs = await eth.request({ method: 'eth_requestAccounts' })
      setAddress(accs[0] || '')
      makeWalletClient()
      // 切换到 BSC 测试网
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_HEX }] })
      } catch(e) {
        if (e.code === 4902) {
          await eth.request({ method: 'wallet_addEthereumChain', params: [{
            chainId: BSC_HEX,
            chainName: 'BSC Testnet',
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'],
            blockExplorerUrls: ['https://testnet.bscscan.com'],
          }]})
        }
      }
      const id = await eth.request({ method: 'eth_chainId' })
      setChainId(parseInt(id, 16))
    } catch(e) {
      console.error('connect wallet error:', e)
    } finally { setPending(false) }
  }, [])

  const disconnectWallet = useCallback(() => {
    setAddress('')
    walletClientRef.current = null
  }, [])

  // getWalletClient — 供各页面替代 useWalletClient
  const getWalletClient = useCallback(() => {
    if (walletClientRef.current) return walletClientRef.current
    return makeWalletClient()
  }, [])

  const value = {
    address,
    chainId,
    isConnected: !!address,
    isCorrectChain: chainId === bscTestnet.id,
    isPending: pending,
    connectWallet,
    disconnectWallet,
    getWalletClient,   // 替代 useWalletClient
    publicClient,      // 替代 usePublicClient（viem 直接实例）
  }

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be inside WalletProvider')
  return ctx
}

// 兼容层 — 让现有页面不需要改动，直接替换 wagmi hooks
export function useAccount() {
  const { address, isConnected, chainId } = useWallet()
  return { address, isConnected, chainId, chain: isConnected ? bscTestnet : undefined }
}

export function useWalletClient() {
  const { getWalletClient, isConnected } = useWallet()
  const wc = isConnected ? getWalletClient() : null
  return { data: wc }
}

export function usePublicClient() {
  return publicClient
}
