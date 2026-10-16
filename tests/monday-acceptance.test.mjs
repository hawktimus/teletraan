// The acceptance cases of the order for the Monday panels (docs/monday.md), the ones the screen decides, run on made-up
// boards: a task of the right team and department shows on its panel and on no panel of the other team, General shows on
// both, Hide takes a task off, the status decides where a task is and not its group, a task with no department never
// shows, no last name or address reaches a panel, a stale board says so, and tasks whose Timeline is over are overdue.
// What the Mini does (reading the board, counting the tasks it hides, writing the documents) is tested in
// tests/monday-script.test.mjs.
//
//   node tests/monday-acceptance.test.mjs

import assert from 'node:assert/strict';
import { contentOf, htmlOf, monday, now, panelIds, panels, runTests, task, test, views, wordsOf } from './helpers/monday-world.mjs';

const prime = { team: 'prime', department: 'lead-build' };
const novaBuild = { team: 'nova', department: 'lead-build' };

// Every panel that takes a team, drawn for a team, for the departments of that team, as one text
function everythingFor(content, code) {
  const departments = views.departmentsOf(content, monday.forTeam(monday.visibleTasks(content, now), code), now);
  const pages = departments.length > 0 ? departments.map(department => ({ team: code, department: department.id })) : [{ team: code, department: '' }];

  return [].concat(
    pages.map(page => htmlOf('monday-tasks', content, page)),
    htmlOf('monday-done', content, { team: code }),
    htmlOf('monday-timeline', content, { team: code }),
    htmlOf('monday-board', content, { team: code }),
    htmlOf('monday-status-depts', content),
    htmlOf('monday-overall', content)
  ).join('\n');
}

test('a task of Team Prime, Department Build, Status In Progress, Show on TV Show is on the Prime Build tasks panel and on no Nova panel', () => {
  const content = contentOf([task({ title: '[Weld the frame]', status: 'in-progress' })]);

  assert.ok(htmlOf('monday-tasks', content, prime).includes('[Weld the frame]'));
  assert.ok(htmlOf('monday-board', content, { team: 'prime' }).includes('[Weld the frame]'));
  assert.ok(htmlOf('monday-timeline', content, { team: 'prime' }).includes('[Weld the frame]'));

  assert.equal(panels['monday-tasks'].hasContent(content, novaBuild), false, 'Nova has no task in Build, so its Build row has nothing to show');
  assert.equal(htmlOf('monday-tasks', content, novaBuild).includes('[Weld the frame]'), false);
  assert.equal(panels['monday-board'].hasContent(content, { team: 'nova' }), false);
  assert.equal(htmlOf('monday-board', content, { team: 'nova' }).includes('[Weld the frame]'), false);
  assert.equal(htmlOf('monday-timeline', content, { team: 'nova' }).includes('[Weld the frame]'), false);
  assert.equal(panels['monday-done'].hasContent(content, { team: 'nova' }), false);
});

test('the same task with Team General is on the Build panels of both teams, and counted once in the panels of both', () => {
  const content = contentOf([task({ title: '[Shop clean up]', status: 'in-progress', team: undefined })]);

  ['prime', 'nova'].forEach(code => {
    const page = { team: code, department: 'lead-build' };
    assert.equal(panels['monday-tasks'].hasContent(content, page), true, code);
    assert.ok(htmlOf('monday-tasks', content, page).includes('[Shop clean up]'), code);
    assert.ok(htmlOf('monday-board', content, { team: code }).includes('[Shop clean up]'), code);
  });

  const status = views.statusView(content, now);
  assert.equal(status.totals.tasks, 1, 'the panels of both teams count it once');
  assert.equal(views.overallView(content, now).counts.total, 1);
});

test('Show on TV set to Hide takes the task off every panel, and Show in Studio off does too', () => {
  const shown = contentOf([task({ title: '[Shown]', status: 'done', completedOn: '2026-10-12' })]);
  assert.ok(everythingFor(shown, 'prime').includes('[Shown]'));

  const hidden = contentOf([task({ title: '[Shown]', status: 'done', completedOn: '2026-10-12', showOnBoard: false })]);
  assert.equal(everythingFor(hidden, 'prime').includes('[Shown]'), false);
  assert.equal(panels['monday-tasks'].hasContent(hidden, prime), false);

  const off = contentOf([task({ title: '[Shown]', status: 'done', completedOn: '2026-10-12', showOnTv: false })]);
  assert.equal(everythingFor(off, 'prime').includes('[Shown]'), false);
});

