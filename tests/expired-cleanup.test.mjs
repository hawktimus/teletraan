// Tests for the clean up of expired items: cleanup-plan.mjs (what may be deleted), expired-cleanup.sh (the run), status-write.sh
// cleanup, the units and the installer. Sanity is a fake curl in a temporary folder that answers from files, keeps what is
// written, and fails when asked to. node, jq and the shell are the real ones, and the clock is given by CLEANUP_NOW, so nothing
// leaves the machine and nothing real is deleted.
//
//   node tests/expired-cleanup.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as plan from '../computer/scripts/cleanup-plan.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-cleanup-'));
process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));
const token = 'skTESTONLYnotarealkey0123';
let passed = 0;
let counter = 0;

function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const now = Date.parse('2026-10-21T03:40:00Z');
const dayMs = 86400000;
const ago = days => new Date(now - days * dayMs).toISOString();
const dayAgo = days => new Date(now - days * dayMs).toISOString().slice(0, 10);
const oldEdit = '2026-01-01T00:00:00.000Z';
const on = (days = 14, mode = 'delete') => ({ cleanupEnabled: true, cleanupDeleteAfterDays: days, cleanupMode: mode });

// ----- the plan, in process -----

// One expired document of each allowed type, with the field that decides it. 30 days ago is past the 14 day grace.
const expiredOf = {
  tipOrNews: { text: 'Old tip', expires: ago(30) },
  announcement: { text: 'Old notice', start: ago(40), end: ago(30) },
  photo: { caption: 'Old photo', expires: ago(30) },
  plan: { heading: 'Old meeting', date: dayAgo(30) },
  person: { name: 'Old coach', expires: ago(30) },
  rosterPerson: { firstName: 'Sam', expires: ago(30) },
  subteam: { name: 'Old subteam', expires: ago(30) },
  sponsor: { name: 'Old sponsor', expires: ago(30) },
  calendarFilter: { name: 'Old rule', expires: ago(30) },
  presentation: { name: 'Pat', topic: 'Old talk', start: ago(30) },
};

function doc(type, id, fields, updated = oldEdit) {
  return Object.assign({ _id: id, _type: type, _updatedAt: updated }, fields);
}

// Some kept documents of the same type, so that one expired document is not most of the type (the 40 percent stop)
function withCompany(type, docs) {
  const company = [];
  for (let index = 0; index < 5; index += 1) company.push(doc(type, 'keep-' + type + '-' + index, { name: 'Kept', text: 'Kept', heading: 'Kept', topic: 'Kept', firstName: 'Kept', start: ago(-5), end: ago(-5), expires: ago(-5), date: dayAgo(-5) }));
  return docs.concat(company);
}

function planOf(docs, setting = on(), at = now) {
  return plan.makePlan({ setting: setting, nowMs: at, docs: docs });
}

check('every allowed type is deleted when its own date field passed more than the grace ago, with its draft', () => {
  assert.deepEqual(plan.types.sort(), Object.keys(expiredOf).sort(), 'the allow-list is the ten types, no more');
  Object.entries(expiredOf).forEach(([type, fields]) => {
    const docs = withCompany(type, [doc(type, 'old-1', fields), doc(type, 'drafts.old-1', fields)]);
    const result = planOf(docs);
    assert.equal(result.candidates.length, 1, type);
    assert.deepEqual(result.candidates[0].ids, ['old-1', 'drafts.old-1'], type);
    assert.equal(result.candidates[0].ageDays, type === 'plan' ? 29 : 30, type);
    assert.equal(result.stop, null, type);
  });
});

check('the rule of a type with two date fields uses the later one, and a calendar filter counts To date and Hide after', () => {
  const agenda = withCompany('plan', [doc('plan', 'a1', { heading: 'Meeting', date: dayAgo(30), expires: ago(5) })]);
  assert.equal(planOf(agenda).candidates.length, 0, 'Hide after is only 5 days ago');
  const agendaDay = withCompany('plan', [doc('plan', 'a2', { heading: 'Meeting', date: dayAgo(3), expires: ago(30) })]);
  assert.equal(planOf(agendaDay).candidates.length, 0, 'the day is only 3 days ago');
  const rule = withCompany('calendarFilter', [doc('calendarFilter', 'f1', { name: 'Rule', toDate: dayAgo(30), expires: ago(2) })]);
  assert.equal(planOf(rule).candidates.length, 0);
  const rule2 = withCompany('calendarFilter', [doc('calendarFilter', 'f2', { name: 'Rule', toDate: dayAgo(30) })]);
  assert.equal(planOf(rule2).candidates.length, 1, 'a rule with only To date works');
});

check('the grace period: the day it is reached the document goes, the day before it stays, and the setting moves it', () => {
  const at = days => withCompany('tipOrNews', [doc('tipOrNews', 'g', { text: 'Tip', expires: ago(days) })]);
  assert.equal(planOf(at(13.9)).candidates.length, 0);
  assert.equal(planOf(at(14)).candidates.length, 1);
  assert.equal(planOf(at(20), on(30)).candidates.length, 0);
  assert.equal(planOf(at(31), on(30)).candidates.length, 1);
  assert.equal(planOf(at(2), on(1)).candidates.length, 1);
  assert.equal(plan.settingFrom({ cleanupDeleteAfterDays: 0 }).cleanupDeleteAfterDays, 14, 'a number out of range gives the starting value');
  assert.equal(plan.settingFrom({ cleanupDeleteAfterDays: 366 }).cleanupDeleteAfterDays, 14);
  assert.equal(plan.settingFrom({ cleanupDeleteAfterDays: 14.5 }).cleanupDeleteAfterDays, 14);
});

