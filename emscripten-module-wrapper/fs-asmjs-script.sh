#!/bin/zsh

emcc -c filesystem.c
emcc -o filesystem.wasm -s EXPORTED_FUNCTIONS="['_env____syscall5', '_env____syscall140', '_env____syscall6', '_env____syscall3', '_env____syscall195', '_env____syscall146', \
'_env____syscall4', '_env____syscall41', '_env____syscall63', '_env____syscall330', '_env____syscall145', '_env____syscall333', '_env____syscall197', '_env____syscall221', \
'_env____syscall334', '_env____syscall180', '_env____syscall181', '_env____syscall295', '_env____lock', '_env____unlock', '_env__getenv', \
'_env____syscall54', '_env__pthread_mutex_lock', '_env__pthread_mutex_unlock', '_env__pthread_cond_broadcast', '_env____cxa_atexit',  '_env____cxa_allocate_exception', \
'_initSystem', '_finalizeSystem', '_callArguments', '_callReturns', '_getReturn', '_callMemory', '_env__getInternalFile', \
'_env__pthread_mutex_lock', '_env__pthread_mutex_init', '_env__pthread_mutex_destroy', \
'_env__pthread_mutexattr_init', '_env__pthread_mutexattr_settype', '_env__pthread_cond_init', \
'_env__pthread_mutexattr_destroy', '_env__pthread_condattr_init', '_env__llvm_bswap_i64', \
'_env__pthread_getspecific', '_env__pthread_setspecific', '_env__pthread_condattr_create', '_env__pthread_condattr_setclock', '_env__pthread_condattr_destroy', '_env__pthread_key_create', \
'_env__pthread_mutex_unlock', '_env__pthread_cond_broadcast', '_env__pthread_rwlock_rdlock', '_env__emscripten_memcpy_big', \
'_env__internalSync', '_env__internalSync2']" -s BINARYEN=1 -s BINARYEN_ROOT="'/home/sami/emsdk/clang/e1.37.36_64bit/binaryen/'" -s SIDE_MODULE=2 filesystem.o

rm filesystem.o
# ../ocaml-offchain/interpreter/wasm -export-global 3 filesystem.wasm
# ../ocaml-offchain/interpreter/wasm -export-global 4 -name FS_STACK_MAX exported.wasm
# mv exported.wasm filesystem.wasm

