// Tests for the Monday cards as rows: the mix and the order of the rows of the tasks card, the page marker and
// the scroll of a card with more than five rows, the cards of both teams, the header of a card (the chip with the
// name of the team and the words that fit beside it), the names of a team (core/team-title.js), and what the Panel
// order list does with a Monday card. frame.js (scrollCard) and core/schedule.js are run with stand-ins for the
// page. The board data is made up: the sample in data/sample/content.json, changed here and there.
//
//   node tests/monday-rows.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-monday-rows-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'frame.js'].forEach(file => fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});

const cardNames = ['tasks', 'milestones', 'progress', 'milestones-both', 'progress-both'];
cardNames.forEach(name => {
  const id = 'monday-' + name;
  fs.mkdirSync(path.join(root, 'panels', id), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', id, 'panel.js'), path.join(root, 'panels', id, 'panel.js'));
});
['leadership', 'team-leads', 'roster'].forEach(id => {
  fs.mkdirSync(path.join(root, 'panels', id), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', id, 'panel.js'), path.join(root, 'panels', id, 'panel.js'));
});

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const monday = await import(base + 'core/monday.js');
const draw = await import(base + 'core/monday-draw.js');
const screens = await import(base + 'core/screens.js');
const sanity = await import(base + 'core/sanity.js');
const teams = await import(base + 'core/teams.js');
const teamTitle = await import(base + 'core/team-title.js');
const headerRoom = await import(base + 'core/header-room.js');
const textWidthModule = await import(base + 'core/text-width.js');
const panelOrder = await import(base + 'core/panel-order.js');
const panels = {};
for (const name of cardNames) panels[name] = await import(base + 'panels/monday-' + name + '/panel.js');
const people = {};
for (const name of ['leadership', 'team-leads', 'roster']) people[name] = await import(base + 'panels/' + name + '/panel.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const at = text => new Date(text); // always written with a Z, so it means the same on every computer
// The sample also holds the tasks of the one task board (showOnBoard), which these tests were not written for and which
// tests/monday-panels.test.mjs uses. They run on the tasks that came before.
const sampleRaw = () => {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  raw.tasks = raw.tasks.filter(task => task.showOnBoard === undefined);
  return raw;
};
const countOf = (text, piece) => text.split(piece).length - 1;
const titlesOf = tasks => tasks.map(task => task.title);

// Noon on Monday October 12 2026 in Holly Springs
const monday12 = at('2026-10-12T16:00:00Z');

// The sample content, cleaned as the screen cleans it. Anything else is changed by the function given, which is given the raw sample.
function contentWith(change) {
  const raw = sampleRaw();
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}

// The id a Team lead has in these tests, made from its name, so that a task names its department by id as the sync writes it
const slug = name => 'lead-' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// A task from the board, the way the board sync makes it, with what a test changes
function board(fields) {
  const task = Object.assign({ title: '[Task]', subteam: '[Subteam A]', status: 'up-next', team: 'prime', source: 'monday', mondayId: '[item]', showOnTv: true }, fields);
  return Object.assign({ subteamId: slug(task.subteam) }, task);
}

// The sample with these tasks in place of its own, and these lead entries when there are some
function contentOf(tasks, leads, change) {
  return contentWith(raw => {
    raw.tasks = tasks;
    if (leads) raw.subteams = leads.map(name => ({ name: name }));
    raw.subteams.forEach(lead => {
      lead.id = slug(lead.name);
    });
    if (change) change(raw);
  });
}

// Runs a check with a team on the screen, and puts the built-in team back after it
function onTeamScreen(code, run) {
  teams.useTeams({ teams: contentWith().teams, settings: { teamMode: code, alternateMinutes: 5 } });
  teams.changeTeamNow();
  try {
    run();
  } finally {
    teams.useTeams(null);
    teams.changeTeamNow();
  }
}

const wordsOf = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const textOf = (html, cssClass) => Array.from(html.matchAll(new RegExp('<span class="' + cssClass + '[^"]*">([^<]*)</span>', 'g'))).map(match => match[1]);

// Some tasks of one status, with a number in the title so that they can be told apart
const many = (count, status, fields) => Array.from({ length: count }, (nothing, index) => board(Object.assign({ title: status + ' ' + String(index + 1).padStart(2, '0'), status: status }, fields)));


// The rows of the tasks card

test('a card has ten rows at the most, in the mix of 2 done, 3 in the backlog and the rest in progress', () => {
  assert.deepEqual([monday.mostRows, monday.rowsPerPage, monday.shares], [10, 5, { done: 2, backlog: 3 }]);

  const tasks = many(4, 'done').concat(many(6, 'up-next'), many(8, 'in-progress'));
  const rows = monday.pickRows(tasks);
  const count = status => rows.filter(task => task.status === status).length;

  assert.equal(rows.length, 10);
  assert.deepEqual([count('done'), count('up-next'), count('in-progress')], [2, 3, 5]);
  assert.deepEqual(titlesOf(rows.filter(task => task.status === 'in-progress')), titlesOf(many(5, 'in-progress')), 'each status gives its first ones, which are the first by rank');
  assert.equal(titlesOf(tasks)[0], 'done 01', 'the list given is not changed');
});

test('a status with fewer than its share leaves its slots to the others, in progress first, then the backlog, then done', () => {
  const count = (rows, status) => rows.filter(task => task.status === status).length;
  const shape = rows => [count(rows, 'done'), count(rows, 'up-next'), count(rows, 'in-progress')];

  assert.deepEqual(shape(monday.pickRows(many(3, 'done').concat(many(8, 'up-next'), many(2, 'in-progress')))), [2, 6, 2], 'two in progress leave three slots, which the backlog takes');
  assert.deepEqual(shape(monday.pickRows(many(3, 'done').concat(many(1, 'up-next'), many(1, 'in-progress')))), [3, 1, 1], 'every task is shown when there are fewer than ten');
  assert.deepEqual(shape(monday.pickRows(many(9, 'done').concat(many(1, 'up-next')))), [9, 1, 0], 'done tasks fill what nothing else takes');
  assert.deepEqual(shape(monday.pickRows(many(8, 'in-progress'))), [0, 0, 8]);
  assert.deepEqual(shape(monday.pickRows(many(12, 'in-progress'))), [0, 0, 10]);
  assert.deepEqual(monday.pickRows([]), []);
  assert.deepEqual(monday.pickRows([board({ status: 'blocked' })]), [], 'a blocked task has no row');
});

test('the rows are ranked high, medium, low and none, then the earliest due date, then the title, whatever their status', () => {
  const rows = monday.pickRows([
    board({ title: 'd low', status: 'done', priority: 'low' }),
    board({ title: 'c backlog medium', status: 'up-next', priority: 'medium', dueDate: '2026-10-14' }),
    board({ title: 'b progress high late', status: 'in-progress', priority: 'high', dueDate: '2026-10-20' }),
    board({ title: 'a progress high soon', status: 'in-progress', priority: 'high', dueDate: '2026-10-13' }),
    board({ title: 'e backlog none', status: 'up-next' }),
    board({ title: 'f done high', status: 'done', priority: 'high', dueDate: '2026-10-13' }),
  ]);
  assert.deepEqual(titlesOf(rows), ['a progress high soon', 'f done high', 'b progress high late', 'c backlog medium', 'd low', 'e backlog none']);
});

test('a row is the status, the title, the first name of the owner when there is one, and the priority as a shape', () => {
  const content = contentOf([
    board({ title: 'with all', status: 'in-progress', priority: 'high', contact: 'Sam' }),
    board({ title: 'medium', status: 'up-next', priority: 'medium', dueDate: '2026-10-14' }),
    board({ title: 'low', status: 'done', priority: 'low' }),
    board({ title: '<i>x</i>', status: 'in-progress', priority: 'urgent', contact: '<b>Al</b>' }),
  ]);
  const html = panels.tasks.markupFor(content, monday12, 1);

  assert.equal(html.match(/class="row[ "]/g).length, 4);
  assert.deepEqual(textOf(html, 'chip'), ['IN PROGRESS', 'IN PROGRESS', 'TO DO', 'DONE'], 'in progress first, then to do, then done, and each row says its status in words');
  assert.ok(html.includes('<span class="row-title">with all</span><span class="poc">Sam</span>'));
  assert.ok(html.includes('<span class="row-title">medium</span><span class="poc"></span>'), 'no one to ask leaves the place empty');
  assert.equal(countOf(html, 'triangle-high'), 1);
  assert.equal(countOf(html, 'triangle-medium'), 1);
  assert.equal(countOf(html, 'class="triangle-'), 2, 'low and none have no shape');
  assert.equal(countOf(html, 'class="priority"'), 4, 'but they keep their place');
  assert.equal(html.includes('<i>') || html.includes('<b>'), false);
  assert.ok(html.includes('&lt;i&gt;x&lt;/i&gt;') && html.includes('&lt;b&gt;Al&lt;/b&gt;'));
  assert.equal(/style="/.test(html), false);
});

test('the numbers under the rows count all the tasks of the lead, not only the rows that show', () => {
  const content = contentOf(many(4, 'done').concat(many(6, 'up-next', { dueDate: '2026-10-05' }), many(8, 'in-progress')));
  const html = panels.tasks.markupFor(content, monday12, 1);

  assert.equal(html.match(/class="row[ "]/g).length, 10);
  assert.ok(html.includes('<span class="fact-number">6</span><span class="fact-label">OVERDUE</span>'));
  assert.ok(html.includes('<span class="fact-number">14</span><span class="fact-label">OPEN</span>'));
  assert.ok(html.includes('<span class="fact-number">4</span><span class="fact-label">DONE</span>'));
});


// The page marker and the scroll

test('a card with more than five rows has a page marker and holds for two pages, and one with five or fewer has neither', () => {
  const html = count => panels.tasks.markupFor(contentOf(many(count, 'in-progress')), monday12, 1);

  [1, 5].forEach(count => {
    assert.equal(html(count).includes('class="marker"'), false, count + ' rows have no marker');
    assert.equal(panels.tasks.scrollPages(contentOf(many(count, 'in-progress')), 1), 1);
  });
  [6, 7, 10, 14].forEach(count => {
    const shown = Math.min(count, 10);
    assert.equal(panels.tasks.scrollPages(contentOf(many(count, 'in-progress')), 1), 2, count + ' tasks');
    assert.ok(html(count).includes('<span class="place place-1">1 OF 2<span class="place-more"> · ' + shown + ' TASKS</span></span><span class="place place-2">2 OF 2<span class="place-more"> · ' + shown + ' TASKS</span></span>'), count + ' tasks');
    assert.equal(countOf(html(count), 'class="square square-'), 2, 'a square for each page');
  });
  assert.equal(panels.tasks.scrollPages(contentOf([]), 1), 1, 'a page that does not exist is one page');
  assert.equal(monday.pagesOf(0), 1);
  assert.deepEqual([5, 6, 10].map(monday.pagesOf), [1, 2, 2]);
  assert.ok(monday.pagesOf(monday.mostRows) <= 2, 'the page marker has a square and a place for two pages, which are all that ten rows make');
});

test('a card that scrolls says so on its section, starting at page 1, and the list is marked for frame.js', () => {
  const html = panels.tasks.markupFor(contentOf(many(8, 'in-progress')), monday12, 1);

  assert.ok(html.includes('<section class="page monday monday-tasks" data-scroll-page="1">'));
  assert.equal(countOf(html, 'data-scroll-list'), 1);
  assert.ok(html.indexOf('data-scroll-list') < html.search(/class="row[ "]/), 'the rows are in the list');
  assert.equal(panels.milestones.markupFor(contentWith(), monday12).includes('data-scroll'), false, 'the card of one team that does not scroll has none of it');
});

// frame.js with a fake page and a fake list that records the animation it is given
async function withFrame(motion, run) {
  const real = globalThis.document;
  globalThis.document = fakeDocument();

  try {
    const frame = await import(base + 'frame.js?motion=' + motion);
    frame.setMotion(motion);
    await run(frame);
  } finally {
    globalThis.document = real;
  }
}

function fakeDocument() {
  return { documentElement: { dataset: {}, style: { setProperty: () => {} } }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
}

function fakeCard(animate) {
  const properties = {};
  const list = { animate: animate };
  return { dataset: { scrollPage: '1' }, style: { setProperty: (name, value) => { properties[name] = value; } }, querySelector: selector => (selector === '[data-scroll-list]' ? list : null), properties: properties };
}

test('frame.js moves the list of a card up by a page in 600 ms with the easing of the slats, in full motion, and at once in calm and none', async () => {
  await withFrame('full', frame => {
    const played = [];
    const card = fakeCard((keyframes, options) => played.push({ keyframes: keyframes, options: options }));

    frame.scrollCard(card, 1);
    assert.equal(card.dataset.scrollPage, '2', 'the page marker follows this');
    assert.equal(card.properties['--scroll-page'], '1');
    assert.equal(played.length, 1);
    assert.deepEqual(played[0].options, { duration: 600, easing: 'cubic-bezier(.5, 0, .2, 1)' });
    assert.deepEqual(played[0].keyframes.map(keyframe => Object.keys(keyframe)), [['transform'], ['transform']], 'only the transform moves');
    assert.ok(played[0].keyframes[0].transform.startsWith('translateY(calc(0 * var(--scroll-step') && played[0].keyframes[1].transform.startsWith('translateY(calc(1 * var(--scroll-step'));

    frame.scrollCard(card, 0);
    assert.equal(card.dataset.scrollPage, '1');
    assert.ok(played[1].keyframes[0].transform.includes('calc(1 *'), 'and back to the first page, from the second');

    frame.setSpeed('slow');
    frame.scrollCard(card, 1);
    assert.equal(played[2].options.duration, 900, 'the Speed setting stretches it like every other time');
    frame.setSpeed('normal');

    const none = { dataset: {}, style: { setProperty: () => {} }, querySelector: () => null };
    frame.scrollCard(none, 1);
    assert.equal(none.dataset.scrollPage, '2', 'a page with no list still says which page it is on');
  });

  for (const motion of ['calm', 'none']) {
    await withFrame(motion, frame => {
      const played = [];
      const card = fakeCard(() => played.push('animated'));
      frame.scrollCard(card, 1);
      assert.deepEqual([card.dataset.scrollPage, card.properties['--scroll-page'], played.length], ['2', '1', 0], motion + ': the list is at its place and nothing moves');
    });
  }
});

test('frame.css keeps the list a page up for each page in view, and the stylesheets of the cards have no animation of their own', () => {
  const frameCss = read('frame.css');
  assert.ok(/\[data-scroll-list\] \{\s*transform: translateY\(calc\(var\(--scroll-page, 0\) \* var\(--scroll-step, 0px\) \* -1\)\);\s*\}/.test(frameCss));

  const shared = read('monday.css');
  assert.ok(/--scroll-step: 420px;/.test(shared), 'a step is five rows of 84');
  assert.ok(/\.monday\.monday-progress-both \{\s*--scroll-step: 380px;/.test(read('panels/monday-progress-both/panel.css')), 'and five rows of 76 on the progress card of both teams');
  assert.equal(/transform|transition|animation|keyframes/.test(shared), false);
});


// core/schedule.js, with stand-ins for the page

const scheduleTree = path.join(workFolder, 'schedule-tree');
['config.js', 'core/schedule.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(scheduleTree, 'dashboard', file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(scheduleTree, 'dashboard', file));
});
fs.writeFileSync(path.join(scheduleTree, 'package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/frame.js'), [
  'export const pace = () => 1;',
  'export const turnMs = () => 0;',
  'export const isPaused = () => false;',
  'export const wait = () => new Promise(resolve => globalThis.scheduleWorld.waits.push(resolve));',
  'export const scrollCard = (card, index) => globalThis.scheduleWorld.log.push("scroll " + card.name + " " + index);',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/panels.js'), [
  'export function buildPage(id) {',
  "  globalThis.scheduleWorld.log.push('build ' + id);",
  '  return { id: id, element: { name: id } };',
  '}',
  'export const canShow = () => true;',
  'export const moduleOf = id => globalThis.scheduleWorld.modules[id] || null;',
  'export const regionOf = () => "grid1";',
  'export const topicOf = () => null;',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/photos.js'), 'export const ownSeconds = () => 0;\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/layout.js'), [
  'export const hasRegion = () => true;',
  "export const layoutNow = () => 'standard';",
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/areas.js'), [
  'export async function changePage(region, page) {',
  "  globalThis.scheduleWorld.log.push('page ' + (page ? page.id : 'none'));",
  '  return 0;',
  '}',
  'export function clearRegion() {}',
].join('\n') + '\n');
let scheduleRuns = 0;

async function inRotation(modules, run) {
  const world = { log: [], waits: [], modules: modules };
  globalThis.scheduleWorld = world;

  try {
    scheduleRuns += 1;
    world.module = await import(pathToFileURL(path.join(scheduleTree, 'dashboard/core/schedule.js')).href + '?run=' + scheduleRuns);
    world.content = { settings: { pageSeconds: 20, rotation: {} } };
    world.settle = async () => {
      for (let turn = 0; turn < 8; turn++) await new Promise(resolve => setImmediate(resolve));
    };
    // lets every wait go, a quarter of a second at a time, until this many seconds have passed
    world.pass = async count => {
      for (let quarter = 0; quarter < count * 4; quarter++) {
        world.waits.splice(0).forEach(resolve => resolve());
        await world.settle();
      }
    };
    await run(world);
  } finally {
    delete globalThis.scheduleWorld;
  }
}

const steps = ids => ids.map(panel => ({ panel: panel, show: true }));

test('a card that scrolls is held for its time, then its list moves up and it is held for the same time again, and then the next page comes', async () => {
  await inRotation({ a: { scrollPages: () => 2 } }, async world => {
    world.module.startRotation('grid1', () => steps(['a', 'b']), () => world.content);
    await world.settle();

    // a page is held 20 seconds less the second it takes to leave, which here is none
    await world.pass(19);
    assert.deepEqual(world.log, ['build a', 'page a'], 'held, and not scrolled yet');
    await world.pass(2);
    assert.deepEqual(world.log, ['build a', 'page a', 'scroll a 1'], 'the list moves up by a page');
    await world.pass(18);
    assert.deepEqual(world.log, ['build a', 'page a', 'scroll a 1'], 'and holds again');
    await world.pass(3);
    assert.deepEqual(world.log.slice(3), ['build b', 'page b'], 'then the next card');
  });
});

test('a card with one page, a panel that says nothing, and a panel whose answer is a problem are held once and never scrolled', async () => {
  const modules = { a: { scrollPages: () => 1 }, b: {}, c: { scrollPages: () => { throw new Error('broken'); } }, d: { scrollPages: () => 'many' } };
  const real = console.error;
  console.error = () => {};

  try {
    await inRotation(modules, async world => {
      world.module.startRotation('grid1', () => steps(['a', 'b', 'c', 'd']), () => world.content);
      await world.settle();
      await world.pass(100);
      assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), []);
      assert.deepEqual(world.log.filter(line => line.startsWith('page')).slice(0, 4), ['page a', 'page b', 'page c', 'page d']);
    });
  } finally {
    console.error = real;
  }
});

