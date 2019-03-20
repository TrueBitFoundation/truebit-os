pragma solidity ^0.5.0;

import "./TRU.sol";

interface IWhitelist {
    function approved(bytes32 taskID, address solver) external returns (bool);
}

interface ITruebit {
    function isFailed(bytes32 taskID) external returns (bool);
    function isFinalized(bytes32 taskID) external returns (bool);
    function getBlock(bytes32 taskID) external returns (uint);
    function getSolution(bytes32 taskID) external returns (bytes32);
}

contract TestBook is ITruebit {

    struct Task {
        bool failed;
        bool finalized;
        uint bn;
        bytes32 solution;
    }

    mapping (bytes32 => Task) tasks;

    function isFailed(bytes32 taskID) external returns (bool) {
        return tasks[taskID].failed;
    }
    function isFinalized(bytes32 taskID) external returns (bool) {
        return tasks[taskID].finalized;
    }
    function getBlock(bytes32 taskID) external returns (uint) {
        return tasks[taskID].bn;
    }
    function getSolution(bytes32 taskID) external returns (bytes32) {
        return tasks[taskID].solution;
    }

    function addTask(bytes32 taskID, bytes32 solution) public {
        tasks[taskID].bn = block.number;
        tasks[taskID].solution = solution;
    }

    function finalizeTask(bytes32 taskID) public {
        tasks[taskID].finalized = true;
    }

    function failTask(bytes32 taskID) public {
        tasks[taskID].failed = true;
    }

}

