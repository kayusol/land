# Indexer 合约事件列表（单链 BSC）

Indexer 需订阅以下 BSC 合约事件，将链上数据同步到数据库。合约地址见项目 `src/constants/contracts.js`。

## 1. Land（地块 NFT）

- **合约地址**：`CONTRACTS.land`
- **事件**：
  - `Transfer(address indexed from, address indexed to, uint256 indexed tokenId)` — 铸造、转让、拍卖成交时更新 owner
  - `LandMinted(uint256 indexed tokenId, int16 x, int16 y, uint80 attr)` — 铸造时写入坐标与资源属性
- **索引逻辑**：维护 `lands` 表；`Transfer(from=0)` 视为 Mint，否则更新 owner；`LandMinted` 写入/更新 land_id、gx、gy、resource_attr。

## 2. Auction（拍卖）

- **合约地址**：`CONTRACTS.auction`
- **事件**：
  - `AuctionCreated(uint256 indexed id, address seller, uint128 start, uint128 end, uint64 duration)` — 创建拍卖
  - `AuctionWon(uint256 indexed id, address buyer, uint256 price)` — 成交，需更新 land 的 owner/status，并写入 auction 历史
  - `AuctionCancelled(uint256 indexed id)` — 取消拍卖
- **索引逻辑**：维护 `land_auctions` 表（当前进行中的拍卖）及拍卖历史；`auctions(id)` 与 `currentPrice(id)` 可做回填或校验。

## 3. Drill（钻头 NFT）

- **合约地址**：`CONTRACTS.drill`
- **事件**：
  - `Transfer(address indexed from, address indexed to, uint256 indexed tokenId)` — 所有权变更
  - `DrillMinted(uint256 indexed id, address to, uint8 tier, uint8 affinity)` — 铸造，写入 tier/affinity
- **索引逻辑**：维护 `drills` 表；`Transfer(from=0)` 或 `DrillMinted` 写入/更新 owner、tier、affinity 等。

## 4. Apostle（使徒 NFT）

- **合约地址**：`CONTRACTS.apostle`
- **事件**：
  - `Transfer(address indexed from, address indexed to, uint256 indexed tokenId)` — 所有权变更
  - `ApostleMinted(uint256 indexed id, address to, uint8 strength, uint8 element)` — 铸造
- **索引逻辑**：维护 `apostles` 表；同上，用 Transfer + Mint 事件更新 owner 与属性。

## 5. Mining（挖矿）

- **合约地址**：`CONTRACTS.mining`
- **事件**：
  - `MiningStarted(uint256 indexed landId, uint256 apostleId, uint256 drillId)` — 地块上开始挖矿，更新 land 的 drill/apostle 工作区
  - `MiningStopped(uint256 indexed landId, uint256 apostleId)` — 停止挖矿
  - `Claimed(uint256 indexed landId, address indexed owner, uint256[5] amounts)` — 领取奖励，可记入历史
- **索引逻辑**：维护地块与钻头/使徒的装备关系（如 `land_drill_slots`、`land_apostle_slots` 或合并在 land 的 JSON 字段）；Claimed 可写表做统计。

## 6. Referral（推荐）

- **合约地址**：`CONTRACTS.referral`
- **事件**：
  - `Bound(address indexed user, address indexed ref)` — 绑定推荐人
  - `ReferralRewarded(address indexed earner, address indexed miner, address indexed token, uint256 amount, uint8 level)` — 推荐奖励（可选统计）
- **索引逻辑**：若前端需展示推荐关系/收益，可维护 `referrals`、`referral_rewards` 表；否则可暂不索引。

## 7. Blindbox（盲盒）

- **合约地址**：`CONTRACTS.blindbox`
- **事件**：
  - `BoxOpened(address indexed buyer, string boxType, uint256 tokenId, uint8 attr1, uint8 attr2)` — 开盒，对应 Drill 或 Apostle 的铸造
- **索引逻辑**：可与 Drill/Apostle 的 Mint 事件配合，标记来源为盲盒；非必须单独表。

---

## 回填与校验

- **起始区块**：从各合约部署区块或首次 LandMinted 区块开始扫描。
- **回填**：可用合约只读方法（如 `ownerOf`、`resourceAttr`、`auctions`、`currentPrice`）对已有 tokenId 做批量回填，再与事件增量合并。
- **单链**：仅 BSC 一条链，无需 `landId`/`EVO-NETWORK` 区分；所有表可加 `chain_id = 97` 或省略。