test('a card with three pages scrolls twice, and a refresh of the pages ends the holds', async () => {
  await inRotation({ a: { scrollPages: () => 3 } }, async world => {
    world.module.startRotation('grid1', () => steps(['a', 'b']), () => world.content);
    await world.settle();
    await world.pass(60);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), ['scroll a 1', 'scroll a 2']);

    world.module.showPagesNow();
    await world.pass(2);
    assert.ok(world.log.includes('page b'), 'the next page comes at once');
  });

  await inRotation({ a: { scrollPages: () => 3 } }, async world => {
    world.module.startRotation('grid1', () => steps(['a', 'b']), () => world.content);
    await world.settle();
    await world.pass(25);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), ['scroll a 1']);

    world.module.showPagesNow();
    await world.pass(2);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), ['scroll a 1'], 'and the second scroll never happens');
    assert.ok(world.log.includes('page b'));
  });
});


// The cards of both teams

test('the rows of both teams are one for each department and each team that has board tasks, alternating, in the order of the Team leads list', () => {
  const content = contentWith();
  const rows = monday.bothRows(content, teamsOf(content), monday12);

  assert.deepEqual(rows.map(row => (row.team ? row.team.code : 'none') + ' ' + row.lead), [
    'prime [Subteam A]', 'nova [Subteam A]', 'prime [Subteam B]', 'nova [Subteam B]', 'prime [Subteam C]', 'nova [Subteam C]',
    'prime [Subteam D]', 'nova [Subteam D]', 'prime [Subteam E]', 'nova [Subteam E]', 'none [Subteam F]',
  ]);
  assert.equal(rows[0].tasks.length, 6, 'the five tasks of Prime for Subteam A and the one for both teams');
  assert.equal(rows[1].tasks.length, 3, 'the two tasks of Nova for Subteam A and the same one for both teams');
  assert.ok(rows.slice(0, 10).every(row => row.tasks.every(task => task.team === row.team.code || task.team === undefined)), 'a row has the tasks of its own team and those for both');
  assert.equal(rows[10].tasks.length, 1, 'Subteam F has one task, for both teams, from a board with no team: it is one row, and the row has no team');

  const swapped = monday.bothRows(content, teamsOf(content).reverse(), monday12);
  assert.deepEqual(swapped.slice(0, 4).map(row => row.team.code), ['nova', 'prime', 'nova', 'prime'], 'the teams are in the order given');
  assert.deepEqual(monday.bothRows(contentOf([]), teamsOf(content), monday12), []);
});

