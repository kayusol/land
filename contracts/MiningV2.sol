// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ── Interfaces ───────────────────────────────────────────────

interface IERC721Receiver {
    function onERC721Received(address,address,uint256,bytes calldata) external returns (bytes4);
}
interface ILandNFT {
    function ownerOf(uint256 id) external view returns (address);
    function getRate(uint256 id, uint8 res) external view returns (uint16);
    function transferFrom(address f, address t, uint256 id) external;
}
interface IDrillNFT {
    function ownerOf(uint256 id) external view returns (address);
    function attrs(uint256 id) external view returns (uint8 tier, uint8 affinity);
    function transferFrom(address f, address t, uint256 id) external;
}
interface IApostleNFT {
    function ownerOf(uint256 id) external view returns (address);
    function attrs(uint256 id) external view returns (uint8 strength, uint8 element);
    function transferFrom(address f, address t, uint256 id) external;
}
interface IMintable {
    function mint(address to, uint256 amount) external;
}

abstract contract Ownable {
    address public owner;
    constructor() { owner = msg.sender; }
    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }
    function transferOwnership(address a) external onlyOwner { require(a != address(0)); owner = a; }
}

/**
 * @notice MiningSystemV3 — 地块持有者优先权 + 手续费机制
 *
 * 核心机制：
 *
 * 1. 地块持有者优先权（landOwner priority）
 *    - 地块持有者放置的使徒标记为 isOwnerSlot = true
 *    - 槽位满时，外部使徒（isOwnerSlot=false）才能被挤走
 *    - 地块持有者的使徒永远不会被外部玩家挤走
 *    - 地块持有者可以主动挤走任何外部使徒
 *
 * 2. 手续费机制（land fee）
 *    - 外部玩家（非地块持有者）在地块上挖矿，产出的 landFeeBps（默认1000=10%）
 *      自动计入土地持有者的待领取份额（pendingLandFee）
 *    - 地块持有者自己的使徒：100% 归地块持有者，无手续费
 *    - 外部玩家通过 claimMiner(landId) 领取自己的 minerPending
 *    - 地块持有者通过 claim(landId) 领取自己挖矿产出 + 所有累计手续费
 *
 * 3. 产出分离存储
 *    - pending[landId][r]：地块持有者自己使徒的待领取（100%归持有者）
 *    - minerPending[placer][landId][r]：外部矿工的待领取（90%归矿工）
 *    - landFeePending[landId][r]：从外部矿工产出中提取的手续费（10%归持有者）
 *
 * 4. 挤占规则
 *    - 地块持有者放置使徒：槽位满时，优先挤走力量最低的外部使徒
 *    - 外部玩家放置使徒：只能挤走比自己力量低的外部使徒（不能挤地块持有者的使徒）
 */
