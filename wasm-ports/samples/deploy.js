const fs = require('fs')

const ipfs = require('ipfs-api')("localhost", '5001', { protocol: 'http' })

let abi = JSON.parse(fs.readFileSync('./build/SampleContract.abi'))
let bin = fs.readFileSync('./build/SampleContract.bin')

let info = JSON.parse(fs.readFileSync('./info.json'))

const host = "http://localhost:8545"

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))

const merkleRoot = require('truebit-util').merkleRoot.web3

const getNetwork = require('truebit-util').getNetwork

async function addIPFSFile(tbFileSystem, account, name, buf) {
    let ipfsFile = (await ipfs.files.add([{ content: buf, path: name }]))[0]

    let ipfsHash = ipfsFile.hash
    let size = buf.length
    // let name = ipfsFile.path

    //setup file
    let fileNonce = Math.floor(Math.random() * Math.pow(2, 30))
    let mr = merkleRoot(web3, buf)

    let fileID = await tbFileSystem.methods.calcId(fileNonce).call({ from: account })

    await tbFileSystem.methods.addIPFSFile(name, size, ipfsHash, mr, fileNonce).send({ from: account, gas: 300000 })

    console.log("Uploaded file", name, "with root", mr)

    return fileID
}

async function deploy() {

    //Upload file to IPFS
    let codeBuf = fs.readFileSync("./task.wasm")

    let ipfsFile = (await ipfs.files.add([{ content: codeBuf, path: "task.wasm" }]))[0]

    console.log(ipfsFile)

    let ipfsHash = ipfsFile.hash
    let size = codeBuf.byteLength
    let name = ipfsFile.path

    //Deploy contract with appropriate artifacts

    let networkName = await getNetwork(web3)

    let artifacts = JSON.parse(fs.readFileSync('../../../wasm-client/' + networkName + '.json'))

    let accounts = await web3.eth.getAccounts()
    let account = accounts[0]

    let options = { from: accounts[0].toLowerCase(), gas: 4000000 }

    let bundleID, codeFileID
    let initHash = info.codehash

    let tbFileSystem = new web3.eth.Contract(artifacts.fileSystem.abi, artifacts.fileSystem.address)

    //setup bundle
    let bundleNonce = Math.floor(Math.random() * Math.pow(2, 30))
    bundleID = await tbFileSystem.methods.calcId(bundleNonce).call({ from: account })

    // await tbFileSystem.methods.makeBundle(bundleNonce).send({from: account, gas: 300000})

    let randomFile
    try {
        randomFile = await addIPFSFile(tbFileSystem, account, "_dev_urandom", fs.readFileSync("_dev_urandom"))
    }
    catch (e) {
        console.log("Random file does't exist")
    }

    //setup file
    let fileNonce = Math.floor(Math.random() * Math.pow(2, 30))
    let mr = merkleRoot(web3, codeBuf)

    codeFileID = await tbFileSystem.methods.calcId(fileNonce).call({ from: account })

    console.log("debug", name, size, ipfsHash, mr, initHash, fileNonce)

    await tbFileSystem.methods.addIPFSCodeFile(name, size, ipfsHash, mr, initHash, fileNonce).send({ from: account, gas: 300000 })

    console.log("Registered IPFS file with Truebit filesystem")

    let args = [
        artifacts.incentiveLayer.address,
        artifacts.cpu.address,
        artifacts.fileSystem.address,
        codeFileID,
        info.memsize,
        info.gas || 0
    ]

    if (randomFile) args.push(randomFile)

    let contract = new web3.eth.Contract(abi)

    let c = await contract.deploy({ data: "0x" + bin, arguments: args }).send(options)

    let cpu = new web3.eth.Contract(artifacts.cpu.abi, artifacts.cpu.address)

    cpu.methods.transfer(c.options.address, "100000000000000000000").send({ from: accounts[0], gas: 200000 })

    artifacts["sample"] = { address: c.options.address, abi: abi }

    fs.writeFileSync("public/" + networkName + ".json", JSON.stringify(artifacts))

    console.log("Contract has been deployed")
}

deploy()