function teamsOf(content) {
  return screens.teamsOf(content);
}

test('the cards of both teams are two, and only when two teams or more have board tasks', () => {
  const cards = [{ panel: 'monday-milestones-both', show: true }, { panel: 'monday-progress-both', show: true }];
  const content = contentWith();

  assert.deepEqual(monday.bothSteps(content, ['prime', 'nova'], monday12), cards);
  assert.deepEqual(monday.bothSteps(content, ['prime'], monday12), [], 'one team has its own cards');
  assert.deepEqual(monday.bothSteps(content, ['prime', 'nova', 'other'], monday12), cards, 'a team with no rows does not count');
  assert.deepEqual(monday.bothSteps(contentOf([board({})]), ['prime', 'nova'], monday12), [], 'Nova has none');
  assert.deepEqual(monday.bothSteps(contentOf([board({ team: '' })]), ['prime', 'nova'], monday12), cards, 'a board task for both teams is each team\'s');
  assert.deepEqual(monday.bothSteps(contentOf([board({ showOnTv: false }), board({ team: 'nova' })]), ['prime', 'nova'], monday12), [], 'a task that is off the TV is not a row');
  [null, undefined, {}, [], 'text'].forEach(value => assert.deepEqual(monday.bothSteps(value, ['prime', 'nova']), [], String(value)));
  assert.deepEqual(monday.bothSteps(content, null), []);
});

