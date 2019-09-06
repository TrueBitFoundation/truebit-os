
module.exports.makeEnv = function (obj, memory) {
    
    let env = {}
    
    let HEAP8 = new Uint8Array(memory.buffer)
    
    function getI64() {
        var buffer = new ArrayBuffer(8)
        var view = new Uint8Array(buffer)
        for (var i = 0; i < 8; i++) {
            view[i] = HEAP8[64+i]
        }
        return view
    }

    var criticals = {}
    obj.step.forEach(a => criticals[a] = true)

    // Load critical steps
    var step = 0

    var stack = []
    var call_stack = []
    
    env.storeReturnPC = function (i) {
        console.log("Return PC", i)
        call_stack.push(i)
    }

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
        return criticals[step] || false
    }
    
    env.storeLocalI32 = function (l) {
        console.log("Pushing", l)
        stack.push(l)
    }

    env.storeLocalF32 = function (l) {
        stack.push(l)
    }

    env.storeLocalF64 = function (l) {
        stack.push(l)
    }

    env.storeLocalI64 = function () {
        stack.push(getI64())
    }

    env.adjustStackI32 = function (l) {
        console.log("Checking for return at step", step)
        if (criticals[step+1]) {
            console.log("Pushing return", l)
            stack.push(l)
        }
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
    
    env.storeIndirect = function (a) {
        return a
    }
    
    return env

}
