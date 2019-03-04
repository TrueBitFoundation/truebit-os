const assert = require('assert')
const timeout = require('../os/lib/util/timeout')
const BigNumber = require('bignumber.js')
const mineBlocks = require('../os/lib/util/mineBlocks')
const fs = require('fs')
const logger = require('../os/logger')

let os, accounting

let taskSubmitter

before(async () => {
	os = await require('../os/kernel')("./wasm-client/ss_config.json")
	accounting = await require('../os/lib/util/accounting')(os)
})

describe('Truebit OS WASM', async function () {
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

		let storageAddress, initStateHash


		before(async () => {
			taskSubmitter = await require('../wasm-client/ss_taskSubmitter')(os.web3, os.logger)

			killTaskGiver = await os.taskGiver.init(os.web3, os.accounts[1], os.logger)
			killSolver = await os.solver.init(os, os.accounts[0])

		})

		after(async () => {
			killTaskGiver()
			killSolver()

		})

		it('should submit task', async () => {

			let exampleTask = {
				"minDeposit": "1",
				"codeType": "WAST",
				"storageType": "BLOCKCHAIN",
				"codeFile": "/data/factorial.wast",
				"reward": "1",
				"maxDifficulty": "1"
			}

			//simulate cli by adding from account

			exampleTask["from"] = os.accounts[0]

			await taskSubmitter.submitTask(exampleTask)

			await timeout(8000)
			await mineBlocks(os.web3, 110)
			await timeout(5000)
			await mineBlocks(os.web3, 110)
			await timeout(5000)

			// let tasks = os.taskGiver.getTasks()
			//taskID = Object.keys(tasks)[0]
			// assert(Object.keys(os.taskGiver.getTasks()))
		})

	})
})
