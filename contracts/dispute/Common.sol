pragma solidity ^0.4.15;

import "./Offchain.sol";
import "./Onchain.sol";
import "./Alu.sol";

/**
* @title VM Interpreter
* @author Sami Mäkelä
*/
contract REPLACEME, ALU {
    /**
    * @dev get a pointer for the place we want to perform a read from, based on the opcode
    *
    * @param hint the opcode
    *
    * @return returns a pointer to where to read from
    */
    function readPosition(uint hint) internal view returns (uint) {
        assert(hint > 4);
        if (hint == 5) return getReg1();
        else if (hint == 6) return getStackPtr()-1;
        else if (hint == 7) return getStackPtr()-2;
        else if (hint == 8) return getStackPtr()-getReg1(); // Stack in reg
        else if (hint == 9) return getStackPtr()-getReg2();
        else if (hint == 14) return getCallPtr()-1;
        else if (hint == 15) return (getReg1()+getIreg())/8;
        else if (hint == 16) return getReg1();
        else if (hint == 17) return (getReg1()+getIreg())/8 + 1;
        else if (hint == 18) return getReg1();
        else if (hint == 19) return getReg1();
        else if (hint == 0x16) return getStackPtr()-3;
        else assert(false);
    }
    
    uint constant FINAL_STATE = 0xffffffffff;

    /**
    * @dev perform a read based on the opcode
    *
    * @param hint the opcode
    *
    * @return return the read value
    */
    function readFrom(uint hint) internal returns (uint res, bool fin4l) {
        if (hint == 0) res = 0;
        else if (hint == 1) res = getIreg();
        else if (hint == 2) res = getPC()+1;
        else if (hint == 3) res = getStackPtr();
        else if (hint == 4) res = getMemsize();
        // Add special cases for input data, input name
        else if (hint == 0x14) {
            if (getReg2() >= 1024) fin4l = true;
            else if (!checkInputNameAccess(getReg2(), getReg1())) {
                fin4l = true;
                getInputName(getReg2(), 0);
            }
            else res = getInputName(getReg2(), getReg1());
        }
        else if (hint == 0x15) {
            if (getReg2() >= 1024) fin4l = true;
            else if (!checkInputDataAccess(getReg2(), getReg1())) {
                fin4l = true;
                getInputData(getReg2(), 0);
            }
            else res = getInputData(getReg2(), getReg1());
        }
        else {
          uint loc = readPosition(hint);
        
          if (!checkReadAccess(loc, hint)) {
                setPC(FINAL_STATE);
                res = 0;
                fin4l = true;
                if (hint == 5) res = getGlobal(0);
                else if (hint == 6) res = getStack(0);
                else if (hint == 7) res = getStack(0);
                else if (hint == 8) res = getStack(0);
                else if (hint == 9) res = getStack(0);
                else if (hint == 14) res = getCallStack(0);
                else if (hint == 15) res = getMemory(0);
                else if (hint == 16) res = getCallTable(0);
                else if (hint == 17) res = getMemory(0);
                else if (hint == 18) res = getCallTypes(0);
                else if (hint == 19) res = getInputSize(0);
                else if (hint == 0x16) res = getStack(0);
          }
          else if (hint == 5) res = getGlobal(loc);
          else if (hint == 6) res = getStack(loc);
          else if (hint == 7) res = getStack(loc);
          else if (hint == 8) res = getStack(loc);
          else if (hint == 9) res = getStack(loc);
          else if (hint == 14) res = getCallStack(loc);
          else if (hint == 15) res = getMemory(loc);
          else if (hint == 16) res = getCallTable(loc);
          else if (hint == 17) res = getMemory(loc);
          else if (hint == 18) res = getCallTypes(loc);
          else if (hint == 19) res = getInputSize(loc);
          else if (hint == 0x16) res = getStack(loc);
          else assert(false);
        }
    }

    /**
    * @dev make changes to a memory location
    *
    * @param loc where should be changed inside memory
    * @param v the value to change the memory position to
    * @param hint denoted v's type and packing value
    *
    * @return none
    */
    function makeMemChange1(uint loc, uint v, uint hint) internal  {
        uint old = getMemory(loc);
        uint8[] memory mem = toMemory(old, 0);
        storeX(mem, (getReg1()+getIreg())%8, v, hint);
        uint res; uint extra;
        (res, extra) = fromMemory(mem);
        setMemory(loc, res);
    }
    
    /**
    * @dev make changes to a memory location
    *
    * @param loc where should the write be performed
    * @param v the value to be written to memory
    * @param hint denotes v's type and packing value
    *
    * @return none
    */
    function makeMemChange2(uint loc, uint v, uint hint) internal {
        uint old = getMemory(loc);
        uint8[] memory mem = toMemory(0, old);
        storeX(mem, (getReg1()+getIreg())%8, v, hint);
        uint res; uint extra;
        (extra, res) = fromMemory(mem);
        setMemory(loc, res);
        
    }

    /**
    * @dev get a pointer to where we want to write to based on the opcode
    *
    * @param hint the opcode
    *
    * @return returns a pointer to where to write to
    */
    function writePosition(uint hint) internal view returns (uint) {
        assert(hint > 0);
        if (hint == 2) return getStackPtr()-getReg1();
        else if (hint == 3) return getStackPtr();
        else if (hint == 4) return getStackPtr()-1;
        else if (hint == 5) return getReg1()+getReg2();
        else if (hint == 6) return getCallPtr();
        else if (hint == 8) return getReg1();
        else if (hint == 9) return getStackPtr()-2;
        else if (hint == 0x0a) return getReg1();
        else if (hint == 0x0c) return getReg1();
        else if (hint == 0x0e) return getIreg();
        else if (hint == 0x0f) return getIreg();
        else if (hint & 0xc0 == 0x80) return (getReg1()+getIreg())/8;
        else if (hint & 0xc0 == 0xc0) return (getReg1()+getIreg())/8 + 1;
        else assert(false);
    }
    
    /**
    * @dev perform a write
    *
    * @param hint the opcode
    * @param v the value to be written
    *
    * @return none
    */
    function writeStuff(uint hint, uint v) internal {
        if (hint == 0) return;
        // Special cases for creation, other output
        uint r1;
        if (hint == 0x0b) {
            r1 = getReg1();
            if (r1 >= 1024) setPC(FINAL_STATE);
            else if (!checkInputNameAccess(r1, getReg2())) {
                setPC(FINAL_STATE);
                getInputName(r1, 0);
            }
            else setInputName(r1, getReg2(), v);
        }
        else if (hint == 0x0c) {
            r1 = getReg1();
            if (r1 >= 1024) setPC(FINAL_STATE);
            else createInputData(r1, v);
        }
        else if (hint == 0x0d) {
            r1 = getReg1();
            if (r1 >= 1024) setPC(FINAL_STATE);
            else if (!checkInputDataAccess(r1, getReg2())) {
                setPC(FINAL_STATE);
                getInputData(r1, 0);
            }
            else setInputData(r1, getReg2(), v);
        }
        else if (hint == 0x10) setStackSize(v);
        else if (hint == 0x11) setCallStackSize(v);
        else if (hint == 0x12) setGlobalsSize(v);
        else if (hint == 0x13) setTableSize(v);
        else if (hint == 0x14) setTableTypesSize(v);
        else if (hint == 0x15) setMemorySize(v);
        else {
          uint loc = writePosition(hint);
          if (!checkWriteAccess(loc, hint)) {
              setPC(FINAL_STATE);
              if (hint & 0xc0 == 0x80) getMemory(0);
              else if (hint & 0xc0 == 0xc0) getMemory(0);
              else if (hint == 2) getStack(0);
              else if (hint == 3) getStack(0);
              else if (hint == 4) getStack(0);
              else if (hint == 6) getCallStack(0);
              else if (hint == 8) getGlobal(0);
              else if (hint == 9) getStack(0);
              else if (hint == 0x0a) getInputSize(0);
              else if (hint == 0x0e) getCallTable(0);
              else if (hint == 0x0f) getCallTypes(0);
          }
          else if (hint & 0xc0 == 0x80) makeMemChange1(loc, v, hint);
          else if (hint & 0xc0 == 0xc0) makeMemChange2(loc, v, hint);
          else if (hint == 2) setStack(loc, v);
          else if (hint == 3) setStack(loc, v);
          else if (hint == 4) setStack(loc, v);
          else if (hint == 6) setCallStack(loc, v);
          else if (hint == 8) setGlobal(loc, v);
          else if (hint == 9) setStack(loc, v);
          else if (hint == 0x0a) setInputSize(loc, v);
          else if (hint == 0x0e) setCallTable(loc, v);
          else if (hint == 0x0f) setCallType(loc, v);
          else assert(false);
        }
    }
    
    /**
    * @dev makes the necessary changes to a pointer based on the addressing mode provided by hint
    *
    * @param hint provides a hint as to what changes to make to the input pointer
    * @param ptr the pointer that's going to be handled
    *
    * @return returns the pointer after processing
    */
    function handlePointer(uint hint, uint ptr) internal view returns (uint) {
        if (hint == 0) return ptr - getReg1();
        else if (hint == 1) return getReg1();
        else if (hint == 2) return getReg2();
        else if (hint == 3) return getReg3();
        else if (hint == 4) return ptr+1;
        else if (hint == 5) return ptr-1;
        else if (hint == 6) return ptr;
        else if (hint == 7) return ptr-2;
        else if (hint == 8) return ptr-1-getIreg();
        else assert(false);
    }
    
    /**
    * @dev get the immediate value of an instruction
    */
    function getImmed(bytes32 op) internal pure returns (uint256) {
        // it is the first 8 bytes
        return uint(op)/(2**(13*8));
    }

    /**
    * @dev "fetch" an instruction
    */
    function performFetch() internal {
        setOp(getCode(getPC()));
    }

    /**
    * @dev initialize the Truebit register machine's registers
    */
    function performInit() internal  {
        setReg1(0);
        setReg2(0);
        setReg3(0);
        setIreg(getImmed(getOp()));
    }
    
    /**
    * @dev get the opcode
    *
    * @param n which opcode byte to read
    *
    * @return returns the opcode
    */
    function getHint(uint n) internal view returns (uint) {
        return (uint(getOp())/2**(8*n))&0xff;
    }
    
    /**
    * @dev read the first byte of the opcode and then read the value based on the hint into REG1
    */
    function performRead1() internal {
        uint res;
        bool fin4l;
        (res, fin4l) = readFrom(getHint(0));
        if (!fin4l) setReg1(res);
    }

    /**
    * @dev read the second byte of the opcode and then read the value based on the hint into REG2
    */
    function performRead2() internal {
        uint res;
        bool fin4l;
        (res, fin4l) = readFrom(getHint(1));
        if (!fin4l) setReg2(res);
    }

    /**
    * @dev read the third byte of the opcode and then read the value based on the hint into REG3
    */
    function performRead3() internal {
        uint res;
        bool fin4l;
        (res, fin4l) = readFrom(getHint(2));
        if (!fin4l) setReg3(res);
    }
    
    /**
    * @dev execute the opcode, put the result back in REG1
    */
    function performALU() internal {
        uint res;
        bool fin4l;
        (res, fin4l) = handleALU(getHint(3), getReg1(), getReg2(), getReg3(), getIreg());
        if (fin4l) setPC(FINAL_STATE);
        else setReg1(res);
    }
    
    /**
    * @dev write a value stored in REG to a location using the 4th and 5th hint bytes
    */
    function performWrite1() internal {
        uint target = getHint(4);
        uint hint = getHint(5);
        uint v;
        if (target == 1) v = getReg1();
        if (target == 2) v = getReg2();
        if (target == 3) v = getReg3();
        writeStuff(hint, v);
    }

    /**
    * @dev write a value stored in REG to a location using the 6th and 7th hint bytes
    */
    function performWrite2() internal {
        uint target = getHint(6);
        uint hint = getHint(7);
        uint v;
        if (target == 1) v = getReg1();
        if (target == 2) v = getReg2();
        if (target == 3) v = getReg3();
        writeStuff(hint, v);
    }
    
    function performUpdatePC() internal {
        setPC(handlePointer(getHint(11), getPC()));
    }
    function performUpdateStackPtr() internal {
        setStackPtr(handlePointer(getHint(9), getStackPtr()));
    }
    function performUpdateCallPtr() internal {
        setCallPtr(handlePointer(getHint(8), getCallPtr()));
    }
    function performUpdateMemsize() internal {
        if (getHint(12) == 1) setMemsize(getMemsize()+getReg1());
    }
    
    uint phase;
    
    
    function performPhase() internal {
        if (getPC() == FINAL_STATE) {}
        else if (phase == 0) performFetch();
        else if (phase == 1) performInit();
        else if (phase == 2) performRead1();
        else if (phase == 3) performRead2();
        else if (phase == 4) performRead3();
        else if (phase == 5) performALU();
        else if (phase == 6) performWrite1();
        else if (phase == 7) performWrite2();
        else if (phase == 8) performUpdatePC();
        else if (phase == 9) performUpdateStackPtr();
        else if (phase == 10) performUpdateCallPtr();
        else if (phase == 11) performUpdateMemsize();
        phase = (phase+1) % 12;
    }
    
}

