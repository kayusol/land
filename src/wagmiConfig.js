import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { defineChain } from 'viem'

export const bscTestnet = defineChain({
  id: 97,
  name: 'BSC Testnet',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://bsc-testnet-rpc.publicnode.com'] },
    public:  { http: ['https://bsc-testnet-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://testnet.bscscan.com' },
  },
  testnet: true,
})

export const wagmiConfig = getDefaultConfig({
  appName: 'Evolution Land BSC',
  projectId: 'evo-land-bsc-demo',
  chains: [bscTestnet],
  ssr: false,
})
