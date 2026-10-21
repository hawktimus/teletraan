// Tests for the Rotation board (docs/rotation-board.md): the blocks and their totals, the loop time, which columns and details a
// row has for each kind of panel, the changes that keep keys and values, what is written, and the phone rules. Nothing is drawn
// in a browser: the page is drawn with a stand-in for React and read back.
//
//   node tests/rotation-board.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, finish } from './helpers/runner.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-rotation-board-'));
process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));

fs.cpSync(path.join(root, 'studio', 'tools'), path.join(work, 'tools'), { recursive: true });
fs.mkdirSync(path.join(work, 'inputs'));
['screen-panels.js', 'rotation-board-parts.js', 'rotation-board-view.js', 'rotation-auto-parts.js'].forEach(file => fs.copyFileSync(path.join(root, 'studio', 'inputs', file), path.join(work, 'inputs', file)));
fs.writeFileSync(path.join(work, 'package.json'), '{ "type": "module" }\n');
const stub = (name, files) => {
  fs.mkdirSync(path.join(work, 'node_modules', name), { recursive: true });
  Object.keys(files).forEach(file => fs.writeFileSync(path.join(work, 'node_modules', name, file), files[file]));
};
stub('react', {
  'package.json': JSON.stringify({ name: 'react', type: 'module', exports: { '.': './index.js' } }),
  'index.js': 'export const createElement = (type, props, ...children) => ({ type, props: props || {}, children });\nexport const useState = v => [v, () => {}];\nexport const useRef = v => ({ current: v });\nexport const useEffect = () => {};',
});
stub('sanity', {
  'package.json': JSON.stringify({ name: 'sanity', type: 'module', exports: { '.': './index.js', './router': './router.js' } }),
  'index.js': 'export const useClient = () => ({});',
  'router.js': "export const Link = 'a';",
});

const load = file => import(pathToFileURL(path.join(work, file)).href);
const board = await load('tools/rotation-board.js');
const titles = await load('tools/rotation-titles.js');
const parts = await load('inputs/rotation-board-parts.js');
const view = await load('inputs/rotation-board-view.js');
const defaults = await load('tools/default-rotation.js');
const dashboardRotation = await import(pathToFileURL(path.join(root, 'dashboard', 'config-rotation.js')).href);

const row = (view, panel, extra) => Object.assign({ _key: view + panel + Math.random().toString(16).slice(2, 8), view: view, panel: panel, shown: true }, extra || {});
const sample = () => board.withKeys([
  row('robotics', 'leadership', { seconds: 20, side: 'sponsor-logo', secret: 'kept' }),
  row('robotics', 'events', { part: 1, seconds: 30, side: 'task-counts' }),
  row('prime', 'monday-department', { department: 'build', list: 'open', seconds: 30 }),
  row('prime', 'roster', { department: 'build', part: 1 }),
  row('nova', 'photo', { photoCount: 4, secondsPerPhoto: 10, seconds: 40, shown: false }),
  row('robotics', 'tonight', { seconds: 45 }),
]);

function walk(node, found = []) {
  if (typeof node === 'string' || typeof node === 'number') found.push(String(node));
  if (!node || typeof node !== 'object') return found;
  found.push(node);
  (Array.isArray(node) ? node : node.children || []).forEach(child => walk(child, found));
  return found;
}
const nodesWhere = (node, check) => walk(node).filter(item => typeof item === 'object' && item.props !== undefined && check(item));
const textOf = node => walk(node).filter(item => typeof item === 'string').join('');

const state = (rows, extra) => Object.assign({
  read: true, rows: rows, settings: { pageSeconds: 20, partsLink: false }, busy: false, text: '', failed: false, open: '', collapsed: {}, selected: {}, history: [], newView: 'robotics', newPanel: 'tasks', dragging: -1,
}, extra || {});

const noActions = new Proxy({}, { get: () => () => {} });

