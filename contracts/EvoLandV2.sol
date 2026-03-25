// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ================================================================
//  Evolution Land BSC V2 — 修复版
//  修复: MiningSystem PRECISION bug (原值1e12 → 移除)
//  新增: 使徒可不带钻头挖矿，stopMining允许任何人取回自己的使徒
// ================================================================

abstract contract Ownable {
    address public owner;
    event OwnershipTransferred(address indexed prev, address indexed next);
    constructor() { owner = msg.sender; }
    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }
    function transferOwnership(address a) external onlyOwner {
        require(a != address(0)); emit OwnershipTransferred(owner, a); owner = a;
    }
}

abstract contract ERC20Base {
    string  public name; string public symbol;
    uint8   public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed f, address indexed t, uint256 v);
    event Approval(address indexed o, address indexed s, uint256 v);
    constructor(string memory n, string memory s) { name = n; symbol = s; }
    function transfer(address t, uint256 v) external returns (bool) { _transfer(msg.sender,t,v); return true; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s]=v; emit Approval(msg.sender,s,v); return true; }
    function transferFrom(address f, address t, uint256 v) external returns (bool) {
        if (allowance[f][msg.sender] != type(uint256).max) allowance[f][msg.sender] -= v;
        _transfer(f,t,v); return true;
    }
    function _transfer(address f, address t, uint256 v) internal { require(t!=address(0)); balanceOf[f]-=v; balanceOf[t]+=v; emit Transfer(f,t,v); }
    function _mint(address t, uint256 v) internal { totalSupply+=v; balanceOf[t]+=v; emit Transfer(address(0),t,v); }
    function _burn(address f, uint256 v) internal { balanceOf[f]-=v; totalSupply-=v; emit Transfer(f,address(0),v); }
}

abstract contract MintableERC20 is ERC20Base, Ownable {
    mapping(address => bool) public minters;
    constructor(string memory n, string memory s) ERC20Base(n,s) {}
    modifier onlyMinter() { require(minters[msg.sender]||msg.sender==owner,"!minter"); _; }
    function setMinter(address a, bool v) external onlyOwner { minters[a]=v; }
    function mint(address t, uint256 v) external onlyMinter { _mint(t,v); }
    function burn(address f, uint256 v) external onlyMinter { _burn(f,v); }
}

interface IERC721Receiver {
    function onERC721Received(address,address,uint256,bytes calldata) external returns (bytes4);
}

abstract contract ERC721Base is Ownable {
    string public name; string public symbol;
    mapping(uint256=>address) public ownerOf;
    mapping(address=>uint256) public balanceOf;
    mapping(uint256=>address) public getApproved;
    mapping(address=>mapping(address=>bool)) public isApprovedForAll;
    event Transfer(address indexed f, address indexed t, uint256 indexed id);
    event Approval(address indexed o, address indexed a, uint256 indexed id);
    event ApprovalForAll(address indexed o, address indexed op, bool v);
    constructor(string memory n, string memory s) { name=n; symbol=s; }
    function supportsInterface(bytes4 id) external pure returns(bool) {
        return id==0x80ac58cd||id==0x5b5e139f||id==0x01ffc9a7;
    }
    function approve(address a, uint256 id) external {
        address o=ownerOf[id]; require(msg.sender==o||isApprovedForAll[o][msg.sender]);
        getApproved[id]=a; emit Approval(o,a,id);
    }
    function setApprovalForAll(address op, bool v) external { isApprovedForAll[msg.sender][op]=v; emit ApprovalForAll(msg.sender,op,v); }
    function transferFrom(address f, address t, uint256 id) public virtual {
        require(_ok(msg.sender,id)); _xfer(f,t,id);
    }
    function safeTransferFrom(address f, address t, uint256 id) external { safeTransferFrom(f,t,id,""); }
    function safeTransferFrom(address f, address t, uint256 id, bytes memory d) public virtual {
        require(_ok(msg.sender,id)); _xfer(f,t,id); _chk(msg.sender,f,t,id,d);
    }
    function _ok(address s, uint256 id) internal view returns(bool) {
        address o=ownerOf[id]; return s==o||isApprovedForAll[o][s]||getApproved[id]==s;
    }
    function _xfer(address f, address t, uint256 id) internal {
        require(ownerOf[id]==f&&t!=address(0)); delete getApproved[id];
        balanceOf[f]--; balanceOf[t]++; ownerOf[id]=t; emit Transfer(f,t,id);
    }
    function _mint(address t, uint256 id) internal {
        require(t!=address(0)&&ownerOf[id]==address(0)); balanceOf[t]++; ownerOf[id]=t; emit Transfer(address(0),t,id);
    }
    function _burn(uint256 id) internal {
        address o=ownerOf[id]; require(o!=address(0)); balanceOf[o]--; delete ownerOf[id]; delete getApproved[id]; emit Transfer(o,address(0),id);
    }
    function _chk(address op, address f, address t, uint256 id, bytes memory d) internal {
        if (t.code.length>0) require(IERC721Receiver(t).onERC721Received(op,f,id,d)==0x150b7a02,"!receiver");
    }
}

