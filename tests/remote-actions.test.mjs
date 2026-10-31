// Tests for the remote actions: the decisions (computer/scripts/remote-plan.mjs), the poller with a fake Sanity and a
// fake helper (remote-poller.mjs), the log helper, the schemas and the Studio buttons. No network, no systemd.
//
//   node tests/remote-actions.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { openStudio } from './helpers/studio-world.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const scripts = pathToFileURL(path.join(repo, 'computer/scripts/')).href;
const plan = await import(scripts + 'remote-plan.mjs');
const poller = await import(scripts + 'remote-poller.mjs');
const jsonlog = await import(scripts + 'jsonlog.mjs');

const minute = 60 * 1000;
const now = Date.parse('2026-10-30T12:00:00Z');
const ago = minutes => new Date(now - minutes * minute).toISOString();

function request(action, minutesAgo, extra) {
  return Object.assign({ _rev: 'r1', action: action, requestedAt: ago(minutesAgo), requestedBy: 'Sam' }, extra);
}

test('a fresh new request runs with its fixed word', () => {
  assert.equal(plan.decide(request('restart_dashboard', 1), now, null).word, 'restart-kiosk');
  assert.equal(plan.decide(request('restart_services', 1), now, null).word, 'restart-services');
  assert.equal(plan.decide(request('reboot_computer', 1), now, null).word, 'reboot');
});

test('a request older than 10 minutes is marked ignored and does not run', () => {
  const answer = plan.decide(request('reboot_computer', 11), now, null);
  assert.equal(answer.kind, 'skip');
  assert.equal(answer.result, 'ignored: too old');
  assert.equal(plan.decide(request('restart_dashboard', 9.9), now, null).kind, 'run');
});

test('a request that was handled already is not run again', () => {
  assert.equal(plan.decide(request('restart_dashboard', 3, { lastHandledAt: ago(4) }), now, null).kind, 'run');
  assert.equal(plan.decide(request('restart_dashboard', 3, { lastHandledAt: ago(3) }), now, null).kind, 'nothing');
  assert.equal(plan.decide(request('restart_dashboard', 3, { lastHandledAt: ago(1) }), now, null).kind, 'nothing');
});

test('the handled time is never earlier than the request, so a fast browser clock cannot replay it', () => {
  const ahead = request('restart_dashboard', -1);
  const answer = plan.decide(ahead, now, null);
  assert.equal(answer.kind, 'run');
  assert.equal(answer.handledAt, ahead.requestedAt);
  assert.equal(plan.decide(Object.assign({}, ahead, { lastHandledAt: answer.handledAt }), now + 30000, null).kind, 'nothing');
});

test('a time far in the future is ignored', () => {
  assert.equal(plan.decide(request('reboot_computer', -30), now, null).result, 'ignored: time is in the future');
});

test('an unknown action is refused, whatever it holds', () => {
  const odd = ['rm -rf /', 'restart_dashboard; reboot', 'RESTART_DASHBOARD', ' restart_dashboard', 'reboot', 'toString', '__proto__', 'constructor', 'hasOwnProperty'];
  odd.forEach(text => {
    const answer = plan.decide(request(text, 1), now, null);
    assert.equal(answer.kind, 'skip', text);
    assert.equal(answer.result, 'refused: unknown action', text);
    assert.equal(answer.word, undefined, text);
  });
});

test('no request, no action or a bad time means nothing to do', () => {
  assert.equal(plan.decide(null, now, null).kind, 'nothing');
  assert.equal(plan.decide({}, now, null).kind, 'nothing');
  assert.equal(plan.decide({ action: 'restart_dashboard' }, now, null).kind, 'nothing');
  assert.equal(plan.decide({ action: 'restart_dashboard', requestedAt: 'tomorrow' }, now, null).kind, 'nothing');
  assert.equal(plan.decide({ action: 7, requestedAt: ago(1) }, now, null).kind, 'nothing');
});

test('only one reboot in 10 minutes, and the limit does not touch the other actions', () => {
  assert.equal(plan.decide(request('reboot_computer', 1), now, ago(9)).kind, 'skip');
  assert.equal(plan.decide(request('reboot_computer', 1), now, ago(9)).result, 'ignored: a reboot already ran in the last 10 minutes');
  assert.equal(plan.decide(request('reboot_computer', 1), now, ago(10)).kind, 'run');
  assert.equal(plan.decide(request('reboot_computer', 1), now, 'not a time').kind, 'run');
  assert.equal(plan.decide(request('restart_services', 1), now, ago(1)).kind, 'run');
});