test('rows of one view that follow each other are one block, with the count and the seconds of the rows that are shown', () => {
  const blocks = board.blocksOf(sample());
  assert.deepEqual(blocks.map(block => block.view + ':' + block.count + ':' + block.shown + ':' + block.seconds), ['robotics:2:2:50', 'prime:2:2:50', 'nova:1:0:0', 'robotics:1:1:45']);
  assert.equal(blocks[1].seconds, 30 + 20, 'a row with no seconds follows pageSeconds');
  assert.equal(board.blocksOf(sample(), 10)[1].seconds, 40);
  const standard = board.blocksOf(board.standardRows());
  assert.equal(standard[0].view, 'robotics');
  assert.equal(standard[0].count, 19, 'six pairs, nine departments, three charts and the Business and Marketing roster');
  assert.equal(standard.reduce((all, block) => all + block.count, 0), defaults.defaultRotationRows().length);
});

test('the loop time counts only rows that are shown and is said in plain words', () => {
  assert.equal(board.loopSeconds(sample()), 20 + 30 + 30 + 20 + 45);
  assert.equal(board.loopSeconds(board.setShown(sample(), [sample()[0]._key], false)), board.loopSeconds(sample()), 'keys of another list change nothing');
  assert.equal(board.durationWords(580), '9 minutes 40 seconds');
  assert.equal(board.durationWords(60), '1 minute');
  assert.equal(board.durationWords(61), '1 minute 1 second');
  assert.equal(board.durationWords(0), '0 seconds');
  assert.equal(board.loopWords([row('prime', 'events', { seconds: 580 })]), 'A full loop takes 9 minutes 40 seconds.');
  const hidden = [row('prime', 'events', { seconds: 100, shown: false }), row('prime', 'tasks', { seconds: 30 })];
  assert.equal(board.loopSeconds(hidden), 30);
  assert.match(board.loopWords([row('prime', 'events', { shown: false })]), /standard order/);
  assert.equal(board.secondsOf(row('robotics', 'photo', { photoCount: 3, secondsPerPhoto: 7, seconds: 99 })), 21, 'a Photos row stays photos times seconds each');
});

test('the preview strip has a tile for each row, greys the hidden ones and marks a view change only between rows that play', () => {
  const items = board.stripOf(sample());
  assert.deepEqual(items.filter(item => item.type === 'tile').map(item => item.title), ['Leadership', 'Upcoming events', 'Monday: Department tasks', 'Subteam roster', 'Photo', 'Daily Agenda']);
  assert.equal(items.filter(item => item.type === 'tile' && !item.shown).length, 1);
  const changes = items.filter(item => item.type === 'change').map(item => item.from + '>' + item.to);
  assert.deepEqual(changes, ['robotics>prime', 'prime>robotics'], 'the hidden Nova row starts no view change');
  const strip = parts.stripOfPage(state(sample()));
  assert.equal(nodesWhere(strip, node => node.props.className === 'rb-change').length, 2);
  assert.equal(nodesWhere(strip, node => /rb-off/.test(node.props.className || '')).length, 1);
  assert.match(textOf(strip), /view change/);
  assert.match(textOf(strip), /A full loop takes 2 minutes 25 seconds\./);
});

test('the small panel column is for a Robotics row that is split, and the wide list is the one of the dashboard', () => {
  assert.deepEqual(board.wideRoboticsPanels, dashboardRotation.roboticsWidePanels);
  assert.equal(board.hasSmallPanel(row('robotics', 'events')), true);
  assert.equal(board.hasSmallPanel(row('robotics', 'monday-department')), false, 'a wide Robotics row has none');
  assert.equal(board.hasSmallPanel(row('prime', 'events')), false, 'a team view row has none');
  const page = parts.tableOf(state(sample()), noActions);
  const cells = nodesWhere(page, node => node.props['data-cell'] === 'small');
  const filled = cells.filter(node => node.children.length > 0);
  assert.equal(cells.length, 6, 'every row keeps its place in the grid');
  assert.equal(filled.length, 3, 'only the three split Robotics rows draw the picker');
  const headings = nodesWhere(page, node => node.props.role === 'columnheader').map(textOf);
  assert.deepEqual(headings.filter(Boolean), ['#', 'View', 'Panel', 'Small panel', 'Seconds', 'Show on screen', 'Details']);
});

