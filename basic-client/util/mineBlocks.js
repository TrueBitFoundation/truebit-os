module.exports = async (web3, n) => {
    for(let i = 0; i < n; i++) {
      await new Promise((resolve, reject) => {
        web3.eth.currentProvider.send({
          jsonrpc: '2.0',
          method: 'evm_mine',
          params: [],
          id: 0,
        }, () => {resolve()})
      })
    }
}