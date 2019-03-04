// This file contains all vorpal cli commands.
// No logic should be implemented in this file, the correct place to implement logic is the cliLib.
const figlet = require('figlet')
const chalk = require('chalk')
const logger = require('../os/logger')
const vorpal = require('vorpal')()

const cliLib = require('./cliLib')

console.log(
  chalk.green(figlet.textSync('Truebit:', { horizontalLayout: 'full' }))
)

console.log(chalk.blue(figlet.textSync('task solve verify')))

let configPath = process.argv[2] || "wasm-client/config.json"

let os
  ; (async () => {
    os = await cliLib.setup(configPath)
  })()

vorpal
  .command('version', 'display package version')
  .action(async (args, callback) => {
    return cliLib.version({ os })
    callback()
  })

vorpal
  .command('start <command>', 'start a task giver, solver or verifier [task,solve,verify].')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .option('-r, --recover <num>', 'recovery mode: check the blocks.')
  .option('-t, --test', 'testing mode: verifier will challenge correct tasks.')
  .action(async (args, callback) => {
    // account is optional argument, defaulted to 0
    const account = os.accounts[args.options.account || 0]
    const test = !!args.options.test
    const recover = args.options.recover || -1
    switch (args.command) {
      case 'task':
        return cliLib.initTaskGiver({ os, account })
      case 'solve':
        return cliLib.initSolver({ os, account, recover, test })
      case 'verify':
        return cliLib.initVerifier({ os, account, recover, test })
      default:
        os.logger.log({
          level: 'error',
          message: `command not available: ${args.command}`
        })
        throw new Error('command not available')
    }

    callback()
  })

vorpal
  .command('task', 'submit a task')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .option('-t, --task <pathToTask>', 'the path to a task json file')
  .action(async (args, callback) => {
    await cliLib.taskGiver({
      os,
      args
    })
    callback()
  })

vorpal
  .command(
    'hash',
    'Given task information generates an initial hash for the code including input files'
  )
  .option('-t, --task <pathToTask>', 'the path to a task json file')
  .action(async (args, callback) => {
    let initHash = await cliLib.initHash({
      os,
      args
    })
    console.log("Initial hash: " + initHash)
    callback()
  })


vorpal
  .command('skip', 'skip blocks')
  .option('-n, --number <num>', 'number of blocks to skip.')
  .action(async (args, callback) => {
    await cliLib.skipHelper({
      os,
      args
    })
    callback()
  })

vorpal
  .command(
    'accounts',
    'lists the available accounts on the network. Requires a running session.'
  )
  .action(async (args, callback) => {
    await cliLib.accounts({
      os
    })
    callback()
  })

vorpal
  .command('balance', 'show the balance of an account')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .action(async (args, callback) => {
    await cliLib.balance({
      os,
      args
    })
    callback()
  })

vorpal
  .command('ticket', 'buy ticket from whitelist')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .option('-v, --value <num>', 'amount of tickets.')
  .action(async (args, callback) => {
    await cliLib.ticket({
      os,
      args
    })
    callback()
  })
vorpal
  .command('claim', 'claim test tokens')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .action(async (args, callback) => {
    await cliLib.claimTokens({
      os,
      args
    })
    callback()
  })
vorpal
  .command('deposit', 'deposit tokens to incentive layer')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .option('-v, --value <num>', 'amount of tokens.')
  .action(async (args, callback) => {
    await cliLib.deposit({
      os,
      args
    })
    callback()
  })

// All commands below this point are stubbed
vorpal
  .command(
    'config',
    'creates a default config.json file, or reloads the existing config file'
  )
  .action(async (args, callback) => {
    throw new Error('not implemented')
    callback()
  })

vorpal
  .command(
    'networks',
    'lists the available networks in the currently loaded config'
  )
  .action(async (args, callback) => {
    throw new Error('not implemented')
    callback()
  })

vorpal
  // current behavior is shell, this can be altered by uncommenting this line
  // .parse(process.argv)
  .delimiter('$ ')
  .show()
