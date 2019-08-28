#!/bin/sh

# From https://github.com/ethereum/solidity/blob/develop/scripts/travis-emscripten/build_emscripten.sh

wget https://sourceforge.net/projects/boost/files/boost/1.57.0/boost_1_57_0.tar.gz
tar xf boost_1_57_0.tar.gz
cd boost_1_57_0
./bootstrap.sh --with-toolset=gcc --with-libraries=thread,system,regex,date_time,chrono,filesystem,program_options,random --prefix=$EMSCRIPTEN/system

sed -i 's|using gcc ;|using gcc : : em++ ;|g' ./project-config.jam
sed -i 's|$(archiver\[1\])|emar|g' ./tools/build/src/tools/gcc.jam
sed -i 's|$(ranlib\[1\])|emranlib|g' ./tools/build/src/tools/gcc.jam
./b2 link=static variant=release threading=single runtime-link=static system regex filesystem unit_test_framework program_options
find . -name 'libboost*.a' -exec cp {} . \;
cp *.a $EMSCRIPTEN/system/lib
cp -R boost $EMSCRIPTEN/system/include

cd ..
rm -rf boost_*
