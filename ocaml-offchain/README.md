[![Build Status](https://travis-ci.org/TrueBitFoundation/ocaml-offchain.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/ocaml-offchain)

<p align="center">
  <img src="./Computation Layer.jpg"/>
</p>

# Installation of the off-chain interpreter

These instructions were tested on Ubuntu 17.04.

First install dependencies
```
apt-get install -y wget gcc ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev
opam init -y
eval $(opam config env)
opam install cryptokit yojson
```

Then go to the `interpreter` directory of the repo
```
cd interpreter
make
```

If the build fails it may be due to an outdated version of ocaml. To upgrade simply run `opam switch 4.06.0`, and then follow the steps above starting with `eval $(opam config env)`.

This should generate the executable `wasm` in the `interpreter` directory.

# Testing the off-chain interpreter
```
./wasm -m ../test/core/fac.wast
```
If there are no errors, it means that the tests were passed.

```
./wasm -t -m ../test/core/fac.wast
```

This command will print the trace messages, it will basically output every instruction that the interpreter runs.

Outputting proofs:
```
./wasm -case 0 -step 4 -m ../test/core/fac.wast
```
This will make a proof for step 4 in the computation. Because there are many test cases, one of them has to be selected, so for example `-case 0` will select the first test case.

# Using the JSON-RPC Server

```
cd server
npm install
node index.js
```

A client can communicate with the server like this:
```javascript
var jayson = require('jayson');

// create a client
var client = jayson.client.http({
  port: 3000
});

// invoke *command* with *args*
client.request('*command*', [*args*], function(err, response) {
  if(err) throw err;
  console.log(response.result);
});
```

# Docker

If you want to run these tests inside of a Docker container you can pull the latest docker image and try it out.

```
docker run --name tb-offchain -ti hswick/ocaml-offchain:latest`
cd webasm/interpreter
./wasm -t -m ../test/core/fac.wast
```

# License
The license for the test folder is the original Apache 2.0 license.<br/>
We have re-licensed the interpreter folder to MIT.<br/>
The license for the rest of the repo is MIT.<br/>
