cd wasm-client/webasm-solidity/

git submodule init
git submodule update
npm install
npm run compile

cd ..

cd ocaml-offchain
git submodule init
git submodule update

sudo apt-get update
sudo apt-get install -y wget gcc ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev
opam init https://opam.ocaml.org/1.2
opam switch 4.06.1

eval $(opam config env)
opam install cryptokit yojson

cd interpreter
make

cd ../..
