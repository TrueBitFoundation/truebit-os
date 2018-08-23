const fs = require('fs')
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

function contract(contractConfig) {
    return new web3.eth.Contract(contractConfig.abi, contractConfig.address)
}

async function distribute() {
    let contracts = JSON.parse(fs.readFileSync('./wasm-client/contracts.json'))

    let token = contract(contracts.tru)
    let exchangeRateOracle = contract(contracts.exchangeRateOracle)
    
    const TRUperUSD = 2000
    const reward = 100000000
    const minDeposit = 100000

    let accounts = await web3.eth.getAccounts()
    
    await exchangeRateOracle.methods.updateExchangeRate(TRUperUSD).send({from: accounts[0]})

    await web3.eth.sendTransaction({from: accounts[0], to: token._address, value: web3.utils.toWei('1', 'ether')})
    await web3.eth.sendTransaction({from: accounts[1], to: token._address, value: web3.utils.toWei('1', 'ether')})
    await web3.eth.sendTransaction({from: accounts[2], to: token._address, value: web3.utils.toWei('1', 'ether')})  

    await token.methods.approve(contracts.incentiveLayer.address, reward + (minDeposit * 5)).send({from: accounts[0]})
    await token.methods.approve(contracts.incentiveLayer.address, minDeposit).send({from: accounts[1]})
    await token.methods.approve(contracts.incentiveLayer.address, minDeposit).send({from: accounts[2]})
}

distribute()
