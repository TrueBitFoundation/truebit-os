const fs = require('fs')

const solverConf = { error: false, error_location: 0, stop_early: -1, deposit: 1 }

function writeFile(fname, buf) {
    return new Promise(function (cont, err) { fs.writeFile(fname, buf, function (err, res) { cont() }) })
}

const toVmParameters = require('./toVmParameters')

module.exports = async (incentiveLayer, merkleComputer, taskID, wasmCodeBuffer, codeType, verifier = true, files = []) => {

    let agentName = "solver"
    if (verifier) agentName = "verifier"

    let randomPath = process.cwd() + "/tmp." + agentName + "_" + Math.floor(Math.random() * Math.pow(2, 60)).toString(32)

    if (!fs.existsSync(randomPath)) fs.mkdirSync(randomPath)

    let filePath

    if (codeType == '0') {
        filePath = randomPath + "/task.wast"
    } else if (codeType == '1') {
        filePath = randomPath + "/task.wasm"
    } else {
        throw "code type not recognized"
    }

    let data = await incentiveLayer.methods.getVMParameters(taskID).call()

    let vmParameters = {
        stack: parseInt(data[0]),
        mem: parseInt(data[1]),
        globals: parseInt(data[2]),
        table: parseInt(data[3]),
        call: parseInt(data[4]),
        gasLimit: parseInt(data[5]),
    }
    // add metering
    if (vmParameters.gasLimit > 0) {
        const metering = require('wasm-metering-tb')
        const meteredWasm = metering.meterWASM(wasmCodeBuffer, {
            moduleStr: 'env',
            fieldStr: 'usegas',
            meterType: 'i32'
        })
        wasmCodeBuffer = meteredWasm
        await writeFile(randomPath + "/metered.wasm", wasmCodeBuffer)
        await merkleComputer.run(["-limit-stack", "metered.wasm"], randomPath)
        wasmCodeBuffer = fs.readFileSync(randomPath + "/stacklimit.wasm")
    }

    await writeFile(filePath, wasmCodeBuffer)

    //write files to temp dir
    let fileNames = []
    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            let file = files[i]
            await writeFile(randomPath + "/" + file.name, file.dataBuf)
            fileNames.push(file.name)
        }
    }

    let config = {
        code_file: filePath,
        actor: solverConf,
        files: fileNames,
        vm_parameters: vmParameters,
        code_type: codeType
    }

    vm = merkleComputer.init(config, randomPath)

    return vm
}
