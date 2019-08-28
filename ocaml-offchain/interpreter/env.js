
var fs = require('fs')

// Load all files
var input = {
    name : [],
    data : [],
}

function loadFile(fn) {
    var buf = fs.readFileSync(fn)
    input.name.push(fn)
    // input.size.push(buf.length)
    input.data.push(buf)
}

function loadedFiles() {
    input.name.push("")
    input.data.push("")
}

var ee

// setup command line parameters, needs malloc
function allocArgs(m, lst) {
    var heap8 = new Uint8Array(m.wasmMemory.buffer)
    function setInt(ptr, i) {
        heap8[ptr+0] = ptr&0xff
        heap8[ptr+1] = (ptr>>8)&0xff
        heap8[ptr+2] = (ptr>>16)&0xff
        heap8[ptr+3] = (ptr>>24)&0xff
    }
    var malloc = m.instance.exports._malloc
    var argv = lst.map(function (str) {
        console.log("malloc")
        var ptr = malloc(str.length+1)
        ee.clearStack()
        for (var i = 0; i < str.length; i++) heap8[ptr+1] = str.charCodeAt(i)
        heap8[ptr+str.length] = 0
        return ptr
    })
    console.log("malloc")
    var res = malloc(lst.length*4)
    ee.clearStack()
    for (var i = 0; i < lst.length; i++) setInt(res+i*4, argv[i])
    return res
}

var module

var system = 0

var HEAP32, HEAP8

function _sbrk(increment) {
    console.log("sbrk", increment)
      increment = increment|0;
      var oldDynamicTop = 0;
      var oldDynamicTopOnChange = 0;
      var newDynamicTop = 0;
      var totalMemory = 0;
    
    console.log(module.DYNAMICTOP_PTR, HEAP32[module.DYNAMICTOP_PTR>>2])
    
      oldDynamicTop = HEAP32[module.DYNAMICTOP_PTR>>2]|0;
      newDynamicTop = oldDynamicTop + increment | 0;
/*
      if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
        | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
        abortOnCannotGrowMemory()|0;
        ___setErrNo(12);
        return -1;
      }
*/
      HEAP32[module.DYNAMICTOP_PTR>>2] = newDynamicTop;
    /*
      totalMemory = getTotalMemory()|0;
      if ((newDynamicTop|0) > (totalMemory|0)) {
        if ((enlargeMemory()|0) == 0) {
          HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
          ___setErrNo(12);
          return -1;
        }
      }
      */
      return oldDynamicTop|0;
}

