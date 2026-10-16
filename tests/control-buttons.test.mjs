// The buttons of the Now showing, Status and Log tabs must never do nothing: each one shows Done in green or the
// reason in red. This walks the chain from the button to the helper and to Sanity with fakes, and breaks each link.
//
//   node tests/control-buttons.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { makeWorld } from './helpers/control-world.mjs';
import * as helperRoute from '../control/routes/helper.js';
import * as requestRoute from '../control/routes/request.js';
import { createHelper } from '../control/lib/helper-client.js';
import { actions, buildRequest } from '../control/support/requests.js';
import { doneWords, outcome } from '../control/static/tabs/render.js';
import { api, showResult } from '../control/static/tabs/api.js';
import { makePresentationTestRunner, tidyTestRequest } from '../dashboard/core/presentation-test.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-buttons-'));
const unreachable = 'The control page could not reach the helper on this computer. Run the installer again.';

// A connection that answers the way the helper does: it takes the request, then sends the text and closes
function answering(text) {
  return () => {
    const socket = new EventEmitter();
    socket.sent = '';
    socket.end = request => {
      socket.sent += request;
      setImmediate(() => { socket.emit('data', text); socket.emit('close'); });
    };
    socket.destroy = () => {};
    setImmediate(() => socket.emit('connect'));
    return socket;
  };
}

test('a helper socket that is not there gives the sentence of the installer, with the code kept for the log', async () => {
  const helper = createHelper(path.join(work, 'missing.sock'));
  await assert.rejects(helper('reboot'), error => error.message === unreachable && error.code === 'ENOENT');
});

test('a helper that answers ok, failed or refused is told apart, and its reason reaches the page', async () => {
  assert.equal(await createHelper('x', 1000, answering('The Teletraan computer is rebooting.\nok\n'))('reboot'), 'The Teletraan computer is rebooting.');
  await assert.rejects(createHelper('x', 1000, answering('sudo: a password is required\nfailed 1\n'))('reboot'), error => /did not finish \(failed 1\)\. sudo: a password is required/.test(error.message));
  await assert.rejects(createHelper('x', 1000, answering('refused\n'))('reboot'), error => error.message === 'The helper refused that.');

  const world = await makeWorld([helperRoute]);
  world.ctx.helper = createHelper(path.join(work, 'missing.sock'));
  const answer = await world.router.call('POST', '/helper/reboot', { body: { confirmed: true } });
  assert.equal(answer.status, 502);
  assert.equal(answer.json.error, unreachable, 'not the empty "something went wrong"');
  assert.ok(world.logged.some(line => line.includes('(ENOENT)')), 'the log has the code');
});

test('Run presentation test: a missing key, a refused key, no network and an empty answer each give their own sentence', async () => {
  const cases = [
    { name: 'no key', env: '', status: 503, words: /SANITY_WRITE_TOKEN is not set/ },
    { name: 'refused', reply: { ok: false, status: 401 }, status_: 502, words: /^Sanity refused the write\. Check SANITY_WRITE_TOKEN on the Keys tab\.$/ },
    { name: 'forbidden', reply: { ok: false, status: 403 }, status_: 502, words: /^Sanity refused the write\. Check SANITY_WRITE_TOKEN on the Keys tab\.$/ },
    { name: 'server error', reply: { ok: false, status: 500 }, status_: 502, words: /could not take the change \(500\)/ },
    { name: 'offline', offline: true, status_: 502, words: /could not reach Sanity/ },
    { name: 'nothing written', reply: { ok: true, status: 200, results: [] }, status_: 502, words: /changed no document/ },
  ];
  for (const item of cases) {
    const world = await makeWorld([requestRoute], item.env === undefined ? {} : { env: item.env });
    const base = world.ctx.fetch;
    world.ctx.fetch = async (url, init) => {
      if (!String(url).includes('/data/mutate/')) return base(url, init);
      if (item.offline) throw new Error('the network is down');
      return { ok: item.reply.ok, status: item.reply.status, json: async () => ({ results: item.reply.results }) };
    };
    const answer = await world.router.call('POST', '/request', { body: { action: 'presentation-test' } });
    assert.equal(answer.status, item.status || item.status_, item.name);
    assert.match(answer.json.error, item.words, item.name);
    assert.ok(!JSON.stringify(answer).includes('skFAKEtoken'), item.name + ': the key is never in the answer');
  }
});

