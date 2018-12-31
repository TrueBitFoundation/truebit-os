pragma solidity ^0.5.0;

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
        
}
