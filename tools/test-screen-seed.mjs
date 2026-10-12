// Tests for the rows that a Screen is built from the Panel order (dashboard/core/screen-seed.js): the order of the rows,
// which panels have a team, what carries over from the old rows, and the Panel order the team saved before the Screens.
// The Studio builds the same rows with a copy of the rule, and the lead's parity test compares the two. Nothing is
// drawn and nothing touches the network.
//
//   node tools/test-screen-seed.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying the three files the rule reads next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-screen-seed-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'core/panel-order.js', 'core/screen-seed.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const registry = await import(base + 'registry.js');
const { seedMainRows, seedSideRows } = await import(base + 'core/screen-seed.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const prime = { code: 'prime' };
const nova = { code: 'nova' };
const rowsOf = list => list.map(row => row.panel + (row.team ? ' ' + row.team : '') + (row.seconds ? ' ' + row.seconds + 's' : ''));

// The Panel order that is saved on the screen today: eleven rows, all shown, with no seconds
const ownersOrder = ['tonight', 'forecast', 'leadership', 'team-leads', 'photo', 'next-event', 'task-counts', 'sponsor-logo', 'task-counts', 'events', 'tasks'].map(panel => ({ panel: panel, show: true }));

test('the Panel order saved on the screen today becomes: each team with its panels and its Monday rows, then the panels that are the same for both', () => {
  const main = seedMainRows({ order: ownersOrder }, [prime, nova]);
  assert.deepEqual(rowsOf(main), [
    'tonight prime', 'leadership prime', 'team-leads prime', 'tasks prime', 'monday-tasks prime', 'monday-milestones prime', 'monday-progress prime',
    'tonight nova', 'leadership nova', 'team-leads nova', 'tasks nova', 'monday-tasks nova', 'monday-milestones nova', 'monday-progress nova',
    'photo', 'events',
  ]);
  assert.deepEqual(rowsOf(seedSideRows({ order: ownersOrder })), ['forecast', 'next-event', 'task-counts', 'sponsor-logo', 'task-counts'], 'task-counts is twice, as it is in the order');
  main.slice(14).forEach(row => assert.equal(row.team, '', row.panel + ' has no team'));
  main.slice(0, 14).forEach(row => assert.ok(row.team === 'prime' || row.team === 'nova', row.panel));
});

test('with one team the rows are that team\'s, its Monday rows and then the shared panels, and with the teams the other way round Nova comes first', () => {
  const only = seedMainRows({ order: ownersOrder }, [prime]);
  assert.deepEqual(rowsOf(only), ['tonight prime', 'leadership prime', 'team-leads prime', 'tasks prime', 'monday-tasks prime', 'monday-milestones prime', 'monday-progress prime', 'photo', 'events']);

  assert.deepEqual(rowsOf(seedMainRows({ order: [{ panel: 'tasks' }, { panel: 'photo' }] }, [nova, prime])), [
    'tasks nova', 'monday-tasks nova', 'monday-milestones nova', 'monday-progress nova',
    'tasks prime', 'monday-tasks prime', 'monday-milestones prime', 'monday-progress prime',
    'photo',
  ]);
  assert.deepEqual(seedMainRows({ order: ownersOrder }, []).map(row => row.panel), ['photo', 'events'], 'no team has only the panels that are the same for both');
});

test('seconds carry over, a row with none has none, a row that is off is not carried and a Monday card in the old order is not either', () => {
  const order = [
    { panel: 'tasks', show: true, seconds: 25 },
    { panel: 'events', show: true },
    { panel: 'photo', show: false, seconds: 30 },
    { panel: 'monday-tasks', show: true, seconds: 40 },
    { panel: 'leadership', show: true, seconds: 15 },
    { panel: 'forecast', show: true, seconds: 9 },
    { panel: 'next-event', show: false },
    { panel: 'sponsor-logo', show: true },
  ];

  const seeded = seedMainRows({ order: order }, [prime]);
  assert.deepEqual(rowsOf(seeded), ['tasks prime 25s', 'leadership prime 15s', 'monday-tasks prime', 'monday-milestones prime', 'monday-progress prime', 'events']);
  assert.deepEqual(rowsOf(seedSideRows({ order: order })), ['forecast 9s', 'sponsor-logo']);
  assert.deepEqual(seeded[0], { panel: 'tasks', team: 'prime', seconds: 25 });
  assert.equal('seconds' in seeded[seeded.length - 1], false, 'Events has none');
  assert.equal('team' in seedSideRows({ order: order })[0], false, 'a small row never has a team');
  [0, -5, '12', null].forEach(seconds => assert.equal('seconds' in seedMainRows({ order: [{ panel: 'photo', show: true, seconds: seconds }] }, [])[0], false, String(seconds)));
});

test('an empty Panel order is built from the two older lists, the large panels and then the small ones, as the screen always did', () => {
  const lists = {
    order: [],
    grid1: [{ panel: 'events', show: true }, { panel: 'tasks', show: true, seconds: 22 }],
    grid2: [{ panel: 'safety-days', show: true }, { panel: 'task-counts', show: true }],
  };

  assert.deepEqual(rowsOf(seedMainRows(lists, [prime])), ['tasks prime 22s', 'monday-tasks prime', 'monday-milestones prime', 'monday-progress prime', 'events']);
  assert.deepEqual(rowsOf(seedSideRows(lists)), ['safety-days', 'task-counts']);
  assert.deepEqual(seedMainRows({}, [prime]).map(row => row.panel), ['monday-tasks', 'monday-milestones', 'monday-progress'], 'no order and no lists is only the Monday rows');
  assert.deepEqual(seedSideRows({}), []);
  assert.deepEqual(seedSideRows(undefined), []);
});

test('the rows of the large panel are all large panels, the rows of the small panel all small, and the rows are copies of the order', () => {
  const order = registry.panels.filter(panel => (panel.region === 'grid1' || panel.region === 'grid2') && !panel.testOnly && !panel.monday && !panel.lastResort).map(panel => ({ panel: panel.id, show: true }));
  const regionOf = id => registry.panels.find(panel => panel.id === id).region;
  const frozen = JSON.stringify(order);

  seedMainRows({ order: order }, [prime, nova]).forEach(row => assert.equal(regionOf(row.panel), 'grid1', row.panel));
  seedSideRows({ order: order }).forEach(row => assert.equal(regionOf(row.panel), 'grid2', row.panel));
  assert.equal(JSON.stringify(order), frozen, 'the order that was given is not changed');
});

// The panels with a team are the ones whose items have the Team field: the query of core/sanity.js sends the code of the team with
// the items of these lists, and with no others. A panel draws the items of one list (the Daily Agenda panel also lists the
// booked talks, which have a team too).
test('a panel has a team when the list of items it draws has the Team field, and that is the list in config.js', () => {
  const query = read('core/sanity.js');
  const lists = {};
  query.split(/\n  "(?=[A-Za-z]+": \*\[_type == )/).slice(1).forEach(block => {
    lists[block.slice(0, block.indexOf('"'))] = block.includes('"team": team->code');
  });
  assert.deepEqual(Object.keys(lists).filter(name => lists[name]).sort(), ['customPanels', 'people', 'plans', 'presentations', 'sponsors', 'subteams', 'tasks', 'tipsAndNews']);

  const drawn = { tasks: 'tasks', tonight: 'plans', spotlight: 'subteams', 'team-leads': 'subteams', roster: 'subteams', leadership: 'people', 'sponsor-feature': 'sponsors', custom: 'customPanels', photo: 'photos', events: null };
  const followTeam = Object.keys(drawn).filter(panel => drawn[panel] && lists[drawn[panel]]).sort();
  assert.deepEqual(config.teamPanels.slice().sort(), followTeam);
  assert.deepEqual(config.teamPanels, ['tasks', 'tonight', 'spotlight', 'team-leads', 'roster', 'leadership', 'sponsor-feature', 'custom']);
  assert.deepEqual(config.mondayRows, ['monday-tasks', 'monday-milestones', 'monday-progress']);
  config.teamPanels.forEach(id => assert.equal(registry.panels.find(panel => panel.id === id).region, 'grid1', id + ' is a large panel'));
});


// Run them

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
process.exit(failures === 0 ? 0 : 1);