test('the details of a row depend on its panel', () => {
  const fields = panel => board.detailsFor(row('prime', panel)).map(item => item.field + ':' + item.kind).join();
  assert.equal(fields('photo'), 'photoCount:number,secondsPerPhoto:number');
  assert.equal(fields('monday-department'), 'department:choice,list:choice,team:choice');
  assert.equal(fields('monday-charts'), 'chart:choice,team:choice');
  assert.equal(fields('monday-board'), '', 'a retired panel has no details');
  assert.equal(fields('roster'), 'department:text,part:part');
  assert.equal(fields('driveHours'), 'department:text');
  assert.equal(fields('events'), 'part:part');
  assert.equal(fields('team-leads'), 'part:part');
  assert.equal(fields('tonight'), '');
  assert.equal(board.detailsFor(row('robotics', 'photo', { side: 'qrParts' })).map(item => item.kind).join(), 'number,number,link');
  assert.match(board.qrStatus(false), /not set/);
  assert.match(board.qrStatus(true), /is set/);
  board.detailsFor(row('robotics', 'photo', { side: 'qrParts' })).concat(board.detailsFor(row('prime', 'roster')), board.detailsFor(row('prime', 'monday-department')), board.detailsFor(row('prime', 'monday-charts'))).forEach(item => assert.ok(item.help.length > 10 && !/[–—]/.test(item.help), 'a one line help for ' + item.field));
  const editor = parts.editorOf(row('robotics', 'photo', { side: 'qrParts' }), 0, state([]), noActions);
  assert.equal(nodesWhere(editor, node => node.props['data-link'] === 'missing').length, 1);
  assert.equal(nodesWhere(parts.editorOf(row('robotics', 'photo', { side: 'qrParts' }), 0, state([], { settings: { pageSeconds: 20, partsLink: true } }), noActions), node => node.props['data-link'] === 'set').length, 1);
  assert.equal(board.detailsSummary(row('prime', 'roster', { department: 'build', part: 2 })), 'build, Page 2');
  assert.equal(board.detailsSummary(row('robotics', 'monday-department', { department: 'cnc', list: 'done', team: 'nova' })), 'CNC, Done, Nova');
  assert.equal(board.detailsSummary(row('robotics', 'monday-department', {})), 'No department, Open, Both');
  assert.equal(board.detailsSummary(row('robotics', 'monday-charts', {})), 'Status by department, Both');
  const choices = parts.editorOf(row('robotics', 'monday-department', { department: 'cnc' }), 0, state([]), noActions);
  const selects = nodesWhere(choices, node => node.type === 'select');
  assert.deepEqual(selects.map(node => node.props.id + '=' + node.props.value), ['rb-department=cnc', 'rb-list=open', 'rb-team=']);
  assert.deepEqual(nodesWhere(selects[1], node => node.type === 'option').map(textOf), ['Open', 'Done']);
  assert.deepEqual(nodesWhere(selects[2], node => node.type === 'option').map(textOf), ['Both', 'Prime', 'Nova']);
  assert.match(board.detailsSummary(row('robotics', 'photo', { photoCount: 4, secondsPerPhoto: 10 })), /4 photos, 10 s each/);
});

