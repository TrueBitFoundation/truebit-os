# Truebit OS

[![Build Status](https://travis-ci.org/TrueBitFoundation/truebit-os.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/truebit-os)

<p align="center">
  <img src="./gundam-schematic.gif"/>
</p>

The Truebit OS is meant to be a general purpose platform for interactive verification games. The benefit of it is that users are not locked into a particular client, but can build their own and then host it on the Truebit platform. Benefitting from the time we spend on development and research for solving problems related to running interactive verification games on a blockchain.

For a simple intro and a high level overview watch this [video demo](https://www.youtube.com/watch?v=VRQwmNGHbhI)

If you want to talk to the developers working on this project feel free to say hello on our [Gitter](https://gitter.im/TrueBitFoundation/Lobby)

# Getting Started

An ethereum client running on port 8545, and an ipfs daemon at port 5001.

You will also need the latest version of solidity installed and available on your path.

## Installation

In order to get things running you'll have to go through all these commands at least once.

```bash
npm run fixperms
npm run deps
npm run compile
npm run deploy
```

# Docker Installation

```
docker build . -t truebit-os:latest
docker run -it -p 4001:4001 -p 30303:30303 -v ~/kovan:/root/.local/share/io.parity.ethereum truebit-os:latest /bin/bash
```

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

In one of the sessions:
```
cd truebit-os/scripts
chmod 755 kovan.sh
./kovan.sh
```

In the other panel (`ctrl-b`+`arrow` to change panel) run this command:
```
ipfs swarm connect /ip4/176.9.9.249/tcp/4001/ipfs/QmS6C9YNGKVjWK2ctksqYeRo3zGoosEPRuPhCvgAVHBXtg
```

Once your kovan node is synced you are ready to follow along with the usage instructions below.

## Usage

Point the truebit-os shell to the wasm client configuration file which it will use to initialize.

NOTE: If you have not fully waited for your node to sync to kovan, the following command will throw an error.

```
npm run truebit wasm-client/config.json
```

The prompt should show up and then you can use the commands.

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
