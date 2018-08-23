const fs = require('fs')
const contract = require('./contractHelper')
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

async function distribute() {
    let contracts = JSON.parse(fs.readFileSync('./wasm-client/contracts.json'))

    let token = await contract(web3, contracts.tru)
    let exchangeRateOracle = await contract(web3, contracts.exchangeRateOracle)
    
    const TRUperUSD = 2000
    const reward = 100000000
    const minDeposit = 100000

    let accounts = await web3.eth.getAccounts()
    
    await exchangeRateOracle.updateExchangeRate(TRUperUSD, {from: accounts[0]})

    await token.sendTransaction({from: accounts[0], value: web3.utils.toWei('1', 'ether')})
    await token.sendTransaction({from: accounts[1], value: web3.utils.toWei('1', 'ether')})
    await token.sendTransaction({from: accounts[2], value: web3.utils.toWei('1', 'ether')})

    await token.approve(contracts.incentiveLayer.address, reward + (minDeposit * 5), {from: accounts[0]})
    await token.approve(contracts.incentiveLayer.address, minDeposit, {from: accounts[1]})
    await token.approve(contracts.incentiveLayer.address, minDeposit, {from: accounts[2]})
}

distribute()
