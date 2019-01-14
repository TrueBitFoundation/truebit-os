pragma solidity ^0.5.0;

import "../dispute/Filesystem.sol";
import "../openzeppelin-solidity/Ownable.sol";

import "../interface/IGameMaker.sol";
import "../interface/IDisputeResolutionLayer.sol";

interface Callback {
    function solved(bytes32 taskID, bytes32[] calldata files) external;
    function cancelled(bytes32 taskID) external;
}

contract SingleSolverIncentiveLayer  is Ownable {

    uint private numTasks = 0;
    uint private taxMultiplier = 5;

    uint constant BASIC_TIMEOUT = 50;
    uint constant IPFS_TIMEOUT = 50;
    uint constant RUN_RATE = 100000;
    uint constant INTERPRET_RATE = 100000;

    uint constant SOLVER_DEPOSIT = 1 ether;
    uint constant VERIFIER_DEPOSIT = 0.1 ether;

    uint bonded; // amount of ether bonded by the solver

    enum CodeType {
        WAST,
        WASM,
        INTERNAL
    }

    enum StorageType {
        IPFS,
        BLOCKCHAIN
    }

    struct VMParameters {
        uint8 stackSize;
        uint8 memorySize;
        uint8 callSize;
        uint8 globalsSize;
        uint8 tableSize;
        uint32 gasLimit;
    }

    event DepositBonded(bytes32 taskID, address account, uint amount);
    event JackpotTriggered(bytes32 taskID);
    event DepositUnbonded(bytes32 taskID, address account, uint amount);
    event SlashedDeposit(bytes32 taskID, address account, address opponent, uint amount);
    event TaskCreated(bytes32 taskID, uint blockNumber, uint reward, CodeType codeType, StorageType storageType, string storageAddress);
    event SolverSelected(bytes32 indexed taskID, address solver, bytes32 taskData, uint minDeposit, bytes32 randomBitsHash);
    event SolutionsCommitted(bytes32 taskID, CodeType codeType, StorageType storageType, string storageAddress, bytes32 solutionHash0);
    event SolutionRevealed(bytes32 taskID);
    // event TaskStateChange(bytes32 taskID, uint state);
    event VerificationCommitted(bytes32 taskID, address verifier, uint index);
    event SolverDepositBurned(address solver, bytes32 taskID);
    event VerificationGame(address indexed solver, uint currentChallenger); 
    event PayReward(address indexed solver, uint reward);

    event EndRevealPeriod(bytes32 taskID);
    event EndChallengePeriod(bytes32 taskID);
    event TaskFinalized(bytes32 taskID);

    enum State { TaskInitialized, SolverSelected, SolutionCommitted, ChallengesAccepted, IntentsRevealed, SolutionRevealed, TaskFinalized, TaskTimeout }
    enum Status { Uninitialized, Challenged, Unresolved, SolverWon, ChallengerWon }//For dispute resolution
    
    struct RequiredFile {
        bytes32 nameHash;
        StorageType fileStorage;
        bytes32 fileId;
    }
    
    struct Task {
        address payable owner;
        // address selectedSolver;
        // uint minDeposit;
        uint reward;
        // uint tax;
        bytes32 initTaskHash;
        State state;
        bytes32 blockhash;
        bytes32 randomBitsHash;
        // mapping(address => uint) bondedDeposits;
        // uint randomBits;
        uint finalityCode; // 0 => not finalized, 1 => finalized, 2 => forced error occurred
        // uint jackpotID;
        // uint cost;
        CodeType codeType;
        StorageType storageType;
        string storageAddress;
        
        bool requiredCommitted;
        RequiredFile[] uploads;
        
        // uint lastBlock; // Used to check timeout
        uint timeoutBlock;
        uint challengeTimeout;
    }

    struct Solution {
        // bytes32 solutionCommit; // keccak256(solutionHash0)
        bytes32 solutionHash;
        // bytes32 solutionHash1;
        // bool solution0Correct;
        // address[] solution0Challengers;
        // address[] solution1Challengers;
        address payable [] allChallengers;
        address payable currentChallenger;
        bool solverConvicted;
        bytes32 currentGame;
        
        bytes32 dataHash;
        bytes32 sizeHash;
        bytes32 nameHash;
    }

    mapping(bytes32 => Task) private tasks;
    mapping(bytes32 => Solution) private solutions;
    mapping(bytes32 => VMParameters) private vmParams;
    mapping (bytes32 => uint) challenges;    

    address disputeResolutionLayer; //using address type because in some cases it is IGameMaker, and others IDisputeResolutionLayer
    Filesystem fs;

    constructor (address _disputeResolutionLayer, address fs_addr) 
        public 
    {
        disputeResolutionLayer = _disputeResolutionLayer;
        fs = Filesystem(fs_addr);
    }

    function defaultParameters(bytes32 taskID) internal {
        VMParameters storage params = vmParams[taskID];
        params.stackSize = 14;
        params.memorySize = 16;
        params.globalsSize = 8;
        params.tableSize = 8;
        params.callSize = 10;
        params.gasLimit = 0;
    }

    // @dev – taskGiver creates tasks to be solved.
    // @param minDeposit – the minimum deposit required for engaging with a task as a solver or verifier.
    // @param reward - the payout given to solver
    // @param taskData – tbd. could be hash of the wasm file on a filesystem.
    // @param numBlocks – the number of blocks to adjust for task difficulty
    // @return – boolean
    function createTaskAux(bytes32 initTaskHash, CodeType codeType, StorageType storageType, string memory storageAddress, uint maxDifficulty, uint reward) internal returns (bytes32) {
        // Get minDeposit required by task
	    require(maxDifficulty > 0);
	    require(reward > 0);

        bytes32 id = keccak256(abi.encodePacked(initTaskHash, codeType, storageType, storageAddress, maxDifficulty, reward, numTasks));
        numTasks++;

        Task storage t = tasks[id];
        t.owner = msg.sender;
        t.reward = reward;

        bonded += reward;

        t.initTaskHash = initTaskHash;
        t.codeType = codeType;
        t.storageType = storageType;
        t.storageAddress = storageAddress;
        
        t.timeoutBlock = block.number + IPFS_TIMEOUT + BASIC_TIMEOUT;
        return id;
    }

    // @dev – taskGiver creates tasks to be solved.
    // @param minDeposit – the minimum deposit required for engaging with a task as a solver or verifier.
    // @param reward - the payout given to solver
    // @param taskData – tbd. could be hash of the wasm file on a filesystem.
    // @param numBlocks – the number of blocks to adjust for task difficulty
    // @return – boolean
    function createTask(bytes32 initTaskHash, CodeType codeType, StorageType storageType, string memory storageAddress, uint maxDifficulty) public payable returns (bytes32) {
        bytes32 id = createTaskAux(initTaskHash, codeType, storageType, storageAddress, maxDifficulty, msg.value);
        defaultParameters(id);
	    commitRequiredFiles(id);
        
        return id;
    }

    function createTaskWithParams(bytes32 initTaskHash, CodeType codeType, StorageType storageType, string memory storageAddress, uint maxDifficulty,
                                  uint8 stack, uint8 mem, uint8 globals, uint8 table, uint8 call, uint32 limit) public payable returns (bytes32) {
        bytes32 id = createTaskAux(initTaskHash, codeType, storageType, storageAddress, maxDifficulty, msg.value);
        VMParameters storage param = vmParams[id];
        require(stack > 5 && mem > 5 && globals > 5 && table > 5 && call > 5);
        require(stack < 30 && mem < 30 && globals < 30 && table < 30 && call < 30);
        param.stackSize = stack;
        param.memorySize = mem;
        param.globalsSize = globals;
        param.tableSize = table;
        param.callSize = call;
        param.gasLimit = limit;
        
        return id;
    }

    function requireFile(bytes32 id, bytes32 hash, StorageType st) public {
        Task storage t = tasks[id];
        require (!t.requiredCommitted && msg.sender == t.owner);
        t.uploads.push(RequiredFile(hash, st, 0));
    }
    
    function commitRequiredFiles(bytes32 id) public {
        Task storage t = tasks[id];
        require (msg.sender == t.owner);
        t.requiredCommitted = true;
        emit TaskCreated(id, t.timeoutBlock, t.reward, t.codeType, t.storageType, t.storageAddress);
    }
    
    function getUploadNames(bytes32 id) public view returns (bytes32[] memory) {
        RequiredFile[] storage lst = tasks[id].uploads;
        bytes32[] memory arr = new bytes32[](lst.length);
        for (uint i = 0; i < arr.length; i++) arr[i] = lst[i].nameHash;
        return arr;
    }

    function getUploadTypes(bytes32 id) public view returns (StorageType[] memory) {
        RequiredFile[] storage lst = tasks[id].uploads;
        StorageType[] memory arr = new StorageType[](lst.length);
        for (uint i = 0; i < arr.length; i++) arr[i] = lst[i].fileStorage;
        return arr;
    }

    // @dev – selected solver submits a solution to the exchange
    // 1 -> 2
    // @param taskID – the task id.
    // @param solutionHash0 – the hash of the solution (could be true or false solution)
    // @return – boolean
    function commitSolution(bytes32 taskID, bytes32 solutionHash0) public returns (bool) {
        Task storage t = tasks[taskID];
        VMParameters storage vm = vmParams[taskID];

        require(!(t.owner == address(0x0)));
        require(t.state == State.TaskInitialized);

        require(address(this).balance > bonded && address(this).balance - bonded > SOLVER_DEPOSIT);

        bonded += SOLVER_DEPOSIT;

        Solution storage s = solutions[taskID];
        s.solutionHash = solutionHash0;
        s.solverConvicted = false;
        t.state = State.SolutionCommitted;
        t.timeoutBlock = block.number + BASIC_TIMEOUT + IPFS_TIMEOUT + (1+vm.gasLimit/RUN_RATE);
        t.challengeTimeout = t.timeoutBlock; // End of challenge period
        emit SolutionsCommitted(taskID, t.codeType, t.storageType, t.storageAddress, solutionHash0);
        return true;
    }

    function cancelTask(bytes32 taskID) internal {
        Task storage t = tasks[taskID];
        t.state = State.TaskTimeout;
        bool ok;
        bytes memory res;
        (ok, res) = t.owner.call(abi.encodeWithSignature("cancel(bytes32)", taskID));
    }

    function slashOwner(bytes32 taskID, address payable recp) internal {
        Solution storage s = solutions[taskID];
        for (uint i = 0; i < s.allChallengers.length; i++) {
            if (s.allChallengers[i] != address(0)) s.allChallengers[i].transfer(VERIFIER_DEPOSIT);
        }
        recp.transfer(SOLVER_DEPOSIT + VERIFIER_DEPOSIT);
        bonded -= SOLVER_DEPOSIT;
    }

    function slashVerifier(address /* verifier */) internal {
        bonded -= VERIFIER_DEPOSIT;
    }

    function payReward(bytes32 taskID) internal {
        Task storage t = tasks[taskID];
        bonded -= t.reward;
    }

    function taskTimeout(bytes32 taskID) public {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        uint g_timeout = IDisputeResolutionLayer(disputeResolutionLayer).timeoutBlock(s.currentGame);
        require(block.number > g_timeout);
        require(block.number > t.timeoutBlock + BASIC_TIMEOUT);
        require(t.state != State.TaskTimeout);
        require(t.state != State.TaskFinalized);
        cancelTask(taskID);
        slashOwner(taskID, s.currentChallenger);
    }

    function isTaskTimeout(bytes32 taskID) public view returns (bool) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        uint g_timeout = IDisputeResolutionLayer(disputeResolutionLayer).timeoutBlock(s.currentGame);
        if (block.number <= g_timeout) return false;
        if (t.state == State.TaskTimeout) return false;
        if (t.state == State.TaskFinalized) return false;
        if (block.number <= t.timeoutBlock + BASIC_TIMEOUT) return false;
        return true;
    }

    function solverLoses(bytes32 taskID) public returns (bool) {
        // Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        if (IDisputeResolutionLayer(disputeResolutionLayer).status(s.currentGame) == uint(Status.ChallengerWon)) {
            cancelTask(taskID);
            slashOwner(taskID, s.currentChallenger);
            return s.currentChallenger == msg.sender;
        }
        return false;
    }    

    // @dev – verifier submits a challenge to the solution provided for a task
    // verifiers can call this until task giver changes state or timeout
    // @param taskID – the task id.
    // @param intentHash – submit hash of even or odd number to designate which solution is correct/incorrect.
    // @return – boolean
    function commitChallenge(bytes32 hash) public returns (bool) {
        require(challenges[hash] == 0);
        challenges[hash] = block.number;
        return true;
    }

    function endChallengePeriod(bytes32 taskID) public returns (bool) {
        Task storage t = tasks[taskID];
        if (t.state != State.SolutionCommitted || !(t.timeoutBlock < block.number)) return false;
        
        t.state = State.IntentsRevealed;
        emit EndRevealPeriod(taskID);
        t.timeoutBlock = block.number + BASIC_TIMEOUT;

        return true;
    }

    // @dev – verifiers can call this until task giver changes state or timeout
    // @param taskID – the task id.
    // @param intent – submit 0 to challenge solution0, 1 to challenge solution1, anything else challenges both
    // @return – boolean
    function makeChallenge(bytes32 taskID) public payable returns (bool) {
        Task storage t = tasks[taskID];
        require(t.state == State.SolutionCommitted);
        require(msg.value == VERIFIER_DEPOSIT);
        bonded += VERIFIER_DEPOSIT;
        uint position = solutions[taskID].allChallengers.length;
        solutions[taskID].allChallengers.push(msg.sender);

        emit VerificationCommitted(taskID, msg.sender, position);
        return true;
    }

    // @dev – solver reveals which solution they say is the correct one
    // 4 -> 5
    // @param taskID – the task id.
    // @param solution0Correct – determines if solution0Hash is the correct solution
    // @param originalRandomBits – original random bits for sake of commitment.
    // @return – boolean
    function revealSolution(bytes32 taskID, bytes32 codeHash, bytes32 sizeHash, bytes32 nameHash, bytes32 dataHash) public {
        Task storage t = tasks[taskID];
        require(t.state == State.IntentsRevealed);
        require(owner == msg.sender);
        
        Solution storage s = solutions[taskID];

        s.nameHash = nameHash;
        s.sizeHash = sizeHash;
        s.dataHash = dataHash;

        require(keccak256(abi.encodePacked(codeHash, sizeHash, nameHash, dataHash)) == s.solutionHash);

        t.state = State.SolutionRevealed;
        emit SolutionRevealed(taskID);
        t.timeoutBlock = block.number;
    }


    // verifier should be responsible for calling this first
    function canRunVerificationGame(bytes32 taskID) public view returns (bool) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        if (t.state != State.SolutionRevealed) return false;
        if (s.allChallengers.length == 0) return false;
        return (s.currentGame == 0 || IDisputeResolutionLayer(disputeResolutionLayer).status(s.currentGame) == uint(Status.SolverWon));
    }
    
    function runVerificationGame(bytes32 taskID) public {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        
        require(t.state == State.SolutionRevealed);
        require(s.currentGame == 0 || IDisputeResolutionLayer(disputeResolutionLayer).status(s.currentGame) == uint(Status.SolverWon));

        address payable slashedVerifier = s.currentChallenger;

        if (s.allChallengers.length > 0) {
            s.currentChallenger = s.allChallengers[s.allChallengers.length-1];
            verificationGame(taskID, owner, s.currentChallenger, s.solutionHash);
            s.allChallengers.length -= 1;
        }
        // emit VerificationGame(t.selectedSolver, s.currentChallenger);
        t.timeoutBlock = block.number;
        slashVerifier(slashedVerifier);
    }

    function verificationGame(bytes32 taskID, address solver, address challenger, bytes32 solutionHash) internal {
        Task storage t = tasks[taskID];
        VMParameters storage params = vmParams[taskID];
        uint size = 1;
        uint timeout = BASIC_TIMEOUT+(1+params.gasLimit/INTERPRET_RATE);
        bytes32 gameID = IGameMaker(disputeResolutionLayer).make(taskID, solver, challenger, t.initTaskHash, solutionHash, size, timeout);
        solutions[taskID].currentGame = gameID;
    }
    
    function uploadFile(bytes32 id, uint num, bytes32 file_id, bytes32[] memory name_proof, bytes32[] memory data_proof, uint file_num) public returns (bool) {
        Task storage t = tasks[id];
        Solution storage s = solutions[id];
        RequiredFile storage file = t.uploads[num];
        require(checkProof(fs.getRoot(file_id), s.dataHash, data_proof, file_num));
        require(checkProof(fs.getNameHash(file_id), s.nameHash, name_proof, file_num));
        
        file.fileId = file_id;
        return true;
    }
    
    function getLeaf(bytes32[] memory proof, uint loc) internal pure returns (uint) {
        require(proof.length >= 2);
        if (loc%2 == 0) return uint(proof[0]);
        else return uint(proof[1]);
    }
    
    function getRoot(bytes32[] memory proof, uint loc) internal pure returns (bytes32) {
        require(proof.length >= 2);
        bytes32 res = keccak256(abi.encodePacked(proof[0], proof[1]));
        for (uint i = 2; i < proof.length; i++) {
            loc = loc/2;
            if (loc%2 == 0) res = keccak256(abi.encodePacked(res, proof[i]));
            else res = keccak256(abi.encodePacked(proof[i], res));
        }
        require(loc < 2); // This should be runtime error, access over bounds
        return res;
    }
    
    function checkProof(bytes32 hash, bytes32 root, bytes32[] memory proof, uint loc) internal pure returns (bool) {
        return uint(hash) == getLeaf(proof, loc) && root == getRoot(proof, loc);
    }

    function finalizeTask(bytes32 taskID) public {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];

        require(t.state == State.SolutionRevealed);
        require(s.allChallengers.length == 0 && (s.currentGame == 0 || IDisputeResolutionLayer(disputeResolutionLayer).status(s.currentGame) == uint(Status.SolverWon)));

        bytes32[] memory files = new bytes32[](t.uploads.length);
        for (uint i = 0; i < t.uploads.length; i++) {
            require(t.uploads[i].fileId != 0);
            files[i] = t.uploads[i].fileId;
        }

        t.state = State.TaskFinalized;
        t.finalityCode = 1; // Task has been completed

        payReward(taskID);
        bool ok;
        bytes memory res;
        (ok, res) = t.owner.call(abi.encodeWithSignature("solved(bytes32,bytes32[])", taskID, files));
        emit TaskFinalized(taskID);
        // Callback(t.owner).solved(taskID, files);

        if (IDisputeResolutionLayer(disputeResolutionLayer).status(s.currentGame) == uint(Status.SolverWon)) {
            slashVerifier(s.currentChallenger);
        }

    }
    
    function isFinalized(bytes32 taskID) public view returns (bool) {
        Task storage t = tasks[taskID];
        return (t.state == State.TaskFinalized);
    }
    
    function canFinalizeTask(bytes32 taskID) public view returns (bool) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        
        if (t.state != State.SolutionRevealed) return false;

        if (!(s.allChallengers.length == 0 && (s.currentGame == 0 || IDisputeResolutionLayer(disputeResolutionLayer).status(s.currentGame) == uint(Status.SolverWon)))) return false;

        for (uint i = 0; i < t.uploads.length; i++) {
           if (t.uploads[i].fileId == 0) return false;
        }
        
        return true;
    }

    function getTaskFinality(bytes32 taskID) public view returns (uint) {
        return tasks[taskID].finalityCode;
    }

    function getVMParameters(bytes32 taskID) public view returns (uint8, uint8, uint8, uint8, uint8, uint32) {
        VMParameters storage params = vmParams[taskID];
        return (params.stackSize, params.memorySize, params.globalsSize, params.tableSize, params.callSize, params.gasLimit);
    }

    function getTaskInfo(bytes32 taskID) public view returns (address, bytes32, CodeType, StorageType, string memory, bytes32) {
        Task storage t = tasks[taskID];
        return (t.owner, t.initTaskHash, t.codeType, t.storageType, t.storageAddress, taskID);
    }

    function getSolutionInfo(bytes32 taskID) public view returns(bytes32, bytes32, bytes32, CodeType, StorageType, string memory) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        return (taskID, s.solutionHash, t.initTaskHash, t.codeType, t.storageType, t.storageAddress);
    }

}
