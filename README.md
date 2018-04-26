# Truebit OS

# Getting Started

## Installation
```bash
chmod 755 install.sh
./install.sh

chmod 755 deploy.sh
./deploy.sh
```

## Usage
```bash
node os/shell.js
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