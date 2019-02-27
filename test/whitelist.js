const assert = require('assert')
const fs = require('fs')
const contractsConfig = require('../wasm-client/util/contractsConfig')
const mineBlocks = require('../os/lib/util/mineBlocks')
const bigInt = require("big-integer")

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
        contract(web3, config['testbook']),
        contract(web3, config['tru']),
    ]
}

async function getTickets(wl, from) {

    let evs = await wl.getPastEvents('NewTicket', {fromBlock:from})

    let lst = []

    for(let t of evs) {
        let valid = await wl.methods.validTicket(t.returnValues.ticket).call()
        if (valid) lst.push(t.returnValues)
    }

    return lst
}

async function selectCandidates(wl, tickets, task) {

    let lst = []

    for(let t of tickets) {
        let w = await wl.methods.verifierWeight(t.ticket, task).call()
        lst.push({ticket:t, weight:bigInt(w)})
    }

    let sorted = lst.sort((b,a) => a.weight.compare(b.weight))

    return sorted

}

async function selectSolver(wl, tickets, task) {

    let lst = []

    for(let t of tickets) {
        let w = await wl.methods.solverWeight(t.ticket, task).call()
        lst.push({ticket:t, weight:bigInt(w)})
    }

    let sorted = lst.sort((b,a) => a.weight.compare(b.weight))

    return sorted

}

async function findSolver(wl, startBlock, task) {
    let tickets = await getTickets(wl, startBlock)

    let lst = await selectCandidates(wl, tickets, task)
    let selected = lst.slice(0, 2).map(a => a.ticket)
    let lst2 = await selectSolver(wl, selected, task)
    return lst2[0].ticket
}

function expectError(p) {
    return p.then(() => Promise.reject(new Error('Expected method to reject')), err => { assert(err instanceof Error) })
}

