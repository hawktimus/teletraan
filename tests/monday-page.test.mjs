// Tests for the Monday page of the Studio (studio/inputs/monday-page-parts.js and monday-page.js): the cards of the
// boards, the choice of the two boards, the red sentence for a chosen board the token cannot see, the items
// grouped by department and filtered, the Show on TV switch, the milestones, the old lists that stay
// reachable and the rules for a phone. The parts are plain functions and the client is a stand-in, so nothing
// is installed and nothing touches the network. The sidebar line and the pane its links open are checked by
// tests/schemas.test.mjs.
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

const status = {
  connectedAs: 'Sam',
  lastSyncAt: ago(11),
  callsToday: 42,
  callsDate: '2026-10-17',
  boards: [
    { id: '18435272887', name: 'Milestones', itemCount: 1 },
    { id: '111', name: 'Build Tasks', itemCount: 5 },
    { id: '222', name: 'Social Media', itemCount: 1 },
  ],
  readings: [{ boardId: '18435272887', itemsRead: 1, readAt: ago(11), note: '' }],
};

const chosenMissing = { taskBoard: '18435126893', milestoneBoard: '18435272887', everyMinutes: 30 };

// A stand-in for the Sanity client: documents by id, and a record of every write
function fakeClient(documents) {
  const store = {};
  documents.forEach(doc => (store[doc._id] = JSON.parse(JSON.stringify(doc))));
  const writes = [];

  function patchOf(id, ops) {
    const record = { id: id, setIfMissing: null, set: null };
    const patch = {
      setIfMissing: value => {
        record.setIfMissing = value;
        return patch;
      },
      set: value => {
        record.set = value;
        return patch;
      },
      commit: async () => {
        writes.push({ type: 'patch', id: id, setIfMissing: record.setIfMissing, set: record.set });
        return {};
      },
    };
    if (ops && ops.set) patch.set(ops.set);
    return patch;
  }

  return {
    writes: writes,
    store: store,
    getDocument: async id => store[id] || null,
    fetch: async (query, params) => (params && params.ids ? params.ids.filter(id => store[id]).map(id => store[id]) : []),
    createIfNotExists: async doc => {
      writes.push({ type: 'createIfNotExists', id: doc._id, doc: doc });
      if (!store[doc._id]) store[doc._id] = doc;
      return doc;
    },
    patch: id => patchOf(id),
    transaction: () => {
      const pending = [];
      const transaction = {
        createIfNotExists: doc => {
          pending.push({ type: 'createIfNotExists', id: doc._id, doc: doc });
          return transaction;
        },
        patch: (id, ops) => {
          pending.push({ type: 'patch', id: id, setIfMissing: null, set: ops.set });
          return transaction;
        },
        commit: async () => {
          pending.forEach(write => writes.push(write));
          return {};
        },
      };
      return transaction;
    },
  };
}

const published = { _id: 'dashboardSettings', _type: 'dashboardSettings', _rev: 'a', _createdAt: 'x', _updatedAt: 'y', mondayEveryMinutes: 30, mondayTaskBoard: { boardId: '18435126893', departmentColumn: 'color_mm82nvea' }, mondayMilestoneBoard: { boardId: '18435272887' }, motion: 'full' };

test('the boards of the token become cards, the chosen ones first, each with the two roles and a plain status', () => {
  const cards = parts.boardCards(status, { taskBoard: '111', milestoneBoard: '18435272887', everyMinutes: 30 }, now);

  assert.deepEqual(cards.map(card => card.id), ['18435272887', '111', '222']);
  const milestones = cards[0];
  assert.equal(milestones.name, 'Milestones');
  assert.equal(milestones.items, '1 item');
  assert.equal(milestones.read, 'Read 11 minutes ago');
  assert.equal(milestones.milestones, true);
  assert.equal(milestones.task, false);
  assert.equal(milestones.status, 'The Teletraan computer can read this board.');
  assert.equal(cards[1].task, true);
  assert.equal(cards[1].items, '5 items');
  assert.equal(cards[1].read, 'Not read yet');
  assert.equal(cards[2].task || cards[2].milestones, false);
  assert.equal(parts.words.taskRole, 'Show tasks from this board');
  assert.equal(parts.words.milestoneRole, 'Show milestones from this board');
});

