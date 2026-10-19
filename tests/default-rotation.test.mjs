// Tests for the default rotation (docs/views.md, "The default rotation"): the fifteen blocks the team asked for, in order, what
// each named panel is in the registry, the same list in the Studio, and that the screen plays it while the Studio has no
// Shown row. Nothing is drawn.
//
//   node tests/default-rotation.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config, contentOf, dashboardFolder, load, now, read, registry, task, test, runTests } from './helpers/monday-world.mjs';

const studioFolder = fileURLToPath(new URL('../studio/', import.meta.url));
const rotation = await load('core/rotation.js');
const playing = await load('core/views.js');

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-default-rotation-'));
fs.mkdirSync(path.join(workFolder, 'tools'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['default-rotation.js', 'rotation-migrate.js', 'view-defaults.js'].forEach(file => fs.copyFileSync(path.join(studioFolder, 'tools', file), path.join(workFolder, 'tools', file)));
process.on('exit', () => fs.rmSync(workFolder, { recursive: true, force: true }));
const studio = await import(pathToFileURL(path.join(workFolder, 'tools', 'rotation-migrate.js')).href);
const studioDefault = await import(pathToFileURL(path.join(workFolder, 'tools', 'default-rotation.js')).href);

const content = contentOf([]);
const rows = rotation.rotationRowsOf(content);
const blocks = rotation.rotationBlocks(rows);
const line = block => block.rows.map(item => item.panel + (item.part ? ' ' + item.part : '') + (item.department ? ' [' + item.department + ']' : '') + (item.list ? ' ' + item.list : '') + (item.chart ? ' ' + item.chart : ''));

// The two roster rows of a department of a team view
const two = department => ['roster 1 [' + department + ']', 'roster 2 [' + department + ']'];
const nine = ['build', 'electrical', 'programming', 'design', 'cnc', 'strategy', 'operations', 'business', 'marketing'];
const lastFour = ['robotStatus', 'wireframe', 'driveHours', 'competition-rank'];
const pairs = [
  ['leadership', 'sponsor-logo'], ['events 1', 'task-counts'], ['events 2', 'forecast'], ['sponsor-feature', 'next-event'], ['spotlight', 'miniIdea1'], ['photo', 'qrParts'],
];

test('an untouched Studio plays the default rotation: fifteen blocks, in the views the team asked for', () => {
  assert.equal(rotation.rotationOn(content), false, 'the Studio has no list');
  assert.equal(blocks.length, 15);
  assert.deepEqual(blocks.map(block => block.view), ['robotics', 'prime', 'nova', 'prime', 'nova', 'robotics', 'prime', 'nova', 'prime', 'nova', 'robotics', 'prime', 'nova', 'prime', 'nova']);
  assert.ok(rows.every(item => item.shown));
});

test('block 1 is the six pairs of the split layout, then the open tasks of the nine departments, the three TV charts and the Business and Marketing roster', () => {
  const first = blocks[0].rows;
  assert.deepEqual(first.slice(0, 6).map(item => [item.panel + (item.part ? ' ' + item.part : ''), item.side]), pairs);
  assert.deepEqual(line({ rows: first.slice(6) }), nine.map(name => 'monday-department [' + name + '] open').concat([
    'monday-charts status', 'monday-charts progress', 'monday-charts timeline', 'roster [business,marketing]',
  ]));
  first.slice(6).forEach(item => assert.equal(config.roboticsWidePanels.includes(item.panel), true, item.panel + ' is wide'));
  first.slice(0, 6).forEach(item => assert.equal(config.roboticsWidePanels.includes(item.panel), false, item.panel + ' is split'));
});

test('blocks 2 and 3 are the Team leads and Build for Prime and for Nova, blocks 4 and 5 Electrical', () => {
  const leads = ['team-leads 1', 'team-leads 2'];
  assert.deepEqual(line(blocks[1]), leads.concat(two('build')));
  assert.deepEqual(line(blocks[2]), leads.concat(two('build')));
  assert.deepEqual(line(blocks[3]), two('electrical'));
  assert.deepEqual(line(blocks[4]), two('electrical'));
});

test('blocks 6 and 11 are the six pairs again with no Business rows', () => {
  [5, 10].forEach(at => assert.deepEqual(blocks[at].rows.map(item => [item.panel + (item.part ? ' ' + item.part : ''), item.side]), pairs));
});

test('blocks 7 to 10 and 12 to 13 are Programming, Design and CNC, and Strategy, Prime then Nova', () => {
  assert.deepEqual(line(blocks[6]), two('programming'));
  assert.deepEqual(line(blocks[7]), two('programming'));
  assert.deepEqual(line(blocks[8]), two('design'));
  assert.deepEqual(line(blocks[9]), two('design'));
  assert.deepEqual(line(blocks[11]), two('strategy'));
  assert.deepEqual(line(blocks[12]), two('strategy'));
});

test('blocks 14 and 15 are the last four panels of Prime and of Nova', () => {
  assert.deepEqual(line(blocks[13]), lastFour);
  assert.deepEqual(line(blocks[14]), lastFour);
  assert.equal(rows.length, 6 + 13 + 2 * (2 + 2) + 2 * 2 + 6 + 4 * 2 + 6 + 2 * 2 + 2 * 4, 'the count of rows adds up');
});

test('every default row is a registered panel the list accepts, and nothing is dropped by tidy', () => {
  const raw = config.defaultRotationRows();
  assert.equal(rows.length, raw.length);
  raw.forEach(item => {
    const entry = registry.panels.find(panel => panel.id === item.panel);
    assert.ok(entry && entry.region === 'grid1', item.panel + ' is a large panel');
    if (item.side) {
      const side = registry.panels.find(panel => panel.id === item.side);
      assert.ok(side && side.region === 'grid2', item.side + ' is a small panel');
    }
  });
});

test('the panels the team named are these registered ones', () => {
  const mapping = {
    'Leadership Roster': 'leadership', 'Upcoming Events 1 and 2': 'events', 'Sponsor Spotlight': 'sponsor-feature', 'Sponsor Logo Spotlight': 'sponsor-logo',
    'Task Counts': 'task-counts', 'Weather Forecast': 'forecast', 'Next Event': 'next-event', 'Subteam Spotlight': 'spotlight', Photos: 'photo',
    'Mini Panel Idea 1': 'miniIdea1', 'QR Code for Parts Request': 'qrParts', 'Department tasks': 'monday-department', 'TV Charts': 'monday-charts',
    'Team Roster': 'roster',
    'Team Leads': 'team-leads', 'Total Robot Status': 'robotStatus', '3D Wireframe of Robot': 'wireframe', 'Drive Hours Recorded': 'driveHours', 'FRC Ranking': 'competition-rank',
  };
  Object.keys(mapping).forEach(name => assert.ok(registry.panels.some(panel => panel.id === mapping[name]), name + ' is ' + mapping[name]));
  const used = new Set(rows.map(item => item.panel).concat(rows.filter(item => item.side).map(item => item.side)));
  Object.keys(mapping).forEach(name => assert.ok(used.has(mapping[name]), name + ' is in the default rotation'));
});

test('the Studio default is the same list as the screen default, with a key on every row, and it is what a new list is filled with', () => {
  assert.deepEqual(studioDefault.defaultRotationRows(), config.defaultRotationRows());
  const filled = studio.migrateRotationRows();
  assert.deepEqual(filled.map(item => { const { _key, ...rest } = item; return rest; }), config.defaultRotationRows());
  assert.equal(new Set(filled.map(item => item._key)).size, filled.length);
  assert.deepEqual(rotation.migrateRotation(content), rows);
});

test('a list with a Shown row is played in place of the default, and a list with no Shown row is not', () => {
  const own = { view: 'robotics', panel: 'events', seconds: 30, shown: true };
  const listed = contentOf([], raw => { raw.settings.rotationRows = [own]; });
  assert.deepEqual(rotation.rotationRowsOf(listed).map(item => item.panel), ['events']);

  const hidden = contentOf([], raw => { raw.settings.rotationRows = [Object.assign({}, own, { shown: false })]; });
  assert.equal(rotation.rotationRowsOf(hidden).length, rows.length, 'no Shown row plays the default');
  assert.equal(rotation.rotationBlocks(rotation.rotationRowsOf(hidden)).length, 15);
});

test('the older lists of the views are kept as the way to build a list from them', () => {
  const older = rotation.migrateRotationFromViews(content);
  assert.equal(older[0].panel, 'tonight');
  assert.ok(studio.migrateRotationRowsFromViews([], {}).length > 0);
});

test('a row keeps its part, its side and its department when it is tidied, and loses a side that is not a small panel', () => {
  const tidy = rotation.tidyRotationRow({ view: 'robotics', panel: 'roster', part: 2, side: 'qrParts', department: 'build', shown: true });
  assert.equal(tidy.part, 2);
  assert.equal(tidy.side, 'qrParts');
  assert.equal(tidy.department, 'build');
  assert.equal(rotation.tidyRotationRow({ view: 'robotics', panel: 'events', side: 'tonight' }).side, undefined);
  assert.equal(rotation.tidyRotationRow({ view: 'robotics', panel: 'events', part: 3 }).part, undefined);
});

test('the steps of the first block carry the small panel of each row, and the pairing follows the step on the screen', () => {
  const steps = playing.viewSteps(content, 'general', now, 0);
  assert.deepEqual(steps.slice(0, 6).map(step => step.side), ['sponsor-logo', 'task-counts', 'forecast', 'next-event', 'miniIdea1', 'qrParts']);
  assert.deepEqual(steps[1].page, { team: '', department: '', part: 1 }, 'the first page of the Events panel');
  assert.deepEqual(steps[2].page, { team: '', department: '', part: 2 });

  playing.resetViews();
  assert.deepEqual(playing.viewSidePlaylist(content).map(step => step.panel).slice(0, 1), ['next-event'], 'before a pairing the view plays its own small panels');
  assert.equal(playing.pairSide(steps[5]), true);
  const side = playing.viewSidePlaylist(content);
  assert.deepEqual(side.map(step => [step.panel, step.paired]), [['qrParts', true]]);
  assert.ok(side[0].seconds > steps[5].seconds, 'the side outlasts the step, the next step moves it');
  assert.equal(playing.pairSide({ panel: 'monday-department' }), true, 'a step with no side takes the pairing away');
  assert.equal(playing.pairSide({ panel: 'monday-department' }), false);
  assert.equal(playing.viewSidePlaylist(content)[0].panel !== 'qrParts', true);
  playing.resetViews();
});

test('the Robotics Monday block plays the departments with open tasks and the charts, and leaves the others out', () => {
  const named = contentOf([
    task({ title: '[A]', department: 'build', status: 'in-progress', team: 'prime', estHours: 4 }),
    task({ title: '[B]', department: 'electrical', list: 'done', status: 'done', team: 'prime', estHours: 2, completedOn: '2026-10-14' }),
  ]);
  const first = playing.viewSteps(named, 'general', now, 0).filter(step => step.panel.startsWith('monday-'));
  assert.deepEqual(first.map(step => step.page.department || step.page.chart), ['build', 'status', 'progress', 'timeline'], 'Electrical has nothing open');
});

test('the views doc has the table of the default order', () => {
  const text = fs.readFileSync(path.join(path.dirname(dashboardFolder), 'docs', 'views.md'), 'utf8');
  ['The default rotation', 'miniIdea1', 'qrParts', 'monday-department', 'monday-charts', 'driveHours', 'competition-rank', 'partsRequestUrl'].forEach(word => assert.ok(text.includes(word), 'views.md names ' + word));
  assert.ok(read('registry.js').includes('rotationOnly'));
});

await runTests();
