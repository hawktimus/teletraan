// Tests for computer/sudoers/teletraan-control: every command it allows is named in full, with its unit and its
// arguments, so sudo allows that command and no other. visudo checks the generated text when it is installed here.
//
//   node tests/sudoers.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const template = fs.readFileSync(path.join(repo, 'computer/sudoers/teletraan-control'), 'utf8');
let passed = 0;

function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

// The file as install.sh writes it: the login user in place of ACCOUNT
function generated(account) {
  return template.replace(/ACCOUNT/g, account);
}

// A strict reader of the only two shapes the file may hold. Backslash lines are joined first. A Cmnd_Alias is
// NAME = command, command; a rule is account ALL=(root) NOPASSWD: alias or command, ... Anything else throws.
function read(text) {
  const lines = text.replace(/\\\n/g, ' ').split('\n').map(line => line.trim()).filter(line => line !== '' && !line.startsWith('#'));
  const aliases = {};
  const rules = [];
  lines.forEach(line => {
    let match = /^Cmnd_Alias ([A-Z_]+) = (.+)$/.exec(line);
    if (match) {
      aliases[match[1]] = match[2].split(',').map(item => item.trim());
      return;
    }
    match = /^([a-z_][a-z0-9_-]*) ALL=\(root\) NOPASSWD: (.+)$/.exec(line);
    assert.ok(match, 'a line this test does not know: ' + line);
    rules.push({ account: match[1], items: match[2].split(',').map(item => item.trim()) });
  });
  return { aliases, rules };
}

// Every command a rule gives, aliases opened
function commandsOf(parsed) {
  const out = [];
  parsed.rules.forEach(rule => rule.items.forEach(item => {
    if (parsed.aliases[item]) out.push(...parsed.aliases[item]);
    else {
      assert.ok(!/^[A-Z_]+$/.test(item), 'an alias that is not defined: ' + item);
      out.push(item);
    }
  }));
  return out;
}

// sudo allows a command line when the path and every argument match one rule word for word. A rule with no arguments
// allows no arguments, except the wrapper rule, which checks its own arguments.
const wrapper = '/usr/local/sbin/teletraan-install-tree';
function allows(commands, line) {
  return commands.some(command => command === line || (command === wrapper && (line === wrapper || line.startsWith(wrapper + ' '))));
}

const parsed = read(generated('hawk'));
const commands = commandsOf(parsed);

const timers = ['calendars', 'monday', 'slides', 'watchdog', 'nightly', 'reboot', 'network'];
const syncs = ['calendars', 'monday', 'frc', 'news', 'photos-drive', 'match13'];
const networkServices = ['NetworkManager.service', 'systemd-networkd.service', 'systemd-resolved.service', 'networking.service'];
const journalLine = '/usr/bin/journalctl -u NetworkManager.service -u wpa_supplicant.service -u systemd-networkd.service --no-pager -n 60 -o short-iso';
const expected = [
  '/usr/bin/systemctl restart teletraan-kiosk.service',
  '/usr/bin/systemctl start teletraan-mirror.service',
  ...timers.map(name => '/usr/bin/systemctl restart teletraan-' + name + '.timer'),
  ...syncs.map(name => '/usr/bin/systemctl start teletraan-' + name + '.service'),
  ...networkServices.map(name => '/usr/bin/systemctl restart ' + name),
  journalLine,
  '/usr/bin/docker restart teletraan-web',
  '/usr/bin/systemctl reboot',
  '/bin/systemctl reboot',
  '/usr/sbin/reboot',
  '/sbin/reboot',
  wrapper,
];

check('the file allows exactly the listed commands, each with its unit and arguments', () => {
  assert.deepEqual([...commands].sort(), [...expected].sort());
  assert.deepEqual(parsed.rules.map(rule => rule.account), ['hawk', 'hawk'], 'only the login user has a rule');
});

