
const toTaskInfo = require('./util/toTaskInfo')
// const toSolutionInfo = require('./util/toSolutionInfo')
const midpoint = require('./util/midpoint')
const toIndices = require('./util/toIndices')
const assert = require('assert')
const recovery = require('./recovery')

const fsHelpers = require('./fsHelpers_new')

const contractsConfig = require('./util/contractsConfig')
const bigInt = require("big-integer")

function contract(web3, info) {
    return new web3.eth.Contract(info.abi, info.address)    
}

async function setup(web3) {
    const config = await contractsConfig(web3)
    incentiveLayer = contract(web3, config['ss_incentiveLayer'])
    fileSystem = contract(web3, config['fileSystem'])
    disputeResolutionLayer = contract(web3, config['interactive'])
    wl = contract(web3, config['stake_whitelist'])

    return [incentiveLayer, fileSystem, disputeResolutionLayer, wl]
}

async function getTickets(wl, from) {

    let evs = await wl.getPastEvents('NewTicket', {fromBlock:from})

    let lst = []

    for(let t of evs) {
        let valid = await wl.methods.validTicket(t.returnValues.ticket).call()
        if (valid) lst.push(t.returnValues)
    }

    return lst
}

async function selectCandidates(wl, tickets, task) {

    let lst = []

    for(let t of tickets) {
        let w = await wl.methods.verifierWeight(t.ticket, task).call()
        lst.push({ticket:t, weight:bigInt(w)})
    }

    let sorted = lst.sort((b,a) => a.weight.compare(b.weight))

    return sorted

}

async function selectSolver(wl, taskbook, tickets, task, solution) {

    let lst = []

    let bn = await taskbook.methods.getBlock(task).call()

    for(let t of tickets) {
        let w = await wl.methods.getSolverWeight(t.ticket, task, solution, bn).call()
        lst.push({ticket:t, weight:bigInt(w)})
    }

    let sorted = lst.sort((b,a) => a.weight.compare(b.weight))

    return sorted

}

async function findSolver(wl, taskbook, startBlock, task, solution) {
    let tickets = await getTickets(wl, startBlock)

    let lst = await selectCandidates(wl, tickets, task)
    let selected = lst.slice(0, 2).map(a => a.ticket)
    let lst2 = await selectSolver(wl, taskbook, selected, task, solution)
    return lst2[0].ticket
}

async function checkSolver(wl, taskbook, task, solution, tickets) {
    let lst = await selectCandidates(wl, tickets, task)
    let selected = lst.slice(0, 2).map(a => a.ticket)
    let lst2 = await selectSolver(wl, taskbook, selected, task, solution)
    return lst2[0].ticket
}