contract StakeWhitelist is IWhitelist {

    struct Ticket {
        address owner;
        uint price;
        uint bn;
        bytes32 taskID;
        uint usedBN;
        uint deposit;
        bytes32[] challenges;
        address challenger;
        uint challengeDeposit;
        mapping (bytes32 => bool) challengeMap; 
    }

    mapping (bytes32 => Ticket) tickets;

    mapping (address => uint) deposit;

    uint constant NUM_VERIFIERS = 2;
    uint constant TICKET_PRICE = 1 ether;
    uint constant CHALLENGE_DEPOSIT = 1 ether;

    address owner;

    constructor () public {
        owner = msg.sender;
    }

    ITruebit tb;
    TRU token;

    // @dev - allows a user to deposit TRU tokens
    function makeDeposit(uint _deposit) public {
        require(token.allowance(msg.sender, address(this)) >= _deposit, "Not enough allowance");
        token.transferFrom(msg.sender, address(this), _deposit);
        deposit[msg.sender] += _deposit;
    }

    function getDeposit(address a) public view returns (uint) {
        return deposit[a];
    }

    function setTaskBook(address tb_addr) public {
        require(owner == msg.sender, "Only owner can change taskbook");
        tb = ITruebit(tb_addr);
    }

    function setToken(address payable c_addr) public {
        require(owner == msg.sender, "Only owner can change taskbook");
        token = TRU(c_addr);
    }

    event NewTicket(address owner, bytes32 ticket, uint block);

    function buyTicket(bytes32 idx) public {
        Ticket storage t = tickets[idx];
        require(t.owner == address(0), "Ticket exists");
        require(deposit[msg.sender] >= TICKET_PRICE, "Cannot afford ticket");
        t.owner = msg.sender;
        t.bn = block.number;
        deposit[msg.sender] -= TICKET_PRICE;
        t.deposit = TICKET_PRICE;
        emit NewTicket(msg.sender, idx, block.number);
    }

    mapping (bytes32 => address) selected;

    function approved(bytes32 taskID, address solver) external returns (bool) {
        return selected[taskID] == solver;
    }

    function validTicket(bytes32 idx) public view returns (bool) {
        return tickets[idx].owner != address(0) && tickets[idx].taskID == 0;
    }

    event UsedTicket(bytes32 ticket, bytes32 taskID, address owner);

    function useTicket(bytes32 idx, bytes32 taskID) public {
        Ticket storage t = tickets[idx];
        require(t.owner == msg.sender);
        require(t.taskID == 0);
        require(selected[taskID] == address(0));
        t.taskID = taskID;
        t.usedBN = block.number;
        selected[taskID] = msg.sender;
        emit UsedTicket(idx, taskID, t.owner);
    }

    // Larger weight is better
    function verifierWeight(bytes32 idx, bytes32 taskID) public returns (uint) {
        uint task_block = tb.getBlock(taskID);
        Ticket storage t = tickets[idx];
        if (t.bn > task_block) return 0;
        if (t.usedBN < task_block && t.usedBN != 0) return 0;
//        if (t.taskID != 0 && t.taskID != taskID) return 0;
        return uint(keccak256(abi.encodePacked(idx, taskID, blockhash(task_block))));
    } 

    function getVerifierWeight(bytes32 idx, bytes32 taskID, uint task_block) public view returns (uint) {
        Ticket storage t = tickets[idx];
        if (t.bn > task_block) return 0;
        if (t.usedBN < task_block && t.usedBN != 0) return 0;
        return uint(keccak256(abi.encodePacked(idx, taskID, blockhash(task_block))));
    } 

    function getSolverWeight(bytes32 idx, bytes32 /* taskID */, bytes32 solutionID, uint task_block) public view returns (uint) {
        Ticket storage t = tickets[idx];
        if (t.bn > task_block) return 0;
        if (t.usedBN < task_block && t.usedBN != 0) return 0;
        return uint(keccak256(abi.encodePacked(idx, solutionID, blockhash(task_block))));
    } 

    // Larger weight is better
    function solverWeight(bytes32 idx, bytes32 taskID) public returns (uint) {
        uint task_block = tb.getBlock(taskID);
        Ticket storage t = tickets[idx];
        if (t.bn > task_block) return 0;
        if (t.usedBN < task_block && t.usedBN != 0) return 0;
//        if (t.taskID != 0 && t.taskID != taskID) return 0;
        return uint(keccak256(abi.encodePacked(idx, tb.getSolution(taskID), blockhash(task_block))));
    }

    event TicketChallenged(bytes32 idx, address owner, bytes32 task);

    // here we should perhaps add a deposit so that no useless challenges will be made
    // correct strategy is to add all verifiers in order
    function addChallenge(bytes32 idx, bytes32 other, uint loc) public {

        Ticket storage t = tickets[idx];
        require(t.taskID != 0);
        require(idx == other || tickets[other].taskID == 0);

        if (t.challenges.length == 0) emit TicketChallenged(idx, t.owner, t.taskID);

        if (msg.sender != t.owner && t.challengeDeposit == 0) {
            require(deposit[msg.sender] > CHALLENGE_DEPOSIT);
            t.challengeDeposit += CHALLENGE_DEPOSIT;
            t.challenger = msg.sender;
            deposit[msg.sender] -= CHALLENGE_DEPOSIT;
        }

        for (uint i = 0; i < t.challenges.length; i++) {
            require(t.challenges[i] != other);
        }
        if (loc > 0) require(verifierWeight(t.challenges[loc-1], t.taskID) > verifierWeight(other, t.taskID));
        if (t.challenges.length == loc) {
            t.challenges.push(other);
        }
        else {
            require(verifierWeight(t.challenges[loc], t.taskID) < verifierWeight(other, t.taskID));
            t.challenges[loc] = other;
        }
    }

    function getChallenges(bytes32 idx) public view returns (bytes32 [] memory) {
        Ticket storage t = tickets[idx];
        return t.challenges;
    }

    event SlashedTicket(bytes32 ticket);

    function payChallengers(bytes32 idx) internal {
        Ticket storage t = tickets[idx];
        if (t.challenges.length == 0) return;
        if (t.deposit == 0) return;
        uint payout = t.deposit / t.challenges.length;
        for (uint i = 0; i < t.challenges.length; i++) {
            deposit[tickets[t.challenges[i]].owner] += payout;
        }
        t.deposit = 0;
        deposit[t.challenger] += t.challengeDeposit;
        t.challengeDeposit = 0;
        emit SlashedTicket(idx);
    }

    function checkVerifiers(bytes32 idx) internal {
        Ticket storage t = tickets[idx];
        // we may find out from challenges that this was not selected as verifier
        uint w = verifierWeight(idx, t.taskID);
        uint better_verifiers = 0;
        for (uint i = 0; i < t.challenges.length; i++) {
            if (verifierWeight(t.challenges[i], t.taskID) > w) better_verifiers++;
        }
        if (better_verifiers >= NUM_VERIFIERS) {
            payChallengers(idx);
        }
    }

    function checkSolvers(bytes32 idx) internal {
        Ticket storage t = tickets[idx];
        // we may find out from challenges that this was not selected as verifier
        uint w = solverWeight(idx, t.taskID);
        uint better_solvers = 0;
        for (uint i = 0; i < t.challenges.length; i++) {
            if (solverWeight(t.challenges[i], t.taskID) > w) better_solvers++;
        }
        if (better_solvers > 0) {
            payChallengers(idx);
        }
    }

    function debugVerifiers(bytes32 idx) public returns (uint) {
        Ticket storage t = tickets[idx];
        // we may find out from challenges that this was not selected as verifier
        uint w = verifierWeight(idx, t.taskID);
        uint better_verifiers = 0;
        for (uint i = 0; i < t.challenges.length; i++) {
            if (verifierWeight(t.challenges[i], t.taskID) > w) better_verifiers++;
        }
        return better_verifiers;
    }

    function debugSolvers(bytes32 idx) public returns (uint) {
        Ticket storage t = tickets[idx];
        // we may find out from challenges that this was not selected as verifier
        uint w = solverWeight(idx, t.taskID);
        uint better_solvers = 0;
        for (uint i = 0; i < t.challenges.length; i++) {
            if (solverWeight(t.challenges[i], t.taskID) > w) better_solvers++;
        }
        return better_solvers;
    }

    event ReleasedTicket(bytes32 ticket);

    // running the task was succesful
    function releaseTicket(bytes32 idx) public {
        Ticket storage t = tickets[idx];
        require(t.taskID != 0, "Ticket was not used");
        require(tb.isFinalized(t.taskID), "Task was not finalized");
        // we may find out from challenges that this was not selected as verifier
        checkVerifiers(idx);
        checkSolvers(idx);
        deposit[t.owner] += t.deposit + t.challengeDeposit;
        delete tickets[idx];
        emit ReleasedTicket(idx);
    }

    function failedTicket(bytes32 idx) public {
        Ticket storage t = tickets[idx];
        require(tb.isFailed(t.taskID));
        // we may find out from challenges that this was not selected as verifier
        checkVerifiers(idx);
        payChallengers(idx);
        delete tickets[idx];
        emit ReleasedTicket(idx);
    }

}

