// Tests for computer/scripts/network-watchdog.sh: the checks, the ladder of repairs in order, the pauses, the cool-down,
// the reboot guards, the detection of the network manager, the status file and the state it keeps. curl, ip, ping, getent,
// nmcli, networkctl, ifup, ifdown, systemctl, sudo, flock and status-write.sh are fakes in a temporary folder that write
// down what they were asked, so nothing touches a real network or service.
//
//   node tests/network-watchdog.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-network-'));
const scriptFile = path.join(repo, 'computer/scripts/network-watchdog.sh');
const ordinaryTools = ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'awk', 'tr', 'mv', 'rm', 'cut', 'wc', 'mkdir', 'chmod', 'ls', 'sleep', 'jq', 'printf', 'cp'];

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function writeTool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

// Each fake writes its line to the log. The stub folder holds the answers: curl.code and curl.exit, ping.exit, getent.exit,
// route.txt, active-<unit> files for systemctl is-active, fail-<tool> files, and sudo.exit.
const logging = name => `#!/bin/sh\necho "${name} $*" >> "$STUB_LOG"\n[ -f "$STUB_DIR/fail-${name}" ] && exit 1\nexit 0\n`;
const fakes = {
  curl: `#!/bin/sh
echo "curl $*" >> "$STUB_LOG"
printf '%s' "$(cat "$STUB_DIR/curl.code")"
exit "$(cat "$STUB_DIR/curl.exit")"
`,
  ip: `#!/bin/sh
echo "ip $*" >> "$STUB_LOG"
cat "$STUB_DIR/route.txt"
`,
  ping: `#!/bin/sh
echo "ping $*" >> "$STUB_LOG"
exit "$(cat "$STUB_DIR/ping.exit")"
`,
  getent: `#!/bin/sh
echo "getent $*" >> "$STUB_LOG"
exit "$(cat "$STUB_DIR/getent.exit")"
`,
  timeout: '#!/bin/sh\nshift\nexec "$@"\n',
  flock: '#!/bin/sh\nexit 0\n',
  nmcli: logging('nmcli'),
  networkctl: logging('networkctl'),
  ifup: logging('ifup'),
  ifdown: logging('ifdown'),
  systemctl: `#!/bin/sh
echo "systemctl $*" >> "$STUB_LOG"
if [ "$1" = is-active ]; then
  [ -f "$STUB_DIR/active-$3" ]
  exit $?
fi
exit 0
`,
  sudo: `#!/bin/sh
echo "sudo $*" >> "$STUB_LOG"
case "$*" in *reboot*) cp "$STATE_FILE" "$STUB_DIR/state-at-reboot.txt" 2>/dev/null; cp "$REBOOT_STATE" "$STUB_DIR/reboot-state-at-reboot.txt" 2>/dev/null ;; esac
[ -f "$STUB_DIR/sudo.exit" ] && exit "$(cat "$STUB_DIR/sudo.exit")"
[ "$1" = -n ] && shift
exec "$@"
`,
};

let counter = 0;
const minute = 60;
const hour = 3600;
const base = 1760000000;

