const fs = require('fs')
const contract = require('./contractHelper')
const assert = require('assert')
const path = require('path')

const contractsConfig = require('./util/contractsConfig')

function isString(n) {
    return typeof n == 'string' || n instanceof String
}

async function setup(web3) {
    const httpProvider = web3.currentProvider
    const config = await contractsConfig(web3)
    let incentiveLayer = await contract(httpProvider, config['ss_incentiveLayer'])
    let fileSystem = await contract(httpProvider, config['fileSystem'])
    return [incentiveLayer, fileSystem]
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


    const merkleComputer = require('./merkle-computer')(logger, './../wasm-client/ocaml-offchain/interpreter/wasm')

    const typeTable = {
        "WAST": merkleComputer.CodeType.WAST,
        "WASM": merkleComputer.CodeType.WASM
    }

    let [incentiveLayer, tbFileSystem] = await setup(web3)

    //Two filesystems (which may be confusing)
    //tbFileSystem is the Truebit filesystem contract
    //mcFileSystem is a module for ipfs helpers from merkleComputer module


    async function uploadOnchain(codeData, options) {
        return merkleComputer.uploadOnchain(codeData, web3, options)
    }

    async function getInitHash(config, path) {

        vm = merkleComputer.init(config, path)

        let interpreterArgs = []

        let initHash = (await vm.initializeWasmTask(interpreterArgs)).hash

        return initHash
    }

    async function getCodeRoot(config, path) {

        vm = merkleComputer.init(config, path)

        let interpreterArgs = []

        let codeRoot = (await vm.initializeWasmTask(interpreterArgs)).vm.code

        return codeRoot
    }

    async function makeBundle(account) {
        let bundleNonce = Math.floor(Math.random() * Math.pow(2, 60))
        let bundleId = await tbFileSystem.calcId.call(bundleNonce, { from: account })

        await tbFileSystem.makeBundle(bundleNonce, { from: account, gas: 300000 })

        console.log("made bundle", bundleId)

        return bundleId
    }

    async function uploadIPFS(codeBuf, config, from, dirPath) {
        assert(Buffer.isBuffer(codeBuf))

        let bundleID = await makeBundle(from)

        let ipfsFile = (await mcFileSystem.upload(codeBuf, "task.wast"))[0]

        let ipfsHash = ipfsFile.hash
        let name = ipfsFile.path

        let randomNum = Math.floor(Math.random() * Math.pow(2, 60))
        let size = codeBuf.byteLength
        let codeRoot = await getCodeRoot(config, dirPath)

        let fileRoot = merkleComputer.merkleRoot(web3, codeBuf)

        let codeFileID = await tbFileSystem.calcId.call(randomNum, { from: from })

        await tbFileSystem.addIPFSFile(name, size, ipfsHash, fileRoot, randomNum, { from: from, gas: 300000 })

        await tbFileSystem.setCodeRoot(codeFileID, codeRoot, { from: from, gas: 100000 })

        await tbFileSystem.finalizeBundle(bundleID, codeFileID)

        let initHash = await tbFileSystem.getInitHash.call(bundleID)

        return [bundleID, initHash]
    }

    async function uploadIPFSFiles(codeBuf, config, from, dirPath) {
        assert(Buffer.isBuffer(codeBuf))

        let bundleID = await makeBundle(from)

        let ipfsFile = (await mcFileSystem.upload(codeBuf, "task.wast"))[0]

        let ipfsHash = ipfsFile.hash
        let codeName = ipfsFile.path
        let codeSize = ipfsFile.size

        let newFiles = []

        for (let i = 0; i < config.files.length; i++) {
            let filePath = config.files[i]
            let fileBuf = await readFile(process.cwd() + filePath)

            let fileName = path.basename(filePath)
            let newFilePath = dirPath + "/" + fileName
            newFiles.push(newFilePath)

            await writeFile(newFilePath, fileBuf)

            let fileSize = fileBuf.byteLength
            let fileRoot = merkleComputer.merkleRoot(web3, fileBuf)

            let fileNonce = Math.floor(Math.random() * Math.pow(2, 60))

            let fileIPFSHash = (await mcFileSystem.upload(fileBuf, "bundle/" + fileName))[0].hash

            let fileID = await tbFileSystem.calcId.call(fileNonce, { from: from })

            await tbFileSystem.addIPFSFile(
                fileName,
                fileSize,
                fileIPFSHash,
                fileRoot,
                fileNonce,
                { from: from, gas: 200000 }
            )

            await tbFileSystem.addToBundle(bundleID, fileID, { from: from })
        }

        let randomNum = Math.floor(Math.random() * Math.pow(2, 60))
        let codeFileId = await tbFileSystem.calcId(randomNum, { from: from })

        config.files = newFiles

        let codeRoot = await getCodeRoot(config, dirPath)
        let fileRoot = merkleComputer.merkleRoot(web3, codeBuf)

        await tbFileSystem.addIPFSCodeFile(codeName, codeSize, ipfsHash, fileRoot, codeRoot, randomNum, { from: from, gas: 300000 })

        await tbFileSystem.finalizeBundle(bundleID, codeFileId, { from: from, gas: 1500000 })

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

        let randomPath = process.cwd() + "/tmp.giver_" + Math.floor(Math.random() * Math.pow(2, 60)).toString(32)

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

    async function submitTask_aux(task) {

        let [config, randomPath, codeBuf] = setupTaskConfiguration(task)

        if (task.storageType == "IPFS") {

            if (task.files == []) {
                let [bundleID, initHash] = await uploadIPFS(codeBuf, config, task.from, randomPath)

                task["bundleID"] = bundleID
                task["initHash"] = initHash
            } else {
                let [bundleID, initHash] = await uploadIPFSFiles(codeBuf, config, task.from, randomPath)
                task["bundleID"] = bundleID
                task["initHash"] = initHash
            }

            logger.log({
                level: 'info',
                message: `Uploaded data to IPFS`
            })

        } else { //store file on blockchain

            let contractAddress = await uploadOnchain(codeBuf, { from: task.from, gas: 4000000 })

            logger.log({
                level: 'info',
                message: `Uploaded data onchain`
            })

            let codeRoot = await getCodeRoot(config, randomPath)
            let fileRoot = merkleComputer.merkleRoot(web3, codeBuf)
            let codeFileNonce = Math.floor(Math.random() * Math.pow(2, 60))
            let codeFileId = await tbFileSystem.calcId.call(codeFileNonce, { from: task.from })
            // let codeFileId2 = await tbFileSystem.calcId.call(codeFileNonce)
            // console.log("code file nonce", codeFileNonce, codeFileId, codeFileId2, task.from)

            let size = Buffer.byteLength(codeBuf, 'utf8');

            await tbFileSystem.addContractFile("task.wasm", codeFileNonce, contractAddress, fileRoot, size, { from: task.from, gas: 300000 })
            await tbFileSystem.setCodeRoot(codeFileId, codeRoot, { from: task.from, gas: 100000 })

            let bundleID = await makeBundle(task.from)

            await tbFileSystem.finalizeBundle(bundleID, codeFileId, { from: task.from, gas: 3000000 })
            let initHash = await tbFileSystem.finalizeBundle.call(bundleID, codeFileId, { from: task.from, gas: 3000000 })

            logger.log({
                level: 'info',
                message: `Registered deployed contract with truebit filesystem`
            })

            task["bundleID"] = bundleID
            task["initHash"] = initHash
        }

        task.reward = web3.utils.toWei(task.reward, 'ether')

        logger.log({ level: 'info', message: `Submitting task` })

        console.log(task.initHash,
            task.codeType,
            task.bundleId,
            1)

        var id = await incentiveLayer.createTask(
            task.initHash,
            task.codeType,
            task.bundleID,
            1,
            { gas: 1000000, from: task.from, value: task.reward }
        )

        logger.log({
            level: 'info',
            message: 'Task was created'
        })

        return id

    }

    return {

        getInitialHash: async (task) => {

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
            try {
                return await submitTask_aux(task)
            }
            catch (e) {
                logger.error(`Cannot create task: ${e}`)
            }
        }
    }
}
