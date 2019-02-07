pragma solidity ^0.5.0;

import "./BundleManager.sol";

/**
* @title Calculate a merkle tree for the filesystem in solidity
* @author Sami Mäkelä
*/
contract Filesystem is BundleManager {
    constructor() public BundleManager() {}
    function calcId(uint nonce) public view returns (bytes32) {
	return keccak256(abi.encodePacked(msg.sender, nonce));
    }

}
