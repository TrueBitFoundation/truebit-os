module.exports = (depositsManager) => {
  return {
    getDeposit: async (account) => {
			return depositsManager.getDeposit.call(account)
    }
  }
}