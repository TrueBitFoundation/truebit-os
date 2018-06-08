const assert = require('assert')

const cliLib = require('../cli/cliLib')

// setup is required before all other tests.
before(async () => {
  os = await cliLib.setup('./basic-client/config.json')
})

// no fat arrow because of timeout
describe('CLI Lib', async function() {
  this.timeout(60000)

  describe('version', async () => {
    it('displays package.json version', () => {
      let version = cliLib.version({ os })
      assert(version === require('../package.json').version)
    })
  })

  describe('initTaskGiver', async () => {
    it('initializes os.taskGiver', async () => {
      let data = await cliLib.initTaskGiver({ os, account: os.accounts[0] })
      assert(typeof data === 'function')
    })
  })

  describe('initSolver', async () => {
    it('initializes os.solver', async () => {
      let data = await cliLib.initSolver({ os, account: os.accounts[1] })
      assert(typeof data === 'function')
    })
  })

  describe('initVerifier', async () => {
    it('initializes os.verifier', async () => {
      let data = await cliLib.initVerifier({ os, account: os.accounts[2] })
      assert(typeof data === 'function')
    })
  })

  describe('taskGiver', async () => {
    it('should submit a task', async () => {
      let data = await cliLib.taskGiver({
        os,
        args: {
          options: {
            account: 0,
            task: './testTask.json'
          }
        }
      })
      // TODO: This should probably not return undefined.
      assert(typeof data === 'undefined')
    })
  })

  describe('skip', async () => {
    it('should skip some blocks', async () => {
      let data = await cliLib.skipHelper({
        os,
        args: {
          options: {
            number: 65
          }
        }
      })
      // TODO: This should probably not return undefined.
      assert(typeof data === 'undefined')
    })
  })

  describe('accounts', async () => {
    it('should return os.accounts', async () => {
      let accounts = await cliLib.accounts({
        os
      })
      // TODO: Add better object equality check here.
      assert(typeof accounts === 'object')
    })
  })

  describe('balance', async () => {
    it('should return the balance of an account by index in wei', async () => {
      let balance = await cliLib.balance({
        os,
        args: {
          options: {
            account: 0
          }
        }
      })
      assert(typeof balance === 'string')
    })
  })
})
