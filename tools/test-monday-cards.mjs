// Tests for the Monday cards (dashboard/core/monday.js, core/monday-draw.js and the panels in
// dashboard/panels/monday-*). The plain functions are run for real. Each card is run against a fake host
// that keeps the markup it draws, and the stylesheets are checked by reading them, because the sizes need
// a browser to be seen. The board data is made up: the sample in data/sample/content.json, changed here and
// there. The look rotation that runs the cards is in tools/test-look-rotation.mjs, and the Studio side (the
// Panel order choices and the due date field) is in studio/check-schemas.mjs.
//
//   node tools/test-monday-cards.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-monday-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js'].forEach(file => fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});

const singleNames = ['tasks', 'milestones', 'progress'];
const bothNames = ['milestones-both', 'progress-both'];
const cardNames = singleNames.concat(bothNames);
const cardIds = cardNames.map(name => 'monday-' + name);
cardIds.forEach(id => {
  fs.mkdirSync(path.join(root, 'panels', id), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', id, id + '.js'), path.join(root, 'panels', id, id + '.js'));
});

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const registry = await import(base + 'registry.js');
const monday = await import(base + 'core/monday.js');
const draw = await import(base + 'core/monday-draw.js');
const rotation = await import(base + 'core/look-rotation.js');
const sanity = await import(base + 'core/sanity.js');
const contentModule = await import(base + 'core/content.js');
const teams = await import(base + 'core/teams.js');
const panels = {};
for (const name of cardNames) panels[name] = await import(base + 'panels/monday-' + name + '/monday-' + name + '.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const at = text => new Date(text); // always written with a Z, so it means the same on every computer
const sampleRaw = () => JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
const countOf = (text, piece) => text.split(piece).length - 1;
const titlesOf = tasks => tasks.map(task => task.title);

// Noon on Monday October 12 2026 in Holly Springs. The week of Monday October 12 ends on Sunday October 18.
const monday12 = at('2026-10-12T16:00:00Z');

// The sample content, cleaned as the screen cleans it. The countdown has a time with a Z, so it falls on the same
// day in every time zone. Anything else is changed by the function given, which is given the raw sample.
function contentWith(change) {
  const raw = sampleRaw();
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}

// A task from the board, the way the board sync makes it, with what a test changes
function board(fields) {
  return Object.assign({ title: '[Task]', subteam: '[Subteam A]', status: 'up-next', team: 'prime', source: 'monday', mondayId: '[item]', showOnTv: true }, fields);
}

// The sample with these tasks in place of its own, and these lead entries when there are some
function contentOf(tasks, leads, change) {
  return contentWith(raw => {
    raw.tasks = tasks;
    if (leads) raw.subteams = leads.map(name => ({ name: name }));
    if (change) change(raw);
  });
}

// Runs a check with a team on the screen, and puts the built-in team back after it. The
// module is shared by every test in this file, so it has to be left as it was found.
function onTeamScreen(code, run) {
  const list = contentWith().teams;
  teams.useTeams({ teams: list, settings: { teamMode: code, alternateMinutes: 5 } });
  teams.changeTeamNow();
  try {
    run();
  } finally {
    teams.useTeams(null);
    teams.changeTeamNow();
  }
}

function hostFor(panel, content, page) {
  const host = { innerHTML: '' };
  panel.mount(host, content, page);
  return host.innerHTML;
}

// The words of some markup, with the tags taken out
const wordsOf = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// The words in the header of a page
function titleOf(html) {
  return wordsOf(/<h2 class="title"[^>]*>([\s\S]*?)<\/h2>/.exec(html)[1]);
}

const dashes = /[\u2013\u2014]/;


// The registry and the settings

test('the five cards are panels of the large frame, flagged monday in registry.js, with a script and a stylesheet each, and none is in the rotation lists of config.js', () => {
  const source = read('registry.js');
  cardIds.forEach(id => {
    assert.ok(source.includes("{ id: '" + id + "', region: 'grid1', topic: 'monday', monday: true },"), id);
    assert.ok(fs.existsSync(path.join(dashboardFolder, 'panels', id, id + '.js')) && fs.existsSync(path.join(dashboardFolder, 'panels', id, id + '.css')), id);
    assert.ok(!config.defaultSettings.rotation.grid1.some(step => step.panel === id), id + ' is not in a rotation list');
    assert.ok(!read('core/panel-order.js').includes(id), id);
  });
  assert.equal(countOf(source, 'monday: true'), 5);
  assert.deepEqual(registry.panels.filter(panel => panel.monday).map(panel => panel.id), cardIds);
  registry.panels.filter(panel => panel.monday).forEach(panel => assert.equal(panel.pages, undefined, panel.id + ' has no fixed pages: the tasks card has one for each lead entry'));
});

test('the screen asks Sanity for monday-status with the rest, and content has monday, null when there is none', () => {
  assert.ok(sanity.contentQuery.includes('"monday": *[_id == "monday-status"][0]'));
  assert.equal(contentModule.withDefaults({}).monday, null);
  assert.equal(sanity.normalizeContent({}).monday, null);
  assert.equal(sanity.normalizeSample({}).monday, null);
  assert.equal(sanity.normalizeContent({ monday: 'text' }).monday, null);

  const document = {
    _id: 'monday-status', _type: 'mondayStatus', _rev: 'a', connectedAs: 'Sam', lastSyncAt: '2026-10-08T14:00:00Z',
    boards: [{ _key: 'b', id: '1', name: 'A board', columns: [] }],
    snapshots: [{ _key: 'k', date: '2026-10-08', open: 7 }],
  };
  assert.deepEqual(sanity.normalizeContent({ monday: document }).monday, { lastSyncAt: '2026-10-08T14:00:00Z', lastError: '', snapshots: [{ date: '2026-10-08', open: 7 }] }, 'the boards and the name are left out');
});

test('tidyMondayStatus keeps the sync time, the last error and one count of open items for each day, oldest first, and cleaning twice changes nothing', () => {
  [null, undefined, [], 'text', 5].forEach(value => assert.equal(monday.tidyMondayStatus(value), null, String(value)));
  assert.deepEqual(monday.tidyMondayStatus({}), { lastSyncAt: '', lastError: '', snapshots: [] });

  const messy = monday.tidyMondayStatus({
    lastSyncAt: 'yesterday',
    lastError: 'x'.repeat(500),
    snapshots: [
      { date: '2026-10-03', open: 12 },
      { date: '2026-10-01', open: 15.4 },
      { date: '2026-10-02', open: 14 },
      { date: '2026-10-02', open: 13 },
      { date: 'October 4', open: 5 },
      { date: '2026-10-05', open: -1 },
      { date: '2026-10-06', open: '9' },
      { date: '2026-10-07', open: null },
      { open: 3 },
      7,
    ],
  });
  assert.equal(messy.lastSyncAt, '');
  assert.equal(messy.lastError.length, 300);
  assert.deepEqual(messy.snapshots, [{ date: '2026-10-01', open: 15 }, { date: '2026-10-02', open: 13 }, { date: '2026-10-03', open: 12 }]);
  assert.deepEqual(monday.tidyMondayStatus(messy), messy);

  const many = [];
  for (let day = 0; day < 150; day++) many.push({ date: new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10), open: day });
  const kept = monday.tidyMondayStatus({ snapshots: many }).snapshots;
  assert.equal(kept.length, 120);
  assert.equal(kept[0].open, 30, 'the oldest are dropped');
  assert.equal(kept[119].open, 149);

  assert.equal('sample' in monday.tidyMondayStatus({ sample: 'yes' }), false);
  assert.equal(monday.tidyMondayStatus({ sample: true }).sample, true);
});

test('the sample has only board tasks, six for both teams, nine for Prime and six for Nova, all in brackets and short enough for the Studio, and a status with 14 counts that ends at the open tasks', () => {
  const raw = sampleRaw();
  const boardTasks = raw.tasks.filter(task => task.source === 'monday');
  assert.equal(boardTasks.length, raw.tasks.length, 'the screen shows no other task');
  assert.deepEqual(Array.from(new Set(boardTasks.map(task => task.subteam))), ['[Subteam A]', '[Subteam C]', '[Subteam B]', '[Subteam E]', '[Subteam D]', '[Subteam F]']);
  assert.deepEqual([boardTasks.filter(task => task.team === 'prime').length, boardTasks.filter(task => task.team === 'nova').length, boardTasks.filter(task => task.team === undefined).length], [9, 6, 6]);
  const leadsOf = code => Array.from(new Set(boardTasks.filter(task => task.team === code).map(task => task.subteam)));
  assert.deepEqual(leadsOf('prime'), ['[Subteam A]', '[Subteam B]']);
  assert.deepEqual(leadsOf('nova'), ['[Subteam A]', '[Subteam B]', '[Subteam C]', '[Subteam D]', '[Subteam E]']);

  boardTasks.forEach(task => {
    ['title', 'subteam', 'mondayId', 'contact'].forEach(name => {
      if (task[name] !== undefined) assert.ok(/^\[.+\]$/.test(task[name]), task.title + ' ' + name + ' is in brackets');
    });
    assert.ok(task.title.length <= 22, task.title + ' fits the 22 characters of a task name');
    assert.ok(task.team === 'prime' || task.team === 'nova' || task.team === undefined, task.title + ' is for a team or for both teams');
    assert.equal(task.showOnTv, true);
    assert.ok(['up-next', 'in-progress', 'done'].includes(task.status), task.title);
    if (task.priority !== undefined) assert.ok(monday.priorities.includes(task.priority), task.title);
    if (task.dueDate !== undefined) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate), task.title);
  });

  assert.equal(raw.monday.sample, true);
  assert.equal(raw.monday.snapshots.length, 14);
  assert.equal(raw.monday.snapshots[13].open, boardTasks.filter(task => task.status !== 'done').length, 'the counts are those of all the tasks of the board, for both teams and for each');
  assert.equal(contentWith().monday.snapshots.length, 14);

  const content = contentWith();
  assert.ok(rotation.mondayCards(content, 'prime').length > 0, 'Prime has Monday rows');
  assert.ok(rotation.mondayCards(content, 'nova').length > 0, 'Nova has tasks of its own and the six for both teams, so it has a Monday pass');
  assert.equal(rotation.bothCards(content, ['prime', 'nova']).length, 2, 'so there is a pass of both teams');
});


