pragma solidity ^0.5.0;

import "./BundleManager.sol";

/**
* @title Calculate a merkle tree for the filesystem in solidity
* @author Sami Mäkelä
*/
contract Filesystem is BundleManager {
       
    function getCodeAtAddress(address a) internal view returns (bytes memory) {
        uint len;
        assembly {
	len := extcodesize(a)
		}
        bytes memory bs = new bytes(len);
        assembly {
            extcodecopy(a, add(bs,32), 0, len)
		}
        return bs;
    }

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

    // assume 256 bytes?
    function hashName(string memory name) public pure returns (bytes32) {
	return makeMerkle(bytes(name), 0, 8);
    }
   
    // more efficient way to store data onchain in chunks
    mapping (bytes32 => uint) chunks;
   
    function addChunk(bytes32[] memory arr, uint sz) public returns (bytes32) {
        require( /* arr.length == 2**sz && */ arr.length > 1);
        bytes32 hash = fileMerkle(arr, 0, sz);
        chunks[hash] = sz;
        return hash;
    }
    
    function combineChunks(bytes32[] memory arr, uint part_sz, uint sz) public {
        require(arr.length == 2**sz && arr.length > 1);
        bytes32 hash = calcMerkle(arr, 0, sz);
        for (uint i = 0; i < arr.length; i++) require(chunks[arr[i]] == part_sz);
        chunks[hash] = sz+part_sz;
    }

    function fileFromChunk(string memory name, bytes32 chunk, uint size) public returns (bytes32) {
        bytes32 id = keccak256(abi.encodePacked(msg.sender, chunk));
        require(chunks[chunk] != 0);
        File storage f = files[id];
        f.bytesize = size;
        f.name = name;
        f.root = chunk;
        return id;
    }
}

contract FSUtils {

    function idToString(bytes32 id) internal pure returns (string memory) {
	bytes memory res = new bytes(64);
	for (uint i = 0; i < 64; i++) res[i] = bytes1(uint8(((uint(id) / (2**(4*i))) & 0xf) + 65));
	return string(res);
    }

    function makeMerkle(bytes memory arr, uint idx, uint level) internal pure returns (bytes32) {
	if (level == 0) return idx < arr.length ? bytes32(uint(uint8(arr[idx]))) : bytes32(0);
	else return keccak256(abi.encodePacked(makeMerkle(arr, idx, level-1), makeMerkle(arr, idx+(2**(level-1)), level-1)));
    }

    function calcMerkle(bytes32[] memory arr, uint idx, uint level) internal returns (bytes32) {
	if (level == 0) return idx < arr.length ? arr[idx] : bytes32(0);
	else return keccak256(abi.encodePacked(calcMerkle(arr, idx, level-1), calcMerkle(arr, idx+(2**(level-1)), level-1)));
    }

    // assume 256 bytes?
    function hashName(string memory name) internal pure returns (bytes32) {
	return makeMerkle(bytes(name), 0, 8);
    }

}
