// Tests for computer/scripts/scheduled-reboot.sh and its unit files: the timer that reboots the Teletraan computer at the
// time set in Dashboard Settings. curl, sudo, flock and status-write.sh are fakes in a temporary folder, node and jq are the
// real ones, and the clock and the uptime are given by REBOOT_NOW and REBOOT_UPTIME, so nothing reboots anything.
//
//   node tests/scheduled-reboot.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-reboot-'));
process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));
let passed = 0;
let counter = 0;

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// The fake curl copies the prepared answer to the file named by --output, and fails when curl.exit exists
const fakeCurl = `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/curl.exit" ] && exit "$(cat "$STUB_DIR/curl.exit")"
while [ $# -gt 0 ]; do
  if [ "$1" = --output ]; then cp "$STUB_DIR/answer.json" "$2"; fi
  shift
done
`;
const fakeSudo = `#!/bin/sh
echo "sudo $*" >> "$STUB_LOG"
[ -f "$STUB_DIR/sudo.exit" ] && exit "$(cat "$STUB_DIR/sudo.exit")"
exit 0
`;
const fakeStatusWrite = `#!/bin/sh
echo "status-write $*" >> "$STUB_LOG"
`;

const ny = 'America/New_York';
const slot = Date.parse('2026-10-20T07:30:00Z') / 1000; // Tuesday 03:30 in New York
const settingOn = { rebootEnabled: true, rebootTime: '03:30', rebootDays: [0, 1, 2, 3, 4, 5, 6], rebootSkipBusy: true, rebootWaitMinutes: 30 };

// A place that keeps its files between runs: a place is made once and run many times
function makePlace() {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard/core'), { recursive: true });
  [bin, stub, data].forEach(folder => fs.mkdirSync(folder));
  ['scheduled-reboot.sh', 'lib.sh', 'reboot-plan.mjs'].forEach(name => fs.copyFileSync(path.join(repo, 'computer/scripts', name), path.join(root, 'computer/scripts', name)));
  fs.chmodSync(path.join(root, 'computer/scripts/scheduled-reboot.sh'), 0o755);
  fs.copyFileSync(path.join(repo, 'dashboard/core/constants.js'), path.join(root, 'dashboard/core/constants.js'));
  fs.writeFileSync(path.join(root, 'package.json'), '{ "type": "module" }\n');
  fs.writeFileSync(path.join(root, 'dashboard/config.js'), "export const sanity = {\n  projectId: 'abc123',\n  dataset: 'production',\n  apiVersion: '2024-01-01',\n};\n");
  // A made-up key line, to show that nothing prints it
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_DATA='" + data + "'\nSANITY_WRITE_TOKEN='skTESTONLYnotarealkey'\n");
  ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'cut', 'mkdir', 'chmod', 'mv', 'cp', 'cmp', 'mktemp', 'rm', 'tr', 'jq', 'node'].forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  writeTool(bin, 'curl', fakeCurl);
  writeTool(bin, 'sudo', fakeSudo);
  writeTool(bin, 'flock', '#!/bin/sh\nexit 0\n');
  writeTool(path.join(root, 'computer/scripts'), 'status-write.sh', fakeStatusWrite);
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  return { root, bin, stub, data, log };
}

function answer(place, setting, extra) {
  const result = Object.assign({ setting: setting, zone: ny, announcements: [], talks: [] }, extra || {});
  fs.writeFileSync(path.join(place.stub, 'answer.json'), JSON.stringify({ ms: 3, query: 'x', result: result }));
  fs.rmSync(path.join(place.stub, 'curl.exit'), { force: true });
}

// The setting is seen one hour before its slot, as it is when it was published the day before
function ready(place, setting, extra) {
  answer(place, setting, extra);
  run(place, slot - 3600);
  fs.writeFileSync(place.log, '');
}

function offline(place) {
  fs.writeFileSync(path.join(place.stub, 'curl.exit'), '7');
}

