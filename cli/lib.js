const fs = require('fs')
const mineBlocks = require('../os/lib/util/mineBlocks')

const setup = configPath => {
  return (async () => {
    const os = await require('../os/kernel')(configPath)
    os.taskSubmitter = require('../basic-client/taskSubmitter')(
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

const taskGiver = async ({ os, args }) => {
  const account = os.accounts[args.options.account || 0]
  const task = args.options.task || 'testTask.json'
  fs.readFile(task, (err, data) => {
    if (err) {
      throw err
    } else {
      let taskData = JSON.parse(data)
      taskData['from'] = account
      taskData['reward'] = os.web3.utils.toWei(taskData.reward, 'ether')
      os.taskSubmitter.submitTask(taskData)
    }
  })
}

const skipHelper = async ({ os, args }) => {
  const number = args.options.number || 65
  return mineBlocks(os.web3, number)
}

module.exports = {
  setup,
  taskGiver,
  skipHelper
}
