#!/bin/bash
cd $(dirname $0)

#This deploys contracts to development chain
(cd incentive-layer && truffle migrate --reset)
(cd ./dispute-resolution-layer && truffle migrate --reset)
