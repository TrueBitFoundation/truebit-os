
const fs = require('fs')

const host = "http://localhost:8545"
const assert = require('assert')

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))

const getNetwork = require('truebit-util').getNetwork

let account, fileSystem, sampleSubmitter

before(async () => {
    let accounts = await web3.eth.getAccounts()
    account = accounts[0]
})

describe('Truebit Chess test', async function() {
    this.timeout(600000)

    it('should have a web3', () => {
        assert(web3)
    })

    it('connect to contracts', async () => {
        let networkName = await getNetwork(web3)

        //get scrypt submitter artifact
	    const artifacts = JSON.parse(fs.readFileSync("chess/public/" + networkName + ".json"))

        // fileSystem = new web3.eth.Contract(artifacts.fileSystem.abi, artifacts.fileSystem.address)
        sampleSubmitter = new web3.eth.Contract(artifacts.sample.abi, artifacts.sample.address)

    })

    let dta = new Buffer("hjkl")

    it('submit test task', async () => {
        await sampleSubmitter.methods.submitData(dta).send({gas: 2000000, from: account})
    })

    it('wait for solution', async () => {
        let solution = ""
        while (solution.length == 0) {
            await sampleSubmitter.methods.getResult(dta).send({from: account})
            let raw = await sampleSubmitter.methods.getResult(dta).call()
            solution = Buffer.from(raw.map(a => a.substr(2)).join(""), "hex").toString()
        }
        assert.equal(solution, "At move 0 White move illegal\n\u0000\u0000\u0000")
    })

})

