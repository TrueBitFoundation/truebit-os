
let argv = require('minimist')(process.argv.slice(2));

console.log(argv)

let host = argv.host || 'http://localhost:8545'

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))
const fs = require('fs')
const getNetwork = async () => { return await web3.eth.net.getNetworkType() }

const base = './build/'

async function main() {

    let accounts = await web3.eth.getAccounts()
    await web3.eth.sendTransaction({from: accounts[0], to: argv.to, value: web3.utils.toWei("20", "ether")})

}

main()
