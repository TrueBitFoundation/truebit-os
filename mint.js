
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

    // let tru = new web3.eth.Contract(config.tru.abi, config.tru.address)
    let cpu = new web3.eth.Contract(config.cpu.abi, config.cpu.address)
    let stake = new web3.eth.Contract(config.stake.abi, config.stake.address)

    let opt = new web3.eth.Contract(config.option.abi, config.option.address)

    let cpu_amount = (argv.cpu || 2).toString()

    await cpu.methods.approve(opt.options.address, ether("1")).send({from: accounts[0], gas:300000})
    await stake.methods.approve(opt.options.address, ether("2")).send({from: accounts[0], gas:300000})

    let id = await opt.methods.startMint(stake.options.address, ether("2"), ether(cpu_amount)).call({from: accounts[0], gas:300000})
    await opt.methods.startMint(stake.options.address, ether("2"), ether(cpu_amount)).send({from: accounts[0], gas:300000})

    async function check() {
        try {
            let res = await opt.methods.mint(id).call({from: accounts[0], gas:300000})
            console.log("checking", res)
            await opt.methods.mint(id).send({from: accounts[0], gas:300000})
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


