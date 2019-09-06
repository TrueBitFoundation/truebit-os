
const fs = require('fs')
const buildstack = require("./buildstack")
const critical = require("./critical")
const execFile = require('child_process').execFile

let argv = require('minimist')(process.argv.slice(2));

const wasm_path = __dirname + "/../ocaml-offchain/interpreter/wasm"

function doExec(e, args, path) {
    return new Promise(function (resolve, reject) {
        execFile(e, args, { cwd: path }, function (error, stdout, stderr) {
                console.error(stderr)
                resolve(stdout)
        })
    })
}

console.log(argv)

// Load all files
let input = {
    name : [],
    data : [],
}

function loadFile(fn) {
    let buf = fs.readFileSync(fn)
    input.name.push(fn)
    // input.size.push(buf.length)
    input.data.push(buf)
}

function loadedFiles() {
    input.name.push("")
    input.data.push("")
}

function resetFiles() {
    input.name = [];
    input.data = [];
}

// setup command line parameters, needs malloc
function allocArgs(m, lst) {
    let malloc = m.instance.exports._malloc
    if (!malloc) return
    let heap8 = new Uint8Array(m.wasmMemory.buffer)
    function setInt(ptr, i) {
        heap8[ptr+0] = i&0xff
        heap8[ptr+1] = (i>>8)&0xff
        heap8[ptr+2] = (i>>16)&0xff
        heap8[ptr+3] = (i>>24)&0xff
    }
    let args = lst.map(function (str) {
        let ptr = malloc(str.length+1)
        for (let i = 0; i < str.length; i++) heap8[ptr+1+memory_offset] = str.charCodeAt(i)
        heap8[ptr+str.length+memory_offset] = 0
        return ptr
    })
    let res = malloc(lst.length*4)
    for (let i = 0; i < lst.length; i++) setInt(res+i*4+memory_offset, args[i])
    return res
}

let mdle
let system = 0

let gas = 0
let gas_limit = 0
let call_limit = 0
let stack_limit = 0
let memory_offset = 0

let HEAP32, HEAP8, e

function _sbrk(increment) {
    console.log("sbrk", increment)
      increment = increment|0;
      let oldDynamicTop = 0;
      // var oldDynamicTopOnChange = 0;
      let newDynamicTop = 0;
      // var totalMemory = 0;
    
    console.log(mdle.DYNAMICTOP_PTR, HEAP32[(mdle.DYNAMICTOP_PTR+memory_offset)>>2])
    
      oldDynamicTop = HEAP32[(mdle.DYNAMICTOP_PTR+memory_offset)>>2]|0;
      newDynamicTop = oldDynamicTop + increment | 0;
      HEAP32[(mdle.DYNAMICTOP_PTR+memory_offset)>>2] = newDynamicTop;
      return oldDynamicTop|0;
}

// Make our runtime environment for the wasm module
function makeEnv(env) {
    env.getTotalMemory = function () { return mdle['TOTAL_MEMORY']; };
    env.abort = function () { process.exit(-1) }
    env.exit = function () {
        finalize()
        process.exit(0)
    }
    env._exit = function () {
        finalize()
        process.exit(0)
    }
    env._sbrk = _sbrk
    env._getSystem = function () { return system }
    env._setSystem = function (ptr) { system = ptr }
    env._debugSeek = function (ptr) {}
    env._debugString = function (ptr) {
        var str = ""
        ptr += memory_offset
        while (HEAP8[ptr] != 0) {
            str += String.fromCharCode(HEAP8[ptr])
            ptr++
        }
        console.log("DEBUG:", JSON.stringify(str).substr(0, 256))
    }
    env._debugBuffer = function (ptr, len) {
        let str = ""
        ptr += memory_offset
        while (len > 0) {
            str += String.fromCharCode(HEAP8[ptr])
            len--
            ptr++
        }
        console.log("DEBUG:", JSON.stringify(str).substr(0, 256))
    }
    env._debugInt = function (i) { console.log(i) }
    
    env._inputName = function (i,j) {
        // console.log("input name", i, j, input.name[i][j])
        return input.name[i].charCodeAt(j) || 0
    }
    
    env._rintf = function (x) {
       return x;
    }

    env._inputSize = function (i,j) {
        return input.data[i].length
    }
    
    env._inputData = function (i,j) {
        // console.log("input data", i, j, input.data[i][j])
        return input.data[i][j]
    }
    
    env._outputName = function (i,j,c) {
        let len = Math.max(input.name[i].length, j)
        let buf = Buffer.alloc(len, input.name[i])
        // console.log("doing output")
        input.name[i] = buf
        input.name[i][j] = c
    }

    env._outputSize = function (i,sz) {
        input.data[i] = Buffer.alloc(sz)
    }

    env._outputData = function (i,j,c) {
        input.data[i][j] = c
    }

    env.usegas = function (i) {
        gas += i
        if (gas > gas_limit) {
            console.log("Running out of gas")
            flushFiles()
            process.exit(-1)
        }
    }

    env.gas = env.usegas

    env.abortStackOverflow = function () {
        console.log("stack overflow")
        flushFiles()
        process.exit(-1)
    }
    
    // stack limit
    
    env.pushFrame = function (x) {
        call_limit--
        stack_limit -= x
        if (call_limit < 0) {
            console.log("Exceeded call stack limit")
            flushFiles()
            process.exit(-1)
        }
        if (stack_limit < 0) {
            console.log("Exceeded stack limit")
            flushFiles()
            process.exit(-1)
        }
    }

    env.popFrame = function (x) {
        call_limit++
        stack_limit += x
    }

}

// var dta = JSON.parse(fs.readFileSync("info.json"))

