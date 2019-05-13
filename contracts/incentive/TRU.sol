pragma solidity ^0.5.0;

import "../openzeppelin-solidity/MintableToken.sol";
import "../openzeppelin-solidity/BurnableToken.sol";

contract TRU is MintableToken, BurnableToken {
    string public name = "TRU Token";
    string public symbol = "TRU";
    uint8 public constant decimals = 18;

    mapping (address => uint) test_tokens;
    mapping (address => bool) transfer_wl;
    bool allow_all;

    constructor (string memory _name, string memory _symbol, bool param) public {
        name = _name;
        symbol = _symbol;
        allow_all = param;
    }

    bool faucetEnabled;

    function enableFaucet() public onlyOwner {
        faucetEnabled = true;
    }

    function disableFaucet() public onlyOwner {
        faucetEnabled = false;
    }

    function allowTransfers(address a) public onlyOwner {
        transfer_wl[a] = true;
    }

    function disableTransfers(address a) public onlyOwner {
        transfer_wl[a] = false;
    }

    function transfer(address _to, uint _value) public returns (bool) {
        require(_value <= balances[msg.sender]);
        require(_to != address(0));
        require(allow_all || transfer_wl[_to] || transfer_wl[msg.sender]);

        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(_value <= balances[_from], "no balance");
        require(_value <= allowed[_from][msg.sender], "no allowance");
        require(_to != address(0));
        require(allow_all || transfer_wl[msg.sender], "locked address");

        balances[_from] = balances[_from].sub(_value);
        balances[_to] = balances[_to].add(_value);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        emit Transfer(_from, _to, _value);
        return true;
    }

    function getTestTokens() public returns (bool) {
        require (faucetEnabled);
        if (test_tokens[msg.sender] != 0) return false;
        test_tokens[msg.sender] = block.number;
        balances[msg.sender] += 100000000000000000000000;
        totalSupply_ += 100000000000000000000000;
        return true;
    }

    function () external payable {
        revert("Contract has disabled receiving ether");
    }

}
