// Tests that the Studio and the dashboard fill an empty Screen with the same rows. The Studio fills the list when a Screen
// is opened (studio/tools/screen-seed.js) and the dashboard works the list out for a Screen that has none (core/screens.js,
// core/screen-seed.js). Each side has its own copy of the rule, so this file runs both on the same Panel order and the same
// Team documents and compares what they make. Nothing is drawn and nothing touches the network.
//
//   node tests/screen-seed-parity.test.mjs

import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const studioFolder = fileURLToPath(new URL('../studio/', import.meta.url));
const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const studioSeed = await import(pathToFileURL(studioFolder + 'tools/screen-seed.js').href);
const studioPanels = await import(pathToFileURL(studioFolder + 'inputs/screen-panels.js').href);
const studioParts = await import(pathToFileURL(studioFolder + 'inputs/screen-parts.js').href);
const config = await import(pathToFileURL(dashboardFolder + 'config.js').href);
const screens = await import(pathToFileURL(dashboardFolder + 'core/screens.js').href);
const { withDefaults } = await import(pathToFileURL(dashboardFolder + 'core/content.js').href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const prime = { _id: 'team-prime', code: 'prime', name: 'Hawktimus Prime', shortName: 'PRIME', active: true, order: 10 };
const nova = { _id: 'team-nova', code: 'nova', name: 'Hawktimus Nova', shortName: 'NOVA', active: true, order: 20 };
const shown = panels => panels.map(panel => ({ panel: panel, show: true }));
const flat = rows => rows.map(row => ({ panel: row.panel, team: row.team || '', seconds: row.seconds || 0 }));
const words = rows => flat(rows).map(row => row.panel + (row.team ? ':' + row.team : '') + (row.seconds ? ':' + row.seconds + 's' : ''));

// The Panel order saved: 11 rows, all shown, none with seconds
const ownersOrder = shown(['tonight', 'forecast', 'leadership', 'team-leads', 'photo', 'next-event', 'task-counts', 'sponsor-logo', 'task-counts', 'events', 'tasks']);

// The Team documents as the Studio reads them: the active ones, in order. The dashboard reads all of them and keeps the active
// ones (activeTeams in core/teams.js).
function studioCodes(teamDocuments) {
  return studioParts.teamCodes((teamDocuments || []).filter(team => team.active !== false));
}

// What the Studio fills a Screen with, from the Dashboard Settings it reads
function fromStudio(style, settings, teamDocuments) {
  return studioSeed.seedScreen(style, settings, studioCodes(teamDocuments));
}

// What the dashboard plays for a Screen that has no rows. The settings go through withDefaults, which is what puts the starting
// lists under a Panel order that was never saved.
function fromDashboard(style, settings, teamDocuments) {
  const content = withDefaults({ settings: settings, teams: teamDocuments });
  const screen = screens.resolveScreen(content, style);
  return { mainRows: screen.mainRows, sideRows: screen.sideRows, mondayStyle: screen.mondayStyle };
}

function compare(rotation, teamDocuments, extra) {
  const settings = Object.assign({ rotation: rotation }, extra);

  config.styles.forEach(style => {
    const studio = fromStudio(style, settings, teamDocuments);
    const dashboard = fromDashboard(style, settings, teamDocuments);
    assert.deepEqual(flat(studio.mainRows), flat(dashboard.mainRows), 'the main rows of ' + style);
    assert.equal(studio.mondayStyle, dashboard.mondayStyle, 'the Monday style of ' + style);
    // Minimal has no side panel, so the Studio gives it no side rows
    if (style !== 'minimal') assert.deepEqual(flat(studio.sideRows), flat(dashboard.sideRows), 'the side rows of ' + style);
  });
  return { studio: fromStudio('original', settings, teamDocuments), dashboard: fromDashboard('original', settings, teamDocuments) };
}

test('the panels that follow the team are the same list on both sides', () => {
  assert.deepEqual(studioPanels.teamSpecificPanels, config.teamPanels);
  assert.deepEqual(studioPanels.seededMondayPanels, config.mondayRows, 'the Monday rows a team is seeded with');
  // the status pie is offered in the Rotation list only, not in the rows of a Screen
  assert.deepEqual(studioPanels.idsOf(studioPanels.mondayPanels), Object.keys(config.mondayKinds).filter(id => id !== 'monday-pie'), 'the Monday panels the Studio offers');
});

test('the Panel order the owner saved gives 16 main rows and 5 side rows on both sides', () => {
  const made = compare({ order: ownersOrder }, [prime, nova]);

  [made.studio, made.dashboard].forEach(screen => {
    assert.equal(screen.mainRows.length, 16);
    assert.equal(screen.sideRows.length, 5);
  });
  assert.deepEqual(words(made.dashboard.mainRows), [
    'tonight:prime', 'leadership:prime', 'team-leads:prime', 'tasks:prime', 'monday-tasks:prime', 'monday-done:prime', 'monday-board:prime',
    'tonight:nova', 'leadership:nova', 'team-leads:nova', 'tasks:nova', 'monday-tasks:nova', 'monday-done:nova', 'monday-board:nova',
    'photo', 'events',
  ]);
  assert.deepEqual(words(made.dashboard.sideRows), ['forecast', 'next-event', 'task-counts', 'sponsor-logo', 'task-counts']);
});

test('an empty order is built from the older lists, the large panels and then the small panels', () => {
  const lists = {
    order: [],
    grid1: [{ panel: 'events', show: true, seconds: 30 }, { panel: 'tasks', show: true }, { panel: 'forecast', show: true }, { panel: 'photo', show: true }],
    grid2: [{ panel: 'forecast', show: true }, { panel: 'tasks', show: true }, { panel: 'task-counts', show: true, seconds: 12 }, { panel: 'monday-tasks', show: true }],
  };
  const made = compare(lists, [prime, nova]);
  assert.deepEqual(words(made.dashboard.mainRows).filter(row => row.indexOf('prime') !== -1), ['tasks:prime', 'monday-tasks:prime', 'monday-done:prime', 'monday-board:prime']);
  assert.deepEqual(words(made.dashboard.sideRows), ['forecast', 'task-counts:12s']);
});

test('only the older large list, only the older small list, and a saved order that wins over both', () => {
  compare({ order: [], grid1: shown(['photo', 'tasks']) }, [prime]);
  compare({ order: [], grid2: shown(['next-event', 'forecast']) }, [prime]);
  const made = compare({ order: shown(['photo']), grid1: shown(['tasks']), grid2: shown(['forecast']) }, [prime]);
  assert.deepEqual(words(made.dashboard.mainRows), ['monday-tasks:prime', 'monday-done:prime', 'monday-board:prime', 'photo']);
  assert.deepEqual(made.dashboard.sideRows, []);
});

test('nothing saved gives every panel in the order of the pickers', () => {
  [undefined, {}, { order: [] }].forEach(rotation => {
    const made = compare(rotation, [prime, nova]);
    assert.equal(made.dashboard.sideRows.length, studioPanels.smallPanels.length);
    assert.equal(made.dashboard.mainRows.length, 2 * (config.teamPanels.length + 3) + 2);
  });
});

test('lists that were saved empty stay empty on both sides, and a list that was never saved is the starting list', () => {
  const empty = compare({ order: [], grid1: [], grid2: [] }, [prime]);
  assert.deepEqual(words(empty.dashboard.mainRows), ['monday-tasks:prime', 'monday-done:prime', 'monday-board:prime']);
  assert.deepEqual(empty.dashboard.sideRows, []);

  const largeOnly = compare({ order: [], grid1: shown(['photo']) }, [prime]);
  assert.deepEqual(words(largeOnly.dashboard.sideRows), ['task-counts', 'next-event', 'forecast', 'safety-days', 'sponsor-logo']);
});

test('a row that is switched off is not seeded, in either list', () => {
  const order = [{ panel: 'tasks', show: false }, { panel: 'photo', show: true }, { panel: 'forecast', show: false }, { panel: 'next-event' }, { panel: 'leadership', show: false, seconds: 40 }];
  const made = compare({ order: order }, [prime, nova]);
  assert.deepEqual(words(made.dashboard.mainRows), ['monday-tasks:prime', 'monday-done:prime', 'monday-board:prime', 'monday-tasks:nova', 'monday-done:nova', 'monday-board:nova', 'photo']);
  assert.deepEqual(words(made.dashboard.sideRows), ['next-event']);

  const oldLists = compare({ order: [], grid1: [{ panel: 'tasks', show: false }, { panel: 'events', show: true }], grid2: [{ panel: 'forecast', show: false }, { panel: 'task-counts', show: true }] }, [prime]);
  assert.deepEqual(words(oldLists.dashboard.mainRows), ['monday-tasks:prime', 'monday-done:prime', 'monday-board:prime', 'events']);
  assert.deepEqual(words(oldLists.dashboard.sideRows), ['task-counts']);
});

test('a panel that appears twice has a row in each place, for each team', () => {
  const made = compare({ order: shown(['tasks', 'events', 'tasks', 'task-counts', 'forecast', 'task-counts']) }, [prime, nova]);
  assert.deepEqual(words(made.dashboard.mainRows), [
    'tasks:prime', 'tasks:prime', 'monday-tasks:prime', 'monday-done:prime', 'monday-board:prime',
    'tasks:nova', 'tasks:nova', 'monday-tasks:nova', 'monday-done:nova', 'monday-board:nova',
    'events',
  ]);
  assert.deepEqual(words(made.dashboard.sideRows), ['task-counts', 'forecast', 'task-counts']);
});

test('no Team documents is the built-in Prime team, and the Monday rows are still there', () => {
  [[], undefined].forEach(none => {
    const made = compare({ order: ownersOrder }, none);
    assert.deepEqual(words(made.dashboard.mainRows), [
      'tonight:prime', 'leadership:prime', 'team-leads:prime', 'tasks:prime', 'monday-tasks:prime', 'monday-done:prime', 'monday-board:prime',
      'photo', 'events',
    ]);
  });
});

test('one team takes the rows once, and a team that is switched off has none', () => {
  const only = compare({ order: ownersOrder }, [nova]);
  assert.equal(only.dashboard.mainRows.filter(row => row.team === 'nova').length, 7);
  assert.equal(only.dashboard.mainRows.filter(row => row.team === 'prime').length, 0);

  const off = compare({ order: ownersOrder }, [prime, Object.assign({}, nova, { active: false })]);
  assert.equal(off.dashboard.mainRows.filter(row => row.team === 'nova').length, 0);
  assert.equal(off.dashboard.mainRows.length, 9);

  const allOff = compare({ order: ownersOrder }, [Object.assign({}, prime, { active: false }), Object.assign({}, nova, { active: false })]);
  assert.equal(allOff.dashboard.mainRows.filter(row => row.team === 'prime').length, 7);
});

test('two teams take the rows in the order of the Team documents', () => {
  const primeFirst = compare({ order: shown(['tasks', 'photo']) }, [prime, nova]);
  assert.deepEqual(primeFirst.dashboard.mainRows.map(row => row.team || ''), ['prime', 'prime', 'prime', 'prime', 'nova', 'nova', 'nova', 'nova', '']);

  const novaFirst = compare({ order: shown(['tasks', 'photo']) }, [nova, prime]);
  assert.deepEqual(novaFirst.dashboard.mainRows.map(row => row.team || ''), ['nova', 'nova', 'nova', 'nova', 'prime', 'prime', 'prime', 'prime', '']);
});

test('seconds carry over, and a row with none, a zero or a word has none', () => {
  const order = [
    { panel: 'tasks', show: true, seconds: 30 },
    { panel: 'photo', show: true, seconds: 12 },
    { panel: 'events', show: true },
    { panel: 'leadership', show: true, seconds: 0 },
    { panel: 'team-leads', show: true, seconds: '20' },
    { panel: 'roster', show: true, seconds: -4 },
    { panel: 'forecast', show: true, seconds: 9 },
    { panel: 'next-event', show: true, seconds: null },
  ];
  const made = compare({ order: order }, [prime, nova]);
  assert.deepEqual(words(made.dashboard.mainRows).slice(0, 5), ['tasks:prime:30s', 'leadership:prime', 'team-leads:prime', 'roster:prime', 'monday-tasks:prime']);
  assert.deepEqual(words(made.dashboard.mainRows).slice(-2), ['photo:12s', 'events']);
  assert.deepEqual(words(made.dashboard.sideRows), ['forecast:9s', 'next-event']);
});

test('a Monday card, a competition card, a spare, a test panel and an unknown panel are not seeded from the order', () => {
  const order = shown(['monday-tasks', 'monday-board-both', 'competition-rank', 'competition-next-match', 'nothing', 'stand-in-tile', 'team-tile', 'photo', 'forecast', 'alert', 'banner']);
  const made = compare({ order: order }, [prime]);
  assert.deepEqual(words(made.dashboard.mainRows), ['monday-tasks:prime', 'monday-done:prime', 'monday-board:prime', 'photo']);
  assert.deepEqual(words(made.dashboard.sideRows), ['forecast']);
});

test('a row that is not a row, and a panel in the wrong list, are left out', () => {
  const lists = { order: [], grid1: [null, 'tasks', { panel: 'tasks' }, { show: true }, { panel: 'next-event', show: true }], grid2: [undefined, { panel: 'photo', show: true }, { panel: 'safety-days', show: true }] };
  const made = compare(lists, [prime]);
  assert.deepEqual(words(made.dashboard.mainRows), ['tasks:prime', 'monday-tasks:prime', 'monday-done:prime', 'monday-board:prime']);
  assert.deepEqual(words(made.dashboard.sideRows), ['safety-days']);
});

test('the Monday style comes from the old setting on both sides, and is minimal without one', () => {
  ['original', 'cybertron', 'minimal'].forEach(style => {
    assert.equal(compare({ order: ownersOrder }, [prime], { mondayStyle: style }).dashboard.mondayStyle, style);
  });
  [undefined, '', 'neon', 7].forEach(style => {
    assert.equal(compare({ order: ownersOrder }, [prime], { mondayStyle: style }).dashboard.mondayStyle, 'minimal');
  });
});

let failures = 0;
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

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
