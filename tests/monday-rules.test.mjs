// Tests for the rules of the Monday panels (dashboard/core/monday.js): which tasks are visible, for a team and for a
// department, overdue, the order, the hours, the milestones, and when the board counts as stale. The plain functions are
// run for real. The stale chip in the header (core/monday-draw.js), the normalizers of the new task fields and of the
// milestones (core/sanity.js) and the copy of the last content in localStorage (core/content.js) are here too.
//
//   node tests/monday-rules.test.mjs

import assert from 'node:assert/strict';
import { contentModule, contentOf, draw, monday, now, panels, read, runTests, sanity, task, test, today } from './helpers/monday-world.mjs';

const titles = list => list.map(item => item.title);

test('visibleTasks keeps a task from the board that is shown on the board and in Studio, has a department and is not a subitem', () => {
  const content = contentOf([
    task({ title: '[Shown]' }),
    task({ title: '[Hidden on the board]', showOnBoard: false }),
    task({ title: '[Hidden in Studio]', showOnTv: false }),
    task({ title: '[Switched off]', show: false }),
    task({ title: '[No department]', subteamId: undefined }),
    task({ title: '[Unassigned]', subteamId: undefined, show: false, hiddenReason: 'unassigned' }),
    task({ title: '[Unassigned but shown]', hiddenReason: 'unassigned' }),
    task({ title: '[A subitem]', parentId: '[item 1]' }),
    task({ title: '[Typed by hand]', source: 'manual' }),
    task({ title: '[Written before Show on TV existed]', showOnBoard: undefined }),
  ]);

  assert.deepEqual(titles(monday.visibleTasks(content, now)), ['[Shown]', '[Written before Show on TV existed]']);
});

test('visibleTasks leaves out a task whose expiry has passed', () => {
  const content = contentOf([task({ title: '[Old]', expires: '2026-10-01T12:00' }), task({ title: '[New]' })]);
  assert.deepEqual(titles(monday.visibleTasks(content, now)), ['[New]']);
});

test('forTeam keeps the tasks of the team and General, and everything for no team', () => {
  const tasks = [task({ title: '[P]', team: 'prime' }), task({ title: '[N]', team: 'nova' }), task({ title: '[G]', team: undefined })];

  assert.deepEqual(titles(monday.forTeam(tasks, 'prime')), ['[P]', '[G]']);
  assert.deepEqual(titles(monday.forTeam(tasks, 'nova')), ['[N]', '[G]']);
  assert.deepEqual(titles(monday.forTeam(tasks, null)), ['[P]', '[N]', '[G]']);
  assert.equal(monday.forTeam(tasks, null).length, 3, 'General counts once');
  assert.notEqual(monday.forTeam(tasks, null), tasks, 'the list given is not the list handed back');
});

test('forDepartment keeps the tasks of one Team lead, and none for no id', () => {
  const tasks = [task({ title: '[B]' }), task({ title: '[E]', subteamId: 'lead-electrical' })];

  assert.deepEqual(titles(monday.forDepartment(tasks, 'lead-electrical')), ['[E]']);
  assert.deepEqual(monday.forDepartment(tasks, ''), []);
  assert.deepEqual(monday.forDepartment(tasks, undefined), []);
});

test('overdue is a due date before today on a task that is not done', () => {
  assert.equal(monday.overdue(task({ dueDate: '2026-10-14' }), today), true);
  assert.equal(monday.overdue(task({ dueDate: '2026-10-15' }), today), false, 'due today is not late');
  assert.equal(monday.overdue(task({ dueDate: '2026-10-14', status: 'done' }), today), false);
  assert.equal(monday.overdue(task({ dueDate: '2026-10-14', status: 'blocked' }), today), true);
  assert.equal(monday.overdue(task({ dueDate: undefined }), today), false, 'a task with no due date is never late');
  assert.equal(monday.overdue(task({ dueDate: 'soon' }), today), false);
});