function run(place, when, uptime) {
  const result = spawnSync('/bin/bash', [path.join(place.root, 'computer/scripts/scheduled-reboot.sh')], {
    env: { PATH: place.bin, TZ: 'UTC', REBOOT_NOW: String(when), REBOOT_UPTIME: String(uptime === undefined ? 40 * 3600 : uptime), STUB_LOG: place.log, STUB_DIR: place.stub, TELETRAAN_SYSTEMCTL: '/usr/bin/systemctl' },
    encoding: 'utf8',
    timeout: 30000,
    input: '',
  });
  const calls = fs.readFileSync(place.log, 'utf8').split('\n').filter(Boolean);
  return { status: result.status, text: result.stdout + result.stderr, calls: calls, reboots: calls.filter(line => line === 'sudo -n /usr/bin/systemctl reboot') };
}

const stateOf = place => JSON.parse(fs.readFileSync(path.join(place.data, 'reboot/state.json'), 'utf8'));
const statusOf = place => JSON.parse(fs.readFileSync(path.join(place.data, 'reboot/status.json'), 'utf8'));

function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

check('at the slot the computer is rebooted once, by the same sudo command the control page uses', () => {
  const place = makePlace();
  ready(place, settingOn);
  const result = run(place, slot + 120);
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(result.reboots, ['sudo -n /usr/bin/systemctl reboot']);
  assert.match(result.text, /scheduled reboot: rebooting for Tue 03:30\./);
});

check('the state and the status are written before the reboot, and Studio is told', () => {
  const place = makePlace();
  ready(place, settingOn);
  const result = run(place, slot + 120);
  assert.equal(stateOf(place).lastSlot, slot * 1000);
  const status = statusOf(place);
  assert.equal(status.nextRebootText, 'Wed 03:30');
  assert.equal(status.nextRebootAt, '2026-10-21T07:30:00.000Z');
  assert.equal(status.lastRebootAt, new Date((slot + 120) * 1000).toISOString().replace('.000Z', 'Z'));
  assert.equal(status.lastRebootWhy, 'Tue 03:30, as scheduled');
  assert.ok(result.calls.indexOf('status-write reboot') < result.calls.indexOf('sudo -n /usr/bin/systemctl reboot'), 'status-write should come first');
});

check('a second run five minutes later, on the same slot, reboots nothing', () => {
  const place = makePlace();
  ready(place, settingOn);
  run(place, slot + 120);
  fs.writeFileSync(place.log, '');
  const second = run(place, slot + 420, 8 * 60);
  assert.deepEqual(second.reboots, []);
  const third = run(place, slot + 720, 13 * 60);
  assert.deepEqual(third.reboots, []);
});

check('the status is sent only when it changed, so a quiet day is no writes', () => {
  const place = makePlace();
  ready(place, settingOn);
  const again = run(place, slot - 3600 + 300);
  assert.equal(again.calls.filter(line => line.startsWith('status-write')).length, 0);
});

check('off reboots nothing and plans nothing', () => {
  const place = makePlace();
  ready(place, Object.assign({}, settingOn, { rebootEnabled: false }));
  const result = run(place, slot + 120);
  assert.deepEqual(result.reboots, []);
  assert.match(result.text, /scheduled reboot is off/);
  assert.equal(statusOf(place).nextRebootText, '');
});

check('a day that is not ticked reboots nothing', () => {
  const place = makePlace();
  ready(place, Object.assign({}, settingOn, { rebootDays: [0, 1, 3, 4, 5, 6] }));
  assert.deepEqual(run(place, slot + 120).reboots, []);
});

check('a computer that started less than 10 minutes ago is not rebooted', () => {
  const place = makePlace();
  ready(place, settingOn);
  assert.deepEqual(run(place, slot + 120, 9 * 60).reboots, []);
});

