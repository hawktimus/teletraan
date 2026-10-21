// Tests for the two Monday panels (dashboard/panels/monday-department and monday-charts), what they draw
// (core/monday-views.js and core/monday-draw.js), how a row of the rotation plays them or skips them (core/rotation.js,
// core/screens.js), and the rows of the eleven older Monday panels, which are retired. The board data is made up. The sizes
// need a browser to be seen, so the stylesheets are read.
//
//   node tests/monday-panels.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config, contentOf, htmlOf, load, monday, now, panels, read, registry, runTests, screens, task, test, views, wordsOf } from './helpers/monday-world.mjs';

const rotation = await load('core/rotation.js');
const viewsPlay = await load('core/views.js');
const draw = await load('core/monday-draw.js');
const repo = fileURLToPath(new URL('../', import.meta.url));
const studio = file => import(pathToFileURL(path.join(repo, 'studio', file)).href);

const department = page => views.departmentView(contentOf(page.tasks), now, page);


// The registry and the retired panels

test('the registry has two Monday panels, and none of the eleven older ones', () => {
  assert.deepEqual(registry.panels.filter(panel => panel.monday).map(panel => panel.id), ['monday-department', 'monday-charts']);
  assert.equal(config.retiredMondayPanels.length, 11);
  config.retiredMondayPanels.forEach(id => {
    assert.equal(registry.panels.some(panel => panel.id === id), false, id + ' is still registered');
    assert.equal(fs.existsSync(path.join(repo, 'dashboard/panels', id)), false, id + ' still has a folder');
  });
  ['monday-department', 'monday-charts'].forEach(id => {
    assert.ok(fs.existsSync(path.join(repo, 'dashboard/panels', id, 'panel.js')) && fs.existsSync(path.join(repo, 'dashboard/panels', id, 'panel.css')), id);
  });
});

test('a stored monday-tasks row with one of the nine departments plays as Department tasks, open, in the team of its view', () => {
  assert.deepEqual(rotation.tidyRotationRow({ view: 'prime', panel: 'monday-tasks', department: ' Build ', seconds: 30 }),
    { view: 'prime', panel: 'monday-department', shown: true, seconds: 30, department: 'build', list: 'open', team: 'prime' });
  assert.deepEqual(rotation.tidyRotationRow({ view: 'robotics', panel: 'monday-tasks', department: 'marketing' }),
    { view: 'robotics', panel: 'monday-department', shown: true, department: 'marketing', list: 'open' }, 'Robotics is both teams');
});

test('every other row of an older Monday panel is kept, marked retired, and plays nothing', () => {
  config.retiredMondayPanels.forEach(id => {
    const row = rotation.tidyRotationRow({ view: 'nova', panel: id, department: id === 'monday-tasks' ? 'Team lead X' : 'build', shown: true });
    assert.deepEqual(row, { view: 'nova', panel: id, shown: true, retired: true }, id);
    assert.equal(screens.tidyMainRow(rotation.mainRowOf(row, contentOf([])), false, true), null, id + ' has no step');
  });
  assert.equal(config.retiredWords, 'Retired, use Department tasks.');

  const content = contentOf([task({})], raw => { raw.settings.rotationRows = [{ _key: 'a', view: 'robotics', panel: 'monday-pie', shown: true }, { _key: 'b', view: 'robotics', panel: 'monday-tasks', department: 'build', shown: true }]; });
  const steps = viewsPlay.viewSteps(content, 'general', now);
  assert.deepEqual(steps.map(step => step.panel), ['monday-department'], 'the pie plays nothing and the tasks row plays Build');
});


// Department tasks

