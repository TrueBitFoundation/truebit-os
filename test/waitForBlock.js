const assert = require('assert')
const timeout = require('../os/lib/util/timeout')

const mineBlocks = require('./helper/mineBlocks')

const waitForBlock = require('../os/lib/util/waitForBlock')

let os

describe('Truebit OS', async function() {

	before(async () => {
		os = await require('../os')()
	})

	this.timeout(60000)

	let isWorking = false

	it('should wait for block and use callback', async () => {
		let blockNumber = await os.web3.eth.getBlockNumber()

		waitForBlock(os.web3, blockNumber+2, () => {
			isWorking = true
		})

		await mineBlocks(os.web3, 5)
	
		await timeout(3000)
	
		assert(isWorking)
	})
})