check('the last reboot less than 6 hours ago stops a second reboot', () => {
  const place = makePlace();
  ready(place, settingOn);
  fs.writeFileSync(path.join(place.data, 'reboot/state.json'), JSON.stringify({ lastRebootAt: (slot - 3600) * 1000, settingKey: 'on|03:30|0123456', settingSince: (slot - 86400) * 1000 }));
  assert.deepEqual(run(place, slot + 120).reboots, []);
});

check('a talk, an alert or an announcement makes it wait, and it reboots anyway after the wait', () => {
  const place = makePlace();
  ready(place, settingOn, { setting: Object.assign({}, settingOn, { alert: { on: true } }) });
  const waiting = run(place, slot + 120);
  assert.deepEqual(waiting.reboots, []);
  assert.match(waiting.text, /waiting for an alert/);
  const stillWaiting = run(place, slot + 20 * 60);
  assert.deepEqual(stillWaiting.reboots, []);
  const done = run(place, slot + 31 * 60);
  assert.equal(done.reboots.length, 1);
  assert.equal(statusOf(place).lastRebootWhy, 'Tue 03:30, after waiting 30 minutes for an alert');
});

check('the alert is not part of the cached setting, so an old alert never holds back a reboot', () => {
  const place = makePlace();
  answer(place, settingOn, { setting: Object.assign({}, settingOn, { alert: { on: true } }) });
  run(place, slot - 3600);
  const cached = JSON.parse(fs.readFileSync(path.join(place.data, 'reboot/setting.json'), 'utf8'));
  assert.equal(cached.setting.alert, undefined);
  assert.equal(cached.zone, ny);
});

check('when Sanity cannot be asked, the last known setting is used and the reboot still happens', () => {
  const place = makePlace();
  ready(place, settingOn);
  offline(place);
  const result = run(place, slot + 120);
  assert.equal(result.reboots.length, 1);
  assert.match(result.text, /last known setting is used/);
});

check('when Sanity cannot be asked and no setting is kept, nothing is done and the run ends quietly', () => {
  const place = makePlace();
  offline(place);
  const result = run(place, slot + 120);
  assert.equal(result.status, 0);
  assert.deepEqual(result.reboots, []);
  assert.match(result.text, /no setting is kept/);
});

check('a reboot the system refuses is not tried again every five minutes, and the last reboot stays the one before', () => {
  const place = makePlace();
  ready(place, settingOn);
  fs.writeFileSync(path.join(place.stub, 'sudo.exit'), '1');
  const refused = run(place, slot + 120);
  assert.equal(refused.status, 1);
  assert.match(refused.text, /refused/);
  assert.equal(stateOf(place).lastRebootAt, 0);
  assert.equal(stateOf(place).lastSlot, slot * 1000);
  fs.writeFileSync(place.log, '');
  assert.deepEqual(run(place, slot + 420).reboots, []);
});

check('it asks Sanity over https for published content only, sends no key, and never prints one', () => {
  const place = makePlace();
  ready(place, settingOn);
  const result = run(place, slot + 120);
  const asked = result.calls.find(line => line.startsWith('curl'));
  assert.match(asked, /--proto =https/);
  assert.match(asked, /abc123\.api\.sanity\.io\/v2024-01-01\/data\/query\/production/);
  assert.match(asked, /perspective=published/);
  assert.doesNotMatch(asked, /Authorization|Bearer|skTESTONLY/);
  assert.doesNotMatch(result.text, /skTESTONLY/);
  const query = decodeURIComponent(asked.replace(/\+/g, ' '));
  ['rebootEnabled', 'rebootTime', 'rebootDays', 'rebootSkipBusy', 'rebootWaitMinutes', 'theme', 'announcement', 'presentation'].forEach(word => assert.ok(query.includes(word), 'the query should ask for ' + word));
});

