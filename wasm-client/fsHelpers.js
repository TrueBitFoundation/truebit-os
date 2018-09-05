
function makeRandom(n) {
    let res = ""
    for (let i = 0; i < n*2; i++) {
        res += Math.floor(Math.random()*16).toString(16)
    }
    return res
}


