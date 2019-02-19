FROM ubuntu:18.04
MAINTAINER Sami Mäkelä

SHELL ["/bin/bash", "-c"]

RUN apt-get  update \
 && apt-get install -y git cmake ninja-build g++ python wget ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev psmisc sudo curl tmux nano npm apache2 \
 && opam init -y \
 && npm install -g ganache-cli mocha browserify

RUN cd bin \
 && wget https://github.com/ethereum/solidity/releases/download/v0.5.2/solc-static-linux \
 && mv solc-static-linux solc \
 && chmod 744 solc

# RUN cd bin \
# && wget https://releases.parity.io/ethereum/v2.3.2/x86_64-unknown-linux-gnu/parity \
# && chmod 744 parity \
# && (parity --chain dev &) \
# && sleep 10 \
# && killall parity

RUN wget -O rustup.sh https://sh.rustup.rs \
 && sh rustup.sh -y \
 && source $HOME/.cargo/env \
 && rustup toolchain add stable

RUN git clone https://github.com/goerli/parity-goerli.git \
 && cd parity-goerli \
 && source $HOME/.cargo/env \
 && apt-get install -y libudev-dev \
 && cargo build --release --features final

RUN wget https://dist.ipfs.io/go-ipfs/v0.4.17/go-ipfs_v0.4.17_linux-amd64.tar.gz \
 && tar xf go-ipfs_v0.4.17_linux-amd64.tar.gz \
 && cd go-ipfs \
 && ./install.sh \
 && ipfs init

RUN git clone https://github.com/mrsmkl/truebit-os \
 && cd truebit-os \
 && git checkout v2test \
 && npm i --production\
 && npm run deps \
 && npm run compile

RUN git clone https://github.com/mrsmkl/example-app \
 && cd example-app \
 && git checkout v2 \
 && npm i \
 && ln -s /truebit-os . \
 && ln -s /example-app/public /var/www/html/app \
 && browserify public/js/app.js -o public/js/bundle.js

RUN git clone https://github.com/TruebitFoundation/jit-runner \
 && cd jit-runner \
 && git checkout v2 \
 && npm i

RUN git clone https://github.com/TruebitFoundation/wasm-ports \
 && cd wasm-ports \
 && git checkout v2 \
 && ln -s /truebit-os . \
 && cd samples \
 && npm i \
 && ln -s /wasm-ports/samples /var/www/html \
 && browserify pairing/public/app.js -o pairing/public/bundle.js \
 && cd pairing \
 && solc --abi --optimize --overwrite --bin -o build contract.sol

RUN cp /parity-goerli/target/release/parity /bin

# ipfs and eth ports
EXPOSE 4001 30303 80 8545

# docker build . -t truebit-os:latest
# docker run -it -p 3000:80 -p 8545:8548 -p 4001:4001 -p 30303:30303 -v ~/kovan:/root/.local/share/io.parity.ethereum truebit-os:latest /bin/bash
# ipfs swarm connect /ip4/176.9.9.249/tcp/4001/ipfs/QmS6C9YNGKVjWK2ctksqYeRo3zGoosEPRuPhCvgAVHBXtg
