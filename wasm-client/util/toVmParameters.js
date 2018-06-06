module.exports = (data) => {
    return {
	stack: data[0].toNumber(),
	mem: data[1].toNumber(),
	globals: data[2].toNumber(),
	table: data[3].toNumber(),
	call: data[4].toNumber()
    }
}
