
#This script installs Truebit-OS for MacOS.

#Install Solidity
brew update
brew upgrade
brew tap ethereum/ethereum
brew install solidity

#Install NPM and IPFS
brew install node ipfs

#Install dependencies for offchain interpreter
brew install opam libffi pkg-config
opam init -y
eval $(opam config env)
opam install cryptokit yojson ctypes ctypes-foreign -y

#Install offchain interpreter
cd wasm-client/ocaml-offchain
git submodule init
git submodule update

cd interpreter
make

cd ../../..

#Install Truebit-OS
rm package-lock.json
npm i -g ganache-cli
npm i