test('add, duplicate, delete and move keep the keys and the values the board does not show', () => {
  const rows = sample();
  const keys = rows.map(item => item._key);

  const moved = board.moveRow(rows, 0, 1);
  assert.deepEqual(moved.map(item => item._key), [keys[1], keys[0]].concat(keys.slice(2)));
  assert.equal(moved[1].secret, 'kept');
  assert.equal(board.moveRow(rows, 0, -1), rows);
  assert.equal(board.moveRow(rows, 5, 1), rows);
  assert.deepEqual(board.moveTo(rows, 0, 3).map(item => item._key), [keys[1], keys[2], keys[3], keys[0], keys[4], keys[5]]);
  assert.equal(board.moveTo(rows, 2, 2), rows);

  const copied = board.copyRow(rows, 0);
  assert.equal(copied.length, 7);
  assert.equal(copied[1].secret, 'kept');
  assert.notEqual(copied[1]._key, keys[0]);
  assert.equal(new Set(copied.map(item => item._key)).size, 7);

  const removed = board.removeRow(rows, 2);
  assert.deepEqual(removed.map(item => item._key), keys.filter((key, at) => at !== 2));
  assert.deepEqual(board.removeRows(rows, [keys[0], keys[5]]).map(item => item._key), keys.slice(1, 5));

  const added = board.addRow(rows, 'nova', 'photo');
  assert.equal(added.length, 7);
  assert.equal(added[6].view, 'nova');
  assert.equal(added[6].shown, true);
  assert.equal(added[6].seconds, 40, 'a new Photos row has its photo values');
  assert.equal(board.addRow(rows, 'prime', 'events')[6].seconds, undefined);

  const edited = board.setRowValue(rows, 0, 'seconds', 45);
  assert.equal(edited[0].seconds, 45);
  assert.equal(edited[0].secret, 'kept');
  assert.equal(rows[0].seconds, 20, 'the old rows are not changed');
  assert.equal('seconds' in board.setRowValue(rows, 0, 'seconds', '')[0], false);
  const photo = board.setPhotoValue(rows, 4, 'photoCount', 6);
  assert.equal(photo[4].photoCount, 6);
  assert.equal(photo[4].seconds, 60);
  assert.equal(photo[4].shown, false);

  const hidden = board.setShown(rows, [keys[0], keys[1]], false);
  assert.deepEqual(hidden.map(item => item.shown), [false, false, true, true, false, true]);
  assert.equal(hidden[0].secret, 'kept');
  assert.equal(board.secondsFrom('') === '' && board.secondsFrom('45') === 45 && board.secondsFrom('5') === null && board.secondsFrom('121') === null && board.secondsFrom('4.5') === null, true);
});

test('Fill from the standard order gives the owner list with keys, and the rows a page opens with come from the draft first', () => {
  const standard = board.standardRows();
  assert.equal(standard.length, defaults.defaultRotationRows().length);
  assert.ok(standard.every(item => item._key && item.view && item.panel));
  assert.equal(new Set(standard.map(item => item._key)).size, standard.length);
  const draft = { _id: 'drafts.dashboardSettings', rotationRows: [{ _key: 'd', view: 'prime', panel: 'events' }], pageSeconds: 30, partsRequestUrl: 'https://example.org/x' };
  const published = { _id: 'dashboardSettings', rotationRows: [{ _key: 'p', view: 'robotics', panel: 'tonight' }] };
  assert.equal(board.rowsFrom([published, draft])[0]._key, 'd');
  assert.equal(board.rowsFrom([published])[0]._key, 'p');
  assert.equal(board.rowsFrom([]), null);
  assert.deepEqual(board.settingsFrom([published, draft]), { pageSeconds: 30, partsLink: true });
  assert.deepEqual(board.settingsFrom([published]), { pageSeconds: 20, partsLink: false });
  assert.deepEqual(board.pushUndo([[1]], [2]), [[1], [2]]);
  assert.equal(board.pushUndo(Array.from({ length: 25 }, (item, at) => [at]), []).length, 20);
});

