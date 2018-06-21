const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')

module.exports = (web3, logger) => {
    const ilConfig = JSON.parse(fs.readFileSync(__dirname + "/incentive-layer/export/development.json"))
    const drlConfig = JSON.parse(fs.readFileSync(__dirname + "/dispute-resolution-layer/export/development.json"))

    function setup(httpProvider) {
        return (async () => {
            incentiveLayer = await contract(httpProvider, ilConfig['TaskExchange'])
            return incentiveLayer
        })()
    }

    return {
        submitTask: async (task) => {

            let incentiveLayer = await setup(web3.currentProvider)
	    
            await depositsHelper(web3, incentiveLayer, task.from, task.minDeposit)
	    
            // Incentive layer is restricted to bytes32 for task data
            taskData = web3.utils.bytesToHex(task.data)

            tx = await incentiveLayer.createTask(
                task.minDeposit,
                taskData,
                task.intervals,
                task.data.length,
                drlConfig["BasicVerificationGame"].address,
                {
                    from: task.from, 
                    value: task.reward,
                    gas: 300000
                }
            )
            logger.log({
		level: 'info',
		message: `Task submitted ${tx.tx}`
	    })
        }
    }
}
