#!/bin/sh

wget https://www.openssl.org/source/openssl-1.1.0h.tar.gz
tar xf openssl-1.1.0h.tar.gz
cd openssl-1.1.0h

emconfigure ./Configure linux-generic64 --prefix=$EMSCRIPTEN/system

sed -i 's|^CROSS_COMPILE.*$|CROSS_COMPILE=|g' Makefile

emmake make -j 12 build_generated libssl.a libcrypto.a
rm -rf $EMSCRIPTEN/system/include/openssl
cp -R include/openssl $EMSCRIPTEN/system/include
cp libcrypto.a libssl.a $EMSCRIPTEN/system/lib
cd ..
rm -rf openssl-1.1.0h*

