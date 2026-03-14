// ─────────────────────────────────────────────────────────────
//  Evolution Land BSC — Contract ABIs (human-readable)
// ─────────────────────────────────────────────────────────────

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]

export const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
  'function approve(address to, uint256 tokenId)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
]

export const LAND_ABI = [
  ...ERC721_ABI,
  'function encodeId(int16 x, int16 y) view returns (uint256)',
  'function decodeId(uint256 id) view returns (int16 x, int16 y)',
  'function resourceAttr(uint256 tokenId) view returns (uint80)',
  'function getRate(uint256 tokenId, uint8 resource) view returns (uint16)',
  'function district(uint256 tokenId) view returns (uint8)',
  'event LandMinted(uint256 indexed tokenId, int16 x, int16 y, uint80 attr)',
]

export const DRILL_ABI = [
  ...ERC721_ABI,
  'function nextId() view returns (uint256)',
  'function attrs(uint256 tokenId) view returns (uint8 tier, uint8 affinity)',
  'event DrillMinted(uint256 indexed id, address to, uint8 tier, uint8 affinity)',
]

export const APOSTLE_ABI = [
  ...ERC721_ABI,
  'function nextId() view returns (uint256)',
  'function attrs(uint256 tokenId) view returns (uint8 strength, uint8 element)',
  'event ApostleMinted(uint256 indexed id, address to, uint8 strength, uint8 element)',
]

export const MINING_ABI = [
  'function MAX_APOSTLES_PER_LAND() view returns (uint256)',
  'function startMining(uint256 landId, uint256 apostleId, uint256 drillId)',
  'function stopMining(uint256 landId, uint256 apostleId)',
  'function claim(uint256 landId)',
  'function pendingRewards(uint256 landId) view returns (uint256[5])',
  'function slotCount(uint256 landId) view returns (uint256)',
  'function slots(uint256 landId, uint256 index) view returns (uint256 apostleId, uint256 drillId, uint256 startTime)',
  'function apostleOnLand(uint256 apostleId) view returns (uint256)',
  'function drillOnLand(uint256 drillId) view returns (uint256)',
  'event MiningStarted(uint256 indexed landId, uint256 apostleId, uint256 drillId)',
  'event MiningStopped(uint256 indexed landId, uint256 apostleId)',
  'event Claimed(uint256 indexed landId, address indexed owner, uint256[5] amounts)',
]

export const AUCTION_ABI = [
  'function FEE_BPS() view returns (uint256)',
  'function createAuction(uint256 id, uint128 startPrice, uint128 endPrice, uint64 duration)',
  'function bid(uint256 id, uint256 maxPay)',
  'function cancelAuction(uint256 id)',
  'function currentPrice(uint256 id) view returns (uint256)',
  'function auctions(uint256 id) view returns (address seller, uint128 startPrice, uint128 endPrice, uint64 duration, uint64 startedAt)',
  'event AuctionCreated(uint256 indexed id, address seller, uint128 start, uint128 end, uint64 duration)',
  'event AuctionWon(uint256 indexed id, address buyer, uint256 price)',
  'event AuctionCancelled(uint256 indexed id)',
]

export const REFERRAL_ABI = [
  'function bind(address referrer)',
  'function referrer(address user) view returns (address)',
  'function bound(address user) view returns (bool)',
  'function getAncestors(address user) view returns (address[5])',
  'function getRates() view returns (uint256[5])',
  'function totalEarned(address user, address token) view returns (uint256)',
  'function earned(address user, address token) view returns (uint256)',
  'function RATES(uint256) view returns (uint256)',
  'event Bound(address indexed user, address indexed ref)',
  'event ReferralRewarded(address indexed earner, address indexed miner, address indexed token, uint256 amount, uint8 level)',
]

export const BLINDBOX_ABI = [
  'function apostleBoxPrice() view returns (uint256)',
  'function drillBoxPrice() view returns (uint256)',
  'function buyApostleBox() returns (uint256 tokenId)',
  'function buyDrillBox() returns (uint256 tokenId)',
  'function buyApostleBoxBatch(uint256 count)',
  'function buyDrillBoxBatch(uint256 count)',
  'event BoxOpened(address indexed buyer, string boxType, uint256 tokenId, uint8 attr1, uint8 attr2)',
]
