const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')

module.exports = (web3, logger) => {
    const wasmConfig = JSON.parse(fs.readFileSync(__dirname + "/webasm-solidity/export/development.json"))

    function setup(httpProvider) {
	return (async () => {
	    incentiveLayer = await contract(httpProvider, wasmConfig['tasks'])
	    return incentiveLayer
	})()
    }

    return {
	submitTask: async (task) => {
	    let incentiveLayer = await setup(web3.currentProvider)

	    await depositsHelper(web3, incentiveLayer, task.from, task.minDeposit)
	}
    }
}
