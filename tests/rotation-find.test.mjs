// Tests for finding rows on the Rotation board (docs/rotation-board.md): the skipped-now filter, the placeholder badge, the
// search over panel titles, the Jump to links, and the line "Right now the loop has".
//
//   node tests/rotation-find.test.mjs

import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { nodesWhere, root, rotationWorld, textOf } from './helpers/rotation-world.mjs';

const world = await rotationWorld();
const { board, parts } = world;
const registry = await import(pathToFileURL(path.join(root, 'dashboard', 'registry.js')).href);
// the copy in the work folder, so that it shares the modules the board loaded
const findInWork = await import(pathToFileURL(world.workFile('tools/rotation-find.js')).href);

const row = (view, panel, extra) => Object.assign({ _key: view + panel, view: view, panel: panel, shown: true }, extra || {});
const rows = () => [
  row('robotics', 'leadership'),
  row('robotics', 'robotStatus'),
  row('robotics', 'events', { side: 'miniIdea1' }),
  row('prime', 'monday-tasks', { department: 'build' }),
  row('prime', 'photo', { shown: false }),
  row('nova', 'monday-board'),
  row('robotics', 'wireframe'),
];
const skips = { 'novamonday-board': 'Skipped now: no Monday tasks for the Nova team.' };
const state = (extra) => Object.assign({
  read: true, rows: rows(), settings: { pageSeconds: 20, partsLink: false }, busy: false, text: '', failed: false, open: '', collapsed: {}, selected: {}, history: [], newView: 'robotics', newPanel: 'tasks', dragging: -1,
  skips: skips, data: { tasks: [], photos: [] }, search: '', onlySkipped: false, onlyPlaceholders: false,
}, extra || {});
const noActions = new Proxy({}, { get: () => () => {} });
const keysOf = blocks => blocks.reduce((all, block) => all.concat(block.rows.map(item => item.row._key)), []);

test('the placeholder ids are the registry placeholders, and a row names them in a badge', () => {
  assert.deepEqual(world.titles.placeholderIds.slice().sort(), registry.panels.filter(panel => panel.placeholder).map(panel => panel.id).sort());
  assert.equal(findInWork.placeholderBadge(row('robotics', 'robotStatus')), 'Placeholder: draws only a title');
  assert.equal(findInWork.placeholderBadge(row('robotics', 'wireframe')), 'Placeholder: draws only a title');
  assert.match(findInWork.placeholderBadge(row('robotics', 'events', { side: 'miniIdea1' })), /Mini panel idea 1 is a placeholder: draws only a title/);
  assert.equal(findInWork.placeholderBadge(row('robotics', 'events')), '');
  assert.equal(findInWork.isPlaceholder(row('robotics', 'events')), false);
});

test('Skipped now is a row that is switched off or has a note', () => {
  const blocks = board.blocksOf(rows());
  const shown = keysOf(findInWork.filterBlocks(blocks, { onlySkipped: true }, { 'novamonday-board': 'note' }));
  assert.deepEqual(shown, ['primephoto', 'novamonday-board']);
});

test('the filters and the search narrow the blocks, keep the index of each row and drop empty blocks', () => {
  const blocks = board.blocksOf(rows());
  assert.equal(findInWork.filterBlocks(blocks, {}, {}), blocks, 'no filter changes nothing');
  const placeholders = findInWork.filterBlocks(blocks, { onlyPlaceholders: true }, {});
  assert.deepEqual(keysOf(placeholders), ['roboticsrobotStatus', 'roboticsevents', 'roboticswireframe']);
  assert.deepEqual(placeholders.map(block => block.view), ['robotics', 'robotics'], 'the Prime and Nova blocks are dropped');
  assert.equal(placeholders[0].count, 3, 'the counts stay those of the whole block');
  assert.deepEqual(findInWork.filterBlocks(blocks, { search: 'robot status' }, {})[0].rows.map(item => item.index), [1]);
  assert.deepEqual(keysOf(findInWork.filterBlocks(blocks, { search: 'ROSTER' }, {})), []);
  assert.deepEqual(keysOf(findInWork.filterBlocks(blocks, { search: 'monday build' }, {})), ['primemonday-tasks']);
  assert.deepEqual(keysOf(findInWork.filterBlocks(blocks, { search: 'photo', onlySkipped: true }, {})), ['primephoto']);
  assert.match(findInWork.findingWords(0, 7), /No row matches/);
  assert.equal(findInWork.findingWords(1, 7), 'Showing 1 row of 7.');
});

test('the Jump to links name each block and the rows in it', () => {
  const links = findInWork.jumpLinks(board.blocksOf(rows()));
  assert.deepEqual(links.map(link => link.label), ['Robotics, rows 1 to 3', 'Prime, rows 4 to 5', 'Nova, row 6', 'Robotics, row 7']);
  assert.equal(findInWork.blockId('abc'), 'rb-block-abc');
});

test('the table draws the search box, both filters, a Jump to button for each block and a badge on each placeholder', () => {
  const page = parts.tableOf(state(), noActions);
  assert.equal(nodesWhere(page, node => node.props.type === 'search').length, 1);
  assert.match(textOf(page), /Show only rows that are skipped now/);
  assert.match(textOf(page), /Show only placeholders/);
  assert.equal(nodesWhere(page, node => node.props['data-find'] === 'jump')[0].children.length, 1 + 1, 'the label and the list of buttons');
  assert.equal(nodesWhere(page, node => node.type === 'button' && /^(Robotics|Prime|Nova), row/.test(textOf(node))).length, 4);
  assert.equal(nodesWhere(page, node => node.props['data-placeholder'] !== undefined).length, 3);
  assert.equal(nodesWhere(page, node => String(node.props.id || '').indexOf('rb-block-') === 0).length, 4, 'a line to jump to for each block');
  assert.equal(nodesWhere(page, node => node.props['data-finding'] === 'count').length, 0);
});

test('with a filter on the table keeps only the rows that pass and says how many', () => {
  const page = parts.tableOf(state({ onlyPlaceholders: true }), noActions);
  assert.equal(nodesWhere(page, node => node.props['data-row'] !== undefined).length, 3);
  assert.match(textOf(nodesWhere(page, node => node.props['data-finding'] === 'count')[0]), /Showing 3 rows of 7\./);
  const none = parts.tableOf(state({ search: 'zzz' }), noActions);
  assert.equal(nodesWhere(none, node => node.props['data-row'] !== undefined).length, 0);
  assert.match(textOf(none), /No row matches/);
});

test('the controls are 44 pixels tall and the words are plain', () => {
  const page = textOf(parts.tableOf(state(), noActions));
  assert.ok(!/[—–!]/.test(page));
  assert.ok(!/\b(simply|just|basically|really|very|actually|easily)\b/i.test(page));
  const parts_ = nodesWhere(parts.tableOf(state(), noActions), node => node.props.type === 'search')[0];
  assert.ok(parts_.props.style.minHeight >= 44);
});

await finish();