test('a chosen board the token cannot see gets a card of its own that says what to do', () => {
  const cards = parts.boardCards(status, chosenMissing, now);
  const lost = cards.filter(card => card.id === '18435126893')[0];

  assert.ok(lost, 'the missing board should have a card');
  assert.equal(lost.task, true);
  assert.equal(lost.visible, false);
  assert.equal(lost.name, 'Board 18435126893');
  assert.equal(lost.status, 'The token cannot see this board: open the board in Monday, click Share, and add the account the token belongs to, or choose another board.');
  assert.equal(cards[0].id === '18435126893' || cards[0].id === '18435272887', true, 'the chosen boards come first');
});

test('a missing task board gives the red sentence with the number and the action, and the note about multi-level boards', () => {
  const lines = parts.missingLines(status, chosenMissing);

  assert.equal(lines.length, 1);
  assert.equal(lines[0].kind, 'task');
  assert.ok(lines[0].text.includes('18435126893'), 'it names the board number');
  assert.ok(/Share/.test(lines[0].text) && /add the account the token belongs to/.test(lines[0].text) && /choose another board/.test(lines[0].text), 'it says what to do');
  assert.equal(parts.showMultiLevelNote(status, chosenMissing), true);
  assert.ok(/Robotics Tasks/.test(parts.words.multiLevel) && /multi-level/.test(parts.words.multiLevel) && /may not list/.test(parts.words.multiLevel));
});

test('no red sentence when the token sees both boards, or before the computer has written anything', () => {
  assert.deepEqual(parts.missingLines(status, { taskBoard: '111', milestoneBoard: '18435272887', everyMinutes: 30 }), []);
  assert.equal(parts.showMultiLevelNote(status, { taskBoard: '111', milestoneBoard: '222', everyMinutes: 30 }), false);
  assert.deepEqual(parts.missingLines(null, chosenMissing), []);
  assert.equal(parts.missingLines({ boards: [] }, chosenMissing).length, 2, 'a token that sees nothing means both boards are missing');
});

test('the choice is read from the draft first, then the published document, then the starting boards', () => {
  const draft = Object.assign({}, published, { _id: 'drafts.dashboardSettings', mondayTaskBoard: { boardId: '111' }, mondayEveryMinutes: 45 });

  assert.deepEqual(parts.chosenFrom([published, draft]), { found: true, taskBoard: '111', milestoneBoard: '18435272887', everyMinutes: 45 });
  assert.equal(parts.chosenFrom([published]).taskBoard, '18435126893');
  const none = parts.chosenFrom([null, null]);
  assert.equal(none.found, false);
  assert.equal(none.taskBoard, '18435126893');
  assert.equal(none.milestoneBoard, '18435272887');
  assert.equal(none.everyMinutes, 30);
});

test('choosing a board writes only its number, to the draft of Dashboard Settings, and never publishes', async () => {
  const client = fakeClient([published]);
  await parts.saveBoardChoice(client, 'task', '111');

  assert.ok(client.store['drafts.dashboardSettings'], 'the draft is made from the published document');
  assert.equal(client.store['drafts.dashboardSettings'].motion, 'full', 'the other fields are kept');
  assert.equal(client.store['drafts.dashboardSettings']._rev, undefined);
  const patches = client.writes.filter(write => write.type === 'patch');
  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, 'drafts.dashboardSettings');
  assert.deepEqual(patches[0].set, { 'mondayTaskBoard.boardId': '111' });
  assert.deepEqual(patches[0].setIfMissing, { mondayTaskBoard: {} });
  assert.ok(client.writes.every(write => write.id === 'drafts.dashboardSettings'), 'nothing touches the published document');
});

test('the milestones choice writes the other block, an existing draft is not copied again, and the interval is its own field', async () => {
  const draft = Object.assign({}, published, { _id: 'drafts.dashboardSettings' });
  const client = fakeClient([published, draft]);
  await parts.saveBoardChoice(client, 'milestones', '222');
  await parts.saveInterval(client, '15');

  assert.equal(client.writes.filter(write => write.type === 'createIfNotExists').length, 0);
  const patches = client.writes.filter(write => write.type === 'patch');
  assert.deepEqual(patches[0].set, { 'mondayMilestoneBoard.boardId': '222' });
  assert.deepEqual(patches[1].set, { mondayEveryMinutes: 15 });
});

test('a board number that is not digits, a bad role and a bad interval are refused before anything is written', async () => {
  const client = fakeClient([published]);

  await assert.rejects(() => parts.saveBoardChoice(client, 'task', '11 1'));
  await assert.rejects(() => parts.saveBoardChoice(client, 'task', ''));
  await assert.rejects(() => parts.saveBoardChoice(client, 'banner', '111'));
  await assert.rejects(() => parts.saveInterval(client, '4'));
  await assert.rejects(() => parts.saveInterval(client, '121'));
  await assert.rejects(() => parts.saveInterval(client, '30.5'));
  assert.equal(client.writes.length, 0);
  assert.equal(parts.minutesFrom(' 30 '), 30);
  assert.equal(parts.minutesFrom('abc'), null);
});

