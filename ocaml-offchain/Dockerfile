FROM ubuntu:17.04
MAINTAINER Harley Swick

RUN apt-get update && \
  apt-get install -y wget ocaml opam libzarith-ocaml-dev m4 pkg-config zlib1g-dev && \
  opam init -y

RUN eval `opam config env` && \
   opam install cryptokit yojson -y

RUN git clone https://github.com/TrueBitFoundation/ocaml-offchain webasm && \
   cd webasm/interpreter && \
   eval `opam config env` && \
   make