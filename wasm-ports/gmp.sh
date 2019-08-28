#!/bin/bash

wget https://gmplib.org/download/gmp/gmp-6.1.2.tar.lz
tar xf gmp-6.1.2.tar.lz
cd gmp-6.1.2

sed -i '2igmp_asm_syntax_testing=no' configure

emconfigure ./configure --disable-assembly --disable-shared --prefix=$EMSCRIPTEN/system

echo '#define HAVE_MEMSET 1' >> config.h
echo '#define HAVE_STRNLEN 1' >> config.h
echo '#define HAVE_VSNPRINTF 1' >> config.h

make -j 12
make install

cd ..
rm -rf gmp-6.1.2*

