// Tests for the first rows of a Screen (studio/screen-seed.js) and for the rules a row of a Screen
// follows about its panel and its team (studio/screen-panels.js). The seeding turns the Panel order
// that the screen follows now into the rows of the main panel (B) and the side panel (D). Plain
// functions only: nothing is drawn and nothing touches the network.
//
//   node tools/test-screen-seed.mjs

import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const studioFolder = fileURLToPath(new URL('../studio/', import.meta.url));
const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const seed = await import(pathToFileURL(studioFolder + 'screen-seed.js').href);
const panelLists = await import(pathToFileURL(studioFolder + 'screen-panels.js').href);
const ids = await import(pathToFileURL(studioFolder + 'screen-ids.js').href);
const registry = await import(pathToFileURL(dashboardFolder + 'registry.js').href);
const config = await import(pathToFileURL(dashboardFolder + 'config.js').href);

const { seedRows, seedScreen, currentOrder, needsSeed, withKeys } = seed;
const { teamKindOf, teamChoices, teamProblem, teamWord, largePanels, smallPanels, mondayPanels, teamSpecificPanels } = panelLists;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const row = (panel, team, seconds) => {
  const made = { panel: panel };
  if (team) made.team = team;
  if (seconds) made.seconds = seconds;
  return made;
};
const shown = panels => panels.map(panel => ({ panel: panel, show: true }));

// The Panel order the owner saved: 11 rows, all shown, none with seconds
const ownersOrder = shown(['tonight', 'forecast', 'leadership', 'team-leads', 'photo', 'next-event', 'task-counts', 'sponsor-logo', 'task-counts', 'events', 'tasks']);
const prime = 'prime';
const nova = 'nova';

test('the owner Panel order gives 16 main rows: Prime rows, Prime Monday rows, Nova rows, Nova Monday rows, then the rows for both teams', () => {
  const rows = seedRows({ order: ownersOrder }, [prime, nova]);
  assert.deepEqual(rows.mainRows, [
    row('tonight', prime), row('leadership', prime), row('team-leads', prime), row('tasks', prime),
    row('monday-tasks', prime), row('monday-milestones', prime), row('monday-progress', prime),
    row('tonight', nova), row('leadership', nova), row('team-leads', nova), row('tasks', nova),
    row('monday-tasks', nova), row('monday-milestones', nova), row('monday-progress', nova),
    row('photo'), row('events'),
  ]);
});

test('the owner Panel order gives five side rows, task counts twice, in the order they had', () => {
  const rows = seedRows({ order: ownersOrder }, [prime, nova]);
  assert.deepEqual(rows.sideRows, [row('forecast'), row('next-event'), row('task-counts'), row('sponsor-logo'), row('task-counts')]);
});

test('a row of the side panel has no team, and a row for both teams has none', () => {
  const rows = seedRows({ order: ownersOrder }, [prime, nova]);
  rows.sideRows.forEach(side => assert.equal(Object.prototype.hasOwnProperty.call(side, 'team'), false));
  rows.mainRows.filter(main => main.panel === 'photo' || main.panel === 'events').forEach(main => assert.equal(Object.prototype.hasOwnProperty.call(main, 'team'), false));
});

test('seconds carry over and a row with none has none', () => {
  const rows = seedRows({ order: [{ panel: 'tasks', show: true, seconds: 30 }, { panel: 'photo', show: true, seconds: 12 }, { panel: 'events', show: true }, { panel: 'forecast', show: true, seconds: 9 }] }, [prime]);
  assert.deepEqual(rows.mainRows, [row('tasks', prime, 30), row('monday-tasks', prime), row('monday-milestones', prime), row('monday-progress', prime), row('photo', '', 12), row('events')]);
  assert.deepEqual(rows.sideRows, [row('forecast', '', 9)]);
});

