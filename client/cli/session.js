const fs = require('fs')
const contract = require('truffle-contract')
const Web3 = require('web3')


module.exports = async (rl, config, network) => {
	if (!config['networks'][network]) {
		console.error(network + " is not a configured network. Enter `network` to see which networks are configured.")
	} else {

		//initialize provider
		const web3 = new Web3.providers.HttpProvider("http://localhost:8545")

		const networkConfig = config['networks'][network]

		const incentiveLayerContracts = JSON.parse(fs.readFileSync(networkConfig["incentive-layer"] + "/" + network + ".json"))
		const disputeResolutionLayerContracts = JSON.parse(fs.readFileSync(networkConfig['dispute-resolution-layer'] + "/" + network + ".json"))

		let incentiveLayer = contract({abi: incentiveLayerContracts['TaskExchange'].abi})
		incentiveLayer.setProvider(web3)

//dirty hack for web3@1.0.0 support for localhost testrpc, see https://github.com/trufflesuite/truffle-contract/issues/56#issuecomment-331084530
if (typeof incentiveLayer.currentProvider.sendAsync !== "function") {
  incentiveLayer.currentProvider.sendAsync = function() {
    return incentiveLayer.currentProvider.send.apply(
      incentiveLayer.currentProvider, arguments
    )
  }
}

		console.log(await incentiveLayer.at(incentiveLayerContracts['TaskExchange'].address))
	}
	rl.prompt()
}