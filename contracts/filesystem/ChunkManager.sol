pragma solidity ^0.5.0;

contract ChunkManager {
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
