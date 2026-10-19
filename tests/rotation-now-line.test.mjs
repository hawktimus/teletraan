// Tests for the line "What the wall plays now" at the top of the Rotation board (docs/rotation-board.md). It uses the rows and
// the published tasks and photos the board has read, and nothing from the Mini.
//
//   node tests/rotation-now-line.test.mjs

import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { nodesWhere, rotationWorld, textOf } from './helpers/rotation-world.mjs';

const world = await rotationWorld();
const { parts, view } = world;
const find = await import(pathToFileURL(world.workFile('tools/rotation-find.js')).href);

const row = (key, extra) => Object.assign({ _key: key, view: 'robotics', panel: 'events', shown: true }, extra || {});
const rows = [row('a'), row('b'), row('c'), row('d', { shown: false }), row('e', { panel: 'photo' })];
const skips = { b: 'Skipped now: nothing', e: 'Skipped now: no photos' };

test('the line counts rows shown, rows skipped for want of data and rows switched off', () => {
  assert.equal(find.playsNowWords(rows, skips, true), 'Right now the loop has 2 rows shown, 2 skipped (no data), 1 switched off. The cards the wall adds by itself are not counted.');
  assert.equal(find.playsNowWords([row('a')], {}, true), 'Right now the loop has 1 row shown, 0 skipped (no data). The cards the wall adds by itself are not counted.');
  assert.equal(find.playsNowWords([row('a', { shown: false }), row('b')], { a: 'ignored while the row is off' }, true), 'Right now the loop has 1 row shown, 0 skipped (no data), 1 switched off. The cards the wall adds by itself are not counted.');
});

test('before the tasks and photos are read it does not claim a count of skipped rows', () => {
  const text = find.playsNowWords(rows, {}, false);
  assert.equal(text, 'Right now the loop has 4 rows switched on, 1 switched off. Which of them have no data to show could not be read yet.');
  assert.ok(!/skipped/.test(text));
});

test('the page draws the line first, under the intro, only when there are rows', () => {
  const state = { read: true, rows: rows, settings: { pageSeconds: 20, partsLink: false }, busy: false, text: '', failed: false, open: '', collapsed: {}, selected: {}, history: [], newView: 'robotics', newPanel: 'tasks', dragging: -1, skips: skips, data: { tasks: [], photos: [] } };
  const page = view.pageOf(state, new Proxy({}, { get: () => () => {} }));
  const line = nodesWhere(page, node => node.props['data-block'] === 'plays-now');
  assert.equal(line.length, 1);
  assert.match(textOf(line[0]), /^What the wall plays now\. Right now the loop has 2 rows shown, 2 skipped \(no data\), 1 switched off\./);
  const empty = view.pageOf(Object.assign({}, state, { rows: [] }), new Proxy({}, { get: () => () => {} }));
  assert.equal(nodesWhere(empty, node => node.props['data-block'] === 'plays-now').length, 0);
  assert.ok(!/[—–!]/.test(textOf(line[0])));
});

await finish();
