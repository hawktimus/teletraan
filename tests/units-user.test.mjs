// Tests for the unit files in computer/systemd: no service runs as root unless it is on the list below with a reason,
// every unit that names ACCOUNT is filled in by the installers, and the installers replace an old unit that ran as root.
// systemd-analyze verify checks the units when it is installed here (it is on the Teletraan computer, not on a Mac).
//
//   node tests/units-user.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const units = path.join(repo, 'computer/systemd');
let passed = 0;

function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

// The only units allowed to run as root, each with the reason. A new unit that needs root is added here with its reason,
// and a coach reads the line before it is merged.
const rootAllowed = {
  'teletraan-console.service': 'writes the shutdown drawing to the first text console (tty1) and switches to it with chvt, which need root',
};

const services = fs.readdirSync(units).filter(name => name.endsWith('.service') || name.endsWith('.socket'));

function setting(text, name) {
  const found = new RegExp('^' + name + '=(.*)$', 'm').exec(text);
  return found ? found[1] : null;
}

check('every service runs as ACCOUNT, and the ones that run as root are on the allow-list with a reason', () => {
  assert.ok(services.length >= 15, 'the units were found');
  const rootUnits = [];
  services.forEach(name => {
    const text = fs.readFileSync(path.join(units, name), 'utf8');
    const user = name.endsWith('.socket') ? setting(text, 'SocketUser') : setting(text, 'User');
    if (user === null || user === 'root') rootUnits.push(name);
    else assert.equal(user, 'ACCOUNT', name + ' names a fixed account');
  });
  assert.deepEqual(rootUnits.sort(), Object.keys(rootAllowed).sort());
  Object.keys(rootAllowed).forEach(name => assert.ok(rootAllowed[name].length > 20, name + ' has a reason'));
});

check('the watchdog and nightly services run as ACCOUNT and do not block sudo', () => {
  ['teletraan-watchdog.service', 'teletraan-nightly.service'].forEach(name => {
    const text = fs.readFileSync(path.join(units, name), 'utf8');
    assert.equal(setting(text, 'User'), 'ACCOUNT', name);
    assert.equal(setting(text, 'NoNewPrivileges'), null, name + ' needs sudo');
  });
});

check('a root unit that runs a script of /opt/teletraan is not allowed: the tree is writable by the login user', () => {
  services.forEach(name => {
    if (!rootAllowed[name]) return;
    const text = fs.readFileSync(path.join(units, name), 'utf8');
    const run = text.split('\n').filter(line => /^Exec(Start|Stop|StartPre)=/.test(line));
    run.forEach(line => assert.ok(!/\/opt\/teletraan\/computer\/scripts\/[^ ]*\.(sh|py|mjs)\b/.test(line), name + ' runs a script from the writable tree: ' + line));
  });
});

check('the installers fill in ACCOUNT, refuse root, and say when they replace a unit that ran as root', () => {
  ['watchdog', 'nightly', 'reboot', 'cleanup', 'backup', 'calendars'].forEach(name => {
    const text = fs.readFileSync(path.join(repo, 'computer/scripts/install-' + name + '.sh'), 'utf8');
    assert.ok(text.includes('s/^User=ACCOUNT\\$/User=$account/'), name);
    assert.ok(text.includes('"$account" = root'), name + ' refuses root');
  });
  ['watchdog', 'nightly'].forEach(name => {
    const text = fs.readFileSync(path.join(repo, 'computer/scripts/install-' + name + '.sh'), 'utf8');
    assert.ok(text.includes('runs as root. It is replaced'), name + ' tells the owner');
    assert.ok(text.includes('restart teletraan-kiosk.service'), name + ' checks the sudoers file');
  });
  const installer = fs.readFileSync(path.join(repo, 'computer/install.sh'), 'utf8');
  assert.ok(installer.includes('sed "s/ACCOUNT/$account/g" "$unit"'), 'install.sh fills in every unit it copies');
});

check('install-watchdog.sh and install-nightly.sh replace an old root unit with one that runs as the account', () => {
  ['watchdog', 'nightly'].forEach(name => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-units-'));
    try {
      const old = path.join(folder, 'teletraan-' + name + '.service');
      fs.writeFileSync(old, '[Service]\nType=oneshot\nExecStart=/opt/teletraan/computer/scripts/' + name + '.sh\n');
      const template = fs.readFileSync(path.join(units, 'teletraan-' + name + '.service'), 'utf8');
      // The installer's own sed, run twice: the second run changes nothing
      const filled = () => spawnSync('/usr/bin/sed', ['s/^User=ACCOUNT$/User=hawk/'], { input: template, encoding: 'utf8' }).stdout;
      fs.writeFileSync(old, filled());
      const first = fs.readFileSync(old, 'utf8');
      fs.writeFileSync(old, filled());
      assert.equal(fs.readFileSync(old, 'utf8'), first);
      assert.match(first, /^User=hawk$/m);
      assert.doesNotMatch(first, /ACCOUNT\n/);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});

check('systemd-analyze verify accepts the units with the account filled in', () => {
  const found = spawnSync('/bin/sh', ['-c', 'command -v systemd-analyze'], { encoding: 'utf8' }).stdout.trim();
  if (!found) {
    console.log('      systemd-analyze is not installed here, so the units were checked as text only.');
    return;
  }
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-verify-'));
  try {
    const names = fs.readdirSync(units);
    names.forEach(name => fs.writeFileSync(path.join(folder, name), fs.readFileSync(path.join(units, name), 'utf8').replace(/ACCOUNT/g, os.userInfo().username)));
    const files = names.filter(name => /\.(service|timer)$/.test(name) && !name.includes('@')).map(name => path.join(folder, name));
    const result = spawnSync(found, ['verify', ...files], { encoding: 'utf8' });
    // The scripts live in /opt/teletraan, which is not here, so a missing executable is not a fault of the unit
    const faults = (result.stdout + result.stderr).split('\n').filter(line => line.trim() !== '' && !/Command .* is not executable|No such file or directory|Failed to prepare filename|not found/.test(line));
    assert.deepEqual(faults, []);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

console.log(passed + ' of ' + passed + ' checks passed.');
