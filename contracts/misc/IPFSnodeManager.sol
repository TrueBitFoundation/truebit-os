pragma solidity ^0.5.0;
import "../openzeppelin-solidity/Ownable.sol";

contract IPFSnodeManager is Ownable {

    address private owner;
    constructor () public {
        owner = msg.sender;
    }

    bytes IPFSaddresses;

    function addNode(bytes memory ipfsAddress) public {
        for (uint i=0; i<ipfsAddress.length; i++) {
            require(ipfsAddress[i] != ",", ", (comma) character cannot be included in IPFS multiaddr");
            IPFSaddresses.push(ipfsAddress[i]);
        }
        IPFSaddresses.push(",");
    }
    
    function getNodes() public view returns (bytes memory) {
        return IPFSaddresses;
    }

    function resetNodes() public onlyOwner {
        delete IPFSaddresses;
    }
    
}