const program = require('commander')

program
.version('0.0.1')
.description("CLI for Truebit Client system")

program
.command('hello <world>')
.description('Testing out commander')
.action(async function (world) {
  console.log("Hello " + world)
})

program.parse(process.argv)