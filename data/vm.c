
#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>
#include <assert.h>

uint8_t popcnt32(uint32_t r1)  {
    uint32_t temp = r1;
    temp = (temp & 0x55555555) + ((temp >> 1) & 0x55555555);
    temp = (temp & 0x33333333) + ((temp >> 2) & 0x33333333);
    temp = (temp & 0x0f0f0f0f) + ((temp >> 4) & 0x0f0f0f0f);
    temp = (temp & 0x00ff00ff) + ((temp >> 8) & 0x00ff00ff);
    temp = (temp & 0x0000ffff) + ((temp >> 16) & 0x0000ffff);
    return temp;
}

uint8_t popcnt64(uint64_t r1)  {
    uint64_t temp = r1;
    temp = (temp & 0x5555555555555555) + ((temp >> 1) & 0x5555555555555555);
    temp = (temp & 0x3333333333333333) + ((temp >> 2) & 0x3333333333333333);
    temp = (temp & 0x0f0f0f0f0f0f0f0f) + ((temp >> 4) & 0x0f0f0f0f0f0f0f0f);
    temp = (temp & 0x00ff00ff00ff00ff) + ((temp >> 8) & 0x00ff00ff00ff00ff);
    temp = (temp & 0x0000ffff0000ffff) + ((temp >> 16) & 0x0000ffff0000ffff);
    temp = (temp & 0x00000000ffffffff) + ((temp >> 32) & 0x00000000ffffffff);
    return temp;
}

uint8_t clz32(uint32_t r1) {
    if (r1 == 0) return 32;
    uint32_t temp_r1 = r1;
    uint8_t n = 0;
    if ((temp_r1 & 0xffff0000) == 0) {
      n += 16;
      temp_r1 = temp_r1 << 16;
    }
    if ((temp_r1 & 0xff000000) == 0) {
      n += 8;
      temp_r1 = temp_r1 << 8;
    }
    if ((temp_r1 & 0xf0000000) == 0) {
      n += 4;
      temp_r1 = temp_r1 << 4;
    }
    if ((temp_r1 & 0xc0000000) == 0) {
      n += 2;
      temp_r1 = temp_r1 << 2;
    }
    if ((temp_r1 & 0x8000000) == 0) {
      n++;
    }
    return n;
}

uint8_t clz64(uint64_t r1) {
    if (r1 == 0) return 64;
    uint64_t temp_r1 = r1;
    uint8_t n = 0;
    if ((temp_r1 & 0xffffffff00000000) == 0) {
      n += 32;
      temp_r1 = temp_r1 << 32;
    }
    if ((temp_r1 & 0xffff000000000000) == 0) {
      n += 16;
      temp_r1 == temp_r1 << 16;
    }
    if ((temp_r1 & 0xff00000000000000) == 0) {
      n+= 8;
      temp_r1 = temp_r1 << 8;
    }
    if ((temp_r1 & 0xf000000000000000) == 0) {
      n += 4;
      temp_r1 = temp_r1 << 4;
    }
    if ((temp_r1 & 0xc000000000000000) == 0) {
      n += 2;
      temp_r1 = temp_r1 << 2;
    }
    if ((temp_r1 & 0x8000000000000000) == 0) {
      n += 1;
    }
    return n;
}

uint8_t ctz32(uint32_t r1) {
    if (r1 == 0) return 32;
    uint32_t temp_r1 = r1;
    uint8_t n = 0;
    if ((temp_r1 & 0x0000ffff) == 0) {
      n += 16;
      temp_r1 = temp_r1 >> 16;
    }
    if ((temp_r1 & 0x000000ff) == 0) {
      n += 8;
      temp_r1 = temp_r1 >> 8;
    }
    if ((temp_r1 & 0x0000000f) == 0) {
      n += 4;
      temp_r1 = temp_r1 >> 4;
    }
    if ((temp_r1 & 0x00000003) == 0) {
      n += 2;
      temp_r1 = temp_r1 >> 2;
    }
    if ((temp_r1 & 0x00000001) == 0) {
      n += 1;
    }
    return n;
}