test('the progress card of both teams has a row for each department and team: the team, the department, a bar of done, in progress and backlog, and the count', () => {
  const html = panels['progress-both'].markupFor(contentWith(), monday12);
  const found = panels['progress-both'].progressFor(contentWith(), monday12);

  assert.equal(found.total, 11, 'five departments for each of the two teams, and Subteam F once, with no team');
  assert.equal(found.rows.length, 10, 'and the card keeps ten');
  assert.deepEqual(found.rows[0], { team: found.rows[0].team, lead: '[Subteam A]', backlog: 2, progress: 3, done: 1, total: 6 });
  assert.deepEqual(textOf(html, 'team-tag'), ['PRIME', 'NOVA', 'PRIME', 'NOVA', 'PRIME', 'NOVA', 'PRIME', 'NOVA', 'PRIME', 'NOVA'], 'the teams alternate while both have a department');
  assert.deepEqual(textOf(html, 'department').slice(0, 4), ['[SUBTEAM A]', '[SUBTEAM A]', '[SUBTEAM B]', '[SUBTEAM B]']);
  assert.deepEqual(textOf(html, 'count'), ['1/6', '0/3', '1/5', '0/2', '0/1', '0/2', '1/1', '1/2', '0/1', '1/2']);
  assert.ok(html.includes('team-tag team-tag-prime') && html.includes('team-tag team-tag-nova'));
  assert.equal(countOf(html, '<svg class="stack"'), 10, 'a bar for each row');

  // the stacks of the first row follow each other, done, in progress, backlog, and the longest bar fills the room
  const first = Array.from(html.split('<svg class="stack"')[1].matchAll(/<rect class="seg seg-(\w+)" x="(\d+)" y="0" width="(\d+)" height="44"\/>/g)).map(match => [match[1], Number(match[2]), Number(match[3])]);
  assert.deepEqual(first, [['done', 0, 67], ['progress', 67, 200], ['backlog', 267, 133]]);
  assert.deepEqual(['DONE', 'IN PROGRESS', 'BACKLOG'].map(label => html.includes('</span>' + label + '</span>')), [true, true, true], 'the legend names them in the same order');
  assert.equal(titleOf(html), 'PROGRESS');
  assert.equal(html.includes('team-chip'), false, 'the header has no chip: it reads PROGRESS alone');
  assert.ok(html.includes('1 OF 2 · 10 ROWS'));
});