contract MiningSystemV3 is Ownable {
    uint256 public constant MAX_APOSTLES_PER_LAND = 5;

    // 手续费比例（外部矿工产出中提取给地块持有者）
    // 1000 = 10%，可由管理员调整
    uint256 public landFeeBps = 1000;
    uint256 public constant BPS = 10000;

    ILandNFT    public land;
    IDrillNFT   public drill;
    IApostleNFT public apostle;
    address[5]  public resources;

    struct Slot {
        uint256 apostleId;
        uint256 drillId;
        uint256 startTime;
        address placer;        // 放置者地址
        bool    isOwnerSlot;   // true = 地块持有者自己放的（受保护，不可被挤走）
    }

    mapping(uint256 => Slot[MAX_APOSTLES_PER_LAND]) public slots;
    mapping(uint256 => uint256) public slotCount;
    mapping(uint256 => uint256) public apostleOnLand;
    mapping(uint256 => uint256) public drillOnLand;

    // 地块持有者自己的挖矿待领取（100%归持有者）
    mapping(uint256 => uint256[5]) public pending;

    // 外部矿工的待领取（矿工扣除手续费后的90%）
    // minerPending[placer][landId][resource]
    mapping(address => mapping(uint256 => uint256[5])) public minerPending;

    // 地块持有者从外部矿工收取的手续费待领取（10%）
    mapping(uint256 => uint256[5]) public landFeePending;

    event MiningStarted(uint256 indexed landId, uint256 apostleId, uint256 drillId, address placer, bool isOwnerSlot);
    event MiningStopped(uint256 indexed landId, uint256 apostleId, address to);
    event Claimed(uint256 indexed landId, address indexed claimer, uint256[5] amounts);
    event MinerClaimed(uint256 indexed landId, address indexed miner, uint256[5] amounts);
    event LandFeeBpsUpdated(uint256 newBps);

    constructor(
        address _land, address _drill, address _apostle,
        address[5] memory _resources
    ) {
        land    = ILandNFT(_land);
        drill   = IDrillNFT(_drill);
        apostle = IApostleNFT(_apostle);
        resources = _resources;
    }

    // ── 管理员调整手续费比例 ────────────────────────────────────────
    function setLandFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 3000, "max 30%");
        landFeeBps = bps;
        emit LandFeeBpsUpdated(bps);
    }

    // ── 开始挖矿 ────────────────────────────────────────────────────
    /**
     * 任何人持有自己的使徒即可放到任意已铸造地块挖矿。
     *
     * 槽位满时的挤占规则：
     * - 如果是地块持有者放置：可以挤走任意外部使徒中力量最低的
     * - 如果是外部玩家放置：只能挤走比自己力量低的外部使徒（不能挤持有者的使徒）
     */
    function startMining(uint256 landId, uint256 apostleId, uint256 drillId) external {
        require(apostle.ownerOf(apostleId) == msg.sender, "!apostle owner");
        require(apostleOnLand[apostleId] == 0, "apostle busy");

        // 判断是否为地块持有者
        address landOwner;
        try land.ownerOf(landId) returns (address o) { landOwner = o; } catch {}
        require(landOwner != address(0), "land not minted");
        bool isOwner = (msg.sender == landOwner);

        uint256 count = slotCount[landId];

        // 槽位满时尝试挤占
        if (count >= MAX_APOSTLES_PER_LAND) {
            (uint8 newStr,) = apostle.attrs(apostleId);
            uint256 weakestIdx = type(uint256).max;
            uint8   weakestStr = type(uint8).max;

            for (uint256 i = 0; i < count; i++) {
                Slot storage s = slots[landId][i];
                // 地块持有者的槽位：外部玩家不能挤，地块持有者自己也不需要挤自己的
                if (s.isOwnerSlot && !isOwner) continue;
                // 地块持有者挤占：只挤外部使徒（isOwnerSlot=false）
                if (isOwner && s.isOwnerSlot) continue;
                (uint8 existStr,) = apostle.attrs(s.apostleId);
                if (existStr < weakestStr) {
                    weakestStr = existStr;
                    weakestIdx = i;
                }
            }

            // 检查能否挤占
            if (weakestIdx == type(uint256).max) {
                revert("land full: no evictable slot");
            }
            require(newStr > weakestStr, "strength too low to evict");

            // 执行挤占：先结算被挤使徒的挖矿收益，再归还
            _flushSlot(landId, weakestIdx);
            Slot storage evicted = slots[landId][weakestIdx];
            uint256 evictedApoId = evicted.apostleId;
            uint256 evictedDrlId = evicted.drillId;
            address evictedPlacer = evicted.placer;

            apostle.transferFrom(address(this), evictedPlacer, evictedApoId);
            apostleOnLand[evictedApoId] = 0;
            if (evictedDrlId != 0) {
                drill.transferFrom(address(this), evictedPlacer, evictedDrlId);
                drillOnLand[evictedDrlId] = 0;
            }
            emit MiningStopped(landId, evictedApoId, evictedPlacer);

            // 复用这个槽位
            if (drillId != 0) {
                require(drill.ownerOf(drillId) == msg.sender, "!drill owner");
                require(drillOnLand[drillId] == 0, "drill busy");
                drill.transferFrom(msg.sender, address(this), drillId);
                drillOnLand[drillId] = landId;
            }
            apostle.transferFrom(msg.sender, address(this), apostleId);
            apostleOnLand[apostleId] = landId;
            slots[landId][weakestIdx] = Slot(apostleId, drillId, block.timestamp, msg.sender, isOwner);
            // slotCount 不变（替换了一个槽位）
            emit MiningStarted(landId, apostleId, drillId, msg.sender, isOwner);
            return;
        }

        // 槽位未满，正常放置
        if (drillId != 0) {
            require(drill.ownerOf(drillId) == msg.sender, "!drill owner");
            require(drillOnLand[drillId] == 0, "drill busy");
            drill.transferFrom(msg.sender, address(this), drillId);
            drillOnLand[drillId] = landId;
        }
        apostle.transferFrom(msg.sender, address(this), apostleId);
        apostleOnLand[apostleId] = landId;
        slots[landId][count] = Slot(apostleId, drillId, block.timestamp, msg.sender, isOwner);
        slotCount[landId] = count + 1;
        emit MiningStarted(landId, apostleId, drillId, msg.sender, isOwner);
    }

    // ── 停止挖矿 ─────────────────────────────────────────────────────
    /**
     * 权限：
     * - 放置者（placer）可以取回自己的使徒
     * - 地块持有者可以驱逐任何外部使徒（isOwnerSlot=false）
     * - 合约owner可以强制停止任何使徒
     * 注意：地块持有者不能被别人停止（只有放置者自己或合约owner）
     */
    function stopMining(uint256 landId, uint256 apostleId) external {
        _doStop(landId, apostleId, msg.sender);
    }

    function adminStop(uint256 landId, uint256 apostleId, address to) external onlyOwner {
        _doStop(landId, apostleId, to);
    }

    function _doStop(uint256 landId, uint256 apostleId, address recipient) internal {
        uint256 count = slotCount[landId];
        for (uint256 i = 0; i < count; i++) {
            if (slots[landId][i].apostleId != apostleId) continue;

            address placer    = slots[landId][i].placer;
            bool    isOwnSlot = slots[landId][i].isOwnerSlot;
            address landOwner;
            try land.ownerOf(landId) returns (address o) { landOwner = o; } catch {}

            // 权限检查：
            // 1. 放置者本人可以取回
            // 2. 地块持有者可以驱逐外部使徒（非 isOwnerSlot）
            // 3. 合约owner可以驱逐任何人
            bool byPlacer    = (msg.sender == placer);
            bool byLandOwner = (msg.sender == landOwner && !isOwnSlot);
            bool byAdmin     = (msg.sender == owner);
            require(byPlacer || byLandOwner || byAdmin, "!authorized");

            // 先结算收益
            _flushSlot(landId, i);

            uint256 drillId = slots[landId][i].drillId;
            apostle.transferFrom(address(this), recipient, apostleId);
            apostleOnLand[apostleId] = 0;
            if (drillId != 0) {
                drill.transferFrom(address(this), recipient, drillId);
                drillOnLand[drillId] = 0;
            }
            slots[landId][i] = slots[landId][count-1];
            delete slots[landId][count-1];
            slotCount[landId] = count - 1;
            emit MiningStopped(landId, apostleId, recipient);
            return;
        }
        revert("apostle not here");
    }

    // ── 地块持有者领取（自己挖矿产出 + 手续费收入）──────────────────
    function claim(uint256 landId) external {
        _flushLand(landId);
        address landOwner = land.ownerOf(landId);
        require(msg.sender == landOwner || msg.sender == owner, "!land owner");

        uint256[5] memory amounts;
        for (uint8 r = 0; r < 5; r++) {
            uint256 own  = pending[landId][r];
            uint256 fee  = landFeePending[landId][r];
            uint256 total = own + fee;
            if (total > 0) {
                pending[landId][r]     = 0;
                landFeePending[landId][r] = 0;
                amounts[r] = total;
                IMintable(resources[r]).mint(landOwner, total);
            }
        }
        emit Claimed(landId, landOwner, amounts);
    }

    // ── 外部矿工领取自己的挖矿收益 ────────────────────────────────────
    function claimMiner(uint256 landId) external {
        _flushLand(landId);
        uint256[5] memory amounts;
        for (uint8 r = 0; r < 5; r++) {
            uint256 amt = minerPending[msg.sender][landId][r];
            if (amt > 0) {
                minerPending[msg.sender][landId][r] = 0;
                amounts[r] = amt;
                IMintable(resources[r]).mint(msg.sender, amt);
            }
        }
        emit MinerClaimed(landId, msg.sender, amounts);
    }

    // ── 查询待领取（地块持有者视角：自己挖矿+手续费）────────────────
    function pendingRewards(uint256 landId) external view returns (uint256[5] memory res) {
        for (uint8 r = 0; r < 5; r++) {
            res[r] = pending[landId][r] + landFeePending[landId][r];
        }
        uint256 count = slotCount[landId];
        address landOwner;
        try land.ownerOf(landId) returns (address o) { landOwner = o; } catch {}

        for (uint256 i = 0; i < count; i++) {
            Slot storage s = slots[landId][i];
            uint256 elapsed = block.timestamp - s.startTime;
            uint256[5] memory inc = _calcIncrement(landId, s, elapsed);
            if (s.isOwnerSlot) {
                // 地块持有者自己的使徒：全部产出归持有者
                for (uint8 r = 0; r < 5; r++) res[r] += inc[r];
            } else {
                // 外部矿工：手续费部分归持有者
                for (uint8 r = 0; r < 5; r++) {
                    res[r] += inc[r] * landFeeBps / BPS;
                }
            }
        }
    }

    // ── 查询矿工待领取 ────────────────────────────────────────────────
    function pendingMinerRewards(address miner, uint256 landId) external view returns (uint256[5] memory res) {
        for (uint8 r = 0; r < 5; r++) res[r] = minerPending[miner][landId][r];
        uint256 count = slotCount[landId];
        for (uint256 i = 0; i < count; i++) {
            Slot storage s = slots[landId][i];
            if (s.placer != miner || s.isOwnerSlot) continue;
            uint256 elapsed = block.timestamp - s.startTime;
            uint256[5] memory inc = _calcIncrement(landId, s, elapsed);
            for (uint8 r = 0; r < 5; r++) {
                res[r] += inc[r] * (BPS - landFeeBps) / BPS;
            }
        }
    }

    // ── 内部：结算整块地 ─────────────────────────────────────────────
    function _flushLand(uint256 landId) internal {
        uint256 count = slotCount[landId];
        for (uint256 i = 0; i < count; i++) {
            _flushSlot(landId, i);
        }
    }

    // ── 内部：结算单个槽位 ───────────────────────────────────────────
    function _flushSlot(uint256 landId, uint256 slotIdx) internal {
        Slot storage s = slots[landId][slotIdx];
        uint256 elapsed = block.timestamp - s.startTime;
        if (elapsed == 0) return;

        uint256[5] memory inc = _calcIncrement(landId, s, elapsed);

        if (s.isOwnerSlot) {
            // 地块持有者自己的使徒：全部加入 pending
            for (uint8 r = 0; r < 5; r++) {
                pending[landId][r] += inc[r];
            }
        } else {
            // 外部矿工：按比例分配
            for (uint8 r = 0; r < 5; r++) {
                if (inc[r] == 0) continue;
                uint256 fee    = inc[r] * landFeeBps / BPS;
                uint256 miner  = inc[r] - fee;
                landFeePending[landId][r]            += fee;
                minerPending[s.placer][landId][r]    += miner;
            }
        }

        s.startTime = block.timestamp;
    }

    // ── 计算增量（无 PRECISION，正确公式）───────────────────────────
    function _calcIncrement(uint256 landId, Slot storage s, uint256 elapsed)
        internal view returns (uint256[5] memory inc)
    {
        (uint8 strength,) = apostle.attrs(s.apostleId);
        uint8 drillTier; uint8 drillAff; bool hasDrill = s.drillId != 0;
        if (hasDrill) (drillTier, drillAff) = drill.attrs(s.drillId);
        for (uint8 r = 0; r < 5; r++) {
            uint256 rate = land.getRate(landId, r);
            if (rate == 0) continue;
            uint256 boost = 100;
            if (hasDrill && drillAff == r) boost += uint256(drillTier) * 20;
            inc[r] = rate * 1e18 * uint256(strength) * boost * elapsed / (50 * 100 * 86400);
        }
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }
}
