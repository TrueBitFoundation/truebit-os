
let argv = require('minimist')(process.argv.slice(2));

const fs = require("fs")

let host = argv.host || 'http://localhost:8545'

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))
const bigInt = require("big-integer")

const getNetwork = async () => {
    let id = await web3.eth.net.getId()
    if (id == 5) return "goerli"
    else return await web3.eth.net.getNetworkType()
}

function ether(str) {
    return web3.utils.toWei(str, "ether")
}

async function main() {
    let networkName = await getNetwork(web3)

    let filename = './wasm-client/' + networkName + '.json'
    let accounts = await web3.eth.getAccounts()
    // let startBlock = await web3.eth.getBlockNumber()
    let startBlock = 0

    let config = JSON.parse(fs.readFileSync(filename))

    let cpu = new web3.eth.Contract(config.cpu.abi, config.cpu.address)
    let stake = new web3.eth.Contract(config.stake.abi, config.stake.address)

    let opt = new web3.eth.Contract(config.option.abi, config.option.address)

    let handled = {}

    let target = bigInt(ether((argv.cpu || "1").toString()))

    async function handle(ev) {
        if (handled[ev.id]) return
        handled[ev.id] = true
        console.log("handling", ev.returnValues)
        let a = bigInt(ev.returnValues.amount)
        let ca = bigInt(ev.returnValues.cpu_amount)
        console.log("amount", a, "cpu amount", ca)
        let id = ev.returnValues.id
        let sugg = bigInt(await opt.methods.getSuggested(id).call({from: accounts[0], gas:300000}))
        console.log("suggested price for 1 CPU", sugg)
        if (sugg.lt(target)) {
            console.log("CPU price is lower than target, buy")
        }
    }

    async function check() {
        let evs = await opt.getPastEvents("StartMint", {fromBlock:startBlock})
        evs.forEach(handle)
    }

    setInterval(check, 2000)

}

main()

