// Tests for the order of the panels (dashboard/core/panel-order.js): the one list in
// Dashboard Settings, the list built from the two older lists while it is empty, and the
// rows each area of the screen follows. The reader that cleans the rows (core/sanity.js)
// is run too. Nothing is drawn and nothing touches the network.
//
//   node tools/test-panel-order.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-panel-order-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard/themes/overlays'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});
const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const registry = await import(base + 'registry.js');
const order = await import(base + 'core/panel-order.js');
const { normalizeContent } = await import(base + 'core/sanity.js');
const { withDefaults } = await import(base + 'core/content.js');

const { orderFromLists, panelOrder, playlistOf } = order;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const idsOf = rows => rows.map(row => row.panel);
const registered = area => registry.panels.filter(panel => panel.region === area && !panel.testOnly && !panel.competition && !panel.monday).map(panel => panel.id);

// Settings as the Studio stores them for a page that was never given Panel order

const oldLists = {
  grid1: [{ panel: 'events', show: false, seconds: 30 }, { panel: 'tasks', show: true }, { panel: 'events', show: true }],
  grid2: [{ panel: 'forecast', show: true, seconds: 9 }, { panel: 'task-counts', show: false }],
};

// The older lists as one

test('the older lists become one list: the large panels, then the small panels, each row with its switch and its seconds', () => {
  assert.deepEqual(orderFromLists(oldLists), [
    { panel: 'events', show: false, seconds: 30 },
    { panel: 'tasks', show: true },
    { panel: 'events', show: true },
    { panel: 'forecast', show: true, seconds: 9 },
    { panel: 'task-counts', show: false },
  ]);
});

test('the default lists in config.js give every panel of the large and the small frame once, the large ones first', () => {
  const built = orderFromLists(config.defaultSettings.rotation);

  assert.deepEqual(idsOf(built), registered('grid1').concat(registered('grid2')));
  built.forEach(row => assert.equal(row.show, true, row.panel));
  built.forEach(row => assert.equal('seconds' in row, false, row.panel + ' follows Seconds per page'));
});

test('the rows are copies, so changing the list does not change the older lists', () => {
  const built = orderFromLists(oldLists);
  built[0].show = true;
  built[0].seconds = 99;

  assert.deepEqual(oldLists.grid1[0], { panel: 'events', show: false, seconds: 30 });
});

test('a panel in the wrong list is left out, as the schedule always did, and so is a row with no panel', () => {
  const built = orderFromLists({
    grid1: [{ panel: 'tasks', show: true }, { panel: 'forecast', show: true }, { show: true }, null, { panel: 'no-such-panel', show: true }, { panel: 'stand-in-tile', show: true }],
    grid2: [{ panel: 'events', show: true }, { panel: 'safety-days', show: true }, { panel: '' }, 'task-counts'],
  });

  assert.deepEqual(idsOf(built), ['tasks', 'safety-days']);
});

test('lists that are missing, or are not lists, give an empty list', () => {
  [undefined, null, {}, { grid1: undefined, grid2: null }, { grid1: 'tasks', grid2: { panel: 'forecast' } }, 'text', 5, []].forEach(rotation => {
    assert.deepEqual(orderFromLists(rotation), [], JSON.stringify(rotation));
  });
});

// The list the screen follows

test('an empty order is built from the older lists, and a list with rows is used as it is', () => {
  const built = orderFromLists(oldLists);

  [undefined, [], null, 'tasks', {}].forEach(empty => {
    assert.deepEqual(panelOrder(Object.assign({}, oldLists, { order: empty })), built, JSON.stringify(empty));
  });
  assert.deepEqual(panelOrder(oldLists), built, 'a page with no order at all');
  assert.deepEqual(panelOrder(undefined), []);

  const own = [{ panel: 'photo', show: true }, { panel: 'tasks', show: false, seconds: 12 }];
  assert.equal(panelOrder(Object.assign({}, oldLists, { order: own })), own);
  assert.equal(panelOrder({ order: own }), own, 'the older lists are not needed');
});

test('each area follows its own rows of the list, in the order they have there', () => {
  const rotation = {
    order: [
      { panel: 'forecast', show: true },
      { panel: 'photo', show: true, seconds: 20 },
      { panel: 'task-counts', show: false },
      { panel: 'tasks', show: true },
      { panel: 'photo', show: true },
      { panel: 'sponsor-logo', show: true },
    ],
    grid1: oldLists.grid1,
    grid2: oldLists.grid2,
  };

  assert.deepEqual(playlistOf(rotation, 'grid1'), [{ panel: 'photo', show: true, seconds: 20 }, { panel: 'tasks', show: true }, { panel: 'photo', show: true }]);
  assert.deepEqual(playlistOf(rotation, 'grid2'), [{ panel: 'forecast', show: true }, { panel: 'task-counts', show: false }, { panel: 'sponsor-logo', show: true }]);
});