// The tasks card

test('tasks are ranked high, medium, low and none, then the earliest due date, then the title, and equal tasks keep their order', () => {
  const list = [
    board({ title: 'none', dueDate: '2026-10-01' }),
    board({ title: 'low', priority: 'low' }),
    board({ title: 'medium', priority: 'medium', dueDate: '2026-10-01' }),
    board({ title: 'high no date', priority: 'high' }),
    board({ title: 'high late', priority: 'high', dueDate: '2026-10-20' }),
    board({ title: 'High soon b', priority: 'high', dueDate: '2026-10-10' }),
    board({ title: 'a high soon', priority: 'high', dueDate: '2026-10-10' }),
    board({ title: 'odd', priority: 'urgent', dueDate: '2026-09-01' }),
    board({ title: 'same', mondayId: '1' }),
    board({ title: 'same', mondayId: '2' }),
  ];
  const ranked = monday.rankTasks(list);

  assert.deepEqual(titlesOf(ranked), ['a high soon', 'High soon b', 'high late', 'high no date', 'medium', 'low', 'odd', 'none', 'same', 'same']);
  assert.deepEqual(ranked.slice(-2).map(task => task.mondayId), ['1', '2'], 'equal tasks keep the order they came in');
  assert.equal(titlesOf(list)[0], 'none', 'the list given is not changed');
  assert.deepEqual(monday.rankTasks([]), []);
  assert.equal(monday.dueDateOf({ dueDate: '2026-10-1' }), '', 'a date that is not a plain date is none');
  assert.equal(monday.dueDateOf({}), '');
});

test('the due soonest list puts the earliest date first, and equal dates in ranked order', () => {
  const list = [
    board({ title: 'late low', priority: 'low', dueDate: '2026-10-20' }),
    board({ title: 'soon low', priority: 'low', dueDate: '2026-10-14' }),
    board({ title: 'soon high', priority: 'high', dueDate: '2026-10-14' }),
    board({ title: 'sooner', dueDate: '2026-10-13' }),
  ];
  assert.deepEqual(titlesOf(monday.dueSoonestFirst(list)), ['sooner', 'soon high', 'soon low', 'late low']);
});

test('the card ranks the tasks of its page, and a task typed by hand is not one of them', () => {
  const content = contentOf([
    board({ title: 'board low', status: 'up-next', priority: 'low' }),
    board({ title: 'board high', status: 'up-next', priority: 'high' }),
    { title: 'typed', subteam: '[Subteam A]', status: 'up-next', team: 'prime' },
    board({ title: 'board med', status: 'up-next', priority: 'medium' }),
  ]);
  const html = panels.tasks.markupFor(content, monday12, 1);

  assert.ok(html.indexOf('>board high<') < html.indexOf('>board med<') && html.indexOf('>board med<') < html.indexOf('>board low<'));
  assert.equal(html.includes('typed'), false, 'the screen shows no task typed by hand');
  assert.equal(countOf(html, 'class="row"'), 3);
});

test('a task with Show on TV off, switched off, expired or for the other team never shows, and neither does one typed by hand', () => {
  const content = contentOf([
    board({ title: 'shown' }),
    board({ title: 'off tv', showOnTv: false }),
    board({ title: 'off', show: false }),
    board({ title: 'expired', expires: '2020-01-01T00:00:00.000Z' }),
    board({ title: 'nova only', team: 'nova' }),
    { title: 'pinned', subteam: '[Subteam A]', status: 'up-next' },
  ]);

  const html = panels.tasks.markupFor(content, monday12, 1);
  assert.ok(html.includes('>shown<'));
  ['off tv', 'off', 'expired', 'nova only', 'pinned'].forEach(title => assert.equal(html.includes('>' + title + '<'), false, title));

  onTeamScreen('nova', () => {
    const nova = panels.tasks.markupFor(content, monday12, 1);
    assert.ok(nova.includes('>nova only<'), 'a task for Nova shows on the Nova screen');
    ['shown', 'pinned'].forEach(title => assert.equal(nova.includes('>' + title + '<'), false, title));
  });
  assert.equal(monday.boardTasksFor(content, monday12, 'nova').length, 1, 'the question can be asked about a team that is not on the screen');
  assert.equal(monday.tasksFor(content, monday12).length, 1, 'the reader drops the task typed by hand, so only the one shown is left for Prime');
});

test('there is one page for each lead entry that has tasks, in the order of the Team leads list, and a name is matched without regard to capitals', () => {
  const content = contentOf([
    board({ title: 'c task', subteam: '[Subteam C]' }),
    board({ title: 'a task', subteam: ' [SUBTEAM A] ' }),
    board({ title: 'x task', subteam: '[No such lead]' }),
    board({ title: 'blank task', subteam: '' }),
    board({ title: 'e task', subteam: '[Subteam E]', showOnTv: false }),
  ], ['[Subteam A]', '[Subteam B]', '[Subteam C]', '[Subteam D]', '[Subteam E]']);

  assert.deepEqual(monday.groupByLead(monday.tasksFor(content, monday12), monday.leadEntries(content, monday12)).map(group => group.name), ['[Subteam A]', '[Subteam C]']);
  assert.equal(panels.tasks.hasContent(content, 1) && panels.tasks.hasContent(content, 2), true);
  assert.equal(panels.tasks.hasContent(content, 3), false);
  assert.ok(panels.tasks.markupFor(content, monday12, 1).includes('>a task<'));
  assert.ok(panels.tasks.markupFor(content, monday12, 2).includes('>c task<'));
  assert.deepEqual(rotation.mondayCards(content, 'prime'), [
    { panel: 'monday-tasks', show: true, page: 1 },
    { panel: 'monday-tasks', show: true, page: 2 },
    { panel: 'monday-milestones', show: true },
    { panel: 'monday-progress', show: true },
  ]);
});

test('a lead entry that is switched off, expired, for the other team, or has the same name as one before it makes no page of its own', () => {
  const content = contentWith(raw => {
    raw.tasks = [board({ title: 'a task' }), board({ title: 'b task', subteam: '[Subteam B]' }), board({ title: 'c task', subteam: '[Subteam C]' }), board({ title: 'd task', subteam: '[Subteam D]' })];
    raw.subteams = [
      { name: '[Subteam A]' },
      { name: '[subteam a]', lead: 'twice' },
      { name: '[Subteam B]', show: false },
      { name: '[Subteam C]', expires: '2020-01-01T00:00:00.000Z' },
      { name: '[Subteam D]', team: 'nova' },
    ];
  });
  assert.deepEqual(monday.groupByLead(monday.tasksFor(content, monday12), monday.leadEntries(content, monday12)).map(group => group.name), ['[Subteam A]']);
  assert.deepEqual(monday.leadEntries(content, monday12).map(entry => entry.name), ['[Subteam A]']);
});

