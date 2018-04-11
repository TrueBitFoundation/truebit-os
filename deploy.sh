#This deploys contracts to development chain
cd incentive-layer
truffle migrate --reset
cd ..
cd dispute-resolution-layer
truffle migrate --reset
cd ..