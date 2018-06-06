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
    init: async (web3, account, logger, test = false) => {
	logger.log({
	    level: 'info',
	    message: `Task Giver initialized`
	})

	let [incentiveLayer, filesSystem] = await setup(web3.currentProvider)

	//Solution committed event
	const solvedEvent = incentiveLayer.Solved()

	solvedEvent.watch(async (err, result) => {
	    if (result) {
		let taskID = result.args.id.toNumber()

		let taskInfo = toTaskInfo(await incentiveLayer.taskInfo.call(taskID))
		if(result.args.cs.toNumber() == merkleComputer.StorageType.BLOCKCHAIN) {
		}

					  

	    }
	})

	return () => {
	    try {
		solvedEvent.stopWatching()
	    } catch(e) {
	    }
	}
    }
}
