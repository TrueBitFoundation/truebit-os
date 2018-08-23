module.exports = async (web3, incentiveLayer, account, minDeposit) => {
	let currentBalance = await web3.eth.getBalance(account)
	let currentDeposit = (await incentiveLayer.getDeposit.call(account)).toNumber()

	let totalAssets = currentBalance + currentDeposit

	if (totalAssets < minDeposit) {
		throw 'current account balance + current deposit is less than minimum deposit specified'
	} else {
		let difference = currentDeposit - minDeposit

		if(difference < 0) {
		    await incentiveLayer.makeDeposit(difference * -1, {from: account})
		}
	}
}
