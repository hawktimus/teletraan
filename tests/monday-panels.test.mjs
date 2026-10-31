// Tests for the three Monday panels (dashboard/panels/monday-department, monday-charts and monday-projects), what they draw
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

test('the registry has three Monday panels, and none of the eleven older ones', () => {
  assert.deepEqual(registry.panels.filter(panel => panel.monday).map(panel => panel.id), ['monday-department', 'monday-charts', 'monday-projects']);
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

test('open is Stuck, then In Progress and In Review by the soonest end of the Timeline, then To Do by priority; done is the newest date completed first', () => {
  const open = [
    task({ title: '[todo low]', status: 'up-next', priority: 'low', dueDate: '2026-10-16' }),
    task({ title: '[todo high late date]', status: 'up-next', priority: 'high', dueDate: '2026-12-01' }),
    task({ title: '[todo high early date]', status: 'up-next', priority: 'high', dueDate: '2026-10-20' }),
    task({ title: '[todo no priority]', status: 'up-next', priority: undefined, dueDate: '2026-10-16' }),
    task({ title: '[stuck]', status: 'blocked', dueDate: '2026-10-20' }),
    task({ title: '[progress no date]', status: 'in-progress', dueDate: undefined }),
    task({ title: '[progress late]', status: 'in-progress', dueDate: '2026-11-20' }),
    task({ title: '[progress soon]', status: 'in-progress', dueDate: '2026-10-18' }),
    task({ title: '[review]', status: 'in-review', dueDate: '2026-10-19' }),
  ];
  const rows = department({ tasks: open, department: 'build', list: 'open' }).rows;
  assert.deepEqual(rows.map(row => row.project), [
    '[stuck]', '[progress soon]', '[review]', '[progress late]', '[progress no date]',
    '[todo high early date]', '[todo high late date]', '[todo low]', '[todo no priority]',
  ]);
  assert.deepEqual(rows.map(row => row.statusWord), ['STUCK', 'IN PROGRESS', 'IN REVIEW', 'IN PROGRESS', 'IN PROGRESS', 'TO DO', 'TO DO', 'TO DO', 'TO DO']);

  const done = [
    task({ title: '[a]', list: 'done', status: 'done', completedOn: '2026-10-01' }),
    task({ title: '[b]', list: 'done', status: 'done', completedOn: '2026-10-12' }),
    task({ title: '[c]', list: 'done', status: 'up-next', completedOn: undefined }),
  ];
  const doneRows = department({ tasks: done, department: 'build', list: 'done' }).rows;
  assert.deepEqual(doneRows.map(row => row.project), ['[b]', '[a]', '[c]']);
  assert.deepEqual(doneRows.map(row => row.status), ['done', 'done', 'done'], 'a task of the done list reads Done, whatever its status says');
});

test('the count in the header: how many are in progress, stuck and to do, or how many are done', () => {
  const open = [task({ status: 'in-progress' }), task({ status: 'in-review' }), task({ status: 'blocked' }), task({ status: 'up-next' }), task({ status: 'up-next' }), task({ list: 'done', status: 'done' })];
  assert.equal(department({ tasks: open, department: 'build', list: 'open' }).countWords, '2 IN PROGRESS · 1 STUCK · 2 TO DO');
  assert.equal(department({ tasks: [task({ status: 'up-next' })], department: 'build', list: 'open' }).countWords, '0 IN PROGRESS · 1 TO DO', 'Stuck is left out when there is none');
  assert.equal(department({ tasks: open, department: 'build', list: 'done' }).countWords, '1 DONE');
  assert.equal(department({ tasks: open, department: 'build', list: 'open' }).tallyWords, '5 OPEN · 1 DONE');
  const html = htmlOf('monday-department', contentOf(open), { department: 'build', list: 'open' });
  assert.ok(html.includes('<span class="count-words">2 IN PROGRESS · 1 STUCK · 2 TO DO</span>') && html.includes('<span class="tally">5 OPEN · 1 DONE</span>'));
});

test('a column is drawn only when a task of the list has a value for it, and a value a task does not have is left empty', () => {
  const tasks = [
    task({ title: '[Full]', contact: 'Robin', priority: 'high', dueDate: '2026-10-30' }),
    task({ title: '[Bare]', contact: undefined, priority: undefined, dueDate: undefined }),
  ];
  const view = department({ tasks: tasks, department: 'build', list: 'open' });
  assert.deepEqual(view.rows[0], { status: 'up-next', statusWord: 'TO DO', project: '[Full]', contact: 'Robin', priority: 'High', priorityLevel: 'high', date: 'Oct 30', late: false, note: '', extra: false });
  assert.deepEqual([view.rows[1].contact, view.rows[1].priority, view.rows[1].date], ['Unassigned', 'No Priority', 'No Date'], 'the page of the Studio and the control page still say these words');
  assert.deepEqual(view.columns, { contact: true, priority: true, date: true });

  const html = htmlOf('monday-department', contentOf(tasks), { department: 'build', list: 'open' });
  assert.ok(html.includes('<span class="contact">Robin</span>') && html.includes('<span class="contact"></span>'), 'the bare row has an empty place');
  assert.ok(html.includes('priority priority-none"></span>') && html.includes('<span class="date blank"></span>'));
  assert.equal(/Unassigned|No Priority|No Date/.test(html), false, 'a placeholder word is never drawn');
  assert.equal(html.includes('class="columns"'), false, 'there is no line of column names');

  // no task has a contact, a priority or a date: none of the three columns is drawn, and the project takes the room
  const bare = [task({ title: '[One]', contact: undefined, priority: undefined, dueDate: undefined }), task({ title: '[Two]', contact: undefined, priority: undefined, dueDate: undefined })];
  const none = department({ tasks: bare, department: 'build', list: 'open' });
  assert.deepEqual(none.columns, { contact: false, priority: false, date: false });
  const bareHtml = htmlOf('monday-department', contentOf(bare), { department: 'build', list: 'open' });
  assert.equal(/class="(contact|priority|date)/.test(bareHtml), false);
  assert.ok(bareHtml.includes('--cols: minmax(0, 1fr) var(--w-chip)') && bareHtml.includes('class="rows cols-0"'));
  assert.ok(html.includes('--cols: minmax(0, 1fr) var(--w-date) var(--w-priority) var(--w-contact) var(--w-chip)') && html.includes('class="rows cols-3"'));
});

test('a task past the end of its Timeline that is not done is LATE, in a chip, in place of its date, and a done task never is', () => {
  const tasks = [
    task({ title: '[Past]', status: 'in-progress', dueDate: '2026-10-14' }),
    task({ title: '[Today]', status: 'in-progress', dueDate: '2026-10-15' }),
    task({ title: '[Future]', status: 'in-progress', dueDate: '2026-10-16' }),
    task({ title: '[No date]', status: 'in-progress', dueDate: undefined }),
  ];
  const rows = department({ tasks: tasks, department: 'build', list: 'open' }).rows;
  const late = Object.fromEntries(rows.map(row => [row.project, row.late]));
  assert.deepEqual(late, { '[Past]': true, '[Today]': false, '[Future]': false, '[No date]': false });
  const html = htmlOf('monday-department', contentOf(tasks), { department: 'build', list: 'open' });
  assert.equal(html.split('chip chip-late">LATE</span>').length - 1, 1, 'one LATE chip');
  assert.equal(html.includes('Oct 14'), false, 'the date of a late task is not printed');
  assert.ok(html.includes('Oct 16'));

  const done = department({ tasks: [task({ list: 'done', status: 'done', dueDate: '2026-06-01', completedOn: '2026-06-02' })], department: 'build', list: 'done' }).rows;
  assert.equal(done[0].late, false);
  assert.ok(read('panels/monday-department/panel.css').includes('.monday-department .chip-late { width: 104px;'));
});

test('the note of a Stuck task is its second line, one line, and no other task shows a note', () => {
  const tasks = [
    task({ title: '[Stuck]', status: 'blocked', note: 'Waiting for a part from the supplier' }),
    task({ title: '[Going]', status: 'in-progress', note: 'A long sentence that the row never shows' }),
    task({ title: '[Stuck bare]', status: 'blocked' }),
  ];
  const view = department({ tasks: tasks, department: 'build', list: 'open' });
  assert.deepEqual(view.rows.map(row => [row.project, row.note, row.extra]), [['[Stuck bare]', '', false], ['[Stuck]', 'Waiting for a part from the supplier', true], ['[Going]', '', false]]);
  const html = htmlOf('monday-department', contentOf(tasks), { department: 'build', list: 'open' });
  assert.ok(html.includes('<span class="note">Waiting for a part from the supplier</span>'));
  assert.equal(html.includes('never shows'), false);
  const note = read('panels/monday-department/panel.css').match(/\.monday-department \.note \{([^}]*)\}/)[1];
  assert.ok(/white-space: nowrap;/.test(note) && /text-overflow: ellipsis;/.test(note), 'one line with an ellipsis');
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

test('as many rows are in view as fit the body, the list scrolls a page at a time, and stops at twenty rows with the rest counted', () => {
  const tasks = [];
  for (let at = 0; at < 23; at += 1) tasks.push(task({ title: '[T' + String(at).padStart(2, '0') + ']', dueDate: undefined }));
  const page = { department: 'build', list: 'open' };
  const view = views.departmentView(contentOf(tasks), now, page);
  assert.equal(view.rows.length, 20);
  assert.equal(view.more, 3);
  assert.deepEqual(view.pageRows.map(rows => rows.length), [7, 7, 6], 'seven rows of 68 fit the window of 476');
  assert.equal(view.pages, 3);
  assert.equal(panels['monday-department'].scrollPages(contentOf(tasks), page), 3);
  const html = htmlOf('monday-department', contentOf(tasks), page);
  assert.ok(html.includes('data-scroll-page="1"') && html.includes('data-scroll-list'));
  assert.equal(html.split('class="rows-page"').length - 1, 3, 'a block for each page, so a step moves one window');
  assert.ok(html.includes('<span class="place place-3">3 OF 3</span>') && html.includes('+3 MORE ON MONDAY'));
  assert.ok(read('panels/monday-department/panel.css').includes('--scroll-step: 476px'), 'seven rows of 68');
  assert.equal(views.rowRoom.bar.window, 7 * views.rowRoom.bar.row);

  // The standard layout has two lines in a row (96) and a count of two lines, so four rows
  assert.deepEqual(views.departmentView(contentOf(tasks), now, page, 'standard').pageRows.map(rows => rows.length), [4, 4, 4, 4, 4]);

  // A row with a second line (a Stuck note) takes 48 more, so a page holds one row less
  const noted = [];
  for (let at = 0; at < 8; at += 1) noted.push(task({ title: '[N' + at + ']', status: 'blocked', note: '[note]', dueDate: undefined }));
  assert.deepEqual(views.departmentView(contentOf(noted), now, page).pageRows.map(rows => rows.length), [4, 4], 'four rows of 116 fit 476');
  assert.ok(views.pagesOf([{ extra: true }], 'bar').length === 1, 'a page holds one row at least');

  const few = contentOf([task({})]);
  assert.equal(panels['monday-department'].scrollPages(few, page), 1);
  assert.equal(htmlOf('monday-department', few, page).includes('data-scroll-page'), false, 'one page does not scroll');
});

test('a long project name is on one line, and takes the room the fixed columns leave', () => {
  const html = htmlOf('monday-department', contentOf([task({ title: '[Short]' }), task({ title: '[A much longer project name]' })]), { department: 'build', list: 'open' });
  assert.ok(html.includes('<span class="project">[Short]</span>') && html.includes('<span class="project">[A much longer project name]</span>'));
  const css = read('panels/monday-department/panel.css');
  assert.match(css, /\.monday-department \.project \{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;[^}]*font: 500 var\(--size-label\)\//);
  assert.match(css, /\.monday-department \.cols-2 \.project \{ font-size: var\(--size-body\); \}/, 'with two columns or fewer the name is at the body size');
  assert.match(css, /grid-template-columns: var\(--cols, /);
});

test('nothing to show is one line under the title, not a box', () => {
  const content = contentOf([task({ list: 'done', status: 'done' })]);
  const open = htmlOf('monday-department', content, { department: 'build', list: 'open' });
  assert.ok(open.includes('<p class="empty">Nothing in progress</p>') && open.includes('BUILD TASKS'), 'the title is the department');
  assert.ok(htmlOf('monday-department', contentOf([task({})]), { department: 'build', list: 'done' }).includes('<p class="empty">Nothing done yet</p>'));
  assert.ok(htmlOf('monday-department', content, {}).includes('DEPARTMENT TASKS'));
  const never = htmlOf('monday-department', contentOf([], raw => { raw.monday.lastSyncAt = ''; }), { department: 'build', list: 'open' });
  assert.ok(never.includes('Waiting for the first read of the board.'));
  const css = read('monday.css');
  assert.match(css, /\.monday \.empty \{[^}]*white-space: nowrap;/);
  assert.equal(/\.monday \.empty \{[^}]*height: 100%/.test(css), false, 'no box that fills the body');
});


// Projects

const projectList = list => list.map((entry, at) => Object.assign({ id: String(at), title: '[Project ' + at + ']', status: 'in-progress' }, entry));
const withProjects = (list, change) => contentOf([], raw => { raw.monday.projects = projectList(list); if (change) change(raw); });
const projects = (list, page = { team: '' }) => views.projectsView(withProjects(list), now, page);

test('projects: Stuck, In Progress, In Review and To Do first, then up to 3 done in the last 14 days, the newest first', () => {
  const view = projects([
    { title: '[todo]', status: 'up-next' }, { title: '[done old]', status: 'done', completedOn: '2026-09-30' },
    { title: '[done 1]', status: 'done', completedOn: '2026-10-10' }, { title: '[done 2]', status: 'done', completedOn: '2026-10-14' },
    { title: '[done 3]', status: 'done', completedOn: '2026-10-01' }, { title: '[done 4]', status: 'done', completedOn: '2026-10-12' },
    { title: '[done none]', status: 'done' }, { title: '[done 5]', status: 'done', completedOn: '2026-10-13' },
    { title: '[progress]', status: 'in-progress' }, { title: '[review]', status: 'in-review' }, { title: '[stuck]', status: 'blocked' },
  ]);
  assert.deepEqual(view.rows.map(row => row.project), ['[stuck]', '[progress]', '[review]', '[todo]', '[done 2]', '[done 5]', '[done 4]']);
  assert.deepEqual(view.rows.map(row => row.statusWord), ['STUCK', 'IN PROGRESS', 'IN REVIEW', 'TO DO', 'DONE', 'DONE', 'DONE']);
  assert.equal(view.title, 'PROJECTS');
  assert.equal(view.countWords, '2 IN PROGRESS · 1 STUCK · 1 TO DO');
  assert.equal(view.tallyWords, '3 DONE');
  assert.equal(projects([{ status: 'done', completedOn: '2026-09-01' }]), null, 'only an old done project: nothing to show');
  assert.equal(projects([]), null);
});

test('projects: a project past the end of its Timeline that is not done is late, and a missing Timeline never is', () => {
  const view = projects([
    { title: '[past]', timelineEnd: '2026-10-01' }, { title: '[today]', timelineEnd: '2026-10-15' }, { title: '[none]' },
    { title: '[done past]', status: 'done', completedOn: '2026-10-14', timelineEnd: '2026-10-01' }, { title: '[future]', status: 'up-next', timelineEnd: '2027-01-01' },
  ]);
  const late = Object.fromEntries(view.rows.map(row => [row.project, row.late]));
  assert.deepEqual(late, { '[past]': true, '[today]': false, '[none]': false, '[done past]': false, '[future]': false });
  assert.match(htmlOf('monday-projects', withProjects([{ title: '[past]', timelineEnd: '2026-10-01' }]), { team: '' }), /chip chip-late">LATE</);
  assert.doesNotMatch(htmlOf('monday-projects', withProjects([{ title: '[none]' }]), { team: '' }), /chip-late/);
  assert.match(fs.readFileSync(new URL('../dashboard/monday.css', import.meta.url), 'utf8'), /\.monday \.chip \{[^}]*font: 700 30px/);
});

test('projects: the mentor first name, and the last initial for both when two mentors share a first name', () => {
  const view = projects([
    { title: '[a]', mentor: 'Dan', mentorInitial: 'K' }, { title: '[b]', mentor: 'Dan', mentorInitial: 'M' }, { title: '[c]', mentor: 'Cari-Ann' },
    { title: '[d]', mentor: 'Dan', mentorInitial: 'K' }, { title: '[e]', mentor: 'Steve', mentorInitial: 'R' }, { title: '[f]' },
  ]);
  assert.deepEqual(view.rows.map(row => row.mentor), ['Dan K', 'Dan M', 'Cari-Ann', 'Dan K', 'Steve', ''], 'two Dans get an initial, one Steve with an initial does not');
  // one Dan with no initial and one with: only the one that has an initial can be told apart
  assert.deepEqual(projects([{ title: '[a]', mentor: 'Dan' }, { title: '[b]', mentor: 'Dan', mentorInitial: 'K' }]).rows.map(row => row.mentor), ['Dan', 'Dan K']);
});

test('projects: nothing is drawn for a value the project does not have, and no column no project has', () => {
  const view = projects([{ title: '[Bare]' }, { title: '[Full]', mentor: 'Pat', helpers: ['Cari-Ann', 'Steve'], percent: 45 }]);
  assert.deepEqual(view.rows.map(row => [row.mentor, row.helperWords, row.percent, row.extra]), [['', '', null, false], ['Pat', 'with Cari-Ann, Steve', 45, true]]);
  assert.deepEqual(view.columns, { mentor: true, percent: true });
  const html = htmlOf('monday-projects', withProjects([{ title: '[Bare]' }, { title: '[Full]', mentor: 'Pat', helpers: ['Cari-Ann'], percent: 45 }]), { team: '' });
  assert.ok(html.includes('<span class="mentor">Pat</span>') && html.includes('45%') && html.includes('style="width: 45%"') && html.includes('<span class="note">with Cari-Ann</span>'));
  assert.equal(/\[Bare\]<\/span><\/span><span class="details"><span class="mentor">/.test(html), true, 'a bare row has an empty mentor place');

  const plain = htmlOf('monday-projects', withProjects([{ title: '[One]' }, { title: '[Two]' }]), { team: '' });
  assert.equal(/class="(mentor|percent|note)/.test(plain), false, 'no mentor, bar or helpers drawn');
  assert.ok(plain.includes('--cols: minmax(0, 1fr) var(--w-chip)') && plain.includes('class="rows cols-0"'));
  assert.ok(html.includes('--cols: var(--w-mentor) minmax(0, 1fr) var(--w-percent) var(--w-chip)'));
});

test('projects: pages by the room they take, and a helpers line takes 48 more', () => {
  const many = [];
  for (let at = 0; at < 12; at += 1) many.push({ title: '[P' + at + ']', mentor: 'Pat' });
  assert.deepEqual(projects(many).pageRows.map(rows => rows.length), [7, 5]);
  const helped = many.map(entry => Object.assign({}, entry, { helpers: ['Sam'] }));
  assert.deepEqual(projects(helped).pageRows.map(rows => rows.length), [4, 4, 4], 'four rows of 116 fit 476');
  assert.equal(panels['monday-projects'].scrollPages(withProjects(many), { team: '' }), 2);
  assert.equal(panels['monday-projects'].hasContent(withProjects(many), { team: '' }), true);
});

test('projects play only for both teams in the Robotics view: a Prime or Nova page has nothing, and so has a Prime or Nova block', () => {
  assert.equal(projects([{ title: '[a]' }], { team: 'prime' }), null);
  assert.equal(projects([{ title: '[a]' }], { team: 'nova' }), null);
  const content = withProjects([{ title: '[a]', status: 'in-progress' }]);
  const rows = [
    { panel: 'monday-projects', team: '', tasksTeam: '' },
    { panel: 'monday-projects', team: 'prime', tasksTeam: '' },
    { panel: 'monday-projects', team: 'nova', tasksTeam: '' },
  ];
  assert.deepEqual(rows.map((row, at) => screens.stepsOfRow(row, at, rows, content, now).length), [1, 0, 0], 'the Prime and Nova blocks give their team to a row, and the page is for no team');
  const steps = viewsPlay.viewSteps(content, 'general', now).filter(step => step.panel === 'monday-projects');
  assert.deepEqual(steps.map(step => step.view), ['family'], 'the Robotics block plays it in the Condensed view, with no Team on the page');
  assert.equal(steps[0].page.team, '');
  assert.equal(viewsPlay.viewSteps(content, 'prime', now).some(step => step.panel === 'monday-projects'), false);
  assert.equal(viewsPlay.viewSteps(content, 'nova', now).some(step => step.panel === 'monday-projects'), false);
  assert.equal(viewsPlay.viewSteps(contentOf([]), 'general', now).some(step => step.panel === 'monday-projects'), false, 'no project, no step');
  assert.ok(config.roboticsWidePanels.includes('monday-projects') && config.mondayKinds['monday-projects'] === 'projects');
  const row = rotation.tidyRotationRow({ view: 'robotics', panel: 'monday-projects', seconds: 25, team: 'prime', department: 'build', chart: 'timeline' });
  assert.deepEqual(row, { view: 'robotics', panel: 'monday-projects', shown: true, seconds: 25, department: 'build' }, 'a row of Projects has no team and no chart; its seconds are its own');
});

test('projects: the document of the sync is cleaned, so a last name or an address never reaches the screen', () => {
  const tidy = monday.tidyMondayStatus({
    lastSyncAt: '2026-10-15T15:59:00Z',
    projects: [
      { id: '1', title: '  Shelves  ', status: 'in-progress', mentor: 'Dan', mentorInitial: 'k', helpers: ['Cari-Ann', 'Steve Ray', 'a@b.com', 'Lee'], percent: 140, timelineEnd: '2026-10-01' },
      { id: '2', title: 'Odd status', status: 'waiting' }, { id: '3', title: '', status: 'done' },
      { id: '4', title: 'Address', status: 'up-next', mentor: 'dan@example.com', percent: -5, completedOn: 'soon', timelineEnd: 'later' },
      'not a project', null,
    ],
  });
  assert.deepEqual(tidy.projects, [
    { id: '1', title: 'Shelves', status: 'in-progress', mentor: 'Dan', mentorInitial: 'K', helpers: ['Cari-Ann', 'Lee'], percent: 100, timelineEnd: '2026-10-01' },
    { id: '4', title: 'Address', status: 'up-next', percent: 0 },
  ]);
  assert.deepEqual(monday.tidyMondayStatus({ lastSyncAt: '2026-10-15T15:59:00Z' }).projects, [], 'a document with no list has no projects');
});

test('projects: the empty state is one line, and the sample content shows the panel', async () => {
  assert.ok(htmlOf('monday-projects', contentOf([]), { team: '' }).includes('<p class="empty">Nothing in progress</p>'));
  assert.ok(htmlOf('monday-projects', contentOf([], raw => { raw.monday.lastSyncAt = ''; }), { team: '' }).includes('Waiting for the first read'));
  const sanity = await load('core/sanity.js');
  const sample = sanity.normalizeSample(JSON.parse(read('data/sample/content.json')));
  assert.ok(views.projectsView(sample, now, { team: '' }), 'the sample has projects');
  sample.monday.projects.forEach(project => assert.match(project.title, /^\[.*\]$/, 'a sample project is a marked placeholder'));
});

test('the Projects chip is the same 30px chip, and the stylesheet draws the bar by width only', () => {
  const css = read('panels/monday-projects/panel.css');
  assert.match(css, /\.monday-projects \.percent-fill \{[^}]*width|\.percent-fill \{\s*display: block;/);
  assert.equal(/transition|animation/.test(css), false);
  const html = htmlOf('monday-projects', withProjects([{ title: '[a]', percent: 10 }]), { team: '' });
  assert.ok(html.includes('<span class="chip chip-in-progress">IN PROGRESS</span>'));
  assert.match(read('monday.css'), /\.monday \.chip \{[^}]*font: 700 30px\/48px/);
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
  assert.deepEqual(chart(hours, { chart: 'progress' }), { title: 'OVERALL PROGRESS', team: '', department: '', chart: 'progress', percent: 75, bar: true, done: 6, total: 8, unit: 'HOURS', tasks: { done: 1, open: 3 } });
  const counts = [task({ list: 'done', status: 'done' }), task({}), task({}), task({})];
  assert.deepEqual(chart(counts, { chart: 'progress' }).percent, 25);
  assert.equal(chart(counts, { chart: 'progress' }).unit, 'TASKS');
  assert.ok(wordsOf(htmlOf('monday-charts', contentOf(hours), { chart: 'progress' })).includes('75% 6 OF 8 HOURS DONE'));
});

test('overall progress counts tasks when the hours add up to 0, and draws no bar at 0 percent', () => {
  // the board has no Estimated Hours today: the total is 0, so the percent is done tasks over all tasks
  const none = [task({ estHours: 0 }), task({ list: 'done', status: 'done', estHours: 0 }), task({}), task({})];
  const counted = chart(none, { chart: 'progress' });
  assert.deepEqual([counted.percent, counted.unit, counted.done, counted.total, counted.bar], [25, 'TASKS', 1, 4, true]);
  const html = htmlOf('monday-charts', contentOf(none), { chart: 'progress' });
  assert.ok(html.includes('class="progress-track"') && html.includes('style="width: 25%"'));

  const nothing = [task({}), task({})];
  const zero = chart(nothing, { chart: 'progress' });
  assert.deepEqual([zero.percent, zero.bar], [0, false]);
  const empty = htmlOf('monday-charts', contentOf(nothing), { chart: 'progress' });
  assert.equal(empty.includes('progress-track'), false, 'a 0 percent bar is not drawn');
  assert.ok(wordsOf(empty).includes('0% 0 OF 2 TASKS DONE'));
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

test('the default rotation has the four both-teams departments, the three charts and Projects in Robotics, and the five team departments in each team view', () => {
  const monday = config.defaultRotationRows().filter(row => row.panel.startsWith('monday-'));
  const words = row => row.view + ' ' + row.panel + ' ' + (row.department || row.chart || '') + ' ' + (row.list || '') + ' ' + (row.team || 'both');
  assert.deepEqual(monday.filter(row => row.view === 'robotics').map(words), [
    'robotics monday-department business open both', 'robotics monday-department operations open both',
    'robotics monday-department marketing open both', 'robotics monday-department strategy open both',
    'robotics monday-charts status  both', 'robotics monday-charts progress  both', 'robotics monday-charts timeline  both',
    'robotics monday-projects   both',
  ]);
  ['prime', 'nova'].forEach(team => assert.deepEqual(monday.filter(row => row.view === team).map(words),
    ['build', 'electrical', 'programming', 'design', 'cnc'].map(name => team + ' monday-department ' + name + ' open ' + team), team));
  ['monday-department', 'monday-charts', 'monday-projects'].forEach(id => assert.ok(config.roboticsWidePanels.includes(id), id + ' is wide'));

  // Business has a task for both teams, Build one for Prime and one for Nova
  const content = contentOf([task({ department: 'business' }), task({ team: 'prime' }), task({ team: 'nova', title: '[N]' })]);
  const steps = viewsPlay.viewSteps(content, 'general', now).filter(step => step.panel.startsWith('monday-'));
  assert.deepEqual(steps.map(step => step.page.department || step.page.chart), ['business', 'status', 'progress', 'timeline']);
  assert.deepEqual(steps.map(step => step.view), ['family', 'family', 'family', 'family']);
});

test('the sample content shows the department and chart panels', async () => {
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
  ['panels/monday-department/panel.css', 'panels/monday-charts/panel.css', 'panels/monday-projects/panel.css', 'monday.css'].forEach(file => {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    Array.from(css.matchAll(/font:\s*\d+\s+(\d+)px/g)).forEach(match => {
      const size = Number(match[1]);
      assert.ok(size >= 44 || exceptions.includes(size), file + ' has text at ' + size + 'px');
    });
    assert.equal(/#[0-9a-f]{3,8}\b/i.test(css), false, file + ' has a colour of its own');
    assert.equal(/animation|transition|@keyframes|filter:|box-shadow|text-shadow/.test(css), false, file + ' moves or glows');
  });
  ['panels/monday-department/panel.js', 'panels/monday-charts/panel.js', 'panels/monday-projects/panel.js'].forEach(file => {
    assert.equal(/animate\(|requestAnimationFrame|setTimeout|setInterval/.test(read(file)), false, file + ' has animation code');
  });
});


test('the standard layout has two lines in a row of 96, with the details under the name, and the bar layout one line of 68', () => {
  ['monday-department', 'monday-projects'].forEach(id => {
    const css = read('panels/' + id + '/panel.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const standard = selector => Array.from(css.matchAll(new RegExp('html\\[data-layout="standard"\\] \\.' + id + ' ' + selector.replace(/[.>:()]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'))).map(match => match[1]).join(';');
    const rule = (selector, name) => (standard(selector).match(new RegExp('(?:^|[;\\s])' + name + ':\\s*([^;]+);')) || [])[1];

    // four rows of 96 are the window, which starts under a count of two lines (112) and ends inside the body of Cybertron (532)
    assert.equal(rule('.rows-window', 'height'), '384px', id);
    assert.equal(rule('.rows-window', 'top'), '112px', id);
    assert.ok(112 + 4 * 96 <= 532, 'the rows end inside the body');
    assert.equal(rule('.row', 'grid-template-rows'), '48px 44px', id + ': 48 and 44 make 92 of the 96');
    assert.ok(new RegExp('html\\[data-layout="standard"\\] \\.' + id + ' \\{ --scroll-step: 384px; \\}').test(css), id);
    assert.equal(rule('.details', 'grid-row'), '2', id + ': the details are under the name');
    // the bar layout: one line of 64 in a row of 68, and seven rows are the window of 476
    const bar = css.match(new RegExp('^\\.' + id + ' \\.row \\{([^}]*)\\}', 'm'))[1];
    assert.ok(/grid-template-rows: 64px;/.test(bar) && /border-bottom: 3px solid/.test(bar) && /padding-bottom: 1px;/.test(bar), id);
    assert.ok(new RegExp('\\.' + id + ' \\.rows-window \\{[^}]*top: 56px;[^}]*height: 476px;').test(css), id);
  });
  // a first name is 40, one line with an ellipsis
  const css = read('panels/monday-department/panel.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const contact = css.match(/^\.monday-department \.contact \{([^}]*)\}/m)[1];
  assert.ok(/font: 500 40px/.test(contact) && /text-overflow: ellipsis/.test(contact) && /white-space: nowrap/.test(contact));
  assert.ok(/--w-contact: 250px;/.test(css), '250 holds a first name of 12 letters at 40px');
});


// The Studio and the control page follow the same rules

test('the Studio and the control page have the same department, list, chart and team choices, and the same retired panels', async () => {
  const parts = await studio('inputs/screen-panels.js');
  const lists = await import(pathToFileURL(path.join(repo, 'dashboard/config-lists.js')).href);
  assert.deepEqual(parts.mondayDepartmentChoices, lists.mondayDepartments);
  assert.deepEqual(parts.mondayListChoices, lists.mondayLists);
  assert.deepEqual(parts.mondayChartChoices, lists.mondayCharts);
  assert.deepEqual(parts.olderMondayPanels.map(item => item.value), lists.retiredMondayPanels);
  assert.deepEqual(parts.mondayPanels.map(item => item.value), ['monday-department', 'monday-charts', 'monday-projects']);

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