test('a panel that appears twice has a row for each place, for each team', () => {
  const rows = seedRows({ order: shown(['tasks', 'events', 'tasks']) }, [prime, nova]);
  assert.deepEqual(rows.mainRows.map(main => main.panel + ':' + (main.team || '')), [
    'tasks:prime', 'tasks:prime', 'monday-tasks:prime', 'monday-milestones:prime', 'monday-progress:prime',
    'tasks:nova', 'tasks:nova', 'monday-tasks:nova', 'monday-milestones:nova', 'monday-progress:nova',
    'events:',
  ]);
});

test('a row that was switched off in the Panel order is left out of both lists', () => {
  const rows = seedRows({ order: [{ panel: 'tasks', show: false }, { panel: 'photo', show: true }, { panel: 'forecast', show: false }, { panel: 'next-event' }] }, [prime]);
  assert.deepEqual(rows.mainRows.map(main => main.panel), ['monday-tasks', 'monday-milestones', 'monday-progress', 'photo']);
  assert.deepEqual(rows.sideRows, [row('next-event')]);
});

test('the teams take the rows in the order they are given, and one team takes them once', () => {
  const novaFirst = seedRows({ order: shown(['tasks', 'photo']) }, [nova, prime]);
  assert.deepEqual(novaFirst.mainRows.map(main => main.team || ''), ['nova', 'nova', 'nova', 'nova', 'prime', 'prime', 'prime', 'prime', '']);
  const alone = seedRows({ order: shown(['tasks', 'photo']) }, [prime]);
  assert.deepEqual(alone.mainRows.map(main => main.panel), ['tasks', 'monday-tasks', 'monday-milestones', 'monday-progress', 'photo']);
});

test('with no team given the screen has the built-in team, Prime', () => {
  [[], undefined, null].forEach(none => {
    assert.deepEqual(seedRows({ order: shown(['tasks']) }, none).mainRows.map(main => main.team || ''), ['prime', 'prime', 'prime', 'prime']);
  });
});

test('a Panel order made of nothing but panels for both teams has Monday rows only for the teams', () => {
  const rows = seedRows({ order: shown(['events', 'photo']) }, [prime, nova]);
  assert.deepEqual(rows.mainRows.map(main => main.panel + ':' + (main.team || '')), [
    'monday-tasks:prime', 'monday-milestones:prime', 'monday-progress:prime',
    'monday-tasks:nova', 'monday-milestones:nova', 'monday-progress:nova',
    'events:', 'photo:',
  ]);
});

test('an empty rotation.order is built from the older lists, the large panels and then the small panels, as the dashboard does', () => {
  const lists = {
    order: [],
    grid1: [{ panel: 'events', show: true, seconds: 30 }, { panel: 'tasks', show: true }],
    grid2: [{ panel: 'forecast', show: true }, { panel: 'tasks', show: true }, { panel: 'task-counts', show: true }],
  };
  assert.deepEqual(currentOrder(lists), [lists.grid1[0], lists.grid1[1], lists.grid2[0], lists.grid2[2]]);
  const rows = seedRows(lists, [prime]);
  assert.deepEqual(rows.mainRows.map(main => main.panel), ['tasks', 'monday-tasks', 'monday-milestones', 'monday-progress', 'events']);
  assert.deepEqual(rows.sideRows, [row('forecast'), row('task-counts')]);
});

test('the Panel order wins over the older lists when it has rows', () => {
  const lists = { order: shown(['photo']), grid1: shown(['tasks']), grid2: shown(['forecast']) };
  assert.deepEqual(currentOrder(lists), lists.order);
});

test('a row for a Monday card, a competition card or an unknown panel is left out of the Panel order', () => {
  const rows = seedRows({ order: shown(['monday-tasks', 'competition-rank', 'nothing', 'photo', 'team-tile']) }, [prime]);
  assert.deepEqual(rows.mainRows.map(main => main.panel), ['monday-tasks', 'monday-milestones', 'monday-progress', 'photo']);
  assert.deepEqual(rows.sideRows, []);
});

