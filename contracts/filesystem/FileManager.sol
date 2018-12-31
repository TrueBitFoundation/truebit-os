pragma solidity ^0.5.0;

interface Consumer {
   function consume(bytes32 id, bytes32[] calldata dta) external;
}

contract FileManager {

    bytes32[] zero;
    bytes32[] zero_files;
    
    struct File {
	uint bytesize;
	bytes32[] data;
	string name;
     
	string ipfs_hash;
	address contractAddress;
	bytes32 root;
	uint type;// 0: eth_bytes, 1: contract, 2: ipfs
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

    function calcId(uint nonce) public view returns (bytes32) {
	return keccak256(abi.encodePacked(msg.sender, nonce));
    }

    //Creates file out of bytes data
    function createFileWithContents(string memory name, uint nonce, bytes32[] memory arr, uint sz) public returns (bytes32) {
	bytes32 id = keccak256(abi.encodePacked(msg.sender, nonce));
	File storage f = files[id];
	f.type = 0;
	f.data = arr;
	f.name = name;
	f.bytesize = sz;
	uint size = 0;
	uint tmp = arr.length;
	while (tmp > 1) { size++; tmp = tmp/2; }
	f.root = fileMerkle(arr, 0, size);
	return id;
    }

    function addContractFile(string memory name, uint nonce, address _address, bytes32 root) public returns (bytes32) {
	bytes32 id = keccak256(abi.encodePacked(msg.sender, nonce));
	File storage f = files[id];

	f.name = name;
	f.contractAddress = _address;
	f.bytesize = size;
	f.root = root;
	f.type = 1;

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
	f.type = 2;
	return id;
    }

    function getName(bytes32 id) public view returns (string memory) {
	return files[id].name;
    }

    function getType(bytes32 id) public view returns (uint) {
	return files[id].type;
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
    
}
