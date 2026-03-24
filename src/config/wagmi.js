import { createConfig, http, createConnector } from 'wagmi'

export const bscTestnet = {
  id: 97,
  name: 'BSC Testnet',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://bsc-testnet-rpc.publicnode.com'] },
    public:  { http: ['https://bsc-testnet-rpc.publicnode.com'] },
  },
  blockExplorers: { default: { name: 'BscScan', url: 'https://testnet.bscscan.com' } },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 17422483,
    },
  },
  testnet: true,
}

// 直接用 window.ethereum，兼容所有环境（本地/Vercel/移动端）
function injectedConnector() {
  return createConnector((config) => ({
    id: 'injected',
    name: 'MetaMask',
    type: 'injected',
    async connect({ chainId } = {}) {
      const provider = await this.getProvider()
      const accounts = await provider.request({ method: 'eth_requestAccounts' })
      const currentChainId = await provider.request({ method: 'eth_chainId' })
      const currentChainIdNum = parseInt(currentChainId, 16)
      // 如果链不对，尝试切换
      if (chainId && currentChainIdNum !== chainId) {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + chainId.toString(16) }],
          })
        } catch (e) {
          // 链不存在则添加
          if (e.code === 4902) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x61',
                chainName: 'BSC Testnet',
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                rpcUrls: ['https://bsc-testnet-rpc.publicnode.com'],
                blockExplorerUrls: ['https://testnet.bscscan.com'],
              }],
            })
          }
        }
      }
      return { accounts, chainId: chainId ?? currentChainIdNum }
    },
    async disconnect() {
      // injected connectors don't support programmatic disconnect
    },
    async getAccounts() {
      const provider = await this.getProvider()
      const accounts = await provider.request({ method: 'eth_accounts' })
      return accounts
    },
    async getChainId() {
      const provider = await this.getProvider()
      const chainId = await provider.request({ method: 'eth_chainId' })
      return parseInt(chainId, 16)
    },
    async getProvider() {
      if (typeof window === 'undefined') throw new Error('window not available')
      const provider = window.ethereum
      if (!provider) throw new Error('MetaMask not installed')
      return provider
    },
    async isAuthorized() {
      try {
        const provider = await this.getProvider()
        const accounts = await provider.request({ method: 'eth_accounts' })
        return accounts.length > 0
      } catch { return false }
    },
    onAccountsChanged(accounts) {
      if (accounts.length === 0) config.emitter.emit('disconnect')
      else config.emitter.emit('change', { accounts })
    },
    onChainChanged(chainId) {
      config.emitter.emit('change', { chainId: parseInt(chainId, 16) })
    },
    onDisconnect() {
      config.emitter.emit('disconnect')
    },
    async setup() {
      const provider = await this.getProvider().catch(() => null)
      if (!provider) return
      provider.on('accountsChanged', this.onAccountsChanged.bind(this))
      provider.on('chainChanged', this.onChainChanged.bind(this))
      provider.on('disconnect', this.onDisconnect.bind(this))
    },
  }))
}

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  connectors: [injectedConnector()],
  transports: {
    [bscTestnet.id]: http('https://bsc-testnet-rpc.publicnode.com'),
  },
})
