#!/bin/bash

export A=${1%.js}

mkdir -p $A.tmp

## Add hooks
sed -e 's/{{PRE_RUN_ADDITIONS}}/\n#include "\.\.\/pre-run.js"/g' \
    -e 's/{{PREAMBLE_ADDITIONS}}/\n#include "\.\.\/preamble.js"/g' \
    -e 's/var exports = null;/var exports = null; global_info = info;/g' \
    -e 's/updateGlobalBufferViews();/updateGlobalBufferViews(); addHeapHooks();/g' \
    $A.js > $A.tmp/hooked.js

echo "var source_dir = \"$A.tmp\";" > $A.tmp/prep.js
cpp -I .. -P $A.tmp/hooked.js >> $A.tmp/prep.js

## Run the program, generates globals.json and record.bin
nodejs $A.tmp/prep.js $2

## merge file system
./ocaml-offchain/interpreter/wasm -merge $A.wasm ocaml-offchain/interpreter/filesystem.wasm && mv merge.wasm $A.tmp

## merge globals
./ocaml-offchain/interpreter/wasm -add-globals $A.tmp/globals.json $A.tmp/merge.wasm && mv globals.wasm $A.tmp

## Run with off-chain interpreter
cd $A.tmp
../ocaml-offchain/interpreter/wasm -m -file record.bin -table-size 20 -stack-size 20 -memory-size 25 -arg $2 -wasm globals.wasm