// ── Tokens ───────────────────────────────────────────────────────────────────
contract RingToken is MintableERC20 {
    constructor() MintableERC20("Evolution Land Ring", "RING") {
        _mint(msg.sender, 100_000 * 1e18);  // 10万 RING
    }
}
contract GoldToken  is MintableERC20 { constructor() MintableERC20("EvoLand Gold",  "GOLD")  {} }
contract WoodToken  is MintableERC20 { constructor() MintableERC20("EvoLand Wood",  "WOOD")  {} }
contract WaterToken is MintableERC20 { constructor() MintableERC20("EvoLand Water", "HHO")   {} }
contract FireToken  is MintableERC20 { constructor() MintableERC20("EvoLand Fire",  "FIRE")  {} }
contract SoilToken  is MintableERC20 { constructor() MintableERC20("EvoLand Soil",  "SIOO") {} }

// ── Land NFT ─────────────────────────────────────────────────────────────────
contract LandNFT is ERC721Base {
    mapping(address => bool) public operators;
    mapping(uint256 => uint80) public resourceAttr;
    mapping(uint256 => uint8)  public district;
    event LandMinted(uint256 indexed tokenId, int16 x, int16 y, uint80 attr);
    modifier onlyOperator() { require(operators[msg.sender]||msg.sender==owner,"!op"); _; }
    constructor() ERC721Base("Evolution Land", "LAND") {}
    function setOperator(address a, bool v) external onlyOwner { operators[a]=v; }
    function encodeId(int16 x, int16 y) public pure returns (uint256) {
        require(x>=0&&x<=99&&y>=0&&y<=99,"oob");
        return uint256(uint16(x))*100 + uint256(uint16(y)) + 1;
    }
    function decodeId(uint256 id) public pure returns (int16 x, int16 y) {
        uint256 idx = id - 1; x = int16(int256(idx/100)); y = int16(int256(idx%100));
    }
    function mint(address to, int16 x, int16 y, uint80 attr) external onlyOperator {
        uint256 id = encodeId(x,y); resourceAttr[id] = attr; district[id] = 1;
        _mint(to, id); emit LandMinted(id, x, y, attr);
    }
    function getRate(uint256 id, uint8 res) public view returns (uint16) {
        return uint16(resourceAttr[id] >> (uint256(res)*16));
    }
    function transferFrom(address f, address t, uint256 id) public override {
        if (operators[msg.sender]) _xfer(f,t,id); else super.transferFrom(f,t,id);
    }
    function safeTransferFrom(address f, address t, uint256 id, bytes memory d) public override {
        if (operators[msg.sender]) { _xfer(f,t,id); _chk(msg.sender,f,t,id,d); }
        else super.safeTransferFrom(f,t,id,d);
    }

    // ── 地块属性充能（仅升级合约可调用）────────────────────────────
    function upgradeAttr(uint256 id, uint8 res, uint16 addVal) external onlyOperator {
        require(ownerOf[id] != address(0), "!exist");
        uint80 attr = resourceAttr[id];
        uint80 curVal = uint80(attr >> (uint256(res)*16)) & 0xffff;
        uint80 newVal = curVal + addVal;
        if (newVal > 0xffff) newVal = 0xffff;
        // 清除对应16位，写入新值
        uint80 mask = ~(uint80(0xffff) << (uint80(res)*16));
        resourceAttr[id] = (attr & mask) | (newVal << (uint80(res)*16));
    }
}

