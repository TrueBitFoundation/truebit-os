const assert = require('assert')

const timeout = require('../os/lib/util/timeout')

const BigNumber = require('bignumber.js')

const mineBlocks = require('../os/lib/util/mineBlocks')

const fs = require('fs')

const logger = require('../os/logger')

const merkleComputer = require('../wasm-client/webasm-solidity/merkle-computer')

let os

let taskSubmitter

before(async () => {
    os = await require('../os/kernel')("./wasm-client/config.json")
})

describe('Truebit OS WASM', async function() {
    this.timeout(60000)

    it('should have a logger', () => {
	assert(os.logger)
    })

    it('should have a web3', () => {
	assert(os.web3)
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
    
    describe('Task lifecycle with challenge', async () => {
	let killTaskGiver
	let killSolver
	let killVerifier

	let taskID
	
	let originalBalance

	let storageAddress, initStateHash
	

	before(async () => {
	    taskSubmitter = require('../wasm-client/taskSubmitter')(os.web3, os.logger)
	    
	    killTaskGiver = await os.taskGiver.init(os.web3, os.accounts[0], os.logger)
	    killSolver = await os.solver.init(os.web3, os.accounts[1], os.logger)
	    killSolver = await os.verifier.init(os.web3, os.accounts[1], os.logger, true)
	    originalBalance = new BigNumber(await os.web3.eth.getBalance(os.accounts[1]))
	})

	after(() => {
	    killTaskGiver()
	    killSolver()
	})

	it('should upload task onchain', async () => {
	    wastCode = fs.readFileSync(__dirname + "/../wasm-client/webasm-solidity/data/factorial.wast")

	    storageAddress = await taskSubmitter.uploadOnchain(wastCode, {from: os.accounts[0], gas: 400000})

	})

	it('should get initial state hash', async () => {
	    let config = {
		code_file: __dirname + "/../wasm-client/webasm-solidity/data/factorial.wast",
		input_file: "",
		actor: {},
		files: []
	    }
	    
	    initStateHash = await taskSubmitter.getInitStateHash(config)
	})
	
	it('should submit task', async () => {

	    let tx = await taskSubmitter.submitTask({
		from: os.accounts[0],
		minDeposit: os.web3.utils.toWei('1', 'ether'),
		storageAddress: storageAddress,
		initStateHash: initStateHash,
		codeType: merkleComputer.CodeType.WAST,
		storageType: merkleComputer.StorageType.BLOCKCHAIN,
		gas: 300000
	    })

	    await timeout(2000)
	    let tasks = os.taskGiver.getTasks()
	    //taskID = Object.keys(tasks)[0]
	    assert(Object.keys(os.taskGiver.getTasks()))
	})

	// it('should have a higher balance', async () => {

	//     await mineBlocks(os.web3, 110)

	//     await timeout(5000)

	//     const newBalance = new BigNumber(await os.web3.eth.getBalance(os.accounts[1]))
	//     console.log(newBalance)
	//     console.log(originalBalance)
	//     assert(originalBalance.isLessThan(newBalance))
	// })

	// it('should have a correct solution', () => {
	//     assert(fs.existsSync('solutions/' + taskID + '.json'))
	//     const { solution } = require('../solutions/' + taskID + '.json')
	//     const expected =
	// 	      '0x000000000000000000000000000000000000000000000000000000000000002d'
	//     const actual = solution
	//     assert(expected === actual)
	// })
    })
})
