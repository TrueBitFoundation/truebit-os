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
node $A.tmp/prep.js $2 $3

OCAML=../ocaml-offchain/interpreter

$OCAML/wasm -underscore $A.wasm && mv underscore.wasm $A.tmp

## merge file system
$OCAML/wasm -merge $A.tmp/underscore.wasm $OCAML/filesystem.wasm && mv merge.wasm $A.tmp

## merge globals
$OCAML/wasm -add-globals $A.tmp/globals.json $A.tmp/merge.wasm && mv globals.wasm $A.tmp
# $OCAML/wasm -shift-mem 2048 $A.tmp/globals.wasm && mv shiftmem.wasm $A.tmp

## Run with off-chain interpreter
cd $A.tmp
# ../$OCAML/wasm -m -file record.bin -table-size 20 -stack-size 20 -memory-size 25 -wasm shiftmem.wasm # -arg $2 -arg $3
../$OCAML/wasm -m -file record.bin -table-size 20 -stack-size 20 -memory-size 25 -wasm globals.wasm # -arg $2 -arg $3

