const assert = require('assert')
const timeout = require('../os/lib/util/timeout')

let os

before(async () => {
	os = await require('../os')()
})

describe('Truebit OS', async function() {
	this.timeout(60000)

	it('should have a proper config', () => {
		assert(os.config.networks)
		assert(os.config.networks.development)
		assert(os.config.networks.development["incentive-layer"])
		assert(os.config.networks.development["dispute-resolution-layer"])
	})

	it('should have a web3', () => {
		assert(os.web3)
	})

	it('should have contracts', () => {
		assert(os.contracts)
		assert(os.contracts.incentiveLayer)
		assert(os.contracts.disputeResolutionLayer)
		assert(os.contracts.computationLayer)
	})

	describe('Task Giver', () => {

		it('should have a task giver', () => {
			assert(os.taskGiver)
		})

		it('should initialize task giver', () => {
			os.taskGiver.init()
		})

		it('should submit task', async () => {
			os.taskGiver.submitTask({
				minDeposit: 1000,
				data: [1, 2, 3, 4, 5, 6, 7, 8, 9],
				intervals: [20, 40, 60],
				disputeResAddress: os.contracts.disputeResolutionLayer.address,
				reward: 2000,
				from: os.accounts[0]
			})

			await timeout(2000)

			assert(Object.keys(os.taskGiver.getTasks()))
		})

	})
})