check('no wildcard, no open command and no way to change the environment', () => {
  const body = template.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
  assert.ok(!/[*?[\]!]/.test(body), 'no wildcard or negation');
  assert.ok(!/\bALL\b/.test(body.replace(/ALL=\(root\)/g, '')), 'no ALL command');
  assert.ok(!/SETENV|EXEC|sudoedit|\(ALL|ALL:/.test(body));
  commands.filter(command => command !== wrapper && command !== journalLine && !/reboot$/.test(command)).forEach(command => {
    assert.match(command, /^\/usr\/bin\/(systemctl (restart|start) (teletraan-[a-z0-9-]+\.(service|timer)|NetworkManager\.service|systemd-networkd\.service|systemd-resolved\.service|networking\.service)|docker restart teletraan-web)$/, command);
  });
  commands.forEach(command => assert.ok(command.startsWith('/'), 'a full path: ' + command));
});

check('every command the scripts run through sudo is allowed, by the same path', () => {
  const helper = fs.readFileSync(path.join(repo, 'computer/scripts/control-helper.sh'), 'utf8');
  assert.ok(helper.includes('TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl') && helper.includes('TELETRAAN_DOCKER:-/usr/bin/docker'));
  const loop = /for timer in ([a-z ]+); do/.exec(helper);
  assert.deepEqual(loop[1].split(' '), timers, 'the helper restarts the six timers');
  const list = /sync-now\)\n\s+case \$argument in\n\s+([a-z0-9|-]+)\) ;;/.exec(helper);
  assert.deepEqual(list[1].split('|'), syncs, 'the helper starts the six sync services');

  const lines = [
    '/usr/bin/systemctl restart teletraan-kiosk.service',
    '/usr/bin/systemctl start teletraan-mirror.service',
    '/usr/bin/docker restart teletraan-web',
    '/usr/bin/systemctl reboot',
    ...timers.map(name => '/usr/bin/systemctl restart teletraan-' + name + '.timer'),
    ...syncs.map(name => '/usr/bin/systemctl start teletraan-' + name + '.service'),
  ];
  lines.forEach(line => assert.ok(allows(commands, line), line));

  // The watchdog restarts the screen. The nightly job restarts it and reboots. The scheduled reboot reboots.
  const scripts = { watchdog: ['restart teletraan-kiosk.service'], nightly: ['restart teletraan-kiosk.service', 'reboot'], 'scheduled-reboot': ['reboot'], 'network-watchdog': ['restart teletraan-kiosk.service', 'reboot'] };
  Object.keys(scripts).forEach(name => {
    const text = fs.readFileSync(path.join(repo, 'computer/scripts', name + '.sh'), 'utf8');
    assert.ok(text.includes('TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl'), name);
    scripts[name].forEach(args => {
      assert.ok(text.includes(args) || (name === 'watchdog' && text.includes('service=teletraan-kiosk.service')), name + ' runs ' + args);
      assert.ok(allows(commands, '/usr/bin/systemctl ' + args), name + ' is allowed ' + args);
    });
  });
});

check('commands that are not listed are refused: other units, extra arguments, wildcards and other programs', () => {
  [
    '/usr/bin/systemctl restart sshd.service',
    '/usr/bin/systemctl restart teletraan-kiosk.service sshd.service',
    '/usr/bin/systemctl restart teletraan-kiosk.service teletraan-mirror.service',
    '/usr/bin/systemctl restart teletraan-kiosk',
    '/usr/bin/systemctl restart teletraan-*',
    '/usr/bin/systemctl restart teletraan-x.service',
    '/usr/bin/systemctl start teletraan-kiosk.service',
    '/usr/bin/systemctl start teletraan-backup.service',
    '/usr/bin/systemctl start teletraan-control.socket',
    '/usr/bin/systemctl restart teletraan-frc.timer',
    '/usr/bin/systemctl reboot --force',
    '/usr/bin/systemctl reboot now',
    '/usr/bin/systemctl poweroff',
    '/usr/bin/systemctl enable teletraan-kiosk.service',
    '/usr/bin/systemctl edit teletraan-kiosk.service',
    '/usr/bin/systemctl daemon-reload',
    '/usr/bin/docker restart other-container',
    '/usr/bin/docker restart teletraan-web teletraan-control',
    '/usr/bin/docker run --rm -v /:/host alpine sh',
    '/usr/sbin/reboot -f',
    '/sbin/poweroff',
    '/bin/sh',
    '/bin/bash -c id',
    '/usr/bin/tee /etc/sudoers.d/x',
    '/usr/local/sbin/teletraan-install-tree-other',
    '/opt/teletraan/computer/scripts/watchdog.sh',
    '/usr/bin/systemctl restart NetworkManager',
    '/usr/bin/systemctl stop NetworkManager.service',
    '/usr/bin/systemctl restart wpa_supplicant.service',
    '/usr/bin/systemctl restart NetworkManager.service systemd-networkd.service',
    '/usr/bin/journalctl -u sshd.service --no-pager -n 60 -o short-iso',
    '/usr/bin/journalctl -u NetworkManager.service -u wpa_supplicant.service -u systemd-networkd.service --no-pager -n 6000 -o short-iso',
    '/usr/bin/journalctl',
    '/usr/bin/nmcli device wifi connect x password y',
    '/usr/bin/nmcli connection delete id x',
  ].forEach(line => assert.ok(!allows(commands, line), 'must be refused: ' + line));
});

