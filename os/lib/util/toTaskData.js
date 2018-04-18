//bytes taskData, uint numSteps, uint state, uint[3] intervals
module.exports = (data) => {
	return {
		taskData: data[0],
		numSteps: data[1].toNumber(),
		state: data[2].toNumber(),
		intervals: [data[3][0].toNumber(), data[3][1].toNumber(), data[3][2].toNumber()],
		taskCreationBlockNumber: data[4].toNumber()
	}
}