import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

export const bscTestnet = {
  id: 97,
  name: 'BSC 测试网',
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

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  connectors: [injected()],
  transports: { [bscTestnet.id]: http('https://bsc-testnet-rpc.publicnode.com') },
})
