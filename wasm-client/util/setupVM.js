const fs = require('fs')

const solverConf = { error: false, error_location: 0, stop_early: -1, deposit: 1 }

function writeFile(fname, buf) {
    return new Promise(function (cont,err) { fs.writeFile(fname, buf, function (err, res) { cont() }) })
}

const toVmParameters = require('./toVmParameters')

module.exports = async (incentiveLayer, merkleComputer, taskID, wasmCodeBuffer, codeType, verifier = true) => {
    
    let agentName = "solver"
    if(verifier) agentName = "verifier"
    
    let filePath = process.cwd() + "/temp/" + "tmp." + agentName + Math.floor(Math.random()*Math.pow(2, 60)).toString(32) + "WasmCode.wast"

    await writeFile(filePath, wasmCodeBuffer)
    
    let vmParameters = toVmParameters(await incentiveLayer.getVMParameters.call(taskID))

    //TODO: Allow for input files
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
