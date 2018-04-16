const timeout = require('timeout')

module.exports = async (web3, endBlock) => {
	return new Promise((resolve, reject) => {
		let currentBlock = await web3.eth.getBlockNumber()
		while(currentBlock <= endBlock) {
			await timeout(2000)
			currentBlock = await web3.eth.getBlockNumber()
		}
		resolve()
	})
}