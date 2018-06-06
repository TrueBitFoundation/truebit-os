const fs = require('fs')

const solverConf = { error: false, error_location: 0, stop_early: -1, deposit: 1 }

function writeFile(fname, buf) {
    return new Promise(function (cont,err) { fs.writeFile(fname, buf, function (err, res) { cont() }) })
}

const toVmParameters = require('./toVmParameters')

module.exports = async (incentiveLayer, merkleComputer, taskID, wasmCodeBuffer, codeType, verifier = true) => {
    //TODO: add random path to ensure it doesnt get over written

    let agentName = "solver"
    if(verifier) agentName = "verifier"
    
    let filePath = process.cwd() + "/tmp." + agentName + "WasmCode.wast"

    await writeFile(filePath, wasmCodeBuffer)
    
    let vmParameters = toVmParameters(await incentiveLayer.getVMParameters.call(taskID))

    //TODO: Generalize config
    let config = {
	code_file: filePath,
	input_file: "",
	actor: solverConf,
	files: [],
	vm_parameters: vmParameters,
	code_type: codeType
    }

    let randomPath = process.cwd() + "/tmp." + agentName + "_" + Math.floor(Math.random()*Math.pow(2, 60)).toString(32)

    vm = merkleComputer.init(config, randomPath)

    return vm
}
