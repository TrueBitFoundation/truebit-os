
exports.merkleRoot = require("./merkleRoot")

exports.getNetwork = async (web3) => {
    let id = await web3.eth.net.getId()
    if (id == 5) return "goerli"
    else return await web3.eth.net.getNetworkType()
}

