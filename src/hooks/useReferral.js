/**
 * useReferral — bind referrer and read referral tree
 * Returns: { isBound, referrer, ancestors, rates, bind, totalEarned }
 */
import { useReadContracts, useWriteContract } from 'wagmi'
import { useAccount } from '../contexts/WalletContext.jsx'
import { CONTRACTS } from '../constants/contracts'
import { REFERRAL_ABI } from '../constants/abi'

export function useReferral() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const enabled = !!address && CONTRACTS.referral !== '0x0000000000000000000000000000000000000000'

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: CONTRACTS.referral, abi: REFERRAL_ABI, functionName: 'bound',        args: [address ?? '0x0'] },
      { address: CONTRACTS.referral, abi: REFERRAL_ABI, functionName: 'referrer',     args: [address ?? '0x0'] },
      { address: CONTRACTS.referral, abi: REFERRAL_ABI, functionName: 'getAncestors', args: [address ?? '0x0'] },
      { address: CONTRACTS.referral, abi: REFERRAL_ABI, functionName: 'getRates' },
    ],
    query: { enabled, refetchInterval: 30_000 },
  })

  const isBound   = data?.[0]?.result ?? false
  const referrer  = data?.[1]?.result ?? ''
  const ancestors = data?.[2]?.result ?? []
  const rates     = (data?.[3]?.result ?? []).map(r => Number(r) / 100) // convert bps → %

  async function bindReferrer(refAddress) {
    if (!address) throw new Error('wallet not connected')
    await writeContractAsync({
      address: CONTRACTS.referral,
      abi: REFERRAL_ABI,
      functionName: 'bind',
      args: [refAddress],
    })
    await refetch()
  }

  return { isBound, referrer, ancestors, rates, bind: bindReferrer, refetch }
}
