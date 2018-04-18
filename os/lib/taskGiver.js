let tasks = {}
let accounts = new Set([])

const depositsHelper = require('./depositsHelper')
const waitForBlock = require('./util/waitForBlock')
const fs = require('fs')
const toTaskData = require('./util/toTaskData')

function toSolution(data) {
	return {
		solution: data[0],
		finalized: data[1]
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

						waitForBlock(os.web3, taskData.intervals[0] + taskData.taskCreationBlockNumber, async () => {
							if(tasks[taskID]["state"] == "register") {
								try {
									await os.contracts.incentiveLayer.timeout(taskID, {from: account})
								} catch(e) {
									//handle error
									console.error(e)
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
						let taskData = toTaskData(await os.contracts.incentiveLayer.getTaskData.call(taskID))
						tasks[taskID]["state"] = "selected"

						waitForBlock(os.web3, taskData.intervals[1] + taskData.taskCreationBlockNumber, async () => {
							if(tasks[taskID]["state"] == "selected") {
								try {
									await os.contracts.incentiveLayer.timeout(taskID, {from: account})
								} catch(e) {
									//handle error
									console.error(e)
								}
							}
						})

					}

				}
			})

			const solutionCommittedEvent = os.contracts.incentiveLayer.SolutionCommitted()

			solutionCommittedEvent.watch(async (err, result) => {
				if (result) {
					const taskID = result.args.taskID.toNumber()
					if (tasks[taskID]) {

						let taskData = toTaskData(await os.contracts.incentiveLayer.getTaskData.call(taskID))

						tasks[taskID]["state"] = "solved"

						//fire off timeout to wait for finalization
						//should make this recursive in case of verification game
						waitForBlock(os.web3, taskData.intervals[2] + taskData.taskCreationBlockNumber, async () => {
							
							if(tasks[taskID]["state"] == "solved") {
								try {

									const solution = toSolution(await os.contracts.incentiveLayer.getSolution.call(taskID))

									console.log(solution)

									if (solution.finalized) {
										fs.writeFile(taskID + ".json", JSON.stringify(solution))
										await taskExchange.unbondDeposit(taskID, {from: taskGiver})
									}

								} catch(e) {
									//handle error
									console.error(e)
								}
							}
						})

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