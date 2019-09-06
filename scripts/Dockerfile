FROM ubuntu:18.04
MAINTAINER Sami Mäkelä

SHELL ["/bin/bash", "-c"]

RUN apt-get update  \
 && apt-get install -y git cmake ninja-build g++ python wget ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev apache2 psmisc sudo mongodb curl tmux nano \
 && opam init -y

RUN git clone https://github.com/juj/emsdk \
 && cd emsdk \
 && ./emsdk update-tags \
 && ./emsdk install sdk-1.37.36-64bit \
 && ./emsdk activate sdk-1.37.36-64bit \
 && ./emsdk install  binaryen-tag-1.37.36-64bit \
 && ./emsdk activate binaryen-tag-1.37.36-64bit

RUN wget http://releases.llvm.org/6.0.1/llvm-6.0.1.src.tar.xz \
 && wget http://releases.llvm.org/6.0.1/cfe-6.0.1.src.tar.xz \
 && wget http://releases.llvm.org/6.0.1/lld-6.0.1.src.tar.xz \
 && tar xf llvm-6.0.1.src.tar.xz \
 && tar xf cfe-6.0.1.src.tar.xz \
 && tar xf lld-6.0.1.src.tar.xz \
 && mv llvm-6.0.1.src llvm \
 && cd llvm/tools \
 && mv /cfe-6.0.1.src clang \
 && mv /lld-6.0.1.src lld \
 && mkdir /build \
 && cd /build \
 && cmake -G Ninja -DLLVM_EXPERIMENTAL_TARGETS_TO_BUILD=WebAssembly -DLLVM_TARGETS_TO_BUILD="" -DCMAKE_BUILD_TYPE=release -DCMAKE_INSTALL_PREFIX=/usr/ /llvm \
 && ninja \
 && ninja install \
 && cd / \
 && rm -rf build llvm

RUN sed -i 's|/emsdk/clang/e1.37.36_64bit|/usr/bin|' /root/.emscripten
