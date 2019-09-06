const zeroWord = Buffer.alloc(16)

function makeMerkle(hash, arr, i, level) {
	if (level == 0) {
		if (i < arr.length) {
			return arr[i].toString("hex")
		} else {
			return zeroWord.toString("hex")
		}
	} else {
		let res = hash(makeMerkle(hash, arr, i, level - 1) + makeMerkle(hash, arr, i + Math.pow(2, level - 1), level - 1))
		return res.substr(2)
	}
}

function depth(x) {
	if (x <= 1) {
		return 0
	} else {
		return 1 + depth(Math.floor(x / 2))
	}
}

function to16BytesArray(inputBuf) {
	let leafs = []
	let i = 0
	while (i < inputBuf.byteLength) {
		let buf = inputBuf.slice(i, i + 16)
		if (buf.byteLength < 16) {
			leafs.push(Buffer.concat([buf, Buffer.alloc(16 - buf.byteLength)]))
		} else {
			leafs.push(buf)
		}
		i += 16
	}
	return leafs
}

module.exports = (hash, input) => {
	let chunks = to16BytesArray(input)
	while (chunks.length < 2) chunks.push(zeroWord)
	// console.log(chunks)
	var res = makeMerkle(hash, chunks, 0, depth(chunks.length * 2 - 1))
	return "0x" + res
}