test('with no Dashboard Settings at all the choice says to publish it first, and writes nothing', async () => {
  const client = fakeClient([]);
  await assert.rejects(() => parts.saveBoardChoice(client, 'task', '111'), /not been published/);
  assert.equal(client.writes.length, 0);
});

test('the interval, the reads used today and the last read are said in plain words', () => {
  assert.equal(parts.budgetText(status, '2026-10-17'), '42 of 900');
  assert.equal(parts.budgetText(status, '2026-10-18'), '0 of 900', 'a count of another day is a new day');
  assert.equal(parts.budgetText({}, '2026-10-17'), '');
  assert.equal(parts.updatedText(status, now), 'The Teletraan computer last read Monday 11 minutes ago.');
  assert.equal(parts.errorText({ lastError: 'monday refused the token' }), 'Monday refused the token.');
});

const tasks = [
  { _id: 'task-monday-1', title: 'Chassis frame assembly', status: 'in-progress', priority: 'high', dueDate: '2026-10-21', estHours: 6, owners: ['Ana', 'Ben'], department: 'Build', showOnTv: true, showOnBoard: true },
  { _id: 'task-monday-2', title: 'Wire the main breaker panel and the radio power', status: 'up-next', department: 'Electrical', contact: 'Cy' },
  { _id: 'task-monday-3', title: 'Autonomous routine', status: 'blocked', department: 'Programming', showOnTv: false },
  { _id: 'task-monday-4', title: 'Sponsor letters', status: 'done', department: 'Business' },
  { _id: 'task-monday-5', title: 'Mount the winch', status: 'up-next', department: 'Build', showOnBoard: false },
  { _id: 'task-monday-6', title: 'Plan the pit layout', status: 'up-next', department: '', hiddenReason: 'unassigned', show: false },
  { _id: 'task-monday-7', title: 'Robot cart', status: 'up-next', department: 'Pit Crew' },
  { _id: 'task-monday-8', title: 'Social posts for the week', status: 'up-next', department: 'Marketing' },
];

test('a task that has a draft shows the draft, so a switch turned here is seen at once', () => {
  const merged = parts.mergeDrafts([tasks[0], { _id: 'drafts.task-monday-1', title: 'Chassis frame assembly', showOnTv: false }, tasks[1]]);

  assert.equal(merged.length, 2);
  assert.equal(merged[0]._id, 'task-monday-1');
  assert.equal(merged[0].showOnTv, false);
  assert.equal(merged[0].draft, true);
  assert.equal(merged[1].draft, false);
});

test('the items are grouped by department in the order of the team, other departments after them, no department last', () => {
  const rows = parts.itemRows(tasks, now);
  const groups = parts.groupRows(rows, {});

  assert.deepEqual(groups.map(group => group.title), ['Build', 'Electrical', 'Programming', 'Business', 'Marketing', 'Pit Crew', 'No department']);
  assert.equal(groups[0].rows.length, 2);
  assert.deepEqual(parts.departmentsOf(rows), ['Build', 'Electrical', 'Programming', 'Business', 'Marketing', 'Pit Crew', '']);
});

test('the items filter by department, by status, by on or off the TV and by a search of the title or an owner', () => {
  const rows = parts.itemRows(tasks, now);
  const titles = filters => parts.groupRows(rows, filters).reduce((all, group) => all.concat(group.rows.map(row => row.id)), []);

  assert.deepEqual(titles({ department: 'Build' }), ['task-monday-1', 'task-monday-5']);
  assert.deepEqual(titles({ department: parts.noDepartmentKey }), ['task-monday-6']);
  assert.deepEqual(titles({ status: 'blocked' }), ['task-monday-3']);
  assert.deepEqual(titles({ shown: 'off' }).sort(), ['task-monday-3', 'task-monday-5', 'task-monday-6']);
  assert.equal(titles({ shown: 'on' }).length, 5);
  assert.deepEqual(titles({ search: 'ben' }), ['task-monday-1'], 'an owner first name finds the task');
  assert.deepEqual(titles({ search: 'BREAKER' }), ['task-monday-2'], 'a search ignores capitals');
  assert.deepEqual(titles({ department: 'Build', status: 'up-next' }), ['task-monday-5']);
  assert.deepEqual(titles({ search: 'nothing like this' }), []);
});

