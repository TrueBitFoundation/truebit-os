const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const merkleComputer = require('./merkle-computer')('./../wasm-client/ocaml-offchain/interpreter/wasm')
const assert = require('assert')
const path = require('path')

const contractsConfig = JSON.parse(fs.readFileSync(__dirname + "/contracts.json"))

function setup(httpProvider) {
    return (async () => {
        let incentiveLayer = await contract(httpProvider, contractsConfig['incentiveLayer'])
        let fileSystem = await contract(httpProvider, contractsConfig['fileSystem'])
        let tru = await contract(httpProvider, contractsConfig['tru'])
        return [incentiveLayer, fileSystem, tru]
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
    "IPFS": merkleComputer.StorageType.IPFS
}

const readFile = (filepath) => {
    return new Promise((resolve, reject) => {
	fs.readFile(filepath, (err, res) => {
	    if (err) reject(err)
	    else resolve(res)
	})
    }) 
}

const writeFile = (filepath, buf) => {
    return new Promise((resolve, reject) => {
	fs.writeFile(filepath, buf, (err) => {
	    if (err) reject(err)
	    else { resolve() }
	})
    })
}

module.exports = async (web3, logger, mcFileSystem) => {

    let contracts = await setup(web3.currentProvider)

    //Two filesystems (which may be confusing)
    //tbFileSystem is the Truebit filesystem contract
    //mcFileSystem is a module for ipfs helpers from merkleComputer module

    incentiveLayer = contracts[0]
    tbFileSystem = contracts[1]
    tru = contracts[2]

    async function uploadOnchain(codeData, options) {
        return merkleComputer.uploadOnchain(codeData, web3, options)
    }

    async function getInitHash(config, path) {

        vm = merkleComputer.init(config, path)

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

    async function getCodeRoot(config, path) {	

        vm = merkleComputer.init(config, path)

        let interpreterArgs = []

        let codeRoot = (await vm.initializeWasmTask(interpreterArgs)).vm.code

        return codeRoot
    }

    async function uploadIPFS(codeBuf, config, from, dirPath) {
        assert(Buffer.isBuffer(codeBuf))

        let bundleID = await tbFileSystem.makeBundle.call(
            Math.floor(Math.random()*Math.pow(2, 60)),
            {from: from}
        )

        let ipfsHash = (await mcFileSystem.upload(codeBuf, "task.wast"))[0].hash

        let randomNum = Math.floor(Math.random()*Math.pow(2, 60))
        let size = codeBuf.byteLength
        let codeRoot = await getCodeRoot(config, dirPath)

        await tbFileSystem.finalizeBundleIPFS(bundleID, ipfsHash, codeRoot, {from: from, gas: 1500000})

        let initHash = await tbFileSystem.getInitHash.call(bundleID)

        return [bundleID, initHash]
    }

    async function uploadIPFSFiles(codeBuf, config, from, dirPath) {
        assert(Buffer.isBuffer(codeBuf))

        let bundleID = await tbFileSystem.makeBundle.call(
            Math.floor(Math.random()*Math.pow(2, 60)),
            {from: from}
        )

        let newFiles = []

        for(let i = 0; i < config.files.length; i++) {
            let filePath = config.files[i]
            let fileBuf = await readFile(process.cwd() + filePath)

            let fileName = path.basename(filePath)
            newFiles.push(fileName)
            await writeFile(dirPath + "/" + fileName, fileBuf)

            let fileSize = fileBuf.byteLength
            let fileRoot = merkleComputer.merkleRoot(web3, fileBuf)

            let fileNonce = Math.floor(Math.random()*Math.pow(2, 60))

            let fileIPFSHash = (await mcFileSystem.upload(fileBuf, "bundle/" + fileName))[0].hash

            let fileID = await tbFileSystem.addIPFSFile.call(
                fileName,
                fileSize,
                fileIPFSHash,
                fileRoot,
                fileNonce,
                {from: from}
            )

            await tbFileSystem.addIPFSFile(
                fileName,
                fileSize,
                fileIPFSHash,
                fileRoot,
                fileNonce,
                {from: from, gas: 200000}
            )

            await tbFileSystem.addToBundle(bundleID, fileID, {from: from})	    	    
        }

        config.files = newFiles

        let ipfsHash = (await mcFileSystem.upload(codeBuf, "task.wast"))[0].hash

        let randomNum = Math.floor(Math.random()*Math.pow(2, 60))
        let size = codeBuf.byteLength
        let codeRoot = await getCodeRoot(config, dirPath)

        await tbFileSystem.finalizeBundleIPFS(bundleID, ipfsHash, codeRoot, {from: from, gas: 1500000})

        let initHash = await tbFileSystem.getInitHash.call(bundleID)

        return [bundleID, initHash]
    }

    //This also creates a directory for the random path if it doesnt exist
    
    function setupTaskConfiguration(task) {
        task["codeType"] = typeTable[task.codeType]

        if (!task.files) {
            task["files"] = []
        }

        if (!task.inputFile) {
            task["inputFile"] = ""
        } else {
            task["inputFile"] = process.cwd() + task.inputFile
        }

        let codeBuf = fs.readFileSync(process.cwd() + task.codeFile)

        let randomPath = process.cwd() + "/tmp.giver_" + Math.floor(Math.random()*Math.pow(2, 60)).toString(32)

        if (!fs.existsSync(randomPath)) fs.mkdirSync(randomPath)
	fs.writeFileSync(randomPath + "/" + path.basename(task.codeFile), codeBuf)
	

        let config = {
            code_file: path.basename(task.codeFile),
            input_file: task.inputFile,
            actor: {},
            files: task.files,
            code_type: task.codeType
        }

	return [config, randomPath, codeBuf]
	
    }

    return {

	getInitialHash: async (task) => {
            //verifyTaskFormat(task)

	    let [config, randomPath, codeBuf] = setupTaskConfiguration(task)

	    let initHash

	    if (task.files == []) {
		initHash = await getInitHash(config, randomPath) 
	    } else {
		initHash = await getInitHash(config, randomPath)
	    }

	    return initHash
	    
	},

        submitTask: async (task) => {

	    let [config, randomPath, codeBuf] = setupTaskConfiguration(task)

            if(task.storageType == "IPFS") {

                if(task.files == []) {
                    let [bundleID, initHash] = await uploadIPFS(codeBuf, config, task.from, randomPath)

                    task["storageAddress"] = bundleID
                    task["initHash"] = initHash

                } else {
                    let [bundleID, initHash] = await uploadIPFSFiles(codeBuf, config, task.from, randomPath)
                    task["storageAddress"] = bundleID
                    task["initHash"] = initHash
                }

		logger.log({
		    level: 'info',
		    message: `Uploaded data to IPFS`
		})		

            } else { //store file on blockchain

                let contractAddress = await uploadOnchain(codeBuf, {from: task.from, gas: 400000})

		logger.log({
		    level: 'info',
		    message: `Uploaded data onchain`
		})		

                task["initHash"] = await getInitHash(config, randomPath)

                let bundleID = await makeSimpleBundle({
                    from: task.from,
                    gas: 350000,
                    initHash: task.initHash,
                    contractAddress: contractAddress
                })

		logger.log({
		    level: 'info',
		    message: `Registered deployed contract with truebit filesystem`
		})

                task["storageAddress"] = bundleID
            }

            //translate storage type	    
            task["storageType"] = typeTable[task.storageType]
            
            //bond minimum deposit
            task["minDeposit"] = web3.utils.toWei(task.minDeposit, 'ether')
            await depositsHelper(web3, incentiveLayer, tru, task.from, task.minDeposit)
	    
	    logger.log({ level: 'info', message: `Minimum deposit was met`})			 

            var id = await incentiveLayer.createTask(
                task.initHash,
                task.codeType,
                task.storageType,
                task.storageAddress,
                1, //TODO: set maxDifficulty 
                1,  //TODO: set Reward
                {gas: 1000000, from: task.from}
            )

	    logger.log({
		level: 'info',
		message: 'Task was created'
	    })
            
            return id

        }
    }
}
