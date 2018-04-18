let tasks = {}

const depositsHelper = require('./depositsHelper')
const util = require('ethereumjs-util')
const waitForBlock = require('./util/waitForBlock')
const toTaskData = require('./util/toTaskData')

module.exports = (os) => {
  return {
		init: (account) => {
			const taskCreatedEvent = os.contracts.incentiveLayer.TaskCreated()

			taskCreatedEvent.watch(async (err, result) => {
					if (result) {
						let taskID = result.args.taskID.toNumber()
						let taskMinDeposit = result.args.minDeposit.toNumber()

						let taskData = toTaskData(await os.contracts.incentiveLayer.getTaskData.call(taskID))

						try {

							let blockNumber = await os.web3.eth.getBlockNumber()

							if (!(blockNumber > taskData.intervals[0] + taskData.taskCreationBlockNumber)) {

								await depositsHelper(os, account, taskMinDeposit)

								let tx = await os.contracts.incentiveLayer.registerForTask(taskID, {from: account, gas: 100000})

								tasks[taskID] = taskData
	
								let program = os.web3.utils.hexToBytes(taskData.taskData).map((n) => {
									return util.bufferToHex(util.setLengthLeft(n, 32))
								})
	
								let output = await os.contracts.computationLayer.runSteps.call(program, taskData.numSteps)
	
								let solution = output[0][1]
	
								tx = await os.contracts.incentiveLayer.commitSolution(taskID, solution, {from: account})
	
								waitForBlock(os.web3, taskData.intervals[2] + taskData.taskCreationBlockNumber, async () => {
									if (!tasks[taskID]["challenged"]) {
										await os.contracts.incentiveLayer.finalizeTask(taskID, {from: account})
									}
								})
							}

						} catch (e) {
							console.error(e)
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