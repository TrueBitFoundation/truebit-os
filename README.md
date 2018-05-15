# Truebit OS

[![Build Status](https://travis-ci.org/TrueBitFoundation/truebit-os.svg?branch=master)](https://travis-ci.org/TrueBitFoundation/truebit-os)

The Truebit OS is meant to be a general purpose platform for interactive verification games. The benefit of it is that users are not locked into a particular client, but can build their own and then host it on the Truebit platform. Benefitting from the time we spend on development and research for solving problems related to running interactive verification games on a blockchain.

# Getting Started

## Installation
```bash
chmod 755 basic-client/install.sh
./basic-client/install.sh

chmod 755 basic-client/deploy.sh
./basic-client/deploy.sh
```

The `basic-client` directory houses an example project with the relevant modules to interface with the Truebit OS kernel. 
These are `taskGiver.js`, `solver.js`, and `verifier.js`. Please note that any of these modules are optional and can be run independently of each other.

The point of `basic-client` is to function as a template for anyone to base their interactive verification game project off of. Such a project can then be hosted on the Truebit OS platform.

Currently it uses the `TaskExchange` contract for the incentive layer. The `BasicVerificationGame` as the dispute resolution layer. And the `SimpleAdderVM` for the computation layer. In order to run tasks with this setup you simply add a list of numbers you want summed by the SimpleAdderVM. It then creates a task on the `TaskExchange` contract which will be finalized after a specified number of blocks. In the case of a challenge to the task's solution, a verification game is created on the dispute resolution layer. In this case, this is handled by the `BasicVerificationGame` contract. The two contracts for the incentive layer and the dispute resolution layer don't have to be used, but they can be helpful to inherit from other smart contracts to build similar systems with custom features for a particular problem. 

## Usage

The way that Truebit OS knows where to load the relevant modules is with a config file. This is a simple JSON file with a couple fields, that tell the OS where to find the modules at. Here is the example config.json provided used for `basic-client`:
```javascript
{
    "http-url": "http://localhost:8545",
    "verifier": "../basic-client/verifier",
    "solver": "../basic-client/solver",
    "task-giver": "../basic-client/taskGiver"
}
```

Once a user has created their config file they can start up the Truebit OS shell. Ex:

```bash
node os/shell.js basic-client/config.json
```

## Example

After starting up the shell you can enter commands to start submitting and solving tasks:

You can start up a task giver process that will monitor the incentive layer smart contract for events:
```
start task -a 0
```

Now the process will be monitoring for tasks created by account 0.

We can also start up a solver:
```
start solve -a 1
```

We've started up a solver with account 1 (this is to simulate different users, but it could be the same account).

Finally, we can submit our task:
```
task -a 0 -t testTask.json
```

We have specified to submit a task from account 0. And the data related to the task is located at testTask.json

If you are running this on a development test net you will need to skip blocks to see the solution in the solutions directory.
```
skip 65
```

Now you should see a json file in solutions/ labelled with the task id.

You can exit out of the shell and close the running processes with `quit`

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