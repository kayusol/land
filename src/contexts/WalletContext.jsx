// src/contexts/WalletContext.jsx
// 完全基于 window.ethereum + EIP-6963，支持 MetaMask / OKX / TokenPocket
import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
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

const BSC_CHAIN_PARAMS = {
  chainId: '0x61', chainName: 'BSC Testnet',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'],
  blockExplorerUrls: ['https://testnet.bscscan.com'],
}

export const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://bsc-testnet-rpc.publicnode.com'),
})

// ── EIP-6963 钱包检测（推荐标准，各钱包互不覆盖）──────────────────────────
let eip6963Providers = []  // 全局缓存 EIP-6963 注册的 provider

function initEIP6963() {
  if (typeof window === 'undefined') return
  window.addEventListener('eip6963:announceProvider', (event) => {
    const { info, provider } = event.detail
    if (!eip6963Providers.find(p => p.info.uuid === info.uuid)) {
      eip6963Providers.push({ info, provider })
    }
  })
  // 广播请求，让所有钱包响应
  window.dispatchEvent(new Event('eip6963:requestProvider'))
}

// 在模块加载时立即初始化
initEIP6963()

function detectWallets() {
  const wallets = []
  const seen = new Set()

  function add(name, icon, provider) {
    if (!provider || seen.has(provider)) return
    seen.add(provider)
    wallets.push({ name, icon, provider })
    console.log('[Wallet] detected:', name)
  }

  // 1. 优先用 EIP-6963（最可靠，各钱包独立注册）
  if (eip6963Providers.length > 0) {
    eip6963Providers.forEach(({ info, provider }) => {
      const n = info.name || ''
      let icon = '👛'
      if (n.toLowerCase().includes('metamask')) icon = '🦊'
      else if (n.toLowerCase().includes('okx')) icon = '⭕'
      else if (n.toLowerCase().includes('token')) icon = '🎒'
      add(n, icon, provider)
    })
    return wallets
  }

  // 2. window.ethereum.providers 数组（多钱包注入方式）
  const providers = window.ethereum?.providers
  if (Array.isArray(providers) && providers.length > 0) {
    providers.forEach(p => {
      if (p.isMetaMask && !p.isOKExWallet && !p.isOKX) add('MetaMask', '🦊', p)
      else if (p.isOKExWallet || p.isOKX) add('OKX 钱包', '⭕', p)
      else if (p.isTokenPocket) add('TP 钱包', '🎒', p)
      else add('钱包', '👛', p)
    })
    if (wallets.length > 0) return wallets
  }

  // 3. 独立入口（OKX/TP 有自己的 window 对象）
  if (window.okxwallet) add('OKX 钱包', '⭕', window.okxwallet)
  if (window.tokenpocket) add('TP 钱包', '🎒', window.tokenpocket)

  // 4. window.ethereum 单 provider 兜底
  if (window.ethereum) {
    const eth = window.ethereum
    if (eth.isMetaMask && !eth.isOKExWallet && !eth.isOKX) add('MetaMask', '🦊', eth)
    else if (eth.isOKExWallet || eth.isOKX) add('OKX 钱包', '⭕', eth)
    else if (eth.isTokenPocket) add('TP 钱包', '🎒', eth)
    else add('钱包', '👛', eth)
  }

  if (wallets.length === 0) console.warn('[Wallet] no wallet detected')
  return wallets
}

async function switchToBSC(provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x61' }] })
  } catch (e) {
    if (e.code === 4902 || e.code === -32603) {
      await provider.request({ method: 'wallet_addEthereumChain', params: [BSC_CHAIN_PARAMS] })
    } else if (e.code !== 4001) {
      console.warn('[Wallet] switchChain error:', e.message)
    }
  }
}

const WalletCtx = createContext(null)

