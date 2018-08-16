pragma solidity ^0.4.16;

interface JudgeInterface {
    function judge(bytes32[13] res, uint q,
                        bytes32[] _proof, bytes32[] _proof2,
                        bytes32 vm_, bytes32 op, uint[4] regs,
                        bytes32[10] roots, uint[4] pointers) external returns (uint);
    function judgeCustom(bytes32 state1, bytes32 state2, bytes32 ex_state, uint ex_reg, bytes32 op, uint[4] regs, bytes32[10] roots, uint[4] pointers, bytes32[] proof) external;

    function checkFileProof(bytes32 state, bytes32[10] roots, uint[4] pointers, bytes32[] proof, uint loc) external returns (bool);
    function checkProof(bytes32 hash, bytes32 root, bytes32[] proof, uint loc) external returns (bool);

    function calcStateHash(bytes32[10] roots, uint[4] pointers) external returns (bytes32);
    function calcIOHash(bytes32[10] roots) external returns (bytes32);
}

interface CustomJudge {
    // Initializes a new custom verification game
    function init(bytes32 state, uint state_size, uint r3, address solver, address verifier) external returns (bytes32);

    // Last time the task was updated
    function clock(bytes32 id) external returns (uint);

    // Check if has resolved into correct state: merkle root of output data and output size
    function resolved(bytes32 id, bytes32 state, uint size) external returns (bool);
}

import "./../interface/IGameMaker.sol";
import "./../interface/IDisputeResolutionLayer.sol";

