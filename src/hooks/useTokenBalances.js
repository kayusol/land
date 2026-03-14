import { useReadContracts, useAccount } from 'wagmi'
import { CONTRACTS, RESOURCE_TOKENS } from '../constants/contracts'
import { ERC20_ABI } from '../constants/abi'
import { formatEther } from 'viem'

export function useTokenBalances() {
  const { address } = useAccount()

  const allTokens = [
    { addr: CONTRACTS.ring,  symbol: 'RING' },
    ...RESOURCE_TOKENS.map(t => ({ addr: t.addr, symbol: t.symbol })),
  ]

  const { data, isLoading, refetch } = useReadContracts({
    contracts: allTokens.map(t => ({
      address: t.addr,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address ?? '0x0000000000000000000000000000000000000000'],
    })),
    query: { enabled: !!address, refetchInterval: 15_000 },
  })

  const balances = {}
  if (data) {
    allTokens.forEach((t, i) => {
      const raw = data[i]?.result ?? 0n
      balances[t.symbol] = {
        raw,
        formatted: parseFloat(formatEther(raw)).toFixed(4),
        symbol: t.symbol,
      }
    })
  }

  return { balances, isLoading, refetch }
}
