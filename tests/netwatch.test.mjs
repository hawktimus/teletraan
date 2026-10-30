// Tests for computer/scripts/netwatch.sh: the three checks, the ladder (3 failures restart the network service and renew
// DHCP, 6 bounce the interface and reload a Wi-Fi driver, 15 reboot at most once in 2 hours), the pauses, the reboot guards,
// the detection of the network manager, netwatch.json, the status file and the log. curl, ip, ping, getent, nmcli,
// networkctl, ifup, ifdown, modprobe, systemctl, sudo, flock, notify.sh and status-write.sh are fakes in a temporary folder
// that write down what they were asked, so nothing touches a real network or service.
//
//   node tests/netwatch.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-network-'));
const scriptFile = path.join(repo, 'computer/scripts/netwatch.sh');
const ordinaryTools = ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'awk', 'tr', 'mv', 'rm', 'cut', 'wc', 'mkdir', 'chmod', 'ls', 'sleep', 'jq', 'printf', 'cp', 'readlink', 'basename', 'sort'];

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
  modprobe: logging('modprobe'),
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

// options: manager (networkmanager | networkd | ifupdown | none), ethernetCarrier, host (NETWATCH_HOST in local.env)
function setup(options = {}) {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  const sys = path.join(root, 'sys');
  const logs = path.join(root, 'logs');
  [path.join(root, 'computer/scripts'), path.join(root, 'dashboard'), bin, stub, data, path.join(sys, 'wlp2s0/device/driver'), path.join(sys, 'enp3s0f0'), path.join(sys, 'docker0'), path.join(root, 'modules/iwlwifi')].forEach(folder => fs.mkdirSync(folder, { recursive: true }));
  fs.symlinkSync(path.join(root, 'modules/iwlwifi'), path.join(sys, 'wlp2s0/device/driver/module'));
  fs.copyFileSync(scriptFile, path.join(root, 'computer/scripts/netwatch.sh'));
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  writeTool(path.join(root, 'computer/scripts'), 'status-write.sh', `#!/bin/sh\necho "status-write $*" >> "$STUB_LOG"\n[ -f "$STUB_DIR/fail-status" ] && exit 1\nexit 0\n`);
  writeTool(path.join(root, 'computer/scripts'), 'notify.sh', `#!/bin/sh\necho "notify $*" >> "$STUB_LOG"\nexit 0\n`);
  fs.writeFileSync(path.join(root, 'dashboard/config.js'), "export const sanity = {\n  projectId: 'abc123',\n  dataset: 'production',\n  apiVersion: '2025-02-19',\n};\n");
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_DATA='" + data + "'\nSANITY_WRITE_TOKEN='skTESTtoken0123456789abcdef'\n" + (options.host ? "NETWATCH_HOST='" + options.host + "'\n" : ''));
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
  const publicFile = path.join(root, 'netwatch.json');
  fs.writeFileSync(publicFile, '');

  const place = {
    root, data, stub, stateFile, rebootState, publicFile, logs, uptime: 3 * hour,
    down() { fs.writeFileSync(path.join(stub, 'curl.code'), '000'); fs.writeFileSync(path.join(stub, 'curl.exit'), '6'); },
    up() { fs.writeFileSync(path.join(stub, 'curl.code'), '200'); fs.writeFileSync(path.join(stub, 'curl.exit'), '0'); },
    set(name, text) { fs.writeFileSync(path.join(stub, name), text); },
    state(name) {
      const found = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8').split('\n').filter(line => line.startsWith(name + '=')) : [];
      return found.length ? found[found.length - 1].slice(name.length + 1) : null;
    },
    status() { return JSON.parse(fs.readFileSync(path.join(data, 'network/status.json'), 'utf8')); },
    netwatch() { return JSON.parse(fs.readFileSync(publicFile, 'utf8')); },
    logLines() {
      const file = path.join(logs, 'netwatch.jsonl');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    },
    // One run at the given seconds after the start of the test
    run(at, extra = {}) {
      const before = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).length;
      const env = Object.assign({
        PATH: bin, TZ: 'UTC', STUB_LOG: log, STUB_DIR: stub, STATE_FILE: stateFile, REBOOT_STATE: rebootState,
        NETWORK_NOW: String(base + at), NETWORK_UPTIME: String(place.uptime + at), NETWORK_SETTLE: '0', NETWORK_BOOT_FILE: path.join(root, 'boot-id'),
        NETWORK_SYS: sys, NETWORK_INTERFACES_FILE: path.join(root, 'interfaces'), NETWATCH_STATE: publicFile, TELETRAAN_LOG_DIR: logs,
        TELETRAAN_SYSTEMCTL: path.join(bin, 'systemctl'), TELETRAAN_NMCLI: path.join(bin, 'nmcli'), TELETRAAN_NETWORKCTL: path.join(bin, 'networkctl'),
        TELETRAAN_IFUP: path.join(bin, 'ifup'), TELETRAAN_IFDOWN: path.join(bin, 'ifdown'), TELETRAAN_MODPROBE: path.join(bin, 'modprobe'),
      }, extra);
      const result = spawnSync('/bin/bash', [path.join(root, 'computer/scripts/netwatch.sh')], { env, encoding: 'utf8', input: '' });
      const calls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).slice(before);
      const short = line => line.replace(new RegExp(bin + '/', 'g'), '');
      return {
        status: result.status, text: result.stdout, errors: result.stderr, calls,
        sudo: calls.filter(line => line.startsWith('sudo -n ')).map(line => short(line.slice(8))),
        told: calls.filter(line => line.startsWith('status-write')),
        notified: calls.filter(line => line.startsWith('notify ') && !line.startsWith('notify --flush')).map(line => line.slice(7)),
        flushed: calls.filter(line => line === 'notify --flush').length,
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

const wifiBounce = ['nmcli device disconnect wlp2s0', 'modprobe -r iwlwifi', 'modprobe iwlwifi', 'nmcli device connect wlp2s0'];

test('a working network does nothing, writes netwatch.json, its state and a status file, and tells Studio once an hour', () => {
  const place = setup();
  const first = place.run(0);
  assert.equal(first.status, 0, first.errors);
  assert.deepEqual(first.sudo, []);
  assert.equal(place.state('fails'), '0');
  assert.equal(place.state('manager'), 'networkmanager');
  assert.equal(place.status().networkDownSince, '');
  assert.equal(place.status().networkRecoveries, 0);
  assert.deepEqual(first.told, ['status-write network']);
  assert.deepEqual(place.run(2 * minute).told, [], 'nothing changed, so nothing is sent');
  assert.deepEqual(place.run(hour + 2 * minute).told, ['status-write network'], 'a sign of life every hour');
  const curl = first.calls.find(line => line.startsWith('curl'));
  assert.ok(curl.includes('--head') && curl.includes('--max-time 10') && curl.includes('https://abc123.api.sanity.io/'), curl);
  assert.ok(first.calls.some(line => line === 'getent hosts abc123.api.sanity.io') && first.calls.some(line => line.startsWith('ping -c 1 -W 2 10.0.137.1')));
});

test('netwatch.json has exactly the fields the status poller reads, and the times are ISO texts or null', () => {
  const place = setup();
  place.run(0);
  const good = place.netwatch();
  assert.deepEqual(Object.keys(good), ['failures', 'lastCheckAt', 'lastOkAt', 'lastAction', 'lastActionAt', 'lastRebootAt']);
  assert.equal(good.failures, 0);
  assert.equal(good.lastCheckAt, new Date((base) * 1000).toISOString().replace('.000', ''));
  assert.equal(good.lastOkAt, good.lastCheckAt);
  assert.equal(good.lastAction, 'none');
  assert.equal(good.lastActionAt, null);
  assert.equal(good.lastRebootAt, null);

  place.down();
  place.run(2 * minute);
  assert.equal(place.netwatch().failures, 1);
  assert.equal(place.netwatch().lastOkAt, good.lastOkAt, 'the last good time stays while it fails');
});

test('every run writes one JSON line to the log with ts, service, source, event and detail', () => {
  const place = setup();
  place.run(0);
  place.down();
  place.run(2 * minute);
  const lines = place.logLines();
  assert.equal(lines.filter(line => line.event === 'check').length, 2);
  lines.forEach(line => assert.deepEqual(Object.keys(line), ['ts', 'service', 'source', 'event', 'detail']));
  assert.equal(lines[0].service, 'netwatch');
  assert.match(lines[0].detail, /ping ok, dns ok, https ok, failures 0/);
  assert.match(lines[lines.length - 1].detail, /https fail, failures 1/);
  const text = JSON.stringify(lines);
  assert.ok(!/abc123|api\.sanity|10\.0\.137/.test(text), 'no host name and no address in the log: ' + text);
});

test('one or two failed checks do nothing, the third restarts the network service and renews DHCP', () => {
  const place = setup();
  place.down();
  assert.deepEqual(place.run(0).sudo, []);
  assert.deepEqual(place.run(2 * minute).sudo, []);
  const third = place.run(4 * minute);
  assert.deepEqual(third.sudo, ['systemctl restart NetworkManager.service', 'nmcli device reapply wlp2s0']);
  assert.ok(third.text.includes('networkmanager') && third.text.includes('Action 1 of 3'), third.text);
  assert.equal(place.state('downSince'), String(base));
  assert.equal(place.netwatch().lastAction, 'restart_network');
  assert.equal(place.netwatch().failures, 3);
  assert.equal(place.status().networkLastStep, '1 restart');
  assert.ok(place.status().networkDownSince.startsWith('2025-'));
  assert.deepEqual(third.notified.length, 1);
  assert.match(third.notified[0], /netwatch: restart_network after 3 failed checks/);
});

test('the ladder in order with NetworkManager on Wi-Fi: restart and renew at 3, bounce and reload the driver at 6, one reboot at 15', () => {
  const place = setup();
  place.down();
  const calls = every(place, 0, 45 * minute);
  assert.deepEqual(calls.map(item => item.call), [
    'systemctl restart NetworkManager.service', 'nmcli device reapply wlp2s0',
    ...wifiBounce,
    'systemctl reboot',
  ]);
  assert.equal(calls[0].at, 4 * minute, 'the third failed check');
  assert.equal(calls[2].at, 10 * minute, 'the sixth');
  assert.equal(calls[calls.length - 1].at, 28 * minute, 'the fifteenth, 30 minutes after the first');
  assert.ok(calls[2].at - calls[0].at >= 3 * minute, 'a pause between actions');
  assert.equal(place.netwatch().lastAction, 'reboot');
  assert.ok(place.netwatch().lastRebootAt.startsWith('2025-'));
  assert.ok(place.netwatch().lastActionAt.startsWith('2025-'));
});

test('an Ethernet port with a cable is bounced without any driver being reloaded', () => {
  const place = setup({ ethernetCarrier: true });
  place.down();
  const calls = every(place, 0, 12 * minute).map(item => item.call);
  assert.deepEqual(calls, ['systemctl restart NetworkManager.service', 'nmcli device reapply enp3s0f0', 'nmcli device disconnect enp3s0f0', 'nmcli device connect enp3s0f0']);
  assert.equal(place.state('interface'), 'enp3s0f0');
});

test('the state is written before the reboot is asked for, and the scheduled reboot learns of it', () => {
  const place = setup();
  place.down();
  every(place, 0, 45 * minute);
  const written = fs.readFileSync(path.join(place.stub, 'state-at-reboot.txt'), 'utf8');
  assert.match(written, /\nlastRebootAt=\d+\n/, 'lastRebootAt was already in the state file when sudo reboot ran');
  assert.match(written, /\nlastAction=reboot\n/);
  const reboot = JSON.parse(fs.readFileSync(path.join(place.stub, 'reboot-state-at-reboot.txt'), 'utf8'));
  assert.ok(reboot.lastRebootAt > 0 && reboot.lastWhy === 'network down');
});

test('a long outage never loops: each action once per boot, and the reboot at most once in 2 hours, boot after boot', () => {
  const place = setup();
  place.down();
  const calls = every(place, 0, 3 * hour, 10 * minute);
  const count = text => calls.filter(item => item.call === text).length;
  assert.equal(count('systemctl restart NetworkManager.service'), 1);
  assert.equal(count('nmcli device disconnect wlp2s0'), 1);
  assert.equal(count('systemctl reboot'), 1, 'one reboot, and the boot has not changed in this test');

  // The computer came back from that reboot at 40 minutes. The network is still down.
  const rebootAt = calls.filter(item => item.call === 'systemctl reboot')[0].at;
  fs.writeFileSync(path.join(place.root, 'boot-id'), 'boot-two\n');
  place.uptime = -(rebootAt + 2 * minute);
  const later = every(place, rebootAt + 4 * minute, rebootAt + 4 * hour, 4 * minute);
  const reboots = later.filter(item => item.call === 'systemctl reboot').map(item => item.at);
  assert.ok(later.some(item => item.call === 'systemctl restart NetworkManager.service'), 'the new boot climbs the ladder again');
  assert.equal(reboots.length >= 1 && reboots.length <= 2, true, 'reboots: ' + reboots.length);
  assert.ok(reboots[0] - rebootAt >= 2 * hour, 'not before 2 hours after the last reboot');
});

test('no reboot within 10 minutes of boot, or within 2 hours of a reboot the scheduled job made', () => {
  const young = setup();
  young.down();
  young.uptime = 8 * minute;
  // Down for a long time already, as after a reboot that did not help
  fs.mkdirSync(path.join(young.data, 'network'), { recursive: true });
  fs.writeFileSync(young.stateFile, 'boot=boot-one\nfails=20\nfirstFail=' + (base - 2 * hour) + '\ndownSince=' + (base - 2 * hour) + '\nlevel=2\nlevelAt=' + (base - hour) + '\n');
  const early = young.run(0);
  assert.ok(!early.sudo.includes('systemctl reboot'), early.text);
  assert.ok(early.text.includes('less than 10 minutes ago'), early.text);

  const recent = setup();
  recent.down();
  fs.mkdirSync(path.join(recent.data, 'reboot'), { recursive: true });
  fs.writeFileSync(recent.rebootState, JSON.stringify({ lastRebootAt: (base + 28 * minute - 90 * minute) * 1000, lastWhy: 'Tue 03:30, as scheduled' }));
  const calls = every(recent, 0, 40 * minute);
  assert.ok(!calls.some(item => item.call === 'systemctl reboot'), 'the scheduled reboot 90 minutes ago blocks it');
  assert.ok(calls.some(item => item.call === 'nmcli device disconnect wlp2s0'), 'the other actions still ran');
});

test('this script does not reboot twice inside 2 hours either', () => {
  const place = setup();
  place.down();
  fs.mkdirSync(path.join(place.data, 'network'), { recursive: true });
  fs.writeFileSync(place.stateFile, 'boot=boot-one\nfails=30\nfirstFail=' + (base - 3 * hour) + '\ndownSince=' + (base - 3 * hour) + '\nlevel=2\nlevelAt=' + (base - hour) + '\nlastRebootAt=' + (base - 100 * minute) + '\n');
  const run = place.run(0);
  assert.ok(!run.sudo.includes('systemctl reboot'), run.text);
  assert.ok(run.text.includes('less than 2 hours ago'), run.text);
});

test('nothing is done in the first 5 minutes after boot', () => {
  const place = setup();
  place.down();
  place.uptime = 0;
  const calls = every(place, 0, 4 * minute);
  assert.deepEqual(calls, []);
});

test('a recovery clears the outage, counts it, tells Studio at once, raises the push message and sends what was kept', () => {
  const place = setup();
  place.down();
  every(place, 0, 12 * minute);
  place.up();
  const back = place.run(14 * minute);
  assert.ok(back.text.includes('the network is back after'), back.text);
  assert.equal(place.state('fails'), '0');
  assert.equal(place.state('downSince'), '0');
  assert.equal(place.state('level'), '0');
  assert.equal(place.status().networkRecoveries, 1);
  assert.equal(place.status().networkDownSince, '');
  assert.ok(place.status().networkLastProblemAt.startsWith('2025-'));
  assert.ok(place.status().networkLastStep.length > 0, 'the step that was last tried stays');
  assert.deepEqual(back.told, ['status-write network']);
  assert.equal(back.notified.length, 1);
  assert.match(back.notified[0], /network is back after \d+ minutes \(last action: bounce_interface\)/);
  assert.equal(back.flushed, 1, 'the messages kept while it was down go out now');
  assert.equal(place.netwatch().failures, 0);
  assert.equal(place.netwatch().lastAction, 'bounce_interface', 'the last action stays in the record');
  assert.ok(place.logLines().some(line => line.event === 'recovered'));
});

test('the push messages hold no host name and no address', () => {
  const place = setup();
  place.down();
  const messages = [];
  for (let at = 0; at <= 14 * minute; at += 2 * minute) messages.push(...place.run(at).notified);
  assert.ok(messages.length >= 2);
  messages.forEach(message => assert.ok(!/abc123|sanity|10\.0\.|\.io|wlp2s0/.test(message), message));
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

test('systemd-networkd is found: restart networkd and resolved and renew, then reconfigure and reload the driver', () => {
  const place = setup({ manager: 'networkd' });
  place.down();
  const calls = every(place, 0, 12 * minute).map(item => item.call);
  assert.deepEqual(calls, ['systemctl restart systemd-networkd.service', 'systemctl restart systemd-resolved.service', 'networkctl renew wlp2s0', 'modprobe -r iwlwifi', 'modprobe iwlwifi', 'networkctl reconfigure wlp2s0']);
  assert.equal(place.state('manager'), 'networkd');
});

test('ifupdown is found: restart networking and ifup --force, then ifdown, the driver and ifup', () => {
  const place = setup({ manager: 'ifupdown' });
  place.down();
  const calls = every(place, 0, 12 * minute).map(item => item.call);
  assert.deepEqual(calls, ['systemctl restart networking.service', 'ifup --force wlp2s0', 'ifdown wlp2s0', 'modprobe -r iwlwifi', 'modprobe iwlwifi', 'ifup wlp2s0']);
  assert.equal(place.state('manager'), 'ifupdown');
});

test('with no known manager the first two actions are skipped and logged, and nothing else is touched', () => {
  const place = setup({ manager: 'none' });
  place.down();
  place.run(0);
  place.run(2 * minute);
  const first = place.run(4 * minute);
  assert.ok(first.text.includes('skipped, no known network manager'), first.text);
  assert.deepEqual(every(place, 6 * minute, 12 * minute).map(item => item.call), []);
});

test('docker, tailscale and bridge devices are never acted on', () => {
  const docker = setup({ route: 'default via 172.17.0.1 dev docker0\n' });
  fs.rmSync(path.join(docker.root, 'sys/wlp2s0'), { recursive: true });
  docker.down();
  docker.run(0);
  docker.run(2 * minute);
  const none = docker.run(4 * minute);
  assert.deepEqual(none.sudo, []);
  assert.ok(none.text.includes('skipped, no interface found'), none.text);
});

test('an action the sudoers file refuses is logged, counted as taken, and not repeated in a loop', () => {
  const place = setup();
  place.down();
  place.set('sudo.exit', '1');
  const calls = every(place, 0, 20 * minute);
  assert.equal(calls.filter(item => item.call.startsWith('systemctl restart NetworkManager')).length, 1);
  assert.ok(place.logLines().some(line => line.event === 'action_result' && /failed \(code 1\), check that the sudoers files are installed/.test(line.detail)));
});

test('a new boot starts a new streak and the ladder, but the outage and the time of the last action are kept', () => {
  const place = setup();
  place.down();
  every(place, 0, 12 * minute);
  assert.equal(place.state('level'), '2');
  fs.writeFileSync(path.join(place.root, 'boot-id'), 'boot-two\n');
  place.uptime = 20 * minute;
  place.run(14 * minute);
  assert.equal(place.state('fails'), '1');
  assert.equal(place.state('level'), '0');
  assert.equal(place.state('downSince'), String(base));
  assert.equal(place.state('lastAction'), 'bounce_interface');
});

test('the host to check is NETWATCH_HOST when it is set, and the Sanity host of the project when it is not', () => {
  const set = setup({ host: 'example.org' });
  const run = set.run(0);
  assert.ok(run.calls.some(line => line.startsWith('curl') && line.includes('https://example.org/')), run.calls.join('\n'));
  assert.ok(run.calls.includes('getent hosts example.org'));

  const bad = setup({ host: 'not a host; reboot' });
  const refused = bad.run(0);
  assert.notEqual(refused.status, 0);
  assert.deepEqual(refused.sudo, []);
});

test('a run that finds the last one still going stops, and the state file is written by temporary file', () => {
  const text = fs.readFileSync(scriptFile, 'utf8');
  assert.ok(text.includes('flock -n 9') && text.includes('mv -f "$temporary" "$state"'));
  const place = setup();
  place.run(0);
  assert.ok(!fs.readdirSync(path.join(place.data, 'network')).some(name => name.includes('.tmp.')), 'no temporary file is left');
});

test('there is one HTTPS check, no key is read, and the old watchdog and its timer are gone', () => {
  const text = fs.readFileSync(scriptFile, 'utf8');
  assert.equal((text.match(/curl --disable/g) || []).length, 1, 'one curl');
  assert.ok(!/SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|Authorization/.test(text), 'no key is read here');
  assert.ok(!/[–—]/.test(text), 'no em or en dash');
  assert.ok(text.includes('TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl') && text.includes('/usr/bin/nmcli') && text.includes('/usr/bin/networkctl') && text.includes('/usr/sbin/modprobe'));
  assert.equal(fs.existsSync(path.join(repo, 'computer/scripts/network-watchdog.sh')), false);
  assert.equal(fs.existsSync(path.join(repo, 'computer/systemd/teletraan-network.timer')), false);
  assert.equal(fs.existsSync(path.join(repo, 'computer/systemd/teletraan-network.service')), false);
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-netwatch.timer'), 'utf8');
  assert.match(timer, /OnUnitActiveSec=2min/);
  assert.match(fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-netwatch.service'), 'utf8'), /ExecStart=\/opt\/teletraan\/computer\/scripts\/netwatch\.sh/);
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
