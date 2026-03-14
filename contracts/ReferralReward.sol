// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ReferralReward
 * @notice 5级邀请奖励合约
 *
 * 奖励比例（下级挖矿产出的百分比）：
 *   L1 (direct)   : 5.0%
 *   L2            : 3.0%
 *   L3            : 2.0%
 *   L4            : 1.0%
 *   L5            : 0.5%
 *
 * 流程：
 *   1. 新用户调用 bind(referrer) 绑定上级
 *   2. MiningLogic 在发放奖励时调用 distributeReward(miner, token, amount)
 *   3. 合约自动计算各级分成并转账
 */
contract ReferralReward is Ownable {
    using SafeERC20 for IERC20;

    // ===== 常量 =====
    uint256 public constant MAX_LEVELS  = 5;
    uint256 public constant RATE_BASE   = 10000;  // 基数 10000 = 100%

    // L1=5%, L2=3%, L3=2%, L4=1%, L5=0.5%
    uint256[5] public RATES = [500, 300, 200, 100, 50];

    // ===== 状态 =====
    // miner => referrer (L1上级)
    mapping(address => address) public referrer;

    // 是否已绑定
    mapping(address => bool) public bound;

    // 历史累计奖励： user => token => totalEarned
    mapping(address => mapping(address => uint256)) public totalEarned;

    // 指定的 MiningLogic 地址（只有它才能调用 distributeReward）
    address public miningLogic;

    // ===== 事件 =====
    event Bound(address indexed user, address indexed referrer);
    event ReferralRewarded(
        address indexed earner,
        address indexed miner,
        address indexed token,
        uint256 amount,
        uint8   level
    );
    event MiningLogicSet(address indexed addr);
    event RatesUpdated(uint256[5] newRates);

    // ===== 修饰器 =====
    modifier onlyMining() {
        require(msg.sender == miningLogic, "ReferralReward: caller is not MiningLogic");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ===== 管理函数 =====

    function setMiningLogic(address _mining) external onlyOwner {
        require(_mining != address(0), "zero address");
        miningLogic = _mining;
        emit MiningLogicSet(_mining);
    }

    /// @notice 更新奖励比例（单位万分之一）
    function setRates(uint256[5] calldata newRates) external onlyOwner {
        uint256 total = 0;
        for (uint i = 0; i < 5; i++) {
            total += newRates[i];
        }
        require(total <= 2000, "total referral rate > 20%, too high"); // 最多20%
        RATES = newRates;
        emit RatesUpdated(newRates);
    }

    // ===== 用户函数 =====

    /**
     * @notice 绑定上级地址
     * @param _referrer 推荐人地址（即邀请人）
     */
    function bind(address _referrer) external {
        require(!bound[msg.sender],          "already bound");
        require(_referrer != address(0),     "invalid referrer");
        require(_referrer != msg.sender,     "cannot refer yourself");
        require(!_isAncestor(msg.sender, _referrer), "circular referral");

        referrer[msg.sender] = _referrer;
        bound[msg.sender]    = true;

        emit Bound(msg.sender, _referrer);
    }

    /**
     * @notice 分发奖励——由 MiningLogic 调用
     * @param miner  实际挖矿下级地址
     * @param token  奖励代币（元素代币）
     * @param amount 当前此次挖矿总产出量（未扣除分成）
     *
     * 注意：mining合约必须先 approve(referralReward, amount) 或者由合约自身持有代币并 mint。
     * 最简单的集成方式：MiningLogic mint给矿工，同时 mint 额外的分成量给各级。
     */
    function distributeReward(
        address miner,
        address token,
        uint256 amount
    ) external onlyMining {
        address cur = miner;
        for (uint8 lvl = 0; lvl < MAX_LEVELS; lvl++) {
            address upper = referrer[cur];
            if (upper == address(0)) break;  // 链断了

            uint256 reward = (amount * RATES[lvl]) / RATE_BASE;
            if (reward > 0) {
                IERC20(token).safeTransfer(upper, reward);
                totalEarned[upper][token] += reward;
                emit ReferralRewarded(upper, miner, token, reward, lvl + 1);
            }
            cur = upper;
        }
    }

    // ===== 视图函数 =====

    /**
     * @notice 获取某用户的 5 级上级地址数组
     */
    function getAncestors(address user) external view returns (address[5] memory ancestors) {
        address cur = user;
        for (uint8 i = 0; i < MAX_LEVELS; i++) {
            address up = referrer[cur];
            if (up == address(0)) break;
            ancestors[i] = up;
            cur = up;
        }
    }

    /**
     * @notice 获取某用户对某代币的历史总收益
     */
    function earned(address user, address token) external view returns (uint256) {
        return totalEarned[user][token];
    }

    /**
     * @notice 获取当前 5 级收益比例
     */
    function getRates() external view returns (uint256[5] memory) {
        return RATES;
    }

    // ===== 内部函数 =====

    /// @dev 检查 potentialAncestor 是否已经是 user 的祖先（防止循环引用）
    function _isAncestor(address user, address potentialAncestor) internal view returns (bool) {
        address cur = user;
        for (uint8 i = 0; i < MAX_LEVELS + 1; i++) {
            cur = referrer[cur];
            if (cur == address(0)) return false;
            if (cur == potentialAncestor) return true;
        }
        return false;
    }
}
