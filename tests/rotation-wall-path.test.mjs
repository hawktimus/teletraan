// The whole path of the Rotation list from the Studio to the wall, on paper and with the real functions: what the board writes,
// what the content query reads, what the normalizer keeps, what the clock plays, what happens when a new list is published, and
// the notes the board shows for a row that has nothing to show. Nothing is drawn and nothing leaves the process.
//
//   node tests/rotation-wall-path.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { openValidation } from './helpers/studio-validation.mjs';
import { readModule } from './helpers/read-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const studioFolder = fileURLToPath(new URL('../studio/', import.meta.url));
const repoFolder = fileURLToPath(new URL('../', import.meta.url));

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-rotation-path-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js'].forEach(file => copyModule(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(root, file));
});
// The Studio files that are plain JavaScript with no package in them
const studioCopy = path.join(workFolder, 'studio');
fs.mkdirSync(path.join(studioCopy, 'tools'), { recursive: true });
fs.mkdirSync(path.join(studioCopy, 'inputs'), { recursive: true });
fs.writeFileSync(path.join(studioCopy, 'package.json'), '{ "type": "module" }\n');
['rotation-board.js', 'rotation-titles.js', 'default-rotation.js'].forEach(file => fs.copyFileSync(path.join(studioFolder, 'tools', file), path.join(studioCopy, 'tools', file)));
['screen-panels.js'].forEach(file => fs.copyFileSync(path.join(studioFolder, 'inputs', file), path.join(studioCopy, 'inputs', file)));

const base = pathToFileURL(root).href + '/';
const rotation = await import(base + 'core/rotation.js');
const views = await import(base + 'core/views.js');
const sanity = await import(base + 'core/sanity.js');
const board = await import(pathToFileURL(path.join(studioCopy, 'tools', 'rotation-board.js')).href);
const titles = await import(pathToFileURL(path.join(studioCopy, 'tools', 'rotation-titles.js')).href);

const tests = [];
function test(name, body) {
  tests.push({ name: name, run: body });
}

const monday12 = new Date('2026-10-12T16:00:00Z');
const sampleRaw = () => JSON.parse(readModule(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));
function contentWith(change) {
  const raw = sampleRaw();
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}
const row = (view, panel, seconds, extra) => Object.assign({ view: view, panel: panel, seconds: seconds, shown: true }, extra || {});

