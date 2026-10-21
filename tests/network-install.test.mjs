// Tests for computer/scripts/install-network.sh, run in a folder that stands for the root of the Teletraan computer, with
// id, stat, systemctl, nmcli, ip, ethtool, udevadm and visudo replaced by small fakes: the interface rules, the settings
// that stop the network from sleeping, that running it twice changes nothing, and that --undo takes them away again.
//
//   node tests/network-install.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-netinstall-')));
const ordinary = ['sed', 'head', 'tail', 'grep', 'awk', 'cat', 'mkdir', 'chmod', 'install', 'mktemp', 'rm', 'cmp', 'dirname', 'sort', 'ls', 'tr', 'printf', 'readlink', 'cut', 'echo', 'paste', 'basename'];
let counter = 0;

function find(name) {
  return spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
}
function tool(folder, name, text) {
  fs.writeFileSync(path.join(folder, name), text, { mode: 0o755 });
}

const manager = list => list.join('\\n') + '\\n';

function setup(options = {}) {
  counter += 1;
  const root = path.join(work, 'r' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const home = path.join(root, 'opt/teletraan');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(stub);
  fs.mkdirSync(home, { recursive: true });
  fs.cpSync(path.join(repo, 'computer'), path.join(home, 'computer'), { recursive: true, filter: source => !source.endsWith('local.env') });
  ['etc/sudoers.d', 'etc/systemd/system', 'sys/class/net/wlp2s0', 'sys/class/net/enp3s0f0', 'sys/class/net/docker0'].forEach(folder => fs.mkdirSync(path.join(root, folder), { recursive: true }));
  fs.copyFileSync(path.join(repo, 'computer/sudoers/teletraan-control'), path.join(root, 'etc/sudoers.d/teletraan-control'));
  ordinary.forEach(name => {
    const found = find(name);
    if (found && !fs.existsSync(path.join(bin, name))) fs.symlinkSync(found, path.join(bin, name));
  });
  const log = path.join(root, 'calls.log');
  fs.writeFileSync(log, '');
  tool(bin, 'id', '#!/bin/sh\n[ "$1" = -u ] && { echo 0; exit 0; }\nexit 0\n');
  tool(bin, 'stat', '#!/bin/sh\necho hawk\n');
  tool(bin, 'curl', '#!/bin/sh\n');
  tool(bin, 'flock', '#!/bin/sh\n');
  tool(bin, 'ip', '#!/bin/sh\necho "default via 10.0.137.1 dev wlp2s0 proto dhcp"\n');
  tool(bin, 'systemctl', `#!/bin/sh
echo "systemctl $*" >> "${log}"
if [ "$1" = is-enabled ]; then [ -f "${stub}/masked-$2" ] && echo masked || echo static; exit 0; fi
if [ "$1" = mask ]; then shift; for n in "$@"; do : > "${stub}/masked-$n"; done; fi
if [ "$1" = unmask ]; then shift; for n in "$@"; do rm -f "${stub}/masked-$n"; done; fi
exit 0
`);
  tool(bin, 'nmcli', `#!/bin/sh
echo "nmcli $*" >> "${log}"
case "$*" in
  *"-f DEVICE,TYPE,STATE device"*) printf '${manager(['wlp2s0:wifi:connected', 'enp3s0f0:ethernet:unavailable', 'docker0:bridge:unmanaged', 'veth1a2b:ethernet:unmanaged', 'tailscale0:tun:unmanaged'])}' ;;
  *"UUID,TYPE connection show --active"*) printf '${manager(['aaaa-bbbb:802-11-wireless', 'cccc-dddd:bridge'])}' ;;
  *"-g 802-11-wireless.powersave"*) cat "${stub}/powersave" 2>/dev/null || echo 0 ;;
  *"802-11-wireless.powersave 2"*) echo 2 > "${stub}/powersave" ;;
  *"802-11-wireless.powersave 0"*) echo 0 > "${stub}/powersave" ;;
esac
exit 0
`);
  tool(bin, 'udevadm', `#!/bin/sh\necho "udevadm $*" >> "${log}"\n`);
  if (options.ethtool !== false) tool(bin, 'ethtool', `#!/bin/sh\necho "ethtool $*" >> "${log}"\ncase "$1" in --show-eee) echo "EEE status: enabled - inactive" ;; esac\n`);
  if (options.iw) tool(bin, 'iw', `#!/bin/sh\necho "iw $*" >> "${log}"\n`);
  const visudo = find('visudo');
  if (visudo) fs.symlinkSync(visudo, path.join(bin, 'visudo'));
  return {
    root, bin, stub, log,
    file: name => path.join(root, name),
    text: name => (fs.existsSync(path.join(root, name)) ? fs.readFileSync(path.join(root, name), 'utf8') : null),
    calls: () => fs.readFileSync(log, 'utf8'),
    run(args = []) {
      const env = { PATH: bin, NETWORK_ROOT: root };
      const result = spawnSync('/bin/bash', [path.join(home, 'computer/scripts/install-network.sh'), ...args], { env, encoding: 'utf8', input: '\n' });
      return { status: result.status, text: result.stdout, errors: result.stderr };
    },
  };
}

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  console.log('PASS  ' + name);
}

