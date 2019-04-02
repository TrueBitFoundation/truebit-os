// This file contains all vorpal cli commands.
// No logic should be implemented in this file, the correct place to implement logic is the cliLib.
const figlet = require('figlet')
const chalk = require('chalk')
const vorpal = require('vorpal')()
let argv = require('minimist')(process.argv.slice(2))

// console.log(argv)

const cliLib = require('./cliLib')

console.log(
  chalk.green(figlet.textSync('Truebit:', { horizontalLayout: 'full' }))
)

console.log(chalk.blue(figlet.textSync('task solve verify')))

let configPath = argv._[0] || "wasm-client/config.json"

let os
  ; (async () => {
    os = await cliLib.setup(configPath)
    if (!argv.c) return
    if (typeof argv.c == "string") argv.c = [argv.c]
    for (let c of argv.c || []) {
      await vorpal.exec(c)
    }
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
  .action(async (args, callback) => { await cliLib.taskGiver({ os, args }); callback() })

vorpal
  .command(
    'hash',
    'Given task information generates an initial hash for the code including input files'
  )
  .option('-t, --task <pathToTask>', 'the path to a task json file')
  .action(async (args, callback) => {
    let initHash = await cliLib.initHash({ os, args })
    console.log("Initial hash: " + initHash)
    callback()
  })


vorpal
  .command('skip', 'skip blocks')
  .option('-n, --number <num>', 'number of blocks to skip.')
  .action(async (args, callback) => { await cliLib.skipHelper({ os, args }); callback() })

vorpal
  .command(
    'accounts',
    'lists the available accounts on the network. Requires a running session.'
  )
  .action(async (args, callback) => { await cliLib.accounts({ os }); callback() })

vorpal
  .command('balance', 'show the balance of an account')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .action(async (args, callback) => { await cliLib.balance({ os, args }); callback() })

vorpal
  .command('ticket', 'buy ticket from whitelist')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .option('-v, --value <num>', 'amount of tickets.')
  .action(async (args, callback) => { await cliLib.ticket({ os, args }); callback() })

vorpal
  .command('claim', 'claim test tokens')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .action(async (args, callback) => { await cliLib.claimTokens({ os, args }); callback() })

vorpal
  .command('deposit', 'deposit tokens to incentive layer')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .option('-v, --value <num>', 'amount of tokens.')
  .action(async (args, callback) => { await cliLib.deposit({ os, args }); callback() })

vorpal
  .command('deposit-ether', 'deposit ether to incentive layer')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .option('-v, --value <num>', 'amount of tokens.')
  .action(async (args, callback) => { await cliLib.depositEther({ os, args }); callback() })

vorpal
  .command('unbond <task>', 'unbond deposit from task')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .types({string:["_"]})
  .action(async (args, callback) => { await cliLib.unbondDeposit({ os, args }); callback() })

vorpal
  .command('ps', 'list solvers and verifiers, and the tasks they are involved in')
  .action(async (args, callback) => { await cliLib.listProcesses({ os }); callback() })

vorpal
  .command('stop <num>', 'stop solver or verifier. Get the number of process with ps')
  .action(async (args, callback) => { await cliLib.stopProcesse({ os, args }); callback() })

if (!argv["batch"]) {
  vorpal.delimiter('$ ').show()
}
