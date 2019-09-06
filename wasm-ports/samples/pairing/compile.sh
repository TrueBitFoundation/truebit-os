#!/bin/sh

em++ -O2 -c pairing.cpp -s WASM=1 -I $EMSCRIPTEN/system/include -std=c++11
em++ pairing.o -s WASM=1 -lff -lgmp -I $EMSCRIPTEN/system/include -std=c++11 -o pairing.js
node ~/emscripten-module-wrapper/prepare.js pairing.js --debug --out dist --file _dev_urandom --file input.data --file output.data --upload-ipfs --analyze --run
cp dist/globals.wasm task.wasm
cp dist/info.json .
solc --overwrite --bin --abi --optimize contract.sol -o build

