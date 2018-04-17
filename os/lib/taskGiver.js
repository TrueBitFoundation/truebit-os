let tasks = {}
let accounts = new Set([])

const depositsHelper = require('./depositsHelper')
const waitForBlock = require('./util/waitForBlock')

//bytes taskData, uint numSteps, uint state, uint[3] intervals
function toTaskData(data) {
	return {
		taskData: data[0],
		numSteps: data[1].toNumber(),
		state: data[2].toNumber(),
		intervals: [data[3][0].toNumber(), data[3][1].toNumber(), data[3][2].toNumber()]
	}
}

module.exports = (os) => {
	return {
		init: (account) => {
			const taskCreatedEvent = os.contracts.incentiveLayer.TaskCreated()
	
			taskCreatedEvent.watch(async (err, result) => {
				if (result) {
					if (accounts.has(result.args.creator)) {
						let taskID = result.args.taskID.toNumber()
						let taskData = toTaskData(await os.contracts.incentiveLayer.getTaskData.call(taskID))
						taskData["state"] = "register"
						tasks[taskID] = taskData

						waitForBlock(os.web3, taskData.intervals[0], () => {
							if(tasks[taskID]["state"] == "register") {
								try {
									os.contracts.incentiveLayer.taskGiverTimeout(taskID, {from: account})
								} catch(e) {
									//handle error
								}
							}
						})
						
					}
				}
			})

			const solverSelectedEvent = os.contracts.incentiveLayer.SolverSelected()

			solverSelectedEvent.watch(async (err, result) => {
				if (result) {
					const taskID = result.args.taskID.toNumber()

					if (tasks[taskID]) {
						tasks[taskID]["state"] = "selected"

						//fire off timeout watcher
					}

				}
			})

			const solutionCommittedEvent = os.contracts.incentiveLayer.SolutionCommitted()

			solutionCommittedEvent.watch(async (err, result) => {
				if (result) {
					const taskID = result.args.taskID.toNumber()
					if (tasks[taskID]) {

						tasks[taskID]["state"] = "solved"
						
						tasks[taskID]["solution"] = {solution: result.args.solution, finalized: false}

						console.log(result.args.solution)

						//fire off timeout to wait for finalization
					}
				}
			})

			return () => {
				try {
					taskCreatedEvent.stopWatching()
					solverSelectedEvent.stopWatching()
					solutionCommittedEvent.stopWatching()
				} catch (e) {
					//console.log("Events stopped watching ungracefully")
				}
			}
		},
	
		submitTask: async (task) => {

			await depositsHelper(os, task.from, task.minDeposit)

			tx = await os.contracts.incentiveLayer.createTask(
				task.minDeposit, 
				task.data,
				task.intervals,
				task.data.length,
				task.disputeResAddress,
				{
					from: task.from, 
					value: task.reward,
					gas: 300000
				}
			)
			
			accounts.add(task.from.toLowerCase())
		},
	
		getTasks: () => {
			return tasks
		}
	}
}