describe('Truebit Whitelist Smart Contract Unit Tests', function () {
    this.timeout(60000)

    let accounts, wl, taskBook, web3, tru, startBlock

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
            await wl.methods.buyTicket(ticket).send({from:account, gas:1000000})
        }
        for(let account of accounts) {
            let ticket = makeRandom(32)
            await wl.methods.buyTicket(ticket).send({from:account, gas:1000000})
        }

        let tickets = await getTickets(wl, startBlock)

        assert.equal(tickets.length, accounts.length*2)

    })

    let task, solver

    it("select solver", async () => {

        task = makeRandom(32)
        let solution = makeRandom(32)

        await taskBook.methods.addTask(task, solution).send({from:accounts[0]})

        solver = await findSolver(wl, startBlock, task)

        // console.log("Solver ticket", solver)

        await wl.methods.useTicket(solver.ticket, task).send({from:solver.owner})

        let valid = await wl.methods.validTicket(solver.ticket).call()

        let approved = await wl.methods.approved(task, solver.owner).call()

        assert(!valid)
        assert(approved)

    })

    it("cannot select another solver", async () => {
        let tickets = await getTickets(wl, startBlock)
        assert.equal(tickets.length, accounts.length*2-1)
        let solver = tickets[0]

        await expectError(wl.methods.useTicket(solver.ticket, task).send({from:solver.owner}))

    })

    it("releasing ticket", async () => {
        await taskBook.methods.finalizeTask(task).send({from:solver.owner})
        await wl.methods.releaseTicket(solver.ticket).send({from:solver.owner, gas:1000000})

        let evs = await wl.getPastEvents("SlashedTicket", {fromBlock:startBlock})
        assert.equal(evs.length, 0)
    })

    it("select solver again, but also challenge", async () => {

        task = makeRandom(32)
        let solution = makeRandom(32)

        await taskBook.methods.addTask(task, solution).send({from:accounts[0]})

        let tickets = await getTickets(wl, startBlock)
        let lst = await selectCandidates(wl, tickets, task)
        let selected = lst.slice(0,2).map(a => a.ticket)
        let lst2 = await selectSolver(wl, selected, task)
        solver = lst2[0].ticket

        let other = lst2[1].ticket

        // console.log("Solver ticket", solver)

        await wl.methods.useTicket(solver.ticket, task).send({from:solver.owner})

        let valid = await wl.methods.validTicket(solver.ticket).call()

        let approved = await wl.methods.approved(task, solver.owner).call()

        assert(!valid)
        assert(approved)

        let i = 0
        for (let t of selected) {
            await wl.methods.addChallenge(solver.ticket, t.ticket, i).send({from:other.owner, gas:1000000})
            i++
        }

        let chals = await wl.methods.getChallenges(solver.ticket).call()

        assert.equal(chals.length, selected.length)

    })

    it("releasing ticket again", async () => {
        await taskBook.methods.finalizeTask(task).send({from:solver.owner})

        await wl.methods.releaseTicket(solver.ticket).send({from:solver.owner, gas:1000000})

        let evs = await wl.getPastEvents("SlashedTicket", {fromBlock:startBlock})
        assert.equal(evs.length, 0)

    })

    it("select wrong solver", async () => {

        task = makeRandom(32)
        let solution = makeRandom(32)

        await taskBook.methods.addTask(task, solution).send({from:accounts[0]})

        let tickets = await getTickets(wl, startBlock)
        let lst = await selectCandidates(wl, tickets, task)
        let selected = lst.slice(0,2).map(a => a.ticket)
        let lst2 = await selectSolver(wl, selected, task)
        solver = lst2[1].ticket

        let other = lst2[0].ticket

        // console.log("Solver ticket", solver)

        await wl.methods.useTicket(solver.ticket, task).send({from:solver.owner})

        let valid = await wl.methods.validTicket(solver.ticket).call()

        let approved = await wl.methods.approved(task, solver.owner).call()

        assert(!valid)
        assert(approved)

        let i = 0
        for (let t of selected) {
            await wl.methods.addChallenge(solver.ticket, t.ticket, i).send({from:other.owner, gas:1000000})
            i++
        }

        let chals = await wl.methods.getChallenges(solver.ticket).call()

        assert.equal(chals.length, selected.length)

    })

    it("releasing ticket, should get slashed", async () => {
        await taskBook.methods.finalizeTask(task).send({from:solver.owner})
        await wl.methods.releaseTicket(solver.ticket).send({from:solver.owner, gas:1000000})

        let evs = await wl.getPastEvents("SlashedTicket", {fromBlock:startBlock})
        // console.log(evs)
        assert.equal(evs.length, 1)

    })

    it("select a solver that is not candidate", async () => {

        task = makeRandom(32)
        let solution = makeRandom(32)

        await taskBook.methods.addTask(task, solution).send({from:accounts[0]})

        let tickets = await getTickets(wl, startBlock)
        let lst = await selectCandidates(wl, tickets, task)
        let selected = lst.slice(0,2).map(a => a.ticket)
        solver = lst[2].ticket

        let other = lst[0].ticket

        // console.log("Solver ticket", solver)

        await wl.methods.useTicket(solver.ticket, task).send({from:solver.owner})

        let valid = await wl.methods.validTicket(solver.ticket).call()

        let approved = await wl.methods.approved(task, solver.owner).call()

        assert(!valid)
        assert(approved)

        let i = 0
        for (let t of selected) {
            await wl.methods.addChallenge(solver.ticket, t.ticket, i).send({from:other.owner, gas:1000000})
            i++
        }

        let chals = await wl.methods.getChallenges(solver.ticket).call()

        assert.equal(chals.length, selected.length)

    })

    it("releasing ticket, should get slashed", async () => {
        await taskBook.methods.finalizeTask(task).send({from:solver.owner})

        let verifiers = await wl.methods.debugVerifiers(solver.ticket).call()
        let solvers = await wl.methods.debugSolvers(solver.ticket).call()

        // console.log("verifiers", verifiers, "solvers", solvers)
        await wl.methods.releaseTicket(solver.ticket).send({from:solver.owner, gas:1000000})

        let evs = await wl.getPastEvents("SlashedTicket", {fromBlock:startBlock})
        // console.log(evs)
        assert.equal(evs.length, 2)

    })

    it("select solver again, but task fails", async () => {

        task = makeRandom(32)
        let solution = makeRandom(32)

        await taskBook.methods.addTask(task, solution).send({from:accounts[0]})

        let tickets = await getTickets(wl, startBlock)
        let lst = await selectCandidates(wl, tickets, task)
        let selected = lst.slice(0,2).map(a => a.ticket)
        let lst2 = await selectSolver(wl, selected, task)
        solver = lst2[0].ticket

        let other = lst2[1].ticket

        // console.log("Solver ticket", solver)

        await wl.methods.useTicket(solver.ticket, task).send({from:solver.owner})

        let valid = await wl.methods.validTicket(solver.ticket).call()

        let approved = await wl.methods.approved(task, solver.owner).call()

        assert(!valid)
        assert(approved)

        let i = 0
        for (let t of selected) {
            await wl.methods.addChallenge(solver.ticket, t.ticket, i).send({from:other.owner, gas:1000000})
            i++
        }

        let chals = await wl.methods.getChallenges(solver.ticket).call()

        assert.equal(chals.length, selected.length)

    })

    it("releasing ticket again", async () => {
        await taskBook.methods.failTask(task).send({from:solver.owner})

        await wl.methods.failedTicket(solver.ticket).send({from:solver.owner, gas:1000000})

        let evs = await wl.getPastEvents("SlashedTicket", {fromBlock:startBlock})
        assert.equal(evs.length, 3)

    })
})

