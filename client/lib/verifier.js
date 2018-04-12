const depositsHelper = require('./depositsHelper')

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
            
			//start monitoring for solutions
			let solutionCommittedEvent = session.contracts.incentiveLayer.SolutionCommitted()

			new Promise(async (resolve, reject) => {
				solutionCommittedEvent.watch(async (error, result) => {
					if (result) {
						let taskID = result.args.taskID.toNumber()
						let taskMinDeposit = result.args.minDeposit.toNumber()
						let solverSolutionHash = result.args.solutionHash

						if (taskMinDeposit < minDeposit) {
							let taskData = await session.contracts.incentiveLayer.getTaskData.call(taskID)

							let program = session.web3.utils.hexToBytes(taskData[0]).map((n) => {
								return util.bufferToHex(util.setLengthLeft(n, 32))
							})

							let output = await session.contracts.computationLayer.runSteps.call(program, taskData[1].toNumber())

							let solutionHash = output[1]

							if (solutionHash != solverSolutionHash) {
								await session.contracts.incentiveLayer.commitChallenge(taskID, {from: account})
							}
						}
					}
				})
			})

		}

	}
}