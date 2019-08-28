
const fs = require("fs")

let str = fs.readFileSync(process.argv[2]).toString().split("\n")

str.pop()

str = str.map(a => JSON.parse(a))

let res = []

for (let i = 0; i < str.length; i += 2) {
    Object.assign(str[i], str[i+1])
    res.push(str[i])
}

console.log(JSON.stringify(res))

