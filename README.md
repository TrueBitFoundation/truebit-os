# Truebit OS

[![Build Status](https://travis-ci.org/TrueBitFoundation/truebit-os.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/truebit-os)

<p align="center">
  <img src="./gundam-schematic.gif"/>
</p>

The basic components of an operating system are a kernel designed to manage processes and resources and a shell. The shell is an interactive abstraction over the kernel. We have our own kernel module designed to manage processes and utilities related to using the Truebit protocol. We also provide a nice shell (CLI) to interface with the kernel. If you want to be a miner (solver/verifier) in our network you can follow the instructions below to setup your node with Docker. For technical reasons, this repository also contains all of our smart contracts.  If you are interested in interfacing with Truebit via smart contract you'll want to check out this [example](https://github.com/TrueBitFoundation/example-app) application. It demonstrates how to use Truebit-OS as a dependency in your own development process. 

If you want to talk to the developers working on this project feel free to say hello on our [Gitter](https://gitter.im/TrueBitFoundation/Lobby)

# Getting Started

An ethereum client running on port 8545, and an ipfs daemon at port 5001. For a quick start, ganache-cli is a blockchain emulator that can be used for development.

```
npm i -g ganache-cli
```

You will also need the latest version of solidity compiler installed and available on your path. Please refer to [its documentation](https://solidity.readthedocs.io/) to install its binary package.

## Installation

Install instructions are catered to Linux users. However, other OS's can use this by simply installing ocaml-offchain without the `npm run deps` script.

In order to get things running you'll have to go through all these commands at least once.

```bash
cd truebit-os/
npm i
npm run fixperms
npm run deps # you'll need to be in root (su root)
npm run compile
npm run deploy
```

## Docker Installation

Then use `tmux` to create multiple sessions of the shell:

Reminder commands:

To split plane horizontally
```
ctrl+b "
```

To split plane vertically
```
ctrl-b %
```

New window
```
ctrl-b c
```

Change panel
```
ctrl-b arrow
```

In the other panel run this command:
```
ipfs swarm connect /ip4/176.9.9.249/tcp/4001/ipfs/QmS6C9YNGKVjWK2ctksqYeRo3zGoosEPRuPhCvgAVHBXtg
```

### Docker usage

```
docker run -it -p 8545:8545 -p 3000:80 -p 4001:4001 -p 30303:30303 mrsmkl/truebit-os:latest /bin/bash
```

Use tmux to have several windows. New windows are made with "Ctrl-b c".

In first windows, run `ipfs daemon`

In second window, run `ganache-cli -h 0.0.0.0`

Find out what is your address in metamask (`address`), in hex format without 0x prefix.

In the next window
```
cd truebit-os
npm run deploy
node send.js --to=address
npm run truebit
```

To run truebit client in JIT solving mode, use
```
npm run truebit wasm-client/config-jit.json
```
In the Truebit console, type
```
start solve
```

Then make a new tmux window
```
cd example-app
node deploy.js
service apache2 start
```

With web browser, go to localhost:3000/app

After you have submitted the task, go to the tmux window with Truebit console, and type
 `skip` a few times until the task is finalized.


Pairing sample:

```
cd /wasm-ports/samples/pairing/
node ../deploy.js
```

This page will be at `localhost:3000/samples/pairing/public`

### Goerli testnet

Build and run the docker image at truebit-os directory:
```
docker build . -t truebit-os:latest
docker run -it -p 8545:8545 -p 3000:80 -p 4001:4001 -p 30303:30303 truebit-os:latest /bin/bash
```

Setup a new parity account:
```
echo plort > supersecret.txt
parity --chain goerli account new --password=supersecret.txt > goerliparity
```

Start the parity node, it should take a few minutes to sync:
```
parity --chain goerli --unlock=$(cat goerliparity) --password=supersecret.txt --jsonrpc-cors=all --jsonrpc-interface=all
```

Remember to send eth to the generated address. Faucet: https://faucet.goerli.mudit.blog/

## Usage

Point the truebit-os shell to the wasm client configuration file which it will use to initialize.

NOTE: If you have not fully waited for your node to sync to kovan, the following command will throw an error.

```
npm run truebit wasm-client/config.json
```

You should now see the truebit-os shell. The shell provides a number of commands which you can get instructions by using the `help` command:

```
help
```

Before submitting a task you will need to claim some test TRU tokens, from our faucet.

```
claim -a 0
```

Then account0 after the transaction is confirmed you should have 10000 TRU.

## Example

After starting up the shell you can enter commands to start submitting and solving tasks:

You can start up a task giver process that will monitor the incentive layer smart contract for events:
```
start task -a 0
```

Now the process will be monitoring for tasks created by account 0.

We can also start up a solver with a different account:
```
start solve -a 1
```

We've started up a solver with account 1 (this is to simulate different users, but it could be the same account).

Finally, we can submit our task:
```
task -a 0 -t testWasmTask.json
```

If you are using the Kovan testnet you can look at the progress of your transactions [here](https://kovan.etherscan.io/address/0x9da6f9b3dfd4b4053096246ec1658ae227d80b7c).

We have specified to submit a task from account 0. And the data related to the task is located at testWasmTask.json

If you are running this on a development test net you will need to skip blocks to see the solution in the solutions directory.
```
skip 200 # Go past the challenge period
skip 300 # Go past reveal period and finalize task
```

*NOTE* These parameters are subject to future change

# Development

To run the tests use: `npm run test`

# WASM Client

The `wasm-client` directory houses the primary Truebit client. It contains 4 relevant JS modules that wrap the internal details of the protocol for a user friendly experience. These modules are designed to interact with the Truebit OS kernel and shell. The four modules are taskGiver, taskSubmitter, solver, and verifier. These modules can be run independently from each other. With the exception of taskGiver and taskSubmitter being recommended to run together.

## Usage
The way that Truebit OS knows where to load the relevant modules is with a config file. This is a simple JSON file with a couple fields, that tell the OS where to find the modules at. Here is the example config.json provided used for `basic-client`:
```javascript
{
    "http-url": "http://localhost:8545",
    "verifier": "../wasm-client/verifier",
    "solver": "../wasm-client/solver",
    "task-giver": "../wasm-client/taskGiver"
}
```

### Logging

Logging is provided by [winston](https://github.com/winstonjs/winston). If you would like to disable console logging, you can set the NODE_ENV to production, like so:

```
NODE_ENV='production' npm run test
```

# Git Submodule Commands

Add submodule
```
git submodule add *url*
```

Cloning repo with submodule
```
git clone *repo*
cd *submodule_name*
git submodule init
git submodule update
```

If you want to include all the submodules with the repo you clone
```
git clone --recurse-submodules *url*
```

Fetching submodule updates
```
git submodule update --remote *submodule_name*
```

Pushing changes of a submodule to remote
```
git submodule update --remote --merge
```

Deleting submodules
```
git rm *submodule_name*
rm -rf .git/modules/*submodule_name*
```
