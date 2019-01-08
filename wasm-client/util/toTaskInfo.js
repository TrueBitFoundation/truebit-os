module.exports = (data) => {
    return {
	giver: data[0],
	initStateHash: data[1],
	codeType: data[2].toNumber(),
	bundleId: data[3],
	uniqueNum: data[4]
    }
}