test('the header reads the department and TEAM, the name of the team is in a chip, and tasks for both teams have no chip', () => {
  const content = contentOf([board({ title: 'a', subteam: 'Build' }), board({ title: 'b', subteam: 'Electrical' }), board({ title: 'c', subteam: 'Safety Team' })], ['Build', 'Electrical', 'Safety Team']);
  const chipOf = html => /<span class="team-chip">([^<]*)<\/span>/.exec(html)[1];

  assert.deepEqual([1, 2, 3].map(page => titleOf(panels.tasks.markupFor(content, monday12, page))), ['BUILD TEAM', 'ELECTRICAL TEAM', 'SAFETY TEAM']);
  assert.deepEqual([1, 2, 3].map(page => chipOf(panels.tasks.markupFor(content, monday12, page))), ['PRIME', 'PRIME', 'PRIME']);
  assert.equal(draw.teamNameShown(), 'PRIME');

  const nova = contentOf([board({ title: 'a', subteam: 'Build', team: 'nova' })], ['Build']);
  onTeamScreen('nova', () => assert.equal(chipOf(panels.tasks.markupFor(nova, monday12, 1)), 'NOVA'));

  const shared = contentOf([board({ title: 'a', subteam: 'Build', team: '' })], ['Build']);
  assert.equal(panels.tasks.markupFor(shared, monday12, 1).includes('team-chip'), false, 'a board task for both teams makes a page for both, with no chip');
  assert.ok(panels.tasks.markupFor(content, monday12, 1).includes('<h2 class="title" data-slat="title">BUILD TEAM</h2>'), 'a name is never markup, and the title is plain text');
  assert.ok(draw.departmentHeader('<b>x', 'PRIME', null, monday12).includes('&lt;B&gt;X TEAM'), 'a name is never markup');
  assert.equal(dashes.test(draw.departmentHeader('Build', 'PRIME', { lastSyncAt: '2026-10-12T15:56:00Z' }, monday12)), false, 'the dot is a middle dot, and no dash is used');
});

test('the numbers under the columns count the lead\'s open tasks, the open tasks that are past due, and the done ones', () => {
  const tasks = [
    board({ status: 'up-next', dueDate: '2026-10-11' }),
    board({ status: 'in-progress', dueDate: '2026-10-12' }),
    board({ status: 'in-progress', dueDate: '2026-10-01' }),
    board({ status: 'blocked' }),
    board({ status: 'done', dueDate: '2026-09-01' }),
    board({ status: 'up-next' }),
  ];
  assert.deepEqual(panels.tasks.factsOf(tasks, '2026-10-12'), [{ label: 'OVERDUE', value: 2 }, { label: 'OPEN', value: 5 }, { label: 'DONE', value: 1 }]);
  assert.deepEqual(panels.tasks.factsOf([], '2026-10-12').map(fact => fact.value), [0, 0, 0]);

  const html = panels.tasks.markupFor(contentOf(tasks), monday12, 1);
  assert.ok(html.includes('<div class="fact-label">OVERDUE</div><div class="fact-number">2</div>'));
});

test('a card with no tasks says so in one plain sentence that says why', () => {
  const content = contentOf([]);
  const html = panels.tasks.markupFor(content, monday12, 1);

  assert.ok(html.includes('<p class="empty">No board is chosen yet.</p>'));
  assert.equal(titleOf(html), 'TASKS');
  assert.equal(panels.tasks.hasContent(content, 1), false);
  assert.equal(countOf(html, 'class="row"'), 0);

  const chosen = contentOf([], null, raw => { raw.settings.mondayBoards = [{ boardId: '[board]' }]; delete raw.monday; });
  assert.ok(panels.tasks.markupFor(chosen, monday12, 1).includes('<p class="empty">Waiting for the first sync from the board.</p>'));
  const synced = contentOf([], null, raw => { raw.settings.mondayBoards = [{ boardId: '[board]' }]; });
  assert.ok(panels.tasks.markupFor(synced, monday12, 1).includes('<p class="empty">Nothing on the chosen boards is showing yet.</p>'));
});


// The milestones card

test('a due date is in this week, next week or later, counting weeks from Monday, and a date before this week is in this week', () => {
  const week = panels.milestones.weekIndexOf;

  // today is Sunday October 11 2026, the last day of its week
  assert.deepEqual(['2026-10-05', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-18', '2026-10-19'].map(date => week(date, '2026-10-11')), [0, 0, 0, 1, 1, 2]);
  // today is Monday October 12, the first day of its week
  assert.deepEqual(['2026-10-11', '2026-10-12', '2026-10-18', '2026-10-19', '2026-10-25', '2026-10-26'].map(date => week(date, '2026-10-12')), [0, 0, 0, 1, 1, 2]);
  // the weeks go on over the new year, and over the 29th of February
  assert.deepEqual(['2027-01-03', '2027-01-04', '2027-01-10', '2027-01-11'].map(date => week(date, '2026-12-28')), [0, 1, 1, 2]);
  assert.deepEqual(['2028-02-29', '2028-03-05', '2028-03-06'].map(date => week(date, '2028-02-28')), [0, 0, 1]);
  // every day of a week is in the same column
  for (let day = 12; day <= 18; day++) assert.equal(week('2026-10-' + day, '2026-10-14'), 0, 'October ' + day);
});

test('the time zone says which day it is, so the week turns over at midnight there and not by the clock of the computer', () => {
  const task = board({ title: 'monday task', dueDate: '2026-10-12' });
  const settle = zone => panels.milestones.milestonesFor(contentOf([task], null, raw => { raw.theme = Object.assign({}, raw.theme, { timeZone: zone }); }), at('2026-10-12T02:00:00Z'));

  // 10 PM on Sunday October 11 in New York, and 3 PM on Monday October 12 in Auckland
  const newYork = settle('America/New_York');
  assert.equal(newYork.today, '2026-10-11');
  assert.equal(newYork.rows[0].cells[0], null);
  assert.equal(newYork.rows[0].cells[1].title, 'monday task', 'the Monday is next week on Sunday evening in New York');

  const auckland = settle('Pacific/Auckland');
  assert.equal(auckland.today, '2026-10-12');
  assert.equal(auckland.rows[0].cells[0].title, 'monday task', 'and this week in Auckland, a day ahead');
  assert.equal(settle('Nowhere/Land').today, '2026-10-11', 'a zone that is not one is the Look page default');
});

test('a row has the soonest open task of the lead in this week and the next, a count of the tasks due later, and tasks that are done or have no due date are not in it', () => {
  const content = contentOf([
    board({ title: 'this late', dueDate: '2026-10-16' }),
    board({ title: 'this soon', dueDate: '2026-10-13', priority: 'low' }),
    board({ title: 'next', dueDate: '2026-10-22' }),
    board({ title: 'later', dueDate: '2026-12-01' }),
    board({ title: 'later too', dueDate: '2026-11-01' }),
    board({ title: 'later still', dueDate: '2027-01-01' }),
    board({ title: 'done', status: 'done', dueDate: '2026-10-12' }),
    board({ title: 'no date' }),
    board({ title: 'other lead', subteam: '[Subteam B]', dueDate: '2026-10-30' }),
    board({ title: 'hidden', dueDate: '2026-10-12', showOnTv: false }),
    { title: 'pinned', subteam: '[Subteam A]', status: 'up-next', dueDate: '2026-10-12' },
  ]);
  const found = panels.milestones.milestonesFor(content, monday12);

  assert.equal(found.today, '2026-10-12');
  assert.deepEqual(found.rows.map(row => row.name), ['[Subteam A]', '[Subteam B]']);
  assert.deepEqual(found.rows[0].cells.map(cell => cell && cell.title), ['this soon', 'next']);
  assert.equal(found.rows[0].later, 3, 'the three tasks that are due after next week');
  assert.deepEqual(found.rows[1].cells, [null, null]);
  assert.equal(found.rows[1].later, 1, 'a lead with only a later task has a row');
  assert.equal(found.more, 0);

  const html = panels.milestones.markupFor(content, monday12);
  assert.deepEqual(['THIS WEEK', 'NEXT'].map(label => html.includes('<div class="week-head">' + label + '</div>')), [true, true]);
  assert.equal(html.includes('LATER'), false, 'there is no column for later, only the chip');
  assert.ok(html.includes('<span class="cell-title">this soon</span><span class="cell-date">OCT 13</span>'));
  assert.ok(html.includes('<span class="later-chip">+3 later</span>') && html.includes('<span class="later-chip">+1 later</span>'));
  assert.equal(countOf(html, 'cell-empty'), 2, 'the two cells of the second lead, and the heading row has none');
  ['done', 'no date', 'hidden', 'this late', 'pinned'].forEach(title => assert.equal(html.includes('>' + title + '<'), false, title));

  const none = panels.milestones.markupFor(contentOf([board({ title: 'a', dueDate: '2026-10-13' })]), monday12);
  assert.equal(none.includes('later-chip'), false, 'no chip when nothing is due later');
});

test('a task that is already late is in this week, with its date marked late', () => {
  const html = panels.milestones.markupFor(contentOf([board({ title: 'behind', dueDate: '2026-10-05' }), board({ title: 'on time', subteam: '[Subteam B]', dueDate: '2026-10-14' })]), monday12);

  assert.ok(html.includes('<span class="cell-title">behind</span><span class="cell-date late">OCT 5</span>'));
  assert.ok(html.includes('<span class="cell-title">on time</span><span class="cell-date">OCT 14</span>'));
});

test('the card has five rows at most, and +N MORE says how many lead entries did not fit', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(letter => '[Lead ' + letter + ']');
  const content = count => contentOf(names.slice(0, count).map((name, index) => board({ title: 'task ' + index, subteam: name, dueDate: '2026-10-14' })), names);

  assert.equal(panels.milestones.mostRows, 5);
  const eight = panels.milestones.milestonesFor(content(8), monday12);
  assert.deepEqual([eight.rows.length, eight.more], [5, 3]);
  assert.deepEqual(eight.rows.map(row => row.name), names.slice(0, 5), 'the first five in the order of the Team leads list');
  assert.ok(panels.milestones.markupFor(content(8), monday12).includes('<div class="more">+3 MORE</div>'));

  const six = panels.milestones.markupFor(content(6), monday12);
  assert.ok(six.includes('+1 MORE'));
  const five = panels.milestones.markupFor(content(5), monday12);
  assert.equal(five.includes('MORE'), false, 'five fit, so there is nothing more');
  assert.equal(countOf(five, 'class="milestone-row"'), 6, 'the heading row and five rows');
});

test('a lead entry with nothing due is not a row, so it does not use one of the five', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'].map(letter => '[Lead ' + letter + ']');
  const tasks = names.map((name, index) => board({ title: 'task ' + index, subteam: name, dueDate: index === 0 ? '' : '2026-10-14' }));
  const found = panels.milestones.milestonesFor(contentOf(tasks, names), monday12);

  assert.deepEqual(found.rows.map(row => row.name), names.slice(1));
  assert.equal(found.more, 0);
});