// Make our runtime environment for the wasm module
function makeEnv(env) {
    function finalize() {
        module._finalizeSystem()
    }
    env.getTotalMemory = function () { return module['TOTAL_MEMORY']; };
    env.abort = function () { process.exit(-1) }
    env.exit = function () {
        finalize()
        process.exit(0)
    }
    env._sbrk = _sbrk
    env._getSystem = function () { return system }
    env._setSystem = function (ptr) { system = ptr }
    env._debugSeek = function (ptr) {}
    env._debugString = function (ptr) {
        var str = ""
        while (HEAP8[ptr] != 0) {
            str += String.fromCharCode(HEAP8[ptr])
            ptr++
        }
        console.log("DEBUG:", str)
    }
    env._debugBuffer = function (ptr, len) {
        var str = ""
        while (len > 0) {
            str += String.fromCharCode(HEAP8[ptr])
            len--
            ptr++
        }
        console.log("DEBUG:", str)
    }
    env._debugInt = function (i) { console.log(i) }
    
    env._inputName = function (i,j) {
        // console.log("input name", i, j, input.name[i][j])
        return input.name[i].charCodeAt(j) || 0
    }
    
    env._inputSize = function (i,j) {
        return input.data[i].length
    }
    
    env._inputData = function (i,j) {
        // console.log("input data", i, j, input.data[i][j])
        return input.data[i][j]
    }
    
    env._outputName = function (i,j,c) {
        var len = Math.max(input.name[i].length, j)
        var buf = Buffer.alloc(len, input.name[i])
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
    
    /* Finding critical path */
    
    var stack = []
    var step = 0
    var target = 100000

    var func_stack = [0]
    var loop_stack = [0]
    var step_stack = [0]
    
    env.clearStack = function () {
        func_stack = [0]
        loop_stack = [0]
        step_stack = [0]
    }
    
    var saved = {}
    
    env.printStack = function () {
        var str = JSON.stringify(saved)
        console.log(str, step)
        fs.writeFileSync("critical.json", str)
    }
    
    env.enterLoopCritical = function () {
        step++
        if (step % 1000 == 0) console.log(step)
        if (step == target) {
            step_stack.push(target)
            saved.func = func_stack.concat()
            saved.loop = loop_stack.concat()
            saved.step = step_stack.concat()
        }
        loop_stack[loop_stack.length-1]++
    }

    /*
    env.enterFuncCritical = function () {
        step++
        if (step % 1000 == 0) console.log(step)
        if (step == target) {
            step_stack.push(target)
            saved.func = func_stack.concat()
            saved.loop = loop_stack.concat()
            saved.step = step_stack.concat()
        }
    }*/

    env.pushFuncCritical = function (num) {
        step++
        if (step % 1000 == 0) console.log(step)
        func_stack.push(num)
        loop_stack.push(0)
        step_stack.push(step)
        if (step == target) {
            step_stack.push(target)
            saved.func = func_stack.concat()
            saved.loop = loop_stack.concat()
            saved.step = step_stack.concat()
        }
        // console.log("push ", func_stack.length, num)
    }

    env.popFuncCritical = function (num) {
        if (num == func_stack[func_stack.length-1]) {
            func_stack.length--
            loop_stack.length--
            step_stack.length--
            // console.log("pop ", func_stack.length, num)
        }
        else {
            console.log("cannot pop ", func_stack.length, num, func_stack)
        }
        step++
        if (step % 1000 == 0) console.log(step)
        if (step == target) {
            step_stack.push(target)
            saved.func = func_stack.concat()
            saved.loop = loop_stack.concat()
            saved.step = step_stack.concat()
        }
    }
    
    try {
        var obj = JSON.parse(fs.readFileSync("critical.json"))
        addStackEnv(env, obj)
    }
    catch (e) {}
    
    ee = env
    
}

function getI64() {
    var buffer = new ArrayBuffer(8)
    var view = new Uint8Array(buffer)
    for (var i = 0; i < 8; i++) {
        view[i] = HEAP8[64+i]
    }
    return view
}

function addStackEnv(env, obj) {
    var criticals = {}
    obj.step.forEach(a => criticals[a] = true)

    // Load critical steps
    var step = 0

    var stack = []

    env.countStep = function () {
        step++
        if (step % 1000 == 0) console.log(step)
        if (criticals[step]) console.log("critical", step)
        return criticals[step] || false
    }

    env.testStep = function () {
        return criticals[step+1] || false
    }
    
    env.storeArg = function () {
        return criticals[step+1] || false
    }
    
    env.storeLocalI32 = function (idx, l) {
        stack.push(l)
    }

    env.storeLocalF32 = function (idx, l) {
        stack.push(l)
    }

    env.storeLocalF64 = function (idx, l) {
        stack.push(l)
    }

    env.storeLocalI64 = function (idx) {
        stack.push(getI64())
    }

    env.adjustStackI32 = function (l) {
        if (criticals[step]) stack.push(l)
        return l
    }

    env.adjustStackF32 = function (l) {
        if (criticals[step]) stack.push(l)
        return l
    }

    env.adjustStackF64 = function (l) {
        if (criticals[step]) stack.push(l)
        return l
    }

    env.adjustStackI64 = function (idx) {
        if (criticals[step]) stack.push(getI64())
    }

    env.printStack = function () {
        console.log(stack, step)
    }

}

// var dta = JSON.parse(fs.readFileSync("info.json"))

function handleImport(env, imp) {
    if (imp.kind != "function") return
    var str = imp.name
    if (env[str]) return
    function makeDynamicCall(i) {
        return function () {
            // console.log("dyncall", i)
            return module["_dynCall"+i].apply(null, arguments)
        }
    }

    // how to handle invokes? probably have to find all dynCalls
    if (str.substr(0,7) == "_invoke") {
        var idx = str.substr(7)
        env["_invoke" + idx] = makeDynamicCall(idx)
        return
    }
    
    console.log("should generate import", str)
    env[str] = function () { console.log("called", str) }
}

async function run(binary, args) {
    var info = { env: {}, global: {NaN: 0/0, Infinity:1/0} }
    // var sz = TOTAL_MEMORY / WASM_PAGE_SIZE
    var sz = 256
    info.env.table = new WebAssembly.Table({ 'initial': 10, 'maximum': 10, 'element': 'anyfunc' });
    info.env.memory = new WebAssembly.Memory({ 'initial': sz, 'maximum': sz })
    
    // dta.map(e => { info[e[0]][e[1]] = function () {} })
    
    var mod = await WebAssembly.compile(new Uint8Array(binary))
    
    var imports = WebAssembly.Module.imports(mod)
    // console.log(imports)

    makeEnv(info.env)
    
    imports.forEach(imp => handleImport(info.env,imp))
    
    var m = await WebAssembly.instantiate(new Uint8Array(binary), info)
    module = m.instance.exports
    
    m.wasmMemory = info.env.memory
    
    HEAP32 = new Uint32Array(info.env.memory.buffer)
    HEAP8 = new Uint8Array(info.env.memory.buffer)
    
    var e = m.instance.exports
    
    // After building the environment, run the init functions
    if (e._initSystem) {
        console.log("init system")
        e._initSystem()
        ee.clearStack()
    }
    if (e.__GLOBAL__I_000101) {
        console.log("init global")
        e.__GLOBAL__I_000101()
        ee.clearStack()
    }
    for (name in e) {
        if (name.substr(0, 15) == "__GLOBAL__sub_I" || name.substr(0, 22) == "___cxx_global_var_init") {
            console.log("calling", name)
            e[name]()
            ee.clearStack()
        }
    }
    // if (e.__GLOBAL__sub_I_iostream_cpp) e.__GLOBAL__sub_I_iostream_cpp()
    var argv = allocArgs(m, args)

    console.log("calling main")
    ee.printStack()

    e._main(args.length, argv)
    ee.clearStack()

    if (e._finalizeSystem) {
        console.log("finalize")
        e._finalizeSystem()
    }
    
    console.log("exiting")
    
    ee.printStack()

    for (var i = 0; i < input.data.length; i++) {
        if (input.data[i].length > 0) {
            fs.writeFileSync(input.name[i]+".out", input.data[i])
        }
    }
    
}

process.argv.slice(2).forEach(loadFile)

loadedFiles()

console.log(process.cwd())

run(fs.readFileSync("task.wasm"), ["/home/truebit/program.wasm"])

