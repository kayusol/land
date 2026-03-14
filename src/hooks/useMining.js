/**
 * useMining — start/stop mining and claim rewards for a land parcel
 * Returns: { pendingRewards, startMining, stopMining, claim, slotCount }
 */
import { useReadContracts, useWriteContract, useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { CONTRACTS } from '../constants/contracts'
import { MINING_ABI, LAND_ABI, DRILL_ABI, APOSTLE_ABI } from '../constants/abi'

export function useMining(landId) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const enabled = !!landId && landId !== '0'

  const { data, refetch } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.mining, abi: MINING_ABI,
        functionName: 'pendingRewards', args: [BigInt(landId ?? 0)],
      },
      {
        address: CONTRACTS.mining, abi: MINING_ABI,
        functionName: 'slotCount', args: [BigInt(landId ?? 0)],
      },
    ],
    query: { enabled, refetchInterval: 15_000 },
  })

  const RESOURCE_NAMES = ['GOLD','WOOD','HHO','FIRE','SIOO']
  const rawRewards = data?.[0]?.result ?? [0n,0n,0n,0n,0n]
  const pendingRewards = rawRewards.map((v, i) => ({
    name: RESOURCE_NAMES[i],
    amount: formatUnits(v, 18),
  }))
  const slotCount = Number(data?.[1]?.result ?? 0)

  // Approve NFT → mining, then startMining
  async function startMining(apostleId, drillId = 0) {
    if (!address || !landId) throw new Error('not ready')
    // Approve land (operator should already be set, but approve apostle/drill)
    await writeContractAsync({
      address: CONTRACTS.apostle, abi: APOSTLE_ABI,
      functionName: 'approve',
      args: [CONTRACTS.mining, BigInt(apostleId)],
    })
    if (drillId) {
      await writeContractAsync({
        address: CONTRACTS.drill, abi: DRILL_ABI,
        functionName: 'approve',
        args: [CONTRACTS.mining, BigInt(drillId)],
      })
    }
    await writeContractAsync({
      address: CONTRACTS.mining, abi: MINING_ABI,
      functionName: 'startMining',
      args: [BigInt(landId), BigInt(apostleId), BigInt(drillId)],
    })
    await refetch()
  }

  async function stopMining(apostleId) {
    if (!landId) throw new Error('no land')
    await writeContractAsync({
      address: CONTRACTS.mining, abi: MINING_ABI,
      functionName: 'stopMining',
      args: [BigInt(landId), BigInt(apostleId)],
    })
    await refetch()
  }

  async function claim() {
    if (!landId) throw new Error('no land')
    await writeContractAsync({
      address: CONTRACTS.mining, abi: MINING_ABI,
      functionName: 'claim',
      args: [BigInt(landId)],
    })
    await refetch()
  }

  return { pendingRewards, slotCount, startMining, stopMining, claim, refetch }
}
