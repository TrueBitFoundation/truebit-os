let tasks = {}

const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const toTaskInfo = require('./util/toTaskInfo')
const waitForBlock = require('./util/waitForBlock')

const wasmClientConfig = JSON.parse(fs.readFileSync(__dirname + "/webasm-solidity/export/development.json"))

function setup(httpProvider) {
    return (async () => {
	incentiveLayer = await contract(httpProvider, wasmClientConfig['tasks'])
	return incentiveLayer
    })()
}

module.exports = {
    init: async (web3, account, logger) => {

	logger.log({
	    level: 'info',
	    message: `Task Giver initialized`
	})

	let incentiveLayer = await setup(web3.currentProvider)

	//Task creation event
	const taskPostedEvent = incentiveLayer.Posted()

	taskPostedEvent.watch(async (err, result) => {
	    if (result) {
		if (account.toLowerCase() == result.args.giver) {
		    let taskID = result.args.id.toNumber()
		    let taskInfo = toTaskInfo(await incentiveLayer.taskInfo.call(taskID))
		    tasks[taskID] = taskInfo
		}
	    }
	})

	//Solution committed event
	const solvedEvent = incentiveLayer.Solved()

	solvedEvent.watch(async (err, result) => {
	    if (result) {
		let taskID = result.args.id.toNumber()

		if (tasks[taskID]) {
		    
		    //TODO: get and store solution

		    let currentBlockNumber = await web3.eth.getBlockNumber()
		    
		    waitForBlock(web3, currentBlockNumber + 105, async () => {

			if(await incentiveLayer.finalizeTask.call(taskID)) {
			    await incentiveLayer.finalizeTask(taskID, {from: account})
			}			
		    })
		}
	    }
	})

	return () => {
	    try {
		taskPostedEvent.stopWatching()
		solvedEvent.stopWatching()
	    } catch (e) {
	    }
	}
    },

    getTasks: () => {
	return tasks
    }
}
