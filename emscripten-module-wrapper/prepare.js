
const fs = require('fs-extra');
let argv = require('minimist')(process.argv.slice(2));
const ipfsAPI = require('ipfs-api');
const { spawn, execFile } = require('child_process');
const path = require('path');

var dir = path.dirname(fs.realpathSync(__filename)) + '/';

var tmp_dir = "/tmp/emscripten-module-wrapper" + Math.floor(Math.random() * Math.pow(2,32)).toString(32)
if (argv.out) tmp_dir = path.resolve(process.cwd(), argv.out);

fs.mkdirpSync(tmp_dir);

var debug = false
if (argv.debug) debug = true

// fix pathing so we don't need to worry about what dir we are in.
const fixPaths = (targetDir, relativePathsArray) => {
  //  console.log(targetDir, relativePathsArray)
     if (typeof relativePathsArray == "string") relativePathsArray = [relativePathsArray]
     return relativePathsArray.map(filePath => {
         let start = path.resolve(process.cwd(), filePath);
         let localPath = path.basename(filePath)
         let end = path.resolve(targetDir, localPath);
         fs.copySync(start, end);
         return localPath;
     });
};

const localizeArgv = argv => {
  argv._.push(argv._[0].replace(/.js$/, '.wasm'));
  fixPaths(tmp_dir, argv._);
  argv._ = [fixPaths(tmp_dir, argv._)[0]];

  // move files
  if (!argv.file) argv.file = []
     fixPaths(tmp_dir, argv.file);
  argv.file = fixPaths(tmp_dir, argv.file);
  return argv;
};

argv = localizeArgv(argv);

var config = [];

function readConfig() {
  try {
    config = JSON.parse(
      fs.readFileSync(dir + '../webasm-solidity/node/config.json')
    );
  } catch (e) {}
}

readConfig();

var wasm = dir + '../ocaml-offchain/interpreter/wasm';

var prerun = fs.readFileSync(dir + 'pre-run.js');
var preamble = fs.readFileSync(dir + 'preamble.js');

function exec(cmd, args) {
  return new Promise((resolve, reject) => {
      if (debug) console.log(cmd, args.join(" "))
    execFile(cmd, args, { cwd: tmp_dir }, (error, stdout, stderr) => {
      if (error) {
        console.error('error ', error);
        reject(error);
      }
      if (stderr) {
        if (debug) console.error('error ', stderr, args);
        // reject(stderr);
      }
      if (stdout) {
        if (debug) console.log('output ', stdout, args);
      }
      resolve(stdout);
    });
  });
}

function spawnPromise(cmd, args) {
  return new Promise((resolve, reject) => {
    var res = '';
      if (debug) console.log(cmd, args.join(" "))
    const p = spawn(cmd, args, { cwd: tmp_dir });

    p.on('error', err => {
      console.log('Failed to start subprocess.');
      reject(err);
    });

    p.stdout.on('data', data => {
      res += data;
      if (debug) console.log(`stdout: ${data}`);
    });

    p.stderr.on('data', data => {
      if (debug) console.log(`stderr: ${data}`);
    });

    p.on('close', code => {
      if (debug) console.log(`child process exited with code ${code}`);
      resolve(res);
    });
  });
}

function flatten(lst) {
  return [].concat.apply([], lst);
}

function clean(obj, field) {
  var x = obj[field];
  if (typeof x == 'object') return;
  if (typeof x == 'undefined') obj[field] = [];
  else obj[field] = [x];
}

