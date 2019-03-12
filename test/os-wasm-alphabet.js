const assert = require('assert')

const timeout = require('../os/lib/util/timeout')

const BigNumber = require('bignumber.js')

const mineBlocks = require('../os/lib/util/mineBlocks')

const fs = require('fs')

const logger = require('../os/logger')

let os, accounting

let taskSubmitter

before(async () => {
    os = await require('../os/kernel')("./wasm-client/config.json")
    accounting = await require('../os/lib/util/accounting')(os)    
})

describe('Truebit OS WASM Alphabet', async function() {
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
    
    describe('Normal task lifecycle', async () => {
	let killTaskGiver
	let killSolver
	let killVerifier

	let taskID
	
	let tgBalanceEth, sBalanceEth, tgBalanceTru, sBalanceTru

	let storageAddress, initStateHash, bundleID
	

	before(async () => {
	    taskSubmitter = await require('../wasm-client/taskSubmitter')(os.web3, os.logger, os.fileSystem)
	    
	    killTaskGiver = await os.taskGiver.init(os.web3, os.accounts[0], os.logger)
	    killSolver = await os.solver.init(os, os.accounts[1])

	    tgBalanceEth = await accounting.ethBalance(os.accounts[0])
	    sBalanceEth = await accounting.ethBalance(os.accounts[1])

	    tgBalanceTru = await accounting.truBalance(os.accounts[0])
	    sBalanceTru = await accounting.truBalance(os.accounts[1])
	    
	})

	after(async () => {
	    killTaskGiver()
	    killSolver()

	    await accounting.ethReportDif(tgBalanceEth, os.accounts[0], "TaskGiver")
	    await accounting.ethReportDif(sBalanceEth, os.accounts[1], "Solver")

	    await accounting.truReportDif(tgBalanceTru, os.accounts[0], "TaskGiver")
	    await accounting.truReportDif(sBalanceTru, os.accounts[1], "Solver")
	    
	})

	it('should submit task', async () => {

	    let exampleTask = {
		"minDeposit": "1",
		"codeType": "WASM",
		"storageType": "IPFS",
		"codeFile": "/data/reverse_alphabet.wasm",
		"reward": "1",
		"maxDifficulty": "1",
		"files": ["/data/alphabet.txt", "/data/reverse_alphabet.txt"]
	    }

	    //simulate cli by adding from account and translate reward

	    exampleTask["from"] = os.accounts[0]	    

	    await taskSubmitter.submitTask(exampleTask)

	    await timeout(8000)
	    await mineBlocks(os.web3, 20)
	    await timeout(5000)
	    await mineBlocks(os.web3, 20)
	    await timeout(10000)
	    
	    let tasks = os.taskGiver.getTasks()
	    //taskID = Object.keys(tasks)[0]
	    assert(Object.keys(os.taskGiver.getTasks()))
	})
	
    })
})
