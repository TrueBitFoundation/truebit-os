const fs = require('fs')

module.exports = () => {
	let filePath = './config.json'
	if (fs.existsSync(filePath)) {
		config = JSON.parse(fs.readFileSync(filePath))
		console.log("Reloaded config from " + filePath)
		return config
	} else {
		let defaultConfig = {
			"networks": {
				"development" : {
					"incentive-layer" : __dirname + "/../../incentive-layer/export",
					"dispute-resolution-layer" : __dirname + "/../../dispute-resolution-layer/export"
				}
			}
		}
		fs.writeFileSync(filePath, JSON.stringify(defaultConfig))
		config = defaultConfig
		console.log("config.json file created. Reloaded current config")
		return config
	}
}