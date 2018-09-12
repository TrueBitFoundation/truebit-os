COPY . /truebit-os

RUN add-apt-repository ppa:ethereum/ethereum

RUN apt-get update \
 && apt-get install nodejs npm solc


RUN npm install \
 && npm run fixperms \
 && npm run deps
 && npm run compile
 && npm run deploy
 && npm run truebit wasm-client/config.json