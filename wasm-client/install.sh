
# This script installs the offchain interpreter

cd wasm-client/ocaml-offchain
git submodule init
git submodule update

apt-get update
apt-get install -y wget gcc m4 pkg-config zlib1g-dev libffi-dev libgmp3-dev
wget https://raw.github.com/ocaml/opam/master/shell/opam_installer.sh -O - | sh -s /usr/local/bin/

opam init --comp=4.06.1 -y

eval $(opam config env)
opam install cryptokit yojson ctypes ctypes-foreign -y

cd interpreter
make

cd ../..
