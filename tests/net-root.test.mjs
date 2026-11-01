// Tests for computer/scripts/net-root.sh, the root tool behind the Wi-Fi page: it takes five words, scans, switches the
// Wi-Fi with a rollback, and keeps the password out of every command line and file except the connection file (mode 600).
// nmcli, systemctl, systemd-run and curl are fakes in a temporary folder that write down what they were asked. The tool
// reads its NET_* overrides only when it is not root, so these tests need a normal user.
//
//   node tests/net-root.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const script = path.join(repo, 'computer/scripts/net-root.sh');
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-netroot-')));
const secret = 'correct horse 9';
let count = 0;

const nmcli = `#!/bin/sh
echo "nmcli $*" >> "$FAKE_LOG"
case "$*" in
  "-t -f DEVICE,TYPE device") printf 'eth0:ethernet\\nwlan0:wifi\\n' ;;
  "-t -f UUID,TYPE connection show --active") printf '11111111-1111-4111-8111-111111111111:802-11-wireless\\n' ;;
  "-t -f IN-USE,SSID device wifi list") printf '*:Old Net\\n :Other\\n' ;;
  "-t -f IN-USE,SIGNAL,SECURITY,SSID device wifi list")
    printf '*:80:WPA2:Old Net\\n :60:WPA2:Guest\\\\:Open\\n :30:--:Cafe\\n :55:WPA2 802.1X:Staff\\n :40:WPA2:Old Net\\n :70:WPA2:\\n' ;;
  "-t -f UUID,NAME connection show") printf '11111111-1111-4111-8111-111111111111:Old Net\\n22222222-2222-4222-8222-222222222222:Teletraan Wi-Fi aaaaaaaa\\n' ;;
  "connection load "*) cp "\${3}" "$FAKE_SAVED"; stat -c %a "\${3}" 2>/dev/null > "$FAKE_SAVED.mode" || stat -f %Lp "\${3}" > "$FAKE_SAVED.mode" ;;
  "--wait 45 connection up uuid 11111111-1111-4111-8111-111111111111") [ -z "$FAKE_PREVIOUS_FAILS" ] || exit 4 ;;
  "--wait 45 connection up uuid "*) [ -z "$FAKE_NEW_FAILS" ] || exit 4 ;;
esac
exit 0
`;
const systemctl = `#!/bin/sh
echo "systemctl $*" >> "$FAKE_LOG"
case "$*" in
  "is-active --quiet NetworkManager.service") [ -z "$FAKE_NO_NM" ] ;;
  "is-active --quiet teletraan-wifi-switch.service") [ -n "$FAKE_BUSY" ] ;;
  *) exit 0 ;;
esac
`;
// The real systemd-run answers at once and the unit runs on its own, so the fake ignores how the unit ended
const systemdRun = `#!/bin/sh
echo "systemd-run $*" >> "$FAKE_LOG"
while [ "$#" -gt 0 ]; do case "$1" in --*) shift ;; *) break ;; esac; done
"$@" || true
`;
const curl = `#!/bin/sh
echo "curl $*" >> "$FAKE_LOG"
[ -z "$FAKE_CURL_FAILS" ]
`;

function setup(extra = {}) {
  const root = path.join(work, 'c' + count++);
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const names = { nmcli, systemctl, 'systemd-run': systemdRun, curl };
  Object.keys(names).forEach(name => fs.writeFileSync(path.join(bin, name), names[name], { mode: 0o755 }));
  const env = Object.assign({
    PATH: bin + ':' + process.env.PATH,
    NET_NMCLI: path.join(bin, 'nmcli'), NET_SYSTEMCTL: path.join(bin, 'systemctl'), NET_SYSTEMD_RUN: path.join(bin, 'systemd-run'), NET_CURL: path.join(bin, 'curl'),
    NET_SELF: script, NET_STATE_DIR: path.join(root, 'state'), NET_RUN_DIR: path.join(root, 'run'), NET_CONNECTION_DIR: path.join(root, 'connections'),
    FAKE_LOG: path.join(root, 'calls.log'), FAKE_SAVED: path.join(root, 'saved'), NET_SETTLE: '0',
  }, extra);
  return {
    root, env,
    run(args, input = '') {
      return spawnSync('bash', [script, ...args], { input: input, encoding: 'utf8', env: env });
    },
    calls() { return fs.existsSync(env.FAKE_LOG) ? fs.readFileSync(env.FAKE_LOG, 'utf8') : ''; },
    result() {
      const found = {};
      const file = path.join(root, 'state/wifi-last');
      if (!fs.existsSync(file)) return found;
      fs.readFileSync(file, 'utf8').split('\n').forEach(line => { const at = line.indexOf(': '); if (at > 0) found[line.slice(0, at)] = line.slice(at + 2); });
      return found;
    },
  };
}

