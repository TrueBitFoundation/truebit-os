module.exports = (data) => {
    return {
	low: data[0].toNumber(),
	high: data[1].toNumber()
    }
}
