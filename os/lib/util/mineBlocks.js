module.exports = async (web3, n) => {
  let accounts = await web3.eth.getAccounts()
  
  for (let i = 0; i < n; i++) {
    await web3.eth.sendTransaction({ from: accounts[0], to: accounts[0], value: 123 })
  }
}
