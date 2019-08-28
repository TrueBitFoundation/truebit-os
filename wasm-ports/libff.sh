#!/bin/sh

git clone https://github.com/scipr-lab/libff
cd libff
git checkout 0409460
cp ../profiling.cpp libff/common/profiling.cpp

mkdir build
cd build

cmake -DCMAKE_TOOLCHAIN_FILE=$EMSCRIPTEN/cmake/Modules/Platform/Emscripten.cmake -DCMAKE_LIBRARY_PATH=$EMSCRIPTEN/system/lib \
      -DCMAKE_BUILD_TYPE=Release -DCURVE=ALT_BN128 -DWITH_PROCPS=0 -DEMSCRIPTEN=1 -DCMAKE_INSTALL_PREFIX=$EMSCRIPTEN/system ..
make -j 12
make install

cd ../..
rm -rf libff

