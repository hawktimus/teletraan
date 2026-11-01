// The Now area without a browser: the plain sentence for each known failure, what the banner, the five dots and the Attention list say,
// GET overview and GET remote-last with the files of the other services present, missing or damaged, and the sign-in lockout and the
// HTTPS and host name readiness of the service (docs/control-page.md, docs/control-page-inventory.md).
//
//   node tests/control-overview.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { makeWorld } from './helpers/control-world.mjs';
import * as overviewRoute from '../control/routes/overview.js';
import * as statusRoute from '../control/routes/status.js';
import { createService, readConfig } from '../control/server.js';
import { isSecure, sameOrigin, triesAllowed } from '../control/lib/auth.js';
import { classify, plainProblem, plainReason, whenWords, agoWords, waitWords } from '../control/static/words.js';
import { buildBanner, buildDots, buildProblems, networkActionWords, networkDown, remoteWords, sourceState } from '../control/static/overview.js';
import { waitAfter } from '../control/static/poll.js';

const now = new Date('2026-10-31T15:30:00');
const at = minutes => new Date(now.getTime() - minutes * 60000).toISOString();

test('each known failure has one short sentence and the fixes the table of the plan names', () => {
  const calendar = plainProblem({ source: 'calendars', reason: 'TLS handshake failed: secure connection failed', lastGoodAt: at(20) }, now);
  assert.equal(calendar.message, "Calendars didn't update. The last good copy from 3:10 PM is still showing.");
  assert.deepEqual(calendar.fixes.map(fix => fix.label), ['Sync calendars now', 'Run network check']);
  assert.match(calendar.still, /still showing the copy from 3:10 PM/);

  const expired = plainProblem({ source: 'calendars', reason: 'The server said no (HTTP 403)', lastGoodAt: at(20) }, now);
  assert.equal(expired.message, 'A calendar link may have expired. Replace it in the settings file.');
  assert.deepEqual(expired.fixes.map(fix => fix.id), ['keys']);
  assert.equal(expired.where, 'Update, Keys');

  const down = plainProblem({ source: 'calendars', reason: 'could not resolve host', networkDown: true }, now);
  assert.equal(down.message, "The computer can't reach the internet. The screen shows saved data.");
  assert.deepEqual(down.fixes.map(fix => fix.label), ['Run network check', 'Show details']);

  const skipped = plainProblem({ source: 'news', reason: 'Unit teletraan-news.service not found.' }, now);
  assert.equal(skipped.message, "FRC news isn't set up on this computer, so it was skipped.");
  assert.deepEqual(skipped.fixes.map(fix => fix.label), ['Remove from Sync all']);

  const slow = plainProblem({ source: 'monday', reason: 'The job timed out after 60 seconds' }, now);
  assert.equal(slow.message, 'Monday took too long and was stopped.');
  assert.deepEqual(slow.fixes.map(fix => fix.label), ['Try again']);

  const other = plainProblem({ source: 'match13', reason: 'failed (3)' }, now);
  assert.equal(other.message, "Match13 didn't finish.");
  assert.deepEqual(other.fixes.map(fix => fix.label), ['Try again', 'Show details']);
  assert.equal(other.raw, 'failed (3)', 'the raw reason is kept for the drawer');
});

test('a dead address is not mistaken for a service that was never installed, and a raw command never reaches a primary line', () => {
  assert.equal(classify('HTTP 404 not found'), 'expired');
  assert.equal(classify('Failed to start x.service: Unit x.service not found.'), 'notInstalled');
  assert.equal(classify('connection refused'), 'unreachable');
  assert.equal(classify(''), 'other');
  assert.match(plainReason('Failed to start teletraan-news.service: see systemctl status and journalctl -xe'), /^the computer could not do that/);
  assert.equal(plainReason('Monday refused the token.'), 'Monday refused the token.');
});

test('times read as 3:12 PM and 20 min ago', () => {
  assert.equal(whenWords(at(20), now), '3:10 PM, 20 min ago');
  assert.equal(agoWords(at(0), now), 'just now');
  assert.equal(agoWords(at(130), now), '2 hours ago');
  assert.match(whenWords(at(60 * 30), now), /^Oct 30, /);
  assert.equal(whenWords('', now), '');
});

