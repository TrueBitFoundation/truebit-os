
const fs = require('fs')

const host = "http://localhost:8545"
const assert = require('assert')

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))

const getNetwork = require('truebit-util').getNetwork

let account, fileSystem, scryptSubmitter

before(async () => {
    let accounts = await web3.eth.getAccounts()
    account = accounts[0]
})

describe('Truebit Scrypt test', async function() {
    this.timeout(600000)

    it('should have a web3', () => {
        assert(web3)
    })

    it('connect to contracts', async () => {
        let networkName = await getNetwork(web3)

	//get scrypt submitter artifact
	const artifacts = JSON.parse(fs.readFileSync("scrypt/public/" + networkName + ".json"))

        // fileSystem = new web3.eth.Contract(artifacts.fileSystem.abi, artifacts.fileSystem.address)
        scryptSubmitter = new web3.eth.Contract(artifacts.sample.abi, artifacts.sample.address)

    })

    let dta = new Buffer("hjkl")

    it('submit test task', async () => {
        await scryptSubmitter.methods.submitData(dta).send({gas: 2000000, from: account})
    })
    it('wait for solution', async () => {
        let solution = "0x0000000000000000000000000000000000000000000000000000000000000000"
        while (solution == "0x0000000000000000000000000000000000000000000000000000000000000000") {
            await scryptSubmitter.methods.scrypt(dta).send({from: account})
            solution = await scryptSubmitter.methods.scrypt(dta).call()
        }
        assert.equal(solution, "0xc73061dd01c0afe2a9eff0b4b3876e04568abeb738d58acffad271f3515d0b98")
    })

})

