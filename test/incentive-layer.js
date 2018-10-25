const assert = require('assert')
const fs = require('fs')
const contractsConfig = require('../wasm-client/util/contractsConfig')
const contract = require('../wasm-client/contractHelper')

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

    let incentiveLayer, tru, taskGiver, solver, verifier, minDeposit, accounts, taskID

    before(async () => {
	let os = await require('../os/kernel')('./wasm-client/config.json')

	let contracts = await setup(os.web3)

	incentiveLayer = contracts[0]
	tru = contracts[1]

	taskGiver = os.accounts[0]
	solver = os.accounts[1]
	verifier = os.accounts[2]

	accounts = [taskGiver, solver, verifier]

	minDeposit = 100000

	for(let account of accounts) {
	    await tru.approve(incentiveLayer.address, minDeposit, { from: account })
	}

    })

    it("participants should make a deposit", async () => {

	for(let account of accounts) {

	    let deposit

	    deposit = (await incentiveLayer.getDeposit.call(taskGiver)).toNumber()

	    if (deposit < minDeposit) {
		await incentiveLayer.makeDeposit(minDeposit, { from: account })
	    }	    	    
	    
	    deposit = (await incentiveLayer.getDeposit.call(taskGiver)).toNumber()

	    assert(deposit > 1)
	    
	}	
	
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
	assert(log.args.minDeposit.toNumber() == 3)
	assert(log.args.tax.toNumber() == (log.args.minDeposit.toNumber() * 5))

	taskID = log.args.taskID
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
    
    
})