test('the only words that can be sent are the table, and they are all in the helper', () => {
  assert.deepEqual([...new Set(Object.values(plan.wordOf))].sort(), ['reboot', 'restart-kiosk', 'restart-services', 'sync-now']);
  const helper = fs.readFileSync(path.join(repo, 'computer/scripts/control-helper.sh'), 'utf8');
  Object.values(plan.wordOf).forEach(word => assert.ok(helper.includes(word), word));
  assert.ok(Object.isFrozen(plan.wordOf) && Object.isFrozen(plan.linesOf) && Object.isFrozen(plan.linesOf.sync_all));
});

test('every sync source that can be sent is one the helper accepts, and the helper list is the plan list', () => {
  const helper = fs.readFileSync(path.join(repo, 'computer/scripts/control-helper.sh'), 'utf8');
  const found = helper.match(/sync-now\)\s*case \$argument in\s*([a-z0-9|-]+)\) ;;/);
  assert.ok(found, 'the sync-now case of the helper');
  const accepted = found[1].split('|').sort();
  assert.deepEqual(accepted, [...plan.helperSyncSources].sort());
  const sent = Object.values(plan.linesOf).flat().filter(line => line.startsWith('sync-now '));
  sent.forEach(line => assert.ok(accepted.includes(line.slice('sync-now '.length)), line));
  assert.equal(plan.linesOf.sync_all.length, 6);
  assert.deepEqual(plan.linesOf.sync_competition, ['sync-now frc']);
  assert.deepEqual(plan.linesOf.sync_photos, ['sync-now photos-drive']);
});

test('every sync action runs its fixed line, and sync_all runs all six in order', () => {
  ['sync_calendars', 'sync_monday', 'sync_competition', 'sync_news', 'sync_match13', 'sync_photos'].forEach(action => {
    const answer = plan.decide(request(action, 1), now, null, null);
    assert.equal(answer.kind, 'run', action);
    assert.equal(answer.word, 'sync-now');
    assert.equal(answer.lines.length, 1);
    assert.equal(answer.settingsFields, null);
  });
  assert.deepEqual(plan.decide(request('sync_all', 1), now, null, null).lines, [
    'sync-now calendars', 'sync-now monday', 'sync-now frc', 'sync-now news', 'sync-now match13', 'sync-now photos-drive',
  ]);
});

test('a sync inside a minute of the last one is ignored, of any kind, and other actions are not limited', () => {
  const answer = plan.decide(request('sync_monday', 1), now, null, new Date(now - 59 * 1000).toISOString());
  assert.equal(answer.kind, 'skip');
  assert.equal(answer.result, 'ignored: a sync already ran in the last minute');
  assert.equal(plan.decide(request('sync_all', 1), now, null, ago(0.5)).kind, 'skip');
  assert.equal(plan.decide(request('sync_all', 1), now, null, ago(1)).kind, 'run');
  assert.equal(plan.decide(request('sync_all', 1), now, null, 'not a time').kind, 'run');
  assert.equal(plan.decide(request('restart_dashboard', 1), now, null, ago(0)).kind, 'run');
  assert.equal(plan.decide(request('reboot_computer', 1), now, null, ago(0)).kind, 'run');
});

test('stale and replayed sync and show requests are handled like the others', () => {
  assert.equal(plan.decide(request('sync_all', 11), now, null, null).result, 'ignored: too old');
  assert.equal(plan.decide(request('show_view', 11, { view: 'nova' }), now, null, null).result, 'ignored: too old');
  assert.equal(plan.decide(request('sync_all', 3, { lastHandledAt: ago(3) }), now, null, null).kind, 'nothing');
  assert.equal(plan.decide(request('pause_rotation', 3, { lastHandledAt: ago(2) }), now, null, null).kind, 'nothing');
  assert.equal(plan.decide(request('show_theme', -30, { theme: 'retro' }), now, null, null).result, 'ignored: time is in the future');
});

