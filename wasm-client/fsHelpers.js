
const merkleComputer = require("./merkle-computer")('./../wasm-client/ocaml-offchain/interpreter/wasm')
const setupVM = require('./util/setupVM')

exports.makeRandom = function (n) {
    let res = ""
    for (let i = 0; i < n*2; i++) {
        res += Math.floor(Math.random()*16).toString(16)
    }
    return res
}

function getLeaf(lst, loc) {
    if (loc % 2 == 1) return lst[1]
    else return lst[0]
}
 function parseId(str) {
    var res = ""
    for (var i = 0; i < str.length; i++) res = (str.charCodeAt(i)-65).toString(16) + res
    return "0x" + res;
}
 function parseData(lst, size) {
    var res = []
    lst.forEach(function (v) {
        for (var i = 1; i <= 32; i++) {
            res.push(parseInt(v.substr(i*2, 2), 16))
        }
    })
    res.length = size
    return Buffer.from(res)
}
 function arrange(arr) {
    var res = []
    var acc = ""
    arr.forEach(function (b) { acc += b; if (acc.length == 64) { res.push("0x"+acc); acc = "" } })
    if (acc != "") res.push("0x"+acc)
    return res
}

exports.init = function (fileSystem, web3, mcFileSystem, logger, incentiveLayer) {
    
    async function loadMixedCode(fileid) {
        var hash = await fileSystem.getIPFSCode.call(fileid)
        console.log("code hash", hash, fileid)
        if (hash) {
            return (await mcFileSystem.download(hash, "task.wasm")).content
        }
        else {
			let wasmCode = await fileSystem.getCode.call(fileid)
			return Buffer.from(wasmCode.substr(2), "hex")
        }
    }
        
    async function loadFilesFromChain(id) {
        let lst = await fileSystem.getFiles.call(id)
        let res = []
        for (let i = 0; i < lst.length; i++) {
            let ipfs_hash = await fileSystem.getHash.call(lst[i])
            let name = await fileSystem.getName.call(lst[i])
            if (ipfs_hash) {
				let dataBuf = (await mcFileSystem.download(ipfsHash, name)).content
                res.push({name:name, dataBuf:dta.content})
            }
            else {
                let size = await fileSystem.getByteSize.call(lst[i])
                let data = await fileSystem.getData.call(lst[i])
                let buf = parseData(data, size)
                res.push({name:name, dataBuf:buf})
            }
        }
        return res
    }
        
    async function createFile(fname, buf) {
        var nonce = await web3.eth.getTransactionCount(account)
        var arr = []
        for (var i = 0; i < buf.length; i++) {
            if (buf[i] > 15) arr.push(buf[i].toString(16))
            else arr.push("0" + buf[i].toString(16))
        }
        // console.log("Nonce file", nonce, {arr:arr, buf:buf, arranged: arrange(arr)})
        var tx = await fileSystem.createFileWithContents(fname, nonce, arrange(arr), buf.length, {from: account, gas: 200000})
        var id = await fileSystem.calcId.call(nonce, {from: account, gas: 200000})
        var lst = await fileSystem.getData.call(id, {from: account, gas: 200000})
        console.log("Ensure upload", {data:lst})
        return id
    }
    
    function uploadIPFS(fname, buf) {
        return new Promise(function (cont,err) {
            ipfs.files.add([{content:buf, path:fname}], function (err, res) {
                cont(res[0])
            })
        })
    }
    
     async function createIPFSFile(fname, buf) {
        var hash = await uploadIPFS(fname, buf)
        var info = merkleComputer.merkleRoot(buf)
        var nonce = await web3.eth.getTransactionCount(base)
        logger.info("Adding ipfs file", {name:new_name, size:info.size, ipfs_hash:hash.hash, data:info.root, nonce:nonce})
        await fileSystem.addIPFSFile(new_name, info.size, hash.hash, info.root, nonce, {from: account, gas: 200000})
        var id = await fileSystem.calcId.call(nonce, {from: account, gas: 200000})
        return id
    }
    
    async function uploadOutputs(task_id, vm) {
        var lst = await incentiveLayer.getUploadNames.call(task_id)
        var types = await incentiveLayer.getUploadTypes.call(task_id)
        console.log("Uploading", {names:lst, types:types})
        if (lst.length == 0) return
        var proofs = await vm.fileProofs() // common.exec(config, ["-m", "-input-proofs", "-input2"])
        // var proofs = JSON.parse(proofs)
        console.log("Uploading", {names:lst, types:types, proofs: proofs})
        for (var i = 0; i < lst.length; i++) {
            // find proof with correct hash
            console.log("Findind upload proof", {hash:lst[i], kind:types[i]})
            var hash = lst[i]
            var proof = proofs.find(el => getLeaf(el.name, el.loc) == hash)
            if (!proof) {
                logger.error("Cannot find proof for a file")
                continue
            }
            console.log("Found proof", proof)
            // upload the file to ipfs or blockchain
            var fname = proof.file.substr(0, proof.file.length-4)
            var buf = await vm.readFile(proof.file)
            var file_id
            if (parseInt(types[i]) == 1) file_id = await createIPFSFile(fname, buf)
            else {
                console.log("Create file", {fname:fname, data:buf})
                file_id = await createFile(fname, buf)
            }
            console.log("Uploading file", {id:file_id, fname:fname})
            console.log("result", await incentiveLayer.uploadFile.call(task_id, i, file_id, proof.name, proof.data, proof.loc, {from: account, gas: 1000000}))
            await incentiveLayer.uploadFile(task_id, i, file_id, proof.name, proof.data, proof.loc, {from: account, gas: 1000000})
        }
    }
    
    async function setupVMWithFS(taskInfo) {
        let taskID = taskInfo.taskID
        let storageAddress = taskInfo.storageAddress
        if (taskInfo.storageType == merkleComputer.StorageType.BLOCKCHAIN) {
            if (storageAddress.substr(0,2) == "0x") {
                let wasmCode = await fileSystem.getCode.call(storageAddress)
                let buf = Buffer.from(wasmCode.substr(2), "hex")
                return setupVM(
                    incentiveLayer,
                    merkleComputer,
                    taskID,
                    buf,
                    taskInfo.codeType,
                    false
                )
            }
            else {
                let fileid = parseId(storageAddress)
                let buf = await loadMixedCode(fileid)
                let files = await loadFilesFromChain(fileid)
                return setupVM(
                    incentiveLayer,
                    merkleComputer,
                    taskID,
                    buf,
                    taskInfo.codeType,
                    false,
                    files
                )
            }
        }
        else {
            let codeIPFSHash = await fileSystem.getIPFSCode.call(storageAddress)

            let name = "task.wast"

            let codeBuf = (await mcFileSystem.download(codeIPFSHash, name)).content

            //download other files
            let fileIDs = await fileSystem.getFiles.call(storageAddress)

            let files = []

            if (fileIDs.length > 0) {
                for(let i = 0; i < fileIDs.length; i++) {
                    let fileID = fileIDs[i]
                    let name = await fileSystem.getName.call(fileID)
                    let ipfsHash = await fileSystem.getHash.call(fileID)
                    let dataBuf = (await mcFileSystem.download(ipfsHash, name)).content
                    files.push({
                        name: name,
                        dataBuf: dataBuf
                    })				
                }
            }

            return setupVM(
                incentiveLayer,
                merkleComputer,
                taskID,
                codeBuf,
                taskInfo.codeType,
                false,
                files
            )

        }
    }
    
    return {
        setupVMWithFS: setupVMWithFS,
        uploadOutputs: uploadOutputs,
    }

}
