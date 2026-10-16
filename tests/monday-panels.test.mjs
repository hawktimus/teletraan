// Tests for the six panels of the one task board (dashboard/panels/monday-tasks, monday-done, monday-status-depts,
// monday-overall, monday-timeline and monday-board), what they draw (core/monday-views.js), the registry and the Screens
// that play them (core/screens.js), and the department picker of the Screens builder (studio/inputs/screen-parts.js and
// screen-panels.js). The sizes need a browser to be seen, so the stylesheets are read.
//
//   node tests/monday-panels.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, contentOf, dashboardFolder, htmlOf, leads, monday, now, panelIds, panels, read, registry, runTests, screens, task, test, views, wordsOf } from './helpers/monday-world.mjs';

const studioFolder = fileURLToPath(new URL('../studio/', import.meta.url));
const sheet = id => read('panels/' + id + '/panel.css');
const olderIds = ['monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both'];
const countOf = (text, piece) => text.split(piece).length - 1;

// The rules of a stylesheet as { selector: body }, with the comments taken out
function rulesOf(css) {
  const rules = {};
  css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^{}]+)\{([^{}]*)\}/g, (all, selector, body) => {
    selector.split(',').forEach(part => {
      const name = part.trim().replace(/\s+/g, ' ');
      rules[name] = (rules[name] || '') + body;
    });
    return all;
  });
  return rules;
}

function fontSizes(css) {
  const found = [];
  const rules = rulesOf(css);
  Object.keys(rules).forEach(selector => {
    Array.from(rules[selector].matchAll(/(?:^|[;\s])font:\s*(?:italic\s+)?(\d+)\s+(\d+)px\/(\d+)px/g)).forEach(match => found.push({ selector: selector, size: Number(match[2]), line: Number(match[3]) }));
  });
  return found;
}


// The registry and the files

test('the six panels of the board are flagged monday in registry.js with a script and a stylesheet each, in the large panel, and none is in a rotation list', () => {
  const flagged = registry.panels.filter(panel => panel.monday).map(panel => panel.id);
  assert.deepEqual(flagged, panelIds.concat(olderIds));

  panelIds.concat(olderIds).forEach(id => {
    const entry = registry.panels.find(panel => panel.id === id);
    assert.equal(entry.region, 'grid1', id);
    assert.equal(entry.topic, 'monday', id);
    assert.equal(entry.older === true, olderIds.includes(id), id + ' is marked older only when it is an older panel');
    assert.ok(fs.existsSync(path.join(dashboardFolder, 'panels', id, 'panel.js')) && fs.existsSync(path.join(dashboardFolder, 'panels', id, 'panel.css')), id);
    assert.ok(!config.defaultSettings.rotation.grid1.some(step => step.panel === id), id);
    assert.ok(!read('core/panel-order.js').includes(id), id);
  });
});

test('the older Monday panels are still registered and still draw, and the Studio does not offer them', async () => {
  const picker = await import(path.join(studioFolder, 'inputs', 'screen-panels.js'));
  const offered = picker.mondayPanels.map(panel => panel.value);

  assert.deepEqual(offered, panelIds);
  olderIds.forEach(id => assert.ok(registry.panels.some(panel => panel.id === id), id));
  olderIds.forEach(id => assert.equal(offered.includes(id), false, id));
  olderIds.forEach(id => assert.ok(picker.panelTitle(id).endsWith('(older)'), id + ' still has a title for a list line'));
});

test('every panel script has the three functions a panel has, and no animation code, no font size and only the styles of a measured width, a flex share or a color', () => {
  panelIds.forEach(id => {
    const js = read('panels/' + id + '/panel.js');
    assert.equal(typeof panels[id].hasContent, 'function', id);
    assert.equal(typeof panels[id].mount, 'function', id);
    assert.equal(typeof panels[id].markupFor, 'function', id);
    assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(|@keyframes|transform|font-size/.test(js), false, id + ' has animation code or a font size');
    Array.from(js.matchAll(/style="([^"$]*)/g)).forEach(match => assert.ok(/^(width|flex|background)/.test(match[1]), id + ' has a style that is not a width, a flex share or a color: ' + match[1]));
  });
  [['monday-tasks', true], ['monday-board', false], ['monday-done', false]].forEach(([id, scrolls]) => assert.equal(typeof panels[id].scrollPages === 'function', scrolls, id));
});


// What they draw

const rich = () => {
  const list = [];
  for (let number = 1; number <= 12; number++) list.push(task({ title: '[Build ' + number + ']', status: number % 3 === 0 ? 'in-progress' : 'up-next', priority: ['high', 'medium', 'low'][number % 3], dueDate: '2026-10-' + String(10 + number).padStart(2, '0'), estHours: number }));
  list.push(task({ title: '[Stuck one]', status: 'blocked', priority: 'low' }));
  list.push(task({ title: '[Review one]', status: 'in-review' }));
  list.push(task({ title: '[Done one]', status: 'done', completedOn: '2026-10-14' }));
  return contentOf(list);
};

