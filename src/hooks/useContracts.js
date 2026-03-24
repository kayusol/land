
import { getContract } from 'viem'
import { usePublicClient, useWalletClient, useAccount } from '../contexts/WalletContext.jsx'
import { CONTRACTS } from '../constants/contracts'
import {
  ERC20_ABI, LAND_ABI, DRILL_ABI, APOSTLE_ABI,
  MINING_ABI, AUCTION_ABI, REFERRAL_ABI, BLINDBOX_ABI
} from '../constants/abi'

export function useContracts() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()

  function pub(addr, abi) {
    return getContract({ address: addr, abi, client: publicClient })
  }
  function wal(addr, abi) {
    if (!walletClient) return null
    return getContract({ address: addr, abi, client: walletClient })
  }

  return {
    // read-only
    ring:     pub(CONTRACTS.ring,     ERC20_ABI),
    gold:     pub(CONTRACTS.gold,     ERC20_ABI),
    wood:     pub(CONTRACTS.wood,     ERC20_ABI),
    water:    pub(CONTRACTS.water,    ERC20_ABI),
    fire:     pub(CONTRACTS.fire,     ERC20_ABI),
    soil:     pub(CONTRACTS.soil,     ERC20_ABI),
    land:     pub(CONTRACTS.land,     LAND_ABI),
    drill:    pub(CONTRACTS.drill,    DRILL_ABI),
    apostle:  pub(CONTRACTS.apostle,  APOSTLE_ABI),
    mining:   pub(CONTRACTS.mining,   MINING_ABI),
    auction:  pub(CONTRACTS.auction,  AUCTION_ABI),
    referral: pub(CONTRACTS.referral, REFERRAL_ABI),
    blindbox: pub(CONTRACTS.blindbox, BLINDBOX_ABI),
    // write (wallet required)
    ringW:     wal(CONTRACTS.ring,     ERC20_ABI),
    landW:     wal(CONTRACTS.land,     LAND_ABI),
    drillW:    wal(CONTRACTS.drill,    DRILL_ABI),
    apostleW:  wal(CONTRACTS.apostle,  APOSTLE_ABI),
    miningW:   wal(CONTRACTS.mining,   MINING_ABI),
    auctionW:  wal(CONTRACTS.auction,  AUCTION_ABI),
    referralW: wal(CONTRACTS.referral, REFERRAL_ABI),
    blindboxW: wal(CONTRACTS.blindbox, BLINDBOX_ABI),
    // helpers
    address,
    publicClient,
    walletClient,
  }
}
