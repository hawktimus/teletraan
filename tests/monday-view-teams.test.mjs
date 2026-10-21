// Tests for which Monday tasks play in which view (docs/monday.md, "Which view plays which tasks"): the Condensed view shows
// only the tasks that are for both teams, Prime tasks play in the Prime view and Nova tasks in the Nova view, a team page
// keeps its own tasks and the both-teams ones, the TV charts take a department, the Subteam roster takes a team, and the
// Studio board and the control page offer the same dropdowns and add the missing rows the same way.
//
//   node tests/monday-view-teams.test.mjs

import assert from 'node:assert/strict';
import { contentOf, htmlOf, load, now, runTests, task, test, views, wordsOf } from './helpers/monday-world.mjs';
import * as displayRows from '../control/static/display-rows.js';
import * as studioBoard from '../studio/tools/rotation-board.js';
import { rowHtml } from '../control/static/tabs/display-parts.js';

const playing = await load('core/views.js');
const rotation = await load('core/rotation.js');
const roster = await load('core/roster.js');
const rosterPanel = await load('panels/roster/panel.js');
const rowPreview = await load('core/row-preview.js');

const row = (view, panel, extra) => Object.assign({ view: view, panel: panel, seconds: 10, shown: true }, extra);
const tasks = [
  task({ title: '[both]', department: 'business' }),
  task({ title: '[prime only]', department: 'business', team: 'prime' }),
  task({ title: '[nova only]', department: 'business', team: 'nova' }),
  task({ title: '[build both]', department: 'build' }),
  task({ title: '[build prime]', department: 'build', team: 'prime', status: 'blocked' }),
  task({ title: '[build nova]', department: 'build', team: 'nova', status: 'in-progress' }),
  task({ title: '[build prime done]', department: 'build', team: 'prime', list: 'done', status: 'done' }),
  task({ title: '[cnc nova]', department: 'cnc', team: 'nova' }),
];
const found = rows => contentOf(tasks, raw => { raw.settings.rotationRows = rows; });
const projects = (page, content = contentOf(tasks)) => (views.departmentView(content, now, page) || { rows: [] }).rows.map(item => item.project).sort();

test('Both is the Condensed view: only tasks that are for both teams. A team has its own tasks and the both-teams ones', () => {
  assert.deepEqual(projects({ department: 'business', list: 'open' }), ['[both]']);
  assert.deepEqual(projects({ department: 'business', list: 'open', team: 'prime' }), ['[both]', '[prime only]']);
  assert.deepEqual(projects({ department: 'business', list: 'open', team: 'nova' }), ['[both]', '[nova only]']);
  assert.deepEqual(views.ofTeam(tasks, '').map(item => item.title), ['[both]', '[build both]']);
  assert.equal(views.departmentView(contentOf(tasks), now, { department: 'cnc', list: 'open' }), null, 'a Nova only department has nothing for both teams');
});

test('a Monday row of a Robotics block plays in the view of its team: Condensed for both, Prime, Nova', () => {
  assert.equal(playing.playViewOf('general', 'monday-department', ''), 'family');
  assert.equal(playing.playViewOf('general', 'monday-charts'), 'family');
  assert.equal(playing.playViewOf('general', 'monday-department', 'prime'), 'prime');
  assert.equal(playing.playViewOf('general', 'monday-charts', 'nova'), 'nova');
  assert.equal(playing.playViewOf('general', 'events', 'prime'), 'general', 'a panel that is not Monday or the roster is not moved');
  assert.equal(playing.playViewOf('general', 'roster', 'nova'), 'nova');
  assert.equal(playing.playViewOf('general', 'roster', ''), 'general');
  assert.equal(playing.playViewOf('prime', 'monday-department', ''), 'prime');

  const content = found([
    row('robotics', 'leadership'),
    row('robotics', 'monday-department', { department: 'business' }),
    row('robotics', 'monday-department', { department: 'build', team: 'prime' }),
    row('robotics', 'monday-department', { department: 'build', team: 'nova' }),
    row('robotics', 'leadership'),
  ]);
  const steps = playing.viewSteps(content, 'general', now);
  assert.deepEqual(steps.map(step => step.panel + ':' + step.view + ':' + step.team), [
    'leadership:general:prime', 'monday-department:family:prime', 'monday-department:prime:prime', 'monday-department:nova:nova', 'leadership:general:prime',
  ]);
  assert.deepEqual(steps.filter(step => step.panel === 'monday-department').map(step => step.page.team), ['', 'prime', 'nova']);
  assert.deepEqual(steps.map(step => playing.layoutOfStep(content, step)), ['standard', 'bar', 'bar', 'bar', 'standard'], 'a Prime or Nova view is the bar layout');
});

