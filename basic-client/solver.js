let tasks = {}
let games = {}

const depositsHelper = require('./depositsHelper')
const util = require('ethereumjs-util')
const waitForBlock = require('./util/waitForBlock')
const toTaskData = require('./util/toTaskData')
const toGameData = require('./util/toGameData')
const merkleTree = require('./util/merkleTree')
const sha3 = require('ethereumjs-util').sha3
const toProgram = require('./util/toProgram')

const fs = require('fs')

const contract = require('./contractHelper')

function setup(httpProvider) {
    return (async () => {
	ilConfig = JSON.parse(fs.readFileSync(__dirname + "/incentive-layer/export/development.json"))
	incentiveLayer = await contract(httpProvider, ilConfig['TaskExchange'])
	drlConfig = JSON.parse(fs.readFileSync(__dirname + "/dispute-resolution-layer/export/development.json"))
	disputeResolutionLayer = await contract(httpProvider, drlConfig['BasicVerificationGame'])
	computationLayer = await contract(httpProvider, drlConfig['SimpleAdderVM'])
	return [incentiveLayer, disputeResolutionLayer, computationLayer]
    })()
}

module.exports = {
    init: async (web3, account, logger) => {

	logger.log({
	    level: 'info',
	    message: `Solver initialized`
	})
		    
	let [incentiveLayer, disputeResolutionLayer, computationLayer] = await setup(web3.currentProvider)

	const taskCreatedEvent = incentiveLayer.TaskCreated()

	taskCreatedEvent.watch(async (err, result) => {
	    if (result) {
		let taskID = result.args.taskID.toNumber()
		let taskMinDeposit = result.args.minDeposit.toNumber()

		let taskData = toTaskData(await incentiveLayer.getTaskData.call(taskID))

		try {

		    let blockNumber = await web3.eth.getBlockNumber()

		    if (!(blockNumber > taskData.intervals[0] + taskData.taskCreationBlockNumber)) {

			await depositsHelper(web3, incentiveLayer, account, taskMinDeposit)

			let tx = await incentiveLayer.registerForTask(taskID, {from: account, gas: 100000})

			tasks[taskID] = taskData

			let program = toProgram(web3, taskData.taskData)
						
			let output = await computationLayer.runSteps.call(program, taskData.numSteps)
			
			let solution = output[0][1]

			let stateHash = await computationLayer.merklizeState.call(output[0])
			
			tx = await incentiveLayer.commitSolution(taskID, solution, stateHash, {from: account})
			
			waitForBlock(web3, taskData.intervals[2] + taskData.taskCreationBlockNumber, async () => {
			    if (!tasks[taskID]["challenged"]) {
				await incentiveLayer.finalizeTask(taskID, {from: account})
			    }
			})
		    }

		} catch (e) {
		    console.error(e)
		}
	    }
	})

	const verificationCommittedEvent = incentiveLayer.VerificationCommitted()

	verificationCommittedEvent.watch(async (err, result) => {
	    if (result) {
		let taskID = result.args.taskID.toNumber()
		let gameId = result.args.gameId
		
		if(tasks[taskID]) {
		    games[gameId] = {taskID: taskID}
		    tasks[taskID]["gameId"] = gameId

		    let taskData = toTaskData(await incentiveLayer.getTaskData.call(games[gameId].taskID))

		    let program = toProgram(web3, taskData.taskData)

		    let hashes = program.map(e => sha3(e))

		    mtree = new merkleTree.MerkleTree(hashes, true)
		    root = mtree.getRoot()
		    games[gameId]["program"] = program
		    games[gameId]["merkle-tree"] = mtree
		    games[gameId]["merkle-root"] = root
		    games[gameId]["hashes"] = hashes
		}
	    }
	})

	const newGameEvent = disputeResolutionLayer.NewGame()

	newGameEvent.watch(async (err, result) => {
	    if (result) {
		let gameId = result.args.gameId
		let responseTime = result.args.responseTime.toNumber()
		games[gameId]["responseTime"] = responseTime
	    }
	})
	
	const newQueryEvent = disputeResolutionLayer.NewQuery()

	newQueryEvent.watch(async (err, result) => {
            if (result) {
		let gameId = result.args.gameId
		let stepNumber = result.args.stepNumber

		if (games[gameId]) {
		    const gameData =  toGameData(await disputeResolutionLayer.gameData.call(gameId))

		    let taskData = toTaskData(await incentiveLayer.getTaskData.call(games[gameId].taskID))
		    
		    if (gameData.low + 1 != gameData.high) {
			let program = web3.utils.hexToBytes(taskData.taskData).map((n) => {
			    return util.bufferToHex(util.setLengthLeft(n, 32))
			})
			
			let output = await computationLayer.runSteps.call(program, gameData.med)
			
			let solutionHash = output[1]

			await disputeResolutionLayer.respond(gameId, stepNumber, solutionHash, {from: account})
						
			//start timeout watcher
			waitForBlock(web3, web3.eth.getBlockNumber() + games[gameId].responseTime, async () => {
			    let gameData = toGameData(await disputeResolutionLayer.gameData.call(gameId))
			    if(gameData.lastParticipant == account) {
				await disputeResolutionLayer.timeout(gameId, {from: account})
			    }
			})
			
		    } else {
			//Game has reached final step; Solver prove innocence
			
			const gameData = toGameData(await disputeResolutionLayer.gameData.call(gameId))

			const game = games[gameId]

			let lowStepState = (await computationLayer.runSteps.call(game["program"], gameData.low))[0]

			let highStepIndex = gameData.high - 1

			let highStepState = await computationLayer.runStep.call(lowStepState, game["program"][highStepIndex])
			
			let proof = game["merkle-tree"].getProofOrdered(game["hashes"][highStepIndex], gameData.high)
			const newProof = '0x' + proof.map(e => e.toString('hex')).join('')

			await disputeResolutionLayer.performStepVerification(
			    gameId,
			    lowStepState,
			    highStepState,
			    game["program"][highStepIndex],
			    newProof,
			    {from: account}
			)
		    }
		}
            }
	})

	return () => {
	    try {
			let emptyCallback = data => {
				// empty callback required to prevent error in web3
				// console.log('taskCreatedEvent.stopWatching callback:', data)
			  }
		taskCreatedEvent.stopWatching(emptyCallback)
		verificationCommittedEvent.stopWatching(emptyCallback)
		newQueryEvent.stopWatching(emptyCallback)
		newGameEvent.stopWatching(emptyCallback)
	    } catch (e) {
		//console.log("Events stopped watching ungracefully")
	    }
	}
    }
}