test('the tasks panel has ten rows at the most and two pages, stuck first, with the three numbers of the whole department', () => {
  const content = rich();
  const view = views.tasksView(content, now, { team: 'prime', department: 'lead-build' });

  assert.equal(view.rows.length, 10);
  assert.equal(view.pages, 2);
  assert.equal(panels['monday-tasks'].scrollPages(content, { team: 'prime', department: 'lead-build' }), 2);
  assert.equal(view.title, 'PRIME [BUILD] TASKS');
  assert.equal(view.rows[0].title, '[Stuck one]');
  assert.equal(view.rows[0].status, 'blocked');
  assert.deepEqual(view.counts, { overdue: view.counts.overdue, open: 14, done: 1 });
  assert.ok(view.counts.overdue >= 1);

  const html = htmlOf('monday-tasks', content, { team: 'prime', department: 'lead-build' });
  assert.equal(html.match(/class="row[ "]/g).length, 10);
  assert.ok(wordsOf(html).includes('1 OF 2 · 10 TASKS'), 'the page marker');
  assert.ok(html.includes('chip-blocked') && html.includes('>STUCK<') && html.includes('>IN PROGRESS<') && html.includes('>TO DO<'));
  assert.ok(html.includes('data-scroll-page="1"') && html.includes('data-scroll-list'));
  assert.ok(html.includes('class="chip chip-overdue">OVERDUE</span>'));
  assert.ok(wordsOf(html).includes('OVERDUE OPEN DONE') === false && /\d+ OVERDUE \d+ OPEN \d+ DONE/.test(wordsOf(html)));
});

test('the tasks panel for a department of no value is the first department that has tasks, and a number is the nth, as the older rows said', () => {
  const content = contentOf([task({ title: '[E]', subteamId: 'lead-electrical', subteam: '[Electrical]' }), task({ title: '[B]' })]);

  assert.equal(views.tasksView(content, now, { team: 'prime', department: '' }).department.id, 'lead-build', 'the order of the Team leads list, not of the tasks');
  assert.equal(views.tasksView(content, now, { team: 'prime' }).department.id, 'lead-build');
  assert.equal(views.tasksView(content, now, 2) === null, false);
  assert.equal(views.tasksView(content, now, { team: 'prime', department: 'lead-electrical' }).department.id, 'lead-electrical');
  assert.equal(views.tasksView(content, now, { team: 'prime', department: 'lead-design' }), null, 'a department with no task has nothing to draw');
  assert.equal(views.tasksView(content, now, 3), null);
});

test('the header title is the short name of the team and the department, and a panel for both teams has no chip', () => {
  const content = rich();
  const tasks = htmlOf('monday-tasks', content, { team: 'prime', department: 'lead-build' });
  assert.ok(tasks.includes('data-slat="title">PRIME [BUILD] TASKS</h2>'));
  assert.ok(tasks.includes('<span class="team-chip">PRIME</span>'));
  assert.ok(htmlOf('monday-done', content, { team: 'prime' }).includes('>PRIME DONE</h2>'));
  assert.ok(htmlOf('monday-timeline', content, { team: 'prime' }).includes('>PRIME TIMELINE</h2>'));
  assert.ok(htmlOf('monday-board', content, { team: 'prime' }).includes('>PRIME BOARD</h2>'));

  ['monday-status-depts', 'monday-overall'].forEach(id => assert.equal(htmlOf(id, content).includes('team-chip'), false, id));
  assert.ok(htmlOf('monday-status-depts', content).includes('>STATUS BY DEPARTMENT</h2>'));
  assert.ok(htmlOf('monday-overall', content).includes('>OVERALL PROGRESS</h2>'));
});

test('a panel for a team takes the name of its chip from the Team document, so a rename there changes it', () => {
  const content = contentOf([task({ status: 'done', completedOn: '2026-10-12' })], raw => {
    raw.teams[0].shortName = 'NONSENSE';
  });
  assert.ok(htmlOf('monday-done', content, { team: 'prime' }).includes('>NONSENSE DONE</h2>'));
  assert.ok(htmlOf('monday-done', content, { team: 'prime' }).includes('<span class="team-chip">NONSENSE</span>'));
});

test('the done panel has the right text, the last six by date completed, and a number of this week, this season and hours', () => {
  const html = htmlOf('monday-done', rich(), { team: 'prime' });

  assert.ok(html.includes('LAST 6 · BY DATE COMPLETED'));
  assert.equal(html.includes('MIN AGO'), false);
  assert.ok(html.includes('[BUILD]') === false && html.includes('[Build]'), 'the department name is as the Team lead has it');
  assert.ok(wordsOf(html).includes('1 THIS WEEK 1 THIS SEASON 0 HOURS'));
});