// The interface rules that install-network.sh writes: the block of computer/sudoers/teletraan-network once for each device
const netTemplate = fs.readFileSync(path.join(repo, 'computer/sudoers/teletraan-network'), 'utf8');
function netGenerated(account, names) {
  const block = netTemplate.split('\n').slice(netTemplate.split('\n').indexOf('# --- block ---') + 1, netTemplate.split('\n').indexOf('# --- end ---')).join('\n');
  return names.map(name => block.replace(/IFACE/g, name).replace(/ACCOUNT/g, account)).join('\n') + '\n';
}

check('the interface rules name each command with the interface, for the devices that were found only', () => {
  const text = netGenerated('hawk', ['wlp2s0', 'enp3s0f0']);
  const net = commandsOf(read(text));
  const expectedNet = [];
  ['wlp2s0', 'enp3s0f0'].forEach(name => expectedNet.push('/usr/bin/nmcli device reapply ' + name, '/usr/bin/nmcli device disconnect ' + name,
    '/usr/bin/nmcli device connect ' + name, '/usr/bin/networkctl renew ' + name, '/usr/bin/networkctl reconfigure ' + name,
    '/usr/sbin/ifup --force ' + name, '/usr/sbin/ifup ' + name, '/usr/sbin/ifdown ' + name));
  assert.deepEqual([...net].sort(), [...expectedNet].sort());
  assert.ok(!/[*?[\]!]/.test(text), 'no wildcard');
  ['docker0', 'tailscale0', 'br-1a2b3c', 'veth9f8e', 'lo', 'wlp2s0 extra', '*'].forEach(name => {
    ['/usr/bin/nmcli device reapply ', '/usr/bin/nmcli device disconnect ', '/usr/bin/networkctl renew '].forEach(start => assert.ok(!allows(net, start + name), start + name));
  });
  assert.ok(!allows(net, '/usr/bin/nmcli device delete wlp2s0') && !allows(net, '/usr/bin/nmcli radio wifi off'));
  const script = fs.readFileSync(path.join(repo, 'computer/scripts/network-watchdog.sh'), 'utf8');
  ['nmcli_bin\" device reapply', 'nmcli_bin\" device disconnect', 'nmcli_bin\" device connect', 'networkctl_bin\" renew', 'networkctl_bin\" reconfigure', 'ifup_bin\" --force', 'ifdown_bin\" \"$interface'].forEach(part => assert.ok(script.includes(part), part));
  assert.ok(allows(commands, '/usr/bin/systemctl restart teletraan-kiosk.service') && allows(commands, '/usr/bin/systemctl reboot'), 'the watchdog reuses the kiosk and reboot rules');
});

check('visudo accepts the generated file and refuses a broken one', () => {
  const visudo = spawnSync('/bin/sh', ['-c', 'command -v visudo'], { encoding: 'utf8' }).stdout.trim();
  if (!visudo) {
    console.log('      visudo is not installed here, so only the strict reader above checked the file.');
    return;
  }
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-sudoers-'));
  try {
    const file = path.join(folder, 'teletraan-control');
    fs.writeFileSync(file, generated('hawktimus'), { mode: 0o440 });
    const result = spawnSync(visudo, ['-cf', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const broken = path.join(folder, 'broken');
    fs.writeFileSync(broken, generated('hawktimus') + '\nhawktimus ALL=(root NOPASSWD: /usr/bin/systemctl\n', { mode: 0o440 });
    const net = path.join(folder, 'teletraan-network');
    fs.writeFileSync(net, netGenerated('hawktimus', ['wlp2s0', 'enp3s0f0']), { mode: 0o440 });
    assert.equal(spawnSync(visudo, ['-cf', net], { encoding: 'utf8' }).status, 0, 'visudo accepts the interface rules');
    assert.notEqual(spawnSync(visudo, ['-cf', broken], { encoding: 'utf8' }).status, 0, 'visudo does refuse a broken file');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

console.log(passed + ' of ' + passed + ' checks passed.');