check('the starting setting is off, 14 days and list only, and anything odd falls back to it', () => {
  assert.deepEqual(plan.defaults, { cleanupEnabled: false, cleanupDeleteAfterDays: 14, cleanupMode: 'list' });
  assert.deepEqual(plan.settingFrom(null), plan.defaults);
  assert.deepEqual(plan.settingFrom({ cleanupEnabled: 'yes', cleanupMode: 'DELETE' }), plan.defaults);
  assert.equal(plan.settingFrom({ cleanupEnabled: true, cleanupMode: 'delete' }).cleanupMode, 'delete');
  assert.deepEqual(plan.daysRange, { min: 1, max: 365 });
});

check('types that are never touched are not touched, even with an old date', () => {
  const never = ['team', 'dashboardSettings', 'theme', 'view', 'screen', 'task', 'milestone', 'status', 'calendarStatus', 'mondayStatus', 'frcStatus', 'frcNews', 'extraEvent', 'customPanel', 'subtheme', 'presentationDay', 'place', 'demo', 'driveFolder'];
  const docs = never.map(type => doc(type, type + '-1', { expires: ago(400), end: ago(400), date: dayAgo(400), start: ago(400), text: 'x', name: 'x' }));
  docs.push(doc('task', 'task-monday-123', { expires: ago(400), title: 'x' }));
  const result = planOf(docs);
  assert.equal(result.candidates.length, 0);
  assert.deepEqual(result.totals, {});
});

check('an id that is a settings, status or Monday id is skipped even if its type is allowed', () => {
  const ids = ['dashboardSettings', 'theme', 'status-mini', 'calendar-status', 'monday-status', 'frc-status', 'frc-news', 'task-monday-5', 'milestone-monday-9'];
  const docs = ids.map(id => doc('tipOrNews', id, { text: 'Tip', expires: ago(400) }));
  docs.push(doc('tipOrNews', 'versions.release1.tip', { text: 'Tip', expires: ago(400) }));
  docs.push(doc('tipOrNews', 'tip.with.dots', { text: 'Tip', expires: ago(400) }));
  const result = planOf(docs);
  assert.equal(result.candidates.length, 0);
  assert.equal(result.skipped.length, ids.length + 2);
});

check('a document with no date, an empty date or a date that cannot be read is kept, and the unreadable ones are told', () => {
  const kinds = [
    ['none', {}],
    ['empty', { expires: '' }],
    ['null', { expires: null }],
  ];
  kinds.forEach(([name, fields]) => {
    const result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'n-' + name, Object.assign({ text: 'Tip' }, fields))]));
    assert.equal(result.candidates.length, 0, name);
    assert.equal(result.skipped.length, 0, name + ' is quiet: a tip with no end date is normal');
  });
  ['next week', '2026-02-30', 5, {}, '2026-08-01', '2026-13-01T00:00:00Z', '2026-08-01T25:00:00Z'].forEach(value => {
    const result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'bad', { text: 'Tip', expires: value })]));
    assert.equal(result.candidates.length, 0, JSON.stringify(value));
    assert.equal(result.skipped.length, 1, JSON.stringify(value));
    assert.match(result.skipped[0].reason, /cannot be read/);
  });
  ['next week', '2026-02-30', '2026-08-01T00:00:00Z', 30].forEach(value => {
    const result = planOf(withCompany('plan', [doc('plan', 'bad', { heading: 'Mtg', date: value })]));
    assert.equal(result.candidates.length, 0, 'plan date ' + JSON.stringify(value));
  });
  const draftBad = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'x', { text: 'Tip', expires: ago(30) }), doc('tipOrNews', 'drafts.x', { text: 'Tip', expires: 'soon' })]));
  assert.equal(draftBad.candidates.length, 0, 'one copy that cannot be read keeps the whole document');
});

check('a draft that was given a later date keeps the published copy too', () => {
  const result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'x', { text: 'Tip', expires: ago(30) }), doc('tipOrNews', 'drafts.x', { text: 'Tip', expires: ago(-30) })]));
  assert.equal(result.candidates.length, 0);
  const noDate = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'y', { text: 'Tip', expires: ago(30) }), doc('tipOrNews', 'drafts.y', { text: 'Tip' })]));
  assert.equal(noDate.candidates.length, 0, 'a draft with the date taken out keeps it too');
});

check('a document edited in the last 48 hours is kept, published or draft, and one edited just before is not', () => {
  const edit = hours => new Date(now - hours * 3600000).toISOString();
  const fields = { text: 'Tip', expires: ago(30) };
  let result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'e', fields, edit(24))]));
  assert.equal(result.candidates.length, 0);
  assert.match(result.skipped[0].reason, /48 hours/);
  result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'e', fields, edit(47.9))]));
  assert.equal(result.candidates.length, 0);
  result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'e', fields, edit(48.1))]));
  assert.equal(result.candidates.length, 1);
  result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'e', fields), doc('tipOrNews', 'drafts.e', fields, edit(5))]));
  assert.equal(result.candidates.length, 0, 'a fresh draft keeps the old published copy');
  result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'e', fields, 'not a time')]));
  assert.equal(result.candidates.length, 0, 'an edit time that cannot be read keeps it');
});

check('a draft with no published copy is kept for 14 days after its last edit', () => {
  const fields = { text: 'Tip', expires: ago(60) };
  const edit = days => new Date(now - days * dayMs).toISOString();
  let result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'drafts.d', fields, edit(10))]));
  assert.equal(result.candidates.length, 0);
  assert.match(result.skipped[0].reason, /never published/);
  result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'drafts.d', fields, edit(15))]));
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].ids, ['drafts.d']);
  result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'd', fields, edit(10))]));
  assert.equal(result.candidates.length, 1, 'a published copy with no draft is only held by the 48 hours');
});