test('the status panel has a row for each department with a task, at most eight and the rest as OTHER, with five segments and done over all', () => {
  const list = [];
  for (let number = 1; number <= 10; number++) list.push(task({ title: '[T' + number + ']', subteamId: 'lead-extra-' + number, subteam: '[Extra ' + number + ']', status: number % 2 ? 'done' : 'in-progress' }));
  const content = contentOf(list, raw => {
    raw.subteams = [];
    for (let number = 1; number <= 10; number++) raw.subteams.push({ id: 'lead-extra-' + number, name: '[Extra ' + number + ']', order: number });
  });
  const view = views.statusView(content, now);

  assert.equal(view.rows.length, 8);
  assert.equal(view.rows[7].name, 'OTHER');
  assert.equal(view.rows[7].total, 3, 'departments eight, nine and ten');
  assert.equal(view.rows[0].name, '[EXTRA 1]');
  assert.equal(view.totals.tasks, 10);

  const html = htmlOf('monday-status-depts', content);
  assert.equal(countOf(html, 'class="row"'), 8);
  assert.ok(html.includes('1/1') && html.includes('1/3'));
  assert.ok(html.includes('chip-done') && html.includes('chip-in-progress'));
  assert.ok(html.includes('class="legend"') && html.includes('TO DO') && html.includes('IN REVIEW') && html.includes('STUCK'));
  assert.ok(html.includes('10 TASKS · 0 STUCK · 0 OVERDUE'));
  assert.ok(html.includes('width: 100%'), 'the longest bar is the whole track');
});

test('the status panel draws the five segments in order and the others in proportion to the longest row', () => {
  const content = contentOf([
    task({ status: 'up-next' }),
    task({ status: 'in-progress' }),
    task({ status: 'in-review' }),
    task({ status: 'blocked' }),
    task({ status: 'done' }),
    task({ status: 'done', subteamId: 'lead-electrical', subteam: '[Electrical]' }),
  ]);
  const html = htmlOf('monday-status-depts', content);

  const order = ['chip-up-next', 'chip-in-progress', 'chip-in-review', 'chip-blocked', 'chip-done'].map(name => html.indexOf('class="segment ' + name));
  assert.ok(order.every(place => place !== -1) && order.slice(1).every((place, index) => place > order[index]));
  assert.ok(html.includes('width: 100%') && html.includes('width: 20%'), 'a row of one task beside a row of five');
});

test('the overall panel has the ring, a bar for each team, the next three milestones and the three numbers', () => {
  const content = contentOf(
    [
      task({ status: 'done', estHours: 6, milestoneIds: ['m1'] }),
      task({ status: 'up-next', estHours: 14, milestoneIds: ['m1'] }),
      task({ status: 'done', estHours: 10, team: 'nova', subteamId: 'lead-design', subteam: '[Design]', milestoneIds: ['m2'] }),
      task({ status: 'blocked', team: 'nova', subteamId: 'lead-design', subteam: '[Design]', dueDate: '2026-10-01' }),
    ],
    raw => {
      raw.milestones = [
        { id: 'milestone-monday-m1', name: '[Soon]', targetDate: '2026-10-19', status: 'on-track' },
        { id: 'milestone-monday-m2', name: '[Nearly]', targetDate: '2026-11-20', status: 'on-track' },
        { id: 'milestone-monday-m3', name: '[Third]', targetDate: '2026-12-01', status: 'not-started' },
        { id: 'milestone-monday-m4', name: '[Fourth]', targetDate: '2026-12-02', status: 'not-started' },
      ];
    }
  );
  const view = views.overallView(content, now);

  assert.equal(view.percent, 52);
  assert.deepEqual(view.hours, { done: 16, total: 31, unestimated: 1 });
  assert.deepEqual(view.teams.map(team => [team.code, team.hours.done, team.hours.total]), [['prime', 6, 20], ['nova', 10, 11]]);
  assert.deepEqual(view.milestones.map(item => [item.name, item.percent, item.daysLeft]), [['[Soon]', 30, 4], ['[Nearly]', 100, 36], ['[Third]', 0, 47]]);
  assert.deepEqual(view.counts, { done: 2, total: 4, overdue: 1, stuck: 1 });

  const html = htmlOf('monday-overall', content);
  assert.ok(html.includes('stroke-dasharray="52 100"') && html.includes('pathLength="100"'), 'one arc, 100 long, with the percent as its dash');
  assert.ok(html.includes('>52%<'));
  assert.ok(html.includes('16 OF 31 HOURS') && html.includes('1 UNESTIMATED') && html.includes('HOURS DONE'));
  assert.ok(html.includes('6/20 HRS') && html.includes('10/11 HRS'));
  assert.ok(html.includes('NEXT MILESTONES') && html.includes('4 DAYS') && html.includes('class="milestone-days soon"') && html.includes('milestone-fill green'));
  assert.equal(html.includes('[Fourth]'), false, 'three milestones');
  assert.ok(/2\/4 TASKS DONE/.test(wordsOf(html)) && /1 OVERDUE/.test(wordsOf(html)) && /1 STUCK/.test(wordsOf(html)));
  assert.ok(html.includes('HOURS WEIGHTED · 1 MIN AGO'));
  assert.ok(html.includes('data-scroll') === false);
});

