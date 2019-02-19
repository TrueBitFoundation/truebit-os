module.exports = async (web3, incentiveLayer, tru, account, minDeposit) => {
    let currentBalance = (await tru.balanceOf.call(account)).toNumber()
    let currentDeposit = (await incentiveLayer.getDeposit.call(account)).toNumber()

    // console.log("balance", currentBalance, "deposit", currentDeposit)

    let totalAssets = currentBalance + currentDeposit

    if (totalAssets < minDeposit) {
        throw 'current account balance + current deposit is less than minimum deposit specified'
    } else {
        let difference = minDeposit - currentDeposit

        if (difference > 0) {
            await tru.approve(incentiveLayer.address, difference, { from: account })            
            await incentiveLayer.makeDeposit(difference, { from: account })
        }
    }
}
