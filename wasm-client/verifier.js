const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const toTaskInfo = require('./util/toTaskInfo')
const toSolutionInfo = require('./util/toSolutionInfo')
const setupVM = require('./util/setupVM')
const midpoint = require('./util/midpoint')
const waitForBlock = require('./util/waitForBlock')

const merkleComputer = require(__dirname+ "/merkle-computer")('./../wasm-client/ocaml-offchain/interpreter/wasm')

const contractsConfig = JSON.parse(fs.readFileSync(__dirname + "/contracts.json"))

function setup(httpProvider) {
    return (async () => {
        let incentiveLayer = await contract(httpProvider, contractsConfig['incentiveLayer'])
        let fileSystem = await contract(httpProvider, contractsConfig['fileSystem'])
        let disputeResolutionLayer = await contract(httpProvider, contractsConfig['interactive'])
        let tru = await contract(httpProvider, contractsConfig['tru'])
        return [incentiveLayer, fileSystem, disputeResolutionLayer, tru]
    })()
}

function writeFile(fname, buf) {
    return new Promise(function (cont,err) { fs.writeFile(fname, buf, function (err, res) { cont() }) })
}

function makeRandom(n) {
    let res = ""
    for (let i = 0; i < n*2; i++) {
        res += Math.floor(Math.random()*16).toString(16)
    }
    return res
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

	let [incentiveLayer, fileSystem, disputeResolutionLayer, tru] = await setup(web3.currentProvider)
    
    const clean_list = []
    let game_list = []

    function addEvent(ev, handler) {
        clean_list.push(ev)
        ev.watch(async (err, result) => {
            if (result) handler(result)
        })
    }

	//INCENTIVE

	//Solution committed event
	addEvent(incentiveLayer.SolutionsCommitted(), async result => {
        console.log("Solution posted")
		let taskID = result.args.taskID
		let storageAddress = result.args.storageAddress
		let minDeposit = result.args.minDeposit.toNumber()
		let solverHash0 = result.args.solutionHash0
		let solverHash1 = result.args.solutionHash1

		// let taskInfo = toTaskInfo(await incentiveLayer.taskInfo.call(taskID))
		// let solutionInfo = toSolutionInfo(await incentiveLayer.solutionInfo.call(taskID))

		let storageType = result.args.storageType.toNumber()
        let vm, solution
		
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
        
        console.log("Loaded files")

<<<<<<< HEAD
        tasks[taskID] = {
            solverHash0: solverHash0,
            solverHash1: solverHash1,
            solutionHash: solution.hash,
            vm: vm
        }
		if ((solverHash0 != solution.hash) ^ test) {
            console.log("Checking deposit")
		    await depositsHelper(web3, incentiveLayer, tru, account, minDeposit) 
            let intent = makeRandom(31) + "00"
            tasks[taskID].intent0 = "0x" + intent
            let hash_str = taskID + intent + account.substr(2) + solverHash0.substr(2) + solverHash1.substr(2) 
            await incentiveLayer.commitChallenge(web3.utils.soliditySha3(hash_str), {from: account, gas: 350000})
            logger.log({
                level: 'info',
                message: `Challenged solution for task ${taskID}`
            })
		}
		if ((solverHash1 != solution.hash) ^ test) {
		    await depositsHelper(web3, incentiveLayer, tru, account, minDeposit) 
            let intent = makeRandom(31) + "01"
            tasks[taskID].intent1 = "0x" + intent
            let hash_str = taskID + intent + account.substr(2) + solverHash0.substr(2) + solverHash1.substr(2) 
            await incentiveLayer.commitChallenge(web3.utils.soliditySha3(hash_str), {from: account, gas: 350000})
            logger.log({
                level: 'info',
                message: `Challenged solution for task ${taskID}`
            })
		}
        
=======
            tasks[taskID] = {
		solverHash0: solverHash0,
		solverHash1: solverHash1,
		solutionHash: solution.hash,
		vm: vm
            }
	    
	    if (solverHash0 != solution.hash) {
		await depositsHelper(web3, incentiveLayer, account, minDeposit) 
		let intent = makeRandom(31) + "00"
		tasks[taskID].intent0 = "0x" + intent
		let hash_str = taskID + intent + account.substr(2) + solverHash0.substr(2) + solverHash1.substr(2) 
		await incentiveLayer.commitChallenge(web3.utils.soliditySha3(hash_str), {from: account, gas: 350000})
		logger.log({
                    level: 'info',
                    message: `Challenged solution for task ${taskID}`
		})
	    }
	    
	    if (solverHash1 != solution.hash) {
		await depositsHelper(web3, incentiveLayer, account, minDeposit) 
		let intent = makeRandom(31) + "01"
		tasks[taskID].intent1 = "0x" + intent
		let hash_str = taskID + intent + account.substr(2) + solverHash0.substr(2) + solverHash1.substr(2) 
		await incentiveLayer.commitChallenge(web3.utils.soliditySha3(hash_str), {from: account, gas: 350000})
		logger.log({
                    level: 'info',
                    message: `Challenged solution for task ${taskID}`
		})
	    }
            
>>>>>>> bbf0f7d0655b379b0752fc884b395f52ab2b98de
	})

	addEvent(incentiveLayer.EndChallengePeriod(), async result => {
        let taskID = result.args.taskID
        let taskData = tasks[taskID]
        if (!taskData) return
        if (taskData.intent0) {
            console.log("Revealing intent")
            await incentiveLayer.revealIntent(taskID, taskData.solverHash0, taskData.solverHash1, taskData.intent0, {from: account, gas:1000000})
        }
        if (taskData.intent1) {
            console.log("Revealing intent")
            await incentiveLayer.revealIntent(taskID, taskData.solverHash0, taskData.solverHash1, taskData.intent1, {from: account, gas:1000000})
        }
    })

	// DISPUTE

	addEvent(disputeResolutionLayer.StartChallenge(), async result => {
		let challenger = result.args.c

		if (challenger.toLowerCase() == account.toLowerCase()) {
		    let gameID = result.args.uniq
            
            game_list.push(gameID)

		    let taskID = await disputeResolutionLayer.getTask.call(gameID)

            games[gameID] = {
                prover: result.args.prover,
                taskID: taskID
            }
		}		
	})

    addEvent(disputeResolutionLayer.Reported(), async result => {
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
            
            /*

            let currentBlockNumber = await web3.eth.getBlockNumber()
            waitForBlock(web3, currentBlockNumber + 105, async () => {
                if(await disputeResolutionLayer.gameOver.call(gameID)) {
                    await disputeResolutionLayer.gameOver(gameID, {from: account})
                }
		    })
		    
		    */
		}
	})

	addEvent(disputeResolutionLayer.PostedPhases(), async result => {
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
		    /*
            let currentBlockNumber = await web3.eth.getBlockNumber()
            waitForBlock(web3, currentBlockNumber + 105, async () => {
                if(await disputeResolutionLayer.gameOver.call(gameID)) {
                    await disputeResolutionLayer.gameOver(gameID, {from: account})
                }
            })
            */
		    
	    }
	})
    
    async function handleGameTimeouts(gameID) {
        if (await disputeResolutionLayer.gameOver.call(gameID)) {
            console.log("Calling game over")
            await disputeResolutionLayer.gameOver(gameID, {from: account})
        }
    }
        
    let ival = setInterval(() => {
            game_list.forEach(handleGameTimeouts)
    }, 1000)

	return () => {
        try {
            let empty = data => { }
            clearInterval(ival)
            clean_list.forEach(ev => ev.stopWatching(empty))
        }
        catch(e) {
            console.log("Umm")
	    }
	}
    }
}