test('the content query reads the published Dashboard Settings whole, so rotationRows and every field of a row come with it', () => {
  const query = sanity.contentQuery;
  assert.ok(/"settings": \*\[_id == "dashboardSettings"\]\[0\] \{\s*\.\.\./.test(query), 'the settings are read by the published id, with every field');
  assert.ok(!query.includes('drafts.'), 'a draft is never read');
  assert.ok(sanity.queryUrl({ projectId: 'p', dataset: 'd', apiVersion: '2025-02-19' }).endsWith('&perspective=published'));
  assert.ok(!/rotationRows\s*\[|rotationRows\s*\{/.test(query), 'no part of the list is picked out by name, so no field can be left out');
});

test('every field the board writes on a row reaches the wall: view, panel, seconds, shown, side, part, department, list, team and the photo values', () => {
  const written = [
    row('robotics', 'events', 30, { part: 2, side: 'forecast' }),
    row('prime', 'monday-department', 40, { department: 'build', list: 'done', team: 'nova' }),
    { view: 'nova', panel: 'photo', photoCount: 3, secondsPerPhoto: 12, shown: true },
    row('nova', 'roster', undefined, { department: 'business,marketing', shown: false }),
  ];
  const content = contentWith(raw => { raw.settings.rotationRows = JSON.parse(JSON.stringify(written)); });
  const saved = rotation.savedRotationRows(content);
  assert.equal(saved.length, 4);
  assert.deepEqual([saved[0].view, saved[0].panel, saved[0].seconds, saved[0].part, saved[0].side, saved[0].shown], ['robotics', 'events', 30, 2, 'forecast', true]);
  assert.deepEqual([saved[1].department, saved[1].seconds, saved[1].list, saved[1].team], ['build', 40, 'done', 'nova']);
  assert.deepEqual([saved[2].photoCount, saved[2].secondsPerPhoto, saved[2].seconds], [3, 12, 36]);
  assert.deepEqual([saved[3].department, saved[3].shown], ['business,marketing', false]);
  assert.deepEqual(saved.map(item => item.panel), written.map(item => item.panel), 'the order is the order of the board');
});

test('every panel, small panel and view the board offers is accepted by the wall, so no row it writes is dropped', () => {
  titles.panelChoices.forEach(choice => {
    assert.notEqual(rotation.tidyRotationRow({ view: 'robotics', panel: choice.value }), null, choice.value + ' is a panel of the wall');
  });
  titles.sideChoices.forEach(choice => {
    assert.equal(rotation.tidyRotationRow({ view: 'robotics', panel: 'events', side: choice.value }).side, choice.value, choice.value + ' is a small panel of the wall');
  });
  titles.viewTable.forEach(entry => assert.equal(rotation.rotationViewOf(entry.value), entry.value));
});

test('a row with an unknown panel or view is left out and never stalls the loop', () => {
  const content = contentWith(raw => {
    raw.settings.rotationRows = [row('robotics', 'events', 20), row('robotics', 'no-such-panel', 20), row('moon', 'events', 20), row('robotics', 'tonight', 20)];
  });
  assert.deepEqual(rotation.savedRotationRows(content).map(item => item.panel), ['events', 'tonight']);
  assert.deepEqual(views.viewSteps(content, 'general', monday12).map(step => step.panel), ['events', 'tonight']);
});

test('a list with no shown row plays the default rotation, and one shown row is enough to play the list', () => {
  const none = contentWith(raw => { raw.settings.rotationRows = [Object.assign(row('robotics', 'events', 20), { shown: false }), Object.assign(row('prime', 'tonight', 20), { shown: false })]; });
  assert.equal(rotation.rotationOn(none), false);
  assert.equal(rotation.rotationRowsOf(none).length, rotation.rotationRowsOf(contentWith()).length, 'the default rotation plays');
  const one = contentWith(raw => { raw.settings.rotationRows = [row('robotics', 'events', 20), Object.assign(row('prime', 'tonight', 20), { shown: false })]; });
  assert.equal(rotation.rotationOn(one), true);
  assert.deepEqual(rotation.rotationRowsOf(one).filter(item => item.shown).map(item => item.panel), ['events']);
});

test('a Monday row with no tasks for its department is skipped by the wall, and plays once the tasks are there', () => {
  const rows = [row('robotics', 'tonight', 20), row('prime', 'monday-department', 20, { department: 'build', list: 'open' })];
  const content = contentWith(raw => {
    raw.settings.rotationRows = rows;
    raw.tasks = [];
  });
  assert.deepEqual(views.viewSteps(content, 'prime', monday12).map(step => step.panel), [], 'nothing to show, the row is skipped');
  assert.deepEqual(views.viewSteps(content, 'general', monday12).map(step => step.panel), ['tonight']);
  const filled = contentWith(raw => {
    raw.settings.rotationRows = rows;
    raw.tasks = [{ title: '[A]', department: 'build', list: 'open', status: 'up-next', source: 'monday', showOnTv: true }];
  });
  assert.deepEqual(views.viewSteps(filled, 'prime', monday12).map(step => step.panel), ['monday-department']);
});

// A published change reaches the wall without a restart: the clock reads the newest content every second
test('a list published while the wall runs is played from the next tick, even when the blocks change place', () => {
  const before = contentWith(raw => { raw.settings.rotationRows = [row('robotics', 'events', 20), row('prime', 'tonight', 20)]; });
  const after = contentWith(raw => { raw.settings.rotationRows = [row('prime', 'tonight', 20), row('robotics', 'events', 20)]; });
  views.resetViews();
  let second = 0;
  const tick = content => views.tickView(content, new Date(monday12.getTime() + (second += 1) * 1000), {});
  tick(before);
  for (let step = 0; step < 21; step += 1) tick(before);
  assert.equal(views.cycleKey(), 'prime', 'the clock is on the second block');

  for (let step = 0; step < 12; step += 1) tick(after);
  const steps = views.viewPlaylist(after, new Date(monday12.getTime() + second * 1000));
  assert.ok(steps.length > 0, 'the large panel has something to play after the list changed (' + views.cycleKey() + ' block ' + views.cycleBlock() + ')');
  assert.equal(views.cycleKey(), steps[0].view, 'the view of the clock is the view of the block it plays');
  views.resetViews();
});

test('a list that gets shorter while the wall runs does not leave the clock on a block that is gone', () => {
  const before = contentWith(raw => { raw.settings.rotationRows = [row('robotics', 'events', 20), row('prime', 'tonight', 20), row('nova', 'tonight', 20)]; });
  const after = contentWith(raw => { raw.settings.rotationRows = [row('robotics', 'events', 20)]; });
  views.resetViews();
  let second = 0;
  const tick = content => views.tickView(content, new Date(monday12.getTime() + (second += 1) * 1000), {});
  for (let step = 0; step < 45; step += 1) tick(before);
  assert.equal(views.cycleBlock(), 2);
  for (let step = 0; step < 3; step += 1) tick(after);
  assert.equal(views.cycleBlock(), 0);
  assert.ok(views.viewPlaylist(after, monday12).length > 0);
  views.resetViews();
});

test('the screen reads new content from the stream and every 5 minutes, and the views take the newest content each second', () => {
  const source = readModule(path.join(dashboardFolder, 'core/content-source.js'), 'utf8');
  assert.ok(source.includes('new EventSource(liveEventsUrl(sanity))'), 'it listens for live changes');
  assert.ok(/const pollEvery = 5 \* 60 \* 1000;/.test(source), 'it also reads every 5 minutes');
  const run = readModule(path.join(dashboardFolder, 'core/views-run.js'), 'utf8');
  assert.ok(/const content = getContent\(\);/.test(run) && run.includes('frame.onSecond'), 'the views ask for the newest content every second');
  const shell = readModule(path.join(dashboardFolder, 'shell-content.js'), 'utf8');
  assert.ok(shell.includes('viewPlaylist(shellState.content'), 'the large panel list is worked out from the content on the screen');
});

test('the Rotation board names a row that the wall skips for lack of data, and every row of a retired panel', () => {
  const rows = [
    { _key: 'a', view: 'prime', panel: 'monday-department', department: 'build', list: 'open', team: 'prime', shown: true },
    { _key: 'b', view: 'robotics', panel: 'photo', shown: true },
    { _key: 'c', view: 'robotics', panel: 'events', shown: true },
    { _key: 'd', view: 'nova', panel: 'monday-board', shown: false },
  ];
  const none = board.skipNotes(rows, { tasks: [], photos: [] });
  assert.deepEqual(Object.keys(none).sort(), ['a', 'b', 'd']);
  assert.equal(none.a, 'Skipped now: no open Build task is on the TV for the Prime team.');
  assert.equal(none.b, 'Skipped now: no photos (every photo is hidden or past its expiry).');
  assert.equal(none.d, 'Retired, use Department tasks.', 'a retired row says so, shown or not');

  const some = { tasks: [{ team: 'prime', department: 'electrical', list: 'done' }, { team: '', department: 'cnc', status: 'up-next' }, { team: 'nova', department: 'build', list: 'open', startDate: '2026-10-01', dueDate: '2026-10-20' }], photos: [{ expires: '2999-01-01T00:00:00Z' }] };
  const more = [
    { _key: 'e', view: 'prime', panel: 'monday-department', department: 'electrical', list: 'done', shown: true },
    { _key: 'f', view: 'nova', panel: 'monday-tasks', department: 'cnc', shown: true },
    { _key: 'g', view: 'nova', panel: 'monday-department', department: 'electrical', list: 'done', team: 'nova', shown: true },
    { _key: 'h', view: 'robotics', panel: 'monday-department', shown: true },
    { _key: 'i', view: 'robotics', panel: 'monday-charts', chart: 'timeline', team: 'prime', shown: true },
    { _key: 'j', view: 'robotics', panel: 'monday-charts', chart: 'timeline', shown: true },
  ];
  const notes = board.skipNotes(rows.concat(more), some);
  assert.equal(notes.a, 'Skipped now: no open Build task is on the TV for the Prime team.', 'a Nova task is not on the Prime panel');
  assert.equal(notes.b, undefined, 'a photo that has not expired is something to show');
  assert.equal(notes.e, undefined);
  assert.equal(notes.f, undefined, 'an older tasks row with a department plays as Department tasks, and a task of no team counts for every team');
  assert.equal(notes.g, 'Skipped now: no done Electrical task is on the TV for the Nova team.');
  assert.equal(notes.h, 'Skipped now: pick a Department in Details.');
  assert.equal(notes.i, 'Skipped now: no Monday task of the Prime team has a Timeline.');
  assert.equal(notes.j, undefined);
  assert.deepEqual(board.skipNotes(rows, null), { d: 'Retired, use Department tasks.' }, 'when the data cannot be read only the retired rows have notes');
  assert.deepEqual(Object.keys(board.skipNotes(rows, { tasks: [], photos: [{ expires: '2000-01-01T00:00:00Z' }] })).sort(), ['a', 'b', 'd'], 'an expired photo is not a photo');
});

test('the board asks for the same tasks the wall would show, and draws the notes under the panel', () => {
  assert.ok(board.skipQuestion.includes('source == "monday"') && board.skipQuestion.includes('showOnTv != false') && board.skipQuestion.includes('showOnBoard != false') && board.skipQuestion.includes('defined(department)'));
  const view = readModule(path.join(studioFolder, 'inputs/rotation-board-view.js'), 'utf8');
  assert.ok(view.includes('skipNotes(state.rows, state.data)') && view.includes("perspective: 'published'"));
  assert.ok(view.includes('words.skipHint'));
  const parts = readModule(path.join(studioFolder, 'inputs/rotation-board-parts.js'), 'utf8');
  assert.ok(parts.includes("'data-skip'") && parts.includes('state.skips[row._key]') && parts.includes("'data-retired'"));
  assert.ok(!/[—–]/.test(board.skipHint) && !/!/.test(board.skipHint), 'written plainly');
});

test('a list like the one on the wall, 107 rows with department rows, passes the Studio rules, so it can be published', async () => {
  const validation = await openValidation(repoFolder);
  if (!validation) return;
  try {
    const rows = [];
    ['robotics', 'prime', 'nova'].forEach(view => {
      ['events', 'leadership', 'photo', 'roster', 'monday-department', 'monday-charts', 'monday-tasks', 'monday-board'].forEach((panel, at) => {
        const item = { _key: view + at, view: view, panel: panel, shown: true, seconds: 30 };
        if (panel === 'photo') Object.assign(item, { photoCount: 4, secondsPerPhoto: 10, seconds: 40 });
        if (panel === 'monday-tasks' || panel === 'roster' || panel === 'monday-department') item.department = 'build';
        if (panel === 'monday-department') Object.assign(item, { list: 'done', team: 'nova' });
        if (panel === 'monday-charts') item.chart = 'timeline';
        if (panel === 'events') Object.assign(item, { part: 1, side: 'task-counts' });
        rows.push(item);
      });
    });
    assert.deepEqual(await validation.problems({ _id: 'dashboardSettings', _type: 'dashboardSettings', rotationRows: rows }, ['rotationRows']), []);
  } finally {
    validation.close();
  }
});

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log('      ' + String(error && error.stack ? error.stack : error).split('\n').join('\n      '));
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}
console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exit(1);
