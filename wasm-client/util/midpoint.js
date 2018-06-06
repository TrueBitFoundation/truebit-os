module.exports = (lowStep, highStep) => {
    return Math.floor((highStep - lowStep) / 2 + lowStep)
}
