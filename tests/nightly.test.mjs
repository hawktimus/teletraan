// Tests for computer/scripts/nightly.sh and its unit files: the 04:00 restart, the Sunday 04:10
// reboot and the skip when a presentation is booked within the hour. curl and systemctl are
// fakes in a temporary folder, so nothing touches a real service.
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
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
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

const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/curl.exit" ] && exit "$(cat "$STUB_DIR/curl.exit")"
cat "$STUB_DIR/answer.txt"
`;
const fakeSystemctl = `#!/bin/sh
echo "systemctl $*" >> "$STUB_LOG"
`;

// booked is the number of talks the fake Sanity says are near, or null for no answer
function run(when, booked) {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  fs.mkdirSync(bin);
  fs.mkdirSync(stub);
  fs.copyFileSync(path.join(repo, 'computer/scripts/nightly.sh'), path.join(root, 'computer/scripts/nightly.sh'));
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  fs.writeFileSync(path.join(root, 'dashboard/config.js'), "export const sanity = {\n  projectId: 'abc123',\n  dataset: 'production',\n  apiVersion: '2024-01-01',\n};\n");
  ['sed', 'head', 'grep', 'date', 'dirname', 'cat'].forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'curl', fakeCurl);
  writeTool(bin, 'systemctl', fakeSystemctl);
  writeTool(bin, 'sudo', fakeSudo);
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  if (booked === null) fs.writeFileSync(path.join(stub, 'curl.exit'), '7');
  else fs.writeFileSync(path.join(stub, 'answer.txt'), '{"ms":3,"query":"x","result":' + booked + '}');

  const result = spawnSync('/bin/sh', [path.join(root, 'computer/scripts/nightly.sh')], {
    env: { PATH: bin, TZ: 'UTC', NIGHTLY_NOW: when, STUB_LOG: log, STUB_DIR: stub, TELETRAAN_SYSTEMCTL: path.join(bin, 'systemctl') },
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

check('at 04:00 with nothing booked the kiosk is restarted', () => {
  const result = run('3 0400', 0);
  assert.equal(result.status, 0);
  assert.deepEqual(result.did, ['systemctl restart teletraan-kiosk.service']);
});

check('a late start of a minute or two still counts as the 04:00 run', () => {
  assert.deepEqual(run('3 0402', 0).did, ['systemctl restart teletraan-kiosk.service']);
  assert.deepEqual(run('3 0357', 0).did, ['systemctl restart teletraan-kiosk.service']);
});

check('at 04:10 on a Sunday with nothing booked the Teletraan computer is rebooted', () => {
  assert.deepEqual(run('7 0410', 0).did, ['systemctl reboot']);
});

check('04:10 on any other day does nothing', () => {
  const result = run('2 0410', 0);
  assert.equal(result.status, 0);
  assert.deepEqual(result.did, []);
  assert.match(result.text, /no reboot except on Sunday/);
});

check('a talk booked within the hour skips the restart and the reboot, and says so', () => {
  const kiosk = run('3 0400', 1);
  assert.deepEqual(kiosk.did, []);
  assert.match(kiosk.text, /skipped/);
  const reboot = run('7 0410', 2);
  assert.deepEqual(reboot.did, []);
  assert.match(reboot.text, /skipped/);
});

check('the question to Sanity is about booked talks only, in the hour ahead and the two hours back', () => {
  const result = run('3 0400', 0);
  const asked = decodeURIComponent(result.calls.find(line => line.startsWith('curl')).replace(/\+/g, ' '));
  assert.match(asked, /_type == "presentation"/);
  assert.match(asked, /status == "scheduled"/);
  assert.match(asked, /dateTime\(start\) < dateTime\("\d{4}-\d\d-\d\dT[\d:]+Z"\)/);
  assert.match(asked, /dateTime\(start\) > dateTime\("\d{4}-\d\d-\d\dT[\d:]+Z"\)/);
  assert.match(asked, /abc123\.api\.sanity\.io\/v2024-01-01\/data\/query\/production/);
});

check('when Sanity cannot be asked the restart goes ahead', () => {
  assert.deepEqual(run('3 0400', null).did, ['systemctl restart teletraan-kiosk.service']);
});

check('any other time of day does nothing and does not ask Sanity', () => {
  const result = run('3 1300', 0);
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
  const kiosk = run('3 0400', 0);
  assert.ok(kiosk.calls.some(line => /^sudo -n .*\/systemctl restart teletraan-kiosk\.service$/.test(line)), kiosk.calls.join('|'));
  const reboot = run('7 0410', 0);
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
