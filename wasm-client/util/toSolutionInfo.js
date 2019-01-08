module.exports = (data) => {
    return {
	taskID: data[0],
	resultHash0: data[1],
	resultHash1: data[2],
	initStateHash: data[3],
	codeType: data[4].toNumber(),
	bundleId: data[5],
	solver: data[6]
    }
}
