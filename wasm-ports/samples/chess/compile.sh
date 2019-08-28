#!/bin/sh

em++ chess.cpp -s WASM=1 -I $EMSCRIPTEN/system/include -std=c++11 -o chess.js
node ~/emscripten-module-wrapper/prepare.js chess.js  --run --debug --out dist --file input.data --file output.data --upload-ipfs
cp dist/globals.wasm task.wasm
cp dist/info.json .
solc --overwrite --bin --abi --optimize contract.sol -o build
