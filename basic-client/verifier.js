let tasks = {}
let games = {}

function calculateMidpoint(low, high) {
    return Math.floor(low + ((high - low) / 2))
}

const depositsHelper = require('./depositsHelper')
const toGameData = require('./util/toGameData')
const toTaskData = require('./util/toTaskData')
const waitForBlock = require('./util/waitForBlock')
const util = require('ethereumjs-util')
const fs = require('fs')
const merkleTree = require('./util/merkleTree')
const sha3 = require('ethereumjs-util').sha3
const toProgram = require('./util/toProgram')

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
    init: async (web3, account, logger, test = false) => {

	logger.log({
	    level: 'info',
	    message: `Verifier initialized`
	})

	let [incentiveLayer, disputeResolutionLayer, computationLayer] = await setup(web3.currentProvider)
	
	const solutionCommittedEvent = incentiveLayer.SolutionCommitted()

	solutionCommittedEvent.watch(async (err, result) => {
	    if (result) {
		let taskID = result.args.taskID.toNumber()
		let taskMinDeposit = result.args.minDeposit.toNumber()
		let solution = result.args.solution
		let solver = result.args.solver
		
		let taskData = toTaskData(await incentiveLayer.getTaskData.call(taskID))
		
		let blockNumber = await web3.eth.getBlockNumber()
		
		if (!(blockNumber > taskData.intervals[0] + taskData.taskCreationBlockNumber)) {
		    tasks[taskID] = taskData

		    let program = toProgram(web3, taskData.taskData)
		    		    
		    let output = await computationLayer.runSteps.call(program, taskData.numSteps)
		    
		    let mySolution = output[0][1]
		    
		    if(mySolution != solution || test) {
			await depositsHelper(web3, incentiveLayer, account, taskMinDeposit)

			await incentiveLayer.commitChallenge(taskID, {gas: 200000, from: account})
		    }
		}
	    }
	})

	const verificationCommittedEvent = incentiveLayer.VerificationCommitted()

	verificationCommittedEvent.watch(async (err, result) => {
	    if (result) {
		let taskID = result.args.taskID.toNumber()
		let gameId = result.args.gameId
		let responseTime = result.args.responseTime.toNumber()
		if(tasks[taskID]) {
		    games[gameId] = {taskID: taskID}
		    tasks[taskID]["gameId"] = gameId

		    //Get task data to initialize game
		    let taskData = toTaskData(await incentiveLayer.getTaskData(taskID))

		    let program = toProgram(web3, taskData.taskData)

		    let hashes = program.map(e => sha3(e))
		    mtree = new merkleTree.MerkleTree(hashes, true)
		    root = mtree.getRoot()

		    let solution = await incentiveLayer.getSolution(taskID)

		    let stateHash = (await incentiveLayer.getSolution(taskID))[1]

		    //Initialize new game
		    await disputeResolutionLayer.initGame(
			gameId,
			merkleTree.bufToHex(root),
			stateHash,
			taskData.numSteps,
			responseTime,
			computationLayer.address,
			{from: account, gas: 300000}
		    )
		}
	    }
	})

	const newGameEvent = disputeResolutionLayer.NewGame()

	newGameEvent.watch(async (err, result) => {
	    if (result) {
		let gameId = result.args.gameId
		let solver = result.args.solver
		let verifier = result.args.verifier
		let responseTime = result.args.responseTime

		if(account.toLowerCase() == verifier) {
		    games[gameId]["ongoing"] = true
		    games[gameId]["responseTime"] = responseTime

		    const gameData =  toGameData(await disputeResolutionLayer.gameData.call(gameId))

		    const toQueryStep = calculateMidpoint(gameData.low, gameData.high)
		    await disputeResolutionLayer.query(gameId, toQueryStep, {from: account})
		    
		    //start timeout
		    waitForBlock(web3, web3.eth.getBlockNumber() + games[gameId].responseTime, async () => {
			let gameData = toGameData(await disputeResolutionLayer.gameData.call(gameId))
			if(gameData.lastParticipant == account) {
			    await disputeResolutionLayer.timeout(gameId, {from: account})
			}
		    })
		}
	    }
	})

	const newResponseEvent = disputeResolutionLayer.NewResponse()

	newResponseEvent.watch(async (err, result) => {
	    if (result) {
		let gameId = result.args.gameId
		let hash = result.args.hash

		if (games[gameId]) {
		    const gameData =  toGameData(await disputeResolutionLayer.gameData.call(gameId))

		    let taskData = toTaskData(await incentiveLayer.getTaskData.call(games[gameId].taskID))
		    
		    let program = web3.utils.hexToBytes(taskData.taskData).map((n) => {
			return util.bufferToHex(util.setLengthLeft(n, 32))
		    })
		    
		    let output = await computationLayer.runSteps.call(program, gameData.med)
		    
		    let solutionHash = output[1]
		    
		    if (solutionHash == gameData.medHash) {
			// we agree with their state; look in the right half
			await disputeResolutionLayer.query(gameId, calculateMidpoint(gameData.med, gameData.high), {from: account})
		    } else {
			// we disagree with their state; look in the left half.
			await disputeResolutionLayer.query(gameId, calculateMidpoint(gameData.low, gameData.med), {from: account})
		    }

		    //start timeout watcher
		    waitForBlock(web3, web3.eth.getBlockNumber() + games[gameId].responseTime, async () => {
			let gameData = toGameData(await disputeResolutionLayer.gameData.call(gameId))
			if(gameData.lastParticipant == account) {
			    await disputeResolutionLayer.timeout(gameId, {from: account})
			}
		    })		    
		}
	    }
	})

	return () => {
	    try {
			let emptyCallback = data => {
				// empty callback required to prevent error in web3
				// console.log('taskCreatedEvent.stopWatching callback:', data)
			  }
		solutionCommittedEvent.stopWatching(emptyCallback)
		newGameEvent.stopWatching(emptyCallback)
		verificationCommittedEvent.stopWatching(emptyCallback)
		newResponseEvent.stopWatching(emptyCallback)
	    } catch(e) {

	    }
	}
    }
}
