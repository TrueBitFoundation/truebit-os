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
	bytes32 init;
	bytes32[] files;
    }

    mapping (bytes32 => Bundle) bundles;

    function makeBundle(uint num) public view returns (bytes32) {
	bytes32 id = keccak256(abi.encodePacked(msg.sender, num));
	return id;
    }

    function addToBundle(bytes32 id, bytes32 file_id) public returns (bytes32) {
	Bundle storage b = bundles[id];
	b.files.push(file_id);
    }

    function finalizeBundle(bytes32 bundleID, bytes32 codeFileID) public returns (bytes32) {
	Bundle storage b = bundles[bundleID];
	File storage f = files[codeFileID];

	b.codeFileId = codeFileID;

	bytes32[] memory res1 = new bytes32[](b.files.length);
	bytes32[] memory res2 = new bytes32[](b.files.length);
	bytes32[] memory res3 = new bytes32[](b.files.length);
       
	for (uint i = 0; i < b.files.length; i++) {
	    res1[i] = bytes32(getByteSize(b.files[i]));
	    res2[i] = hashName(getName(b.files[i]));
	    res3[i] = getRoot(b.files[i]);
	}
       
	b.init = keccak256(abi.encodePacked(f.codeRoot, calcMerkle(res1, 0, 10), calcMerkle(res2, 0, 10), calcMerkleFiles(res3, 0, 10)));

	return b.init;

    }

    function debugFinalizeBundle(bytes32 bundleID, bytes32 codeFileID) public returns (bytes32, bytes32, bytes32, bytes32, bytes32) {
	Bundle storage b = bundles[bundleID];
	File storage f = files[codeFileID];

	bytes32[] memory res1 = new bytes32[](b.files.length);
	bytes32[] memory res2 = new bytes32[](b.files.length);
	bytes32[] memory res3 = new bytes32[](b.files.length);
       
	for (uint i = 0; i < b.files.length; i++) {
	    res1[i] = bytes32(getByteSize(b.files[i]));
	    res2[i] = hashName(getName(b.files[i]));
	    res3[i] = getRoot(b.files[i]);
	}

	return (f.codeRoot,
		calcMerkle(res1, 0, 10),
		calcMerkle(res2, 0, 10),
		calcMerkleFiles(res3, 0, 10),
		keccak256(abi.encodePacked(f.codeRoot, calcMerkle(res1, 0, 10), calcMerkle(res2, 0, 10), calcMerkleFiles(res3, 0, 10)))
		);
    }
       
    function getInitHash(bytes32 bid) public view returns (bytes32) {
	Bundle storage b = bundles[bid];
	return b.init;
    }

    function getCodeFileID(bytes32 bundleID) public view returns (bytes32) {
	Bundle storage b = bundles[bundleID];
	return b.codeFileId;
    }
      
    function getFiles(bytes32 bid) public view returns (bytes32[] memory) {
	Bundle storage b = bundles[bid];
	return b.files;
    }
    
}
