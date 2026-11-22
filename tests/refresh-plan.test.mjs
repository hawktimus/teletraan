// computer/scripts/refresh-plan.mjs: when the pre-meeting refresh starts, what holds it back, and what it does after the
// health check, with a fake clock and fake health. docs/audit.md, Part G.
//
//   node tests/refresh-plan.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { decideRepair, decideStart, meetingNow, settingsOf, words } from '../computer/scripts/refresh-plan.mjs';

const zone = 'America/New_York';
// 2026-11-17 is a Tuesday. 13:30 Eastern is 18:30 UTC in November.
const at = (hhmm, day = '2026-11-17') => Date.parse(day + 'T' + hhmm + ':00Z');
const base = { settings: {}, zone: zone, state: {}, events: [] };
const start = (hhmmUtc, extra = {}, day) => decideStart(Object.assign({}, base, { now: at(hhmmUtc, day) }, extra));

test('the settings start on, at 13:30, on weekdays, and an odd value falls back to that', () => {
  assert.deepEqual(settingsOf(undefined), { refreshEnabled: true, refreshTime: '13:30', refreshDays: [1, 2, 3, 4, 5] });
  assert.deepEqual(settingsOf({ refreshTime: '25:00', refreshDays: [], refreshEnabled: 'yes' }), { refreshEnabled: true, refreshTime: '13:30', refreshDays: [1, 2, 3, 4, 5] });
  assert.deepEqual(settingsOf({ refreshTime: '07:05', refreshDays: [3, 3, 1, 9], refreshEnabled: false }), { refreshEnabled: false, refreshTime: '07:05', refreshDays: [1, 3] });
});

test('it starts at 13:30 Eastern on a weekday, and not before, and not on the weekend', () => {
  assert.equal(start('18:29').start, false);
  assert.match(start('18:29').reason, /Not time yet/);
  assert.equal(start('18:30').start, true);
  assert.equal(start('18:34').start, true, 'the timer wakes every 5 minutes, so a few minutes late is fine');
  assert.match(start('18:30', {}, '2026-11-21').reason, /Not a refresh day/, 'a Saturday');
  assert.equal(start('18:30', {}, '2026-11-22').start, false, 'a Sunday');
});

test('the time follows the clock of the zone in summer too, when 13:30 is 17:30 UTC', () => {
  const july = '2026-07-14';
  assert.equal(start('17:29', {}, july).start, false);
  assert.equal(start('17:30', {}, july).start, true);
});

test('it is off when the setting says so, and runs once a day', () => {
  assert.equal(start('18:30', { settings: { refreshEnabled: false } }).start, false);
  assert.match(start('18:30', { settings: { refreshEnabled: false } }).reason, /is off/);
  assert.equal(start('18:35', { state: { lastSlot: '2026-11-17' } }).start, false);
  assert.match(start('18:35', { state: { lastSlot: '2026-11-17' } }).reason, /Already done today/);
  assert.equal(start('18:35', { state: { lastSlot: '2026-11-16' } }).start, true, 'yesterday does not count');
});

test('a Meetings event holds it back from 15 minutes before to 10 minutes after, and other kinds do not', () => {
  const meeting = (from, to, kind = 'meetings') => ({ start: at(from), end: at(to), kind: kind });
  assert.equal(meetingNow([meeting('18:45', '20:00')], at('18:30')), true, '15 minutes before');
  assert.equal(meetingNow([meeting('18:46', '20:00')], at('18:30')), false);
  assert.equal(meetingNow([meeting('17:00', '18:00')], at('18:10')), true, 'ten minutes after');
  assert.equal(meetingNow([meeting('17:00', '18:00')], at('18:11')), false);
  assert.equal(meetingNow([meeting('18:00', '20:00', 'outreach')], at('18:30')), false);
  const held = start('18:30', { events: [meeting('18:00', '20:00')] });
  assert.deepEqual([held.start, held.wait], [false, true]);
  assert.match(held.reason, /meeting/);
});

