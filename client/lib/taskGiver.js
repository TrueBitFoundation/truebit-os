const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const waitForBlock = require('./util/waitForBlock')

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

			if(!args['t']) {
				throw "please input a task with the `-t` flag"
			} else {
				let taskFilePath = args['t'].trim()
				let taskData = await new Promise((resolve, reject) => {
					fs.readFile(taskFilePath, function(err, data) {
						if (err) {
							reject(taskFilePath + " not found.")
						} else {
							resolve(session.web3.utils.bytesToHex(JSON.parse(data)))
						}
					})
				})

				tx = await session.contracts.incentiveLayer.createTask(
					minDeposit, 
					taskData,
					[20, 40, 60],
					taskData.length,
					session.contracts.disputeResolutionLayer.address,
					{
						from: account, 
						value: 1000,
						gas: 300000
					}
				)

				let log = tx.logs.find(log => log.event === 'TaskCreated')

				let taskID = log.args.taskID.toNumber()

				//watch for solver selected
				//TODO: use timeout as well
				await new Promise(async (resolve, reject) => {
					let solverSelectedEvent = session.contracts.incentiveLayer.SolverSelected({taskID: taskID})

					solverSelectedEvent.watch(async (err, result) => {
						if (result) {
							resolve()
						}
					})

				})

				let solution = {}

				await Promise.race([
					new Promise(async (resolve, reject) => {
						//watch for solution
						let solutionCommittedEvent = session.contracts.incentiveLayer.SolutionCommitted({taskID: taskID})

						solutionCommittedEvent.watch(async (err, result) => {
							if (result) {
								solution["solution"] = result.args.solution
								resolve()
							}
						})
					}),
					new Promise(async (resolve, reject) => {
						//wait for timeout and then call taskGiver timeout
						let currentBlockNumber = await session.web3.getBlockNumber()
						await waitForBlock(session.web3, currentBlockNumber + 40) //40 is interval 2
						await session.contracts.incentiveLayer.taskGiverTimeout(taskID, {from: account})
						resolve()
					})
				])

				// if(solution) {
				// 	//wait for finalization
				// } else {
				// 	//resubmit???
				// }

			}
		}

	}
}