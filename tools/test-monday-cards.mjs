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

const cardNames = ['tasks', 'milestones', 'progress'];
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

test('the three cards are panels of the large frame, flagged monday in registry.js, with a script and a stylesheet each, and none is in the rotation lists of config.js', () => {
  const source = read('registry.js');
  cardIds.forEach(id => {
    assert.ok(source.includes("{ id: '" + id + "', region: 'grid1', topic: 'monday', monday: true },"), id);
    assert.ok(fs.existsSync(path.join(dashboardFolder, 'panels', id, id + '.js')) && fs.existsSync(path.join(dashboardFolder, 'panels', id, id + '.css')), id);
    assert.ok(!config.defaultSettings.rotation.grid1.some(step => step.panel === id), id + ' is not in a rotation list');
    assert.ok(!read('core/panel-order.js').includes(id), id);
  });
  assert.equal(countOf(source, 'monday: true'), 3);
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

test('the sample has board tasks for two lead entries, all in brackets and short enough for the Studio, and a status with 14 counts that ends at the open tasks', () => {
  const raw = sampleRaw();
  const boardTasks = raw.tasks.filter(task => task.source === 'monday');
  assert.deepEqual(Array.from(new Set(boardTasks.map(task => task.subteam))), ['[Subteam A]', '[Subteam B]']);

  boardTasks.forEach(task => {
    ['title', 'subteam', 'mondayId', 'contact'].forEach(name => {
      if (task[name] !== undefined) assert.ok(/^\[.+\]$/.test(task[name]), task.title + ' ' + name + ' is in brackets');
    });
    assert.ok(task.title.length <= 22, task.title + ' fits the 22 characters of a task name');
    assert.equal(task.team, 'prime');
    assert.equal(task.showOnTv, true);
    assert.ok(['up-next', 'in-progress', 'done'].includes(task.status), task.title);
    if (task.priority !== undefined) assert.ok(monday.priorities.includes(task.priority), task.title);
    if (task.dueDate !== undefined) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate), task.title);
  });

  assert.equal(raw.monday.sample, true);
  assert.equal(raw.monday.snapshots.length, 14);
  assert.equal(raw.monday.snapshots[13].open, boardTasks.filter(task => task.status !== 'done').length);
  assert.equal(contentWith().monday.snapshots.length, 14);

  const content = contentWith();
  assert.ok(rotation.mondayCards(content, 'prime').length > 0, 'Prime has Monday rows');
  assert.deepEqual(rotation.mondayCards(content, 'nova'), [], 'Nova has none, so it has no Monday pass');
});


// The tasks card

test('the three columns hold the up next, in progress and done tasks, and a blocked task has no column', () => {
  assert.deepEqual(monday.columns.map(column => [column.label, column.status]), [['BACKLOG', 'up-next'], ['IN PROGRESS', 'in-progress'], ['DONE', 'done']]);

  const found = monday.columnsOf([
    board({ title: 'a', status: 'up-next' }),
    board({ title: 'b', status: 'in-progress' }),
    board({ title: 'c', status: 'done' }),
    board({ title: 'd', status: 'blocked' }),
    board({ title: 'e', status: 'up-next' }),
  ]);
  assert.deepEqual(found.map(column => column.id), ['backlog', 'progress', 'done']);
  assert.deepEqual(found.map(column => titlesOf(column.shown)), [['a', 'e'], ['b'], ['c']]);
  assert.deepEqual(found.map(column => column.total), [2, 1, 1]);
});

test('each column has room for two cards, and says how many it has in all', () => {
  assert.equal(monday.cardsPerColumn, 2);
  const found = monday.columnsOf(['a', 'b', 'c', 'd', 'e'].map(title => board({ title: title, status: 'in-progress' })));

  assert.deepEqual(titlesOf(found[1].shown), ['a', 'b']);
  assert.equal(found[1].total, 5);
  assert.deepEqual([found[0].shown.length, found[0].total, found[2].shown.length], [0, 0, 0]);
});

