const jayson = require('jayson');
const shell = require('shelljs');

// create a server
const server = jayson.server({
  wasm: function(args, callback) {
    //args[0] is the filename
    callback(null, shell.exec("../interpreter/wasm -m " + args[0]).code)
  }
});

console.log("Starting WASM Interpreter Server")
server.http().listen(3000);