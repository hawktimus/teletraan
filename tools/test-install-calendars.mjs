// Tests for deploy/scripts/install-calendars.sh. The tools it uses on the Mini
// (id, systemctl) are replaced with small fake ones in a temporary folder, so
// nothing touches the machine. The script cannot get as far as copying files
// here, because it only does that with sudo and with the repository at
// /opt/teletraan, so the tests cover what it checks before that and what it
// is allowed to install.
//
//   node tools/test-install-calendars.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const installFile = path.join(repo, 'deploy/scripts/install-calendars.sh');
const timersFile = path.join(repo, 'deploy/scripts/install-timers.sh');
const unitFiles = ['teletraan-calendars.service', 'teletraan-calendars.timer'];
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-install-calendars-'));

// The tools the script needs that are not the ones being faked
const ordinaryTools = ['sed', 'grep', 'mktemp', 'rm', 'dirname', 'cat'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// Makes a copy of the deploy folder to run in and a folder of tools to run
// with, and returns how to run the script.
function setup(name) {
  const root = path.join(work, name);
  const bin = path.join(root, 'bin');
  fs.mkdirSync(path.join(root, 'deploy/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'deploy/systemd'), { recursive: true });
  fs.mkdirSync(bin);

  fs.copyFileSync(installFile, path.join(root, 'deploy/scripts/install-calendars.sh'));
  fs.chmodSync(path.join(root, 'deploy/scripts/install-calendars.sh'), fs.statSync(installFile).mode);
  fs.copyFileSync(path.join(repo, 'deploy/scripts/fetch-calendars.sh'), path.join(root, 'deploy/scripts/fetch-calendars.sh'));
  fs.chmodSync(path.join(root, 'deploy/scripts/fetch-calendars.sh'), 0o755);
  unitFiles.forEach(unit => fs.copyFileSync(path.join(repo, 'deploy/systemd', unit), path.join(root, 'deploy/systemd', unit)));

  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && echo "$STUB_UID"\nexit 0\n');
  writeTool(bin, 'systemctl', '#!/bin/sh\necho "systemctl $*" >> "$STUB_LOG"\n');

  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  return {
    root: root,
    install(extra) {
      const env = Object.assign({ PATH: bin, STUB_LOG: log, STUB_UID: '1000' }, extra || {});
      const result = spawnSync('/bin/sh', [path.join(root, 'deploy/scripts/install-calendars.sh')], { env: env, encoding: 'utf8', input: '\n', cwd: root });
      return { text: result.stdout, errors: result.stderr, status: result.status, calls: fs.readFileSync(log, 'utf8') };
    },
  };
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('it stops, naming the file, when a unit file is missing or empty', () => {
  const missing = setup('missing');
  fs.rmSync(path.join(missing.root, 'deploy/systemd/teletraan-calendars.service'));
  const first = missing.install();
  assert.equal(first.status, 1);
  assert.ok(first.errors.includes('teletraan-calendars.service is missing or empty'), first.errors);

  const empty = setup('empty');
  fs.writeFileSync(path.join(empty.root, 'deploy/systemd/teletraan-calendars.timer'), '');
  const second = empty.install();
  assert.equal(second.status, 1);
  assert.ok(second.errors.includes('teletraan-calendars.timer is missing or empty'), second.errors);

  [first, second].forEach(result => assert.ok(!result.calls.includes('systemctl'), 'nothing was changed'));
});

test('it stops when fetch-calendars.sh is missing or cannot be run', () => {
  const missing = setup('no-fetch');
  fs.rmSync(path.join(missing.root, 'deploy/scripts/fetch-calendars.sh'));
  const first = missing.install();
  assert.equal(first.status, 1);
  assert.ok(first.errors.includes('fetch-calendars.sh is missing or cannot be run'), first.errors);

  const plain = setup('plain-fetch');
  fs.chmodSync(path.join(plain.root, 'deploy/scripts/fetch-calendars.sh'), 0o644);
  const second = plain.install();
  assert.equal(second.status, 1);
  assert.ok(second.errors.includes('fetch-calendars.sh is missing or cannot be run'), second.errors);

  [first, second].forEach(result => assert.ok(!result.calls.includes('systemctl'), 'nothing was changed'));
});

test('with everything in place it still needs sudo and the repository at /opt/teletraan before it changes anything', () => {
  const place = setup('checks');
  const plain = place.install({ STUB_UID: '1000' });
  assert.equal(plain.status, 1);
  assert.ok(plain.errors.includes('it has to run with sudo'), plain.errors);

  const root = place.install({ STUB_UID: '0' });
  assert.equal(root.status, 1);
  assert.ok(root.errors.includes('The unit files expect the repository at /opt/teletraan'), root.errors);
  assert.ok(!root.calls.includes('systemctl'));
});

test('it installs and turns on the calendar units only, never the pull timer, the kiosk or the slides', () => {
  const text = fs.readFileSync(installFile, 'utf8');

  const unitNames = text.match(/teletraan-[a-z]+\.(service|timer)/g);
  assert.deepEqual([...new Set(unitNames)], ['teletraan-calendars.service', 'teletraan-calendars.timer']);
  ['pull', 'kiosk', 'slides'].forEach(other => assert.ok(!text.includes('teletraan-' + other), 'it never names the ' + other + ' unit'));
  assert.ok(!text.includes('teletraan-*'), 'no pattern that picks up the other units');

  const enables = text.split('\n').filter(line => /^systemctl (enable|restart)/.test(line));
  assert.deepEqual(enables, ['systemctl enable --now teletraan-calendars.timer', 'systemctl restart teletraan-calendars.timer']);
});

test('it fills in the account the way install-timers.sh does, and the units it copies say ACCOUNT', () => {
  const fill = /^\s*sed "s\/\^User=ACCOUNT\\\$\/User=\$account\/".*$/m;
  const own = fs.readFileSync(installFile, 'utf8').match(fill);
  const timers = fs.readFileSync(timersFile, 'utf8').match(fill);
  assert.ok(own && timers, 'both scripts have the line');
  assert.equal(own[0].replace(/ "\$units\/\$unit"/, ' "$unit"'), timers[0]);

  const service = fs.readFileSync(path.join(repo, 'deploy/systemd/teletraan-calendars.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'deploy/systemd/teletraan-calendars.timer'), 'utf8');
  assert.deepEqual(service.match(/^User=.*$/gm), ['User=ACCOUNT']);
  assert.ok(/^ExecStart=\/opt\/teletraan\/deploy\/scripts\/fetch-calendars\.sh$/m.test(service));
  assert.ok(/^OnUnitActiveSec=15min$/m.test(timer));
  assert.ok(!/hawktimus/i.test(service + timer), 'no account name is written in the unit files');
});

test('the script has valid sh syntax and is executable', () => {
  const syntax = spawnSync('/bin/sh', ['-n', installFile], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.ok(fs.readFileSync(installFile, 'utf8').startsWith('#!/bin/sh\n'));
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
