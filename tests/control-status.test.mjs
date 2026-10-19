// Tests for the status, now, log and helper routes of the control service (control/routes). They are
// mounted on a small router stub (tests/helpers/router-stub.mjs) with a fake Sanity and a fake helper.
//
//   node tests/control-status.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as status from '../control/routes/status.js';
import * as now from '../control/routes/now.js';
import * as log from '../control/routes/log.js';
import * as helper from '../control/routes/helper.js';
import { buildStatus, lastLines, lineStarting } from '../control/support/status-parts.js';
import { makeWorld } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const minutesAgo = (minutes, at = new Date()) => new Date(at.getTime() - minutes * 60000).toISOString();

function datasetAnswer(at = new Date(), extra = {}) {
  return {
    result: Object.assign({
      mini: { lastContentSeenAt: minutesAgo(3, at), lastCalendarSyncAt: minutesAgo(10, at), lastSlidesFetchAt: minutesAgo(1, at), lastMondaySyncAt: minutesAgo(20, at), kioskStartedAt: minutesAgo(600, at), lastBackupAt: minutesAgo(300, at), kioskRestarts: 1, lastKioskRestartAt: minutesAgo(900, at) },
      monday: { lastSyncAt: minutesAgo(20, at), lastError: '', callsToday: 41, callsDate: '2026-10-15' },
      settings: { mondayEveryMinutes: 30 },
      calendarErrors: 0,
    }, extra),
  };
}

await check('GET status gives versions, kiosk and display lines, the Teletraan computer times, backups, restarts, disk, the address and three dots with reasons', async () => {
  const world = await makeWorld([status], { answers: { 'status-mini': datasetAnswer() } });
  fs.mkdirSync(path.join(world.releasesDir, '14'));
  fs.mkdirSync(path.join(world.releasesDir, '13'));
  fs.symlinkSync('14', path.join(world.releasesDir, 'current'));
  fs.writeFileSync(path.join(world.dataDir, 'cors-check.json'), JSON.stringify({ ok: true, at: 'x' }));

  const answer = await world.router.call('GET', '/status');
  assert.equal(answer.status, 200);
  const data = answer.json;
  assert.equal(data.versions.current, 14);
  assert.deepEqual(data.versions.previous, [13]);
  assert.equal(data.kiosk, 'running since 08:00');
  assert.equal(data.display, 'output HDMI-1, mode 1920x1080, scale 1x1');
  assert.equal(data.tailscale, '100.64.0.7');
  assert.equal(data.mondayCallsToday, 41);
  assert.equal(data.kioskRestarts, 1);
  assert.ok(data.lastBackupAt);
  assert.equal(data.sanity.reachable, true);
  assert.deepEqual(data.cors, { ok: true, at: 'x' });
  assert.ok(data.disk.freeBytes > 0);
  assert.deepEqual(Object.keys(data.dots), ['monday', 'band', 'sanity']);
  Object.values(data.dots).forEach(dot => { assert.equal(dot.color, 'green'); assert.ok(dot.reason.length > 0); });
  assert.deepEqual(world.helped.map(item => item.word), ['status']);
});

await check('status makes the Monday dot amber when the read is older than twice its interval, and red on an error', async () => {
  const stale = await makeWorld([status], { answers: { 'status-mini': datasetAnswer(new Date(), { monday: { lastSyncAt: minutesAgo(61), lastError: '' } }) } });
  assert.equal((await stale.router.call('GET', '/status')).json.dots.monday.color, 'amber');
  const failed = await makeWorld([status], { answers: { 'status-mini': datasetAnswer(new Date(), { monday: { lastSyncAt: minutesAgo(5), lastError: 'Daily read limit reached' } }) } });
  const dot = (await failed.router.call('GET', '/status')).json.dots.monday;
  assert.equal(dot.color, 'red');
  assert.match(dot.reason, /Daily read limit reached/);
});

await check('status with Sanity out of reach says so, shows the Sanity dot red, and still answers', async () => {
  const world = await makeWorld([status], { offline: true });
  const answer = await world.router.call('GET', '/status');
  assert.equal(answer.status, 200);
  assert.equal(answer.json.sanity.reachable, false);
  assert.equal(answer.json.dots.sanity.color, 'red');
  assert.equal(answer.json.mini.content, '');
});

await check('status does not ask Sanity with a key and puts no key in its answer', async () => {
  const world = await makeWorld([status], { answers: { 'status-mini': datasetAnswer() } });
  const answer = await world.router.call('GET', '/status');
  world.fetched.forEach(item => assert.equal(item.init.headers, undefined));
  assert.ok(!answer.text.includes('skFAKEtoken'));
});

await check('every route needs the PIN: a request without it is refused with 401 and does nothing', async () => {
  const world = await makeWorld([status, log, helper, now], { pin: false });
  for (const [method, url, body] of [['GET', '/status'], ['GET', '/log'], ['POST', '/helper/status', {}], ['GET', '/now']]) {
    const answer = await world.router.call(method, url, { body: body });
    assert.equal(answer.status, 401, method + ' ' + url);
  }
  assert.deepEqual(world.helped, []);
});

