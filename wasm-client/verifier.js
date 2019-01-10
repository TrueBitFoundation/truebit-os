const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const toTaskInfo = require('./util/toTaskInfo')
const toSolutionInfo = require('./util/toSolutionInfo')
const setupVM = require('./util/setupVM')
const midpoint = require('./util/midpoint')
const waitForBlock = require('./util/waitForBlock')
const recovery = require('./recovery')
const assert = require('assert')

const fsHelpers = require('./fsHelpers')

// const merkleComputer = require(__dirname + "/merkle-computer")('./../wasm-client/ocaml-offchain/interpreter/wasm')

const contractsConfig = require('./util/contractsConfig')

function setup(web3) {
    return (async () => {
	const httpProvider = web3.currentProvider
	const config = await contractsConfig(web3)
        let incentiveLayer = await contract(httpProvider, config['incentiveLayer'])
        let fileSystem = await contract(httpProvider, config['fileSystem'])
        let disputeResolutionLayer = await contract(httpProvider, config['interactive'])
        let tru = await contract(httpProvider, config['tru'])
        return [incentiveLayer, fileSystem, disputeResolutionLayer, tru]
    })()
}

const solverConf = { error: false, error_location: 0, stop_early: -1, deposit: 1 }

module.exports = {
    init: async (os, account, test = false, recover = -1) => {

        let {web3, logger, throttle} = os
        let mcFileSystem = os.fileSystem
        let tasks = {}
        let games = {}
            
        logger.log({
            level: 'info',
            message: `Verifier initialized`
        })

        let [incentiveLayer, fileSystem, disputeResolutionLayer, tru] = await setup(web3)

        const config = await contractsConfig(web3)
        const WAIT_TIME = config.WAIT_TIME || 0

        let helpers = fsHelpers.init(fileSystem, web3, mcFileSystem, logger, incentiveLayer, account, os.config)

        const clean_list = []
        let game_list = []
        let task_list = []

        let bn = await web3.eth.getBlockNumber()

        let recovery_mode = recover > 0
        let events = []
        const RECOVERY_BLOCKS = recover

        function addEvent(name, evC, handler) {

	    if (!evC) {
		logger.error(`VERIFIER: ${name} event is undefined when given to addEvent`)
	    } else {
		let ev = recovery_mode ? evC({}, {fromBlock:Math.max(0,bn-RECOVERY_BLOCKS)}) : evC()
		clean_list.push(ev)
		ev.watch(async (err, result) => {
                    // console.log(result)
                    if (result && recovery_mode) {
			events.push({event:result, handler})
			console.log("Recovering", result.event, "at block", result.blockNumber)
                    } else if (result) {
			try {
                            await handler(result)
			} catch (e) {
                            logger.error(`VERIFIER: Error while handling ${name} event ${JSON.stringify(result)}: ${e}`)
			}
                    } else {
			console.log(err)
		    }
		})		
	    }	    
        }

        //INCENTIVE

        //Solution committed event
        addEvent("SolutionsCommitted", incentiveLayer.SolutionsCommitted, async result => {

            logger.log({
                level: 'info',
                message: `VERIFIER: Solution has been posted`
            })

            let taskID = result.args.taskID
            let minDeposit = result.args.minDeposit.toNumber()
            let solverHash0 = result.args.solutionHash0
            let taskInfo = toTaskInfo(await incentiveLayer.getTaskInfo.call(taskID))
            taskInfo.taskID = taskID

            if (Object.keys(tasks).length <= throttle) {

                logger.info("VERIFIER: Setting up VM")
                let vm = await helpers.setupVMWithFS(taskInfo)

                logger.info("VERIFIER: Executing task")
                let interpreterArgs = []
                solution = await vm.executeWasmTask(interpreterArgs)

                logger.log({
                    level: 'info',
                    message: `VERIFIER: Executed task ${taskID}. Checking solutions`
                })

                task_list.push(taskID)

                let myHash = web3.utils.soliditySha3(solution.hash)
                if (test) myHash = "0x"+helpers.makeSecret(myHash)

                tasks[taskID] = {
                    solverHash0: solverHash0,
                    solutionHash: solution.hash,
                    vm: vm,
                    minDeposit: minDeposit,
                }


                // let intent = helpers.makeSecret(solution.hash + taskID).substr(0, 62) + "00"
                    // console.log("intent", intent)
                    // tasks[taskID].intent0 = "0x" + intent
                    let hash_str = taskID + account.substr(2) + myHash.substr(2)
                    await incentiveLayer.commitChallenge(web3.utils.soliditySha3(hash_str), { from: account, gas: 350000 })

                    logger.log({
                        level: 'info',
                        message: `VERIFIER: Challenged solution for task ${taskID}`
                    })


            }
        })

        addEvent("EndChallengePeriod", incentiveLayer.EndChallengePeriod, async result => {
            let taskID = result.args.taskID
            let taskData = tasks[taskID]

            if (!taskData) return

            await depositsHelper(web3, incentiveLayer, tru, account, taskData.minDeposit)

            let myHash = web3.utils.soliditySha3(taskData.solutionHash)
            if (test) myHash = "0x" + helpers.makeSecret(myHash)

            // logger.info(`my solution ${taskData.solutionHash}, my hash ${myHash}`)

            await incentiveLayer.revealIntent(taskID, myHash, { from: account, gas: 1000000 })

            logger.log({
                level: 'info',
                message: `VERIFIER: Revealing challenge intent for ${taskID}`
            })

        })

        addEvent("JackpotTriggered", incentiveLayer.JackpotTriggered, async result => {
            let taskID = result.args.taskID
            let taskData = tasks[taskID]

            if (!taskData) return
            logger.info("VERIFIER: Jackpot!!!")

            let lst = await incentiveLayer.getJackpotReceivers.call(taskID)

            console.log("Got receivers")

            for (let i = 0; i < lst.length; i++) {
                if (lst[i].toLowerCase() == account.toLowerCase()) await incentiveLayer.receiveJackpotPayment(taskID, i, {from: account, gas: 100000})
            }

        })

        addEvent("ReceivedJackpot", incentiveLayer.ReceivedJackpot, async (result) => {
            let recv = result.args.receiver
            let amount = result.args.amount
            logger.info(`VERIFIER: ${recv} got jackpot ${amount.toString(10)}`)
        })

        addEvent("VerificationCommitted", incentiveLayer.VerificationCommitted, async result => {
        })

        addEvent("TaskFinalized", incentiveLayer.TaskFinalized, async (result) => {
            let taskID = result.args.taskID	   
	    
            if (tasks[taskID]) {
                await incentiveLayer.unbondDeposit(taskID, {from: account, gas: 100000})
		        delete tasks[taskID]
                logger.log({
                    level: 'info',
                    message: `VERIFIER: Task ${taskID} finalized. Tried to unbond deposits.`
                  })

            }

        })

        addEvent("SlashedDeposit", incentiveLayer.SlashedDeposit, async (result) => {
            let addr = result.args.account

            if (account.toLowerCase() == addr.toLowerCase()) {
                logger.info("VERIFIER: Oops, I was slashed, hopefully this was a test")
            }

        })

        // DISPUTE

        addEvent("StartChallenge", disputeResolutionLayer.StartChallenge, async result => {
            let challenger = result.args.c

            if (challenger.toLowerCase() == account.toLowerCase()) {
                let gameID = result.args.gameID

                game_list.push(gameID)

                let taskID = await disputeResolutionLayer.getTask.call(gameID)

                games[gameID] = {
                    prover: result.args.prover,
                    taskID: taskID
                }
            }
        })

	
        // addEvent("Queried", disputeResolutionLayer.Queried, async result => {})
        
        addEvent("Reported", disputeResolutionLayer.Reported, async result => {
            let gameID = result.args.gameID

            if (games[gameID]) {

                let lowStep = result.args.idx1.toNumber()
                let highStep = result.args.idx2.toNumber()
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

        addEvent("PostedPhases", disputeResolutionLayer.PostedPhases, async result => {
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

        let busy_table = {}
        function busy(id) {
            return busy_table[id] && Date.now() < busy_table[id]
        }

        function working(id) {
            busy_table[id] = Date.now() + WAIT_TIME
        }

        async function handleTimeouts(taskID) {

            if (busy(taskID)) return

            if (await incentiveLayer.solverLoses.call(taskID, {from: account})) {

                working(taskID)
                logger.log({
                    level: 'info',
                    message: `VERIFIER: Winning verification game for task ${taskID}`
                })

                await incentiveLayer.solverLoses(taskID, {from: account})

            }
            if (await incentiveLayer.isTaskTimeout.call(taskID, {from: account})) {

                working(taskID)
                logger.log({
                    level: 'info',
                    message: `VERIFIER: Timeout in task ${taskID}`
                })

                await incentiveLayer.taskTimeout(taskID, {from: account})

            }
        }

        async function handleGameTimeouts(gameID) {
            // console.log("Verifier game timeout")
            if (busy(gameID)) return
            working(gameID)
            if (await disputeResolutionLayer.gameOver.call(gameID)) {

                logger.log({
                    level: 'info',
                    message: `Triggering game over, game: ${gameID}`
                })

                await disputeResolutionLayer.gameOver(gameID, { from: account })
            }
        }

        async function recoverTask(taskID) {
            let taskInfo = toTaskInfo(await incentiveLayer.getTaskInfo.call(taskID))
            if (!tasks[taskID]) tasks[taskID] = {}
            tasks[taskID].taskInfo = taskInfo
            taskInfo.taskID = taskID

            logger.log({
                level: 'info',
                message: `RECOVERY: Verifying task ${taskID}`
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

            if (!tasks[taskID]) logger.error(`FAILURE: haven't recovered task ${taskID} for game ${gameID}`)

            logger.log({
                level: 'info',
                message: `RECOVERY: Solution to task ${taskID} has been challenged`
            })

            games[gameID] = {
                taskID: taskID
            }
        }

        let ival = setInterval(() => {
            task_list.forEach(async t => {
                try {
                    await handleTimeouts(t)
                }
                catch (e) {
                    console.log(e)
                    logger.error(`Error while handling timeouts of task ${t}: ${e.toString()}`)
                }
            })
            game_list.forEach(async g => {
                try {
                    await handleGameTimeouts(g)
                }
                catch (e) {
                    console.log(e)
                    logger.error(`Error while handling timeouts of game ${g}: ${e.toString()}`)
                }
            })
            if (recovery_mode) {
                recovery_mode = false
                recovery.analyze(account, events, recoverTask, recoverGame, disputeResolutionLayer, incentiveLayer, game_list, task_list, true)
            }
        }, 2000)

        return () => {
            try {
                let empty = data => { }
                clearInterval(ival)
                clean_list.forEach(ev => ev.stopWatching(empty))
            }
            catch (e) {
                console.log("Umm")
            }
        }
    }
}
