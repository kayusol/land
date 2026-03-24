// src/contexts/WalletContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { createWalletClient, custom, createPublicClient, http } from 'viem'

export const bscTestnet = {
  id: 97, name: 'BSC Testnet',
  nativeCurrency: { name:'BNB', symbol:'BNB', decimals:18 },
  rpcUrls: { default: { http:['https://bsc-testnet-rpc.publicnode.com'] } },
  blockExplorers: { default: { name:'BscScan', url:'https://testnet.bscscan.com' } },
  contracts: { multicall3: { address:'0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated:17422483 } },
  testnet: true,
}
const BSC_CHAIN_PARAMS = {
  chainId:'0x61', chainName:'BSC Testnet',
  nativeCurrency:{ name:'BNB', symbol:'BNB', decimals:18 },
  rpcUrls:['https://bsc-testnet-rpc.publicnode.com'],
  blockExplorerUrls:['https://testnet.bscscan.com'],
}
export const publicClient = createPublicClient({
  chain: bscTestnet,
  transport: http('https://bsc-testnet-rpc.publicnode.com'),
})

let eip6963Providers = []
function initEIP6963() {
  if (typeof window==='undefined') return
  window.addEventListener('eip6963:announceProvider', e=>{
    const {info,provider}=e.detail
    if (!eip6963Providers.find(p=>p.info.uuid===info.uuid)) eip6963Providers.push({info,provider})
  })
  window.dispatchEvent(new Event('eip6963:requestProvider'))
}
initEIP6963()

function detectWallets() {
  const wallets=[], seen=new Set()
  function add(name,icon,provider){
    if(!provider||seen.has(provider)) return
    seen.add(provider); wallets.push({name,icon,provider})
    console.log('[Wallet] detected:',name)
  }
  if (eip6963Providers.length>0){
    eip6963Providers.forEach(({info,provider})=>{
      const n=info.name||''
      add(n, n.toLowerCase().includes('metamask')?'🦊':n.toLowerCase().includes('okx')?'⭕':n.toLowerCase().includes('token')?'🎒':'👛', provider)
    })
    if (wallets.length) return wallets
  }
  const ps=window.ethereum?.providers
  if (Array.isArray(ps)&&ps.length){
    ps.forEach(p=>{
      if (p.isMetaMask&&!p.isOKExWallet) add('MetaMask','🦊',p)
      else if (p.isOKExWallet||p.isOKX) add('OKX 钱包','⭕',p)
      else if (p.isTokenPocket) add('TP 钱包','🎒',p)
      else add('钱包','👛',p)
    })
    if (wallets.length) return wallets
  }
  if (window.okxwallet) add('OKX 钱包','⭕',window.okxwallet)
  if (window.tokenpocket) add('TP 钱包','🎒',window.tokenpocket)
  if (window.ethereum){
    const e=window.ethereum
    if (e.isMetaMask&&!e.isOKExWallet) add('MetaMask','🦊',e)
    else if (e.isOKExWallet||e.isOKX) add('OKX 钱包','⭕',e)
    else if (e.isTokenPocket) add('TP 钱包','🎒',e)
    else add('钱包','👛',e)
  }
  return wallets
}

async function switchToBSC(provider) {
  try {
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x61'}]})
  } catch(e) {
    if (e.code===4902||e.code===-32603)
      await provider.request({method:'wallet_addEthereumChain',params:[BSC_CHAIN_PARAMS]})
    else if (e.code!==4001) console.warn('[Wallet] switchChain:',e.message)
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
  const wcRef = useRef(null)

  // 关键修复：account 必须传入才能调用 sendTransaction
  function makeWC(provider, addr) {
    if (!provider || !addr) return
    providerRef.current = provider
    wcRef.current = createWalletClient({
      account: addr,          // ← 必须！否则 sendTransaction 报错
      chain: bscTestnet,
      transport: custom(provider),
    })
    console.log('[Wallet] walletClient created for', addr)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const eth = window.ethereum; if (!eth) return
      eth.request({method:'eth_accounts'}).then(accs=>{
        if (accs?.[0]) { setAddress(accs[0]); makeWC(eth, accs[0]) }
      }).catch(()=>{})
      eth.request({method:'eth_chainId'}).then(id=>setChainId(parseInt(id,16))).catch(()=>{})
    }, 300)
    const onAcc = accs => {
      const addr = accs?.[0]||''
      setAddress(addr)
      if (addr && providerRef.current) makeWC(providerRef.current, addr)
    }
    const onChain = id => setChainId(parseInt(id,16))
    window.ethereum?.on?.('accountsChanged', onAcc)
    window.ethereum?.on?.('chainChanged', onChain)
    return () => {
      clearTimeout(timer)
      window.ethereum?.removeListener?.('accountsChanged', onAcc)
      window.ethereum?.removeListener?.('chainChanged', onChain)
    }
  }, [])

  async function connectWith(provider) {
    if (!provider) return
    setPending(true); setShowPicker(false)
    try {
      const accs = await provider.request({method:'eth_requestAccounts'})
      if (!accs?.[0]) throw new Error('No accounts')
      const addr = accs[0]
      setAddress(addr)
      makeWC(provider, addr)     // ← 传入地址
      await switchToBSC(provider)
      const id = await provider.request({method:'eth_chainId'})
      setChainId(parseInt(id,16))
      console.log('[Wallet] connected:', addr)
    } catch(e) {
      if (e.code!==4001) console.error('[Wallet] error:', e.message)
    } finally { setPending(false) }
  }

  function connectWallet() {
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setTimeout(() => {
      const detected = detectWallets()
      console.log('[Wallet] wallets:', detected.map(w=>w.name))
      if (!detected.length) { alert('未检测到钱包\n请安装 MetaMask / OKX / TokenPocket'); return }
      if (detected.length===1) connectWith(detected[0].provider)
      else { setWallets(detected); setShowPicker(true) }
    }, 100)
  }

  function disconnectWallet() {
    setAddress(''); wcRef.current=null; providerRef.current=null
  }

  return (
    <WalletCtx.Provider value={{
      address, chainId,
      isConnected: !!address,
      isCorrectChain: chainId===97,
      isPending: pending,
      connectWallet, disconnectWallet,
      getWalletClient: ()=>wcRef.current||null,
    }}>
      {children}
      {showPicker&&<WalletPicker wallets={wallets} onSelect={connectWith} onClose={()=>setShowPicker(false)}/>}
    </WalletCtx.Provider>
  )
}

function WalletPicker({ wallets, onSelect, onClose }) {
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#120f1e',border:'1px solid #4a3060',borderRadius:16,padding:'24px 20px',minWidth:280,boxShadow:'0 8px 40px rgba(0,0,0,.7)'}}>
        <div style={{fontSize:'.9rem',color:'#c090ff',marginBottom:20,textAlign:'center',fontWeight:700}}>🔗 选择钱包连接</div>
        {wallets.map((w,i)=>(
          <button key={i} onClick={()=>onSelect(w.provider)}
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
