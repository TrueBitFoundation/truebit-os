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

contract Interactive {

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

    struct Record {
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
        
        // 
        CustomJudge judge;
        bytes32 sub_task;
        bytes32 ex_state; // result from the custom judge
        uint ex_size;
    }

    mapping (bytes32 => Record) records;
    mapping (uint64 => CustomJudge) judges;

    // who should be able to 
    function registerJudge(uint64 id, address addr) public {
        judges[id] = CustomJudge(addr);
    }

    event StartChallenge(address p, address c, bytes32 s, bytes32 e, uint256 par, uint to, bytes32 uniq);

    function make(uint task_id, address p, address c, bytes32 s, bytes32 e, uint256 par, uint to) public returns (bytes32) {
        bytes32 uniq = keccak256(task_id, p, c, s, e, par, to);
        Record storage r = records[uniq];
        r.task_id = task_id;
        r.prover = p;
        r.challenger = c;
        r.start_state = s;
        r.end_state = e;
        r.timeout = to;
        r.clock = block.number;
        r.next = r.prover;
        r.idx1 = 0;
        r.phase = 16;
        r.size = par;
        r.state = State.Started;
        emit StartChallenge(p, c, s, e, r.size, to, uniq);
        blocked[task_id] = r.clock + r.timeout;
        return uniq;
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
        return keccak256(arr);
    }
    
    function initialize(bytes32 id, bytes32[10] s_roots, uint[4] s_pointers, uint _steps,
                                    bytes32[10] e_roots, uint[4] e_pointers) public returns (bytes32[10], uint[4], bytes32, bytes32) {
        Record storage r = records[id];
        require(msg.sender == r.next && r.state == State.Started);
        // check first state here
        // if (r.start_state != judge.calcIOHash(s_roots)) return false;
        require (r.start_state == judge.calcIOHash(s_roots));
        // then last one
        // if (r.end_state != judge.calcIOHash(e_roots)) return false;
        require (r.end_state == judge.calcIOHash(e_roots));
        
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
        r.steps = _steps;
        if (r.size > r.steps - 2) r.size = r.steps-2;
        r.idx2 = r.steps-1;
        r.proof.length = r.steps;
        r.proof[r.steps-1] = judge.calcStateHash(e_roots, e_pointers);
        r.proof[0] = judge.calcStateHash(s_roots, s_pointers);
        r.state = State.Running;
        // return true;
        return (e_roots, e_pointers, keccak256(e_roots, e_pointers), ccStateHash(e_roots, e_pointers));
    }
    
    function getDescription(bytes32 id) public view returns (bytes32 init, uint steps, bytes32 last) {
        Record storage r = records[id];
        return (r.proof[0], r.steps, r.proof[r.steps-1]);
    }
    
    function getChallenger(bytes32 id) public view returns (address) {
       return records[id].challenger;
    }
    
    function getProver(bytes32 id) public view returns (address) {
       return records[id].prover;
    }
    
    function getIndices(bytes32 id) public view returns (uint idx1, uint idx2) {
        Record storage r = records[id];
        return (r.idx1, r.idx2);
    }
    
    function getTask(bytes32 id) public view returns (uint) {
        Record storage r = records[id];
        return r.task_id;
    }
    
    function deleteChallenge(bytes32 id) public {
       delete records[id];
    }

    function checkTimeout(bytes32 id) internal returns (bool) {
        Record storage r = records[id];
        if (r.state == State.Custom) return block.number >= r.judge.clock(r.sub_task) + r.timeout;
        return block.number >= r.clock + r.timeout && r.state != State.Finished;
   }

    function gameOver(bytes32 id) public returns (bool) {
        Record storage r = records[id];
        if (!checkTimeout(id)) return false;
        require(checkTimeout(id));
        if (r.next == r.prover) {
            r.winner = r.challenger;
            rejected[r.task_id] = true;
        }
        else {
            r.winner = r.prover;
            blocked[r.task_id] = 0;
        }
        emit WinnerSelected(id);
        r.state = State.Finished;
        return true;
    }
    
    function clock(bytes32 id) public returns (uint) {
        Record storage r = records[id];
        if (r.sub_task != 0) return r.judge.clock(r.sub_task);
        else return r.clock;
    }
    
    function isRejected(uint id) public view returns (bool) {
        return rejected[id];
    }
    
    function blockedTime(uint id) public view returns (uint) {
        return blocked[id] + 5;
    }

    function getIter(bytes32 id) internal view returns (uint it, uint i1, uint i2) {
        Record storage r = records[id];
        it = (r.idx2-r.idx1)/(r.size+1);
        i1 = r.idx1;
        i2 = r.idx2;
    }

    event Reported(bytes32 id, uint idx1, uint idx2, bytes32[] arr);

    function report(bytes32 id, uint i1, uint i2, bytes32[] arr) public returns (bool) {
        Record storage r = records[id];
        require(r.state == State.Running && arr.length == r.size && i1 == r.idx1 && i2 == r.idx2 &&
                msg.sender == r.prover && r.prover == r.next);
        r.clock = block.number;
        blocked[r.task_id] = r.clock + r.timeout;
        uint iter = (r.idx2-r.idx1)/(r.size+1);
        for (uint i = 0; i < arr.length; i++) {
            r.proof[r.idx1+iter*(i+1)] = arr[i];
        }
        r.next = r.challenger;
        emit Reported(id, i1, i2, arr);
        return true;
    }
    
    function getStateAt(bytes32 id, uint loc) public view returns (bytes32) {
        return records[id].proof[loc];
    }
    
    event Queried(bytes32 id, uint idx1, uint idx2);

    function query(bytes32 id, uint i1, uint i2, uint num) public {
        Record storage r = records[id];
        require(r.state == State.Running && num <= r.size && i1 == r.idx1 && i2 == r.idx2 && msg.sender == r.challenger && r.challenger == r.next);
        r.clock = block.number;
        blocked[r.task_id] = r.clock + r.timeout;
        uint iter = (r.idx2-r.idx1)/(r.size+1);
        r.idx1 = r.idx1+iter*num;
        // If last segment was selected, do not change last index
        if (num != r.size) r.idx2 = r.idx1+iter;
        if (r.size > r.idx2-r.idx1-1) r.size = r.idx2-r.idx1-1;
        // size eventually becomes zero here
        r.next = r.prover;
        emit Queried(id, r.idx1, r.idx2);
        if (r.size == 0) r.state = State.NeedPhases;
    }

    function getStep(bytes32 id, uint idx) public view returns (bytes32) {
        Record storage r = records[id];
        return r.proof[idx];
    }

    event PostedPhases(bytes32 id, uint idx1, bytes32[13] arr);

    function postPhases(bytes32 id, uint i1, bytes32[13] arr) public {
        Record storage r = records[id];
        require(r.state == State.NeedPhases && msg.sender == r.prover && r.next == r.prover && r.idx1 == i1);
        require(r.proof[r.idx1] == arr[0] && r.proof[r.idx1+1] == arr[12] && arr[12] != bytes32(0));
        r.clock = block.number;
        r.state = State.PostedPhases;
        blocked[r.task_id] = r.clock + r.timeout;
        r.result = arr;
        r.next = r.challenger;
        emit PostedPhases(id, i1, arr);
    }

    function getResult(bytes32 id)  public view returns (bytes32[13]) {
        return records[id].result;
    }
    
    event SelectedPhase(bytes32 id, uint idx1, uint phase);
    
    function selectPhase(bytes32 id, uint i1, bytes32 st, uint q) public {
        Record storage r = records[id];
        require(r.state == State.PostedPhases && msg.sender == r.challenger && r.idx1 == i1 && r.result[q] == st &&
                r.next == r.challenger && q < 13);
        r.clock = block.number;
        blocked[r.task_id] = r.clock + r.timeout;
        r.phase = q;
        emit SelectedPhase(id, i1, q);
        r.next = r.prover;
        r.state = State.SelectedPhase;
    }
    
    function getState(bytes32 id) public view returns (State) {
        return records[id].state;
    }
    
    function getPhase(bytes32 id) public view returns (uint) {
        return records[id].phase;
    }
    
    function getWinner(bytes32 id) public view returns (address) {
        return records[id].winner;
    }

    event WinnerSelected(bytes32 id);

    function callJudge(bytes32 id, uint i1, uint q,
                        bytes32[] proof, bytes32[] proof2,
                        bytes32 vm, bytes32 op, uint[4] regs,
                        bytes32[10] roots, uint[4] pointers) public {
        Record storage r = records[id];
        require(r.state == State.SelectedPhase && r.phase == q && msg.sender == r.prover && r.idx1 == i1 && r.next == r.prover);
        // for custom judge, use another method
        // uint alu_hint = (uint(op)/2**(8*3))&0xff; require (q != 5 || alu_hint != 0xff);
        
        judge.judge(r.result, r.phase, proof, proof2, vm, op, regs, roots, pointers);
        emit WinnerSelected(id);
        r.winner = r.prover;
        blocked[r.task_id] = 0;
        r.state = State.Finished;
    }

    event SubGoal(bytes32 id, uint64 judge, bytes32 init_data, uint init_size, bytes32 ret_data, uint ret_size);

    function resolveCustom(bytes32 id) public returns (bool) {
        Record storage r = records[id];
        if (r.sub_task == 0 || !r.judge.resolved(r.sub_task, r.ex_state, r.ex_size)) return false;
        emit WinnerSelected(id);
        r.winner = r.prover;
        blocked[r.task_id] = 0;
        r.state = State.Finished;
        return true;
    }

    // some register should have the input size?
    function callCustomJudge(bytes32 id, uint i1,
                        bytes32 op, uint[4] regs,
                        bytes32 custom_result, uint custom_size, bytes32[] custom_proof,
                        bytes32[10] roots, uint[4] pointers) public {
                        
        Record storage r = records[id];
        require(r.state == State.SelectedPhase && r.phase == 6 && msg.sender == r.prover && r.idx1 == i1 &&
                r.next == r.prover);

        uint hint = (uint(op)/2**(8*5))&0xff;
        require (hint == 0x16);

        r.judge = judges[uint64(regs[3])];

        // uint256 init_size = regs[0] % 2 == 0 ? uint(custom_size_proof[0]) : uint(custom_size_proof[1]);
        bytes32 init_data = regs[0] % 2 == 0 ? custom_proof[0] : custom_proof[1];

        r.sub_task = r.judge.init(init_data, regs[1], regs[2], r.prover, r.challenger);
        r.ex_state = custom_result;
        r.ex_size = custom_size;
        judge.judgeCustom(r.result[5], r.result[6], custom_result, custom_size, op, regs, roots, pointers, custom_proof);
        r.state = State.Custom;
        
        emit SubGoal(id, uint64(regs[3]), init_data, regs[1], custom_result, custom_size);
        
        return;
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