// ── Drill NFT ────────────────────────────────────────────────────────────────
contract DrillNFT is ERC721Base {
    uint256 public nextId = 1;
    mapping(address => bool) public operators;
    struct DrillAttr { uint8 tier; uint8 affinity; }
    mapping(uint256 => DrillAttr) public attrs;
    event DrillMinted(uint256 indexed id, address to, uint8 tier, uint8 affinity);
    modifier onlyOperator() { require(operators[msg.sender]||msg.sender==owner,"!op"); _; }
    constructor() ERC721Base("EvoLand Drill", "DRILL") {}
    function setOperator(address a, bool v) external onlyOwner { operators[a]=v; }
    function mint(address to, uint8 tier, uint8 affinity) external onlyOperator returns (uint256 id) {
        require(tier>=1&&tier<=5&&affinity<=4,"bad attr");
        id = nextId++; attrs[id] = DrillAttr(tier, affinity); _mint(to, id);
        emit DrillMinted(id, to, tier, affinity);
    }
    function transferFrom(address f, address t, uint256 id) public override {
        if (operators[msg.sender]) _xfer(f,t,id); else super.transferFrom(f,t,id);
    }
    function safeTransferFrom(address f, address t, uint256 id, bytes memory d) public override {
        if (operators[msg.sender]) { _xfer(f,t,id); _chk(msg.sender,f,t,id,d); }
        else super.safeTransferFrom(f,t,id,d);
    }

    // ── 升级合约调用：销毁钻头 ──────────────────────────────────
    function burn(uint256 id) external onlyOperator {
        require(ownerOf[id] != address(0), "!exist");
        _burn(id);
    }
}