test('rank puts stuck first, then in progress and in review, then To Do by priority and start, and Done last by the date completed', () => {
  const ranked = monday.rank([
    task({ title: 'done-old', status: 'done', completedOn: '2026-10-01' }),
    task({ title: 'todo-low', status: 'up-next', priority: 'low', startDate: '2026-10-01' }),
    task({ title: 'todo-none-early', status: 'up-next', priority: undefined, startDate: '2026-10-01' }),
    task({ title: 'todo-high-late', status: 'up-next', priority: 'high', startDate: '2026-10-20' }),
    task({ title: 'todo-high-early', status: 'up-next', priority: 'high', startDate: '2026-10-10' }),
    task({ title: 'todo-medium', status: 'up-next', priority: 'medium' }),
    task({ title: 'progress', status: 'in-progress' }),
    task({ title: 'done-new', status: 'done', completedOn: '2026-10-12' }),
    task({ title: 'review', status: 'in-review' }),
    task({ title: 'stuck', status: 'blocked', priority: 'low' }),
    task({ title: 'done-undated', status: 'done' }),
  ]);

  assert.deepEqual(titles(ranked), ['stuck', 'progress', 'review', 'todo-high-early', 'todo-high-late', 'todo-medium', 'todo-low', 'todo-none-early', 'done-new', 'done-old', 'done-undated']);
});

test('rank keeps tasks that are the same in everything in the order they came, and does not change the list given', () => {
  const tasks = [task({ title: 'a' }), task({ title: 'b' }), task({ title: 'c' })];
  const before = titles(tasks);

  assert.deepEqual(titles(monday.rank(tasks)), ['a', 'b', 'c']);
  assert.deepEqual(titles(tasks), before);
});

test('progressHours is the hours done over all the hours, a task with no hours counts as one, and unestimated says how many', () => {
  const none = monday.progressHours([]);
  assert.deepEqual(none, { done: 0, total: 0, unestimated: 0, percent: 0 });

  const some = monday.progressHours([
    task({ status: 'done', estHours: 6 }),
    task({ status: 'up-next', estHours: 4 }),
    task({ status: 'done', estHours: undefined }),
    task({ status: 'in-progress', estHours: 0 }),
  ]);
  assert.deepEqual(some, { done: 7, total: 12, unestimated: 2, percent: 58 });
});

test('milestoneProgress weighs the linked tasks by hours and counts the days left', () => {
  const milestone = { id: 'milestone-monday-m1', name: '[M]', targetDate: '2026-10-19', status: 'on-track' };
  const tasks = [
    task({ status: 'done', estHours: 6, milestoneIds: ['m1'] }),
    task({ status: 'up-next', estHours: 2, milestoneIds: ['m1', 'm2'] }),
    task({ status: 'done', estHours: 50, milestoneIds: ['m2'] }),
    task({ status: 'done', estHours: 50, milestoneIds: [] }),
  ];

  assert.deepEqual(monday.milestoneProgress(milestone, tasks, today), { percent: 75, daysLeft: 4, done: 1, total: 2 });
  assert.equal(monday.milestoneProgress(Object.assign({}, milestone, { targetDate: '2026-10-14' }), tasks, today).daysLeft, -1);
  assert.equal(monday.milestoneProgress(milestone, [], today).percent, 0, 'a milestone with no tasks and not done is at nothing');
  assert.equal(monday.milestoneProgress(Object.assign({}, milestone, { status: 'done' }), [], today).percent, 100);
});

