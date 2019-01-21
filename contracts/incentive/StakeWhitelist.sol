pragma solidity ^0.5.0;

interface IWhitelist {
    function approved(bytes32 taskID, address solver) external returns (bool);
}

interface ITruebit {
    function isFailed(bytes32 taskID) external returns (bool);
    function isFinalized(bytes32 taskID) external returns (bool);
    function getBlock(bytes32 taskID) external returns (uint);
    function getSolution(bytes32 taskID) external returns (bytes32);
}

contract StakeWhitelist is IWhitelist {

    struct Ticket {
        address owner;
        uint price;
        uint bn;
        bytes32 taskID;
        uint deposit;
        bytes32[] challenges;
        address challenger;
        uint challengeDeposit;
    }

    mapping (bytes32 => Ticket) tickets;

    mapping (address => uint) deposit;

    uint constant NUM_VERIFIERS = 20;
    uint constant TICKET_PRICE = 1 ether;
    uint constant CHALLENGE_DEPOSIT = 1 ether;

    address owner;

    constructor () public {
        owner = msg.sender;
    }

    ITruebit tb;

    function setIncentiveLayer(address tb_addr) public {
        require(owner == msg.sender);
        tb = ITruebit(tb_addr);
    }

    function buyTicket(bytes32 idx) public {
        Ticket storage t = tickets[idx];
        require(t.owner == address(0));
        require(deposit[msg.sender] >= TICKET_PRICE);
        t.owner = msg.sender;
        t.bn = block.number;
        deposit[msg.sender] -= TICKET_PRICE;
        t.deposit = TICKET_PRICE;
    }

    mapping (bytes32 => address) selected;

    function approved(bytes32 taskID, address solver) external returns (bool) {
        return selected[taskID] == solver;
    }

    function useTicket(bytes32 idx, bytes32 taskID) public {
        Ticket storage t = tickets[idx];
        require(t.owner == msg.sender);
        require(selected[taskID] == address(0));
        t.taskID = taskID;
        selected[taskID] = msg.sender;
    }

    // Larger weight is better
    function verifierWeight(bytes32 idx, bytes32 taskID) internal returns (uint) {
        uint task_block = tb.getBlock(taskID);
        Ticket storage t = tickets[idx];
        if (t.bn > task_block) return 0;
        return uint(keccak256(abi.encodePacked(idx, taskID, blockhash(task_block))));
    } 

    // Larger weight is better
    function solverWeight(bytes32 idx, bytes32 taskID) internal returns (uint) {
        uint task_block = tb.getBlock(taskID);
        Ticket storage t = tickets[idx];
        if (t.bn > task_block) return 0;
        return uint(keccak256(abi.encodePacked(idx, tb.getSolution(taskID), blockhash(task_block))));
    }

    // here we should perhaps add a deposit so that no useless challenges will be made
    function addChallenge(bytes32 idx, bytes32 other, uint loc) public {

        Ticket storage t = tickets[idx];
        require(t.taskID != 0);

        if (msg.sender != t.owner && t.challengeDeposit == 0) {
            require(deposit[msg.sender] > CHALLENGE_DEPOSIT);
            t.challengeDeposit += CHALLENGE_DEPOSIT;
            t.challenger = msg.sender;
            deposit[msg.sender] -= CHALLENGE_DEPOSIT;
        }


        for (uint i = 0; i < t.challenges.length; i++) {
            require(t.challenges[i] != other);
        }
        if (t.challenges.length < NUM_VERIFIERS) t.challenges.push(other);
        else {
            require(verifierWeight(t.challenges[loc], t.taskID) < verifierWeight(other, t.taskID));
            t.challenges[loc] = other;
        }
    }

    function payChallengers(bytes32 idx) internal {
        Ticket storage t = tickets[idx];
        uint payout = t.deposit / t.challenges.length;
        for (uint i = 0; i < t.challenges.length; i++) {
            deposit[tickets[t.challenges[i]].owner] += payout;
        }
        t.deposit = 0;
        deposit[t.challenger] += t.challengeDeposit;
        t.challengeDeposit = 0;
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
        if (better_solvers >= 0) {
            payChallengers(idx);
        }
    }

    // running the task was succesful
    function releaseTicket(bytes32 idx) public {
        Ticket storage t = tickets[idx];
        require(tb.isFinalized(t.taskID));
        // we may find out from challenges that this was not selected as verifier
        checkVerifiers(idx);
        checkSolvers(idx);
        deposit[t.owner] += t.deposit + t.challengeDeposit;
        delete tickets[idx];
    }

    function failedTicket(bytes32 idx) public {
        Ticket storage t = tickets[idx];
        require(tb.isFailed(t.taskID));
        // we may find out from challenges that this was not selected as verifier
        checkVerifiers(idx);
        payChallengers(idx);
        delete tickets[idx];
    }

}

