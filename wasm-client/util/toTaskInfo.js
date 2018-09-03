module.exports = (data) => {
    return {
	giver: data[0],
	initStateHash: data[1],
	codeType: data[2].toNumber(),
	storageType: data[3].toNumber(),
	storageAddress: data[4],
	uniqueNum: data[5]
    }
}