contract Interactive is IGameMaker, IDisputeResolutionLayer {

    enum Status { Uninitialized, Challenged, Unresolved, SolverWon, ChallengerWon }

    constructor(address addr) public {
        judge = JudgeInterface(addr);
    }

    JudgeInterface judge;

    mapping (uint => uint) blocked;
    mapping (uint => bool) rejected;

    enum State {
        Started,
        Running, // First and last state have been set up ... but this will mean that the verification game is running now
        Finished, // Winner has been chosen
        NeedPhases,
        PostedPhases,
        SelectedPhase,
        
        // Special states for custom judges
        Custom
    }

    struct Game {
        uint256 task_id;
    
        address prover;
        address challenger;
        
        bytes32 start_state; // actually initial code + input
        bytes32 end_state; // actually output
        
        // Maybe number of steps should be finished
        uint256 steps;
        
        address winner;
        address next;
        
        uint256 size;
        uint256 timeout;
        uint256 clock;
        
        uint256 idx1;
        uint256 idx2;
        
        uint256 phase;
        
        bytes32[] proof;
        bytes32[13] result;
        
        State state;
	Status status;
        
        // 
        CustomJudge judge;
        bytes32 sub_task;
        bytes32 ex_state; // result from the custom judge
        uint ex_size;
    }

    mapping (bytes32 => Game) games;
    mapping (uint64 => CustomJudge) judges;

    // who should be able to 
    function registerJudge(uint64 id, address addr) public {
        judges[id] = CustomJudge(addr);
    }

    event StartChallenge(address p, address c, bytes32 s, bytes32 e, uint256 par, uint to, bytes32 uniq);

    function make(uint taskID, address solver, address verifier, bytes32 startStateHash, bytes32 endStateHash, uint256 size, uint timeout) external returns (bytes32) {
        bytes32 gameID = keccak256(abi.encodePacked(taskID, solver, verifier, startStateHash, endStateHash, size, timeout));
        Game storage g = games[gameID];
        g.task_id = taskID;
        g.prover = solver;
        g.challenger = verifier;
        g.start_state = startStateHash;
        g.end_state = endStateHash;
        g.timeout = timeout;
        g.clock = block.number;
        g.next = g.prover;
        g.idx1 = 0;
        g.phase = 16;
        g.size = size;
        g.state = State.Started;
	g.status = Status.Challenged;	
        emit StartChallenge(solver, verifier, startStateHash, endStateHash, g.size, timeout, gameID);
        blocked[taskID] = g.clock + g.timeout;
        return gameID;
    }

    function status(bytes32 gameID) external view returns(uint8) {
	return uint8(games[gameID].status);
    }
    
    uint constant FINAL_STATE = 0xffffffffff;
    
    struct Roots {
        bytes32 code;
        bytes32 stack;
        bytes32 mem;
        bytes32 globals;
        bytes32 calltable;
        bytes32 calltypes;
        bytes32 call_stack;
        bytes32 input_size;
        bytes32 input_name;
        bytes32 input_data;
    }

    struct VM {
        uint pc;
        uint stack_ptr;
        uint call_ptr;
        uint memsize;
    }
    
    VM vm;
    Roots vm_r;

    function ccStateHash(bytes32[10] roots, uint[4] pointers) public returns (bytes32) {
        vm_r.code = roots[0];
        vm_r.stack = roots[1];
        vm_r.mem = roots[2];
        vm_r.call_stack = roots[3];
        vm_r.globals = roots[4];
        vm_r.calltable = roots[5];
        vm_r.calltypes = roots[6];
        vm_r.input_size = roots[7];
        vm_r.input_name = roots[8];
        vm_r.input_data = roots[9];

        vm.pc = pointers[0];
        vm.stack_ptr = pointers[1];
        vm.call_ptr = pointers[2];
        vm.memsize = pointers[3];
        bytes32[] memory arr = new bytes32[](14);
        arr[0] = vm_r.code;
        arr[1] = vm_r.mem;
        arr[2] = vm_r.stack;
        arr[3] = vm_r.globals;
        arr[4] = vm_r.call_stack;
        arr[5] = vm_r.calltable;
        arr[6] = vm_r.calltypes;
        arr[7] = vm_r.input_size;
        arr[8] = vm_r.input_name;
        arr[9] = vm_r.input_data;
        
        arr[0] = roots[0];
        arr[1] = roots[2];
        arr[2] = roots[1];
        
        arr[3] = roots[4];
        arr[4] = roots[3];
        
        arr[5] = roots[5];
        arr[6] = roots[6];
        arr[7] = roots[7];
        arr[8] = roots[8];
        arr[9] = roots[9];
        
        arr[10] = bytes32(vm.pc);
        arr[11] = bytes32(vm.stack_ptr);
        arr[12] = bytes32(vm.call_ptr);
        arr[13] = bytes32(vm.memsize);
        return keccak256(abi.encodePacked(arr));
    }
    
    function initialize(bytes32 gameID, bytes32[10] s_roots, uint[4] s_pointers, uint _steps, bytes32[10] e_roots, uint[4] e_pointers) public returns (bytes32[10], uint[4], bytes32, bytes32) {
        Game storage g = games[gameID];
        require(msg.sender == g.next && g.state == State.Started);
        // check first state here
        require (g.start_state == judge.calcIOHash(s_roots));
	
        // then last one
        require (g.end_state == judge.calcIOHash(e_roots));
        
        // need to check that the start state is empty
        // stack
        require(s_roots[1] == 0xb4c11951957c6f8f642c4af61cd6b24640fec6dc7fc607ee8206a99e92410d30);
        // memory
        require(s_roots[2] == 0xb4c11951957c6f8f642c4af61cd6b24640fec6dc7fc607ee8206a99e92410d30);
        // call stack
        require(s_roots[3] == 0xb4c11951957c6f8f642c4af61cd6b24640fec6dc7fc607ee8206a99e92410d30);
        // globals
        require(s_roots[4] == 0xb4c11951957c6f8f642c4af61cd6b24640fec6dc7fc607ee8206a99e92410d30);
        // call table (check if resizing works)
        require(s_roots[5] == 0x7bf9aa8e0ce11d87877e8b7a304e8e7105531771dbff77d1b00366ecb1549624);
        //require(s_roots[5] == 0xc024f071f70ef04cc1aaa7cb371bd1c4f7df06b0edb57b81adbcc9cdb1dfc910);
        // call types
        require(s_roots[6] == 0xb4c11951957c6f8f642c4af61cd6b24640fec6dc7fc607ee8206a99e92410d30);
        // pointers
        require(s_pointers[0] == 0 && s_pointers[1] == 0 && s_pointers[2] == 0 && s_pointers[3] == 0);
        
        // check final state
        require(e_pointers[0] == FINAL_STATE);

        // Now we can initialize
        g.steps = _steps;
        if (g.size > g.steps - 2) g.size = g.steps-2;
        g.idx2 = g.steps-1;
        g.proof.length = g.steps;
        g.proof[g.steps-1] = judge.calcStateHash(e_roots, e_pointers);
        g.proof[0] = judge.calcStateHash(s_roots, s_pointers);
        g.state = State.Running;
	g.status = Status.Unresolved;
        // return true;
        return (e_roots, e_pointers, keccak256(abi.encodePacked(e_roots, e_pointers)), ccStateHash(e_roots, e_pointers));
    }
    
    function getDescription(bytes32 gameID) public view returns (bytes32 init, uint steps, bytes32 last) {
        Game storage g = games[gameID];
        return (g.proof[0], g.steps, g.proof[g.steps-1]);
    }
    
    function getChallenger(bytes32 gameID) public view returns (address) {
       return games[gameID].challenger;
    }
    
    function getProver(bytes32 gameID) public view returns (address) {
       return games[gameID].prover;
    }
    
    function getIndices(bytes32 gameID) public view returns (uint idx1, uint idx2) {
        Game storage g = games[gameID];
        return (g.idx1, g.idx2);
    }
    
    function getTask(bytes32 gameID) public view returns (uint) {
        Game storage g = games[gameID];
        return g.task_id;
    }
    
    function deleteChallenge(bytes32 gameID) public {
       delete games[gameID];
    }

    function checkTimeout(bytes32 gameID) internal returns (bool) {
        Game storage g = games[gameID];
        if (g.state == State.Custom) return block.number >= g.judge.clock(g.sub_task) + g.timeout;
        return block.number >= g.clock + g.timeout && g.state != State.Finished;
   }

    function gameOver(bytes32 gameID) public returns (bool) {
        Game storage g = games[gameID];
        if (!checkTimeout(gameID)) return false;
        require(checkTimeout(gameID));
        if (g.next == g.prover) {
            g.winner = g.challenger;
	    g.status = Status.ChallengerWon;
            rejected[g.task_id] = true;
        }
        else {
            g.winner = g.prover;
	    g.status = Status.SolverWon;
            blocked[g.task_id] = 0;
        }
        emit WinnerSelected(gameID);
        g.state = State.Finished;
        return true;
    }
    
    function clock(bytes32 gameID) public returns (uint) {
        Game storage g = games[gameID];
        if (g.sub_task != 0) return g.judge.clock(g.sub_task);
        else return g.clock;
    }
    
    function isRejected(uint gameID) public view returns (bool) {
        return rejected[gameID];
    }
    
    function blockedTime(uint gameID) public view returns (uint) {
        return blocked[gameID] + 5;
    }

    function getIter(bytes32 gameID) internal view returns (uint it, uint i1, uint i2) {
        Game storage g = games[gameID];
        it = (g.idx2-g.idx1)/(g.size+1);
        i1 = g.idx1;
        i2 = g.idx2;
    }

    event Reported(bytes32 id, uint idx1, uint idx2, bytes32[] arr);

    function report(bytes32 gameID, uint i1, uint i2, bytes32[] arr) public returns (bool) {
        Game storage g = games[gameID];
        require(g.state == State.Running && arr.length == g.size && i1 == g.idx1 && i2 == g.idx2 && msg.sender == g.prover && g.prover == g.next);
        g.clock = block.number;
        blocked[g.task_id] = g.clock + g.timeout;
        uint iter = (g.idx2-g.idx1)/(g.size+1);
        for (uint i = 0; i < arr.length; i++) {
            g.proof[g.idx1+iter*(i+1)] = arr[i];
        }
        g.next = g.challenger;
        emit Reported(gameID, i1, i2, arr);
        return true;
    }
    
    function getStateAt(bytes32 gameID, uint loc) public view returns (bytes32) {
        return games[gameID].proof[loc];
    }
    
    event Queried(bytes32 id, uint idx1, uint idx2);

    function query(bytes32 gameID, uint i1, uint i2, uint num) public {
        Game storage g = games[gameID];
        require(g.state == State.Running && num <= g.size && i1 == g.idx1 && i2 == g.idx2 && msg.sender == g.challenger && g.challenger == g.next);
        g.clock = block.number;
        blocked[g.task_id] = g.clock + g.timeout;
        uint iter = (g.idx2-g.idx1)/(g.size+1);
        g.idx1 = g.idx1+iter*num;
        // If last segment was selected, do not change last index
        if (num != g.size) g.idx2 = g.idx1+iter;
        if (g.size > g.idx2-g.idx1-1) g.size = g.idx2-g.idx1-1;
        // size eventually becomes zero here
        g.next = g.prover;
        emit Queried(gameID, g.idx1, g.idx2);
        if (g.size == 0) g.state = State.NeedPhases;
    }

    function getStep(bytes32 gameID, uint idx) public view returns (bytes32) {
        Game storage g = games[gameID];
        return g.proof[idx];
    }

    event PostedPhases(bytes32 id, uint idx1, bytes32[13] arr);

    function postPhases(bytes32 gameID, uint i1, bytes32[13] arr) public {
        Game storage g = games[gameID];
        require(g.state == State.NeedPhases && msg.sender == g.prover && g.next == g.prover && g.idx1 == i1);
        require(g.proof[g.idx1] == arr[0] && g.proof[g.idx1+1] == arr[12] && arr[12] != bytes32(0));
        g.clock = block.number;
        g.state = State.PostedPhases;
        blocked[g.task_id] = g.clock + g.timeout;
        g.result = arr;
        g.next = g.challenger;
        emit PostedPhases(gameID, i1, arr);
    }

    function getResult(bytes32 gameID)  public view returns (bytes32[13]) {
        return games[gameID].result;
    }
    
    event SelectedPhase(bytes32 id, uint idx1, uint phase);
    
    function selectPhase(bytes32 gameID, uint i1, bytes32 st, uint q) public {
        Game storage g = games[gameID];
        require(g.state == State.PostedPhases && msg.sender == g.challenger && g.idx1 == i1 && g.result[q] == st && g.next == g.challenger && q < 13);
        g.clock = block.number;
        blocked[g.task_id] = g.clock + g.timeout;
        g.phase = q;
        emit SelectedPhase(gameID, i1, q);
        g.next = g.prover;
        g.state = State.SelectedPhase;
    }
    
    function getState(bytes32 gameID) public view returns (State) {
        return games[gameID].state;
    }
    
    function getPhase(bytes32 gameID) public view returns (uint) {
        return games[gameID].phase;
    }
    
    function getWinner(bytes32 gameID) public view returns (address) {
        return games[gameID].winner;
    }

    event WinnerSelected(bytes32 id);

    function callJudge(bytes32 gameID, uint i1, uint q, bytes32[] proof, bytes32[] proof2, bytes32 vmHash, bytes32 op, uint[4] regs, bytes32[10] roots, uint[4] pointers) public {
        Game storage g = games[gameID];
        require(g.state == State.SelectedPhase && g.phase == q && msg.sender == g.prover && g.idx1 == i1 && g.next == g.prover);
        // for custom judge, use another method
        // uint alu_hint = (uint(op)/2**(8*3))&0xff; require (q != 5 || alu_hint != 0xff);
        
        judge.judge(g.result, g.phase, proof, proof2, vmHash, op, regs, roots, pointers);
        emit WinnerSelected(gameID);
        g.winner = g.prover;
        blocked[g.task_id] = 0;
        g.state = State.Finished;
    }

    event SubGoal(bytes32 id, uint64 judge, bytes32 init_data, uint init_size, bytes32 ret_data, uint ret_size);

    function resolveCustom(bytes32 gameID) public returns (bool) {
        Game storage g = games[gameID];
        if (g.sub_task == 0 || !g.judge.resolved(g.sub_task, g.ex_state, g.ex_size)) return false;
        emit WinnerSelected(gameID);
        g.winner = g.prover;
        blocked[g.task_id] = 0;
        g.state = State.Finished;
        return true;
    }

    // some register should have the input size?
    function callCustomJudge(bytes32 gameID, uint i1, bytes32 op, uint[4] regs, bytes32 custom_result, uint custom_size, bytes32[] custom_proof, bytes32[10] roots, uint[4] pointers) public {
                        
        Game storage g = games[gameID];
        require(g.state == State.SelectedPhase && g.phase == 6 && msg.sender == g.prover && g.idx1 == i1 && g.next == g.prover);

        uint hint = (uint(op)/2**(8*5))&0xff;
        require (hint == 0x16);

        g.judge = judges[uint64(regs[3])];

        // uint256 init_size = regs[0] % 2 == 0 ? uint(custom_size_proof[0]) : uint(custom_size_proof[1]);
        bytes32 init_data = regs[0] % 2 == 0 ? custom_proof[0] : custom_proof[1];

        g.sub_task = g.judge.init(init_data, regs[1], regs[2], g.prover, g.challenger);
        g.ex_state = custom_result;
        g.ex_size = custom_size;
        judge.judgeCustom(g.result[5], g.result[6], custom_result, custom_size, op, regs, roots, pointers, custom_proof);
        g.state = State.Custom;
        
        emit SubGoal(gameID, uint64(regs[3]), init_data, regs[1], custom_result, custom_size);        
    }

    function checkFileProof(bytes32 state, bytes32[10] roots, uint[4] pointers, bytes32[] proof, uint loc) public returns (bool) {
        return judge.checkFileProof(state, roots, pointers, proof, loc);
    }
    
    function checkProof(bytes32 hash, bytes32 root, bytes32[] proof, uint loc) public returns (bool) {
        return judge.checkProof(hash, root, proof, loc);
    }

    function calcStateHash(bytes32[10] roots, uint[4] pointers) public returns (bytes32) {
        return judge.calcStateHash(roots, pointers);
    }
    
}
