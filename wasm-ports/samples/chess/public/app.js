const truffleContract = require('truffle-contract')

var listening = false
var hashes = {}
var fileSystem, sampleSubmitter, account

function listenEvents() {

	if (listening) return
	listening = true

	sampleSubmitter.FinishedTask().watch(function(err, result) {
		if (result) {
			console.log(result)
			if (hashes[result.transactionHash]) return
			hashes[result.transactionHash] = true
			let res = Buffer.from(result.args.result.map(a => a.substr(2)).join(""), "hex").toString()
			let data = Buffer.from(result.args.data.substr(2), "hex").toString()
			document.getElementById('tb-result').innerHTML += data + ": " + res + "<br>"
		} else if(err) {
			console.error(err)
		}
	})

	sampleSubmitter.NewTask().watch(function(err, result) {
		if (result) {
			console.log(result)
			if (hashes[result.transactionHash]) return
			hashes[result.transactionHash] = true
			let data = Buffer.from(result.args.data.substr(2), "hex").toString()
			// let data = result.args.data
			document.getElementById('tb-result').innerHTML += "Submitted task " + data + "<br>"
		} else if(err) {
			console.error(err)
		}
	})

}

function getTruebitResult(data) {

    sampleSubmitter.debugData.call(data, {gas: 2000000, from: account}).then(function(res) {
      console.log("Debug data:", res)
    })

    return sampleSubmitter.submitData(data, {gas: 2000000, from: account}).then(function(txHash) {})

}

window.runSample = function () {
    data = document.getElementById('input-data').value

	getTruebitResult(data)
}

function getArtifacts(networkName) {
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

	    sampleSubmitter = truffleContract({
		abi: artifacts.sample.abi
	    })

	    sampleSubmitter.setProvider(window.web3.currentProvider)

	    sampleSubmitter = await sampleSubmitter.at(artifacts.sample.address)

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
