const truffleContract = require('truffle-contract')
const ipfs = require('ipfs-api')("localhost", '5001', { protocol: 'http' })
const merkleRoot = require('truebit-util').merkleRoot

async function addIPFSFile(tbFileSystem, account, name, buf, orig_name) {

	let ipfsFile = (await ipfs.files.add([{ content: buf, path: name }]))[0]

	let ipfsHash = ipfsFile.hash
	let size = buf.length
	// let name = ipfsFile.path
	console.log("added to ipfs", ipfsFile, buf)

	//setup file
	let fileNonce = Math.floor(Math.random() * Math.pow(2, 30))
	let mr = merkleRoot(x => window.web3.sha3(x, { encoding: "hex" }).substr(2), buf)
	console.log("with root", name, size, ipfsHash, mr, fileNonce)

	let fileID = await tbFileSystem.calcId.call(fileNonce, { from: account })

	await tbFileSystem.addIPFSFile(name, size, ipfsHash, mr, fileNonce, { from: account, gas: 3000000 })

	console.log("Uploaded file", name, "with root", mr)

	let file = document.getElementById("files")
	file.innerHTML += `<p><div>From file ${orig_name}, ID <span class="file_id">${fileID}</span>, Root ${mr}, IPFS address ${ipfsHash}
	                   <button onclick="submitData(event)">Validate</button></div>`

	return fileID
}

window.submitData = function (ev) {
	window.myEvent = ev
	console.log(ev.origin)
	let id = ev.target.parentElement.querySelector(".file_id").innerHTML
	getTruebitResult(id).then(function (truHash) {
		document.getElementById('tb-result').innerHTML = showResult(truHash)
	})
}

function showResult(hash) {
	return "<div>Output from TrueBit solver:</div> <div>" + hash + "</div>"
}

var fileSystem, sampleSubmitter, account

function getTruebitResult(data) {

	sampleSubmitter.debugData.call(data, { gas: 2000000, from: account }).then(function (res) {
		console.log("Debug data:", res)
	})

	return sampleSubmitter.submitData(data, { gas: 2000000, from: account }).then(function (txHash) {

		const gotFilesEvent = sampleSubmitter.GotFiles()

		return new Promise((resolve, reject) => {
			gotFilesEvent.watch(function (err, result) {
				console.log("Got event", result, err)
				if (result) {
					gotFilesEvent.stopWatching(x => { })
					resolve(result.args.files[0])
				} else if (err) {
					reject()
				}
			})
		})
	})

}

async function testIPFS() {
	addIPFSFile(fileSystem, account, "test.data", new Buffer("asd"))
}

function getArtifacts(networkName) {
	httpRequest = new XMLHttpRequest()

	httpRequest.onreadystatechange = async function () {
		if (httpRequest.readyState === XMLHttpRequest.DONE) {
			//get scrypt submitter artifact
			const artifacts = JSON.parse(httpRequest.responseText)

			fileSystem = truffleContract({
				abi: artifacts.fileSystem.abi,
			})

			fileSystem.setProvider(window.web3.currentProvider)

			fileSystem = await fileSystem.at(artifacts.fileSystem.address)

			sampleSubmitter = truffleContract({
				abi: artifacts.sample.abi
			})

			sampleSubmitter.setProvider(window.web3.currentProvider)

			sampleSubmitter = await sampleSubmitter.at(artifacts.sample.address)

			account = window.web3.eth.defaultAccount

		}
	}

	httpRequest.open('GET', networkName + '.json')
	httpRequest.send()
}


function newIPFSFile() {
	let el = document.querySelector("#wasm_file")
	let fr = new FileReader()
	let name = el.files[0].name
	fr.onload = function () {
		console.log("result", fr)
		addIPFSFile(fileSystem, account, "input.wasm", Buffer.from(fr.result, "binary"), name)
	}
	fr.readAsBinaryString(el.files[0])
}

function init() {
	const isMetaMaskEnabled = function () { return !!window.web3 }

	if (!isMetaMaskEnabled()) {
		document.getElementById('app').innerHTML = "Please install MetaMask"
	} else {

		document.getElementById("wasm_file").onchange = newIPFSFile

		window.web3.version.getNetwork((err, netId) => {
			if (netId == '1') {
				getArtifacts('main')
			} else if (netId == '3') {
				getArtifacts('ropsten')
			} else if (netId == '4') {
				getArtifacts('rinkeby')
			} else if (netId == '42') {
				getArtifacts('kovan')
			} else {
				getArtifacts('private')
			}
		})
	}
}

window.onload = init
