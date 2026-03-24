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
 * @notice MiningSystemV2 — 修复产出公式 + 优化权限
 *
 *   核心修复:
 *   1. 去掉 PRECISION=1e12，修正产出公式
 *      inc[r] = rate * 1e18 * strength * boost * elapsed / (50 * 100 * 86400)
 *      rate=50, strength=50 → 每天产出 50 tokens
 *
 *   2. startMining 不再要求 land owner（任何人可以把自己的使徒放到任何地块）
 *
 *   3. stopMining 允许：
 *      - 使徒当前 owner（无论谁，只要能收到归还的使徒就行）
 *      - 土地 owner
 *      - 合约 owner（管理员）
 *
 *   4. adminStop：合约 owner 可以强制归还使徒给任意地址
 */
contract MiningSystemV2 is Ownable {
    uint256 public constant MAX_APOSTLES_PER_LAND = 5;

    ILandNFT    public land;
    IDrillNFT   public drill;
    IApostleNFT public apostle;
    address[5]  public resources;

    struct Slot {
        uint256 apostleId;
        uint256 drillId;
        uint256 startTime;
        address placer;     // 放置者地址（记录谁放的）
    }
    mapping(uint256 => Slot[MAX_APOSTLES_PER_LAND]) public slots;
    mapping(uint256 => uint256) public slotCount;
    mapping(uint256 => uint256) public apostleOnLand;
    mapping(uint256 => uint256) public drillOnLand;
    mapping(uint256 => uint256[5]) public pending;

    event MiningStarted(uint256 indexed landId, uint256 apostleId, uint256 drillId);
    event MiningStopped(uint256 indexed landId, uint256 apostleId, address to);
    event Claimed(uint256 indexed landId, address indexed owner, uint256[5] amounts);

    constructor(
        address _land, address _drill, address _apostle,
        address[5] memory _resources
    ) {
        land = ILandNFT(_land);
        drill = IDrillNFT(_drill);
        apostle = IApostleNFT(_apostle);
        resources = _resources;
    }

    // ── 开始挖矿（任何人可以放自己的使徒到任意地块）────────────────
    function startMining(uint256 landId, uint256 apostleId, uint256 drillId) external {
        require(apostle.ownerOf(apostleId) == msg.sender, "!apostle owner");
        require(apostleOnLand[apostleId] == 0, "apostle busy");
        uint256 count = slotCount[landId];
        require(count < MAX_APOSTLES_PER_LAND, "land full");

        if (drillId != 0) {
            require(drill.ownerOf(drillId) == msg.sender, "!drill owner");
            require(drillOnLand[drillId] == 0, "drill busy");
            drill.transferFrom(msg.sender, address(this), drillId);
            drillOnLand[drillId] = landId;
        }
        apostle.transferFrom(msg.sender, address(this), apostleId);
        apostleOnLand[apostleId] = landId;
        slots[landId][count] = Slot(apostleId, drillId, block.timestamp, msg.sender);
        slotCount[landId] = count + 1;
        emit MiningStarted(landId, apostleId, drillId);
    }

    // ── 停止挖矿（使徒放置者 或 土地所有者 或 合约owner 可调用）──
    function stopMining(uint256 landId, uint256 apostleId) external {
        _doStop(landId, apostleId, msg.sender);
    }

    // ── 管理员强制停止（返还到指定地址）────────────────────────────
    function adminStop(uint256 landId, uint256 apostleId, address to) external onlyOwner {
        _doStop(landId, apostleId, to);
    }

    function _doStop(uint256 landId, uint256 apostleId, address recipient) internal {
        _flushLand(landId);
        uint256 count = slotCount[landId];
        for (uint256 i = 0; i < count; i++) {
            if (slots[landId][i].apostleId == apostleId) {
                // 权限：放置者 / 土地owner / 合约owner
                address placer = slots[landId][i].placer;
                address landOwner;
                try land.ownerOf(landId) returns (address o) { landOwner = o; } catch {}
                require(
                    msg.sender == placer ||
                    msg.sender == landOwner ||
                    msg.sender == owner,
                    "!authorized"
                );
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
        }
        revert("apostle not here");
    }

    // ── 领取资源 ─────────────────────────────────────────────────────
    function claim(uint256 landId) external {
        _flushLand(landId);
        address owner_ = land.ownerOf(landId);
        uint256[5] memory amounts;
        for (uint8 r = 0; r < 5; r++) {
            uint256 amt = pending[landId][r];
            if (amt > 0) {
                pending[landId][r] = 0;
                amounts[r] = amt;
                IMintable(resources[r]).mint(owner_, amt);
            }
        }
        emit Claimed(landId, owner_, amounts);
    }

    // ── 查询待领取 ───────────────────────────────────────────────────
    function pendingRewards(uint256 landId) external view returns (uint256[5] memory res) {
        for (uint8 r = 0; r < 5; r++) res[r] = pending[landId][r];
        uint256 count = slotCount[landId];
        for (uint256 i = 0; i < count; i++) {
            Slot storage s = slots[landId][i];
            uint256 elapsed = block.timestamp - s.startTime;
            uint256[5] memory inc = _calcIncrement(landId, s, elapsed);
            for (uint8 r = 0; r < 5; r++) res[r] += inc[r];
        }
    }

    function _flushLand(uint256 landId) internal {
        uint256 count = slotCount[landId];
        for (uint256 i = 0; i < count; i++) {
            Slot storage s = slots[landId][i];
            uint256 elapsed = block.timestamp - s.startTime;
            if (elapsed == 0) continue;
            uint256[5] memory inc = _calcIncrement(landId, s, elapsed);
            for (uint8 r = 0; r < 5; r++) pending[landId][r] += inc[r];
            s.startTime = block.timestamp;
        }
    }

    // ✅ 修复后公式（无 PRECISION）
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
