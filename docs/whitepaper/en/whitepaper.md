# Columbus Land — White Paper

**Version 1.0 | March 2026**

---

> *"My name is EVE. I am the mother of all. I am in charge of all the resources and lives in Columbus Land. I am not a person or a group of people, nor a Goddess. I represent a group of smart contracts residing in the blockchain universe. I am destined to watch and guard this space. Trust no one, not even me — trust the code."*

---

## What is Columbus Land?

Columbus Land is a blockchain-based virtual land strategy game built on **BNB Smart Chain (BSC)**. Players can purchase land parcels, deploy Apostles as miners, extract five elemental resources, craft equipment, breed apostles, and trade all assets freely in the marketplace.

The game runs entirely on-chain. All land ownership, apostle genetics, resource balances, and transaction history are recorded on the blockchain — permanently, transparently, and without any possibility of tampering by the development team. You truly own what you hold.

**Game address:** https://ringland.vercel.app

---

## The World

Columbus Land exists on **BSC**, the first of what may become multiple continents across different blockchain networks. The continent is named the **Columbus Continent** — a vast landmass containing **10,000 parcels** (a 100×100 grid) of unique terrain.

Each parcel of land contains hidden reserves of five elemental resources. When you purchase land, you are acquiring a productive asset that generates resources every day your apostles are deployed on it.

The world is governed by smart contracts. There is no central authority. The rules encoded at deployment cannot be changed without community governance.

---

## Land


Land is the core asset of Columbus Land. Each land parcel is an **NFT (ERC-721)** on BSC. When you purchase land, the token is transferred to your wallet — and you become the sole owner.

### Size and Structure

Each land parcel is a unique plot on the Columbus Continent grid. Every parcel has its own coordinate (x, y) and a unique set of five resource reserves. No two parcels are identical.

### Resource Reserves

Every land parcel holds reserves of the five elemental resources: **GOLD, WOOD, HHO (Water), FIRE,** and **SIOO (Soil)**. The reserve values determine the **maximum rate at which resources can be mined per day** — the higher the reserve, the more resources your apostles can extract.

Resource reserves are indicated by a value called **MRAR (Max Resource Attenuation Rate)**, which represents the ceiling of daily production at full mining speed.

### Land as a Mining Pool

From a DeFi perspective, each land parcel is a **mining pool**. You deploy Apostles and Drills to extract resources. Resources extracted from the land can be traded on the marketplace or used to forge equipment and upgrade your apostles.

### Land Ownership

Land ownership is fully on-chain. You can:
- Deploy apostles to mine resources
- Transfer your land to another player as a gift
- List your land on the marketplace for auction
- Charge your land with elemental resources to permanently increase its reserve values (+20 per charge)

### Mining Fee

When external players (non-owners) deploy their apostles on your land, they contribute to your income. The landowner receives **10% of all resources mined by external apostles** on their land as an automatic fee. This creates a passive income stream for landowners with highly productive parcels.

### Land Colors on the Map

| Color | Meaning |
|-------|---------|
| 🟠 Orange | Your land |
| 🔴 Red | Your land listed for auction |
| 🟢 Green | Land for sale (second-hand auction) |
| 🟣 Purple | Another player's land |
| ⬛ Dark | Unminted / unclaimed |

---

## Apostle

The Apostle is your worker — the entity that actually mines resources from the land. Each Apostle is an **NFT (ERC-721)** with unique genetic attributes.

### Lore

The story begins in the future. Scientists predicted an extinction-level meteorite impact on Earth. Before catastrophe struck, humanity created **EVE** — the first truly self-aware artificial intelligence — to manage a space station named LAND, carrying the DNA of all life on Earth. After years adrift in space, the LAND discovered a habitable galaxy.

You are a fragment of human consciousness preserved in the system. Your Apostles are the new humanity, born from synthetic wombs, carrying the memories and traits of the original eighteen astronauts. They are your miners, builders, and warriors.

### Apostle Attributes

**Strength** determines mining efficiency. The higher the strength, the more resources an apostle extracts per day:

| Strength Range | Mining Efficiency |
|---------------|------------------|
| 1 – 30 | ×0.85 |
| 31 – 50 | ×1.00 |
| 51 – 70 | ×1.10 |
| 71 – 85 | ×1.20 |
| 86 – 100 | ×1.40 |

**Elemental Affinity** — each apostle belongs to one of five elements (GOLD / WOOD / HHO / FIRE / SIOO). An apostle mines the most efficiently in their matching element.

**Genes** — every apostle carries a genetic code that determines ten talents including mining power, combat strength, luck, vitality, and more. Genes are inherited through breeding.

### Getting an Apostle

1. **Marketplace** — purchase an apostle listed by another player in the Dutch auction market
2. **Blind Box** — spend RING to open a blind box and receive a random apostle

### Upgrading an Apostle

Apostles can be upgraded by consuming elemental tokens matching their affinity:

| Current Stars | Strength Range | Element Cost |
|--------------|----------------|-------------|
| ★ | 1 – 30 | 100 |
| ★★ | 31 – 50 | 200 |
| ★★★ | 51 – 70 | 400 |
| ★★★★ | 71 – 85 | 800 |

### Breeding

Two apostles — one male, one female — can breed to produce offspring. The child inherits genes from both parents, with a chance of genetic variation. Breeding opens the possibility of apostles with exceptional attributes that cannot be obtained any other way.

---

## Drill (Equipment)

The Drill is the mining tool equipped to an apostle. Each Drill is an **NFT** with a tier level (★ to ★★★★★) and an elemental affinity. Equipping an apostle with a drill significantly increases their mining output.

