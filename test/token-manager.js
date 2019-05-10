const assert = require('assert')
const contractsConfig = require('../wasm-client/util/contractsConfig')
var bigInt = require("big-integer")

let c = x => bigInt(x.toString(10))

function contract(web3, info) {
    return new web3.eth.Contract(info.abi, info.address)    
}

let assert_eq = (a,b) => assert.equal(a.toString(10), b.toString(10))

describe('Truebit Filesystem Smart Contract Unit Tests', function () {
    this.timeout(60000)

    let accounts, web3, manager, token, other

    let balance, other_balance, rate, limit, amount

    before(async () => {
        let os = await require('../os/kernel')('./wasm-client/config.json')

        web3 = os.web3

        accounts = [os.accounts[0]]

        const config = await contractsConfig(web3)

        manager = contract(web3, config['cpuManager'])
        token = contract(web3, config['cpu'])
        other = contract(web3, config['tru'])

        rate = web3.utils.toWei("1", "ether")
        limit = web3.utils.toWei("100", "ether")
        amount = web3.utils.toWei("10", "ether")
    })

    it("check balance", async () => {
        balance = c(await token.methods.balanceOf(accounts[0]).call())
        other_balance = c(await other.methods.balanceOf(accounts[0]).call())
    })

    it("whitelist minting and transfers", async () => {
        await token.methods.addMinter(manager.options.address).send({ from: accounts[0], gas: 300000 })
        await token.methods.allowTransfers(manager.options.address).send({ from: accounts[0], gas: 1000000 })
    })

    it("whitelist conversion for other token", async () => {
        await manager.methods.setRate(other.options.address, rate, rate, limit, 0, 0).send({from: accounts[0], gas: 1000000})
    })

    it("registering user", async () => {
        await manager.methods.register(other.options.address).send({from: accounts[0], gas: 1000000})
    })

    it("deposit funds", async () => {
        await other.methods.approve(manager.options.address, amount).send({from: accounts[0], gas: 1000000})
        await manager.methods.deposit(amount).send({from: accounts[0], gas: 1000000})
        let cur_balance = c(await token.methods.balanceOf(accounts[0]).call())
        let cur_other = c(await other.methods.balanceOf(accounts[0]).call())
        assert_eq(cur_balance.subtract(c(amount)), balance)
        assert_eq(cur_other.add(c(amount)), other_balance)
    })

    it("withdraw funds", async () => {
        await token.methods.approve(manager.options.address, amount).send({from: accounts[0], gas: 1000000})
        await manager.methods.withdraw(amount).send({from: accounts[0], gas: 1000000})
        let cur_balance = c(await token.methods.balanceOf(accounts[0]).call())
        let cur_other = c(await other.methods.balanceOf(accounts[0]).call())
        assert_eq(cur_balance, balance)
        assert_eq(cur_other, other_balance)
    })

})

