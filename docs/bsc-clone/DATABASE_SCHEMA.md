# 数据库表结构（单链 BSC 后端）

与官方前端 `backendApi` 的 types 对齐，便于 REST API 直接返回。以下为建议表结构（PostgreSQL / MySQL 均可）。

## 1. lands

地块基础与当前归属。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PRIMARY KEY | 自增主键 |
| token_id | VARCHAR(78) UNIQUE NOT NULL | 地块 NFT tokenId（0x 或十进制） |
| land_id | INT NOT NULL | 地图上的 land_id（如 1–10000） |
| owner | VARCHAR(42) NOT NULL | 当前 owner 地址 |
| gx | SMALLINT NOT NULL | 地图 x |
| gy | SMALLINT NOT NULL | 地图 y |
| lon | INT | 经度（可选） |
| lat | INT | 纬度（可选） |
| resource_attr | VARCHAR(32) | 资源属性（uint80 十进制或 hex） |
| gold_rate, wood_rate, water_rate, fire_rate, soil_rate | SMALLINT | 从 resourceAttr 解析的 5 元素占比 |
| status | VARCHAR(20) | 如 genesis / secondhand / onsale / bid |
| introduction | TEXT | 介绍 |
| land_url | VARCHAR(512) | 链接 |
| cover | VARCHAR(512) | 封面图 |
| district | VARCHAR(4) | 单链可写死如 '1' |
| created_at | TIMESTAMP | 首次铸造时间 |
| updated_at | TIMESTAMP | 最后更新 |

索引：`token_id`, `owner`, `land_id`, `status`。

## 2. land_auctions

当前进行中的拍卖（与官方 LandAuction 一致）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PRIMARY KEY | |
| land_token_id | VARCHAR(78) UNIQUE NOT NULL | 对应 lands.token_id |
| seller | VARCHAR(42) NOT NULL | |
| start_price | VARCHAR(78) NOT NULL | 十进制字符串 |
| end_price | VARCHAR(78) NOT NULL | |
| duration | BIGINT NOT NULL | 秒 |
| started_at | BIGINT NOT NULL | 开始时间戳 |
| last_bid_at | BIGINT | 最后出价时间 |
| last_price | VARCHAR(78) | 当前价 |
| winner_address | VARCHAR(42) | 当前最高出价者（未 claim 前） |
| status | VARCHAR(20) | active / won / cancelled |
| token_address | VARCHAR(42) | 支付代币（如 RING） |
| token_decimals | SMALLINT | |
| token_symbol | VARCHAR(20) | |

索引：`land_token_id`, `seller`, `status`。

## 3. land_auction_history

拍卖出价历史（LandAuctionHistoryItem）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PRIMARY KEY | |
| land_token_id | VARCHAR(78) NOT NULL | |
| bid_price | VARCHAR(78) NOT NULL | |
| tx_id | VARCHAR(66) NOT NULL | |
| buyer | VARCHAR(42) NOT NULL | |
| start_at | BIGINT NOT NULL | 出价时间 |

索引：`land_token_id`。

## 4. land_records

地块成交记录（LandRecord，用于详情页「最终记录」）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PRIMARY KEY | |
| land_token_id | VARCHAR(78) NOT NULL | |
| claim_time | BIGINT NOT NULL | |
| create_tx | VARCHAR(66) NOT NULL | |
| final_price | VARCHAR(78) NOT NULL | |
| seller | VARCHAR(42) NOT NULL | |
| winner | VARCHAR(42) NOT NULL | |

## 5. apostles

使徒 NFT（与官方 Apostle 类型对齐，字段可逐步补全）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PRIMARY KEY | |
| token_id | VARCHAR(78) UNIQUE NOT NULL | |
| token_index | INT NOT NULL | |
| owner | VARCHAR(42) NOT NULL | |
| origin_owner | VARCHAR(42) | |
| gen | SMALLINT | 代数 |
| gender | VARCHAR(10) | |
| genes | VARCHAR(64) | |
| strength, element 等 | 见官方 Apostle / ApostleTalent | 可 JSON 或拆列 |
| current_price | VARCHAR(78) | 若在售 |
| auction_start_at | BIGINT | |
| working_status | VARCHAR(20) | |
| land_id (working) | INT | 当前工作地块 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

索引：`token_id`, `owner`。

## 6. drills

钻头 NFT（与官方 Drill 类型对齐）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PRIMARY KEY | |
| token_id | VARCHAR(78) UNIQUE NOT NULL | |
| owner | VARCHAR(42) NOT NULL | |
| origin_owner | VARCHAR(42) | |
| class / grade / formula_id / prefer | 见官方 Drill | |
| land_equip | JSONB | DrillLandEquip：land_token_id, index, equip_time 等 |
| create_time | BIGINT | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

索引：`token_id`, `owner`。

## 7. illustrated_drills

钻头图鉴（静态或配置数据，与官方 Illustrated 一致）。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT PRIMARY KEY | |
| name | VARCHAR(64) | |
| major_id | INT | |
| index | INT | |
| class | SMALLINT | |
| grade | SMALLINT | |
| pic | VARCHAR(512) | |
| productivity | JSONB | 数组 |
| minor | JSONB | LP / element 等 |
| issued | INT | 发行量 |
| sort | INT | |
| can_disenchant | BOOLEAN | |
| protection_period | INT | |

可由配置或脚本导入，非必须从链上事件索引。

## 8. land_drill_slots / land_apostle_slots（可选）

若希望「地块上装备的钻头/使徒」单独成表，可建：

- **land_drill_slots**：land_token_id, drill_token_id, slot_index, equip_time, owner
- **land_apostle_slots**：land_token_id, apostle_token_id, slot_index, …

否则可由 Mining 事件推导后写入 `lands` 的 JSON 字段或 drills/apostles 的 land_equip。

## 9. farm（可选，做 Farm 时再加）

- **farm_pools**：池子配置（staker 地址、代币、apr 等）
- **farm_stakes**：用户质押记录（addr, pool_id, amount, timestamp）
- **farm_apr_snapshots**：APR 历史，供 `/api/farm/apr` 查询

---

## 单链说明

- 所有表无需 `land_id`/`chain_id` 区分时，可省略；若预留多链则加 `chain_id = 97`（BSC Testnet）。
- 官方返回的 `district` 为大陆 ID；单链 BSC 可统一返回 `'1'` 或与前端约定单一值。
