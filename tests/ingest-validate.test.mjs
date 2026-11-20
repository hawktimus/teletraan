// computer/scripts/ingest-validate.mjs: an empty or malformed answer never becomes content.json, a date with no zone is
// repaired in the zone of the Look page, nothing is dropped without a line in the list, and the sync service writes
// data-problems.json and keeps the last good content. docs/audit.md, Part B.
//
//   node tests/ingest-validate.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { checkContent, isoInZone, problemsFile } from '../computer/scripts/ingest-validate.mjs';
import { createSync } from '../computer/scripts/sync-service.mjs';

const rich = { settings: { pageSeconds: 20 }, theme: { timeZone: 'America/New_York' }, tasks: [1, 2, 3].map(n => ({ _id: 't' + n, title: 'T' + n, source: 'manual' })), people: [{ name: 'Sam' }, { name: 'Lee' }], sponsors: [], tipsAndNews: [] };

test('a zone-less time is read in the zone of the Look page, in winter and in summer', () => {
  assert.equal(isoInZone('2026-11-17T18:00', 'America/New_York'), '2026-11-17T23:00:00.000Z');
  assert.equal(isoInZone('2026-07-17 12:00', 'America/New_York'), '2026-07-17T16:00:00.000Z');
  assert.equal(isoInZone('2026-07-17T12:00', 'America/Los_Angeles'), '2026-07-17T19:00:00.000Z');
  assert.equal(isoInZone('not a time', 'America/New_York'), null);
});

test('a talk, an announcement and a task with a time of no zone are repaired and listed, and a good one is left alone', () => {
  const answer = Object.assign({}, rich, {
    presentations: [{ id: 'p1', name: 'Sam', start: '2026-11-17T18:00' }, { id: 'p2', name: 'Lee', start: '2026-11-17T23:00:00.000Z' }],
    notices: [{ _id: 'n1', text: 'Bring the form', start: '2026-11-17T09:00', end: 'tomorrow' }],
  });
  const checked = checkContent(answer, null);
  assert.equal(checked.ok, true);
  assert.equal(checked.result.presentations[0].start, '2026-11-17T23:00:00.000Z');
  assert.equal(checked.result.presentations[1].start, '2026-11-17T23:00:00.000Z', 'a time with a zone is not touched');
  assert.equal(checked.result.notices[0].start, '2026-11-17T14:00:00.000Z');
  assert.equal(checked.result.notices[0].end, 'tomorrow', 'what cannot be repaired is left as it is');
  assert.equal(answer.presentations[0].start, '2026-11-17T18:00', 'the answer that was passed in is not changed');
  assert.equal(checked.problems.length, 3);
  assert.deepEqual(checked.problems.map(problem => problem.action.split(' ')[0]), ['repaired', 'repaired', 'left']);
});

test('an answer that is empty, not an object, or has a list that is not a list is refused with the reason', () => {
  assert.equal(checkContent(null, rich).ok, false);
  assert.equal(checkContent([], rich).ok, false);
  const wrong = checkContent(Object.assign({}, rich, { tasks: 'none' }), rich);
  assert.equal(wrong.ok, false);
  assert.match(wrong.reason, /tasks as something other than a list/);
  const bare = checkContent({ settings: null, tasks: [], people: [], sponsors: [], tipsAndNews: [], plans: [] }, rich);
  assert.equal(bare.ok, false);
  assert.match(bare.reason, /no settings document/);
  const hollow = checkContent({ settings: { a: 1 }, tasks: [], people: [], sponsors: [], tipsAndNews: [] }, rich);
  assert.equal(hollow.ok, false);
  assert.match(hollow.reason, /empty answer/);
});

test('a first read with an empty dataset is accepted, so a new computer is not stuck', () => {
  assert.equal(checkContent({ settings: null, tasks: [], people: [] }, null).ok, true);
});

test('a Monday task with a department that is not one of the nine is listed under monday, and a hidden one is not', () => {
  const answer = Object.assign({}, rich, { tasks: [
    { _id: 'a', title: 'Fits', source: 'monday', department: 'build' },
    { _id: 'b', title: 'Design/CNC', source: 'monday', department: 'Design/CNC' },
    { _id: 'c', title: 'Hidden', source: 'monday', department: 'Design/CNC', showOnBoard: false },
  ] });
  const found = checkContent(answer, null).problems;
  assert.equal(found.length, 1);
  assert.equal(found[0].source, 'monday');
  assert.match(found[0].where, /Design\/CNC/);
});

test('the file has the whole count, the first rows of each source, and no more than 200 of them', () => {
  const many = Array.from({ length: 250 }, (item, index) => ({ source: 'sanity', where: 'row ' + index, what: 'x', action: 'y' }));
  const file = problemsFile(many.concat([{ source: 'monday', where: 'z', what: 'x', action: 'y' }]), '2026-11-17T12:00:00Z');
  assert.equal(file.count, 251);
  assert.equal(file.sources.sanity.count, 250);
  assert.equal(file.sources.sanity.items.length, 200);
  assert.equal(file.sources.monday.items.length, 1);
});

test('the sync service writes data-problems.json, and an empty answer after a good one leaves content.json as it was and counts as a failure', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-ingest-'));
  let answer = Object.assign({}, rich, { presentations: [{ id: 'p1', name: 'Sam', start: '2026-11-17T18:00' }] });
  let count = 0;
  const fetchFake = async url => {
    const address = String(url);
    const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    if (address.includes(encodeURIComponent('count(*)'))) return json({ result: { count: ++count, latest: 'x' + count } });
    return json({ result: answer });
  };
  const sync = createSync({ dataDir: folder, sanityBase: 'http://sanity.test', weatherUrl: 'http://weather.test/', now: () => 1_800_000_000_000 + count * 400_000, fetch: fetchFake, noProbe: true, token: '' });
  assert.equal(await sync.checkSanity(), true);
  const problems = JSON.parse(fs.readFileSync(path.join(folder, 'data-problems.json'), 'utf8'));
  assert.equal(problems.count, 1);
  assert.match(problems.sources.sanity.items[0].action, /repaired/);
  const before = fs.readFileSync(path.join(folder, 'content.json'), 'utf8');
  assert.match(before, /2026-11-17T23:00:00.000Z/, 'the repaired time is what is written');

  answer = { settings: null, tasks: [], people: [], sponsors: [], tipsAndNews: [] };
  await sync.checkSanity();
  assert.equal(fs.readFileSync(path.join(folder, 'content.json'), 'utf8'), before, 'the wall keeps what it has');
  assert.match(sync.state.sanity.lastFailureReason, /no settings document/);
  fs.rmSync(folder, { recursive: true, force: true });
});

finish();
