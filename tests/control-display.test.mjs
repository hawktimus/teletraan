// Tests for the Display tab of the control page: what it reads and writes in Dashboard Settings (control/support/display.js,
// control/routes/display.js), what the wall would do with each row (control/support/display-wall.js), and the plain row
// functions it shares with the page (control/static/display-rows.js), which must do what the Studio board does.
// A fake Sanity and a temporary data folder; nothing leaves the process.
//
//   node tests/control-display.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as display from '../control/routes/display.js';
import * as logic from '../control/support/display.js';
import { checkRow, checkRows, extrasOf, readMatch13 } from '../control/support/display-wall.js';
import * as rows from '../control/static/display-rows.js';
import * as studio from '../studio/tools/rotation-board.js';
import { defaultRotationRows } from '../dashboard/config-rotation.js';
import { normalizeSample } from '../dashboard/core/sanity.js';
import { makeWorld, repo } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const sample = JSON.parse(fs.readFileSync(path.join(repo, 'dashboard/data/sample/content.json'), 'utf8'));
const sampleMatch13 = fs.readFileSync(path.join(repo, 'dashboard/data/sample/match13.json'), 'utf8');
const settingsKey = 'rotationRows, themeByWeekday';

const published = { _id: 'dashboardSettings', _type: 'dashboardSettings', _rev: 'rev-pub', _updatedAt: '2026-10-18T10:00:00Z', pageSeconds: 25, rotationRows: [{ _key: 'a1', view: 'robotics', panel: 'photo', photoCount: 4, secondsPerPhoto: 10, seconds: 40, shown: true }] };
const draft = Object.assign({}, published, { _id: 'drafts.dashboardSettings', _rev: 'rev-draft', _updatedAt: '2026-10-18T11:00:00Z', rotationRows: published.rotationRows.concat([{ _key: 'b2', view: 'prime', panel: 'team-leads', part: 1, shown: false, extraField: 'kept' }]) });

// A world whose wall content is the sample, so the wall check does not ask Sanity for the whole content
async function worldWith(docs, options = {}) {
  const world = await makeWorld([display], { answers: { [settingsKey]: { result: docs } }, ...options });
  world.ctx.state = { displayWorld: { at: Date.now(), world: { content: normalizeSample(sample), now: new Date(), match13: null, problem: '' } } };
  return world;
}

const mutationsOf = world => world.fetched.filter(call => call.url.includes('/data/mutate/')).map(call => JSON.parse(call.init.body).mutations);

// ----- the rows, shared with the page -----

await check('the row functions do what the Studio board does, on the same rows', () => {
  const start = studio.standardRows();
  const same = (mine, theirs) => assert.deepEqual(mine.map(row => Object.assign({}, row, { _key: 'k' })), theirs.map(row => Object.assign({}, row, { _key: 'k' })));

  assert.deepEqual(rows.moveRow(start, 3, 1), studio.moveRow(start, 3, 1));
  assert.deepEqual(rows.moveRow(start, 0, -1), studio.moveRow(start, 0, -1));
  assert.deepEqual(rows.moveRow(start, start.length - 1, 1), studio.moveRow(start, start.length - 1, 1));
  assert.deepEqual(rows.removeRow(start, 2), studio.removeRow(start, 2));
  assert.deepEqual(rows.setRowValue(start, 1, 'seconds', 33), studio.setRowValue(start, 1, 'seconds', 33));
  assert.deepEqual(rows.setRowValue(start, 1, 'seconds', ''), studio.setRowValue(start, 1, 'seconds', ''));
  assert.deepEqual(rows.setRowValue(start, 1, 'shown', false), studio.setRowValue(start, 1, 'shown', false));
  const photo = start.findIndex(row => row.panel === 'photo');
  assert.deepEqual(rows.setPhotoValue(start, photo, 'photoCount', 6), studio.setPhotoValue(start, photo, 'photoCount', 6));
  same(rows.copyRow(start, 4), studio.copyRow(start, 4));
  same(rows.addRow(start, 'nova', 'photo'), studio.addRow(start, 'nova', 'photo'));
  same(rows.addRow(start, 'prime', 'events'), studio.addRow(start, 'prime', 'events'));

  assert.deepEqual(rows.blocksOf(start, 25), studio.blocksOf(start, 25));
  assert.equal(rows.loopSeconds(start, 25), studio.loopSeconds(start, 25));
  assert.equal(rows.durationWords(580), studio.durationWords(580));
  [['12', ''], ['', ''], ['5', ''], ['121', ''], ['abc', ''], [' 60 ', '']].forEach(([text]) => assert.equal(rows.secondsFrom(text), studio.secondsFrom(text), text));
  assert.equal(rows.wholeFrom('7', rows.photoRange.each), studio.wholeFrom('7', studio.photoRange.each));
  assert.equal(rows.wholeFrom('61', rows.photoRange.each), studio.wholeFrom('61', studio.photoRange.each));
  start.forEach(row => assert.equal(rows.secondsOf(row, 25), studio.secondsOf(row, 25)));
  assert.deepEqual(rows.secondsRange, studio.secondsRange);
  assert.deepEqual(rows.photoRange, studio.photoRange);
  assert.deepEqual(rows.startingPhotos, studio.startingPhotos);
  assert.equal(rows.defaultPageSeconds, studio.defaultPageSeconds);
});

