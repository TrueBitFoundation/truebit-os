let tasks = {}

const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const toTaskInfo = require('./util/toTaskInfo')
const waitForBlock = require('./util/waitForBlock')
const toSolutionInfo = require('./util/toSolutionInfo')

const contractsConfig = require('./util/contractsConfig')

function setup(web3) {
    return (async () => {
	const httpProvider = web3.currentProvider
	const config = await contractsConfig(web3)
	
	incentiveLayer = await contract(httpProvider, config['incentiveLayer'])
	return incentiveLayer
    })()
}

module.exports = {
    init: async (web3, account, logger) => {

	logger.log({
	    level: 'info',
	    message: `Task Giver initialized`
	})

	let incentiveLayer = await setup(web3)

	//Task creation event
	const taskCreatedEvent = incentiveLayer.TaskCreated()

	taskCreatedEvent.watch(async (err, result) => {
	    if (result) {
		if (account.toLowerCase() == result.args.giver) {		    
		    let taskID = result.args.taskID
		    let taskInfo = toTaskInfo(await incentiveLayer.taskInfo.call(taskID))
		    tasks[taskID] = taskInfo

		    logger.log({
			level: 'info',
			message: `Task has been submitted successfully with ID: ${taskID}`
		    })
		    
		}
	    }
	})

	const solverSelectedEvent = incentiveLayer.SolverSelected()

	solverSelectedEvent.watch(async (err, result) => {
	    if (result) {

		let taskID = result.args.taskID

		if (tasks[taskID]) {
		    //TODO
		    //Set timer for timeout
		}
	    }
	})

	//Solution committed event
	const solvedEvent = incentiveLayer.SolutionsCommitted()

	solvedEvent.watch(async (err, result) => {
	    if (result) {
		let taskID = result.args.taskID

		if (tasks[taskID]) {

		    logger.log({
			level: 'info',
			message: `Solution for task ${taskID} has been submitted`
		    })
		    		    
		    //TODO: store solution data somewhere, or have hooks for actions to be taken when solution was submitted
		}
	    }
	})

	return () => {
	    try {
		
		let empty = data => {}
		solverSelectedEvent.stopWatching(empty)
		taskCreatedEvent.stopWatching(empty)
		solvedEvent.stopWatching(empty)
		
	    } catch (e) {
		
	    }
	}
    },

    getTasks: () => {
	return tasks
    }
}