test('the milestones card of both teams has a row for each department and team with an open task that has a due date: the team, the department, the next milestone and its date', () => {
  const html = panels['milestones-both'].markupFor(contentWith(), monday12);
  const found = panels['milestones-both'].milestonesFor(contentWith(), monday12);

  assert.deepEqual(found.rows.map(row => row.team.code + ' ' + row.lead + ' ' + row.task.title), [
    'prime [Subteam A] [Reattach drivetrain]', 'nova [Subteam A] [Cut the base plates]', 'prime [Subteam B] [Write the grant]', 'nova [Subteam B] [Plan the outreach]', 'nova [Subteam C] [Test the auto modes]', 'nova [Subteam D] [Draw the field]',
  ]);
  assert.equal(found.total, 6, 'Subteams E and F have no open task with a due date, and Prime has none for C and D');
  assert.deepEqual(textOf(html, 'milestone'), ['[Reattach drivetrain]', '[Cut the base plates]', '[Write the grant]', '[Plan the outreach]', '[Test the auto modes]', '[Draw the field]']);
  assert.deepEqual(textOf(html, 'date'), ['OCT 8', 'OCT 15', 'OCT 16', 'OCT 20', 'OCT 13', 'NOV 2']);
  assert.ok(html.includes('<span class="date late">OCT 8</span>'), 'a date that is past is marked late');
  assert.ok(html.includes('1 OF 2 · 6 MILESTONES'));
  assert.equal(html.includes('team-chip'), false, 'the header has no chip: it reads MILESTONES alone');
  assert.equal(titleOf(html), 'MILESTONES');

  const none = panels['milestones-both'].markupFor(contentOf([board({ title: 'a' }), board({ title: 'b', team: 'nova' })]), monday12);
  assert.ok(none.includes('<p class="empty">No open board items have a due date yet.</p>'));
  assert.equal(panels['milestones-both'].scrollPages(contentOf([board({ title: 'a' }), board({ title: 'b', team: 'nova' })])), 1);
  const empty = panels['milestones-both'].markupFor(contentOf([]), monday12);
  assert.ok(empty.includes('<p class="empty">No board is chosen yet.</p>'));
  assert.ok(panels['progress-both'].markupFor(contentOf([]), monday12).includes('<p class="empty">No board is chosen yet.</p>'));
});

function titleOf(html) {
  return wordsOf(/<h2 class="title"[^>]*>([\s\S]*?)<\/h2>/.exec(html)[1]);
}

