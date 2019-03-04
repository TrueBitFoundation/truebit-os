var bigInt = require("big-integer")


function c(x) {
    return bigInt(x.toString(10))
}

module.exports = async (web3, incentiveLayer, tru, account, minDeposit) => {
    let currentBalance = c(await tru.balanceOf.call(account))
    let currentDeposit = c(await incentiveLayer.getDeposit.call(account))

    let deposit = c(minDeposit)

    // console.log("balance", currentBalance.toString(10), "deposit", currentDeposit.toString(10), "needed", minDeposit.toString(10))

    let totalAssets = currentBalance.add(currentDeposit)

    if (totalAssets.lt(deposit)) {
        throw 'current account balance + current deposit is less than minimum deposit specified'
    } else {
        let difference = deposit.subtract(currentDeposit)

        if (difference.gt(0)) {
            await tru.approve(incentiveLayer.address, difference.toString(10), { from: account, gasPrice: web3.gp })            
            await incentiveLayer.makeDeposit(difference.toString(10), { from: account, gasPrice: web3.gp })
            // console.log("difference", difference)
        }
    }
}
