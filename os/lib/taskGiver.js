
let tasks = {}
let accounts = new Set([])

const depositsHelper = require('./depositsHelper')

module.exports = (os) => {
	return {
		init: () => {
			const taskCreatedEvent = os.contracts.incentiveLayer.TaskCreated()
	
			taskCreatedEvent.watch(async (err, result) => {
				if (result) {
					if (accounts.has(result.creator)) {
						let taskID = result.taskID.toNumber()
						let taskData = os.contracts.incentiveLayer.getTaskData.call(taskID)
						tasks[taskID] = taskData
					}
				}
			})
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
			
			accounts.add(task.from)
		},
	
		getTasks: () => {
			return tasks
		}
	}
}