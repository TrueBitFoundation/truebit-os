
const fs = require('fs')

const host = "http://localhost:8545"
const assert = require('assert')

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))

const getNetwork = async () => {
    let id = await web3.eth.net.getId()
    if (id == 5) return "goerli"
    else return await web3.eth.net.getNetworkType()
}

let account, fileSystem, scryptSubmitter

let timeout = async (ms) => new Promise((resolve, reject) => setTimeout(resolve, ms))

async function main() {
    let accounts = await web3.eth.getAccounts()
    account = accounts[0]
        let networkName = await getNetwork()

	    //get scrypt submitter artifact
	    const artifacts = JSON.parse(fs.readFileSync("public/" + networkName + ".json"))

	    // fileSystem = new web3.eth.Contract(artifacts.fileSystem.abi, artifacts.fileSystem.address)
        scryptSubmitter = new web3.eth.Contract(artifacts.sample.abi, artifacts.sample.address)
    let str = process.argv[2] || "hjkl"
    console.log("computing scrypt for", str)
    let dta = new Buffer(str)

        await scryptSubmitter.methods.submitData(dta).send({gas: 2000000, from: account})
        let solution = "0x0000000000000000000000000000000000000000000000000000000000000000"
        while (solution == "0x0000000000000000000000000000000000000000000000000000000000000000") {
            await timeout(1000)
            solution = await scryptSubmitter.methods.scrypt(dta).call()
        }
   console.log("Got solution", solution)

}

main()


