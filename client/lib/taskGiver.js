const depositsHelper = require('./depositsHelper')
const fs = require('fs')

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

			}
		}

	}
}