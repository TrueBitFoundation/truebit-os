
pragma solidity ^0.5.0;

interface Filesystem {

   function createFileWithContents(string calldata name, uint nonce, bytes32[] calldata arr, uint sz) external returns (bytes32);
   function getSize(bytes32 id) external view returns (uint);
   function getRoot(bytes32 id) external view returns (bytes32);
   function getData(bytes32 id) external view returns (bytes32[] memory);
   function forwardData(bytes32 id, address a) external;
   function makeBundle(uint num) external view returns (bytes32);
   function addToBundle(bytes32 id, bytes32 file_id) external returns (bytes32);
   function finalizeBundle(bytes32 bundleID, bytes32 codeFileID) external;
   function getInitHash(bytes32 bid) external view returns (bytes32);
   function addIPFSFile(string calldata name, uint size, string calldata hash, bytes32 root, uint nonce) external returns (bytes32);
   function hashName(string calldata name) external returns (bytes32);
}

interface TrueBit {
    function createTaskWithParams(bytes32 initTaskHash, uint8 codeType, bytes32 bundleID,  uint maxDifficulty, uint reward,
                                  uint8 stack, uint8 mem, uint8 globals, uint8 table, uint8 call, uint32 limit) external returns (bytes32);
   function requireFile(bytes32 id, bytes32 hash, /* Storage */ uint st) external;
   function commitRequiredFiles(bytes32 id) external;
   function makeRewardDeposit(uint _deposit) external payable returns (uint);
}

interface TRU {
    function approve(address spender, uint tokens) external returns (bool success);
}

contract Scrypt {

   event GotFiles(bytes32[] files);
   event Consuming(bytes32[] arr);

   event InputData(bytes32[] data);

   uint nonce;
   TrueBit truebit;
   Filesystem filesystem;
   TRU tru;

   // bytes32 bundleID;
   bytes32 codeFileID;
   bytes32 initHash;

   mapping (bytes => bytes32) string_to_file;
   mapping (bytes32 => bytes) task_to_string;
   mapping (bytes => bytes32) result;

   constructor(address tb, address tru_, address fs, bytes32 _codeFileID, bytes32 _initHash) public {
       truebit = TrueBit(tb);
       tru = TRU(tru_);
       filesystem = Filesystem(fs);
       codeFileID = _codeFileID;
       initHash = _initHash;
   }

   function formatData(bytes memory data) public pure returns (bytes32[] memory output) {
      //Format data
      output = new bytes32[](data.length/32+1);
      for (uint i = 0; i <= data.length/32; i++) {
         uint a;
         for (uint j = 0; j < 32; j++) {
            a = a*256;
            if (i*32+j < data.length) a += uint8(data[i*32+j]);
         }
         output[i] = bytes32(a);
      }

      return output;
   }

   function submitData(bytes memory data) public returns (bytes32) {
      uint num = nonce;
      nonce++;

      bytes32[] memory input = formatData(data);
      emit InputData(input);

      bytes32 bundleID = filesystem.makeBundle(num);

      bytes32 inputFileID = filesystem.createFileWithContents("input.data", num, input, data.length);
      string_to_file[data] = inputFileID;
      filesystem.addToBundle(bundleID, inputFileID);

      bytes32[] memory empty = new bytes32[](0);
      filesystem.addToBundle(bundleID, filesystem.createFileWithContents("output.data", num+1000000000, empty, 0));

      filesystem.finalizeBundle(bundleID, codeFileID);

      tru.approve(address(truebit), 1000);
      truebit.makeRewardDeposit(1000);
      bytes32 task = truebit.createTaskWithParams(filesystem.getInitHash(bundleID), 1, bundleID, 1, 1, 20, 20, 8, 20, 10, 5000);
      truebit.requireFile(task, filesystem.hashName("output.data"), 0);
      truebit.commitRequiredFiles(task);
      task_to_string[task] = data;
      return filesystem.getInitHash(bundleID);
   }

   bytes32 remember_task;

   // this is the callback name
   function solved(bytes32 id, bytes32[] memory files) public {
      // could check the task id
      require(TrueBit(msg.sender) == truebit, "only Truebit contract can post the solution");
      remember_task = id;
      emit GotFiles(files);
      bytes32[] memory arr = filesystem.getData(files[0]);
      emit Consuming(arr);
      result[task_to_string[remember_task]] = arr[0];
   }

   // need some way to get next state, perhaps shoud give all files as args
   function scrypt(bytes memory data) public view returns (bytes32) {
      return result[data];
   }

}
