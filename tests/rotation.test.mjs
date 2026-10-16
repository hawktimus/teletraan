// Tests for the one rotation list (docs/views.md, "The rotation"): the rows and their tidy, the blocks, the kind of
// transition between two rows, the migration from the lists of the views (on the screen and in the Studio), and the
// clock that plays the blocks. Nothing is drawn.
//
//   node tests/rotation.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { readModule } from './helpers/read-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const studioFolder = fileURLToPath(new URL('../studio/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-rotation-'));
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
// The studio tool is plain JavaScript with no package in it
fs.mkdirSync(path.join(workFolder, 'studio-tools'), { recursive: true });
['rotation-migrate.js', 'view-defaults.js'].forEach(file => fs.copyFileSync(path.join(studioFolder, 'tools', file), path.join(workFolder, 'studio-tools', file)));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const rotation = await import(base + 'core/rotation.js');
const views = await import(base + 'core/views.js');
const sanity = await import(base + 'core/sanity.js');
const studio = await import(pathToFileURL(path.join(workFolder, 'studio-tools', 'rotation-migrate.js')).href);

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

const row = (view, panel, seconds, shown = true) => ({ view: view, panel: panel, seconds: seconds, shown: shown });

test('an untouched Studio has an empty list and a transition length of 3 seconds', () => {
  const content = contentWith();
  assert.deepEqual(content.settings.rotationRows, []);
  assert.equal(content.settings.transitionSeconds, 3);
  assert.equal(rotation.rotationOn(content), false);
  assert.equal(rotation.transitionSecondsOf(content), 3);
});

test('transitionSeconds is kept from 2 to 4', () => {
  assert.equal(contentWith(raw => { raw.settings.transitionSeconds = 9; }).settings.transitionSeconds, 4);
  assert.equal(contentWith(raw => { raw.settings.transitionSeconds = 0.5; }).settings.transitionSeconds, 2);
  assert.equal(contentWith(raw => { raw.settings.transitionSeconds = 'slow'; }).settings.transitionSeconds, 3);
});

test('a row is read the way it is typed, general is robotics, and a row that cannot play is dropped', () => {
  const rows = rotation.tidyRotationRows([
    row('general', 'events', 30),
    row('prime', 'monday-tasks', 400),
    { view: 'nova', panel: 'events' },
    row('family', 'monday-overall', 20),
    row('moon', 'events', 20),
    row('prime', 'no-such-panel', 20),
    row('prime', 'task-counts', 20),
    'text',
  ]);
  assert.deepEqual(rows.map(item => [item.view, item.panel, item.seconds, item.shown]), [
    ['robotics', 'events', 30, true], ['prime', 'monday-tasks', 120, true], ['nova', 'events', undefined, true], ['robotics', 'monday-overall', 20, true],
  ]);
});

test('a hidden row keeps its place and plays nothing, and rows of one view that follow each other are one block', () => {
  const rows = rotation.tidyRotationRows([row('robotics', 'tonight', 45), row('robotics', 'events', 60, false), row('robotics', 'leadership', 20), row('prime', 'monday-tasks', 30), row('robotics', 'events', 30)]);
  assert.equal(rows.length, 5);
  const blocks = rotation.rotationBlocks(rows);
  assert.deepEqual(blocks.map(block => [block.view, block.key, block.rows.map(item => item.panel)]), [
    ['robotics', 'general', ['tonight', 'leadership']], ['prime', 'prime', ['monday-tasks']], ['robotics', 'general', ['events']],
  ]);
});

test('transitionKindFor says reformView when the view changes and reform inside a view', () => {
  assert.equal(rotation.transitionKindFor(row('robotics', 'events', 20), row('robotics', 'leadership', 20)), 'reform');
  assert.equal(rotation.transitionKindFor(row('robotics', 'events', 20), row('prime', 'monday-tasks', 20)), 'reformView');
  assert.equal(rotation.transitionKindFor(row('prime', 'monday-tasks', 20), row('nova', 'monday-tasks', 20)), 'reformView');
  assert.equal(rotation.transitionKindFor(row('general', 'events', 20), row('robotics', 'tonight', 20)), 'reform', 'general is robotics');
  assert.equal(rotation.transitionKindFor(null, row('prime', 'events', 20)), 'reform');
});

