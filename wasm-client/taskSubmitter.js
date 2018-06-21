const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const merkleComputer = require(__dirname + '/webasm-solidity/merkle-computer')()
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
    assert(task.codeType != undefined)
    assert(task.storageType != undefined)
    assert(task.reward != undefined)
}

function verifyBundlePayloadFormat(bundlePayload) {
    assert(bundlePayload.from != undefined)
    assert(bundlePayload.gas != undefined)
    assert(bundlePayload.contractAddress != undefined)
    assert(bundlePayload.initHash != undefined)
}

const typeTable = {
    "WAST": merkleComputer.CodeType.WAST,
    "WASM": merkleComputer.CodeType.WASM,
    "BLOCKCHAIN": merkleComputer.StorageType.BLOCKCHAIN,
    "IPFS": merkleComputer.StorageType.WASM
}

module.exports = async (web3, logger, mcFileSystem) => {

    let contracts = await setup(web3.currentProvider)

    //Two filesystems (which may be confusing)
    //tbFileSystem is the Truebit filesystem contract
    //mcFileSystem is a module for ipfs helpers from merkleComputer module

    incentiveLayer = contracts[0]
    tbFileSystem = contracts[1]

    async function uploadOnchain(codeData, options) {
	    return merkleComputer.uploadOnchain(codeData, web3, options)
	}

	async function getInitHash(config) {
	    let randomPath = process.cwd() + "/tmp.giver_" + Math.floor(Math.random()*Math.pow(2, 60)).toString(32)

	    vm = merkleComputer.init(config, randomPath)

	    let interpreterArgs = []

	    let initHash = (await vm.initializeWasmTask(interpreterArgs)).hash
	    return initHash
	}

	async function makeSimpleBundle(bundlePayload) {
	    if(!bundlePayload.fileHash) {
		bundlePayload["fileHash"] = "0x00"
	    }

	    verifyBundlePayloadFormat(bundlePayload)

	    let randomNum = Math.floor(Math.random()*Math.pow(2, 60))

	    let bundleID = await fileSystem.calcId.call(randomNum, {from: bundlePayload.from})
	    let tx = await fileSystem.makeSimpleBundle(
		randomNum,
		bundlePayload.contractAddress,
		bundlePayload.initHash,
		bundlePayload.fileHash,
		{from: bundlePayload.from, gas: bundlePayload.gas}
	    )

	    return bundleID
	}

	async function uploadIPFS(fileName, dataBuf, from) {
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

	    //await tbFileSystem.finalizeBundleIPFS(bundleID, ipfsHash, root, {from: from, gas: 1500000})

	    //let initHash = await tbFileSystem.getInitHash.call(bundleID)

	    return bundleID
	}

    return {
	
	submitTask: async (task) => {

	    //verifyTaskFormat(task)
	    
	    //get initial hash
	    let config = {
		code_file: process.cwd() + task.codeFile,
		input_file: "",
		actor: {},
		files: []
	    }

	    if(task.storageType == "IPFS") {
	    } else { //store file on blockchain
		codeBuf = fs.readFileSync(process.cwd() + task.codeFile)
		
		let contractAddress = await uploadOnchain(codeBuf, {from: task.from, gas: 400000})

		task["initHash"] = await getInitHash(config)

		//register deployed contract with truebit filesystem
		let bundleID = await makeSimpleBundle({
		    from: task.from,
		    gas: 200000,
		    initHash: task.initHash,
		    contractAddress: contractAddress
		})

		task["storageAddress"] = bundleID
	    }

	    //translate types
	    task["codeType"] = typeTable[task.codeType]
	    task["storageType"] = typeTable[task.storageType]

	    //bond minimum deposit
	    task["minDeposit"] = web3.utils.toWei(task.minDeposit, 'ether')
	    await depositsHelper(web3, incentiveLayer, task.from, task.minDeposit)

	    return await incentiveLayer.add(
		task.initHash,
		task.codeType,
		task.storageType,
		task.storageAddress,
		{from: task.from, gas: 350000}
	    )
	}
    }
}
