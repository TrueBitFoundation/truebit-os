#!/bin/sh

git clone https://github.com/bitcoin-core/secp256k1
cd secp256k1
git checkout 452d8e4

# apt install autoconf

./autogen.sh
emconfigure ./configure --with-bignum=no --with-asm=no --enable-module-recovery --disable-shared --prefix=$EMSCRIPTEN/system

make -j 12
make install
cd ..
rm -rf secp256k1

