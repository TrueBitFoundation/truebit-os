const truffleContract = require('truffle-contract')

module.exports = async (web3, contractConfig) => {
	let contract = truffleContract({abi: contractConfig.abi})
	contract.setProvider(web3)

	//dirty hack for web3@1.0.0 support for localhost testrpc, see https://github.com/trufflesuite/truffle-contract/issues/56#issuecomment-331084530
	if (typeof contract.currentProvider.sendAsync !== "function") {
		contract.currentProvider.sendAsync = function() {
			return contract.currentProvider.send.apply(
				contract.currentProvider, arguments
			)
		}
	}

	return await contract.at(contractConfig.address)
}