check('status-write.sh reboot sends the next and last reboot to status-mini, and removes a part that is empty', () => {
  const place = makePlace();
  fs.copyFileSync(path.join(repo, 'computer/scripts/status-write.sh'), path.join(place.root, 'computer/scripts/status-write.sh'));
  fs.mkdirSync(path.join(place.data, 'reboot'));
  const write = line => fs.writeFileSync(path.join(place.data, 'reboot/status.json'), line + '\n');
  const send = () => {
    fs.writeFileSync(place.log, '');
    const result = spawnSync('/bin/bash', [path.join(place.root, 'computer/scripts/status-write.sh'), 'reboot'], { env: { PATH: place.bin, STUB_LOG: place.log, STUB_DIR: place.stub }, encoding: 'utf8', input: '' });
    const sent = fs.readFileSync(place.log, 'utf8').split('\n').find(line => line.startsWith('curl')) || '';
    return { status: result.status, text: result.stdout + result.stderr, body: sent.includes('--data') ? JSON.parse(sent.slice(sent.indexOf('--data ') + 7).split(' --output')[0]) : null };
  };

  write('{"nextRebootAt":"2026-10-21T07:30:00.000Z","nextRebootText":"Wed 03:30","lastRebootAt":"2026-10-20T07:32:00Z","lastRebootWhy":"Tue 03:30, as scheduled"}');
  const both = send();
  assert.equal(both.status, 0, both.text);
  const patch = both.body.mutations[1].patch;
  assert.equal(patch.id, 'status-mini');
  assert.deepEqual(patch.set, { nextRebootAt: '2026-10-21T07:30:00.000Z', nextRebootText: 'Wed 03:30', lastRebootAt: '2026-10-20T07:32:00Z', lastRebootWhy: 'Tue 03:30, as scheduled' });
  assert.equal(patch.unset, undefined);

  write('{"nextRebootAt":"","nextRebootText":"","lastRebootAt":"","lastRebootWhy":""}');
  const none = send();
  assert.deepEqual(none.body.mutations[1].patch.unset, ['nextRebootAt', 'nextRebootText', 'lastRebootAt', 'lastRebootWhy']);
  assert.equal(none.body.mutations[1].patch.set, undefined);

  write('{"nextRebootAt":"tomorrow","nextRebootText":"x","lastRebootAt":"","lastRebootWhy":""}');
  const bad = send();
  assert.equal(bad.status, 1);
  assert.equal(bad.body, null);
  assert.doesNotMatch(bad.text, /skTESTONLY/);
});

check('the unit runs the script as the account every 5 minutes, and is not Persistent', () => {
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-reboot.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-reboot.timer'), 'utf8');
  assert.match(service, /^User=ACCOUNT$/m);
  assert.match(service, /^ExecStart=\/opt\/teletraan\/computer\/scripts\/scheduled-reboot\.sh$/m);
  assert.match(timer, /^OnUnitActiveSec=5min$/m);
  assert.match(timer, /^OnBootSec=15min$/m);
  assert.doesNotMatch(timer, /Persistent=true/);
});

check('the installer, the Mac tool and the helper know the reboot timer, and the sudoers file allows the reboot it uses', () => {
  const installer = fs.readFileSync(path.join(repo, 'computer/scripts/install-reboot.sh'), 'utf8');
  assert.match(installer, /teletraan-reboot\.timer/);
  assert.match(installer, /sudo apt install curl jq nodejs/);
  assert.match(fs.readFileSync(path.join(repo, 'tools/teletraan/teletraan-tool-deploy.sh'), 'utf8'), /nightly reboot cleanup; do/);
  assert.match(fs.readFileSync(path.join(repo, 'computer/scripts/control-helper.sh'), 'utf8'), /watchdog nightly reboot network; do/);
  assert.match(fs.readFileSync(path.join(repo, 'computer/sudoers/teletraan-control'), 'utf8'), /\/usr\/bin\/systemctl reboot/);
});

console.log('\n' + passed + ' of ' + passed + ' checks passed.');
