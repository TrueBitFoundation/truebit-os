const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const merkleComputer = require(__dirname + '/webasm-solidity/merkle-computer')
const assert = require('assert')

const wasmClientConfig = JSON.parse(fs.readFileSync(__dirname + "/webasm-solidity/export/development.json"))

function setup(httpProvider) {
    return (async () => {
	incentiveLayer = await contract(httpProvider, wasmClientConfig['tasks'])
	fileSystem = await contract(httpProvider, wasmClientConfig['filesystem'])
	return [incentiveLayer, fileSystem]
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

function verifyBundlePayloadFormat(bundlePayload) {
    assert(bundlePayload.from != undefined)
    assert(bundlePayload.gas != undefined)
    assert(bundlePayload.storageAddress != undefined)
    assert(bundlePayload.initStateHash != undefined)
}

module.exports = (web3, logger) => {

    let contracts = setup(web3.currentProvider)

    incentiveLayer = contracts[0]
    fileSystem = contracts[1]

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

	makeSimpleBundle: async (bundlePayload) => {
	    if(!bundlePayload.fileHash) {
		bundlePayload["fileHash"] = "0x00"
	    }

	    verifyBundlePayloadFormat(bundlePayload)

	    let randomNum = Math.floor(Math.random()*Math.pow(2, 60))

	    let bundleID = await fileSystem.calcId.call(randomNum, {from: bundlePayload.from})
	    await fileSystem.makeSimpleBundle(
		randomNum,
		bundlePayload.storageAddress,
		bundlePayload.initStateHash,
		bundlePayload.fileHash,
		{from: bundlePayload.from, gas: bundlePayload.gas}
	    )

	    return bundleID
	},
	
	submitTask: async (task) => {

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
