
module.exports.makeEnv = function (num) {
    /* Finding critical path */
    
    let env = {}

    var stack = []
    var step = 0
    var target = num

    var func_stack = [0]
    // var loop_stack = [0]
    var step_stack = [0]

    env.clearStack = function () {
        func_stack = [0]
        // loop_stack = [0]
        step_stack = [0]
    }
    
    env.saved = {}
    
    let saved = env.saved
    
    env.getStep = function () {
        return step
    }

    /*
    env.printStack = function () {
        var str = JSON.stringify(env.saved)
        console.log(str, step)
        fs.writeFileSync("critical.json", str)
    }
    */
    
    env.enterLoopCritical = function () {
        step++
        if (step % 1000 == 0) console.log(step)
        if (step == target) {
            step_stack.push(target)
            saved.func = func_stack.concat()
            // saved.loop = loop_stack.concat()
            saved.step = step_stack.concat()
        }
        // loop_stack[loop_stack.length-1]++
    }

    env.pushFuncCritical = function (num) {
        step++
        if (step % 1000 == 0) console.log(step)
        func_stack.push(num)
        // loop_stack.push(0)
        step_stack.push(step)
        if (step == target) {
            step_stack.push(target)
            saved.func = func_stack.concat()
            // saved.loop = loop_stack.concat()
            saved.step = step_stack.concat()
        }
        // console.log("push ", func_stack.length, num)
    }

    env.popFuncCritical = function (num) {
        if (num == func_stack[func_stack.length-1]) {
            func_stack.length--
            // loop_stack.length--
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
            // saved.loop = loop_stack.concat()
            saved.step = step_stack.concat()
        }
    }
    
    return env

}

