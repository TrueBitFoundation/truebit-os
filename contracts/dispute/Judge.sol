pragma solidity ^0.5.0;

import "./CommonOnchain.sol";

contract Judge is CommonOnchain {

    address winner;

    constructor () public {
    }

    bytes32 constant mask = bytes32(uint256(0xffffffffffffffffffffffffffffffffffffffffffffffff));

    function checkProof(bytes32[] memory pr, bytes32[] memory pr2) internal view {
       if (pr2.length == 0 && !(phase == 7 && getHint(7) == 0x0c)) require (pr.length == 0 || (pr.length != 1 && pr[0] == pr[0]&mask && pr[1] == pr[1]&mask));
    }

    function judgeCustom(bytes32 start, bytes32 next, bytes32 ex_state, uint ex_size, bytes32 op, uint[4] memory regs, bytes32[10] memory roots,
     uint[4] memory pointers, bytes32[] memory _proof) public {
         
         setVM(roots, pointers);
         setMachine(hashVM(), op, regs[0], regs[1], regs[2], regs[3]);
         proof = _proof;
         
         require(hashMachine() == start);
         require(getRoot(regs[0]) == vm_r.input_data);
         
         // state after execution
         regs[1] = ex_size;
         // checkProof(_proof);
         setInputFile(regs[0], ex_state);
         
         m.vm = hashVM();
         require(hashMachine() == next);
    }

    function judge(bytes32[13] memory res, uint q,
                        bytes32[] memory _proof, bytes32[] memory _proof2,
                        bytes32 vm_, bytes32 op, uint[4] memory regs,
                        bytes32[10] memory roots, uint[4] memory pointers) public returns (uint) {
        setMachine(vm_, op, regs[0], regs[1], regs[2], regs[3]);
        setVM(roots, pointers);
        // Special initial state
        if (q == 0) {
            m.vm = hashVM();
            state = hashMachine();
            require(m.vm == res[q]);
        }
        else {
           require(hashVM() == m.vm);
           state = res[q];
           require(state == hashMachine());
        }
        phase = q;
        checkProof(_proof, _proof2);
        proof = _proof;
        proof2 = _proof2;
        performPhase();
        // Special final state
        if (q == 11) state = m.vm;
        require (state == res[q+1]);
        winner = msg.sender;
        return q;
    }

    function debug_judge(bytes32[13] memory res, uint q,
                        bytes32[] memory _proof, bytes32[] memory _proof2,
                        bytes32 vm_, bytes32 op, uint[4] memory regs,
                        bytes32[10] memory roots, uint[4] memory pointers) public returns (uint, bytes32, bytes32, uint) {
        setMachine(vm_, op, regs[0], regs[1], regs[2], regs[3]);
        setVM(roots, pointers);
        // Special initial state
        if (q == 0) {
            m.vm = hashVM();
            state = hashMachine();
            // require(m.vm == res[q]);
        }
        else {
           state = res[q];
           // require(state == hashMachine());
        }
        phase = q;
        checkProof(_proof, _proof2);
        proof = _proof;
        proof2 = _proof2;
        performPhase();
        // Special final state
        if (q == 11) state = m.vm;
        // require (state == res[q+1]);
        winner = msg.sender;
        return (q, state, debugb, debug);
    }

    function checkFileProof(bytes32 state, bytes32[10] memory roots, uint[4] memory pointers, bytes32[] memory _proof, uint loc) public returns (bool) {
        setVM(roots, pointers);
        proof = _proof;
        return state == calcIOHash(roots) && vm_r.input_data == getRoot(loc);
    }

    function checkProof(bytes32 hash, bytes32 root, bytes32[] memory _proof, uint loc) public returns (bool) {
        proof = _proof;
        return uint(hash) == getLeaf(loc) && root == getRoot(loc);
    }

    function calcStateHash(bytes32[10] memory roots, uint[4] memory pointers) public returns (bytes32) {
        setVM(roots, pointers);
        return hashVM();
    }

    function calcIOHash(bytes32[10] memory roots) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(roots[0], roots[7], roots[8], roots[9]));
    }

}
