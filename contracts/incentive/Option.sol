pragma solidity ^0.5.0;

import "../interface/IToken.sol";

contract Option {
    IToken cpu;
    IToken tru;

    struct Item {
        IToken token;
        uint rate;
    }

    address owner;

    mapping (address => Item) whitelist;

    uint constant TIMEOUT = 100;

    constructor (address cpu_, address tru_) public {
        owner = msg.sender;
        cpu = IToken(cpu_);
        tru = IToken(tru_);
    }

    function add(address t, uint rate) public {
        require(msg.sender == owner, "Only owner can modify whitelist");
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

    // suggest minting more CPU
    function startMint(address ta, uint amount, uint cpu_amount) public returns (bytes32) {
        IToken t = whitelist[ta].token;

        // move funds here
        t.transferFrom(msg.sender, address(this), amount);
        cpu.transferFrom(msg.sender, address(this), 1 ether);

        uniq++;
        bytes32 id = keccak256(abi.encodePacked(uniq, msg.sender, ta, amount));
        minting[id] = Mint(msg.sender, block.number, ta, amount, cpu_amount, Status.Minting);
        return id;
    }

    // after timeout, CPU can be minted
    function mint(bytes32 id) public {
        Mint storage m = minting[id];
        require(m.state == Status.Minting, "Invalid item or id");
        require(m.bn + TIMEOUT > block.number, "Wait for timeout");
        m.state = Status.Minted;
        cpu.mint(m.to, m.cpu_amount);
    }

    // prevent minting, get the CPU bond
    function exchange(bytes32 id) public {
        Mint storage m = minting[id];
        // calculate suggested price: it's amount of tokens divided by amount of CPU tokens
        // then adjust by the rate which tells how much is actually accepted as collateral
        uint suggested = (m.amount*1 ether / m.cpu_amount) / whitelist[m.token].rate;
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
    }

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

    function medianPrice() public returns (uint);

    function give(bytes32 id) public {
        Convert storage c = conv[id];
        require(c.bn != 0, "Empty conversion item");
        tru.transferFrom(msg.sender, c.to, medianPrice());
        cpu.transfer(msg.sender, 1 ether);
    }

    function timeout(bytes32 id) public {
        Convert storage c = conv[id];
        require(c.bn != 0, "Empty conversion item");
        require(c.bn + TIMEOUT > block.number, "Wait for timeout");
        tru.mint(c.to, medianPrice());
    }

}


