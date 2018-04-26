let tasks = {}
let games = {}

const depositsHelper = require('./depositsHelper')
const util = require('ethereumjs-util')
const waitForBlock = require('./util/waitForBlock')
const toTaskData = require('./util/toTaskData')
const merkleTree = require('./util/merkleTree')
const sha3 = require('ethereumjs-util').sha3

module.exports = (os) => {
  return {
		init: (account) => {
			const taskCreatedEvent = os.contracts.incentiveLayer.TaskCreated()

			taskCreatedEvent.watch(async (err, result) => {
					if (result) {
						let taskID = result.args.taskID.toNumber()
						let taskMinDeposit = result.args.minDeposit.toNumber()

						let taskData = toTaskData(await os.contracts.incentiveLayer.getTaskData.call(taskID))

						try {

							let blockNumber = await os.web3.eth.getBlockNumber()

							if (!(blockNumber > taskData.intervals[0] + taskData.taskCreationBlockNumber)) {

								await depositsHelper(os, account, taskMinDeposit)

								let tx = await os.contracts.incentiveLayer.registerForTask(taskID, {from: account, gas: 100000})

								tasks[taskID] = taskData
	
								let program = os.web3.utils.hexToBytes(taskData.taskData).map((n) => {
									return util.bufferToHex(util.setLengthLeft(n, 32))
								})
	
								let output = await os.contracts.computationLayer.runSteps.call(program, taskData.numSteps)
	
								let solution = output[0][1]
	
								tx = await os.contracts.incentiveLayer.commitSolution(taskID, solution, {from: account})
	
								waitForBlock(os.web3, taskData.intervals[2] + taskData.taskCreationBlockNumber, async () => {
									if (!tasks[taskID]["challenged"]) {
										await os.contracts.incentiveLayer.finalizeTask(taskID, {from: account})
									}
								})
							}

						} catch (e) {
							console.error(e)
						}
					}
      })

			const verificationCommittedEvent = os.contracts.incentiveLayer.VerificationCommitted()

			verificationCommittedEvent.watch(async (err, result) => {
				if (result) {
					let taskID = result.args.taskID.toNumber()
					let gameId = result.args.gameId
					if(tasks[taskID]) {
						games[gameId] = {taskID: taskID}
						tasks[taskID]["gameId"] = gameId

						let taskData = toTaskData(await os.contracts.incentiveLayer.getTaskData.call(games[gameId].taskID))

						let program = os.web3.utils.hexToBytes(taskData.taskData).map((n) => {
							return util.bufferToHex(util.setLengthLeft(n, 32))
						})

						let hashes = program.map(e => sha3(e))

						mtree = new merkleTree.MerkleTree(hashes, true)
						root = mtree.getRoot()
						games[gameId]["merkle-tree"] = mtree
						games[gameId]["merkle-root"] = root
						games[gameId]["hashes"] = hashes
					}
				}
      })
      
      const newQueryEvent = os.contracts.disputeResolutionLayer.NewQuery()

      newQueryEvent.watch(async (err, result) => {
        if (result) {
          let gameId = result.args.gameId
          let stepNumber = result.args.stepNumber

					if (games[gameId]) {
						const gameData =  toGameData(await os.contracts.disputeResultionLayer.gameData.call(gameId))

            let taskData = toTaskData(await os.contracts.incentiveLayer.getTaskData.call(games[gameId].taskID))
            
            if (gameData.low + 1 != gameData.high) {
              let program = os.web3.utils.hexToBytes(taskData.taskData).map((n) => {
                return util.bufferToHex(util.setLengthLeft(n, 32))
              })
    
              let output = await os.contracts.computationLayer.runSteps.call(program, gameData.med)
    
              const result = await api.getResult(session.input, medStep)
              let solutionHash = output[1]
    
              if (solutionHash == game.medHash) {
                // we agree with their state; look in the right half
                await os.contracts.disputeResolutionLayer.query(gameId, calculateMidpoint(gameData.med, gameData.high), {from: account})
              } else {
                // we disagree with their state; look in the left half.
                await os.contracts.disputeResolutionLayer.query(gameId, calculateMidpoint(gameData.low, gameData.med), {from: account})
              }
  
							//start timeout watcher
							waitForBlock(os.web3, taskData.intervals[2] + taskData.taskCreationBlockNumber, async () => {
								if (!tasks[taskID]["challenged"]) {
									await os.contracts.incentiveLayer.finalizeTask(taskID, {from: account})
								}
							})
							
            } else {
							const gameData =  toGameData(await os.contracts.disputeResultionLayer.gameData.call(gameId))

							const game = games[gameId]

							let lowStepState = await os.contracts.computationLayer.runSteps.call(game["program"], gameData.low)[0]

							let highStepIndex = game.high - 1

							let highStepState = await os.contracts.computationLayer.runStep.call(lowStepState, game.high, game["program"][highStepIndex])
					
							let proof = game["merkle-tree"].getProofOrdered(game["hashes"][highStepIndex], game.high)
							const newProof = '0x' + proof.map(e => e.toString('hex')).join('')

							await basicVerificationGame.performStepVerification(gameId, lowStepState, highStepState, newProof, {from: account})
            }
					}
        }
      })

			return () => {
				try {
          taskCreatedEvent.stopWatching()
          verificationCommittedEvent.stopWatching()
          newQueryEvent.stopWatching()
				} catch (e) {
					//console.log("Events stopped watching ungracefully")
				}
			}
		}
	}
}