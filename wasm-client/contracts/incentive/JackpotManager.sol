pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./TRU.sol";

contract JackpotManager {
    using SafeMath for uint;

    struct Jackpot {
        uint finalAmount;
        uint amount;
        address[] challengers;
        uint redeemedCount;
    }

    mapping(uint => Jackpot) jackpots;//keeps track of versions of jackpots

    uint internal currentJackpotID;
    TRU public token;

    event JackpotIncreased(uint amount);

    constructor (address _TRU) public {
        token = TRU(_TRU);
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

    function setJackpotReceivers(address[] _challengers) internal returns (uint) {
        jackpots[currentJackpotID].finalAmount = jackpots[currentJackpotID].amount;
        jackpots[currentJackpotID].challengers = _challengers;
        currentJackpotID = currentJackpotID + 1;
        return currentJackpotID - 1;
    }

    function receiveJackpotPayment(uint jackpotID, uint index) public {
        Jackpot storage j = jackpots[jackpotID];
        require(j.challengers[index] == msg.sender);        
        
        uint amount = j.finalAmount.div(2**(index+1));
        //transfer jackpot payment
        //msg.sender.transfer(amount);
        token.mint(msg.sender, amount);
    }
}
