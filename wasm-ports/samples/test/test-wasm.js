
const fs = require('fs')

const host = "http://localhost:8545"
const assert = require('assert')

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))

const getNetwork = require('truebit-util').getNetwork
const merkleRoot = require('truebit-util').merkleRoot.web3

const ipfs = require('ipfs-api')("localhost", '5001', {protocol: 'http'})

let account, fileSystem, sampleSubmitter

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

before(async () => {
    let accounts = await web3.eth.getAccounts()
    account = accounts[0]
})

describe('Truebit WebAssembly validation test', async function() {
    this.timeout(600000)

    it('should have a web3', () => {
        assert(web3)
    })

    it('connect to contracts', async () => {
        let networkName = await getNetwork(web3)

        //get scrypt submitter artifact
	const artifacts = JSON.parse(fs.readFileSync("wasm/public/" + networkName + ".json"))

        fileSystem = new web3.eth.Contract(artifacts.fileSystem.abi, artifacts.fileSystem.address)
        sampleSubmitter = new web3.eth.Contract(artifacts.sample.abi, artifacts.sample.address)

    })

    let dta

    it('upload test file', async () => {
        dta = await addIPFSFile(fileSystem, account, "input.wasm", fs.readFileSync("wasm/input.wasm"))
    })
    it('submit test task', async () => {
        await sampleSubmitter.methods.submitData(dta).send({gas: 2000000, from: account})
    })
    it('wait for solution', async () => {
        let solution = "0x0000000000000000000000000000000000000000000000000000000000000000"
        while (solution == "0x0000000000000000000000000000000000000000000000000000000000000000") {
            await sampleSubmitter.methods.getResult(dta).send({from: account})
            solution = await sampleSubmitter.methods.getResult(dta).call()
        }
        let hash = await fileSystem.methods.getHash(solution).call()
        assert.equal(hash, "QmQXmWo9dzfb7ZSdVfQ9k4QnNcpzDM1dMKw4k3JRfHZESe")
    })

})