const code = text => text.split('\n').filter(line => !line.startsWith('#')).join('\n');

check('the sudo rules cover the Wi-Fi and Ethernet devices of NetworkManager and nothing else', () => {
  const place = setup();
  const result = place.run();
  assert.equal(result.status, 0, result.errors + result.text);
  const rules = place.text('etc/sudoers.d/teletraan-network');
  assert.ok(rules.includes('/usr/bin/nmcli device reapply wlp2s0') && rules.includes('/usr/bin/nmcli device reapply enp3s0f0'));
  assert.ok(rules.includes('hawk ALL=(root) NOPASSWD:'));
  ['docker0', 'veth', 'tailscale0', 'br-'].forEach(word => assert.ok(!code(rules).includes(word), word));
  assert.ok(!/IFACE|ACCOUNT/.test(code(rules)), 'every placeholder is filled in');
  assert.ok(!/[*?]/.test(code(rules)), 'no wildcard');
  assert.equal(fs.statSync(place.file('etc/sudoers.d/teletraan-network')).mode & 0o777, 0o440);
});

check('the unit files are copied for the login user and the timer is turned on', () => {
  const place = setup();
  place.run();
  assert.match(place.text('etc/systemd/system/teletraan-network.service'), /^User=hawk$/m);
  assert.ok(place.text('etc/systemd/system/teletraan-network.timer').includes('OnUnitActiveSec=2min'));
  assert.ok(place.calls().includes('systemctl enable --now teletraan-network.timer') && place.calls().includes('systemctl restart teletraan-network.timer'));
});

check('Wi-Fi power saving goes off through NetworkManager (drop-in and the active connection) when iw is not installed, and the output says so', () => {
  const place = setup();
  const result = place.run();
  const conf = place.text('etc/NetworkManager/conf.d/70-teletraan-network.conf');
  assert.ok(conf.includes('wifi.powersave = 2') && conf.includes('connection.autoconnect-retries = 0') && conf.includes('ipv4.dhcp-timeout = 2147483647'));
  assert.ok(place.calls().includes('nmcli connection modify uuid aaaa-bbbb 802-11-wireless.powersave 2'));
  assert.ok(!place.calls().includes('cccc-dddd'), 'only the Wi-Fi connection is changed');
  assert.ok(result.text.includes('iw is not installed'), result.text);
  assert.ok(!(place.text('etc/udev/rules.d/70-teletraan-network.rules') || '').includes('power_save'), 'no iw rule without iw');
});

check('with iw installed the udev rule and the command turn power saving off too; energy-efficient Ethernet is turned off when reported', () => {
  const place = setup({ iw: true });
  place.run();
  const rules = place.text('etc/udev/rules.d/70-teletraan-network.rules');
  assert.ok(rules.includes('KERNEL=="wlp2s0", RUN+="') && rules.includes('dev wlp2s0 set power_save off'), rules);
  assert.ok(rules.includes('--set-eee enp3s0f0 eee off'), rules);
  assert.ok(place.calls().includes('ethtool --set-eee enp3s0f0 eee off'));
  assert.ok(place.calls().includes('udevadm control --reload'));
});

check('a USB adapter gets an autosuspend rule', () => {
  const place = setup();
  const usb = place.file('sys/devices/usb1/1-2');
  fs.mkdirSync(path.join(usb, '1-2:1.0'), { recursive: true });
  fs.mkdirSync(path.join(usb, 'power'));
  fs.writeFileSync(path.join(usb, 'idVendor'), '0bda\n');
  fs.writeFileSync(path.join(usb, 'idProduct'), '8179\n');
  fs.writeFileSync(path.join(usb, 'power/control'), 'auto\n');
  fs.rmSync(place.file('sys/class/net/wlp2s0'), { recursive: true });
  fs.mkdirSync(place.file('sys/class/net/wlp2s0'));
  fs.symlinkSync(path.join(usb, '1-2:1.0'), place.file('sys/class/net/wlp2s0/device'));
  place.run();
  const rules = place.text('etc/udev/rules.d/70-teletraan-network.rules');
  assert.ok(rules.includes('ATTR{idVendor}=="0bda", ATTR{idProduct}=="8179"') && rules.includes('ATTR{power/control}="on"'), rules);
  assert.equal(fs.readFileSync(path.join(usb, 'power/control'), 'utf8').trim(), 'on');
});

