pragma solidity ^0.5.0;

import "../openzeppelin-solidity/MintableToken.sol";
import "../openzeppelin-solidity/BurnableToken.sol";

contract TRU is MintableToken, BurnableToken {
    string public constant name = "TRU Token";
    string public constant symbol = "TRU";
    uint8 public constant decimals = 18;
/*
    event Burn(address indexed from, uint256 amount);
*/

    mapping (address => uint) test_tokens;

    bool faucetEnabled;

    function enableFaucet() public onlyOwner {
        faucetEnabled = true;
    }

    function disableFaucet() public onlyOwner {
        faucetEnabled = false;
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