await check('a change leaves the rows it was given as they were and keeps a field the tab does not show', () => {
  const start = rows.withKeys([{ view: 'prime', panel: 'roster', department: 'build', part: 2, side: 'forecast', shown: true, unknown: 'x' }]);
  const before = JSON.stringify(start);
  const moved = rows.setRowValue(start, 0, 'seconds', 40);
  assert.equal(JSON.stringify(start), before);
  assert.equal(moved[0].unknown, 'x');
  assert.equal(moved[0].department, 'build');
  assert.ok(start[0]._key.length >= 10);
  const keys = rows.withKeys([{ _key: 'same' }, { _key: 'same' }, {}]).map(row => row._key);
  assert.equal(new Set(keys).size, 3, 'a repeated or missing key is replaced');
});

// ----- checking what the page sent -----

await check('rows are checked with the row number, and an out of range value is refused and not corrected', () => {
  const bad = (row, words) => assert.throws(() => logic.cleanRows([{ view: 'robotics', panel: 'tasks' }, row], []), error => error.status === 400 && error.message.startsWith('Row 2: ') && words.test(error.message), JSON.stringify(row));
  bad({ view: 'general2', panel: 'tasks' }, /Robotics, Prime or Nova/);
  bad({ view: 'prime', panel: 'nothing' }, /panel the wall can play/);
  bad({ view: 'prime', panel: 'tasks', seconds: 5 }, /6 to 120/);
  bad({ view: 'prime', panel: 'tasks', seconds: 121 }, /6 to 120/);
  bad({ view: 'prime', panel: 'tasks', seconds: 12.5 }, /whole number/);
  bad({ view: 'prime', panel: 'tasks', shown: 'yes' }, /on or off/);
  bad({ view: 'prime', panel: 'photo', photoCount: 21 }, /from 1 to 20/);
  bad({ view: 'prime', panel: 'photo', secondsPerPhoto: 4 }, /from 5 to 60/);
  bad({ view: 'prime', panel: 'events', part: 3 }, /1 or 2/);
  bad({ view: 'prime', panel: 'tasks', side: 'tasks' }, /small panel/);
  bad('text', /not a row/);
  assert.throws(() => logic.cleanRows('no', []), error => error.status === 400);
  assert.throws(() => logic.cleanRows(new Array(301).fill({ view: 'prime', panel: 'tasks' }), []), error => error.status === 400 && /300/.test(error.message));
});

