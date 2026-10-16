// Releases and installs of the control service: the counter, the keep-5 rule, the switch and rollback, the install
// steps in order, and that a failure removes the half-built folder and leaves current alone. Programs the
// install would run (the schema check, npm) are replaced by a fake that is told what to answer.
//
//   node tests/control-releases.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { makeZip, sampleTree } from './helpers/zip-maker.mjs';
import { createReleases, buildJsText, buildName, shortCommit } from '../control/lib/releases.js';
import { installRelease, steps } from '../control/lib/install.js';

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-releases-'));
let counter = 0;

// A root with an empty releases folder and a context for the install
function place(options = {}) {
  const root = path.join(work, 'root' + counter++);
  const releasesDir = path.join(root, 'releases');
  fs.mkdirSync(releasesDir, { recursive: true });
  const calls = [];
  const events = [];
  const ctx = {
    rootDir: root,
    releasesDir: releasesDir,
    releases: createReleases(releasesDir),
    state: {},
    log: () => {},
    run: async (command, args) => {
      calls.push(command + ' ' + args.join(' '));
      return options.schemaFails && args[0].endsWith('schemas.test.mjs') ? { code: 1, output: 'schema Foo is wrong' } : { code: 0, output: '' };
    },
    helper: async word => { calls.push('helper ' + word); return { ok: true, output: '' }; },
    waitForBuild: async build => { calls.push('wait ' + build); return true; },
  };
  return { root: root, releasesDir: releasesDir, ctx: ctx, calls: calls, events: events, emit: event => events.push(event) };
}

function fakeRelease(p, n, extra = {}) {
  const dir = path.join(p.releasesDir, String(n));
  fs.mkdirSync(path.join(dir, 'dashboard'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'RELEASE.json'), JSON.stringify(Object.assign({ version: n, commit: 'abc1234', date: '2026-10-15T20:00:00Z', from: 'upload', note: '', treeHash: 'h' + n }, extra)));
  fs.mkdirSync(path.join(dir, 'mini'), { recursive: true });
  return dir;
}

test('the counter only goes up: it is not lowered by removing releases or by a lost file', () => {
  const p = place();
  const releases = p.ctx.releases;
  assert.equal(releases.takeNumber(), 1);
  assert.equal(releases.takeNumber(), 2);
  fs.rmSync(path.join(p.releasesDir, 'COUNTER'));
  fakeRelease(p, 7);
  assert.equal(releases.takeNumber(), 8, 'a lost counter is rebuilt from the folders');
  fs.writeFileSync(path.join(p.releasesDir, 'COUNTER'), '40\n');
  assert.equal(releases.takeNumber(), 41, 'the owner can raise the counter by hand');
  fs.writeFileSync(path.join(p.releasesDir, 'COUNTER'), '3\n');
  assert.equal(releases.takeNumber(), 8, 'a counter lowered by hand is still kept above the newest folder');
});

test('flip points current at a release without a moment when there is no link, and links the top folders', () => {
  const p = place();
  fakeRelease(p, 1);
  fakeRelease(p, 2);
  p.ctx.releases.flip(1);
  assert.equal(p.ctx.releases.currentNumber(), 1);
  assert.equal(fs.readlinkSync(path.join(p.root, 'current')), path.join('releases', '1'));
  assert.equal(fs.readlinkSync(path.join(p.root, 'mini')), path.join('current', 'mini'));
  p.ctx.releases.flip(2);
  assert.equal(p.ctx.releases.currentNumber(), 2);
  assert.ok(fs.existsSync(path.join(p.root, 'dashboard')), 'the old name reaches the new release');
  assert.throws(() => p.ctx.releases.flip(9), /no release 9/);
});

