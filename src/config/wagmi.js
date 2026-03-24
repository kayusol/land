import { createConfig, http } from 'wagmi'
import { injected, metaMask } from 'wagmi/connectors'

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

export const wagmiConfig = createConfig({
  chains: [bscTestnet],
  connectors: [
    metaMask({
      dappMetadata: {
        name: '进化星球 BSC',
        url: 'https://land-kayusol.vercel.app',
      },
    }),
    injected({ target: 'metaMask' }),
    injected(),
  ],
  transports: {
    [bscTestnet.id]: http('https://bsc-testnet-rpc.publicnode.com'),
  },
})
