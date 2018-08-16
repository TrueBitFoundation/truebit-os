pragma solidity ^0.4.19;

// generic merkle proofs for keccak256

contract Merkle {

   function bytes32ToBytes(bytes32 x) internal pure returns (bytes) {
     bytes memory res = new bytes(32);
     assembly {
       mstore(add(res,32), x)
     }
     return res;
   }

   function process(bytes32 leaf, bytes[] inst) internal pure returns (bytes32) {
      // first is the leaf
      for (uint i = 0; i+1 < inst.length; i += 2) {
         leaf = keccak256(inst[i], leaf, inst[i+1]);
      }
      return leaf;
   }
   
   function slice(bytes arr, uint i, uint n) internal pure returns (bytes) {
       bytes memory res = new bytes(n);
       for (uint j = 0; j < n; j++) res[j] = arr[i+j];
       return res;
   }
   
   function slice2(bytes arr, uint i1, uint i2) internal pure returns (bytes) {
       bytes memory res = new bytes(i2-i1);
       for (uint j = 0; j < i2-i1; j++) res[j] = arr[i1+j];
       return res;
   }
   
   // basically the merkle root of the argument has to be calculated
   // perhaps just require that it has to be padded?
   function process2(bytes32 leaf, uint[] ctrl, bytes inst) public pure returns (bytes32) {
      // first is the leaf
      for (uint i = 1; i+2 < ctrl.length; i += 2) {
         leaf = keccak256(slice2(inst, ctrl[i], ctrl[i+1]),
                          leaf,
                          slice2(inst, ctrl[i+1], ctrl[i+2]));
      }
      return leaf;
   }

   uint constant skip_start = 64;
   uint constant skip_end = 32;
   
   function dataMerkle(uint[] ctrl, uint idx, uint level) internal pure returns (bytes32) {
      if (level == 0) {
          if (idx < ctrl.length) {
              // get the element
              bytes32 elem = bytes32(ctrl[idx]);
              return keccak256(bytes16(elem), uint128(elem));
          }
          else return keccak256(bytes16(0), bytes16(0));
      }
      else return keccak256(dataMerkle(ctrl, idx, level-1), dataMerkle(ctrl, idx+(2**(level-1)), level-1));
   }

   function test(bytes dta) public pure returns (bytes32) {
       return keccak256(dta);
   }

   function test2(bytes dta, uint n) public pure {
       slice2(dta, 0, n);
   }

   function test3() public pure returns (bytes32) {
       return keccak256(bytes2(0x0));
   }

// interface CustomJudge

    struct Task {
      bytes32 initial_state;
      address solver;
      uint clock;
      bytes32 leaf;
      bytes32 valid_root;
    }

    mapping (bytes32 => Task) tasks;
    mapping (bytes32 => bool) valid;

    // perhaps have mongodb or something to store the actual file data?
    event AddedObligation(bytes32 id, bytes32 state, address solver);

    // Initializes a new custom verification game
    function init(bytes32 state, uint /* state_size */, uint /* r3 */, address solver, address /* verifier */) public returns (bytes32) {
       bytes32 id = keccak256(state, solver);
       Task storage t = tasks[id];
       t.initial_state = state;
       t.solver = solver;
       t.clock = block.number;
       emit AddedObligation(id, state, solver);
       return id;
    }

    // Last time the task was updated
    function clock(bytes32 id) public view returns (uint) {
        return tasks[id].clock;
    }

    // Check if has resolved into correct state: merkle root of output data and output size
    function resolved(bytes32 id, bytes32 state, uint size) public view returns (bool) {
       Task storage t = tasks[id];
       bytes32 zero = keccak256(bytes16(0), bytes16(0));
       bytes32 leaf = keccak256(bytes16(t.leaf), uint128(t.leaf));
       // bytes32 root = keccak256(bytes16(t.valid_root), uint128(t.valid_root));
       return size == 32 && state == keccak256(keccak256(leaf, zero), keccak256(zero, zero));
    }

    function submitProof(bytes32 id, bytes32 leaf, uint[] ctrl, bytes inst, uint sz) public {
       Task storage t = tasks[id];
       require(msg.sender == t.solver);
       bytes32 input = dataMerkle(ctrl, 0, sz);
       require(input == t.initial_state);
       bytes32 root = process2(leaf, ctrl, inst);
       require(root == bytes32(ctrl[0]));
       require(valid[root]);
       t.valid_root = root;
       t.leaf = leaf;
    }

}
