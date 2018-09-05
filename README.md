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

## Installation
```bash
npm run fixperms
npm run install
npm run deploy
npm run truebit wasm-client/config.json
```

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

Once a user has created their config file they can start up the Truebit OS shell to interact with the client. Ex:

```bash
npm run truebit wasm-client/config.json
```

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
skip 120
```

# Basic Client

The `basic-client` directory houses an example project with the relevant modules to interface with the Truebit OS kernel.

The point of `basic-client` is to function as a template for anyone to base their interactive verification game project off of. Such a project can then be hosted on the Truebit OS platform. It was originally used to prototype the features for this project, and is useful for educational purposes as it uses a simplified Computation Layer. If you are interested in diving into how the protocol's implementation works without having to understand the internals of WASM this is a good place to look. Basic client is also a good template for Truebit Lite mechanisms that use specific computation layers (for example Scrypt hashing) and can be implemented fully in Solidity. Since WASM is a general platform, this may not end up being used, however, some teams may want to use it for cost optimization or other purposes.

## Usage

```
npm run truebit basic-client/config.json
```

Similar instructions above but make sure to use `testTask.json`.

Now you should see a json file in solutions/ labelled with the task id.

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