test('an action that is not in the table is refused and nothing is built from its text', () => {
  ['sync_slides', 'sync-all', 'sync_all; reboot', 'sync_', 'sync_monday ../x', 'SYNC_ALL', 'sync-now calendars', 'show_views', 'dns_public', 'set_dns'].forEach(text => {
    const answer = plan.decide(request(text, 1, { view: 'nova' }), now, null, null);
    assert.equal(answer.kind, 'skip', text);
    assert.equal(answer.result, 'refused: unknown action', text);
    assert.equal(answer.lines, undefined, text);
    assert.equal(answer.settingsFields, undefined, text);
  });
});

test('show view and show theme take only the words of the lists', () => {
  plan.viewValues.forEach(view => assert.equal(plan.decide(request('show_view', 1, { view: view }), now, null).kind, 'run', view));
  plan.themeValues.forEach(theme => assert.equal(plan.decide(request('show_theme', 1, { theme: theme }), now, null).kind, 'run', theme));
  assert.deepEqual([...plan.viewValues], ['general', 'prime', 'nova', 'family', 'auto']);
  assert.deepEqual([...plan.themeValues], ['original', 'cybertron', 'retro', 'foundry', 'auto']);
  ['robotics', 'NOVA', ' nova', 'nova; reboot', '', 'retro', '__proto__', 'toString', 7, null, ['nova']].forEach(view => {
    const answer = plan.decide(request('show_view', 1, { view: view }), now, null);
    assert.equal(answer.result, 'refused: unknown view', String(view));
    assert.equal(answer.settingsFields, undefined);
  });
  ['family', 'Cybertron', 'cybertron ', 'x', '', undefined].forEach(theme => {
    assert.equal(plan.decide(request('show_theme', 1, { theme: theme }), now, null).result, 'refused: unknown theme', String(theme));
  });
  assert.equal(plan.decide(request('show_view', 1), now, null).result, 'refused: unknown view');
});

test('the request fields written for a show action are exactly the screen request shape', () => {
  const until = new Date(now + 60 * minute).toISOString().replace(/\.\d{3}Z$/, 'Z');
  assert.deepEqual(plan.decide(request('show_view', 1, { view: 'nova' }), now, null).settingsFields, { showView: { key: 'nova', until: until } });
  assert.deepEqual(plan.decide(request('show_view', 1, { view: 'auto' }), now, null).settingsFields, { showView: { key: '', until: '' } });
  assert.deepEqual(plan.decide(request('show_theme', 1, { theme: 'retro' }), now, null).settingsFields, { previewTheme: { theme: 'retro', until: until } });
  assert.deepEqual(plan.decide(request('show_theme', 1, { theme: 'auto' }), now, null).settingsFields, { previewTheme: { theme: '', until: '' } });
  assert.deepEqual(plan.decide(request('pause_rotation', 1), now, null).settingsFields, { pauseRotation: { until: until } });
  assert.deepEqual(plan.decide(request('resume_rotation', 1), now, null).settingsFields, { pauseRotation: { until: '' } });
  const answer = plan.decide(request('show_view', 1, { view: 'nova' }), now, null);
  assert.equal(answer.word, null);
  assert.deepEqual(answer.lines, []);
});

test('the words of the show lists are the words the dashboard accepts', async () => {
  const requests = await import(pathToFileURL(path.join(repo, 'dashboard/core/screen-requests.js')).href);
  assert.deepEqual(plan.viewValues.filter(word => word !== 'auto'), requests.viewKeys);
  assert.deepEqual(plan.themeValues.filter(word => word !== 'auto'), requests.themeIds);
  assert.ok(plan.showMinutes <= requests.longestMinutes);
});

test('the last record for the control page has the fixed shape and a first name', () => {
  const record = plan.lastRecordOf(request('sync_all', 1, { requestedBy: 'Sam Smith 3' }), ago(0), 'done: sync_all');
  assert.deepEqual(record, { action: 'sync_all', requestedBy: 'Sam', handledAt: ago(0), result: 'done: sync_all', via: 'sanity' });
  assert.equal(plan.lastRecordOf(request('format everything', 1), ago(0), 'refused: unknown action').action, 'unknown');
  assert.ok(plan.lastRecordOf(request('sync_all', 1), ago(0), 'x'.repeat(500)).result.length <= 120);
});

