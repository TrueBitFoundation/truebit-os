
# Scrypt sample walkthrough

## Writing programs

Let's start with snippets from the source code. `scrypthash.cpp`
```
std::ifstream fin("input.data", std::ios::binary);
std::ostringstream ostrm;
ostrm << fin.rdbuf();
std::string indata = ostrm.str();
indata.resize(80);
std::cout << "Got string: " << indata << std::endl;
```

So the input from the task is read from file `input.data`. In general the input and output of Truebit tasks is handled using files. 
Here is the code for output:
```
std::ofstream fout("output.data", std::ios::binary);
for (int i= 0; i < 32; i++) fout << out[i];
fout.close();
```

In general, any program written in clean C/C++ or Rust should work. Stuff like `setjmp`/`longjmp` won't work. Exceptions might not currently work properly.

## Compiling and preparing programs

C programs can be compiled into WebAssembly using emscripten `compile.sh`.
Wasm-ports repo has scripts to install libraries into `$EMSCRIPTEN/system/`.
The scrypt sample uses OpenSSL library for some primitives.
```
em++ -O2 -I $EMSCRIPTEN/system/include -c -std=c++11 scrypthash.cpp
em++ -O2 -I $EMSCRIPTEN/system/include -c -std=c++11 scrypt.cpp
em++ -o scrypt.js scrypthash.o scrypt.o -lcrypto -lssl
```

This will generate `scrypt.wasm` (the WebAssembly file) and `scrypt.js` (JS runtime).
So, the file `scrypt.wasm` has to be linked with Truebit runtime that is written in C and compiled into WASM.
This is done with the command
```
node ~/emscripten-module-wrapper/prepare.js scrypt.js --file input.data --file output.data --run --debug --out=dist --memory-size=20 --metering=5000 --upload-ipfs --limit-stack
```

The important generated files are `dist/globals.wasm` and `dist/info.json`. `globals.wasm` is the linked WASM file, `info.json` has the calculated code hash that
can be used to resolve verification games (internal format of Truebit VM).

## Using Truebit from smart contracts

There are three Truebit smart contracts that are needed for interacting Truebit. `Filesystem` is for setting up the inputs and outputs to the tasks.
`IncentiveLayer` for posting tasks. `TRU` is the token used to pay for tasks.

The data should be hashed is posted as `bytes` in method `submitData`
```
function submitData(bytes memory data) public returns (bytes32) {
```

The combination of files related to a task is called "bundle"
```
bytes32 bundleID = filesystem.makeBundle(num);
```

The input and output files are created and then added to the bundle
```
bytes32 inputFileID = filesystem.createFileFromBytes("input.data", num, data);
filesystem.addToBundle(bundleID, inputFileID);
bytes32[] memory empty = new bytes32[](0);
filesystem.addToBundle(bundleID, filesystem.createFileWithContents("output.data", num+1000000000, empty, 0));
```

The bundle is ready when the task code file has been added.
```
filesystem.finalizeBundle(bundleID, codeFileID);
```

Need to add deposit to pay to solvers and verifiers
```
tru.approve(address(truebit), 6 ether);
truebit.makeDeposit(6 ether);
```

The task is created using the hash of the bundle:
```
bytes32 task = truebit.createTaskWithParams(filesystem.getInitHash(bundleID), 1, bundleID, 1,
      1 ether, // reward
      20,      // stack size 2^20
      20,      // memory size 2^20 64-bit words
      8,       // globals 2^8
      20,      // table 2^20
      10,      // call 2^10
      5000     // gas limit in Mgas
      );
```

Then we need to register the files that should be uploaded to blockchain
```
truebit.requireFile(task, filesystem.hashName("output.data"), 0);
truebit.commitRequiredFiles(task);
```
When the required files are committed, the task is posted for the solvers to handle.

This is the callback method that is called when the task has been finalized
```
function solved(bytes32 id, bytes32[] memory files) public
```
As params, there are the task id and the uploaded file IDs.

Read the file from the filesystem contract, and store the result in the mapping
```
bytes32[] memory arr = filesystem.getData(files[0]);
result[task_to_string[id]] = arr[0];
```

## Deploying and using the contract

This contract is just deployed and used the same way as any other Ethereum contract.
See `../deploy.js` and `send.js` for details.

Note that the contract needs the code hash (from `info.json`) and addresses to Truebit contracts when it's deployed.

