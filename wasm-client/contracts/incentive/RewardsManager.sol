pragma solidity^0.4.18;

import "../openzeppelin-solidity/SafeMath.sol";
import "./TRU.sol";

contract RewardsManager {
    using SafeMath for uint;

    mapping(uint => uint) public rewards;
    address public owner;
    TRU public token;

    event RewardDeposit(uint indexed task, address who, uint amount);
    event RewardClaimed(uint indexed task, address who, uint amount);
    
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor(address _tru) public {
        owner = msg.sender;
        token = TRU(_tru);
    }

    function getTaskReward(uint taskID) public view returns (uint) {
        return rewards[taskID];
    }

    function depositReward(uint taskID, uint reward) public returns (bool) {
        require(token.allowance(msg.sender, address(this)) >= reward);
        token.transferFrom(msg.sender, address(this), reward);
    
        rewards[taskID] = rewards[taskID].add(reward);
        emit RewardDeposit(taskID, msg.sender, reward);
        return true; 
    }

    function payReward(uint taskID, address to) internal returns (bool) {
        require(rewards[taskID] > 0);
        uint payout = rewards[taskID];
        rewards[taskID] = 0;
        
        token.transfer(to, payout);
        emit RewardClaimed(taskID, to, payout);
        return true;
    } 

}