// options: manager (networkmanager | networkd | ifupdown | none), ethernetCarrier
function setup(options = {}) {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const sys = path.join(root, 'sys');
  [path.join(root, 'computer/scripts'), path.join(root, 'dashboard'), bin, stub, data, path.join(sys, 'wlp2s0'), path.join(sys, 'enp3s0f0'), path.join(sys, 'docker0')].forEach(folder => fs.mkdirSync(folder, { recursive: true }));
  fs.copyFileSync(scriptFile, path.join(root, 'computer/scripts/network-watchdog.sh'));
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  writeTool(path.join(root, 'computer/scripts'), 'status-write.sh', `#!/bin/sh\necho "status-write $*" >> "$STUB_LOG"\n[ -f "$STUB_DIR/fail-status" ] && exit 1\nexit 0\n`);
  fs.writeFileSync(path.join(root, 'dashboard/config.js'), "export const sanity = {\n  projectId: 'abc123',\n  dataset: 'production',\n  apiVersion: '2025-02-19',\n};\n");
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_DATA='" + data + "'\nSANITY_WRITE_TOKEN='skTESTtoken0123456789abcdef'\n");
  fs.writeFileSync(path.join(root, 'boot-id'), 'boot-one\n');
  ordinaryTools.forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  Object.keys(fakes).forEach(name => writeTool(bin, name, fakes[name]));
  fs.writeFileSync(path.join(sys, 'wlp2s0/carrier'), '1\n');
  fs.writeFileSync(path.join(sys, 'enp3s0f0/carrier'), options.ethernetCarrier ? '1\n' : '0\n');
  fs.writeFileSync(path.join(sys, 'docker0/carrier'), '1\n');
  fs.writeFileSync(path.join(stub, 'route.txt'), options.route || 'default via 10.0.137.1 dev wlp2s0 proto dhcp metric 600\n');
  fs.writeFileSync(path.join(stub, 'curl.code'), '200');
  fs.writeFileSync(path.join(stub, 'curl.exit'), '0');
  fs.writeFileSync(path.join(stub, 'ping.exit'), '0');
  fs.writeFileSync(path.join(stub, 'getent.exit'), '0');
  const manager = options.manager || 'networkmanager';
  if (manager === 'networkmanager') fs.writeFileSync(path.join(stub, 'active-NetworkManager.service'), '');
  if (manager === 'networkd') {
    fs.writeFileSync(path.join(stub, 'active-systemd-networkd.service'), '');
    fs.writeFileSync(path.join(stub, 'active-systemd-resolved.service'), '');
  }
  if (manager === 'ifupdown') fs.writeFileSync(path.join(root, 'interfaces'), 'auto wlp2s0\n');
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  const stateFile = path.join(data, 'network/state');
  const rebootState = path.join(data, 'reboot/state.json');

  const place = {
    root, data, stub, stateFile, rebootState, uptime: 3 * hour,
    down() { fs.writeFileSync(path.join(stub, 'curl.code'), '000'); fs.writeFileSync(path.join(stub, 'curl.exit'), '6'); },
    up() { fs.writeFileSync(path.join(stub, 'curl.code'), '200'); fs.writeFileSync(path.join(stub, 'curl.exit'), '0'); },
    set(name, text) { fs.writeFileSync(path.join(stub, name), text); },
    state(name) {
      const found = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8').split('\n').filter(line => line.startsWith(name + '=')) : [];
      return found.length ? found[found.length - 1].slice(name.length + 1) : null;
    },
    status() { return JSON.parse(fs.readFileSync(path.join(data, 'network/status.json'), 'utf8')); },
    history() { return fs.existsSync(path.join(data, 'network/history')) ? fs.readFileSync(path.join(data, 'network/history'), 'utf8') : ''; },
    // One run at the given seconds after the start of the test
    run(at, extra = {}) {
      const before = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).length;
      const env = Object.assign({
        PATH: bin, TZ: 'UTC', STUB_LOG: log, STUB_DIR: stub, STATE_FILE: stateFile, REBOOT_STATE: rebootState,
        NETWORK_NOW: String(base + at), NETWORK_UPTIME: String(place.uptime + at), NETWORK_SETTLE: '0', NETWORK_BOOT_FILE: path.join(root, 'boot-id'),
        NETWORK_SYS: sys, NETWORK_INTERFACES_FILE: path.join(root, 'interfaces'),
        TELETRAAN_SYSTEMCTL: path.join(bin, 'systemctl'), TELETRAAN_NMCLI: path.join(bin, 'nmcli'), TELETRAAN_NETWORKCTL: path.join(bin, 'networkctl'),
        TELETRAAN_IFUP: path.join(bin, 'ifup'), TELETRAAN_IFDOWN: path.join(bin, 'ifdown'),
      }, extra);
      const result = spawnSync('/bin/bash', [path.join(root, 'computer/scripts/network-watchdog.sh')], { env, encoding: 'utf8', input: '' });
      const calls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).slice(before);
      const short = line => line.replace(new RegExp(bin + '/', 'g'), '');
      return {
        status: result.status, text: result.stdout, errors: result.stderr, calls,
        sudo: calls.filter(line => line.startsWith('sudo -n ')).map(line => short(line.slice(8))),
        told: calls.filter(line => line.startsWith('status-write')),
      };
    },
  };
  return place;
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

// Runs every 2 minutes from `from` to `to` seconds and gives all the sudo calls in order, with their time
function every(place, from, to, step = 2 * minute) {
  const out = [];
  for (let at = from; at <= to; at += step) place.run(at).sudo.forEach(call => out.push({ at, call }));
  return out;
}

