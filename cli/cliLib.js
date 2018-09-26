/** @module cliLib */
// This file contains all functions called by vorpal.
// It provides a seperation between the cli interface and the functional interface.

const fs = require('fs')
const mineBlocks = require('../os/lib/util/mineBlocks')
const contractsConfig = require('../wasm-client/util/contractsConfig')
const contract = require('../wasm-client/contractHelper')

/** returns the package version  */
module.exports.version = ({ os }) => {
  const version = require('../package.json').version
  os.logger.log({
    level: 'info',
    message: `version ${version}`
  })
  return version
}

/** initialize and await os and attach taskSubmitter  */
module.exports.setup = configPath => {
    return (async () => {
	const os = await require('../os/kernel')(configPath)
	let baseName = configPath.split("/")[0]
	os.taskSubmitter = await require("../" + baseName + "/taskSubmitter")(
	    os.web3,
	    os.logger,
	    os.fileSystem
	)
	os.logger.log({
	    level: 'info',
	    message: 'Truebit OS has been initialized with config at ' + configPath
	})
	return os
    })()
}

/** initialize taskGiver with account address  */
module.exports.initTaskGiver = ({ os, account }) => {
    return os.taskGiver.init(os.web3, account, os.logger)
}

/** initialize solver with account address  */
module.exports.initSolver = ({ os, account, test, recover }) => {
    return os.solver.init(os.web3, account, os.logger, os.fileSystem, test, recover, os.throttle)
}

/** initialize verifier with account address  */
module.exports.initVerifier = ({ os, account, test, recover }) => {
    return os.verifier.init(os.web3, account, os.logger, os.fileSystem, test, recover, os.throttle)
}

/** submit a task  */
module.exports.taskGiver = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  const task = args.options.task || 'testWasmTask.json'

  return new Promise((resolve, reject) => {
    fs.readFile(task, (err, data) => {
      if (err) {
        reject(err)
      } else {
        let taskData = JSON.parse(data)
        taskData['from'] = account        
        resolve(os.taskSubmitter.submitTask(taskData))
      }
    })
  })
}

/** initialize task hash */
module.exports.initHash = async ({os, args}) => {
    const task = args.options.task 
    return new Promise((resolve, reject) => {
	fs.readFile(task, (err, data) => {
	    if (err) {
		reject(err)
	    } else {
		let taskData = JSON.parse(data)
		resolve(os.taskSubmitter.getInitialHash(taskData))
	    }
	})
    })
}

/** skip blocks */
module.exports.skipHelper = async ({ os, args }) => {
  const number = args.options.number || 65
  return mineBlocks(os.web3, number)
}

/** return the os accounts */
module.exports.accounts = async ({ os }) => {
  let accounts = os.accounts
  os.logger.log({
    level: 'info',
    message: `OS Accounts: ${JSON.stringify(accounts, null, 2)}`
  })
  return accounts
}

/** get balance of an account */
module.exports.balance = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  let balance = await os.web3.eth.getBalance(account)
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const tru = await contract(httpProvider, config['tru'])
  let truBalance = await tru.balanceOf(account)
  os.logger.log({
    level: 'info',
    message: `${account}: ${os.web3.utils.fromWei(balance)} ETH, ${os.web3.utils.fromWei(truBalance.toString(10))} TRU`
  })
  return balance
}

/** get balance of an account */
module.exports.claimTokens = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const tru = await contract(httpProvider, config['tru'])
  let success = await tru.getTestTokens.call({from:account, gas:100000})
  if (!success) {
    os.logger.log({
      level: 'info',
      message: `${account}: Already claimed the test tokens`
    })
  }
  else {
    await tru.getTestTokens({from:account, gas:100000})
    os.logger.log({
      level: 'info',
      message: `${account}: Claimed test tokens`
    })
    module.exports.balance({os, args})
  }
}