if (process.getuid && process.getuid() === 0) {
  console.log('SKIP  these tests need a normal user, because the tool ignores its test settings as root');
  process.exit(0);
}

test('it takes five words and refuses everything else', () => {
  const s = setup();
  ['', 'bogus', 'scan now', 'forget', 'connect'].forEach(word => {
    const result = s.run(word === '' ? [] : word.split(' '));
    assert.notEqual(result.status, 0, word);
  });
  ['scan', 'switch', 'restart', 'dns-public', 'dns-default'].forEach(word => assert.ok(fs.readFileSync(script, 'utf8').includes(word)));
});

test('scan lists each network once with its strongest signal, marks the one in use, and sorts strongest first', () => {
  const s = setup();
  const result = s.run(['scan']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n'), [
    'network: 80|yes|1|Old Net',
    'network: 60|yes|0|Guest:Open',
    'network: 55|enterprise|0|Staff',
    'network: 30|no|0|Cafe',
  ]);
  assert.ok(s.calls().includes('nmcli device wifi rescan'));
});

test('scan and the other NetworkManager words say so when NetworkManager is not in use', () => {
  const s = setup({ FAKE_NO_NM: '1' });
  const result = s.run(['scan']);
  assert.equal(result.status, 3);
  assert.match(result.stderr, /does not use NetworkManager/);
});

test('switch refuses a bad name or password before it changes anything', () => {
  const s = setup();
  [['', 'longenoughpass'], ['a'.repeat(33), 'longenoughpass'], ['Net;work', 'longenoughpass'], ['Net\\work', 'longenoughpass'], ['Net', 'short'], ['Net', 'x'.repeat(65)]].forEach(([name, pass]) => {
    const result = s.run(['switch'], name + '\n' + pass + '\nhost.example\n');
    assert.equal(result.status, 2, name + ' / ' + pass.length);
  });
  assert.ok(!s.calls().includes('systemd-run'), 'nothing was started');
  assert.ok(!fs.existsSync(path.join(s.root, 'run/request')), 'no request was left');
});