test('with no due dates the card says so in one plain sentence', () => {
  const html = panels.milestones.markupFor(contentOf([board({ title: 'no date' }), board({ title: 'done', status: 'done', dueDate: '2026-10-14' })]), monday12);

  assert.ok(html.includes('<p class="empty">No open board items have a due date yet.</p>'));
  assert.equal(titleOf(html), 'MILESTONES');
  assert.equal(html.includes('week-head'), false);
});


// The progress card

test('each lead entry has one bar of its board tasks in the three stacks, and the bars are as long as the tasks are many', () => {
  const content = contentOf([
    board({ status: 'up-next' }), board({ status: 'in-progress' }), board({ status: 'in-progress' }), board({ status: 'done' }),
    board({ status: 'up-next', subteam: '[Subteam B]' }), board({ status: 'done', subteam: '[Subteam B]' }),
    board({ status: 'blocked', subteam: '[Subteam B]' }),
    { title: 'pinned', subteam: '[Subteam B]', status: 'up-next' },
  ]);
  const found = panels.progress.barsFor(content, monday12);

  assert.deepEqual(found.rows, [
    { name: '[Subteam A]', backlog: 1, progress: 2, done: 1, total: 4 },
    { name: '[Subteam B]', backlog: 1, progress: 0, done: 1, total: 2 },
  ]);
  assert.equal(found.more, 0);

  const html = panels.progress.markupFor(content, monday12);
  const bars = Array.from(html.matchAll(/<rect class="seg seg-(\w+)" x="(\d+)" y="0" width="(\d+)" height="44"\/>/g)).map(match => [match[1], Number(match[2]), Number(match[3])]);
  // the longest bar is 206 wide and the others in proportion, each stack after the one before, each ending where the count so far says
  assert.deepEqual(bars, [['backlog', 0, 52], ['progress', 52, 103], ['done', 155, 51], ['backlog', 0, 52], ['done', 52, 51]]);
  assert.deepEqual(Array.from(html.matchAll(/<span class="department">([^<]*)<\/span>/g)).map(match => match[1]), ['[SUBTEAM A]', '[SUBTEAM B]']);
  assert.deepEqual(Array.from(html.matchAll(/<span class="count">([^<]*)<\/span>/g)).map(match => match[1]), ['1/4', '1/2'], 'done out of all, at the right of each bar');
  assert.equal(countOf(html, 'class="swatch'), 3, 'a square for each stack in the legend');
  ['BACKLOG', 'IN PROGRESS', 'DONE'].forEach(label => assert.ok(html.includes('</span>' + label + '</span>'), label));
  assert.ok(html.includes('<div class="totals">5 OPEN · 0 OVERDUE</div>'), 'the totals of the team, under the bars: every task of its entries that is not done, as the tasks card counts');
});

test('there are six bars at most, and a lead entry with no board tasks has none', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(letter => '[Lead ' + letter + ']');
  const content = contentOf(names.map(name => board({ subteam: name, status: 'in-progress' })).concat([{ title: 'pinned only', subteam: '[Lead A]' }]), names.concat(['[Lead Z]']));
  const found = panels.progress.barsFor(content, monday12);

  assert.deepEqual([found.rows.length, found.more], [6, 2]);
  assert.ok(panels.progress.markupFor(content, monday12).includes('<div class="more">+2 MORE</div>'));
  assert.equal(panels.progress.markupFor(content, monday12).includes('[LEAD Z]'), false);
  assert.equal(panels.progress.barsFor(contentOf([board({ subteam: names[0] }), board({ subteam: names[1], showOnTv: false })], names), monday12).rows.length, 1);
  assert.equal(panels.progress.markupFor(contentOf([board({ subteam: names[0] })], names), monday12).includes('class="more"'), false);
});

test('the line has at most 12 points taken evenly from the first count to the last, and one for each count when there are fewer', () => {
  const list = count => Array.from({ length: count }, (nothing, index) => ({ date: new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10), open: 100 - index }));

  assert.equal(panels.progress.mostPoints, 12);
  assert.deepEqual(panels.progress.thinOut(list(5), 12), list(5));
  assert.deepEqual(panels.progress.thinOut(list(12), 12), list(12));
  [13, 14, 30, 120].forEach(count => {
    const thin = panels.progress.thinOut(list(count), 12);
    assert.equal(thin.length, 12, count + ' counts');
    assert.deepEqual([thin[0], thin[11]], [list(count)[0], list(count)[count - 1]], 'both ends are kept');
    assert.deepEqual(thin.map(item => item.date).slice().sort(), thin.map(item => item.date), 'in order');
    assert.equal(new Set(thin.map(item => item.date)).size, 12, 'none twice');
  });

  const content = contentWith(raw => { raw.monday.snapshots = list(120).map(item => Object.assign({ _key: 'k' }, item)); });
  assert.equal(panels.progress.lineFor(content, monday12).points.length, 12);
  assert.equal(countOf(panels.progress.markupFor(content, monday12), '<circle class="dot"'), 12);
  assert.equal(/<polyline class="line" points="([^"]+)"/.exec(panels.progress.markupFor(content, monday12))[1].split(' ').length, 12);
});

test('the line is drawn by the day, higher for more items left, with a dashed target line from the first count to nothing on the date of the countdown', () => {
  const line = panels.progress.lineFor(contentWith(), monday12);
  const first = line.points[0];
  const last = line.points[line.points.length - 1];

  // the sample counts run from September 25 to October 8, and the countdown date is January 9 2027, 106 days after the first
  assert.deepEqual([first.date, first.open, last.date, last.open], ['2026-09-25', 30, '2026-10-08', 16]);
  assert.deepEqual([first.x, first.y], [724, 208], 'the first count is at the left end and the highest count at the top of the plot');
  assert.equal(last.x, Math.round(724 + (13 / 106) * 352));
  assert.equal(last.y, Math.round(440 - (16 / 30) * 232));
  line.points.slice(1).forEach((point, index) => assert.ok(point.x > line.points[index].x && point.y >= line.points[index].y, 'to the right, and lower or level'));

  assert.deepEqual(line.target, { x1: first.x, y1: first.y, x2: 1076, y2: 440 });
  assert.equal(line.endDate, '2027-01-09');
  assert.equal(line.label, 'KICKOFF');

  const html = panels.progress.markupFor(contentWith(), monday12);
  assert.ok(html.includes('<line class="target" x1="724" y1="208" x2="1076" y2="440"/>'));
  assert.ok(html.includes('>ITEMS LEFT</text>') && html.includes('>TO KICKOFF</text>'));
  assert.ok(html.includes('>SEP 25</text>') && html.includes('>JAN 9</text>'), 'the dates of the two ends');
  assert.ok(html.includes('>16</text>'), 'the count now');
});

