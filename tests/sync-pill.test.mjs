// Tests for the status pill and the error guard of the dashboard: core/sync-status.js (what the pill says), core/sync-pill.js
// (the words and the element), guard.js (no error text on the screen) and the places they are wired in. No browser: the
// rules are plain functions, and the guard runs in a fake window.
//
//   node tests/sync-pill.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseSyncStatus, pillState, limitsOf } from '../dashboard/core/sync-status.js';
import { pillText } from '../dashboard/core/sync-pill.js';
import { syncDownMinutes, syncStaleMinutes, syncSourceMinutes } from '../dashboard/core/constants.js';
import { formatTimeOfDay } from '../dashboard/core/time.js';

const dashboard = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboard, file), 'utf8');
let passed = 0;

async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const now = new Date(2026, 9, 30, 15, 30, 0);
const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();

// A status file: every source fresh to start with, and the changes a test asks for (a number is minutes ago, null is never)
function statusFile(changes = {}, generatedMinutes = 0) {
  const sources = {};
  const fresh = { sanity: 1, weather: 5, images: 2, monday: 12, competition: 3, calendars: 8 };
  Object.keys(fresh).forEach(name => {
    const minutes = name in changes ? changes[name] : fresh[name];
    sources[name] = { lastSuccessAt: minutes === null ? null : ago(minutes), lastFailureAt: null, lastFailureReason: '' };
  });
  return { generatedAt: ago(generatedMinutes), sources: sources };
}

const stateOf = (file, mondayMinutes) => pillState(parseSyncStatus(file), now, mondayMinutes);

await check('the limits are in constants.js: 10 minutes late, 30 minutes down', () => {
  assert.equal(syncStaleMinutes, 10);
  assert.equal(syncDownMinutes, 30);
  assert.deepEqual(Object.keys(syncSourceMinutes), ['sanity', 'weather', 'images', 'monday', 'competition', 'calendars']);
});

await check('everything fresh draws no pill', () => {
  assert.deepEqual(stateOf(statusFile()), { state: 'ok', since: null });
  assert.equal(pillText(stateOf(statusFile())), '');
});

await check('no status file (a laptop with no sync service) draws no pill', () => {
  assert.deepEqual(pillState(null, now), { state: 'ok', since: null });
  assert.equal(parseSyncStatus(null), null);
  assert.equal(parseSyncStatus({ hello: 'world' }), null);
  assert.equal(parseSyncStatus('text'), null);
});

await check('a source more than 10 minutes without a good read makes the pill amber, with the time of its last good read', () => {
  const state = stateOf(statusFile({ sanity: 11 }));
  assert.equal(state.state, 'late');
  assert.equal(state.since.getTime(), now.getTime() - 11 * 60000);
  assert.equal(pillText(state), 'Offline since ' + formatTimeOfDay(state.since));
  assert.equal(stateOf(statusFile({ sanity: 10 })).state, 'ok', 'exactly 10 minutes is not more than 10');
});

await check('the time is the oldest late source, so it names when the trouble began', () => {
  const state = stateOf(statusFile({ sanity: 13, weather: 40 }));
  assert.equal(state.state, 'late');
  assert.equal(state.since.getTime(), now.getTime() - 40 * 60000);
});

await check('it is red only when every source in use is more than 30 minutes without a good read', () => {
  assert.equal(stateOf(statusFile({ sanity: 31, weather: 50, images: 31, monday: 200, competition: 31, calendars: 50 })).state, 'down');
  assert.equal(stateOf(statusFile({ sanity: 31, weather: 50, images: 31, monday: 200, competition: 31, calendars: 20 })).state, 'late');
  assert.equal(stateOf(statusFile({ sanity: 45, weather: 50 })).state, 'late', 'images is fresh');
});

await check('a source that has never run and never failed is not in use and does not count', () => {
  const file = statusFile({ competition: null, monday: null });
  assert.equal(stateOf(file).state, 'ok');
  const allOld = statusFile({ sanity: 40, weather: 50, images: 40, monday: null, competition: null, calendars: 50 });
  assert.equal(stateOf(allOld).state, 'down', 'the two that are not in use do not hold the pill at amber');
});

await check('a source that failed and never had a good read counts as late, and the pill still has a time to show or none', () => {
  const file = statusFile({ calendars: null });
  file.sources.calendars.lastFailureAt = ago(5);
  file.sources.calendars.lastFailureReason = 'the server took too long to answer';
  const state = stateOf(file);
  assert.equal(state.state, 'late');
  assert.ok(state.since instanceof Date, 'it falls back to the time of the file');
});

await check('a slow source is late after twice its own gap, not after 10 minutes', () => {
  assert.deepEqual(limitsOf('monday', 120), { late: 240, down: 360 });
  assert.deepEqual(limitsOf('calendars'), { late: 30, down: 45 });
  assert.deepEqual(limitsOf('sanity'), { late: 10, down: 30 });
  assert.equal(stateOf(statusFile({ monday: 100 }), 60).state, 'ok', 'Monday every 60 minutes is not late at 100');
  assert.equal(stateOf(statusFile({ monday: 130 }), 60).state, 'late');
  assert.equal(stateOf(statusFile({ calendars: 25 })).state, 'ok', 'calendars every 15 minutes');
});

await check('a status file older than 10 minutes counts as every source late, and older than 30 as every source down', () => {
  const stale = statusFile({}, 11);
  assert.equal(stateOf(stale).state, 'late');
  assert.equal(stateOf(statusFile({}, 31)).state, 'down');
  assert.equal(stateOf(statusFile({}, 10)).state, 'ok');
  const old = stateOf(stale);
  assert.ok(old.since.getTime() <= now.getTime() - 11 * 60000, 'since is when the sources last read, before the file was last written');
  const noTime = { generatedAt: 'later', sources: statusFile().sources };
  assert.equal(stateOf(noTime).state, 'down', 'a file with no usable time is as old as it can be');
});