test('the overall panel of a board with no hours counts every task as one hour', () => {
  const view = views.overallView(contentOf([task({ status: 'done', estHours: undefined }), task({ status: 'up-next', estHours: undefined })]), now);
  assert.equal(view.percent, 50);
  assert.equal(view.hours.unestimated, 2);
});

test('the timeline has eight weeks from the Monday before today, a row for each department that has a Timeline, at most six, and says how many have no dates', () => {
  const list = [];
  const extra = [];
  for (let number = 1; number <= 8; number++) {
    list.push(task({ title: '[T' + number + ']', subteamId: 'lead-x' + number, subteam: '[X' + number + ']', startDate: '2026-10-13', dueDate: '2026-10-20' }));
    extra.push({ id: 'lead-x' + number, name: '[X' + number + ']', order: number });
  }
  list.push(task({ title: '[Undated]', startDate: undefined, dueDate: undefined }));
  list.push(task({ title: '[Only a due date]', startDate: undefined, dueDate: '2026-10-20' }));
  const content = contentOf(list, raw => {
    raw.subteams = extra;
  });
  const view = views.timelineView(content, now, { team: 'prime' });

  assert.deepEqual(view.weeks, ['OCT 12', 'OCT 19', 'OCT 26', 'NOV 2', 'NOV 9', 'NOV 16', 'NOV 23', 'NOV 30']);
  assert.equal(view.rows.length, 6);
  assert.equal(view.without, 2);
  assert.equal(view.days, 56);
  assert.equal(views.mondayBefore('2026-10-12'), views.mondayBefore('2026-10-18'), 'a Monday and the Sunday after it are the same week');
  assert.equal(view.todayAt, 3 / 56);

  const html = htmlOf('monday-timeline', content, { team: 'prime' });
  assert.ok(html.includes('8 WEEKS · 2 WITHOUT DATES · 1 MIN AGO'));
  assert.equal(html.includes('[Undated]'), false);
  assert.equal(countOf(html, '<svg class="picture'), 2, 'one picture for the page and one for the bar layout');
  assert.ok(html.includes('class="today"') && html.includes('>TODAY<'));
  assert.equal(countOf(html, 'viewBox="0 0 1104 '), 1);
  assert.equal(countOf(html, 'viewBox="0 0 1379 '), 1);
});

test('a bar goes from its start to its due date in its status color, and bars that overlap go in two lanes', () => {
  const content = contentOf([
    task({ title: '[First]', status: 'in-progress', startDate: '2026-10-12', dueDate: '2026-10-18' }),
    task({ title: '[Second]', status: 'blocked', startDate: '2026-10-14', dueDate: '2026-10-20' }),
    task({ title: '[Third]', status: 'up-next', startDate: '2026-10-21', dueDate: '2026-10-25' }),
    task({ title: '[Clipped]', status: 'done', startDate: '2026-09-01', dueDate: '2026-10-13', completedOn: '2026-10-13' }),
  ]);
  const view = views.timelineView(content, now, { team: 'prime' });
  const bars = view.rows[0].bars;

  assert.equal(bars.length, 4, 'the one that began in September is clipped to the first week');
  const clipped = bars.find(bar => bar.title === '[Clipped]');
  assert.equal(clipped.from, 0);
  assert.ok(clipped.to > 0 && clipped.to <= 1);
  assert.equal(bars.every(bar => bar.lanes === 2), true);
  assert.deepEqual(bars.map(bar => bar.lane).sort(), [0, 0, 0, 1]);

  const crowded = contentOf([1, 2, 3].map(number => task({ title: '[Over ' + number + ']', startDate: '2026-10-14', dueDate: '2026-10-20' })));
  assert.equal(views.timelineView(crowded, now, { team: 'prime' }).rows[0].bars.length, 2, 'a third task that lies over both lanes is left out');
  const html = htmlOf('monday-timeline', content, { team: 'prime' });
  assert.ok(html.includes('bar bar-blocked') && html.includes('bar bar-in-progress') && html.includes('bar bar-up-next'));
});

test('the countdown date is a red marker on the timeline when it falls inside the eight weeks', () => {
  const inside = contentOf([task({})], raw => {
    raw.settings.countdown = { kickoffLabel: 'GAMEDROP IN', kickoff: '2026-11-09T17:00:00.000Z', rolloutLabel: '', rollout: '' };
  });
  const html = htmlOf('monday-timeline', inside, { team: 'prime' });
  assert.ok(html.includes('class="gamedrop"') && html.includes('>GAMEDROP<'));

  const outside = contentOf([task({})]);
  assert.equal(htmlOf('monday-timeline', outside, { team: 'prime' }).includes('class="gamedrop"'), false, 'January is past the window');
});

