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
    return await contract
	.deploy({data: "0x" + artifacts.bin, arguments: args})
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

function exportContract(contract) {
    return {
	address: contract._address,
	abi: contract._jsonInterface
    }
}

async function deploy() {
    let accounts = await web3.eth.getAccounts()
    let fileSystem = await deployContract('Filesystem', {from: accounts[0], gas: 3500000})
    let judge = await deployContract('Judge', {from: accounts[0], gas: 4600000})
    // let merkle = await deployContract('Merkle', {from: accounts[0], gas: 1000000})
    
    let interactive = await deployContract('Interactive', {from: accounts[0], gas: 3500000}, [judge._address])
    // await interactive.methods.registerJudge(1, merkle._address).send({from: accounts[0]})

    let tru = await deployContract('TRU', {from: accounts[0], gas: 1000000})
    let exchangeRateOracle = await deployContract('ExchangeRateOracle', {from: accounts[0], gas: 1000000})
    let incentiveLayer = await deployContract('IncentiveLayer', {from: accounts[0], gas: 5200000}, [tru._address, exchangeRateOracle._address, interactive._address, fileSystem._address])
    
    fs.writeFileSync('./wasm-client/contracts.json', JSON.stringify({
        fileSystem: exportContract(fileSystem),
        judge: exportContract(judge),
        // merkle: exportContract(merkle),
        interactive: exportContract(interactive),
        tru: exportContract(tru),
        exchangeRateOracle: exportContract(exchangeRateOracle),
        incentiveLayer: exportContract(incentiveLayer)
    }))

    //TODO: Figure what to do for main net

    const TRUperUSD = 2000
    await exchangeRateOracle.methods.updateExchangeRate(TRUperUSD).send({from: accounts[0]})
    
    // Mint tokens for testing
    accounts.forEach(addr => {
        tru.methods.mint(addr, "100000000000000000000000").send({from:accounts[0], gas: 100000})
    })

}

deploy()




