let argv = require('minimist')(process.argv.slice(2));

const fs = require("fs")
const util = require('util');
const exec = util.promisify(require('child_process').exec)

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

    let reg = new web3.eth.Contract(config.ipfsRegister.abi, config.ipfsRegister.address)

    // get addresses
    let evs = await reg.getPastEvents("Register", {fromBlock:0})

    for (let e of evs) {
        let addr = e.returnValues.addr
        console.log("Connecting to", addr)
        try {
            let {stdout, stderr} = await exec("ipfs swarm connect " + addr)
            console.log(stdout || "", stderr || "")
        }
        catch (err) {
            console.log("Error", err.stderr)
        }
    }

    // console.log(evs)

    let {stdout} = await exec("ipfs id")

    let dta = JSON.parse(stdout)["Addresses"] || []

    for (let e of dta) {
        if (e.match(/\/ip6/)) continue
        if (e.match(/\/ip4\/127/)) continue
        if (e.match(/\/ip4\/192.168/)) continue
        // if (e.match(/\/ip4\//)) continue
        console.log("Registering", e)
        await reg.methods.register(e).send({from: accounts[0], gas:300000})
    }

}

main()