test('saving writes only rotationRows, to the draft, made from the published document when there is none', async () => {
  const rows = sample();
  const calls = [];
  const client = documents => ({
    getDocument: async id => documents[id] || null,
    createIfNotExists: async doc => { calls.push({ create: doc }); },
    patch: id => ({ set: fields => ({ commit: async () => { calls.push({ patch: id, set: fields }); return {}; } }) }),
  });
  await board.saveRows(client({ dashboardSettings: { _id: 'dashboardSettings', _rev: 'r', motion: 'calm' } }), rows);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].create._id, 'drafts.dashboardSettings');
  assert.equal(calls[0].create.motion, 'calm');
  assert.equal(calls[0].create._rev, undefined);
  assert.deepEqual(Object.keys(calls[1].set), ['rotationRows']);
  assert.equal(calls[1].patch, 'drafts.dashboardSettings');
  calls.length = 0;
  await board.saveRows(client({ 'drafts.dashboardSettings': { _id: 'drafts.dashboardSettings' } }), rows);
  assert.equal(calls.length, 1, 'with a draft there is only the patch');
  await assert.rejects(board.saveRows(client({}), rows), /has not been published/);
  const source = fs.readFileSync(path.join(root, 'studio', 'inputs', 'rotation-board-view.js'), 'utf8') + fs.readFileSync(path.join(root, 'studio', 'tools', 'rotation-board.js'), 'utf8');
  assert.equal((source.match(/\.publish\(|\.createOrReplace\(|\.delete\(/g) || []).length, 0, 'the board never publishes or deletes a document');
  assert.equal((source.match(/\.set\(\{/g) || []).length, 1, 'one set, of rotationRows');
});

test('the page has the owner sentence, a group for each block, a row for each row, and the actions are wired', () => {
  assert.equal(view.words.intro, 'The wall plays this list top to bottom. Drag a row to move it. Turn Show on screen off to skip a row. Seconds is how long it stays.');
  const rows = sample();
  const calls = [];
  const actions = new Proxy({}, { get: (target, name) => (...given) => calls.push(name + ':' + given.filter(item => typeof item !== 'object').join('/')) });
  const page = view.pageOf(state(rows, { open: rows[1]._key }), actions);
  assert.equal(nodesWhere(page, node => node.props['data-group'] !== undefined).length, 4);
  assert.equal(nodesWhere(page, node => node.props['data-row'] !== undefined).length, 6);
  assert.equal(nodesWhere(page, node => node.props['data-editor'] === rows[1]._key).length, 1, 'only the open row shows its details');
  const groupLine = nodesWhere(page, node => node.props['data-group'] === rows[2]._key)[0];
  assert.match(textOf(groupLine), /Prime/);
  assert.match(textOf(groupLine), /2 rows, 50 seconds/);
  assert.equal(groupLine.props.style['--rb-colour'], titles.viewEntry('prime').colour);
  assert.notEqual(titles.viewEntry('prime').colour, titles.viewEntry('nova').colour);
  const buttonNamed = name => nodesWhere(page, node => node.type === 'button' && node.props['aria-label'] === name);
  buttonNamed('Move down')[0].props.onClick();
  buttonNamed('Duplicate row')[1].props.onClick();
  buttonNamed('Delete row')[2].props.onClick();
  nodesWhere(page, node => node.props.role === 'switch')[0].props.onClick();
  const handle = nodesWhere(page, node => node.props.draggable === true);
  assert.equal(handle.length, 6, 'every row has a drag handle');
  handle[1].props.onDragStart({});
  nodesWhere(page, node => node.props['data-row'] === rows[3]._key)[0].props.onDrop({ preventDefault() {} });
  assert.deepEqual(calls, ['move:0/1', 'copy:1', 'remove:2', 'edit:0/shown/false', 'dragStart:1', 'drop:3']);
  assert.match(textOf(view.pageOf(state(rows, { selected: { [rows[0]._key]: true, [rows[1]._key]: true } }), noActions)), /2 rows selected/);
  assert.match(textOf(view.pageOf({ read: true, rows: null }, noActions)), /has not been published/);
  assert.match(textOf(view.pageOf(state([]), noActions)), /list is empty/);
  assert.match(textOf(view.pageOf({ read: false }, noActions)), /Reading/);
  const out = [];
  const withOut = view.pageOf(state(rows, { selected: { [rows[0]._key]: true } }), new Proxy({}, { get: (target, name) => () => out.push(name) }));
  nodesWhere(withOut, node => node.type === 'button' && /^(Show on screen|Hide|Delete selected|Undo|Add row|Fill from the standard order)$/.test(textOf(node))).forEach(node => node.props.onClick());
  assert.deepEqual(out, ['add', 'undo', 'fill', 'showSelected', 'showSelected', 'removeSelected']);
});

test('the Monday rows buttons show their counts, call only their actions and are left out when there is nothing to do', () => {
  const old = board.withKeys([{ view: 'prime', panel: 'monday-tasks', department: 'build' }, { view: 'robotics', panel: 'monday-done' }, { view: 'robotics', panel: 'tasks' }]);
  const labels = rows => nodesWhere(view.pageOf(state(rows), noActions), node => node.type === 'button').map(textOf);
  assert.ok(labels(old).includes('Remove retired Monday rows (2)'));
  assert.ok(labels(old).includes('Add the nine Department tasks rows (Robotics, Open)'));
  assert.ok(labels(old).includes('Add the three TV charts rows'));
  const out = [];
  const tree = view.pageOf(state(old), new Proxy({}, { get: (target, name) => () => out.push(name) }));
  nodesWhere(tree, node => node.type === 'button' && /^(Remove retired|Add the)/.test(textOf(node))).forEach(node => node.props.onClick());
  assert.deepEqual(out, ['removeRetired', 'addDepartments', 'addCharts']);
  const done = board.addChartRows(board.addDepartmentRows(board.withKeys([{ view: 'robotics', panel: 'tasks' }])));
  assert.ok(!labels(done).some(text => /^(Remove retired|Add the)/.test(text)));
});

test('every panel the rows use has a plain title from the one table, and the pickers are grouped', () => {
  defaults.defaultRotationRows().forEach(item => {
    assert.ok(titles.panelTitleOf(item.panel), 'a title for ' + item.panel);
    assert.ok(titles.panelChoices.some(choice => choice.value === item.panel) || titles.sideChoices.some(choice => choice.value === item.panel), item.panel + ' is in a picker');
    if (item.side) assert.ok(titles.sideChoices.some(choice => choice.value === item.side), item.side + ' is in the small panel picker');
  });
  assert.deepEqual(titles.viewTable.map(item => item.title), ['Robotics', 'Prime', 'Nova']);
  assert.ok(titles.panelGroups.length >= 3 && titles.panelGroups.every(group => group.title && group.panels.length > 0));
  assert.equal(new Set(titles.panelChoices.map(item => item.value)).size, titles.panelChoices.length, 'no panel twice');
});

test('the phone rules: cards under 600 pixels, 44 pixel targets, 16 pixel text and a 16 pixel gutter', () => {
  assert.match(parts.boardCss, /@media \(max-width: 600px\)/);
  const small = parts.boardCss.slice(parts.boardCss.indexOf('@media'));
  assert.match(small, /\.rb-line \{[^}]*flex-direction: column/, 'a row becomes a card');
  assert.match(small, /\.rb-head \{ display: none/, 'the header row goes');
  assert.match(small, /\.rb-handle \{ display: none/, 'dragging is not offered on a phone');
  assert.match(small, /\.rb-label \{ display: block/, 'each cell names itself in a card');
  assert.match(parts.boardCss, /overflow-wrap: anywhere/);
  assert.match(parts.styles.page.padding, /^24px 16px$/);
  [parts.styles.button, parts.styles.plain, parts.styles.select, parts.styles.number, parts.styles.textBox].forEach(style => {
    assert.ok(style.minHeight >= 44);
    assert.ok(style.fontSize >= 16);
  });
  assert.match(parts.boardCss, /\.rb-switch \{[^}]*min-height: 44px/);
  const page = view.pageOf(state(sample(), { open: sample()[0]._key }), noActions);
  const buttons = nodesWhere(page, node => node.type === 'button' && node.props.className !== 'rb-switch');
  assert.ok(buttons.length > 0 && buttons.every(node => node.props.style.minHeight >= 44));
  const boxes = nodesWhere(page, node => ['select', 'input'].includes(node.type) && !['checkbox'].includes(node.props.type));
  assert.ok(boxes.length > 0 && boxes.every(node => node.props.style.minHeight >= 44 && node.props.style.fontSize >= 16));
  assert.ok(nodesWhere(page, node => node.type === 'input' && node.props.type === 'checkbox').every(node => node.props.style.width >= 24 && node.props.style.margin >= 10), 'a checkbox has a 44 pixel target');
  assert.equal((fs.readFileSync(path.join(root, 'studio', 'inputs', 'rotation-board-parts.js'), 'utf8').match(/\bwidth: [3-9]\d\d\b/g) || []).length, 0, 'nothing is fixed wider than a phone');
});

test('the words are plain', () => {
  Object.values(parts.words).forEach(text => {
    assert.ok(!/[–—!]/.test(text), text);
    assert.ok(!/\b(simply|just|basically|really|very|actually|easily)\b/i.test(text), text);
  });
});

await finish();
