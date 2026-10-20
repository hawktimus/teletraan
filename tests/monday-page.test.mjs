// Tests for the Monday page of the Studio (studio/inputs/monday-page-parts.js and monday-page.js): one read only page with a
// line about the last read and a table for each of the nine departments, with the five columns of the Department tasks
// panel, the open and done counts and a link to the Rotation board. The parts are plain functions, so nothing is installed
// and nothing touches the network. The panel and the page are compared in tests/monday-panels.test.mjs.
//
//   node tests/monday-page.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const studio = path.join(root, 'studio');
const parts = await import(pathToFileURL(path.join(studio, 'inputs', 'monday-page-parts.js')).href);
const viewSource = fs.readFileSync(path.join(studio, 'inputs', 'monday-page.js'), 'utf8');
const partsSource = fs.readFileSync(path.join(studio, 'inputs', 'monday-page-parts.js'), 'utf8');
const structureSource = fs.readFileSync(path.join(studio, 'structure.js'), 'utf8');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const now = new Date('2026-10-17T15:00:00.000Z');
const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();
const task = fields => Object.assign({ source: 'monday', title: '[Task]', department: 'build', list: 'open', status: 'up-next', contact: 'Robin', priority: 'medium', dueDate: '2026-10-30', showOnBoard: true }, fields);

test('the line about the last read says when, and that it worked or the problem in plain words', () => {
  assert.deepEqual(parts.lastReadLine({ lastSyncAt: ago(11), lastError: '' }, now), { ok: true, text: 'Last read 11 minutes ago. It worked.' });
  assert.deepEqual(parts.lastReadLine({ lastSyncAt: ago(11), lastError: 'Monday refused the token; paste a new MONDAY_API_TOKEN in Settings, Keys on the control page' }, now),
    { ok: false, text: 'Last read 11 minutes ago. The last try did not work: Monday refused the token; paste a new MONDAY_API_TOKEN in Settings, Keys on the control page.' });
  assert.deepEqual(parts.lastReadLine(null, now), { ok: false, text: parts.words.neverRead });
  assert.equal(parts.lastReadLine({ lastError: 'Daily read limit reached. Reads start again at midnight.' }, now).text, 'The last read did not work: Daily read limit reached. Reads start again at midnight.');
});

const teams = [{ code: 'prime', name: 'Hawktimus Prime', shortName: 'Prime' }, { code: 'nova', name: 'Hawktimus Nova', shortName: 'Nova' }];
const content = tasks => parts.contentOf({ tasks: tasks, teams: teams });

test('a table for each of the nine departments, in the order of the panels, with its to do and done counts', () => {
  const tables = parts.departmentTables(content([task({}), task({ department: 'cnc', list: 'done', status: 'done' }), task({ department: 'cnc', showOnBoard: false })]), '', now);
  assert.deepEqual(tables.map(table => table.title), ['Build', 'Electrical', 'Programming', 'Design', 'CNC', 'Strategy', 'Operations', 'Business', 'Marketing']);
  const cnc = tables.find(table => table.value === 'cnc');
  assert.deepEqual([cnc.open, cnc.done, cnc.empty], [0, 1, false]);
  assert.equal(parts.countLine(cnc), '0 to do, 1 done');
  assert.equal(parts.countLine(tables[0]), '1 to do, 0 done');
  assert.deepEqual([tables[1].empty, tables[1].openRows.length, tables[1].doneRows.length], [true, 0, 0], 'an empty department is listed, and empty');
  assert.equal(parts.hiddenCount(content([task({}), task({ showOnBoard: false })]), now), 1);
});

test('a team shows its own tasks and the tasks with no team, and Both shows every task', () => {
  const list = content([task({ title: '[prime]', team: 'prime' }), task({ title: '[nova]', team: 'nova' }), task({ title: '[general]' })]);
  const names = team => parts.departmentTables(list, team, now)[0].openRows.map(row => row.project).sort();
  assert.deepEqual(names('prime'), ['[general]', '[prime]']);
  assert.deepEqual(names('nova'), ['[general]', '[nova]']);
  assert.deepEqual(names(''), ['[general]', '[nova]', '[prime]']);
  assert.equal(parts.generalCount(list, now), 1);
});

test('a row has the five columns of the TV, open rows in the order of the panel and done rows apart, with the words of an empty value', () => {
  const table = parts.departmentTables(content([
    task({ title: '[done]', list: 'done', status: 'done', completedOn: '2026-10-02' }),
    task({ title: '[todo]' }),
    task({ title: '[stuck]', status: 'blocked', contact: undefined, priority: undefined, dueDate: undefined, team: 'nova' }),
  ]), '', now)[0];
  assert.deepEqual(parts.words.columns, ['Status', 'Project', 'Contact', 'Priority', 'Estimated Completion Date']);
  const five = row => [row.statusWord, row.project, row.contact, row.priority, row.date];
  assert.deepEqual(table.openRows.map(five), [['STUCK', '[stuck]', 'Unassigned', 'No Priority', 'No Date'], ['TO DO', '[todo]', 'Robin', 'Medium', 'Oct 30']]);
  assert.deepEqual(table.doneRows.map(five), [['DONE', '[done]', 'Robin', 'Medium', 'Oct 30']]);
});

