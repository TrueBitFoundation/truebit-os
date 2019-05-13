pragma solidity ^0.5.0;

interface IDispute {
    enum Status { Uninitialized, Challenged, Unresolved, SolverWon, ChallengerWon }
    function status(bytes32 id) external view returns (Status);
    function timeoutBlock(bytes32 id) external view returns (uint);
    function make(bytes32 taskID, address solver, address verifier,
                  bytes32 startStateHash, bytes32 endStateHash, uint256 size, uint timeout) external returns (bytes32);
}
