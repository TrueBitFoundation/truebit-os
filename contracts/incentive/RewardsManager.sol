pragma solidity ^0.5.0;

import "../openzeppelin-solidity/SafeMath.sol";
import "../interface/IToken.sol";

contract RewardsManager {
    using SafeMath for uint;

    mapping(bytes32 => uint) public rewards;
    mapping(bytes32 => uint) public taxes;
    address public owner;
    IToken public tru;

    event RewardDeposit(bytes32 indexed task, address who, uint amount, uint tax);
    event RewardClaimed(bytes32 indexed task, address who, uint amount, uint tax);
    
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor(address _t) public {
        owner = msg.sender;
        tru = IToken(_t);
    }

    function getTaskReward(bytes32 taskID) public view returns (uint) {
        return rewards[taskID];
    }

    function depositReward(bytes32 taskID, uint reward, uint tax) internal {
        rewards[taskID] = rewards[taskID].add(reward);
        taxes[taskID] = rewards[taskID].add(tax);
        emit RewardDeposit(taskID, msg.sender, reward, tax);
    }

    function payReward(bytes32 taskID, address to) internal {
        require(rewards[taskID] > 0);
        uint payout = rewards[taskID];
        rewards[taskID] = 0;

        uint tax = taxes[taskID];
        taxes[taskID] = 0;

        tru.mint(to, payout);
//        tru.transfer(to, payout);
        emit RewardClaimed(taskID, to, payout, tax);
    }

    function getTax(bytes32 taskID) public view returns (uint) {
        return taxes[taskID];
    }

}