test('a department row shows the tasks of its department and list: Both has only the General tasks, a team has its own and the General ones', () => {
  const tasks = [
    task({ title: '[P]', team: 'prime' }), task({ title: '[N]', team: 'nova' }), task({ title: '[G]', team: undefined }),
    task({ title: '[E]', department: 'electrical' }), task({ title: '[D]', list: 'done', status: 'done' }),
  ];
  const projects = page => (department(Object.assign({ tasks: tasks }, page)) || { rows: [] }).rows.map(row => row.project).sort();
  assert.deepEqual(projects({ department: 'build', list: 'open' }), ['[G]'], 'both teams is the Condensed view: a task of one team never plays there');
  assert.deepEqual(projects({ department: 'build', list: 'open', team: 'prime' }), ['[G]', '[P]']);
  assert.deepEqual(projects({ department: 'build', list: 'open', team: 'nova' }), ['[G]', '[N]']);
  assert.deepEqual(projects({ department: 'build', list: 'done' }), ['[D]']);
  assert.deepEqual(projects({ department: 'electrical', list: 'open' }), ['[E]']);
  assert.equal(department({ tasks: tasks, department: 'cnc', list: 'open' }), null, 'nothing to show');
  assert.equal(department({ tasks: tasks, department: '', list: 'open' }), null, 'no department, nothing to show');
});

test('a task hidden by Show on TV? on the board or in the Studio, past its expiry, typed by hand or with no department is never drawn', () => {
  const tasks = [
    task({ title: '[On]' }),
    task({ title: '[Hide]', showOnBoard: false }), task({ title: '[Off]', showOnTv: false }), task({ title: '[Gone]', show: false }),
    task({ title: '[Old]', expires: '2026-10-01T00:00:00Z' }), task({ title: '[Hand]', source: undefined }),
    task({ title: '[None]', department: undefined }), task({ title: '[Odd]', department: 'unassigned' }),
  ];
  assert.deepEqual(department({ tasks: tasks, department: 'build', list: 'open' }).rows.map(row => row.project), ['[On]']);
});

test('open is In Progress, In Review, Stuck, To Do and then the earliest estimated completion date; done is the newest date completed first', () => {
  const open = [
    task({ title: '[todo early]', status: 'up-next', dueDate: '2026-10-16' }),
    task({ title: '[stuck]', status: 'blocked', dueDate: '2026-10-20' }),
    task({ title: '[progress no date]', status: 'in-progress', dueDate: undefined }),
    task({ title: '[progress late]', status: 'in-progress', dueDate: '2026-11-20' }),
    task({ title: '[progress soon]', status: 'in-progress', dueDate: '2026-10-18' }),
    task({ title: '[review]', status: 'in-review' }),
  ];
  assert.deepEqual(department({ tasks: open, department: 'build', list: 'open' }).rows.map(row => row.project),
    ['[progress soon]', '[progress late]', '[progress no date]', '[review]', '[stuck]', '[todo early]']);
  assert.deepEqual(department({ tasks: open, department: 'build', list: 'open' }).rows.map(row => row.statusWord),
    ['IN PROGRESS', 'IN PROGRESS', 'IN PROGRESS', 'IN REVIEW', 'STUCK', 'TO DO']);

  const done = [
    task({ title: '[a]', list: 'done', status: 'done', completedOn: '2026-10-01' }),
    task({ title: '[b]', list: 'done', status: 'done', completedOn: '2026-10-12' }),
    task({ title: '[c]', list: 'done', status: 'up-next', completedOn: undefined }),
  ];
  const rows = department({ tasks: done, department: 'build', list: 'done' }).rows;
  assert.deepEqual(rows.map(row => row.project), ['[b]', '[a]', '[c]']);
  assert.deepEqual(rows.map(row => row.status), ['done', 'done', 'done'], 'a task of the done list reads Done, whatever its status says');
});