test('a working network does nothing, writes its state and a status file, and tells Studio once an hour', () => {
  const place = setup();
  const first = place.run(0);
  assert.equal(first.status, 0, first.errors);
  assert.deepEqual(first.sudo, []);
  assert.equal(place.state('fails'), '0');
  assert.equal(place.state('sanity'), 'ok');
  assert.equal(place.state('manager'), 'networkmanager');
  assert.equal(place.status().networkDownSince, '');
  assert.equal(place.status().networkRecoveries, 0);
  assert.deepEqual(first.told, ['status-write network']);
  assert.deepEqual(place.run(2 * minute).told, [], 'nothing changed, so nothing is sent');
  assert.deepEqual(place.run(hour + 2 * minute).told, ['status-write network'], 'a sign of life every hour');
  const curl = first.calls.find(line => line.startsWith('curl'));
  assert.ok(curl.includes('--max-time 10') && curl.includes('https://abc123.api.sanity.io/v2025-02-19/data/query/production'), curl);
  assert.ok(first.calls.some(line => line === 'getent hosts abc123.api.sanity.io') && first.calls.some(line => line.startsWith('ping -c 1 -W 2 10.0.137.1')));
});

test('one or two failed checks do nothing, the third starts the ladder with step 1', () => {
  const place = setup();
  place.down();
  assert.deepEqual(place.run(0).sudo, []);
  assert.deepEqual(place.run(2 * minute).sudo, []);
  const third = place.run(4 * minute);
  assert.deepEqual(third.sudo, ['nmcli device reapply wlp2s0']);
  assert.ok(third.text.includes('networkmanager') && third.text.includes('Step 1 of 5'), third.text);
  assert.equal(place.state('downSince'), String(base));
  assert.match(place.history(), /1-dhcp done, still down/);
  assert.equal(place.status().networkLastStep, '1 dhcp');
  assert.ok(place.status().networkDownSince.startsWith('2025-'));
});

test('the whole ladder in order with NetworkManager: reapply, reconnect, restart the service, restart the screen, one reboot', () => {
  const place = setup();
  place.down();
  const calls = every(place, 0, 45 * minute);
  assert.deepEqual(calls.map(item => item.call), [
    'nmcli device reapply wlp2s0',
    'nmcli device disconnect wlp2s0', 'nmcli device connect wlp2s0',
    'systemctl restart NetworkManager.service',
    'systemctl restart teletraan-kiosk.service',
    'systemctl reboot',
  ]);
  const steps = [calls[0].at, calls[1].at, calls[3].at, calls[4].at, calls[5].at];
  for (let index = 1; index < steps.length; index += 1) assert.ok(steps[index] - steps[index - 1] >= 3 * minute, 'pause before step ' + (index + 1));
  assert.ok(calls[5].at >= 30 * minute, 'the reboot is not before 30 minutes');
});

test('the state is written before the reboot is asked for, and the scheduled reboot learns of it', () => {
  const place = setup();
  place.down();
  every(place, 0, 45 * minute);
  const written = fs.readFileSync(path.join(place.stub, 'state-at-reboot.txt'), 'utf8');
  assert.match(written, /\nlast5=\d+\n/, 'last5 was already in the state file when sudo reboot ran');
  const reboot = JSON.parse(fs.readFileSync(path.join(place.stub, 'reboot-state-at-reboot.txt'), 'utf8'));
  assert.ok(reboot.lastRebootAt > 0 && reboot.lastWhy === 'network down');
});

test('a long outage never loops: each of steps 1 to 4 once, the reboot at most once in 6 hours', () => {
  const place = setup();
  place.down();
  const calls = every(place, 0, 14 * hour, 10 * minute);
  const count = text => calls.filter(item => item.call === text).length;
  assert.equal(count('nmcli device reapply wlp2s0'), 1);
  assert.equal(count('nmcli device disconnect wlp2s0'), 1);
  assert.equal(count('systemctl restart NetworkManager.service'), 1);
  assert.equal(count('systemctl restart teletraan-kiosk.service'), 1);
  const reboots = calls.filter(item => item.call === 'systemctl reboot').map(item => item.at);
  assert.ok(reboots.length >= 2 && reboots.length <= 3, 'reboots: ' + reboots.length);
  for (let index = 1; index < reboots.length; index += 1) assert.ok(reboots[index] - reboots[index - 1] >= 6 * hour, 'a gap of 6 hours');
  assert.ok(calls.length <= 5 + 3, 'at most ' + calls.length + ' commands in 14 hours');
});

