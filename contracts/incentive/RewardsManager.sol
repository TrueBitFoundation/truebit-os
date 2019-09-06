pragma solidity ^0.5.0;

import "../openzeppelin-solidity/SafeMath.sol";
import "../interface/IToken.sol";
import "./DepositsManager.sol";
import "../openzeppelin-solidity/Ownable.sol";

contract RewardsManager is Ownable {

    uint fee;
    uint fee_fixed;

    function setFee(uint a) public onlyOwner {
        fee = a;
    }

    function setFixedFee(uint a) public onlyOwner {
        fee_fixed = a;
    }

    function getFee() public view returns (uint) {
        return fee;
    }

    function getFixedFee() public view returns (uint) {
        return fee_fixed;
    }

}