uint8_t ctz64(uint64_t r1) {
    if (r1 == 0) return 64;
    uint64_t temp_r1 = r1;
    uint8_t n = 0;
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

int error_code = 0;

uint8_t tmp_mem[16];

void storeN(uint8_t *mem, uint64_t addr, uint64_t n, uint64_t v) {
    for (int i = 0; i < n; i++) {
            mem[addr+i] = v;
            v = v >> 8;
    }
}

// a and b are integer values that represent 8 bytes each
uint8_t *toMemory(uint64_t a, uint64_t b) {
        storeN(tmp_mem, 0, 8, a);
        storeN(tmp_mem, 8, 8, b);
        return tmp_mem;
}

uint64_t loadN(uint8_t *mem, uint64_t addr, uint64_t n) {
        uint64_t res = 0;
        uint64_t exp = 1;
        for (int i = 0; i < n; i++) {
            // printf("Byte %02x\n", mem[addr+i]);
            res += mem[addr+i]*exp;
            exp = exp << 8;
        }
        return res;
}

uint64_t fromMemory1(uint8_t *mem) {
        return loadN(mem, 0, 8);
}

uint64_t fromMemory2(uint8_t *mem) {
        return loadN(mem, 8, 8);
}

uint64_t typeSize(uint64_t ty) {
        if (ty == 0) return 4; // I32
        else if (ty == 1) return 8; // I64
        else if (ty == 2) return 4; // F32
        else if (ty == 3) return 8; // F64
}

void store(uint8_t *mem, uint64_t addr, uint64_t v, uint64_t ty, uint64_t packing) {
        if (packing == 0) storeN(mem, addr, typeSize(ty), v);
        else {
            // Only integers can be packed, also cannot pack I32 to 32-bit?
            assert(ty < 2 && !(ty == 0 && packing == 4));
            storeN(mem, addr, packing, v);
        }
}

void storeX(uint8_t *mem, uint64_t addr, uint64_t v, uint64_t hint) {
        store(mem, addr, v, (hint >> 3)&0x3, hint&0x7);
}

uint64_t load(uint8_t *mem, uint64_t addr, uint64_t ty, uint64_t packing, uint8_t sign_extend) {
        if (packing == 0) return loadN(mem, addr, typeSize(ty));
        else {
            assert(ty < 2 && !(ty == 0 && packing == 4));
            uint64_t res = loadN(mem, addr, packing);
            if (sign_extend) {
                res = res | (0xffffffffffffffff << (8*packing))*(res >> (8*packing-1));
            }
            if (ty == 0) res = res & 0xffffffff;
            else res = res & 0xffffffffffffffff;
            return res;
        }
}
    
uint64_t loadX(uint8_t *mem, uint64_t addr, uint64_t hint) {
        return load(mem, addr, (hint >> 4)&0x3, (hint >> 1)&0x7, (hint&0x1) == 1);
}

struct vm_t {
  uint64_t reg1;
  uint64_t reg2;
  uint64_t reg3;
  uint64_t ireg;
  
  uint8_t *op;
  
  uint64_t stack_ptr;
  uint64_t call_ptr;
  uint64_t pc;
  uint64_t memsize;
  
  uint64_t *globals;
  uint64_t *stack;
  uint64_t *callstack;
  uint64_t *memory;
  uint64_t *calltable;
  uint64_t *calltypes;
  
  uint64_t *inputsize;
  uint8_t **inputname;
  uint8_t **inputdata;

  uint8_t *code;
};



int debug = 0;

uint64_t handleALU(uint8_t hint, uint64_t r1, uint64_t r2, uint64_t r3, uint64_t ireg) {
        uint64_t res = r1;
        if (hint == 0) return r1;
        switch (hint) {
          case 1:
          case 6:
           assert(0);
          case 2:
            if (r1 < r2) return r1;
            else return r2;
        // Calculate conditional jump
          case 3:
            if (r2 != 0) return r1;
            else return r3;
        // Calculate jump to jump table
          case 4:
            return r2 + (r1 >= ireg ? ireg : r1);
        // Check dynamic call
          case 7:
            if (ireg != r2) assert(0);
            return 0;
          // Handle 32 bit and 64 bit differently
          case 0x45:
          case 0x50:
            return (r1 == 0) ? 1 : 0;
          case 0x46:
          case 0x51:
            return (r1 == r2) ? 1 : 0;
          case 0x47:
          case 0x52:
            return (r1 != r2) ? 1 : 0;
          case  0x48: return ((int32_t)r1 < (int32_t)r2) ? 1 : 0;
          case 0x49:
            return ((uint32_t)r1 < (uint32_t)r2) ? 1 : 0;
          case 0x4a:
            return ((int32_t)r1 > (int32_t)r2) ? 1 : 0;
          case 0x4b:
            return ((uint32_t)r1 > (uint32_t)r2) ? 1 : 0;
          case 0x4c:
            return ((int32_t)r1 <= (int32_t)r2) ? 1 : 0;
          case 0x4d:
            return ((uint32_t)r1 <= (uint32_t)r2) ? 1 : 0;
          case 0x4e:
            return ((int32_t)r1 >= (int32_t)r2) ? 1 : 0;
          case 0x4f:
            return ((uint32_t)r1 >= (uint32_t)r2) ? 1 : 0;
          case 0x53:
            return ((int64_t)r1 < (int64_t)r2) ? 1 : 0;
          case 0x54:
            return ((uint64_t)r1 < (uint64_t)r2) ? 1 : 0;
          case 0x55:
            return ((int64_t)r1 > (int64_t)r2) ? 1 : 0;
          case 0x56:
            return ((uint64_t)r1 > (uint64_t)r2) ? 1 : 0;
          case 0x57:
            return ((int64_t)r1 <= (int64_t)r2) ? 1 : 0;
          case 0x58:
            return ((uint64_t)r1 <= (uint64_t)r2) ? 1 : 0;
          case 0x59:
            return ((int64_t)r1 >= (int64_t)r2) ? 1 : 0;
          case 0x5a:
            return ((uint64_t)r1 >= (uint64_t)r2) ? 1 : 0;
          case 0x67: return clz32((uint32_t)r1);
          case 0x68: return ctz32((uint32_t)r1);
          case 0x69: return popcnt32((uint32_t)r1);
          case 0x79: return clz64((uint64_t)r1);
          case 0x7a: return ctz64((uint64_t)r1);
          case 0x7b: return popcnt64((uint64_t)r1);
          case 0x6a: return (uint32_t)r1+(uint32_t)r2;
          case 0x7c: return r1+r2;
          case 0x6b: return (uint32_t)r1-(uint32_t)r2;
          case 0x7d: return r1-r2;
          case 0x6c: return (uint32_t)r1*(uint32_t)r2;
          case 0x7e: return r1*r2;
          case 0x6d: return (uint64_t)((int32_t)r1/(int32_t)r2);
          case 0x7f: return (uint64_t)((int64_t)r1/(int64_t)r2);
          case 0x6e: return (uint32_t)r1/(uint32_t)r2;
          case 0x80: return r1/r2;
          case 0x6f:
            return (uint64_t)((int32_t)r1%(int32_t)r2);
          case 0x81:
            return (uint64_t)((int64_t)r1%(int64_t)r2);
          case 0x70: return (uint32_t)r1%(uint32_t)r2;
          case 0x82: return r1%r2;
          case 0x71:
          case 0x83:
            return r1&r2;
          case 0x72:
          case 0x84:
            return r1|r2;
          case 0x73:
          case 0x85:
            return r1^r2;
          case 0x74: return (r1 << r2)&0xffffffff;
          case 0x86: return r1 << r2; // shift 
        case 0x75: return (r1 >> r2)&0xffffffff;
        case 0x87: return r1 >> r2;
        case 0x76: return (r1 >> r2)&0xffffffff;
        case 0x88: return r1 >> r2;
        // rol, ror -- fix
        case 0x77:
            return (r1<<r2) | (r1>>(32-r2));
        case 0x78:
            return (r1>>r2) | (r1<<(32-r2));
        case 0x89:
            return (r1<<r2) | (r1<<(64-r2));
        case 0x8a:
            return (r1>>r2) | (r1<<(64-r2));
        default:
          // Loading from memory
          if ((hint & 0xc0) == 0xc0) {
            uint8_t *arr = toMemory(r2, r3);
            return loadX(arr, (r1+ireg)&0x7, hint);
          }
          return res;
     }
     return res;
}

struct vm_t vm;

uint64_t readFrom(uint8_t hint) {
  // fprintf(stderr, "read hint %x\n", hint);
    if (!hint) return 0;
    switch (hint) {
      case 0: return 0;
      case 1: return vm.ireg;
      case 2: return vm.pc+1;
      case 3: return vm.stack_ptr;
      case 4: return vm.memsize;
      case 0x14: return vm.inputname[vm.reg2][vm.reg1];
      case 0x15: return vm.inputdata[vm.reg2][vm.reg1];
      case 5: return vm.globals[vm.reg1];
      case 6: return vm.stack[vm.stack_ptr-1];
      case 7: return vm.stack[vm.stack_ptr-2];
      case 8: return vm.stack[vm.stack_ptr-vm.reg1];
      case 9: return vm.stack[vm.stack_ptr-vm.reg2];
      case 14: return vm.callstack[vm.call_ptr-1];
      case 15: return vm.memory[(vm.reg1+vm.ireg) >> 3];
      case 16: return vm.calltable[vm.reg1];
      case 17: return vm.memory[((vm.reg1+vm.ireg) >> 3) + 1];
      case 18: return vm.calltypes[vm.reg1];
      case 19: return vm.inputsize[vm.reg1];
      case 0x16: return vm.stack[vm.stack_ptr-3];
      default:  assert(0);
   }
}

void makeMemChange1(uint64_t loc, uint64_t v, uint8_t hint) {
        // if (debug) fprintf(stderr, "Storing A: %ld to %ld\n", v, loc);
        uint64_t old = vm.memory[loc];
        uint8_t *mem = toMemory(old, 0);
        storeX(mem, (vm.reg1+vm.ireg)&0x7, v, hint);
        vm.memory[loc] = fromMemory1(mem);
}

void makeMemChange2(uint64_t loc, uint64_t v, uint8_t hint) {
        // if (debug) fprintf(stderr, "Storing B: %ld to %ld\n", v, loc);
        uint64_t old = vm.memory[loc];
        uint8_t *mem = toMemory(0, old);
        storeX(mem, (vm.reg1+vm.ireg)&0x7, v, hint);
        vm.memory[loc] = fromMemory2(mem);
}

void writeStuff(uint8_t hint, uint64_t v) {
   switch (hint) {
     case 0: return;
        // Special cases for creation, other output
     case 0x0b:
          // fprintf(stderr, "Output name\n");
          vm.inputname[vm.reg1][vm.reg2] = v;
          return;
     case 0x0c:
          // fprintf(stderr, "Output data size\n");
          vm.inputdata[vm.reg1] = (uint8_t*)malloc(v*sizeof(uint8_t));
          vm.inputsize[vm.reg1] = v;
          return;
     case 0x0d:
          // fprintf(stderr, "Output data\n");
          vm.inputdata[vm.reg1][vm.reg2] = v;
          return;
     case 2:
        vm.stack[vm.stack_ptr-vm.reg1] = v;
        return;
     case 3:
        vm.stack[vm.stack_ptr] = v;
        return;
     case 4:
        vm.stack[vm.stack_ptr-1] = v;
        return;
     case 6:
        vm.callstack[vm.call_ptr] = v;
        return;
     case 8:
        vm.globals[vm.reg1] = v;
        return;
     case 9:
        vm.stack[vm.stack_ptr-2] = v;
        return;
     case 0x0a: 
        vm.inputsize[vm.reg1] = v;
        return;
     case 0x0e: 
        vm.calltable[vm.ireg] = v;
        return;
     case 0x0f:
        vm.calltypes[vm.ireg] = v;
        return;
     default:
        // fprintf(stderr, "Loc: %ld, hint %x\n", loc, hint);
        if ((hint & 0xc0) == 0x80) makeMemChange1((vm.reg1+vm.ireg) >> 3, v, hint);
        else if ((hint & 0xc0) == 0xc0) makeMemChange2(((vm.reg1+vm.ireg) >> 3) + 1, v, hint);
        else assert(0);
   }
}
    
uint64_t handlePointer(uint8_t hint, uint64_t ptr) {
   switch (hint) {
     case 0: return ptr - vm.reg1;
     case 1: return vm.reg1;
     case 2: return vm.reg2;
     case 3: return vm.reg3;
     case 4: return ptr+1;
     case 5: return ptr-1;
     case 6: return ptr;
     case 7: return ptr-2;
     case 8: return ptr-1-vm.ireg;
     default: assert(0);
   }
}
    
uint64_t getImmed(uint8_t *op) {
   // if (!*((uint64_t *)(op+11))) return 0;
   uint64_t res = 0;
   for (int i = 0; i < 8; i++) {
     res = (res<<8) + op[11+i];
   }
   return res;
}

uint8_t getHint(uint8_t n) {
        return vm.op[31-n];
}
    
void performStep() {
    vm.op = &vm.code[vm.pc*32];

    if (getHint(3) == 0x06) return;

/*    vm.reg1 = 0;
    vm.reg2 = 0;
    vm.reg3 = 0; */
    vm.ireg = getImmed(vm.op);

    uint8_t target;
    uint8_t *hptr = vm.op+31;
    uint64_t v;

    vm.reg1 = readFrom(*hptr--);
    vm.reg2 = readFrom(*hptr--);
    vm.reg3 = readFrom(*hptr--);

    // hint = getHint(3);
    if (*hptr) vm.reg1 = handleALU(*hptr, vm.reg1, vm.reg2, vm.reg3, vm.ireg);
    hptr -= 2;

    if (*hptr) {
        target = hptr[1];
        if (target == 1) v = vm.reg1;
        else if (target == 2) v = vm.reg2;
        else if (target == 3) v = vm.reg3;
        else assert(0);
        writeStuff(*hptr, v);
    }
    hptr -= 2;
    
    // hint = getHint(7);
    if (*hptr) {
           target = hptr[1];
           if (target == 1) v = vm.reg1;
           else if (target == 2) v = vm.reg2;
           else if (target == 3) v = vm.reg3;
           else assert(0);
           writeStuff(*hptr, v);
    }
    hptr--;

    vm.call_ptr = handlePointer(*hptr--, vm.call_ptr);
    vm.stack_ptr = handlePointer(*hptr--, vm.stack_ptr);
    hptr--;
    vm.pc = handlePointer(*hptr--, vm.pc);
    if (*hptr) vm.memsize = vm.memsize + vm.reg1;
}

void init() {
  vm.globals = malloc(sizeof(uint64_t)*1024);
  vm.stack = malloc(sizeof(uint64_t)*1024*1024*10);
  vm.callstack = malloc(sizeof(uint64_t)*1024*1024);
  vm.memory = malloc(sizeof(uint64_t)*1024*1024*100);
  memset(vm.memory, 0, sizeof(uint64_t)*1024*1024*100);
  vm.calltable = malloc(sizeof(uint64_t)*1024*1024);
  vm.calltypes = malloc(sizeof(uint64_t)*1024*1024);
  
  vm.inputsize = malloc(sizeof(uint64_t)*1024);
  vm.inputname = malloc(sizeof(uint64_t*)*1024);
  vm.inputdata = malloc(sizeof(uint64_t*)*1024);

  vm.stack_ptr = 0;
  vm.call_ptr = 0;
  vm.pc = 0;
  vm.memsize = 1024*100*8;

}

uint8_t *readFile(char *name, uint64_t *sz) {
  FILE *f = fopen(name, "rb");
  fseek(f, 0, SEEK_END);
  long fsize = ftell(f);
  fseek(f, 0, SEEK_SET);  //same as rewind(f);
  
  fprintf(stderr, "Loading file %s: size %d\n", name, (int)fsize);

  uint8_t *res = malloc(fsize);
  fread(res, fsize, 1, f);
  fclose(f);
  
  *sz = fsize;
  
  return res;
}

int main(int argc, char **argv) {
  init();
  // Load code from file
  uint64_t sz = 0;
  vm.code = readFile("decoded.bin", &sz);

  // Load files to input
  for (int i = 1; i < argc; i++) {
     vm.inputname[i-1] = argv[i];
     vm.inputdata[i-1] = readFile(argv[i], &sz);
     vm.inputsize[i-1] = sz;
  }
     vm.inputname[argc-1] = "";
     vm.inputdata[argc-1] = "";
     vm.inputsize[argc-1] = 0;
  
  // start running it
  uint64_t counter = 0;
  while (1) {
    // printf("Step %ld, PC %ld\n", counter, vm.pc);
    performStep();
    if (getHint(3) == 0x06) return 0;
    // printOp();
    counter++;
    // fprintf(stderr, "Step %ld, PC %ld, Stack ptr %ld\n", counter, vm.pc, vm.stack_ptr);
    if (counter % 10000000 == 0) fprintf(stderr, "Step %ld, PC %ld, Stack ptr %ld\n", counter, vm.pc, vm.stack_ptr);
    /* if (counter > 560010000) {
       debug = 1;
       fprintf(stderr, "Step %ld, PC %ld, Stack ptr %ld\n", counter, vm.pc, vm.stack_ptr);
       fprintf(stderr, "mem at %lx %lx\n", loadN(vm.memory, 6784, 8), loadN(vm.memory, 6792, 8));
    } */
  }
  fprintf(stderr, "Number of steps %ld\n", counter);
  return 0;
}

