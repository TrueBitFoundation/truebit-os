const fs = require('fs')
const Web3 = require('web3')
const logger = require('./logger')

function requireHelper(cb) {
    try {
        return cb()
    } catch (e) {
        console.log(e)
        return undefined
    }
}

function ipfsFileSystemHelper(config) {
    if (config["ipfs"]) {
        const ipfs = require('ipfs-api')(config.ipfs.host, config.ipfs.port, { protocol: config.ipfs.protocol })
        const merkleComputer = require('../wasm-client/merkle-computer')()
        const fileSystem = merkleComputer.fileSystem(ipfs)
        return fileSystem
    } else {
        return undefined
    }
}

module.exports = async (configPath) => {
    const config = JSON.parse(fs.readFileSync(configPath))
    let provider
    if (config["ws-url"]) provider = new Web3.providers.WebsocketProvider(config["ws-url"])
    else provider = new Web3.providers.HttpProvider(config["http-url"])
    const web3 = new Web3(provider)
    const accounts = await web3.eth.getAccounts()
    const submitter = requireHelper(() => require(config["task-submitter"]))

    web3.gp = "1000000000"

    const os = {
        taskGiver: requireHelper(() => { return require(config["task-giver"]) }),
        solver: requireHelper(() => { return require(config["solver"]) }),
        verifier: requireHelper(() => { return require(config["verifier"]) }),
        web3: web3,
        accounts: accounts,
        logger: logger,
        fileSystem: ipfsFileSystemHelper(config),
        throttle: config["throttle"],
        config: config
    }

    os.taskSubmitter = await submitter(
        os.web3,
        os.logger,
        os.fileSystem
    )

    return os

}
