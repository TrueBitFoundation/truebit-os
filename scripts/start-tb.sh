#!/bin/bash

echo Starting Truebit solver

node cli/index.js wasm-client/config-jit.json -c claim -c "start solve" --batch > ~/tb_log 2>&1 &

echo Logs should be at ~/tb_log
