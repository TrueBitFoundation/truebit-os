const depositsHelper = require('./depositsHelper')

module.exports = async (session, args) => {
	if (!args['a']) {
		throw "please specify which account number you want to use with the `-a` flag"
	} else {
		let account = session.accounts[args['a'].trim()]

		if(!args['d']) {
			throw "please specify your minimum deposit amount with the `-d` flag"
		} else {

			let minDeposit = args['d'].trim()

      await depositsHelper(session, account, minDeposit)
            
      //start monitoring for solutions
		}

	}
}