await check('a good list is stored with the Studio field names, a photo row keeps photos times seconds, and a field the tab does not show stays', () => {
  const stored = [{ _key: 'b2', view: 'prime', panel: 'team-leads', part: 1, extraField: 'kept' }];
  const out = logic.cleanRows([
    { _key: 'b2', view: 'general', panel: 'team-leads', part: 1, shown: false, seconds: 30 },
    { view: 'nova', panel: 'photo', photoCount: 3, secondsPerPhoto: 12, seconds: 999 },
    { _key: 'b2', view: 'robotics', panel: 'events', department: ' build ', side: 'forecast' },
  ], stored);
  assert.deepEqual(Object.keys(out[0]).sort(), ['_key', 'extraField', 'part', 'panel', 'seconds', 'shown', 'view'].sort());
  assert.equal(out[0].view, 'robotics', 'the old name general is stored as robotics');
  assert.equal(out[0].extraField, 'kept');
  assert.equal(out[0].shown, false);
  assert.deepEqual([out[1].photoCount, out[1].secondsPerPhoto, out[1].seconds], [3, 12, 36]);
  assert.ok(/^[0-9a-f]{12}$/.test(out[1]._key));
  assert.notEqual(out[2]._key, 'b2', 'a repeated key is replaced');
  assert.equal(out[2].department, 'build');
  assert.equal(out[2].extraField, undefined, 'a stored field is kept only for the row with that key, once');
  assert.deepEqual(logic.cleanRows([], stored), []);
});

await check('the theme and view settings are checked and only the fields that were sent are written', () => {
  const week = { monday: 'retro', tuesday: 'cybertron', wednesday: 'original', thursday: 'foundry', friday: 'original', saturday: 'cybertron', sunday: 'original' };
  assert.deepEqual(logic.cleanTheme({ themeByWeekday: week, generalViewTitle: '  HAWKTIMUS   ROBOTICS ', transitionSeconds: 3 }), { themeByWeekday: week, generalViewTitle: 'HAWKTIMUS ROBOTICS', transitionSeconds: 3 });
  assert.deepEqual(logic.cleanTheme({ transitionSeconds: 2.5 }), { transitionSeconds: 2.5 });
  assert.deepEqual(logic.cleanTheme(undefined), {});
  assert.throws(() => logic.cleanTheme({ themeByWeekday: Object.assign({}, week, { friday: 'neon' }) }), error => error.status === 400 && /Friday/.test(error.message));
  assert.throws(() => logic.cleanTheme({ themeByWeekday: { monday: 'original' } }), error => error.status === 400);
  assert.throws(() => logic.cleanTheme({ generalViewTitle: 'x'.repeat(29) }), error => error.status === 400);
  assert.throws(() => logic.cleanTheme({ generalViewTitle: ' ' }), error => error.status === 400);
  assert.throws(() => logic.cleanTheme({ transitionSeconds: 5 }), error => error.status === 400);
  assert.throws(() => logic.cleanTheme({ transitionSeconds: '3' }), error => error.status === 400);
});

await check('saving writes the draft only, and makes the draft from the published document when there is none', () => {
  const fields = { rotationRows: [] };
  const withDraft = logic.saveMutations(fields, logic.pickSettings([published, draft]));
  assert.deepEqual(withDraft, [{ patch: { id: 'drafts.dashboardSettings', ifRevisionID: 'rev-draft', set: fields } }]);

  const without = logic.saveMutations(fields, logic.pickSettings([published]));
  assert.equal(without.length, 2);
  assert.equal(without[0].createIfNotExists._id, 'drafts.dashboardSettings');
  ['_rev', '_createdAt', '_updatedAt'].forEach(name => assert.equal(without[0].createIfNotExists[name], undefined, name));
  assert.equal(without[0].createIfNotExists.pageSeconds, 25, 'the other fields are kept');
  assert.deepEqual(without[1], { patch: { id: 'drafts.dashboardSettings', set: fields } });
  assert.ok(!JSON.stringify(withDraft).includes('"id":"dashboardSettings"'), 'the published document is never patched');

  assert.throws(() => logic.saveMutations(fields, logic.pickSettings([])), error => error.status === 409 && /Publish once/.test(error.message));
});

