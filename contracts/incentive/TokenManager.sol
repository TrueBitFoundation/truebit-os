pragma solidity ^0.5.0;

import "../interface/IToken.sol";

contract TokenManager {

    address owner;

    struct Token {
        uint rate;
        uint rate_back;
        uint limit;
        uint fee;
        uint fee_back;
    }

    mapping (address => Token) whitelist;

    IToken tru;

    constructor (address tru_) public {
        owner = msg.sender;
        tru = IToken(tru_);
    }

    struct User {
        IToken token;
        uint balance;
    }

    mapping (address => User) users;
    mapping (address => address) contracts;

    function setOwner(address other) public {
        require(msg.sender == owner, "only owner allowed");
        owner = other;
    }

    // rate 0 means that token is disabled
    function setRate(address token, uint rate, uint rate_back, uint limit, uint fee, uint fee_back) public {
        require(msg.sender == owner, "only owner allowed");
        whitelist[token].rate = rate;
        whitelist[token].rate_back = rate_back;
        whitelist[token].limit = limit;
        whitelist[token].fee = fee;
        whitelist[token].fee_back = fee_back;
    }

    function register(address token) public {
        if (address(users[msg.sender].token) == token) return;
        require (address(users[msg.sender].token) == address(0), "already registered");
        users[msg.sender].token = IToken(token);
    }

    mapping (address => mapping (address => uint)) allowances;

    function allowance(address from, address to) public view returns (uint) {
        return allowances[from][to];
    }

    function transferFrom(address from, address to, uint a) public {
        require(allowances[from][to] >= a, "not enough allowance");
        require(msg.sender == to, "can only pull funds to oneself");
        allowances[from][to] -= a;
        tru.mint(to, a);
    }

    function prepareDeposit(address other, uint amount) internal returns (uint, uint) {
        User storage u = users[msg.sender];
        require(u.token.allowance(msg.sender, address(this)) >= amount, "not enough allowance");
        u.token.transferFrom(msg.sender, address(this), amount);
        Token storage info = whitelist[address(u.token)];
        require(info.rate > 0, "token not whitelisted");
        require(info.limit >= amount, "token limit reached");
        if (info.fee > 0) u.token.transfer(owner, info.fee);
        uint amount_left = amount - info.fee;
        require(contracts[other] == msg.sender || contracts[other] == address(0) || contracts[other] == address(1), "not your contract");
        if (other != msg.sender) require(address(users[other].token) == address(0), "other users cannot be your contract");
        info.limit -= amount;
        uint new_tokens = amount_left * info.rate / 1 ether;
        return (new_tokens, amount_left);
    }

    function deposit(uint amount) public {
        require(contracts[msg.sender] == address(0) || contracts[msg.sender] == msg.sender, "contracts cannot deposit");
        (uint new_tokens, uint amount_left) = prepareDeposit(msg.sender, amount);
        contracts[msg.sender] = msg.sender;
        users[msg.sender].balance += amount_left;
        tru.mint(msg.sender, new_tokens);
    }

    function depositAllowance(address other, uint amount) public {
        require(contracts[other] == address(0) || contracts[other] == address(1), "not public contract");
        (uint new_tokens, ) = prepareDeposit(other, amount);
        allowances[msg.sender][other] = new_tokens;
        contracts[other] = address(1);
    }

    // maybe shouldn't be able to withdraw from contracts
    function withdrawFrom(address other, address to, uint amount) public {
        require(tru.allowance(other, address(this)) >= amount, "not enough allowance");
        tru.transferFrom(other, address(this), amount);
        require(contracts[other] == to, "can only withdraw from your own contract");
        User storage u = users[to];
        Token storage info = whitelist[address(u.token)];
        uint token_amount = amount * info.rate_back / 1 ether;
        require(u.balance >= token_amount, "cannot get more tokens back than was originally deposited");
        require(token_amount >= info.fee_back, "cannot afford fee");
        u.balance -= token_amount;
        u.token.transfer(to, token_amount-info.fee_back);
        u.token.transfer(owner, info.fee_back);
    }

    function withdraw(uint amount) public {
        withdrawFrom(msg.sender, msg.sender, amount);
    }

}

