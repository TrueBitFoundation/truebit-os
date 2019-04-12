/** @module cliLib */
// This file contains all functions called by vorpal.
// It provides a seperation between the cli interface and the functional interface.

const fs = require('fs')
const ipfsClient = require('ipfs-http-client')
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
  return os.solver.init(os, account, test, recover)
}

/** initialize verifier with account address  */
module.exports.initVerifier = ({ os, account, test, recover }) => {
  return os.verifier.init(os, account, test, recover)
}

/** initialize solver with account address  */
module.exports.ss_initSolver = ({ os, account, test, recover }) => {
  return os.ss_solver.init(os, account, test, recover)
}

/** initialize verifier with account address  */
module.exports.ss_initVerifier = ({ os, account, test, recover }) => {
  return os.ss_verifier.init(os, account, test, recover)
}

function printList(lst, n = 1) {
  for (let i = 0; i < lst.length; i++) {
    console.log(`${i+n}. Account ${lst[i].account}  ${lst[i].exiting() ? "Preparing to exit" : ""}`)
    let tasks = lst[i].tasks()
    for (let j = 0; j < tasks.length; j++) {
      console.log(`  Task ${j+n}: ${tasks[j]}`)
    }
    let games = lst[i].games()
    for (let j = 0; j < games.length; j++) {
      console.log(`  Game ${j+n}: ${games[j]}`)
    }
  }
}

module.exports.listProcesses = ({os}) => {
  console.log("SOLVERS")
  let lst = os.solver.get()
  printList(lst)
  console.log("VERIFIERS")
  printList(os.verifier.get(), lst.length+1)
}

module.exports.stopProcesse = ({os, args}) => {
  let lst1 = os.solver.get()
  let lst2 = os.verifier.get()
  let num = args.num - 1
  if (num < 0) {
    console.log("No such process", args.num)
    return
  }
  if (num < lst1.length) {
    lst1[num].exit()
  }
  else {
    num -= lst1.length
    if (num >= lst2.length) console.log("No such process", args.num)
    else lst2[num].exit()
  }
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

/** submit a task  */
module.exports.ss_taskGiver = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  const task = args.options.task || 'testWasmTask.json'

  return new Promise((resolve, reject) => {
    fs.readFile(task, (err, data) => {
      if (err) {
        reject(err)
      } else {
        let taskData = JSON.parse(data)
        taskData['from'] = account        
        resolve(os.ss_taskSubmitter.submitTask(taskData))
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
  let balance = os.web3.utils.fromWei(await os.web3.eth.getBalance(account))
  let block = await os.web3.eth.getBlockNumber()
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const tru = await contract(httpProvider, config['tru'])
  const incentiveLayer = await contract(httpProvider, config[os.config.incentiveLayer])
  let truBalance_raw = await tru.balanceOf.call(account)
  let truBalance = os.web3.utils.fromWei(truBalance_raw.toString(10))
  let deposit_raw = await incentiveLayer.getDeposit.call(account)
  let deposit = os.web3.utils.fromWei(deposit_raw.toString(10))
  os.logger.log({
    level: 'info',
    message: `${account}: ${balance} ETH, ${truBalance} TRU, deposit ${deposit} TRU at block ${block}`
  })
  return balance
}

/** deposit tokens to incentive contract */
module.exports.deposit = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  const num_tru = (args.options.value || "1").toString()
  const num = os.web3.utils.toWei(num_tru)
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const incentiveLayer = await contract(httpProvider, config[os.config.incentiveLayer])
  const tru = await contract(httpProvider, config['tru'])

  await tru.approve(incentiveLayer.address, num, { from: account, gasPrice:os.web3.gp })
  await incentiveLayer.makeDeposit(num, { from: account, gasPrice:os.web3.gp })

  module.exports.balance({os, args})
}

/** unbond deposit from task */
module.exports.unbondDeposit = async ({ os, args }) => {
  console.log("unbond", args)
  const account = os.accounts[args.options.account || 0]
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const incentiveLayer = await contract(httpProvider, config[os.config.incentiveLayer])

  await incentiveLayer.unbondDeposit(args.task, { from: account, gasPrice:os.web3.gp })

  module.exports.balance({os, args})
}

/** deposit tokens to incentive contract */
module.exports.depositEther = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  const num_eth = (args.options.value || "1").toString()
  const num = os.web3.utils.toWei(num_eth)
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const incentiveLayer = await contract(httpProvider, config["ss_incentiveLayer"])

  await incentiveLayer.makeDeposit({ value: num, from: account, gasPrice:os.web3.gp })

  module.exports.balance({os, args})
}

function makeRandom(n) {
  let res = ""
  for (let i = 0; i < n * 2; i++) {
      res += Math.floor(Math.random() * 16).toString(16)
  }
  return "0x" + res
}

/** deposit tokens to incentive contract */
module.exports.ticket = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  const num = args.options.value || 1
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const wl = await contract(httpProvider, config["stake_whitelist"])
  for (let i = 0; i < num; i++) {
    let ticket = makeRandom(32)
    await wl.buyTicket(ticket, { from: account, gas: 1000000, gasPrice: os.web3.gp })
  }
  module.exports.balance({os, args})
}

/** claim test tokens */
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
    await tru.getTestTokens({from:account, gas:100000, gasPrice:os.web3.gp})
    os.logger.log({
      level: 'info',
      message: `${account}: Claimed test tokens`
    })
    module.exports.balance({os, args})
  }
}

/** register node */
module.exports.registerNode = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const IPFSnodeManager = await contract(httpProvider, config['IPFSnodeManager'])
  const ipfs = await ipfsClient('localhost', '5001', { protocol: 'http' })
  const IPFSaddress = await ipfs.id()
  os.logger.log({
    level: 'info',
    message: `IPFSaddress: ${IPFSaddress.addresses[2]}`
  })
  console.log(IPFSaddress.addresses[2])
  await IPFSnodeManager.addNode(IPFSaddress.addresses[2], { from: account, gas: 1000000, gasPrice: os.web3.gp })
  module.exports.balance({os, args})
}

/** connect nodes */
module.exports.connectNodes = async ({ os, args }) => {
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const IPFSnodeManager = await contract(httpProvider, config['IPFSnodeManager'])
  const ipfs = await ipfsClient('localhost', '5001', { protocol: 'http' })
  const nodes = await IPFSnodeManager.getNodes({})
  nodeArray = os.web3.utils.toAscii(nodes).split(",")
  nodeArray.pop()
  console.log("Nodes: ")
  console.log(nodeArray)
  nodeArray.forEach(async function (node) {
    console.log('Trying to connect to: '+ node)
    try {
      await ipfs.swarm.connect(node)
      os.logger.log({
        level: 'info',
        message: `Success: Connected to ${node}`
      })
    } catch (e) {
      os.logger.log({
        level: 'error',
        message: `Exception: ${e}`
      })
    }    
  }); 

  module.exports.balance({os, args})
}

/** list nodes */
module.exports.listNodes = async ({ os, args }) => {
  const httpProvider = os.web3.currentProvider
	const config = await contractsConfig(os.web3)
  const IPFSnodeManager = await contract(httpProvider, config['IPFSnodeManager'])
  const nodes = await IPFSnodeManager.getNodes({})
  nodeArray = os.web3.utils.toAscii(nodes).split(",")
  nodeArray.pop()
  console.log("Nodes: ")
  console.log(nodeArray)
  os.logger.log({
    level: 'info',
    message: `Nodes: ${splitNodes(nodeArray)}`
  })
  module.exports.balance({os, args})
}




