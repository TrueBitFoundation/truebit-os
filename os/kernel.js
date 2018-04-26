const fs = require('fs')

const Web3 = require('web3')

module.exports = async (configPath) => {
	const config = JSON.parse(fs.readFileSync(configPath))

	const httpProvider = new Web3.providers.HttpProvider(config["http-url"])
	const web3 = new Web3(httpProvider)

	const accounts = await web3.eth.getAccounts()

	return {
		taskGiver: require(config["task-giver"]),
		solver: require(config["solver"]),
		verifier: require(config["verifier"]),
		web3: web3,
		accounts: accounts
	}
}