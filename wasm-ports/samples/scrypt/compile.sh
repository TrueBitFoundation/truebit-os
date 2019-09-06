#!/bin/sh

em++ -O2 -I $EMSCRIPTEN/system/include -c -std=c++11 scrypthash.cpp
em++ -O2 -I $EMSCRIPTEN/system/include -c -std=c++11 scrypt.cpp
em++ -o scrypt.js scrypthash.o scrypt.o -lcrypto -lssl

node ~/emscripten-module-wrapper/prepare.js scrypt.js --file input.data --file output.data --run --debug --out=dist --memory-size=20 --metering=5000 --upload-ipfs --limit-stack
cp dist/globals.wasm task.wasm
cp dist/info.json .
solc --overwrite --bin --abi --optimize contract.sol -o build

