const util = require('ethereumjs-util')

module.exports = (web3, data) => {
    return web3.utils.hexToBytes(data).map((n) => {
	return util.bufferToHex(util.setLengthLeft(n, 32))
    })    
}
