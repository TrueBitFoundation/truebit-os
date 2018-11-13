pragma solidity ^0.4.15;

import "./CommonOffchain.sol";

contract Interpreter is CommonOffchain {
    /**
    * @dev run the module in its entirety
    *
    * @param code the wasm code to run
    * @param stack the stack
    * @param mem the linear memory
    * @param globals the gloval values
    * @param calltable the calltbale
    * @param calltypes the calltypes i.e.
    * @param call_stack the call stack
    * @param input the input size
    * @param pc the program counter
    * @param stack_ptr the stack pointer
    * @param call_ptr the call pointer
    * @param memsize the linear memory size
    *
    * @return return the wasm module's return value
    */
    function run(bytes32[] code, bytes32[] stack, bytes32[] mem, bytes32[] globals, bytes32[] calltable,
                 bytes32[] calltypes, bytes32[] call_stack, bytes32[] input,
                 uint pc, uint stack_ptr, uint call_ptr, uint memsize) public returns (int64) {
        vm_r.code = code;
        vm_r.stack = stack;
        vm_r.mem = mem;
        vm_r.globals = globals;
        vm_r.calltable = calltable;
        vm_r.calltypes = calltypes;
        vm_r.call_stack = call_stack;
        vm_r.input_size = input;
        vm.pc = pc;
        vm.stack_ptr = stack_ptr;
        vm.call_ptr = call_ptr;
        vm.memsize = memsize;
        
        /*
        while (vm_r.code[vm.pc] != 0x0000000000000000000000000000000000000000040006060001000106000000) {
            performPhase();
        } */
        return int64(vm_r.stack[0]);
    }

    /**
    * @dev run a single step
    *
    * @param limit maximum number of steps
    * @param code the code
    * @param roots the roots of the wasm machine state
    * @param pc program counter
    * @param stack_ptr stack pointer
    * @param call_ptr call pointer
    * @param memsize size of the linear memory
    *
    * @return return the top of stack, the program counter and the stack
    */
    function run2(uint limit, bytes32[] code,
                  uint[] roots,
                 uint pc, uint stack_ptr, uint call_ptr, uint memsize) public returns (int64, uint, bytes32) {
        vm_r.code = code;
        vm_r.stack.length = roots[0];
        vm_r.mem.length = roots[1];
        vm_r.globals.length = roots[2];
        vm_r.calltable.length = roots[3];
        vm_r.calltypes.length = roots[4];
        vm_r.call_stack.length = roots[5];
        vm_r.input_size.length = roots[6];
        vm.pc = pc;
        vm.stack_ptr = stack_ptr;
        vm.call_ptr = call_ptr;
        vm.memsize = memsize;
        
        while (limit > 0 && vm_r.code[vm.pc] != 0x0000000000000000000000000000000000000000040006060001000106000000) {
            performPhase();
            limit--;
        }
        return (int64(vm_r.stack[0]), vm.pc, keccak256(abi.encodePacked(vm_r.stack)));
    }

    function run3(uint limit, bytes32[] code) public returns (bytes32, uint, uint, uint, uint) {
        vm_r.code = code;
        vm_r.stack.length = 4;
        vm_r.mem.length = 4;
        vm_r.globals.length = 4;
        vm_r.calltable.length = 4;
        vm_r.calltypes.length = 4;
        vm_r.call_stack.length = 4;
        vm_r.input_size.length = 4;
        /*
        vm.pc = pc;
        vm.stack_ptr = stack_ptr;
        vm.call_ptr = call_ptr;
        vm.memsize = memsize;
        */

        while (limit > 0) {
            performPhase();
            limit--;
        }

        bytes32 s_top = 0;
        if (vm_r.stack.length > 0) s_top = bytes32(vm_r.stack[0]);

        return (s_top, vm.pc, m.reg1, m.reg2, getHint(3));
        // return (s_top, vm.pc, vm.stack_ptr, 0);
    }
}

