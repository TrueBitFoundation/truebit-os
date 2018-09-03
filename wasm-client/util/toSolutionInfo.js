module.exports = (data) => {
    return {
	taskID: data[0],
	resultHash0: data[1],
	resultHash1: data[2],
	initStateHash: data[3],
	codeType: data[4].toNumber(),
	storageType: data[5].toNumber(),
	storageAddress: data[6],
	solver: data[7]
    }
}