test('rollback and roll forward switch current, and a release from before the move is refused', () => {
  const p = place();
  fakeRelease(p, 1);
  fakeRelease(p, 2);
  fakeRelease(p, 3);
  fs.mkdirSync(path.join(p.releasesDir, '1', 'deploy', 'scripts'), { recursive: true });
  p.ctx.releases.flip(3);
  assert.equal(p.ctx.releases.activate(2).version, 2);
  assert.equal(p.ctx.releases.currentNumber(), 2);
  assert.equal(p.ctx.releases.activate(3).version, 3);
  assert.throws(() => p.ctx.releases.activate(1), /older than round 6; update it\./);
  assert.equal(p.ctx.releases.currentNumber(), 3, 'a refused switch changes nothing');
  assert.throws(() => p.ctx.releases.activate(99), /no release 99/);
  const listed = p.ctx.releases.list();
  assert.deepEqual(listed.map(r => r.version), [3, 2, 1]);
  assert.deepEqual(listed.map(r => r.current), [true, false, false]);
  assert.equal(listed[2].legacy, true);
});

test('the last 5 are kept, older ones are removed, and the live one is never removed', () => {
  const p = place();
  for (let n = 1; n <= 8; n++) fakeRelease(p, n);
  p.ctx.releases.flip(2);
  const removed = p.ctx.releases.prune();
  assert.deepEqual(removed.sort(), [1, 3]);
  assert.deepEqual(p.ctx.releases.numbers(), [8, 7, 6, 5, 4, 2]);
  assert.equal(p.ctx.releases.currentNumber(), 2);
});

test('build.js carries build, version, commit and date, and the build changes with every release', () => {
  const text = buildJsText({ version: 15, commit: 'A1B2C3D4E5F6', date: '2026-10-15T20:52:00Z' });
  assert.equal(text, 'export const build = "15-a1b2c3d";\nexport const version = 15;\nexport const commit = "a1b2c3d";\nexport const date = "2026-10-15T20:52:00Z";\n');
  assert.equal(buildName(16, ''), '16');
  assert.equal(buildName(16, 'zzz'), '16');
  assert.equal(shortCommit('not a hash'), '');
  assert.notEqual(buildName(15, 'a1b2c3d'), buildName(16, 'a1b2c3d'));
});

test('an install from a zip runs the steps in order, writes RELEASE.json and build.js, and switches', async () => {
  const p = place();
  fakeRelease(p, 1);
  p.ctx.releases.flip(1);
  fs.writeFileSync(path.join(p.root, 'local.env'), "SANITY_WRITE_TOKEN='x'\n");
  fs.mkdirSync(path.join(p.releasesDir, '1', 'tests'), { recursive: true });
  const zip = makeZip(sampleTree({ 'tests/schemas.test.mjs': '// check\n' }));
  const info = await installRelease(p.ctx, { zip: zip, note: 'First push', commit: 'A1B2C3D4', from: 'upload', emit: p.emit, studio: false });

  assert.equal(info.version, 2);
  assert.equal(p.ctx.releases.currentNumber(), 2);
  const done = p.events.filter(e => e.state === 'done').map(e => e.step);
  assert.deepEqual(done.filter(s => steps.includes(s)), steps, 'every step finished, in order');
  const release = JSON.parse(fs.readFileSync(path.join(p.releasesDir, '2', 'RELEASE.json'), 'utf8'));
  assert.deepEqual(Object.keys(release), ['version', 'commit', 'date', 'from', 'note', 'treeHash']);
  assert.equal(release.commit, 'a1b2c3d');
  assert.equal(release.from, 'upload');
  assert.equal(release.note, 'First push');
  assert.match(release.treeHash, /^[0-9a-f]{64}$/);
  assert.match(fs.readFileSync(path.join(p.releasesDir, '2', 'dashboard/build.js'), 'utf8'), /^export const build = "2-a1b2c3d";/);
  assert.equal(fs.readlinkSync(path.join(p.releasesDir, '2', 'mini/local.env')), path.join(p.root, 'local.env'));
  assert.ok(fs.existsSync(path.join(p.releasesDir, '2', 'studio-dist')));
  assert.ok(!fs.existsSync(path.join(p.releasesDir, '2.tmp')));
  assert.ok(p.calls.some(c => c.startsWith('node ') && c.endsWith('schemas.test.mjs')), p.calls.join(' | '));
  assert.deepEqual(p.calls.filter(c => c.startsWith('helper') || c.startsWith('wait')), ['helper restart-services', 'helper restart-kiosk', 'wait 2-a1b2c3d']);
  assert.ok(p.events.some(e => e.step === 'wait' && e.message === 'On the wall: v2'));
});

