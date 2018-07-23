const fs = require('fs')

const solverConf = { error: false, error_location: 0, stop_early: -1, deposit: 1 }

function writeFile(fname, buf) {
    return new Promise(function (cont,err) { fs.writeFile(fname, buf, function (err, res) { cont() }) })
}

const toVmParameters = require('./toVmParameters')

module.exports = async (incentiveLayer, merkleComputer, taskID, wasmCodeBuffer, codeType, verifier = true, files = []) => {
    
    let agentName = "solver"
    if(verifier) agentName = "verifier"

    let randomPath = process.cwd() + "/tmp." + agentName + "_" + Math.floor(Math.random()*Math.pow(2, 60)).toString(32)

    if (!fs.existsSync(randomPath)) fs.mkdirSync(randomPath)
    
    let filePath

    if (codeType == '0') {
	filePath = randomPath + "/task.wast"
    } else if (codeType == '1') {
	filePath = randomPath + "/task.wasm"
    } else {
	throw "code type not recognized"
    }

    await writeFile(filePath, wasmCodeBuffer)
    
    let vmParameters = toVmParameters(await incentiveLayer.getVMParameters.call(taskID))

    //write files to temp dir
    let fileNames = []
    if (files.length > 0) {
	for(let i = 0; i < files.length; i++) {
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