test('the board has four columns with their counts, two cards each in rank order, +N MORE, and a stuck task in Review with a red edge and a STUCK tag', () => {
  const content = rich();
  const view = views.boardView(content, now, { team: 'prime' });

  assert.deepEqual(view.columns.map(column => column.name), ['TO DO', 'IN PROGRESS', 'REVIEW', 'DONE']);
  assert.deepEqual(view.columns.map(column => column.count), [8, 4, 2, 1]);
  assert.deepEqual(view.columns.map(column => column.cards.length), [2, 2, 2, 1]);
  assert.deepEqual(view.columns.map(column => column.more), [6, 2, 0, 0]);
  assert.equal(view.columns[2].cards[0].stuck, true);
  assert.equal(view.columns[2].cards[0].title, '[Stuck one]', 'stuck first in Review');
  assert.equal(view.columns[2].cards[1].stuck, false);

  const html = htmlOf('monday-board', content, { team: 'prime' });
  assert.ok(html.includes('card card-stuck') && html.includes('class="stuck-tag">STUCK</span>'));
  assert.ok(html.includes('+6 MORE') && html.includes('+2 MORE'));
  assert.equal(html.match(/class="card[ "]/g).length, 7);
});

test('a board that plays twice in a row shows cards three and four the second time', () => {
  const content = rich();
  const second = views.boardView(content, now, { team: 'prime', turn: 2 });

  assert.deepEqual(second.columns.map(column => column.cards.length), [2, 2, 0, 0]);
  assert.deepEqual(second.columns.map(column => column.more), [4, 0, 0, 0]);
  const first = views.boardView(content, now, { team: 'prime', turn: 1 });
  const same = column => first.columns[column].cards.map(card => card.title).concat(second.columns[column].cards.map(card => card.title));
  assert.equal(new Set(same(0)).size, 4, 'four different cards in To Do');
  assert.equal(panels['monday-board'].hasContent(content, { team: 'prime', turn: 3 }), true);
  assert.equal(panels['monday-board'].hasContent(content, { team: 'prime', turn: 9 }), false, 'a turn with no cards at all has nothing to show');
});

test('a panel with nothing to show says so in a sentence and the Screens leave its row out', () => {
  const content = contentOf([]);
  panelIds.forEach(id => assert.equal(panels[id].hasContent(content, { team: 'prime', department: 'lead-build' }), false, id));
  assert.ok(htmlOf('monday-done', content, { team: 'prime' }).includes('class="empty"'));
  panels['monday-board'].mount({ set innerHTML(text) { assert.ok(text.includes('empty')); } }, content, { team: 'prime' });
});


// The Screens

const rowsOf = list => list.map(row => Object.assign({ team: '' }, row));
const screenWith = rows => screens.tidyScreen({ mainRows: rows }, 'original', 'minimal');

test('a saved row that names an older Monday panel plays as the tasks panel of its team, for the first department, and three older rows are one', () => {
  const screen = screenWith(rowsOf([
    { panel: 'monday-tasks', team: 'prime' },
    { panel: 'monday-milestones', team: 'prime' },
    { panel: 'monday-progress', team: 'prime' },
    { panel: 'monday-milestones', team: 'nova' },
    { panel: 'monday-progress-both', team: 'both' },
    { panel: 'monday-milestones-both', team: '' },
    { panel: 'monday-progress', team: 'nova', seconds: 20 },
  ]));

  assert.deepEqual(screen.mainRows, [
    { panel: 'monday-tasks', team: 'prime', department: '' },
    { panel: 'monday-tasks', team: 'nova', department: '' },
  ]);
});

test('an older row keeps its seconds when it is the first of its kind', () => {
  const screen = screenWith(rowsOf([{ panel: 'monday-progress', team: 'nova', seconds: 20 }]));
  assert.deepEqual(screen.mainRows, [{ panel: 'monday-tasks', team: 'nova', department: '', seconds: 20 }]);
});

test('a Monday row has the team and the department its panel takes: a department for tasks, a team for done, timeline and board, neither for status and overall', () => {
  const screen = screenWith(rowsOf([
    { panel: 'monday-tasks', team: 'prime', department: ' lead-build ' },
    { panel: 'monday-tasks', team: 'nova' },
    { panel: 'monday-done', team: 'nova', department: 'lead-build' },
    { panel: 'monday-timeline', team: 'prime' },
    { panel: 'monday-board', team: 'nova' },
    { panel: 'monday-status-depts', team: 'prime', department: 'lead-build' },
    { panel: 'monday-overall', team: 'both' },
    { panel: 'monday-done', team: '' },
    { panel: 'monday-board', team: 'both' },
    { panel: 'monday-tasks', team: '' },
  ]));

  assert.deepEqual(screen.mainRows, [
    { panel: 'monday-tasks', team: 'prime', department: 'lead-build' },
    { panel: 'monday-tasks', team: 'nova', department: '' },
    { panel: 'monday-done', team: 'nova' },
    { panel: 'monday-timeline', team: 'prime' },
    { panel: 'monday-board', team: 'nova' },
    { panel: 'monday-status-depts', team: '' },
    { panel: 'monday-overall', team: '' },
  ]);
  assert.deepEqual(config.mondayKinds, { 'monday-tasks': 'department', 'monday-done': 'team', 'monday-status-depts': 'none', 'monday-overall': 'none', 'monday-timeline': 'team', 'monday-board': 'team' });
});

