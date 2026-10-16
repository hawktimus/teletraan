// Update from GitHub: the library (latest commit, download with a size cap), the routes over HTTP with a fake
// GitHub, and the page card. Nothing leaves the process.
//
//   node tests/control-github.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { makeZip, sampleTree } from './helpers/zip-maker.mjs';
import { latest, download } from '../control/lib/github.js';
import { createService } from '../control/server.js';

process.env.CONTROL_SKIP_STUDIO = '1';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-github-'));
const sha = '4e18836a2f18479d9ce9b23f94f4baa097c3eed2';
const other = 'b'.repeat(40);

function commitJson(commitSha = sha, message = 'Drop DASHBOARD beside the wordmark\n\nlong body') {
  return { sha: commitSha, commit: { message: message, committer: { date: '2026-10-16T16:55:00Z' } } };
}

// A GitHub that answers the two addresses and keeps every request
function fakeGithub(options = {}) {
  const seen = [];
  const top = 'teletraan-' + sha + '/';
  const zip = options.zip || makeZip(Object.fromEntries(Object.entries(sampleTree()).map(([name, text]) => [top + name, text])));
  const github = {
    seen: seen,
    fetch: async (url, init = {}) => {
      seen.push({ url: String(url), init: init });
      if (options.status) return { ok: false, status: options.status };
      if (options.offline) throw new TypeError('fetch failed');
      if (String(url).includes('/commits/')) return { ok: true, status: 200, json: async () => commitJson(options.sha || sha) };
      if (options.hold) await options.hold;
      return { ok: true, status: 200, headers: { get: name => (name === 'content-length' && options.length ? String(options.length) : null) }, arrayBuffer: async () => zip };
    },
  };
  return github;
}

test('latest reads the commit: full sha, short, first line of the message cut to 90, date', async () => {
  const github = fakeGithub();
  const found = await latest({ github: github });
  assert.deepEqual(found, { commit: sha, short: '4e18836', message: 'Drop DASHBOARD beside the wordmark', date: '2026-10-16T16:55:00Z' });
  assert.equal(github.seen[0].url, 'https://api.github.com/repos/Hawktimus/teletraan/commits/main');
  const long = fakeGithub();
  const original = long.fetch;
  long.fetch = async (url, init) => Object.assign(await original(url, init), { json: async () => commitJson(sha, 'x'.repeat(200)) });
  assert.equal((await latest({ github: long })).message.length, 90);
});

test('a limit answer gives the plain sentence, no internet gives its own, and other answers name the status', async () => {
  for (const status of [403, 429]) {
    await assert.rejects(latest({ github: fakeGithub({ status: status }) }), error => error.message === 'GitHub is limiting requests. Try again in a few minutes.' && error.status === 429);
  }
  await assert.rejects(latest({ github: fakeGithub({ offline: true }) }), /could not reach GitHub/);
  await assert.rejects(latest({ github: fakeGithub({ status: 500 }) }), /GitHub answered with 500/);
});

test('download asks for the zip of the exact sha, refuses another kind of name, and caps the size at 100 MB', async () => {
  const github = fakeGithub();
  const bytes = await download({ github: github }, sha);
  assert.ok(Buffer.isBuffer(bytes) && bytes.length > 0);
  assert.equal(github.seen[0].url, 'https://codeload.github.com/Hawktimus/teletraan/zip/' + sha);
  await assert.rejects(download({ github: github }, 'main'), /full commit hash/);
  await assert.rejects(download({ github: fakeGithub({ length: 100 * 1024 * 1024 + 1 }) }, sha), error => /larger than 100 MB/.test(error.message) && error.status === 413);
  const small = fakeGithub();
  await assert.rejects(download({ github: Object.assign(small, { maxBytes: 10 }) }, sha), /larger than/);
});

test('a stream that runs past the cap is cut off', async () => {
  const chunks = [Buffer.alloc(600), Buffer.alloc(600)];
  let cancelled = false;
  const github = {
    maxBytes: 1000,
    fetch: async () => ({ ok: true, status: 200, headers: { get: () => null }, body: { getReader: () => ({ read: async () => (chunks.length ? { done: false, value: chunks.shift() } : { done: true }), cancel: async () => { cancelled = true; } }) } }),
  };
  await assert.rejects(download({ github: github }, sha), /larger than/);
  assert.equal(cancelled, true);
});

test('no request carries an Authorization header', async () => {
  const github = fakeGithub();
  await latest({ github: github });
  await download({ github: github }, sha);
  github.seen.forEach(call => {
    assert.ok(!Object.keys(call.init.headers || {}).some(name => name.toLowerCase() === 'authorization'), call.url);
  });
});

// The routes over HTTP

