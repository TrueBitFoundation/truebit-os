pragma solidity ^0.4.15;

import "./VMMemory.sol";

/**
* @title the ALU for the solidity interpreter.
* @author Sami Mäkelä
*/
contract ALU is VMMemory {
    /**
    * @dev handles the ALU operations of the WASM machine i.e. the WASM instructions are implemented and run here
    *
    * @param hint the actual opcode
    * @param r1 register one
    * @param r2 register two
    * @param r3 register three
    * @param ireg the register holding the immediate value
    *
    * @return returns the result of the operation
    */
    function handleALU(uint hint, uint r1, uint r2, uint r3, uint ireg) internal pure returns (uint, bool) {
        uint res = r1;
        if (hint == 0) return (r1, false);
        else if (hint == 1 || hint == 6) {
           return (0, true);
           // revert(); // Trap
        }
        // Loading from memory
        else if (hint & 0xc0 == 0xc0) {
            uint8[] memory arr = toMemory(r2, r3);
            res = loadX(arr, (r1+ireg)%8, hint);
        }
        else if (hint == 2) {
            if (r1 < r2) res = r1;
            else res = r2;
        }
        // Calculate conditional jump
        else if (hint == 3) {
            if (r2 != 0) res = r1;
            else res = r3;
        }
        // Calculate jump to jump table
        else if (hint == 4) {
            res = r2 + (r1 >= ireg ? ireg : r1);
        }
        // Check dynamic call
        else if (hint == 7) {
            if (ireg != r2) revert();
            res = 0;
        }
        else if (hint == 0x45 || hint == 0x50) {
            if (r1 == 0) res = 1;
            else res = 0;
        }
        else if (hint == 0x46 || hint == 0x51) {
            if (r1 == r2) res = 1;
            else res = 0;
        }
        else if (hint == 0x47 || hint == 0x52) {
            if (r1 != r2) res = 1;
            else res = 0;
        }
        else if (hint == 0x48) {
            if (int32(r1) < int32(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x49) {
            if (uint32(r1) < uint32(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x4a) {
            if (int32(r1) > int32(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x4b) {
            if (uint32(r1) > uint32(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x4c) {
            if (int32(r1) <= int32(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x4d) {
            if (uint32(r1) <= uint32(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x4e) {
            if (int32(r1) >= int32(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x4f) {
            if (uint32(r1) >= uint32(r2)) res = 1;
            else res = 0;
        }

        else if (hint == 0x53) {
            if (int64(r1) < int64(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x54) {
            if (uint64(r1) < uint64(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x55) {
            if (int64(r1) > int64(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x56) {
            if (uint64(r1) > uint64(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x57) {
            if (int64(r1) <= int64(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x58) {
            if (uint64(r1) <= uint64(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x59) {
            if (int64(r1) >= int64(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x5a) {
            if (uint64(r1) >= uint64(r2)) res = 1;
            else res = 0;
        }
        else if (hint == 0x67) {
            res = clz32(uint32(r1));
        }
        else if (hint == 0x68) {
            res = ctz32(uint32(r1));
        }
        else if (hint == 0x69) {
            res = popcnt32(uint32(r1));
        }
        else if (hint == 0x79) {
            res = clz64(uint64(r1));
        }
        else if (hint == 0x7a) {
            res = ctz64(uint64(r1));
        }
        else if (hint == 0x7b) {
            res = popcnt64(uint64(r1));
        }
        else if (hint == 0x6a || hint == 0x7c) {
            res = r1+r2;
        }
        else if (hint == 0x6b || hint == 0x7d) {
            res = r1-r2;
        }
        else if (hint == 0x6c || hint == 0x7e) {
            res = r1*r2;
        }
        else if (hint == 0x6d) {
            res = uint(int32(r1)/int32(r2));
        }
        else if (hint == 0x7f) {
            res = uint(int64(r1)/int64(r2));
        }
        else if (hint == 0x6e || hint == 0x80) {
            res = r1/r2;
        }
        else if (hint == 0x6f) {
            res = uint(int32(r1)%int32(r2));
        }
        else if (hint == 0x81) {
            res = uint(int64(r1)%int64(r2));
        }
        else if (hint == 0x70 || hint == 0x82) {
            res = r1%r2;
        }
        else if (hint == 0x71 || hint == 0x83) {
            res = r1&r2;
        }
        else if (hint == 0x72 || hint == 0x84) {
            res = r1|r2;
        }
        else if (hint == 0x73 || hint == 0x85) {
            res = r1^r2;
        }
        else if (hint == 0x74 || hint == 0x86) {
            res = r1*2**r2; // shift 
        }
        else if (hint == 0x75 || hint == 0x87) {
            res = r1/2**r2;
        }
        else if (hint == 0x76 || hint == 0x88) {
            res = r1/2**r2;
        }
        // rol, ror -- fix
        else if (hint == 0x77) {
            res = (r1*2**r2) | (r1/2**32);
        }
        else if (hint == 0x78) {
            res = (r1/2**r2) | (r1*2**32);
        }
        else if (hint == 0x89) {
            res = (r1*2**r2) | (r1/2**64);
        }
        else if (hint == 0x8a) {
            res = (r1/2**r2) | (r1*2**64);
        }
        
        if (hint >= 0x62 && hint <= 0x78) {
            res = res % (2**32);
        }
        else if (hint >= 0x7c && hint <= 0x8a) {
            res = res % (2**64);
        }
        
        return (res, false);
    }
    
  /**
  * @dev counts the number of set bits for a 32 bit value
  *
  * @param r1 the input value
  *
  * @return number of sit bits in r1
  */
  function popcnt32(uint32 r1) internal pure returns (uint8) {
    uint32 temp = r1;
    temp = (temp & 0x55555555) + ((temp >> 1) & 0x55555555);
    temp = (temp & 0x33333333) + ((temp >> 2) & 0x33333333);
    temp = (temp & 0x0f0f0f0f) + ((temp >> 4) & 0x0f0f0f0f);
    temp = (temp & 0x00ff00ff) + ((temp >> 8) & 0x00ff00ff);
    temp = (temp & 0x0000ffff) + ((temp >> 16) & 0x0000ffff);
    return uint8(temp);
  }

  /**
  * @dev counts the number of set bits for a 64 bit value
  *
  * @param r1 the input value
  *
  * @return returns the number of set bits for r1
  */
  function popcnt64(uint64 r1) internal pure returns (uint8) {
    uint64 temp = r1;
    temp = (temp & 0x5555555555555555) + ((temp >> 1) & 0x5555555555555555);
    temp = (temp & 0x3333333333333333) + ((temp >> 2) & 0x3333333333333333);
    temp = (temp & 0x0f0f0f0f0f0f0f0f) + ((temp >> 4) & 0x0f0f0f0f0f0f0f0f);
    temp = (temp & 0x00ff00ff00ff00ff) + ((temp >> 8) & 0x00ff00ff00ff00ff);
    temp = (temp & 0x0000ffff0000ffff) + ((temp >> 16) & 0x0000ffff0000ffff);
    temp = (temp & 0x00000000ffffffff) + ((temp >> 32) & 0x00000000ffffffff);
    return uint8(temp);
  }

  /**
  * @dev counts the number of leading zeroes for a 32-bit value using binary search
  *
  * @param r1 the input
  *
  * @return returns the number of leading zeroes for r1
  */
  function clz32(uint32 r1) internal pure returns (uint8) {
    if (r1 == 0) return 32;
    uint32 temp_r1 = r1;
    uint8 n = 0;
    if (temp_r1 & 0xffff0000 == 0) {
      n += 16;
      temp_r1 = temp_r1 << 16;
    }
    if (temp_r1 & 0xff000000 == 0) {
      n += 8;
      temp_r1 = temp_r1 << 8;
    }
    if (temp_r1 & 0xf0000000 == 0) {
      n += 4;
      temp_r1 = temp_r1 << 4;
    }
    if (temp_r1 & 0xc0000000 == 0) {
      n += 2;
      temp_r1 = temp_r1 << 2;
    }
    if (temp_r1 & 0x8000000 == 0) {
      n++;
    }
    return n;
  }

  /**
  * @dev counts the number of leading zeroes for a 64-bit value using binary search
  *
  * @param r1 the input value
  *
  * @return returns the number of leading zeroes for the input vlaue
  */
  function clz64(uint64 r1) internal pure returns (uint8) {
    if (r1 == 0) return 64;
    uint64 temp_r1 = r1;
    uint8 n = 0;
    if (temp_r1 & 0xffffffff00000000 == 0) {
      n += 32;
      temp_r1 = temp_r1 << 32;
    }
    if (temp_r1 & 0xffff000000000000 == 0) {
      n += 16;
      temp_r1 == temp_r1 << 16;
    }
    if (temp_r1 & 0xff00000000000000 == 0) {
      n+= 8;
      temp_r1 = temp_r1 << 8;
    }
    if (temp_r1 & 0xf000000000000000 == 0) {
      n += 4;
      temp_r1 = temp_r1 << 4;
    }
    if (temp_r1 & 0xc000000000000000 == 0) {
      n += 2;
      temp_r1 = temp_r1 << 2;
    }
    if (temp_r1 & 0x8000000000000000 == 0) {
      n += 1;
    }
    return n;
  }

  /**
  * @dev counts the number of trailing zeroes for a 32-bit value using binary search
  *
  * @param r1 the input value
  *
  * @return returns the number of trailing zeroes for the input value
  */
  function ctz32(uint32 r1) internal pure returns (uint8) {
    if (r1 == 0) return 32;
    uint32 temp_r1 = r1;
    uint8 n = 0;
    if (temp_r1 & 0x0000ffff == 0) {
      n += 16;
      temp_r1 = temp_r1 >> 16;
    }
    if (temp_r1 & 0x000000ff == 0) {
      n += 8;
      temp_r1 = temp_r1 >> 8;
    }
    if (temp_r1 & 0x0000000f == 0) {
      n += 4;
      temp_r1 = temp_r1 >> 4;
    }
    if (temp_r1 & 0x00000003 == 0) {
      n += 2;
      temp_r1 = temp_r1 >> 2;
    }
    if (temp_r1 & 0x00000001 == 0) {
      n += 1;
    }
    return n;
  }

  /**
  * @dev returns the number of trailing zeroes for a 64-bit input value using binary search
  *
  * @param r1 the input value
  *
  * @return returns the trailing zeroes count for the input value
  */
  function ctz64(uint64 r1) internal pure returns (uint8) {
    if (r1 == 0) return 64;
    uint64 temp_r1 = r1;
    uint8 n = 0;
    if (temp_r1 & 0x00000000ffffffff == 0) {
      n += 32;
      temp_r1 = temp_r1 >> 32;
    }
    if (temp_r1 & 0x000000000000ffff == 0) {
      n += 16;
      temp_r1 = temp_r1 >> 16;
    }
    if (temp_r1 & 0x00000000000000ff == 0) {
      n += 8;
      temp_r1 = temp_r1 >> 8;
    }
    if (temp_r1 & 0x000000000000000f == 0) {
      n += 4;
      temp_r1 = temp_r1 >> 4;
    }
    if (temp_r1 & 0x0000000000000003 == 0) {
      n += 2;
      temp_r1 = temp_r1 >> 2;
    }
    if (temp_r1 & 0x0000000000000001 == 0) {
      n += 1;
    }
    return n;
  }
}