test('the steps of a Monday row carry the team, the department and the turn, the second board in a row has turn 2, and a row with nothing to show has no step', () => {
  const content = contentOf(rich().tasks, raw => {
    raw.screens = [{ _id: 'screen-original', mainRows: [
      { panel: 'monday-tasks', team: 'prime', department: 'lead-build' },
      { panel: 'monday-board', team: 'prime' },
      { panel: 'monday-board', team: 'prime' },
      { panel: 'monday-board', team: 'nova' },
      { panel: 'monday-tasks', team: 'prime', department: 'lead-design' },
      { panel: 'monday-overall' },
    ] }];
  });
  const steps = screens.mainPlaylist(content, now, screens.resolveScreen(content, 'original'));

  assert.deepEqual(steps.map(step => step.panel), ['monday-tasks', 'monday-board', 'monday-board', 'monday-overall'], 'Nova has no task and Prime has none in Design, so those rows are left out');
  assert.deepEqual(steps[0].page, { team: 'prime', department: 'lead-build', turn: 1 });
  assert.deepEqual(steps.map(step => step.page.turn), [1, 1, 2, 1]);
  assert.equal(steps[3].team, '', 'a row with no team keeps the team on the screen');
  assert.equal(steps[2].show, true);
  steps.forEach(step => assert.equal(screens.isMondayPanel(step.panel), true));
  assert.deepEqual(screens.lookForStep(steps[0], { team: 'nova', style: 'original', monday: false }, { style: 'original', mondayStyle: 'minimal' }), { team: 'prime', style: 'minimal', monday: true });
});

test('a row of the Screen for a department with no visible task has nothing to show, so the scheduler skips it, and one with tasks has', () => {
  const content = contentOf([task({})]);

  assert.equal(panels['monday-tasks'].hasContent(content, { team: 'prime', department: 'lead-build', turn: 1 }), true);
  assert.equal(panels['monday-tasks'].hasContent(content, { team: 'prime', department: 'lead-electrical', turn: 1 }), false);
  assert.equal(panels['monday-tasks'].hasContent(content, { team: 'nova', department: 'lead-build', turn: 1 }), false);
});

test('an empty Screen is seeded with the tasks, done and board rows of each team', () => {
  assert.deepEqual(config.mondayRows, ['monday-tasks', 'monday-done', 'monday-board']);
  const rows = screens.seedMainRows({ order: [{ panel: 'tasks', show: true }] }, [{ code: 'prime' }, { code: 'nova' }]);

  assert.deepEqual(rows.filter(row => row.panel.startsWith('monday')).map(row => row.panel + '/' + row.team), ['monday-tasks/prime', 'monday-done/prime', 'monday-board/prime', 'monday-tasks/nova', 'monday-done/nova', 'monday-board/nova']);
});


// The Screens builder

test('the builder offers the six panels under Monday, asks for the department beside the team for the tasks row only, and none for a row with no team', async () => {
  const picker = await import(path.join(studioFolder, 'inputs', 'screen-panels.js'));

  assert.deepEqual(picker.mondayPanels.map(panel => panel.title), [
    'Monday: Tasks by team and department',
    'Monday: Done by team',
    'Monday: Status by department',
    'Monday: Overall progress',
    'Monday: Timeline by team',
    'Monday: Board by team',
  ]);
  assert.deepEqual(picker.mondayPanels.filter(panel => picker.takesDepartment(panel.value)).map(panel => panel.value), ['monday-tasks']);
  assert.deepEqual(picker.mondayPanels.map(panel => picker.teamKindOf(panel.value)), ['one', 'one', 'none', 'none', 'one', 'one']);
  assert.deepEqual(picker.teamChoices('monday-status-depts', [{ code: 'prime', label: 'Prime' }]), [], 'a row with no team shows no team picker');
  assert.deepEqual(picker.teamChoices('monday-tasks', [{ code: 'prime', label: 'Prime' }, { code: 'nova', label: 'Nova' }]).map(choice => choice.value), ['prime', 'nova']);
  assert.equal(picker.teamProblem('monday-board', 'both') !== '', true);
  assert.equal(picker.teamProblem('monday-overall', ''), '');
  assert.equal(picker.teamProblem('monday-tasks', ''), 'Pick the team for this Monday row.');
  assert.deepEqual(config.mondayKinds, picker.mondayKinds, 'the builder and the dashboard agree on what each panel takes');
  assert.deepEqual(picker.seededMondayPanels, config.mondayRows);
});

