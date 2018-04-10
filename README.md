# Truebit Client

This is meant to be the Client software used to interact with the Truebit system.

## Git Submodule Commands

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

This is a good blog post to reference CLI apps in Node
https://www.sitepoint.com/javascript-command-line-interface-cli-node-js/