test('Status Done puts a task in the Done list by the date completed even in another group, and a To Do task in the Done group reads To Do', () => {
  const content = contentOf([
    task({ title: '[Finished early]', status: 'done', completedOn: '2026-10-02', group: 'Build' }),
    task({ title: '[Finished last]', status: 'done', completedOn: '2026-10-13', group: 'Build' }),
    task({ title: '[Finished between]', status: 'done', completedOn: '2026-10-08', group: 'Build' }),
    task({ title: '[Reopened]', status: 'up-next', completedOn: '2026-10-14', group: 'Done' }),
    task({ title: '[In the Done group]', status: 'up-next', group: 'Done' }),
  ]);

  const done = views.doneView(content, now, { team: 'prime' });
  assert.deepEqual(done.rows.map(row => row.title), ['[Finished last]', '[Finished between]', '[Finished early]']);
  assert.equal(done.rows.some(row => /Reopened|Done group/.test(row.title)), false);

  const tasks = views.tasksView(content, now, prime);
  const reopened = tasks.rows.filter(row => /Reopened|In the Done group/.test(row.title));
  assert.equal(reopened.length, 2);
  reopened.forEach(row => assert.equal(row.status, 'up-next', row.title + ' reads To Do'));
  assert.ok(htmlOf('monday-tasks', content, prime).includes('chip-up-next'));
  assert.equal(tasks.counts.done, 3);
  assert.equal(tasks.counts.open, 2);
});

test('the Done list shows six, the last done first, with this week, this season and the hours', () => {
  const dates = ['2026-10-14', '2026-10-13', '2026-10-12', '2026-10-11', '2026-10-10', '2026-10-09', '2026-10-08', '2026-10-05', '2026-09-20'];
  const content = contentOf(dates.map((date, index) => task({ title: '[Done ' + (index + 1) + ']', status: 'done', completedOn: date, estHours: 2 })));
  const done = views.doneView(content, now, { team: 'prime' });

  assert.deepEqual(done.rows.map(row => row.title), ['[Done 1]', '[Done 2]', '[Done 3]', '[Done 4]', '[Done 5]', '[Done 6]']);
  assert.deepEqual(done.counts, { week: 6, season: 9, hours: 18 });
});

test('a task with Department Unassigned never renders, also when it is shown, and no panel has a row for it', () => {
  const content = contentOf([
    task({ title: '[Unassigned]', subteamId: undefined, subteam: undefined, show: false, hiddenReason: 'unassigned', status: 'in-progress' }),
    task({ title: '[Unassigned and shown]', subteamId: undefined, subteam: undefined, hiddenReason: 'unassigned', status: 'in-progress' }),
    task({ title: '[Assigned]' }),
  ]);

  const all = everythingFor(content, 'prime') + everythingFor(content, 'nova');
  assert.equal(all.includes('Unassigned'), false);
  assert.ok(all.includes('[Assigned]'));
  assert.equal(monday.visibleTasks(content, now).length, 1);
  assert.equal(views.statusView(content, now).totals.tasks, 1);
});

test('no last name and no address reaches any panel: the contact and the owners are first names, and the Notes are never read', () => {
  const content = contentOf(
    [
      task({ title: '[Wiring]', status: 'in-progress', contact: 'Jordan Q. Smith', owners: ['Maya Johnson', 'maya.johnson@example.test'], notes: 'Ask Jordan Smith at jordan.smith@example.test' }),
      task({ title: '[Wired]', status: 'done', completedOn: '2026-10-12', contact: 'jordan.smith@example.test' }),
      task({ title: '[Planning]', status: 'up-next', contact: 'Sam Lee', dueDate: '2026-10-20' }),
      task({ title: '[Reviewing]', status: 'in-review', contact: 'Priya Natarajan-Gupta' }),
    ],
    raw => {
      raw.tasks[0].text_mm82s03v = 'Notes: Dillon Fitzgerald, dillon@example.test';
    }
  );
  const all = everythingFor(content, 'prime') + everythingFor(content, 'nova');

  ['Smith', 'Johnson', 'Lee', 'Natarajan', 'Gupta', 'Fitzgerald', 'Q.', '@', 'example.test', 'Notes'].forEach(piece => assert.equal(all.includes(piece), false, piece));
  ['Jordan', 'Sam', 'Priya'].forEach(piece => assert.ok(all.includes(piece), piece));
  assert.ok(all.includes('[Wired]') && all.includes('chip-done'));
});

