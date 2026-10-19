// Tests the hidden transition buttons and the Last hidden transition block of the control page
// (control/support/requests.js, control/routes/request.js, control/routes/now.js, control/static/tabs/render.js,
// dashboard/core/now-report-parts.js). Fake Sanity; nothing leaves the process.
//
//   node tests/hidden-control.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as request from '../control/routes/request.js';
import * as now from '../control/routes/now.js';
import { actions, buildRequest, hiddenKinds } from '../control/support/requests.js';
import { doneWords, hiddenRunHtml, hiddenRunWords, nowControlsHtml } from '../control/static/tabs/render.js';
import { pushedKind } from '../dashboard/core/hidden.js';
import { makeWorld } from './helpers/control-world.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const tests = [];
const test = (name, run) => tests.push({ name, run });

const at = new Date('2026-10-19T14:42:00Z');
const hour = new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const played = (kind, steps, extra = {}) => Object.assign({ kind: kind, at: at.toISOString(), steps: steps, ignored: '', browser: 'Chromium 109 Linux', imageTypes: { png: true, webp: true } }, extra);

test('the hidden request has the same shape as the one the Studio menu writes, and the screen reads it', () => {
  assert.ok(actions.includes('hidden'));
  assert.deepEqual(hiddenKinds, ['desktop', 'redEyes']);
  hiddenKinds.forEach(kind => {
    const built = buildRequest('hidden', { kind: kind }, at);
    assert.deepEqual(built.set, { hiddenRequest: { kind: kind, requestedAt: at.toISOString() } });
    assert.equal(pushedKind(built.set.hiddenRequest, '', at), kind, 'the wall plays what the page wrote');
  });

  const studio = fs.readFileSync(new URL('../studio/tools/screen-requests.js', import.meta.url), 'utf8');
  assert.ok(studio.includes('hiddenRequest: { kind: kind, requestedAt: new Date().toISOString() }'));
  ['', 'megaflash', undefined, 'toString'].forEach(kind => {
    assert.throws(() => buildRequest('hidden', { kind: kind }, at), error => error.status === 400, String(kind));
  });
});

test('the route writes the request, and says so in plain words when Allow hidden transitions is off', async () => {
  const world = await makeWorld([request, now], {});
  const answer = await world.router.call('POST', '/request', { body: { action: 'hidden', kind: 'redEyes' } });
  assert.equal(answer.status, 200);
  const mutation = JSON.parse(world.fetched[world.fetched.length - 1].init.body).mutations[0];
  assert.equal(mutation.patch.id, 'dashboardSettings');
  assert.equal(mutation.patch.set.hiddenRequest.kind, 'redEyes');
  assert.ok(Math.abs(Date.parse(mutation.patch.set.hiddenRequest.requestedAt) - Date.now()) < 5000);

  const off = await makeWorld([request, now], { answers: { hiddenEnabled: { result: false } } });
  const refused = await off.router.call('POST', '/request', { body: { action: 'hidden', kind: 'desktop' } });
  assert.equal(refused.status, 409);
  assert.match(refused.json.error, /Allow hidden transitions is switched off/);
  assert.ok(!off.fetched.some(call => call.url.includes('/data/mutate/')), 'nothing was written');

  const on = await makeWorld([request, now], { answers: { hiddenEnabled: { result: true } } });
  assert.equal((await on.router.call('POST', '/request', { body: { action: 'hidden', kind: 'desktop' } })).status, 200);
});

test('the Now report carries the last hidden transition through the service, cut to 400 characters', async () => {
  const world = await makeWorld([request, now], {});
  const run = played('desktop', ['pile 1.7s', 'picture blue-screen-1.png loaded 700x394 after 40ms', 'on screen 1920x1080 opacity 1.0', 'effect shown 3.0s', 'rebuild ok', 'total 9.4s']);
  const sent = await world.router.call('POST', '/now', { body: { panel: 'roster', view: 'general', hiddenRun: run }, headers: { 'x-real-ip': '127.0.0.1' } });
  assert.equal(sent.status, 200);
  const got = await world.router.call('GET', '/now');
  assert.deepEqual(got.json.report.hiddenRun.steps, run.steps);
  assert.deepEqual(got.json.report.hiddenRun.imageTypes, { png: true, webp: true });
  assert.ok(JSON.stringify(got.json.report.hiddenRun).length <= 400);

  await world.router.call('POST', '/now', { body: { panel: 'roster' }, headers: { 'x-real-ip': '127.0.0.1' } });
  assert.equal((await world.router.call('GET', '/now')).json.report.hiddenRun, null, 'an older wall sends none');
});