test('a row of a team that is not switched on, or that ?team= leaves out, plays nothing', () => {
  const content = found([row('robotics', 'monday-department', { department: 'build', team: 'nova' }), row('robotics', 'monday-department', { department: 'business' })]);
  content.teams = content.teams.filter(team => team.code !== 'nova');
  assert.deepEqual(playing.viewSteps(content, 'general', now).map(step => step.page.department), ['business']);
});

test('a Prime or Nova block plays its Monday rows in its view, with its own tasks and the both-teams ones, whatever the row says', () => {
  const content = found([row('prime', 'monday-department', { department: 'build' }), row('nova', 'monday-department', { department: 'build', team: 'nova' })]);
  const prime = playing.viewSteps(content, 'prime', now, -1);
  const nova = playing.viewSteps(content, 'nova', now, -1);
  assert.deepEqual(prime.map(step => step.view + ':' + step.page.team), ['prime:prime']);
  assert.deepEqual(nova.map(step => step.view + ':' + step.page.team), ['nova:nova']);
  assert.deepEqual(projects(prime[0].page, content), ['[build both]', '[build prime]']);
  assert.deepEqual(projects(nova[0].page, content), ['[build both]', '[build nova]']);
});

test('the TV charts take a department: one bar and its numbers, and a title with the department', () => {
  const content = contentOf(tasks);
  const status = views.chartsView(content, now, { chart: 'status', team: 'prime', department: 'build' });
  assert.equal(status.title, 'BUILD STATUS');
  assert.equal(status.team, 'PRIME');
  assert.deepEqual(status.rows, [{ name: 'BUILD', done: 1, progress: 1, todo: 1, total: 3, blocked: 1 }]);
  assert.equal(views.chartsView(content, now, { chart: 'progress', team: 'prime', department: 'build' }).title, 'BUILD PROGRESS');
  assert.equal(views.chartsView(content, now, { chart: 'timeline', team: 'nova', department: 'build' }).title, 'BUILD TIMELINE');
  assert.equal(views.chartsView(content, now, { chart: 'status' }).title, 'STATUS BY DEPARTMENT', 'all departments is as it was');
  assert.deepEqual(views.chartsView(content, now, { chart: 'status', team: 'nova' }).rows.map(item => item.name), ['BUILD', 'CNC', 'BUSINESS']);
  assert.equal(views.chartsView(content, now, { chart: 'status', department: 'cnc' }), null, 'cnc has no task for both teams: nothing to draw');
  assert.equal(views.chartsView(content, now, { chart: 'status', team: 'prime', department: 'cnc' }), null);
  assert.equal(views.chartsView(content, now, { chart: 'progress', team: 'prime', department: 'build' }).tasks.done, 1);

  const html = wordsOf(htmlOf('monday-charts', content, { chart: 'status', team: 'prime', department: 'build' }));
  assert.match(html, /BUILD STATUS/);
  assert.match(html, /3 TASKS 1 DONE 0 IN PROGRESS 1 TO DO 1 STUCK/);
  assert.equal(htmlOf('monday-charts', content, { chart: 'status' }).includes('class="facts"'), false, 'all departments has no numbers under the bars');
});

test('a TV charts row keeps its department when it is tidied, and loses one that is not of the nine', () => {
  assert.equal(rotation.tidyRotationRow(row('robotics', 'monday-charts', { chart: 'timeline', department: ' Build ', team: 'nova' })).department, 'build');
  assert.equal(rotation.tidyRotationRow(row('robotics', 'monday-charts', { chart: 'timeline', department: 'lunch' })).department, undefined);
  const tidy = rotation.tidyRotationRow(row('robotics', 'monday-charts', { chart: 'status', department: 'cnc', team: 'prime' }));
  const main = rotation.mainRowOf(tidy, contentOf(tasks));
  assert.equal(main.department, 'cnc');
  assert.equal(main.tasksTeam, 'prime');
});

test('the Subteam roster takes a team from its row, and a Robotics roster row with a team plays in that team view', () => {
  const crew = [
    task({ title: '[a]', owners: ['Ana'], estHours: 4 }),
    task({ title: '[b]', team: 'prime', owners: ['Pat'], estHours: 3 }),
    task({ title: '[c]', team: 'nova', owners: ['Nia'], estHours: 2 }),
  ];
  const content = contentOf(crew);
  const names = team => (roster.rosterRowView(content, now, team, 'lead-build', 0) || { rows: [] }).rows.map(item => item.name).sort();
  assert.deepEqual(names('prime'), ['Ana', 'Pat']);
  assert.deepEqual(names('nova'), ['Ana', 'Nia']);
  assert.deepEqual(names(''), ['Ana', 'Nia', 'Pat'], 'Both counts the people of both teams');

  const list = found([row('robotics', 'roster', { department: 'lead-build', team: 'nova' }), row('robotics', 'roster', { department: 'lead-build' })]);
  const steps = playing.viewSteps(list, 'general', now);
  assert.deepEqual(steps.map(step => step.view), ['nova', 'general']);
  assert.deepEqual(steps.map(step => step.page.team), ['nova', '']);
  assert.equal(rotation.tidyRotationRow(row('robotics', 'roster', { department: 'build', team: 'nova' })).team, 'nova');
  assert.equal(typeof rosterPanel.hasContent, 'function');
});