async function serve(github) {
  const root = path.join(work, 'service' + Math.random().toString(16).slice(2));
  fs.mkdirSync(path.join(root, 'releases/1/dashboard'), { recursive: true });
  fs.mkdirSync(path.join(root, 'releases/1/computer'), { recursive: true });
  fs.writeFileSync(path.join(root, 'releases/1/RELEASE.json'), JSON.stringify({ version: 1, commit: '4e18836', date: '2026-10-15T20:00:00Z', from: 'github', note: 'Before', treeHash: '' }));
  fs.symlinkSync('releases/1', path.join(root, 'current'));
  fs.writeFileSync(path.join(root, 'local.env'), "CONTROL_PIN='424242'\n");
  const { server, ctx } = await createService({
    port: 0, host: '127.0.0.1', rootDir: root, releasesDir: path.join(root, 'releases'), dataDir: root, envFile: path.join(root, 'local.env'),
    secretFile: path.join(root, 'control-secret'), socket: path.join(root, 'none.sock'), logFile: path.join(root, 'logs/control.log'),
  }, { github: github, helper: async () => '', waitForBuild: async () => true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const login = await fetch(base + '/control/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '424242' }) });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  return { base: base, ctx: ctx, server: server, root: root, headers: { cookie: cookie } };
}

test('both routes need the PIN', async () => {
  const s = await serve(fakeGithub());
  try {
    assert.equal((await fetch(s.base + '/control/api/github/latest')).status, 401);
    assert.equal((await fetch(s.base + '/control/api/github/update', { method: 'POST' })).status, 401);
  } finally {
    s.server.close();
  }
});

test('latest says whether the wall has the commit (the wall commit starts it) and what is on the wall', async () => {
  const github = fakeGithub();
  const s = await serve(github);
  try {
    let answer = await (await fetch(s.base + '/control/api/github/latest', { headers: s.headers })).json();
    assert.equal(answer.commit, sha);
    assert.equal(answer.short, '4e18836');
    assert.equal(answer.onWall, true);
    assert.deepEqual(answer.wall, { version: 1, short: '4e18836' });
    github.fetch = fakeGithub({ sha: other }).fetch;
    answer = await (await fetch(s.base + '/control/api/github/latest', { headers: s.headers })).json();
    assert.equal(answer.onWall, false);
  } finally {
    s.server.close();
  }
});

test('latest answers the limit sentence and the offline sentence as plain errors', async () => {
  const limited = await serve(fakeGithub({ status: 403 }));
  const offline = await serve(fakeGithub({ offline: true }));
  try {
    const a = await fetch(limited.base + '/control/api/github/latest', { headers: limited.headers });
    assert.equal(a.status, 429);
    assert.equal((await a.json()).error, 'GitHub is limiting requests. Try again in a few minutes.');
    const b = await fetch(offline.base + '/control/api/github/latest', { headers: offline.headers });
    assert.equal(b.status, 502);
    assert.match((await b.json()).error, /could not reach GitHub/);
  } finally {
    limited.server.close();
    offline.server.close();
  }
});

test('update downloads the sha, strips the top folder, installs as release 2 from github with the note, and a second press during it is refused', async () => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const github = fakeGithub({ sha: other, hold: hold });
  const s = await serve(github);
  try {
    const first = fetch(s.base + '/control/api/github/update', { method: 'POST', headers: s.headers });
    await new Promise(resolve => setTimeout(resolve, 150));
    const second = await fetch(s.base + '/control/api/github/update', { method: 'POST', headers: s.headers });
    assert.equal(second.status, 409);
    assert.match((await second.json()).error, /Another update is running/);
    release();
    const response = await first;
    assert.equal(response.status, 200);
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(events.filter(e => e.state === 'start').map(e => e.step), ['download', 'unpack', 'files', 'schemas', 'studio', 'release', 'switch', 'restart', 'wait']);
    assert.equal(events[events.length - 1].step, 'finish');
    assert.equal(events[events.length - 1].state, 'done');
    // the zip asked for is the one of the sha the API gave, not the branch
    assert.ok(github.seen.some(call => call.url === 'https://codeload.github.com/Hawktimus/teletraan/zip/' + other));
    const dir = path.join(s.root, 'releases', '2');
    assert.ok(fs.existsSync(path.join(dir, 'dashboard/index.html')), 'the top folder is gone');
    assert.ok(!fs.existsSync(path.join(dir, 'teletraan-' + sha)));
    const info = JSON.parse(fs.readFileSync(path.join(dir, 'RELEASE.json'), 'utf8'));
    assert.equal(info.from, 'github');
    assert.equal(info.commit, 'bbbbbbb');
    assert.equal(info.note, 'From GitHub bbbbbbb Drop DASHBOARD beside the wordmark');
    assert.equal(s.ctx.releases.currentNumber(), 2);
    github.seen.forEach(call => assert.ok(!Object.keys(call.init.headers || {}).some(name => name.toLowerCase() === 'authorization')));
  } finally {
    s.server.close();
  }
});

test('a failed download ends the stream with the sentence and installs nothing', async () => {
  const s = await serve(fakeGithub({ length: 200 * 1024 * 1024 }));
  try {
    const response = await fetch(s.base + '/control/api/github/update', { method: 'POST', headers: s.headers });
    const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(events[events.length - 1].state, 'fail');
    assert.match(events[events.length - 1].message, /larger than 100 MB/);
    assert.equal(s.ctx.releases.currentNumber(), 1);
    assert.deepEqual(s.ctx.releases.numbers(), [1]);
  } finally {
    s.server.close();
  }
});

test('the Update tab has the From GitHub card first, the disabled words, Check again, and the folder card below', () => {
  const card = fs.readFileSync(new URL('../control/static/github-card.js', import.meta.url), 'utf8');
  const tab = fs.readFileSync(new URL('../control/static/tab-update.js', import.meta.url), 'utf8');
  assert.ok(card.includes("'From GitHub'") && card.includes("'Update from GitHub'") && card.includes("'Already on the wall'") && card.includes("'Check again'"));
  assert.ok(card.includes("'On GitHub: '") && card.includes("'On the wall: '"));
  assert.ok(tab.indexOf('githubCard(') < tab.indexOf('columns);') && tab.includes("'From a folder on this computer'"));
});

fs.rmSync(work, { recursive: true, force: true });
await finish();
