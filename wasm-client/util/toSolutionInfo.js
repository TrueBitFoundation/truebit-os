module.exports = (data) => {
    return {
	taskID: data[0].toNumber(),
	resultHash: data[1],
	initStateHash: data[2],
	codeType: data[3].toNumber(),
	storageType: data[4].toNumber(),
	storageAddress: data[5],
	solver: data[6]
    }
}
