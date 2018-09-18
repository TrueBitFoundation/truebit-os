FROM ubuntu:18.04
MAINTAINER Harley Swick

COPY . /truebit-os

RUN apt-get update

RUN apt-get install software-properties-common -y

RUN add-apt-repository ppa:ethereum/ethereum

RUN apt-get update \
 && apt-get install nodejs npm solc geth git -y

RUN cd ./truebit-os \
 && npm install \
 && npm run fixperms \
 && npm run deps \
 && npm run compile \
 && npm run deploy \
 && npm run truebit wasm-client/config.json