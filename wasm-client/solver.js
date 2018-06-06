const depositsHelper = require('./depositsHelper')
const fs = require('fs')
const contract = require('./contractHelper')
const toTaskInfo = require('./util/toTaskInfo')
const toVmParameters = require('./util/toVmParameters')

const merkleComputer = require(__dirname+ "/webasm-solidity/merkle-computer")

const wasmClientConfig = JSON.parse(fs.readFileSync(__dirname + "/webasm-solidity/export/development.json"))

function setup(httpProvider) {
    return (async () => {
	incentiveLayer = await contract(httpProvider, wasmClientConfig['tasks'])
	fileSystem = await contract(httpProvider, wasmClientConfig['filesystem'])
	return [incentiveLayer, fileSystem]
    })()
}

function writeFile(fname, buf) {
    return new Promise(function (cont,err) { fs.writeFile(fname, buf, function (err, res) { cont() }) })
}

const solverConf = { error: false, error_location: 0, stop_early: -1, deposit: 1 }

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

		//TODO: Need to check if solution is solved already
		
		if(storageType == merkleComputer.StorageType.BLOCKCHAIN) {
		    //TODO: This seems like it could be more efficient

		    let wasmCode = await fileSystem.getCode.call(storageAddress)

		    let buf = Buffer.from(wasmCode.substr(2), "hex")

		    let filePath = process.cwd() + "/tmp.solverWasmCode.wast"

		    await writeFile(filePath, buf)
		    
		    let vmParameters = toVmParameters(await incentiveLayer.getVMParameters.call(taskID))

		    let config = {
			code_file: filePath,
			input_file: "",
			actor: solverConf,
			files: [],
			vm_parameters: vmParameters,
			code_type: result.args.ct.toNumber()
		    }

		    let randomPath = process.cwd() + "/tmp.giver_" + Math.floor(Math.random()*Math.pow(2, 60)).toString(32)

		    vm = merkleComputer.init(config, randomPath)

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