// ── Apostle NFT V2 ───────────────────────────────────────────────────────────
contract ApostleNFT is ERC721Base {
    uint256 public nextId = 1;
    mapping(address => bool) public operators;
    uint256 public constant GROWTH_TIME = 7 days;
    uint256 public breedFee = 1e18;
    struct ApostleAttr {
        uint8 strength; uint8 element; uint8 gender; uint16 gen;
        uint64 genes; uint64 birthTime; uint64 cooldown; uint32 motherId; uint32 fatherId;
    }
    mapping(uint256 => ApostleAttr) public attrs;
    address public ring;
    event ApostleMinted(uint256 indexed id, address to, uint8 str, uint8 elem, uint8 gender, uint16 gen);
    event Bred(uint256 indexed childId, uint256 maleId, uint256 femaleId);
    modifier onlyOperator() { require(operators[msg.sender]||msg.sender==owner,"!op"); _; }
    constructor(address _ring) ERC721Base("EvoLand Apostle","APO") { ring=_ring; }
    function setOperator(address a,bool v) external onlyOwner { operators[a]=v; }
    function setBreedFee(uint256 f) external onlyOwner { breedFee=f; }
    function mint(address to, uint8 strength, uint8 element) external onlyOperator returns(uint256 id){
        require(strength>=1&&strength<=100&&element<=4,"bad");
        id=nextId++;
        uint8 g=uint8(uint256(keccak256(abi.encodePacked(block.timestamp,id)))%2);
        uint64 genes=uint64(uint256(keccak256(abi.encodePacked(id,strength,element))));
        attrs[id]=ApostleAttr(strength,element,g,0,genes,uint64(block.timestamp),0,0,0);
        _mint(to,id); emit ApostleMinted(id,to,strength,element,g,0);
    }
    function breed(uint256 maleId, uint256 femaleId) external returns(uint256 childId){
        require(ownerOf[maleId]==msg.sender&&ownerOf[femaleId]==msg.sender,"!owner");
        ApostleAttr storage m=attrs[maleId]; ApostleAttr storage fm=attrs[femaleId];
        require(m.gender==0&&fm.gender==1,"gender");
        require(isAdult(maleId)&&isAdult(femaleId),"!adult");
        require(block.timestamp>=m.birthTime+m.cooldown&&block.timestamp>=fm.birthTime+fm.cooldown,"cd");
        if(breedFee>0) require(ERC20Base(ring).transferFrom(msg.sender,address(this),breedFee),"ring");
        childId=nextId++;
        uint256 rnd=uint256(keccak256(abi.encodePacked(childId,block.timestamp)));
        uint16 cGen=(m.gen>fm.gen?m.gen:fm.gen)+1;
        uint8 cStr=uint8((uint256(m.strength)+fm.strength)/2+(rnd%11)); if(cStr>100)cStr=100;
        attrs[childId]=ApostleAttr(cStr,rnd%2==0?m.element:fm.element,uint8((rnd>>8)%2),cGen,
            uint64(rnd>>16),uint64(block.timestamp),uint64(GROWTH_TIME*cGen),uint32(femaleId),uint32(maleId));
        m.cooldown=uint64(GROWTH_TIME); fm.cooldown=uint64(GROWTH_TIME);
        _mint(msg.sender,childId); emit Bred(childId,maleId,femaleId);
    }
    function isAdult(uint256 id) public view returns(bool){ return block.timestamp>=attrs[id].birthTime+GROWTH_TIME; }
    function growthProgress(uint256 id) public view returns(uint8){
        uint256 age=block.timestamp-attrs[id].birthTime;
        return age>=GROWTH_TIME?100:uint8(age*100/GROWTH_TIME);
    }
    function transferFrom(address f,address t,uint256 id) public override {
        if(operators[msg.sender])_xfer(f,t,id); else super.transferFrom(f,t,id);
    }
    function safeTransferFrom(address f,address t,uint256 id,bytes memory d) public override {
        if(operators[msg.sender]){_xfer(f,t,id);_chk(msg.sender,f,t,id,d);}
        else super.safeTransferFrom(f,t,id,d);
    }

    // ── 升级合约调用：提升使徒力量 ────────────────────────────
    function upgradeStrength(uint256 id, uint8 newStrength) external onlyOperator {
        require(attrs[id].birthTime > 0, "!exist");
        attrs[id].strength = newStrength;
    }
}

