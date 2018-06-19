cd webasm-solidity/

git submodule init
git submodule update

cd ..

cd ocaml-offchain
git submodule init
git submodule update

sudo apt-get install -y wget gcc ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev
opam init -y
eval $(opam config env)
opam install cryptokit yojson

cd interpreter
make

cd ../..