test('stale is true once the last read is older than twice the interval, so 30 minutes is stale after an hour', () => {
  const read = minutes => ({ lastSyncAt: new Date(now.getTime() - minutes * 60000).toISOString() });

  assert.equal(monday.stale(read(5), now, 30), false);
  assert.equal(monday.stale(read(60), now, 30), false, 'exactly twice is not older than twice');
  assert.equal(monday.stale(read(61), now, 30), true);
  assert.equal(monday.stale(read(11), now, 5), true);
  assert.equal(monday.stale(read(10), now, 5), false);
  assert.equal(monday.stale(read(61), now), true, 'the interval is 30 minutes when none is given');
  assert.equal(monday.stale(null, now, 30), true, 'a board that was never read is stale');
  assert.equal(monday.stale({ lastSyncAt: '' }, now, 30), true);
  assert.equal(monday.stale({ lastSyncAt: 'never' }, now, 30), true);
  assert.equal(monday.stale(Object.assign(read(5), { unreachable: true }), now, 30), true, 'out of reach of Sanity it is stale whatever its age');
  assert.equal(monday.stale({ lastSyncAt: '2020-01-01T00:00:00Z', sample: true }, now, 30), false, 'a sample is never stale');
});

test('the interval comes from Dashboard Settings, 5 to 120, and is 30 when it is not set', () => {
  assert.equal(monday.everyMinutesOf({ settings: { mondayEveryMinutes: 45 } }), 45);
  assert.equal(monday.everyMinutesOf({ settings: { mondayEveryMinutes: 1 } }), 5);
  assert.equal(monday.everyMinutesOf({ settings: { mondayEveryMinutes: 900 } }), 120);
  assert.equal(monday.everyMinutesOf({ settings: {} }), 30);
  assert.equal(monday.everyMinutesOf(null), 30);
  assert.equal(monday.staleWords({ lastSyncAt: new Date(now.getTime() - 75 * 60000).toISOString() }, now), 'STALE · 75 MIN');
  assert.equal(monday.staleWords({ lastSyncAt: '' }, now), 'STALE');
});

test('markUnreachable marks the status and changes nothing else, also when there is no status', () => {
  const content = contentOf([task({})]);
  const marked = monday.markUnreachable(content);

  assert.equal(marked.monday.unreachable, true);
  assert.equal(marked.monday.lastSyncAt, content.monday.lastSyncAt);
  assert.equal(marked.tasks, content.tasks);
  assert.equal(content.monday.unreachable, undefined, 'the content given is not changed');
  assert.equal(monday.markUnreachable({ monday: null }).monday.unreachable, true);
});


// The header

const header = (content, at = now) => draw.boardHeader('PRIME BUILD TASKS', 'PRIME', content, at);

test('the header says BOARD · N MIN AGO at the right end while the board is fresh, and no chip of amber', () => {
  const content = contentOf([task({})]);
  content.monday.lastSyncAt = new Date(now.getTime() - 4 * 60000).toISOString();
  const html = draw.boardHeader('OVERALL PROGRESS', '', content, now);

  assert.ok(html.includes('BOARD · 4 MIN AGO'), html);
  assert.equal(html.includes('stale-chip'), false);
  assert.ok(draw.boardHeader('OVERALL PROGRESS', '', content, now, 'HOURS WEIGHTED').includes('HOURS WEIGHTED · 4 MIN AGO'));
  assert.ok(draw.boardHeader('X', '', content, now, '91 TASKS · 4 STUCK · 5 OVERDUE', true).includes('91 TASKS · 4 STUCK · 5 OVERDUE'));
  assert.equal(draw.boardHeader('X', '', content, now, '91 TASKS', true).includes('MIN AGO'), false);
});

test('the header says STALE · N MIN in an amber chip in place of the words when the board is stale', () => {
  const content = contentOf([task({})]);
  content.monday.lastSyncAt = new Date(now.getTime() - 75 * 60000).toISOString();
  const html = header(content);

  assert.ok(html.includes('<span class="stale-chip">STALE · 75 MIN</span>'), html);
  assert.equal(html.includes('MIN AGO'), false);
  assert.ok(html.includes('<span class="team-chip">PRIME</span>'), 'the chip of the team is still there');
});

