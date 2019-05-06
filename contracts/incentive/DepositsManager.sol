pragma solidity ^0.5.0;

import "../openzeppelin-solidity/SafeMath.sol";
import "../interface/IToken.sol";

contract DepositsManager {
    using SafeMath for uint;

    mapping(address => uint) public deposits;
    mapping(address => uint) public reward_deposits;
    address public owner;
    IToken public stake;
    IToken public cpu;

    event DepositMade(address who, uint amount);
    event DepositWithdrawn(address who, uint amount);

    // @dev – the constructor
    constructor(address _cpu, address _stake) public {
        owner = msg.sender;
        stake = IToken(_stake);
        cpu = IToken(_cpu);
    }
    
    // @dev - fallback does nothing since we only accept TRU tokens
    function () external payable {
        revert();
    }

    // @dev – returns an account's deposit
    // @param who – the account's address.
    // @return – the account's deposit.
    function getDeposit(address who) view public returns (uint) {
        return deposits[who];
    }

    function getRewardDeposit(address who) view public returns (uint) {
        return reward_deposits[who];
    }

    // @dev - allows a user to deposit TRU tokens
    // @return - the uer's update deposit amount
    function makeDeposit(uint _deposit) public payable returns (uint) {
	    require(_deposit > 0);
        require(stake.allowance(msg.sender, address(this)) >= _deposit);
        stake.transferFrom(msg.sender, address(this), _deposit);

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
        stake.transfer(msg.sender, amount);

        emit DepositWithdrawn(msg.sender, amount);
        return deposits[msg.sender];
    }

    // @dev - allows a user to deposit TRU tokens
    // @return - the uer's update deposit amount
    function makeRewardDeposit(uint _deposit) public payable returns (uint) {
	    require(_deposit > 0, "deposit needs to be greater than zero");
        require(cpu.allowance(msg.sender, address(this)) >= _deposit, "not enough allowance");
        cpu.transferFrom(msg.sender, address(this), _deposit);

        reward_deposits[msg.sender] = reward_deposits[msg.sender].add(_deposit);
        emit DepositMade(msg.sender, _deposit);
        return deposits[msg.sender];
    }

    // @dev - allows a user to withdraw TRU from their deposit
    // @param amount - how much TRU to withdraw
    // @return - the user's updated deposit
    function withdrawRewardDeposit(uint amount) public returns (uint) {
        require(reward_deposits[msg.sender] >= amount);
        reward_deposits[msg.sender] = reward_deposits[msg.sender].sub(amount);
        cpu.transfer(msg.sender, amount);

        emit DepositWithdrawn(msg.sender, amount);
        return reward_deposits[msg.sender];
    }

}
