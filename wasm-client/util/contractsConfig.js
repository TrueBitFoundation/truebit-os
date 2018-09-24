const getNetwork = require('./getNetwork')
const fs = require('fs')

module.exports = async (web3) => {
    const networkName = await getNetwork(web3)
    return JSON.parse(fs.readFileSync('./wasm-client/' + networkName + '.json'))
}