test('a content marked as out of reach shows the stale chip with a fresh board, and a sample shows SAMPLE and no chip', () => {
  const content = monday.markUnreachable(contentOf([task({})]));
  assert.ok(header(content).includes('stale-chip'));

  const sample = contentOf([task({})], raw => {
    raw.monday = { sample: true, lastSyncAt: '2020-01-01T00:00:00Z' };
  });
  assert.equal(header(sample).includes('stale-chip'), false);
});

test('the stale color is the one new color, #F0A830, in tokens.css, and the chip is 30px', () => {
  assert.ok(/--stale:\s*#f0a830;/i.test(read('tokens.css')));
  assert.ok(/\.monday \.stale-chip \{[^}]*background: var\(--stale\);[^}]*font: 700 30px\//.test(read('monday.css')));
});


// What the screen takes from the Teletraan computer

test('the query asks for the new fields of a task and for the milestones, and a task keeps the id of its Team lead', () => {
  assert.ok(sanity.contentQuery.includes('"subteamId": subteam._ref'));
  assert.ok(sanity.contentQuery.includes('"milestones": *[_type == "milestone" && show != false] | order(targetDate asc)'));
  assert.ok(sanity.contentQuery.includes('"id": _id,\n    "team": team->code,'), 'a Team lead has its id');
});

test('a task written before the new fields still reads, and the new fields are tidied', () => {
  const content = contentOf([
    { title: '[Older]', subteam: '[Build]', status: 'up-next', source: 'monday', mondayId: '[item 1]', showOnTv: true },
    task({ title: '[Newer]', dueDate: 'tomorrow', estHours: -3, completedOn: '2026-10-10', milestoneIds: ['m1', 7, ''], owners: ['Jordan Smith', 'x@y.test', 'Sam'], notes: '[Full name] [a@b.test]', showOnBoard: 'yes' }),
  ]);
  const older = content.tasks[0];
  const newer = content.tasks[1];

  assert.equal(older.title, '[Older]');
  assert.equal(older.showOnBoard, undefined);
  assert.equal(older.estHours, undefined);
  assert.equal(newer.dueDate, undefined);
  assert.equal(newer.estHours, undefined);
  assert.equal(newer.completedOn, '2026-10-10');
  assert.deepEqual(newer.milestoneIds, ['m1']);
  assert.deepEqual(newer.owners, ['Jordan', 'Sam']);
  assert.equal('notes' in newer, false, 'notes are never kept');
  assert.equal(newer.showOnBoard, undefined);
});

test('a milestone with no target date, with a name that starts with EXAMPLE or with no name is skipped', () => {
  const content = contentOf([], raw => {
    raw.milestones = [
      { id: 'milestone-monday-1', name: '[Drivetrain rolling]', targetDate: '2026-10-19', status: 'on-track', team: 'prime' },
      { id: 'milestone-monday-2', name: '[No date]', status: 'on-track' },
      { id: 'milestone-monday-3', name: 'EXAMPLE - edit or delete me (Robot reveal)', targetDate: '2026-11-01', status: 'not-started' },
      { id: 'milestone-monday-4', name: 'example row', targetDate: '2026-11-02' },
      { id: 'milestone-monday-5', name: '   ', targetDate: '2026-11-03' },
      { id: 'milestone-monday-6', name: '[Bad date]', targetDate: 'next week' },
      { id: 'milestone-monday-7', name: '[Earlier]', targetDate: '2026-10-05', status: 'nonsense' },
    ];
  });

  assert.deepEqual(content.milestones.map(item => item.name), ['[Earlier]', '[Drivetrain rolling]']);
  assert.equal(content.milestones[0].status, 'not-started', 'a status that is not one of the four is not started');
  assert.equal(sanity.normalizeContent({ milestones: [{ id: 'x', name: '[M]', targetDate: '2026-10-19', team: 'prime' }] }).milestones.length, 1);
  assert.deepEqual(sanity.normalizeContent({}).milestones, []);
  assert.deepEqual(sanity.normalizeContent({ milestones: 'oops' }).milestones, []);
});

test('nextMilestones gives the three earliest that are not done, for a team and for both', () => {
  const content = contentOf([], raw => {
    raw.milestones = [
      { id: 'milestone-monday-1', name: '[A]', targetDate: '2026-10-19', status: 'on-track', team: 'prime' },
      { id: 'milestone-monday-2', name: '[B]', targetDate: '2026-10-16', status: 'done' },
      { id: 'milestone-monday-3', name: '[C]', targetDate: '2026-11-14', status: 'at-risk', team: 'nova' },
      { id: 'milestone-monday-4', name: '[D]', targetDate: '2026-12-01', status: 'not-started' },
      { id: 'milestone-monday-5', name: '[E]', targetDate: '2026-12-09', status: 'not-started' },
    ];
  });

  assert.deepEqual(monday.nextMilestones(content, null).map(item => item.name), ['[A]', '[C]', '[D]']);
  assert.deepEqual(monday.nextMilestones(content, 'prime').map(item => item.name), ['[A]', '[D]', '[E]']);
});


// The last content, kept in localStorage

test('the content is kept under teletraan-last-content after every good read, and a failing storage does not stop the read', async () => {
  const { run } = fakeWorld();

  await run(async world => {
    const started = await contentModule.startSanityContent(() => {});
    assert.equal(world.stored.has('teletraan-last-content'), true, 'written after the first good read');
    const saved = JSON.parse(world.stored.get('teletraan-last-content'));
    assert.equal(saved.raw.monday.lastSyncAt, answer().monday.lastSyncAt);
    assert.equal(typeof saved.savedAt, 'number');
    assert.equal(world.stored.has('teletraan-content'), false, 'the older name is not written again');

    world.stored.clear();
    answer().monday.lastSyncAt = new Date(world.now).toISOString();
    await world.advance(5 * 60 * 1000);
    assert.equal(world.stored.has('teletraan-last-content'), true, 'written again after the next good read');

    world.broken = true;
    await world.advance(5 * 60 * 1000);
    assert.ok(started.first.content, 'a storage that throws is caught');
    started.stop();
  });
});

test('with no network the screen starts from the last content, then says it is offline, and every Monday panel shows the stale chip', async () => {
  const { run } = fakeWorld();

  await run(async world => {
    const fresh = Object.assign(answer(), { monday: { lastSyncAt: new Date(world.now - 10 * 60000).toISOString(), lastError: '', snapshots: [] } });
    world.stored.set('teletraan-last-content', JSON.stringify({ savedAt: world.now - 10 * 60000, raw: fresh }));
    world.down = true;

    const changes = [];
    const started = await contentModule.startSanityContent(change => changes.push(change));
    const first = started.first;
    assert.equal(first.status.source, 'cache');
    assert.equal(first.status.offline, false);
    assert.equal(first.content.tasks.length, answer().tasks.length, 'the last content is on the screen at once');
    assert.equal(monday.stale(first.content.monday, new Date(world.now), 30), false, 'a board read 10 minutes ago is not stale yet');

    await world.advance(2 * 60 * 1000 + 1000);
    assert.equal(changes.length >= 1, true);
    const out = changes[changes.length - 1];
    assert.equal(out.status.offline, true);
    assert.equal(out.content.tasks.length, answer().tasks.length, 'the same tasks are still drawn');

    for (const id of ['monday-tasks', 'monday-done', 'monday-status-depts', 'monday-overall', 'monday-timeline', 'monday-board']) {
      const html = panels[id].markupFor(out.content, new Date(world.now), { team: 'prime', department: 'lead-build' });
      assert.ok(html.includes('stale-chip'), id + ' shows the stale chip');
      assert.ok(html.includes('STALE · '), id);
    }
    started.stop();
  });
});

test('a copy saved under the older name is still read once, and the copy of the new name wins', async () => {
  const { run } = fakeWorld();

  await run(async world => {
    world.down = true;
    world.stored.set('teletraan-content', JSON.stringify({ savedAt: 1, raw: answer() }));
    const started = await contentModule.startSanityContent(() => {});
    assert.equal(started.first.status.source, 'cache');
    assert.equal(started.first.content.tasks.length, answer().tasks.length);
    started.stop();

    const newer = answer();
    newer.tasks = newer.tasks.slice(0, 1);
    world.stored.set('teletraan-last-content', JSON.stringify({ savedAt: 2, raw: newer }));
    const again = await contentModule.startSanityContent(() => {});
    assert.equal(again.first.content.tasks.length, 1);
    again.stop();
  });
});


// A fake browser: a clock that moves when it is told, a fetch that answers with the board or fails, and a localStorage

let current = null;

function answer() {
  return current.raw;
}

function fakeWorld() {
  const content = contentOf([task({ title: '[One]' }), task({ title: '[Two]', status: 'done', completedOn: '2026-10-12' }), task({ title: '[Three]', team: 'nova', subteamId: 'lead-design', subteam: '[Design]' })]);
  const raw = {
    settings: { mondayEveryMinutes: 30 },
    tasks: content.tasks.map(item => Object.assign({}, item)),
    subteams: content.subteams.map(item => Object.assign({}, item)),
    teams: content.teams,
    monday: { lastSyncAt: new Date(now.getTime() - 60000).toISOString(), lastError: '', snapshots: [] },
  };
  current = { raw: raw };

  return {
    async run(body) {
      const world = { now: now.getTime(), timers: [], next: 1, stored: new Map(), broken: false, down: false };
      const names = ['fetch', 'EventSource', 'localStorage', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'];
      const originals = {};
      names.forEach(name => {
        originals[name] = Object.getOwnPropertyDescriptor(globalThis, name);
      });
      const realNow = Date.now;
      const realError = console.error;

      const add = (run, delay, every) => {
        world.timers.push({ id: world.next, at: world.now + delay, run: run, every: every });
        return world.next++;
      };
      const fakes = {
        fetch: async () => {
          if (world.down) throw new TypeError('network is down');
          return { ok: true, status: 200, json: async () => ({ result: JSON.parse(JSON.stringify(current.raw)) }) };
        },
        EventSource: undefined,
        localStorage: {
          getItem: key => {
            if (world.broken) throw new Error('storage is blocked');
            return world.stored.has(key) ? world.stored.get(key) : null;
          },
          setItem: (key, value) => {
            if (world.broken) throw new Error('storage is blocked');
            world.stored.set(key, String(value));
          },
        },
        setTimeout: (run, delay) => add(run, delay, null),
        setInterval: (run, delay) => add(run, delay, delay),
        clearTimeout: id => {
          world.timers = world.timers.filter(timer => timer.id !== id);
        },
        clearInterval: id => {
          world.timers = world.timers.filter(timer => timer.id !== id);
        },
      };
      const settle = async () => {
        for (let turn = 0; turn < 30; turn++) await Promise.resolve();
      };
      world.advance = async milliseconds => {
        const end = world.now + milliseconds;
        for (;;) {
          const due = world.timers.filter(timer => timer.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
          if (!due) break;
          world.now = Math.max(world.now, due.at);
          if (due.every) due.at += due.every;
          else world.timers = world.timers.filter(timer => timer !== due);
          due.run();
          await settle();
        }
        world.now = end;
        await settle();
      };

      names.forEach(name => {
        if (fakes[name] === undefined) delete globalThis[name];
        else Object.defineProperty(globalThis, name, { value: fakes[name], configurable: true, writable: true });
      });
      Date.now = () => world.now;
      console.error = () => {};
      try {
        await body(world);
      } finally {
        console.error = realError;
        Date.now = realNow;
        names.forEach(name => {
          if (originals[name]) Object.defineProperty(globalThis, name, originals[name]);
          else delete globalThis[name];
        });
      }
    },
  };
}

await runTests();