check('at most 100 documents a run, the oldest first, and the rest are counted as waiting', () => {
  const docs = [];
  for (let index = 0; index < 105; index += 1) docs.push(doc('tipOrNews', 'old-' + String(index).padStart(3, '0'), { text: 'Tip', expires: ago(20 + index) }));
  for (let index = 0; index < 200; index += 1) docs.push(doc('tipOrNews', 'new-' + index, { text: 'Tip' }));
  const result = planOf(docs);
  assert.equal(plan.maxDeletions, 100);
  assert.equal(result.candidates.length, 100);
  assert.equal(result.waiting, 5);
  assert.equal(result.stop, null, '105 of 305 is 34 percent');
  assert.equal(result.candidates[0].id, 'old-104', 'the oldest comes first');
  assert.ok(!result.candidates.some(candidate => candidate.id === 'old-000'), 'the newest of them waits');
});

check('more than 40 percent of one type stops the run, and exactly 40 percent does not', () => {
  const tips = (expired, kept) => {
    const docs = [];
    for (let index = 0; index < expired; index += 1) docs.push(doc('tipOrNews', 'old-' + index, { text: 'Tip', expires: ago(30) }));
    for (let index = 0; index < kept; index += 1) docs.push(doc('tipOrNews', 'new-' + index, { text: 'Tip' }));
    return docs;
  };
  let result = planOf(tips(3, 7));
  assert.equal(result.stop, null, '3 of 10 is 30 percent');
  result = planOf(tips(4, 6));
  assert.equal(result.stop, null, '4 of 10 is exactly 40 percent');
  result = planOf(tips(5, 5));
  assert.deepEqual(Object.keys(result.stop).sort(), ['count', 'label', 'total', 'type']);
  assert.equal(result.stop.count, 5);
  assert.equal(result.stop.total, 10);
  assert.match(plan.stopWords(result.stop), /more than 40 percent/);
  result = planOf(tips(1, 1));
  assert.equal(result.stop && result.stop.count, 1, 'one of two sponsors is 50 percent and is held back too');
  assert.equal(plan.maxShare, 0.4);
});

check('verify keeps only the copies that are still as planned', () => {
  const result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'a', { text: 'Tip', expires: ago(30) }), doc('tipOrNews', 'b', { text: 'Tip', expires: ago(30) }), doc('tipOrNews', 'c', { text: 'Tip', expires: ago(30) })]));
  const fresh = [doc('tipOrNews', 'a', {}), doc('tipOrNews', 'b', {}, '2026-10-21T03:00:00.000Z')];
  const kept = plan.verifyPlan(result, fresh);
  assert.deepEqual(kept.candidates.map(candidate => candidate.id), ['a']);
  assert.equal(kept.changedWhileRunning, 2, 'b was edited and c is gone');
});

check('the lines for the page are tab separated, and a title cannot break them', () => {
  const result = planOf(withCompany('tipOrNews', [doc('tipOrNews', 'a', { text: 'Pipe | and\ttab\nline', expires: ago(30) })]));
  const lines = plan.linesOf(result);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].split('\t'), ['item', 'Tip or news', 'Pipe and tab line', dayAgo(30), '30']);
  assert.match(plan.textOf(result, '2026-10-21T03:40:00Z', 'list'), /list only, nothing is deleted/);
});

// ----- the run, with a fake Sanity -----