contract MiningSystem is Ownable {
    uint256 public constant MAX_APOSTLES_PER_LAND = 5;
    // ✅ 修复: 移除 PRECISION=1e12, 产出公式直接用 rate*1e18*str*boost*elapsed/(50*100*86400)
    // rate=50,str=50,boost=100x → 50 tokens/天

    LandNFT    public land;
    DrillNFT   public drill;
    ApostleNFT public apostle;
    address[5] public resources;

    struct Slot { uint256 apostleId; uint256 drillId; uint256 startTime; }
    mapping(uint256 => Slot[MAX_APOSTLES_PER_LAND]) public slots;
    mapping(uint256 => uint256) public slotCount;
    mapping(uint256 => uint256) public apostleOnLand;
    mapping(uint256 => uint256) public drillOnLand;
    mapping(uint256 => uint256[5]) public pending;

    event MiningStarted(uint256 indexed landId, uint256 apostleId, uint256 drillId);
    event MiningStopped(uint256 indexed landId, uint256 apostleId);
    event Claimed(uint256 indexed landId, address indexed owner, uint256[5] amounts);

    constructor(address _land, address _drill, address _apostle, address[5] memory _res) {
        land=LandNFT(_land); drill=DrillNFT(_drill); apostle=ApostleNFT(_apostle); resources=_res;
    }

    function startMining(uint256 landId, uint256 apostleId, uint256 drillId) external {
        require(apostle.ownerOf(apostleId)==msg.sender,"!apo owner");
        require(apostleOnLand[apostleId]==0,"apo busy");
        uint256 count = slotCount[landId];
        require(count < MAX_APOSTLES_PER_LAND,"land full");
        if(drillId!=0){
            require(drill.ownerOf(drillId)==msg.sender,"!drl owner");
            require(drillOnLand[drillId]==0,"drl busy");
            drill.transferFrom(msg.sender, address(this), drillId);
            drillOnLand[drillId]=landId;
        }
        apostle.transferFrom(msg.sender, address(this), apostleId);
        apostleOnLand[apostleId]=landId;
        slots[landId][count]=Slot(apostleId,drillId,block.timestamp);
        slotCount[landId]=count+1;
        emit MiningStarted(landId,apostleId,drillId);
    }

    function stopMining(uint256 landId, uint256 apostleId) external {
        // 任何人可以取回自己的使徒（不再要求是土地所有者）
        _flushLand(landId);
        uint256 count = slotCount[landId];
        for(uint256 i=0;i<count;i++){
            if(slots[landId][i].apostleId==apostleId){
                uint256 drillId=slots[landId][i].drillId;
                apostle.transferFrom(address(this),msg.sender,apostleId);
                apostleOnLand[apostleId]=0;
                if(drillId!=0){
                    drill.transferFrom(address(this),msg.sender,drillId);
                    drillOnLand[drillId]=0;
                }
                slots[landId][i]=slots[landId][count-1];
                delete slots[landId][count-1];
                slotCount[landId]=count-1;
                emit MiningStopped(landId,apostleId);
                return;
            }
        }
        revert("not here");
    }

    function claim(uint256 landId) external {
        _flushLand(landId);
        address owner_=land.ownerOf(landId);
        uint256[5] memory amounts;
        for(uint8 r=0;r<5;r++){
            uint256 amt=pending[landId][r];
            if(amt>0){ pending[landId][r]=0; amounts[r]=amt; MintableERC20(resources[r]).mint(owner_,amt); }
        }
        emit Claimed(landId,owner_,amounts);
    }

    function pendingRewards(uint256 landId) external view returns(uint256[5] memory res){
        for(uint8 r=0;r<5;r++) res[r]=pending[landId][r];
        uint256 count=slotCount[landId];
        for(uint256 i=0;i<count;i++){
            Slot storage s=slots[landId][i];
            uint256 elapsed=block.timestamp-s.startTime;
            uint256[5] memory inc=_calc(landId,s,elapsed);
            for(uint8 r=0;r<5;r++) res[r]+=inc[r];
        }
    }

    function _flushLand(uint256 landId) internal {
        uint256 count=slotCount[landId];
        for(uint256 i=0;i<count;i++){
            Slot storage s=slots[landId][i];
            uint256 elapsed=block.timestamp-s.startTime;
            if(elapsed==0) continue;
            uint256[5] memory inc=_calc(landId,s,elapsed);
            for(uint8 r=0;r<5;r++) pending[landId][r]+=inc[r];
            s.startTime=block.timestamp;
        }
    }

    // ✅ 修复后公式: rate*1e18*str*boost*elapsed / (50*100*86400)
    function _calc(uint256 landId, Slot storage s, uint256 elapsed)
        internal view returns(uint256[5] memory inc)
    {
        (uint8 str,,,,,,,,) = apostle.attrs(s.apostleId);
        uint8 dTier; uint8 dAff; bool hasDrl=s.drillId!=0;
        if(hasDrl) { (dTier,dAff)=drill.attrs(s.drillId); }
        for(uint8 r=0;r<5;r++){
            uint256 rate=land.getRate(landId,r);
            if(rate==0) continue;
            uint256 boost=100;
            if(hasDrl&&dAff==r) boost+=uint256(dTier)*20;
            inc[r]=rate*1e18*uint256(str)*boost*elapsed/(50*100*86400);
        }
    }

    function onERC721Received(address,address,uint256,bytes calldata) external pure returns(bytes4){
        return 0x150b7a02;
    }
}

