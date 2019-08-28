FROM ubuntu:18.04
MAINTAINER Sami Mäkelä

SHELL ["/bin/bash", "-c"]

RUN apt-get  update \
 && apt-get install -y git cmake ninja-build g++ python wget ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev apache2 psmisc sudo mongodb curl tmux nano \
 && opam init -y

RUN git clone https://github.com/juj/emsdk \
 && cd emsdk \
 && ./emsdk update-tags \
 && ./emsdk install sdk-1.37.36-64bit \
 && ./emsdk activate sdk-1.37.36-64bit \
 && ./emsdk install  binaryen-tag-1.37.36-64bit \
 && ./emsdk activate binaryen-tag-1.37.36-64bit

RUN git clone https://github.com/llvm-mirror/llvm \
 && cd llvm/tools \
 && git clone https://github.com/llvm-mirror/clang \
 && git clone https://github.com/llvm-mirror/lld \
 && cd /llvm \
 && git checkout release_60 \
 && cd tools/clang \
 && git checkout release_60 \
 && cd ../lld \
 && git checkout release_60 \
 && mkdir /build \
 && cd /build \
 && cmake -G Ninja -DLLVM_EXPERIMENTAL_TARGETS_TO_BUILD=WebAssembly -DCMAKE_BUILD_TYPE=release -DCMAKE_INSTALL_PREFIX=/usr/ /llvm \
 && ninja \
 && ninja install \
 && cd / \
 && rm -rf build llvm

RUN sed -i 's|/emsdk/clang/e1.37.36_64bit|/usr/bin|' /root/.emscripten

RUN eval `opam config env` \
 && apt-get install libffi-dev \
 && opam update \
 && opam install cryptokit yojson ctypes ctypes-foreign -y \
 && git clone https://github.com/TrueBitFoundation/ocaml-offchain \
 && cd ocaml-offchain/interpreter \
 && git checkout v2 \
 && make

RUN wget https://dist.ipfs.io/go-ipfs/v0.4.17/go-ipfs_v0.4.17_linux-amd64.tar.gz \
 && tar xf go-ipfs_v0.4.17_linux-amd64.tar.gz \
 && cd go-ipfs \
 && ./install.sh \
 && ipfs init \
 && cd / \
 && rm -rf go-ipfs*

RUN apt-get  update \
 && apt-get install -y git cmake ninja-build g++ python wget ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev psmisc sudo curl tmux nano npm apache2 \
 && opam init -y \
 && npm install -g ganache-cli mocha browserify

RUN wget -O rustup.sh https://sh.rustup.rs \
 && sh rustup.sh -y \
 && source $HOME/.cargo/env \
 && rustup toolchain add stable \
 && git clone https://github.com/goerli/parity-goerli.git \
 && cd parity-goerli \
 && source $HOME/.cargo/env \
 && apt-get install -y libudev-dev \
 && cargo build --release --features final \
 && cd / \
 && cp /parity-goerli/target/release/parity /bin \
 && rm -rf /parity-goerli ~/.rustup ~/.cargo

RUN cd bin \
 && wget https://github.com/ethereum/solidity/releases/download/v0.5.2/solc-static-linux \
 && mv solc-static-linux solc \
 && chmod 744 solc

RUN git clone https://github.com/TruebitFoundation/jit-runner \
 && cd jit-runner \
 && git  checkout v2 \
 && npm i

RUN git clone https://github.com/TrueBitFoundation/emscripten-module-wrapper \
 && source /emsdk/emsdk_env.sh \
 && cd emscripten-module-wrapper \
 && git checkout v2 \
 && npm install \
 && ln -s /emscripten-module-wrapper /root/emscripten-module-wrapper


RUN git clone https://github.com/TrueBitFoundation/wasm-ports \
 && source /emsdk/emsdk_env.sh \
 && export EMCC_WASM_BACKEND=1 \
 && cd wasm-ports \
 && git checkout v2 \
 && apt-get install -y lzip autoconf libtool flex bison \
 && sh gmp.sh \
 && sh openssl.sh \
 && sh secp256k1.sh \
 && sh libff.sh \
 && sh boost.sh \
 && sh libpbc.sh

RUN git clone https://github.com/mrsmkl/truebit-os \
 && cd truebit-os \
 && git checkout meter_fix \
 && npm i --production \
 && npm run deps \
 && npm run  compile \
 && rm -rf ~/.opam

RUN cd wasm-ports/samples/pairing \
 && git pull \
 && source  /emsdk/emsdk_env.sh \
 && ( ipfs daemon & ) \
 && export EMCC_WASM_BACKEND=1 \
 && sh compile.sh \
 && cd ../scrypt \
 && sh compile.sh \
 && cd ../chess \
 && sh compile.sh

RUN cd wasm-ports/samples/ffmpeg \
 && git pull \
 && source  /emsdk/emsdk_env.sh \
 && ( ipfs daemon & ) \
 && sh compile.sh

RUN cd wasm-ports/samples \
 && git  pull \
 && npm i \
 && cd /wasm-ports \
 && ln -s /truebit-os .

RUN cd wasm-ports/samples/pairing \
 && git pull

RUN cd truebit-os \
 && git  pull

EXPOSE 4001 30303 80 8545
