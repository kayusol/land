// src/contexts/WalletContext.jsx
// 完全基于 window.ethereum，支持 MetaMask / OKX / TokenPocket
import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { createWalletClient, custom, createPublicClient, http } from 'viem'

// ── 链配置 ─────────────────────────────────────────────────────────────────
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
  chainId: '0x61',
  chainName: 'BSC Testnet',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'],
  blockExplorerUrls: ['https://testnet.bscscan.com'],
}

// 全局读链客户端（只读，不需要钱包）
export const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://bsc-testnet-rpc.publicnode.com'),
})

// ── 检测所有可用钱包 ────────────────────────────────────────────────────────
function detectWallets() {
  const wallets = []
  const seen = new Set()

  function add(name, icon, provider) {
    if (!provider || seen.has(provider)) return
    seen.add(provider)
    wallets.push({ name, icon, provider })
  }

  // MetaMask
  if (window.ethereum?.isMetaMask && !window.ethereum?.isOKExWallet) {
    add('MetaMask', '🦊', window.ethereum)
  }

  // OKX — 优先用专属入口
  if (window.okxwallet) {
    add('OKX 钱包', '⭕', window.okxwallet)
  } else if (window.ethereum?.isOKExWallet || window.ethereum?.isOKX) {
    add('OKX 钱包', '⭕', window.ethereum)
  }

  // TokenPocket
  if (window.tokenpocket) {
    add('TP 钱包', '🎒', window.tokenpocket)
  } else if (window.ethereum?.isTokenPocket) {
    add('TP 钱包', '🎒', window.ethereum)
  }

  // 多 provider 环境（某些浏览器）
  if (window.ethereum?.providers?.length) {
    window.ethereum.providers.forEach(p => {
      if (p.isMetaMask && !p.isOKExWallet) add('MetaMask', '🦊', p)
      else if (p.isOKExWallet || p.isOKX)  add('OKX 钱包', '⭕', p)
      else if (p.isTokenPocket)             add('TP 钱包',  '🎒', p)
    })
  }

  // 兜底：如果啥都没检测到但有 window.ethereum
  if (wallets.length === 0 && window.ethereum) {
    add('钱包', '👛', window.ethereum)
  }

  return wallets
}

// ── 工具函数 ────────────────────────────────────────────────────────────────
async function switchToBSC(provider) {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x61' }] })
  } catch (e) {
    if (e.code === 4902 || e.code === -32603) {
      await provider.request({ method: 'wallet_addEthereumChain', params: [BSC_CHAIN_PARAMS] })
    } else {
      throw e
    }
  }
}

// ── WalletProvider ──────────────────────────────────────────────────────────
const WalletCtx = createContext(null)

export function WalletProvider({ children }) {
  const [address, setAddress]       = useState('')
  const [chainId, setChainId]       = useState(0)
  const [pending, setPending]       = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [wallets, setWallets]       = useState([])
  const providerRef = useRef(null)
  const wcRef       = useRef(null)

  // 用 provider 建 walletClient
  function makeWC(provider) {
    providerRef.current = provider
    wcRef.current = createWalletClient({ chain: bscTestnet, transport: custom(provider) })
  }

  // 页面加载：静默恢复已连接账户
  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return

    eth.request({ method: 'eth_accounts' })
      .then(accs => { if (accs?.[0]) { setAddress(accs[0]); makeWC(eth) } })
      .catch(() => {})

    eth.request({ method: 'eth_chainId' })
      .then(id => setChainId(parseInt(id, 16)))
      .catch(() => {})

    const onAcc   = accs => { setAddress(accs?.[0] || ''); if (accs?.[0]) makeWC(eth) }
    const onChain = id   => setChainId(parseInt(id, 16))
    eth.on?.('accountsChanged', onAcc)
    eth.on?.('chainChanged', onChain)
    return () => {
      eth.removeListener?.('accountsChanged', onAcc)
      eth.removeListener?.('chainChanged', onChain)
    }
  }, [])

  // 用指定 provider 连接钱包
  async function connectWith(provider) {
    if (!provider) return
    setPending(true)
    setShowPicker(false)
    try {
      const accs = await provider.request({ method: 'eth_requestAccounts' })
      if (!accs?.[0]) throw new Error('未获取到账户')
      setAddress(accs[0])
      makeWC(provider)
      await switchToBSC(provider)
      const id = await provider.request({ method: 'eth_chainId' })
      setChainId(parseInt(id, 16))
    } catch (e) {
      if (e.code !== 4001) console.error('[Wallet] connect error:', e.message)
    } finally {
      setPending(false)
    }
  }

  // 点击"连接钱包"按钮
  function connectWallet() {
    if (typeof window === 'undefined') return
    const detected = detectWallets()
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
  }

  function disconnectWallet() {
    setAddress('')
    wcRef.current = null
    providerRef.current = null
  }

  const ctx = {
    address,
    chainId,
    isConnected:    !!address,
    isCorrectChain: chainId === 97,
    isPending:      pending,
    connectWallet,
    disconnectWallet,
    // 供各页面调用发交易
    getWalletClient: () => wcRef.current || null,
  }

  return (
    <WalletCtx.Provider value={ctx}>
      {children}
      {showPicker && (
        <WalletPicker
          wallets={wallets}
          onSelect={connectWith}
          onClose={() => setShowPicker(false)}
        />
      )}
    </WalletCtx.Provider>
  )
}

// ── 钱包选择弹窗 ────────────────────────────────────────────────────────────
function WalletPicker({ wallets, onSelect, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:99999,
              display:'flex',alignItems:'center',justifyContent:'center'}}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{background:'#120f1e',border:'1px solid #4a3060',borderRadius:16,
                padding:'24px 20px',minWidth:280,boxShadow:'0 8px 40px rgba(0,0,0,.7)'}}
      >
        <div style={{fontSize:'.9rem',color:'#c090ff',marginBottom:20,textAlign:'center',
                     fontWeight:700,letterSpacing:'.05em'}}>
          🔗 选择钱包连接
        </div>
        {wallets.map((w, i) => (
          <button
            key={i}
            onClick={() => onSelect(w.provider)}
            style={{display:'flex',alignItems:'center',gap:14,width:'100%',
                    padding:'13px 16px',background:'#1c1630',border:'1px solid #3a2860',
                    borderRadius:10,cursor:'pointer',color:'#e8d8ff',fontSize:'.92rem',
                    fontWeight:600,marginBottom:10,transition:'border-color .15s,background .15s'}}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#8855dd'; e.currentTarget.style.background='#251e3e' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#3a2860'; e.currentTarget.style.background='#1c1630' }}
          >
            <span style={{fontSize:'1.6rem',lineHeight:1}}>{w.icon}</span>
            <span>{w.name}</span>
          </button>
        ))}
        <button
          onClick={onClose}
          style={{width:'100%',padding:'8px',background:'none',border:'none',
                  color:'#5a4080',cursor:'pointer',fontSize:'.78rem',marginTop:4}}
        >
          取消
        </button>
      </div>
    </div>
  )
}

// ── Hooks ───────────────────────────────────────────────────────────────────
export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be inside WalletProvider')
  return ctx
}

// 兼容层 — 让现有页面不需要修改
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