test('no reboot within 10 minutes of boot, or within 6 hours of a reboot the scheduled job made', () => {
  const young = setup();
  young.down();
  young.uptime = 8 * minute;
  // Down for a long time already, as after a reboot that did not help
  fs.mkdirSync(path.join(young.data, 'network'), { recursive: true });
  fs.writeFileSync(young.stateFile, 'boot=boot-one\nfails=5\nfirstFail=' + (base - 2 * hour) + '\ndownSince=' + (base - 2 * hour) + '\nstep=4\nstepAt=' + (base - hour) + '\nlast4=' + (base - hour) + '\n');
  const early = young.run(0);
  assert.ok(!early.sudo.includes('systemctl reboot'), early.text);
  assert.ok(early.text.includes('less than 10 minutes ago'), early.text);

  const recent = setup();
  recent.down();
  fs.mkdirSync(path.join(recent.data, 'reboot'), { recursive: true });
  fs.writeFileSync(recent.rebootState, JSON.stringify({ lastRebootAt: (base + 20 * minute - 2 * hour) * 1000, lastWhy: 'Tue 03:30, as scheduled' }));
  const calls = every(recent, 0, 50 * minute);
  assert.ok(!calls.some(item => item.call === 'systemctl reboot'), 'the scheduled reboot 2 hours ago blocks it');
  assert.ok(calls.some(item => item.call === 'systemctl restart teletraan-kiosk.service'), 'the other steps still ran');
});

test('nothing is done in the first 5 minutes after boot', () => {
  const place = setup();
  place.down();
  place.uptime = 0;
  const calls = every(place, 0, 4 * minute);
  assert.deepEqual(calls, []);
});

test('a recovery clears the outage, counts it, and tells Studio at once', () => {
  const place = setup();
  place.down();
  every(place, 0, 12 * minute);
  place.up();
  const back = place.run(14 * minute);
  assert.ok(back.text.includes('the network is back after'), back.text);
  assert.equal(place.state('fails'), '0');
  assert.equal(place.state('downSince'), '0');
  assert.equal(place.state('step'), '0');
  assert.equal(place.status().networkRecoveries, 1);
  assert.equal(place.status().networkDownSince, '');
  assert.ok(place.status().networkLastProblemAt.startsWith('2025-'));
  assert.ok(place.status().networkLastStep.length > 0, 'the step that was last tried stays');
  assert.deepEqual(back.told, ['status-write network']);
  assert.match(place.history(), /back after \d+ minutes/);
});

test('a failed send to Studio is tried again at the next run', () => {
  const place = setup();
  place.set('fail-status', '1');
  assert.equal(place.run(0).told.length, 1);
  assert.equal(place.run(2 * minute).told.length, 1, 'the first one failed, so it is sent again');
  fs.rmSync(path.join(place.stub, 'fail-status'));
  assert.equal(place.run(4 * minute).told.length, 1);
  assert.equal(place.run(6 * minute).told.length, 0);
});

test('recoveries are counted over the last 24 hours only', () => {
  const place = setup();
  for (let round = 0; round < 3; round += 1) {
    const start = round * 5 * hour;
    place.down();
    every(place, start, start + 8 * minute);
    place.up();
    place.run(start + 10 * minute);
  }
  assert.equal(place.status().networkRecoveries, 3);
  place.run(40 * hour);
  assert.equal(place.status().networkRecoveries, 0);
});

test('a fault in the certificate with a working gateway and lookup is a wrong clock, not a broken network', () => {
  const place = setup();
  place.set('curl.code', '000');
  place.set('curl.exit', '60');
  const calls = every(place, 0, 20 * minute);
  assert.deepEqual(calls, []);
  assert.equal(place.state('downSince'), '0');
  place.set('ping.exit', '1');
  assert.equal(every(place, 22 * minute, 30 * minute).length > 0, true, 'with the gateway gone it is a network fault');
});

test('systemd-networkd is found and gets networkctl renew, reconfigure, and a restart of networkd and resolved', () => {
  const place = setup({ manager: 'networkd' });
  place.down();
  const calls = every(place, 0, 20 * minute).map(item => item.call);
  assert.deepEqual(calls, ['networkctl renew wlp2s0', 'networkctl reconfigure wlp2s0', 'systemctl restart systemd-networkd.service', 'systemctl restart systemd-resolved.service', 'systemctl restart teletraan-kiosk.service']);
  assert.equal(place.state('manager'), 'networkd');
});

test('ifupdown is found and gets ifup --force, ifdown then ifup, and a restart of networking', () => {
  const place = setup({ manager: 'ifupdown' });
  place.down();
  const calls = every(place, 0, 20 * minute).map(item => item.call);
  assert.deepEqual(calls, ['ifup --force wlp2s0', 'ifdown wlp2s0', 'ifup wlp2s0', 'systemctl restart networking.service', 'systemctl restart teletraan-kiosk.service']);
  assert.equal(place.state('manager'), 'ifupdown');
});