await check('publishing replaces the published document with the draft and deletes the draft', () => {
  const made = logic.publishMutations(logic.pickSettings([published, draft]));
  assert.equal(made[0].createOrReplace._id, 'dashboardSettings');
  assert.equal(made[0].createOrReplace.rotationRows.length, 2);
  ['_rev', '_updatedAt'].forEach(name => assert.equal(made[0].createOrReplace[name], undefined, name));
  assert.deepEqual(made[1], { delete: { id: 'drafts.dashboardSettings' } });
  assert.throws(() => logic.publishMutations(logic.pickSettings([published])), error => error.status === 409);
});

await check('the draft is shown when there is one, and the page is told when the Studio copy is the newer one', () => {
  const both = logic.pickSettings([published, draft]);
  assert.equal(both.rev, 'rev-draft');
  assert.equal(both.isDraft, true);
  assert.equal(both.studioNewer, true);
  const only = logic.pickSettings([published]);
  assert.deepEqual([only.rev, only.isDraft, only.studioNewer], ['rev-pub', false, false]);
  const same = logic.pickSettings([published, Object.assign({}, draft, { _updatedAt: published._updatedAt })]);
  assert.equal(same.studioNewer, false);
  assert.equal(logic.pickSettings([]).source, null);
});

// ----- the routes -----

await check('GET display gives the rows with keys, the theme, the choices and a wall answer for each row', async () => {
  const world = await worldWith([published, draft]);
  const answer = await world.router.call('GET', '/display');
  assert.equal(answer.status, 200);
  assert.equal(answer.json.rev, 'rev-draft');
  assert.equal(answer.json.isDraft, true);
  assert.equal(answer.json.pageSeconds, 25);
  assert.equal(answer.json.canWrite, true);
  assert.deepEqual(answer.json.rows.map(row => row._key), ['a1', 'b2']);
  assert.equal(answer.json.rows[1].extraField, 'kept');
  assert.equal(answer.json.wall.rows.a1.state, 'show', 'the sample has photos');
  assert.equal(answer.json.wall.rows.b2.state, 'off', 'a row with Shown off is off');
  assert.match(answer.json.wall.rows.b2.reason, /Shown is off/);
  assert.deepEqual(answer.json.choices.views.map(view => view.value), ['robotics', 'prime', 'nova']);
  assert.deepEqual(answer.json.choices.themes.map(theme => theme.value), ['original', 'cybertron', 'retro', 'foundry']);
  assert.ok(answer.json.choices.panelGroups.some(group => group.panels.some(panel => panel.value === 'monday-tasks')));
  assert.equal(answer.json.theme.themeByWeekday.monday, 'original');
  assert.equal(answer.json.standardRows.length, defaultRotationRows().length);
  assert.ok(!answer.text.includes('skFAKE'), 'the write key is never in an answer');
  const read = world.fetched.find(call => call.url.includes('perspective=raw'));
  assert.equal(read.init.headers.Authorization, 'Bearer skFAKEtoken0123456789', 'drafts are read on the computer, with the key');
});

await check('without the write key the tab can read the published list and says it cannot save', async () => {
  const world = await worldWith([published], { env: "CONTROL_PIN='123456'\n" });
  const answer = await world.router.call('GET', '/display');
  assert.equal(answer.json.canWrite, false);
  assert.equal(answer.json.isDraft, false);
  assert.ok(world.fetched.every(call => !(call.init.headers && call.init.headers.Authorization)));
  const saved = await world.router.call('POST', '/display/save', { body: { rows: [], baseRev: answer.json.rev } });
  assert.equal(saved.status, 503);
  assert.match(saved.json.error, /SANITY_WRITE_TOKEN/);
});

await check('when Sanity cannot be read the tab says so in plain words', async () => {
  const world = await worldWith([published], { offline: true });
  const answer = await world.router.call('GET', '/display');
  assert.equal(answer.status, 502);
  assert.match(answer.json.error, /could not read Dashboard Settings/);
});