test('the status carries the network state when the sync file has it and works without it', () => {
  const withNetwork = plan.statusOf({ sources: {}, network: { ok: false, since: ago(5) } }, null, null);
  assert.deepEqual(withNetwork.network, { ok: false, since: new Date(now - 5 * minute).toISOString() });
  assert.equal(plan.statusOf({ sources: {} }, null, null).network, undefined);
  assert.equal(plan.statusOf({ sources: {}, network: { ok: 'yes' } }, null, null).network, undefined);
  assert.equal(plan.statusOf({ sources: {}, network: 'down' }, null, null).network, undefined);
});

test('the status keeps first names, plain source names and no host names or addresses', () => {
  assert.equal(plan.firstNameOf('Sam Smith 3'), 'Sam');
  assert.equal(plan.firstNameOf('S4m!'), 'Sm');
  assert.equal(plan.safeReason('timeout reaching feeds.example-school.org at 10.1.2.3 via https://x.test/a?k=1'), 'timeout reaching [host] at [address] via [address]');
  assert.ok(plan.safeReason('x'.repeat(300)).length <= 120);
  const status = plan.statusOf({ sources: { monday: { lastSuccessAt: ago(1), lastFailureAt: null, lastFailureReason: 'HTTP 500 from api.monday.com' }, 'bad name!': {} } }, { failures: 2, lastAction: 'format_disk', lastCheckAt: ago(1) }, null);
  assert.deepEqual(status.sources.map(source => source.name), ['monday']);
  assert.equal(status.sources[0].lastFailureReason, 'HTTP 500 from [host]');
  assert.equal(status.netwatch.lastAction, 'none');
  assert.equal(plan.statusOf(null, null, null).netwatch, undefined);
});

test('the status is written when it changed or after 5 minutes', () => {
  const status = { a: 1 };
  const written = { at: now, text: JSON.stringify(status) };
  assert.equal(plan.statusDue(status, null, now), true);
  assert.equal(plan.statusDue(status, written, now + minute), false);
  assert.equal(plan.statusDue({ a: 2 }, written, now + minute), true);
  assert.equal(plan.statusDue(status, written, now + 5 * minute), true);
});

// A fake Sanity with one remoteControl document, and records of what the poller did
function world(doc, options) {
  const state = { doc: doc, writes: [], helperCalls: [], pushes: [], sleeps: [], logs: [], files: {}, failWrites: false, helperFails: false, clock: now, settings: { _id: 'dashboardSettings', _rev: 's1' }, settingsWrites: [], order: [], settingsConflicts: 0 };
  const settings = options || {};
  const deps = {
    fetch: async (url, init) => {
      if (!init || !init.method) {
        const asked = decodeURIComponent(url);
        return { ok: true, status: 200, json: async () => ({ result: asked.includes('dashboardSettings') ? state.settings : state.doc }) };
      }
      if (state.failWrites) return { ok: false, status: 500, json: async () => ({}) };
      for (const mutation of JSON.parse(init.body).mutations) {
        if (mutation.patch && mutation.patch.id === 'dashboardSettings') {
          if (state.settingsConflicts > 0) {
            state.settingsConflicts -= 1;
            state.settings._rev = 's' + Math.random();
            return { ok: false, status: 409, json: async () => ({}) };
          }
          assert.equal(mutation.patch.ifRevisionID, state.settings._rev, 'a revision check');
          Object.assign(state.settings, mutation.patch.set);
          state.settingsWrites.push(mutation.patch.set);
          state.order.push('settings');
          continue;
        }
        state.writes.push(mutation);
        if (mutation.patch) state.order.push('control:' + (mutation.patch.set.lastResult || ''));
        if (mutation.patch && state.doc) {
          Object.assign(state.doc, mutation.patch.set);
          state.doc._rev = 'r' + (state.writes.length + 1);
        }
      }
      return { ok: true, status: 200, json: async () => ({}) };
    },
    now: () => state.clock,
    readJson: file => (state.files[file] === undefined ? null : state.files[file]),
    writeJson: (file, value) => { state.files[file] = value; },
    helper: async word => { state.helperCalls.push(word); if (state.helperFails) throw new Error('the helper said: failed 1'); },
    notify: text => { state.pushes.push(text); if (settings.notifyThrows) throw new Error('no script'); },
    sleep: async ms => { state.sleeps.push(ms); },
    log: (event, detail) => state.logs.push({ event: event, detail: detail }),
    config: { project: 'p', dataset: 'd', version: '2025-02-19', token: 'T', stateFile: 'state', syncFile: 'sync', netwatchFile: 'net', lastFile: 'last' },
  };
  return { state: state, poller: poller.createPoller(deps) };
}