check('suspend, hibernate and hybrid sleep are masked and logind ignores idle and the lid', () => {
  const place = setup();
  place.run();
  ['sleep.target', 'suspend.target', 'hibernate.target', 'hybrid-sleep.target', 'suspend-then-hibernate.target'].forEach(name => assert.ok(fs.existsSync(path.join(place.stub, 'masked-' + name)), name));
  const logind = place.text('etc/systemd/logind.conf.d/70-teletraan-no-sleep.conf');
  ['IdleAction=ignore', 'HandleLidSwitch=ignore', 'HandleSuspendKey=ignore', 'HandleHibernateKey=ignore'].forEach(line => assert.ok(logind.includes(line), line));
  assert.ok(!logind.includes('HandlePowerKey'), 'the power key is left alone');
});

check('running it again changes nothing and says so', () => {
  const place = setup({ iw: true });
  place.run();
  const files = ['etc/sudoers.d/teletraan-network', 'etc/NetworkManager/conf.d/70-teletraan-network.conf', 'etc/udev/rules.d/70-teletraan-network.rules', 'etc/systemd/logind.conf.d/70-teletraan-no-sleep.conf'];
  const before = files.map(name => [place.text(name), fs.statSync(place.file(name)).mtimeMs]);
  fs.writeFileSync(place.log, '');
  const again = place.run();
  assert.equal(again.status, 0, again.errors);
  files.forEach((name, index) => {
    assert.equal(place.text(name), before[index][0]);
    assert.equal(fs.statSync(place.file(name)).mtimeMs, before[index][1], name + ' was not rewritten');
  });
  assert.ok(again.text.includes('already as it should be') && again.text.includes('is already masked') && again.text.includes('Wi-Fi power saving is already off'), again.text);
  assert.ok(!place.calls().includes('systemctl mask') && !place.calls().includes('powersave 2'), 'nothing is masked or changed twice');
});

check('--undo removes the settings, unmasks the targets and puts power saving back, and leaves the timer and sudoers file', () => {
  const place = setup({ iw: true });
  place.run();
  const undone = place.run(['--undo']);
  assert.equal(undone.status, 0, undone.errors);
  ['etc/NetworkManager/conf.d/70-teletraan-network.conf', 'etc/udev/rules.d/70-teletraan-network.rules', 'etc/systemd/logind.conf.d/70-teletraan-no-sleep.conf'].forEach(name => assert.equal(place.text(name), null, name));
  assert.ok(!fs.readdirSync(place.stub).some(name => name.startsWith('masked-')), 'unmasked');
  assert.equal(fs.readFileSync(path.join(place.stub, 'powersave'), 'utf8').trim(), '0');
  assert.ok(place.text('etc/sudoers.d/teletraan-network') && place.text('etc/systemd/system/teletraan-network.timer'));
});

check('it refuses to run without root, for a repository owned by root, and with a word it does not know', () => {
  const place = setup();
  fs.writeFileSync(path.join(place.bin, 'id'), '#!/bin/sh\n[ "$1" = -u ] && { echo 1000; exit 0; }\nexit 0\n', { mode: 0o755 });
  assert.equal(place.run().status, 1);
  const owned = setup();
  fs.writeFileSync(path.join(owned.bin, 'stat'), '#!/bin/sh\necho root\n', { mode: 0o755 });
  const refused = owned.run();
  assert.equal(refused.status, 1);
  assert.ok(refused.errors.includes('should not run as that'));
  assert.equal(setup().run(['--wrong']).status, 2);
});

check('the script is plain: no em or en dash, no root unit, and it asks before it changes anything', () => {
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/install-network.sh'), 'utf8');
  assert.ok(!/[–—]/.test(text));
  assert.ok(text.indexOf('read -r answer') < text.indexOf('install -m 644 "$tmp"'));
  const unit = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-network.service'), 'utf8');
  assert.match(unit, /^User=ACCOUNT$/m);
  assert.ok(!/^NoNewPrivileges=/m.test(unit));
});

fs.rmSync(work, { recursive: true, force: true });
console.log(passed + ' of ' + passed + ' checks passed.');
