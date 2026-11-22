// Tests for computer/scripts/nightly.sh and its unit files: the 04:00 restart, the Sunday 04:10
// reboot. systemctl and sudo are fakes in a temporary folder, so nothing touches a real service.
//
//   node tests/nightly.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-nightly-'));
let passed = 0;
let counter = 0;

function findTool(name) {
  const found = spawnSync('/bin/bash', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

const fakeSudo = `#!/bin/sh
echo "sudo $*" >> "$STUB_LOG"
[ "$1" = -n ] && shift
exec "$@"
`;

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

const fakeSystemctl = `#!/bin/sh
echo "systemctl $*" >> "$STUB_LOG"
`;

function run(when) {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const bin = path.join(root, 'bin');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(bin);
  fs.copyFileSync(path.join(repo, 'computer/scripts/nightly.sh'), path.join(root, 'computer/scripts/nightly.sh'));
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  // The reboot asks the gate first (computer/scripts/gate.sh), which needs these three and node
  ['gate.sh', 'ledger.mjs', 'supervisor-plan.mjs'].forEach(name => fs.copyFileSync(path.join(repo, 'computer/scripts', name), path.join(root, 'computer/scripts', name)));
  fs.chmodSync(path.join(root, 'computer/scripts/gate.sh'), 0o755);
  ['sed', 'head', 'grep', 'date', 'dirname', 'cat', 'node'].forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'systemctl', fakeSystemctl);
  writeTool(bin, 'sudo', fakeSudo);
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');

  const result = spawnSync('/bin/bash', [path.join(root, 'computer/scripts/nightly.sh')], {
    env: { PATH: bin, TZ: 'UTC', NIGHTLY_NOW: when, STUB_LOG: log, TELETRAAN_SYSTEMCTL: path.join(bin, 'systemctl'), TELETRAAN_LEDGER: path.join(root, 'reboot-ledger.json'), TELETRAAN_UPTIME_SECONDS: String(40 * 3600), NETWATCH_STATE: path.join(root, 'no-netwatch.json') },
    encoding: 'utf8',
  });
  const calls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean);
  return { status: result.status, text: result.stdout, calls: calls, did: calls.filter(line => line.startsWith('systemctl')) };
}

function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

check('at 04:00 the kiosk is restarted', () => {
  const result = run('3 0400');
  assert.equal(result.status, 0);
  assert.deepEqual(result.did, ['systemctl restart teletraan-kiosk.service']);
});

check('a late start of a minute or two still counts as the 04:00 run', () => {
  assert.deepEqual(run('3 0402').did, ['systemctl restart teletraan-kiosk.service']);
  assert.deepEqual(run('3 0357').did, ['systemctl restart teletraan-kiosk.service']);
});

check('at 04:10 on a Sunday the Teletraan computer is rebooted', () => {
  assert.deepEqual(run('7 0410').did, ['systemctl reboot']);
});

check('04:10 on any other day does nothing', () => {
  const result = run('2 0410');
  assert.equal(result.status, 0);
  assert.deepEqual(result.did, []);
  assert.match(result.text, /no reboot except on Sunday/);
});

check('any other time of day does nothing', () => {
  const result = run('3 1300');
  assert.deepEqual(result.calls, []);
});

check('the timer fires at 04:00 daily and 04:10 on Sundays, is not persistent, and starts the service', () => {
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-nightly.timer'), 'utf8');
  assert.match(timer, /^OnCalendar=\*-\*-\* 04:00:00$/m);
  assert.match(timer, /^OnCalendar=Sun \*-\*-\* 04:10:00$/m);
  assert.match(timer, /^Persistent=false$/m);
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-nightly.service'), 'utf8');
  assert.match(service, /^ExecStart=\/opt\/teletraan\/computer\/scripts\/nightly\.sh$/m);
});

check('the restart and the reboot go through sudo -n with exactly the commands the sudoers file names', () => {
  const kiosk = run('3 0400');
  assert.ok(kiosk.calls.some(line => /^sudo -n .*\/systemctl restart teletraan-kiosk\.service$/.test(line)), kiosk.calls.join('|'));
  const reboot = run('7 0410');
  assert.ok(reboot.calls.some(line => /^sudo -n .*\/systemctl reboot$/.test(line)), reboot.calls.join('|'));
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/nightly.sh'), 'utf8');
  assert.ok(text.includes('TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl'));
  assert.ok(!/^\s*systemctl /m.test(text), 'no systemctl without sudo');
});

check('the nightly unit runs as the login user, not root', () => {
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-nightly.service'), 'utf8');
  assert.match(service, /^User=ACCOUNT$/m);
  assert.doesNotMatch(service, /^NoNewPrivileges=/m);
});

check('the backup timer is at 03:15 and the script keeps 14', () => {
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-backup.timer'), 'utf8');
  assert.match(timer, /^OnCalendar=\*-\*-\* 03:15:00$/m);
  assert.match(fs.readFileSync(path.join(repo, 'computer/scripts/backup-dataset.sh'), 'utf8'), /^keep=14$/m);
});

console.log(passed + ' of ' + passed + ' checks passed.');
