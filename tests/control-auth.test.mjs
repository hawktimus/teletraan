// The PIN, the cookie and the lockout, the merge of local.env, and the service itself over HTTP: nothing is
// served without the cookie, the dashboard's own report is let in only through the local server, and a release can
// be switched. The helper is a fake; no socket and no Docker are used.
//
//   node tests/control-auth.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { makeZip, sampleTree } from './helpers/zip-maker.mjs';
import { createAuth, validPin, fixedPins, triesAllowed, blockTime, triesWindow } from '../control/lib/auth.js';
import { parseEnv, mergeEnv, envProblem } from '../control/lib/env-merge.js';
import { createService } from '../control/server.js';

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-auth-'));
let clock = 1_800_000_000_000;
let override = '';
const secretFile = path.join(work, 'control-secret');
const auth = createAuth({ getOverride: () => override, secretFile: secretFile, now: () => clock });
const request = cookie => ({ headers: cookie ? { cookie: 'teletraan_control=' + cookie } : {} });

test('the two fixed PINs are the team numbers, and a PIN typed by hand is 4 to 12 digits', () => {
  assert.deepEqual(fixedPins, ['3229', '3426']);
  ['1234', '123456789012'].forEach(value => assert.equal(validPin(value), true, value));
  ['123', '1234567890123', '12345a', '', undefined, '12 456'].forEach(value => assert.equal(validPin(value), false, String(value)));
});

test('the secret is made on the first start with mode 600 and kept', () => {
  assert.equal(auth.attempt('1.1.1.1', '3229').ok, true);
  assert.equal(fs.statSync(secretFile).mode & 0o777, 0o600);
  const before = fs.readFileSync(secretFile, 'utf8');
  createAuth({ getOverride: () => override, secretFile: secretFile }).attempt('1.1.1.1', '3229');
  assert.equal(fs.readFileSync(secretFile, 'utf8'), before);
});

test('the right PIN gives a cookie good for 30 days, and it is HttpOnly and on /control only', () => {
  const result = auth.attempt('2.2.2.2', '3426');
  assert.equal(result.ok, true);
  const value = result.cookie;
  assert.equal(auth.isAuthed(request(value)), true);
  const header = auth.cookieHeader(value);
  assert.ok(header.includes('HttpOnly') && header.includes('Path=/control') && header.includes('SameSite=Strict'));
  assert.ok(header.includes('Max-Age=' + 30 * 86400));
  clock += 29 * 86400000;
  assert.equal(auth.isAuthed(request(value)), true, 'still good on day 29');
  clock += 2 * 86400000;
  assert.equal(auth.isAuthed(request(value)), false, 'over after 30 days');
});

test('a cookie that was changed, copied from another secret, or made before a typed PIN took over does not work', () => {
  const value = auth.attempt('3.3.3.3', '3229').cookie;
  assert.equal(auth.isAuthed(request(value)), true);
  assert.equal(auth.isAuthed(request(value.slice(0, -1) + (value.endsWith('0') ? '1' : '0'))), false);
  assert.equal(auth.isAuthed(request('')), false);
  assert.equal(auth.isAuthed(request('garbage')), false);
  const other = createAuth({ getOverride: () => override, secretFile: path.join(work, 'other-secret'), now: () => clock });
  assert.equal(other.isAuthed(request(value)), false);
  override = '654321';
  assert.equal(auth.isAuthed(request(value)), false, 'a PIN typed in local.env ends every old cookie');
  override = '';
});

test('six wrong tries in ten minutes block the address for an hour, and the right PIN does not get through meanwhile', () => {
  const address = '4.4.4.4';
  for (let i = 1; i < triesAllowed; i++) assert.equal(auth.attempt(address, '000000').triesLeft, triesAllowed - i);
  const sixth = auth.attempt(address, '000000');
  assert.equal(sixth.blockedSeconds, blockTime / 1000);
  assert.equal(auth.attempt(address, '3229').ok, false, 'blocked even with the right PIN');
  assert.equal(auth.attempt('5.5.5.5', '3229').ok, true, 'another address is not blocked');
  clock += blockTime - 1000;
  assert.ok(auth.blockedFor(address) > 0);
  clock += 2000;
  assert.equal(auth.attempt(address, '3229').ok, true, 'free after an hour');
});