const patches = state => state.writes.filter(write => write.patch);

test('the poller writes the answer first, then sends the fixed word, then writes the result', async () => {
  const { state, poller: run } = world(request('restart_dashboard', 1));
  assert.equal(await run.pollOnce(), 'done');
  assert.deepEqual(state.helperCalls, ['restart-kiosk']);
  const writes = patches(state);
  assert.equal(writes[0].patch.set.lastResult, 'accepted: restart_dashboard');
  assert.equal(writes[1].patch.set.lastResult, 'done: restart_dashboard');
  assert.deepEqual(state.pushes, ['remote action received: restart_dashboard']);
  assert.equal(await run.pollOnce(), 'nothing');
  assert.deepEqual(state.helperCalls, ['restart-kiosk']);
});

test('nothing runs when the answer cannot be written', async () => {
  const { state, poller: run } = world(request('restart_services', 1));
  state.failWrites = true;
  assert.equal(await run.pollOnce(), 'unwritten');
  assert.deepEqual(state.helperCalls, []);
});

test('a stale request is answered and not run, and a replay is ignored', async () => {
  const { state, poller: run } = world(request('reboot_computer', 30));
  assert.equal(await run.pollOnce(), 'skip');
  assert.equal(state.doc.lastResult, 'ignored: too old');
  assert.deepEqual(state.helperCalls, []);
  assert.equal(await run.pollOnce(), 'nothing');
});

test('a reboot waits 5 seconds after the write, saves its time first, and a second one in 10 minutes is ignored', async () => {
  const { state, poller: run } = world(request('reboot_computer', 1));
  assert.equal(await run.pollOnce(), 'done');
  assert.deepEqual(state.sleeps, [5000]);
  assert.deepEqual(state.helperCalls, ['reboot']);
  assert.equal(state.files.state.lastRebootAt, new Date(now).toISOString());
  assert.equal(patches(state).length, 1, 'the result stays accepted: the computer is going down');

  state.clock = now + 2 * minute;
  state.doc.requestedAt = new Date(state.clock - minute).toISOString();
  assert.equal(await run.pollOnce(), 'skip');
  assert.match(state.doc.lastResult, /^ignored: a reboot already ran/);
  assert.deepEqual(state.helperCalls, ['reboot']);
});

test('an unknown action is refused and never reaches the helper', async () => {
  const { state, poller: run } = world(request('restart_dashboard && reboot', 1));
  assert.equal(await run.pollOnce(), 'skip');
  assert.equal(state.doc.lastResult, 'refused: unknown action');
  assert.deepEqual(state.helperCalls, []);
  assert.ok(state.pushes.every(text => !text.includes('&&')), 'text from Sanity is not put in the push');
});

test('a failing helper is written as failed, and a missing notifier changes nothing', async () => {
  const { state, poller: run } = world(request('restart_services', 1), { notifyThrows: true });
  state.helperFails = true;
  assert.equal(await run.pollOnce(), 'failed');
  assert.equal(state.doc.lastResult, 'failed: restart_services');
});

test('no document at all is a quiet round', async () => {
  const { state, poller: run } = world(null);
  assert.equal(await run.pollOnce(), 'nothing');
  assert.deepEqual(state.helperCalls, []);
});

test('a sync runs each fixed line, saves its time first, and a second one inside a minute is ignored', async () => {
  const { state, poller: run } = world(request('sync_all', 1));
  assert.equal(await run.pollOnce(), 'done');
  assert.equal(state.helperCalls.length, 6);
  assert.equal(state.helperCalls[0], 'sync-now calendars');
  assert.equal(state.doc.lastResult, 'done: sync_all');
  assert.equal(state.files.state.lastSyncAt, new Date(now).toISOString());

  state.clock = now + 30 * 1000;
  state.doc.action = 'sync_monday';
  state.doc.requestedAt = new Date(state.clock - 1000).toISOString();
  assert.equal(await run.pollOnce(), 'skip');
  assert.equal(state.doc.lastResult, 'ignored: a sync already ran in the last minute');
  assert.equal(state.helperCalls.length, 6);
});