export function WalletProvider({ children }) {
  const [address, setAddress]       = useState('')
  const [chainId, setChainId]       = useState(0)
  const [pending, setPending]       = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [wallets, setWallets]       = useState([])
  const providerRef = useRef(null)
  const wcRef       = useRef(null)

  function makeWC(provider) {
    providerRef.current = provider
    wcRef.current = createWalletClient({ chain: bscTestnet, transport: custom(provider) })
  }

  // 页面加载：等待 EIP-6963 钱包注册完成后恢复已连接账户
  useEffect(() => {
    // 给 EIP-6963 钱包 500ms 注册时间
    const timer = setTimeout(() => {
      const eth = window.ethereum
      if (!eth) return
      eth.request({ method: 'eth_accounts' })
        .then(accs => { if (accs?.[0]) { setAddress(accs[0]); makeWC(eth) } })
        .catch(() => {})
      eth.request({ method: 'eth_chainId' })
        .then(id => setChainId(parseInt(id, 16)))
        .catch(() => {})
    }, 500)

    const onAcc   = accs => { setAddress(accs?.[0] || ''); if (accs?.[0]) makeWC(window.ethereum) }
    const onChain = id   => setChainId(parseInt(id, 16))
    window.ethereum?.on?.('accountsChanged', onAcc)
    window.ethereum?.on?.('chainChanged', onChain)
    return () => {
      clearTimeout(timer)
      window.ethereum?.removeListener?.('accountsChanged', onAcc)
      window.ethereum?.removeListener?.('chainChanged', onChain)
    }
  }, [])

  async function connectWith(provider) {
    if (!provider) { console.error('[Wallet] connectWith: no provider'); return }
    console.log('[Wallet] connecting with provider:', provider.isMetaMask ? 'MetaMask' : provider.isOKExWallet ? 'OKX' : 'unknown')
    setPending(true)
    setShowPicker(false)
    try {
      const accs = await provider.request({ method: 'eth_requestAccounts' })
      console.log('[Wallet] accounts:', accs)
      if (!accs?.[0]) throw new Error('No accounts returned')
      setAddress(accs[0])
      makeWC(provider)
      await switchToBSC(provider)
      const id = await provider.request({ method: 'eth_chainId' })
      setChainId(parseInt(id, 16))
      console.log('[Wallet] connected:', accs[0], 'chainId:', parseInt(id, 16))
    } catch (e) {
      if (e.code !== 4001) console.error('[Wallet] connectWith error:', e.code, e.message)
      else console.log('[Wallet] user rejected connection')
    } finally {
      setPending(false)
    }
  }

  function connectWallet() {
    // 重新广播 EIP-6963 请求（确保最新状态）
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => {
      const detected = detectWallets()
      console.log('[Wallet] detected wallets:', detected.map(w=>w.name))
      if (detected.length === 0) {
        alert('未检测到钱包插件\n请安装 MetaMask / OKX / TokenPocket')
        return
      }
      if (detected.length === 1) {
        connectWith(detected[0].provider)
      } else {
        setWallets(detected)
        setShowPicker(true)
      }
    }, 100)  // 给 EIP-6963 100ms 响应时间
  }

  function disconnectWallet() {
    setAddress(''); wcRef.current = null; providerRef.current = null
  }

  const ctx = {
    address, chainId,
    isConnected:    !!address,
    isCorrectChain: chainId === 97,
    isPending:      pending,
    connectWallet,
    disconnectWallet,
    getWalletClient: () => wcRef.current || null,
  }

  return (
    <WalletCtx.Provider value={ctx}>
      {children}
      {showPicker && <WalletPicker wallets={wallets} onSelect={connectWith} onClose={() => setShowPicker(false)} />}
    </WalletCtx.Provider>
  )
}

function WalletPicker({ wallets, onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#120f1e',border:'1px solid #4a3060',borderRadius:16,padding:'24px 20px',minWidth:280,boxShadow:'0 8px 40px rgba(0,0,0,.7)'}}>
        <div style={{fontSize:'.9rem',color:'#c090ff',marginBottom:20,textAlign:'center',fontWeight:700}}>🔗 选择钱包连接</div>
        {wallets.map((w, i) => (
          <button key={i} onClick={() => onSelect(w.provider)}
            style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'13px 16px',background:'#1c1630',border:'1px solid #3a2860',borderRadius:10,cursor:'pointer',color:'#e8d8ff',fontSize:'.92rem',fontWeight:600,marginBottom:10}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#8855dd';e.currentTarget.style.background='#251e3e'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#3a2860';e.currentTarget.style.background='#1c1630'}}>
            <span style={{fontSize:'1.6rem',lineHeight:1}}>{w.icon}</span>
            <span>{w.name}</span>
          </button>
        ))}
        <button onClick={onClose} style={{width:'100%',padding:'8px',background:'none',border:'none',color:'#5a4080',cursor:'pointer',fontSize:'.78rem',marginTop:4}}>取消</button>
      </div>
    </div>
  )
}

export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be inside WalletProvider')
  return ctx
}

export function useAccount() {
  const { address, isConnected, chainId } = useWallet()
  return { address, isConnected, chainId, chain: isConnected ? bscTestnet : undefined }
}

export function useWalletClient() {
  const { getWalletClient, isConnected } = useWallet()
  return { data: isConnected ? getWalletClient() : null }
}

export function usePublicClient() {
  return publicClient
}
