#!/bin/sh

cd ./contracts/

mkdir -p ../build

sed 's/REPLACEME/CommonOffchain is Offchain/g' dispute/Common.sol > dispute/CommonOffchain.sol
sed 's/REPLACEME/CommonOnchain is Onchain/g' dispute/Common.sol > dispute/CommonOnchain.sol

solc --abi --optimize --overwrite --bin -o ../build filesystem/Filesystem.sol
solc --abi --optimize --overwrite --bin -o ../build --allow-paths /interface/, dispute/Interactive.sol
solc --abi --optimize --overwrite --bin -o ../build dispute/Interpreter.sol
solc --abi --optimize --overwrite --bin -o ../build dispute/Judge.sol
solc --abi --optimize --overwrite --bin -o ../build dispute/Merkle.sol

solc --abi --optimize --overwrite --bin -o ../build --allow-paths /interface,  incentive/IncentiveLayer.sol
solc --abi --optimize --overwrite --bin -o ../build --allow-paths /interface,  incentive/SingleSolver.sol


