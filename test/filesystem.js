const assert = require('assert')
const contractsConfig = require('../wasm-client/util/contractsConfig')
const merkleRoot = require('../utils/merkleRoot').web3
const mineBlocks = require('../os/lib/util/mineBlocks')

function makeRandom(n) {
    let res = ""
    for (let i = 0; i < n * 2; i++) {
        res += Math.floor(Math.random() * 16).toString(16)
    }
    return Buffer.from(res, "hex")
}

async function wait(web3, fs, acc) {
    
    let bn = await web3.eth.getBlockNumber()
    fs.methods.ev().send({from:acc})
    console.log("block", bn)

    await (new Promise((resolve, reject) => {
        fs.once("MakeEvent", {fromBlock:bn}, (err,ev) => {
            console.log(ev)
            if (err) reject(err); else resolve(ev) })
    }))

    let bn2 = await web3.eth.getBlockNumber()
    console.log("block", bn2)

}

async function waitFor(web3, fs, evn) {
    
    let bn = await web3.eth.getBlockNumber()
    // console.log("block", bn)

    let res = await (new Promise((resolve, reject) => {
        fs.once(evn, {fromBlock:bn}, (err,ev) => {
            // console.log(ev)
            if (err) reject(err); else resolve(ev) })
    }))

    let bn2 = await web3.eth.getBlockNumber()
    // console.log("block", bn2)
    return res

}

function contract(web3, info) {
    return new web3.eth.Contract(info.abi, info.address)    
}

async function setup(web3) {
    const config = await contractsConfig(web3)

    return [
        contract(web3, config['fileSystem']),
    ]
}

describe('Truebit Filesystem Smart Contract Unit Tests', function () {
    this.timeout(60000)

    let accounts, web3, filesystem

    before(async () => {
        let os = await require('../os/kernel')('./wasm-client/ss_config.json')

        let contracts = await setup(os.web3)
        filesystem = contracts[0]

        web3 = os.web3

        accounts = [os.accounts[0]]
    })

    let rnd = Math.floor(Math.random()*1000000)

    it("creating empty file", async () => {
        let buf = Buffer.from("")
        let res = await filesystem.methods.createFileFromBytes("file", rnd, "0x"+buf.toString("hex")).send({from:accounts[0], gas:5000000})
        assert.equal(res.events.CreatedFile.returnValues.root, merkleRoot(web3, buf))
        /*
        let file = await filesystem.methods.calcId(rnd).call()
        console.log("umm here", file)
        assert.equal(await filesystem.methods.getRoot(file).call(), merkleRoot(web3, buf))
        */
    })

    it("creating smaller file", async () => {
        rnd++

        let sz = Math.floor(Math.random() * 32)
        let buf = Buffer.from(makeRandom(sz))
        let res = await filesystem.methods.createFileFromBytes("file", rnd, "0x"+buf.toString("hex")).send({from:accounts[0], gas:5000000})
        assert.equal(res.events.CreatedFile.returnValues.root, merkleRoot(web3, buf))
        /*
        let file = await filesystem.methods.calcId(rnd).call()
        assert.equal(await filesystem.methods.getRoot(file).call(), merkleRoot(web3, buf))
        */
    })

    it("a bit larger file", async () => {
        rnd++

        let sz = Math.floor(Math.random() * 32) + 32
        let buf = Buffer.from(makeRandom(sz))
        let res = await filesystem.methods.createFileFromBytes("file", rnd, "0x"+buf.toString("hex")).send({from:accounts[0], gas:5000000})
        assert.equal(res.events.CreatedFile.returnValues.root, merkleRoot(web3, buf))
    })

    it("more larger file", async () => {
        rnd++

        let sz = Math.floor(Math.random() * 1000) + 64
        let buf = Buffer.from(makeRandom(sz))
        let res = await filesystem.methods.createFileFromBytes("file", rnd, "0x"+buf.toString("hex")).send({from:accounts[0], gas:5000000})
        assert.equal(res.events.CreatedFile.returnValues.root, merkleRoot(web3, buf))
    })

})
