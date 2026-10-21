// Tests for the rows of the default rotation that name a department or a part (docs/views.md, "The default rotation"): the
// Department tasks for one of the nine departments, the roster for one department in two parts, the Events and Team leads panels in
// two parts, and the competition rank card as the FRC ranking of a team's view.
//
//   node tests/department-rows.test.mjs

import assert from 'node:assert/strict';
import { config, contentOf, load, now, panels, runTests, task, test, views, wordsOf } from './helpers/monday-world.mjs';

const roster = await load('core/roster.js');
const rosterPanel = await load('panels/roster/panel.js');
const eventsPanel = await load('panels/events/panel.js');
const leadsPanel = await load('panels/team-leads/panel.js');
const rankPanel = await load('panels/competition-rank/panel.js');
const screens = await load('core/screens.js');
const leadDepartments = await load('core/lead-departments.js');

const crew = names => names.map((name, at) => task({ title: '[T' + at + ']', subteamId: 'lead-build', contact: name, owners: [name], estHours: 10 - at, status: at % 2 === 0 ? 'in-progress' : 'done', list: at % 2 === 0 ? 'open' : 'done', completedOn: '2026-10-14' }));
const world = tasks => contentOf(tasks, raw => {
  raw.subteams = [{ id: 'lead-build', name: 'Build', order: 1 }, { id: 'lead-electrical', name: 'Electrical', order: 2 }, { id: 'lead-design', name: 'Design', order: 3 }, { id: 'lead-cnc', name: 'CNC', order: 4 }];
});
const eight = ['[A1]', '[A2]', '[A3]', '[A4]', '[A5]', '[A6]', '[A7]', '[A8]'];

test('a department of the Team leads is found by its name in any case, by the id of a Team lead, and Design and CNC are one', () => {
  const content = world(crew(eight).concat([task({ subteamId: 'lead-design', subteam: 'Design' }), task({ subteamId: 'lead-cnc', subteam: 'CNC' })]));
  const found = leadDepartments.departmentsOf(content, content.tasks, now);

  assert.equal(leadDepartments.departmentIn(found, 'build').name, 'Build');
  assert.equal(leadDepartments.departmentIn(found, 'BUILD').name, 'Build');
  assert.equal(leadDepartments.departmentIn(found, 'lead-build').name, 'Build');
  assert.equal(leadDepartments.departmentIn(found, 'design').name, config.designDepartment);
  assert.equal(leadDepartments.departmentIn(found, 'cnc').name, config.designDepartment);
  assert.equal(leadDepartments.departmentIn(found, 'strategy'), null);
  assert.equal(leadDepartments.departmentIn(found, ''), null);
});

test('Department tasks take a department and a list, and a department with nothing in the list has nothing to show', () => {
  const content = world(crew(eight));
  assert.equal(views.departmentView(content, now, { department: 'build', list: 'open' }).title, 'BUILD TASKS');
  assert.equal(views.departmentView(content, now, { department: 'build', list: 'done' }).title, 'BUILD DONE');
  assert.equal(views.departmentView(content, now, { department: 'electrical', list: 'open' }), null);
  assert.equal(views.departmentView(content, now, { department: '', list: 'open' }), null, 'a row with no department plays nothing');
});

test('a Monday row of the rotation keeps its department, list and team, and the look keeps the team of its view', () => {
  assert.deepEqual(screens.tidyMainRow({ panel: 'monday-department', team: '', tasksTeam: 'nova', department: 'Build', list: 'done' }, true, true),
    { panel: 'monday-department', team: '', tasksTeam: 'nova', department: 'build', list: 'done' });
  assert.deepEqual(screens.tidyMainRow({ panel: 'monday-department', team: 'prime', department: 'business' }, false, true),
    { panel: 'monday-department', team: 'prime', tasksTeam: '', department: 'business', list: 'open' }, 'a row of the Prime view with no team shows both teams');
  assert.deepEqual(screens.tidyMainRow({ panel: 'monday-charts', team: '', chart: 'nope' }, true, true), { panel: 'monday-charts', team: '', tasksTeam: '', chart: 'status' });
  assert.equal(screens.tidyMainRow({ panel: 'monday-done', team: 'prime', department: 'build' }, false, true), null, 'a retired panel plays nothing');
});

test('the roster of a department has six people in part 1 and the rest in part 2, which scrolls six at a time', () => {
  const content = world(crew(eight.concat(['[B1]', '[B2]', '[B3]', '[B4]', '[B5]', '[B6]'])));
  const first = roster.rosterRowView(content, now, 'prime', 'build', 1);
  const second = roster.rosterRowView(content, now, 'prime', 'build', 2);
  const all = roster.rosterRowView(content, now, 'prime', 'build', 0);

  assert.equal(first.title, 'BUILD ROSTER');
  assert.equal(first.rows.length, 6);
  assert.equal(first.pages, 1);
  assert.equal(first.parts, 2);
  assert.equal(second.rows.length, 8);
  assert.equal(second.pages, 2);
  assert.equal(second.rows[0].name, roster.mondayRosterPages(content, now, 'prime')[1].rows[0].name, 'part 2 follows part 1');
  assert.equal(all.rows.length, 14);
  assert.equal(all.pages, 3);
  assert.equal(roster.rosterRowView(content, now, 'prime', 'electrical', 1), null);
});

