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

test('the only words that can be sent are the three of the table, and they are all in the helper', () => {
  assert.deepEqual(Object.values(plan.wordOf).sort(), ['reboot', 'restart-kiosk', 'restart-services']);
  const helper = fs.readFileSync(path.join(repo, 'computer/scripts/control-helper.sh'), 'utf8');
  Object.values(plan.wordOf).forEach(word => assert.ok(helper.includes(word), word));
  assert.ok(Object.isFrozen(plan.wordOf));
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
  const state = { doc: doc, writes: [], helperCalls: [], pushes: [], sleeps: [], logs: [], files: {}, failWrites: false, helperFails: false, clock: now };
  const settings = options || {};
  const deps = {
    fetch: async (url, init) => {
      if (!init || !init.method) return { ok: true, status: 200, json: async () => ({ result: state.doc }) };
      if (state.failWrites) return { ok: false, status: 500, json: async () => ({}) };
      JSON.parse(init.body).mutations.forEach(mutation => {
        state.writes.push(mutation);
        if (mutation.patch && state.doc) {
          Object.assign(state.doc, mutation.patch.set);
          state.doc._rev = 'r' + (state.writes.length + 1);
        }
      });
      return { ok: true, status: 200, json: async () => ({}) };
    },
    now: () => state.clock,
    readJson: file => (state.files[file] === undefined ? null : state.files[file]),
    writeJson: (file, value) => { state.files[file] = value; },
    helper: async word => { state.helperCalls.push(word); if (state.helperFails) throw new Error('the helper said: failed 1'); },
    notify: text => { state.pushes.push(text); if (settings.notifyThrows) throw new Error('no script'); },
    sleep: async ms => { state.sleeps.push(ms); },
    log: (event, detail) => state.logs.push({ event: event, detail: detail }),
    config: { project: 'p', dataset: 'd', version: '2025-02-19', token: 'T', stateFile: 'state', syncFile: 'sync', netwatchFile: 'net' },
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
    assert.deepEqual(control.fields.map(field => field.name), ['action', 'requestedAt', 'requestedBy', 'lastHandledAt', 'lastResult']);
    assert.deepEqual(control.fields[0].options.list.map(item => item.value), Object.keys(plan.wordOf));
    control.fields.forEach(field => assert.ok(field.description && field.readOnly, field.name));

    const status = (await studio.load('schemas/remoteStatus.js')).default;
    assert.equal(status.readOnly, true);

    const tools = await studio.load('tools/remote-actions.js');
    assert.deepEqual(tools.remoteActionButtons.map(button => button.action), ['restartDashboard', 'restartServices', 'rebootComputer']);
    assert.equal(tools.firstNameOf({ name: 'Sam Smith' }), 'Sam');
    assert.equal(tools.firstNameOf(null), '');
    const fields = tools.requestFields('reboot_computer', { name: 'Sam Smith' }, new Date('2026-10-30T12:00:00Z'));
    assert.deepEqual(fields, { action: 'reboot_computer', requestedAt: '2026-10-30T12:00:00.000Z', requestedBy: 'Sam' });
  } finally {
    studio.close();
  }
});

finish();