// ── Dutch Auction ────────────────────────────────────────────────────────────
contract LandAuction is Ownable {
    uint256 public constant FEE_BPS = 400; uint256 public constant BPS = 10000;
    LandNFT public land; address public ring;
    struct Auction { address seller; uint128 startPrice; uint128 endPrice; uint64 duration; uint64 startedAt; }
    mapping(uint256=>Auction) public auctions;
    bool private _lock;
    event AuctionCreated(uint256 indexed id,address seller,uint128 start,uint128 end,uint64 dur);
    event AuctionWon(uint256 indexed id,address buyer,uint256 price);
    event AuctionCancelled(uint256 indexed id);
    modifier noReentrant(){ require(!_lock); _lock=true; _; _lock=false; }
    constructor(address _land,address _ring){ land=LandNFT(_land); ring=_ring; }
    function createAuction(uint256 id,uint128 sp,uint128 ep,uint64 dur) external noReentrant {
        require(land.ownerOf(id)==msg.sender,"!owner");
        require(dur>=60&&dur<=30 days); require(sp>=ep);
        land.transferFrom(msg.sender,address(this),id);
        auctions[id]=Auction(msg.sender,sp,ep,dur,uint64(block.timestamp));
        emit AuctionCreated(id,msg.sender,sp,ep,dur);
    }
    function bid(uint256 id,uint256 maxPay) external noReentrant {
        Auction storage a=auctions[id]; require(a.startedAt>0,"no auction");
        uint256 price=currentPrice(id); require(maxPay>=price,"too low");
        uint256 fee=price*FEE_BPS/BPS;
        ERC20Base r=ERC20Base(ring);
        require(r.transferFrom(msg.sender,a.seller,price-fee),"ring fail");
        if(fee>0) r.transferFrom(msg.sender,owner,fee);
        delete auctions[id];
        land.transferFrom(address(this),msg.sender,id);
        emit AuctionWon(id,msg.sender,price);
    }
    function cancelAuction(uint256 id) external noReentrant {
        Auction storage a=auctions[id]; require(a.startedAt>0);
        require(a.seller==msg.sender||msg.sender==owner);
        address seller=a.seller; delete auctions[id];
        land.transferFrom(address(this),seller,id);
        emit AuctionCancelled(id);
    }
    function currentPrice(uint256 id) public view returns(uint256){
        Auction storage a=auctions[id]; require(a.startedAt>0);
        uint256 elapsed=block.timestamp-a.startedAt;
        if(elapsed>=a.duration) return a.endPrice;
        return a.startPrice-(a.startPrice-a.endPrice)*elapsed/a.duration;
    }
    function onERC721Received(address,address,uint256,bytes calldata) external pure returns(bytes4){ return 0x150b7a02; }
}

// ── Land Initializer ─────────────────────────────────────────────────────────
contract LandInitializer is Ownable {
    LandNFT public land; LandAuction public auction; address public ring;
    constructor(address _land,address _auction,address _ring){ land=LandNFT(_land); auction=LandAuction(_auction); ring=_ring; }
    function batchMint(int16[] calldata xs,int16[] calldata ys,uint80[] calldata attrs,address to) external onlyOwner {
        for(uint256 i=0;i<xs.length;i++) land.mint(to,xs[i],ys[i],attrs[i]);
    }
}

