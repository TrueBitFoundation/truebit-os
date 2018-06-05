const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const merkleComputer = require(__dirname + '/webasm-solidity/merkle-computer')
const assert = require('assert')

module.exports = (web3, logger) => {
    const wasmClientConfig = JSON.parse(fs.readFileSync(__dirname + "/webasm-solidity/export/development.json"))

    function setup(httpProvider) {
	return (async () => {
	    incentiveLayer = await contract(httpProvider, wasmClientConfig['tasks'])
	    return incentiveLayer
	})()
    }

    function verifyTaskFormat(task) {
	assert(task.from != undefined)
	assert(task.minDeposit != undefined)
	assert(task.initStateHash != undefined)
	assert(task.codeType != undefined)
	assert(task.storageType != undefined)
	assert(task.storageAddress != undefined)
	assert(task.gas != undefined)
    }

    return {

	uploadOnchain: async (codeData, options) => {
	    return merkleComputer.uploadOnchain(codeData, web3, options)
	},

	getInitStateHash: async (config) => {
	    let randomPath = process.cwd() + "/tmp.giver_" + Math.floor(Math.random()*Math.pow(2, 60)).toString(32)

	    vm = merkleComputer.init(config, randomPath)

	    let interpreterArgs = []

	    let initStateHash = (await vm.initializeWasmTask(interpreterArgs)).hash
	    return initStateHash
	},
	
	submitTask: async (task) => {
	    let incentiveLayer = await setup(web3.currentProvider)

	    verifyTaskFormat(task)

	    await depositsHelper(web3, incentiveLayer, task.from, task.minDeposit)

	    return await incentiveLayer.add(
		task.initStateHash,
		task.codeType,
		task.storageType,
		task.storageAddress,
		{from: task.from, gas: task.gas}
	    )
	}
    }
}
