#!/bin/sh

cd contracts/

mkdir -p build

sed 's/REPLACEME/CommonOffchain is Offchain/g' dispute/common.sol > dispute/common-offchain.sol
sed 's/REPLACEME/CommonOnchain is Onchain/g' dispute/common.sol > dispute/common-onchain.sol

solc --abi --optimize --overwrite --bin -o build dispute/fs.sol
solc --abi --optimize --overwrite --bin -o build dispute/interactive.sol
solc --abi --optimize --overwrite --bin -o build dispute/interpreter.sol
solc --abi --optimize --overwrite --bin -o build dispute/judge.sol
solc --abi --optimize --overwrite --bin -o build dispute/merkle.sol

solc --abi --optimize --overwrite --bin -o build incentive/IncentiveLayer.sol


