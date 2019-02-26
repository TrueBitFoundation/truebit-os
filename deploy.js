
let argv = require('minimist')(process.argv.slice(2));

let host = argv.host || 'http://localhost:8545'

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider(host))
const fs = require('fs')
const getNetwork = async () => {
    let id = await web3.eth.net.getId()
    if (id == 5) return "goerli"
    else return await web3.eth.net.getNetworkType()
}

const base = './build/'

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
        .deploy({ data: "0x" + artifacts.bin, arguments: args })
        .send(options)
}

function exportContract(contract) {
    return {
        address: contract._address,
        abi: contract._jsonInterface
    }
}

async function deploy() {
    let networkName = await getNetwork(web3)
    let filename = './wasm-client/' + networkName + '.json'
    console.log("Writing to", filename)

    let accounts = await web3.eth.getAccounts()
    let fileSystem = await deployContract('Filesystem', { from: accounts[0], gas: 5500000 })
    let judge = await deployContract('Judge', { from: accounts[0], gas: 5600000 })

    let interactive = await deployContract('Interactive', { from: accounts[0], gas: 5500000 }, [judge._address])

    let tru = await deployContract('TRU', { from: accounts[0], gas: 2000000 })
    let exchangeRateOracle = await deployContract('ExchangeRateOracle', { from: accounts[0], gas: 1000000 })

    let incentiveLayer = await deployContract(
        'IncentiveLayer',
        { from: accounts[0], gas: 5200000 },
        [tru._address,
        exchangeRateOracle._address,
        interactive._address,
        fileSystem._address,
        ]
    )


    // tru.methods.transferOwnership(incentiveLayer._address).send({from: accounts[0], gas: 1000000})

    let wait = 0
    if (networkName == "kovan") wait = 10000
    else if (networkName == "rinkeby") wait = 15000
    else if (networkName == "goerli") wait = 15000
    else if (networkName == "ropsten") wait = 30000

    let config = {
        WAIT_TIME: wait,
        fileSystem: exportContract(fileSystem),
        judge: exportContract(judge),
        interactive: exportContract(interactive),
        tru: exportContract(tru),
        exchangeRateOracle: exportContract(exchangeRateOracle),
        incentiveLayer: exportContract(incentiveLayer),
    }

    if (networkName == "private") {
        let whitelist = await deployContract('WhiteList', { from: accounts[0], gas: 2000000 })
        let stake_whitelist = await deployContract('StakeWhitelist', { from: accounts[0], gas: 2000000 })

        let ss_incentiveLayer = await deployContract(
            'SingleSolverIncentiveLayer',
            { from: accounts[0], gas: 5200000 },
            [interactive._address, fileSystem._address, whitelist._address]
        )
        
        await web3.eth.sendTransaction({ from: accounts[0], to: ss_incentiveLayer._address, value: web3.utils.toWei("2", "ether") })

        await stake_whitelist.methods.setToken(tru._address).send({ from: accounts[0], gas: 300000 })

        config.ss_incentiveLayer = exportContract(ss_incentiveLayer)
        config.stake_whitelist = exportContract(stake_whitelist)
    }

    fs.writeFileSync(filename, JSON.stringify(config))

    // Set exchange rate oracle for testing, main net should come from external data source (dex, oraclize, etc..)
    // const TRUperUSD = 2000
    const TRUperUSD = 0
    await exchangeRateOracle.methods.updateExchangeRate(TRUperUSD).send({ from: accounts[0] })

    // Mint tokens for testing
    if (networkName == "private") accounts.forEach(async addr => {
        await tru.methods.addMinter(addr).send({ from: accounts[0], gas: 300000 })
        await tru.methods.mint(addr, "100000000000000000000000").send({ from: addr, gas: 300000 })
    })

    if (networkName != "ethereum") {
        tru.methods.enableFaucet().send({ from: accounts[0], gas: 300000 })
    }

}

deploy()
