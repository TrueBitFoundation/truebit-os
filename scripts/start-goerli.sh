#!/bin/bash

echo Starting up Parity and IPFS

ipfs daemon  > ~/ipfs_log 2>&1 &

echo plort > supersecret.txt
mkdir -p ~/.local/share/io.parity.ethereum
if [ ! -f ~/.local/share/io.parity.ethereum/goerliparity ]
then
    parity --chain goerli account new --password=supersecret.txt > ~/.local/share/io.parity.ethereum/goerliparity
fi

parity --chain goerli --unlock=$(cat ~/.local/share/io.parity.ethereum/goerliparity) --password=supersecret.txt --jsonrpc-cors=all --jsonrpc-interface=all > ~/goerli_log 2>&1 &

sleep 5

echo "Logs should be at ~/goerli_log and ~/ipfs_log"
