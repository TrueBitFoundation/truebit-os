
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

function ether(str) {
    return web3.utils.toWei(str, "ether")
}

async function main() {
    let networkName = await getNetwork(web3)

    let filename = './wasm-client/' + networkName + '.json'
    let accounts = await web3.eth.getAccounts()

    let config = JSON.parse(fs.readFileSync(filename))

    let tru = new web3.eth.Contract(config.tru.abi, config.tru.address)
    let cpu = new web3.eth.Contract(config.cpu.abi, config.cpu.address)

    let deposit = new web3.eth.Contract(config.deposit.abi, config.deposit.address)

    let tru_amount = (argv.tru || 100).toString()

    await cpu.methods.approve(deposit.options.address, ether("1")).send({from: accounts[0], gas:300000})
    await tru.methods.approve(deposit.options.address, ether(tru_amount)).send({from: accounts[0], gas:300000})

    let id = await deposit.methods.post(ether(tru_amount)).call({from: accounts[0], gas:300000})
    await deposit.methods.post(ether(tru_amount)).send({from: accounts[0], gas:300000})

    console.log("posted state")

    async function check() {
        try {
            let res = await deposit.methods.activate(id).call({from: accounts[0], gas:300000})
            console.log("checking", res)
            await deposit.methods.activate(id).send({from: accounts[0], gas:300000})
            console.log("success")
            process.exit(0)
        }
        catch (wot) {
            console.log("waiting..." + wot)
        }
    }

    setInterval(check, 2000)

}

main()


