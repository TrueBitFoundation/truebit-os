pragma solidity ^0.5.0;

import "./DepositsManager.sol";
import "./RewardsManager.sol";

import "../filesystem/Filesystem.sol";
import "./ExchangeRateOracle.sol";

import "../interface/IToken.sol";
import "../interface/IDisputeResolutionLayer.sol";

interface Callback {
    function solved(bytes32 taskID, bytes32[] calldata files) external;
    function cancelled(bytes32 taskID) external;
}

contract IncentiveLayer is DepositsManager {

    uint private numTasks = 0;
    uint taxMultiplier = 0.75 ether;

    uint BASIC_TIMEOUT = 5;
    uint IPFS_TIMEOUT = 5;
    uint RUN_RATE = 100000;
    uint INTERPRET_RATE = 100000;

    function getTaxRate() public view returns (uint) {
        return taxMultiplier;
    }

    enum CodeType {
        WAST,
        WASM,
        INTERNAL
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
    event TaskCreated(bytes32 taskID, uint minDeposit, uint blockNumber, uint reward, uint tax, CodeType codeType, bytes32 bundleId);
    event SolverSelected(bytes32 indexed taskID, address solver, bytes32 taskData, uint minDeposit, bytes32 randomBitsHash);
    event SolutionsCommitted(bytes32 taskID, uint minDeposit, uint reward, CodeType codeType, bytes32 bundleId, bytes32 solutionHash0);
    event SolutionRevealed(bytes32 taskID, uint randomBits);
    // event TaskStateChange(bytes32 taskID, uint state);
    event VerificationCommitted(bytes32 taskID, address verifier, uint jackpotID, bytes32 solution, uint index);
    event SolverDepositBurned(address solver, bytes32 taskID);
    event VerificationGame(address indexed solver, uint currentChallenger);
    event PayReward(address indexed solver, uint reward);

    event EndRevealPeriod(bytes32 taskID);
    event EndChallengePeriod(bytes32 taskID);
    event TaskFinalized(bytes32 taskID);
    event TaskTimeout(bytes32 taskID);

    enum State { TaskInitialized, SolverSelected, SolutionCommitted, ChallengesAccepted, IntentsRevealed, SolutionRevealed, TaskFinalized, TaskTimeout }
//    enum Status { Uninitialized, Challenged, Unresolved, SolverWon, ChallengerWon }//For dispute resolution


    struct RequiredFile {
        bytes32 nameHash;
        uint fileType;
        bytes32 fileId;
    }

    struct Task {
        address owner;
        address selectedSolver;
        uint minDeposit;
        uint reward; // reward for solver
        uint tax; // reward for verifiers
        uint fee; // fee for contract owner
        bytes32 initTaskHash;
        State state;
        bytes32 blockhash;
        bytes32 randomBitsHash;
        mapping(address => uint) bondedDeposits;
        uint randomBits;
        uint finalityCode; // 0 => not finalized, 1 => finalized, 2 => forced error occurred
        uint jackpotID;
//        uint cost;
        CodeType codeType;
	    bytes32 bundleId;

        bool requiredCommitted;
        RequiredFile[] uploads;

        uint timeoutBlock;
        uint challengeTimeout;
    }

    struct Solution {
        bytes32 solutionCommit; // keccak256(solutionHash0)
        bytes32 solutionHash0;
        // bytes32 solutionHash1;
        // bool solution0Correct;
        address[] solution0Challengers;
        // address[] solution1Challengers;
        address[] allChallengers;
        address currentChallenger;
        bool solverConvicted;
        bytes32 currentGame;

        bytes32 dataHash;
        bytes32 sizeHash;
        bytes32 nameHash;
    }

    mapping(bytes32 => Task) private tasks;
    mapping(bytes32 => Solution) private solutions;
    mapping(bytes32 => VMParameters) private vmParams;
    mapping(bytes32 => uint) challenges;

    ExchangeRateOracle oracle;
    IDispute disputeResolutionLayer;
    Filesystem fs;

    IToken tru;

    constructor (address _TRU, address _CPU, address _STAKE, address _exchangeRateOracle, address _disputeResolutionLayer, address fs_addr)
        DepositsManager(_CPU, _STAKE)
        RewardsManager()
        public
    {
        disputeResolutionLayer = IDispute(_disputeResolutionLayer);
        oracle = ExchangeRateOracle(_exchangeRateOracle);
        fs = Filesystem(fs_addr);
        tru = IToken(_TRU);
    }

    function getBalance(address addr) public view returns (uint) {
        return tru.balanceOf(addr);
    }

    // @dev – locks up part of the a user's deposit into a task.
    // @param taskID – the task id.
    // @param account – the user's address.
    // @param amount – the amount of deposit to lock up.
    // @return – the user's deposit bonded for the task.
    function bondDeposit(bytes32 taskID, address account, uint amount) private returns (uint) {
        Task storage task = tasks[taskID];
        require(deposits[account] >= amount);
        deposits[account] -= amount;
        task.bondedDeposits[account] += amount;
        emit DepositBonded(taskID, account, amount);
        return task.bondedDeposits[account];
    }

    function getJackpotReceivers(bytes32 taskID) public view returns (address[] memory) {
        Solution storage s = solutions[taskID];
        return s.allChallengers;
    }

    event ReceivedJackpot(address receiver, uint amount);

    function receiveJackpotPayment(bytes32 taskID, uint index) public {
        Solution storage s = solutions[taskID];
        Task storage t = tasks[taskID];
        require(s.allChallengers[index] == msg.sender, "Tried to get jackpot belonging to others");
        s.allChallengers[index] = address(0);

        //transfer jackpot payment
        uint amount = t.tax.div(2 ** (s.allChallengers.length-1));
        tru.mint(msg.sender, amount);

        emit ReceivedJackpot(msg.sender, amount);
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
    function slashDeposit(bytes32 taskID, address account, address opponent) private returns (uint) {
        Task storage task = tasks[taskID];
        uint bondedDeposit = task.bondedDeposits[account];
        uint toOpponent = bondedDeposit/10;

        emit SlashedDeposit(taskID, account, opponent, bondedDeposit);
        if (bondedDeposit == 0) return 0;

        delete task.bondedDeposits[account];
        deposits[task.owner] += toOpponent;
        deposits[opponent] += toOpponent;
        return bondedDeposit;
    }

    function payReward(bytes32 taskID, address to) internal {
        Task storage task = tasks[taskID];
        uint payout = task.reward;
        uint fee_payout = task.fee;
        task.reward = 0;
        task.fee = 0;

        if (fee_payout > 0) tru.mint(owner, fee_payout);
        if (payout > 0) tru.mint(to, payout);
//        tru.transfer(to, payout);
    }

    // @dev – returns the user's bonded deposits for a task.
    // @param taskID – the task id.
    // @param account – the user's address.
    // @return – the user's bonded deposits for a task.
    function getBondedDeposit(bytes32 taskID, address account) view public returns (uint) {
        return tasks[taskID].bondedDeposits[account];
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
    function createTaskAux(bytes32 initTaskHash, CodeType codeType, bytes32 bundleId, uint maxDifficulty, uint reward_with_fee) internal returns (bytes32) {
        // Get minDeposit required by task
	    require(maxDifficulty > 0);
        uint minDeposit = oracle.getMinDeposit(maxDifficulty);
        require(minDeposit > 0);
        require(reward_with_fee > 0);

        bytes32 id = keccak256(abi.encodePacked(initTaskHash, codeType, bundleId, maxDifficulty, reward_with_fee, numTasks));
        numTasks.add(1);

        uint fee_amount = reward_with_fee * fee / 1 ether + fee_fixed;

        uint reward = reward_with_fee - fee_amount;

        Task storage t = tasks[id];
        t.owner = msg.sender;
        t.minDeposit = minDeposit;
        t.fee = fee_amount;
        t.tax = reward * taxMultiplier / 1 ether;
        t.reward = reward - t.tax;

        require(reward_deposits[msg.sender] >= reward_with_fee);
        reward_deposits[msg.sender] -= reward_with_fee;

        // depositReward(id, reward, t.tax);
        // BaseJackpotManager(jackpotManager).increaseJackpot(t.tax);

        t.initTaskHash = initTaskHash;
        t.codeType = codeType;
	    t.bundleId = bundleId;

        t.timeoutBlock = block.number + IPFS_TIMEOUT + BASIC_TIMEOUT;
        return id;
    }

    // @dev – taskGiver creates tasks to be solved.
    // @param minDeposit – the minimum deposit required for engaging with a task as a solver or verifier.
    // @param reward - the payout given to solver
    // @param taskData – tbd. could be hash of the wasm file on a filesystem.
    // @param numBlocks – the number of blocks to adjust for task difficulty
    // @return – boolean
    function createTask(bytes32 initTaskHash, CodeType codeType, bytes32 bundleId, uint maxDifficulty, uint reward) public returns (bytes32) {
        bytes32 id = createTaskAux(initTaskHash, codeType, bundleId, maxDifficulty, reward);
        defaultParameters(id);
	    commitRequiredFiles(id);
        return id;
    }

    function createTaskWithParams(bytes32 initTaskHash, CodeType codeType, bytes32 bundleId, uint maxDifficulty, uint reward, uint8 stack, uint8 mem, uint8 globals, uint8 table, uint8 call, uint32 limit) public returns (bytes32) {
        bytes32 id = createTaskAux(initTaskHash, codeType, bundleId, maxDifficulty, reward);
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

    function requireFile(bytes32 id, bytes32 hash, uint fileType) public {
        Task storage t = tasks[id];
        require (!t.requiredCommitted && msg.sender == t.owner);
        t.uploads.push(RequiredFile(hash, fileType, 0));
    }

    function commitRequiredFiles(bytes32 id) public {
        Task storage t = tasks[id];
        require (msg.sender == t.owner);
        t.requiredCommitted = true;
        emit TaskCreated(id, t.minDeposit, t.timeoutBlock, t.reward, t.tax, t.codeType, t.bundleId);
    }

    function getUploadNames(bytes32 id) public view returns (bytes32[] memory) {
        RequiredFile[] storage lst = tasks[id].uploads;
        bytes32[] memory arr = new bytes32[](lst.length);
        for (uint i = 0; i < arr.length; i++) arr[i] = lst[i].nameHash;
        return arr;
    }

    function getUploadTypes(bytes32 id) public view returns (uint[] memory) {
        RequiredFile[] storage lst = tasks[id].uploads;
        uint[] memory arr = new uint[](lst.length);
        for (uint i = 0; i < arr.length; i++) arr[i] = lst[i].fileType;
        return arr;
    }

    // @dev – solver registers for tasks, if first to register than automatically selected solver
    // 0 -> 1
    // @param taskID – the task id.
    // @param randomBitsHash – hash of random bits to commit to task
    // @return – boolean
    function registerForTask(bytes32 taskID, bytes32 randomBitsHash) public returns(bool) {
        Task storage t = tasks[taskID];
        VMParameters storage vm = vmParams[taskID];

        require(!(t.owner == address(0x0)));
        require(t.state == State.TaskInitialized);
        require(t.selectedSolver == address(0x0));

        bondDeposit(taskID, msg.sender, t.minDeposit);
        t.selectedSolver = msg.sender;
        t.randomBitsHash = randomBitsHash;
        t.state = State.SolverSelected;
        t.timeoutBlock = block.number + (1+vm.gasLimit/RUN_RATE);

        emit SolverSelected(taskID, msg.sender, t.initTaskHash, t.minDeposit, t.randomBitsHash);
        return true;
    }

    // @dev – selected solver submits a solution to the exchange
    // 1 -> 2
    // @param taskID – the task id.
    // @param solutionHash0 – the hash of the solution (could be true or false solution)
    // @param solutionHash1 – the hash of the solution (could be true or false solution)
    // @return – boolean
    function commitSolution(bytes32 taskID, bytes32 solutionHash0) public returns (bool) {
        Task storage t = tasks[taskID];
        require(t.selectedSolver == msg.sender);
        require(t.state == State.SolverSelected);
        // require(block.number < t.taskCreationBlockNumber.add(TIMEOUT));
        Solution storage s = solutions[taskID];
        s.solutionCommit = solutionHash0;
        // s.solutionHash1 = solutionHash1;
        s.solverConvicted = false;
        t.state = State.SolutionCommitted;
        VMParameters storage vm = vmParams[taskID];
        t.timeoutBlock = block.number + BASIC_TIMEOUT + IPFS_TIMEOUT + (1+vm.gasLimit/RUN_RATE);
        t.challengeTimeout = t.timeoutBlock; // End of challenge period
        emit SolutionsCommitted(taskID, t.minDeposit, t.reward, t.codeType, t.bundleId, solutionHash0);
        return true;
    }

    // @dev – selected solver revealed his random bits prematurely
    // @param taskID – The task id.
    // @param randomBits – bits whose hash is the commited randomBitsHash of this task
    // @return – boolean
    function prematureReveal(bytes32 taskID, uint originalRandomBits) public returns (bool) {
        Task storage t = tasks[taskID];
        require(t.state == State.SolverSelected);
        // require(block.number < t.taskCreationBlockNumber.add(TIMEOUT));
        require(t.randomBitsHash == keccak256(abi.encodePacked(originalRandomBits)));

        slashDeposit(taskID, t.selectedSolver, msg.sender);
        
        // Reset task data to selected another solver
        /*
        t.state = State.TaskInitialized;
        t.selectedSolver = address(0x0);
        t.timeoutBlock = block.number;
        emit TaskCreated(taskID, t.minDeposit, t.lastBlock, t.reward, 1, t.codeType, t.storageType, t.storageAddress);
        */

        cancelTask(taskID);

        return true;
    }

    function cancelTask(bytes32 taskID) internal {
        Task storage t = tasks[taskID];
        t.state = State.TaskTimeout;
        delete t.selectedSolver;
        emit TaskTimeout(taskID);
        bool ok;
        bytes memory res;
        (ok, res) = t.owner.call(abi.encodeWithSignature("cancel(bytes32)", taskID));
    }

    function taskTimeout(bytes32 taskID) public {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        uint g_timeout = disputeResolutionLayer.timeoutBlock(s.currentGame);
        require(block.number > g_timeout + BASIC_TIMEOUT);
        require(block.number > t.timeoutBlock + BASIC_TIMEOUT);
        require(t.state != State.TaskTimeout);
        require(t.state != State.TaskFinalized);
        slashDeposit(taskID, t.selectedSolver, s.currentChallenger);
        cancelTask(taskID);
    }

    function isTaskTimeout(bytes32 taskID) public view returns (bool) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        uint g_timeout = disputeResolutionLayer.timeoutBlock(s.currentGame);
        if (block.number <= g_timeout + BASIC_TIMEOUT) return false;
        if (t.state == State.TaskTimeout) return false;
        if (t.state == State.TaskFinalized) return false;
        if (block.number <= t.timeoutBlock + BASIC_TIMEOUT) return false;
        return true;
    }

    function solverLoses(bytes32 taskID) public returns (bool) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        if (disputeResolutionLayer.status(s.currentGame) == IDispute.Status.ChallengerWon) {
            slashDeposit(taskID, t.selectedSolver, s.currentChallenger);
            cancelTask(taskID);
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
        if (t.state != State.SolutionCommitted || !(t.challengeTimeout < block.number)) return false;

        t.state = State.ChallengesAccepted;
        emit EndChallengePeriod(taskID);
        t.timeoutBlock = block.number + BASIC_TIMEOUT;
        t.blockhash = blockhash(block.number-1);

        return true;
    }

    function endRevealPeriod(bytes32 taskID) public returns (bool) {
        Task storage t = tasks[taskID];
        if (t.state != State.ChallengesAccepted || !(t.timeoutBlock < block.number)) return false;

        t.state = State.IntentsRevealed;
        emit EndRevealPeriod(taskID);
        t.timeoutBlock = block.number + BASIC_TIMEOUT;

        return true;
    }

    // @dev – verifiers can call this until task giver changes state or timeout
    // @param taskID – the task id.
    // @param intent – submit 0 to challenge solution0, 1 to challenge solution1, anything else challenges both
    // @return – boolean
    function revealIntent(bytes32 taskID, bytes32 solution0) public returns (bool) {
        bytes32 id = keccak256(abi.encodePacked(taskID, msg.sender, solution0));
        uint cblock = challenges[id];
        Task storage t = tasks[taskID];
        require(t.state == State.ChallengesAccepted);
        require(t.challengeTimeout > cblock);
        require(cblock != 0);
        bondDeposit(taskID, msg.sender, t.minDeposit);
        // Intent determines which solution the verifier is betting is deemed incorrect
        if (keccak256(abi.encodePacked(solution0)) != solutions[taskID].solutionCommit) {
            solutions[taskID].solution0Challengers.push(msg.sender);
        }
        uint position = solutions[taskID].allChallengers.length;
        solutions[taskID].allChallengers.push(msg.sender);

        delete challenges[id];
        emit VerificationCommitted(taskID, msg.sender, tasks[taskID].jackpotID, solution0, position);
        return true;
    }

    // @dev – solver reveals which solution they say is the correct one
    // 4 -> 5
    // @param taskID – the task id.
    // @param solution0Correct – determines if solution0Hash is the correct solution
    // @param originalRandomBits – original random bits for sake of commitment.
    // @return – boolean
    function revealSolution(bytes32 taskID, uint originalRandomBits, bytes32 codeHash, bytes32 sizeHash, bytes32 nameHash, bytes32 dataHash) public {
        Task storage t = tasks[taskID];
        require(t.randomBitsHash == keccak256(abi.encodePacked(originalRandomBits)));
        require(t.state == State.IntentsRevealed);
        require(t.selectedSolver == msg.sender);

        Solution storage s = solutions[taskID];

        s.nameHash = nameHash;
        s.sizeHash = sizeHash;
        s.dataHash = dataHash;

        s.solutionHash0 = keccak256(abi.encodePacked(codeHash, sizeHash, nameHash, dataHash));

        require(keccak256(abi.encodePacked(s.solutionHash0)) == s.solutionCommit);

        rewardJackpot(taskID);

        t.state = State.SolutionRevealed;
        t.randomBits = originalRandomBits;
        emit SolutionRevealed(taskID, originalRandomBits);
        t.timeoutBlock = block.number;
    }


    function rewardJackpot(bytes32 taskID) internal {
        // Task storage t = tasks[taskID];
        // Solution storage s = solutions[taskID];
        // t.jackpotID = BaseJackpotManager(jackpotManager).setJackpotReceivers(s.allChallengers);
        emit JackpotTriggered(taskID);

        // payReward(taskID, t.owner);//Still compensating solver even though solution wasn't thoroughly verified, task giver recommended to not use solution
    }

    // verifier should be responsible for calling this first
    function canRunVerificationGame(bytes32 taskID) public view returns (bool) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        if (t.state != State.SolutionRevealed) return false;
        if (s.solution0Challengers.length == 0) return false;
        return (s.currentGame == 0 || disputeResolutionLayer.status(s.currentGame) == IDispute.Status.SolverWon);
    }

    function runVerificationGame(bytes32 taskID) public {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];

        require(t.state == State.SolutionRevealed);
        require(s.currentGame == 0 || disputeResolutionLayer.status(s.currentGame) == IDispute.Status.SolverWon);

        if (disputeResolutionLayer.status(s.currentGame) == IDispute.Status.SolverWon) {
            slashDeposit(taskID, s.currentChallenger, t.selectedSolver);
        }

        if (s.solution0Challengers.length > 0) {
            s.currentChallenger = s.solution0Challengers[s.solution0Challengers.length-1];
            verificationGame(taskID, t.selectedSolver, s.currentChallenger, s.solutionHash0);
            s.solution0Challengers.length -= 1;
        }
        // emit VerificationGame(t.selectedSolver, s.currentChallenger);
        t.timeoutBlock = block.number;
    }

    function verificationGame(bytes32 taskID, address solver, address challenger, bytes32 solutionHash) internal {
        Task storage t = tasks[taskID];
        VMParameters storage params = vmParams[taskID];
        uint size = 1;
        uint timeout = BASIC_TIMEOUT+(1+params.gasLimit/INTERPRET_RATE);
        bytes32 gameID = disputeResolutionLayer.make(taskID, solver, challenger, t.initTaskHash, solutionHash, size, timeout);
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

    function getRoot(bytes32[] memory proof, uint loc_) internal pure returns (bytes32) {
        uint loc = loc_;
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
        require(s.solution0Challengers.length == 0 && (s.currentGame == 0 || disputeResolutionLayer.status(s.currentGame) == IDispute.Status.SolverWon));

        if (disputeResolutionLayer.status(s.currentGame) == IDispute.Status.SolverWon) {
            slashDeposit(taskID, s.currentChallenger, t.selectedSolver);
        }

        bytes32[] memory files = new bytes32[](t.uploads.length);
        for (uint i = 0; i < t.uploads.length; i++) {
            require(t.uploads[i].fileId != 0);
            files[i] = t.uploads[i].fileId;
        }

        t.state = State.TaskFinalized;
        t.finalityCode = 1; // Task has been completed

        payReward(taskID, t.selectedSolver);
        bool ok;
        bytes memory res;
        (ok, res) = t.owner.call(abi.encodeWithSignature("solved(bytes32,bytes32[])", taskID, files));
        emit TaskFinalized(taskID);
        // Callback(t.owner).solved(taskID, files);
    }

    function isFinalized(bytes32 taskID) public view returns (bool) {
        Task storage t = tasks[taskID];
        return (t.state == State.TaskFinalized);
    }

    function canFinalizeTask(bytes32 taskID) public view returns (bool) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];

        if (t.state != State.SolutionRevealed) return false;

        if (!(s.solution0Challengers.length == 0 && (s.currentGame == 0 || disputeResolutionLayer.status(s.currentGame) == IDispute.Status.SolverWon))) return false;

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

    function getTaskInfo(bytes32 taskID) public view returns (address, bytes32, CodeType, bytes32, bytes32) {
	    Task storage t = tasks[taskID];
        return (t.owner, t.initTaskHash, t.codeType, t.bundleId, taskID);
    }

    function getSolutionInfo(bytes32 taskID) public view returns(bytes32, bytes32, bytes32, bytes32, CodeType, bytes32, address) {
        Task storage t = tasks[taskID];
        Solution storage s = solutions[taskID];
        return (taskID, s.solutionHash0, s.solutionCommit, t.initTaskHash, t.codeType, t.bundleId, t.selectedSolver);
    }

}
