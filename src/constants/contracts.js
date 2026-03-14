// ─────────────────────────────────────────────────────────────
//  Evolution Land BSC — Deployed Contract Addresses
//  Network: BSC Testnet (chainId: 97)
//  Deployed: 2026-03-13T03:11:58.974Z
//  Deployer: 0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2
// ─────────────────────────────────────────────────────────────

export const CONTRACTS = {
  ring:        '0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',
  gold:        '0xbFaEb7b0BeD3684051F8d087717009eEd131C69f',
  wood:        '0x138C98Ca717917C584D878028bB02fB0BAc6E2c4',
  water:       '0x3618bCa0A8B4a56E1cC57b6B6F4e145104f4ea49',
  fire:        '0x3fb8134A6FFedc5bc467179905955fbE25780B33',
  soil:        '0xedAED55F28480839C5417D54160a1E0dDA7E9f13',
  land:        '0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  drill:       '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  apostle:     '0x3D06422b6623b422c4152cd53231f0F45232197A',
  mining:      '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  auction:     '0x6dfAEDBD161f99d655a818AF23377344FB16db1a',
  initializer: '0x78707C585E3C28D6f861b9b3Ef14b0e665f52a7B',
  referral:    '0xdefE1Df8a0F2bd91e6F2d88E564BDD511Ce87b1c',
  blindbox:    '0x77AAB7a9CD934D9aEc5fE60b15DbFbCDe5BC6252',
}

// Resource tokens in order matching contract enum (0=gold,1=wood,2=water,3=fire,4=soil)
export const RESOURCE_TOKENS = [
  { key: 'gold',  addr: CONTRACTS.gold,  symbol: 'GOLD',  icon: '⛏️' },
  { key: 'wood',  addr: CONTRACTS.wood,  symbol: 'WOOD',  icon: '🪵' },
  { key: 'water', addr: CONTRACTS.water, symbol: 'HHO',   icon: '💧' },
  { key: 'fire',  addr: CONTRACTS.fire,  symbol: 'FIRE',  icon: '🔥' },
  { key: 'soil',  addr: CONTRACTS.soil,  symbol: 'SIOO',  icon: '🪨' },
]

export const CHAIN_ID = 97
export const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'

// PancakeSwap BSC Testnet Router
export const PANCAKE_ROUTER = '0xD99D1c33F9fC3444f8101754aBC46c52416550d1'
export const WBNB = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd'