test('the cards of both teams show ten rows at the most, five at a time, and hold for two pages', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'].map(letter => '[Lead ' + letter + ']');
  const tasks = [];
  names.forEach(name => ['prime', 'nova'].forEach(code => tasks.push(board({ subteam: name, team: code, status: 'in-progress', dueDate: '2026-10-14', title: code + ' ' + name }))));
  const content = contentOf(tasks, names);

  const found = panels['progress-both'].progressFor(content, monday12);
  assert.deepEqual([found.rows.length, found.total], [10, 12]);
  assert.deepEqual(found.rows.map(row => row.team.code).join(' '), 'prime nova prime nova prime nova prime nova prime nova');
  assert.equal(panels['progress-both'].scrollPages(content), 2);
  assert.ok(panels['progress-both'].markupFor(content, monday12).includes('1 OF 2 · 10 ROWS'));
  assert.equal(panels['milestones-both'].milestonesFor(content, monday12).rows.length, 10);
  assert.equal(panels['milestones-both'].scrollPages(content), 2);

  const few = contentOf(tasks.slice(0, 4), names);
  assert.equal(panels['progress-both'].scrollPages(few), 1);
  assert.equal(panels['progress-both'].markupFor(few, monday12).includes('class="marker"'), false);
});

test('a name from the board is never markup on the cards of both teams, and no card of either has a dash', () => {
  const content = contentOf([board({ title: '<b>bold</b> & more', subteam: '<u>lead</u>', dueDate: '2026-10-14' }), board({ title: '<i>x</i>', subteam: '<u>lead</u>', team: 'nova', dueDate: '2026-10-15' })], ['<u>lead</u>']);
  const dashes = /[\u2013\u2014]/;

  ['milestones-both', 'progress-both'].forEach(name => {
    const html = panels[name].markupFor(content, monday12);
    assert.equal(/<(b|u|i)>/.test(html), false, name + ' has markup from a name');
    assert.equal(dashes.test(html), false, name);
    assert.ok(html.includes('&lt;U&gt;LEAD&lt;/U&gt;'), name);
  });
  ['core/team-title.js', 'core/text-width.js', 'monday.css', 'panels/monday-milestones-both/panel.js', 'panels/monday-progress-both/panel.js', 'panels/monday-milestones-both/panel.css', 'panels/monday-progress-both/panel.css'].forEach(file => {
    assert.equal(dashes.test(read(file)), false, file + ' has an em or en dash');
  });
});


// The header

test('the words about the board are how long ago and nothing else, and are left out when they do not fit in the room at the right end', () => {
  const room = headerRoom.wordsRoom;

  assert.equal(draw.wordsAtRight('4 MIN AGO'), '4 MIN AGO');
  assert.equal(draw.wordsAtRight('59 MIN AGO'), '59 MIN AGO');
  assert.equal(draw.wordsAtRight('9 DAYS AGO'), '9 DAYS AGO');
  assert.equal(draw.wordsAtRight('12 DAYS AGO'), '', 'a board that was read ten days ago or more has no words: they are 290 wide');
  assert.equal(draw.wordsAtRight('SAMPLE'), 'SAMPLE');
  assert.equal(draw.wordsAtRight('BOARD · 4 MIN AGO'), '', 'BOARD is too much for the room');
  assert.equal(draw.wordsAtRight(''), '');

  // whatever is chosen fits, and nothing is left out that would have fitted
  ['NOW', '4 MIN AGO', '59 MIN AGO', '47 HR AGO', '12 DAYS AGO', '100 DAYS AGO', 'SAMPLE', 'BOARD · 4 MIN AGO'].forEach(text => {
    const wide = textWidthModule.textWidth(text, 600, 44);
    assert.equal(draw.wordsAtRight(text) === text, wide <= room, text + ' is ' + Math.round(wide) + ' wide in ' + room);
  });
});

