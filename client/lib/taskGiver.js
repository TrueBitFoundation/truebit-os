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
							resolve("0x" + JSON.parse(data).map((n) => {
								if (n < 10) {
									return "0x0" + n.toString(16)
								} else {
									return "0x" + n.toString(16)
								}
							}))
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
						value: 1000
					}
				)

				//wait for task to be finalized
				//let waiting = true
				//while(waiting) {
					//timeout(2000)
					//session.contracts.incentiveLayer.getTaskStatus
				//}

			}
		}

	}
}