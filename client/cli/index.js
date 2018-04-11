const clear = require('clear')
const figlet = require('figlet')
const chalk = require('chalk')
const minimist = require('minimist')

const readline = require('readline')
const rl = readline.createInterface(process.stdin, process.stdout)

const fs = require('fs')

const sessionHelper = require('./session')

const taskGiver = require('../lib/taskGiver')

let config
fs.readFile('config.json', function(err, data) {
  if (err) {
    throw "config file not found. Type `config` to setup a configuration"
  } else {
    config = JSON.parse(data)
  }
})

function printBar() {
  let i = 0
  let output = ""
  let len = process.stdout.columns
  while(i < len) {
    output += "-"
    i++
  }
  console.log(chalk.magenta(output))
}

clear()
console.log(
  chalk.green(
    figlet.textSync('Truebit:', { horizontalLayout: 'full' })
  )
)

console.log(
  chalk.blue(
    figlet.textSync('task solve verify')
  )
)
console.log()

console.log("Enter `help` to see the list of commands.")

printBar()

function helpHelper(command) {

  const commands = {
    "start": [
      "begins Truebit client session with a specified network.",
      "options:",
      " -n specifies the 'network' to use (default: development)"
    ].join("\n"),
    "config": "creates a default config.json file, or reloads the existing config file",
    "networks": "lists the available networks in the currently loaded config",
    "help": "outputs the list of commands. Takes a command as argument to get more info.",
    "quit": "closes the Truebit client terminal session",
    "q": "synonym for `quit`",
  }

  if (command) {
    if(command in commands) {
      console.log(command + " -- " + commands[command])
    } else {
      console.log(command + " is not a valid command.")
    }
  } else {
    console.log("Enter `help` [command] for more info. Possible commands: \n" +  Object.keys(commands).join("\n") )
  }
}

function configHelper() {
  let filePath = './config.json'
  if (fs.existsSync(filePath)) {
    config = JSON.parse(fs.readFileSync(filePath))
    console.log("Reloaded config from " + filePath)
  } else {
    let defaultConfig = {
      "networks": {
        "development" : {
          "incentive-layer" : __dirname + "/../../incentive-layer/export",
          "dispute-resolution-layer" : __dirname + "/../../dispute-resolution-layer/export"
        }
      }
    }
    fs.writeFileSync(filePath, JSON.stringify(defaultConfig))
    config = defaultConfig
    console.log("config.json file created. Reloaded current config")
  }
}

function networksHelper() {
  Object.keys(config.networks).forEach((net) => { console.log(net) })
}

function argsParser(tokens) {
  let newTokens = tokens.slice(1)
  let args = []
  for(i = 0; i < newTokens.length; i++) {
    if(newTokens[i].includes("-")) {
      args.push([newTokens[i], newTokens[i+1]].join(" "))
    }
  }
  return minimist(args)
}

let session

async function sessionEnforcer(cb) {
  if (session) {
    await cb()
  } else {
    throw "session is not available use the `start` command to begin one"
  }
}

async function exec(line) {
  let tokens = line.split(" ")
  let command = tokens[0]
  switch(command) {
    case "q":
      rl.close()
      break
    case "quit":
      rl.close()
      break
    case "help":
      helpHelper(tokens[1])
      break
    case "config":
      configHelper()
      break
    case "networks":
      networksHelper()
      break
    case "start":
      let args = argsParser(tokens)

      if (args['n']) {
        session = await sessionHelper(rl, config, args['n'].trim())
      } else {
        session = await sessionHelper(rl, config, "development")
      }
      
      break
    case "accounts":
      await sessionEnforcer(async () => {
        console.log(session.accounts)
      })
      break
    case "balance":
      await sessionEnforcer(async () => {
        let args = argsParser(tokens)
        if(!args['a']) {
          throw 'no account number specified. Use `-a` to specify which account balance you want to see'
        } else {
          console.log(await session.web3.eth.getBalance(session.accounts[args['a'].trim()]))
        }
      })
      break
    case "task":
      await sessionEnforcer(async () => {
        taskGiver(session, argsParser(tokens))
      })
      break
    case "view":
      //start visualizer
      break
    case "estimate":
      //estimate cost of file using specified vm
      break
    default:
      console.log(command + " is not a valid command. Try running `help` to see the list of valid commands.")
  }
  console.log()
  rl.prompt()
}

rl.setPrompt('> ')
rl.prompt()

rl
.on('line', exec)
.on('close',function() {
  console.log("Goodbye!")
  process.exit(0)
})

process.on('uncaughtException', function(e) {
	console.log()
  console.log(chalk.red(e))
  rl.prompt()
})