pragma solidity ^0.4.18;

import "../openzeppelin-solidity/SafeMath.sol";
import "./TRU.sol";

contract DepositsManager {
    using SafeMath for uint;

    mapping(address => uint) public deposits;
    uint public jackpot;
    address public owner;
    TRU public token;

    event DepositMade(address who, uint amount);
    event DepositWithdrawn(address who, uint amount);

    // @dev – the constructor
    constructor(address _tru) public {
        owner = msg.sender;
        token = TRU(_tru);
    }
    
    // @dev - fallback does nothing since we only accept TRU tokens
    function () public payable {
        revert();
    }

    // @dev – returns an account's deposit
    // @param who – the account's address.
    // @return – the account's deposit.
    function getDeposit(address who) view public returns (uint) {
        return deposits[who];
    }

    // @dev - allows a user to deposit TRU tokens
    // @return - the uer's update deposit amount
    function makeDeposit(uint _deposit) public payable returns (uint) {
        require(token.allowance(msg.sender, address(this)) >= _deposit);
        token.transferFrom(msg.sender, address(this), _deposit);

        deposits[msg.sender] = deposits[msg.sender].add(_deposit);
        emit DepositMade(msg.sender, _deposit);
        return deposits[msg.sender];
    }

    // @dev - allows a user to withdraw TRU from their deposit
    // @param amount - how much TRU to withdraw
    // @return - the user's updated deposit
    function withdrawDeposit(uint amount) public returns (uint) {
        require(deposits[msg.sender] >= amount);
        
        deposits[msg.sender] = deposits[msg.sender].sub(amount);
        token.transfer(msg.sender, amount);

        emit DepositWithdrawn(msg.sender, amount);
        return deposits[msg.sender];
    }

}