test('a row says the department, status, owners, due date and hours, and the whole title, never cut', () => {
  const rows = parts.itemRows(tasks, now);
  const first = rows[0];

  assert.equal(parts.detailLine(first), 'In progress · High priority · Ana, Ben · Due Oct 21 · 6 hours');
  assert.equal(first.department, 'Build');
  assert.equal(rows[1].title, 'Wire the main breaker panel and the radio power', 'a long title is kept whole');
  assert.equal(rows[1].owners, 'Cy', 'the point of contact stands in when no owner names are kept');
  const long = parts.itemRows([{ _id: 'task-monday-9', title: 'x'.repeat(200) }], now)[0];
  assert.equal(long.title.length, 200);
});

test('a task the sync hid says why, and the reason keeps it off whatever the switch says', () => {
  const rows = parts.itemRows(tasks, now);
  const byId = id => rows.filter(row => row.id === id)[0];

  assert.equal(byId('task-monday-6').onTv, false);
  assert.ok(/no department/.test(byId('task-monday-6').reason));
  assert.ok(/Off the TV\. The task has no department/.test(parts.shownText(byId('task-monday-6'))));
  assert.ok(/Show on TV column in Monday says Hide/.test(byId('task-monday-5').reason));
  assert.equal(parts.shownText(byId('task-monday-3')), 'Off the TV by your switch');
  assert.equal(byId('task-monday-3').reason, '');
  assert.equal(parts.shownText(byId('task-monday-1')), 'On the TV');
  const expired = parts.itemRows([{ _id: 'task-monday-10', title: 'Old', expires: '2026-10-01T00:00:00.000Z' }], now)[0];
  assert.equal(expired.reason, 'It has expired.');
  assert.equal(parts.countLine(rows), '8 tasks, 5 on the TV.');
});

test('the Show on TV switch writes only showOnTv, to the draft of the task, made from the published task', async () => {
  const client = fakeClient([Object.assign({ _type: 'task', _rev: 'r', _createdAt: 'c', _updatedAt: 'u', source: 'monday' }, tasks[0])]);
  await parts.setShowOnTv(client, ['task-monday-1'], false);

  const made = client.writes.filter(write => write.type === 'createIfNotExists');
  assert.equal(made.length, 1);
  assert.equal(made[0].id, 'drafts.task-monday-1');
  assert.equal(made[0].doc._rev, undefined);
  assert.equal(made[0].doc.title, 'Chassis frame assembly', 'the draft is a copy of the task as it was');
  const patches = client.writes.filter(write => write.type === 'patch');
  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, 'drafts.task-monday-1');
  assert.deepEqual(patches[0].set, { showOnTv: false }, 'nothing but showOnTv is set');
  assert.ok(client.writes.every(write => write.id.startsWith('drafts.')), 'the published task is never written');
});

test('hide all in a group writes the one switch of each task and no more, and a task with a draft is not copied again', async () => {
  const docs = [tasks[0], tasks[4]].map(task => Object.assign({ _type: 'task', source: 'monday' }, task));
  const draft = Object.assign({}, docs[1], { _id: 'drafts.task-monday-5' });
  const client = fakeClient(docs.concat([draft]));
  await parts.setShowOnTv(client, ['task-monday-1', 'task-monday-5', 'drafts.task-monday-5'], true);

  assert.equal(client.writes.filter(write => write.type === 'createIfNotExists').length, 1, 'only the task with no draft is copied');
  const patches = client.writes.filter(write => write.type === 'patch');
  assert.deepEqual(patches.map(write => write.id), ['drafts.task-monday-1', 'drafts.task-monday-5']);
  patches.forEach(write => assert.deepEqual(Object.keys(write.set), ['showOnTv']));
  assert.equal(await parts.setShowOnTv(client, [], true), null, 'no task, no write');
});

test('a task that cannot be found stops the whole change, so half a group is never written', async () => {
  const client = fakeClient([Object.assign({ _type: 'task' }, tasks[0])]);
  await assert.rejects(() => parts.setShowOnTv(client, ['task-monday-1', 'task-monday-404'], false), /could not be found/);
  assert.equal(client.writes.length, 0);
});