test('with nothing saved every panel is a row, in the order of the pickers', () => {
  [undefined, null, {}, { order: [] }].forEach(none => {
    const order = currentOrder(none);
    assert.deepEqual(order.map(step => step.panel), largePanels.concat(smallPanels).map(panel => panel.value));
    assert.ok(order.every(step => step.show === true));
  });
  const rows = seedRows(undefined, [prime, nova]);
  assert.equal(rows.mainRows.length, 2 * (teamSpecificPanels.length + 3) + 2);
  assert.equal(rows.sideRows.length, smallPanels.length);
});

test('an older list that was never saved is the starting list, and one that was saved empty has no rows', () => {
  const large = largePanels.map(panel => panel.value);
  const small = smallPanels.map(panel => panel.value);
  assert.deepEqual(currentOrder({ grid1: shown(['photo']) }).map(step => step.panel), ['photo'].concat(small));
  assert.deepEqual(currentOrder({ grid2: shown(['forecast']) }).map(step => step.panel), large.concat(['forecast']));
  assert.deepEqual(currentOrder({ order: [], grid1: [], grid2: [] }), []);
  const rows = seedRows({ order: [], grid1: [], grid2: [] }, [prime]);
  assert.deepEqual(rows.mainRows.map(main => main.panel), ['monday-tasks', 'monday-milestones', 'monday-progress']);
  assert.deepEqual(rows.sideRows, []);
});

test('a Screen is filled with the rows and the Monday style of the old setting; Minimal has no side rows', () => {
  const settings = { rotation: { order: ownersOrder }, mondayStyle: 'cybertron' };
  const original = seedScreen('original', settings, [prime, nova]);
  assert.equal(original.mainRows.length, 16);
  assert.equal(original.sideRows.length, 5);
  assert.equal(original.mondayStyle, 'cybertron');
  const cybertron = seedScreen('cybertron', settings, [prime, nova]);
  assert.deepEqual(cybertron, original);
  const minimal = seedScreen('minimal', settings, [prime, nova]);
  assert.deepEqual(minimal.mainRows, original.mainRows);
  assert.deepEqual(minimal.sideRows, []);
});

test('the Monday style is minimal when Dashboard Settings has none, or has one that is not a style', () => {
  assert.equal(seedScreen('original', null, [prime]).mondayStyle, 'minimal');
  assert.equal(seedScreen('original', {}, [prime]).mondayStyle, 'minimal');
  assert.equal(seedScreen('original', { mondayStyle: 'neon' }, [prime]).mondayStyle, 'minimal');
  assert.equal(seedScreen('original', { mondayStyle: 'original' }, [prime]).mondayStyle, 'original');
});

test('a Screen is filled only while its main panel list is empty', () => {
  assert.equal(needsSeed(undefined), true);
  assert.equal(needsSeed({}), true);
  assert.equal(needsSeed({ mainRows: [] }), true);
  assert.equal(needsSeed({ mainRows: [{ _key: 'a', panel: 'tasks' }] }), false);
});

test('every row gets a key of its own', () => {
  const keyed = withKeys(seedRows({ order: ownersOrder }, [prime, nova]).mainRows, 'main');
  assert.equal(new Set(keyed.map(item => item._key)).size, keyed.length);
  assert.equal(keyed[0]._key, 'main-1');
  assert.equal(keyed[0].panel, 'tonight');
});

test('the lists of panels are the panels of the registry, and the Monday rows are its Monday cards', () => {
  const registered = area => registry.panels.filter(panel => panel.region === area && !panel.testOnly && !panel.competition && !panel.monday && !panel.lastResort).map(panel => panel.id);
  assert.deepEqual(largePanels.map(panel => panel.value), registered('grid1'));
  assert.deepEqual(smallPanels.map(panel => panel.value), registered('grid2'));
  const monday = registry.panels.filter(panel => panel.monday).map(panel => panel.id);
  mondayPanels.forEach(panel => assert.ok(monday.indexOf(panel.value) !== -1, panel.value + ' should be a Monday card in registry.js'));
  assert.deepEqual(mondayPanels.map(panel => panel.title), ['Monday: Build team', 'Monday: Milestones', 'Monday: Progress']);
  teamSpecificPanels.forEach(panel => assert.ok(registered('grid1').indexOf(panel) !== -1, panel + ' should be a large panel'));
});