test('tasks are ranked pinned first, then high, medium, low and none, then the earliest due date, and equal tasks keep their order', () => {
  const list = [
    board({ title: 'none', dueDate: '2026-10-01' }),
    board({ title: 'low', priority: 'low' }),
    board({ title: 'medium', priority: 'medium', dueDate: '2026-10-01' }),
    board({ title: 'high no date', priority: 'high' }),
    board({ title: 'high late', priority: 'high', dueDate: '2026-10-20' }),
    board({ title: 'high soon', priority: 'high', dueDate: '2026-10-10' }),
    { title: 'pinned low', status: 'up-next', priority: 'low' },
    board({ title: 'high soon too', priority: 'high', dueDate: '2026-10-10' }),
    board({ title: 'odd', priority: 'urgent', dueDate: '2026-09-01' }),
  ];
  const ranked = monday.rankTasks(list);

  assert.deepEqual(titlesOf(ranked), ['pinned low', 'high soon', 'high soon too', 'high late', 'high no date', 'medium', 'low', 'odd', 'none']);
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

test('the card puts the pinned task first in its column, and ranks the rest, so the two it shows are the top two', () => {
  const content = contentOf([
    board({ title: 'board high', status: 'up-next', priority: 'high' }),
    board({ title: 'board med', status: 'up-next', priority: 'medium' }),
    { title: 'pinned', subteam: '[Subteam A]', status: 'up-next', team: 'prime' },
    board({ title: 'board low', status: 'up-next', priority: 'low' }),
  ]);
  const html = panels.tasks.markupFor(content, monday12, 1);

  assert.ok(html.indexOf('>pinned<') < html.indexOf('>board high<'));
  assert.equal(html.includes('board med'), false, 'two cards fit, and the third task of the column is not drawn');
  assert.equal(html.includes('board low'), false);
  assert.equal(countOf(html, 'class="item"'), 2);
});

test('a task with Show on TV off, switched off, expired or for the other team never shows, whatever its source', () => {
  const content = contentOf([
    board({ title: 'shown' }),
    board({ title: 'off tv', showOnTv: false }),
    board({ title: 'off', show: false }),
    board({ title: 'expired', expires: '2020-01-01T00:00:00.000Z' }),
    board({ title: 'nova only', team: 'nova' }),
    { title: 'pinned off', subteam: '[Subteam A]', status: 'up-next', showOnTv: false },
    { title: 'pinned shown', subteam: '[Subteam A]', status: 'up-next' },
  ]);

  const html = panels.tasks.markupFor(content, monday12, 1);
  ['shown', 'pinned shown'].forEach(title => assert.ok(html.includes('>' + title + '<'), title));
  ['off tv', 'off', 'expired', 'nova only', 'pinned off'].forEach(title => assert.equal(html.includes('>' + title + '<'), false, title));

  onTeamScreen('nova', () => {
    const nova = panels.tasks.markupFor(content, monday12, 1);
    assert.ok(nova.includes('>nova only<') && nova.includes('>pinned shown<'), 'tasks for both teams show for Nova too');
    assert.equal(nova.includes('>shown<'), false, 'a task for Prime does not show on the Nova screen');
  });
  assert.equal(monday.boardTasksFor(content, monday12, 'nova').length, 1, 'the question can be asked about a team that is not on the screen');
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

test('the header reads BUILD TEAM, then a dot and the name of the team, and the team is the one on the screen', () => {
  const content = contentOf([board({ title: 'a', subteam: 'Build', team: '' }), board({ title: 'b', subteam: 'Electrical', team: '' }), board({ title: 'c', subteam: 'Safety Team', team: '' })], ['Build', 'Electrical', 'Safety Team']);

  assert.deepEqual([1, 2, 3].map(page => titleOf(panels.tasks.markupFor(content, monday12, page))), ['BUILD TEAM · PRIME', 'ELECTRICAL TEAM · PRIME', 'SAFETY TEAM · PRIME']);
  onTeamScreen('nova', () => assert.equal(titleOf(panels.tasks.markupFor(content, monday12, 1)), 'BUILD TEAM · NOVA'));
  assert.equal(draw.teamNameShown(), 'PRIME');
  assert.equal(draw.leadTitleMarkup('build', 'PRIME'), draw.leadTitleMarkup(' BUILD ', 'PRIME'), 'capitals and spaces do not matter');

  assert.ok(draw.leadTitleMarkup('Build', 'PRIME').includes('<span class="lead">BUILD</span>'));
  assert.ok(draw.leadTitleMarkup('Electrical', 'PRIME').includes('class="lead lead-long"'), 'a name of more than 7 letters is drawn smaller');
  assert.equal(draw.leadTitleMarkup('Drivers', 'PRIME').includes('lead-long'), false, 'seven letters fit at the size of a heading');
  assert.equal(draw.leadTitleMarkup('Strategy', 'PRIME').includes('lead-long'), true, 'eight do not');
  assert.ok(draw.leadTitleMarkup('<b>x', 'PRIME').includes('&lt;B&gt;X'), 'a name is never markup');
  assert.equal(dashes.test(draw.leadTitleMarkup('Build', 'PRIME')), false, 'the dot is a middle dot, and no dash is used');
});

test('a task card has its title, and the priority and the first name when it has them, and a name is never markup', () => {
  const content = contentOf([
    board({ title: 'with all', priority: 'high', contact: 'Sam' }),
    board({ title: 'plain' }),
    board({ title: '<i>x</i>', status: 'in-progress', priority: 'medium', contact: '<b>Al</b>' }),
    board({ title: 'low', status: 'done', priority: 'low' }),
    board({ title: 'odd priority', status: 'done', priority: 'urgent' }),
  ]);
  const html = panels.tasks.markupFor(content, monday12, 1);

  assert.ok(html.includes('<span class="chip chip-high">HIGH</span><span class="contact">Sam</span>'));
  assert.ok(html.includes('<span class="chip chip-medium">MED</span>'));
  assert.ok(html.includes('<span class="chip chip-low">LOW</span>'));
  assert.equal(html.includes('chip-urgent'), false, 'a priority that is not in the list has no chip');
  assert.ok(html.includes('<div class="item"><div class="item-title">plain</div></div>'), 'a card with neither has only its title');
  assert.equal(html.includes('<i>') || html.includes('<b>'), false);
  assert.ok(html.includes('&lt;i&gt;x&lt;/i&gt;'));
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

test('a card with no tasks says so in one plain sentence', () => {
  const content = contentOf([]);
  const html = panels.tasks.markupFor(content, monday12, 1);

  assert.ok(html.includes('<p class="empty">No tasks from the team board are showing yet.</p>'));
  assert.equal(titleOf(html), 'TASKS');
  assert.equal(panels.tasks.hasContent(content, 1), false);
  assert.equal(countOf(html, 'class="lane'), 0);
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

test('a row has the soonest open task of the lead in each week, and tasks that are done or have no due date are not in it', () => {
  const content = contentOf([
    board({ title: 'this late', dueDate: '2026-10-16' }),
    board({ title: 'this soon', dueDate: '2026-10-13', priority: 'low' }),
    board({ title: 'next', dueDate: '2026-10-22' }),
    board({ title: 'later', dueDate: '2026-12-01' }),
    board({ title: 'later too', dueDate: '2026-11-01' }),
    board({ title: 'done', status: 'done', dueDate: '2026-10-12' }),
    board({ title: 'no date' }),
    board({ title: 'other lead', subteam: '[Subteam B]', dueDate: '2026-10-30' }),
    board({ title: 'hidden', dueDate: '2026-10-12', showOnTv: false }),
  ]);
  const found = panels.milestones.milestonesFor(content, monday12);

  assert.equal(found.today, '2026-10-12');
  assert.deepEqual(found.rows.map(row => row.name), ['[Subteam A]', '[Subteam B]']);
  assert.deepEqual(found.rows[0].cells.map(cell => cell && cell.title), ['this soon', 'next', 'later too']);
  assert.deepEqual(found.rows[1].cells.map(cell => cell && cell.title), [null, null, 'other lead']);
  assert.equal(found.more, 0);

  const html = panels.milestones.markupFor(content, monday12);
  assert.deepEqual(['THIS WEEK', 'NEXT WEEK', 'LATER'].map(label => html.includes('<div class="week-head">' + label + '</div>')), [true, true, true]);
  assert.ok(html.includes('<span class="cell-title">this soon</span><span class="cell-date">OCT 13</span>'));
  assert.equal(countOf(html, 'cell-empty'), 2);
  ['done', 'no date', 'hidden', 'this late'].forEach(title => assert.equal(html.includes('>' + title + '<'), false, title));
});

test('a task that is already late is in this week, with its date marked late', () => {
  const html = panels.milestones.markupFor(contentOf([board({ title: 'behind', dueDate: '2026-10-05' }), board({ title: 'on time', subteam: '[Subteam B]', dueDate: '2026-10-14' })]), monday12);

  assert.ok(html.includes('<span class="cell-title">behind</span><span class="cell-date late">OCT 5</span>'));
  assert.ok(html.includes('<span class="cell-title">on time</span><span class="cell-date">OCT 14</span>'));
});

test('the card has six rows at most, and +N MORE says how many lead entries did not fit', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(letter => '[Lead ' + letter + ']');
  const content = count => contentOf(names.slice(0, count).map((name, index) => board({ title: 'task ' + index, subteam: name, dueDate: '2026-10-14' })), names);

  assert.equal(panels.milestones.mostRows, 6);
  const eight = panels.milestones.milestonesFor(content(8), monday12);
  assert.deepEqual([eight.rows.length, eight.more], [6, 2]);
  assert.deepEqual(eight.rows.map(row => row.name), names.slice(0, 6), 'the first six in the order of the Team leads list');
  assert.ok(panels.milestones.markupFor(content(8), monday12).includes('<div class="more">+2 MORE</div>'));

  const seven = panels.milestones.markupFor(content(7), monday12);
  assert.ok(seven.includes('+1 MORE'));
  const six = panels.milestones.markupFor(content(6), monday12);
  assert.equal(six.includes('MORE'), false, 'six fit, so there is nothing more');
  assert.equal(countOf(six, 'class="milestone-row"'), 7, 'the heading row and six rows');
});

test('a lead entry with nothing due is not a row, so it does not use one of the six', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(letter => '[Lead ' + letter + ']');
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
  const bars = Array.from(html.matchAll(/<rect class="seg seg-(\w+)" x="(\d+)" y="(\d+)" width="(\d+)" height="44"\/>/g)).map(match => [match[1], Number(match[2]), Number(match[4])]);
  assert.deepEqual(bars, [['backlog', 224, 81], ['progress', 305, 162], ['done', 467, 81], ['backlog', 224, 81], ['done', 305, 81]], 'the longest bar is 324 wide and the others in proportion, each stack after the one before');
  assert.ok(html.includes('>1/4</text>') && html.includes('>1/2</text>'), 'done out of all, at the right of each bar');
  assert.equal(countOf(html, 'height="28"'), 3, 'a square for each stack in the legend');
  ['BACKLOG', 'IN PROGRESS', 'DONE'].forEach(label => assert.ok(html.includes('>' + label + '</text>'), label));
});

test('there are six bars at most, and a lead entry with no board tasks has none', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(letter => '[Lead ' + letter + ']');
  const content = contentOf(names.map(name => board({ subteam: name, status: 'in-progress' })).concat([{ title: 'pinned only', subteam: '[Lead A]' }]), names.concat(['[Lead Z]']));
  const found = panels.progress.barsFor(content, monday12);

  assert.deepEqual([found.rows.length, found.more], [6, 2]);
  assert.ok(panels.progress.markupFor(content, monday12).includes('>+2 MORE</text>'));
  assert.equal(panels.progress.markupFor(content, monday12).includes('[LEAD Z]'), false);
  assert.equal(panels.progress.barsFor(contentOf([board({ subteam: names[0] }), board({ subteam: names[1], showOnTv: false })], names), monday12).rows.length, 1);
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
  assert.deepEqual([first.date, first.open, last.date, last.open], ['2026-09-25', 21, '2026-10-08', 7]);
  assert.deepEqual([first.x, first.y], [724, 208], 'the first count is at the left end and the highest count at the top of the plot');
  assert.equal(last.x, Math.round(724 + (13 / 106) * 352));
  assert.equal(last.y, Math.round(440 - (7 / 21) * 232));
  line.points.slice(1).forEach((point, index) => assert.ok(point.x > line.points[index].x && point.y >= line.points[index].y, 'to the right, and lower or level'));

  assert.deepEqual(line.target, { x1: first.x, y1: first.y, x2: 1076, y2: 440 });
  assert.equal(line.endDate, '2027-01-09');
  assert.equal(line.label, 'KICKOFF');

  const html = panels.progress.markupFor(contentWith(), monday12);
  assert.ok(html.includes('<line class="target" x1="724" y1="208" x2="1076" y2="440"/>'));
  assert.ok(html.includes('>ITEMS LEFT</text>') && html.includes('>TO KICKOFF</text>'));
  assert.ok(html.includes('>SEP 25</text>') && html.includes('>JAN 9</text>'), 'the dates of the two ends');
  assert.ok(html.includes('>7</text>'), 'the count now');
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

test('with no board tasks the card says so in one plain sentence', () => {
  const html = panels.progress.markupFor(contentOf([{ title: 'pinned', subteam: '[Subteam A]', status: 'up-next' }]), monday12);

  assert.ok(html.includes('<p class="empty">No board items are showing yet.</p>'));
  assert.equal(titleOf(html), 'PROGRESS');
  assert.equal(html.includes('<svg class="chart"'), false);
});


// What the cards share

test('a card mounts into its host as one section, the way the other panels do, with a header, a tag and one slat for the body', () => {
  const content = contentWith();
  cardNames.forEach(name => {
    const html = hostFor(panels[name], content, 1);
    assert.ok(html.trim().startsWith('<section class="page monday monday-' + name + '">'), name);
    assert.ok(html.trim().endsWith('</section>'));
    assert.equal(countOf(html, '<section'), 1);
    assert.equal(countOf(html, 'data-slat="title"'), 1);
    assert.equal(countOf(html, 'data-slat="tag"'), 1);
    assert.equal(countOf(html, 'data-slat="item"'), 1, 'the body is one slat');
    assert.equal(typeof panels[name].mount, 'function');
  });
  assert.equal('hasContent' in panels.milestones, false, 'the look rotation chooses these two, so they always draw');
  assert.equal('hasContent' in panels.progress, false);
  assert.equal(typeof panels.tasks.hasContent, 'function', 'the tasks card says whether it has a page for a lead entry');
});

test('the tag says SAMPLE for the sample and how old the data is when it is old, and nothing when it is new or not known', () => {
  const tagOf = (content, now) => /<span class="tag-text">([^<]*)<\/span>/.exec(panels.progress.markupFor(content, now));
  const real = change => contentWith(raw => { delete raw.monday.sample; Object.assign(raw.monday, change); });

  assert.equal(tagOf(contentWith(), monday12)[1], 'SAMPLE');
  assert.equal(tagOf(real({ lastSyncAt: '2026-10-12T15:30:00Z' }), monday12), null);
  assert.equal(tagOf(real({ lastSyncAt: '2026-10-12T12:00:00Z' }), monday12)[1], '4 HR OLD');
  assert.equal(tagOf(real({ lastSyncAt: '2026-10-08T12:00:00Z' }), monday12)[1], '4 DAYS OLD');
  assert.equal(tagOf(real({ lastSyncAt: '' }), monday12), null);
  assert.equal(tagOf(contentWith(raw => { delete raw.monday; }), monday12), null);
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

  // the sample's tasks typed by hand are for six lead entries, and the board's tasks are for two of those
  assert.deepEqual(steps.map(step => step.panel + (step.page ? ' ' + step.page : '')), ['monday-tasks 1', 'monday-tasks 2', 'monday-tasks 3', 'monday-tasks 4', 'monday-tasks 5', 'monday-tasks 6', 'monday-milestones', 'monday-progress']);
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

test('nothing on a card is smaller than 44px, no line is thinner than 3px, and the stylesheets have no animation, blur or shadow', () => {
  assert.equal(tokens['size-label'], 44);
  cardIds.forEach(id => {
    const css = read('panels/' + id + '/' + id + '.css');
    const rules = rulesOf(css);
    const declarations = Array.from(css.matchAll(/font[a-z-]*:[^;]*;/g)).map(match => match[0]);

    assert.ok(declarations.length >= 5, id + ' has text');
    declarations.forEach(declaration => {
      assert.ok(!declaration.startsWith('font-size'), id + ' sets a size by font-size: ' + declaration);
      const font = fontOf(declaration);
      assert.ok(font, id + ' has a font line that cannot be read: ' + declaration);
      assert.ok(font.size >= 44, id + ' has text of ' + font.size + 'px: ' + declaration);
      assert.ok(font.line >= font.size, id + ' has a line height under its size: ' + declaration);
    });
    Array.from(css.matchAll(/(?:stroke-width|border(?:-left|-bottom)?):\s*([\d.]+)/g)).forEach(match => assert.ok(Number(match[1]) === 0 || Number(match[1]) >= 3, id + ' has a line of ' + match[1] + 'px'));
    assert.equal(/@keyframes|transition:|animation:|transform|box-shadow|text-shadow|filter|blur|drop-shadow|background-image|url\(/.test(css), false, id + ' has an effect that is not allowed');
    assert.ok(rules['.' + id + ' .header'] && rules['.' + id + ' .body'] && rules['.' + id + ' .empty'], id + ' styles its header, body and empty sentence');

    const js = read('panels/' + id + '/' + id + '.js');
    assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(|@keyframes|transform/.test(js), false, id + ' has animation code');
    assert.equal(/font-size|style="/.test(js), false, id + ' sets a size or a style in its markup');
  });
  assert.equal(tokens['size-heading'], 96);
  assert.equal(tokens['size-body-large'], 64);
  assert.equal(fontOf(rulesOf(read('panels/monday-tasks/monday-tasks.css'))['.monday-tasks .title']).size, 96, 'the title is a heading');
  assert.equal(fontOf(rulesOf(read('panels/monday-tasks/monday-tasks.css'))['.monday-tasks .lead-long']).size, 64, 'unless the name is long');
  cardIds.forEach(id => assert.equal(fontOf(rulesOf(read('panels/' + id + '/' + id + '.css'))['.' + id + ' .empty']).size, 56, id + ' says its sentence at the size of body text'));
});

test('the tasks card fits the large panel: three columns and the numbers inside its body, which is clear of the frame and the cut corner', () => {
  const rules = rulesOf(read('panels/monday-tasks/monday-tasks.css'));
  const body = rules['.monday-tasks .body'];
  const lane = pixels(rules['.monday-tasks .lane'], 'width');
  const gap = pixels(rules['.monday-tasks .lanes'], 'gap');

  assert.equal(pixels(body, 'width'), 3 * lane + 2 * gap, 'the three columns are as wide as the body');
  assert.ok(pixels(body, 'left') + pixels(body, 'width') <= 1148, 'inside the frame, which is 1152 wide with a 4px edge');
  assert.equal(pixels(rules['.monday-tasks .fact'], 'width'), lane, 'each number is under its column');

  // a column: its heading, the space, two cards 156 high with 12 between them, and the numbers 16 under that
  assert.ok(rules['.monday-tasks .item:last-child'].includes('margin-bottom: 0'), 'the last card has no space under it');
  const laneHeight = pixels(rules['.monday-tasks .lane-head'], 'height') + pixels(rules['.monday-tasks .lane-head'], 'margin-bottom') + 2 * pixels(rules['.monday-tasks .item'], 'height') + pixels(rules['.monday-tasks .item'], 'margin-bottom');
  assert.equal(laneHeight, 388);
  const factsTop = pixels(rules['.monday-tasks .facts'], 'top');
  assert.equal(factsTop, 388 + 16);
  const factsBottom = factsTop + fontOf(rules['.monday-tasks .fact-label']).line + fontOf(rules['.monday-tasks .fact-number']).line;
  assert.ok(factsBottom <= pixels(body, 'height'), 'the numbers end inside the body');
  assert.ok(pixels(body, 'top') + factsBottom <= 704 - 24, 'and above the bottom edge of the frame');

  // the card is a title of two lines of 48 and a line of 48 under it, in 156 less the 6 above and below
  assert.equal(2 * 48 + 48 + 12, pixels(rules['.monday-tasks .item'], 'height'));
  assert.equal(pixels(rules['.monday-tasks .item-title'], 'height'), 96);
});

test('the milestones card fits its body: the heading row, six rows of 72 and the line that says how many more', () => {
  const rules = rulesOf(read('panels/monday-milestones/monday-milestones.css'));
  const body = rules['.monday-milestones .body'];
  const row = pixels(rules['.monday-milestones .milestone-row'], 'height');
  const head = pixels(rules['.monday-milestones .milestone-row:first-child'], 'height');

  assert.equal(row, 72);
  assert.ok(head + 6 * row <= pixels(rules['.monday-milestones .more'], 'top'), 'the line for more is under the sixth row');
  assert.ok(pixels(rules['.monday-milestones .more'], 'top') + fontOf(rules['.monday-milestones .more']).line <= pixels(body, 'height'));
  assert.ok(pixels(rules['.monday-milestones .cell'], 'height') <= row);
  assert.equal(/grid-template-columns:\s*190px repeat\(3, minmax\(0, 1fr\)\)/.test(rules['.monday-milestones .milestone-row']), true);
  assert.ok(190 + 3 * 8 + 3 * 290 <= pixels(body, 'width'), 'the name column, the gaps and the three weeks fit the body');
  assert.equal(panels.milestones.mostRows * row + head + 48 <= pixels(body, 'height'), true);
});

test('the text of the progress card stays inside its body and does not run into the text beside it, even with the longest names', () => {
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
    assert.ok(reaches.length > 10, entry[0] + ' draws text');

    reaches.forEach(item => {
      if (item.reach.left < -1 || item.reach.right > 1097) problems.push(entry[0] + ': "' + item.text.text + '" runs ' + Math.round(item.reach.left) + ' to ' + Math.round(item.reach.right));
      if (item.reach.top < 0 || item.reach.bottom > 512) problems.push(entry[0] + ': "' + item.text.text + '" is outside the body at the top or bottom');
      if (item.text.cssClass === 'lead' && item.reach.right > 224) problems.push(entry[0] + ': the name "' + item.text.text + '" runs into its bar');
      if (item.text.cssClass === 'numbers' && item.reach.left < 548) problems.push(entry[0] + ': "' + item.text.text + '" is over its bar');
    });
    reaches.forEach((first, index) => reaches.slice(index + 1).forEach(second => {
      const across = Math.min(first.reach.right, second.reach.right) - Math.max(first.reach.left, second.reach.left);
      const down = Math.min(first.reach.bottom, second.reach.bottom) - Math.max(first.reach.top, second.reach.top);
      if (across > 2 && down > 4) problems.push(entry[0] + ': "' + first.text.text + '" runs into "' + second.text.text + '"');
    }));
  });
  assert.deepEqual(problems, []);
});

test('the chart is 1096 by 512 at one pixel to the unit, and the geometry of the bars and the line stays inside it', () => {
  const html = panels.progress.markupFor(contentWith(), monday12);

  assert.ok(html.includes('<svg class="chart" width="1096" height="512" viewBox="0 0 1096 512"'));
  assert.equal(countOf(html, 'role="img"'), 1);
  assert.ok(/aria-label="Progress: [^"]+items left 7 on OCT 8"/.test(html), 'a screen reader gets the numbers');
  Array.from(html.matchAll(/ (?:x|x1|x2|cx)="(-?\d+)"/g)).forEach(match => assert.ok(Number(match[1]) >= 0 && Number(match[1]) <= 1096, 'x ' + match[1]));
  Array.from(html.matchAll(/ (?:y|y1|y2|cy)="(-?\d+)"/g)).forEach(match => assert.ok(Number(match[1]) >= 0 && Number(match[1]) <= 512, 'y ' + match[1]));
  const bars = Array.from(html.matchAll(/<rect class="seg seg-\w+" x="(\d+)" y="(\d+)" width="(\d+)" height="44"\/>/g));
  bars.forEach(match => assert.ok(Number(match[1]) + Number(match[3]) <= 224 + 324 && Number(match[2]) + 44 <= 512));
});

test('every class a card writes has a rule in its own stylesheet, and no class has a rule of its own in the stylesheets of the whole screen', () => {
  const sheets = ['base.css', 'frame.css', 'teams.css', 'neon-kit.css', 'tokens.css'];
  ['styles', 'layouts', 'themes', 'themes/overlays'].forEach(folder => fs.readdirSync(path.join(dashboardFolder, folder)).filter(file => file.endsWith('.css')).forEach(file => sheets.push(folder + '/' + file)));

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
    const css = read('panels/monday-' + name + '/monday-' + name + '.css');
    // the page, the double slash and the status marks are drawn by the screen's own stylesheets
    own.forEach(token => {
      if (['page', 'double-slash', 'monday', 'mark', 'outlined', 'cut'].includes(token) || /^mark-/.test(token) || token === 'monday-' + name) return;
      assert.ok(new RegExp('\\.' + token + '(?![\\w-])').test(css), 'monday-' + name + '.css has no rule for ' + token);
    });
  });
  assert.ok(used.has('chip') && used.has('seg') && used.has('empty') && used.has('cell-title') && used.size > 40);

  // the status marks of the tasks card are drawn by the screen's own stylesheet (core/marks.js, base.css)
  const shared = ['page', 'double-slash', 'monday', 'mark', 'outlined', 'cut', 'mark-up-next', 'mark-in-progress', 'mark-done', 'mark-blocked'];
  const alone = [];
  sheets.forEach(file => {
    Object.keys(rulesOf(read(file))).forEach(selector => {
      const classes = Array.from(selector.matchAll(/\.([A-Za-z][\w-]*)/g)).map(match => match[1]);
      if (classes.length === 1 && used.has(classes[0]) && !shared.includes(classes[0])) alone.push(file + ': ' + selector);
    });
  });
  assert.deepEqual(alone, []);
});


// The docs

test('the docs say what each card shows, where the code is, and what the rotation does with the cards', () => {
  const layouts = fs.readFileSync(path.join(docsFolder, 'layouts.md'), 'utf8').replace(/\s+/g, ' ');
  const editing = fs.readFileSync(path.join(docsFolder, 'editing-content.md'), 'utf8').replace(/\s+/g, ' ');
  const where = fs.readFileSync(path.join(docsFolder, 'where-things-are.md'), 'utf8').replace(/\s+/g, ' ');

  assert.ok(layouts.includes('## The Monday cards'));
  ['monday-tasks', 'monday-milestones', 'monday-progress', 'core/monday.js', 'BUILD TEAM · PRIME', 'This week', 'Next week', 'Later', '+N more', 'items left', 'mondayCards', 'Monday to Sunday', 'two cards', 'showOnTv'].forEach(word => assert.ok(layouts.includes(word), 'layouts.md names ' + word));
  assert.equal(layouts.includes('There are no Monday cards yet'), false, 'the old sentence that said there were none is gone');
  assert.ok(editing.includes('## The Monday cards'));
  ['Tasks card', 'Milestones card', 'Progress card', 'Show on TV', 'Panel order', 'Monday pass'].forEach(word => assert.ok(editing.includes(word), 'editing-content.md names ' + word));
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
