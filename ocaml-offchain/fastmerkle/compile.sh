#!/bin/sh

g++ -fpic -Wall -O3 -o fastmerkle.sox fastmerkle.cc -std=c++11 -shared -lpthread && \
sudo cp fastmerkle.sox /usr/local/bin