test('a list with only large panels leaves the small frame nothing, and a panel the registry does not have is skipped', () => {
  const rotation = { order: [{ panel: 'tasks', show: true }, { panel: 'no-such-panel', show: true }, null, { show: true }, { panel: 'events', show: true }] };

  assert.deepEqual(idsOf(playlistOf(rotation, 'grid1')), ['tasks', 'events']);
  assert.deepEqual(playlistOf(rotation, 'grid2'), []);
  assert.deepEqual(playlistOf(rotation, 'ticker'), []);
});

test('with no order, each area follows the same rows its older list had', () => {
  const rotation = config.defaultSettings.rotation;

  assert.deepEqual(playlistOf(rotation, 'grid1'), rotation.grid1);
  assert.deepEqual(playlistOf(rotation, 'grid2'), rotation.grid2);
  assert.deepEqual(playlistOf(oldLists, 'grid1'), oldLists.grid1);
  assert.deepEqual(playlistOf(oldLists, 'grid2'), oldLists.grid2);
});

test('a row switched off stays in the playlist, because the schedule is the one that skips it', () => {
  const rotation = { order: [{ panel: 'tasks', show: false }, { panel: 'events', show: true }] };

  assert.deepEqual(playlistOf(rotation, 'grid1'), rotation.order);
});

// Through the reader

test('the reader cleans the rows of the order like the rows of the older lists', () => {
  const rotation = normalizeContent({
    settings: {
      rotation: {
        order: [
          { _key: 'a', panel: 'events', show: false, seconds: 30 },
          { _key: 'b', panel: 'tasks' },
          { _key: 'c', show: true, seconds: 9 },
          { _key: 'd', panel: 'forecast', seconds: 0 },
          { _key: 'e', panel: 'photo', seconds: 'ten' },
        ],
        grid1: [{ _key: 'x', panel: 'tasks', show: true }],
        grid2: [],
      },
    },
  }).settings.rotation;

  assert.deepEqual(rotation.order, [
    { panel: 'events', show: false, seconds: 30 },
    { panel: 'tasks', show: true },
    { panel: 'forecast', show: true },
    { panel: 'photo', show: true },
  ]);
  assert.deepEqual(rotation.grid1, [{ panel: 'tasks', show: true }]);
  assert.deepEqual(rotation.grid2, []);
});

test('an order that is not a list is dropped, and a page with no order gets none, so the older lists decide', () => {
  ['tasks', 5, { panel: 'tasks' }, null, true].forEach(value => {
    const rotation = normalizeContent({ settings: { rotation: { order: value, grid1: [{ panel: 'photo', show: true }] } } }).settings.rotation;

    assert.equal('order' in rotation, false, JSON.stringify(value));
    assert.deepEqual(idsOf(playlistOf(rotation, 'grid1')), ['photo'], JSON.stringify(value));
  });

  const plain = normalizeContent({ settings: { rotation: { grid1: [{ panel: 'photo', show: true }], grid2: [] } } }).settings.rotation;
  assert.equal('order' in plain, false);
});

test('an order that the editors emptied brings the older lists back', () => {
  const rotation = normalizeContent({ settings: { rotation: { order: [], grid1: [{ panel: 'photo', show: true }], grid2: [{ panel: 'forecast', show: true }] } } }).settings.rotation;

  assert.deepEqual(rotation.order, []);
  assert.deepEqual(idsOf(playlistOf(rotation, 'grid1')), ['photo']);
  assert.deepEqual(idsOf(playlistOf(rotation, 'grid2')), ['forecast']);
});

test('a page with no settings at all follows the default lists, and one with an order follows the order', () => {
  const none = withDefaults({}).settings.rotation;
  assert.deepEqual(idsOf(playlistOf(none, 'grid1')), registered('grid1'));
  assert.deepEqual(idsOf(playlistOf(none, 'grid2')), registered('grid2'));

  const own = [{ panel: 'roster', show: true }, { panel: 'safety-days', show: true }];
  const set = withDefaults({ settings: { rotation: { order: own } } }).settings.rotation;
  assert.deepEqual(idsOf(playlistOf(set, 'grid1')), ['roster']);
  assert.deepEqual(idsOf(playlistOf(set, 'grid2')), ['safety-days']);
});

test('the screen asks for its playlists through playlistOf and does not read the older lists itself', () => {
  const shell = read('shell.js');

  assert.ok(shell.includes("import { playlistOf, withPages } from './core/panel-order.js';"));
  assert.ok(shell.includes("playlistOf(rotation(), 'grid1')") && shell.includes("playlistOf(rotation(), 'grid2')"));
  assert.ok(!/rotation\(\)\.grid[12]/.test(shell), 'shell.js should not read rotation().grid1 or rotation().grid2');
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
if (failures > 0) process.exitCode = 1;
