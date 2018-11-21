
const Web3 = require('web3')
const web3 = new Web3()
const fs = require("fs")

const BN = Web3.utils.BN

if (process.argv.length < 3) {
    console.log("Give test file as argument!")
    process.exit(0)
}

let host = process.argv[3] || "localhost"

let steps = parseInt(process.argv[4]) || 1000

let provider = new web3.providers.HttpProvider('http://' + host + ':8545')
web3.setProvider(provider)

let dir = __dirname + "/../build/"

let test = JSON.parse(fs.readFileSync(process.argv[2]))

// var send_opt = {from:base, gas: 40000000000}

async function findErrorLocation(contr, t) {
    console.log("Had error, let's try to find location")
    // let i = 1000*12
    let i = 0
    while (i < t.steps*12) {
        i++
        try {
            let res = await contr.methods.run3(i, t.code).call({ gas: "4000000000" })
            console.log("Step", Math.floor(i / 12), "phase", i % 12)
            console.log(res)
            console.log("OP", t.code[parseInt(res[1])])
        }
        catch (e) {
            break
        }
    }
}

async function handleTests(contr) {
    console.log("Found", test.length, "test cases")
    let good = 0
    let bad = 0
    let error = 0
    for (let i = 0; i < test.length; i++) {
        let t = test[i]
        console.log("Code length", t.code.length, "with", t.steps, "steps")
        try {
            let res = await contr.methods.run3((t.steps+10)*12,t.code).call({gas:"4000000000"})
            // console.log(res)
            let expected = t.end_stack[0]
            // let expected = new BN(t.end_stack[0].substr(2), 16)
            if (expected == res[0]) {
                // console.log("Ok!")
                good++
            }
            else {
                console.log("Expected", expected, "got", res[0])
                bad++
                var str = t.code.map(a => a.substr(2)).join("")
                fs.writeFileSync("wrong.code", Buffer.from(str, "hex"))
                await findErrorLocation(contr, t)
                process.exit(-1)
            }
        }
        catch (e) {
            console.log("VM error")
            error++
            var str = t.code.map(a => a.substr(2)).join("")
            fs.writeFileSync("wrong.code", Buffer.from(str, "hex"))
            if (t.steps < 2000) {
                await findErrorLocation(contr, t)
                process.exit(-1)
            }
        }
        console.log("Status", good, "ok", bad, "bad", error, "error /", i+1)
    }
}

async function testInterpreter(contr) {
    let vm = test
    /*vm.memory = []
    vm.stack = []
    vm.call_stack = []
    vm.globals = []
    vm.calltable = []
    vm.calltypes = []
    vm.input = [] */
    console.log("Contract at", contr.options.address)
    let res = await contr.methods.run2(steps*12, vm.code, [vm.stack.length, vm.memory.length, vm.call_stack.length,
                    vm.globals.length, vm.calltable.length, vm.calltypes.length, vm.input.length],
                    vm.pc, vm.stack_ptr, vm.call_ptr, vm.memsize).call({gas:"4000000000"})
    console.log(res)
    if (res[0].toString() != "7034535277573963776") {
        console.log("wrong result")
        process.exit(-1)
    }
                
    /* contr.run.call(vm.code, vm.stack, vm.memory, vm.call_stack, vm.globals, vm.calltable, vm.calltypes, vm.input,
                   vm.pc, vm.stack_ptr, vm.call_ptr, vm.memsize, send_opt, (err,res) => handleResult(err,res)) */
}

async function createContract(name, args, base) {
    var code = "0x" + fs.readFileSync(dir + name + ".bin")
    var abi = JSON.parse(fs.readFileSync(dir + name + ".abi"))
    return new web3.eth.Contract(abi).deploy({data: code, arguments:args}).send({from:base, gas:"5000000"})
}

async function doTest() {
    var accts = await web3.eth.getAccounts()
    var base = accts[0]
    // var base = "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1"
    // var base = "0x9acbcf2d9bd157999ae5541c446f8d6962da1d4d"
    // console.log(base)
    
    let balance = await web3.eth.getBalance(base)
    console.log("Using account", base, "with", balance, "wei")

    let contr = await createContract("Interpreter", [], base)
    contr.setProvider(provider)
    // testInterpreter(contr)
    handleTests(contr)
}

doTest()