test('Run presentation test says so when Run presentations is off, and writes nothing then', async () => {
  const off = await makeWorld([requestRoute], { answers: { presentationsEnabled: { result: false } } });
  const refused = await off.router.call('POST', '/request', { body: { action: 'presentation-test' } });
  assert.equal(refused.status, 409);
  assert.match(refused.json.error, /Run presentations is switched off/);
  assert.ok(!off.fetched.some(item => item.url.includes('/data/mutate/')), 'nothing was written');

  const on = await makeWorld([requestRoute], { answers: { presentationsEnabled: { result: true } } });
  assert.equal((await on.router.call('POST', '/request', { body: { action: 'presentation-test' } })).status, 200);
  assert.ok(on.fetched.some(item => item.url.includes('/data/mutate/')));

  const unknown = await makeWorld([requestRoute], { offline: true });
  const answer = await unknown.router.call('POST', '/request', { body: { action: 'presentation-test' } });
  assert.match(answer.json.error, /could not reach Sanity/, 'a read that fails does not hide the real reason');
});

test('the field the button writes is the field the screen reads, and the screen answers a request that is a few seconds old but not one a minute old', async () => {
  const now = new Date('2026-10-16T12:00:00Z');
  const written = buildRequest('presentation-test', {}, now).set.presentationTestRequest;
  assert.deepEqual(Object.keys(buildRequest('presentation-test', {}, now).set), ['presentationTestRequest']);
  assert.equal(tidyTestRequest(written).requestedAt, '2026-10-16T12:00:00Z');

  async function run(secondsLater) {
    const started = [];
    const runner = makePresentationTestRunner({
      getContent: () => ({ settings: { presentationsEnabled: true, presentationTestRequest: written } }),
      storage: null,
      takeoverRunning: () => false, demoRunning: () => false, nightIsUp: () => false, hiddenPlaying: () => false,
      loadSampleTalk: async () => ({ id: 'sample' }),
      startTalk: talk => started.push(talk),
    });
    runner.look(new Date(now.getTime() + secondsLater * 1000));
    await runner.whenStarted();
    return started.length;
  }
  assert.equal(await run(10), 1, 'seen within the 10 second poll');
  assert.equal(await run(59), 1);
  assert.equal(await run(90), 0, 'a request a minute old is ignored, which is why the screen polls every 10 seconds and not every 5 minutes');
});

test('every action and every helper word has words for Done, and a failure shows the reason in red', () => {
  actions.forEach(action => assert.notEqual(doneWords(action, { minutes: 5, target: 'monday' }), 'It worked.', action));
  ['restart-kiosk', 'restart-services', 'reboot', 'sync-now', 'refresh'].forEach(word => assert.notEqual(doneWords(word, { target: 'frc' }), 'It worked.', word));
  assert.equal(doneWords('hold', { minutes: 1 }).startsWith('The panel is held for 1 minute.'), true);
  assert.deepEqual(outcome({ ok: true }, 'next'), { state: 'done', words: 'Done. ' + doneWords('next') });
  assert.deepEqual(outcome({ ok: false, error: 'Sanity refused the write. Check SANITY_WRITE_TOKEN on the Keys tab.' }, 'presentation-test'), { state: 'bad', words: 'Sanity refused the write. Check SANITY_WRITE_TOKEN on the Keys tab.' });
  assert.equal(outcome({ ok: false }, 'next').state, 'bad');
  assert.ok(outcome({ ok: false }, 'next').words.length > 20, 'even a failure with no reason says something');
});

