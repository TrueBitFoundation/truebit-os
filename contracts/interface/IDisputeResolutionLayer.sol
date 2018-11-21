pragma solidity ^0.5.0;

interface IDisputeResolutionLayer {
    function status(bytes32 id) external view returns (uint8); //returns State enum
    function timeoutBlock(bytes32 id) external view returns (uint);
}
