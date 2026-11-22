// computer/scripts/pre-meeting-refresh.sh with fakes: sudo, systemctl, health.sh, page-command.py and gate.sh write down what they were
// asked, and the files of a data folder say the time and the meetings. docs/audit.md, Part G.
//
//   node tests/pre-meeting-refresh.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-refresh-'));
let count = 0;

function put(file, text, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, mode ? { mode } : undefined);
}

// The refresh at 13:30 Eastern, Tuesday 2026-11-17, is 18:30 UTC
const at = hhmm => Date.parse('2026-11-17T' + hhmm + ':00Z');

function build(options = {}) {
  const p = (() => {
    const root = path.join(work, 'c' + count++);
    return { root, data: path.join(root, 'data'), state: path.join(root, 'state'), scripts: path.join(root, 'computer/scripts'), log: path.join(root, 'calls.log') };
  })();
  fs.mkdirSync(p.scripts, { recursive: true });
  fs.mkdirSync(p.state, { recursive: true });
  fs.mkdirSync(path.join(p.root, 'dashboard'), { recursive: true });
  fs.cpSync(path.join(repo, 'dashboard/core'), path.join(p.root, 'dashboard/core'), { recursive: true });
  fs.writeFileSync(path.join(p.root, 'dashboard/package.json'), '{ "type": "module" }\n');
  ['pre-meeting-refresh.sh', 'lib.sh', 'refresh-plan.mjs', 'refresh-context.mjs'].forEach(name => fs.copyFileSync(path.join(repo, 'computer/scripts', name), path.join(p.scripts, name)));
  fs.writeFileSync(path.join(p.root, 'computer/package.json'), '{ "type": "module" }\n');
  fs.writeFileSync(path.join(p.root, 'computer/local.env'), "TELETRAAN_DATA='" + p.data + "'\n");
  fs.writeFileSync(p.log, '');
  const tool = (name, body) => put(path.join(p.scripts, name), '#!/bin/bash\necho "' + name + ' $*" >> "' + p.log + '"\n' + body, 0o755);
  // health.sh writes the health file the test says: failing names in the file health-failing.txt (one a line), none when it is empty
  tool('health.sh', (options.healAfterRepair ? '[ -f "' + p.root + '/repaired" ] && : > "' + p.root + '/health-failing.txt"\n' : '') + 'names=$(cat "' + p.root + '/health-failing.txt" 2> /dev/null | tr "\\n" " ")\nchecks="{}"\nfor n in $names; do checks=$(printf \'%s\' "$checks" | jq -c --arg n "$n" \'. + {($n): {ok: false}}\'); done\nprintf \'{"checks":%s}\\n\' "$checks" > "' + p.state + '/health.json"\n');
  tool('gate.sh', options.gateRefuses ? 'echo "a reboot was already made 3 hours ago"; exit 3\n' : 'exit 0\n');
  put(path.join(p.scripts, 'page-command.py'), '#!/bin/sh\necho "page-command $*" >> "' + p.log + '"\n', 0o755);
  const bin = path.join(p.root, 'bin');
  fs.mkdirSync(bin);
  put(path.join(bin, 'sudo'), '#!/bin/bash\necho "sudo $*" >> "' + p.log + '"\n[[ "$*" == *restart* ]] && : > "' + p.root + '/repaired"\nexit 0\n', 0o755);
  put(path.join(bin, 'flock'), '#!/bin/sh\nexit 0\n', 0o755);
  // the files of the data folder: the content, the calendars
  const content = { result: { settings: Object.assign({ calendars: [{ id: 'team', kind: 'meetings' }] }, options.settings || {}), theme: { timeZone: 'America/New_York' } } };
  put(path.join(p.data, 'live/content.json'), JSON.stringify(content));
  if (options.meeting) put(path.join(p.data, 'calendars/team.ics'), 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:1\r\nSUMMARY:Meeting\r\nDTSTART:' + options.meeting[0] + '\r\nDTEND:' + options.meeting[1] + '\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n');
  if (options.failing) fs.writeFileSync(path.join(p.root, 'health-failing.txt'), options.failing.join('\n') + '\n');
  const nodeBin = path.dirname(process.execPath);
  return Object.assign(p, {
    run(now, uptime = 3 * 86400) {
      const before = fs.readFileSync(p.log, 'utf8').split('\n').filter(Boolean).length;
      const result = spawnSync('/bin/bash', [path.join(p.scripts, 'pre-meeting-refresh.sh')], {
        encoding: 'utf8',
        env: { PATH: bin + ':' + nodeBin + ':/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin', REFRESH_NOW: String(now), REFRESH_UPTIME: String(uptime), REFRESH_WAIT: '0', TELETRAAN_STATE_DIR: p.state, TELETRAAN_LOG_DIR: path.join(p.root, 'logs'), TELETRAAN_SYSTEMCTL: 'systemctl', TELETRAAN_SUDO: path.join(bin, 'sudo'), TELETRAAN_PYTHON: 'sh' },
      });
      return { status: result.status, text: result.stdout, errors: result.stderr, calls: fs.readFileSync(p.log, 'utf8').split('\n').filter(Boolean).slice(before) };
    },
    last() {
      const file = path.join(p.data, 'refresh/last.json');
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    },
    state_() {
      return JSON.parse(fs.readFileSync(path.join(p.data, 'refresh/state.json'), 'utf8'));
    },
  });
}

test('before 13:30 and on the weekend nothing happens and nothing is written', () => {
  const p = build();
  const early = p.run(at('18:25'));
  assert.equal(early.status, 0, early.errors);
  assert.deepEqual(early.calls, []);
  assert.equal(p.last(), null);
  assert.deepEqual(build().run(Date.parse('2026-11-21T18:30:00Z')).calls, [], 'a Saturday');
});

test('all green at 13:30: every source is read, the page is reloaded and nothing is restarted, and it says so', () => {
  const p = build();
  const result = p.run(at('18:30'));
  assert.equal(result.status, 0, result.errors);
  const calls = result.calls;
  ['calendars', 'monday', 'frc', 'news', 'photos-drive', 'match13'].forEach(unit => assert.ok(calls.some(line => line.includes('start teletraan-' + unit + '.service')), unit));
  assert.ok(calls.some(line => line.startsWith('page-command reload')));
  assert.ok(!calls.some(line => /restart|reboot/.test(line)));
  assert.equal(p.last().decision, 'reloaded page only, all green');
  assert.equal(p.last().time, '13:30');
  assert.equal(p.state_().lastSlot, '2026-11-17');
  assert.deepEqual(p.run(at('18:35')).calls, [], 'it runs once a day');
});

test('amber: the sync service is restarted for a late source, the screen for a frozen page, then it checks again and does not reboot when green', () => {
  const p = build({ failing: ['monday'], healAfterRepair: true });
  const result = p.run(at('18:30'));
  assert.equal(result.status, 0, result.errors);
  assert.ok(result.calls.some(line => line.includes('restart teletraan-sync.service')));
  assert.ok(!result.calls.some(line => line.includes('teletraan-kiosk') || line.includes('reboot')));
  assert.match(p.last().decision, /restarted the sync service, and it is green now/);
  const screen = build({ failing: ['frames'], healAfterRepair: true });
  assert.ok(screen.run(at('18:30')).calls.some(line => line.includes('restart teletraan-kiosk.service')));
});

test('still not healthy after the repair: it asks the gate and reboots, and a gate that says no is logged and nothing reboots', () => {
  const p = build({ failing: ['display'] });
  const result = p.run(at('18:30'));
  assert.ok(result.calls.some(line => line.startsWith('gate.sh allow nightly')), 'a scheduled reboot, outside the recovery budget');
  assert.ok(result.calls.some(line => /sudo .*reboot/.test(line)));
  assert.match(p.last().decision, /^rebooting: Still not healthy/);

  const refused = build({ failing: ['display'], gateRefuses: true });
  const answer = refused.run(at('18:30'));
  assert.ok(!answer.calls.some(line => /reboot/.test(line) && line.startsWith('sudo')), 'no reboot');
  assert.match(refused.last().decision, /the gate said no: a reboot was already made 3 hours ago/);
});

test('green but up more than 7 days: it reboots through the gate', () => {
  const p = build();
  const result = p.run(at('18:30'), 9 * 86400);
  assert.ok(result.calls.some(line => line.startsWith('gate.sh allow nightly')));
  assert.match(p.last().decision, /^rebooting: Everything is green, but the computer has been up 9 days/);
});

test('a meeting on holds it back, once in the log, and it gives up after ninety minutes', () => {
  const p = build({ meeting: ['20261117T183000Z', '20261117T200000Z'] });
  const first = p.run(at('18:30'));
  assert.deepEqual(first.calls, [], 'nothing was touched');
  assert.equal(p.last().decision, 'Waiting: a meeting is on.');
  const again = p.run(at('18:35'));
  assert.deepEqual(again.calls, []);
  assert.equal(fs.readFileSync(path.join(p.root, 'logs/refresh.jsonl'), 'utf8').trim().split('\n').length, 1, 'said once, not at every wake');
  const after = p.run(at('20:15'));
  assert.equal(after.calls.length, 0, 'ninety minutes after the time it gives up');
  assert.match(p.last().decision, /^skipped: a meeting is on\./);
});

test('off in the settings, or on another time, and a day picker', () => {
  assert.deepEqual(build({ settings: { refreshEnabled: false } }).run(at('18:30')).calls, []);
  const later = build({ settings: { refreshTime: '14:00' } });
  assert.deepEqual(later.run(at('18:30')).calls, []);
  assert.ok(later.run(at('19:00')).calls.length > 0);
  const wednesdays = build({ settings: { refreshDays: [3] } });
  assert.deepEqual(wednesdays.run(at('18:30')).calls, [], 'Tuesday is not a refresh day');
});

finish();
