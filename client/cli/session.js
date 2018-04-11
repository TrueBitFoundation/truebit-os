const fs = require('fs')

module.exports = (rl, config, network) => {
	if (!config['networks'][network]) {
		console.error(network + " is not a configured network. Enter `network` to see which networks are configured.")
	} else {
		let networkConfig = config['networks'][network]

		let incentiveLayerContracts = JSON.parse(fs.readFileSync(networkConfig["incentive-layer"] + "/" + network + ".json"))
		let disputeResolutionLayerContracts = JSON.parse(fs.readFileSync(networkConfig['dispute-resolution-layer'] + "/" + network + ".json"))

	}
}