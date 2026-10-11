// Tests for tasks from the team board and tasks typed by hand (dashboard/core/task-source.js,
// isVisible in core/content.js, normalizeContent in core/sanity.js, and the Tasks and Open Tasks
// panels): the screen draws only the tasks from the board, a task kept off the TV never shows,
// and a task from the board keeps the older switches (Show on screen, Hide after, Team) and the
// older order. Nothing is drawn and nothing touches the network.
//
//   node tools/test-task-board.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-task-board-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
fs.copyFileSync(path.join(dashboardFolder, 'config.js'), path.join(root, 'config.js'));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});
['tasks/tasks.js', 'task-counts/task-counts.js'].forEach(file => {
  fs.mkdirSync(path.join(root, 'panels', path.dirname(file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', file), path.join(root, 'panels', file));
});

const base = pathToFileURL(root).href + '/';
const taskSource = await import(base + 'core/task-source.js');
const sanity = await import(base + 'core/sanity.js');
const content = await import(base + 'core/content.js');
const teams = await import(base + 'core/teams.js');
const tasksPanel = await import(base + 'panels/tasks/tasks.js');
const taskCountsPanel = await import(base + 'panels/task-counts/task-counts.js');

const { isFromBoard, fromBoardOnly } = taskSource;
const { normalizeContent, normalizeSample, contentQuery } = sanity;
const { visibleItems, isVisible } = content;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const now = new Date('2026-10-09T12:00:00Z');
const past = '2026-10-01T12:00:00.000Z';
const future = '2026-11-01T12:00:00.000Z';

// A task the way the query sends it: with the names Sanity keeps to itself
function document(id, fields) {
  return Object.assign({ _id: id, _type: 'task', _createdAt: '2026-09-01T10:00:00Z', _updatedAt: '2026-09-01T10:00:00Z', status: 'up-next' }, fields);
}

const titlesOf = tasks => tasks.map(task => task.title);

// Runs a check with a team on the screen, and puts the built-in team back after it. The
// module is shared by every test in this file, so it has to be left as it was found.
function onTeamScreen(code, run) {
  const list = [{ code: 'prime', name: 'Prime', active: true }, { code: 'nova', name: 'Nova', active: true }];
  teams.useTeams({ teams: list, settings: { teamMode: code, alternateMinutes: 5 } });
  teams.changeTeamNow();
  try {
    run();
  } finally {
    teams.useTeams(null);
    teams.changeTeamNow();
  }
}

function openCountText(tasks) {
  const host = { innerHTML: '' };
  taskCountsPanel.mount(host, normalizeContent({ tasks: tasks }, now));
  return host.innerHTML;
}

// A task is from the board only when its source is monday

test('a task is from the board only when its source is monday, so a task with no source was typed by hand', () => {
  assert.equal(isFromBoard({ source: 'monday' }), true);
  [{ source: 'manual' }, {}, { source: null }, { source: '' }, { source: 'Monday' }, { source: 7 }, null, undefined].forEach(task => {
    assert.equal(isFromBoard(task), false, JSON.stringify(task));
  });
});

test('fromBoardOnly keeps the tasks from the board in the order they have, and the list given is not changed', () => {
  const list = [
    { title: 'board 1', source: 'monday' },
    { title: 'typed 1', source: 'manual' },
    { title: 'board 2', source: 'monday' },
    { title: 'old 1' },
    { title: 'board 3', source: 'monday' },
  ];
  assert.deepEqual(titlesOf(fromBoardOnly(list)), ['board 1', 'board 2', 'board 3']);
  assert.deepEqual(titlesOf(list), ['board 1', 'typed 1', 'board 2', 'old 1', 'board 3'], 'the list given is not changed');
  assert.deepEqual(fromBoardOnly([]), []);
  assert.deepEqual(fromBoardOnly([{ title: 'only' }]), []);
});

// Only the board

test('normalizeContent sorts by Order as before, and leaves out every task that is not from the board', () => {
  const result = {
    tasks: [
      document('a', { title: 'board 1', source: 'monday', order: 1 }),
      document('b', { title: 'typed 5', source: 'manual', order: 5 }),
      document('c', { title: 'board 2', source: 'monday', order: 2 }),
      document('d', { title: 'typed none' }),
      document('e', { title: 'board none', source: 'monday' }),
      document('f', { title: 'typed 3', order: 3 }),
    ],
  };
  assert.deepEqual(titlesOf(normalizeContent(result, now).tasks), ['board 1', 'board 2', 'board none']);
});

test('the sample content is cleaned the same way', () => {
  const raw = {
    tasks: [
      { title: 'board', source: 'monday', status: 'up-next', order: 1 },
      { title: 'typed', status: 'up-next', order: 9 },
    ],
  };
  assert.deepEqual(titlesOf(normalizeSample(raw).tasks), ['board']);
});

test('inside a team, the tasks from the board for that team and for both are in, and no task typed by hand is', () => {
  const result = {
    tasks: [
      document('a', { title: 'board prime', source: 'monday', team: 'prime', order: 1 }),
      document('b', { title: 'board both', source: 'monday', order: 2 }),
      document('c', { title: 'board nova', source: 'monday', team: 'nova', order: 3 }),
      document('d', { title: 'typed nova', team: 'nova', order: 4 }),
      document('e', { title: 'typed both', order: 5 }),
      document('f', { title: 'typed prime', team: 'prime', order: 6 }),
    ],
  };
  const tasks = normalizeContent(result, now).tasks;
  onTeamScreen('prime', () => assert.deepEqual(titlesOf(visibleItems(tasks, now)), ['board prime', 'board both']));
  onTeamScreen('nova', () => assert.deepEqual(titlesOf(visibleItems(tasks, now)), ['board both', 'board nova']));
});

test('the Tasks panel draws the tasks from the board only', () => {
  const result = {
    tasks: [
      document('a', { title: 'board first', source: 'monday', status: 'in-progress', order: 1 }),
      document('b', { title: 'typed second', status: 'in-progress', order: 2 }),
      document('c', { title: 'typed third', source: 'manual', status: 'up-next', order: 3 }),
    ],
  };
  const rows = tasksPanel.rowsFor(normalizeContent(result, now), now);
  assert.deepEqual(rows.map(row => titlesOf(row.tasks)), [['board first']]);
  assert.ok(openCountText(result.tasks).includes('<div class="count">1</div>'), 'the Open Tasks panel counts the one task from the board');

  const onlyTyped = normalizeContent({ tasks: [document('d', { title: 'typed', source: 'manual' }), document('e', { title: 'older' })] }, now);
  assert.deepEqual(onlyTyped.tasks, []);
  assert.equal(tasksPanel.hasContent(onlyTyped), false);
  assert.equal(taskCountsPanel.hasContent(onlyTyped), false);
});

// Show on TV

test('a task with Show on TV off never shows, whatever its source, and nothing else about the switch is read', () => {
  assert.equal(isVisible({ title: 'a', showOnTv: false }, now), false);
  assert.equal(isVisible({ title: 'a', showOnTv: false, source: 'monday' }, now), false);
  assert.equal(isVisible({ title: 'a', showOnTv: false, show: true }, now), false);

  // on, empty or missing is shown. Only a switch turned off hides a task.
  [true, undefined, null].forEach(value => assert.equal(isVisible({ title: 'a', showOnTv: value }, now), true, String(value)));

  // the switch on does not undo the other two reasons to hide a task
  assert.equal(isVisible({ title: 'a', showOnTv: true, show: false }, now), false);
  assert.equal(isVisible({ title: 'a', showOnTv: true, expires: past }, now), false);
  assert.equal(isVisible({ title: 'a', showOnTv: true, expires: future }, now), true);
});

test('the Tasks panel and the Open Tasks panel leave out a task with Show on TV off', () => {
  const tasks = [
    document('a', { title: 'in progress on', status: 'in-progress', source: 'monday', showOnTv: true }),
    document('b', { title: 'in progress off', status: 'in-progress', source: 'monday', showOnTv: false }),
    document('c', { title: 'board on', status: 'up-next', source: 'monday' }),
    document('d', { title: 'board off', status: 'up-next', source: 'monday', showOnTv: false }),
    document('e', { title: 'blocked off', status: 'blocked', source: 'monday', showOnTv: false }),
  ];
  const all = normalizeContent({ tasks: tasks }, now);
  const shown = tasksPanel.rowsFor(all, now).reduce((titles, row) => titles.concat(titlesOf(row.tasks)), []);
  assert.deepEqual(shown, ['in progress on', 'board on']);

  const text = openCountText(tasks);
  assert.ok(text.includes('<div class="count">2</div>'), text);
  assert.ok(text.includes('1 in progress') && text.includes('1 up next') && !text.includes('blocked'), text);

  // when nothing is left the panels have nothing to show, as they do with no tasks
  const allOff = normalizeContent({ tasks: [document('f', { title: 'off', source: 'monday', showOnTv: false })] }, now);
  assert.equal(tasksPanel.hasContent(allOff), false);
  assert.equal(taskCountsPanel.hasContent(allOff), false);
});

test('only the shared check reads Show on TV: the two panels take their tasks through visibleItems', () => {
  ['panels/tasks/tasks.js', 'panels/task-counts/task-counts.js'].forEach(file => {
    assert.equal(read(file).includes('showOnTv'), false, file);
    assert.ok(read(file).includes('visibleItems(content.tasks'), file);
  });
  assert.ok(read('core/content.js').includes('item.showOnTv === false'));
});

test('the query sends every field of a task, so the new ones reach the screen with no change to it', () => {
  const part = contentQuery.slice(contentQuery.indexOf('"tasks":'), contentQuery.indexOf('"sponsors":'));
  assert.ok(/\{\s*\.\.\.,/.test(part), part);
});

// A task from the board with only the older switches

// The rule as it was before the new fields: Order first and lowest first, the rest in the order
// they were made, and a task is shown unless it is switched off, expired or for the other team.
function olderOrder(tasks) {
  const hasOrder = task => typeof task.order === 'number';
  return tasks
    .map((task, position) => ({ task: task, position: position }))
    .sort((a, b) => {
      if (hasOrder(a.task) && hasOrder(b.task) && a.task.order !== b.task.order) return a.task.order - b.task.order;
      if (hasOrder(a.task) !== hasOrder(b.task)) return hasOrder(a.task) ? -1 : 1;
      return a.position - b.position;
    })
    .map(entry => entry.task);
}

function olderShown(tasks, teamCode) {
  return olderOrder(tasks).filter(task => task.show !== false && (!task.expires || new Date(task.expires) > now) && (!task.team || task.team === teamCode));
}

// Every mix of the old switches: 3 for show, 3 for expiry, 3 for team, with Order going round.
// Each is a task from the board, because the screen draws no other.
function olderTasks() {
  const orders = [undefined, 3, 1, 2];
  const list = [];
  [undefined, true, false].forEach(show => {
    [undefined, past, future].forEach(expires => {
      ['', 'prime', 'nova'].forEach(team => {
        const fields = { title: 'task ' + (list.length + 1), status: ['in-progress', 'up-next', 'blocked'][list.length % 3], source: 'monday' };
        if (show !== undefined) fields.show = show;
        if (expires) fields.expires = expires;
        if (team) fields.team = team;
        if (orders[list.length % orders.length] !== undefined) fields.order = orders[list.length % orders.length];
        list.push(document('id' + list.length, fields));
      });
    });
  });
  return list;
}

test('tasks from the board with only the older switches come out in the same order, with the same fields, and nothing is added to them', () => {
  const documents = olderTasks();
  const tasks = normalizeContent({ tasks: documents }, now).tasks;
  assert.equal(tasks.length, documents.length);
  assert.deepEqual(titlesOf(tasks), titlesOf(olderOrder(documents)));

  tasks.forEach(task => {
    const original = documents.filter(item => item.title === task.title)[0];
    const expected = Object.keys(original).filter(name => name.charAt(0) !== '_').sort();
    assert.deepEqual(Object.keys(task).sort(), expected, task.title);
    ['showOnTv', 'priority', 'mondayId'].forEach(name => assert.equal(name in task, false, task.title + ' has ' + name));
  });
});

test('tasks from the board with only the older switches show on each team exactly as they did', () => {
  const documents = olderTasks();
  const tasks = normalizeContent({ tasks: documents }, now).tasks;

  ['prime', 'nova'].forEach(code => {
    onTeamScreen(code, () => {
      assert.deepEqual(titlesOf(visibleItems(tasks, now)), titlesOf(olderShown(documents, code)), code);

      const shown = tasksPanel.rowsFor(normalizeContent({ tasks: documents }, now), now).reduce((titles, row) => titles.concat(titlesOf(row.tasks)), []);
      assert.deepEqual(shown.slice().sort(), titlesOf(olderShown(documents, code)).slice().sort(), code + ' in the Tasks panel');

      const open = olderShown(documents, code).length;
      assert.ok(openCountText(documents).includes('<div class="count' + (open >= 10 ? ' long' : '') + '">' + open + '</div>'), code + ' in the Open Tasks panel');
    });
  });
});

test('a task with none of the new fields, or typed by hand, reaches no panel, whatever its switches say', () => {
  const documents = olderTasks().map(task => {
    const copy = Object.assign({}, task);
    delete copy.source;
    return copy;
  });
  assert.deepEqual(normalizeContent({ tasks: documents }, now).tasks, []);
  assert.deepEqual(normalizeContent({ tasks: documents.map(task => Object.assign({}, task, { source: 'manual' })) }, now).tasks, []);
});

test('every sample task is from the board, and the screen keeps them all in the order they are written in', () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  const tasks = normalizeSample(raw).tasks;

  assert.ok(raw.tasks.length >= 12, 'the sample has tasks');
  assert.equal(raw.tasks.every(task => task.source === 'monday' && task.showOnTv === true), true, 'each sample task says it is from the board');
  assert.deepEqual(titlesOf(tasks), titlesOf(olderOrder(raw.tasks)));
  assert.equal(tasks.every(task => isFromBoard(task)), true);
});

test('the cached copy of the content, which is already cleaned, is cleaned again without a change', () => {
  const result = {
    tasks: [
      document('a', { title: 'board', source: 'monday', priority: 'high', mondayId: '1234', showOnTv: false, order: 1 }),
      document('b', { title: 'typed', source: 'manual', showOnTv: true, order: 2 }),
      document('c', { title: 'second board', source: 'monday', mondayId: '1235', order: 3 }),
    ],
  };
  const first = normalizeContent(result, now);
  const stored = JSON.parse(JSON.stringify(first));
  assert.deepEqual(stored.tasks, [
    { title: 'board', status: 'up-next', source: 'monday', priority: 'high', mondayId: '1234', showOnTv: false, order: 1 },
    { title: 'second board', status: 'up-next', source: 'monday', mondayId: '1235', order: 3 },
  ]);
  assert.deepEqual(normalizeSample(stored).tasks, stored.tasks);
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
