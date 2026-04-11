export const CONTRACTS = {
  ring:        '0x7eB5a8b19F5E6fA6C1de46D73F83a3eADaA6A0F5',
  gold:        '0x549A4a22CF41BB016840Dec2c4Bcd17982175a2c',
  wood:        '0x0cCc212EBeBFC8E39dcc0697784B5aeD7926fee7',
  water:       '0x0940461D649891172f9a30F01500Cd7cfE5F2646',
  fire:        '0x550e5D7B1da26c0DBbA756A31E08E9059B73e90e',
  soil:        '0x8C40a9d2b0647B2e8C3DbBAA656A6b9FCde04319',
  land:        '0x2A52aE9c68C2F150A5ED7a2B22Ea8Bfb1AFcc015',
  drill:       '0x97980B8C7402c3db11d52FBa68d90aeAB4608A5F',
  apostle:     '0x2C62A93f67CbE7f66259D658d6D70187FbEE3896',
  mining:      '0xE979E442d40060ED09452FcE66cFafDE065aec58',
  auction:     '0x4B1CC81508971288864400f42634045aF24282a3',
  initializer: '0xabd3c7e41b8A9f52EBD521bdaDB8b2b9384537C3',
  blindbox:    '0xf08D8AD3E7d884bc906432C41Da7aA53D6A02166',
  referral:    '0xe5Ce03D51DDc7598646054480b4D37aEb21B0962',
  upgrade:     '0xd8083a57b479bb920d52f0db2257936023b49ea7',
  rental:      '0x7fb3cdf115552721b3f19f06592c07c83f6c7858',
  landMeta:    '0xad2f254ea1068800b982c2f2e705fcb5960b4625',
}

export const NFT_AUCTION_ADDR = '0x4B1CC81508971288864400f42634045aF24282a3'
// 新合约部署区块
export const DEPLOY_BLOCK = 50000000n
export const DEPLOYER = '0xe149fd4EFc7485ffae69f844bc93EA87a6a2e5b2'
export const PANCAKE_ROUTER = '0xD99D1c33F9fC3444f8101754aBC46c52416550d1'
export const WBNB = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd'

export const isDeployed = CONTRACTS.ring !== '0x0000000000000000000000000000000000000000'

export const RESOURCE_NAMES = ['Gold', 'Wood', 'Water', 'Fire', 'Soil']
export const RES_NAMES_ZH = ['金矿', '木材', '水源', '火焰', '土地']
export const RESOURCE_ICONS = ['🪙', '🌲', '💧', '🔥', '⛰']
export const RES_EMOJIS = RESOURCE_ICONS
export const RESOURCE_KEYS = ['gold', 'wood', 'water', 'fire', 'soil']
export const RES_KEYS = RESOURCE_KEYS
export const RESOURCE_COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a78bfa']
export const RES_COLORS = RESOURCE_COLORS
export const LAND_COLORS = RESOURCE_COLORS

export const RESOURCE_TOKENS = [
  CONTRACTS.gold,
  CONTRACTS.wood,
  CONTRACTS.water,
  CONTRACTS.fire,
  CONTRACTS.soil,
]
