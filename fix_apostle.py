
with open('contracts/EvoLandV2.sol','r',encoding='utf-8') as f: c=f.read()

# find old apostle section
start_marker = '// -- Apostle NFT V2'
# find by unique substring
idx_start = c.find('contract ApostleNFT is ERC721Base {')
# find end by looking for the closing brace after breed/isAdult etc
# search from idx_start for the second occurrence of the transferFrom pattern + last brace
import re
# Find from ApostleNFT start to just before MiningSystem
idx_mine = c.find('// -- Mining System V2')
if idx_mine < 0:
    idx_mine = c.find('contract MiningSystem is Ownable {')

new_apostle = '''contract ApostleNFT is ERC721Base {
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
}

'''

print(f'ApostleNFT idx: {idx_start}, MiningSystem idx: {idx_mine}')
new_c = c[:idx_start] + new_apostle + c[idx_mine:]
with open('contracts/EvoLandV2.sol','w',encoding='utf-8') as f: f.write(new_c)
print('done, total lines:', new_c.count('\n'))
