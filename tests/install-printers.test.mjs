// Tests for computer/scripts/install-printers.sh. The tools it uses on the Teletraan computer (id, node, systemctl) are replaced with
// small fake ones in a temporary folder, so nothing touches the machine. The script cannot get as far as copying files here,
// because it only does that with sudo and with the repository at /opt/teletraan, so the tests cover what it checks before that,
// what it is allowed to install, and the unit file it installs.
//
//   node tests/install-printers.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const installFile = path.join(repo, 'computer/scripts/install-printers.sh');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-install-printers-'));
const ordinaryTools = ['sed', 'grep', 'mktemp', 'rm', 'dirname', 'cat', 'tail'];

function findTool(name) {
  const found = spawnSync('/bin/bash', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// Copies what the script needs into a temporary computer/ folder and returns how to run it. nodeMajor of 0 means no node at all.
function setup(name, nodeMajor = 20) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  ['computer/scripts', 'computer/systemd', 'computer/config'].forEach(folder => fs.mkdirSync(path.join(root, folder), { recursive: true }));
  fs.mkdirSync(bin);

  const copy = file => {
    fs.copyFileSync(path.join(repo, file), path.join(root, file));
    fs.chmodSync(path.join(root, file), fs.statSync(path.join(repo, file)).mode);
  };
  ['computer/scripts/install-printers.sh', 'computer/scripts/lib.sh', 'computer/scripts/printer-sync.mjs', 'computer/scripts/printer-ws.mjs',
    'computer/systemd/teletraan-printers.service', 'computer/config/printers.example.json'].forEach(copy);

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo "$STUB_UID"\nexit 0\n');
  writeTool(bin, 'systemctl', '#!/bin/sh\necho "systemctl $*" >> "$STUB_LOG"\n');
  if (nodeMajor > 0) writeTool(bin, 'node', '#!/bin/sh\n[ "$1" = -e ] && exit ' + (nodeMajor >= 18 ? 0 : 1) + '\nexit 0\n');

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  return {
    root: root,
    install(extra) {
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_UID: '1000' }, extra || {});
      const result = spawnSync('/bin/bash', [path.join(root, 'computer/scripts/install-printers.sh')], { env: env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
  };
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('it stops, naming the file, when the unit file or a script it installs is missing or empty', () => {
  const unit = setup('no-unit');
  fs.rmSync(path.join(unit.root, 'computer/systemd/teletraan-printers.service'));
  const first = unit.install();
  assert.equal(first.status, 1);
  assert.ok(first.errors.includes('teletraan-printers.service is missing or empty'), first.errors);

  const script = setup('no-script');
  fs.writeFileSync(path.join(script.root, 'computer/scripts/printer-sync.mjs'), '');
  const second = script.install();
  assert.equal(second.status, 1);
  assert.ok(second.errors.includes('printer-sync.mjs is missing'), second.errors);

  const example = setup('no-example');
  fs.rmSync(path.join(example.root, 'computer/config/printers.example.json'));
  const third = example.install();
  assert.equal(third.status, 1);
  assert.ok(third.errors.includes('printers.example.json is missing'), third.errors);

  [first, second, third].forEach(result => assert.ok(!result.calls.includes('systemctl'), 'nothing was changed'));
});

test('it stops when node is missing or older than 18', () => {
  const none = setup('no-node', 0).install();
  assert.equal(none.status, 1);
  assert.ok(none.errors.includes('node is not installed'), none.errors);

  const old = setup('old-node', 16).install();
  assert.equal(old.status, 1);
  assert.ok(old.errors.includes('older than version 18'), old.errors);
  [none, old].forEach(result => assert.ok(!result.calls.includes('systemctl')));
});

test('with everything in place it still needs sudo and the repository at /opt/teletraan before it changes anything', () => {
  const place = setup('checks');
  const plain = place.install({ STUB_UID: '1000' });
  assert.equal(plain.status, 1);
  assert.ok(plain.errors.includes('has to run with sudo'), plain.errors);

  const root = place.install({ STUB_UID: '0' });
  assert.equal(root.status, 1);
  assert.ok(root.errors.includes('expects the repository at /opt/teletraan'), root.errors);
  assert.ok(!root.calls.includes('systemctl'));
});

test('it installs and turns on the printers unit only, never the pull timer, the kiosk, the slides or the sync', () => {
  const text = fs.readFileSync(installFile, 'utf8');
  assert.deepEqual([...new Set(text.match(/teletraan-[a-z]+\.(service|timer)/g))], ['teletraan-printers.service']);
  ['pull', 'kiosk', 'slides', 'sync', 'news', 'calendars'].forEach(other => assert.ok(!text.includes('teletraan-' + other), 'it never names the ' + other + ' unit'));
  assert.ok(!text.includes('teletraan-*'), 'no pattern that picks up the other units');

  const changes = text.split('\n').filter(line => /^systemctl (enable|restart|daemon-reload)/.test(line));
  assert.deepEqual(changes, ['systemctl daemon-reload', 'systemctl enable "$unit"', 'systemctl restart "$unit"']);
});

test('it never overwrites an existing printers file', () => {
  const text = fs.readFileSync(installFile, 'utf8');
  assert.ok(/if \[ ! -f "\$printers_file" \]; then/.test(text), 'the file is only made when absent');
  assert.ok(!/cp .*printers_file|install .*printers_file/.test(text));
});

test('the unit runs as ACCOUNT, restarts always, reads no key, and names the service script', () => {
  const unit = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-printers.service'), 'utf8');
  assert.deepEqual(unit.match(/^User=.*$/gm), ['User=ACCOUNT']);
  assert.ok(/^ExecStart=\/usr\/bin\/env node \/opt\/teletraan\/computer\/scripts\/printer-sync\.mjs$/m.test(unit));
  assert.ok(/^Restart=always$/m.test(unit));
  assert.ok(/^NoNewPrivileges=yes$/m.test(unit));
  assert.ok(!/EnvironmentFile/.test(unit), 'local.env is never loaded');
  assert.ok(!/hawktimus/i.test(unit), 'no account name is written in the unit file');
  assert.equal(unit.match(/^Environment=TELETRAAN_DATA=(.*)$/m)[1], '/var/lib/teletraan/data');
});

test('the example printers file has valid JSON with placeholder addresses, not the real ones', () => {
  const text = fs.readFileSync(path.join(repo, 'computer/config/printers.example.json'), 'utf8');
  const parsed = JSON.parse(text);
  assert.ok(Array.isArray(parsed.printers) && parsed.printers.length > 0);
  parsed.printers.forEach(entry => assert.ok(!/^192\.168\.0\.10[123]$/.test(entry.ip), 'no real address in the repository'));
});

test('the script has valid sh syntax and is executable', () => {
  const syntax = spawnSync('/bin/bash', ['-n', installFile], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.ok(fs.readFileSync(installFile, 'utf8').startsWith('#!/bin/bash\n'));
  assert.ok((fs.statSync(installFile).mode & 0o111) !== 0, 'the script should be executable');
});

let failures = 0;
try {
  for (const entry of tests) {
    try {
      entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