test('the reboot time survives a sync and the sync time survives a reboot', async () => {
  const { state, poller: run } = world(request('reboot_computer', 1));
  await run.pollOnce();
  state.clock = now + 2 * minute;
  state.doc.action = 'sync_news';
  state.doc.requestedAt = new Date(state.clock - 1000).toISOString();
  await run.pollOnce();
  assert.equal(state.files.state.lastRebootAt, new Date(now).toISOString());
  assert.equal(state.files.state.lastSyncAt, new Date(now + 2 * minute).toISOString());
});

test('a failing sync line is written as failed after every line was tried', async () => {
  const { state, poller: run } = world(request('sync_all', 1));
  state.helperFails = true;
  assert.equal(await run.pollOnce(), 'failed');
  assert.equal(state.helperCalls.length, 6);
  assert.equal(state.doc.lastResult, 'failed: sync_all');
});

test('a show request is answered first, then the checked fields go to the published settings with a revision check', async () => {
  const { state, poller: run } = world(request('show_view', 1, { view: 'nova' }));
  assert.equal(await run.pollOnce(), 'done');
  assert.deepEqual(state.helperCalls, []);
  assert.deepEqual(state.settingsWrites.length, 1);
  assert.equal(state.settings.showView.key, 'nova');
  assert.match(state.settings.showView.until, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.deepEqual(Object.keys(state.settings).sort(), ['_id', '_rev', 'showView']);
  assert.deepEqual(state.order, ['control:accepted: show_view', 'settings', 'control:done: show_view']);
  assert.equal(await run.pollOnce(), 'nothing');
  assert.equal(state.settingsWrites.length, 1);
});

test('auto, pause and resume write the request fields the screen understands', async () => {
  const { state, poller: run } = world(request('pause_rotation', 1));
  await run.pollOnce();
  assert.match(state.settings.pauseRotation.until, /^2026-10-30T13:00:00Z$/);
  state.doc.action = 'resume_rotation';
  state.clock += minute;
  state.doc.requestedAt = new Date(state.clock - 1000).toISOString();
  await run.pollOnce();
  assert.deepEqual(state.settings.pauseRotation, { until: '' });
  state.doc.action = 'show_theme';
  state.doc.theme = 'retro';
  state.clock += minute;
  state.doc.requestedAt = new Date(state.clock - 1000).toISOString();
  await run.pollOnce();
  assert.equal(state.settings.previewTheme.theme, 'retro');
  state.doc.theme = 'auto';
  state.clock += minute;
  state.doc.requestedAt = new Date(state.clock - 1000).toISOString();
  await run.pollOnce();
  assert.deepEqual(state.settings.previewTheme, { theme: '', until: '' });
});

test('a bad view is refused and nothing is written to the settings', async () => {
  const { state, poller: run } = world(request('show_view', 1, { view: 'nova; reboot' }));
  assert.equal(await run.pollOnce(), 'skip');
  assert.equal(state.doc.lastResult, 'refused: unknown view');
  assert.equal(state.settingsWrites.length, 0);
  assert.deepEqual(state.helperCalls, []);
});

test('a Studio edit between the read and the write is retried once, a second one fails the request', async () => {
  const first = world(request('show_view', 1, { view: 'prime' }));
  first.state.settingsConflicts = 1;
  assert.equal(await first.poller.pollOnce(), 'done');
  assert.equal(first.state.settings.showView.key, 'prime');

  const second = world(request('show_view', 1, { view: 'prime' }));
  second.state.settingsConflicts = 2;
  assert.equal(await second.poller.pollOnce(), 'failed');
  assert.equal(second.state.doc.lastResult, 'failed: show_view');
  assert.equal(second.state.settingsWrites.length, 0);
});

test('every handled request leaves remote-last.json with the same result as the Sanity page', async () => {
  const run1 = world(request('sync_news', 1, { requestedBy: 'Sam' }));
  await run1.poller.pollOnce();
  assert.deepEqual(run1.state.files.last, { action: 'sync_news', requestedBy: 'Sam', handledAt: new Date(now).toISOString(), result: 'done: sync_news', via: 'sanity' });

  const run2 = world(request('reboot_computer', 40));
  await run2.poller.pollOnce();
  assert.equal(run2.state.files.last.result, 'ignored: too old');
  assert.equal(run2.state.files.last.via, 'sanity');

  const run3 = world(request('format everything', 1));
  await run3.poller.pollOnce();
  assert.equal(run3.state.files.last.action, 'unknown');
  assert.equal(run3.state.files.last.result, 'refused: unknown action');

  const run4 = world(request('reboot_computer', 1));
  await run4.poller.pollOnce();
  assert.equal(run4.state.files.last.result, 'accepted: reboot_computer');

  const quiet = world(null);
  await quiet.poller.pollOnce();
  assert.equal(quiet.state.files.last, undefined);
});

test('a round with nothing new does not rewrite remote-last.json', async () => {
  const { state, poller: run } = world(request('restart_dashboard', 1));
  await run.pollOnce();
  state.files.last = { marker: true };
  await run.pollOnce();
  assert.deepEqual(state.files.last, { marker: true });
});

test('the status document is written once, then only when it changes or after 5 minutes', async () => {
  const { state, poller: run } = world(request('restart_dashboard', 20, { lastHandledAt: ago(19), lastResult: 'done: restart_dashboard' }));
  state.files.sync = { generatedAt: ago(1), sources: { calendars: { lastSuccessAt: ago(2), lastFailureAt: null, lastFailureReason: '' } } };
  const statusWrites = () => state.writes.filter(write => write.createOrReplace);

  await run.pollOnce();
  assert.equal(statusWrites().length, 1);
  const document = statusWrites()[0].createOrReplace;
  assert.equal(document._id, 'remote-status');
  assert.equal(document._type, 'remoteStatus');
  assert.equal(document.lastRequest.requestedBy, 'Sam');
  assert.equal(document.lastRequest.via, 'sanity');
  assert.equal(document.checkedAt, document.updatedAt);
  assert.equal(document.lastRequest.result, 'done: restart_dashboard');
  assert.equal(document.sources[0].name, 'calendars');

  state.clock += minute;
  await run.pollOnce();
  assert.equal(statusWrites().length, 1);
  state.files.net = { failures: 1, lastCheckAt: ago(0), lastAction: 'restart_network', lastActionAt: ago(0) };
  await run.pollOnce();
  assert.equal(statusWrites().length, 2);
  state.clock += 6 * minute;
  await run.pollOnce();
  assert.equal(statusWrites().length, 3);
});

test('the helper client sends one word and reads the closing line', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-remote-'));
  const socketPath = path.join(folder, 'c.sock');
  const received = [];
  const server = net.createServer(connection => {
    let text = '';
    connection.on('data', chunk => { text += chunk; });
    connection.on('end', () => { received.push(text); connection.end(text.trim() === 'reboot' ? 'refused\n' : 'working\nok\n'); });
  });
  await new Promise(resolve => server.listen(socketPath, resolve));
  const helper = poller.helperOver(socketPath);
  await helper('restart-kiosk');
  await assert.rejects(helper('reboot'), /refused/);
  assert.deepEqual(received, ['restart-kiosk\n', 'reboot\n']);
  await assert.rejects(poller.helperOver(path.join(folder, 'none.sock'))('reboot'), /could not be reached/);
  server.close();
  fs.rmSync(folder, { recursive: true, force: true });
});

