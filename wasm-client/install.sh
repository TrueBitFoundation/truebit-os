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
sudo apt-get install -y wget gcc m4 pkg-config zlib1g-dev
sudo wget https://raw.github.com/ocaml/opam/master/shell/opam_installer.sh -O - | sh -s /usr/local/bin/

yes | opam init --comp=4.06.1

eval $(opam config env)
opam install cryptokit yojson

cd interpreter
make

cd ../..
