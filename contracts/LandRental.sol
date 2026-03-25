// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LandRental
 * @notice 进化星球土地租赁市场
 * 机制：
 * - 地块持有者可将地块挂出租赁
 * - 租户缴纳押金(50 RING)获得3个月使用权
 * - 挖矿收益：70%归租户，30%归原地块持有者
 * - 项目方抽取5%平台费
 * - 押金到期后返还（扣除1 RING损耗费）
 */

interface IERC20Rental {
    function balanceOf(address a) external view returns (uint256);
    function transferFrom(address f, address t, uint256 v) external returns (bool);
    function transfer(address t, uint256 v) external returns (bool);
}

interface ILandRental {
    function ownerOf(uint256 id) external view returns (address);
    function transferFrom(address from, address to, uint256 id) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

abstract contract Ownable {
    address public owner;
    constructor() { owner = msg.sender; }
    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }
    function transferOwnership(address a) external onlyOwner { require(a != address(0)); owner = a; }
}

contract LandRental is Ownable {

    ILandRental public land;
    IERC20Rental public ring;

    // ── 参数 ──────────────────────────────────────────────────────
    uint256 public constant RENTAL_DURATION = 90 days;     // 3个月
    uint256 public depositAmount     = 50e18;               // 50 RING押金
    uint256 public depositDeduction  = 1e18;                // 1 RING损耗费
    uint256 public platformFeeBps    = 500;                 // 5% 平台费
    uint256 public ownerShareBps     = 3000;                // 30% 给地块持有者
    uint256 public constant BPS      = 10000;

    struct RentalListing {
        address landOwner;       // 土地所有者
        uint256 listPrice;       // 月租金(RING)，0=免费仅靠押金
        bool    active;          // 是否可租
    }

    struct ActiveRental {
        address tenant;          // 租户
        address landOwner;       // 土地原持有者
        uint256 startTime;       // 开始时间
        uint256 endTime;         // 到期时间
        uint256 deposit;         // 押金金额
    }

    mapping(uint256 => RentalListing) public listings;    // landId => listing
    mapping(uint256 => ActiveRental)  public rentals;     // landId => rental
    uint256[] public listedLands;
    mapping(uint256 => bool) public isListed;

    bool private _lock;

    // ── 事件 ──────────────────────────────────────────────────────
    event LandListed(uint256 indexed landId, address owner, uint256 listPrice);
    event LandUnlisted(uint256 indexed landId);
    event LandRented(uint256 indexed landId, address tenant, uint256 endTime, uint256 deposit);
    event RentalEnded(uint256 indexed landId, address tenant, bool expired, uint256 depositReturned);
    event RevenueDistributed(uint256 indexed landId, uint256 totalAmount, uint256 toTenant, uint256 toOwner, uint256 toPlatform);

    modifier noReentrant() { require(!_lock, "reentrant"); _lock = true; _; _lock = false; }

    constructor(address _land, address _ring) {
        land = ILandRental(_land);
        ring = IERC20Rental(_ring);
    }

    // ═══════════════════════════════════════════════════════════════
    // 地块持有者操作
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice 挂出地块供租赁（需要先授权此合约）
     * @param landId 地块ID
     * @param listPrice 额外月租金（0=仅靠押金盈利）
     */
    function listForRent(uint256 landId, uint256 listPrice) external {
        require(land.ownerOf(landId) == msg.sender, "!land owner");
        require(!listings[landId].active, "already listed");
        require(!_hasActiveRental(landId), "has active rental");

        // 地块托管到合约
        land.transferFrom(msg.sender, address(this), landId);

        listings[landId] = RentalListing(msg.sender, listPrice, true);

        if (!isListed[landId]) {
            listedLands.push(landId);
            isListed[landId] = true;
        }

        emit LandListed(landId, msg.sender, listPrice);
    }

    /**
     * @notice 取消挂单（地块归还）
     */
    function unlist(uint256 landId) external noReentrant {
        RentalListing storage l = listings[landId];
        require(l.active, "!listed");
        require(l.landOwner == msg.sender || msg.sender == owner, "!auth");
        require(!_hasActiveRental(landId), "has active rental");

        l.active = false;
        land.transferFrom(address(this), l.landOwner, landId);

        emit LandUnlisted(landId);
    }

    // ═══════════════════════════════════════════════════════════════
    // 租户操作
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice 租赁地块，缴纳押金
     */
    function rent(uint256 landId) external noReentrant {
        RentalListing storage l = listings[landId];
        require(l.active, "!listed");
        require(!_hasActiveRental(landId), "already rented");

        uint256 totalCost = depositAmount + l.listPrice;
        require(ring.balanceOf(msg.sender) >= totalCost, "insufficient ring");
        ring.transferFrom(msg.sender, address(this), totalCost);

        // 月租金立即分配给土地持有者（扣5%平台费）
        if (l.listPrice > 0) {
            uint256 fee = l.listPrice * platformFeeBps / BPS;
            uint256 ownerGet = l.listPrice - fee;
            ring.transfer(l.landOwner, ownerGet);
            ring.transfer(owner, fee);
        }

        uint256 endTime = block.timestamp + RENTAL_DURATION;
        rentals[landId] = ActiveRental(msg.sender, l.landOwner, block.timestamp, endTime, depositAmount);

        emit LandRented(landId, msg.sender, endTime, depositAmount);
    }

    /**
     * @notice 租户主动结束租约（押金返还扣损耗费）
     */
    function endRental(uint256 landId) external noReentrant {
        ActiveRental storage r = rentals[landId];
        require(r.tenant == msg.sender, "!tenant");

        _finalizeRental(landId, false);
    }

    /**
     * @notice 到期后任何人可调用清算（押金返还给租户扣损耗费）
     */
    function expireRental(uint256 landId) external noReentrant {
        ActiveRental storage r = rentals[landId];
        require(r.startTime > 0, "no rental");
        require(block.timestamp >= r.endTime, "!expired");

        _finalizeRental(landId, true);
    }

    /**
     * @notice 分配挖矿收益（由挖矿合约调用）
     * 70% → 租户, 30% → 土地持有者, 5%平台费从各方按比例扣
     */
    function distributeRevenue(uint256 landId, address rewardToken, uint256 amount) external {
        // 仅允许挖矿合约调用（或owner调试用）
        // require(msg.sender == miningContract || msg.sender == owner, "!mining");
        if (amount == 0) return;
        ActiveRental storage r = rentals[landId];
        if (r.startTime == 0) return; // 无租赁则跳过

        uint256 platformCut = amount * platformFeeBps / BPS;
        uint256 remain = amount - platformCut;
        uint256 toOwner  = remain * ownerShareBps / BPS;
        uint256 toTenant = remain - toOwner;

        IERC20Rental(rewardToken).transferFrom(address(this), r.tenant, toTenant);
        IERC20Rental(rewardToken).transferFrom(address(this), r.landOwner, toOwner);
        IERC20Rental(rewardToken).transferFrom(address(this), owner, platformCut);

        emit RevenueDistributed(landId, amount, toTenant, toOwner, platformCut);
    }

    // ═══════════════════════════════════════════════════════════════
    // 查询
    // ═══════════════════════════════════════════════════════════════

    function getListedLands(uint256 offset, uint256 limit) external view
        returns (uint256[] memory ids, RentalListing[] memory info)
    {
        uint256 total = listedLands.length;
        if (offset >= total) return (new uint256[](0), new RentalListing[](0));
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256 count = end - offset;
        ids  = new uint256[](count);
        info = new RentalListing[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = listedLands[offset + i];
            info[i] = listings[ids[i]];
        }
    }

    function getRental(uint256 landId) external view returns (ActiveRental memory) {
        return rentals[landId];
    }

    function timeRemaining(uint256 landId) external view returns (uint256) {
        ActiveRental storage r = rentals[landId];
        if (r.startTime == 0 || block.timestamp >= r.endTime) return 0;
        return r.endTime - block.timestamp;
    }

    // ═══════════════════════════════════════════════════════════════
    // 内部
    // ═══════════════════════════════════════════════════════════════

    function _hasActiveRental(uint256 landId) internal view returns (bool) {
        ActiveRental storage r = rentals[landId];
        return r.startTime > 0 && block.timestamp < r.endTime;
    }

    function _finalizeRental(uint256 landId, bool expired) internal {
        ActiveRental storage r = rentals[landId];
        require(r.startTime > 0, "no rental");

        address tenant = r.tenant;
        uint256 depositReturn = r.deposit > depositDeduction
            ? r.deposit - depositDeduction
            : 0;

        // 返还押金
        if (depositReturn > 0) ring.transfer(tenant, depositReturn);
        // 损耗费给土地持有者
        if (depositDeduction > 0) ring.transfer(r.landOwner, depositDeduction);

        delete rentals[landId];

        emit RentalEnded(landId, tenant, expired, depositReturn);
    }

    // ── 管理员参数 ────────────────────────────────────────────────
    function setDeposit(uint256 amount, uint256 deduction) external onlyOwner {
        depositAmount = amount;
        depositDeduction = deduction;
    }
    function setPlatformFee(uint256 bps) external onlyOwner {
        require(bps <= 1000, "max 10%");
        platformFeeBps = bps;
    }
    function setOwnerShare(uint256 bps) external onlyOwner {
        require(bps <= 5000, "max 50%");
        ownerShareBps = bps;
    }
}
