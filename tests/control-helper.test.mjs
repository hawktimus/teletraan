// The host helper (computer/scripts/control-helper.sh): it accepts exactly its words, logs each one, refuses and logs
// anything else, and writes local.env only from text that looks like an env file. sudo, systemctl and docker are
// small fakes in a temporary folder that write down what they were asked.
//
//   node tests/control-helper.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { words } from '../control/lib/helper-client.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const script = path.join(repo, 'computer/scripts/control-helper.sh');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-helper-'));
let count = 0;

function setup() {
  const root = path.join(work, 'r' + count++);
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(root, 'logs'));
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.copyFileSync(path.join(repo, 'computer/scripts/lib.sh'), path.join(root, 'computer/scripts/lib.sh'));
  const log = path.join(root, 'calls.log');
  const fake = `#!/bin/sh\necho "$(basename "$0") $*" >> "${log}"\n[ "$(basename "$0")" = sudo ] && { [ -n "\${FAKE_SUDO_SAYS:-}" ] && { echo "$FAKE_SUDO_SAYS" >&2; exit 1; }; "$@" 2>/dev/null; exit 0; }\nexit 0\n`;
  for (const name of ['sudo', 'systemctl', 'docker']) fs.writeFileSync(path.join(bin, name), fake, { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'computer/scripts/expired-cleanup.sh'), '#!/bin/sh\necho "cleanup $*" >> "' + log + '"\necho "item\tTip or news\tOld tip\t2026-08-01\t81"\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'computer/scripts/monday-sync.sh'), '#!/bin/sh\necho "monday $*" >> "' + log + '"\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'local.env'), "CONTROL_PIN='123456'\n", { mode: 0o600 });
  return {
    root: root,
    bin: bin,
    ask(input, extra = {}) {
      const env = Object.assign({ PATH: bin + ':/usr/bin:/bin', TELETRAAN_ROOT: root, TELETRAAN_SYSTEMCTL: path.join(bin, 'systemctl'), TELETRAAN_DOCKER: path.join(bin, 'docker') }, extra);
      const result = spawnSync('sh', [script], { input: input, encoding: 'utf8', env: env });
      const lines = result.stdout.trimEnd().split('\n');
      return { status: lines[lines.length - 1], output: lines.slice(0, -1).join('\n'), calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '' };
    },
    log() { return fs.existsSync(path.join(root, 'logs/helper.log')) ? fs.readFileSync(path.join(root, 'logs/helper.log'), 'utf8') : ''; },
  };
}

test('the words the client sends are the words the helper has', () => {
  assert.deepEqual(words, ['restart-kiosk', 'restart-services', 'reboot', 'status', 'sync-now', 'write-env', 'monday-check', 'monday-debug', 'mirror-start', 'mirror-watch', 'mirror-status', 'log-bundle', 'cleanup-preview', 'cleanup-delete']);
  const text = fs.readFileSync(script, 'utf8');
  words.forEach(word => assert.ok(text.includes(word), word));
});

