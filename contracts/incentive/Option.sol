pragma solidity ^0.5.0;

import "../interface/IToken.sol";

contract Option {

    struct Item {
        IToken token;
        uint rate;
    }

    address owner;
    mapping (address => Item) whitelist;

    uint constant TIMEOUT = 10;

    IToken cpu;
    IToken tru;

    constructor (address cpu_, address tru_) public {
        owner = msg.sender;
        cpu = IToken(cpu_);
        tru = IToken(tru_);
    }

    // 1 ether = 100%
    function add(address t, uint rate) public {
        require(msg.sender == owner, "Only owner can modify whitelist");
        require(rate >= 1 ether, "Rate must be over 100%");
        whitelist[t] = Item(IToken(t), rate);
    }

    uint uniq;

    enum Status { None, Minting, Minted, Withdrawn }

    struct Mint {
        address to;
        uint bn;
        address token;
        uint amount;
        uint cpu_amount;
        Status state;
    }

    mapping (bytes32 => Mint) minting;

    event StartMint(bytes32 id, address snd, address token, uint amount, uint cpu_amount);

    // suggest minting more CPU
    // there might be some limits for how much one can mint, for example they could be bonded into stakes
    function startMint(address ta, uint amount, uint cpu_amount) public returns (bytes32) {
        IToken t = whitelist[ta].token;

        // move funds here
        t.transferFrom(msg.sender, address(this), amount);
        cpu.transferFrom(msg.sender, address(this), 1 ether);

        uniq++;
        bytes32 id = keccak256(abi.encodePacked(uniq, msg.sender, ta, amount));
        minting[id] = Mint(msg.sender, block.number, ta, amount, cpu_amount, Status.Minting);
        emit StartMint(id, msg.sender, ta, amount, cpu_amount);
        return id;
    }

    // after timeout, CPU can be minted
    function mint(bytes32 id) public returns (bool) {
        Mint storage m = minting[id];
        require(m.state == Status.Minting, "Invalid item or id");
        require(m.bn + TIMEOUT < block.number, "Wait for timeout");
        m.state = Status.Minted;
        cpu.mint(m.to, m.cpu_amount);
        return true;
    }

    function getSuggested(bytes32 id) public view returns (uint) {
        Mint storage m = minting[id];
        uint suggested = (m.amount*1 ether*1 ether / m.cpu_amount) / whitelist[m.token].rate;
        return suggested;
    }

    // prevent minting, get the CPU bond
    function exchange(bytes32 id) public {
        Mint storage m = minting[id];
        // calculate suggested price: it's amount of tokens divided by amount of CPU tokens
        // then adjust by the rate which tells how much is actually accepted as collateral
        uint suggested = getSuggested(id);
        require(m.state == Status.Minting, "Invalid item or id");
        IToken t = whitelist[m.token].token;
        t.transferFrom(msg.sender, address(this), suggested);
        cpu.transfer(msg.sender, 1 ether);
        t.transfer(m.to, m.amount);
        m.state = Status.Withdrawn;
    }

    // optional: it might be possible to withdraw the deposited tokens and burn the CPU
    function withdraw(bytes32 id) internal {
        Mint storage m = minting[id];
        require(m.to == msg.sender, "Only minter can withdraw");
        cpu.transferFrom(msg.sender, address(this), m.cpu_amount);
        IToken t = whitelist[m.token].token;
        t.transfer(m.to, m.amount);
        m.state = Status.Withdrawn;
    }

    // using CPU tokens: there are basically two alternatives, first is that somebody converts it to TRU tokens with median price
    // second is that TRU tokens are minted
    struct Convert {
        address to;
        uint bn;
    }

    mapping (bytes32 => Convert) conv;

    function use() public {
        uniq++;
        bytes32 id = keccak256(abi.encodePacked(uniq, msg.sender));
        cpu.transferFrom(msg.sender, address(this), 1 ether);
        conv[id] = Convert(msg.sender, block.number);
    }

    function medianPrice() public returns (uint) {
        return 1 ether;
    }

    function give(bytes32 id) public {
        Convert storage c = conv[id];
        require(c.bn != 0, "Empty conversion item");
        tru.transferFrom(msg.sender, c.to, medianPrice());
        cpu.transfer(msg.sender, 1 ether);
    }

    function timeout(bytes32 id) public {
        Convert storage c = conv[id];
        require(c.bn != 0, "Empty conversion item");
        require(c.bn + TIMEOUT < block.number, "Wait for timeout");
        tru.mint(c.to, medianPrice());
    }
}

// staking with pricing
contract Staking {
    address owner;

    uint constant MARGIN = 1.2 ether;
    uint constant TIMEOUT = 10;

    IToken cpu;
    IToken tru;

    constructor (address cpu_, address tru_) public {
        owner = msg.sender;
        cpu = IToken(cpu_);
        tru = IToken(tru_);
    }

    enum Status { None, Posted, Active, Withdrawn }

    struct Stake {
        address owner;
        uint tru_amount;
        Status state;
        uint bn;
    }

    mapping (bytes32 => Stake) stakes;

    uint uniq;

    event Posted(bytes32 id, address a, uint tru_amount);

    function post(uint tru_amount) public returns (bytes32) {
        uniq++;
        bytes32 id = keccak256(abi.encodePacked(uniq, msg.sender));
        stakes[id] = Stake(msg.sender, tru_amount, Status.Posted, block.number);
        tru.transferFrom(msg.sender, address(this), tru_amount);
        cpu.transferFrom(msg.sender, address(this), 1 ether);
        emit Posted(id, msg.sender, tru_amount);
        return id;
    }

    function activate(bytes32 id) public {
        Stake storage s = stakes[id];
        require(s.state == Status.Posted, "Wrong state");
        require(s.bn + TIMEOUT < block.number, "Wait for timeout");
        cpu.transfer(address(this), 1 ether);
        s.state = Status.Active;
    }

    // amount of TRU to buy one CPU
    function getSuggestedCPU(bytes32 id) public view returns (uint) {
        Stake storage s = stakes[id];
        uint suggested = s.tru_amount * MARGIN / 100 ether;
        return suggested;
    }

    function buyCPU(bytes32 id) public {
        Stake storage s = stakes[id];
        require(s.state == Status.Posted, "Wrong state");
        uint suggested = getSuggestedCPU(id);
        tru.transferFrom(msg.sender, address(this), suggested);
        tru.transfer(s.owner, s.tru_amount + suggested);
        cpu.transfer(msg.sender, 1 ether);
        s.state = Status.Withdrawn;
    }

    // amount of CPU to buy one TRU
    /*
    function getSuggestedTRU(bytes32 id) public view returns (uint) {
        Stake storage s = stakes[id];
        uint suggested = 100 ether * MARGIN / s.tru_amount;
        return suggested;
    }
    */

    // amount of TRU bought with one CPU
    function getSuggestedTRU(bytes32 id) public view returns (uint) {
        Stake storage s = stakes[id];
        uint suggested = s.tru_amount * 1 ether * 1 ether / MARGIN / 100 ether;
        return suggested;
    }

    function buyTRU(bytes32 id) public {
        Stake storage s = stakes[id];
        require(s.state == Status.Posted, "Wrong state");
        uint suggested = getSuggestedTRU(id);
        cpu.transferFrom(msg.sender, address(this), 1 ether);
        tru.transfer(msg.sender, suggested);
        tru.transfer(s.owner, s.tru_amount-suggested);
        cpu.transfer(s.owner, 2 ether);
        s.state = Status.Withdrawn;
    }

}



