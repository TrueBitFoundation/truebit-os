pragma solidity ^0.4.18;

import "./DepositsManager.sol";
import "./JackpotManager.sol";
import "./TRU.sol";
import "../dispute/Filesystem.sol";
import "./ExchangeRateOracle.sol";
import "./RewardsManager.sol";

import "../interface/IGameMaker.sol";
import "../interface/IDisputeResolutionLayer.sol";

contract IncentiveLayer is JackpotManager, DepositsManager, RewardsManager {

    uint private numTasks = 0;
    uint private forcedErrorThreshold = 42;
    uint private taxMultiplier = 5;

    uint constant TIMEOUT = 100;

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
    }

    event DepositBonded(bytes32 taskID, address account, uint amount);
    event DepositUnbonded(bytes32 taskID, address account, uint amount);
    event BondedDepositMovedToJackpot(bytes32 taskID, address account, uint amount);
    event TaskCreated(bytes32 taskID, uint minDeposit, uint blockNumber, uint reward, uint tax, CodeType codeType, StorageType storageType, string storageAddress);
    event SolverSelected(bytes32 indexed taskID, address solver, bytes32 taskData, uint minDeposit, bytes32 randomBitsHash);
    event SolutionsCommitted(bytes32 taskID, uint minDeposit, CodeType codeType, StorageType storageType, string storageAddress);
    event SolutionRevealed(bytes32 taskID, uint randomBits);
    event TaskStateChange(bytes32 taskID, uint state);
    event VerificationCommitted(address verifier, uint jackpotID, uint solutionID, uint index);
    event SolverDepositBurned(address solver, bytes32 taskID);
    event VerificationGame(address indexed solver, uint currentChallenger); 
    event PayReward(address indexed solver, uint reward);

    enum State { TaskInitialized, SolverSelected, SolutionCommitted, ChallengesAccepted, IntentsRevealed, SolutionRevealed, TaskFinalized, TaskTimeout }
    enum Status { Uninitialized, Challenged, Unresolved, SolverWon, ChallengerWon }//For dispute resolution
    
    struct RequiredFile {
       bytes32 name_hash;
       StorageType file_storage;
       bytes32 file_id;
    }
    
    struct Task {
        address owner;
        address selectedSolver;
        uint minDeposit;
        uint reward;
        uint tax;
        bytes32 initTaskHash;
        mapping(address => bytes32) challenges;
        State state;
        bytes32 blockhash;
        bytes32 randomBitsHash;
        uint taskCreationBlockNumber;
        mapping(address => uint) bondedDeposits;
        uint randomBits;
        uint finalityCode; // 0 => not finalized, 1 => finalized, 2 => forced error occurred
        uint jackpotID;
        uint initialReward;
        CodeType codeType;
        StorageType storageType;
        string storageAddress;
        
        bool requiredCommitted;
        RequiredFile[] uploads;
    }

    struct Solution {
        bytes32 solutionHash0;
        bytes32 solutionHash1;
        bool solution0Correct;
        address[] solution0Challengers;
        address[] solution1Challengers;
        address[] allChallengers;
        uint currentChallenger;
        bool solverConvicted;
        bytes32 currentGame;
    }

    mapping(bytes32 => Task) private tasks;
    mapping(bytes32 => Solution) private solutions;
    mapping(bytes32 => VMParameters) private vmParams;

    ExchangeRateOracle oracle;
    address disputeResolutionLayer; //using address type because in some cases it is IGameMaker, and others IDisputeResolutionLayer
    Filesystem fs;

    constructor (address _TRU, address _exchangeRateOracle, address _disputeResolutionLayer, address fs_addr) 
        DepositsManager(_TRU) 
        JackpotManager(_TRU)
        RewardsManager(_TRU)
        public 
    {
        disputeResolutionLayer = _disputeResolutionLayer;
        oracle = ExchangeRateOracle(_exchangeRateOracle);
        fs = Filesystem(fs_addr);
    }

    // @dev - private method to check if the denoted amount of blocks have been mined (time has passed).
    // @param taskID - the task id.
    // @param numBlocks - the difficulty weight for the task
    // @return - boolean
    function stateChangeTimeoutReached(bytes32 taskID) private view returns (bool) {
        Task storage t = tasks[taskID];
        return block.number.sub(t.taskCreationBlockNumber) >= TIMEOUT;
    }

    // @dev – locks up part of the a user's deposit into a task.
    // @param taskID – the task id.
    // @param account – the user's address.
    // @param amount – the amount of deposit to lock up.
    // @return – the user's deposit bonded for the task.
    function bondDeposit(bytes32 taskID, address account, uint amount) private returns (uint) {
        Task storage task = tasks[taskID];
        require(deposits[msg.sender] >= amount);
        deposits[account] = deposits[account].sub(amount);
        task.bondedDeposits[account] = task.bondedDeposits[account].add(amount);
        emit DepositBonded(taskID, account, amount);
        return task.bondedDeposits[account];
    }

    // @dev – unlocks a user's bonded deposits from a task.
    // @param taskID – the task id.
    // @param account – the user's address.
    // @return – the user's deposit which was unbonded from the task.
    function unbondDeposit(bytes32 taskID) public returns (uint) {
        Task storage task = tasks[taskID];
        require(task.state == State.TaskFinalized || task.state == State.TaskTimeout);
        uint bondedDeposit = task.bondedDeposits[msg.sender];
        delete task.bondedDeposits[msg.sender];
        deposits[msg.sender] = deposits[msg.sender].add(bondedDeposit);
        emit DepositUnbonded(taskID, msg.sender, bondedDeposit);
        
        return bondedDeposit;
    }

    // @dev – punishes a user by moving their bonded deposits for a task into the jackpot.
    // @param taskID – the task id.
    // @param account – the user's address.
    // @return – the updated jackpot amount.
    function moveBondedDepositToJackpot(bytes32 taskID, address account) private returns (uint) {
        Task storage task = tasks[taskID];
        uint bondedDeposit = task.bondedDeposits[account];
        delete task.bondedDeposits[account];
        jackpot = jackpot.add(bondedDeposit);
        emit BondedDepositMovedToJackpot(taskID, account, bondedDeposit);
        
        return bondedDeposit;
    }

    // @dev – returns the user's bonded deposits for a task.
    // @param taskID – the task id.
    // @param account – the user's address.
    // @return – the user's bonded deposits for a task.
    function getBondedDeposit(bytes32 taskID, address account) constant public returns (uint) {
        return tasks[taskID].bondedDeposits[account];
    }

    function defaultParameters(bytes32 taskID) internal {
        VMParameters storage params = vmParams[taskID];
        params.stackSize = 14;
        params.memorySize = 16;
        params.globalsSize = 8;
        params.tableSize = 8;
        params.callSize = 10;
    }

    // @dev – taskGiver creates tasks to be solved.
    // @param minDeposit – the minimum deposit required for engaging with a task as a solver or verifier.
    // @param reward - the payout given to solver
    // @param taskData – tbd. could be hash of the wasm file on a filesystem.
    // @param numBlocks – the number of blocks to adjust for task difficulty
    // @return – boolean
    function createTaskAux(bytes32 initTaskHash, CodeType codeType, StorageType storageType, string storageAddress, uint maxDifficulty, uint reward) internal returns (bytes32) {
        // Get minDeposit required by task
        uint minDeposit = oracle.getMinDeposit(maxDifficulty);
        require(minDeposit > 0);
//        require(deposits[msg.sender] >= (reward + (minDeposit * taxMultiplier)));
        require(deposits[msg.sender] >= (minDeposit * taxMultiplier));
        
        bytes32 id = keccak256(abi.encodePacked(initTaskHash, codeType, storageType, storageAddress, maxDifficulty, reward, numTasks));
        numTasks.add(1);

        Task storage t = tasks[id];
        t.owner = msg.sender;
        t.minDeposit = minDeposit;
        depositReward(id, reward);
        t.reward = reward;
//        deposits[msg.sender] = deposits[msg.sender].sub(reward);

        t.tax = minDeposit * taxMultiplier;
        t.initTaskHash = initTaskHash;
        t.taskCreationBlockNumber = block.number;
        t.initialReward = minDeposit;
        t.codeType = codeType;
        t.storageType = storageType;
        t.storageAddress = storageAddress;
    }

    // @dev – taskGiver creates tasks to be solved.
    // @param minDeposit – the minimum deposit required for engaging with a task as a solver or verifier.
    // @param reward - the payout given to solver
    // @param taskData – tbd. could be hash of the wasm file on a filesystem.
    // @param numBlocks – the number of blocks to adjust for task difficulty
    // @return – boolean
    function createTask(bytes32 initTaskHash, CodeType codeType, StorageType storageType, string storageAddress, uint maxDifficulty, uint reward) public returns (bytes32) {
        bytes32 id = createTaskAux(initTaskHash, codeType, storageType, storageAddress, maxDifficulty, reward);
        defaultParameters(id);
	    commitRequiredFiles(id);
        // LOOK AT: May be some problem if tax amount is also not bonded
        // but still submitted through makeDeposit. For example,
        // if the task giver decides to bond the deposit and the

        // tax can not be collected. Perhaps another bonding
        // structure to escrow the taxes.
        log0(keccak256(abi.encodePacked(msg.sender))); // possible bug if log is after event

        return id;
    }

    function createTaskWithParams(bytes32 initTaskHash, CodeType codeType, StorageType storageType, string storageAddress, uint maxDifficulty, uint reward,
                                  uint8 stack, uint8 mem, uint8 globals, uint8 table, uint8 call) public returns (bytes32) {
        bytes32 id = createTaskAux(initTaskHash, codeType, storageType, storageAddress, maxDifficulty, reward);
        VMParameters storage param = vmParams[id];
        param.stackSize = stack;
        param.memorySize = mem;
        param.globalsSize = globals;
        param.tableSize = table;
        param.callSize = call;
        
        log0(keccak256(abi.encodePacked(msg.sender))); // possible bug if log is after event

        return id;
    }

    function commitRequiredFiles(bytes32 id) public {
        Task storage t = tasks[id];
        require (msg.sender == t.owner);
        t.requiredCommitted = true;
        emit TaskCreated(id, t.minDeposit, t.taskCreationBlockNumber, t.reward, t.tax, t.codeType, t.storageType, t.storageAddress);
    }

    // @dev – changes a tasks state.
    // @param taskID – the task id.
    // @param newSate – the new state.
    // @return – boolean
    function changeTaskState(bytes32 taskID, uint newState) public returns (bool) {
        Task storage t = tasks[taskID];
	
        //TODO: Add this back in
        require(stateChangeTimeoutReached(taskID));

        t.state = State(newState);
        emit TaskStateChange(taskID, newState);
        return true;
    }

    // @dev – solver registers for tasks, if first to register than automatically selected solver
    // 0 -> 1
    // @param taskID – the task id.
    // @param randomBitsHash – hash of random bits to commit to task
    // @return – boolean
    function registerForTask(bytes32 taskID, bytes32 randomBitsHash) public returns(bool) {
        Task storage t = tasks[taskID];
        
        require(!(t.owner == 0x0));
        require(t.state == State.TaskInitialized);
        require(t.selectedSolver == 0x0);
        
        bondDeposit(taskID, msg.sender, t.minDeposit);
        t.selectedSolver = msg.sender;
        t.randomBitsHash = randomBitsHash;
        t.blockhash = blockhash(block.number.add(1));
        t.state = State.SolverSelected;

        // Burn task giver's taxes now that someone has claimed the task
        deposits[t.owner] = deposits[t.owner].sub(t.tax);
        token.burn(t.tax);

        emit SolverSelected(taskID, msg.sender, t.initTaskHash, t.minDeposit, t.randomBitsHash);
        return true;
    }
    

    // @dev – new solver registers for task if penalize old one, don't burn tokens twice
    // 0 -> 1
    // @param taskID – the task id.
    // @param randomBitsHash – hash of random bits to commit to task
    // @return – boolean
    function registerNewSolver(bytes32 taskID, bytes32 randomBitsHash) public returns(bool) {
        Task storage t = tasks[taskID];
        
        require(!(t.owner == 0x0));
        require(t.state == State.TaskInitialized);
        require(t.selectedSolver == 0x0);
        
        bondDeposit(taskID, msg.sender, t.minDeposit);
        t.selectedSolver = msg.sender;
        t.randomBitsHash = randomBitsHash;
        t.blockhash = blockhash(block.number.add(1));
        t.state = State.SolverSelected;

        emit SolverSelected(taskID, msg.sender, t.initTaskHash, t.minDeposit, t.randomBitsHash);
        return true;
    }
    

    // @dev – selected solver submits a solution to the exchange
    // 1 -> 2
    // @param taskID – the task id.
    // @param solutionHash0 – the hash of the solution (could be true or false solution)
    // @param solutionHash1 – the hash of the solution (could be true or false solution)
    // @return – boolean
    function commitSolution(bytes32 taskID, bytes32 solutionHash0, bytes32 solutionHash1) public returns (bool) {
        Task storage t = tasks[taskID];
        require(t.selectedSolver == msg.sender);
        require(t.state == State.SolverSelected);
        require(block.number < t.taskCreationBlockNumber.add(TIMEOUT));
        Solution storage s = solutions[taskID];
        s.solutionHash0 = solutionHash0;
        s.solutionHash1 = solutionHash1;
        s.solverConvicted = false;
        t.state = State.SolutionCommitted;
        emit SolutionsCommitted(taskID, t.minDeposit, t.codeType, t.storageType, t.storageAddress);
        return true;
    }

    // @dev – selected solver revealed his random bits prematurely
    // @param taskID – The task id.
    // @param randomBits – bits whose hash is the commited randomBitsHash of this task
    // @return – boolean
    function prematureReveal(bytes32 taskID, uint originalRandomBits) public returns (bool) {
        Task storage t = tasks[taskID];
        require(t.state == State.SolverSelected);
        require(block.number < t.taskCreationBlockNumber.add(TIMEOUT));
        require(t.randomBitsHash == keccak256(abi.encodePacked(originalRandomBits)));
        uint bondedDeposit = t.bondedDeposits[t.selectedSolver];
        delete t.bondedDeposits[t.selectedSolver];
        deposits[msg.sender] = deposits[msg.sender].add(bondedDeposit/2);
        token.burn(bondedDeposit/2);
        emit SolverDepositBurned(t.selectedSolver, taskID);
        
        // Reset task data to selected another solver
        t.state = State.TaskInitialized;
        t.selectedSolver = 0x0;
        t.taskCreationBlockNumber = block.number;
        emit TaskCreated(taskID, t.minDeposit, t.taskCreationBlockNumber, t.reward, 1, t.codeType, t.storageType, t.storageAddress);

        return true;
    }        

    function taskGiverTimeout(bytes32 taskID) public {
        Task storage t = tasks[taskID];
        require(msg.sender == t.owner);
        Solution storage s = solutions[taskID];
        require(s.solutionHash0 == 0x0 && s.solutionHash1 == 0x0);
        require(block.number > t.taskCreationBlockNumber.add(TIMEOUT));
        moveBondedDepositToJackpot(taskID, t.selectedSolver);
        t.state = State.TaskTimeout;
    }

    // @dev – verifier submits a challenge to the solution provided for a task
    // verifiers can call this until task giver changes state or timeout
    // @param taskID – the task id.
    // @param intentHash – submit hash of even or odd number to designate which solution is correct/incorrect.
    // @return – boolean
    function commitChallenge(bytes32 taskID, bytes32 intentHash) public returns (bool) {
        Task storage t = tasks[taskID];
        require(t.state == State.SolutionCommitted);

        bondDeposit(taskID, msg.sender, t.minDeposit);
        t.challenges[msg.sender] = intentHash;
        return true;
    }

    // @dev – verifiers can call this until task giver changes state or timeout
    // @param taskID – the task id.
    // @param intent – submit 0 to challenge solution0, 1 to challenge solution1, anything else challenges both
    // @return – boolean
    function revealIntent(bytes32 taskID, uint intent) public returns (bool) {
        require(tasks[taskID].challenges[msg.sender] == keccak256(abi.encodePacked(intent)));
        require(tasks[taskID].state == State.ChallengesAccepted);
        uint solution = 0;
        uint position = 0;
        if (intent%2 == 0) { // Intent determines which solution the verifier is betting is deemed incorrect
            position = solutions[taskID].solution0Challengers.length;
            solutions[taskID].solution0Challengers.push(msg.sender);
        } else if (intent%2 == 1) {
            position = solutions[taskID].solution1Challengers.length;
            solutions[taskID].solution1Challengers.push(msg.sender);
            solution = 1;
        }
        position = solutions[taskID].allChallengers.length;
        solutions[taskID].allChallengers.push(msg.sender);

        delete tasks[taskID].challenges[msg.sender];
        emit VerificationCommitted(msg.sender, tasks[taskID].jackpotID, solution, position);
        return true;
    }

    // @dev – solver reveals which solution they say is the correct one
    // 4 -> 5
    // @param taskID – the task id.
    // @param solution0Correct – determines if solution0Hash is the correct solution
    // @param originalRandomBits – original random bits for sake of commitment.
    // @return – boolean
    function revealSolution(bytes32 taskID, bool solution0Correct, uint originalRandomBits) public {
        Task storage t = tasks[taskID];
        require(t.randomBitsHash == keccak256(abi.encodePacked(originalRandomBits)));
        require(t.state == State.IntentsRevealed);
        require(t.selectedSolver == msg.sender);
        solutions[taskID].solution0Correct = solution0Correct;
        t.state = State.SolutionRevealed;
        t.randomBits = originalRandomBits;
        if (isForcedError(originalRandomBits)) { // this if statement will make this function tricky to test
            rewardJackpot(taskID);
            t.finalityCode = 2;
            t.state = State.TaskFinalized;
        } else {
            emit SolutionRevealed(taskID, originalRandomBits);
        }
    }

    function isForcedError(uint randomBits) internal view returns (bool) {
        return (uint(keccak256(abi.encodePacked(randomBits, blockhash(block.number)))) < forcedErrorThreshold);
    }

    function rewardJackpot(bytes32 taskID) internal {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        t.jackpotID = setJackpotReceivers(s.allChallengers);

        payReward(taskID, t.owner);//Still compensating solver even though solution wasn't thoroughly verified, task giver recommended to not use solution
    }

    // verifier should be responsible for calling this first
    function runVerificationGame(bytes32 taskID) public {
        Task storage t = tasks[taskID];
        require(t.state == State.SolutionRevealed);
        Solution storage s = solutions[taskID];
        if (s.solution0Correct) {
            verificationGame(taskID, t.selectedSolver, s.solution0Challengers[s.currentChallenger], s.solutionHash0);
        } else {
            verificationGame(taskID, t.selectedSolver, s.solution1Challengers[s.currentChallenger], s.solutionHash1);
        }
        s.currentChallenger = s.currentChallenger + 1;
        emit VerificationGame(t.selectedSolver, s.currentChallenger);
    }

    function verificationGame(bytes32 taskID, address solver, address challenger, bytes32 solutionHash) internal {
        Task storage t = tasks[taskID];
        uint size = 1;
        bytes32 gameID = IGameMaker(disputeResolutionLayer).make(taskID, solver, challenger, t.initTaskHash, solutionHash, size, TIMEOUT);
        solutions[taskID].currentGame = gameID;
    }

    function finalizeTask(bytes32 taskID) public {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];

        require(s.currentChallenger >= s.solution0Challengers.length
		|| s.currentChallenger >= s.solution1Challengers.length
		&& IDisputeResolutionLayer(disputeResolutionLayer).status(s.currentGame) == uint(Status.SolverWon));
	
        t.state = State.TaskFinalized;
        t.finalityCode = 1; // Task has been completed

        payReward(taskID, t.selectedSolver);
    }

    function getTaskFinality(bytes32 taskID) public view returns (uint) {
        return tasks[taskID].finalityCode;
    }

    function getVMParameters(bytes32 taskID) public view returns (uint8, uint8, uint8, uint8, uint8) {
        VMParameters storage params = vmParams[taskID];
        return (params.stackSize, params.memorySize, params.globalsSize, params.tableSize, params.callSize);
    }

    function getTaskInfo(bytes32 taskID) public view returns (address, bytes32, CodeType, StorageType, string, bytes32) {
	    Task storage t = tasks[taskID];
        return (t.owner, t.initTaskHash, t.codeType, t.storageType, t.storageAddress, taskID);
    }

    function getSolutionInfo(bytes32 taskID) public view returns(bytes32, bytes32, bytes32, bytes32, CodeType, StorageType, string, address) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        return (taskID, s.solutionHash0, s.solutionHash1, t.initTaskHash, t.codeType, t.storageType, t.storageAddress, t.selectedSolver);
    }

}