test('log-bundle reads the journal of each teletraan unit as the login user, with no sudo', () => {
  const h = setup();
  fs.writeFileSync(path.join(h.bin, 'systemctl'), '#!/bin/sh\necho "teletraan-kiosk.service enabled"\necho "teletraan-monday.timer enabled"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(h.bin, 'journalctl'), '#!/bin/sh\necho "journalctl $*" >> "' + path.join(h.root, 'calls.log') + '"\necho "a journal line"\n', { mode: 0o755 });
  const answer = h.ask('log-bundle\n');
  assert.equal(answer.status, 'ok');
  assert.ok(answer.output.includes('---- journal teletraan-kiosk.service (last 300 lines) ----') && answer.output.includes('---- journal teletraan-monday.timer'));
  assert.ok(answer.output.includes('a journal line') && answer.output.includes('---- docker ps ----'));
  assert.ok(answer.calls.includes('journalctl -u teletraan-kiosk.service -n 300 --no-pager'));
  assert.ok(!answer.calls.includes('sudo'), 'nothing was run as root');
  assert.equal(h.ask('log-bundle now\n').status, 'refused');
});

test('restart-kiosk restarts the screen service and nothing else, and the log has a line with the time', () => {
  const h = setup();
  const answer = h.ask('restart-kiosk\n');
  assert.equal(answer.status, 'ok');
  assert.equal(answer.calls.trim(), 'sudo -n ' + path.join(h.bin, 'systemctl') + ' restart teletraan-kiosk.service');
  assert.match(h.log(), /^\d{4}-\d{2}-\d{2}T[\d:]+Z restart-kiosk\n$/);
});

test('restart-services restarts the web container and the timers, and goes on when one is not installed', () => {
  const h = setup();
  assert.equal(h.ask('restart-services\n').status, 'ok');
  const calls = h.ask('status\n').calls;
  assert.ok(calls.includes('sudo -n ' + path.join(h.bin, 'docker') + ' restart teletraan-web'), calls);
  assert.ok(!calls.includes('nginx'), 'no fallback to the nginx service');
  ['calendars', 'monday', 'slides', 'watchdog', 'nightly'].forEach(name => assert.ok(calls.includes('restart teletraan-' + name + '.timer'), name));
});

test('sync-now takes calendars, monday or frc and nothing else', () => {
  const h = setup();
  ['calendars', 'monday', 'frc'].forEach(name => {
    const answer = h.ask('sync-now ' + name + '\n');
    assert.equal(answer.status, 'ok', name);
    assert.ok(answer.calls.includes('start teletraan-' + name + '.service'), answer.calls);
  });
  ['sync-now', 'sync-now slides', 'sync-now calendars monday', 'sync-now ../x', 'sync-now calendars;reboot'].forEach(line => {
    assert.equal(h.ask(line + '\n').status, 'refused', line);
  });
});

test('anything that is not a word is refused and logged, and nothing runs', () => {
  const h = setup();
  ['', 'ls', 'rm -rf /', 'Restart-Kiosk', 'restart-kiosk now', 'status extra', 'reboot now', 'monday-check x', 'write-env x', 'restart-kiosk; reboot', '$(reboot)', 'restart_kiosk', 'cleanup-preview now', 'cleanup-delete --all'].forEach(line => {
    const answer = h.ask(line + '\n');
    assert.equal(answer.status, 'refused', JSON.stringify(line));
    assert.equal(answer.calls, '', JSON.stringify(line) + ' ran something');
  });
  const log = h.log().trim().split('\n');
  assert.equal(log.length, 14, 'one line for each refusal');
  log.forEach(line => assert.match(line, /^\d{4}-\d{2}-\d{2}T[\d:]+Z refused: [A-Za-z0-9 ?-]{0,40}$/));
});

test('status prints plain name=value lines, and monday-check runs the check of the Monday script', () => {
  const h = setup();
  const status = h.ask('status\n');
  assert.equal(status.status, 'ok');
  assert.match(status.output, /^user: \S+$/m);
  assert.match(status.output, /^host: \S*$/m);
  ['kiosk', 'display', 'tailscale'].forEach(label => assert.match(status.output, new RegExp('^' + label + ':', 'm'), label));
  const check = h.ask('monday-check\n');
  assert.equal(check.status, 'ok');
  assert.ok(check.calls.includes('monday --check'), check.calls);
});

test('cleanup-preview lists without deleting and cleanup-delete deletes, each with no argument, as the login user and without sudo', () => {
  const h = setup();
  const preview = h.ask('cleanup-preview\n');
  assert.equal(preview.status, 'ok');
  assert.ok(preview.calls.includes('cleanup --dry-run --print') && !preview.calls.includes('--delete-now'), preview.calls);
  assert.match(preview.output, /^item\tTip or news\tOld tip\t2026-08-01\t81$/m);
  const gone = h.ask('cleanup-delete\n');
  assert.equal(gone.status, 'ok');
  assert.ok(gone.calls.includes('cleanup --delete-now --print'), gone.calls);
  assert.ok(!/^sudo /m.test(preview.calls + gone.calls), 'no sudo rule is needed');
  ['cleanup-preview x', 'cleanup-preview --delete-now', 'cleanup-delete 5', 'cleanup'].forEach(line => assert.equal(h.ask(line + '\n').status, 'refused', line));
});

test('monday-debug takes one board number and runs the debug of the Monday script, and refuses anything else', () => {
  const h = setup();
  const answer = h.ask('monday-debug 18435126893\n');
  assert.equal(answer.status, 'ok');
  assert.ok(answer.calls.includes('monday --debug 18435126893'), answer.calls);
  ['monday-debug', 'monday-debug abc', 'monday-debug 12 34', 'monday-debug 1;reboot', 'monday-debug $(reboot)', 'monday-debug -1', 'monday-debug 123456789012345678901'].forEach(line => {
    const refused = h.ask(line + '\n');
    assert.equal(refused.status, 'refused', line);
    assert.equal(refused.calls, answer.calls, line + ' ran something');
  });
});

test('reboot asks sudo for the reboot itself, before the answer, and leaves no job in the background', () => {
  const h = setup();
  const answer = h.ask('reboot\n');
  assert.equal(answer.status, 'ok');
  assert.equal(answer.calls.trim(), 'sudo -n ' + path.join(h.bin, 'systemctl') + ' reboot', 'the call is made before the helper ends');
  assert.ok(answer.output.includes('is rebooting'));
  const text = fs.readFileSync(script, 'utf8');
  assert.ok(!/\bsleep\b/.test(text) && !/\) *(> *\/dev\/null)?( *2>&1)? *&\s*$/m.test(text), 'systemd stops the whole service when the helper ends, so a background job would never run');
  assert.ok(!text.includes('/sbin/reboot'));
});

