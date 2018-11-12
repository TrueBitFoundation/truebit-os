const BigNumber = require('bignumber.js')
const contractsConfig = require('../../../wasm-client/util/contractsConfig')
const contract = require('../../../wasm-client/contractHelper')

module.exports = async (os) => {

    const config = await contractsConfig(os.web3)
    const TRU = await contract(os.web3.currentProvider, config['tru'])
    
    return {
	ethBalance: async (account) => {
	    return new BigNumber(await os.web3.eth.getBalance(account))
	},
	ethReportDif: async (original, account, name) => {
	    let newBalance = new BigNumber(await os.web3.eth.getBalance(account))
	    let dif = newBalance.minus(original)

	    let amount = os.web3.utils.fromWei(dif.toString(), 'ether') 
	    console.log(name + " balance change ETH: " + amount)
	},
	truBalance: async (account) => {
	    return new BigNumber(await tru.balanceOf.call(account))
	},
	truReportDif: async (original, account, name) => {
	    let newBalance = new BigNumber(await tru.balanceOf.call(account))

	    let dif = newBalance.minus(original)

	    let amount = os.web3.utils.fromWei(dif.toString(), 'ether') 
	    console.log(name + " balance change TRU: " + amount)
	    
	}
    }
}
