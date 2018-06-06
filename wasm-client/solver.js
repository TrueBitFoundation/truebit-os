const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const toTaskInfo = require('./util/toTaskInfo')

const setupVM = require('./util/setupVM')

const merkleComputer = require(__dirname+ "/webasm-solidity/merkle-computer")

const wasmClientConfig = JSON.parse(fs.readFileSync(__dirname + "/webasm-solidity/export/development.json"))

function setup(httpProvider) {
    return (async () => {
	incentiveLayer = await contract(httpProvider, wasmClientConfig['tasks'])
	fileSystem = await contract(httpProvider, wasmClientConfig['filesystem'])
	return [incentiveLayer, fileSystem]
    })()
}


let tasks = {}

module.exports = {
    init: async (web3, account, logger) => {
	logger.log({
	    level: 'info',
	    message: `Task Giver initialized`
	})

	let [incentiveLayer, filesSystem] = await setup(web3.currentProvider)

	const taskPostedEvent = incentiveLayer.Posted()

	taskPostedEvent.watch(async (err, result) => {
	    if (result) {
		let taskID = result.args.id
		
		let minDeposit = result.args.deposit.toNumber()
		await depositsHelper(web3, incentiveLayer, account, minDeposit)

		let storageType = result.args.cs.toNumber()
		let storageAddress = result.args.stor
		let initStateHash = result.args.hash

		let solution, vm

		//TODO: Need to check if task is solved already
		
		if(storageType == merkleComputer.StorageType.BLOCKCHAIN) {

		    let wasmCode = await fileSystem.getCode.call(storageAddress)

		    let buf = Buffer.from(wasmCode.substr(2), "hex")

		    vm = await setupVM(
			incentiveLayer,
			merkleComputer,
			taskID,
			buf,
			result.args.ct.toNumber()
		    )
		    
		    let interpreterArgs = []
		    solution = await vm.executeWasmTask(interpreterArgs)
		}

		try {
		    
		    await incentiveLayer.solveIO(
			taskID,
			solution.vm.code,
			solution.vm.input_size,
			solution.vm.input_name,
			solution.vm.input_data,
			{from: account, gas: 200000}
		    )

		    tasks[taskID] = {
			solution: solution,
			vm: vm
		    }
		} catch(e) {
		    //TODO: Add logging unsuccessful submission attempt
		    console.log(e)
		}
	    }
	})

	return () => {
	    try {
		taskPostedEvent.stopWatching()
	    } catch(e) {
	    }
	}
    }
}
