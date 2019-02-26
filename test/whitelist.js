const assert = require('assert')
const fs = require('fs')
const contractsConfig = require('../wasm-client/util/contractsConfig')
const mineBlocks = require('../os/lib/util/mineBlocks')

function makeRandom(n) {
    let res = ""
    for (let i = 0; i < n * 2; i++) {
        res += Math.floor(Math.random() * 16).toString(16)
    }
    return "0x" + res
}

function contract(web3, info) {
    return new web3.eth.Contract(info.abi, info.address)    
}

async function setup(web3) {
    const config = await contractsConfig(web3)

    return [
        contract(web3, config['stake_whitelist']),
        contract(web3, config['ss_incentiveLayer']),
        contract(web3, config['tru']),
    ]
}

async function getTickets(wl, from) {

    return wl.getPastEvents('NewTicket', {fromBlock:from})
}

describe('Truebit Whitelist Smart Contract Unit Tests', function () {
    this.timeout(60000)

    let accounts, wl, taskBook, web3, tru, startBlock

    let tickets = []

    before(async () => {
        let os = await require('../os/kernel')('./wasm-client/ss_config.json')

        let contracts = await setup(os.web3)
        wl = contracts[0]
        taskBook = contracts[1]
        tru = contracts[2]

        web3 = os.web3

        accounts = [os.accounts[0], os.accounts[1], os.accounts[2], os.accounts[3]]
    })

    it("participants should make a deposit", async () => {

        const deposit = web3.utils.toWei("100", "ether")

        for(let account of accounts) {
            await tru.methods.getTestTokens().send({ from: account })
        }
        for(let account of accounts) {
            await tru.methods.approve(wl.options.address, deposit).send({ from: account })
        }
    
        for(let account of accounts) {
            await wl.methods.makeDeposit(deposit).send({from:account})
        }

        startBlock = await web3.eth.getBlockNumber()

    })

    it("participants should buy tickets", async () => {

        for(let account of accounts) {
            let ticket = makeRandom(32)
            tickets.push(ticket)
            await wl.methods.buyTicket(ticket).send({from:account, gas:1000000})
        }

        let evs = await getTickets(wl, startBlock)

        // console.log(evs)

        assert.equal(evs.length, accounts.length)

    })


})

