const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const toTaskInfo = require('./util/toTaskInfo')
const toSolutionInfo = require('./util/toSolutionInfo')
const setupVM = require('./util/setupVM')
const midpoint = require('./util/midpoint')
const waitForBlock = require('./util/waitForBlock')

const merkleComputer = require(__dirname+ "/webasm-solidity/merkle-computer")('./../wasm-client/ocaml-offchain/interpreter/wasm')

const contractsConfig = JSON.parse(fs.readFileSync(__dirname + "/contracts.json"))

function setup(httpProvider) {
    return (async () => {
	incentiveLayer = await contract(httpProvider, contractsConfig['incentiveLayer'])
	fileSystem = await contract(httpProvider, contractsConfig['filesystem'])
	disputeResolutionLayer = await contract(httpProvider, contractsConfig['interactive'])
	return [incentiveLayer, fileSystem, disputeResolutionLayer]
    })()
}

function writeFile(fname, buf) {
    return new Promise(function (cont,err) { fs.writeFile(fname, buf, function (err, res) { cont() }) })
}

const solverConf = { error: false, error_location: 0, stop_early: -1, deposit: 1 }

let tasks = {}
let games = {}

module.exports = {
    init: async (web3, account, logger, mcFileSystem, test = false, phase = 1) => {
	logger.log({
	    level: 'info',
	    message: `Verifier initialized`
	})

	let [incentiveLayer, fileSystem, disputeResolutionLayer] = await setup(web3.currentProvider)

	//Solution committed event
	const solutionsCommittedEvent = incentiveLayer.SolutionsCommitted()

	solutionsCommittedEvent.watch(async (err, result) => {
	    if (result) {
		
		let taskID = result.args.taskID.toNumber()
		let storageAddress = result.args.storageAddress
		let minDeposit = result.args.deposit.toNumber()

		let taskInfo = toTaskInfo(await incentiveLayer.taskInfo.call(taskID))
		let solutionInfo = toSolutionInfo(await incentiveLayer.solutionInfo.call(taskID))

		//TODO: Check both solutions

		let storageType = result.args.cs.toNumber()
		
		if(storageType == merkleComputer.StorageType.BLOCKCHAIN) {
		    let wasmCode = await fileSystem.getCode.call(storageAddress)

		    let buf = Buffer.from(wasmCode.substr(2), "hex")

		    vm = await setupVM(
			incentiveLayer,
			merkleComputer,
			taskID,
			buf,
			result.args.codeType.toNumber(),
			true
		    )
		    
		    let interpreterArgs = []
		    solution = await vm.executeWasmTask(interpreterArgs)
		} else if(storageType == merkleComputer.StorageType.IPFS) {
		    // download code file
		    let codeIPFSHash = await fileSystem.getIPFSCode.call(storageAddress)
		    
		    let name = "task.wast"

		    let codeBuf = (await mcFileSystem.download(codeIPFSHash, name)).content

		    //download other files
		    let fileIDs = await fileSystem.getFiles.call(storageAddress)

		    let files = []

		    if (fileIDs.length > 0) {
			for(let i = 0; i < fileIDs.length; i++) {
			    let fileID = fileIDs[i]
			    let name = await fileSystem.getName.call(fileID)
			    let ipfsHash = await fileSystem.getHash.call(fileID)
			    let dataBuf = (await mcFileSystem.download(ipfsHash, name)).content
			    files.push({
				name: name,
				dataBuf: dataBuf
			    })			    
			}
		    }
		    
		    vm = await setupVM(
			incentiveLayer,
			merkleComputer,
			taskID,
			codeBuf,
			result.args.codeType.toNumber(),
			false,
			files
		    )
		    let interpreterArgs = []
		    solution = await vm.executeWasmTask(interpreterArgs)
		    
		}

		if(solutionInfo.resultHash != solution.hash || test) {

		    await depositsHelper(web3, incentiveLayer, account, minDeposit) 
		    
		    await incentiveLayer.challenge(taskID, {from: account, gas: 350000})
		    tasks[taskID] = {
			solverSolutionHash: solutionInfo.resultHash,
			solutionHash: solution.hash,
			vm: vm
		    }
		    logger.log({
			level: 'info',
			message: `Challenged solution for task ${taskID}`
		    })
		    
		}
	    }
	})

	const startChallengeEvent = disputeResolutionLayer.StartChallenge()

	startChallengeEvent.watch(async (err, result) => {
	    if(result) {
		let challenger = result.args.c

		if (challenger.toLowerCase() == account.toLowerCase()) {
		    let gameID = result.args.uniq

		    let taskID = (await disputeResolutionLayer.getTask.call(gameID)).toNumber()

		    games[gameID] = {
			prover: result.args.prover,
			taskID: taskID
		    }
		}		
	    }
	})

	const reportedEvent = disputeResolutionLayer.Reported()

	reportedEvent.watch(async (err, result) => {
	    if (result) {
		let gameID = result.args.id

		if (games[gameID]) {
		    
		    let lowStep = result.args.idx1.toNumber()
		    let highStep = result.args.idx2.toNumber()
		    let taskID = games[gameID].taskID

		    logger.log({
			level: 'info',
			message: `Report received game: ${gameID} low: ${lowStep} high: ${highStep}`
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
			{from: account}
		    )

		    let currentBlockNumber = await web3.eth.getBlockNumber()
		    waitForBlock(web3, currentBlockNumber + 105, async () => {
			if(await disputeResolutionLayer.gameOver.call(gameID)) {
			    await disputeResolutionLayer.gameOver(gameID, {from: account})
			}
		    })
		    
		    
		}
	    }
	})

	const postedPhasesEvent = disputeResolutionLayer.PostedPhases()

	postedPhasesEvent.watch(async (err, result) => {
	    if (result) {
		let gameID = result.args.id

		if (games[gameID]) {

		    logger.log({
			level: 'info',
			message: `Phases posted for game: ${gameID}`
		    })
		    
		    let lowStep = result.args.idx1
		    let phases = result.args.arr

		    let taskID = games[gameID].taskID

		    if (test) {
			await disputeResolutionLayer.selectPhase(gameID, lowStep, phases[phase], phase, {from: account}) 
		    } else {
			let states = (await tasks[taskID].vm.getStep(lowStep, tasks[taskID].interpreterArgs)).states

			for(let i = 0; i < phases.length; i++) {
			    if (states[i] != phases[i]) {
				await disputeResolutionLayer.selectPhase(
				    gameID,
				    lowStep,
				    phases[i],
				    i,
				    {from: account}
				) 				
			    }
			}
		    }
		    
		    let currentBlockNumber = await web3.eth.getBlockNumber()
		    waitForBlock(web3, currentBlockNumber + 105, async () => {
			if(await disputeResolutionLayer.gameOver.call(gameID)) {
			    await disputeResolutionLayer.gameOver(gameID, {from: account})
			}
		    })
		    
		}
	    }
	})

	return () => {
	    try {
		let empty = data => { }
		solvedEvent.stopWatching(empty)
		startChallengeEvent.stopWatching(empty)
		reportedEvent.stopWatching(empty)
		postedPhasesEvent.stopWatching(empty)
	    } catch(e) {
	    }
	}
    }
}
