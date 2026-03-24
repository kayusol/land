// src/contexts/WalletContext.jsx
// 单一钱包状态管理，完全基于 window.ethereum
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createWalletClient, custom, createPublicClient, http } from 'viem'

export const bscTestnet = {
  id: 97,
  name: 'BSC Testnet',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://bsc-testnet-rpc.publicnode.com'] } },
  blockExplorers: { default: { name: 'BscScan', url: 'https://testnet.bscscan.com' } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated: 17422483 } },
  testnet: true,
}

const BSC_HEX = '0x61'

// 全局单例 publicClient（读链用）
export const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://bsc-testnet-rpc.publicnode.com'),
})

const WalletCtx = createContext(null)

export function WalletProvider({ children }) {
  const [address, setAddress]   = useState('')
  const [chainId, setChainId]   = useState(0)
  const [pending, setPending]   = useState(false)
  const wcRef = useRef(null)

  function buildWalletClient() {
    if (typeof window === 'undefined' || !window.ethereum) return null
    wcRef.current = createWalletClient({ chain: bscTestnet, transport: custom(window.ethereum) })
    return wcRef.current
  }

  // 页面加载时恢复已连接状态
  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return
    eth.request({ method: 'eth_accounts' }).then(a => {
      if (a[0]) { setAddress(a[0]); buildWalletClient() }
    }).catch(() => {})
    eth.request({ method: 'eth_chainId' }).then(id => setChainId(parseInt(id, 16))).catch(() => {})
    const onAcc   = a  => { setAddress(a[0] || ''); if (a[0]) buildWalletClient() }
    const onChain = id => setChainId(parseInt(id, 16))
    eth.on('accountsChanged', onAcc)
    eth.on('chainChanged', onChain)
    return () => { eth.removeListener('accountsChanged', onAcc); eth.removeListener('chainChanged', onChain) }
  }, [])

  const connectWallet = useCallback(async () => {
    const eth = window.ethereum
    if (!eth) { alert('请先安装 MetaMask'); return }
    setPending(true)
    try {
      const accs = await eth.request({ method: 'eth_requestAccounts' })
      if (!accs[0]) throw new Error('No accounts returned')
      setAddress(accs[0])
      buildWalletClient()
      // 切换或添加 BSC 测试网
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BSC_HEX }] })
      } catch (e) {
        if (e.code === 4902 || e.code === -32603) {
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
    } catch (e) {
      if (e.code !== 4001) console.error('connect error:', e) // 忽略用户拒绝
    } finally { setPending(false) }
  }, [])

  const disconnectWallet = useCallback(() => {
    setAddress(''); wcRef.current = null
  }, [])

  const value = {
    address,
    chainId,
    isConnected:    !!address,
    isCorrectChain: chainId === 97,
    isPending:      pending,
    connectWallet,
    disconnectWallet,
    // 供各页面使用
    walletClient:  wcRef.current,
    getWalletClient: () => wcRef.current || buildWalletClient(),
    publicClient,
  }

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be inside WalletProvider')
  return ctx
}

// ── 兼容层 hooks（替换 wagmi hooks，让现有页面无需改动）─────────────────

export function useAccount() {
  const { address, isConnected, chainId } = useWallet()
  return { address, isConnected, chainId, chain: isConnected ? bscTestnet : undefined }
}

export function useWalletClient() {
  const { getWalletClient, isConnected, address } = useWallet()
  // 每次 address 变化时重建 walletClient
  const wc = isConnected ? getWalletClient() : null
  return { data: wc }
}

export function usePublicClient() {
  return publicClient
}