await check('the helper route passes only its word list, asks for a confirm on restarts and names the target of a sync', async () => {
  const world = await makeWorld([helper]);
  const call = (word, body) => world.router.call('POST', '/helper/' + word, { body: body || {} });

  assert.equal((await call('format-disk')).status, 400);
  assert.equal((await call('write-env')).status, 400);
  assert.equal((await call('reboot')).status, 400);
  assert.equal((await call('restart-kiosk', { confirmed: false })).status, 400);
  assert.equal((await call('sync-now')).status, 400);
  assert.equal((await call('sync-now', { target: 'everything' })).status, 400);
  assert.deepEqual(world.helped, []);

  assert.equal((await call('restart-kiosk', { confirmed: true })).status, 200);
  assert.equal((await call('restart-services', { confirmed: true })).status, 200);
  assert.equal((await call('reboot', { confirmed: true })).status, 200);
  assert.equal((await call('status')).status, 200);
  assert.equal((await call('monday-check')).status, 200);
  assert.equal((await call('sync-now', { target: 'monday' })).status, 200);
  assert.equal((await call('monday-debug')).status, 400, 'the board number is needed');
  assert.equal((await call('monday-debug', { board: 'abc' })).status, 400);
  assert.equal((await call('monday-debug', { board: '1; reboot' })).status, 400);
  assert.equal((await call('monday-debug', { board: 18435126893 })).status, 400, 'a number is not a string of digits');
  assert.equal((await call('monday-debug', { board: '18435126893' })).status, 200);
  assert.deepEqual(world.helped.map(item => [item.word, ...item.args]), [
    ['restart-kiosk'], ['restart-services'], ['reboot'], ['status'], ['monday-check'], ['sync-now', 'monday'], ['monday-debug', '18435126893'],
  ]);
});

await check('a helper that fails gives a plain error and logs the reason without any request body', async () => {
  const world = await makeWorld([helper], { helperFails: ['reboot'] });
  const answer = await world.router.call('POST', '/helper/reboot', { body: { confirmed: true } });
  assert.equal(answer.status, 502);
  assert.equal(answer.json.error, 'the helper refused reboot', 'the helper has plain sentences, and the page shows them');
  assert.ok(world.logged.some(line => line.includes('the helper refused reboot')));
});

await check('POST now takes a report only from the Teletraan computer itself, keeps it, and GET now says how old it is', async () => {
  const world = await makeWorld([now], { pin: false });
  const report = { at: 'ignored', view: 'prime', theme: 'cybertron', team: 'prime', panel: 'tasks', build: 'v14 a1b2c3d', page: '2', hold: 'tasks', pause: false, dots: { monday: { color: 'green', reason: 'ok' } }, extra: 'dropped' };

  assert.equal((await world.router.call('POST', '/now', { body: report })).status, 403);
  assert.equal((await world.router.call('POST', '/now', { body: report, headers: { 'x-real-ip': '192.168.1.20' } })).status, 403);

  const sent = await world.router.call('POST', '/now', { body: report, headers: { 'x-real-ip': '127.0.0.1' } });
  assert.equal(sent.status, 200);

  world.pin = true;
  const answer = (await world.router.call('GET', '/now')).json;
  assert.equal(answer.report.view, 'prime');
  assert.equal(answer.report.panel, 'tasks');
  assert.equal(answer.report.hold, 'tasks');
  assert.equal(answer.report.extra, undefined);
  assert.equal(answer.quiet, false);
  assert.ok(answer.ageSeconds <= 2);
});

await check('GET now before any report, and after 40 seconds, says no report', async () => {
  const world = await makeWorld([now]);
  const first = (await world.router.call('GET', '/now')).json;
  assert.equal(first.quiet, true);
  assert.equal(first.report, null);
  assert.match(first.message, /No report/);

  assert.equal(now.quietSeconds, 40);
  const received = new Date('2026-10-15T12:00:00Z');
  assert.equal(now.ageSeconds(received, new Date('2026-10-15T12:00:39Z')), 39);
  assert.equal(now.ageSeconds(received, new Date('2026-10-15T12:00:41Z')), 41);
  assert.equal(now.ageSeconds(null, new Date()), null);
});

await check('the card reads the first three rows of the panel from the published dataset', async () => {
  const world = await makeWorld([now], { answers: { '"task"': { result: ['Wire the robot', 'Cut the plate', 'Order bolts', 'A fourth'] } } });
  await world.router.call('POST', '/now', { body: { panel: 'tasks', view: 'general' }, headers: { 'x-real-ip': '::1' } });
  const answer = (await world.router.call('GET', '/now')).json;
  assert.deepEqual(answer.rows, ['Wire the robot', 'Cut the plate', 'Order bolts']);
  assert.ok(world.fetched.every(item => item.init.headers === undefined));
});

await check('GET log gives the last 200 lines of the log file', async () => {
  const world = await makeWorld([log]);
  fs.writeFileSync(path.join(world.dataDir, 'control.log'), Array.from({ length: 250 }, (item, index) => 'line ' + index).join('\n') + '\n');
  const lines = (await world.router.call('GET', '/log')).json.lines;
  assert.equal(lines.length, 200);
  assert.equal(lines[0], 'line 50');
  assert.equal(lines[199], 'line 249');
  assert.deepEqual(lastLines('a\nb\n', 5), ['a', 'b']);
  assert.deepEqual((await (await makeWorld([log])).router.call('GET', '/log')).json.lines, []);
});

await check('buildStatus shows a part it could not read as not known, and lineStarting finds a labelled line', () => {
  const empty = buildStatus({}, new Date());
  assert.equal(empty.versions.current, null);
  assert.equal(empty.cors, null);
  assert.equal(empty.disk, null);
  assert.equal(empty.kiosk, '');
  assert.equal(empty.dots.sanity.color, 'red');
  assert.equal(lineStarting('a: 1\nkiosk: up\n', 'kiosk'), 'up');
});

console.log(passed + ' of ' + passed + ' checks passed.');