function overview(changes = {}) {
  const base = {
    at: at(0),
    status: { mini: { calendars: at(10), monday: at(10), frc: at(30) }, dots: { monday: { color: 'green', reason: 'ok' }, band: { color: 'green', reason: 'ok' }, sanity: { color: 'green', reason: 'ok' } }, kiosk: 'active', network: { state: 'ok' }, calendarErrors: 0 },
    syncStatus: { generatedAt: at(0), sources: { calendars: { lastSuccessAt: at(10), lastFailureAt: null, lastFailureReason: '' } }, network: { ok: true, since: null } },
    netwatch: { failures: 0, lastOkAt: at(1) },
    remoteLast: { present: false },
    wall: { reporting: true, ageSeconds: 4, quiet: false },
  };
  return Object.assign(base, changes);
}

test('all good says All good, with the five dots in the order of the plan and a word for each', () => {
  const found = overview();
  assert.deepEqual(buildBanner(found, now), { state: 'good', count: 0, words: 'All good', checked: '3:30 PM' });
  assert.deepEqual(buildDots(found, now).map(dot => dot.id + ':' + dot.state + ':' + dot.words), ['sanity:ok:OK', 'monday:ok:OK', 'band:ok:OK', 'network:ok:OK', 'screen:ok:OK']);
  assert.deepEqual(buildProblems(found, now), []);
});

test('a failed calendar is one problem that names what still shows, and the banner counts it', () => {
  const found = overview({ syncStatus: { sources: { calendars: { lastSuccessAt: at(95), lastFailureAt: at(5), lastFailureReason: 'secure connection failed' } }, network: { ok: true } } });
  const banner = buildBanner(found, now);
  assert.deepEqual([banner.state, banner.count, banner.words, banner.severity], ['attention', 1, 'Needs attention: 1 problem', 'bad']);
  const problems = buildProblems(found, now);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].message, "Calendars didn't update. The last good copy from 1:55 PM is still showing.");
  assert.equal(buildDots(found, now).find(dot => dot.id === 'band').state, 'bad');
  assert.equal(sourceState(found, 'calendars'), 'failed');
});

test('when the internet is down only the network is listed, from the watchdog, the sync file or the helper, and a missing member is quietly left out', () => {
  assert.equal(networkDown(overview({ netwatch: { failures: 3 } })), true);
  assert.equal(networkDown(overview({ netwatch: { failures: 2 } })), false);
  assert.equal(networkDown(overview({ syncStatus: { sources: {}, network: { ok: false } } })), true);
  assert.equal(networkDown(overview({ netwatch: null, status: { network: { state: 'down' }, dots: {} } })), true);
  const found = overview({ netwatch: { failures: 6, lastOkAt: at(12) }, syncStatus: { sources: { calendars: { lastSuccessAt: at(95), lastFailureAt: at(5), lastFailureReason: 'resolve failed' } } } });
  const problems = buildProblems(found, now);
  assert.deepEqual(problems.map(problem => problem.id), ['network']);
  assert.equal(problems[0].message, "The computer can't reach the internet. The screen shows saved data.");
  const bare = overview({ netwatch: null, syncStatus: null });
  assert.equal(buildDots(bare, now).find(dot => dot.id === 'network').state, 'ok', 'the helper says the network is ok');
  assert.equal(buildBanner(null, now).state, 'unknown');
});

test('a screen that stopped reporting is a problem with Restart the dashboard as its fix', () => {
  const problems = buildProblems(overview({ wall: { reporting: true, ageSeconds: 300, quiet: true } }), now);
  assert.equal(problems[0].id, 'screen');
  assert.deepEqual(problems[0].fixes.map(fix => fix.id), ['restart-screen']);
});

test('the last remote action reads as one line', () => {
  assert.equal(remoteWords({ present: false }, now), '');
  assert.equal(remoteWords({ present: true, action: 'restart-kiosk', requestedBy: 'Jason', handledAt: at(20), result: 'Done.', via: 'sanity' }, now), 'Restart the dashboard, asked by Jason, 3:10 PM, 20 min ago. Done.');
});