function handleImport(env, imp) {
    if (imp.kind != "function") return
    let str = imp.name
    if (env[str]) return
    function makeDynamicCall(i) {
        return function () {
            // console.log("_dyncall", i)
            return mdle["_dynCall"+i].apply(null, arguments)
        }
    }

    function makeDynamicCall2(i) {
        return function () {
            // console.log("dyncall", i)
            return mdle["dynCall"+i].apply(null, arguments)
        }
    }

    // how to handle invokes? probably have to find all dynCalls
    if (str.substr(0,7) == "_invoke") {
        let idx = str.substr(7)
        env["_invoke" + idx] = makeDynamicCall(idx)
        return
    }
    if (str.substr(0,6) == "invoke") {
        let idx = str.substr(6)
        env["invoke" + idx] = makeDynamicCall2(idx)
        return
    }
    
    console.log("should generate import", str)
    env[str] = function () {
       console.log("called", str)
        finalize()
        process.exit(0)
    }
}

function finalize() {

    if (e._finalizeSystem) {
        console.log("finalize")
        e._finalizeSystem()
    }

    flushFiles()

}

function flushFiles() {
    for (let i = 0; i < input.data.length; i++) {
        if (input.name[i].length > 0) {
            fs.writeFileSync(input.name[i] + ".out", input.data[i])
        }
    }
}

function makeMemory() {
    let sz = argv["memory-size"] || 128
    // var sz = TOTAL_MEMORY / WASM_PAGE_SIZE
    let memory = new WebAssembly.Memory({ 'initial': sz, 'maximum': sz })
    HEAP32 = new Uint32Array(memory.buffer)
    HEAP8 = new Uint8Array(memory.buffer)
    
    // console.log("What", memory)
    return memory
}

async function run(binary, args, env, memory) {
    let info = { env: env, global: {NaN: 0/0, Infinity:1/0} }
//    info.env.table = new WebAssembly.Table({ 'initial': 30784, 'maximum': 30784, 'element': 'anyfunc' });
    info.env.table = new WebAssembly.Table({ 'initial': 100000, 'maximum': 100000, 'element': 'anyfunc' });
    info.env.memory = memory
    // dta.map(e => { info[e[0]][e[1]] = function () {} })
    
    let mod = await WebAssembly.compile(new Uint8Array(binary))
    
    let imports = WebAssembly.Module.imports(mod)
    // console.log(imports)

    makeEnv(info.env)
    
    imports.forEach(imp => handleImport(info.env,imp))
    
    // console.log("What", info.memory)
    
    let m = await WebAssembly.instantiate(new Uint8Array(binary), info)
    mdle = m.instance.exports
    
    gas_limit = (mdle['GAS_LIMIT'] || 0)*1000000
    memory_offset = mdle['MEMORY_OFFSET'] || 0
    let frame_max = mdle.FRAME_MAX || 0
    
    console.log("FRAME MAX", frame_max)
    
    call_limit = Math.pow(2, argv["call-limit"] || 10)
    stack_limit = Math.pow(2, argv["stack-limit"] || 10) - frame_max

    // asmjs initialization
    if (mdle.ASMJS != undefined) {
        console.log("ASM.js code")
        let ptr = mdle._malloc(1024)
        mdle.setHelperStack(ptr)
        mdle.setHelperStackLimit(ptr+1024)
    }
    
    // gas_limit = 1000*1000000
    console.log("gas limit", gas_limit)
    console.log("memory offset", memory_offset)

    m.wasmMemory = info.env.memory
    
    e = m.instance.exports
    
    // After building the environment, run the init functions
    console.log("initializing")
    if (e._initSystem) e._initSystem()
    if (e.__GLOBAL__I_000101) e.__GLOBAL__I_000101()
    for (name in e) {
        if (name.substr(0, 15) == "__GLOBAL__sub_I" || name.substr(0, 22) == "___cxx_global_var_init") {
            e[name]()
        }
    }
    // if (e.__GLOBAL__sub_I_iostream_cpp) e.__GLOBAL__sub_I_iostream_cpp()
    let arg_ptr = allocArgs(m, args)

    console.log("calling main")

    try {
        e._main(args.length, arg_ptr)
    }
    catch (e) {
        console.log("exception while executing", e)
    }

    finalize()
    
    console.log("exiting")
}

function loadFiles() {
    let files = argv["file"]
    if (!files) files = []
    if (typeof files == "string") files = [files]
    files.forEach(loadFile)

    loadedFiles()
}


function main() {
    
    let memory = makeMemory()
    loadFiles()
    run(fs.readFileSync("task.wasm"), ["/home/truebit/program.wasm"], {}, memory)
}

async function findStack(num) {
    // generate two needed files
    await doExec(wasm_path, ["-critical", "task.wasm"])
    await doExec(wasm_path, ["-build-stack", "task.wasm"])
    
    var crit_env = critical.makeEnv(num)
    
    let memory = makeMemory()
    loadFiles()

    await run(fs.readFileSync("critical.wasm"), ["/home/truebit/program.wasm"], crit_env, memory)
    
    if (num == 0) crit_env.saved.step = [0]

    console.log("Steps", crit_env.getStep(), "Critical path", crit_env.saved)
    
    if (!crit_env.saved.step) {
        console.log("Cannot find critical path for step", num)
        return
    }

    memory = makeMemory()
    resetFiles()
    loadFiles()

    var stack_env = buildstack.makeEnv(crit_env.saved, memory)
    
    await run(fs.readFileSync("buildstack.wasm"), ["/home/truebit/program.wasm"], stack_env, memory)

}

if (typeof argv.dump == "number") findStack(parseInt(argv.dump))
else main()

