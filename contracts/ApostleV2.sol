// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ================================================================
//  ApostleV2 — 支持代数、性别、成长、繁殖
//  - gen: 0代 = 创世（盲盒），1代以上 = 繁殖所得
//  - gender: 0=雄 1=雌
//  - genes: 64bit 基因（影响后代属性）
//  - birthTime: 铸造时间
//  - cooldown: 繁殖冷却结束时间
//  - GROWTH_TIME: 孵化→成人所需秒数（默认7天）
// ================================================================

interface IERC721Receiver {
    function onERC721Received(address,address,uint256,bytes calldata) external returns (bytes4);
}

abstract contract Ownable {
    address public owner;
    constructor() { owner = msg.sender; }
    modifier onlyOwner() { require(msg.sender == owner, "!owner"); _; }
    function transferOwnership(address a) external onlyOwner { owner = a; }
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
    function setApprovalForAll(address op, bool v) external {
        isApprovedForAll[msg.sender][op]=v; emit ApprovalForAll(msg.sender,op,v);
    }
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
    function _chk(address op, address f, address t, uint256 id, bytes memory d) internal {
        if (t.code.length>0) require(IERC721Receiver(t).onERC721Received(op,f,id,d)==0x150b7a02,"!receiver");
    }
}

contract ApostleV2 is ERC721Base {
    uint256 public nextId = 1;
    mapping(address => bool) public operators;

    // 成长时间：7天后从孵化状态变为成人
    uint256 public constant GROWTH_TIME = 7 days;
    // 繁殖冷却：繁殖后需冷却
    uint256 public constant BREED_COOLDOWN_BASE = 1 days; // 每代+1天

    struct ApostleAttr {
        uint8  strength;   // 1-100 挖矿力
        uint8  element;    // 0-4 元素
        uint8  gender;     // 0=雄 1=雌
        uint16 gen;        // 代数：0=创世，1=第一代...
        uint64 genes;      // 基因（影响后代）
        uint64 birthTime;  // 铸造时间
        uint64 cooldown;   // 繁殖冷却结束时间
        uint32 motherId;   // 母亲ID（0=创世）
        uint32 fatherId;   // 父亲ID（0=创世）
    }
    mapping(uint256 => ApostleAttr) public attrs;

    // 繁殖费用（RING）
    address public ringToken;
    uint256 public breedFee = 1e18; // 1 RING

    event ApostleMinted(uint256 indexed id, address to, uint8 strength, uint8 element, uint8 gender, uint16 gen);
    event ApostleBred(uint256 indexed childId, uint256 motherId, uint256 fatherId, address to);

    modifier onlyOperator() { require(operators[msg.sender]||msg.sender==owner,"!op"); _; }

    constructor(address _ring) ERC721Base("EvoLand Apostle V2", "APO") {
        ringToken = _ring;
    }

    function setOperator(address a, bool v) external onlyOwner { operators[a]=v; }
    function setBreedFee(uint256 fee) external onlyOwner { breedFee = fee; }

    // ── 铸造（运营商/盲盒）──────────────────────────────────────
    function mint(address to, uint8 strength, uint8 element) external onlyOperator returns (uint256 id) {
        require(strength>=1&&strength<=100&&element<=4,"bad attr");
        id = nextId++;
        uint8 gender = uint8(uint256(keccak256(abi.encodePacked(id, block.timestamp))) % 2);
        uint64 genes  = uint64(uint256(keccak256(abi.encodePacked(id, block.prevrandao))));
        attrs[id] = ApostleAttr({
            strength: strength,
            element:  element,
            gender:   gender,
            gen:      0,
            genes:    genes,
            birthTime: uint64(block.timestamp),
            cooldown:  0,
            motherId:  0,
            fatherId:  0
        });
        _mint(to, id);
        emit ApostleMinted(id, to, strength, element, gender, 0);
    }

    // ── 繁殖：雄使徒调用，指定雌使徒 ──────────────────────────
    function breed(uint256 maleId, uint256 femaleId) external returns (uint256 childId) {
        require(ownerOf[maleId]==msg.sender, "!male owner");
        // 雌可以来自任意人（公开繁殖市场）或自己
        require(ownerOf[femaleId]==msg.sender || isApprovedForAll[ownerOf[femaleId]][msg.sender], "!female owner");

        ApostleAttr storage m = attrs[maleId];
        ApostleAttr storage f = attrs[femaleId];

        require(m.gender == 0, "male not male");
        require(f.gender == 1, "female not female");
        require(block.timestamp >= m.cooldown, "male cooling");
        require(block.timestamp >= f.cooldown, "female cooling");
        require(isAdult(maleId), "male not adult");
        require(isAdult(femaleId), "female not adult");

        // 收繁殖费
        if (breedFee > 0 && ringToken != address(0)) {
            _transferRING(msg.sender, owner, breedFee);
        }

        // 生成后代属性（基因混合）
        uint64 childGenes = _mixGenes(m.genes, f.genes, block.prevrandao);
        uint8  childStrength = _inheritStrength(m.strength, f.strength, childGenes);
        uint8  childElement  = (uint8(childGenes) % 2 == 0) ? m.element : f.element;
        uint8  childGender   = uint8(childGenes >> 8) % 2;
        uint16 childGen      = (m.gen > f.gen ? m.gen : f.gen) + 1;

        childId = nextId++;
        attrs[childId] = ApostleAttr({
            strength:  childStrength,
            element:   childElement,
            gender:    childGender,
            gen:       childGen,
            genes:     childGenes,
            birthTime: uint64(block.timestamp),
            cooldown:  0,
            motherId:  uint32(femaleId),
            fatherId:  uint32(maleId)
        });
        _mint(msg.sender, childId);

        // 更新冷却时间
        uint256 maleCooldown  = BREED_COOLDOWN_BASE * (m.gen + 1);
        uint256 femCooldown   = BREED_COOLDOWN_BASE * (f.gen + 1);
        m.cooldown = uint64(block.timestamp + maleCooldown);
        f.cooldown = uint64(block.timestamp + femCooldown);

        emit ApostleBred(childId, femaleId, maleId, msg.sender);
    }

    // ── 查询：是否已成年 ────────────────────────────────────────
    function isAdult(uint256 id) public view returns (bool) {
        return block.timestamp >= attrs[id].birthTime + GROWTH_TIME;
    }

    // ── 查询：成长进度 0-100 ────────────────────────────────────
    function growthProgress(uint256 id) public view returns (uint8) {
        uint256 age = block.timestamp - attrs[id].birthTime;
        if (age >= GROWTH_TIME) return 100;
        return uint8(age * 100 / GROWTH_TIME);
    }

    // ── 基因混合 ────────────────────────────────────────────────
    function _mixGenes(uint64 a, uint64 b, uint256 seed) internal pure returns (uint64) {
        uint64 mask = uint64(uint256(keccak256(abi.encodePacked(seed))));
        return (a & mask) | (b & ~mask);
    }

    // ── 继承力量（父母平均±随机波动）──────────────────────────
    function _inheritStrength(uint8 s1, uint8 s2, uint64 genes) internal pure returns (uint8) {
        uint256 base = (uint256(s1) + uint256(s2)) / 2;
        // ±15% 随机波动
        uint256 vary = uint256(genes >> 16) % 30; // 0-29
        uint256 result = base + vary > 15 ? base + vary - 15 : 1;
        if (result > 100) result = 100;
        if (result < 1)   result = 1;
        return uint8(result);
    }

    function _transferRING(address from, address to, uint256 amount) internal {
        (bool ok,) = ringToken.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        require(ok, "ring transfer failed");
    }

    function transferFrom(address f, address t, uint256 id) public override {
        if (operators[msg.sender]) _xfer(f,t,id);
        else super.transferFrom(f,t,id);
    }
    function safeTransferFrom(address f, address t, uint256 id, bytes memory d) public override {
        if (operators[msg.sender]) { _xfer(f,t,id); _chk(msg.sender,f,t,id,d); }
        else super.safeTransferFrom(f,t,id,d);
    }

    function onERC721Received(address,address,uint256,bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }
}
