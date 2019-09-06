# Truebit toolchain and ports

This repo has three parts
1. there is the dockerfile that can be used to
compile C/C++ programs into Truebit tasks (Truebit toolchain)
2. the Scripts to install libraries compiled to WASM using emscripten
3. Sample applications

Check [here](https://github.com/TrueBitFoundation/truebit-os#compiling-and-running-truebit-tasks)
for instructions about how to use the docker image.
See the samples, especially [scrypt](samples/scrypt) for more instructions.

## Issues with compiling using emscripten

### Does not find the compiler

Seems like this is difficult, perhaps should use $CC or something.
Currently just have to `sed` the Makefile or something similar.

### Typed function calls

In WebAssembly, the function calls are typed, so there will be several issues.
For example configure scripts might not work.

### Stuff that is not implemented in openssl

stdatomic.h

### Always only use static libraries

