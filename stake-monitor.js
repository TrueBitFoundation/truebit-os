
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
    return web3.utils.toWei(str.toString(), "ether")
}

async function main() {
    let networkName = await getNetwork(web3)

    let filename = './wasm-client/' + networkName + '.json'
    let accounts = await web3.eth.getAccounts()
    // let startBlock = await web3.eth.getBlockNumber()
    let startBlock = 0

    let config = JSON.parse(fs.readFileSync(filename))

    let cpu = new web3.eth.Contract(config.cpu.abi, config.cpu.address)
    let tru = new web3.eth.Contract(config.tru.abi, config.tru.address)

    let deposit = new web3.eth.Contract(config.deposit.abi, config.deposit.address)

    let handled = {}

    let cpu_target = bigInt(ether((argv.cpu || "1").toString()))
    let tru_target = bigInt(ether((argv.tru || "2").toString()))

    async function handle(ev) {
        if (handled[ev.id]) return
        handled[ev.id] = true
        console.log("handling", ev.returnValues)
        let ta = bigInt(ev.returnValues.tru_amount)
        console.log("tru amount", ta)
        let id = ev.returnValues.id
        let sugg_cpu = bigInt(await deposit.methods.getSuggestedCPU(id).call({from: accounts[0], gas:300000}))
        console.log("suggested price for 1 CPU", sugg_cpu)
        let sugg_tru = bigInt(await deposit.methods.getSuggestedTRU(id).call({from: accounts[0], gas:300000}))
        console.log("suggested amount of TRU for 1 CPU", sugg_tru)
        if (sugg_cpu.lt(cpu_target)) {
            console.log("CPU price is lower than target, buy")
            await tru.methods.approve(deposit.options.address, sugg_cpu.toString()).send({from: accounts[0], gas:300000})
            try {
                await deposit.methods.buyCPU(id).call({from: accounts[0], gas:300000})
                await deposit.methods.buyCPU(id).send({from: accounts[0], gas:300000})
                console.log("success")
            }
            catch (err) {
                console.log("exchange failed", err.toString())
            }
        }
        if (sugg_tru.gt(tru_target)) {
            console.log("TRU price is lower than target, buy")
            await cpu.methods.approve(deposit.options.address, ether(1)).send({from: accounts[0], gas:300000})
            try {
                await deposit.methods.buyTRU(id).call({from: accounts[0], gas:300000})
                await deposit.methods.buyTRU(id).send({from: accounts[0], gas:300000})
                console.log("success")
            }
            catch (err) {
                console.log("exchange failed", err.toString())
            }
        }
    }

    async function check() {
        let evs = await deposit.getPastEvents("Posted", {fromBlock:startBlock})
        evs.forEach(handle)
    }

    setInterval(check, 2000)

}

main()

