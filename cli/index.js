const figlet = require('figlet')
const chalk = require('chalk')
const logger = require('../os/logger')
const vorpal = require('vorpal')()

const cliLib = require('./lib')

console.log(
  chalk.green(figlet.textSync('Truebit:', { horizontalLayout: 'full' }))
)

console.log(chalk.blue(figlet.textSync('task solve verify')))

let configPath = process.argv[2]

let os
;(async () => {
  os = await cliLib.setup(configPath)
})()

vorpal
  .command('version', 'display package version')
  .action(async (args, callback) => {
    const version = require('../package.json').version
    os.logger.log({
      level: 'info',
      message: `version ${version}`
    })
    callback()
  })

vorpal
  .command('start <command>', 'start a task giver.')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .action(async (args, callback) => {
    // console.log(args)
    // account is optional argument, defaulted to 0
    const account = os.accounts[args.options.account || 0]
    switch (args.command) {
      case 'task':
        os.taskGiver.init(os.web3, account, os.logger)
        break
      case 'solve':
        os.solver.init(os.web3, account, os.logger)
        break
      case 'verify':
        os.verifier.init(os.web3, account, os.logger)
        break
      default:
        os.logger.log({
          level: 'error',
          message: `command not available: ${args.command}`
        })
    }

    callback()
  })

vorpal
  .command('task', 'submit a task')
  .option('-a, --account <num>', 'index of web3 account to use.')
  .option('-t, --task <pathToTask>', 'the path to a task.json')
  .action(async (args, callback) => {
    await cliLib.taskGiver({
      os,
      args
    })
    callback()
  })

vorpal
  .command('skip', 'skip blocks')
  .option('-n, --number <num>', 'index of web3 account to use.')
  .action(async (args, callback) => {
    await cliLib.skipHelper({
      os,
      args
    })
    callback()
  })

vorpal
  // current behavior is shell, this can be altered by uncommenting this line
  // .parse(process.argv)
  .delimiter('🎲   $')
  .show()