test('the Roster page says whose people it counts', async () => {
  const crew = [task({ title: '[a]', owners: ['Ana'], estHours: 4 }), task({ title: '[c]', team: 'nova', owners: ['Nia'], estHours: 2 })];
  const content = contentOf(crew);
  const host = { innerHTML: '' };
  rosterPanel.mount(host, content, { team: 'nova', department: 'lead-build', part: 0 });
  assert.match(wordsOf(host.innerHTML), /ROSTER NOVA/);
  assert.match(wordsOf(host.innerHTML), /Nia/);
  assert.doesNotMatch(wordsOf(host.innerHTML), /Pat/);
  // the Robotics view has no team of its own, so a row for both teams counts the people of both
  globalThis.document = { documentElement: { dataset: { view: 'general' } } };
  try {
    rosterPanel.mount(host, content, { team: '', department: 'lead-build', part: 0 });
  } finally {
    delete globalThis.document;
  }
  assert.match(wordsOf(host.innerHTML), /PRIME \+ NOVA/);
  assert.match(wordsOf(host.innerHTML), /Nia/);
});

test('the row preview draws a Robotics Monday row in the view of its team', () => {
  const params = json => rowPreview.useRowPreview(new URLSearchParams(), { row: json });
  assert.equal(params(row('robotics', 'monday-department', { department: 'build' })).get('view'), 'family');
  assert.equal(params(row('robotics', 'monday-department', { department: 'build', team: 'nova' })).get('view'), 'nova');
  assert.equal(params(row('robotics', 'monday-department', { department: 'build', team: 'nova' })).get('team'), 'nova');
  assert.equal(params(row('prime', 'monday-department', { department: 'build' })).get('team'), 'prime', 'a Prime block row has the tasks of Prime and the both-teams ones');
  assert.equal(params(row('robotics', 'roster', { department: 'build', team: 'prime' })).get('view'), 'prime');
});

test('the Studio board and the control page say the same view for a row, and offer the same dropdowns', () => {
  const samples = [
    row('robotics', 'monday-department', { department: 'build' }),
    row('robotics', 'monday-department', { department: 'build', team: 'prime' }),
    row('robotics', 'monday-charts', { team: 'nova' }),
    row('prime', 'monday-department', { department: 'build', team: 'prime' }),
    row('nova', 'monday-charts', {}),
    row('robotics', 'roster', { department: 'build', team: 'nova' }),
    row('robotics', 'roster', { department: 'build' }),
    row('robotics', 'monday-tasks', { department: 'marketing' }),
    row('robotics', 'events', {}),
  ];
  const expected = ['condensed', 'prime', 'nova', 'prime', 'nova', 'nova', '', 'condensed', ''];
  assert.deepEqual(samples.map(studioBoard.playsIn), expected);
  assert.deepEqual(samples.map(displayRows.playsIn), expected);
  assert.deepEqual(studioBoard.playsWords, displayRows.playsWords);
  assert.equal(studioBoard.playsWords.prime, 'Plays in the Prime view');

  const monday = { departments: studioBoard.rosterDepartmentChoices.slice(1), lists: [], charts: [], teams: studioBoard.mondayTeamChoices };
  const studioFields = item => studioBoard.detailsFor(item).filter(entry => entry.kind === 'choice').map(entry => entry.field);
  ['monday-department', 'monday-charts', 'roster'].forEach(panel => {
    assert.deepEqual(displayRows.mondayFieldsOf(row('prime', panel), monday).map(entry => entry.field), studioFields(row('prime', panel)), panel);
  });
  assert.equal(displayRows.mondayFieldsOf(row('robotics', 'events'), monday).length, 0);
  const roster = studioBoard.detailsFor(row('robotics', 'roster', { department: 'business,marketing' })).find(entry => entry.field === 'department');
  assert.equal(roster.choices[0].title, 'First with people');
  assert.equal(roster.choices.length, 11, 'First with people, the nine, and the stored value that is not one of them');
  assert.equal(roster.choices[10].value, 'business,marketing');
  const charts = studioBoard.detailsFor(row('robotics', 'monday-charts')).find(entry => entry.field === 'department');
  assert.equal(charts.choices[0].title, 'All departments');
  assert.equal(charts.choices.length, 10);
});