| Drill Tier | Mining Bonus |
|-----------|-------------|
| ★ | Base |
| ★★ | Enhanced |
| ★★★ | Strong |
| ★★★★ | Powerful |
| ★★★★★ | ×1.5 output |

### Upgrading Drills (Furnace)

Three drills of the **same tier and same elemental affinity** can be merged in the Furnace to produce one drill of the next tier. A resource cost is also required:

| Target Tier | Materials | Element Cost |
|------------|-----------|-------------|
| ★★ | 3× ★ same element | 300 |
| ★★★ | 3× ★★ same element | 600 |
| ★★★★ | 3× ★★★ same element | 1,200 |
| ★★★★★ | 3× ★★★★ same element | 2,400 |

---

## Resources

Five elemental resources are the lifeblood of Columbus Land. They are mined from land parcels by apostles, consumed in upgrades, and traded freely between players.

| Resource | Symbol | Color |
|---------|--------|-------|
| Gold | GOLD | 🟡 |
| Wood | WOOD | 🟢 |
| Water | HHO | 🔵 |
| Fire | FIRE | 🔴 |
| Soil | SIOO | 🟤 |

Each resource is an **ERC-20 token** on BSC. Resources have real utility:

- **Apostle upgrades** — consume the matching elemental resource
- **Drill merging** — consume the matching elemental resource
- **Land charging** — consume any elemental resource to permanently boost that element's reserve on your land

### Land Charging

By spending elemental resources, a landowner can permanently increase the MRAR of their land's corresponding element by **+20 per charge**. This makes the land more productive — generating more resources per day for any apostle working it.

Charging has a cooldown of **90 days per parcel per element**.

| Current Grade | Attribute Range | Resource Cost |
|--------------|-----------------|--------------|
| C → B | < 40 | 500 |
| B → A | 40 – 59 | 2,000 |
| A → S | 60 – 79 | 8,000 |

---

## Tokens

### RING

RING is the platform's primary currency, used for:
- Purchasing land, apostles, and drills in the marketplace
- Purchasing blind boxes
- All NFT auction transactions

| Contract | Address |
|---------|---------|
| RING | `0x3fa38920EED345672dF7FF916b5EbE4f095822aE` |

### Elemental Resources (ERC-20)

| Token | Symbol | Contract |
|-------|--------|---------|
| Gold | GOLD | `0x5E4b633ae293ec4e000B5934D68997E45D8Bc0B9` |
| Wood | WOOD | `0xD91824b6130DdEf7ffd6b07C1AeFD1ebA60A3b37` |
| Water | HHO | `0x2FFac338404fadd6c551AcED8197E781Ffa6205C` |
| Fire | FIRE | `0xc2d43F4655320227DaeaA0475E3254C83892D487` |
| Soil | SIOO | `0x865607c7d948655a32da9bE40c70A16Ecae35572` |

---

## Marketplace

All NFT trading in Columbus Land uses a **Dutch auction** format:

1. The seller sets a starting price and a floor price
2. The price decreases linearly over the auction duration
3. Any buyer can purchase at the current price at any time
4. No bidding wars, no front-running — just a fair, transparent price discovery mechanism

You can list and buy: **Land**, **Apostles**, and **Drills**.

---

## Blind Box

Blind boxes allow players to obtain apostles and drills without purchasing them in the secondary market. Spend RING, open a box, receive a random NFT. The rarity of the outcome is determined by verifiable on-chain randomness.

---

## Smart Contracts

All Columbus Land contracts are deployed on **BNB Smart Chain Testnet (Chain ID: 97)** during the current beta phase. Mainnet deployment follows successful validation.

| Contract | Address |
|---------|---------|
| Land NFT | `0x889DCe5b3934D56f3814f93793F8e1f8710249ea` |
| Apostle NFT | `0xbBce394d561E67bA9C0720d3aD56b25bC12Ee4f0` |
| Drill NFT | `0x782827AdA353d4f958964e1E10D5d940e4B38409` |
| Mining System V3 | `0x984337501c1cb1f891c3dae3dcd1e0e9c2b1d228` |
| NFT Auction | `0xe489Fd17B4aBF3b22482Bf0f09193f9902f1fd22` |
| Upgrade System | `0xd8083a57b479bb920d52f0db2257936023b49ea7` |
| Blind Box | `0xfa15ce0b6021f84f93e355e6ab22346f7534f049` |
| Land Metadata | `0xad2f254ea1068800b982c2f2e705fcb5960b4625` |

All contracts are open-source. The development team has no ability to withdraw player funds or modify core game logic post-deployment.

---

## Roadmap

| Phase | Status |
|-------|--------|
| Core contracts deployment | ✅ Complete |
| Web application (map, marketplace, assets) | ✅ Complete |
| Blind box system | ✅ Complete |
| Upgrade & furnace system | ✅ Complete |
| Dutch auction marketplace | ✅ Complete |
| On-chain land metadata | ✅ Complete |
| Community testnet open beta | 🔄 In Progress |
| BSC Mainnet deployment | 🔜 Upcoming |
| LP pools (RING / 5 elements) | 🔜 Upcoming |
| Apostle breeding system | 🔜 Upcoming |
| Rental system | 🔜 Upcoming |
| Mobile app | 🔜 Upcoming |

---

## Get Started

1. Install **MetaMask** — https://metamask.io
2. Add **BSC Testnet** (Chain ID: 97, RPC: https://bsc-testnet-rpc.publicnode.com)
3. Get test BNB — https://testnet.bnbchain.org/faucet-smart
4. Open the game — https://ringland.vercel.app
5. Connect wallet → buy land → get an apostle → start mining

---

*Columbus Land is in active development. Features and parameters described here reflect the current testnet state and may be adjusted before mainnet launch.*
