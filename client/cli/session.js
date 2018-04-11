const fs = require('fs')
const Web3 = require('web3')
const contract = require('../lib/getContract')

module.exports = async (rl, config, network) => {
	if (!config['networks'][network]) {
		console.error(network + " is not a configured network. Enter `network` to see which networks are configured.")
	} else {

		//initialize provider
		const httpProvider = new Web3.providers.HttpProvider("http://localhost:8545")

		const networkConfig = config['networks'][network]

		const incentiveLayerContracts = JSON.parse(fs.readFileSync(networkConfig["incentive-layer"] + "/" + network + ".json"))
		const disputeResolutionLayerContracts = JSON.parse(fs.readFileSync(networkConfig['dispute-resolution-layer'] + "/" + network + ".json"))

		console.log("session has been started on " + network + " network")

		const web3 = new Web3(httpProvider)

		return {
			network: network,
			web3: web3,
			accounts: await web3.eth.getAccounts(),//note: these public keys are all uppercase
			contracts : {
				incentiveLayer : await contract(httpProvider, incentiveLayerContracts['TaskExchange']),
				disputeResolutionLayer : await contract(httpProvider, disputeResolutionLayerContracts['BasicVerificationGame']),
				computationLayer : await contract(httpProvider, disputeResolutionLayerContracts['SimpleAdderVM'])
			}
		}
	}
}