test('the Display row card shows the dropdowns and says which view a Robotics row plays in', () => {
  const choices = {
    views: [{ value: 'robotics', title: 'Robotics' }, { value: 'prime', title: 'Prime' }, { value: 'nova', title: 'Nova' }],
    panelGroups: [{ title: 'Panels', panels: [{ value: 'roster', title: 'Subteam roster' }, { value: 'monday-charts', title: 'Monday: TV charts' }] }],
    sideGroups: [],
    monday: { departments: [{ value: 'build', title: 'Build' }], lists: [], charts: [{ value: 'status', title: 'Status by department' }], teams: studioBoard.mondayTeamChoices },
  };
  const page = { choices: choices, checks: {}, pageSeconds: 20 };
  const card = extra => rowHtml(Object.assign({ _key: 'k1', view: 'robotics', panel: 'roster', department: 'build', shown: true }, extra), 0, true, page);
  const html = card({ team: 'nova' });
  assert.match(html, /data-field="department"/);
  assert.match(html, /name="team-k1"/);
  assert.match(html, /Plays in the Nova view/);
  assert.match(html, /First with people/);
  assert.doesNotMatch(card({}), /Plays in the/);
  const charts = rowHtml({ _key: 'k2', view: 'robotics', panel: 'monday-charts', department: 'build', shown: true }, 0, true, page);
  assert.match(charts, /All departments/);
  assert.match(charts, /Plays in the Condensed view/);
});

test('missing Department tasks rows are counted for each department and view, and added in the view of the team', () => {
  const list = displayRows.withKeys([
    { view: 'robotics', panel: 'monday-department', department: 'business', list: 'open' },
    { view: 'robotics', panel: 'monday-department', department: 'build', list: 'open', team: 'prime' },
    { view: 'prime', panel: 'monday-department', department: 'electrical', list: 'open' },
    { view: 'robotics', panel: 'monday-department', department: 'strategy', list: 'open', team: 'nova' },
  ]);
  const mine = displayRows.missingTargets(list).map(item => item.department + ':' + item.view);
  assert.deepEqual(mine, studioBoard.missingTargets(list).map(item => item.department + ':' + item.view));
  assert.equal(mine.includes('business:robotics'), false);
  assert.equal(mine.includes('build:prime'), false, 'Build for Prime in Robotics plays in the Prime view');
  assert.equal(mine.includes('build:nova'), true);
  assert.equal(mine.includes('electrical:prime'), false, 'a row of the Prime view with no team plays there');
  assert.equal(mine.includes('strategy:robotics'), true, 'Strategy for Nova is not the both-teams Strategy');
  assert.equal(mine.length, 14 - 3);

  const added = displayRows.addDepartmentRows(list);
  const other = studioBoard.addDepartmentRows(list);
  assert.deepEqual(added.map(item => Object.assign({}, item, { _key: 'k' })), other.map(item => Object.assign({}, item, { _key: 'k' })));
  assert.equal(added.length, list.length + 11);
  const nova = added.find(item => item.department === 'cnc' && item.view === 'nova');
  assert.deepEqual([nova.team, nova.list, nova.seconds, nova.shown], ['nova', 'open', 30, true]);
  assert.equal(added.find(item => item.department === 'operations').team, undefined);
  assert.equal(displayRows.addDepartmentRows(added).length, added.length, 'nothing is added twice');
});

test('the skip notes follow the same rule: Both needs a task for both teams, a team view also counts its own', () => {
  const data = { photos: [{}], tasks: [
    { team: 'prime', department: 'cnc', list: 'open', status: 'up-next' },
    { department: 'business', list: 'open', status: 'up-next' },
  ] };
  const keyed = extra => Object.assign({ _key: 'a', shown: true }, extra);
  const note = item => studioBoard.skipNotes([keyed(item)], data, now)[item._key || 'a'] || '';
  assert.match(note({ view: 'robotics', panel: 'monday-department', department: 'cnc', list: 'open' }), /no open CNC task is on the TV for both teams/);
  assert.equal(note({ view: 'robotics', panel: 'monday-department', department: 'cnc', list: 'open', team: 'prime' }), '');
  assert.equal(note({ view: 'prime', panel: 'monday-department', department: 'cnc', list: 'open' }), '', 'a Prime block row counts the tasks of Prime');
  assert.equal(note({ view: 'robotics', panel: 'monday-department', department: 'business', list: 'open' }), '');
  assert.match(note({ view: 'robotics', panel: 'monday-charts', chart: 'status', department: 'cnc' }), /no Monday task in CNC is on the TV for both teams/);
  assert.equal(note({ view: 'robotics', panel: 'monday-charts', chart: 'status', department: 'cnc', team: 'prime' }), '');
});

await runTests();