test('the sample content carries a full name and an address in a Notes field, and no panel draws them', async () => {
  const fs = await import('node:fs');
  const { dashboardFolder } = await import('./helpers/monday-world.mjs');
  const raw = JSON.parse(fs.readFileSync(dashboardFolder + 'data/sample/content.json', 'utf8'));
  const withNotes = raw.tasks.filter(item => typeof item.notes === 'string' && item.notes.includes('@') && /\s/.test(item.notes.trim()));
  assert.ok(withNotes.length >= 1, 'a sample task has a full name and an address in notes');

  const { sanity, screens } = await import('./helpers/monday-world.mjs');
  const content = sanity.normalizeSample(raw);
  const pieces = [];
  withNotes.forEach(item => pieces.push(item.notes, item.notes.replace(/[\[\]]/g, ''), 'Full name of a student', 'student@example.test'));

  const teams = screens.teamsOf(content).map(team => team.code);
  const all = teams.map(code => everythingFor(content, code)).join('\n');
  pieces.forEach(piece => assert.equal(all.includes(piece), false, piece + ' is drawn'));
  assert.equal(all.includes('@'), false);
  assert.ok(all.length > 5000, 'the sample draws something');
});

test('a task with a Timeline in the past reads as overdue until the board is changed (the eight imported tasks of May to July 2026)', () => {
  const imported = [];
  for (let number = 1; number <= 8; number++) {
    imported.push(task({ title: '[Imported ' + number + ']', status: number === 8 ? 'done' : 'in-progress', startDate: '2026-05-0' + number, dueDate: number <= 4 ? '2026-06-1' + number : '2026-07-1' + number, completedOn: number === 8 ? '2026-07-18' : undefined }));
  }
  const content = contentOf(imported);
  const view = views.tasksView(content, now, prime);

  assert.equal(view.counts.overdue, 7, 'seven are open and past their end');
  assert.equal(view.rows.filter(row => row.overdue).length, 7);
  assert.ok(htmlOf('monday-tasks', content, prime).includes('chip-overdue'));
  assert.equal(views.statusView(content, now).totals.overdue, 7);
  assert.equal(views.overallView(content, now).counts.overdue, 7);
  assert.equal(monday.overdue(imported[7], '2026-10-15'), false, 'the done one is not');
});

test('a milestone with no date or an EXAMPLE name is not on the overall panel', () => {
  const content = contentOf([task({ milestoneIds: ['m1'] })], raw => {
    raw.milestones = [
      { id: 'milestone-monday-m1', name: '[Real]', targetDate: '2026-10-19', status: 'on-track' },
      { id: 'milestone-monday-m2', name: '[No date]', status: 'on-track' },
      { id: 'milestone-monday-m3', name: 'EXAMPLE - edit or delete me (Robot reveal)', targetDate: '2026-10-20', status: 'on-track' },
    ];
  });
  const html = htmlOf('monday-overall', content);

  assert.ok(html.includes('[Real]'));
  assert.equal(html.includes('No date'), false);
  assert.equal(html.includes('EXAMPLE'), false);
});

test('every panel of the board says how old the board is, and says STALE when it is more than twice the interval', () => {
  const fresh = contentOf([task({ status: 'done', completedOn: '2026-10-12', estHours: 3 })]);
  const old = contentOf([task({ status: 'done', completedOn: '2026-10-12', estHours: 3 })], raw => {
    raw.monday.lastSyncAt = new Date(now.getTime() - 61 * 60000).toISOString();
  });
  const tight = contentOf([task({ status: 'done', completedOn: '2026-10-12', estHours: 3 })], raw => {
    raw.settings.mondayEveryMinutes = 5;
    raw.monday.lastSyncAt = new Date(now.getTime() - 11 * 60000).toISOString();
  });

  panelIds.forEach(id => {
    const page = { team: 'prime', department: 'lead-build' };
    assert.equal(htmlOf(id, fresh, page).includes('stale-chip'), false, id + ' fresh');
    assert.ok(htmlOf(id, old, page).includes('STALE · 61 MIN'), id + ' an hour old at 30 minutes');
    assert.ok(htmlOf(id, tight, page).includes('STALE · 11 MIN'), id + ' 11 minutes at 5');
  });
  assert.ok(wordsOf(htmlOf('monday-tasks', fresh, prime)).includes('BOARD · 1 MIN AGO') || wordsOf(htmlOf('monday-tasks', fresh, prime)).includes('1 MIN AGO'));
});

await runTests();