test('the page asks again after 10, 20, 40 and at most 60 seconds, and the sign-in says how long to wait', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 8].map(failures => waitAfter(failures)), [10000, 10000, 20000, 40000, 60000, 60000]);
  assert.equal(waitWords(3600), 'Try again in 60 minutes.');
  assert.equal(waitWords(40), 'Try again in 40 seconds.');
});

test('GET overview reads the files of the other services, passes on only the fields the page uses, and tolerates every file missing or damaged', async () => {
  const world = await makeWorld([statusRoute, overviewRoute], { answers: { 'status-mini': { result: { mini: { lastCalendarSyncAt: new Date().toISOString() } } } } });
  world.ctx.state = {};
  world.ctx.netwatchFile = path.join(world.root, 'netwatch.json');
  const bare = await world.router.call('GET', '/overview');
  assert.equal(bare.status, 200);
  assert.deepEqual([bare.json.syncStatus, bare.json.netwatch, bare.json.remoteLast], [null, null, { present: false }]);
  assert.equal(bare.json.wall.reporting, false);
  assert.ok(bare.json.status && bare.json.status.dots, 'the status is the same answer as GET status');

  fs.writeFileSync(path.join(world.dataDir, 'sync-status.json'), JSON.stringify({ generatedAt: '2026-10-31T15:00:00Z', sources: { calendars: { lastSuccessAt: '2026-10-31T14:50:00Z', lastFailureAt: null, lastFailureReason: '', secret: 'x' } }, other: 'x' }));
  fs.writeFileSync(world.ctx.netwatchFile, JSON.stringify({ failures: 2, lastCheckAt: 'a', lastOkAt: 'b', lastAction: 'restart_network', lastActionAt: 'c', lastRebootAt: null, extra: 1 }));
  fs.writeFileSync(path.join(world.dataDir, 'remote-last.json'), JSON.stringify({ action: 'reboot', requestedBy: 'Jason', handledAt: '2026-10-31T15:00:00Z', result: 'Done.', via: 'sanity', token: 'x' }));
  world.ctx.state = {};
  const full = await world.router.call('GET', '/overview');
  assert.equal(full.json.syncStatus.sources.calendars.lastSuccessAt, '2026-10-31T14:50:00Z');
  assert.equal(full.json.syncStatus.network, null, 'the network member is optional');
  assert.deepEqual(Object.keys(full.json.syncStatus.sources.calendars).sort(), ['lastFailureAt', 'lastFailureReason', 'lastSuccessAt']);
  assert.equal(full.json.netwatch.failures, 2);
  assert.ok(!('extra' in full.json.netwatch));
  assert.deepEqual(full.json.remoteLast, { present: true, action: 'reboot', requestedBy: 'Jason', handledAt: '2026-10-31T15:00:00Z', result: 'Done.', via: 'sanity' });

  fs.writeFileSync(path.join(world.dataDir, 'remote-last.json'), '{ not json');
  assert.deepEqual((await world.router.call('GET', '/remote-last')).json, { present: false });
  world.ctx.state = {};
  world.ctx.state.wallSeen = { report: { view: 'nova', theme: 'retro', panel: 'tasks', build: 'v14 abc', pause: true }, received: new Date() };
  const wall = (await world.router.call('GET', '/overview')).json.wall;
  assert.deepEqual([wall.reporting, wall.quiet, wall.showing.view, wall.showing.paused], [true, false, 'Nova', true]);
  world.pin = false;
  assert.equal((await world.router.call('GET', '/overview')).status, 401, 'the PIN is needed');
});

// ----- readiness for a private tunnel: relative addresses, HTTPS under another name, the lockout -----

async function service() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-lock-'));
  fs.mkdirSync(path.join(root, 'data'));
  const config = Object.assign(readConfig({ CONTROL_ROOT: root, CONTROL_DATA: path.join(root, 'data') }), { port: 0 });
  const { server } = await createService(config);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: 'http://127.0.0.1:' + server.address().port };
}