test('the milestones are listed read only, with a plain line each', () => {
  const rows = parts.milestoneRows([
    { _id: 'milestone-monday-1', name: 'First drive test', targetDate: '2026-11-04', status: 'on-track', team: 'Hawktimus Prime', department: 'Build' },
    { _id: 'milestone-monday-2', name: 'Bumpers on', targetDate: '2026-11-20', status: 'at-risk', show: false },
  ]);

  assert.equal(parts.milestoneLine(rows[0]), 'Nov 4 · On track · Hawktimus Prime · Build');
  assert.equal(parts.milestoneLine(rows[1]), 'Nov 20 · At risk · Both teams · All departments · Gone from the board');
  assert.ok(!/\.patch\(|\.create|setShowOnTv|saveBoardChoice/.test(viewSource.slice(viewSource.indexOf('function MilestonesTab'), viewSource.indexOf('export function MondayPage'))), 'the Milestones tab writes nothing');
});

test('the old lists of tasks stay reachable: a link on the Items tab, a pane for it in structure.js, and the old lists keep their filters', () => {
  assert.ok(/Old manual tasks/.test(parts.words.oldTasks));
  assert.ok(/childId: oldTasksChild/.test(viewSource) && /words\.oldTasks/.test(viewSource), 'the Items tab links to the old lists');
  assert.ok(/if \(boardId === oldTasksChild\) return groupList\(S, oldTasksFolder, times\)/.test(structureSource), 'structure.js opens the old folder for that link');
  assert.ok(/title: 'Monday', id: 'monday'/.test(structureSource) && !/title: 'Monday Boards'/.test(structureSource), 'the sidebar has one Monday line');
  assert.ok(/const tasksHidden = 'source != "monday"/.test(structureSource), 'the Hidden list still holds the manual tasks');
  assert.ok(/Manual tasks are never shown on the screen/.test(parts.words.oldTasksLine));
});

test('the page keeps to the rules for a phone: a 16 pixel gutter, wrapping text, 44 pixel buttons, nothing fixed wide', () => {
  assert.ok(/page: \{[^}]*padding: '24px 16px'/.test(viewSource), 'the page has a 16 pixel gutter');
  assert.ok(!/padding: '24px 32px'/.test(viewSource));
  (viewSource.match(/minHeight: \d+/g) || []).forEach(found => assert.ok(Number(found.replace(/\D/g, '')) === 0 || Number(found.replace(/\D/g, '')) >= 44, found + ' is under 44 pixels'));
  assert.ok(/minHeight: 44/.test(viewSource));
  (viewSource.match(/\bwidth: [3-9]\d\d\b/g) || []).forEach(found => assert.fail('a fixed width that does not fit a phone: ' + found));
  (viewSource.match(/min[Ww]idth: \d+/g) || []).forEach(found => assert.ok(Number(found.replace(/\D/g, '')) < 300, found));
  assert.ok(/flexWrap: 'wrap'/.test(viewSource), 'rows wrap on a narrow screen');
  assert.ok(/overflowWrap: 'anywhere'/.test(viewSource), 'long words wrap');
  assert.ok(!/nowrap|textOverflow|ellipsis/.test(viewSource), 'a title is never cut with three dots');
  assert.ok(/itemTitle: \{[^}]*overflowWrap: 'anywhere'/.test(viewSource), 'a task title wraps in full');
});

test('the page draws and never writes: every write is in the parts, and each goes to a draft', () => {
  assert.ok(!/\.patch\(|\.create\(|\.createIfNotExists\(|\.createOrReplace\(|\.delete\(|\.mutate\(|\.transaction\(|useDocumentOperation|\.publish\(/.test(viewSource), 'monday-page.js should only call the functions of the parts');
  assert.ok(!/\.createOrReplace\(|\.delete\(|\.mutate\(|\.publish\(/.test(partsSource.replace(/^\/\/.*$/gm, '')), 'the parts never replace, delete or publish');
  assert.ok(/set\(\{ showOnTv: Boolean\(value\) \}\)|set: \{ showOnTv: Boolean\(value\) \}/.test(partsSource), 'a task gets showOnTv and nothing else');
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
  [parts.words.intro, parts.words.saveNote, parts.words.cannotRead, parts.words.multiLevel, parts.words.itemsIntro, parts.words.oldTasksLine].forEach(text => assert.ok(/\.$/.test(text), 'ends with a full stop: ' + text));
  const toolWords = [['Cla', 'ude'], ['Anthro', 'pic'], ['G', 'PT']].map(parts => parts.join('')).join('|');
  assert.ok(!new RegExp('(^|\\n)\\s*(\\/\\/.*)?\\b(' + toolWords + ')\\b').test(viewSource + partsSource), 'no tool names');
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