test('the five columns, and the words of a value the board does not have: Unassigned, No Priority, No Date', () => {
  const tasks = [
    task({ title: '[Full]', contact: 'Robin', priority: 'high', dueDate: '2026-10-30' }),
    task({ title: '[Bare]', contact: undefined, priority: undefined, dueDate: undefined }),
  ];
  const rows = department({ tasks: tasks, department: 'build', list: 'open' }).rows;
  assert.deepEqual(rows[0], { status: 'up-next', statusWord: 'TO DO', project: '[Full]', contact: 'Robin', priority: 'High', priorityLevel: 'high', date: 'Oct 30' });
  assert.deepEqual([rows[1].contact, rows[1].priority, rows[1].date], ['Unassigned', 'No Priority', 'No Date']);

  const html = htmlOf('monday-department', contentOf(tasks), { department: 'build', list: 'open' });
  // The last name is DUE DATE on the TV (the board says Estimated Completion Date, which took three lines), and DATE is
  // hidden in the standard layout by panels/monday-department/panel.css
  const heads = Array.from(html.match(/<div class="columns">([\s\S]*?)<\/div>/)[1].matchAll(/<span>((?:[^<]|<span[^>]*>[^<]*<\/span>)*)<\/span>/g)).map(match => match[1].replace(/<[^>]*>/g, ''));
  assert.deepEqual(heads, ['STATUS', 'PROJECT', 'CONTACT', 'PRIORITY', 'DUE DATE']);
  assert.ok(html.includes('<span class="contact none">Unassigned</span>') && html.includes('<span class="priority priority-none">No Priority</span>') && html.includes('<span class="date none">No Date</span>'));
});

test('a task the older sync wrote, with no list, is done when its status is done', () => {
  const tasks = [task({ title: '[x]', list: undefined, status: 'done' }), task({ title: '[y]', list: undefined, status: 'in-progress' })];
  assert.deepEqual(department({ tasks: tasks, department: 'build', list: 'done' }).rows.map(row => row.project), ['[x]']);
  assert.deepEqual(department({ tasks: tasks, department: 'build', list: 'open' }).rows.map(row => row.project), ['[y]']);
});

test('the title is the department and the list; the team the row names is at the right end of the header', () => {
  const content = contentOf([task({ list: 'done', status: 'done' }), task({})]);
  assert.equal(views.departmentView(content, now, { department: 'build', list: 'open' }).title, 'BUILD TASKS');
  assert.equal(views.departmentView(content, now, { department: 'build', list: 'done' }).title, 'BUILD DONE');
  const prime = htmlOf('monday-department', content, { department: 'build', list: 'open', team: 'prime' });
  assert.match(prime, /<h2 class="title[^"]*" data-slat="title">BUILD TASKS<\/h2>/);
  assert.match(prime, /<span class="ago">PRIME · 1 MIN AGO<\/span>/);
  assert.match(htmlOf('monday-department', content, { department: 'build', list: 'open' }), /<span class="ago">1 MIN AGO<\/span>/, 'both teams: no team words');
  assert.deepEqual(views.departmentView(content, now, { department: 'build', list: 'open' }).counts, { open: 1, done: 1 });
});

test('four rows are in view, the list scrolls four rows at a time, and stops at twenty rows with the rest counted', () => {
  const tasks = [];
  for (let at = 0; at < 23; at += 1) tasks.push(task({ title: '[T' + String(at).padStart(2, '0') + ']', dueDate: undefined }));
  const page = { department: 'build', list: 'open' };
  const view = views.departmentView(contentOf(tasks), now, page);
  assert.equal(view.rows.length, 20);
  assert.equal(view.more, 3);
  assert.equal(view.pages, 5);
  assert.equal(panels['monday-department'].scrollPages(contentOf(tasks), page), 5);
  const html = htmlOf('monday-department', contentOf(tasks), page);
  assert.ok(html.includes('data-scroll-page="1"') && html.includes('data-scroll-list'));
  assert.ok(html.includes('<span class="place place-5">5 OF 5</span>') && html.includes('+3 MORE ON MONDAY'));
  assert.ok(read('panels/monday-department/panel.css').includes('--scroll-step: 336px'), 'four rows of 84');

  const few = contentOf([task({})]);
  assert.equal(panels['monday-department'].scrollPages(few, page), 1);
  assert.equal(htmlOf('monday-department', few, page).includes('data-scroll-page'), false, 'one page does not scroll');
});