test('part 2 of a roster that fits on one page has nothing to show, so the row is skipped', () => {
  const content = world(crew(eight.slice(0, 5)));
  const page = part => ({ team: 'prime', department: 'build', part: part });

  assert.equal(rosterPanel.hasContent(content, page(1)), true);
  assert.equal(rosterPanel.hasContent(content, page(2)), false);
  assert.equal(rosterPanel.scrollPages(content, page(1)), 1);
});

test('the roster panel draws a department row in a window of six rows with the rest under it', () => {
  const content = world(crew(eight));
  const host = { innerHTML: '' };
  rosterPanel.mount(host, content, { team: 'prime', department: 'build', part: 2 });

  assert.ok(wordsOf(host.innerHTML).startsWith('BUILD ROSTER PRIME 2/2'));
  assert.ok(host.innerHTML.includes('data-scroll-list') && host.innerHTML.includes('people-window'));
  assert.equal((host.innerHTML.match(/class="person[" ]/g) || []).length, 6, 'two people and four blank rows fill the window');
});

test('two departments in one row are one roster, as the Business and Marketing roster is', () => {
  const content = contentOf([
    task({ subteamId: 'lead-business', subteam: 'Business', team: '', owners: ['[Cy]'], contact: '[Cy]', estHours: 3 }),
    task({ subteamId: 'lead-marketing', subteam: 'Marketing', team: '', owners: ['[Di]'], contact: '[Di]', estHours: 5 }),
  ], raw => {
    raw.subteams = [{ id: 'lead-business', name: 'Business', order: 1 }, { id: 'lead-marketing', name: 'Marketing', order: 2 }];
  });
  const view = roster.rosterRowView(content, now, '', 'business,marketing', 0);

  assert.equal(view.title, 'BUSINESS · MARKETING ROSTER');
  assert.deepEqual(view.rows.map(row => row.name), ['[Di]', '[Cy]']);
});

// The Events panel puts the shape of its row bars in the hidden defs of the page, so the page gets a small stand-in
globalThis.document = { getElementById: () => ({ insertAdjacentHTML() {} }) };

const eventsWorld = count => {
  const content = world([]);
  content.events = Array.from({ length: count }, (item, at) => ({ title: '[Event ' + (at + 1) + ']', start: '2999-01-' + String(at + 10) + 'T15:00:00.000Z', end: '2999-01-' + String(at + 10) + 'T16:00:00.000Z', allDay: false, location: '[Room]', calendarId: 'x' }));
  return content;
};

test('the Events panel plays page 1 or page 2 alone when a row asks, and both when it does not', () => {
  const content = eventsWorld(6);
  const page = part => ({ team: '', department: '', part: part });
  const rows = host => (host.innerHTML.match(/class="row"/g) || []).length;
  const first = { innerHTML: '' };
  const second = { innerHTML: '' };
  const all = { innerHTML: '' };

  eventsPanel.mount(first, content, page(1));
  eventsPanel.mount(second, content, page(2));
  eventsPanel.mount(all, content);

  assert.equal(eventsPanel.scrollPages(content), 2);
  assert.equal(eventsPanel.scrollPages(content, page(1)), 1);
  assert.equal(eventsPanel.scrollPages(content, page(2)), 1);
  assert.equal(rows(first), 4);
  assert.equal(rows(second), 2);
  assert.ok(first.innerHTML.includes('[Event 1]') && !first.innerHTML.includes('[Event 5]'));
  assert.ok(second.innerHTML.includes('[Event 5]') && !second.innerHTML.includes('[Event 4]'));
  assert.ok(all.innerHTML.includes('[Event 1]') && all.innerHTML.includes('[Event 6]'));
});

test('the Events panel has no second part when the calendar has four events or fewer, and none at all with none', () => {
  const part = number => ({ team: '', department: '', part: number });

  assert.equal(eventsPanel.hasContent(eventsWorld(4), part(1)), true);
  assert.equal(eventsPanel.hasContent(eventsWorld(4), part(2)), false);
  assert.equal(eventsPanel.hasContent(eventsWorld(0), part(1)), false);
  assert.equal(eventsPanel.hasContent(eventsWorld(0), part(2)), false);
});

test('Team leads part 1 and part 2 are the first page and the next, and a short list has no part 2', () => {
  const lead = (name, at) => ({ id: 'lead-' + at, name: name, lead: '[Lead ' + at + ']', order: at });
  const many = contentOf([], raw => {
    raw.subteams = Array.from({ length: 6 }, (item, at) => lead('Dept' + at, at + 1));
  });
  const few = contentOf([], raw => {
    raw.subteams = Array.from({ length: 3 }, (item, at) => lead('Dept' + at, at + 1));
  });
  const page = part => ({ team: 'prime', department: '', part: part });

  assert.equal(leadsPanel.hasContent(many, page(1)), true);
  assert.equal(leadsPanel.hasContent(many, page(2)), true);
  assert.equal(leadsPanel.hasContent(few, page(1)), true);
  assert.equal(leadsPanel.hasContent(few, page(2)), false);
  assert.equal(leadsPanel.hasContent(few), true);
});

test('the Prime and Nova ranking rows are the competition rank card in the team of the view, and say there is no rank yet', () => {
  ['prime', 'nova'].forEach(team => {
    const row = config.defaultRotationRows().filter(item => item.view === team && item.panel === 'competition-rank');
    assert.equal(row.length, 1, team);
  });
  const empty = rankPanel.markupFor(contentOf([], raw => { delete raw.frc; }), now);
  assert.ok(wordsOf(empty).includes('There is no rank yet'));
  assert.ok(screens.tidyMainRow({ panel: 'competition-rank', team: 'nova' }), 'a row can name the card');
});

await runTests();
