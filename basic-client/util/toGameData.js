module.exports = (data) => {
    return {
	low: data[0].toNumber(),
	med: data[1].toNumber(),
	high: data[2].toNumber(),
	medHash: data[3],
	lastParticipant: data[4]
    }    
}
