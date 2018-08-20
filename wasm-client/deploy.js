const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
const fs = require('fs')

const base = './wasm-client/build/'

function getArtifacts(name) {
    return {
	abi: JSON.parse(fs.readFileSync(base + name + '.abi')),
	bin: fs.readFileSync(base + name + '.bin')
    }
}

async function deployContract(name, options = {}, args = []) {
    let artifacts = getArtifacts(name)
    let contract = new web3.eth.Contract(artifacts.abi)
    await contract
	.deploy({data: "0x"+artifacts.bin, arguments: args})
	.send(options)
}

async function getNetwork() {
    let networkId = await web3.eth.net.getId()
    let networkName
    switch (networkId) {
    case "1":
	networkName = "main";
	break;
    case "2":
	networkName = "morden";
	break;
    case "3":
	networkName = "ropsten";
	break;
    case "4":
	networkName = "rinkeby";
	break;
    case "42":
	networkName = "kovan";
	break;
    default:
	networkName = "development";
    }
    return networkName
}

async function deploy() {
    let accounts = await web3.eth.getAccounts()
    let filesystem = deployContract('Filesystem', {from: accounts[0], gas: 3500000})    
}

deploy()