test('a failing schema check removes the half-built folder, leaves current alone and uses up the number', async () => {
  const p = place({ schemaFails: true });
  fakeRelease(p, 1);
  p.ctx.releases.flip(1);
  const zip = makeZip(sampleTree({ 'tests/schemas.test.mjs': '// check\n' }));
  await assert.rejects(installRelease(p.ctx, { zip: zip, emit: p.emit, studio: false }), /schema check failed/);
  assert.equal(p.ctx.releases.currentNumber(), 1);
  assert.deepEqual(p.ctx.releases.numbers(), [1]);
  assert.ok(!fs.existsSync(path.join(p.releasesDir, '2.tmp')));
  assert.equal(p.ctx.releases.readCounter(), 2, 'the number is not used again');
  assert.ok(p.events.some(e => e.step === 'schemas' && e.state === 'fail' && e.message.includes('schema Foo is wrong')));
  assert.ok(p.events.some(e => e.step === 'finish' && e.state === 'fail'));
  assert.ok(!p.calls.some(c => c.startsWith('helper')), 'the screen is not restarted');
  assert.equal(p.ctx.state.installing, false, 'another install can start');
});

test('a tree that still has deploy/, a tree without a dashboard and a bad zip are refused before anything changes', async () => {
  const p = place();
  fakeRelease(p, 1);
  p.ctx.releases.flip(1);
  await assert.rejects(installRelease(p.ctx, { zip: makeZip(sampleTree({ 'deploy/scripts/pull.sh': '#!/bin/sh\n' })), emit: p.emit, studio: false }), /This copy is older than round 6; update it\./);
  await assert.rejects(installRelease(p.ctx, { zip: makeZip({ 'readme.txt': 'x' }), emit: p.emit, studio: false }), /no dashboard\/index\.html/);
  await assert.rejects(installRelease(p.ctx, { zip: Buffer.from('nope'), emit: p.emit, studio: false }), /not a zip/);
  assert.equal(p.ctx.releases.currentNumber(), 1);
  assert.deepEqual(p.ctx.releases.numbers(), [1]);
});

test('an install from a folder leaves out .git, packages and keys, and two installs cannot run together', async () => {
  const p = place();
  const source = path.join(work, 'source');
  Object.entries(sampleTree({ '.git/HEAD': 'ref', 'studio/node_modules/x.js': '1', 'mini/local.env': 'SECRET', 'dashboard/build.js': 'old' })).forEach(([name, text]) => {
    fs.mkdirSync(path.dirname(path.join(source, name)), { recursive: true });
    fs.writeFileSync(path.join(source, name), text);
  });
  const first = installRelease(p.ctx, { dir: source, from: 'git', commit: 'deadbee', emit: p.emit, studio: false, restart: false });
  await assert.rejects(installRelease(p.ctx, { dir: source, emit: p.emit, studio: false }), /Another update is running/);
  const info = await first;
  assert.equal(info.from, 'git');
  const dir = path.join(p.releasesDir, String(info.version));
  assert.ok(!fs.existsSync(path.join(dir, '.git')) && !fs.existsSync(path.join(dir, 'studio/node_modules')));
  assert.ok(!fs.existsSync(path.join(dir, 'mini/local.env')) || fs.lstatSync(path.join(dir, 'mini/local.env')).isSymbolicLink());
  assert.match(fs.readFileSync(path.join(dir, 'dashboard/build.js'), 'utf8'), /deadbee/);
  assert.ok(!p.calls.some(c => c.startsWith('helper')), 'restart: false asks the helper for nothing');
});

test('installing keeps only 5 releases and never removes the one on the wall', async () => {
  const p = place();
  for (let n = 1; n <= 6; n++) fakeRelease(p, n);
  p.ctx.releases.flip(1);
  await installRelease(p.ctx, { zip: makeZip(sampleTree()), emit: p.emit, studio: false, restart: false });
  assert.equal(p.ctx.releases.currentNumber(), 7);
  assert.deepEqual(p.ctx.releases.numbers(), [7, 6, 5, 4, 3]);
});

fs.rmSync(work, { recursive: true, force: true });
await finish();
