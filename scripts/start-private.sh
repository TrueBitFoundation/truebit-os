#!/bin/bash

echo Starting up Ganache and IPFS

ganache-cli -h 0.0.0.0 > ~/ganache_log 2>&1 &
ipfs daemon  > ~/ipfs_log 2>&1 &

echo "Logs should be at ~/ganache_log and ~/ipfs_log"

sleep 5

npm run deploy

echo "Starting up Truebit"

node cli/index.js wasm-client/config-jit.json -c "start solve" --batch > ~/tb_log 2>&1 &

echo "Logs should be at ~/tb_log"

sleep 2