test('tries spread over more than ten minutes do not add up', () => {
  const address = '6.6.6.6';
  for (let i = 0; i < triesAllowed - 1; i++) {
    auth.attempt(address, '000000');
    clock += triesWindow / 3;
  }
  assert.equal(auth.blockedFor(address), 0);
});

test('with no CONTROL_PIN exactly 3229 and 3426 sign in, and never a word about setting a PIN', () => {
  assert.equal(auth.attempt('7.7.7.1', '3229').ok, true);
  assert.equal(auth.attempt('7.7.7.2', '3426').ok, true);
  ['', '0000', '3230', '32290', '322', '123456', undefined].forEach((value, index) => {
    const result = auth.attempt('7.7.8.' + index, value);
    assert.equal(result.ok, false, String(value));
    assert.ok(result.triesLeft > 0 && !('noPin' in result), String(value));
  });
  assert.equal(auth.hasPin, undefined, 'there is no state of having no PIN');
  assert.equal(auth.isAuthed(request('1800000000000.' + 'a'.repeat(64))), false);
});

test('a PIN typed in local.env is the only one that works, 4 to 12 digits and no other rule, and a bad one is ignored', () => {
  override = '4417';
  assert.equal(auth.attempt('8.8.8.1', '3229').ok, false, 'the fixed PINs stop working');
  assert.equal(auth.attempt('8.8.8.1', '3426').ok, false);
  const good = auth.attempt('8.8.8.2', '4417');
  assert.equal(good.ok, true);
  assert.equal(auth.isAuthed(request(good.cookie)), true);
  override = '000000000001';
  assert.equal(auth.attempt('8.8.8.3', '000000000001').ok, true, 'no format rule beyond 4 to 12 digits');
  assert.equal(auth.isAuthed(request(good.cookie)), false, 'the cookie of the other PIN is over');
  override = '12';
  assert.equal(auth.attempt('8.8.8.4', '12').ok, false, 'a PIN of two digits is ignored');
  assert.equal(auth.attempt('8.8.8.4', '3229').ok, true, 'and the fixed ones work');
  override = 'abcd';
  assert.equal(auth.attempt('8.8.8.5', '3426').ok, true);
  override = '';
});

test('local.env is read and merged without losing comments, and a value with a quote or a line break is refused', () => {
  const text = "# keys\nCONTROL_PIN='123456'\nCALENDAR_TEAM_URL='[paste it here]'\nTELETRAAN_PORT='8080'\n";
  assert.deepEqual(parseEnv(text), { CONTROL_PIN: '123456', TELETRAAN_PORT: '8080' });
  const merged = mergeEnv(text, { CONTROL_PIN: '999999', TBA_AUTH_KEY: 'abc', TELETRAAN_PORT: null });
  assert.equal(merged, "# keys\nCONTROL_PIN='999999'\nCALENDAR_TEAM_URL='[paste it here]'\nTBA_AUTH_KEY='abc'\n");
  assert.throws(() => mergeEnv(text, { A_KEY: "it's" }), /quote mark/);
  assert.throws(() => mergeEnv(text, { A_KEY: 'a\nb' }), /line break/);
  assert.throws(() => mergeEnv(text, { 'bad name': 'x' }), /capital letters/);
  assert.ok(!envProblem('A_KEY', "secret'value").includes('secret'), 'the reason never holds the value');
});

// The service over HTTP

