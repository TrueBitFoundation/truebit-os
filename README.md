# Truebit OS

[![Build Status](https://travis-ci.org/TrueBitFoundation/truebit-os.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/truebit-os)

<p align="center">
  <img src="./gundam-schematic.gif"/>
</p>

The basic components of an operating system are a kernel designed to manage processes and resources and a shell. The shell is an interactive abstraction over the kernel. We have our own kernel module designed to manage processes and utilities related to using the Truebit protocol. We also provide a nice shell (CLI) to interface with the kernel. If you want to be a miner (solver/verifier) in our network you can follow the instructions below to setup your node with Docker. For technical reasons, this repository also contains all of our smart contracts.

If you are interested in interfacing with Truebit via smart contract you'll want to check out this [example](https://github.com/TrueBitFoundation/DApp-example) DApp or experiment with this older [version](https://github.com/TrueBitFoundation/example-app). They demonstrates how to use Truebit-OS as a dependency in your own development process.  You can also generate your own Truebit task from C, C++, or Rust code using the [Truebit toolchain](https://github.com/TrueBitFoundation/truebit-toolchain).

If you want to talk to the developers working on this project feel free to say hello on our [Gitter](https://gitter.im/TrueBitFoundation/Lobby).  You can install Truebit using Docker or build it from source.  One can install locally or run over the Goerli testnet.

# Contents

1. [Running on Docker](#running-on-docker)
  1. [Compiling and running Truebit tasks](#compiling-and-running-truebit-tasks)
  2. [Goerli testnet tutorial](#goerli-testnet-tutorial)
2. [Linux installation](#building-from-source-on-linux)
3. [MacOS installation](#building-from-source-on-macos)

# Running on Docker

Install [Docker](https://www.docker.com/), and open a Terminal.  If you previously used another Truebit-OS Docker image, you may need to update first:
```
docker rm tb; docker pull mrsmkl/truebit-goerli:latest; docker pull mrsmkl/wasm-ports:latest
```

## Compiling and running Truebit tasks

First start up the docker image:
```
docker run -ti mrsmkl/wasm-ports:19-03-13 /bin/bash
```

Start up the Truebit environment:
```
cd truebit-os
sh scripts/start-private.sh
```

Run test tasks:
```
cd /wasm-ports/samples
sh deploy.sh
mocha
```

If you want to recompile a sample, go to a sample directory, and then first setup the environment with
```
source /emsdk/emsdk_env.sh
```
Then use the `compile.sh` script. You'll also have to re-deploy with `node ../deploy.js`

### Testing on Goerli network

To speed up network sync the next time, make a directory `~/goerli` and then mount it with docker:
```
docker run --rm --name=tb -it -p 4001:4001 -p 30303:30303 -v ~/goerli:/root/.local/share/io.parity.ethereum mrsmkl/wasm-ports:19-03-13 /bin/bash
```

Start up IPFS and Parity:
```
cd truebit-os
sh scripts/start-goerli.sh
```
Wait for parity to sync, should take few minutes. (For example `tail -F ~/goerli_log`)

Find out your Goerli ETH address:
```
parity --chain=goerli account list
```
Then use the faucet to get some GÖETH:  https://goerli-faucet.slock.it/

To connect to IPFS nodes, try `ipfs swarm connect /ip4/213.251.185.41/tcp/4001/ipfs/QmSob847F3sPkmveU5p2aPmjRgaXXdhXb7nnmJtkBZ1QDz`

(Optional) After parity has synced, you can start Truebit:
```
sh scripts/start-tb.sh
```

Testing samples, Scrypt
```
cd /wasm-ports/samples/scrypt
node send.js <text>
```

Bilinear pairing (enter a string with more than 32 characters)
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

Progress can be followed from https://goerli.etherscan.io/address/0xf018f7f68f6eb999f4e7c02158e9a1ea4d77a067

## Goerli testnet tutorial

*Quickstart: try running these steps!*

1. Install Docker.

2. Open a terminal window.

3. Create directory `~/goerli` to store your blockchain data.

4. Start a session:

```
docker run --rm --name=tb -it -p 8545:8545 -p 3000:80 -p 4001:4001 -p 30303:30303 -v ~/goerli:/root/.ethereum mrsmkl/truebit-goerli:19-03-13 /bin/bash
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
cd ~/.ethereum
echo plort > supersecret.txt
geth --goerli account new --password=supersecret.txt
```

To check addresses created, type
```
geth --goerli account list
```
Make sure there is just one account.

9. *Connect to Goerli*.  Type:

```
geth --goerli --rpc --unlock 0 --password=supersecret.txt
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

13. Check your decentralized computations on the blockchain here: https://goerli.etherscan.io/address/0xf018f7f68f6eb999f4e7c02158e9a1ea4d77a067


# Building from source in Linux

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

# Building from source in MacOS

1. Install brew.
```
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

2. Clone this repo.
```
git clone https://github.com/TrueBitFoundation/truebit-os
cd truebit-os
```

3. Install Solidity, NPM, IPFS, the off-chain interpreter, and client.
```
sh macinstall.sh
```

4. Compile and deploy the contracts.
```
npm run compile
npm run deploy
```
Check that everything works with `npm run test`. Type `npm run` for more options.


5. Task-Solve-Verify.  Open a separate Terminal and start an Ethereum client, i.e.
```
ganache-cli
```
and optionally open another terminal with IPFS via `ipfs daemon`.  Finally, start Truebit-OS!
```
npm run truebit
```
To get some tokens, type `claim`, and check your address using `balance`.  If you need ETH, then `exit` Truebit-OS  and use `node send.js address=[youraddress]` to send test ETH.  Remember to omit the "0x" prefix for the address.  Use `help` For assistance with other Truebit-OS commands.


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
