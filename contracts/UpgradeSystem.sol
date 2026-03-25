// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title UpgradeSystem
 * @notice 进化星球升级系统
 * 实现白皮书核心消耗机制：
 * 1. 使徒升星：消耗对应属性元素 (1→2: 100, 2→3: 200, 3→4: 400, 4→5: 800)
 * 2. 钻头合成升星：3个低星+元素→1个高星 (1→2: 300, 2→3: 600, 3→4: 1200, 4→5: 2400)
 * 3. 地块属性充能：消耗主属性元素提升产出 (C→B: 500, B→A: 2000, A→S: 8000)
 */

interface IERC20Burn {
    function balanceOf(address a) external view returns (uint256);
    function transferFrom(address f, address t, uint256 v) external returns (bool);
    function burn(address f, uint256 v) external;
}

interface IApostleUpgrade {
    function ownerOf(uint256 id) external view returns (address);
    function attrs(uint256 id) external view returns (uint8 strength, uint8 element, uint8 gender, uint16 gen, uint64 genes, uint64 birthTime, uint64 cooldown, uint32 motherId, uint32 fatherId);
    function upgradeStrength(uint256 id, uint8 newStrength) external;
}

interface IDrillUpgrade {
    function ownerOf(uint256 id) external view returns (address);
    function attrs(uint256 id) external view returns (uint8 tier, uint8 affinity);
    function burn(uint256 id) external;
    function mint(address to, uint8 tier, uint8 affinity) external returns (uint256);
}

interface ILandUpgrade {
    function ownerOf(uint256 id) external view returns (address);
    function getRate(uint256 id, uint8 res) external view returns (uint16);
    function upgradeAttr(uint256 id, uint8 res, uint16 addVal) external;
}

abstract contract Ownable {
    address public owner;
    constructor() { owner = msg.sender; }
    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }
    function transferOwnership(address a) external onlyOwner { require(a != address(0)); owner = a; }
}

