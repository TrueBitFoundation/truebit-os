pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

contract IPFSnodeManager {
    bytes IPFSaddresses;
    function addNode(bytes memory ipfsAddress) public {
        for (uint i=0; i<ipfsAddress.length; i++) {
            // handle duplicates
            IPFSaddresses.push(ipfsAddress[i]);
        }
        // is there any problem with multiaddr and this comma separator?
        IPFSaddresses.push(",");
    }
    
    function getNodes() public view returns (bytes memory) {
        return IPFSaddresses;
    }

    // add node removal through admin?
    
    // add fallback function?
}