test('the migration keeps the order of the views and of each list, puts the agenda first in Robotics and turns Family into Robotics rows', () => {
  const content = contentWith();
  const rows = rotation.migrateRotation(content);
  assert.deepEqual(rows.slice(0, 5).map(item => [item.view, item.panel]), [['robotics', 'tonight'], ['robotics', 'events'], ['robotics', 'leadership'], ['robotics', 'photo'], ['robotics', 'sponsor-feature']]);
  assert.deepEqual(rows.slice(5, 9).map(item => [item.view, item.panel]), [['prime', 'monday-tasks'], ['prime', 'monday-done'], ['prime', 'monday-timeline'], ['prime', 'monday-board']]);
  assert.deepEqual(rows.slice(9, 13).map(item => item.view), ['nova', 'nova', 'nova', 'nova']);
  assert.deepEqual(rows.slice(13).map(item => [item.view, item.panel]), [['robotics', 'tonight'], ['robotics', 'monday-overall'], ['robotics', 'monday-status-depts']]);
  assert.ok(rows.every(item => item.shown));
  assert.equal(rows[3].seconds, 40, 'the photos keep their product');
});

test('the migration follows viewOrder and puts the agenda first when the list had it elsewhere', () => {
  const content = contentWith(raw => { raw.settings.viewOrder = ['nova', 'general']; });
  const rows = rotation.migrateRotation(content);
  assert.equal(rows[0].view, 'nova');
  assert.equal(rows.find(item => item.view === 'robotics').panel, 'tonight');
});

test('the Studio migration makes the same rows as the screen', () => {
  const content = contentWith();
  const fromScreen = rotation.migrateRotation(content).map(item => [item.view, item.panel, item.seconds]);
  const fromStudio = studio.migrateRotationRows(content.settings.viewOrder, {}).map(item => [item.view, item.panel, item.seconds]);
  assert.deepEqual(fromStudio, fromScreen);
  assert.ok(studio.migrateRotationRows([], {}).every(item => typeof item._key === 'string'));
});

test('with a list the views play its blocks, and with none they play their own lists', () => {
  const plain = contentWith();
  assert.equal(views.viewSteps(plain, 'general', monday12).map(step => step.panel).join(), 'tonight,events,leadership,photo,sponsor-feature');

  const listed = contentWith(raw => { raw.settings.rotationRows = [row('robotics', 'events', 30), row('robotics', 'tonight', 25)]; });
  assert.deepEqual(views.viewSteps(listed, 'general', monday12).map(step => [step.panel, step.seconds]), [['events', 30], ['tonight', 25]]);
});

test('the clock plays each block for the seconds of its rows, then the next block, and loops', () => {
  const content = contentWith(raw => {
    raw.settings.rotationRows = [row('robotics', 'events', 20), row('robotics', 'tonight', 10), row('nova', 'tonight', 15), row('robotics', 'leadership', 20)];
  });
  views.resetViews();
  const seen = [];
  for (let second = 1; second <= 120; second += 1) {
    const moved = views.tickView(content, new Date(monday12.getTime() + second * 1000), {});
    if (moved.changed) seen.push([second, moved.key, views.cycleBlock()]);
  }
  assert.deepEqual(seen.slice(0, 4), [[1, 'general', 0], [31, 'nova', 1], [46, 'general', 2], [66, 'general', 0]]);
  views.resetViews();
});

test('a block with nothing to show is skipped, and with a hidden row between views nothing changes', () => {
  const content = contentWith(raw => {
    raw.settings.rotationRows = [row('robotics', 'tonight', 20), row('prime', 'monday-tasks', 20), row('nova', 'tonight', 20, false)];
  });
  views.resetViews();
  const seen = [];
  for (let second = 1; second <= 100; second += 1) {
    const moved = views.tickView(content, new Date(monday12.getTime() + second * 1000), { canShow: step => step.panel !== 'monday-tasks' });
    if (moved.changed) seen.push([second, moved.key]);
  }
  assert.deepEqual(seen, [[1, 'general']], 'one playable block stays and starts again');
  views.resetViews();
});

test('the control page can name robotics for a view and gets the general view', () => {
  const requests = fs.readFileSync(path.join(dashboardFolder, 'core/screen-requests.js'), 'utf8');
  assert.ok(requests.includes("'robotics'"));
});

test('the docs name the rotation list', () => {
  const text = readModule(path.join(docsFolder, 'views.md'), 'utf8').replace(/\s+/g, ' ');
  ['rotationRows', 'reformView', 'transitionSeconds', 'Shown'].forEach(word => assert.ok(text.includes(word), 'views.md names ' + word));
  assert.ok(!/[—–]/.test(text) && !/!/.test(text), 'written plainly');
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