test('local.env is read for the names asked for only, as lib.sh does', () => {
  const text = 'A=1\nSANITY_WRITE_TOKEN="abc"\nOTHER=zzz\nSANITY_WRITE_TOKEN=\'last\'\n';
  assert.equal(poller.settingFrom(text, 'SANITY_WRITE_TOKEN'), 'last');
  assert.equal(poller.settingFrom(text, 'MISSING'), '');
});

test('the log writes one JSON line and never throws', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-log-'));
  process.env.TELETRAAN_LOG_DIR = folder;
  jsonlog.logEvent('remote', 'poller', 'poll', { result: 'ok' });
  const entry = JSON.parse(fs.readFileSync(path.join(folder, 'remote.jsonl'), 'utf8').trim().split('\n')[0]);
  assert.deepEqual([entry.service, entry.source, entry.event, entry.detail.result], ['remote', 'poller', 'poll', 'ok']);
  process.env.TELETRAAN_LOG_DIR = path.join(folder, 'remote.jsonl', 'not-a-folder');
  jsonlog.logEvent('remote', 'poller', 'poll');
  delete process.env.TELETRAAN_LOG_DIR;
  fs.rmSync(folder, { recursive: true, force: true });
});

test('the poller builds no shell command and keeps the token out of the log', () => {
  const source = fs.readFileSync(path.join(repo, 'computer/scripts/remote-poller.mjs'), 'utf8');
  assert.ok(!/\bexec\(|execSync|spawnSync|\bspawn\(/.test(source), 'only execFile, with an argument list');
  assert.ok(!/shell:\s*true/.test(source));
  assert.ok(!/log\([^)]*\btoken\b/.test(source), 'the token is not logged');
});

test('the unit, the installer, the make target and the docs are in place', () => {
  const unit = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-remote.service'), 'utf8');
  assert.match(unit, /^User=ACCOUNT$/m);
  assert.match(unit, /remote-poller\.mjs/);
  assert.match(fs.readFileSync(path.join(repo, 'computer/make/remote.mk'), 'utf8'), /^remote-status:/m);
  assert.match(fs.readFileSync(path.join(repo, 'computer/scripts/install-remote.sh'), 'utf8'), /teletraan-remote\.service/);
  assert.match(fs.readFileSync(path.join(repo, 'docs/OPERATIONS.md'), 'utf8'), /## Remote actions from Sanity/);
});

test('the Studio has the page, the status page and one button for each action', async () => {
  const studio = await openStudio();
  try {
    const control = (await studio.load('schemas/remoteControl.js')).default;
    assert.deepEqual(control.fields.map(field => field.name), ['action', 'view', 'theme', 'requestedAt', 'requestedBy', 'lastHandledAt', 'lastResult']);
    assert.deepEqual(control.fields[0].options.list.map(item => item.value), [...plan.allowedActions]);
    assert.deepEqual(control.fields[1].options.list, [...plan.viewValues]);
    assert.deepEqual(control.fields[2].options.list, [...plan.themeValues]);
    control.fields.forEach(field => assert.ok(field.description && field.readOnly, field.name));

    const status = (await studio.load('schemas/remoteStatus.js')).default;
    assert.equal(status.readOnly, true);
    assert.ok(status.fields.some(field => field.name === 'network') && status.fields.some(field => field.name === 'checkedAt'));

    const tools = await studio.load('tools/remote-actions.js');
    assert.deepEqual(tools.remoteActionButtons.map(button => button.action), ['restartDashboard', 'restartServices', 'rebootComputer', 'syncNow', 'showView', 'showTheme', 'pauseRotation', 'resumeRotation']);
    assert.deepEqual(tools.syncChoices.map(item => item.value), ['sync_all', 'sync_calendars', 'sync_monday', 'sync_competition', 'sync_news', 'sync_match13', 'sync_photos']);
    assert.deepEqual(tools.viewChoices.map(item => item.value), [...plan.viewValues]);
    assert.deepEqual(tools.themeChoices.map(item => item.value), [...plan.themeValues]);
    assert.deepEqual(tools.staleFields({ view: 'nova' }), ['theme']);
    assert.deepEqual(tools.staleFields({}), ['view', 'theme']);
    assert.deepEqual(tools.requestFields('show_view', { name: 'Sam' }, new Date('2026-10-30T12:00:00Z'), { view: 'nova' }).view, 'nova');
    assert.equal(tools.firstNameOf({ name: 'Sam Smith' }), 'Sam');
    assert.equal(tools.firstNameOf(null), '');
    const fields = tools.requestFields('reboot_computer', { name: 'Sam Smith' }, new Date('2026-10-30T12:00:00Z'));
    assert.deepEqual(fields, { action: 'reboot_computer', requestedAt: '2026-10-30T12:00:00.000Z', requestedBy: 'Sam' });
  } finally {
    studio.close();
  }
});

finish();
