const assert = require('assert')
const fs = require('fs')
const contractsConfig = require('../wasm-client/util/contractsConfig')
const contract = require('../wasm-client/contractHelper')
const mineBlocks = require('../os/lib/util/mineBlocks')

function setup(web3) {
    return (async () => {
	const httpProvider = web3.currentProvider
	const config = await contractsConfig(web3)
	
	return Promise.all([
	    contract(httpProvider, config['incentiveLayer']),
	    contract(httpProvider, config['tru']),
	])
    })()
}

describe('Truebit Incentive Layer Smart Contract Unit Tests', function() {
    this.timeout(60000)

    let incentiveLayer, tru, taskGiver, solver, verifier, accounts, dummy
    let minDeposit, taskID, randomBits, randomBitsHash, solution0Hash, solution1Hash, web3

    before(async () => {
	let os = await require('../os/kernel')('./wasm-client/config.json')

	let contracts = await setup(os.web3)

	web3 = os.web3

	incentiveLayer = contracts[0]
	tru = contracts[1]

	taskGiver = os.accounts[0]
	solver = os.accounts[1]
	verifier = os.accounts[2]
	dummy = os.accounts[3]

	accounts = [taskGiver, solver, verifier]

	minDeposit = 100000

	randomBits = 42
	randomBitsHash = os.web3.utils.soliditySha3(randomBits)
	solution0Hash = os.web3.utils.soliditySha3(0x0, 0x0, 0x0, 0x0)
	solutionCommit = os.web3.utils.soliditySha3(solution0Hash)

	for(let account of accounts) {
	    await tru.approve(incentiveLayer.address, minDeposit, { from: account })
	}

    })

    it("participants should make a deposit", async () => {

	for(let account of accounts) {
	   
	    await incentiveLayer.makeDeposit(minDeposit, { from: account })
	    
	    let deposit = (await incentiveLayer.getDeposit.call(account)).toNumber()

	    assert(deposit > 1)
	    
	}
	
    })

    it("should reject making a deposit of 42 with empty account", async () => {
	return incentiveLayer.makeDeposit(42, { from: dummy })
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })    

    it("should reject making a deposit of zero", async () => {
	return incentiveLayer.makeDeposit(minDeposit, { from: dummy })
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })

    it("task giver should create a task", async () => {
	const maxDifficulty = 1
	const reward = 10000
	
	let tx = await incentiveLayer.createTask(0x0, 0, 0, 0x0, maxDifficulty, reward, {from: taskGiver, gas: 300000})

	let log = tx.logs.find(log => log.event === 'TaskCreated')

	//confirm existence of params in event
	assert(log.args.taskID)	
	assert(log.args.codeType)
	assert(log.args.storageType)
	assert(log.args.storageAddress == 0x0)
	assert(log.args.blockNumber)
	assert(log.args.reward)

	//confirm proper economic values
	assert.equal(log.args.minDeposit.toNumber(), 3)
	assert.equal(log.args.tax.toNumber(), (log.args.minDeposit.toNumber() * 5))

	taskID = log.args.taskID
    })

    it("should reject creating a task with no deposit", async () => {
	return incentiveLayer.createTask(0x0, 0, 0, 0x0, 1, 10000, {from: dummy, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })

    it("should reject creating a task with max difficulty set to zero", async () => {
	return incentiveLayer.createTask(0x0, 0, 0, 0x0, 0, 10000, {from: taskGiver, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })

    it("should reject creating a task with reward set to zero", async () => {
	return incentiveLayer.createTask(0x0, 0, 0, 0x0, 1, 0, {from: taskGiver, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })

    it("should reject creating a task with improper code type", async () => {
	return incentiveLayer.createTask(0x0, 42, 0, 0x0, 1, 100000, {from: taskGiver, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })

    it("should reject creating a task with improper storage type", async () => {
	return incentiveLayer.createTask(0x0, 0, 42, 0x0, 1, 100000, {from: taskGiver, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })    
    

    it("should get vm parameters", async () => {
	let p = await incentiveLayer.getVMParameters.call(taskID)
	let params = {
	    stackSize: p[0],
	    memorySize: p[1],
	    globalsSize: p[2],
	    tableSize: p[3],
	    callSize: p[4]
	}

	//Testing for default parameters
	assert.equal(params.stackSize, 14)
	assert.equal(params.memorySize, 16)
	assert.equal(params.globalsSize, 8)
	assert.equal(params.tableSize, 8)
	assert.equal(params.callSize, 10)
    })

    it("should get task info", async () => {
	let t = await incentiveLayer.getTaskInfo.call(taskID)

	let taskInfo = {
	    taskGiver: t[0],
	    taskInitHash: t[1],
	    codeType: t[2],
	    storageType: t[3],
	    storageAddress: t[4],
	    taskID: t[5]
	}

	assert.equal(taskInfo.taskGiver, taskGiver.toLowerCase())
	assert.equal(taskInfo.taskInitHash, 0x0)
	assert.equal(taskInfo.codeType, 0)
	assert.equal(taskInfo.storageType, 0)
	assert.equal(taskInfo.taskID, taskID)
    })

    it("should reject registering for a task with no deposit", async () => {
	return incentiveLayer.registerForTask(taskID, randomBitsHash, {from: dummy, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })    
    
    it("solver should register for task", async () => {
	
	let tx = await incentiveLayer.registerForTask(taskID, randomBitsHash, {from: solver, gas: 300000})

	let log

        log = tx.logs.find(log => log.event === 'DepositBonded')
	
        assert.equal(log.args.taskID, taskID)
        assert.equal(log.args.account, solver.toLowerCase())
        assert(log.args.amount.eq(3))

        log = tx.logs.find(log => log.event === 'SolverSelected')

        assert.equal(log.args.taskID, taskID)
        assert.equal(log.args.solver, solver.toLowerCase())
        assert.equal(log.args.taskData, 0x0)        
	assert.equal(log.args.randomBitsHash, randomBitsHash)

	assert.equal(log.args.minDeposit.toNumber(), 3)
	
    })

    it("should reject registering for a task because solver has been selected", async () => {
	return incentiveLayer.registerForTask(taskID, randomBitsHash, {from: verifier, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })

    it("should reject committing solution because not selected solver", async () => {
	return incentiveLayer.commitSolution(taskID, solutionCommit, {from: verifier, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })

    it("solver should commit a solution", async () => {
		let tx = await incentiveLayer.commitSolution(taskID, solutionCommit, {from: solver, gas: 300000})

	let log = tx.logs.find(log => log.event === 'SolutionsCommitted')

	assert(log.args.taskID)
	assert(log.args.minDeposit)
	assert(log.args.storageAddress == 0x0)
	assert(log.args.storageType)
	assert(log.args.codeType)
    })

    it("should reject committing solution again", async () => {
	return incentiveLayer.commitSolution(taskID, solutionCommit, {from: solver, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })

    it("should end challenge period", async () => {
	assert(!(await incentiveLayer.endChallengePeriod.call(taskID)))
	
	await mineBlocks(web3, 110)
	
	assert(await incentiveLayer.endChallengePeriod.call(taskID))
	await incentiveLayer.endChallengePeriod(taskID, {from: solver})
    })

    it("should end reveal period", async () => {
	assert(!(await incentiveLayer.endRevealPeriod.call(taskID)))
	
	await mineBlocks(web3, 110)
	
	assert(await incentiveLayer.endRevealPeriod.call(taskID))
	await incentiveLayer.endRevealPeriod(taskID, {from: solver})
    })

    it("should reject revealing solution if not selected solver", async () => {	
	return incentiveLayer.revealSolution(taskID, randomBits, 0x0, 0x0, 0x0, 0x0, {from: verifier, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })

    it("should reject revealing solution if not correct random bits", async () => {	
	return incentiveLayer.revealSolution(taskID, 12345, 0x0, 0x0, 0x0, 0x0, {from: solver, gas: 300000})
	    .then(
		() => Promise.reject(new Error('Expected method to reject')),
		err => assert(err instanceof Error)
	    )
    })    

    it("should reveal solution", async () => {
	let tx = await incentiveLayer.revealSolution(taskID, randomBits, 0x0, 0x0, 0x0, 0x0, {from: solver, gas: 300000})

	let log = tx.logs.find(log => log.event === 'SolutionRevealed')

	assert(log.args.taskID)
	assert(log.args.randomBits)
    })

    it("should get solution info", async () => {
		let s = await incentiveLayer.getSolutionInfo.call(taskID) 
	
		let solutionInfo = {
			taskID: s[0],
			solutionHash0: s[1],
			solutionCommit: s[2],
			taskInitHash: s[3],
			codeType: s[4],
			storageType: s[5],
			storageAddress: s[6],
			solver: s[7]
		}
	
		assert.equal(solutionInfo.taskID, taskID)
		assert.equal(solutionInfo.solutionCommit, solutionCommit)
		assert.equal(solutionInfo.solutionHash0, solution0Hash)
		assert.equal(solutionInfo.taskInitHash, 0x0)
		assert.equal(solutionInfo.codeType, 0)
		assert.equal(solutionInfo.storageType, 0)
		assert.equal(solutionInfo.storageAddress, 0x0)
		assert.equal(solutionInfo.solver, solver.toLowerCase())
		})
	
    // describe("forced error mechanism", async () => {

    // 	const n = 1000
    // 	let count = 0

    // 	before(async () => {
    // 	    for(let i = 0; i < n; i++) {
    // 		let r = Math.floor((Math.random() * 100000) + 1)
    // 		let hash = web3.utils.soliditySha3(r)
    // 		if(await incentiveLayer.isForcedError.call(r, hash)) count++
    // 	    }
    // 	})

    // 	it("should have forced error rate above 45%", () => {
    // 	    console.log(count + " forced errors out of " + n)
    // 	    assert((count / n) > 0.45)
    // 	})
    // })
    
})
