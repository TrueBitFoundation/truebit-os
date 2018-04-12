const depositsHelper = require('./depositsHelper')
const util = require('ethereumjs-util')

module.exports = async (session, args) => {
	if (!args['a']) {
		throw "please specify which account number you want to use with the `-a` flag"
	} else {
		let account = session.accounts[args['a'].trim()]

		if(!args['d']) {
			throw "please specify your minimum deposit amount with the `-d` flag"
		} else {

			let minDeposit = args['d'].trim()

      await depositsHelper(session, account, minDeposit)
            
			//start monitoring for tasks
			let taskCreatedEvent = session.contracts.incentiveLayer.TaskCreated()
			
			new Promise(async (resolve, reject) => {
				taskCreatedEvent.watch(async (error, result) => {

					if (result) {
						let taskID = result.args.taskID.toNumber()
						let taskMinDeposit = result.args.minDeposit.toNumber()
	
						if (taskMinDeposit <= minDeposit) {
							let taskData = await session.contracts.incentiveLayer.getTaskData.call(taskID)

							let program = session.web3.utils.hexToBytes(taskData[0]).map((n) => {
								return util.bufferToHex(util.setLengthLeft(n, 32))
							})

							try {
								await session.contracts.incentiveLayer.registerForTask(taskID, {from: account})

								let output = await session.contracts.computationLayer.runSteps.call(program, taskData[1].toNumber())

								let solutionHash = output[1]
	
								let tx = await session.contracts.incentiveLayer.commitSolution(taskID, solutionHash, {from: account})

							} catch (e) {
								//registering for task failed
							}
						}
					}

				})
			})
		}

	}
}