test('a gap of days is a gap in the line, and a countdown date that has passed leaves the target line out', () => {
  const content = (snapshots, settings) => contentWith(raw => {
    raw.monday.snapshots = snapshots;
    if (settings) raw.settings.countdown = settings;
  });
  // the countdown is 100 days after the first count, so a day is 3.52 along the line
  const gap = panels.progress.lineFor(content([{ date: '2026-10-01', open: 10 }, { date: '2026-10-02', open: 9 }, { date: '2026-10-10', open: 4 }]), monday12);
  assert.deepEqual(gap.points.map(point => point.x), [724, 728, 756], 'one day, then eight days, which is a longer step');

  const past = panels.progress.lineFor(content([{ date: '2026-10-01', open: 10 }, { date: '2026-10-10', open: 4 }], { kickoffLabel: 'KICKOFF IN', kickoff: '2026-10-05T12:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' }), monday12);
  assert.equal(past.target, null);
  assert.equal(past.points[1].x, 1076, 'the last count is at the right end');
  assert.equal(past.label, '');
  const noDates = content([{ date: '2026-10-01', open: 10 }, { date: '2026-10-10', open: 4 }]);
  noDates.settings.countdown.kickoff = '';
  assert.equal(panels.progress.markupFor(noDates, monday12).includes('class="target"'), false, 'no date at all, no target');

  const rollout = panels.progress.lineFor(content([{ date: '2026-10-01', open: 10 }, { date: '2026-10-10', open: 4 }], { kickoffLabel: 'KICKOFF IN', kickoff: '2026-01-09T12:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '2027-03-01T12:00:00.000Z' }), monday12);
  assert.equal(rollout.label, 'ROLLOUT', 'the next date of the countdown, which is Rollout once Kickoff has passed');
  assert.equal(rollout.endDate, '2027-03-01');
});

test('with fewer than two counts there is no line, and a sentence stands in its place while the bars stay', () => {
  [[], [{ date: '2026-10-08', open: 7 }]].forEach(snapshots => {
    const content = contentWith(raw => { raw.monday.snapshots = snapshots; });
    assert.equal(panels.progress.lineFor(content, monday12), null);

    const html = panels.progress.markupFor(content, monday12);
    assert.equal(html.includes('<polyline') || html.includes('<circle') || html.includes('class="target"'), false);
    assert.ok(html.includes('>Items left needs</text>') && html.includes('>counts from two</text>') && html.includes('>days or more.</text>'));
    assert.ok(html.includes('class="seg seg-backlog"'), 'the bars are still drawn');
  });

  const none = contentWith(raw => { delete raw.monday; });
  assert.equal(none.monday, null);
  assert.equal(panels.progress.lineFor(none, monday12), null);
  assert.ok(panels.progress.markupFor(none, monday12).includes('>Items left needs</text>'));
  assert.deepEqual(panels.progress.wrapWords('Items left needs counts from two days or more.', 17), ['Items left needs', 'counts from two', 'days or more.']);
  assert.deepEqual(panels.progress.wrapWords('word', 17), ['word']);
});

test('with no board tasks the card says so in one plain sentence, and a pinned task is not a board task', () => {
  const html = panels.progress.markupFor(contentOf([{ title: 'pinned', subteam: '[Subteam A]', status: 'up-next' }]), monday12);

  assert.ok(html.includes('<p class="empty">No board is chosen yet.</p>'));
  assert.equal(titleOf(html), 'PROGRESS');
  assert.equal(html.includes('<svg class="chart"'), false);
});


// What the cards share

test('a card mounts into its host as one section, the way the other panels do, with a header, a tag and one slat for the body', () => {
  const content = contentWith();
  cardNames.forEach(name => {
    const html = hostFor(panels[name], content, 1);
    assert.ok(new RegExp('^<section class="page monday monday-' + name + '"( data-scroll-page="1")?>').test(html.trim()), name);
    assert.ok(html.trim().endsWith('</section>'));
    assert.equal(countOf(html, '<section'), 1);
    assert.equal(countOf(html, 'data-slat="title"'), 1);
    assert.equal(countOf(html, 'data-slat="tag"'), 1);
    assert.equal(countOf(html, 'data-slat="item"'), 1, 'the body is one slat');
    assert.equal(typeof panels[name].mount, 'function');
  });
  ['milestones', 'progress', 'milestones-both', 'progress-both'].forEach(name => assert.equal('hasContent' in panels[name], false, name + ': the look rotation chooses it, so it always draws'));
  assert.equal(typeof panels.tasks.hasContent, 'function', 'the tasks card says whether it has a page for a lead entry');
  ['tasks', 'milestones-both', 'progress-both'].forEach(name => assert.equal(typeof panels[name].scrollPages, 'function', name + ' says how many pages it holds for'));
  ['milestones', 'progress'].forEach(name => assert.equal('scrollPages' in panels[name], false, name + ' does not scroll'));
});

test('the header says how long ago the board was read, SAMPLE for the sample, and leaves it out when the time is not known', () => {
  const now = at('2026-10-12T16:00:00Z');
  const status = change => Object.assign({ lastSyncAt: '2026-10-12T15:56:00Z' }, change);

  assert.equal(draw.agoWords(status(), now), '4 MIN AGO');
  assert.equal(draw.agoWords(status({ lastSyncAt: '2026-10-12T15:59:50Z' }), now), 'NOW');
  assert.equal(draw.agoWords(status({ lastSyncAt: '2026-10-12T15:01:00Z' }), now), '59 MIN AGO');
  assert.equal(draw.agoWords(status({ lastSyncAt: '2026-10-12T15:00:00Z' }), now), '1 HR AGO');
  assert.equal(draw.agoWords(status({ lastSyncAt: '2026-10-12T12:00:00Z' }), now), '4 HR AGO');
  assert.equal(draw.agoWords(status({ lastSyncAt: '2026-10-08T12:00:00Z' }), now), '4 DAYS AGO');
  assert.equal(draw.agoWords(status({ lastSyncAt: '2026-10-12T16:30:00Z' }), now), 'NOW', 'a time ahead of the clock is not negative');
  assert.equal(draw.agoWords(status({ sample: true }), now), 'SAMPLE');
  assert.equal(draw.agoWords(status({ lastSyncAt: '' }), now), '');
  assert.equal(draw.agoWords(null, now), '');

  const agoOf = (content, at) => { const found = /<span class="ago">([^<]*)<\/span>/.exec(panels.progress.markupFor(content, at)); return found ? found[1] : null; };
  const real = change => contentWith(raw => { delete raw.monday.sample; Object.assign(raw.monday, change); });
  assert.equal(agoOf(real({ lastSyncAt: '2026-10-12T15:56:00Z' }), now), '4 MIN AGO', 'BOARD · is in front of it when there is room, and with PRIME and the slashes there is not');
  assert.equal(agoOf(real({ lastSyncAt: '' }), now), null);
  assert.equal(agoOf(contentWith(raw => { delete raw.monday; }), now), null);
});

test('no card has a dash in what it writes, and a name from the board is never markup', () => {
  const content = contentOf([board({ title: '<b>bold</b> & more', subteam: '<u>lead</u>', priority: 'high', contact: '<i>x</i>', dueDate: '2026-10-14' })], ['<u>lead</u>']);

  cardNames.forEach(name => {
    const html = panels[name].markupFor(content, monday12, 1);
    assert.equal(dashes.test(html), false, name);
    assert.equal(/<(b|u|i)>/.test(html), false, name + ' has markup from a name');
  });
  ['core/monday.js', 'core/monday-draw.js'].concat(cardIds.map(id => 'panels/' + id + '/' + id + '.js'), cardIds.map(id => 'panels/' + id + '/' + id + '.css')).forEach(file => {
    assert.equal(dashes.test(read(file)), false, file + ' has an em or en dash');
  });
});

test('the cards are not given a team: the team on the screen decides, as for every other panel', () => {
  ['core/monday.js', 'core/monday-draw.js'].concat(cardIds.map(id => 'panels/' + id + '/' + id + '.js')).forEach(file => {
    assert.equal(/\bshowsForTeam\b/.test(read(file)), false, file + ' does not judge the team itself');
  });
  assert.ok(read('core/monday.js').includes('visibleItems('));
  assert.equal(contentModule.visibleItems([{ team: 'nova' }, { team: '' }, { team: 'prime' }], monday12).length, 2, 'the screen team is still the default');
  assert.equal(contentModule.visibleItems([{ team: 'nova' }, { team: '' }, { team: 'prime' }], monday12, 'nova').length, 2);
  assert.deepEqual(contentModule.visibleItems([{ team: 'nova', n: 1 }, { team: 'prime', n: 2 }], monday12, 'nova').map(item => item.n), [1]);
});


// The look rotation hook

test('a team has the Monday cards when it has board tasks that show on the TV, and not otherwise', () => {
  const content = contentOf([board({ title: 'a' }), board({ title: 'b', status: 'done' })]);
  const steps = [{ panel: 'monday-tasks', show: true, page: 1 }, { panel: 'monday-milestones', show: true }, { panel: 'monday-progress', show: true }];

  assert.deepEqual(rotation.mondayCards(content, 'prime'), steps);
  assert.deepEqual(rotation.mondayCards(content, 'nova'), [], 'tasks for Prime are not Nova\'s');
  assert.equal(rotation.mondayCards(contentOf([board({ team: '' })]), 'nova').length, 3, 'a task for both teams is each team\'s');

  assert.deepEqual(rotation.mondayCards(contentOf([]), 'prime'), []);
  assert.deepEqual(rotation.mondayCards(contentOf([{ title: 'pinned', subteam: '[Subteam A]', status: 'up-next', team: 'prime' }]), 'prime'), [], 'a pinned task is not a board row');
  assert.deepEqual(rotation.mondayCards(contentOf([board({ showOnTv: false })]), 'prime'), [], 'a row with Show on TV off is not one either');
  assert.deepEqual(rotation.mondayCards(contentOf([board({ show: false })]), 'prime'), []);
  assert.deepEqual(rotation.mondayCards(contentOf([board({ expires: '2020-01-01T00:00:00.000Z' })]), 'prime'), []);
  assert.equal(rotation.mondayCards(contentOf([board({ status: 'done' })]), 'prime').length, 3, 'any status counts');
  [null, undefined, {}, [], 'text'].forEach(value => assert.deepEqual(rotation.mondayCards(value, 'prime'), [], String(value)));
  assert.deepEqual(rotation.mondayCards(content, ''), [], 'a team code that is empty has no rows of its own');
  assert.deepEqual(monday.mondaySteps(content, 'prime', monday12), steps);
});

test('a Monday pass of a team with board rows has a page of the tasks card for each lead entry that has tasks, and every step is one the screen can show', () => {
  const content = contentWith();
  const steps = rotation.mondayCards(content, 'prime');

  // the six tasks for both teams are for six lead entries, and the tasks of Prime and of Nova are for entries among those
  const sixPages = ['monday-tasks 1', 'monday-tasks 2', 'monday-tasks 3', 'monday-tasks 4', 'monday-tasks 5', 'monday-tasks 6', 'monday-milestones', 'monday-progress'];
  assert.deepEqual(steps.map(step => step.panel + (step.page ? ' ' + step.page : '')), sixPages);
  assert.deepEqual(rotation.mondayCards(content, 'nova').map(step => step.panel + (step.page ? ' ' + step.page : '')), sixPages);
  steps.forEach(step => {
    const entry = registry.panels.filter(panel => panel.id === step.panel)[0];
    assert.ok(entry && entry.region === 'grid1', step.panel + ' is a panel of the large frame');
    assert.equal(step.show, true);
    assert.ok(step.page === undefined || panels.tasks.hasContent(content, step.page), step.panel + ' ' + step.page + ' has a lead entry');
    assert.ok(typeof panels[step.panel.replace('monday-', '')].mount === 'function');
  });
  assert.equal(panels.tasks.hasContent(content, 7), false, 'and there is no page past the last');
});


// The stylesheets

// The rules of a stylesheet, one for each selector, as selector -> text of the rule
function rulesOf(css) {
  const rules = {};
  Array.from(css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)).forEach(match => {
    match[1].split(',').forEach(selector => {
      const key = selector.trim();
      rules[key] = (rules[key] ? rules[key] + ' ' : '') + match[2];
    });
  });
  return rules;
}

const tokens = {};
Array.from(read('tokens.css').matchAll(/--(size-[a-z-]+):\s*(\d+)px;/g)).forEach(match => { tokens[match[1]] = Number(match[2]); });

// The size in pixels of a font declaration: font: 600 var(--size-label)/48px var(--font-display);
function fontOf(rule) {
  const found = /font:\s*(\d+)\s+(var\(--(size-[a-z-]+)\)|(\d+)px)\/(\d+)px\s+var\(--(font-[a-z]+)\)/.exec(rule);
  if (!found) return null;
  return { weight: Number(found[1]), size: found[3] ? tokens[found[3]] : Number(found[4]), line: Number(found[5]), family: found[6] };
}

const pixels = (rule, property) => Number(new RegExp('(?:^|[;\\s])' + property + ':\\s*(\\d+)px').exec(rule)[1]);

// The sizes under 44px that the order for the Monday cards sets, and only these. The status of a row is a colored
// label and not text to read, the first name of the owner is 40, and the labels of the numbers and of a department are 36. The date
// in a cell of the milestones card is 36 as well, muted like the date of a legend row of the season timeline.
const smaller = { '.monday-tasks .status': 30, '.monday-tasks .owner': 40, '.monday-tasks .fact-label': 36, '.monday .department': 36, '.monday-milestones .milestone-lead': 36, '.monday-milestones .cell-date': 36 };

test('nothing on a card is smaller than 44px except the sizes the order sets, no line is thinner than 3px, and the stylesheets have no animation, blur or shadow', () => {
  assert.equal(tokens['size-label'], 44);
  const seen = {};

  ['monday.css'].concat(cardIds.map(id => 'panels/' + id + '/' + id + '.css')).forEach(file => {
    const css = read(file);
    const rules = rulesOf(css);

    assert.ok(Array.from(css.matchAll(/font[a-z-]*:[^;]*;/g)).length >= 1, file + ' has text');
    Object.keys(rules).forEach(selector => {
      Array.from(rules[selector].matchAll(/font[a-z-]*:[^;]*;/g)).map(match => match[0]).forEach(declaration => {
        assert.ok(!declaration.startsWith('font-size'), file + ' sets a size by font-size: ' + declaration);
        const font = fontOf(declaration);
        assert.ok(font, file + ' has a font line that cannot be read: ' + declaration);
        assert.ok(font.line >= font.size, file + ' has a line height under its size: ' + declaration);
        if (selector in smaller) {
          assert.equal(font.size, smaller[selector], file + ' ' + selector);
          seen[selector] = true;
        } else {
          assert.ok(font.size >= 44, file + ' has text of ' + font.size + 'px in ' + selector + ': ' + declaration);
        }
      });
    });
    Array.from(css.matchAll(/(?:stroke-width|border(?:-left|-bottom)?):\s*([\d.]+)/g)).forEach(match => assert.ok(Number(match[1]) === 0 || Number(match[1]) >= 3, file + ' has a line of ' + match[1] + 'px'));
    assert.equal(/@keyframes|transition:|animation:|transform|box-shadow|text-shadow|filter|blur|drop-shadow|background-image|url\(/.test(css), false, file + ' has an effect that is not allowed');
  });
  assert.deepEqual(Object.keys(seen).sort(), Object.keys(smaller).sort(), 'every size under 44px that is allowed is used, and no other is');

  cardIds.forEach(id => {
    const js = read('panels/' + id + '/' + id + '.js');
    assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(|@keyframes|transform/.test(js), false, id + ' has animation code');
    assert.equal(/font-size|style="/.test(js), false, id + ' sets a size or a style in its markup');
  });
  const shared = rulesOf(read('monday.css'));
  assert.ok(shared['.monday .header'] && shared['.monday .body'] && shared['.monday .empty'], 'monday.css styles the header, the body and the empty sentence');
  assert.equal(tokens['size-team'], 60);
  assert.equal(fontOf(shared['.monday .title']).size, 60, 'the title of a card is 60px');
  assert.equal(fontOf(shared['.monday .empty']).size, 56, 'a card says its sentence at the size of body text');
  assert.equal(/style="/.test(read('core/monday-draw.js')), false);
});

test('the tasks card fits the large panel: five rows of 84 and the numbers inside its body, which is clear of the frame and the cut corner', async () => {
  const shared = rulesOf(read('monday.css'));
  const rules = rulesOf(read('panels/monday-tasks/monday-tasks.css'));
  const body = shared['.monday .body'];
  const { textWidth } = await import(base + 'core/text-width.js');

  assert.deepEqual(['left', 'top', 'width', 'height'].map(name => pixels(body, name)), [24, 132, 1104, 544]);
  assert.ok(pixels(body, 'left') + pixels(body, 'width') <= 1148, 'inside the frame, which is 1152 wide with a 4px edge');

  // five rows of 84 in a window of 420, and the page is five rows, which is how far the list moves
  const row = pixels(rules['.monday-tasks .row'], 'height');
  assert.equal(row, 84);
  assert.equal(pixels(shared['.monday .rows-window'], 'height'), 5 * row);
  assert.equal(pixels(shared['.monday'], '--scroll-step'), 5 * row, 'a step of the list is five rows');

  // a row: the status 236 by 44, the title, the owner of 200 at the most and the priority of 36, with 16 between
  const gap = pixels(rules['.monday-tasks .row'], 'gap');
  const title = pixels(body, 'width') - pixels(rules['.monday-tasks .status'], 'width') - pixels(rules['.monday-tasks .owner'], 'max-width') - pixels(rules['.monday-tasks .priority'], 'width') - 3 * gap;
  assert.deepEqual([pixels(rules['.monday-tasks .status'], 'width'), pixels(rules['.monday-tasks .status'], 'height')], [236, 44]);
  assert.ok(title >= 550, 'the title has ' + title + 'px at least, which is 20 letters at 52px');
  assert.equal(fontOf(rules['.monday-tasks .row-title']).size, 52);
  assert.ok(fontOf(rules['.monday-tasks .status']).line <= 44);
  assert.ok(236 >= textWidth('IN PROGRESS', 700, 30) + 12, 'IN PROGRESS fits its label with 6px each side');

  // the numbers are under the rows and end inside the body, and the page marker is at the right
  const factsTop = pixels(rules['.monday-tasks .facts'], 'top');
  const factsHeight = fontOf(rules['.monday-tasks .fact-label']).line + fontOf(rules['.monday-tasks .fact-number']).line;
  assert.ok(factsTop >= 5 * row, 'the numbers are under the rows');
  assert.ok(factsTop + factsHeight <= pixels(body, 'height'), 'and end inside the body');
  assert.equal(fontOf(rules['.monday-tasks .fact-number']).size, 72);
  assert.equal(fontOf(rules['.monday-tasks .fact-label']).size, 36);

  const labelsWidth = ['OVERDUE', 'OPEN', 'DONE'].map(label => 16 + 4 + Math.max(textWidth(label, 600, 36), textWidth('100', 700, 72)));
  const factsRight = labelsWidth.reduce((sum, width) => sum + width, 0) + 2 * pixels(rules['.monday-tasks .facts'], 'gap');
  const markerLeft = pixels(body, 'width') - pixels(shared['.monday .marker'], 'right') - textWidth('1 OF 2 · 10 TASKS', 600, 44);
  assert.ok(factsRight <= markerLeft, 'the numbers (' + Math.round(factsRight) + ') end before the page marker (' + Math.round(markerLeft) + ')');

  // the cut corner at the bottom right of the frame runs from (1148, 640) to (1068, 704): the marker is clear of it
  const markerRight = pixels(body, 'left') + pixels(body, 'width') - pixels(shared['.monday .marker'], 'right');
  const markerHeight = 28 + 8 + fontOf(shared['.monday .place']).line;
  const bottom = pixels(body, 'top') + pixels(body, 'height') - Number(/bottom:\s*(\d+)/.exec(shared['.monday .marker'])[1]);
  const cutAt = y => 1148 - (Math.max(y, 640) - 640) / 64 * 80;
  assert.ok(markerRight <= cutAt(bottom) - 8, 'the page marker is clear of the cut corner');
  assert.ok(pixels(body, 'top') + 5 * row <= bottom - markerHeight, 'and under the rows');
});

test('the milestones card fits its body: the heading row, five rows of 84, the cells and the chip in a row, and the line that says how many more', async () => {
  const rules = rulesOf(read('panels/monday-milestones/monday-milestones.css'));
  const body = rulesOf(read('monday.css'))['.monday .body'];
  const { textWidth } = await import(base + 'core/text-width.js');
  const row = pixels(rules['.monday-milestones .milestone-row'], 'height');
  const head = pixels(rules['.monday-milestones .milestone-row:first-child'], 'height');

  assert.equal(row, 84);
  assert.equal(panels.milestones.mostRows, 5);
  assert.ok(head + 5 * row <= pixels(rules['.monday-milestones .more'], 'top'), 'the line for more is under the fifth row');
  assert.ok(pixels(rules['.monday-milestones .more'], 'top') + fontOf(rules['.monday-milestones .more']).line <= pixels(body, 'height'));
  assert.ok(pixels(rules['.monday-milestones .cell'], 'height') <= row);
  assert.equal(pixels(rules['.monday-milestones .cell'], 'height'), fontOf(rules['.monday-milestones .cell-title']).line + fontOf(rules['.monday-milestones .cell-date']).line, 'the title and the date fill the cell');
  assert.equal(fontOf(rules['.monday-milestones .cell-title']).size, 44, 'the title is one line of 44px');
  assert.equal(fontOf(rules['.monday-milestones .milestone-lead']).size, 36);

  // the columns: 330 for the department, two cells, 230 for the chip, with 12 between the four
  const columns = /grid-template-columns:\s*(\d+)px repeat\(2, minmax\(0, 1fr\)\) (\d+)px/.exec(rules['.monday-milestones .milestone-row']);
  const gap = pixels(rules['.monday-milestones .milestone-row'], 'column-gap');
  assert.deepEqual([Number(columns[1]), Number(columns[2]), gap], [330, 230, 12]);
  const cell = (pixels(body, 'width') - 330 - 230 - 3 * gap) / 2;
  assert.equal(cell, 254);
  assert.ok(330 >= textWidth('PROGRAMMING', 700, 36) + 8 && 330 >= textWidth('ELECTRICAL', 700, 36) + 8, 'PROGRAMMING and ELECTRICAL fit the department column without an ellipsis');
  // lower case is not in the table of text-width.js, so the word later is counted as 2.5 times its size, which is wider than it is
  assert.ok(230 >= 6 + 16 + textWidth('+3 ', 600, 44) + 2.5 * 44, '+3 later fits the chip column');
  assert.ok(textWidth('THIS WEEK', 600, 44) <= cell, 'THIS WEEK fits its column');
  assert.ok(pixels(body, 'left') + pixels(body, 'width') <= 1148);
});

test('the text of the line of the progress card stays inside its body and does not run into the text beside it, even with the longest labels', () => {
  const rules = rulesOf(read('panels/monday-progress/monday-progress.css'));
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(letter => 'Subteam ' + letter + 'W');
  const crowded = contentOf(names.map((name, index) => board({ subteam: name, status: ['up-next', 'in-progress', 'done'][index % 3] })).concat(names.map(name => board({ subteam: name, status: 'done' }))), names, raw => {
    raw.monday.snapshots = Array.from({ length: 30 }, (nothing, index) => ({ date: new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10), open: 188 - index }));
    raw.settings.countdown = { kickoffLabel: 'A VERY LONG LABEL IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  });
  const textsIn = html => Array.from(html.matchAll(/<text x="([^"]+)" y="([^"]+)" class="([^"]+)"(?: text-anchor="([^"]+)")?>([^<]*)<\/text>/g)).map(match => ({
    x: Number(match[1]), y: Number(match[2]), cssClass: match[3], anchor: match[4] || 'start', text: match[5],
  }));
  // A wide guess at how far a text reaches: a capital 0.72 of its size in the display font and 0.66 in the text font, a lower case
  // letter 0.58 and 0.52, a digit 0.62 and 0.58, a space 0.3 and 0.28, anything else 0.5
  const reachOf = (text, font) => {
    const display = font.family === 'font-display';
    const share = letter => {
      if (/[A-Z\[\]]/.test(letter)) return display ? 0.72 : 0.66;
      if (/[a-z]/.test(letter)) return display ? 0.58 : 0.52;
      if (/[0-9]/.test(letter)) return display ? 0.62 : 0.58;
      return letter === ' ' ? (display ? 0.3 : 0.28) : 0.5;
    };
    const width = Array.from(text.text).reduce((total, letter) => total + share(letter), 0) * font.size;
    const left = text.anchor === 'middle' ? text.x - width / 2 : text.anchor === 'end' ? text.x - width : text.x;
    return { left: left, right: left + width, top: text.y - font.size * 0.72, bottom: text.y + font.size * 0.1 };
  };

  const problems = [];
  [['sample', contentWith()], ['crowded', crowded]].forEach(entry => {
    const html = panels.progress.markupFor(entry[1], monday12);
    const reaches = textsIn(html).map(text => {
      const font = fontOf(rules['.monday-progress .' + text.cssClass.split(' ')[0]] || '');
      assert.ok(font, entry[0] + ': the class ' + text.cssClass + ' has no font');
      return { text: text, reach: reachOf(text, font) };
    });
    assert.ok(reaches.length >= 4, entry[0] + ' draws text');

    reaches.forEach(item => {
      if (item.reach.left < -1 || item.reach.right > 1097) problems.push(entry[0] + ': "' + item.text.text + '" runs ' + Math.round(item.reach.left) + ' to ' + Math.round(item.reach.right));
      if (item.reach.top < 0 || item.reach.bottom > 512) problems.push(entry[0] + ': "' + item.text.text + '" is outside the body at the top or bottom');
      if (item.reach.left < 700) problems.push(entry[0] + ': "' + item.text.text + '" is over the bars, which have the 700px at the left');
    });
    reaches.forEach((first, index) => reaches.slice(index + 1).forEach(second => {
      const across = Math.min(first.reach.right, second.reach.right) - Math.max(first.reach.left, second.reach.left);
      const down = Math.min(first.reach.bottom, second.reach.bottom) - Math.max(first.reach.top, second.reach.top);
      if (across > 2 && down > 4) problems.push(entry[0] + ': "' + first.text.text + '" runs into "' + second.text.text + '"');
    }));
  });
  assert.deepEqual(problems, []);
});

test('the progress card fits its body: the legend, six rows of 64, the line for more and the totals at the left, clear of the line at the right, and the names fit their column', async () => {
  const rules = rulesOf(read('panels/monday-progress/monday-progress.css'));
  const shared = rulesOf(read('monday.css'));
  const { textWidth } = await import(base + 'core/text-width.js');
  const bodyHeight = pixels(shared['.monday .body'], 'height');

  // from the top: the legend of 52, six rows of 64 from 56, the line for more under them, and the totals
  const row = pixels(rules['.monday-progress .bar-row'], 'height');
  const rowsTop = pixels(rules['.monday-progress .bars'], 'top');
  assert.equal(row, 64);
  assert.ok(pixels(rules['.monday-progress .legend'], 'height') <= rowsTop);
  assert.ok(rowsTop + panels.progress.mostRows * row <= pixels(rules['.monday-progress .more'], 'top'), 'the line for more is under the sixth row');
  assert.ok(pixels(rules['.monday-progress .more'], 'top') + fontOf(rules['.monday-progress .more']).line <= pixels(rules['.monday-progress .totals'], 'top'), 'and over the totals');
  assert.ok(pixels(rules['.monday-progress .totals'], 'top') + fontOf(rules['.monday-progress .totals']).line <= bodyHeight, 'which end inside the body');

  // a row is the department in 330 at 36px, the bar of 206 and the count of 140, with 12 between: all of the 700 the bars have
  const gap = pixels(rules['.monday-progress .bar-row'], 'gap');
  assert.equal(330 + 2 * gap + 206 + pixels(rules['.monday-progress .count'], 'width'), pixels(rules['.monday-progress .bars'], 'width'));
  assert.equal(pixels(shared['.monday .department'], 'width'), 330);
  assert.equal(fontOf(shared['.monday .department']).size, 36);
  assert.ok(/text-overflow: ellipsis/.test(shared['.monday .department']) && /white-space: nowrap/.test(shared['.monday .department']));
  ['PROGRAMMING', 'ELECTRICAL', 'MECHANICAL', 'BUSINESS'].forEach(name => assert.ok(textWidth(name, 700, 36) + 8 <= 330, name + ' fits without an ellipsis'));
  // the slash is not in the table, so it is counted at half of the size, which is more than it is
  assert.ok(textWidth('12', 700, 44) + textWidth('59', 700, 44) + 0.5 * 44 <= pixels(rules['.monday-progress .count'], 'width'), 'done out of all fits its place with two digits each');

  // the totals line is the shortest it can be and fits the 700 even with three digits in both numbers
  assert.equal(panels.progress.totalsText({ open: 66, overdue: 5 }), '66 OPEN · 5 OVERDUE');
  assert.ok(textWidth(panels.progress.totalsText({ open: 999, overdue: 999 }), 600, 44) <= 700);
  assert.deepEqual(panels.progress.totalsFor(contentOf([board({}), board({ status: 'done' }), board({ dueDate: '2026-10-01' }), board({ status: 'in-progress', dueDate: '2026-10-12' }), board({ status: 'done', dueDate: '2026-10-01' })]), monday12), { open: 3, overdue: 1 });

  // the legend does not wrap, and ends in the body. The legend is over the line's words, which start lower.
  assert.ok(/white-space: nowrap/.test(rules['.monday-progress .legend']));
  assert.ok(3 * (28 + 12) + textWidth('BACKLOG', 600, 44) + textWidth('IN PROGRESS', 600, 44) + textWidth('DONE', 600, 44) + 2 * 32 <= 1104, 'the legend fits in one line');
  assert.ok(pixels(rules['.monday-progress .legend'], 'height') < 124 - 44 * 0.72, 'and ends over the first word of the line, ITEMS LEFT');
});

test('the chart is 1096 by 512 at one pixel to the unit, and the geometry of the bars and the line stays inside it', () => {
  const html = panels.progress.markupFor(contentWith(), monday12);

  assert.ok(html.includes('<svg class="chart" width="1096" height="512" viewBox="0 0 1096 512"'));
  assert.equal(countOf(html, 'role="img"'), 1);
  assert.ok(/aria-label="Progress: [^"]+items left 16 on OCT 8"/.test(html), 'a screen reader gets the numbers');
  Array.from(html.matchAll(/ (?:x|x1|x2|cx)="(-?\d+)"/g)).forEach(match => assert.ok(Number(match[1]) >= 0 && Number(match[1]) <= 1096, 'x ' + match[1]));
  Array.from(html.matchAll(/ (?:y|y1|y2|cy)="(-?\d+)"/g)).forEach(match => assert.ok(Number(match[1]) >= 0 && Number(match[1]) <= 512, 'y ' + match[1]));
  const bars = Array.from(html.matchAll(/<rect class="seg seg-\w+" x="(\d+)" y="(\d+)" width="(\d+)" height="44"\/>/g));
  bars.forEach(match => assert.ok(Number(match[1]) + Number(match[3]) <= 224 + 324 && Number(match[2]) + 44 <= 512));
});

test('every class a card writes has a rule in its own stylesheet or in monday.css, and no class has a rule of its own in the stylesheets of the whole screen', () => {
  const sheets = ['base.css', 'frame.css', 'teams.css', 'neon-kit.css', 'tokens.css'];
  ['styles', 'layouts', 'themes', 'themes/overlays'].forEach(folder => fs.readdirSync(path.join(dashboardFolder, folder)).filter(file => file.endsWith('.css')).forEach(file => sheets.push(folder + '/' + file)));

  // the page, the double slash, the status marks and the chip with the name of a team are drawn by the screen's own stylesheets
  const shared = ['page', 'double-slash', 'monday', 'mark', 'outlined', 'cut', 'mark-up-next', 'mark-in-progress', 'mark-done', 'mark-blocked', 'team-chip'];
  const used = new Set();
  const contents = [contentWith(), contentOf([board({ priority: 'high', contact: 'Sam', dueDate: '2026-10-05' })]), contentOf([]), contentWith(raw => { raw.monday.snapshots = []; })];
  cardNames.forEach(name => {
    const own = new Set();
    contents.forEach(content => [1, 2].forEach(page => {
      Array.from(panels[name].markupFor(content, monday12, page).matchAll(/class="([^"]+)"/g)).forEach(match => match[1].split(' ').forEach(token => {
        used.add(token);
        own.add(token);
      }));
    }));
    const css = read('panels/monday-' + name + '/monday-' + name + '.css') + read('monday.css');
    own.forEach(token => {
      if (shared.includes(token) || token === 'monday-' + name) return;
      assert.ok(new RegExp('\\.' + token + '(?![\\w-])').test(css), 'monday-' + name + '.css and monday.css have no rule for ' + token);
    });
  });
  assert.ok(used.has('status') && used.has('seg') && used.has('empty') && used.has('row-title') && used.has('marker') && used.size > 40);

  const alone = [];
  sheets.forEach(file => {
    Object.keys(rulesOf(read(file))).forEach(selector => {
      const classes = Array.from(selector.matchAll(/\.([A-Za-z][\w-]*)/g)).map(match => match[1]);
      if (classes.length === 1 && used.has(classes[0]) && !shared.includes(classes[0])) alone.push(file + ': ' + selector);
    });
  });
  assert.deepEqual(alone, []);
  assert.ok(/\.team-chip \{/.test(read('base.css')), 'base.css has the chip, which the Roster, Leadership and Team leads headers use too');
});


// The docs

test('the docs say what each card shows, where the code is, and what the rotation does with the cards', () => {
  const layouts = fs.readFileSync(path.join(docsFolder, 'layouts.md'), 'utf8').replace(/\s+/g, ' ');
  const editing = fs.readFileSync(path.join(docsFolder, 'editing-content.md'), 'utf8').replace(/\s+/g, ' ');
  const where = fs.readFileSync(path.join(docsFolder, 'where-things-are.md'), 'utf8').replace(/\s+/g, ' ');

  assert.ok(layouts.includes('## The Monday cards'));
  ['monday-tasks', 'monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both', 'core/monday.js', 'BUILD TEAM', 'This week', '+3 later', '+N more', 'items left', 'Monday rows', 'Monday to Sunday', 'showOnTv', 'scrollPages', 'scrollCard'].forEach(word => assert.ok(layouts.includes(word), 'layouts.md names ' + word));
  assert.equal(layouts.includes('There are no Monday cards yet'), false, 'the old sentence that said there were none is gone');
  assert.ok(editing.includes('## The Monday cards'));
  ['Tasks card', 'Milestones card', 'Progress card', 'Show on TV', 'Monday rows', 'Both teams'].forEach(word => assert.ok(editing.includes(word), 'editing-content.md names ' + word));
  ['monday-tasks', 'monday-milestones', 'monday-progress', 'core/monday.js', 'test-monday-cards.mjs'].forEach(word => assert.ok(where.includes(word), 'where-things-are.md names ' + word));
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
