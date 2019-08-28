
const fs = require('fs')

const host = "http://localhost:8545"
const ipfs = require('ipfs-api')("localhost", '5001', {protocol: 'http'})

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))

const getNetwork = require('truebit-util').getNetwork
const merkleRoot = require('truebit-util').merkleRoot.web3

async function addIPFSFile(tbFileSystem, account, name, buf) {
    let ipfsFile = (await ipfs.files.add([{content: buf, path: name}]))[0]

    let ipfsHash = ipfsFile.hash
    let size = buf.length
    // let name = ipfsFile.path

    //setup file
    let fileNonce = Math.floor(Math.random()*Math.pow(2, 30))
    let mr = merkleRoot(web3, buf)

    let fileID = await tbFileSystem.methods.calcId(fileNonce).call({from: account})

    await tbFileSystem.methods.addIPFSFile(name, size, ipfsHash, mr, fileNonce).send({from: account, gas: 300000})

    console.log("Uploaded file", name, "with root", mr)

    return fileID
}

let account, fileSystem, sampleSubmitter

let timeout = async (ms) => new Promise((resolve, reject) => setTimeout(resolve, ms))

async function main() {
    let accounts = await web3.eth.getAccounts()
    account = accounts[0]
    let networkName = await getNetwork(web3)

    //get scrypt submitter artifact
    const artifacts = JSON.parse(fs.readFileSync("public/" + networkName + ".json"))

    fileSystem = new web3.eth.Contract(artifacts.fileSystem.abi, artifacts.fileSystem.address)
    sampleSubmitter = new web3.eth.Contract(artifacts.sample.abi, artifacts.sample.address)
    let fname = process.argv[2] || "input.ts"
    console.log("validating video clip", fname)

    let wasmFile = await addIPFSFile(fileSystem, account, "input.ts", fs.readFileSync(fname))

    await sampleSubmitter.methods.submitData(wasmFile).send({ gas: 2000000, from: account })
    let solution = "0x0000000000000000000000000000000000000000000000000000000000000000"
    while (solution == "0x0000000000000000000000000000000000000000000000000000000000000000") {
        await timeout(1000)
        solution = await sampleSubmitter.methods.getResult(wasmFile).call()
    }
    console.log("Got solution", solution)
}

main()
