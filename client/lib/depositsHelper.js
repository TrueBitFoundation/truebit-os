module.exports = async (session, account, minDeposit) => {
	let currentBalance = await session.web3.eth.getBalance(account)
	let currentDeposit = (await session.contracts.incentiveLayer.getDeposit.call(account)).toNumber()

	let totalAssets = currentBalance + currentDeposit

	if (totalAssets < minDeposit) {
		throw 'current account balance + current deposit is less than minimum deposit specified'
	} else {
		let difference = currentDeposit - minDeposit

		if(difference < 0) {
			await session.contracts.incentiveLayer.makeDeposit({from: account, value: difference * -1})
		}
	}
}