test('a reboot or a services restart that cuts the connection says to wait, and every other lost connection is red', () => {
  const lost = { ok: false, unreachable: true, error: 'The Teletraan computer could not be reached.' };
  assert.equal(outcome(lost, 'reboot').state, 'wait');
  assert.equal(outcome(lost, 'restart-services').state, 'wait');
  assert.equal(outcome(lost, 'restart-kiosk').state, 'bad');
  assert.equal(outcome(lost, 'presentation-test').state, 'bad');
  assert.ok(/reload this page/.test(outcome(lost, 'reboot').words));
});

test('the page turns a lost network, an empty 502 and a refused PIN into plain sentences', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    const lost = await api('POST', '/request', {});
    assert.equal(lost.ok, false);
    assert.equal(lost.unreachable, true);
    assert.match(lost.error, /could not be reached/);

    globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => { throw new Error('html'); } });
    assert.match((await api('POST', '/request', {})).error, /control service on the Teletraan computer is not answering/);

    globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => ({ error: 'Sanity refused the write. Check SANITY_WRITE_TOKEN on the Keys tab.' }) });
    assert.match((await api('POST', '/request', {})).error, /^Sanity refused the write/);

    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    assert.match((await api('POST', '/request', {})).error, /Enter the PIN/);
  } finally {
    globalThis.fetch = real;
  }
});

test('the result goes in a line right under the buttons that were pressed, and is reused', () => {
  const real = globalThis.document;
  const holder = { nextElementSibling: null, after(element) { this.nextElementSibling = element; } };
  const button = { closest: () => holder, parentElement: holder };
  globalThis.document = {
    createElement: () => {
      const element = { className: '', dataset: {}, attributes: {}, textContent: '' };
      element.classList = { contains: name => element.className.split(' ').includes(name) };
      element.setAttribute = (name, value) => { element.attributes[name] = value; };
      return element;
    },
  };
  try {
    showResult(button, 'working', 'Sending.');
    const line = holder.nextElementSibling;
    assert.equal(line.textContent, 'Sending.');
    assert.equal(line.attributes.role, 'status');
    showResult(button, 'done', 'Done. The screen moves on.');
    assert.equal(holder.nextElementSibling, line, 'the same line');
    assert.deepEqual([line.dataset.state, line.textContent], ['done', 'Done. The screen moves on.']);
  } finally {
    globalThis.document = real;
  }
});

test('every button of the three tabs reports through the result line, and the CSS colors it', () => {
  ['now.js', 'status.js', 'log.js'].forEach(file => {
    const text = read('control/static/tabs/' + file);
    assert.ok(text.includes('showResult(') && text.includes('outcome('), file);
    assert.ok(!text.includes('say('), file + ' still has the quiet note');
  });
  const css = read('control/static/tabs/tabs.css');
  ['done', 'bad', 'wait'].forEach(state => assert.ok(css.includes('.result[data-state="' + state + '"]'), state));
  assert.ok(/\.result\[data-state="done"\] \{ color: #2fd27a/.test(css) && /\.result\[data-state="bad"\] \{ color: #ff8a8a/.test(css));
});

test('the keys are read through the folder, so a key saved on the Keys tab is seen without making the container again', () => {
  const compose = read('computer/docker-compose.yml');
  assert.ok(!/local\.env:\/opt\/teletraan\/local\.env/.test(compose), 'a file mounted by itself keeps the old file when the helper renames a new one over it');
  assert.ok(/- \$\{TELETRAAN_ROOT:-\/opt\/teletraan\}:\/opt\/teletraan\n/.test(compose));
});

test('the docs give the two commands that show the evidence', () => {
  const text = read('docs/control-page.md');
  assert.ok(text.includes('/opt/teletraan/logs/helper.log'));
  assert.ok(text.includes('sudo journalctl -u teletraan-control@* -n 40 --no-pager'));
});

fs.rmSync(work, { recursive: true, force: true });
await finish();
