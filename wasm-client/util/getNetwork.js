module.exports = async (web3) => {
    return await web3.eth.net.getNetworkType()
}
