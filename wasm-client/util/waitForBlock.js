const timeout = require('./timeout')

module.exports = async (web3, endBlock, cb) => {
    return new Promise(async (resolve, reject) => {
	let currentBlock = await web3.eth.getBlockNumber()
	while(currentBlock <= endBlock) {
	    await timeout(1000)
	    currentBlock = await web3.eth.getBlockNumber()
	}
	resolve(cb())
    })
}