async function serve(files = {}) {
  const root = path.join(work, 'service' + Math.random().toString(16).slice(2));
  fs.mkdirSync(path.join(root, 'releases/1/dashboard'), { recursive: true });
  fs.mkdirSync(path.join(root, 'releases/1/computer'), { recursive: true });
  fs.writeFileSync(path.join(root, 'releases/1/RELEASE.json'), JSON.stringify({ version: 1, commit: 'abc1234', date: '2026-10-15T20:00:00Z', from: 'git', note: 'Before', treeHash: '' }));
  fs.symlinkSync('releases/1', path.join(root, 'current'));
  fs.writeFileSync(path.join(root, 'local.env'), "CONTROL_PIN='424242'\nSANITY_WRITE_TOKEN='tokenvalue123456'\n");
  const helperCalls = [];
  const { server, ctx } = await createService({
    port: 0, host: '127.0.0.1', rootDir: root, releasesDir: path.join(root, 'releases'), dataDir: root, envFile: path.join(root, 'local.env'),
    secretFile: path.join(root, 'control-secret'), socket: path.join(root, 'none.sock'), logFile: path.join(root, 'logs/control.log'),
  }, Object.assign({
    helper: async (word, args) => { helperCalls.push(word + (args && args.length ? ' ' + args.join(' ') : '')); return 'user: hawktimus\nhost: teletraan'; },
    waitForBuild: async () => true,
  }, files));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  return { base: base, ctx: ctx, server: server, helperCalls: helperCalls, root: root };
}

