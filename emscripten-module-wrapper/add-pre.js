
const fs = require("fs")

function handle(fname, prename) {
    var prerun = fs.readFileSync(prename, "utf8")
    var str = fs.readFileSync(fname, "utf8")
    str = str.replace(/var asm /, prerun + "\nvar asm ")
    fs.writeFileSync(fname, str)
    
}

handle(process.argv[2], process.argv[3])