test('a panel is for one of four kinds of team: none, optional, one, or one or both', () => {
  assert.equal(teamKindOf('photo'), 'none');
  assert.equal(teamKindOf('events'), 'none');
  assert.equal(teamKindOf('forecast'), 'none');
  assert.equal(teamKindOf('tasks'), 'optional');
  assert.equal(teamKindOf('custom'), 'optional');
  assert.equal(teamKindOf('monday-tasks'), 'one');
  assert.equal(teamKindOf('monday-milestones'), 'oneOrBoth');
  assert.equal(teamKindOf('monday-progress'), 'oneOrBoth');
});

test('the team picker of a row offers what its panel allows', () => {
  const teams = [{ code: prime, label: 'Prime' }, { code: nova, label: 'Nova' }];
  assert.deepEqual(teamChoices('photo', teams), []);
  assert.deepEqual(teamChoices('tasks', teams).map(choice => choice.value), ['', prime, nova]);
  assert.deepEqual(teamChoices('monday-tasks', teams).map(choice => choice.value), [prime, nova]);
  assert.deepEqual(teamChoices('monday-milestones', teams).map(choice => choice.value), [prime, nova, 'both']);
  assert.deepEqual(teamChoices('monday-progress', teams).map(choice => choice.label), ['Prime', 'Nova', 'Both teams']);
  assert.equal(teamChoices('tasks', teams)[0].label, 'Keep the team on the screen');
});

test('a Monday row needs a team, Milestones and Progress may be for both, and a panel for both teams has none', () => {
  assert.equal(teamProblem('monday-tasks', ''), 'Pick the team for this Monday row.');
  assert.equal(teamProblem('monday-tasks', undefined), 'Pick the team for this Monday row.');
  assert.equal(teamProblem('monday-tasks', 'both'), 'The Build team card is for one team. Pick a team.');
  assert.equal(teamProblem('monday-tasks', prime), '');
  assert.equal(teamProblem('monday-milestones', ''), 'Pick a team, or Both teams, for this Monday row.');
  assert.equal(teamProblem('monday-milestones', 'both'), '');
  assert.equal(teamProblem('monday-progress', nova), '');
  assert.equal(teamProblem('tasks', ''), '');
  assert.equal(teamProblem('tasks', nova), '');
  assert.equal(teamProblem('tasks', 'both'), 'Both teams is only for Monday rows. Pick a team or clear it.');
  assert.equal(teamProblem('photo', ''), '');
  assert.equal(teamProblem('photo', nova), 'This panel is for both teams. Clear the team.');
  assert.equal(teamProblem('', nova), '');
});

test('the words for a team in a list line', () => {
  assert.equal(teamWord('prime'), 'Prime');
  assert.equal(teamWord('nova'), 'Nova');
  assert.equal(teamWord('both'), 'Both teams');
  assert.equal(teamWord(''), '');
  assert.equal(teamWord(undefined), '');
});

test('the starting values of the seeding are the ones in dashboard/config.js', () => {
  assert.equal(seed.startingMondayStyle, config.defaultSettings.mondayStyle);
  assert.equal(seed.builtInTeam, config.primeTeam.code);
  assert.deepEqual(ids.screenStyles, config.styles);
});

test('the style of a Screen comes from its id, with or without drafts. in front', () => {
  assert.deepEqual(ids.screenStyles, ['original', 'cybertron', 'minimal']);
  ids.screenStyles.forEach(style => {
    assert.equal(ids.screenIdOf(style), 'screen-' + style);
    assert.equal(ids.styleOfScreenId('screen-' + style), style);
    assert.equal(ids.styleOfScreenId('drafts.screen-' + style), style);
  });
  assert.equal(ids.styleOfScreenId('screen-other'), '');
  assert.equal(ids.styleOfScreenId('dashboardSettings'), '');
  assert.equal(ids.styleOfScreenId(undefined), '');
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
