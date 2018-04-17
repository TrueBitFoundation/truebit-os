let tasks = {}

const depositsHelper = require('./depositsHelper')
const util = require('ethereumjs-util')

module.exports = (os) => {
  return {
		init: (account) => {
			const taskCreatedEvent = os.contracts.incentiveLayer.TaskCreated()

			taskCreatedEvent.watch(async (err, result) => {
					if (result) {
						let taskID = result.args.taskID.toNumber()
						let taskMinDeposit = result.args.minDeposit.toNumber()

						let taskData = await os.contracts.incentiveLayer.getTaskData.call(taskID)

						let program = os.web3.utils.hexToBytes(taskData[0]).map((n) => {
							return util.bufferToHex(util.setLengthLeft(n, 32))
						})

						try {
							await os.contracts.incentiveLayer.registerForTask(taskID, {from: account})

							let output = await os.contracts.computationLayer.runSteps.call(program, taskData[1].toNumber())

							let solution = output[0][1]

							let tx = await os.contracts.incentiveLayer.commitSolution(taskID, solution, {from: account})

						} catch (e) {
							//registering for task failed
						}
					}
			})

			return () => {
				try {
					taskCreatedEvent.stopWatching()
				} catch (e) {
					//console.log("Events stopped watching ungracefully")
				}
			}
		}
	}
}