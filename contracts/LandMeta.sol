// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILandNFT {
    function ownerOf(uint256 id) external view returns (address);
}

/// @notice 土地元数据存储合约
/// 任何人可以为自己持有的土地设置头像和简介
contract LandMeta {
    ILandNFT public immutable land;

    struct Meta {
        string avatarUrl;    // 头像图片URL（推荐IPFS或公开图床）
        string description;  // 土地简介（最多500字符）
        uint64 updatedAt;    // 最后更新时间
    }

    mapping(uint256 => Meta) public metas;

    event MetaUpdated(uint256 indexed landId, address indexed owner, string avatarUrl, string description);

    constructor(address _land) {
        land = ILandNFT(_land);
    }

    /// @notice 设置土地元数据，只有土地持有者可以调用
    function setMeta(uint256 landId, string calldata avatarUrl, string calldata description) external {
        require(land.ownerOf(landId) == msg.sender, "!owner");
        require(bytes(avatarUrl).length <= 256, "avatarUrl too long");
        require(bytes(description).length <= 1000, "description too long");
        metas[landId] = Meta(avatarUrl, description, uint64(block.timestamp));
        emit MetaUpdated(landId, msg.sender, avatarUrl, description);
    }

    /// @notice 批量获取元数据
    function getMetaBatch(uint256[] calldata landIds)
        external view returns (Meta[] memory result)
    {
        result = new Meta[](landIds.length);
        for (uint256 i = 0; i < landIds.length; i++) {
            result[i] = metas[landIds[i]];
        }
    }
}
