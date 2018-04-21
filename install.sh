#!/bin/bash
cd $(dirname $0)

git submodule init
git submodule update || exit $?

npm install
(cd ./dispute-resolution-layer && npm install)
(cd ./incentive-layer && npm install)