// ── Blind Box ────────────────────────────────────────────────────────────────
contract BlindBox is Ownable {
    ApostleNFT public apostle;
    DrillNFT   public drill;
    address    public ring;
    uint256    public apostleBoxPrice = 1e18;   // 1 RING
    uint256    public drillBoxPrice   = 5e17;   // 0.5 RING
    uint256    private _nonce;
    event ApostleBoxOpened(address indexed buyer, uint256 apostleId, uint8 str, uint8 elem);
    event DrillBoxOpened(address indexed buyer, uint256 drillId, uint8 tier, uint8 aff);
    constructor(address _apostle, address _drill, address _ring) {
        apostle=ApostleNFT(_apostle); drill=DrillNFT(_drill); ring=_ring;
    }
    function setApostleBoxPrice(uint256 p) external onlyOwner { apostleBoxPrice=p; }
    function setDrillBoxPrice(uint256 p)   external onlyOwner { drillBoxPrice=p; }
    // ── 使徒盲盒概率（白皮书标准）──────────────────────────────────────
    // rand%100:  0-29=新手(1-30)  30-84=普通(31-60)  85-97=精英(61-84)  98-99=传奇(85-100)
    function buyApostleBox() external {
        require(ERC20Base(ring).transferFrom(msg.sender,owner,apostleBoxPrice),"ring fail");
        uint256 rand=uint256(keccak256(abi.encodePacked(block.timestamp,msg.sender,++_nonce,block.prevrandao)));
        uint8 tier = uint8(rand % 100);   // 0-99 决定稀有度等级
        uint8 str;
        if (tier < 30) {
            // 新手 30%：力量 1-30
            str = uint8(1 + (rand >> 8) % 30);
        } else if (tier < 85) {
            // 普通 55%：力量 31-60
            str = uint8(31 + (rand >> 8) % 30);
        } else if (tier < 98) {
            // 精英 13%：力量 61-84
            str = uint8(61 + (rand >> 8) % 24);
        } else {
            // 传奇 2%：力量 85-100
            str = uint8(85 + (rand >> 8) % 16);
        }
        uint8 elem = uint8((rand >> 16) % 5);
        uint256 id = apostle.mint(msg.sender, str, elem);
        emit ApostleBoxOpened(msg.sender, id, str, elem);
    }

    // ── 钻头盲盒概率（白皮书标准）──────────────────────────────────────
    // rand%100:  0-34=1星  35-64=2星  65-84=3星  85-94=4星  95-99=5星
    function buyDrillBox() external {
        require(ERC20Base(ring).transferFrom(msg.sender,owner,drillBoxPrice),"ring fail");
        uint256 rand=uint256(keccak256(abi.encodePacked(block.timestamp,msg.sender,++_nonce,block.prevrandao,uint256(1))));
        uint8 roll = uint8(rand % 100);
        uint8 tier;
        if (roll < 35)      tier = 1;  // 1星 35%
        else if (roll < 65) tier = 2;  // 2星 30%
        else if (roll < 85) tier = 3;  // 3星 20%
        else if (roll < 95) tier = 4;  // 4星 10%
        else                tier = 5;  // 5星  5%
        uint8 aff = uint8((rand >> 8) % 5);
        uint256 id = drill.mint(msg.sender, tier, aff);
        emit DrillBoxOpened(msg.sender, id, tier, aff);
    }
}

// ── Referral System ──────────────────────────────────────────────────────────
contract ReferralSystem is Ownable {
    uint256[5] public rates = [500, 300, 200, 100, 50];  // 5%, 3%, 2%, 1%, 0.5%
    mapping(address=>address) public referrer;
    mapping(address=>bool)    public bound;
    mapping(address=>mapping(address=>uint256)) public totalEarned;
    event Bound(address indexed user, address indexed ref);
    function getRates() external view returns(uint256[5] memory) { return rates; }
    function bind(address ref) external {
        require(!bound[msg.sender],"already bound");
        require(ref!=msg.sender&&ref!=address(0),"bad ref");
        referrer[msg.sender]=ref; bound[msg.sender]=true;
        emit Bound(msg.sender,ref);
    }
    function distributeReward(address user, address token, uint256 amount) external {
        address ref=referrer[user]; if(ref==address(0)) return;
        for(uint8 i=0;i<5;i++){
            if(ref==address(0)) break;
            uint256 reward=amount*rates[i]/10000;
            if(reward>0){
                try MintableERC20(token).mint(ref,reward){}catch{}
                totalEarned[ref][token]+=reward;
            }
            ref=referrer[ref];
        }
    }
}