test('the header has the title, the words, the chip and the slashes in that order, and a long title is cut off with an ellipsis rather than pushed over the chip', () => {
  const header = draw.headerMarkup('BUILD TEAM', 'PRIME', { lastSyncAt: '2026-10-12T15:56:00Z' }, monday12);

  assert.ok(header.includes('<h2 class="title" data-slat="title">BUILD TEAM</h2>'));
  assert.ok(header.indexOf('class="ago"') < header.indexOf('class="team-chip"') && header.indexOf('class="team-chip"') < header.indexOf('class="double-slash"'));
  assert.ok(header.includes('<span class="ago">4 MIN AGO</span><span class="team-chip">PRIME</span>'));
  assert.ok(header.includes('<div class="tag tag-with-chip" data-slat="tag">'), 'a header with a chip says so, and the stylesheet decides where the words fit beside it');
  assert.equal(draw.headerMarkup('BUILD TEAM', 'PRIME', null, monday12).includes('class="ago"'), false, 'with no status there are no words');

  const css = fs.readFileSync(path.join(dashboardFolder, 'monday.css'), 'utf8');
  assert.ok(/\.monday \.title \{[^}]*min-width: 0;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/.test(css));
  assert.ok(/\.monday \.tag \{\s*flex: none;/.test(css), 'the chip is never made narrower');
});


// Team names

test('a team is named by its short name, a department by itself and TEAM, and a page of shared items names no team', () => {
  assert.equal(teamTitle.teamNameOf({ shortName: 'prime', name: 'Hawktimus Prime', code: 'prime' }), 'PRIME');
  assert.equal(teamTitle.teamNameOf({ name: 'Hawktimus Nova', code: 'nova' }), 'HAWKTIMUS NOVA');
  assert.equal(teamTitle.teamNameOf({ code: 'nova' }), 'NOVA');
  assert.equal(teamTitle.teamNameOf(null), '');
  assert.equal(teamTitle.bothTeamsName, undefined, 'there is no name for both teams');

  assert.equal(teamTitle.departmentTitle('Build'), 'BUILD TEAM');
  assert.equal(teamTitle.departmentTitle(' programming '), 'PROGRAMMING TEAM');
  assert.equal(teamTitle.departmentTitle('Safety Team'), 'SAFETY TEAM', 'a name that ends in TEAM does not get a second one');
  assert.equal(teamTitle.departmentTitle('Teamwork'), 'TEAMWORK TEAM', 'only the word TEAM counts');
  assert.equal(teamTitle.departmentTitle(''), 'TEAM');
  assert.equal(teamTitle.departmentTitle(undefined), 'TEAM');

  assert.equal(teamTitle.pageTeamName([{ team: '' }, {}], 'PRIME'), '');
  assert.equal(teamTitle.pageTeamName([{ team: 'prime' }, { team: '' }], 'PRIME'), 'PRIME', 'one item of the team makes it the team\'s');
  assert.equal(teamTitle.pageTeamName([{ team: 'nova' }], 'NOVA'), 'NOVA');
  assert.equal(teamTitle.pageTeamName([], 'PRIME'), 'PRIME', 'a page with no items is the team on the screen');
  assert.equal(teamTitle.pageTeamName(null, 'PRIME'), 'PRIME');
  assert.equal(teamTitle.teamChipMarkup('<b>x'), '<span class="team-chip">&lt;b&gt;x</span>');
  assert.equal(teamTitle.teamChipMarkup(''), '', 'no name, no chip');
});

test('the text width is the sum of the advance widths of the display font, and a character that is not known is counted wide', () => {
  const width = textWidthModule.textWidth;

  assert.equal(Math.round(width('BUILD TEAM', 700, 60)), 387);
  assert.equal(Math.round(width('PROGRAMMING TEAM', 700, 60)), 685);
  assert.equal(Math.round(width('4 MIN AGO', 600, 44)), 237);
  assert.equal(width('', 700, 44), 0);
  assert.ok(width('é', 700, 44) >= width('W', 700, 44) * 0.79, 'an unknown character is counted as wide');
  assert.equal(width('A', 500, 100), width('A', 700, 100), 'a weight that is not known is 700');
});


// The rows that every Monday card counts

test('the progress card counts the same rows the tasks card shows: one board task is a row on both, and a task that is not from the board is a row on neither', () => {
  const one = contentOf([board({ title: 'the board task' }), { title: 'a pinned task', subteam: '[Subteam A]', status: 'up-next' }]);
  const tasks = panels.tasks.markupFor(one, monday12, 1);
  const progress = panels.progress.markupFor(one, monday12);

  assert.equal(tasks.match(/class="row[ "]/g).length, 1);
  assert.equal(countOf(progress, 'class="bar-row"'), 1, 'the card that said No board items are showing yet while the tasks card had a row');
  assert.ok(progress.includes('<span class="count">0/1</span>') && progress.includes('1 OPEN · 0 OVERDUE'));
  assert.equal(progress.includes('class="empty"'), false);

  const pinned = contentOf([{ title: 'a pinned task', subteam: '[Subteam A]', status: 'up-next' }]);
  assert.equal(panels.tasks.hasContent(pinned, 1), false, 'no page of the tasks card');
  assert.equal(panels.progress.markupFor(pinned, monday12).includes('class="empty"'), true, 'and the progress card has nothing either');
  assert.equal(monday.groupsFor(pinned, monday12).length, 0);

  // for every content, the leads that have tasks are the leads that have a bar
  [contentWith(), contentOf(many(3, 'done').concat(many(3, 'in-progress', { subteam: '[Subteam B]' }), many(1, 'up-next', { subteam: '[Subteam C]', showOnTv: false }))), contentOf([board({ team: '' })])].forEach(content => {
    const pages = monday.groupsFor(content, monday12).map(group => group.name.toUpperCase() + ' TEAM');
    const bars = Array.from(panels.progress.markupFor(content, monday12).matchAll(/<span class="department">([^<]*)<\/span>/g)).map(match => match[1] + ' TEAM');
    assert.deepEqual(bars, pages);
  });
});

test('the milestones card counts board tasks only, as the others do', () => {
  const pinned = contentOf([{ title: 'a pinned task', subteam: '[Subteam A]', status: 'up-next', dueDate: '2026-10-13' }, board({ title: 'the board task', dueDate: '2026-10-14' })]);
  const html = panels.milestones.markupFor(pinned, monday12);

  assert.equal(html.includes('a pinned task'), false);
  assert.ok(html.includes('the board task'));
  assert.ok(panels.milestones.markupFor(contentOf([{ title: 'a pinned task', subteam: '[Subteam A]', status: 'up-next', dueDate: '2026-10-13' }]), monday12).includes('<p class="empty">No board is chosen yet.</p>'));
});


// The names of the teams on the Roster, Leadership and Team leads headers

// plate.js draws each card and bar shape once into a hidden group of the page. This stands in for the page.
async function withFakePage(run) {
  const drawn = [];
  globalThis.document = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => drawn.push(markup.match(/id="([^"]+)"/)[1]) };
      return drawn.includes(id) ? {} : null;
    },
  };
  globalThis.Image = class { set src(address) {} };

  try {
    await run();
  } finally {
    delete globalThis.document;
    delete globalThis.Image;
  }
}

function mounted(panel, content) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  panel.mount(host, content);
  return host.innerHTML;
}

const headerOf = html => ({
  title: wordsOf(/<h2 class="([^"]*)" data-slat="title">([\s\S]*?)<\/h2>/.exec(html)[2]),
  titleClass: /<h2 class="([^"]*)" data-slat="title">/.exec(html)[1],
  chip: (/<span class="team-chip">([^<]*)<\/span>/.exec(html) || [])[1],
});

