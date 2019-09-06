#!/bin/sh

cd scrypt
node ../deploy.js
cd ../pairing
node ../deploy.js
cd ../chess
node ../deploy.js
cd ../wasm
node ../deploy.js
cd ../ffmpeg
node ../deploy.js
cd ..
