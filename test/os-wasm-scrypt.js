const assert = require('assert')

const timeout = require('../os/lib/util/timeout')

const BigNumber = require('bignumber.js')

const mineBlocks = require('../os/lib/util/mineBlocks')

const fs = require('fs')

const logger = require('../os/logger')
const contract = require('../wasm-client/contractHelper')
var truffle_contract = require("truffle-contract");

const contractsConfig = require('../wasm-client/util/contractsConfig')
const merkleComputer = require('../wasm-client/merkle-computer')()

let os, accounting

const config = JSON.parse(fs.readFileSync("./wasm-client/config.json"))
const info = JSON.parse(fs.readFileSync("./scrypt-data/info.json"))

let account
let web3

const ipfs = require('ipfs-api')(config.ipfs.host, '5001', { protocol: 'http' })
const fileSystem = merkleComputer.fileSystem(ipfs)

before(async () => {
	os = await require('../os/kernel')("./wasm-client/config.json")
	accounting = await require('../os/lib/util/accounting')(os)

	account = os.accounts[0]
	web3 = os.web3
})

describe('Truebit OS WASM Scrypt test', async function () {
	this.timeout(600000)

	it('should have a logger', () => {
		assert(os.logger)
	})

	it('should have a web3', () => {
		assert(os.web3)
	})

	it('should have a solver', () => {
		assert(os.solver)
	})

	let tbFilesystem, cpu

	describe('Normal task lifecycle', async () => {
		let killSolver

		let initStateHash, bundleID, cConfig, codeFileID, taskID

		before(async () => {
			cConfig = await contractsConfig(web3)
			tbFilesystem = await contract(web3.currentProvider, cConfig['fileSystem'])
			cpu = await contract(web3.currentProvider, cConfig['cpu'])
			killSolver = await os.solver.init(os, os.accounts[1])

			tgBalanceEth = await accounting.ethBalance(account)
			sBalanceEth = await accounting.ethBalance(os.accounts[1])

			tgBalanceTru = await accounting.truBalance(account)
			sBalanceTru = await accounting.truBalance(os.accounts[1])
		})

		after(async () => {
			killSolver()

			await accounting.ethReportDif(tgBalanceEth, account, "TaskGiver")
			await accounting.ethReportDif(sBalanceEth, os.accounts[1], "Solver")

			await accounting.truReportDif(tgBalanceTru, account, "TaskGiver")
			await accounting.truReportDif(sBalanceTru, os.accounts[1], "Solver")

		})

		it('should upload task code', async () => {
			let codeBuf = fs.readFileSync("./scrypt-data/task.wasm")
			let ipfsFile = (await fileSystem.upload(codeBuf, "task.wasm"))[0]

			let ipfsHash = ipfsFile.hash
			let size = ipfsFile.size
			let name = ipfsFile.path

			let merkleRoot = merkleComputer.merkleRoot(os.web3, codeBuf)
			let nonce = Math.floor(Math.random() * Math.pow(2, 60))

			assert.equal(ipfsHash, info.ipfshash)

			codeFileID = await tbFilesystem.calcId.call(nonce, {from:account})

			await tbFilesystem.addIPFSCodeFile(name, size, ipfsHash, merkleRoot, info.codehash, nonce, { from: account, gas: 300000 })
		})

		let scrypt_contract
		let scrypt_result

		async function deployContract(abi, bin, args = [], options = {}) {
			let contract = new web3.eth.Contract(abi)
			return await contract
				.deploy({ data: "0x" + bin, arguments: args })
				.send(options)
		}

		it('should deploy test contract', async () => {

			let abi = JSON.parse(fs.readFileSync("./scrypt-data/compiled/Scrypt.abi"))

			let contr = await deployContract(
				abi,
				fs.readFileSync("./scrypt-data/compiled/Scrypt.bin"),
				[cConfig.incentiveLayer.address, cConfig.cpu.address, cConfig.fileSystem.address, codeFileID, info.codehash],
				{ from: account, gas: 2000000 })
			
			scrypt_contract = await contract(web3.currentProvider, {abi:abi, address:contr.options.address})

			let result_event = scrypt_contract.GotFiles()
			result_event.watch(async (err, result) => {
				console.log("got event, file ID", result.args.files[0])
				result_event.stopWatching(data => { })
				let fileid = result.args.files[0]
				var lst = await tbFilesystem.getData(fileid)
				console.log("got stuff", lst)
				scrypt_result = lst[0]
			})
			await cpu.mint(scrypt_contract.address, "100000000000", { from: account, gas: 200000 })
		})

		it('should submit task', async () => {
			await scrypt_contract.submitData("testing", { from: account, gas: 2000000 })
		})

		it('wait for task', async () => {

			await timeout(25000)
			await mineBlocks(os.web3, 20)
			await timeout(5000)
			await mineBlocks(os.web3, 20)
			await timeout(5000)

			await mineBlocks(os.web3, 10)
			await timeout(5000)

			assert.equal(scrypt_result, '0x78b512d6425a6fe9e45baf14603bfce1c875a6962db18cc12ecf4292dbd51da6')

		})

	})
})
