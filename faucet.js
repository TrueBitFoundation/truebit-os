
let argv = require('minimist')(process.argv.slice(2));

const fs = require("fs")

let host = argv.host || 'http://localhost:8545'

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))

const getNetwork = async () => {
    let id = await web3.eth.net.getId()
    if (id == 5) return "goerli"
    else return await web3.eth.net.getNetworkType()
}

async function main() {
    let networkName = await getNetwork(web3)

    let filename = './wasm-client/' + networkName + '.json'
    let accounts = await web3.eth.getAccounts()

    let config = JSON.parse(fs.readFileSync(filename))

    let tru = new web3.eth.Contract(config.tru.abi, config.tru.address)

    await tru.methods.enableFaucet().send({from: accounts[0], gas:300000})

}

main()