test('it gives up 90 minutes after the time, saying so', () => {
  const busy = { events: [{ start: at('18:00'), end: at('21:00'), kind: 'meetings' }] };
  assert.equal(start('19:59', busy).wait, true);
  const over = start('20:01', busy);
  assert.equal(over.start, false);
  assert.match(over.reason, /time has passed/);
});

test('everything green: reload the page only; up more than 7 days: reboot', () => {
  assert.deepEqual(decideRepair({ failing: [], uptimeSeconds: 3 * 86400 }), { action: 'reload', services: [], reason: 'Everything is green: reloaded the page only.' });
  const old = decideRepair({ failing: [], uptimeSeconds: 8.5 * 86400 });
  assert.equal(old.action, 'reboot');
  assert.match(old.reason, /up 8 days/);
  assert.equal(decideRepair({ failing: [], uptimeSeconds: 7 * 86400 }).action, 'reload', 'seven days exactly is not more');
});

test('amber: restart what is wrong first, the sync service for a source and the screen for a frozen page, then check again', () => {
  const sources = decideRepair({ failing: ['monday', 'calendars'], uptimeSeconds: 1000 });
  assert.deepEqual([sources.action, sources.services], ['repair', ['sync']]);
  const both = decideRepair({ failing: ['frames', 'services'], uptimeSeconds: 1000 });
  assert.deepEqual(both.services, ['screen', 'sync']);
  assert.match(both.reason, /frames, services/);
});

test('after the repair it is done when green, and a reboot when it still is not', () => {
  assert.equal(decideRepair({ failing: [], uptimeSeconds: 1000, afterRepair: true }).action, 'done');
  const still = decideRepair({ failing: ['display'], uptimeSeconds: 1000, afterRepair: true });
  assert.equal(still.action, 'reboot');
  assert.match(still.reason, /Still not healthy/);
});

test('the words for the pages', () => {
  assert.equal(words({ time: '13:30', decision: 'reloaded page only, all green', at: '1:31 PM' }), '13:30 refresh: reloaded page only, all green (1:31 PM)');
  assert.equal(words(null), '');
  assert.equal(words({ decision: 5 }), '');
});

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(repo, name), 'utf8');

test('the Studio fields start as the plan says, and the dashboard never reads them', () => {
  const schema = read('studio/schemas/settingsRefresh.js');
  assert.ok(schema.includes("initialValue: true,") && schema.includes("initialValue: '13:30',") && schema.includes('initialValue: [1, 2, 3, 4, 5],'));
  assert.deepEqual(settingsOf({}), { refreshEnabled: true, refreshTime: '13:30', refreshDays: [1, 2, 3, 4, 5] });
});

test('the units run as the account, the timer wakes every 5 minutes, the installer is in the Mac tool, and the sudoers file allows what the script runs', () => {
  const service = read('computer/systemd/teletraan-refresh.service');
  assert.match(service, /^User=ACCOUNT$/m);
  assert.ok(!/NoNewPrivileges/.test(service.replace(/#.*/g, '')), 'sudo must keep working');
  assert.match(read('computer/systemd/teletraan-refresh.timer'), /OnUnitActiveSec=5min/);
  assert.ok(read('tools/teletraan/teletraan-tool-deploy.sh').includes('nightly reboot refresh cleanup'));
  const sudoers = read('computer/sudoers/teletraan-control');
  ['restart teletraan-sync.service', 'restart teletraan-kiosk.service', 'systemctl reboot', 'start teletraan-calendars.service', 'start teletraan-monday.service', 'start teletraan-match13.service'].forEach(command => assert.ok(sudoers.includes(command), command));
  const script = read('computer/scripts/pre-meeting-refresh.sh');
  assert.ok(script.includes('gate.sh" allow nightly'), 'a reboot goes through the gate, as a scheduled one');
  assert.ok(!/SANITY_WRITE_TOKEN|MONDAY_API_TOKEN/.test(script), 'it holds no key');
});

finish();
