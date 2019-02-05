FROM ubuntu:18.04
MAINTAINER Sami Mäkelä

SHELL ["/bin/bash", "-c"]

RUN apt-get  update \
 && apt-get install -y git cmake ninja-build g++ python wget ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev psmisc sudo curl tmux nano npm \
 && opam init -y \
 && npm install -g ganache-cli mocha

RUN cd bin \
 && wget https://github.com/ethereum/solidity/releases/download/v0.5.2/solc-static-linux \
 && mv solc-static-linux solc \
 && chmod 744 solc

RUN cd bin \
 && wget https://releases.parity.io/ethereum/v2.2.7/x86_64-unknown-linux-gnu/parity \
 && chmod 744 parity \
 && (parity --chain dev &) \
 && sleep 10 \
 && killall parity

RUN wget https://dist.ipfs.io/go-ipfs/v0.4.17/go-ipfs_v0.4.17_linux-amd64.tar.gz \
 && tar xf go-ipfs_v0.4.17_linux-amd64.tar.gz \
 && cd go-ipfs \
 && ./install.sh \
 && ipfs init

RUN git clone https://github.com/TrueBitFoundation/truebit-os \
 && cd truebit-os \
 && git checkout single_solver \
 && npm i --production\
 && npm run deps \
 && npm run compile

# ipfs and eth ports
EXPOSE 4001 30303

# docker build . -t truebit-os:latest
# docker run -it -p 4001:4001 -p 30303:30303 -v ~/kovan:/root/.local/share/io.parity.ethereum truebit-os:latest /bin/bash
# ipfs swarm connect /ip4/176.9.9.249/tcp/4001/ipfs/QmS6C9YNGKVjWK2ctksqYeRo3zGoosEPRuPhCvgAVHBXtg
