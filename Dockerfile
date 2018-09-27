FROM ubuntu:18.04
MAINTAINER Sami Mäkelä

SHELL ["/bin/bash", "-c"]

RUN apt-get  update \
 && apt-get install -y git cmake ninja-build g++ python wget ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev psmisc sudo curl tmux nano npm \
 && opam init -y \
 && npm install -g ganache-cli mocha

RUN cd bin \
 && wget https://github.com/ethereum/solidity/releases/download/v0.4.25/solc-static-linux \
 && mv solc-static-linux solc \
 && chmod 744 solc

RUN wget http://d1h4xl4cr1h0mo.cloudfront.net/v1.10.1/x86_64-unknown-linux-gnu/parity_1.10.1_ubuntu_amd64.deb \
 && dpkg --install parity_1.10.1_ubuntu_amd64.deb \
 && (parity --chain dev &) \
 && sleep 10 \
 && killall parity

RUN wget https://dist.ipfs.io/go-ipfs/v0.4.11/go-ipfs_v0.4.11_linux-amd64.tar.gz \
 && tar xf go-ipfs_v0.4.11_linux-amd64.tar.gz \
 && cd go-ipfs \
 && ./install.sh \
 && ipfs init

RUN git clone https://github.com/TrueBitFoundation/truebit-os \
 && git checkout docker \
 && cd truebit-os \
 && npm i \
 && npm run deps \
 && npm run compile

EXPOSE 80 22448 4001

# docker build . -t truebit-livepeer:latest
# docker run -it -p 8080:80 -p 4001:4001 -p 22448:22448 truebit-livepeer:latest /bin/bash