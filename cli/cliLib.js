/** @module cliLib */
// This file contains all functions called by vorpal.
// It provides a seperation between the cli interface and the functional interface.

const fs = require('fs')
const mineBlocks = require('../os/lib/util/mineBlocks')

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
      os.logger
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
module.exports.initSolver = ({ os, account }) => {
  return os.solver.init(os.web3, account, os.logger)
}

/** initialize verifier with account address  */
module.exports.initVerifier = ({ os, account }) => {
  return os.verifier.init(os.web3, account, os.logger)
}

/** submit a task  */
module.exports.taskGiver = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  const task = args.options.task || 'testTask.json'

  return new Promise((resolve, reject) => {
    fs.readFile(task, (err, data) => {
      if (err) {
        reject(err)
      } else {
        let taskData = JSON.parse(data)
        taskData['from'] = account
        taskData['reward'] = os.web3.utils.toWei(taskData.reward, 'ether')
        resolve(os.taskSubmitter.submitTask(taskData))
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
  os.logger.log({
    level: 'info',
    message: `${account}: ${balance} wei`
  })
  return balance
}
