pragma solidity ^0.4.15;

/**
* @title collection of getter and setter methods for manipulating the WASM runtime and initialization
* @author Sami Mäkelä
*/
contract Offchain {

    struct Roots {
        bytes32[] code;
        bytes32[] stack;
        bytes32[] mem;
        bytes32[] globals;
        bytes32[] calltable;
        bytes32[] calltypes;
        bytes32[] call_stack;
        bytes32[] input_size;
        bytes32[][] input_name;
        bytes32[][] input_data;
    }

    struct VM {
        uint pc;
        uint stack_ptr;
        uint call_ptr;
        uint memsize;
    }
    
    struct Machine {
        bytes32 op;
        uint reg1;
        uint reg2;
        uint reg3;
        uint ireg;
    }
    
    VM vm;
    Roots vm_r;
    Machine m;
    
    uint debug;
    
    function checkReadAccess(uint loc, uint hint) internal view returns (bool) {
        if (hint == 5) return loc < vm_r.globals.length;
        else if (hint == 6) return loc < vm_r.stack.length;
        else if (hint == 7) return loc < vm_r.stack.length;
        else if (hint == 8) return loc < vm_r.stack.length;
        else if (hint == 9) return loc < vm_r.stack.length;
        else if (hint == 14) return loc < vm_r.call_stack.length;
        else if (hint == 15) return loc < vm_r.mem.length;
        else if (hint == 16) return loc < vm_r.calltable.length;
        else if (hint == 17) return loc < vm_r.mem.length;
        else if (hint == 18) return loc < vm_r.calltypes.length;
        else if (hint == 19) return loc < vm_r.input_size.length;
        else if (hint == 0x16) return loc < vm_r.stack.length;
        return true;
    }
    
    function checkWriteAccess(uint loc, uint hint) internal view returns (bool) {
        if (hint & 0xc0 == 0x80) return loc < vm_r.mem.length;
        else if (hint & 0xc0 == 0xc0) return loc < vm_r.mem.length;
        else if (hint == 2) return loc < vm_r.stack.length;
        else if (hint == 3) return loc < vm_r.stack.length;
        else if (hint == 4) return loc < vm_r.stack.length;
        else if (hint == 6) return loc < vm_r.call_stack.length;
        else if (hint == 8) return loc < vm_r.globals.length;
        else if (hint == 9) return loc < vm_r.stack.length;
        else if (hint == 0x0a) return loc < vm_r.input_size.length;
        else if (hint == 0x0e) return loc < vm_r.calltable.length;
        else if (hint == 0x0f) return loc < vm_r.calltypes.length;
        return true;
    }
    
    function checkInputDataAccess(uint /* loc */, uint /* hint */) internal pure returns (bool) {
        return true;
    }
    
    function checkInputNameAccess(uint /* loc */, uint /* hint */) internal pure returns (bool) {
        return true;
    }
    
    // TODO: these should be cleared first
    function setStackSize(uint sz) internal {
        vm_r.stack.length = 0;
        vm_r.stack.length = 2**sz;
    }

    function setCallStackSize(uint sz) internal {
        vm_r.call_stack.length = 0;
        vm_r.call_stack.length = 2**sz;
    }

    function setGlobalsSize(uint sz) internal {
        vm_r.globals.length = 0;
        vm_r.globals.length = 2**sz;
    }

    function setMemorySize(uint sz) internal {
        vm_r.mem.length = 0;
        vm_r.mem.length = 2**sz;
    }

    function setTableSize(uint sz) internal {
        vm_r.calltable.length = 0;
        vm_r.calltable.length = 2**sz;
        vm_r.calltypes.length = 0;
        vm_r.calltypes.length = 2**sz;
    }

    function setTableTypesSize(uint sz) internal {
        vm_r.calltypes.length = 0;
        vm_r.calltypes.length = 2**sz;
    }

    function getCode(uint loc) internal view returns (bytes32) {
        return vm_r.code[loc];
    }

    function getStack(uint loc) internal view returns (uint) {
        return uint(vm_r.stack[loc]);
    }

    function getCallStack(uint loc) internal view returns (uint) {
        return uint(vm_r.call_stack[loc]);
    }

    function setCallStack(uint loc, uint v) internal  {
        vm_r.call_stack[loc] = bytes32(v);
    }

    function getCallTable(uint loc) internal view returns (uint) {
        return uint(vm_r.calltable[loc]);
    }

    function getCallTypes(uint loc) internal view returns (uint) {
        return uint(vm_r.calltypes[loc]);
    }

    function getMemory(uint loc) internal view returns (uint) {
        return uint(vm_r.mem[loc]);
    }

    function setMemory(uint loc, uint v) internal  {
        vm_r.mem[loc] = bytes32(v);
    }

    function setStack(uint loc, uint v) internal {
        vm_r.stack[loc] = bytes32(v);
    }

    function getGlobal(uint loc) internal view returns (uint) {
        return uint(vm_r.globals[loc]);
    }

    function setGlobal(uint loc, uint v) internal {
        vm_r.globals[loc] = bytes32(v);
    }

    function setCallTable(uint loc, uint v) internal {
        vm_r.calltable[loc] = bytes32(v);
    }

    function setCallType(uint loc, uint v) internal {
        vm_r.calltypes[loc] = bytes32(v);
    }

    function getInputSize(uint loc) internal view returns (uint) {
        return uint(vm_r.input_size[loc]);
    }
    
    function getInputName(uint loc, uint loc2) internal view returns (uint) {
        return uint(vm_r.input_name[loc][loc2]);
    }
    
    function getInputData(uint loc, uint loc2) internal view returns (uint) {
        return uint(vm_r.input_data[loc][loc2]);
    }
    
    function createInputData(uint loc, uint sz) internal {
        vm_r.input_data[loc].length = sz;
    }
    
    function setInputSize(uint loc, uint v) internal {
        vm_r.input_size[loc] = bytes32(v);
    }
    
    function setInputName(uint loc, uint loc2, uint v) internal {
        vm_r.input_name[loc][loc2] = bytes32(v);
    }
    function setInputData(uint loc, uint loc2, uint v) internal {
        vm_r.input_data[loc][loc2] = bytes32(v);
    }
    
    function getPC() internal view returns (uint) {
        return vm.pc;
    }
    
    function getMemsize() internal view returns (uint) {
        return vm.memsize;
    }
    
    function setMemsize(uint v) internal {
        vm.memsize = v;
    }
    
    function getStackPtr() internal view returns (uint) {
        return vm.stack_ptr;
    }
    
    function getCallPtr() internal view returns (uint) {
        return vm.call_ptr;
    }
    
    function getIreg() internal view returns (uint) {
        return m.ireg;
    }
    
    function setIreg(uint v) internal  {
        m.ireg = v;
    }
    
    function setReg1(uint v) internal  {
        m.reg1 = v;
    }
    
    function setReg2(uint v) internal  {
        m.reg2 = v;
    }
    
    function setReg3(uint v) internal  {
        m.reg3 = v;
    }
    
    function getReg1() internal view returns (uint) {
        return m.reg1;
    }
    
    function getReg2() internal view returns (uint) {
        return m.reg2;
    }
    
    function getReg3() internal view returns (uint) {
        return m.reg3;
    }

    function setPC(uint v) internal {
        vm.pc = v;
    }

    function setStackPtr(uint v) internal {
        vm.stack_ptr = v;
    }

    function setCallPtr(uint v) internal {
        vm.call_ptr = v;
    }

    function getOp() internal view returns (bytes32) {
        return m.op;
    }
    
    function setOp(bytes32 op) internal {
        m.op = op;
    }
    


}
