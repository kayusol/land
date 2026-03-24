// src/config/wagmi.js — 最小化配置，仅供 WagmiProvider 包装用
// 实际钱包逻辑全在 WalletContext.jsx
import { createConfig, http } from 'wagmi'
import { bscTestnet } from '../contexts/WalletContext.jsx'

// 空 connector 列表，不用 wagmi 管理钱包连接
export { bscTestnet }

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  connectors: [],
  transports: {
    [bscTestnet.id]: http('https://bsc-testnet-rpc.publicnode.com'),
  },
})
