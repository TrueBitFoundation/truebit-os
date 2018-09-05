pragma solidity ^0.4.18;

interface IDisputeResolutionLayer {
    function status(bytes32 id) external view returns (uint8); //returns State enum
}
