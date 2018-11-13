#!/bin/sh

# cd wasm-client/ocaml-offchain/interpreter
# sh gen-offchain-tests.sh
# cd ../../..

# parity --chain dev --no-discovery --unlock=0x00a329c0648769A73afAc7F9381E08FB43dBEA72 --password=foo.txt

for i in wasm-client/ocaml-offchain/interpreter/sol-test/*.wast.json
do
    echo $(basename $i)
    node scripts/test-offchain.js $i || exit 1
done