const post = (base, pin, headers = {}) => fetch(base + '/control/api/login', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify({ pin: pin }) });

test('repeated wrong PINs block the address: a clear 401 with the tries left, then a 429 with the wait, and the right PIN waits too', async () => {
  const s = await service();
  try {
    const first = await post(s.base, '0000');
    assert.equal(first.status, 401);
    const said = await first.json();
    assert.equal(said.error, 'That PIN is not right.');
    assert.equal(said.triesLeft, triesAllowed - 1);
    let last;
    for (let again = 1; again < triesAllowed; again += 1) last = await post(s.base, '0000');
    assert.equal(last.status, 429);
    const blocked = await last.json();
    assert.match(blocked.error, /^Too many wrong tries\. Try again in \d+ minutes\.$/);
    assert.ok(blocked.blockedSeconds > 0);
    const right = await post(s.base, '3229');
    assert.equal(right.status, 429, 'the right PIN does not get through during the block');
    assert.equal(right.headers.get('set-cookie'), null);
  } finally { s.server.close(); }
});

test('the cookie keeps its behaviour and gains Secure only over HTTPS, and a call from the page under another host name is accepted', async () => {
  const s = await service();
  try {
    const plain = await post(s.base, '3229');
    assert.equal(plain.status, 200);
    const cookie = plain.headers.get('set-cookie');
    assert.match(cookie, /Path=\/control; HttpOnly; SameSite=Strict; Max-Age=2592000$/);
    const secure = await post(s.base, '3229', { 'X-Forwarded-Proto': 'https' });
    assert.match(secure.headers.get('set-cookie'), /; Secure$/);
  } finally { s.server.close(); }
  assert.equal(isSecure({ headers: { 'x-forwarded-proto': 'https' } }), true);
  assert.equal(isSecure({ headers: {}, socket: { encrypted: true } }), true);
  assert.equal(isSecure({ headers: {} }), false);
  assert.equal(sameOrigin({ headers: { origin: 'https://box.example.net', host: 'teletraan:3230', 'x-forwarded-host': 'box.example.net' } }), true);
  assert.equal(sameOrigin({ headers: { origin: 'https://other.example.net', host: 'teletraan:3230', 'x-forwarded-host': 'box.example.net' } }), false);
  assert.equal(sameOrigin({ headers: { origin: 'https://box.example.net', host: 'box.example.net', 'sec-fetch-site': 'cross-site' } }), false);
});

test('no file of the page names a host, an address or an absolute /control path: every call and link is relative', () => {
  const folder = new URL('../control/static/', import.meta.url).pathname;
  const files = [];
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    if (entry.isDirectory()) { if (entry.name !== 'vendor' && entry.name !== 'fonts') walk(path.join(dir, entry.name)); }
    else if (/\.(js|html|css)$/.test(entry.name)) files.push(path.join(dir, entry.name));
  });
  walk(folder);
  files.forEach(file => {
    const code = fs.readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n');
    assert.ok(!/teletraan\.local|\b192\.168\.|\b10\.\d+\.\d+\.\d+|https?:\/\/[A-Za-z0-9]/.test(code.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), path.relative(folder, file) + ' names a host');
    assert.ok(!/['"`]\/control\//.test(code), path.relative(folder, file) + ' has an absolute /control path');
  });
});

test('the last network repair reads in words, and the compose file lets the control service see netwatch.json read only', () => {
  assert.equal(networkActionWords({ lastAction: 'restart_network', lastActionAt: at(20) }, now), 'Restarted the network service, 3:10 PM, 20 min ago');
  assert.equal(networkActionWords({ lastAction: 'none' }, now), '');
  assert.equal(networkActionWords(null, now), '');
  const compose = fs.readFileSync(new URL('../computer/docker-compose.yml', import.meta.url), 'utf8');
  assert.match(compose, /CONTROL_NETWATCH: \/var\/lib\/teletraan-state\/netwatch\.json/);
  assert.match(compose, /target: \/var\/lib\/teletraan-state\n\s+read_only: true/);
});

await finish();