test('a switch that works: the password reaches only the connection file, the old way back stays, and the result says done', () => {
  const s = setup();
  const result = s.run(['switch'], 'New Net\n' + secret + '\nproject.api.example\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /switch has started/);
  assert.ok(!result.stdout.includes(secret) && !result.stderr.includes(secret), 'the answer holds no password');

  assert.ok(!s.calls().includes(secret), 'no command line holds the password:\n' + s.calls());
  assert.ok(!fs.existsSync(path.join(s.root, 'run/request')), 'the request file is gone');
  const saved = fs.readFileSync(path.join(s.root, 'saved'), 'utf8');
  assert.match(saved, /ssid=New Net/);
  assert.match(saved, /psk=correct horse 9/);
  assert.match(saved, /key-mgmt=wpa-psk/);
  assert.match(saved, /powersave=2/);
  assert.match(saved, /interface-name=wlan0/);
  assert.equal(fs.readFileSync(path.join(s.root, 'saved.mode'), 'utf8').trim(), '600');
  const connections = fs.readdirSync(path.join(s.root, 'connections'));
  assert.equal(connections.length, 1);
  assert.equal(fs.statSync(path.join(s.root, 'connections', connections[0])).mode & 0o777, 0o600);

  const done = s.result();
  assert.equal(done.state, 'done');
  assert.equal(done.network, 'New Net');
  assert.equal(done.previous, 'Old Net');
  assert.ok(!JSON.stringify(done).includes(secret));
  assert.ok(s.calls().includes('curl -s -o /dev/null --max-time 6 -I https://project.api.example'), 'the internet was tested');
  assert.ok(s.calls().includes('nmcli connection delete uuid 22222222-2222-4222-8222-222222222222'), 'an older connection made by this page is removed');
  assert.ok(!s.calls().includes('delete uuid 11111111'), 'the connection the computer had stays as the way back');
});

test('an open network is written without a security section', () => {
  const s = setup();
  assert.equal(s.run(['switch'], 'Cafe\n\nproject.api.example\n').status, 0);
  const saved = fs.readFileSync(path.join(s.root, 'saved'), 'utf8');
  assert.ok(!saved.includes('wifi-security') && !saved.includes('psk='));
  assert.equal(s.result().state, 'done');
});

test('a wrong password goes back to the old network and says so, with no password in the result', () => {
  const s = setup({ FAKE_NEW_FAILS: '1' });
  const result = s.run(['switch'], 'New Net\n' + secret + '\nproject.api.example\n');
  assert.equal(result.status, 0, 'the switch call itself answers at once');
  const back = s.result();
  assert.equal(back.state, 'reverted');
  assert.match(back.reason, /did not accept the connection/);
  assert.match(back.reason, /went back to Old Net/);
  assert.ok(s.calls().includes('nmcli --wait 45 connection up uuid 11111111-1111-4111-8111-111111111111'), 'the old connection came back');
  assert.ok(s.calls().includes('nmcli connection delete uuid ') && !s.calls().includes(secret));
  assert.equal(fs.readdirSync(path.join(s.root, 'connections')).length, 0, 'the new connection file is gone');
  assert.ok(!fs.readFileSync(path.join(s.root, 'state/wifi-last'), 'utf8').includes(secret));
});

test('a network with no way out is left again; when the old one cannot come back either, the result says to go to the computer', () => {
  const noInternet = setup({ FAKE_CURL_FAILS: '1' });
  assert.equal(noInternet.run(['switch'], 'New Net\n' + secret + '\nproject.api.example\n').status, 0);
  assert.equal(noInternet.result().state, 'reverted');
  assert.match(noInternet.result().reason, /internet could not be reached/);

  const stuck = setup({ FAKE_NEW_FAILS: '1', FAKE_PREVIOUS_FAILS: '1' });
  assert.equal(stuck.run(['switch'], 'New Net\n' + secret + '\nproject.api.example\n').status, 0);
  assert.equal(stuck.result().state, 'failed');
  assert.match(stuck.result().reason, /Check it at the computer/);
});

test('a second switch while one runs is refused, and the old request is not replaced', () => {
  const s = setup({ FAKE_BUSY: '1' });
  const result = s.run(['switch'], 'New Net\n' + secret + '\nproject.api.example\n');
  assert.equal(result.status, 4);
  assert.match(result.stderr, /already running/);
  assert.ok(!s.calls().includes('systemd-run'));
});

test('special characters in the password are written so the file keeps them, and a space at either end too', () => {
  const s = setup();
  assert.equal(s.run(['switch'], 'Net\n pass\\word \nproject.api.example\n').status, 0);
  assert.match(fs.readFileSync(path.join(s.root, 'saved'), 'utf8'), /psk=\\spass\\\\word\\s\n/);
});

test('restart restarts the network manager in use, and dns changes the active connection only', () => {
  const s = setup();
  const restart = s.run(['restart']);
  assert.equal(restart.status, 0, restart.stderr);
  assert.ok(s.calls().includes('systemctl restart NetworkManager.service'));
  assert.equal(s.run(['dns-public']).status, 0);
  assert.ok(s.calls().includes("nmcli connection modify uuid 11111111-1111-4111-8111-111111111111 ipv4.dns 1.1.1.1 8.8.8.8 ipv4.ignore-auto-dns yes"), s.calls());
  assert.equal(s.run(['dns-default']).status, 0);
  assert.ok(s.calls().includes('ipv4.dns  ipv4.ignore-auto-dns no'), s.calls());
});

test('no line of the tool writes the password to a log, a result or the terminal', () => {
  const text = fs.readFileSync(script, 'utf8').replace(/^\s*#.*$/gm, '');
  assert.ok(!/logger|>> *\S*log|echo "\$password|printf [^\n]*\$password[^\n]*>&2/.test(text));
  assert.ok(!/nmcli[^\n]*\$\{?password/.test(text), 'the password is never an argument');
});

finish();
