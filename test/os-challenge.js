const assert = require('assert')
const timeout = require('../os/lib/util/timeout')

const BigNumber = require('bignumber.js')

const mineBlocks = require('../os/lib/util/mineBlocks')

const fs = require('fs')

let os

let taskSubmitter

before(async () => {
    os = await require('../os/kernel')("./basic-client/config.json")
})

describe('Truebit OS', async function() {
    this.timeout(60000)

    it('should have a web3', () => {
	assert(os.web3)
    })

    it('should have a logger', () => {
	assert(os.logger)
    })

    it('should have a task giver', () => {
	assert(os.taskGiver)
    })

    it('should have a solver', () => {
	assert(os.solver)
    })

    it('should have a verifier', () => {
	assert(os.verifier)
    })
    
    describe('Solution to task is challenged', async () => {
	let killTaskGiver
	let killSolver
	let killVerifier

	let taskID
	
	let originalBalance
	

	before(async () => {

	    taskSubmitter = require('../basic-client/taskSubmitter')(os.web3, os.logger)
	    
	    killTaskGiver = await os.taskGiver.init(os.web3, os.accounts[0], os.logger)
	    killSolver = await os.solver.init(os.web3, os.accounts[1], os.logger)
	    killVerifier = await os.verifier.init(os.web3, os.accounts[2], os.logger, true)
	    originalBalance = new BigNumber(await os.web3.eth.getBalance(os.accounts[1]))
	})

	after(() => {
	    killTaskGiver()
	    killSolver()
	    killVerifier()
	})
	
	it('should submit task', async () => {
	    taskSubmitter.submitTask({
		minDeposit: 1000,
		data: [1, 2, 3, 4, 5, 6, 7, 8, 9],
		intervals: [20, 40, 60],
		//disputeResAddress: os.contracts.disputeResolutionLayer.address,
		reward: os.web3.utils.toWei('1', 'ether'),
		from: os.accounts[0]
	    })

	    await timeout(2000)
	    let tasks = os.taskGiver.getTasks()
	    taskID = Object.keys(tasks)[0]
	    assert(Object.keys(os.taskGiver.getTasks()))
	})

	it('should have a higher balance', async () => {

	    await timeout(5000)

	    await mineBlocks(os.web3, 65)

	    await timeout(5000)

	    const newBalance = new BigNumber(await os.web3.eth.getBalance(os.accounts[1]))
	    assert(originalBalance.isLessThan(newBalance))
	})

	it('should have a correct solution', () => {
	    assert(fs.existsSync('solutions/' + taskID + '.json'))
	    const { solution } = require('../solutions/' + taskID + '.json')
	    const expected =
		      '0x000000000000000000000000000000000000000000000000000000000000002d'
	    const actual = solution
	    assert(expected === actual)
	})	
    })
})
