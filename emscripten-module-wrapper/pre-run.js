
// {{PRE_LIBRARY}}

/*
console.log(Module)

for (i in Module) {
    if (typeof Module[i] == "number") console.log(i + ": " + Module[i])
    else console.log(i + ": " + typeof Module[i])
    // Find out which of there are globals
}
*/

var env_globals = {}

var trace_calls = false
var trace_calls = true

var recording_calls = true
var recording = false

var calls = []

var no_return = {
    "__lock": true,
    "__unlock": true,
}

var foo = 0

function makeStub(name, func) {
    console.log("Stub: " + name)
    return function () {
        console.log("HERE!!!")
        foo++
        if (trace_calls) console.log("Calling ", name, arguments)
        console.log("Checking", HEAP32[1024/4])
        // if (recording) startMemoryRecord()
        if (name == "___syscall146") {
            console.log("FD is at", arguments[1])
            var fd = HEAP32[arguments[1]>>2]
            console.log("FD is", fd)
            // var stream = FS.getStream(fd)
            // console.log("stream is at", stream.position)
        }
        console.log("HERE 2!!!", func)
        var res = func.apply(null, arguments)
        console.log("HERE 3!!!")
        if (recording_calls) {
            var obj = {result: res, args:Array.from(arguments), name:name, memory:(recording ? memory_record : { heap8: [], heap16: [], heap32 : [] })}
            if (!no_return[name]) obj.result = obj.result || 0
            // var obj = {result: res, args:Array.from(arguments), name:name, memory:(recording ? memory_record : { heap8: [], heap16: [], heap32 : [] })}
            if (trace_calls && recording) console.log(memory_record)
            outputCall(obj)
        }
        // calls.push({result: res, args:Array.from(arguments), name:name, memory:memory_record})
        if (trace_calls) console.log("Result", res)
        return res
    }
}

var implemented = {
    "getTotalMemory": true,
    "_emscripten_memcpy_big": true,
    "__syscall5": true, // open
    "__syscall54": true, // sysctl
    "__syscall140": false, // seek
    "__syscall145": false, // readv
    "__syscall6": true, // close
    "__lock": true,
    "__unlock": true,
    "pthread_mutexattr_init": true,
    "pthread_mutexattr_settype": true,
    "pthread_mutexattr_destroy": true,
    "pthread_condattr_init": true,
    "pthread_condattr_setclock": true,
    "pthread_condattr_destroy": true,
    "pthread_getspecific": true,
    "pthread_setspecific": true,
    "pthread_key_create": true,
    "pthread_mutex_init": true,
    "pthread_mutex_destroy": true,
    "pthread_mutex_lock": true,
    "pthread_mutex_unlock": true,
    "pthread_cond_init": true,
    "pthread_cond_broadcast": true,
    "__cxa_atexit": true,
    "__syscall4": true, // write
    "__syscall146": true, // writev
    "__syscall197": true, // fstat64
    "__syscall221": true, // fadvice64
    "__syscall3": true,
    "sbrk": true,
    "getenv": true,
    "rintf": true,
}

implemented = {}

function insertStubs() {
    for (i in global_info.env) {
        if (typeof global_info.env[i] == "number") {
            console.log(i + ": " + global_info.env[i])
            env_globals[i] = global_info.env[i]
        }
        else {
            if (typeof global_info.env[i] == "function" && !implemented[i] && !implemented[i.substr(1)] && i.substr(0,6) != "invoke") global_info.env[i] = makeStub(i, global_info.env[i])
        }
    }

    console.log(global_info.env)


    global_info.env["readBlock"] = function (x) {
        console.log("Reading block not implemented here", x)
    }

    global_info.env["getInternalFile"] = function (x) {
        console.log("get internal file", x)
        return x
    }

    global_info.env["internalStep"] = function () {
        console.log("get internal step number")
    }

    global_info.env["internalSync"] = function (x) {
        console.log("syncing internal file", x)
    }

    global_info.env["internalSync2"] = function (x) {
        console.log("syncing internal file", x)
    }
}

// console.log(global_info.env)

// console.log(global_info)

var saved_globals = {}

function saveGlobals() {
    console.log("TOP", STACKTOP)
    console.log("HEAP", HEAP32[1024 >> 2])
    console.log("DYNAMICTOP at", DYNAMICTOP_PTR, "=", HEAP32[DYNAMICTOP_PTR >> 2], " and BASE =", DYNAMIC_BASE)
    // Why is this needed? for some reason, it is not recorded
    // if (save_stack_top) HEAP32[1024 >> 2] = STACKTOP
    // HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;
    memory_record.heap32.push([256, HEAP32[1024 >> 2]])
    saved_globals = {
        mem: [].concat.apply([], memory_record.heap32.filter(x => typeof x == "object")),
        env: env_globals,
        total_memory: TOTAL_MEMORY,
    }
    // console.log(env_globals)
    recording_calls = true
    recording = true
    // console.log("stack top here", STACKTOP)
}

addOnPreMain(insertStubs)
addOnPreMain(saveGlobals)

// console.log(JSON.stringify(saved_globals))

// console.log(memory_record)

// writing calls

var arr = []

function u8(x) {
    arr.push(x & 0xff)
}

function u16(x) {
    u8(x)
    u8(x >> 8)
}

function u32(x) {
    u16(x)
    u16(x >> 16)
}

function u64(x) {
    u32(x)
    u32(x >> 32)
}

// Only 32 bit heaps, makes things easier (they fit into JS numbers)

var fs = require("fs")

/*
var rs = fs.createWriteStream(source_dir + "/record.bin")

rs.on('finish', () => {
  console.error('All writes are now complete.');
})

rs.on('error', (err) => {
  console.error('sdhsdhsddlsalds', err)
})
*/

var record_file = fs.openSync(source_dir + "/record.bin", "w")

function outputCall(call) {
// number of args, args
// arg might be 64 bit?
    u16(call.args.length)
    call.args.forEach(u64)
// just setting the memory for now
    var h8 = call.memory.heap8.filter(x => typeof x == "object")
    u32(h8.length)
    h8.forEach(x => { u32(x[0]); u8(x[1]) })
    var h16 = call.memory.heap16.filter(x => typeof x == "object")
    u32(h16.length)
    h16.forEach(x => { u32(x[0]); u16(x[1]) })
    var h32 = call.memory.heap32.filter(x => typeof x == "object")
    u32(h32.length)
    h32.forEach(x => { u32(x[0]); u32(x[1]) })
    // rs.write(Buffer.from(arr), function () { console.log("??????????????????????????????????????????????") })
// also number of returns
    if (typeof call.result != "undefined") {
        u16(1)
        u64(call.result)
    }
    else u16(0)
    fs.writeSync(record_file, Buffer.from(arr))
    arr = []
    // console.error("Output")
}

function outputRecord() {
    console.log("Writing record", foo)
    // u32(calls.length)
    // calls.forEach(outputCall)
    
    // rs.end(function () { console.log("???? what") })
    fs.closeSync(record_file)
    recording_calls = false
    // console.log(global_info.env["__syscall5"](5, 0))

    // fs.writeFileSync(source_dir + "/record.bin", Buffer.from(arr))
    fs.writeFileSync(source_dir + "/globals.json", JSON.stringify(saved_globals))
}

addOnExit(outputRecord)

// console.log("stack max", STACK_MAX)