await check('save writes the draft with the revision it was loaded at, and the answer has the new revision', async () => {
  const world = await worldWith([published, draft]);
  const rowsNow = [{ _key: 'a1', view: 'robotics', panel: 'photo', photoCount: 5, secondsPerPhoto: 10, shown: true }];
  const answer = await world.router.call('POST', '/display/save', { body: { rows: rowsNow, baseRev: 'rev-draft' } });
  assert.equal(answer.status, 200);
  assert.equal(answer.json.ok, true);
  const sent = mutationsOf(world);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].length, 1);
  assert.equal(sent[0][0].patch.id, 'drafts.dashboardSettings');
  assert.equal(sent[0][0].patch.ifRevisionID, 'rev-draft');
  assert.deepEqual(Object.keys(sent[0][0].patch.set), ['rotationRows']);
  assert.equal(sent[0][0].patch.set.rotationRows[0].seconds, 50);
  assert.ok(!answer.text.includes('skFAKE') && !world.logged.join('\n').includes('skFAKE'));
});

await check('a theme only save does not touch the rotation rows', async () => {
  const world = await worldWith([published]);
  const week = { monday: 'retro', tuesday: 'cybertron', wednesday: 'original', thursday: 'foundry', friday: 'original', saturday: 'cybertron', sunday: 'original' };
  const answer = await world.router.call('POST', '/display/save', { body: { theme: { themeByWeekday: week }, baseRev: 'rev-pub' } });
  assert.equal(answer.status, 200);
  const sent = mutationsOf(world)[0];
  assert.equal(sent.length, 2, 'no draft yet, so one is made from the published document first');
  assert.equal(sent[0].createIfNotExists._id, 'drafts.dashboardSettings');
  assert.deepEqual(Object.keys(sent[1].patch.set), ['themeByWeekday']);
  assert.equal(sent[1].patch.id, 'drafts.dashboardSettings');
});

await check('a newer Studio edit is not overwritten until the page asks again with force', async () => {
  const world = await worldWith([published, Object.assign({}, draft, { _rev: 'rev-studio-2', _updatedAt: '2026-10-18T12:00:00Z' })]);
  const body = { rows: [{ view: 'prime', panel: 'tasks' }], baseRev: 'rev-draft' };
  const refused = await world.router.call('POST', '/display/save', { body: body });
  assert.equal(refused.status, 409);
  assert.equal(refused.json.conflict, true);
  assert.equal(refused.json.current.rev, 'rev-studio-2');
  assert.equal(refused.json.current.updatedAt, '2026-10-18T12:00:00Z');
  assert.deepEqual(mutationsOf(world), [], 'nothing was written');

  const forced = await world.router.call('POST', '/display/save', { body: Object.assign({ force: true }, body) });
  assert.equal(forced.status, 200);
  const patch = mutationsOf(world)[0][0].patch;
  assert.equal(patch.ifRevisionID, 'rev-studio-2', 'even a forced save names the revision it replaces');
});