test('the department picker lists the Team leads of the team of the row, the first department that has tasks, and keeps a department that is not in the list', async () => {
  const parts = await import(path.join(studioFolder, 'inputs', 'screen-parts.js'));
  const found = [
    { _id: 'lead-build', name: 'Build', team: 'prime' },
    { _id: 'lead-design', name: 'Design', team: 'nova' },
    { _id: 'lead-cnc', name: 'CNC' },
    { _id: 'lead-blank', name: '  ' },
    { name: 'No id' },
  ];

  assert.deepEqual(parts.departmentChoices(found, 'prime', '').map(choice => choice.label), ['The first department that has tasks', 'Build', 'CNC']);
  assert.deepEqual(parts.departmentChoices(found, 'nova', '').map(choice => choice.value), ['', 'lead-design', 'lead-cnc']);
  assert.deepEqual(parts.departmentChoices(found, '', '').map(choice => choice.value), ['', 'lead-build', 'lead-design', 'lead-cnc']);
  assert.deepEqual(parts.departmentChoices(found, 'prime', 'lead-gone').pop(), { value: 'lead-gone', label: 'A department that is not in the list' });
  assert.deepEqual(parts.departmentChoices(null, 'prime', '').length, 1);
  assert.ok(parts.leadsQuestion.includes('_type == "subteam"') && parts.leadsQuestion.includes('"team": team->code'));
});

test('the row description of the board panel says that two rows in a row show cards three and four', () => {
  const text = fs.readFileSync(path.join(studioFolder, 'schemas/screen.js'), 'utf8');
  assert.ok(text.includes('Put Monday: Board by team in two rows in a row and the second shows cards three and four.'));
  assert.ok(/name: 'department'/.test(text) && /takesDepartment\(parent && parent\.panel\)/.test(text));
});


// The stylesheets

// The sizes under 44px that the order sets for the panels of the board, by file and selector. The chips and the keys of a chart are
// 30 and 36, the owner names 40, the labels 36, the chart axis labels 28 and the labels the order names for the overall and the board.
const allowed = {
  'monday.css': { '.monday .stale-chip': 30, '.monday .chip': 30, '.monday .poc': 40, '.monday .fact-label': 36, '.monday .legend': 36, '.monday .department': 36 },
  'monday-tasks': { '.monday-tasks .due': 36, '.monday-tasks .chip-overdue': 30 },
  'monday-done': { '.monday-done .date': 36 },
  'monday-status-depts': { '.monday-status-depts .share': 40 },
  'monday-overall': { '.monday-overall .hours-of': 32, '.monday-overall .milestone-name': 40, '.monday-overall .milestone-date': 32, '.monday-overall .milestone-days': 36, '.monday-overall .milestones-head': 36, '.monday-overall .hours': 40 },
  'monday-timeline': { '.monday-timeline .week': 28, '.monday-timeline .dept': 36, '.monday-timeline .bar text': 32, '.monday-timeline .today-label': 28, '.monday-timeline .gamedrop-label': 28 },
  'monday-board': { '.monday-board .column-name': 34, '.monday-board .count': 30, '.monday-board .card-department': 28, '.monday-board .card-title': 40, '.monday-board .card-poc': 32, '.monday-board .stuck-tag': 26, '.monday-board .more': 30 },
};

