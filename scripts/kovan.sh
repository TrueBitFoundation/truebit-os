#!/bin/sh

echo plort > supersecret.txt
mkdir -p ~/.local/share/io.parity.ethereum/chains/kovan/
if [ ! -f ~/.local/share/io.parity.ethereum/chains/kovan/myaddress ]
then
  parity --chain kovan account new --password=supersecret.txt > ~/.local/share/io.parity.ethereum/chains/kovan/myaddress
fi

parity --chain kovan --unlock=`cat ~/.local/share/io.parity.ethereum/chains/kovan/myaddress` --password=supersecret.txt &
ipfs daemon &