async function processTask(fname) {
  var str = fs.readFileSync(path.resolve(tmp_dir, fname), 'utf8');
  str = str.replace(/{{PRE_LIBRARY}}/, prerun);

  if (argv.asmjs) preamble += '\nvar save_stack_top = false;';
  else preamble += '\nvar save_stack_top = true;';

  // preamble += "\nvar save_stack_top = true;"

  str = str.replace(/{{PREAMBLE_ADDITIONS}}/, preamble);
  str = str.replace(
    /var exports = null;/,
    'var exports = null; global_info = info;'
  );
  str = str.replace(/buffer\.subarray\(/g, 'orig_HEAP8.subarray(');
  str = str.replace(
    /updateGlobalBufferViews\(\);/,
    'updateGlobalBufferViews(); addHeapHooks();'
  );
  str = str.replace(
    /FS.createStandardStreams\(\);/,
    "FS.createStandardStreams(); FS.mkdir('/working'); FS.mount(NODEFS, { root: '.' }, '/working'); FS.chdir('/working');"
  );
  str = str.replace(
    /Module\[\"noExitRuntime\"\] = true/,
    'Module["noExitRuntime"] = false'
  );
  fs.writeFileSync(
    tmp_dir + '/prepared.js',
    'var source_dir = __dirname;\n' + str
  );

  var wasm_file = fname.replace(/.js$/, '.wasm');

  clean(argv, 'arg');
  clean(argv, 'file');

  if (argv.analyze) {
    await exec('node', ['prepared.js'].concat(argv.arg));
  }

  if (argv.asmjs)
    await exec(wasm, ['-merge', wasm_file, dir + 'filesystem.wasm']);
  else {
    await exec(wasm, ['-underscore', wasm_file]);
    await exec(wasm, [
      '-merge',
      'underscore.wasm',
      dir + 'filesystem-wasm.wasm'
    ]);
  }
    
    let gas = 0
    if (argv.metering) {
        gas = parseInt(argv.metering)
    }
    
    let flags

    if (argv.analyze && argv.asmjs) flags = ['-asmjs', '-add-globals', 'globals.json', 'merge.wasm']
    else if (argv.analyze) flags = ['-add-globals', 'globals.json', 'merge.wasm']
    else if (argv.asmjs) flags = ['-asmjs', '-add-globals', dir + 'globals-asmjs.json', 'merge.wasm']
    else flags = ['-add-globals', dir + 'globals.json', 'merge.wasm']

    if (gas > 0) {
        flags = ['-gas-limit', gas].concat(flags)
    }
    
    var mem_size = argv['memory-size'] || '25';
    flags = ['-memory-size', mem_size].concat(flags)
    
    await exec(wasm, flags)

  var args = flatten(argv.arg.map(a => ['-arg', a]));
  args = args.concat(flatten(argv.file.map(a => ['-file', a])));
  if (config.interpreter_args) args = args.concat(config.interpreter_args);
  var result_wasm = 'globals.wasm';
  var float_memory = 10 * 1024;

  if (argv.float) {
    await exec(wasm, ['-shift-mem', float_memory, 'globals.wasm']);
    await exec(wasm, [
      '-memory-offset', float_memory,
      '-int-float', dir + 'softfloat.wasm',
      'shiftmem.wasm'
    ]);
    result_wasm = 'intfloat.wasm';
  }

    let run_wasm = result_wasm

  if (argv.metering) {
    if (!argv["rust-utils"]) {
      var dta = fs.readFileSync(tmp_dir + '/' + result_wasm);
      const metering = require('wasm-metering-tb');
      const meteredWasm = metering.meterWASM(dta, {
        moduleStr: 'env',
        fieldStr: 'usegas',
        meterType: 'i32'
      });
      fs.writeFileSync(tmp_dir + '/metered.wasm', meteredWasm);
      }
    else await exec('wasm-gas', [run_wasm, "metered.wasm"])
    run_wasm = 'metered.wasm';
  }
    
    if (argv['limit-stack']) {
        await exec(wasm, ['-limit-stack', run_wasm]);
        run_wasm = "stacklimit.wasm"
    }

  var info = await spawnPromise(
    wasm,
    [
      '-m',
        '-disable-float',
      '-input',
      '-table-size', '20',
      '-stack-size', '20',
      '-memory-size', mem_size,
      '-wasm', run_wasm
    ].concat(args)
  );

  if (argv.run)
    await spawnPromise(
      wasm,
      [
        '-m',
        '-disable-float',
        '-table-size',
        '20',
        '-stack-size',
        '20',
        '-memory-size',
        mem_size,
        '-wasm',
        run_wasm
      ].concat(args)
    );

  if (!argv['upload-ipfs']) {
    console.log(JSON.stringify(JSON.parse(info), null, 2));
  }

  if (argv['upload-ipfs']) {
    var host = argv['ipfs-host'] || 'localhost';

    var ipfs = ipfsAPI(host, '5001', { protocol: 'http' });

    const uploadIPFS = fname => {
      return new Promise(function(cont, err) {
        fs.readFile(tmp_dir + '/' + fname, function(err, buf) {
          ipfs.files.add([{ content: buf, path: fname }], function(err, res) {
            cont(res[0]);
          });
        });
      });
    };

    var hash = await uploadIPFS(result_wasm);

    let infoJson = JSON.stringify(
      {
          ipfshash: hash.hash,
          codehash: JSON.parse(info).vm.code,
          info: JSON.parse(info),
          memsize: mem_size,
          gas: gas,
      },
      null,
      2
    );

    console.log(infoJson);

    fs.writeFileSync(path.join(tmp_dir, 'info.json'), infoJson);
  }
  // cleanUpAfterInstrumenting();
}

argv._.forEach(processTask);
