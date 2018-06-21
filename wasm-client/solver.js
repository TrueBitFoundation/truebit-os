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

const merkleComputer = require(__dirname+ "/webasm-solidity/merkle-computer")()

const wasmClientConfig = JSON.parse(fs.readFileSync(__dirname + "/webasm-solidity/export/development.json"))

function setup(httpProvider) {
    return (async () => {
	incentiveLayer = await contract(httpProvider, wasmClientConfig['tasks'])
	fileSystem = await contract(httpProvider, wasmClientConfig['filesystem'])
	disputeResolutionLayer = await contract(httpProvider, wasmClientConfig['interactive'])
	return [incentiveLayer, fileSystem, disputeResolutionLayer]
    })()
}


let tasks = {}
let games = {}

module.exports = {
    init: async (web3, account, logger, mcFileSystem) => {
	logger.log({
	    level: 'info',
	    message: `Solver initialized`
	})

	let [incentiveLayer, fileSystem, disputeResolutionLayer] = await setup(web3.currentProvider)

	const taskPostedEvent = incentiveLayer.Posted()

	taskPostedEvent.watch(async (err, result) => {
	    if (result) {
		let taskID = result.args.id
		
		let minDeposit = result.args.deposit.toNumber()		

		let storageType = result.args.cs.toNumber()
		let storageAddress = result.args.stor
		let initStateHash = result.args.hash

		let solution, vm, interpreterArgs

		let solutionInfo = toSolutionInfo(await incentiveLayer.solutionInfo.call(taskID))

		if (solutionInfo.solver == '0x0000000000000000000000000000000000000000') {
		    await depositsHelper(web3, incentiveLayer, account, minDeposit)
		    logger.log({
			level: 'info',
			message: `Solving task ${taskID}`
		    })

		    let buf
		    if(storageType == merkleComputer.StorageType.BLOCKCHAIN) {

			let wasmCode = await fileSystem.getCode.call(storageAddress)

			buf = Buffer.from(wasmCode.substr(2), "hex")

			vm = await setupVM(
			    incentiveLayer,
			    merkleComputer,
			    taskID,
			    buf,
			    result.args.ct.toNumber(),
			    false
			)
			
		    } else if(storageType == merkleComputer.StorageType.IPFS) {
			//let codeIPFSHash = await fileSystem.getIPFSCode.call(storageAddress)

			let files = await fileSystem.getFiles.call(storageAddress)
			let ipfsFiles = []
			for(let i = 0; i < files.length; i++) {
			    let fileID = files[i]
			    let hash = await fileSystem.getHash.call(fileID)
			    let name = await fileSystem.getName.call(fileID)

			    ipfsFiles.push(
				{
				    hash: hash,
				    name: name,
				    code: false,
				    data: await mcFileSystem.download(hash, name)
				}   
			    )
			}

			let codeData = ipfsFiles[0].data.content

			vm = await setupVM(
			    incentiveLayer,
			    merkleComputer,
			    taskID,
			    codeData,
			    result.args.ct.toNumber(),
			    false
			)
			
		    }

		    assert(vm != undefined, "vm is undefined")
		    
		    interpreterArgs = []
		    solution = await vm.executeWasmTask(interpreterArgs)
		    
		    try {
			
			await incentiveLayer.solveIO(
			    taskID,
			    solution.vm.code,
			    solution.vm.input_size,
			    solution.vm.input_name,
			    solution.vm.input_data,
			    {from: account, gas: 200000}
			)

			logger.log({
			    level: 'info',
			    message: `Submitted solution for task ${taskID} successfully`
			})
			

			tasks[taskID] = {
			    solution: solution,
			    vm: vm,
			    interpreterArgs: interpreterArgs
			}
			
		    } catch(e) {
			//TODO: Add logging unsuccessful submission attempt
			console.log(e)
		    }
		}
	    }
	})

	const startChallengeEvent = disputeResolutionLayer.StartChallenge()

	startChallengeEvent.watch(async (err, result) => {
	    if (result) {
		let solver = result.args.p
		let gameID = result.args.uniq
		if (solver.toLowerCase() == account.toLowerCase()) {

		    let taskID = (await disputeResolutionLayer.getTask.call(gameID)).toNumber()

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

		    let currentBlockNumber = await web3.eth.getBlockNumber()
		    waitForBlock(web3, currentBlockNumber + 105, async () => {
			if(await disputeResolutionLayer.gameOver.call(gameID)) {
			    await disputeResolutionLayer.gameOver(gameID, {from: account})
			}
		    })
		    
		}
	    }
	})

	const queriedEvent = disputeResolutionLayer.Queried()

	queriedEvent.watch(async (err, result) => {
	    if (result) {
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
		    
		    let currentBlockNumber = await web3.eth.getBlockNumber()	    
		    waitForBlock(web3, currentBlockNumber + 105, async () => {
			if(await disputeResolutionLayer.gameOver.call(gameID)) {
			    await disputeResolutionLayer.gameOver(gameID, {from: account})
			}
		    })
		    
		 }
	     }
	})

	const selectedPhaseEvent = disputeResolutionLayer.SelectedPhase()

	selectedPhaseEvent.watch(async (err, result) => {
	    if (result) {
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
			    {from: account, gas: 400000}
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
    			    {from: account, gas: 400000}
			)			
		    }
		    
		    logger.log({
			level: 'info',
			message: `Judge called for game ${gameID}`
		    })
		    
		}
	    }
	})

	return () => {
	    try {
		taskPostedEvent.stopWatching()
		startChallengeEvent.stopWatching()
		queriedEvent.stopWatching()
		selectedPhasesEvent.stopWatching()
	    } catch(e) {
	    }
	}
    }
}