async function signIn(base, value = '424242') {
  const response = await fetch(base + '/control/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: value }) });
  return { response: response, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
}

test('without the cookie a page is the sign-in form, an API call is 401, and the form files are open', async () => {
  const s = await serve();
  try {
    const page = await fetch(s.base + '/control/');
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes('Sign in'));
    assert.equal((await fetch(s.base + '/control/other.html')).headers.get('content-type').startsWith('text/html'), true, 'any other page is the form too');
    assert.equal((await fetch(s.base + '/control/app.js')).status, 401, 'a script is refused, never answered with a page');
    assert.equal((await fetch(s.base + '/control/login.js')).headers.get('content-type').startsWith('text/javascript'), true);
    assert.equal((await fetch(s.base + '/control/api/releases')).status, 401);
    assert.equal((await fetch(s.base + '/control/api/helper/status', { method: 'POST' })).status, 401);
    assert.deepEqual(await (await fetch(s.base + '/control/api/session')).json(), { signedIn: false });
  } finally { s.server.close(); }
});

test('a wrong PIN is 401, the right one sets the cookie, and the pages and calls open', async () => {
  const s = await serve();
  try {
    assert.equal((await signIn(s.base, '111111')).response.status, 401);
    const good = await signIn(s.base);
    assert.equal(good.response.status, 200);
    const headers = { cookie: good.cookie };
    const page = await fetch(s.base + '/control/', { headers: headers });
    assert.ok((await page.text()).includes('id="tabs"'));
    const releases = await (await fetch(s.base + '/control/api/releases', { headers: headers })).json();
    assert.equal(releases.current, 1);
    assert.equal(releases.releases[0].commit, 'abc1234');
    const tabs = await (await fetch(s.base + '/control/api/tabs', { headers: headers })).json();
    ['tabs/display.js', 'tabs/settings.js', 'tabs/status.js'].forEach(name => assert.ok(tabs.tabs.includes(name), name + ' is listed: the tabs'));
    assert.ok(!tabs.tabs.includes('tabs/wall-controls.js'), 'the wall controls are part of the Display tab now');
    assert.equal((await fetch(s.base + '/control/..%2f..%2fserver.js', { headers: headers })).status, 404);
    assert.equal((await fetch(s.base + '/control/.hidden', { headers: headers })).status, 404);
  } finally { s.server.close(); }
});

test('with no PIN in local.env 3229 and 3426 open the page, nothing else does, and nothing says to set a PIN', async () => {
  const s = await serve();
  try {
    fs.writeFileSync(path.join(s.root, 'local.env'), "SANITY_WRITE_TOKEN='x'\n");
    assert.deepEqual(await (await fetch(s.base + '/control/api/session')).json(), { signedIn: false });
    assert.equal((await signIn(s.base, '3229')).response.status, 200);
    assert.equal((await signIn(s.base, '3426')).response.status, 200);
    const wrong = await signIn(s.base, '424242');
    assert.equal(wrong.response.status, 401);
    assert.ok(!JSON.stringify(await wrong.response.json()).includes('Set a PIN'));
    const html = await (await fetch(s.base + '/control/')).text();
    const script = fs.readFileSync(new URL('../control/static/login.js', import.meta.url), 'utf8');
    assert.ok(!/set a pin/i.test(html + script), 'neither the page nor its script says to set a PIN');
  } finally { s.server.close(); }
});

test('a CONTROL_PIN in local.env replaces the two fixed ones for the whole service', async () => {
  const s = await serve();
  try {
    assert.equal((await signIn(s.base, '3229')).response.status, 401);
    assert.equal((await signIn(s.base, '424242')).response.status, 200);
  } finally { s.server.close(); }
});

test('POST /now needs no PIN at the door but every other call does, and pinCheck itself only knows the cookie', async () => {
  const s = await serve();
  try {
    assert.equal(s.ctx.pinCheck({ method: 'POST', url: '/control/api/now', headers: {} }), false);
    const post = await fetch(s.base + '/control/api/now', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(post.status, 403, 'the door is open, and the route itself refuses an address that is not the Teletraan computer');
    const local = await fetch(s.base + '/control/api/now', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': '127.0.0.1' }, body: '{}' });
    assert.notEqual(local.status, 401);
    assert.notEqual(local.status, 403);
    assert.equal((await fetch(s.base + '/control/api/now')).status, 401, 'reading still needs the cookie');
    assert.equal((await fetch(s.base + '/control/api/releases', { method: 'POST', headers: { 'x-real-ip': '127.0.0.1' } })).status, 401);
  } finally { s.server.close(); }
});

test('a zip posted to /control/api/releases streams one JSON line for each step, and activate switches and restarts', async () => {
  const s = await serve();
  try {
    process.env.CONTROL_SKIP_STUDIO = '1';
    const headers = { cookie: (await signIn(s.base)).cookie };
    const form = new FormData();
    form.append('note', 'From the test');
    form.append('commit', 'DEADBEEF00');
    form.append('zip', new Blob([makeZip(sampleTree())]), 'teletraan.zip');
    const response = await fetch(s.base + '/control/api/releases', { method: 'POST', headers: headers, body: form });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /ndjson/);
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    assert.ok(events.some(e => e.step === 'unpack' && e.state === 'done'));
    const last = events[events.length - 1];
    assert.equal(last.step, 'finish');
    assert.equal(last.state, 'done');
    assert.equal(last.release.version, 2);
    assert.equal(last.release.commit, 'deadbee');
    assert.equal(s.ctx.releases.currentNumber(), 2);
    assert.deepEqual(s.helperCalls, ['restart-services', 'restart-kiosk']);

    const bad = await fetch(s.base + '/control/api/releases', { method: 'POST', headers: headers, body: (() => { const f = new FormData(); f.append('note', 'x'); return f; })() });
    assert.equal(bad.status, 400);

    s.helperCalls.length = 0;
    const back = await fetch(s.base + '/control/api/releases/1/activate', { method: 'POST', headers: headers });
    assert.equal(back.status, 200);
    assert.equal(s.ctx.releases.currentNumber(), 1);
    assert.deepEqual(s.helperCalls, ['restart-services', 'restart-kiosk']);
    assert.equal((await fetch(s.base + '/control/api/releases/9/activate', { method: 'POST', headers: headers })).status, 404);
  } finally { delete process.env.CONTROL_SKIP_STUDIO; s.server.close(); }
});

fs.rmSync(work, { recursive: true, force: true });
await finish();