// ── Universal NFT Auction (支持土地/使徒/钻头) ─────────────────────────────
interface IERC721Transfer {
    function ownerOf(uint256 id) external view returns (address);
    function transferFrom(address from, address to, uint256 id) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

contract NFTAuction is Ownable {
    uint256 public constant FEE_BPS = 400;
    uint256 public constant BPS = 10000;
    address public ring;

    struct Auction {
        address nftContract;
        address seller;
        uint128 startPrice;
        uint128 endPrice;
        uint64  duration;
        uint64  startedAt;
    }

    // key = keccak256(nftContract, tokenId)
    mapping(bytes32 => Auction) public auctions;
    bool private _lock;

    event AuctionCreated(address indexed nft, uint256 indexed id, address seller, uint128 start, uint128 end, uint64 dur);
    event AuctionWon(address indexed nft, uint256 indexed id, address buyer, uint256 price);
    event AuctionCancelled(address indexed nft, uint256 indexed id);

    modifier noReentrant() { require(!_lock,"reentrant"); _lock=true; _; _lock=false; }

    constructor(address _ring) { ring = _ring; }

    function _key(address nft, uint256 id) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(nft, id));
    }

    function getAuction(address nft, uint256 id) external view returns (Auction memory) {
        return auctions[_key(nft, id)];
    }

    function createAuction(address nft, uint256 id, uint128 sp, uint128 ep, uint64 dur) external noReentrant {
        require(IERC721Transfer(nft).ownerOf(id) == msg.sender, "!owner");
        require(dur >= 60 && dur <= 30 days, "bad dur");
        require(sp >= ep, "sp<ep");
        IERC721Transfer(nft).transferFrom(msg.sender, address(this), id);
        auctions[_key(nft,id)] = Auction(nft, msg.sender, sp, ep, dur, uint64(block.timestamp));
        emit AuctionCreated(nft, id, msg.sender, sp, ep, dur);
    }

    function bid(address nft, uint256 id, uint256 maxPay) external noReentrant {
        Auction storage a = auctions[_key(nft,id)];
        require(a.startedAt > 0, "no auction");
        uint256 price = currentPrice(nft, id);
        require(maxPay >= price, "too low");
        uint256 fee = price * FEE_BPS / BPS;
        ERC20Base r = ERC20Base(ring);
        require(r.transferFrom(msg.sender, a.seller, price - fee), "ring fail");
        if (fee > 0) r.transferFrom(msg.sender, owner, fee);
        address nftAddr = a.nftContract;
        delete auctions[_key(nft,id)];
        IERC721Transfer(nftAddr).transferFrom(address(this), msg.sender, id);
        emit AuctionWon(nft, id, msg.sender, price);
    }

    function cancelAuction(address nft, uint256 id) external noReentrant {
        Auction storage a = auctions[_key(nft,id)];
        require(a.startedAt > 0, "no auction");
        require(a.seller == msg.sender || msg.sender == owner, "!auth");
        address seller = a.seller;
        address nftAddr = a.nftContract;
        delete auctions[_key(nft,id)];
        IERC721Transfer(nftAddr).transferFrom(address(this), seller, id);
        emit AuctionCancelled(nft, id);
    }

    function currentPrice(address nft, uint256 id) public view returns (uint256) {
        Auction storage a = auctions[_key(nft,id)];
        require(a.startedAt > 0, "no auction");
        uint256 elapsed = block.timestamp - a.startedAt;
        if (elapsed >= a.duration) return a.endPrice;
        return a.startPrice - (uint256(a.startPrice) - a.endPrice) * elapsed / a.duration;
    }

    function onERC721Received(address,address,uint256,bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }
}
