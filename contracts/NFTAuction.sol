// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Transfer {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IERC721Transferable {
    function ownerOf(uint256 id) external view returns (address);
    function transferFrom(address from, address to, uint256 id) external;
}

contract NFTAuction {
    uint256 public constant FEE_BPS = 400;
    uint256 public constant BPS = 10000;
    address public owner;
    address public ring;

    struct Auction {
        address nftContract;
        address seller;
        uint128 startPrice;
        uint128 endPrice;
        uint64  duration;
        uint64  startedAt;
    }

    mapping(bytes32 => Auction) public auctionMap;
    bool private _lock;

    event AuctionCreated(address indexed nft, uint256 indexed id, address seller, uint128 start, uint128 end, uint64 dur);
    event AuctionWon(address indexed nft, uint256 indexed id, address buyer, uint256 price);
    event AuctionCancelled(address indexed nft, uint256 indexed id);

    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }
    modifier noReentrant() { require(!_lock, "reentrant"); _lock = true; _; _lock = false; }

    constructor(address _ring) { owner = msg.sender; ring = _ring; }

    function _key(address nft, uint256 id) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(nft, id));
    }

    function getAuction(address nft, uint256 id) external view returns (Auction memory) {
        return auctionMap[_key(nft, id)];
    }

    function createAuction(address nft, uint256 id, uint128 sp, uint128 ep, uint64 dur) external noReentrant {
        require(IERC721Transferable(nft).ownerOf(id) == msg.sender, "!owner");
        require(dur >= 60 && dur <= 30 days, "bad dur");
        require(sp >= ep, "sp<ep");
        IERC721Transferable(nft).transferFrom(msg.sender, address(this), id);
        auctionMap[_key(nft, id)] = Auction(nft, msg.sender, sp, ep, dur, uint64(block.timestamp));
        emit AuctionCreated(nft, id, msg.sender, sp, ep, dur);
    }

    function bid(address nft, uint256 id, uint256 maxPay) external noReentrant {
        Auction storage a = auctionMap[_key(nft, id)];
        require(a.startedAt > 0, "no auction");
        uint256 price = currentPrice(nft, id);
        require(maxPay >= price, "too low");
        uint256 fee = price * FEE_BPS / BPS;
        require(IERC20Transfer(ring).transferFrom(msg.sender, a.seller, price - fee), "ring");
        if (fee > 0) IERC20Transfer(ring).transferFrom(msg.sender, owner, fee);
        address nftAddr = a.nftContract;
        delete auctionMap[_key(nft, id)];
        IERC721Transferable(nftAddr).transferFrom(address(this), msg.sender, id);
        emit AuctionWon(nft, id, msg.sender, price);
    }

    function cancelAuction(address nft, uint256 id) external noReentrant {
        Auction storage a = auctionMap[_key(nft, id)];
        require(a.startedAt > 0, "no auction");
        require(a.seller == msg.sender || msg.sender == owner, "!auth");
        address seller = a.seller;
        address nftAddr = a.nftContract;
        delete auctionMap[_key(nft, id)];
        IERC721Transferable(nftAddr).transferFrom(address(this), seller, id);
        emit AuctionCancelled(nft, id);
    }

    function currentPrice(address nft, uint256 id) public view returns (uint256) {
        Auction storage a = auctionMap[_key(nft, id)];
        require(a.startedAt > 0, "no auction");
        uint256 elapsed = block.timestamp - a.startedAt;
        if (elapsed >= a.duration) return a.endPrice;
        return a.startPrice - (uint256(a.startPrice) - a.endPrice) * elapsed / a.duration;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }
}