test('the Leadership and Team leads headers name the team: PRIME or NOVA, and have no chip when everything on the list is for both', async () => {
  await withFakePage(async () => {
    const person = fields => Object.assign({ name: '[Alex]', role: 'Captain' }, fields);
    const department = fields => Object.assign({ name: '[Build]', lead: '[Lead A]', members: [] }, fields);

    const shared = { people: [person({}), person({ name: '[Sam]' })], subteams: [department({})], settings: {} };
    assert.deepEqual(headerOf(mounted(people.leadership, shared)), { title: 'LEADERSHIP', titleClass: 'title', chip: undefined });
    assert.deepEqual(headerOf(mounted(people['team-leads'], shared)), { title: 'TEAM LEADS', titleClass: 'title', chip: undefined });

    const mixed = { people: [person({}), person({ name: '[Sam]', team: 'prime' })], subteams: [department({}), department({ name: '[Wiring]', team: 'prime' })], settings: {} };
    assert.deepEqual(headerOf(mounted(people.leadership, mixed)), { title: 'LEADERSHIP', titleClass: 'title', chip: 'PRIME' }, 'one person for the team makes it the team\'s, and the heading keeps its size');
    assert.deepEqual(headerOf(mounted(people['team-leads'], mixed)), { title: 'TEAM LEADS', titleClass: 'title', chip: 'PRIME' });

    const onlyNova = { people: [person({ team: 'nova' })], subteams: [department({ team: 'nova' })], settings: {} };
    onTeamScreen('nova', () => {
      assert.equal(headerOf(mounted(people.leadership, onlyNova)).chip, 'NOVA');
      assert.equal(headerOf(mounted(people['team-leads'], onlyNova)).chip, 'NOVA');
    });
    assert.equal(mounted(people.leadership, shared).includes('class="tag-text"'), false, 'the tag text of the old header is gone');
    assert.ok(mounted(people.leadership, shared).includes('class="double-slash"'), 'and the slashes stay');
  });
});

test('the Roster header is the subteam and TEAM with the name of the team in a chip, for each subteam its own team', async () => {
  await withFakePage(async () => {
    const subteam = (name, fields) => Object.assign({ name: name, lead: '[Lead A]', members: ['[Alex]', '[Sam]'] }, fields);
    const content = { people: [], subteams: [subteam('Build', {}), subteam('Programming', { team: 'prime' }), subteam('Strategy', { team: 'nova' })], settings: {} };
    const seen = [];

    for (let visit = 0; visit < 4; visit++) seen.push(headerOf(mounted(people.roster, content)));
    assert.deepEqual(seen.map(header => [header.title, header.chip]), [['BUILD TEAM', undefined], ['PROGRAMMING TEAM', 'PRIME'], ['BUILD TEAM', undefined], ['PROGRAMMING TEAM', 'PRIME']], 'the subteam of the other team has no page on this screen, a subteam for both teams has no chip, and each of the others says its own team');
  });
});

test('a title is at the size of a heading when it fits before the line that ends the tab, and at 60px when it does not', () => {
  assert.equal(teamTitle.titleClass('LEADERSHIP'), 'title');
  assert.equal(teamTitle.titleClass('TEAM LEADS'), 'title');
  assert.equal(teamTitle.titleClass('PROGRAMMING TEAM'), 'title title-tight', 'PROGRAMMING TEAM is 685 wide at 60px, and the room is 656');
  assert.equal(teamTitle.titleClass('BUILD TEAM'), 'title');
  assert.equal(teamTitle.titleClass('ELECTRICAL TEAM'), 'title title-small');

  // the choice is by the room before the line: whatever is at 96px fits in it, and what is at 60px did not fit at 96px. The chip is on the other side of the line
  ['LEADERSHIP', 'TEAM LEADS', 'BUILD TEAM', 'DESIGN TEAM', 'PROGRAMMING TEAM', 'ELECTRICAL TEAM', 'A TEAM'].forEach(title => {
    const big = teamTitle.titleClass(title) === 'title';
    assert.equal(textWidthModule.textWidth(title, 700, 96) <= headerRoom.titleRoom, big, title);
  });
  ['leadership', 'team-leads', 'roster'].forEach(name => {
    const css = fs.readFileSync(path.join(dashboardFolder, 'panels', name, 'panel.css'), 'utf8');
    assert.ok(/\.title \{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;/.test(css), name + ': a title that still does not fit is cut off with an ellipsis');
    assert.ok(/\.title-small \{ font: 700 var\(--size-team\)\/64px/.test(css), name);
    assert.equal(/tag-text/.test(css), false, name + ' has no rule for the old tag text');
  });
});

// The Panel order list

test('a saved Panel order that still names a Monday card is ignored, and the cards are not offered in Studio', () => {
  const rotationOf = order => ({ order: order });
  const saved = rotationOf([{ panel: 'tasks', show: true }, { panel: 'monday-tasks', show: true }, { panel: 'monday-progress-both', show: true }, { panel: 'task-counts', show: true }]);

  assert.deepEqual(panelOrder.playlistOf(saved, 'grid1').map(step => step.panel), ['tasks']);
  assert.deepEqual(panelOrder.playlistOf(saved, 'grid2').map(step => step.panel), ['task-counts']);
  assert.deepEqual(panelOrder.orderFromLists({ grid1: [{ panel: 'tasks' }, { panel: 'monday-milestones' }], grid2: [] }).map(step => step.panel), ['tasks']);
  assert.equal(panelOrder.playlistOf({ order: [{ panel: 'monday-tasks' }] }, 'grid1').length, 0);
  assert.equal(/monday/.test(read('core/competition.js')), false, 'withCompetition never held the Monday cards, and the Monday rows have no competition cards in them');
  assert.equal(/monday/i.test(fs.readFileSync(path.join(dashboardFolder, '../studio/schemas/settingsRotation.js'), 'utf8').replace(/\/\/.*$/gm, '')), false, 'the Panel order choices of Studio have no Monday card');
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
