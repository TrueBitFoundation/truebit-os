const network = "development"

//get contracts
const config = require('./lib/configHelper')()

const networkConfig = config['networks'][network]

const Web3 = require('web3')
const httpProvider = new Web3.providers.HttpProvider("http://localhost:8545")
const web3 = new Web3(httpProvider)

const contract = require('./lib/contractHelper')

const fs = require('fs')

const incentiveLayerContracts = JSON.parse(fs.readFileSync(networkConfig["incentive-layer"] + "/" + network + ".json"))
const disputeResolutionLayerContracts = JSON.parse(fs.readFileSync(networkConfig['dispute-resolution-layer'] + "/" + network + ".json"))

module.exports = async () => {

	const contracts = {
		incentiveLayer : await contract(httpProvider, incentiveLayerContracts['TaskExchange']),
		disputeResolutionLayer : await contract(httpProvider, disputeResolutionLayerContracts['BasicVerificationGame']),
		computationLayer : await contract(httpProvider, disputeResolutionLayerContracts['SimpleAdderVM'])
	}

	//OS setup multi staged
	let os = {
		config: config,
		web3: web3,
		accounts: await web3.eth.getAccounts(),//note: these public keys are all uppercase
		contracts : contracts,
	}

	//Setup drivers
	os["taskGiver"] = require('./lib/taskGiver')(os)

	return os
}