await check('a file with a missing or odd source still gives an answer', () => {
  const file = statusFile();
  delete file.sources.images;
  file.sources.weather = 'broken';
  const parsed = parseSyncStatus(file);
  assert.equal(parsed.sources.images.success, null);
  assert.equal(parsed.sources.weather.success, null);
  assert.equal(pillState(parsed, now).state, 'ok');
});

await check('the network member is read when it is there and null when it is not', () => {
  const file = statusFile();
  assert.equal(parseSyncStatus(file).network, null, 'an older file has none');
  file.network = { ok: false, since: '2026-10-30T14:00:00Z' };
  assert.deepEqual(parseSyncStatus(file).network, { ok: false, since: Date.parse('2026-10-30T14:00:00Z') });
  file.network = { ok: 'no' };
  assert.equal(parseSyncStatus(file).network, null);
});

await check('the words are Offline and a time, and nothing else: no host, no reason, no error', () => {
  const text = pillText({ state: 'down', since: new Date(2026, 9, 30, 15, 12) });
  assert.equal(text, 'Offline since 3:12 PM');
  assert.equal(pillText({ state: 'late', since: null }), 'Offline');
  assert.ok(!/error|failed|network|sanity|http|\./i.test(text));
});

await check('the pill is in index.html after the dots, drawn by shell.js, and has a 30px label that fades with opacity only', () => {
  const html = read('index.html');
  assert.ok(html.includes('<div id="sync-pill"'));
  assert.ok(html.indexOf('id="sync-pill"') > html.indexOf('id="status-dots"') && html.indexOf('id="sync-pill"') < html.indexOf('id="night"'));
  assert.ok(html.includes('href="sync-pill.css?v=0"'));
  assert.ok(read('shell.js').includes('module.startSyncPill(getContent, shellState.showingSample)'));

  const css = read('sync-pill.css');
  assert.match(css, /font:\s*600 30px\//);
  assert.match(css, /transition:\s*opacity 600ms/);
  assert.ok(!/transition:[^;]*(transform|all|width|height|left|top|filter)/.test(css));
  assert.ok(!/(shadow|blur|filter|animation|#[0-9a-fA-F]{3,8}\b)/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'tokens only, no effects');
  assert.match(css, /#sync-pill\[data-state="late"\],\s*#sync-pill\[data-state="down"\]\s*\{\s*opacity: 1;/);
  assert.match(css, /opacity: 0;/, 'hidden by default');
});

await check('the Sanity dot follows the sync service, and no panel is changed', () => {
  const dots = read('core/dots-run.js');
  assert.ok(dots.includes('sanityReadTime()') && dots.includes("from './sync-status.js'"));
  ['monday', 'band', 'sanity', 'network'].forEach(name => assert.ok(read('core/dots.js').includes("'" + name + "'")));
});

// ----- the guard -----

function guardWindow() {
  const logged = [];
  const listeners = {};
  const window = {
    fetch: undefined,
    addEventListener: (type, run) => { listeners[type] = run; },
  };
  const context = vm.createContext({ window: window, console: { error: (...args) => logged.push(args.join(' ')) }, Promise: Promise });
  return { window, context, listeners, logged };
}

await check('guard.js is the first script of the page and draws nothing', () => {
  const html = read('index.html');
  const guard = html.indexOf('<script src="guard.js"></script>');
  assert.ok(guard > 0, 'guard.js is loaded');
  assert.ok(guard < html.indexOf('rel="stylesheet"'), 'before the stylesheets');
  assert.ok(guard < html.indexOf('shell.js'), 'before the shell');
  const code = read('guard.js').replace(/\/\/[^\n]*/g, '');
  assert.ok(!/document\.|innerHTML|textContent|createElement/.test(code), 'it never touches the page');
});

await check('a script error is logged and handled, so the browser draws nothing for it', () => {
  const world = guardWindow();
  vm.runInContext(read('guard.js'), world.context);
  assert.equal(world.window.onerror('boom', 'x.js', 3), true, 'returning true stops the browser from reporting it');
  assert.equal(world.logged.length, 1);
  assert.match(world.logged[0], /kept off the screen/);
});

await check('a promise nobody caught is logged and its default is prevented', () => {
  const world = guardWindow();
  vm.runInContext(read('guard.js'), world.context);
  let prevented = false;
  world.listeners.unhandledrejection({ reason: new Error('no'), preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(world.logged.length, 1);
});

await check('a failed request is logged and the caller still gets the failure', async () => {
  const world = guardWindow();
  world.window.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  vm.runInContext(read('guard.js'), world.context);
  let caught = null;
  await world.window.fetch('x').catch(error => { caught = error; });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(caught && caught.message === 'Failed to fetch', 'the caller sees the failure');
  assert.equal(world.logged.length, 1);
  assert.match(world.logged[0], /request failed/);
});

await check('a good request goes through untouched', async () => {
  const world = guardWindow();
  world.window.fetch = (url) => Promise.resolve({ ok: true, url: url });
  vm.runInContext(read('guard.js'), world.context);
  const answer = await world.window.fetch('x');
  assert.deepEqual(answer, { ok: true, url: 'x' });
  assert.equal(world.logged.length, 0);
});

console.log(passed + ' of ' + passed + ' checks passed.');