test('a played transition reads as the kind, the time, the picture and the seconds', () => {
  const words = hiddenRunWords(played('desktop', ['pile 1.7s', 'picture blue-screen-1.png loaded 700x394 after 40ms', 'on screen 1920x1080 opacity 1.0', 'effect shown 3.0s', 'rebuild ok', 'total 9.4s']));
  assert.equal(words.last, 'Desktop reveal at ' + hour + ': picture loaded 700x394, played 9.4 s');
  assert.equal(words.types, 'The TV browser can read: PNG yes, WebP yes (Chromium 109 Linux).');
  assert.match(hiddenRunWords(played('redEyes', ['picture red-eyes-1.webp loaded 1672x941 after 7ms', 'total 10.7s'])).last, /^Red eyes at \d\d:\d\d: picture loaded 1672x941, played 10.7 s$/);
});

test('a picture that did not load says so with the file and the reason', () => {
  const failed = hiddenRunWords(played('desktop', ['pile 1.7s', 'picture blue-screen-1.png FAILED: error 0, http 404', 'picture blue-screen-2.png FAILED: error 0, http 404', 'picture none, plain backdrop', 'rebuild ok', 'total 11.5s']));
  assert.match(failed.last, /picture FAILED to load \(the TV browser could not read blue-screen-1\.png: error 0, http 404; blue-screen-2\.png/);
  assert.match(failed.last, /played 11\.5 s$/);

  const second = hiddenRunWords(played('redEyes', ['picture red-eyes-1.webp FAILED: error 0', 'picture red-eyes-2.webp loaded 1920x1080 after 60ms', 'total 10.7s']));
  assert.match(second.last, /picture red-eyes-1\.webp FAILED to load, red-eyes-2\.webp loaded 1920x1080/);

  const unseen = hiddenRunWords(played('desktop', ['picture blue-screen-1.png loaded 700x394 after 8ms', 'on screen 1920x1080 opacity 0.0 NOT VISIBLE', 'total 11.5s']));
  assert.match(unseen.last, /picture loaded 700x394, but the picture was not visible on the screen, played 11\.5 s/);
});

test('a request that was ignored, a stopped run, a run in progress and no run each have their own words', () => {
  assert.equal(hiddenRunWords(played('desktop', [], { ignored: 'request older than 5 min' })).last, 'Desktop reveal at ' + hour + '. Ignored: request older than 5 min.');
  assert.match(hiddenRunWords(played('redEyes', ['pile 1.7s', 'stopped: an alert, announcement or talk began', 'total 3.1s'])).last, /stopped: an alert, announcement or talk began$/);
  assert.match(hiddenRunWords(played('redEyes', ['pile 1.7s', 'picture red-eyes-1.webp loaded 1672x941 after 7ms'])).last, /still playing$/);
  assert.equal(hiddenRunWords(played('', [], { at: '' })).last, 'No hidden transition has played since the wall started.');
  assert.equal(hiddenRunWords(null).last, 'The wall has not reported a hidden transition yet.');
  assert.match(hiddenRunWords(played('desktop', [], { imageTypes: { png: true, webp: false } })).types, /PNG yes, WebP NO/);
  assert.match(hiddenRunWords(played('desktop', [], { imageTypes: { png: null, webp: null } })).types, /PNG not tested, WebP not tested/);
});

test('the Messages group has both buttons, the block under them, and every text is escaped', () => {
  const html = nowControlsHtml({});
  assert.match(html, /data-action="hidden" data-kind="desktop">Play desktop reveal</);
  assert.match(html, /data-action="hidden" data-kind="redEyes">Play red eyes</);
  assert.ok(html.indexOf('data-hidden-run') > html.indexOf('Play red eyes'));
  assert.match(html, /Last hidden transition/);
  assert.notEqual(doneWords('hidden', { kind: 'redEyes' }), 'It worked.');
  assert.match(doneWords('hidden', { kind: 'redEyes' }), /red eyes within about 20 seconds/);
  assert.match(doneWords('hidden', { kind: 'desktop' }), /desktop reveal within about 20 seconds/);

  const rude = hiddenRunHtml({ hiddenRun: played('desktop', ['picture <b>x.png</b> FAILED: <script>']) });
  assert.ok(!rude.includes('<b>') && !rude.includes('<script>'));
});

test('the tab draws the block from every report and presses send the kind', () => {
  const tab = fs.readFileSync(root + 'control/static/tabs/now.js', 'utf8');
  assert.ok(tab.includes("if (action === 'hidden') body.kind = button.dataset.kind;"));
  assert.ok(tab.includes('drawHiddenRun(answer.ok ? wallReport(answer.data) : null);'));
});

let failed = 0;
for (const { name, run } of tests) {
  try { await run(); console.log('ok   ' + name); } catch (error) { failed++; console.log('FAIL ' + name + '\n' + error.message); }
}
console.log(tests.length - failed + ' of ' + tests.length + ' passed');
process.exit(failed === 0 ? 0 : 1);
