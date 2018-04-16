const timeout = require('./timeout')

module.exports = async (web3, endBlock, cb) => {
	return new Promise(async (resolve, reject) => {
		let currentBlock = await web3.eth.getBlockNumber()
		let originalBlock = currentBlock
		while(currentBlock <= originalBlock + endBlock) {
			await timeout(2000)
			currentBlock = await web3.eth.getBlockNumber()
		}
		resolve(cb())
	})
}