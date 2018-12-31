pragma solidity ^0.5.0;

import "./FileManager.sol";

contract BundleManager is FileManager {
    // Methods to build IO blocks
    struct Bundle {
	bytes32 name_file;
	bytes32 data_file;
	bytes32 size_file;
	uint pointer;
	bytes32 codeFileId;
	bytes32 codeRoot;
	bytes32[] files;
    }

    mapping (bytes32 => Bundle) bundles;

    function makeBundle(uint num) public view returns (bytes32) {
	bytes32 id = keccak256(abi.encodePacked(msg.sender, num));
	return id;
    }

    function setCodeFile(bytes32, bundleID, bytes32 fileID) public {
	Bundle storage b = bundles[id];
    }

    function addToBundle(bytes32 id, bytes32 file_id) public returns (bytes32) {
	Bundle storage b = bundles[id];
	b.files.push(file_id);
    }

    bytes32 empty_file = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;

    function finalizeBundle(bytes32 id) public {
	Bundle storage b = bundles[id];
    }

    function finalizeBundleIPFS(bytes32 id, string memory file, bytes32 init) public {
	Bundle storage b = bundles[id];
	bytes32[] memory res1 = new bytes32[](b.files.length);
	bytes32[] memory res2 = new bytes32[](b.files.length);
	bytes32[] memory res3 = new bytes32[](b.files.length);
       
	for (uint i = 0; i < b.files.length; i++) {
	    res1[i] = bytes32(getByteSize(b.files[i]));
	    res2[i] = hashName(getName(b.files[i]));
	    res3[i] = getRoot(b.files[i]);
	}
       
	b.code_file = file;
       
	b.init = keccak256(abi.encodePacked(init, calcMerkle(res1, 0, 10), calcMerkle(res2, 0, 10), calcMerkleFiles(res3, 0, 10)));
    }

    function makeSimpleBundle(uint num, address code, bytes32 code_init, bytes32 file_id) public returns (bytes32) {
	bytes32 id = keccak256(abi.encodePacked(msg.sender, num));
	Bundle storage b = bundles[id];
	b.code = code;

	bytes32 res1 = bytes32(getByteSize(file_id));
	for (uint i = 0; i < 3; i++) res1 = keccak256(abi.encodePacked(res1, zero[i]));
       
	bytes32 res2 = hashName(getName(file_id));
	for (uint i = 0; i < 3; i++) res2 = keccak256(abi.encodePacked(res2, zero[i]));
       
	bytes32 res3 = getRoot(file_id);
	for (uint i = 0; i < 3; i++) res3 = keccak256(abi.encodePacked(res3, zero[i]));
       
	b.init = keccak256(abi.encodePacked(code_init, res1, res2, res3));

	b.files.push(file_id);

	return id;
    }    

    function debug_finalizeBundleIPFS(bytes32 id, string memory file, bytes32 init) public returns (bytes32, bytes32, bytes32, bytes32, bytes32) {
	Bundle storage b = bundles[id];
	bytes32[] memory res1 = new bytes32[](b.files.length);
	bytes32[] memory res2 = new bytes32[](b.files.length);
	bytes32[] memory res3 = new bytes32[](b.files.length);
       
	for (uint i = 0; i < b.files.length; i++) {
	    res1[i] = bytes32(getByteSize(b.files[i]));
	    res2[i] = hashName(getName(b.files[i]));
	    res3[i] = getRoot(b.files[i]);
	}
       
	b.code_file = file;
       
	return (init, calcMerkle(res1, 0, 10), calcMerkle(res2, 0, 10), calcMerkleFiles(res3, 0, 10),
		keccak256(abi.encodePacked(init, calcMerkle(res1, 0, 10), calcMerkle(res2, 0, 10), calcMerkleFiles(res3, 0, 10))));
    }
   
    function getInitHash(bytes32 bid) public view returns (bytes32) {
	Bundle storage b = bundles[bid];
	return b.init;
    }
   
    function getCode(bytes32 bid) public view returns (bytes memory) {
	Bundle storage b = bundles[bid];
	return getCodeAtAddress(b.code);
    }

    function getIPFSCode(bytes32 bid) public view returns (string memory) {
	Bundle storage b = bundles[bid];
	return b.code_file;
    }
   
    function getFiles(bytes32 bid) public view returns (bytes32[] memory) {
	Bundle storage b = bundles[bid];
	return b.files;
    }
    
}