test('with no known manager the first three steps are skipped and logged, and the screen restart still happens', () => {
  const place = setup({ manager: 'none' });
  place.down();
  place.run(0);
  place.run(2 * minute);
  const first = place.run(4 * minute);
  assert.ok(first.text.includes('skipped, no known network manager'), first.text);
  const calls = every(place, 6 * minute, 20 * minute).map(item => item.call);
  assert.deepEqual(calls, ['systemctl restart teletraan-kiosk.service']);
});

test('an Ethernet port with a cable is preferred, and docker, tailscale and bridge devices are never acted on', () => {
  const cable = setup({ ethernetCarrier: true });
  cable.down();
  assert.deepEqual(every(cable, 0, 4 * minute), [{ at: 4 * minute, call: 'nmcli device reapply enp3s0f0' }]);
  assert.equal(cable.state('interface'), 'enp3s0f0');

  const wifi = setup();
  wifi.down();
  assert.deepEqual(every(wifi, 0, 4 * minute).map(item => item.call), ['nmcli device reapply wlp2s0']);

  const docker = setup({ route: 'default via 172.17.0.1 dev docker0\n' });
  fs.rmSync(path.join(docker.root, 'sys/wlp2s0'), { recursive: true });
  docker.down();
  docker.run(0);
  docker.run(2 * minute);
  const none = docker.run(4 * minute);
  assert.deepEqual(none.sudo, []);
  assert.ok(none.text.includes('skipped, no interface found'), none.text);
});

test('a step the sudoers file refuses is logged, counted as taken, and not repeated in a loop', () => {
  const place = setup();
  place.down();
  place.set('sudo.exit', '1');
  const calls = every(place, 0, 30 * minute);
  assert.equal(calls.filter(item => item.call.startsWith('nmcli device reapply')).length, 1);
  assert.match(place.history(), /failed \(code 1\), check that the sudoers files are installed/);
});

test('a second outage soon after the first does not start the ladder again from the top (30 minute cool-down per step)', () => {
  const place = setup();
  place.down();
  every(place, 0, 18 * minute);
  place.up();
  place.run(20 * minute);
  place.down();
  const calls = every(place, 24 * minute, 40 * minute);
  assert.deepEqual(calls, [], 'steps 1 to 4 ran less than 30 minutes ago, so they are skipped');
});

test('a new boot starts a new streak and the ladder, but the outage and the times of the steps are kept', () => {
  const place = setup();
  place.down();
  every(place, 0, 12 * minute);
  assert.equal(place.state('step'), '3');
  fs.writeFileSync(path.join(place.root, 'boot-id'), 'boot-two\n');
  place.uptime = 20 * minute;
  place.run(14 * minute);
  assert.equal(place.state('fails'), '1');
  assert.equal(place.state('step'), '0');
  assert.equal(place.state('downSince'), String(base));
  assert.notEqual(place.state('last1'), '0');
});

test('a run that finds the last one still going stops, and the state file is written by temporary file', () => {
  const text = fs.readFileSync(scriptFile, 'utf8');
  assert.ok(text.includes('flock -n 9') && text.includes('mv -f "$temporary" "$state"'));
  const place = setup();
  place.run(0);
  assert.ok(!fs.readdirSync(path.join(place.data, 'network')).some(name => name.includes('.tmp.')), 'no temporary file is left');
});

test('it needs no call to Sanity for a decision other than the one HTTPS check, and holds no key', () => {
  const text = fs.readFileSync(scriptFile, 'utf8');
  assert.equal((text.match(/curl --disable/g) || []).length, 1, 'one curl');
  assert.ok(!/SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|Authorization/.test(text), 'no key is read here');
  assert.ok(!/[–—]/.test(text), 'no em or en dash');
  assert.ok(text.includes('TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl') && text.includes('/usr/bin/nmcli') && text.includes('/usr/bin/networkctl'));
});

let failures = 0;
for (const item of tests) {
  try {
    item.run();
    console.log('ok    ' + item.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + item.name + '\n      ' + (error && error.stack ? error.stack : error));
  }
}
fs.rmSync(work, { recursive: true, force: true });
console.log((tests.length - failures) + ' of ' + tests.length + ' checks passed.');
process.exit(failures ? 1 : 0);
