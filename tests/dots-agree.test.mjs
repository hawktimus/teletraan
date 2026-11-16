// The four dots on the TV and the dots of the control page must say the same thing for the same sync-status.json
// (core/dots.js, factsFromSyncStatus). Both start from the file the sync service writes; neither waits for a round
// trip through Sanity. A source that has not been read since the service started is grey for five minutes, then amber.
//
//   node tests/dots-agree.test.mjs

import assert from 'node:assert/strict';
import { test, finish } from './helpers/runner.mjs';
import { dotStates, factsFromSyncStatus } from '../dashboard/core/dots.js';
import { parseSyncStatus } from '../dashboard/core/sync-status.js';
import { buildStatus } from '../control/support/status-parts.js';

const now = new Date('2026-11-16T15:00:00Z');
const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();

function file(parts) {
  const base = { generatedAt: ago(0), startedAt: ago(120), network: { ok: true, since: null }, sources: {} };
  ['sanity', 'weather', 'images', 'monday', 'competition', 'calendars'].forEach(name => {
    base.sources[name] = { lastSuccessAt: ago(1), lastFailureAt: null, lastFailureReason: '' };
  });
  Object.keys(parts.sources || {}).forEach(name => Object.assign(base.sources[name], parts.sources[name]));
  return Object.assign(base, parts.top || {});
}

// What the TV does (core/dots-run.js): the file, cleaned, then the facts, then the colours
function onTheTv(raw) {
  return dotStates(Object.assign({ everyMinutes: 30 }, factsFromSyncStatus(parseSyncStatus(raw))), now);
}

// What the control page does (control/support/status-parts.js): the same file, and the Sanity documents it no longer needs
function onControl(raw) {
  return buildStatus({ syncStatus: parseSyncStatus(raw), sanity: { ok: true, error: '' }, data: { monday: { lastSyncAt: ago(600) }, settings: { mondayEveryMinutes: 30 } } }, now).dots;
}

const colours = dots => Object.fromEntries(Object.keys(dots).sort().map(name => [name, dots[name].color]));

const cases = {
  'everything fresh': [file({}), { monday: 'green', band: 'green', sanity: 'green', network: 'green' }],
  'just restarted, nothing read yet': [file({ top: { startedAt: ago(1) }, sources: { monday: { lastSuccessAt: null }, calendars: { lastSuccessAt: null }, sanity: { lastSuccessAt: null } } }), { monday: 'grey', band: 'grey', sanity: 'grey', network: 'green' }],
  'restarted ten minutes ago and still nothing read': [file({ top: { startedAt: ago(10) }, sources: { monday: { lastSuccessAt: null }, calendars: { lastSuccessAt: null } } }), { monday: 'amber', band: 'amber', sanity: 'green', network: 'green' }],
  'Monday failed after its last good read': [file({ sources: { monday: { lastSuccessAt: ago(20), lastFailureAt: ago(2), lastFailureReason: 'http 401' } } }), { monday: 'red', band: 'green', sanity: 'green', network: 'green' }],
  'an old failure that a later read cured': [file({ sources: { monday: { lastSuccessAt: ago(1), lastFailureAt: ago(40), lastFailureReason: 'http 500' } } }), { monday: 'green', band: 'green', sanity: 'green', network: 'green' }],
  'the calendars are late': [file({ sources: { calendars: { lastSuccessAt: ago(45) } } }), { monday: 'green', band: 'amber', sanity: 'green', network: 'green' }],
  'Sanity unreadable and the network down': [file({ top: { network: { ok: false, since: ago(8) } }, sources: { sanity: { lastSuccessAt: ago(30), lastFailureAt: ago(1), lastFailureReason: 'fetch failed' } } }), { monday: 'green', band: 'green', sanity: 'red', network: 'red' }],
};

Object.keys(cases).forEach(name => {
  test(name + ': the TV and the control page show the same four colours', () => {
    const [raw, expected] = cases[name];
    assert.deepEqual(colours(onTheTv(raw)), expected, 'the TV');
    assert.deepEqual(colours(onControl(raw)), expected, 'the control page');
  });
});

test('Control reaching Sanity is a separate fact: it does not change the Sanity dot when the service has a file', () => {
  const raw = file({});
  const unreachable = buildStatus({ syncStatus: parseSyncStatus(raw), sanity: { ok: false, error: 'timeout' }, data: null }, now);
  assert.equal(unreachable.dots.sanity.color, 'green', 'the service read Sanity a minute ago');
  assert.equal(unreachable.sanity.reachable, false, 'and this page could not reach it just now');
});

test('without the file the dots fall back to the Sanity documents, as before', () => {
  const fromDocuments = buildStatus({ sanity: { ok: true, error: '' }, data: { monday: { lastSyncAt: ago(5) }, mini: { lastCalendarSyncAt: ago(5) }, settings: { mondayEveryMinutes: 30 } } }, now).dots;
  assert.equal(colours(fromDocuments).monday, 'green');
  assert.equal(factsFromSyncStatus(null), null);
});

finish();