contract UpgradeSystem is Ownable {

    // ── 合约引用 ──────────────────────────────────────────────────────
    address[5] public elementTokens; // [GOLD, WOOD, HHO, FIRE, SIOO]
    IApostleUpgrade public apostle;
    IDrillUpgrade   public drill;
    ILandUpgrade    public land;

    // ── 费用参数（可管理员调整）──────────────────────────────────────
    // 使徒升星消耗元素: starUpgradeCost[fromStar] = 元素量(1e18)
    uint256[5] public apostleUpgradeCost = [0, 100e18, 200e18, 400e18, 800e18]; // index=当前星级

    // 钻头合成消耗元素: drillMergeCost[fromTier] = 元素量(1e18)
    uint256[5] public drillMergeCost = [0, 300e18, 600e18, 1200e18, 2400e18];

    // 地块充能消耗: landChargeCost[currentGrade] = 元素量(1e18)
    // grade: 0=C, 1=B, 2=A (S级无法再升)
    uint256[3] public landChargeCost = [500e18, 2000e18, 8000e18];

    // 地块充能冷却（每纪元90天一次）
    uint256 public constant EPOCH_DURATION = 90 days;
    mapping(uint256 => uint256) public landLastCharge; // landId => lastChargeTimestamp

    // 地块属性升级后增加的值（每次充能）
    uint256 public constant CHARGE_BOOST = 20; // +20 属性值

    // ── 事件 ─────────────────────────────────────────────────────────
    event ApostleUpgraded(uint256 indexed id, uint8 fromStar, uint8 toStar, uint8 element, uint256 elementBurned);
    event DrillMerged(uint256 indexed newId, uint256[3] burnedIds, uint8 tier, uint8 affinity, uint256 elementBurned);
    event LandCharged(uint256 indexed landId, uint8 element, uint256 elementBurned, uint8 newGrade);

    constructor(
        address[5] memory _elements,
        address _apostle,
        address _drill,
        address _land
    ) {
        elementTokens = _elements;
        apostle = IApostleUpgrade(_apostle);
        drill   = IDrillUpgrade(_drill);
        land    = ILandUpgrade(_land);
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. 使徒升星
    // ═══════════════════════════════════════════════════════════════
    /**
     * @notice 使徒升星：消耗对应属性元素，力量+提升
     * @param apostleId 使徒 ID
     * @param currentStar 当前星级（1-4，最高5星无法再升）
     * 升星效果：力量每星提升 ~10-15 点
     */
    function upgradeApostle(uint256 apostleId, uint8 currentStar) external {
        require(apostle.ownerOf(apostleId) == msg.sender, "!apostle owner");
        require(currentStar >= 1 && currentStar <= 4, "invalid star");

        (uint8 strength, uint8 element,,,,,,,) = apostle.attrs(apostleId);
        require(strength > 0, "invalid apostle");

        uint256 cost = apostleUpgradeCost[currentStar];
        require(cost > 0, "no cost set");

        // 消耗对应元素
        IERC20Burn token = IERC20Burn(elementTokens[element]);
        require(token.balanceOf(msg.sender) >= cost, "insufficient element");
        token.burn(msg.sender, cost);

        // 升级力量：每星提升 10-15 点，封顶 100
        uint8 boost = 10 + currentStar * 2; // 1星+12, 2星+14, 3星+16, 4星+18
        uint8 newStrength = strength + boost > 100 ? 100 : strength + boost;
        apostle.upgradeStrength(apostleId, newStrength);

        emit ApostleUpgraded(apostleId, currentStar, currentStar + 1, element, cost);
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. 钻头合成升星
    // ═══════════════════════════════════════════════════════════════
    /**
     * @notice 3个同星级+同属性钻头 + 元素 → 1个高一星钻头
     * @param drillIds 要销毁的3个钻头ID（必须同星级同属性，必须你持有）
     */
    function mergedrills(uint256[3] calldata drillIds) external {
        // 验证：必须是3个相同tier和affinity的钻头
        uint8 tier0; uint8 aff0;
        for (uint8 i = 0; i < 3; i++) {
            require(drill.ownerOf(drillIds[i]) == msg.sender, "!drill owner");
            (uint8 t, uint8 a) = drill.attrs(drillIds[i]);
            if (i == 0) { tier0 = t; aff0 = a; }
            else { require(t == tier0 && a == aff0, "mismatched drills"); }
        }
        require(tier0 >= 1 && tier0 <= 4, "max tier");

        uint256 cost = drillMergeCost[tier0];
        IERC20Burn token = IERC20Burn(elementTokens[aff0]);
        require(token.balanceOf(msg.sender) >= cost, "insufficient element");

        // 消耗元素
        token.burn(msg.sender, cost);

        // 销毁3个低星钻头
        for (uint8 i = 0; i < 3; i++) {
            drill.burn(drillIds[i]);
        }

        // 铸造1个高星钻头
        uint256 newId = drill.mint(msg.sender, tier0 + 1, aff0);

        emit DrillMerged(newId, drillIds, tier0 + 1, aff0, cost);
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. 地块属性充能
    // ═══════════════════════════════════════════════════════════════
    /**
     * @notice 消耗主属性元素为地块充能，提升该元素的产出属性值
     * @param landId 地块ID
     * @param element 要充能的元素索引(0-4)
     */
    function chargeLand(uint256 landId, uint8 element) external {
        require(land.ownerOf(landId) == msg.sender, "!land owner");
        require(element <= 4, "invalid element");

        // 冷却检查：每个纪元（90天）只能充能一次
        require(
            block.timestamp >= landLastCharge[landId] + EPOCH_DURATION,
            "charge cooldown"
        );

        // 判断当前等级（根据该元素属性值）
        uint16 currentRate = land.getRate(landId, element);
        uint8 grade = _getGrade(currentRate);
        require(grade < 3, "already max grade"); // S级无法再升

        uint256 cost = landChargeCost[grade];
        IERC20Burn token = IERC20Burn(elementTokens[element]);
        require(token.balanceOf(msg.sender) >= cost, "insufficient element");

        // 消耗元素
        token.burn(msg.sender, cost);

        // 提升地块属性
        land.upgradeAttr(landId, element, uint16(CHARGE_BOOST));
        landLastCharge[landId] = block.timestamp;

        uint8 newGrade = _getGrade(currentRate + uint16(CHARGE_BOOST));
        emit LandCharged(landId, element, cost, newGrade);
    }

    // ── 查询剩余冷却时间 ────────────────────────────────────────────
    function chargeCountdown(uint256 landId) external view returns (uint256) {
        uint256 next = landLastCharge[landId] + EPOCH_DURATION;
        if (block.timestamp >= next) return 0;
        return next - block.timestamp;
    }

    // ── 内部：根据属性值判断等级 ────────────────────────────────────
    function _getGrade(uint16 rate) internal pure returns (uint8) {
        if (rate >= 80) return 3; // S
        if (rate >= 60) return 2; // A
        if (rate >= 40) return 1; // B
        return 0;                 // C
    }

    // ── 管理员更新费用 ───────────────────────────────────────────────
    function setApostleUpgradeCost(uint8 star, uint256 cost) external onlyOwner {
        apostleUpgradeCost[star] = cost;
    }
    function setDrillMergeCost(uint8 tier, uint256 cost) external onlyOwner {
        drillMergeCost[tier] = cost;
    }
    function setLandChargeCost(uint8 grade, uint256 cost) external onlyOwner {
        landChargeCost[grade] = cost;
    }
}