test('when sudo refuses, the answer says failed with the reason and the log keeps it', () => {
  for (const word of ['reboot', 'restart-kiosk', 'restart-services', 'sync-now calendars']) {
    const h = setup();
    const answer = h.ask(word + '\n', { FAKE_SUDO_SAYS: 'sudo: a password is required' });
    assert.equal(answer.status, 'failed 1', word);
    assert.ok(answer.output.includes('a password is required'), word + ': ' + answer.output);
    assert.match(h.log(), /failed 1: sudo: a password is required/, word);
  }
});

test('the sudoers file names the commands the helper runs, by the same full paths (tests/sudoers.test.mjs checks the rest)', () => {
  const sudoers = fs.readFileSync(path.join(repo, 'computer/sudoers/teletraan-control'), 'utf8');
  const text = fs.readFileSync(script, 'utf8');
  assert.ok(text.includes('TELETRAAN_SYSTEMCTL:-/usr/bin/systemctl') && text.includes('TELETRAAN_DOCKER:-/usr/bin/docker'));
  ['/usr/bin/systemctl restart teletraan-kiosk.service', '/usr/bin/systemctl start teletraan-calendars.service', '/usr/bin/systemctl restart teletraan-monday.timer', '/usr/bin/systemctl reboot', '/usr/bin/docker restart teletraan-web'].forEach(item => assert.ok(sudoers.includes(item), item));
  assert.ok(!sudoers.split('\n').some(line => !line.trim().startsWith('#') && line.includes('*')), 'no wildcard');
});

test('write-env replaces local.env with mode 600 and keeps the old one, and refuses text that is not an env file', () => {
  const h = setup();
  const good = h.ask("write-env\n# comment\n\nCONTROL_PIN='654321'\nTBA_AUTH_KEY='abc'\n");
  assert.equal(good.status, 'ok');
  assert.equal(fs.readFileSync(path.join(h.root, 'local.env'), 'utf8'), "# comment\n\nCONTROL_PIN='654321'\nTBA_AUTH_KEY='abc'\n");
  assert.equal(fs.statSync(path.join(h.root, 'local.env')).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(path.join(h.root, 'local.env.previous'), 'utf8'), "CONTROL_PIN='123456'\n");

  const before = fs.readFileSync(path.join(h.root, 'local.env'), 'utf8');
  ['write-env\nrm -rf /\n', 'write-env\n', 'write-env\nA=1\n$(reboot)\n'].forEach(input => {
    assert.equal(h.ask(input).status, 'refused', JSON.stringify(input));
    assert.equal(fs.readFileSync(path.join(h.root, 'local.env'), 'utf8'), before, 'the file did not change');
  });
  assert.ok(!fs.existsSync(path.join(h.root, 'local.env.new')));
  assert.ok(!h.log().includes('654321'), 'the log never holds a value');
});

fs.rmSync(work, { recursive: true, force: true });
await finish();
