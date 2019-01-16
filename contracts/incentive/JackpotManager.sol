pragma solidity ^0.5.0;

import "../openzeppelin-solidity/SafeMath.sol";
import "../openzeppelin-solidity/Ownable.sol";
import "./TRU.sol";

contract BaseJackpotManager is Ownable {
    using SafeMath for uint;

    struct Jackpot {
        uint finalAmount;
        uint amount;
        address[] challengers;
        uint redeemedCount;
    }

    event ReceivedJackpot(address receiver, uint amount);

    mapping(uint => Jackpot) jackpots;//keeps track of versions of jackpots

    uint internal currentJackpotID;
    TRU public token;
    uint internal forcedErrorThreshold;

    event JackpotIncreased(uint amount);

    constructor (address payable _TRU) public {
        token = TRU(_TRU);
	forcedErrorThreshold = 500000; // should mean 100000/1000000 probability	
    }

    // @dev – returns the current jackpot
    // @return – the jackpot.
    function getJackpotAmount() view public returns (uint) {
        return jackpots[currentJackpotID].amount;
    }

    function getCurrentJackpotID() view public returns (uint) {
        return currentJackpotID;
    }

    //// @dev – allows a uer to donate to the jackpot.
    //// @return – the updated jackpot amount.
    //function donateToJackpot() public payable {
    //    jackpots[currentJackpotID].amount = jackpots[currentJackpotID].amount.add(msg.value);
    //    emit JackpotIncreased(msg.value);
    //}

    function increaseJackpot(uint _amount) public payable {
        jackpots[currentJackpotID].amount = jackpots[currentJackpotID].amount.add(_amount);
        emit JackpotIncreased(_amount);
    } 

    //TODO: Need a modifier that whitelists msg.senders for this call
    
    function setJackpotReceivers(address[] memory _challengers) public returns (uint) {
        jackpots[currentJackpotID].finalAmount = jackpots[currentJackpotID].amount;
        jackpots[currentJackpotID].challengers = _challengers;
        currentJackpotID = currentJackpotID + 1;
        return currentJackpotID - 1;
    }

    function getJackpotReceivers(uint jackpotID) public view returns (address[] memory) {
        Jackpot storage j = jackpots[jackpotID];
        return j.challengers;
    }

    function receiveJackpotPayment(uint jackpotID, uint index) public {
        Jackpot storage j = jackpots[jackpotID];
        require(j.challengers[index] == msg.sender);

        //transfer jackpot payment
        uint amount = j.finalAmount.div(2**(j.challengers.length-1));
        token.transfer(msg.sender, amount);
	
        emit ReceivedJackpot(msg.sender, amount);
    }

    function setForcedErrorThreshold(uint _forcedErrorThreshold) public onlyOwner {
	forcedErrorThreshold = _forcedErrorThreshold;
    }
    
}

interface IForcedError {
    function isForcedError(uint randomBits, bytes32 bh) external view returns (bool);
}

contract JackpotManager is BaseJackpotManager, IForcedError {

    constructor (address payable _TRU) BaseJackpotManager(_TRU) public {}
    
    function isForcedError(uint randomBits, bytes32 bh) external view returns (bool) {
        return (uint(keccak256(abi.encodePacked(randomBits, bh))) % 1000000 < forcedErrorThreshold);
    }
    
}

contract AlwaysJackpotManager is BaseJackpotManager, IForcedError {

    constructor (address payable _TRU) BaseJackpotManager(_TRU) public {}
    
    function isForcedError(uint, bytes32) external view returns (bool) {
        return true;
    }
    
}

contract NeverJackpotManager is BaseJackpotManager, IForcedError {

    constructor (address payable _TRU) BaseJackpotManager(_TRU) public {}
    
    function isForcedError(uint, bytes32) external view returns (bool) {
        return false;
    }
    
}
