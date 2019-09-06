#!/bin/sh

solc --overwrite --bin --abi --optimize contract.sol -o build

# Clone ffmpeg project
git clone https://github.com/mrsmkl/FFmpeg ffmpeg
cd ffmpeg
git checkout truebit_check

echo "Beginning build..."

# Configure
emconfigure ./configure --disable-programs --disable-doc --disable-sdl2 \
            --disable-iconv --disable-muxers --disable-demuxers --disable-parsers \
            --disable-protocols --disable-encoders --disable-decoders --disable-filters \
            --disable-bsfs --disable-postproc --disable-lzma --enable-protocol=rtmp,file \
            --enable-muxer=mpegts,hls,segment,image2 \
            --enable-demuxer=flv,mpegts,mp4,mkv,mov \
            --enable-bsf=h264_mp4toannexb,aac_adtstoasc,h264_metadata,h264_redundant_pps \
            --enable-parser=aac,aac_latm,h264 --enable-encoder=png,mjpeg \
            --enable-filter=abuffer,buffer,abuffersink,buffersink,afifo,fifo,aformat \
            --enable-filter=aresample,asetnsamples,fps,scale --enable-decoder=aac,h264 \
            --prefix="$HOME/compiled/wasm" --cc=emcc --enable-cross-compile \
            --target-os=none --arch=x86_32 --cpu=generic --enable-ffprobe --disable-asm \
            --disable-devices --disable-pthreads --disable-network --disable-hwaccels \
            --disable-stripping

# Generate linked LLVM bitcode
make -j 12

cp ffcheck ../ffcheck.bc

cd ..

emcc -o ffcheck.js ffcheck.bc

node ~/emscripten-module-wrapper/prepare.js ffcheck.js --file output.data --file input.ts \
     --run --memory-size=21 --upload-ipfs --out=dist --debug --float

cp dist/intfloat.wasm task.wasm
cp dist/info.json .