const fakeCurl = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dir = process.env.STUB_DIR;
const args = process.argv.slice(2);
const log = line => fs.appendFileSync(path.join(dir, 'calls.log'), line + '\\n');
const read = (name, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch (error) { return fallback; } };
const options = read('options.json', {});
let output = '';
let body = '';
let method = 'GET';
let url = '';
const queries = {};
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--output') output = args[++index];
  else if (arg === '--data-binary') body = fs.readFileSync(args[++index].slice(1), 'utf8');
  else if (arg === '--data-urlencode') { const pair = args[++index]; const at = pair.indexOf('='); queries[pair.slice(0, at)] = pair.slice(at + 1); }
  else if (arg === '--request') method = args[++index];
  else if (arg === '--max-time' || arg === '--connect-timeout' || arg === '--max-filesize' || arg === '--proto' || arg === '--header' || arg === '--write-out' || arg === '--config') index += 1;
  else if (arg.startsWith('https://')) url = arg;
}
const config = fs.readFileSync(0, 'utf8');
log('config-has-key ' + config.includes('Authorization: Bearer'));
if (options.curlExit) process.exit(options.curlExit);
const respond = (code, value) => { if (output) fs.writeFileSync(output, typeof value === 'string' ? value : JSON.stringify(value)); process.stdout.write(String(code)); };
const docsPath = path.join(dir, 'docs.json');
const docs = read('docs.json', []);
const where = new URL(url).pathname;
if (where.includes('/data/query/') && method === 'GET' && String(queries.query).includes('dashboardSettings')) {
  log('GET setting');
  if (options.settingStatus) return respond(options.settingStatus, 'nope');
  return respond(200, { result: read('setting.json', null) });
}
if (where.includes('/data/query/') && method === 'GET') {
  log('GET documents ' + queries.perspective);
  if (options.docsStatus) return respond(options.docsStatus, 'nope');
  return respond(200, { result: docs });
}
if (where.includes('/data/query/') && method === 'POST') {
  const ids = JSON.parse(body).params.ids;
  log('POST fresh ' + ids.length);
  if (options.freshStatus) return respond(options.freshStatus, 'nope');
  if (options.freshEmpty) return respond(200, { result: [] });
  const override = read('fresh.json', {});
  const found = docs.filter(item => ids.includes(item._id)).map(item => Object.assign({}, item, override[item._id] || {}));
  return respond(200, { result: found });
}
if (where.includes('/data/mutate/')) {
  const mutations = JSON.parse(body).mutations;
  const backups = fs.existsSync(path.join(process.env.DATA_DIR, 'cleanup')) ? fs.readdirSync(path.join(process.env.DATA_DIR, 'cleanup')).filter(name => /^backup-.*\\.json$/.test(name)) : [];
  log('POST mutate backup-before=' + (backups.length > 0) + ' ' + JSON.stringify(mutations));
  const first = mutations[0];
  const id = first.delete ? first.delete.id : first.createIfNotExists._id;
  if ((options.refuse || []).some(part => id.includes(part))) return respond(options.refuseStatus || 409, 'refused');
  const now = read('docs.json', []);
  if (first.delete) {
    const gone = mutations.map(item => item.delete.id);
    fs.writeFileSync(docsPath, JSON.stringify(now.filter(item => !gone.includes(item._id))));
  } else {
    mutations.forEach(item => { if (!now.some(existing => existing._id === item.createIfNotExists._id)) now.push(item.createIfNotExists); });
    fs.writeFileSync(docsPath, JSON.stringify(now));
  }
  return respond(200, { results: [] });
}
respond(404, 'unknown');
`;

function findTool(name) {
  const found = spawnSync('/bin/sh', ['-c', 'command -v ' + name], { encoding: 'utf8' }).stdout.trim();
  assert.ok(found, 'this computer has no ' + name);
  return found;
}

function makePlace(setting, docs, options = {}) {
  counter += 1;
  const root = path.join(work, 'place' + counter);
  const bin = path.join(root, 'bin');
  const stub = path.join(root, 'stub');
  const data = path.join(root, 'data');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  [bin, stub, data].forEach(folder => fs.mkdirSync(folder));
  ['expired-cleanup.sh', 'cleanup-plan.mjs', 'lib.sh'].forEach(name => fs.copyFileSync(path.join(repo, 'computer/scripts', name), path.join(root, 'computer/scripts', name)));
  fs.chmodSync(path.join(root, 'computer/scripts/expired-cleanup.sh'), 0o755);
  fs.writeFileSync(path.join(root, 'dashboard/config.js'), "export const sanity = {\n  projectId: 'abc123',\n  dataset: 'production',\n  apiVersion: '2024-01-01',\n};\n");
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_DATA='" + data + "'\n" + (options.noToken ? '' : "SANITY_WRITE_TOKEN='" + token + "'\n"));
  ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'cut', 'mkdir', 'chmod', 'mv', 'cp', 'mktemp', 'rm', 'tr', 'jq', 'node', 'find', 'basename', 'wc', 'env'].forEach(tool => fs.symlinkSync(findTool(tool), path.join(bin, tool)));
  fs.writeFileSync(path.join(bin, 'curl'), fakeCurl, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'flock'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'computer/scripts/status-write.sh'), '#!/bin/sh\necho "status-write $*" >> "$STUB_DIR/calls.log"\n', { mode: 0o755 });
  fs.writeFileSync(path.join(stub, 'calls.log'), '');
  const place = { root, bin, stub, data, folder: path.join(data, 'cleanup') };
  put(place, setting, docs, options);
  return place;
}

function put(place, setting, docs, options = {}) {
  fs.writeFileSync(path.join(place.stub, 'setting.json'), JSON.stringify(setting));
  fs.writeFileSync(path.join(place.stub, 'docs.json'), JSON.stringify(docs));
  fs.writeFileSync(path.join(place.stub, 'options.json'), JSON.stringify(options));
}

function run(place, flags = [], at = now / 1000) {
  const logFile = path.join(place.stub, 'calls.log');
  const seen = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).length;
  const result = spawnSync('/bin/bash', [path.join(place.root, 'computer/scripts/expired-cleanup.sh'), ...flags], {
    env: { PATH: place.bin, TZ: 'UTC', CLEANUP_NOW: String(at), STUB_DIR: place.stub, DATA_DIR: place.data },
    encoding: 'utf8',
    timeout: 60000,
    input: '',
  });
  const calls = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).slice(seen);
  const mutations = calls.filter(line => line.startsWith('POST mutate')).map(line => JSON.parse(line.slice(line.indexOf(' [') + 1)));
  const files = fs.existsSync(place.folder) ? fs.readdirSync(place.folder) : [];
  return { status: result.status, out: result.stdout, err: result.stderr, text: result.stdout + result.stderr, calls, mutations, files, deletedIds: mutations.flatMap(list => list.map(item => item.delete && item.delete.id).filter(Boolean)) };
}

const listFile = place => fs.readdirSync(place.folder).filter(name => /^list-.*\.txt$/.test(name)).map(name => fs.readFileSync(path.join(place.folder, name), 'utf8'))[0];
const backupFile = place => {
  const name = fs.readdirSync(place.folder).find(entry => /^backup-.*\.json$/.test(entry));
  return name ? path.join(place.folder, name) : null;
};
const statusOf = place => JSON.parse(fs.readFileSync(path.join(place.folder, 'status.json'), 'utf8'));
const liveDocs = place => JSON.parse(fs.readFileSync(path.join(place.stub, 'docs.json'), 'utf8'));

function oneOfEach() {
  const docs = [];
  Object.entries(expiredOf).forEach(([type, fields]) => {
    docs.push(doc(type, 'old-' + type, fields), doc(type, 'drafts.old-' + type, fields));
  });
  Object.keys(expiredOf).forEach(type => {
    docs.push(...withCompany(type, []));
  });
  return docs;
}

check('Mode: delete removes every allowed type with its draft, and the backup is on disk before the first delete', () => {
  const place = makePlace(on(), oneOfEach());
  const result = run(place);
  assert.equal(result.status, 0, result.text);
  const wanted = Object.keys(expiredOf).flatMap(type => ['old-' + type, 'drafts.old-' + type]).sort();
  assert.deepEqual(result.deletedIds.sort(), wanted);
  assert.equal(result.mutations.length, Object.keys(expiredOf).length, 'one request for each document, with its draft');
  result.calls.filter(line => line.startsWith('POST mutate')).forEach(line => assert.match(line, /backup-before=true/));
  assert.ok(result.calls.indexOf('POST fresh 20') < result.calls.findIndex(line => line.startsWith('POST mutate')), 'the backup is asked for first');
  const backup = JSON.parse(fs.readFileSync(backupFile(place), 'utf8'));
  assert.equal(backup.documents.length, 20);
  assert.deepEqual(backup.documents.map(item => item._id).sort(), wanted);
  assert.equal(liveDocs(place).filter(item => item._id.startsWith('old-')).length, 0);
  assert.equal(liveDocs(place).length, 50, 'the 5 kept documents of each type are still there');
  assert.match(listFile(place), /10 documents are on the list/);
  assert.match(listFile(place), /Deleted: Tip or news \| Old tip \| id old-tipOrNews/);
  assert.deepEqual(statusOf(place).deleted, 10);
  assert.equal(statusOf(place).wouldDelete, 10);
  assert.equal(statusOf(place).error, '');
  assert.ok(result.calls.includes('status-write cleanup'));
});

check('while the switch is off nothing is read but the setting, written or deleted', () => {
  const place = makePlace({ cleanupEnabled: false, cleanupMode: 'delete' }, oneOfEach());
  const result = run(place);
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(result.calls.filter(line => !line.startsWith('config-has-key')), ['GET setting']);
  assert.equal(result.files.filter(name => name !== '.lock').length, 0);
  assert.match(result.text, /is off in Dashboard Settings/);
});

check('a Dashboard Settings with no cleanup fields is off', () => {
  const place = makePlace({ _id: 'dashboardSettings', pageSeconds: 25 }, oneOfEach());
  assert.deepEqual(run(place).mutations, []);
  const empty = makePlace(null, oneOfEach());
  assert.deepEqual(run(empty).mutations, []);
});

check('Mode: list writes the list and the status and deletes nothing, with no backup', () => {
  const place = makePlace(on(14, 'list'), oneOfEach());
  const result = run(place);
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(result.mutations, []);
  assert.equal(backupFile(place), null);
  assert.match(listFile(place), /Mode: list only, nothing is deleted/);
  assert.match(listFile(place), /10 documents are on the list/);
  assert.equal(statusOf(place).wouldDelete, 10);
  assert.equal(statusOf(place).deleted, 0);
  assert.equal(liveDocs(place).length, 70);
  assert.match(result.text, /10 documents would be deleted/);
});

check('--dry-run writes only the list, even when the switch is off and the mode is delete, and does not touch the status', () => {
  const place = makePlace({ cleanupEnabled: false, cleanupDeleteAfterDays: 14, cleanupMode: 'delete' }, oneOfEach());
  const result = run(place, ['--dry-run', '--print']);
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(result.mutations, []);
  assert.equal(backupFile(place), null);
  assert.ok(!fs.existsSync(path.join(place.folder, 'status.json')));
  assert.ok(!result.calls.includes('status-write cleanup'));
  assert.ok(!result.calls.some(line => line.startsWith('POST fresh')), 'the documents are not even fetched in full');
  assert.deepEqual(fs.readdirSync(place.folder).filter(name => name !== '.lock').map(name => name.replace(/\d{8}T\d{6}Z/, 'STAMP')), ['list-STAMP.txt']);
  const items = result.out.split('\n').filter(line => line.startsWith('item\t'));
  assert.equal(items.length, 10);
  assert.equal(items[0].split('\t').length, 5);
  assert.ok(!/^error/m.test(result.out));
});

check('--print gives the page lines, and a stop or a wait comes as its own line', () => {
  const docs = [];
  for (let index = 0; index < 5; index += 1) docs.push(doc('tipOrNews', 'old-' + index, { text: 'Tip', expires: ago(30) }));
  for (let index = 0; index < 5; index += 1) docs.push(doc('tipOrNews', 'new-' + index, { text: 'Tip' }));
  docs.push(doc('tipOrNews', 'odd', { text: 'Odd one', expires: 'soon' }));
  const place = makePlace(on(), docs);
  const result = run(place, ['--dry-run', '--print']);
  assert.equal(result.status, 0, result.text);
  assert.match(result.out, /^stop\tStopped, nothing is deleted: 5 of 11 tip or news items/m);
  assert.match(result.out, /^note\tKept "Odd one" \(Tip or news\): the date in expires cannot be read\./m);
});

check('the 40 percent stop deletes nothing at all, not even the other types, and the status says why', () => {
  const docs = oneOfEach();
  for (let index = 0; index < 3; index += 1) docs.push(doc('sponsor', 'old-sp' + index, { name: 'Gone', expires: ago(30) }));
  const place = makePlace(on(), docs);
  const result = run(place);
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(result.mutations, []);
  assert.equal(backupFile(place), null, 'no backup is made for a run that deletes nothing');
  assert.match(statusOf(place).error, /Stopped, nothing is deleted: 4 of 9 sponsor items/);
  assert.match(result.text, /more than 40 percent/);
  assert.match(listFile(place), /Stopped, nothing is deleted/);
});

check('100 deletions a run: the rest wait for the next run, which takes them', () => {
  const docs = [];
  for (let index = 0; index < 105; index += 1) docs.push(doc('tipOrNews', 'old-' + String(index).padStart(3, '0'), { text: 'Tip', expires: ago(20 + index) }));
  for (let index = 0; index < 200; index += 1) docs.push(doc('tipOrNews', 'new-' + index, { text: 'Tip' }));
  const place = makePlace(on(), docs);
  let result = run(place);
  assert.equal(result.status, 0, result.text);
  assert.equal(result.mutations.length, 100);
  assert.equal(liveDocs(place).filter(item => item._id.startsWith('old-')).length, 5);
  result = run(place, [], now / 1000 + 60);
  assert.equal(result.mutations.length, 5);
  assert.equal(liveDocs(place).filter(item => item._id.startsWith('old-')).length, 0);
});

check('a document edited while the run was going is kept, and the rest are deleted', () => {
  const place = makePlace(on(), oneOfEach(), { });
  fs.writeFileSync(path.join(place.stub, 'fresh.json'), JSON.stringify({ 'old-sponsor': { _updatedAt: '2026-10-21T03:39:00.000Z' } }));
  const result = run(place);
  assert.equal(result.status, 0, result.text);
  assert.ok(!result.deletedIds.includes('old-sponsor'));
  assert.ok(!result.deletedIds.includes('drafts.old-sponsor'));
  assert.equal(result.mutations.length, 9);
  assert.match(listFile(place), /Deleted 9 of 10 documents\. 1 were edited while the run was going and were kept\./);
});

check('a backup that cannot be fetched stops the run before any delete, and says so', () => {
  const place = makePlace(on(), oneOfEach(), { freshStatus: 500 });
  const result = run(place);
  assert.equal(result.status, 1, result.text);
  assert.deepEqual(result.mutations, []);
  assert.match(result.err, /The backup could not be made, so nothing was deleted/);
  assert.match(statusOf(place).error, /backup could not be made/);
  assert.equal(statusOf(place).deleted, 0);
  assert.equal(backupFile(place), null);
});

check('a backup file that cannot be written stops the run before any delete', () => {
  const place = makePlace(on(), oneOfEach());
  const stamp = new Date(now).toISOString().replace(/[:-]/g, '').replace(/\.\d+Z$/, 'Z');
  fs.mkdirSync(path.join(place.folder, 'backup-' + stamp + '.json.partial'), { recursive: true });
  const result = run(place);
  assert.equal(result.status, 1, result.text);
  assert.deepEqual(result.mutations, []);
  assert.match(result.err, /The backup file could not be written, so nothing was deleted/);
});

check('a backup with no documents in it does not count as a backup', () => {
  const place = makePlace(on(), oneOfEach(), { freshEmpty: true });
  const result = run(place);
  assert.equal(result.status, 1, result.text);
  assert.deepEqual(result.mutations, []);
  assert.equal(backupFile(place), null);
  assert.match(result.err, /The backup could not be made/);
});

check('one document that Sanity refuses does not hold back the others, and the problem is reported', () => {
  const place = makePlace(on(), oneOfEach(), { refuse: ['old-photo'] });
  const result = run(place);
  assert.equal(result.status, 1, result.text);
  assert.equal(result.mutations.length, 10);
  assert.match(listFile(place), /Not deleted: Photo \| Old photo/);
  assert.match(listFile(place), /Deleted 9 of 10 documents\. 1 could not be deleted/);
  assert.equal(statusOf(place).deleted, 9);
  assert.match(statusOf(place).error, /Sanity did not answer as expected \(status 409\)/);
  assert.ok(liveDocs(place).some(item => item._id === 'old-photo'));
});

check('a token that is turned away ends the run at the first delete', () => {
  const place = makePlace(on(), oneOfEach(), { refuse: ['old-'], refuseStatus: 403 });
  const result = run(place);
  assert.equal(result.status, 1);
  assert.equal(result.mutations.length, 1);
  assert.match(statusOf(place).error, /token cannot do that \(status 403\)/);
});

check('--delete-now needs Mode: delete, and then ignores the switch', () => {
  const list = makePlace({ cleanupEnabled: true, cleanupDeleteAfterDays: 14, cleanupMode: 'list' }, oneOfEach());
  let result = run(list, ['--delete-now', '--print']);
  assert.equal(result.status, 0);
  assert.match(result.out, /^error\tMode is List only, so nothing was deleted/m);
  assert.deepEqual(result.mutations, []);
  const off = makePlace({ cleanupEnabled: false, cleanupDeleteAfterDays: 14, cleanupMode: 'delete' }, oneOfEach());
  result = run(off, ['--delete-now', '--print']);
  assert.equal(result.status, 0, result.text);
  assert.equal(result.mutations.length, 10);
  assert.match(result.out, /^result\tDeleted 10 of 10 documents\. Backup: backup-/m);
  assert.equal(result.out.split('\n').filter(line => line.startsWith('item\t')).length, 10);
  assert.ok(result.calls.includes('status-write cleanup'));
});

check('--delete-now still keeps every rule: recent edits, no dates and the limits', () => {
  const docs = oneOfEach().concat([doc('tipOrNews', 'fresh', { text: 'Fresh', expires: ago(30) }, ago(1)), doc('tipOrNews', 'nodate', { text: 'No date' })]);
  const place = makePlace({ cleanupEnabled: false, cleanupDeleteAfterDays: 14, cleanupMode: 'delete' }, docs);
  const result = run(place, ['--delete-now', '--print']);
  assert.ok(!result.deletedIds.includes('fresh') && !result.deletedIds.includes('nodate'));
  assert.equal(result.deletedIds.length, 20);
});

check('--restore puts the documents of a backup back, leaves existing ones alone, and skips types it may not touch', () => {
  const place = makePlace(on(), oneOfEach());
  run(place);
  const backup = backupFile(place);
  const before = liveDocs(place).length;
  const bigger = JSON.parse(fs.readFileSync(backup, 'utf8'));
  bigger.documents.push({ _id: 'team-x', _type: 'team', name: 'Not restored' });
  fs.writeFileSync(backup, JSON.stringify(bigger));
  // One of the deleted documents is back already: it must not be replaced
  const live = liveDocs(place);
  live.push(Object.assign({}, bigger.documents.find(item => item._id === 'old-sponsor'), { name: 'Typed again' }));
  put(place, on(), live);
  fs.writeFileSync(path.join(place.stub, 'calls.log'), '');
  const result = run(place, ['--restore', backup]);
  assert.equal(result.status, 0, result.text);
  const after = liveDocs(place);
  assert.equal(after.length, before + 1 + 19, 'the 19 other copies came back, the typed one stayed');
  assert.equal(after.find(item => item._id === 'old-sponsor').name, 'Typed again');
  assert.ok(!after.some(item => item._id === 'team-x'));
  assert.ok(after.some(item => item._id === 'drafts.old-photo'));
  result.mutations.flat().forEach(item => {
    assert.ok(item.createIfNotExists, 'only createIfNotExists is used');
    ['_rev', '_createdAt', '_updatedAt'].forEach(name => assert.ok(!(name in item.createIfNotExists), name));
  });
  assert.match(result.out, /put back 20 documents/);
});

check('--restore refuses a file that is not a backup of the clean up', () => {
  const place = makePlace(on(), []);
  const bogus = path.join(place.root, 'bogus.json');
  fs.writeFileSync(bogus, '{"hello": 1}');
  let result = run(place, ['--restore', bogus]);
  assert.equal(result.status, 1);
  assert.match(result.err, /not a backup file made by the clean up/);
  result = run(place, ['--restore', path.join(place.root, 'missing.json')]);
  assert.equal(result.status, 1);
  assert.deepEqual(result.mutations, []);
});

check('the token is never printed, written to a file or put on a command line', () => {
  const place = makePlace(on(), oneOfEach());
  const result = run(place);
  assert.ok(!result.text.includes(token));
  const files = fs.readdirSync(place.folder).map(name => path.join(place.folder, name)).filter(file => fs.statSync(file).isFile());
  files.forEach(file => assert.ok(!fs.readFileSync(file, 'utf8').includes(token), file));
  assert.ok(!fs.readFileSync(path.join(place.stub, 'calls.log'), 'utf8').includes(token));
  assert.ok(result.calls.filter(line => line.startsWith('config-has-key')).every(line => line === 'config-has-key true'), 'every request got the key on standard input');
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/expired-cleanup.sh'), 'utf8');
  assert.ok(!/echo[^\n]*\$token|printf[^\n]*\$token[^\n]*>>/.test(text));
});

check('without a token the timer is quiet and a person who asked is told', () => {
  const place = makePlace(on(), oneOfEach(), { });
  fs.writeFileSync(path.join(place.root, 'computer/local.env'), "TELETRAAN_DATA='" + place.data + "'\n");
  let result = run(place);
  assert.equal(result.status, 0);
  assert.match(result.text, /SANITY_WRITE_TOKEN is not in local\.env/);
  result = run(place, ['--dry-run', '--print']);
  assert.match(result.out, /^error\tSANITY_WRITE_TOKEN is not set/m);
  assert.deepEqual(result.mutations, []);
});

check('when Sanity cannot be reached nothing is deleted and the status says so', () => {
  const place = makePlace(on(), oneOfEach(), { docsStatus: 500 });
  let result = run(place);
  assert.equal(result.status, 1);
  assert.match(result.err, /The documents could not be read, so nothing was deleted/);
  assert.deepEqual(result.mutations, []);
  const down = makePlace(on(), oneOfEach(), { curlExit: 7 });
  result = run(down);
  assert.equal(result.status, 1);
  assert.match(result.err, /The setting could not be read/);
  assert.match(result.err, /could not connect/);
});

check('lists and backups older than 30 days are removed and newer ones are kept', () => {
  const place = makePlace(on(14, 'list'), oneOfEach());
  fs.mkdirSync(place.folder, { recursive: true });
  const old = ['list-20260801T034000Z.txt', 'backup-20260801T034000Z.json'];
  const fresh = ['list-20261015T034000Z.txt', 'backup-20261015T034000Z.json'];
  old.concat(fresh).forEach(name => fs.writeFileSync(path.join(place.folder, name), 'x'));
  old.forEach(name => fs.utimesSync(path.join(place.folder, name), new Date(now - 40 * dayMs), new Date(now - 40 * dayMs)));
  fresh.forEach(name => fs.utimesSync(path.join(place.folder, name), new Date(), new Date()));
  const result = run(place);
  old.forEach(name => assert.ok(!result.files.includes(name), name));
  fresh.forEach(name => assert.ok(result.files.includes(name), name));
});

check('a title with odd signs cannot break the status or the page lines', () => {
  const docs = withCompany('tipOrNews', [doc('tipOrNews', 'old-1', { text: 'Say "hi" \\ and \u0001 more', expires: ago(30) })]);
  const place = makePlace(on(), docs);
  const result = run(place, ['--delete-now', '--print']);
  assert.equal(result.status, 0, result.text);
  JSON.parse(fs.readFileSync(path.join(place.folder, 'status.json'), 'utf8'));
  assert.match(result.out, /^item\tTip or news\tSay "hi" \\ and more\t/m);
});

// ----- status-write.sh cleanup -----

function statusWriteRun(fileText, extraEnv = {}) {
  counter += 1;
  const root = path.join(work, 'sw' + counter);
  const bin = path.join(root, 'bin');
  const data = path.join(root, 'data');
  fs.mkdirSync(path.join(root, 'computer/scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dashboard'), { recursive: true });
  fs.mkdirSync(path.join(data, 'cleanup'), { recursive: true });
  fs.mkdirSync(bin);
  ['status-write.sh', 'lib.sh'].forEach(name => fs.copyFileSync(path.join(repo, 'computer/scripts', name), path.join(root, 'computer/scripts', name)));
  fs.writeFileSync(path.join(root, 'dashboard/config.js'), "export const sanity = {\n  projectId: 'abc123',\n  dataset: 'production',\n  apiVersion: '2024-01-01',\n};\n");
  fs.writeFileSync(path.join(root, 'computer/local.env'), "TELETRAAN_DATA='" + data + "'\nSANITY_WRITE_TOKEN='" + token + "'\n");
  if (fileText !== null) fs.writeFileSync(path.join(data, 'cleanup/status.json'), fileText);
  ['sed', 'head', 'tail', 'grep', 'date', 'dirname', 'cat', 'cut', 'tr', 'wc', 'awk', 'git'].forEach(tool => {
    const found = spawnSync('/bin/sh', ['-c', 'command -v ' + tool], { encoding: 'utf8' }).stdout.trim();
    if (found) fs.symlinkSync(found, path.join(bin, tool));
  });
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nwhile [ $# -gt 0 ]; do if [ "$1" = --data ]; then printf "%s" "$2" > "$STUB_DIR/body.json"; fi; shift; done\ncat > /dev/null\n', { mode: 0o755 });
  const stub = path.join(root, 'stub');
  fs.mkdirSync(stub);
  const result = spawnSync('/bin/bash', [path.join(root, 'computer/scripts/status-write.sh'), 'cleanup'], { env: Object.assign({ PATH: bin, STUB_DIR: stub }, extraEnv), encoding: 'utf8' });
  const bodyFile = path.join(stub, 'body.json');
  return { status: result.status, text: result.stdout + result.stderr, body: fs.existsSync(bodyFile) ? JSON.parse(fs.readFileSync(bodyFile, 'utf8')) : null };
}

check('status-write.sh cleanup sets the four fields, and removes an old problem when there is none', () => {
  let result = statusWriteRun('{"at":"2026-10-21T03:40:00Z","wouldDelete":4,"deleted":3,"error":"One could not be deleted (status 409)."}');
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(result.body.mutations[1].patch.set, { lastCleanupAt: '2026-10-21T03:40:00Z', cleanupWouldDelete: 4, cleanupDeleted: 3, cleanupError: 'One could not be deleted (status 409).' });
  assert.equal(result.body.mutations[0].createIfNotExists._id, 'status-mini');
  result = statusWriteRun('{"at":"2026-10-21T03:40:00Z","wouldDelete":0,"deleted":0,"error":""}');
  assert.equal(result.status, 0, result.text);
  assert.deepEqual(result.body.mutations[1].patch.unset, ['cleanupError']);
  assert.ok(!('cleanupError' in result.body.mutations[1].patch.set));
});

check('status-write.sh cleanup sends nothing without a file, and refuses a file that is not the line the job writes', () => {
  assert.equal(statusWriteRun(null).body, null);
  const bad = statusWriteRun('{"at":"yesterday","wouldDelete":1,"deleted":0,"error":""}');
  assert.equal(bad.status, 1);
  assert.equal(bad.body, null);
  const injected = statusWriteRun('{"at":"2026-10-21T03:40:00Z","wouldDelete":1,"deleted":0,"error":"x\\" ,\\"evil\\":1"}');
  assert.equal(injected.body, null);
});

// ----- the units and the installer -----

check('the service and the timer: 03:40 every night, as the login user, with no root and no sudo', () => {
  const service = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-cleanup.service'), 'utf8');
  const timer = fs.readFileSync(path.join(repo, 'computer/systemd/teletraan-cleanup.timer'), 'utf8');
  assert.match(service, /^User=ACCOUNT$/m);
  assert.match(service, /^NoNewPrivileges=yes$/m);
  assert.match(service, /^ExecStart=\/opt\/teletraan\/computer\/scripts\/expired-cleanup\.sh$/m);
  assert.match(service, /^Type=oneshot$/m);
  assert.match(timer, /^OnCalendar=\*-\*-\* 03:40:00$/m);
  assert.match(timer, /^Persistent=true$/m);
  assert.match(timer, /WantedBy=timers\.target/);
  const script = fs.readFileSync(path.join(repo, 'computer/scripts/expired-cleanup.sh'), 'utf8');
  assert.ok(!/\bsudo\b/.test(script.replace(/#.*$/gm, '')), 'the script never asks for sudo');
  const sudoers = fs.readFileSync(path.join(repo, 'computer/sudoers/teletraan-control'), 'utf8');
  assert.ok(!/cleanup/.test(sudoers), 'the sudoers file is unchanged');
});

check('install-cleanup.sh copies the units as the account, turns the timer on and installs no package', () => {
  const text = fs.readFileSync(path.join(repo, 'computer/scripts/install-cleanup.sh'), 'utf8');
  assert.ok(text.includes('s/^User=ACCOUNT\\$/User=$account/'));
  assert.ok(text.includes('"$account" = root'));
  assert.match(text, /teletraan-cleanup\.service/);
  assert.match(text, /systemctl enable --now teletraan-cleanup\.timer/);
  assert.match(text, /sudo apt install curl jq nodejs/);
  assert.ok(!/^\s*(apt|apt-get)\s+install/m.test(text), 'it prints the apt line and never runs it');
  assert.match(text, /Nothing is deleted until/);
  const refused = spawnSync('/bin/bash', [path.join(repo, 'computer/scripts/install-cleanup.sh')], { encoding: 'utf8', input: '\n' });
  assert.notEqual(refused.status, 0, 'it does not run without root');
  assert.doesNotMatch(refused.stdout + refused.stderr, new RegExp(token));
  const check = spawnSync('/bin/bash', ['-n', path.join(repo, 'computer/scripts/install-cleanup.sh')]);
  assert.equal(check.status, 0);
});

check('the helper knows the two cleanup words, with no argument', () => {
  const helper = fs.readFileSync(path.join(repo, 'computer/scripts/control-helper.sh'), 'utf8');
  assert.match(helper, /\n  cleanup-preview\|cleanup-delete\)\n    \[ -z "\$argument" \] \|\| refuse/);
  assert.match(helper, /expired-cleanup\.sh" --dry-run --print/);
  assert.match(helper, /expired-cleanup\.sh" --delete-now --print/);
});

console.log('expired-cleanup.test.mjs: ' + passed + ' checks passed');
