pragma solidity ^0.5.0;

import "./FSUtils.sol";

interface Consumer {
   function consume(bytes32 id, bytes32[] calldata dta) external;
}

contract FileManager is FSUtils {

    bytes32[] zero;
    bytes32[] zero_files;

    bytes32 empty_file = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;    
    
    struct File {
	uint bytesize;
	bytes32[] data;
	string name;
     
	string ipfs_hash;
	address contractAddress;
	bytes32 root;
	uint fileType;// 0: eth_bytes, 1: contract, 2: ipfs
    }
    
    mapping (bytes32 => File) files;

    constructor() public {
	zero.length = 20;
	zero[0] = bytes32(0);
	zero_files.length = 20;
	zero_files[0] = empty_file;
	for (uint i = 1; i < zero.length; i++) {
	    zero[i] = keccak256(abi.encodePacked(zero[i-1], zero[i-1]));
	    zero_files[i] = keccak256(abi.encodePacked(zero_files[i-1], zero_files[i-1]));
	}
    }

    //Creates file out of bytes data
    function createFileWithContents(string memory name, uint nonce, bytes32[] memory arr, uint sz) public returns (bytes32) {
	bytes32 id = keccak256(abi.encodePacked(msg.sender, nonce));
	File storage f = files[id];
	f.fileType = 0;
	f.data = arr;
	f.name = name;
	f.bytesize = sz;
	uint size = 0;
	uint tmp = arr.length;
	while (tmp > 1) { size++; tmp = tmp/2; }
	f.root = fileMerkle(arr, 0, size);
	return id;
    }

    function addContractFile(string memory name, uint nonce, address _address, bytes32 root, uint size) public returns (bytes32) {
	bytes32 id = keccak256(abi.encodePacked(msg.sender, nonce));
	File storage f = files[id];

	f.name = name;
	f.contractAddress = _address;
	f.bytesize = size;
	f.root = root;
	f.fileType = 1;

	return id;
    }
   
    // the IPFS file should have same contents and name
    function addIPFSFile(string memory name, uint size, string memory hash, bytes32 root, uint nonce) public returns (bytes32) {
	bytes32 id = keccak256(abi.encodePacked(msg.sender, nonce));
	File storage f = files[id];
	f.bytesize = size;
	f.name = name;
	f.ipfs_hash = hash;
	f.root = root;
	f.fileType = 2;
	return id;
    }

    function getName(bytes32 id) public view returns (string memory) {
	return files[id].name;
    }

    function getFileType(bytes32 id) public view returns (uint) {
	return files[id].fileType;
    }
   
    function getNameHash(bytes32 id) public view returns (bytes32) {
	return hashName(files[id].name);
    }
   
    function getHash(bytes32 id) public view returns (string memory) {
	return files[id].ipfs_hash;
    }

    function getByteSize(bytes32 id) public view returns (uint) {
	return files[id].bytesize;
    }

    function setByteSize(bytes32 id, uint sz) public returns (uint) {
	files[id].bytesize = sz;
    }

    function getData(bytes32 id) public view returns (bytes32[] memory) {
	File storage f = files[id];
	return f.data;
    }
   
    function getByteData(bytes32 id) public view returns (bytes memory) {
	File storage f = files[id];
	bytes memory res = new bytes(f.bytesize);
	for (uint i = 0; i < f.data.length; i++) {
	    bytes32 w = f.data[i];
	    for (uint j = 0; j < 32; j++) {
		byte b = byte(uint8(uint(w) >> (8*j)));
		if (i*32 + j < res.length) res[i*32 + j] = b;
	    }
	}
	return res;
    }

    function forwardData(bytes32 id, address a) public {
	File storage f = files[id];
	Consumer(a).consume(id, f.data);
    }
   
    function getRoot(bytes32 id) public view returns (bytes32) {
	File storage f = files[id];
	return f.root;
    }
    
    function getLeaf(bytes32 id, uint loc) public view returns (bytes32) {
	File storage f = files[id];
	return f.data[loc];
    }

    // Merkle methods

    function makeMerkle(bytes memory arr, uint idx, uint level) internal pure returns (bytes32) {
	if (level == 0) return idx < arr.length ? bytes32(uint(uint8(arr[idx]))) : bytes32(0);
	else return keccak256(abi.encodePacked(makeMerkle(arr, idx, level-1), makeMerkle(arr, idx+(2**(level-1)), level-1)));
    }

    function calcMerkle(bytes32[] memory arr, uint idx, uint level) internal returns (bytes32) {
	if (level == 0) return idx < arr.length ? arr[idx] : bytes32(0);
	else if (idx >= arr.length) return zero[level];
	else return keccak256(abi.encodePacked(calcMerkle(arr, idx, level-1), calcMerkle(arr, idx+(2**(level-1)), level-1)));
    }

    function fileMerkle(bytes32[] memory arr, uint idx, uint level) internal returns (bytes32) {
//	if (level == 0) return idx < arr.length ? keccak256(abi.encodePacked(bytes16(arr[idx]), uint128(arr[idx]))) : keccak256(abi.encodePacked(bytes16(0), bytes16(0)));
	if (level == 0) return idx < arr.length ? keccak256(abi.encodePacked(arr[idx])) : keccak256(abi.encodePacked(bytes16(0), bytes16(0)));
	else return keccak256(abi.encodePacked(fileMerkle(arr, idx, level-1), fileMerkle(arr, idx+(2**(level-1)), level-1)));
    }

    function calcMerkleFiles(bytes32[] memory arr, uint idx, uint level) internal returns (bytes32) {
	if (level == 0) return idx < arr.length ? arr[idx] : empty_file;
	else if (idx >= arr.length) return zero_files[level];
	else return keccak256(abi.encodePacked(calcMerkleFiles(arr, idx, level-1), calcMerkleFiles(arr, idx+(2**(level-1)), level-1)));
    }
    
}