module.exports = {
    init: async (os, account, test = false, recover = -1) => {

        let { web3, logger } = os
        let mcFileSystem = os.fileSystem
        account = account.toLowerCase()

        let tasks = {}
        let games = {}
        let task_list = []

        const merkleComputer = require("./merkle-computer")(logger, './../wasm-client/ocaml-offchain/interpreter/wasm')

        let bn = await web3.eth.getBlockNumber()

        logger.log({
            level: 'info',
            message: `Solver initialized at block ${bn}`
        })

        let [incentiveLayer, fileSystem, disputeResolutionLayer, wl] = await setup(web3)

        // For testing, setup the contracts
        // console.log("addresses", incentiveLayer.options.address, wl.options.address)
        wl.methods.setTaskBook(incentiveLayer.options.address).send({from:account})
        incentiveLayer.methods.setWhitelist(wl.options.address).send({from:account})

        let taskbook = incentiveLayer

        const config = await contractsConfig(web3)
        const WAIT_TIME = config.WAIT_TIME || 0

        let recovery_mode = recover > 0
        let events = []

        const clean_list = []
        const game_list = []
        const RECOVERY_BLOCKS = recover

        if (recovery_mode) logger.info(`Recovering back to ${Math.max(0, bn - RECOVERY_BLOCKS)}`)

        let event_handlers = []

        let lastBlock = bn

        let handled = {}

        async function pollEvents() {
            let bn = await web3.eth.getBlockNumber()
            if (bn == lastBlock) return

            event_handlers.forEach(async function (h) {
                let lst = await h.contract.getPastEvents(h.name, {fromBlock: lastBlock-5})
                lst.forEach(async ev => {
                    if (handled[ev.id]) return
                    handled[ev.id] = true
                    try {
                        await h.handler(ev.returnValues)
                    }
                    catch (e) {
                        logger.error(`While handling ${h.name}`)
                        console.log(e)
                    }
                })
            })

            let l1 = await wl.getPastEvents()
        }

        setInterval(pollEvents, 1000)

        function addEvent(name, contract, handler) {
            if (!contract.events[name]) {
                logger.error(`SOLVER: ${name} event is undefined when given to addEvent`)
            } else {
                event_handlers.push({handler:handler, name:name, contract:contract})
                /*
                // let ev = recovery_mode ? evC({}, { fromBlock: Math.max(0, bn - RECOVERY_BLOCKS) }) : evC()
                // recovery mode using past events
                clean_list.push(ev)
                ev(async (err, result) => {
                    if (result) {
                        try {
                            await handler(result.returnValues)
                        }
                        catch (e) {
                            // console.log(e)
                            logger.error(`SOLVER: Error while handling ${name} event ${JSON.stringify(result)}: ${e}`)
                        }
                    }
                    else console.log(err)
                })
                */
            }
        }

        let helpers = fsHelpers.init(fileSystem, web3, mcFileSystem, logger, incentiveLayer, account, os.config)

        let initBlock = Math.max(0, await web3.eth.getBlockNumber()-1000)

        // Task was submitted to task book
        addEvent("TaskCreated", incentiveLayer, async (result) => {

            logger.log({
                level: 'info',
                message: `SOLVER: Task has been posted. Going to solve it.`
            })

            let taskID = result.taskID

            // check from the whitelist, if we are selected as candidate
            let tickets = await getTickets(wl, initBlock)

            let lst = await selectCandidates(wl, tickets, taskID)
            let selected = lst.slice(0, 2).map(a => a.ticket)

            // console.log(selected)

            if (!selected.some(a => a.owner.toLowerCase() == account)) {
                logger.info(`SOLVER: Not selected as candidate for ${taskID}`)
                return
            }

            let data = await incentiveLayer.methods.getTaskInfo(taskID).call()
            // console.log(data)
            let taskInfo = {
                giver: data[0],
                initStateHash: data[1],
                codeType: parseInt(data[2]),
                bundleId: data[3],
                uniqueNum: data[4]
            }
            if (!tasks[taskID]) tasks[taskID] = {}
            tasks[taskID].taskInfo = taskInfo
            taskInfo.taskID = taskID

            task_list.push(taskID)

            logger.log({
                level: 'info',
                message: `SOLVER: Solving task ${taskID}`
            })

            let vm = await helpers.setupVMWithFS(taskInfo)

            assert(vm != undefined, "vm is undefined")

            let interpreterArgs = []
            let solution = await vm.executeWasmTask(interpreterArgs)
            tasks[taskID].solution = solution

            logger.info(`SOLVER: Found solution ${solution.hash}`)

            let solver = await findSolver(wl, taskbook, initBlock, taskID, solution.hash)

            if (solver.owner.toLowerCase() != account) {
                logger.info(`SOLVER: Not selected as solver for ${taskID}`)
                return
            }

            try {
                await wl.methods.useTicket(solver.ticket, taskID).send({ from: account, gas: 1000000 })
                logger.info(`SOLVER: Used ticket ${solver.ticket}`)

                await incentiveLayer.methods.commitSolution(taskID, solution.hash).send({ from: account, gas: 1000000 })

                logger.log({
                    level: 'info',
                    message: `SOLVER: Submitted solution for task ${taskID} successfully`
                })

                tasks[taskID]["solution"] = solution
                tasks[taskID]["vm"] = vm
                tasks[taskID]["interpreterArgs"] = interpreterArgs
                tasks[taskID].ticket = solver.ticket

            } catch (e) {
                logger.info(`SOLVER: Unsuccessful submission for task ${taskID}`)
                console.log(e)
            }

        })

        addEvent("UsedTicket", wl, async (result) => {
            // A ticket was used. If we are a candidate, check the solution

            logger.log({
                level: 'info',
                message: `VERIFIER: Ticket used, checking...`
            })

            let taskID = result.taskID
            let user = result.owner
            let idx = result.ticket

            // check from the whitelist, if we are selected as candidate
            let tickets = await getTickets(wl, initBlock)
            tickets.push({ticket:idx, owner:user})

            console.log("select", tickets, taskID)

            let lst = await selectCandidates(wl, tickets, taskID)
            let selected = lst.slice(0, 2).map(a => a.ticket)

            if (!selected.some(a => a.owner.toLowerCase() == account)) {
                logger.info(`VERIFIER: Not selected as candidate for ${taskID}`)
                return
            }

            let data = await incentiveLayer.methods.getTaskInfo(taskID).call()
            // console.log(data)
            let taskInfo = {
                giver: data[0],
                initStateHash: data[1],
                codeType: parseInt(data[2]),
                bundleId: data[3],
                uniqueNum: data[4]
            }

            if (!tasks[taskID]) {
                tasks[taskID] = {}
                task_list.push(taskID)
            }
            tasks[taskID].taskInfo = taskInfo
            taskInfo.taskID = taskID


            logger.log({
                level: 'info',
                message: `VERIFIER: Solving task ${taskID}`
            })

            let vm = await helpers.setupVMWithFS(taskInfo)

            assert(vm != undefined, "vm is undefined")

            let interpreterArgs = []
            let solution = await vm.executeWasmTask(interpreterArgs)
            tasks[taskID].solution = solution

            logger.info(`VERIFIER: Found solution ${solution.hash}`)

            let solver = await checkSolver(wl, taskbook, taskID, solution.hash, tickets)

            if (!solver) {
                logger.error(`VERIFIER: Cannot determine solver`)
                return
            }

            if (solver.owner.toLowerCase() == user.toLowerCase()) {
                logger.info(`VERIFIER: Solver was correct`)
                return
            }

            // Need to add all candidates as challengers
        
            let i = 0
            for (let t of selected) {
                await wl.methods.addChallenge(idx, t.ticket, i).send({from:account, gas:1000000})
                i++
            }
        })

        // My ticket was challenged
        addEvent("TicketChallenged", wl, async result => {

            let idx = result.idx
            let user = result.owner
            let taskID = result.task

            if (account != result.owner.toLowerCase()) return

            let tickets = await getTickets(wl, initBlock)
            tickets.push({ticket:idx, owner:user})

            // Need to add all candidates as challengers
            let lst = await selectCandidates(wl, tickets, taskID)
            let selected = lst.slice(0, 2).map(a => a.ticket)
        
            let i = 0
            for (let t of selected) {
                await wl.methods.addChallenge(idx, t.ticket, i).send({from:account, gas:1000000})
                i++
            }
        })

        // Solution committed event
        addEvent("SolutionsCommitted", incentiveLayer, async result => {

            logger.log({
                level: 'info',
                message: `VERIFIER: Solution has been posted`
            })

            let taskID = result.taskID
            let solverHash0 = result.solutionHash
            let data = await incentiveLayer.methods.getTaskInfo(taskID).call()
            // console.log(data)
            let taskInfo = {
                giver: data[0],
                initStateHash: data[1],
                codeType: parseInt(data[2]),
                bundleId: data[3],
                uniqueNum: data[4]
            }
            taskInfo.taskID = taskID

            logger.info("VERIFIER: Setting up VM")
            let vm = await helpers.setupVMWithFS(taskInfo)

            logger.info("VERIFIER: Executing task")
            let interpreterArgs = []
            solution = await vm.executeWasmTask(interpreterArgs)

            logger.log({
                level: 'info',
                message: `VERIFIER: Executed task ${taskID}. Checking solutions`
            })

            if (!tasks[taskID]) {
                task_list.push(taskID)
                tasks[taskID] = {}
            }

            let myHash = solution.hash
            if (test) myHash = "0x" + helpers.makeSecret(myHash)

            tasks[taskID].solverHash0 = solverHash0
            tasks[taskID].solutionHash = solution.hash
            tasks[taskID].vm = vm

            if (myHash != solverHash0) {
                await incentiveLayer.makeChallenge(taskID, { from: account, gas: 350000, value: web3.utils.toWei("0.1", "ether") })

                logger.log({
                    level: 'info',
                    message: `VERIFIER: Challenged solution for task ${taskID}`
                })
            }


        })

        addEvent("EndRevealPeriod", incentiveLayer, async (result) => {
            let taskID = result.taskID

            if (tasks[taskID]) {
                let vm = tasks[taskID].solution.vm
                await incentiveLayer.methods.revealSolution(taskID, vm.code, vm.input_size, vm.input_name, vm.input_data).send({ from: account, gas: 1000000 })
                await helpers.uploadOutputs(taskID, tasks[taskID].vm)

                logger.log({
                    level: 'info',
                    message: `SOLVER: Revealed solution for task: ${taskID}. Outputs have been uploaded.`
                })
            }

        })

        addEvent("TaskFinalized", incentiveLayer, async (result) => {
            let taskID = result.taskID

            if (tasks[taskID]) {
                let task = tasks[taskID]
                logger.info(`SOLVER: Task ${taskID} finalized, releasing ticket ${task.ticket}.`)
                await wl.methods.releaseTicket(task.ticket).send({ from: account, gas: 1000000 })
                delete tasks[taskID]
            }

        })

        addEvent("SlashedDeposit", incentiveLayer, async (result) => {
            let addr = result.account

            if (account.toLowerCase() == addr.toLowerCase()) {
                logger.info("SOLVER: Oops, I was slashed, hopefully this was a test")
            }

        })

        // DISPUTE

        addEvent("StartChallenge", disputeResolutionLayer, async (result) => {
            let solver = result.p
            let gameID = result.gameID

            if (solver.toLowerCase() == account.toLowerCase()) {

                game_list.push(gameID)

                let taskID = await disputeResolutionLayer.methods.getTask(gameID).call()

                logger.log({
                    level: 'info',
                    message: `SOLVER: Solution to task ${taskID} has been challenged`
                })

                //Initialize verification game
                let vm = tasks[taskID].vm

                // let solution = tasks[taskID].solution

                let initWasm = await vm.initializeWasmTask(tasks[taskID].interpreterArgs)
                let solution = await vm.getOutputVM(tasks[taskID].interpreterArgs)

                let lowStep = 0
                let highStep = solution.steps + 1

                games[gameID] = {
                    lowStep: lowStep,
                    highStep: highStep,
                    taskID: taskID
                }

                await disputeResolutionLayer.methods.initialize(
                    gameID,
                    merkleComputer.getRoots(initWasm.vm),
                    merkleComputer.getPointers(initWasm.vm),
                    solution.steps + 1,
                    merkleComputer.getRoots(solution.vm),
                    merkleComputer.getPointers(solution.vm)).send({from: account,gas: 1000000})

                logger.log({
                    level: 'info',
                    message: `SOLVER: Game ${gameID} has been initialized`
                })

                let indices = toIndices(await disputeResolutionLayer.methods.getIndices(gameID).call())

                //Post response to implied midpoint query
                let stepNumber = midpoint(indices.low, indices.high)

                let stateHash = await tasks[taskID].vm.getLocation(stepNumber, tasks[taskID].interpreterArgs)

                await disputeResolutionLayer.methods.report(gameID, indices.low, indices.high, [stateHash]).send({ from: account })

                logger.log({
                    level: 'info',
                    message: `SOLVER: Reported state hash for step: ${stepNumber} game: ${gameID} low: ${indices.low} high: ${indices.high}`
                })

            }

            let challenger = result.c

            if (challenger.toLowerCase() == account.toLowerCase()) {
                let gameID = result.gameID

                game_list.push(gameID)

                let taskID = await disputeResolutionLayer.methods.getTask(gameID).call()

                games[gameID] = {
                    prover: result.prover,
                    taskID: taskID
                }
            }
        })

        addEvent("Queried", disputeResolutionLayer, async (result) => {
            let gameID = result.gameID
            let lowStep = parseInt(result.idx1)
            let highStep = parseInt(result.idx2)

            if (games[gameID]) {

                let taskID = games[gameID].taskID

                logger.log({
                    level: 'info',
                    message: `SOLVER: Received query Task: ${taskID} Game: ${gameID}`
                })

                if (lowStep + 1 != highStep) {
                    let stepNumber = midpoint(lowStep, highStep)

                    let stateHash = await tasks[taskID].vm.getLocation(stepNumber, tasks[taskID].interpreterArgs)

                    await disputeResolutionLayer.methods.report(gameID, lowStep, highStep, [stateHash]).send({ from: account })

                    logger.info(`SOLVER: Reported state for step ${stepNumber}`)

                } else {
                    //Final step -> post phases

                    // let lowStepState = await disputeResolutionLayer.getStateAt.call(gameID, lowStep)
                    // let highStepState = await disputeResolutionLayer.getStateAt.call(gameID, highStep)

                    let states = (await tasks[taskID].vm.getStep(lowStep, tasks[taskID].interpreterArgs)).states

                    await disputeResolutionLayer.methods.postPhases(
                        gameID,
                        lowStep,
                        states).send({from: account,gas: 400000})

                    logger.log({
                        level: 'info',
                        message: `SOLVER: Phases have been posted for game ${gameID}`
                    })

                }

            }
        })

        addEvent("SelectedPhase", disputeResolutionLayer, async (result) => {
            let gameID = result.gameID
            if (games[gameID]) {
                let taskID = games[gameID].taskID

                let lowStep = parseInt(result.idx1)
                let phase = parseInt(result.phase)

                logger.log({
                    level: 'info',
                    message: `SOLVER: Phase ${phase} for game ${gameID}`
                })


                let stepResults = await tasks[taskID].vm.getStep(lowStep, tasks[taskID].interpreterArgs)

                let phaseStep = merkleComputer.phaseTable[phase]

                let proof = stepResults[phaseStep]

                let merkle = proof.location || []

                let merkle2 = []

                if (proof.merkle) {
                    merkle = proof.merkle.list || proof.merkle.list1 || []
                    merkle2 = proof.merkle.list2 || []
                }

                let m = proof.machine || { reg1: 0, reg2: 0, reg3: 0, ireg: 0, vm: "0x00", op: "0x00" }
                let vm
                if (typeof proof.vm != "object") {
                    vm = {
                        code: "0x00",
                        stack: "0x00",
                        call_stack: "0x00",
                        calltable: "0x00",
                        globals: "0x00",
                        memory: "0x00",
                        calltypes: "0x00",
                        input_size: "0x00",
                        input_name: "0x00",
                        input_data: "0x00",
                        pc: 0,
                        stack_ptr: 0,
                        call_ptr: 0,
                        memsize: 0
                    }
                } else { vm = proof.vm }

                if (phase == 6 && parseInt(m.op.substr(-12, 2), 16) == 16) {
                    disputeResolutionLayer.callCustomJudge(
                        gameID,
                        lowStep,
                        m.op,
                        [m.reg1, m.reg2, m.reg3, m.ireg],
                        proof.merkle.result_state,
                        proof.merkle.result_size,
                        proof.merkle.list,
                        merkleComputer.getRoots(vm),
                        merkleComputer.getPointers(vm),
                        { from: account, gas: 500000 }
                    )

                    //TODO
                    //merkleComputer.getLeaf(proof.merkle.list, proof.merkle.location)
                    //merkleComputer.storeHash(hash, proof.merkle.data)
                } else {
                    await disputeResolutionLayer.methods.callJudge(
                        gameID,
                        lowStep,
                        phase,
                        merkle,
                        merkle2,
                        m.vm,
                        m.op,
                        [m.reg1, m.reg2, m.reg3, m.ireg],
                        merkleComputer.getRoots(vm),
                        merkleComputer.getPointers(vm)).send({ from: account, gas: 5000000 }
                    )
                }

                logger.log({
                    level: 'info',
                    message: `SOLVER: Judge called for game ${gameID}`
                })

            }
        })

        addEvent("Reported", disputeResolutionLayer, async result => {
            let gameID = result.gameID

            if (games[gameID]) {

                let lowStep = parseInt(result.idx1)
                let highStep = parseInt(result.idx2)
                let taskID = games[gameID].taskID

                logger.log({
                    level: 'info',
                    message: `VERIFIER: Report received game: ${gameID} low: ${lowStep} high: ${highStep}`
                })

                let stepNumber = midpoint(lowStep, highStep)

                let reportedStateHash = await disputeResolutionLayer.getStateAt.call(gameID, stepNumber)

                let stateHash = await tasks[taskID].vm.getLocation(stepNumber, tasks[taskID].interpreterArgs)

                let num = reportedStateHash == stateHash ? 1 : 0

                await disputeResolutionLayer.query(
                    gameID,
                    lowStep,
                    highStep,
                    num,
                    { from: account }
                )

            }
        })

        addEvent("PostedPhases", disputeResolutionLayer, async result => {
            let gameID = result.args.gameID

            if (games[gameID]) {

                logger.log({
                    level: 'info',
                    message: `VERIFIER: Phases posted for game: ${gameID}`
                })

                let lowStep = result.args.idx1
                let phases = result.args.arr

                let taskID = games[gameID].taskID

                if (test) {
                    await disputeResolutionLayer.selectPhase(gameID, lowStep, phases[3], 3, { from: account })
                } else {

                    let states = (await tasks[taskID].vm.getStep(lowStep, tasks[taskID].interpreterArgs)).states

                    for (let i = 0; i < phases.length; i++) {
                        if (states[i] != phases[i]) {
                            await disputeResolutionLayer.selectPhase(
                                gameID,
                                lowStep,
                                phases[i],
                                i,
                                { from: account }
                            )
                            return
                        }
                    }
                }

            }
        })

        addEvent("WinnerSelected", disputeResolutionLayer, async (result) => {})

        // Timeouts

        let busy_table = {}
        function busy(id) {
            let res = busy_table[id] && Date.now() < busy_table[id]
            return res
        }

        function working(id) {
            busy_table[id] = Date.now() + WAIT_TIME
        }

        async function handleGameTimeouts(gameID) {
            if (busy(gameID)) return
            if (await disputeResolutionLayer.methods.gameOver(gameID).call()) {

                working(gameID)
                await disputeResolutionLayer.methods.gameOver(gameID).send({ from: account })

                logger.log({
                    level: 'info',
                    message: `SOLVER: gameOver was called for game ${gameID}`
                })


            }
        }

        async function handleTimeouts(taskID) {
            // console.log("Handling task", taskID)

            if (busy(taskID)) {
                logger.info("SOLVER: Task busy")
                return
            }

            let endReveal = await incentiveLayer.methods.endChallengePeriod(taskID).call()

            if (endReveal) {

                working(taskID)
                await incentiveLayer.methods.endChallengePeriod(taskID).send({ from: account, gas: 100000 })

                logger.log({
                    level: 'info',
                    message: `SOLVER: Ended challenge period for ${taskID}`
                })

            }

            if (await incentiveLayer.methods.canRunVerificationGame(taskID).call()) {

                working(taskID)
                await incentiveLayer.methods.runVerificationGame(taskID).send( { from: account, gas: 1000000 })

                logger.log({
                    level: 'info',
                    message: `SOLVER: Ran verification game for ${taskID}`
                })

            }

            if (await incentiveLayer.methods.canFinalizeTask(taskID).call()) {

                // console.log("Tax should be", (await incentiveLayer.getTax.call(taskID)).toString())

                working(taskID)
                await incentiveLayer.methods.finalizeTask(taskID).send({ from: account, gas: 1000000 })

                logger.log({
                    level: 'info',
                    message: `SOLVER: Finalized task ${taskID}`
                })

            }
        }

        async function recoverTask(taskID) {
            let taskInfo = toTaskInfo(await incentiveLayer.getTaskInfo.call(taskID))
            if (!tasks[taskID]) tasks[taskID] = {}
            tasks[taskID].taskInfo = taskInfo
            taskInfo.taskID = taskID

            logger.log({
                level: 'info',
                message: `SOLVER RECOVERY: Solving task ${taskID}`
            })

            let vm = await helpers.setupVMWithFS(taskInfo)

            assert(vm != undefined, "vm is undefined")

            let interpreterArgs = []
            let solution = await vm.executeWasmTask(interpreterArgs)
            tasks[taskID].solution = solution
            tasks[taskID].vm = vm
        }

        async function recoverGame(gameID) {
            let taskID = await disputeResolutionLayer.getTask.call(gameID)

            if (!tasks[taskID]) logger.error(`SOLVER FAILURE: haven't recovered task ${taskID} for game ${gameID}`)

            logger.log({
                level: 'info',
                message: `SOLVER RECOVERY: Solution to task ${taskID} has been challenged`
            })

            //Initialize verification game
            let solution = tasks[taskID].solution

            let lowStep = 0
            let highStep = solution.steps + 1

            games[gameID] = {
                lowStep: lowStep,
                highStep: highStep,
                taskID: taskID
            }
        }

        let ival = setInterval(async () => {
            // console.log("deposits", (await tru.balanceOf.call(incentiveLayer.address)).toString())
            task_list.forEach(async t => {
                try {
                    await handleTimeouts(t)
                }
                catch (e) {
                    // console.log(e)
                    logger.error(`SOLVER: Error while handling timeouts of task ${t}: ${e.toString()}`)
                }
            })
            game_list.forEach(async g => {
                try {
                    await handleGameTimeouts(g)
                }
                catch (e) {
                    // console.log(e)
                    logger.error(`SOLVER: Error while handling timeouts of game ${g}: ${e.toString()}`)
                }
            })
            if (recovery_mode) {
                recovery_mode = false
                recovery.analyze(account, events, recoverTask, recoverGame, disputeResolutionLayer, incentiveLayer, game_list, task_list)
            }
        }, 2000)

        return () => {
            try {
                let empty = data => { }
                clean_list.forEach(ev => ev.stopWatching(empty))
                clearInterval(ival)
            } catch (e) {
                console.log("SOLVER: Error when stopped watching events")
            }
        }
    }
}
