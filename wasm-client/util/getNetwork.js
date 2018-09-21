module.exports = async (web3) => {
    let networkId = await web3.eth.net.getNetworkType()
    let networkName
    switch (networkId) {
        case "1":
            networkName = "main";
            break;
        case "2":
            networkName = "morden";
            break;
        case "3":
            networkName = "ropsten";
            break;
        case "4":
            networkName = "rinkeby";
            break;
        case "42":
            networkName = "kovan";
            break;
        default:
            networkName = "development";
    }
    return networkName    
}
