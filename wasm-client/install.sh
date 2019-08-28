
# This script installs the offchain interpreter

sudo apt-get update
sudo apt-get install -y wget gcc m4 pkg-config zlib1g-dev libffi-dev libgmp3-dev unzip
wget https://raw.github.com/ocaml/opam/master/shell/opam_installer.sh -O - | sudo sh -s /usr/local/bin/

opam init --comp=4.06.1 -y

eval $(opam config env)
opam install cryptokit yojson ctypes ctypes-foreign -y

cd wasm-client/ocaml-offchain
# git submodule init
# git submodule update

cd interpreter
make

cd ../..