test('a long project name is at 44px on two lines and a short one at the body size', () => {
  const html = htmlOf('monday-department', contentOf([task({ title: '[Short]' }), task({ title: '[A much longer project name]' })]), { department: 'build', list: 'open' });
  assert.ok(html.includes('<span class="project">[Short]</span>'));
  assert.ok(html.includes('<span class="project project-long">[A much longer project name]</span>'));
  const css = read('panels/monday-department/panel.css');
  assert.match(css, /\.monday-department \.project \{[^}]*font: 500 var\(--size-body\)\//);
  assert.match(css, /\.monday-department \.project-long \{[^}]*-webkit-line-clamp: 2;[^}]*font: 500 var\(--size-label\)\//);
});


// The TV charts

const chart = (tasks, page) => views.chartsView(contentOf(tasks), now, page);

test('status by department: Done, In Progress (with In Review and Stuck) and To Do for each department with tasks, in the order of the nine', () => {
  const tasks = [
    task({ department: 'marketing', status: 'up-next' }), task({ status: 'in-progress' }), task({ status: 'in-review' }), task({ status: 'blocked' }),
    task({ status: 'up-next' }), task({ list: 'done', status: 'done' }), task({ list: 'done', status: 'up-next' }),
  ];
  const view = chart(tasks, { chart: 'status' });
  assert.equal(view.title, 'STATUS BY DEPARTMENT');
  assert.deepEqual(view.rows, [
    { name: 'BUILD', done: 2, progress: 3, todo: 1, total: 6, blocked: 1 },
    { name: 'MARKETING', done: 0, progress: 0, todo: 1, total: 1, blocked: 0 },
  ]);
  assert.equal(view.longest, 6);
  const html = htmlOf('monday-charts', contentOf(tasks), { chart: 'status' });
  assert.ok(html.includes('<span class="segment part-progress" style="width: 50%">3</span>'));
  assert.ok(wordsOf(html).includes('DONE IN PROGRESS TO DO'), 'the legend');
  assert.equal(chart([], { chart: 'status' }), null);
});

test('overall progress is the estimated hours done over all the hours, and the tasks done over all the tasks when no task has hours', () => {
  const hours = [task({ estHours: 6, list: 'done', status: 'done' }), task({ estHours: 2 }), task({ estHours: 0 }), task({})];
  assert.deepEqual(chart(hours, { chart: 'progress' }), { title: 'OVERALL PROGRESS', team: '', department: '', chart: 'progress', percent: 75, done: 6, total: 8, unit: 'HOURS', tasks: { done: 1, open: 3 } });
  const counts = [task({ list: 'done', status: 'done' }), task({}), task({}), task({})];
  assert.deepEqual(chart(counts, { chart: 'progress' }).percent, 25);
  assert.equal(chart(counts, { chart: 'progress' }).unit, 'TASKS');
  assert.ok(wordsOf(htmlOf('monday-charts', contentOf(hours), { chart: 'progress' })).includes('75% 6 OF 8 HOURS DONE'));
});

test('the timeline: this month and the next two, the tasks with a Timeline by department in up to three lanes, and today', () => {
  const tasks = [
    task({ title: '[a]', startDate: '2026-10-01', dueDate: '2026-10-10' }),
    task({ title: '[b]', startDate: '2026-10-05', dueDate: '2026-10-20' }),
    task({ title: '[c]', startDate: '2026-10-06', dueDate: '2026-10-21' }),
    task({ title: '[d]', startDate: '2026-10-07', dueDate: '2026-10-22' }),
    task({ title: '[e]', startDate: '2026-12-20', dueDate: '2027-02-01', department: 'strategy' }),
    task({ title: '[f]', startDate: '2027-02-01', dueDate: '2027-02-05' }),
    task({ title: '[g]', startDate: undefined, dueDate: undefined }),
  ];
  const view = chart(tasks, { chart: 'timeline' });
  assert.deepEqual(view.months.map(month => month.name), ['OCT', 'NOV', 'DEC']);
  assert.equal(view.months[0].from, 0);
  assert.deepEqual(view.rows.map(row => row.name), ['BUILD', 'STRATEGY']);
  assert.deepEqual(view.rows[0].bars.map(bar => bar.lane), [0, 1, 2]);
  assert.equal(view.hidden, 1, 'a fourth lane is not drawn');
  assert.equal(view.without, 1);
  assert.equal(view.rows[1].bars[0].to, 1, 'a bar past the window ends at its edge');
  assert.ok(view.todayAt > 0 && view.todayAt < 0.2);
  assert.equal(chart([task({ startDate: undefined })], { chart: 'timeline' }), null, 'no task with a Timeline, nothing to show');
});

test('the charts take a team: a team has its own tasks and the General ones, and Both has the General ones only', () => {
  const tasks = [task({ team: 'prime' }), task({ team: 'nova' }), task({ team: undefined })];
  assert.equal(chart(tasks, { chart: 'status', team: 'prime' }).rows[0].total, 2);
  assert.equal(chart(tasks, { chart: 'status' }).rows[0].total, 1);
  assert.equal(chart(tasks, { chart: 'status', team: 'nova' }).team, 'NOVA');
});


// The rotation

test('a department or a chart with nothing to show is left out of the steps, as an empty row always was', () => {
  const content = contentOf([task({})]);
  const rows = [
    { panel: 'monday-department', team: '', tasksTeam: '', department: 'build', list: 'open' },
    { panel: 'monday-department', team: '', tasksTeam: '', department: 'build', list: 'done' },
    { panel: 'monday-department', team: '', tasksTeam: 'nova', department: 'cnc', list: 'open' },
    { panel: 'monday-charts', team: '', tasksTeam: '', chart: 'timeline' },
    { panel: 'monday-charts', team: '', tasksTeam: '', chart: 'progress' },
  ];
  const steps = rows.map((row, at) => screens.stepsOfRow(row, at, rows, content, now));
  assert.deepEqual(steps.map(list => list.length), [1, 0, 0, 1, 1]);
  assert.deepEqual(steps[0][0].page, { team: '', department: 'build', list: 'open', chart: 'status' });
  assert.equal(panels['monday-department'].hasContent(content, steps[0][0].page), true);
  assert.equal(panels['monday-department'].hasContent(content, { department: 'build', list: 'done' }), false);
  assert.equal(panels['monday-charts'].hasContent(content, { chart: 'status' }), true);
});

test('the default rotation has the four both-teams departments and the three charts in Robotics, and the five team departments in each team view', () => {
  const monday = config.defaultRotationRows().filter(row => row.panel.startsWith('monday-'));
  const words = row => row.view + ' ' + row.panel + ' ' + (row.department || row.chart) + ' ' + (row.list || '') + ' ' + (row.team || 'both');
  assert.deepEqual(monday.filter(row => row.view === 'robotics').map(words), [
    'robotics monday-department business open both', 'robotics monday-department operations open both',
    'robotics monday-department marketing open both', 'robotics monday-department strategy open both',
    'robotics monday-charts status  both', 'robotics monday-charts progress  both', 'robotics monday-charts timeline  both',
  ]);
  ['prime', 'nova'].forEach(team => assert.deepEqual(monday.filter(row => row.view === team).map(words),
    ['build', 'electrical', 'programming', 'design', 'cnc'].map(name => team + ' monday-department ' + name + ' open ' + team), team));
  ['monday-department', 'monday-charts'].forEach(id => assert.ok(config.roboticsWidePanels.includes(id), id + ' is wide'));

  // Business has a task for both teams, Build one for Prime and one for Nova
  const content = contentOf([task({ department: 'business' }), task({ team: 'prime' }), task({ team: 'nova', title: '[N]' })]);
  const steps = viewsPlay.viewSteps(content, 'general', now).filter(step => step.panel.startsWith('monday-'));
  assert.deepEqual(steps.map(step => step.page.department || step.page.chart), ['business', 'status', 'progress', 'timeline']);
  assert.deepEqual(steps.map(step => step.view), ['family', 'family', 'family', 'family']);
});

test('the sample content shows both panels', async () => {
  const sanity = await load('core/sanity.js');
  const sample = sanity.normalizeSample(JSON.parse(read('data/sample/content.json')));
  assert.ok(views.departmentView(sample, now, { department: 'build', list: 'open', team: 'prime' }).rows.length > 4, 'Build has more than one page');
  assert.ok(views.departmentView(sample, now, { department: 'business', list: 'open' }), 'Business has tasks for both teams');
  assert.ok(views.departmentView(sample, now, { department: 'operations', list: 'done' }));
  ['status', 'progress', 'timeline'].forEach(name => assert.ok(views.chartsView(sample, now, { chart: name }), name));
  sample.tasks.filter(item => item.department).forEach(item => assert.match(item.title, /^\[.*\]$/, 'a sample task is a marked placeholder'));
});


// The header and the stale chip

test('the header says how old the board is, and an amber chip says STALE when it is older than twice the read interval', () => {
  const fresh = contentOf([task({})]);
  assert.match(draw.boardHeader('BUILD TASKS', 'PRIME', fresh, now), /PRIME · 1 MIN AGO/);
  const old = contentOf([task({})], raw => { raw.monday.lastSyncAt = '2026-10-15T14:00:00Z'; });
  const header = draw.boardHeader('BUILD TASKS', 'PRIME', old, now);
  assert.ok(header.includes('<span class="stale-chip">STALE · 120 MIN</span>'), header);
  assert.ok(header.includes('<span class="ago">PRIME</span>'), 'the team stays when the board is stale');
  assert.equal(monday.stale(monday.markUnreachable(fresh).monday, now, 30), true, 'out of reach is stale');
  assert.equal(monday.stale({ sample: true }, now), false);
});


// The look

const exceptions = [30, 36, 40]; // the chips, the labels of the columns and the legend, and the first name of a contact (40, an owner name), which the order for the panels allows

test('the stylesheets use no text under 44px but the chips and the labels, no colour of their own and nothing that moves', () => {
  ['panels/monday-department/panel.css', 'panels/monday-charts/panel.css', 'monday.css'].forEach(file => {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    Array.from(css.matchAll(/font:\s*\d+\s+(\d+)px/g)).forEach(match => {
      const size = Number(match[1]);
      assert.ok(size >= 44 || exceptions.includes(size), file + ' has text at ' + size + 'px');
    });
    assert.equal(/#[0-9a-f]{3,8}\b/i.test(css), false, file + ' has a colour of its own');
    assert.equal(/animation|transition|@keyframes|filter:|box-shadow|text-shadow/.test(css), false, file + ' moves or glows');
  });
  ['panels/monday-department/panel.js', 'panels/monday-charts/panel.js'].forEach(file => {
    assert.equal(/animate\(|requestAnimationFrame|setTimeout|setInterval/.test(read(file)), false, file + ' has animation code');
  });
});


test('the standard layout stacks the contact under the status, has rows of 96 and says DUE, and the bar layout has room for a first name', () => {
  const css = read('panels/monday-department/panel.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // the rules of the standard layout for a selector, as one text (a selector may be in a list, and in more than one rule)
  const standard = selector => Array.from(css.matchAll(new RegExp('html\\[data-layout="standard"\\] \\.monday-department ' + selector.replace(/[.>:()]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'))).map(match => match[1]).join(';');
  const rule = (selector, name) => (standard(selector).match(new RegExp('(?:^|[;\\s])' + name + ':\\s*([^;]+);')) || [])[1];

  // four rows of 96 are the window, the step of the scroll and, with the header of 64, end where the counts begin (452)
  assert.equal(rule('.row', 'height'), '96px');
  assert.equal(rule('.rows-window', 'height'), '384px');
  assert.equal(rule('.rows-window', 'top'), '64px');
  assert.ok(/html\[data-layout="standard"\] \.monday-department \{ --scroll-step: 384px; \}/.test(css));
  assert.ok(64 + 4 * 96 <= 452, 'the rows end above the counts');
  // the contact is in the first column, under the chip: 48 and 44 make 92 of the 96
  assert.ok(/\.row > :nth-child\(3\)[^{]*\{ grid-column: 1; grid-row: 2; \}/.test(css), 'the contact is under the status');
  assert.equal(rule('.row', 'grid-template-rows'), '48px 44px');
  assert.ok(/grid-template-columns: 274px minmax\(0, 1fr\) 180px 150px;/.test(css), 'the project has what the three others leave');
  assert.equal(rule('.project', '-webkit-line-clamp'), '2', 'a project has two full lines');
  assert.ok(/\.date-more \{ display: none; \}/.test(css), 'DATE is dropped in the narrow layout, DUE stays');
  // a first name is 40 and wraps, in both layouts; it is never cut with dots
  const contact = css.match(/^\.monday-department \.contact \{([^}]*)\}/m)[1];
  assert.ok(/font: 500 40px/.test(contact) && /overflow-wrap: anywhere/.test(contact) && /white-space: normal/.test(contact) && !/ellipsis/.test(contact));
  assert.ok(/grid-template-columns: 232px minmax\(0, 1fr\) 250px 180px 180px;/.test(css), 'the bar layout has 250 for a name (Bartholomew is 238 at 40px)');
  // No Priority and No Date take two lines and are not cut
  assert.ok(/\.monday-department \.priority,\s*\.monday-department \.date \{\s*white-space: normal;/.test(css));
});


// The Studio and the control page follow the same rules

test('the Studio and the control page have the same department, list, chart and team choices, and the same retired panels', async () => {
  const parts = await studio('inputs/screen-panels.js');
  const lists = await import(pathToFileURL(path.join(repo, 'dashboard/config-lists.js')).href);
  assert.deepEqual(parts.mondayDepartmentChoices, lists.mondayDepartments);
  assert.deepEqual(parts.mondayListChoices, lists.mondayLists);
  assert.deepEqual(parts.mondayChartChoices, lists.mondayCharts);
  assert.deepEqual(parts.olderMondayPanels.map(item => item.value), lists.retiredMondayPanels);
  assert.deepEqual(parts.mondayPanels.map(item => item.value), ['monday-department', 'monday-charts']);

  const board = await studio('tools/rotation-board.js');
  assert.deepEqual(board.mondayTeamChoices, lists.mondayTeams);
  assert.equal(board.retiredWords, lists.retiredWords);
  [
    { view: 'prime', panel: 'monday-tasks', department: 'Build' }, { view: 'robotics', panel: 'monday-tasks', department: 'cnc' },
    { view: 'nova', panel: 'monday-tasks', department: '' }, { view: 'nova', panel: 'monday-done', department: 'build' },
  ].forEach(row => {
    const upgraded = board.upgradedRow(row);
    const wall = rotation.upgradeMondayRow(row);
    assert.deepEqual(upgraded, wall === row ? null : wall, JSON.stringify(row));
  });
});

test('the tables of the Monday page in the Studio are the rows of the panel, from the same code', async () => {
  const page = await studio('inputs/monday-page-parts.js');
  const tasks = [
    task({ title: '[a]', status: 'up-next', dueDate: '2026-10-16' }), task({ title: '[b]', status: 'blocked' }), task({ title: '[c]', status: 'in-progress', dueDate: undefined }),
    task({ title: '[d]', status: 'in-review', contact: undefined, priority: undefined }), task({ title: '[e]', list: 'done', status: 'done', completedOn: '2026-10-02' }),
  ];
  const wall = views.departmentView(contentOf(tasks), now, { department: 'build', list: 'open' }).rows;
  const table = page.departmentTables(page.contentOf({ tasks: tasks }), '', now).find(entry => entry.value === 'build');
  assert.deepEqual(table.openRows, wall);
  assert.deepEqual([table.open, table.done], [4, 1]);
});

await runTests();
