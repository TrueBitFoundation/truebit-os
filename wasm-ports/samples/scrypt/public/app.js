const truffleContract = require('truffle-contract')

var fileSystem, scryptSubmitter, account

var listening = false

var hashes = {}

function listenEvents() {

	if (listening) return
	listening = true

	scryptSubmitter.FinishedTask().watch(function(err, result) {
		if (result) {
			console.log(result)
			if (hashes[result.transactionHash]) return
			hashes[result.transactionHash] = true
			let hash = result.args.result
			let data = Buffer.from(result.args.data.substr(2), "hex").toString()
			document.getElementById('tb-scrypt').innerHTML += data + ": " + hash + "<br>"
		} else if(err) {
			console.error(err)
		}
	})

	scryptSubmitter.NewTask().watch(function(err, result) {
		if (result) {
			console.log(result)
			if (hashes[result.transactionHash]) return
			hashes[result.transactionHash] = true
			let data = Buffer.from(result.args.data.substr(2), "hex").toString()
			// let data = result.args.data
			document.getElementById('tb-scrypt').innerHTML += "Submitted task " + data + "<br>"
		} else if(err) {
			console.error(err)
		}
	})

}

function calcScrypt(str) {
    let arr = new Uint8Array(80);
    let tmp = s.encode_utf8(str);
    for (let i = 0; i < 80 && i < tmp.length; i++) arr[i] = tmp[i];
    return s.crypto_scrypt(arr, arr, 1024, 1, 1, 32);
}

window.runScrypt = function () {
    data = document.getElementById('input-data').value
	hash = calcScrypt(data)
	let dta = "0x" + Buffer.from(data).toString("hex")
	console.log(dta)
    scryptSubmitter.submitData(dta, {gas: 2000000, from: account}).then(function(txHash) {
		console.log("Submitted", txHash)
	})
    document.getElementById('js-scrypt').innerHTML += data + ": " + "0x" + s.to_hex(hash) + "<br>"
}

function getArtifacts(networkName) {
            console.log("getting artifacts", networkName)
    httpRequest = new XMLHttpRequest()

    httpRequest.onreadystatechange = async function() {
	if (httpRequest.readyState === XMLHttpRequest.DONE) {
	    //get scrypt submitter artifact
	    const artifacts = JSON.parse(httpRequest.responseText)

	    fileSystem = truffleContract({
		abi: artifacts.fileSystem.abi,
	    })

	    fileSystem.setProvider(window.web3.currentProvider)

	    fileSystem = await fileSystem.at(artifacts.fileSystem.address)

	    scryptSubmitter = truffleContract({
		abi: artifacts.sample.abi
	    })

	    scryptSubmitter.setProvider(window.web3.currentProvider)

	    scryptSubmitter = await scryptSubmitter.at(artifacts.sample.address)

		account = window.web3.eth.defaultAccount
		
		listenEvents()
	}
    }

    httpRequest.open('GET', networkName + '.json')
    httpRequest.send()
}

function init() {
    const isMetaMaskEnabled = function() { return !!window.web3 }

    if (!isMetaMaskEnabled()) {
	document.getElementById('app').innerHTML = "Please install MetaMask"
    } else {

	//alert(networkType)
	window.web3.version.getNetwork((err, netId) => {
            console.log("netid", netId)
	    if(netId == '1') {
		getArtifacts('main')
	    } else if(netId == '3') {
		getArtifacts('ropsten')
	    } else if(netId == '4') {
		getArtifacts('rinkeby')
	    } else if(netId == '5') {
		getArtifacts('goerli')
	    } else if(netId == '42') {
		getArtifacts('kovan')
	    } else {
		getArtifacts('private')
	    }
	})
	
    }
}

window.onload = init