test('What the TV shows is the first page of a Department tasks row, from the dashboard code, and null when the TV leaves the row out', () => {
  const many = [];
  for (let at = 1; at <= 9; at++) many.push(task({ title: '[task ' + at + ']', dueDate: '2026-10-' + String(10 + at) }));
  const view = parts.tvPreview(content(many), now, { team: '', department: 'build', list: 'open' });
  assert.equal(view.title, 'BUILD TASKS');
  assert.equal(view.rows.length, 4);
  assert.equal(view.pages, 3);
  assert.equal(parts.tvPreview(content(many), now, { team: '', department: 'build', list: 'done' }), null);
  assert.equal(parts.tvPreview(content(many), now, { team: 'nova', department: 'electrical', list: 'open' }), null);
});

test('the page imports the rules of the TV and does not copy them', () => {
  assert.ok(/from '\.\.\/\.\.\/dashboard\/core\/monday-views\.js'/.test(partsSource));
  assert.ok(!/function sortTasks|function rowOf|function onTv|const openOrder/.test(partsSource), 'no copy of the sort or the filter');
  assert.ok(/allow: \['\.\.'\]/.test(fs.readFileSync(path.join(studio, 'sanity.cli.js'), 'utf8')), 'the dev server may read the dashboard folder');
});

test('the page asks for published tasks of the board only, and writes nothing', () => {
  assert.ok(/source == "monday" && !\(_id in path\("drafts\.\*\*"\)\)/.test(parts.question));
  assert.ok(/perspective: 'published'/.test(viewSource));
  assert.ok(!/\.patch\(|\.create\(|\.createIfNotExists\(|\.createOrReplace\(|\.delete\(|\.mutate\(|\.transaction\(|useDocumentOperation|\.publish\(/.test(viewSource + partsSource), 'the page writes nothing');
});

test('the page has a Team picker and three pickers for the preview, and no button that writes, no token button and no tabs', () => {
  assert.ok(!/tabButton|BoardCard|saveBoardChoice|setShowOnTv|PreviewPanelsView|Sync Monday now'/.test(viewSource), 'no write button and no tab');
  assert.deepEqual(parts.teamChoices.map(choice => choice.title), ['Both', 'Prime', 'Nova']);
  assert.equal(parts.controlLink, 'http://teletraan.local:3229/control/#settings/monday');
  assert.equal(parts.rotationPath, '/structure/rotation');
  assert.ok(/id: 'rotation'/.test(structureSource), 'the Rotation board is the line with the id rotation');
  assert.equal(parts.words.rotation, 'Add a Department tasks row on the Rotation board');
  assert.equal(parts.words.previewTitle, 'What the TV shows');
  assert.ok(/title: 'Monday', id: 'monday', icon: ThListIcon, component: MondayPage \}/.test(structureSource), 'one Monday line, with no pane behind it');
  ['monday-boards-view.js', 'monday-boards-parts.js', 'monday-pickers.js', 'monday-token-input.js', 'monday-status-input.js', 'preview-panels-view.js']
    .forEach(file => assert.equal(fs.existsSync(path.join(studio, 'inputs', file)), false, file + ' is gone'));
});

test('the page keeps to the rules for a phone: a 16 pixel gutter, wrapping text, 44 pixel links, nothing fixed wide', () => {
  assert.ok(/page: \{[^}]*padding: '24px 16px'/.test(viewSource));
  assert.ok(/minHeight: 44/.test(viewSource));
  (viewSource.match(/\bwidth: [3-9]\d\d\b/g) || []).forEach(found => assert.fail('a fixed width that does not fit a phone: ' + found));
  (viewSource.match(/min[Ww]idth: \d+/g) || []).forEach(found => assert.ok(Number(found.replace(/\D/g, '')) < 300, found));
  assert.ok(/overflowWrap: 'anywhere'/.test(viewSource));
  assert.ok(!/nowrap|textOverflow|ellipsis/.test(viewSource), 'a project name is never cut');
  assert.ok(/@media \(max-width: 640px\)/.test(viewSource), 'a table becomes cards on a phone');
});

test('the words are plain: no dash, no exclamation mark, no emoji, no filler, and each sentence ends with a stop', () => {
  const all = [];
  (function collect(value) {
    if (typeof value === 'string') all.push(value);
    else if (value && typeof value === 'object') Object.keys(value).forEach(name => collect(value[name]));
  })(parts.words);
  all.forEach(text => {
    assert.ok(!/[–—!]/.test(text), 'no dash or exclamation mark in: ' + text);
    assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(text), 'no emoji in: ' + text);
    assert.ok(!/\b(simply|just|basically|really|very|actually|easily)\b/i.test(text), 'no filler word in: ' + text);
  });
  [parts.words.intro, parts.words.unreadable, parts.words.neverRead, parts.words.none, parts.words.emptyDepartment, parts.words.emptyList, parts.words.previewHelp, parts.words.previewSkipped, parts.words.teamHelp].forEach(text => assert.ok(/\.$/.test(text), 'ends with a full stop: ' + text));
});

let failures = 0;
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

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
