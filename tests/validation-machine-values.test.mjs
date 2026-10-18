// Checks that what the control page, the sync scripts and the computer write into the dataset
// passes the rules of the Studio, so that Publish all never holds back a document because a
// machine wrote it. The real Sanity validation runs on a scratch copy of the studio folder that
// borrows the installed packages. When they are not installed the checks are skipped and the
// test says so.
//
//   node tests/validation-machine-values.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildRequest } from '../control/support/requests.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = [path.join(root, 'studio', 'node_modules'), path.join(root, '..', 'teletraan', 'studio', 'node_modules')].find(folder => fs.existsSync(path.join(folder, '@sanity', 'validation')));

if (!modules) {
  console.log('SKIP  the Sanity packages are not installed, so the real validation cannot run');
  console.log('0 of 0 checks passed.');
  process.exit(0);
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-validate-'));
fs.cpSync(path.join(root, 'studio'), path.join(scratch, 'studio'), { recursive: true, filter: source => !source.includes('node_modules') });
fs.symlinkSync(modules, path.join(scratch, 'studio', 'node_modules'));
const studio = path.join(scratch, 'studio');
const { createRequire } = await import('node:module');
const need = createRequire(path.join(studio, 'x.js'));
const { Schema } = await import(pathToFileURL(need.resolve('@sanity/schema')).href);
const { validateDocument } = await import(pathToFileURL(need.resolve('@sanity/validation')).href);
const schemas = await import(pathToFileURL(path.join(studio, 'schemas', 'index.js')).href);
const schema = Schema.compile({ name: 'teletraan', types: schemas.schemaTypes || schemas.default });

// The problems of one document, as 'path: message', only for the paths that start with one of the named fields
async function problems(document, only) {
  const result = await validateDocument({ document: document, schema: schema, client: {}, getDocumentExists: async () => true });
  return result.markers
    .filter(marker => marker.level === 'error' && (!only || only.includes(marker.path[0])))
    .map(marker => marker.path.join('.') + ': ' + marker.message);
}

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const requestFields = ['holdPanel', 'showView', 'previewTheme', 'pauseRotation', 'nextLookRequest', 'announceRequest', 'presentationTestRequest', 'competitionPreviewRequest'];
const settings = extra => Object.assign({ _id: 'dashboardSettings', _type: 'dashboardSettings' }, extra);
const at = new Date('2026-10-15T12:00:00Z');

await check('every request the control page writes passes the rules of Dashboard Settings', async () => {
  const shapes = [
    buildRequest('next', {}, at).set,
    buildRequest('pause', { minutes: 15 }, at).set,
    buildRequest('hold', { panel: 'tasks', minutes: 10 }, at).set,
    buildRequest('view', { key: 'nova', minutes: 30 }, at).set,
    buildRequest('theme', { theme: 'retro' }, at).set,
    buildRequest('announce', {}, at).set,
    buildRequest('presentation-test', {}, at).set,
  ];
  for (const shape of shapes) assert.deepEqual(await problems(settings(shape), requestFields), []);
});

await check('the cleared shapes pass: Back to schedule, Resume, and a missing until', async () => {
  const cleared = buildRequest('schedule', {}, at).set;
  assert.deepEqual(await problems(settings(cleared), requestFields), []);
  assert.deepEqual(await problems(settings(buildRequest('resume', {}, at).set), requestFields), []);
  assert.deepEqual(await problems(settings({ holdPanel: { panel: 'tasks' }, pauseRotation: {}, previewTheme: { theme: null, until: null }, showView: { key: '' } }), requestFields), []);
  assert.deepEqual(await problems(settings({ holdPanel: null, showView: null, previewTheme: null, pauseRotation: null }), requestFields), []);
});

await check('a malformed text in a request field still fails', async () => {
  assert.equal((await problems(settings({ holdPanel: { panel: 'tasks', until: 'tomorrow' } }), requestFields)).length, 1);
  assert.equal((await problems(settings({ pauseRotation: { until: '2026-13-45' } }), requestFields)).length, 1);
  assert.equal((await problems(settings({ previewTheme: { theme: 'neon', until: '' } }), requestFields)).length, 1);
  assert.equal((await problems(settings({ showView: { key: 'minimal', until: '' } }), requestFields)).length, 1);
});

await check('an announcement made by the control page passes', async () => {
  const made = buildRequest('post-announcement', { text: 'Pizza at 6' }, at).create;
  assert.deepEqual(await problems(Object.assign({ _id: 'a1' }, made)), []);
});

await check('an old Screen with a row that has no panel passes', async () => {
  const rows = [{ _key: 'a', panel: 'tasks', seconds: 20 }, { _key: 'b' }, { _key: 'c', seconds: 12 }];
  assert.deepEqual(await problems({ _id: 'screen-original', _type: 'screen', mainRows: rows }, ['mainRows']), []);
});

await check('the status documents of the computer pass', async () => {
  const time = '2026-10-15T12:00:00Z';
  const status = {
    _id: 'status-mini', _type: 'status', lastContentSeenAt: time, lastCalendarSyncAt: time, lastSlidesFetchAt: time, lastMondaySyncAt: time,
    lastFrcSyncAt: time, kioskStartedAt: time, buildCommit: 'c387c90', buildDate: '2026-10-17', buildBranch: '', kioskRestarts: 0,
    lastKioskRestartAt: time, lastBackupAt: time, photosDriveAt: time, photosDriveState: 'off', photosDriveCount: 0,
  };
  assert.deepEqual(await problems(status), []);
  assert.deepEqual(await problems({ _id: 'status-mini', _type: 'status' }), []);
});

fs.rmSync(scratch, { recursive: true, force: true });
console.log(passed + ' of ' + passed + ' checks passed.');