await check('a bad save is refused before anything is written, and an empty save says so', async () => {
  const world = await worldWith([published, draft]);
  const bad = await world.router.call('POST', '/display/save', { body: { rows: [{ view: 'prime', panel: 'tasks', seconds: 500 }], baseRev: 'rev-draft' } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /^Row 1: /);
  const empty = await world.router.call('POST', '/display/save', { body: { baseRev: 'rev-draft' } });
  assert.equal(empty.status, 400);
  assert.match(empty.json.error, /nothing to save/);
  assert.deepEqual(mutationsOf(world), []);
});

await check('publish is its own call, needs the draft that was saved, and asks before publishing a draft that moved', async () => {
  const world = await worldWith([published, draft]);
  const moved = await world.router.call('POST', '/display/publish', { body: { rev: 'rev-older' } });
  assert.equal(moved.status, 409);
  assert.equal(moved.json.conflict, true);
  assert.deepEqual(mutationsOf(world), []);

  const done = await world.router.call('POST', '/display/publish', { body: { rev: 'rev-draft' } });
  assert.equal(done.status, 200);
  const sent = mutationsOf(world)[0];
  assert.equal(sent[0].createOrReplace._id, 'dashboardSettings');
  assert.deepEqual(sent[1], { delete: { id: 'drafts.dashboardSettings' } });

  const none = await worldWith([published]);
  const nothing = await none.router.call('POST', '/display/publish', { body: { rev: 'rev-pub' } });
  assert.equal(nothing.status, 409);
  assert.match(nothing.json.error, /nothing to publish/);
});

await check('saving never writes to the published document, and never sends Match13 anywhere', async () => {
  const world = await worldWith([published, draft]);
  fs.writeFileSync(path.join(world.dataDir, 'match13.json'), sampleMatch13);
  world.ctx.state.displayWorld.world.match13 = readMatch13(world.dataDir);
  const got = await world.router.call('GET', '/display');
  assert.ok(got.json.wall.extras.match13, 'the page gets the Match13 matches');
  await world.router.call('POST', '/display/save', { body: { rows: got.json.rows, baseRev: got.json.rev, theme: { transitionSeconds: 3 } } });
  await world.router.call('POST', '/display/publish', { body: { rev: 'rev-draft' } });

  const everySent = world.fetched.map(call => call.url + ' ' + (call.init.body || '')).join('\n');
  const match13 = JSON.parse(sampleMatch13);
  assert.ok(!everySent.includes('winProb') && !everySent.includes(match13.generatedAt), 'nothing of match13.json reaches Sanity');
  const toPublished = mutationsOf(world).flat().filter(item => item.patch && item.patch.id === 'dashboardSettings');
  assert.deepEqual(toPublished, [], 'no patch goes to the published id');
});

// ----- what the wall would do -----

await check('the wall check asks the same functions the wall asks, row by row', async () => {
  const world = { content: normalizeSample(sample), now: new Date(), match13: null, problem: '' };
  const photo = await checkRow({ view: 'robotics', panel: 'photo', shown: true }, world);
  assert.equal(photo.state, 'show');
  assert.deepEqual(photo.items, ['3 photos visible']);

  const off = await checkRow({ view: 'robotics', panel: 'photo', shown: false }, world);
  assert.deepEqual([off.state, off.items], ['off', []]);

  const monday = await checkRow({ view: 'prime', panel: 'monday-tasks', department: 'build', shown: true }, world);
  assert.equal(monday.state, 'skip');
  assert.equal(monday.reason, 'Skipped now: no Monday task is on the TV for build in the Prime team.');

  const either = await checkRow({ view: 'robotics', panel: 'monday-done', department: 'business', shown: true }, world);
  assert.match(either.reason, /for business in either team\.$/);

  const nothing = await checkRow({ view: 'robotics', panel: 'nowhere', shown: true }, world);
  assert.equal(nothing.state, 'skip');
  assert.match(nothing.reason, /needs a view and a panel it knows/);

  const lost = await checkRow({ view: 'robotics', panel: 'photo', shown: true }, { content: null, problem: 'Sanity could not be read.' });
  assert.deepEqual([lost.state, lost.reason], ['unknown', 'Sanity could not be read.']);
});

await check('the items are the tasks, the FRC news posts, the events and the TBA lines the wall would draw', async () => {
  const content = normalizeSample(sample);
  const now = new Date('2026-10-20T12:00:00Z');
  content.subteams = content.subteams.concat([{ id: 'build', name: 'Build', members: [] }]);
  content.tasks = [{ id: 't1', title: 'Wire the pit', team: 'prime', subteam: 'Build', subteamId: 'build', status: 'in-progress', source: 'monday', mondayId: 'm1', showOnTv: true, priority: 'high', contact: 'Sam', dueDate: '2026-10-25' }].concat(content.tasks);
  content.news = { lastSyncAt: now.toISOString(), lastError: '', items: [{ title: 'Kickoff is set', link: 'https://example.test/a', date: '2026-10-19T00:00:00Z', categories: ['FRC'], systemcore: false, source: 'FIRST' }] };
  content.events = [{ title: 'Build night', start: new Date('2026-10-22T22:00:00Z'), end: new Date('2026-10-23T00:00:00Z'), allDay: false, location: 'Lab', uid: 'e1', calendar: 'Team', calendarId: 'team' }];
  const world = { content: content, now: now, match13: null, problem: '' };

  const tasks = await checkRow({ view: 'prime', panel: 'monday-tasks', department: 'build', shown: true }, world);
  assert.deepEqual([tasks.state, tasks.items], ['show', ['Wire the pit']]);

  const news = await checkRow({ view: 'robotics', panel: 'frc-news', shown: true }, world);
  assert.deepEqual([news.state, news.items], ['show', ['Kickoff is set']]);
  const events = await checkRow({ view: 'robotics', panel: 'events', shown: true }, world);
  assert.equal(events.state, 'show');
  assert.match(events.items[0], /Build night$/);

  content.news = { lastSyncAt: '', lastError: '', items: [] };
  const empty = await checkRow({ view: 'robotics', panel: 'frc-news', shown: true }, world);
  assert.equal(empty.state, 'skip');
  assert.match(empty.reason, /no FRC news post/);
});

await check('checkRows answers for each key, and the Match13 matches are read from the local file only', async () => {
  const world = await worldWith([published]);
  fs.writeFileSync(path.join(world.dataDir, 'match13.json'), sampleMatch13);
  const data = readMatch13(world.dataDir);
  assert.ok(data && Object.keys(data.events).length > 0);
  const extras = extrasOf({ content: normalizeSample(sample), now: new Date('2026-01-02T00:00:00Z'), match13: data });
  assert.ok(extras.match13.events.length > 0);
  assert.ok(extras.match13.events[0].matches.length > 0);
  assert.equal(extras.match13.stale, false);
  fs.writeFileSync(path.join(world.dataDir, 'match13.json'), 'not json');
  assert.equal(readMatch13(world.dataDir), null);
  assert.equal(readMatch13(path.join(world.dataDir, 'nowhere')), null);

  const answers = await checkRows([{ _key: 'x', view: 'robotics', panel: 'photo' }, { view: 'robotics', panel: 'photo' }, null], { content: normalizeSample(sample), now: new Date(), match13: null, problem: '' });
  assert.deepEqual(Object.keys(answers), ['x']);
});

await check('POST check answers for the rows as they are on the page, without saving anything', async () => {
  const world = await worldWith([published]);
  const answer = await world.router.call('POST', '/display/check', { body: { rows: [{ _key: 'z', view: 'prime', panel: 'monday-tasks', department: 'build', shown: true }] } });
  assert.equal(answer.status, 200);
  assert.equal(answer.json.rows.z.state, 'skip');
  assert.deepEqual(mutationsOf(world), []);
  const bad = await world.router.call('POST', '/display/check', { body: { rows: 'no' } });
  assert.equal(bad.status, 400);
});

await check('when the content cannot be read the rows say not known and the page keeps working', async () => {
  const world = await makeWorld([display], { answers: { [settingsKey]: { result: [published] } }, offline: false });
  world.ctx.fetch = async (url, init) => {
    world.fetched.push({ url: String(url), init: init || {} });
    if (init && init.method === 'POST') throw new Error('the network is down');
    return { ok: true, status: 200, json: async () => ({ result: [published] }) };
  };
  const answer = await world.router.call('GET', '/display');
  assert.equal(answer.status, 200);
  assert.equal(answer.json.wall.rows.a1.state, 'unknown');
  assert.match(answer.json.wall.problem, /could not read the content from Sanity/);
});

await check('GET display/rev gives only the revision', async () => {
  const world = await worldWith([published, draft]);
  const answer = await world.router.call('GET', '/display/rev');
  assert.deepEqual(Object.keys(answer.json).sort(), ['isDraft', 'rev', 'studioNewer', 'updatedAt']);
  assert.equal(answer.json.rev, 'rev-draft');
});

console.log('\n' + passed + ' passed');
