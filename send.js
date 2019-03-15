
let argv = require('minimist')(process.argv.slice(2), {string:["_"]});

console.log(argv)

let host = argv.host || 'http://localhost:8545'

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))

const base = './build/'

async function main() {

    let accounts = await web3.eth.getAccounts()
    await web3.eth.sendTransaction({from: accounts[0], to: argv._[0], value: web3.utils.toWei("20", "ether")})

}

main()
