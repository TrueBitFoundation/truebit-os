const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const merkleComputer = require(__dirname + '/webasm-solidity/merkle-computer')
const merkleRoot = require('./util/merkleRoot')
const assert = require('assert')

const wasmClientConfig = JSON.parse(fs.readFileSync(__dirname + "/webasm-solidity/export/development.json"))

function setup(httpProvider) {
    return (async () => {
	let incentiveLayer = await contract(httpProvider, wasmClientConfig['tasks'])
	let fileSystem = await contract(httpProvider, wasmClientConfig['filesystem'])
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

module.exports = async (web3, logger, mcFileSystem) => {

    let contracts = await setup(web3.currentProvider)

    incentiveLayer = contracts[0]
    tbFileSystem = contracts[1]

    //tbFileSystem is the Truebit filesystem contract
    //mcFileSystem is a module for ipfs helpers from merkleComputer module

    return {

	uploadIPFS: async (fileName, dataBuf, from) => {
	    assert(Buffer.isBuffer(dataBuf))

	    let bundleID = await tbFileSystem.makeBundle.call(
		Math.floor(Math.random()*Math.pow(2, 60)),
		{from: from}
	    )

	    let ipfsHash = (await mcFileSystem.upload(dataBuf, fileName))[0].hash
	    
	    let randomNum = Math.floor(Math.random()*Math.pow(2, 60))
	    let size = dataBuf.byteLength
	    let root = merkleRoot(web3, dataBuf)

	    let fileID = await tbFileSystem.addIPFSFile.call(
		fileName,
		size,
		ipfsHash,
		root,
		randomNum,
		{from: from}
	    )

	    await tbFileSystem.addIPFSFile(
		fileName,
		size,
		ipfsHash,
		root,
		randomNum,
		{from: from, gas: 200000}
	    )

	    await tbFileSystem.addToBundle(bundleID, fileID, {from: from})

	    await tbFileSystem.finalizeBundleIPFS(bundleID, ipfsHash, root, {from: from, gas: 1500000})

	    let initHash = await tbFileSystem.getInitHash.call(bundleID)

	    return [bundleID, initHash]
	},

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
	    let tx = await fileSystem.makeSimpleBundle(
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
