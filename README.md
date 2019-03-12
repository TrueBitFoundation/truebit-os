# Truebit OS

[![Build Status](https://travis-ci.org/TrueBitFoundation/truebit-os.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/truebit-os)

<p align="center">
  <img src="./gundam-schematic.gif"/>
</p>

The basic components of an operating system are a kernel designed to manage processes and resources and a shell. The shell is an interactive abstraction over the kernel. We have our own kernel module designed to manage processes and utilities related to using the Truebit protocol. We also provide a nice shell (CLI) to interface with the kernel. If you want to be a miner (solver/verifier) in our network you can follow the instructions below to setup your node with Docker. For technical reasons, this repository also contains all of our smart contracts.  If you are interested in interfacing with Truebit via smart contract you'll want to check out this [example](https://github.com/TrueBitFoundation/example-app) application. It demonstrates how to use Truebit-OS as a dependency in your own development process. 

If you want to talk to the developers working on this project feel free to say hello on our [Gitter](https://gitter.im/TrueBitFoundation/Lobby).  You can install Truebit using Docker or build it from source.  One can install locally or run over the Goerli testnet.

# Running on Docker

Install [Docker](https://www.docker.com/) and [Metamask](https://metamask.io/), and open a Terminal.  

## Compiling and running Truebit tasks

First start up the docker image:
```
docker run -ti mrsmkl/wasm-ports:latest /bin/bash
```
(If you have old version of the docker image, use `docker pull` to download a new one).

Start up ganache and IPFS, also deploy contracts:
```
cd truebit-os
sh scripts/start-env.sh
```

Set up the emscripten environment variables:
```
source /emsdk/emsdk_env.sh
```

Compile the scrypt C++ program:
```
cd scrypt-data
sh compile.sh
```

Run the test
```
cd ..
mocha test/os-wasm-scrypt.js
```

### Running tests for different tasks

First start up the docker image:
```
docker run -ti mrsmkl/wasm-ports:latest /bin/bash
```

Start up the Truebit environment:
```
cd truebit-os
sh scripts/start-private.sh
```

Test scrypt example task:
```
cd /example-app
node deploy.js
mocha test.js
```

Test bilinear pairing example task:
```
cd /wasm-ports/samples/pairing
node ../deploy.js
mocha test.js
```

Test chess example task:
```
cd /wasm-ports/samples/chess
node ../deploy.js
mocha test.js
```

Test WebAssembly validation example task:
```
cd /wasm-ports/samples/wasm
node ../deploy.js
mocha test.js
```

### Testing on Goerli network

```
docker run --rm --name=tb -it -p 8545:8545 -p 3000:80 -p 4001:4001 -p 30303:30303 -v ~/goerli:/root/.local/share/io.parity.ethereum mrsmkl/wasm-ports:latest /bin/bash
```

Start up IPFS and Parity:
```
cd truebit-os
sh scripts/start-goerli.sh
```
Wait for parity to sync, should take few minutes.

(Optional) After parity has synced, you can start Truebit:
```
sh scripts/start-tb.sh
```

Testing samples, Scrypt
```
cd /example-app
node send.js <text>
```

Bilinear pairing
```
cd /wasm-ports/samples/pairing
node send.js <text>
```

Chess sample
```
cd /wasm-ports/samples/chess
node send.js <text>
```

Validate WASM file
```
cd /wasm-ports/samples/wasm
node send.js <wasm file>
```

## Private network

Run
```
docker run --name=tb -it -p 8545:8545 -p 3000:80 -p 4001:4001 -p 30303:30303 mrsmkl/truebit-goerli:latest /bin/bash
```

To get started, use `tmux` to have several windows. New windows can be made with `ctrl-b c`. Use `ctrl-b <num>` to switch between windows. Alternatively, to split plane horizontally, use `ctrl+b "` and to split plane vertically `ctrl-b %`.  Shift between windows with `ctrl+b` followed by a cursor key. 

In the first window, run `ipfs daemon`

In second window, run `ganache-cli -h 0.0.0.0`

In the next window
```
cd truebit-os
npm run deploy
```
Note that you have to deploy the contracts each time after you have started up ganache.
Find out what is your address in metamask (`address`), in hex format without 0x prefix.

```
node send.js --to=address
```

Start up the Truebit console with
```
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

With a web browser, go to `localhost:3000/app`

After you have submitted the task, go to the tmux window with Truebit console, and type
 `skip` a few times until the task is finalized.

To run the bilinear pairing sample application enter:

```
cd /wasm-ports/samples/pairing/
node ../deploy.js
```

This page will be at `localhost:3000/samples/pairing/public`

Other commands:

Type `?` to list commands

`start verify -t` to create a Verifier that initiates verification games

`start solve -a 1`, `start solve -a 2`, .... creates additional Solvers.


## Goerli testnet tutorial

*Quickstart: try running these steps!*

1. Install Docker.

2. Open a terminal window.

3. Create directory `~/goerli` to store your blockchain data.

4. Start a session:

```
docker run --name=tb -it -p 8545:8545 -p 3000:80 -p 4001:4001 -p 30303:30303 -v ~/goerli:/root/.local/share/io.parity.ethereum mrsmkl/truebit-goerli:latest /bin/bash
```

5. Initiate ```tmux```.

6. Create three windows by typing ```ctrl-b "``` then ```ctrl-b %```.

7. *Start IPFS.*  Navigate to one of the smaller windows on the the bottom ``ctrl-b (down arrow)'' and type

```
ipfs daemon
```

If it looks like IPFS doesn't find files, try `ipfs swarm connect /ip4/213.251.185.41/tcp/4001/ipfs/QmSob847F3sPkmveU5p2aPmjRgaXXdhXb7nnmJtkBZ1QDz`
to connect to a Truebit node running IPFS.

8. *Set up a new parity account.* Navigate to the other small window and type:

```
cd ~/.local/share/io.parity.ethereum
echo plort > supersecret.txt
parity --chain goerli account new --password=supersecret.txt > goerliparity
```
To check addresses created, type

```
parity --chain goerli account list
```

In case more than one account was created, you will need to add flags to command listed below (e.g. ```claim -a 1``` rather than ```claim```).

9. *Connect to Goerli*.  Type:

```
parity --chain goerli --unlock=$(cat goerliparity) --password=supersecret.txt --jsonrpc-cors=all --jsonrpc-interface=all
```

10. *Get testnet tokens* for the account(s) above here: https://goerli-faucet.slock.it/

11.  *Start Truebit-OS.* Wait a few minutes to sync with Goerli.  Console will say "Imported" when ready.  Navigate to the top window ```ctrl-b (up arrow)``` and type
```
cd truebit-os
npm run truebit
claim
balance
```
The balance command should show that you've claimed TRU testnet tokens.

12. *Task - Solve - Verify!*  Start a Solver:
```
start solve
```
Start a Verifier:
```
start verify
```
Issue a task (factorial example):
```
task
```

13. Check your decentralized computations on the blockchain here: https://goerli.etherscan.io/address/0xD8859b0857de197C419f9dFd027c9800F0EC1112

# Building from source

## Getting Started

Start with an ethereum client running on port 8545, and an ipfs daemon at port 5001. For a quick start, ganache-cli is a blockchain emulator that can be used for development.

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


## Usage

The shell provides a number of commands which you can get instructions by using the `help` command:

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

We have specified to submit a task from account 0. And the data related to the task is located at testWasmTask.json

If you are running this on a development test net you will need to skip blocks to see the solution in the solutions directory.
```
skip -n 120 # Go past the challenge period
skip -n 120 # Go past reveal period and finalize task
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