test('nothing in the stylesheets of the panels is under 44px except the sizes the order names, and no line is thinner than 3px', () => {
  const files = [['monday.css', read('monday.css')]].concat(panelIds.map(id => [id, sheet(id)]));

  files.forEach(([name, css]) => {
    const permitted = allowed[name] || {};
    fontSizes(css).forEach(font => {
      assert.ok(font.line >= font.size, name + ' ' + font.selector + ' has a line height under its size');
      if (font.size >= 44) return;
      if (name === 'monday.css' && !(font.selector in permitted)) return; // the older cards share this file and have their sizes in their own test
      assert.equal(permitted[font.selector], font.size, name + ' has text of ' + font.size + 'px in ' + font.selector);
    });
    if (name === 'monday.css') return;
    Array.from(css.matchAll(/(?:stroke-width|border(?:-left|-bottom|-right)?):\s*([\d.]+)/g)).forEach(match => assert.ok(Number(match[1]) === 0 || Number(match[1]) >= 3, name + ' has a line of ' + match[1] + 'px'));
    assert.equal(/@keyframes|transition:|animation:|transform|box-shadow|text-shadow|filter|blur|drop-shadow|background-image|url\(/.test(css), false, name + ' has an effect that is not allowed');
  });
});

test('the measurements of the order are in the stylesheets', () => {
  const tasks = sheet('monday-tasks');
  const shared = read('monday.css');
  assert.ok(/\.monday \.chip \{[^}]*width: 262px;[^}]*height: 48px;/.test(shared), 'the status chip is 262 by 48');
  assert.ok(/\.monday-tasks \.row-title \{[^}]*font: 500 52px/.test(tasks), 'the title of a task is 52px');
  assert.ok(/\.monday \.poc \{[^}]*font: 500 40px/.test(shared) && /\.monday-tasks \.poc \{ width: 140px; \}/.test(tasks), 'who to ask is 40px in 140');
  assert.ok(/\.monday-tasks \.due \{[^}]*width: 290px;[^}]*font: 700 36px/.test(tasks), 'the due date is 36px in 290');
  assert.ok(/\.monday \.fact-number \{ font: 700 72px/.test(shared), 'the numbers are 72px');
  assert.ok(/\.monday-tasks \.row \{[^}]*height: 84px;/.test(tasks));

  const done = sheet('monday-done');
  assert.ok(/\.monday\.monday-done \.department \{ width: 310px; \}/.test(done) && /\.monday-done \.poc \{ width: 180px; \}/.test(done) && /\.monday-done \.date \{[^}]*width: 200px;[^}]*font: 700 36px/.test(done) && /\.monday-done \.row-title \{[^}]*font: 500 48px/.test(done));

  const status = sheet('monday-status-depts');
  assert.ok(/height: 58px;/.test(status) && /\.monday\.monday-status-depts \.department \{ width: 300px; \}/.test(status) && /max-width: 900px;/.test(status) && /\.monday-status-depts \.share \{[^}]*width: 170px;[^}]*font: 700 40px/.test(status));
  assert.ok(/\.monday-status-depts \.segment\.chip-up-next \{ opacity: \.55; \}/.test(status), 'to do is at 55 percent');

  const overall = sheet('monday-overall');
  assert.ok(/width: 340px;/.test(overall) && /\.monday-overall \.ring \{[^}]*width: 300px;[^}]*height: 300px;/.test(overall) && /\.monday-overall \.ring-arc \{[^}]*stroke-width: 28;/.test(overall) && /\.monday-overall \.ring-percent \{[^}]*font: 700 84px/.test(overall));
  assert.ok(/\.monday-overall \.team-row \{[^}]*height: 64px;/.test(overall) && /\.monday-overall \.hours \{[^}]*width: 230px;[^}]*font: 600 40px/.test(overall) && /\.monday-overall \.milestone-track \{[^}]*height: 10px;/.test(overall));

  const timeline = sheet('monday-timeline');
  const script = read('panels/monday-timeline/panel.js');
  assert.ok(/const ROW = 72;/.test(script) && /\.monday-timeline \.week \{[^}]*font: 600 28px/.test(timeline) && /\.monday-timeline \.bar text \{[^}]*font: 600 32px/.test(timeline) && /\.monday-timeline \.rule \{[^}]*stroke-width: 3;/.test(timeline));
  assert.ok(/\.monday-timeline \.today \{[^}]*stroke-width: 5;[^}]*stroke-dasharray/.test(timeline), 'today is a dashed line of 5px');

  const board = sheet('monday-board');
  assert.ok(/\.monday-board \.column-head \{[^}]*height: 52px;[^}]*border-bottom: 4px solid/.test(board) && /\.monday-board \.column-name \{ font: 700 34px/.test(board) && /\.monday-board \.card-title \{[^}]*-webkit-line-clamp: 2;[^}]*font: 500 40px/.test(board) && /\.monday-board \.stuck-tag \{[^}]*font: 700 26px/.test(board));
});

test('the ring draws in over 600 ms in full motion only, and no panel has animation code', () => {
  const frame = read('frame.css');
  assert.ok(/\[data-motion="full"\] \.area\[data-state="in"\] \.ring-arc \{ animation: ring-draw 600ms /.test(frame));
  assert.ok(/@keyframes ring-draw \{ from \{ stroke-dasharray: 0 100; \} \}/.test(frame));
  panelIds.forEach(id => assert.equal(/animation|transition/.test(sheet(id)), false, id));
});

test('the timeline shows the picture for the bar layout only in the bar layout, and the other everywhere else', () => {
  const timeline = sheet('monday-timeline');
  assert.ok(/\.monday-timeline \.picture-bar \{ display: none; \}/.test(timeline));
  assert.ok(/html\[data-layout="bar"\] \.monday-timeline \.picture-page \{ display: none; \}/.test(timeline));
  assert.ok(/html\[data-layout="bar"\] \.monday-timeline \.picture-bar \{[^}]*display: block;/.test(timeline));
});

test('no panel of the board writes an em or en dash, an emoji or an exclamation mark', () => {
  panelIds.forEach(id => {
    const text = read('panels/' + id + '/panel.js') + sheet(id);
    assert.equal(/[–—]/.test(text), false, id);
    assert.equal(/!(?!=)(?=[\s'"`)]|$)/.test(text.replace(/<!--[\s\S]*?-->/g, '').replace(/!==?/g, '')), false, id + ' has an exclamation mark');
  });
});

await runTests();
