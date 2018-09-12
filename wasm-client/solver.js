const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const toTaskInfo = require('./util/toTaskInfo')
const toSolutionInfo = require('./util/toSolutionInfo')
const midpoint = require('./util/midpoint')
const toIndices = require('./util/toIndices')
const waitForBlock = require('./util/waitForBlock')
const setupVM = require('./util/setupVM')
const assert = require('assert')

const fsHelpers = require('./fsHelpers')

const merkleComputer = require("./merkle-computer")('./../wasm-client/ocaml-offchain/interpreter/wasm')

const contractsConfig = JSON.parse(fs.readFileSync(__dirname + "/contracts.json"))

function setup(httpProvider) {
    return (async () => {
        incentiveLayer = await contract(httpProvider, contractsConfig['incentiveLayer'])
        fileSystem = await contract(httpProvider, contractsConfig['fileSystem'])
        tru = await contract(httpProvider, contractsConfig['tru'])
        disputeResolutionLayer = await contract(httpProvider, contractsConfig['interactive'])
        return [incentiveLayer, fileSystem, disputeResolutionLayer, tru]
    })()
}

let tasks = {}
let games = {}
let task_list = []

module.exports = {
    init: async (web3, account, logger, mcFileSystem) => {
        logger.log({
            level: 'info',
            message: `Solver initialized`
        })

        let [incentiveLayer, fileSystem, disputeResolutionLayer, tru] = await setup(web3.currentProvider)
        
        const clean_list = []
        const game_list = []
        
        function addEvent(ev, handler) {
            clean_list.push(ev)
            ev.watch(async (err, result) => {
                if (result) handler(result)
            })
        }
        
        let helpers = fsHelpers.init(fileSystem, web3, mcFileSystem, logger, incentiveLayer, account)

        addEvent(incentiveLayer.TaskCreated(), async (result) => {

	        logger.log({
                level: 'info',
                message: `Task has been posted. Checking for availability.`
            })
	    
            let taskID = result.args.taskID
            let minDeposit = result.args.minDeposit.toNumber()

            let taskInfo = toTaskInfo(await incentiveLayer.getTaskInfo.call(taskID))

            let storageType = taskInfo.codeStorage
            let storageAddress = taskInfo.storageAddress
            let initTaskHash = taskInfo.initTaskHash

            let solutionInfo = toSolutionInfo(await incentiveLayer.getSolutionInfo.call(taskID))
            
            if (solutionInfo.solver == '0x0000000000000000000000000000000000000000') {

                let secret = "0x"+helpers.makeSecret(taskID)

                await depositsHelper(web3, incentiveLayer, tru, account, minDeposit)
                
                console.log("secret", secret, web3.utils.soliditySha3(secret))
                incentiveLayer.registerForTask(taskID, web3.utils.soliditySha3(secret), {from: account, gas: 500000})
                
                tasks[taskID] = {minDeposit: minDeposit}

                // tasks[taskID].secret = secret
            }
        })

        addEvent(incentiveLayer.SolverSelected(), async (result) => {
            let taskID = result.args.taskID
            let solver = result.args.solver            

            if (account.toLowerCase() == solver.toLowerCase()) {		

                //TODO: Need to read secret from persistence or else task is lost
                let taskInfo = toTaskInfo(await incentiveLayer.getTaskInfo.call(taskID))
                if (!tasks[taskID]) tasks[taskID] = {}
                tasks[taskID].taskInfo = taskInfo
                taskInfo.taskID = taskID

                task_list.push(taskID)

                logger.log({
                    level: 'info',
                    message: `Solving task ${taskID}`
                })

                let vm = await helpers.setupVMWithFS(taskInfo)
                
                assert(vm != undefined, "vm is undefined")

                let interpreterArgs = []
                let solution = await vm.executeWasmTask(interpreterArgs)
                tasks[taskID].solution = solution

                console.log("Committing solution", solution)

                let random_hash = "0x" + helpers.makeSecret(taskID)

                try {

                    let b = parseInt(random_hash.substr(64), 16) % 2 == 0
                    console.log("secret", random_hash, random_hash.substr(64), b)
                    let s1 = b ? solution.hash : random_hash
                    let s2 = b ? random_hash : solution.hash

                    await incentiveLayer.commitSolution(taskID, s1, s2, {from: account, gas: 1000000})

                    logger.log({
                        level: 'info',
                        message: `Submitted solution for task ${taskID} successfully`
                    })

                    tasks[taskID]["solution"] = solution
                    tasks[taskID]["vm"] = vm
                    tasks[taskID]["interpreterArgs"] = interpreterArgs

                } catch(e) {
                    //TODO: Add logging unsuccessful submission attempt
                    console.log(e)
                }
            }


        })

        addEvent(incentiveLayer.EndRevealPeriod(), async (result) => {
            let taskID = result.args.taskID	   
	    
            if (tasks[taskID]) {		
                let vm = tasks[taskID].solution.vm
                let secret = "0x"+helpers.makeSecret(taskID)
                console.log("secret", secret)
                await incentiveLayer.revealSolution(taskID, secret, vm.code, vm.input_size, vm.input_name, vm.input_data, {from: account, gas: 1000000})
                await helpers.uploadOutputs(taskID, tasks[taskID].vm)
              
                logger.log({
		              level: 'info',
		              message: `Revealed solution for task: ${taskID}. Ouputs have been uploaded.`
		            })
            }
	    
        })

        addEvent(disputeResolutionLayer.StartChallenge(), async (result) => {
            let solver = result.args.p
            let gameID = result.args.uniq	   
	    
            if (solver.toLowerCase() == account.toLowerCase()) {		
                
                game_list.push(gameID)

                let taskID = await disputeResolutionLayer.getTask.call(gameID)

                logger.log({
                    level: 'info',
                    message: `Solution to task ${taskID} has been challenged`
                })

                //Initialize verification game
                let vm = tasks[taskID].vm

                let solution = tasks[taskID].solution

                let initWasm = await vm.initializeWasmTask(tasks[taskID].interpreterArgs)

                let lowStep = 0
                let highStep = solution.steps + 1

                games[gameID] = {
                    lowStep: lowStep,
                    highStep: highStep,
                    taskID: taskID
                }		    

                await disputeResolutionLayer.initialize(
                    gameID,
                    merkleComputer.getRoots(initWasm.vm),
                    merkleComputer.getPointers(initWasm.vm),
                    solution.steps + 1,
                    merkleComputer.getRoots(solution.vm),
                    merkleComputer.getPointers(solution.vm),
                    {
                        from: account,
                        gas: 1000000
                    }
                )		    

                logger.log({
                    level: 'info',
                    message: `Game ${gameID} has been initialized`
                })

                let indices = toIndices(await disputeResolutionLayer.getIndices.call(gameID))

                //Post response to implied midpoint query
                let stepNumber = midpoint(indices.low, indices.high)

                let stateHash = await tasks[taskID].vm.getLocation(stepNumber, tasks[taskID].interpreterArgs)

                await disputeResolutionLayer.report(gameID, indices.low, indices.high, [stateHash], {from: account})

                logger.log({
                    level: 'info',
                    message: `Reported state hash for step: ${stepNumber} game: ${gameID} low: ${indices.low} high: ${indices.high}`
                })

            }
        })

        addEvent(disputeResolutionLayer.Queried(), async (result) => {
            let gameID = result.args.id
            let lowStep = result.args.idx1.toNumber()
            let highStep = result.args.idx2.toNumber()

            if(games[gameID]) {

                let taskID = games[gameID].taskID

                logger.log({
                    level: 'info',
                    message: `Received query Task: ${taskID} Game: ${gameID}`
                })

                if(lowStep + 1 != highStep) {
                    let stepNumber = midpoint(lowStep, highStep)

                    let stateHash = await tasks[taskID].vm.getLocation(stepNumber, tasks[taskID].interpreterArgs)

                    await disputeResolutionLayer.report(gameID, lowStep, highStep, [stateHash], {from: account})

                } else {
                    //Final step -> post phases

                    let lowStepState = await disputeResolutionLayer.getStateAt.call(gameID, lowStep)
                    let highStepState = await disputeResolutionLayer.getStateAt.call(gameID, highStep)

                    let states = (await tasks[taskID].vm.getStep(lowStep, tasks[taskID].interpreterArgs)).states

                    await disputeResolutionLayer.postPhases(
                        gameID,
                        lowStep,
                        states,
                        {
                            from: account,
                            gas: 400000
                        }
                    )

                    logger.log({
                        level: 'info',
                        message: `Phases have been posted for game ${gameID}`
                    })

                }
                
            }
        })

        addEvent(disputeResolutionLayer.SelectedPhase(), async (result) => {
            let gameID = result.args.id
            if (games[gameID]) {
                let taskID = games[gameID].taskID

                let lowStep = result.args.idx1.toNumber()
                let phase = result.args.phase.toNumber()

                logger.log({
                    level: 'info',
                    message: `Phase ${phase} for game  ${gameID}`
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

                let m = proof.machine || {reg1:0, reg2:0, reg3:0, ireg:0, vm:"0x00", op:"0x00"}
                let vm
                if (typeof proof.vm != "object") {
                    vm = {
                        code: "0x00",
                        stack:"0x00",
                        call_stack:"0x00",
                        calltable:"0x00",
                        globals : "0x00",
                        memory:"0x00",
                        calltypes:"0x00",
                        input_size:"0x00",
                        input_name:"0x00",
                        input_data:"0x00",
                        pc:0,
                        stack_ptr:0,
                        call_ptr:0,
                        memsize:0
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
                        {from: account, gas: 500000}
                    )

                    //TODO
                    //merkleComputer.getLeaf(proof.merkle.list, proof.merkle.location)
                    //merkleComputer.storeHash(hash, proof.merkle.data)
                } else {
                    await disputeResolutionLayer.callJudge(
                        gameID,
                        lowStep,
                        phase,
                        merkle,
                        merkle2,
                        m.vm,
                        m.op,
                        [m.reg1, m.reg2, m.reg3, m.ireg],
                        merkleComputer.getRoots(vm),
                        merkleComputer.getPointers(vm),
                        {from: account, gas: 5000000}
                    )			
                }

                logger.log({
                    level: 'info',
                    message: `Judge called for game ${gameID}`
                })

            }
        })
        
        async function handleGameTimeouts(gameID) {
            if (await disputeResolutionLayer.gameOver.call(gameID)) {
		
                await disputeResolutionLayer.gameOver(gameID, {from: account})
		
                logger.log({
                    level: 'info',
                    message: `gameOver was called for game ${gameID}`
                })
		
            }
        }
        
        async function handleTimeouts(taskID) {

            if (await incentiveLayer.endChallengePeriod.call(taskID)) {

                await incentiveLayer.endChallengePeriod(taskID, {from:account, gas: 100000})

                logger.log({
                    level: 'info',
                    message: `Ended challenge period for ${taskID}`
                })
		
            }
	    
            if (await incentiveLayer.endRevealPeriod.call(taskID)) {

                await incentiveLayer.endRevealPeriod(taskID, {from:account, gas:100000})

                logger.log({
                    level: 'info',
                    message: `Ended reveal period for ${taskID}`
                })
		
            }
	    
            if (await incentiveLayer.canRunVerificationGame.call(taskID)) {

                await incentiveLayer.runVerificationGame(taskID, {from:account, gas:1000000})

                logger.log({
                    level: 'info',
                    message: `Ran verification game for ${taskID}`
                })
		
            }
	    
            if (await incentiveLayer.canFinalizeTask.call(taskID)) {

                await incentiveLayer.finalizeTask(taskID, {from:account, gas:1000000})

                logger.log({
                    level: 'info',
                    message: `Finalized task ${taskID}`
                })

            }
        }
        
        let ival = setInterval(() => {
            task_list.forEach(handleTimeouts)
            game_list.forEach(handleGameTimeouts)
        }, 1000)

        return () => {
            try {
                let empty = data => { }
                clean_list.forEach(ev => ev.stopWatching(empty))
                clearInterval(ival)
            } catch(e) {
                console.log("Error when stopped watching events")
            }
        }
    }
}


