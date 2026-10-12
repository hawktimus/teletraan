// Tests for the Screens (dashboard/core/screens.js): the three documents read, the Screen of each weekday, the rows
// built from the Panel order, the list of the large panel, and the swaps between rows. The modules that hold the style
// and the team (core/style.js and core/teams.js) are run too. Nothing is drawn and no clock runs. The page side
// (core/screens-run.js) is in tools/test-look-rotation.mjs.
//
//   node tools/test-screens.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-screens-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard/themes/overlays'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});
const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const registry = await import(base + 'registry.js');
const screens = await import(base + 'core/screens.js');
const seed = await import(base + 'core/screen-seed.js');
const styleModule = await import(base + 'core/style.js');
const teamsModule = await import(base + 'core/teams.js');
const { normalizeContent, normalizeSample } = await import(base + 'core/sanity.js');
const { withDefaults } = await import(base + 'core/content.js');
const { withPages } = await import(base + 'core/panel-order.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// October 12 2026 is a Monday, and in New York (the time zone of the Look page) it is four hours behind UTC
const mondayNoon = new Date('2026-10-12T16:00:00Z');
const dayAfter = days => new Date(mondayNoon.getTime() + days * 86400 * 1000);

const sampleRaw = () => JSON.parse(fs.readFileSync(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));
function contentWith(change) {
  const raw = sampleRaw();
  if (change) change(raw);
  return normalizeSample(raw);
}

const rowsOf = list => list.map(row => row.panel + (row.team ? ' ' + row.team : '') + (row.seconds ? ' ' + row.seconds + 's' : ''));
const doc = (style, fields) => Object.assign({ _id: 'screen-' + style }, fields);
const prime = { code: 'prime', name: 'HAWKTIMUS PRIME', active: true };
const nova = { code: 'nova', name: 'HAWKTIMUS NOVA', active: true };

// What each test starts from: nothing held, no team asked for
function clean() {
  screens.holdScreenLook({ team: '', style: '', monday: false });
  teamsModule.askForTeam('');
  teamsModule.rotateTeam('');
  styleModule.rotateStyle('');
}


// The documents

test('a Screen is read by its id, and an id that is not one of the three, or comes twice, is left out', () => {
  const found = screens.tidyScreens([
    doc('cybertron', { swapSeconds: 2 }),
    { _id: 'screen-gold' },
    doc('original', {}),
    doc('cybertron', { swapSeconds: 3 }),
    null,
    'text',
    { _id: 'drafts.screen-minimal' },
  ], 'minimal');

  assert.deepEqual(found.map(screen => screen.style), ['cybertron', 'original']);
  assert.equal(found[0].swapSeconds, 2, 'the first document of an id counts');
  assert.deepEqual(screens.tidyScreens(undefined, 'minimal'), []);
  assert.deepEqual(screens.tidyScreens('text', 'minimal'), []);
  assert.deepEqual(config.screenIds, { original: 'screen-original', cybertron: 'screen-cybertron', minimal: 'screen-minimal' });
});

test('a row of the large panel keeps its panel, team and seconds, and a panel that is not a large panel is dropped', () => {
  const screen = screens.tidyScreen({
    mainRows: [
      { _key: 'a', panel: 'tasks', team: 'Prime', seconds: 30 },
      { panel: 'forecast', team: 'prime' },
      { panel: 'banner' },
      { panel: 'no-such-panel' },
      { panel: 'stand-in-tile' },
      { panel: 'events' },
      { panel: 42 },
      null,
      'text',
      { panel: ' photo ' },
    ],
  }, 'original', 'minimal');

  assert.deepEqual(screen.mainRows, [{ panel: 'tasks', team: 'prime', seconds: 30 }, { panel: 'events', team: '' }, { panel: 'photo', team: '' }]);
});

test('a row of the small panel keeps its panel and seconds and never a team, and the last resort is not a row', () => {
  const screen = screens.tidyScreen({
    sideRows: [
      { panel: 'forecast', team: 'nova', seconds: 12 },
      { panel: 'tasks' },
      { panel: 'team-tile' },
      { panel: 'stand-in-tile' },
      { panel: 'task-counts' },
    ],
  }, 'original', 'minimal');

  assert.deepEqual(screen.sideRows, [{ panel: 'forecast', seconds: 12 }, { panel: 'task-counts' }]);
});

test('only a panel that follows the team has a team, and a Monday row needs a team or both', () => {
  const screen = screens.tidyScreen({
    mainRows: [
      { panel: 'tasks', team: 'nova' },
      { panel: 'events', team: 'nova' },
      { panel: 'photo', team: 'both' },
      { panel: 'tonight', team: 'both' },
      { panel: 'monday-tasks', team: 'prime' },
      { panel: 'monday-tasks', team: '' },
      { panel: 'monday-tasks' },
      { panel: 'monday-tasks', team: 'both' },
      { panel: 'monday-milestones', team: 'both' },
      { panel: 'monday-progress', team: 'NOVA' },
      { panel: 'monday-progress' },
      { panel: 'monday-progress-both', team: 'both' },
    ],
  }, 'original', 'minimal');

  assert.deepEqual(rowsOf(screen.mainRows), ['tasks nova', 'events', 'photo', 'tonight', 'monday-tasks prime', 'monday-milestones both', 'monday-progress nova']);
  assert.deepEqual(config.teamPanels, ['tasks', 'tonight', 'spotlight', 'team-leads', 'roster', 'leadership', 'sponsor-feature', 'custom']);
  config.teamPanels.forEach(id => assert.equal(registry.panels.find(panel => panel.id === id).region, 'grid1', id + ' is a large panel'));
});

test('a team code is lowercase letters and digits, and anything else is no team', () => {
  const screen = screens.tidyScreen({ mainRows: [{ panel: 'tasks', team: 'Nova2' }, { panel: 'tonight', team: 'no va' }, { panel: 'leadership', team: 7 }] }, 'original', 'minimal');
  assert.deepEqual(rowsOf(screen.mainRows), ['tasks nova2', 'tonight', 'leadership']);
});

test('seconds are 6 to 120, and a row with seconds that are not a number has none', () => {
  const rows = [3, 6, 20.5, 120, 500, 0, -4, '30', null, NaN].map(seconds => ({ panel: 'photo', seconds: seconds }));
  const found = screens.tidyScreen({ mainRows: rows }, 'original', 'minimal').mainRows.map(row => row.seconds);
  assert.deepEqual(found, [6, 6, 20.5, 120, 120, undefined, undefined, undefined, undefined, undefined]);
});

test('the banner settings and the length of a swap start at 10 minutes, 15 minutes and 1.25 seconds, and stay inside their limits', () => {
  const empty = screens.tidyScreen(null, 'original', 'minimal');
  assert.deepEqual([empty.nameEffectEveryMinutes, empty.hawkEveryMinutes, empty.swapSeconds], [10, 15, 1.25]);
  assert.deepEqual(config.defaultScreen, { nameEffectEveryMinutes: 10, hawkEveryMinutes: 15, swapSeconds: 1.25 });

  const low = screens.tidyScreen({ nameEffectEveryMinutes: 0, hawkEveryMinutes: -3, swapSeconds: 0.1 }, 'original', 'minimal');
  assert.deepEqual([low.nameEffectEveryMinutes, low.hawkEveryMinutes, low.swapSeconds], [1, 1, 0.5]);
  const high = screens.tidyScreen({ nameEffectEveryMinutes: 999, hawkEveryMinutes: 241, swapSeconds: 9 }, 'original', 'minimal');
  assert.deepEqual([high.nameEffectEveryMinutes, high.hawkEveryMinutes, high.swapSeconds], [240, 240, 3]);
  const odd = screens.tidyScreen({ nameEffectEveryMinutes: '5', hawkEveryMinutes: null, swapSeconds: NaN }, 'original', 'minimal');
  assert.deepEqual([odd.nameEffectEveryMinutes, odd.hawkEveryMinutes, odd.swapSeconds], [10, 15, 1.25]);
  const own = screens.tidyScreen({ nameEffectEveryMinutes: 5, hawkEveryMinutes: 30, swapSeconds: 2.5 }, 'original', 'minimal');
  assert.deepEqual([own.nameEffectEveryMinutes, own.hawkEveryMinutes, own.swapSeconds], [5, 30, 2.5]);
});

test('the Monday style of a Screen is its own, then the one of Dashboard Settings, then Minimal', () => {
  assert.equal(screens.tidyScreen({ mondayStyle: 'cybertron' }, 'original', 'original').mondayStyle, 'cybertron');
  assert.equal(screens.tidyScreen({}, 'original', 'original').mondayStyle, 'original');
  assert.equal(screens.tidyScreen({ mondayStyle: 'red' }, 'original', 'cybertron').mondayStyle, 'cybertron');
  assert.equal(screens.tidyScreen({}, 'original', 'red').mondayStyle, 'minimal');
  assert.equal(screens.tidyScreen({}, 'original', undefined).mondayStyle, 'minimal');

  const content = normalizeContent({ settings: { mondayStyle: 'cybertron' }, screens: [doc('original', {}), doc('minimal', { mondayStyle: 'original' })] });
  assert.deepEqual(content.screens.map(screen => screen.mondayStyle), ['cybertron', 'original'], 'a Screen that has not set it takes the setting that was there');
});

test('the content has the Screens that the Studio sent, cleaned the way the sample is', () => {
  const content = normalizeContent({ screens: [doc('minimal', { mainRows: [{ panel: 'photo' }] })] });
  assert.deepEqual(content.screens.map(screen => screen.style), ['minimal']);
  assert.deepEqual(normalizeContent({}).screens, []);
  assert.deepEqual(withDefaults({}).screens, []);

  const sample = normalizeSample(sampleRaw());
  assert.deepEqual(sample.screens.map(screen => screen.style), ['original', 'cybertron', 'minimal']);
  sample.screens.forEach(screen => assert.ok(screen.mainRows.length > 0, screen.style + ' has rows'));
  assert.equal(sample.screens[0].sideRows.length, 4);
  assert.deepEqual(sample.settings.screenSchedule, config.defaultSchedule);
});


// The day

test('the weekday is read in the time zone of the Look page, from midnight to midnight there', () => {
  const zone = 'America/New_York';
  assert.equal(screens.weekdayIn(zone, new Date('2026-10-12T04:00:00Z')), 1, 'midnight in New York on Monday');
  assert.equal(screens.weekdayIn(zone, new Date('2026-10-12T03:59:59Z')), 0, 'a second before it is still Sunday');
  assert.equal(screens.weekdayIn(zone, new Date('2026-10-13T03:59:59Z')), 1, 'and Monday goes on until midnight');
  assert.equal(screens.weekdayIn(zone, new Date('2026-10-13T04:00:00Z')), 2);

  const instant = new Date('2026-10-12T20:00:00Z'); // 4 PM on Monday in New York and 5 AM on Tuesday in Tokyo
  assert.equal(screens.weekdayIn('Asia/Tokyo', instant), 2);
  [undefined, null, '', 'Nowhere/Land', 5].forEach(value => assert.equal(screens.weekdayIn(value, instant), 1, String(value) + ' is the time zone of the Look page default'));
  assert.equal(config.defaultThemeSettings.timeZone, zone);
});

test('the weekday is right on the night the clocks go back and the night they go forward', () => {
  const zone = 'America/New_York';
  assert.equal(screens.weekdayIn(zone, new Date('2026-11-01T12:00:00Z')), 0, 'November 1 is a Sunday');
  assert.equal(screens.weekdayIn(zone, new Date('2026-11-02T04:59:59Z')), 0, 'still Sunday at 11:59 PM in standard time');
  assert.equal(screens.weekdayIn(zone, new Date('2026-11-02T05:00:00Z')), 1);
  assert.equal(screens.weekdayIn(zone, new Date('2026-03-08T12:00:00Z')), 0);
  assert.equal(screens.weekdayIn(zone, new Date('2026-03-09T12:00:00Z')), 1);
});

test('the Screen of a date is the one the schedule gives that weekday: Original on Monday, Wednesday, Friday and Sunday, Cybertron on the others', () => {
  const week = [0, 1, 2, 3, 4, 5, 6].map(days => screens.screenStyleFor(undefined, 'America/New_York', dayAfter(days)));
  assert.deepEqual(week, ['original', 'cybertron', 'original', 'cybertron', 'original', 'cybertron', 'original'], 'Monday to Sunday');
  assert.equal(week.includes('minimal'), false, 'Minimal is not scheduled');
  assert.deepEqual(config.weekdays, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], 'the Studio lists the days from Monday');
  assert.deepEqual(config.defaultSettings.screenSchedule, config.defaultSchedule);
});

test('a schedule from Dashboard Settings is used, and a day that is missing or has a name that is not a style has the starting Screen', () => {
  const schedule = { monday: 'minimal', wednesday: 'cybertron', friday: 'red', tuesday: 7 };
  assert.equal(screens.screenStyleFor(schedule, 'America/New_York', mondayNoon), 'minimal');
  assert.equal(screens.screenStyleFor(schedule, 'America/New_York', dayAfter(1)), 'cybertron', 'Tuesday was not a style');
  assert.equal(screens.screenStyleFor(schedule, 'America/New_York', dayAfter(2)), 'cybertron');
  assert.equal(screens.screenStyleFor(schedule, 'America/New_York', dayAfter(4)), 'original', 'Friday was not a style');
  assert.equal(screens.screenStyleFor(schedule, 'America/New_York', dayAfter(5)), 'cybertron', 'Saturday was not there');

  [undefined, null, 'original', [], 5].forEach(value => assert.deepEqual(screens.tidySchedule(value), config.defaultSchedule, JSON.stringify(value)));
  const tidy = screens.tidySchedule(schedule);
  assert.deepEqual(Object.keys(tidy), config.weekdays.slice(), 'always the seven days');
  assert.deepEqual(withDefaults({ settings: { screenSchedule: { sunday: 'minimal' } } }).settings.screenSchedule, Object.assign({}, config.defaultSchedule, { sunday: 'minimal' }));
});

test('the plan is worked out again at every row, so the first row after midnight plays the Screen of the new day', () => {
  clean();
  const content = contentWith();
  const late = new Date('2026-10-13T03:59:30Z'); // 11:59:30 PM on Monday
  const before = screens.planFor(content, late);
  assert.deepEqual([before.style, before.mondayStyle], ['original', 'minimal']);
  assert.equal(before.screen.style, 'original');

  const after = screens.planFor(content, new Date(late.getTime() + 60 * 1000));
  assert.equal(after.style, 'cybertron');
  assert.equal(after.screen.style, 'cybertron');

  // the same row has the style of the day, and a change of day is a change of style
  const step = { panel: 'tasks', team: 'prime' };
  const held = { team: 'prime', style: 'original', monday: false };
  const look = screens.lookForStep(step, held, after);
  assert.equal(look.style, 'cybertron');
  assert.equal(screens.changesBetween(held, look).swap, true);
});


// The rows built from the Panel order (core/screen-seed.js, tools/test-screen-seed-dashboard.mjs)

const ownersOrder = ['tonight', 'forecast', 'leadership', 'team-leads', 'photo', 'next-event', 'task-counts', 'sponsor-logo', 'task-counts', 'events', 'tasks'].map(panel => ({ panel: panel, show: true }));

test('the rows that Screens build are the ones of the seeding module, and the teams of a screen are the ones that are switched on', () => {
  assert.equal(screens.seedMainRows, seed.seedMainRows);
  assert.equal(screens.seedSideRows, seed.seedSideRows);

  assert.deepEqual(screens.teamsOf({}).map(team => team.code), ['prime']);
  assert.deepEqual(screens.teamsOf(null).map(team => team.code), ['prime']);
  assert.deepEqual(screens.teamsOf({ teams: [] }).map(team => team.code), ['prime']);
  assert.deepEqual(screens.teamsOf({ teams: [Object.assign({}, prime, { active: false }), nova] }).map(team => team.code), ['nova'], 'a team that is switched off has no rows');
  assert.deepEqual(screens.teamsOf({ teams: [Object.assign({}, prime, { active: false })] }).map(team => team.code), ['prime'], 'and with none on there is the built-in one');
  assert.deepEqual(screens.teamsOf({ teams: [nova, prime] }).map(team => team.code), ['nova', 'prime'], 'in the order of the Teams');
  assert.deepEqual(rowsOf(seed.seedMainRows({ order: [{ panel: 'tasks' }] }, screens.teamsOf({ teams: [nova, prime] }))).slice(0, 2), ['tasks nova', 'monday-tasks nova']);
});


// A screen with no Screens

test('with no Screen documents the dashboard plays rows built from the Panel order, and nothing is blank', () => {
  clean();
  const content = contentWith(raw => {
    delete raw.screens;
    raw.settings.rotation = { order: ownersOrder };
  });
  assert.deepEqual(content.screens, []);

  const screen = screens.resolveScreen(content, 'cybertron');
  assert.equal(screen.style, 'cybertron');
  assert.deepEqual(rowsOf(screen.mainRows).slice(0, 4), ['tonight prime', 'leadership prime', 'team-leads prime', 'tasks prime']);
  assert.equal(screen.mainRows.length, 16);
  assert.deepEqual(rowsOf(screen.sideRows), ['forecast', 'next-event', 'task-counts', 'sponsor-logo', 'task-counts']);
  assert.deepEqual([screen.nameEffectEveryMinutes, screen.hawkEveryMinutes, screen.swapSeconds, screen.mondayStyle], [10, 15, 1.25, 'minimal']);

  const playlist = screens.mainPlaylist(content, mondayNoon);
  assert.ok(playlist.length > 10);
  assert.equal(playlist[0].panel, 'tonight');
  assert.ok(screens.sidePlaylist(content, mondayNoon).length === 5);
});

test('a Screen with an empty list of rows is built from the Panel order, each list on its own, and a Screen with rows keeps them', () => {
  clean();
  const content = contentWith(raw => {
    raw.settings.rotation = { order: ownersOrder };
    raw.screens = [
      doc('original', { mainRows: [{ panel: 'photo' }, { panel: 'events' }], sideRows: [] }),
      doc('cybertron', { mainRows: [], sideRows: [{ panel: 'safety-days' }] }),
    ];
  });

  const original = screens.resolveScreen(content, 'original');
  assert.deepEqual(rowsOf(original.mainRows), ['photo', 'events'], 'its own rows');
  assert.deepEqual(rowsOf(original.sideRows), ['forecast', 'next-event', 'task-counts', 'sponsor-logo', 'task-counts'], 'and the small ones it did not have');

  const cybertron = screens.resolveScreen(content, 'cybertron');
  assert.equal(cybertron.mainRows.length, 16);
  assert.deepEqual(rowsOf(cybertron.sideRows), ['safety-days']);
  assert.equal(screens.resolveScreen(content, 'minimal').mainRows.length, 16, 'a Screen that has no document at all');
});

test('content that is not content, or has no settings, still gives a Screen and a look', () => {
  clean();
  [null, undefined, {}, [], 'text', { settings: 7 }, { screens: 'x' }, { teams: 'x', settings: { rotation: 5 } }].forEach(value => {
    const screen = screens.resolveScreen(value, 'original');
    assert.ok(screen.mainRows.length > 0, JSON.stringify(value));
    assert.ok(screens.planFor(value, mondayNoon).style === 'original');
    assert.ok(Array.isArray(screens.mainPlaylist(value, mondayNoon)));
    assert.ok(Array.isArray(screens.sidePlaylist(value, mondayNoon)));
  });
  assert.deepEqual(screens.bootLook(null), { team: '', style: '', monday: false }, 'with no saved copy nothing is held and the settings decide');
  assert.deepEqual(screens.bootLook(undefined), { team: '', style: '', monday: false });
});


// The list of the large panel

test('the steps of the large panel are the rows in order, with the team, the seconds and the number of the row', () => {
  clean();
  const content = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: [{ panel: 'tasks', team: 'prime', seconds: 30 }, { panel: 'events' }, { panel: 'tonight', team: 'nova' }, { panel: 'photo', seconds: 8 }] })];
  });
  const steps = screens.mainPlaylist(content, mondayNoon);

  assert.deepEqual(steps, [
    { panel: 'tasks', show: true, team: 'prime', seconds: 30, row: 0 },
    { panel: 'events', show: true, team: '', row: 1 },
    { panel: 'tonight', show: true, team: 'nova', row: 2 },
    { panel: 'photo', show: true, team: '', seconds: 8, row: 3 },
  ]);
  const pages = withPages(steps);
  assert.deepEqual(pages.map(step => step.panel + (step.page || '')), ['tasks', 'events', 'tonight', 'photo'], 'Events is one row and one step: it scrolls from its first page to its second');
  assert.deepEqual(pages.filter(step => step.panel === 'events').map(step => step.row), [1], 'the step is the one row');
});

test('the Screen on the screen is the one of the style that is held, and the one of the day before anything is held', () => {
  clean();
  const content = contentWith();
  assert.equal(screens.currentScreen(content, mondayNoon).style, 'original', 'Monday');
  assert.equal(screens.currentScreen(content, dayAfter(1)).style, 'cybertron', 'Tuesday');

  screens.holdScreenLook({ team: 'prime', style: 'minimal', monday: true });
  assert.equal(screens.currentScreen(content, mondayNoon).style, 'minimal');
  assert.equal(screens.currentScreen(content, dayAfter(1)).style, 'minimal');
  clean();
});

test('the rows of the large panel are the ones of the Screen of the day, also while another style is held for a Monday row', () => {
  clean();
  const content = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: [{ panel: 'photo' }, { panel: 'events' }] }), doc('minimal', { mainRows: [{ panel: 'tonight', team: 'prime' }] })];
  });

  assert.deepEqual(screens.mainPlaylist(content, mondayNoon).map(step => step.panel), ['photo', 'events']);
  screens.holdScreenLook({ team: 'prime', style: 'minimal', monday: true });
  assert.deepEqual(screens.mainPlaylist(content, mondayNoon).map(step => step.panel), ['photo', 'events'], 'Monday, which is an Original day');
  assert.ok(screens.mainPlaylist(content, dayAfter(1)).length > 2, 'Tuesday is Cybertron, which has no document and is built from the Panel order');
  clean();
});

test('a Monday row has a step for each page of the tasks card, one for each of the other cards, and none for a team with no board tasks', () => {
  clean();
  const content = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: [
      { panel: 'monday-tasks', team: 'prime' }, { panel: 'monday-milestones', team: 'prime', seconds: 20 }, { panel: 'monday-progress', team: 'prime' },
      { panel: 'monday-tasks', team: 'nova' },
    ] })];
    raw.tasks = raw.tasks.filter(task => task.team === 'prime'); // a board task with no team is for both teams
  });
  const steps = screens.mainPlaylist(content, mondayNoon);
  const pagesOfTasks = steps.filter(step => step.panel === 'monday-tasks');

  assert.ok(pagesOfTasks.length >= 2, 'a page for each Team lead entry that has tasks');
  assert.deepEqual(pagesOfTasks.map(step => step.page), pagesOfTasks.map((step, index) => index + 1));
  assert.ok(pagesOfTasks.every(step => step.team === 'prime' && step.row === 0));
  assert.deepEqual(steps.slice(pagesOfTasks.length).map(step => [step.panel, step.team, step.seconds, step.row]), [['monday-milestones', 'prime', 20, 1], ['monday-progress', 'prime', undefined, 2]]);
  assert.equal(steps.some(step => step.team === 'nova'), false, 'Nova has no board tasks, and its row is left out');
});

test('a Monday row for both teams plays the card for both, and only while two teams have board tasks', () => {
  clean();
  const rows = [{ panel: 'monday-milestones', team: 'both' }, { panel: 'monday-progress', team: 'both', seconds: 25 }];
  const content = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: rows })];
  });
  assert.deepEqual(screens.mainPlaylist(content, mondayNoon).map(step => [step.panel, step.team, step.seconds]), [['monday-milestones-both', 'both', undefined], ['monday-progress-both', 'both', 25]]);

  const onlyPrime = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: rows })];
    raw.tasks = raw.tasks.filter(task => task.team === 'prime');
  });
  assert.deepEqual(screens.mainPlaylist(onlyPrime, mondayNoon), [], 'one team alone has its own cards');
});

test('a row for a team that is switched off or is not there is left out, and ?team= leaves out the rows of the other team', () => {
  clean();
  const mainRows = [{ panel: 'tasks', team: 'prime' }, { panel: 'tasks', team: 'nova' }, { panel: 'tonight', team: 'ghost' }, { panel: 'photo' }, { panel: 'monday-milestones', team: 'both' }];
  const content = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: mainRows })];
  });
  const names = steps => steps.map(step => step.panel + (step.team ? ' ' + step.team : ''));

  assert.deepEqual(names(screens.mainPlaylist(content, mondayNoon)), ['tasks prime', 'tasks nova', 'photo', 'monday-milestones-both both']);

  const off = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: mainRows })];
    raw.teams.forEach(team => { if (team.code === 'nova') team.active = false; });
  });
  assert.deepEqual(names(screens.mainPlaylist(off, mondayNoon)), ['tasks prime', 'photo']);

  teamsModule.askForTeam('nova');
  assert.deepEqual(names(screens.mainPlaylist(content, mondayNoon)), ['tasks nova', 'photo', 'monday-milestones-both both']);
  teamsModule.askForTeam('prime');
  assert.deepEqual(names(screens.mainPlaylist(content, mondayNoon)), ['tasks prime', 'photo', 'monday-milestones-both both']);
  teamsModule.askForTeam('alternate');
  assert.equal(screens.mainPlaylist(content, mondayNoon).length, 4, 'Alternate mode leaves out nothing');
  clean();
});

test('the steps of the small panel are the side rows of the Screen on the screen, with no team', () => {
  clean();
  const content = contentWith(raw => {
    raw.screens = [doc('original', { sideRows: [{ panel: 'forecast', seconds: 9 }, { panel: 'task-counts' }] }), doc('cybertron', { sideRows: [{ panel: 'safety-days' }] })];
  });

  assert.deepEqual(screens.sidePlaylist(content, mondayNoon), [{ panel: 'forecast', show: true, seconds: 9 }, { panel: 'task-counts', show: true }]);
  screens.holdScreenLook({ team: 'prime', style: 'cybertron', monday: false });
  assert.deepEqual(screens.sidePlaylist(content, mondayNoon), [{ panel: 'safety-days', show: true }]);
  clean();
});


// The swaps

const plain = (panel, team) => ({ panel: panel, show: true, team: team || '' });
const originalDay = { style: 'original', mondayStyle: 'minimal' };
const startOfDay = { team: 'prime', style: 'original', monday: false };

// The numbers of the rows, counting from 1, where the screen swaps
function swapsOf(steps, plan, start, laps) {
  const found = [];
  let from = start;

  for (let lap = 0; lap < laps; lap++) {
    screens.walkSteps(steps, plan, from).forEach((entry, index) => {
      if (entry.changes.swap) found.push(lap * steps.length + index + 1);
      from = entry.look;
    });
  }
  return found;
}

test('a list of Prime, Prime, no team, Nova, a Monday row of Nova, Prime swaps at rows 4, 5 and 6, and at the same rows when it loops', () => {
  const list = [plain('tasks', 'prime'), plain('tonight', 'prime'), plain('photo'), plain('tasks', 'nova'), plain('monday-milestones', 'nova'), plain('leadership', 'prime')];

  assert.deepEqual(swapsOf(list, originalDay, startOfDay, 1), [4, 5, 6]);
  assert.deepEqual(swapsOf(list, originalDay, startOfDay, 2), [4, 5, 6, 10, 11, 12], 'the loop goes from Prime to Prime, so the first row has no swap');
  assert.deepEqual(swapsOf(list, originalDay, startOfDay, 3), [4, 5, 6, 10, 11, 12, 16, 17, 18]);

  const walk = screens.walkSteps(list, originalDay, startOfDay);
  assert.deepEqual(walk.map(entry => entry.look.team), ['prime', 'prime', 'prime', 'nova', 'nova', 'prime']);
  assert.deepEqual(walk.map(entry => entry.look.style), ['original', 'original', 'original', 'original', 'minimal', 'original']);
  assert.deepEqual(walk.map(entry => entry.look.monday), [false, false, false, false, true, false]);
  assert.deepEqual(walk.map(entry => entry.changes.team), [false, false, false, true, false, true]);
  assert.deepEqual(walk.map(entry => entry.changes.style), [false, false, false, false, true, true]);
});

test('a list that ends in the other team swaps at the loop, and a list of one team never swaps', () => {
  const ends = [plain('tasks', 'prime'), plain('tasks', 'nova')];
  assert.deepEqual(swapsOf(ends, originalDay, startOfDay, 3), [2, 3, 4, 5, 6], 'every row changes the team, the loop too');

  const alone = [plain('tasks', 'prime'), plain('photo'), plain('tonight', 'prime'), plain('events')];
  assert.deepEqual(swapsOf(alone, originalDay, startOfDay, 3), []);
  assert.deepEqual(swapsOf([], originalDay, startOfDay, 3), []);
});

test('a Monday row is in the Monday style going in, and the Screen of the day coming out, and the cards between are one look', () => {
  const list = [plain('tasks', 'prime'), plain('monday-tasks', 'prime'), plain('monday-milestones', 'prime'), plain('monday-progress', 'prime'), plain('events')];
  const walk = screens.walkSteps(list, originalDay, startOfDay);

  assert.deepEqual(walk.map(entry => entry.look.style), ['original', 'minimal', 'minimal', 'minimal', 'original']);
  assert.deepEqual(walk.map(entry => entry.changes.swap), [false, true, false, false, true], 'in at the first card, out at the next row; the cards between them hold one look');

  const cybertronDay = { style: 'cybertron', mondayStyle: 'original' };
  const other = screens.walkSteps(list, cybertronDay, { team: 'prime', style: 'cybertron', monday: false });
  assert.deepEqual(other.map(entry => entry.look.style), ['cybertron', 'original', 'original', 'original', 'cybertron'], 'the Monday style of the Screen, and the style of the day coming out');
});

test('a Monday style that is the style of the day changes no style going in and coming out, and the Monday cards are noted for the swap of full motion', () => {
  const list = [plain('tasks', 'prime'), plain('monday-progress', 'prime'), plain('photo')];
  const walk = screens.walkSteps(list, { style: 'original', mondayStyle: 'original' }, startOfDay);

  assert.deepEqual(walk.map(entry => entry.changes.swap), [false, false, false], 'no style and no team changes');
  assert.deepEqual(walk.map(entry => entry.changes.style), [false, false, false]);
  assert.deepEqual(walk.map(entry => entry.changes.monday), [false, true, true], 'but the screen goes into the Monday cards and out of them');
});

test('a row with no team keeps the team, also after a Monday row, and a row for both teams keeps it too', () => {
  const list = [plain('tasks', 'nova'), plain('photo'), plain('monday-milestones', 'both'), plain('events'), plain('monday-progress', 'nova'), plain('photo')];
  const walk = screens.walkSteps(list, originalDay, { team: 'prime', style: 'original', monday: false });

  assert.deepEqual(walk.map(entry => entry.look.team), ['nova', 'nova', 'nova', 'nova', 'nova', 'nova']);
  assert.deepEqual(walk.map(entry => entry.changes.swap), [true, false, true, true, true, true], 'the team changes once; every Monday card is a swap in and the row after it a swap out');
  assert.deepEqual(walk.map(entry => entry.look.style), ['original', 'original', 'minimal', 'original', 'minimal', 'original']);
  assert.equal(screens.isTeamCode('both'), false);
  assert.equal(screens.isTeamCode(''), false);
  assert.equal(screens.isTeamCode(undefined), false);
  assert.equal(screens.isTeamCode('nova'), true);

  // the competition cards are mixed in with no team at all
  const mixed = screens.walkSteps([{ panel: 'competition-rank', show: true }], originalDay, { team: 'nova', style: 'original', monday: false });
  assert.deepEqual([mixed[0].look.team, mixed[0].changes.swap], ['nova', false]);
});

test('a screen that holds nothing yet has nothing to swap from', () => {
  const change = screens.changesBetween({ team: '', style: '', monday: false }, { team: 'prime', style: 'original', monday: false });
  assert.deepEqual([change.team, change.style, change.swap], [true, true, false]);
  assert.equal(screens.changesBetween({ team: 'prime', style: 'original', monday: false }, { team: 'prime', style: 'original', monday: false }).swap, false);
});

test('the steps of the real sample rows swap only where the team or the Monday cards change', () => {
  clean();
  const content = contentWith();
  const plan = screens.planFor(content, mondayNoon);
  const steps = screens.mainPlaylist(content, mondayNoon, plan.screen);
  const walk = screens.walkSteps(steps, plan, screens.bootLook(content, mondayNoon));

  const swaps = walk.filter(entry => entry.changes.swap).map(entry => entry.panel);
  assert.ok(swaps.includes('monday-tasks'), 'into the Monday cards');
  assert.ok(swaps.includes('tasks'), 'and out of them, into the next team');
  assert.equal(walk[0].changes.swap, false, 'the first row is where the screen starts');
  walk.filter(entry => entry.look.monday).forEach(entry => assert.equal(entry.look.style, 'minimal'));
  walk.filter(entry => !entry.look.monday).forEach(entry => assert.equal(entry.look.style, 'original'));
});


// Holding, and the start

test('a look is held the way a preview holds one, through the style and the team modules, and the style that is held is told once', () => {
  clean();
  const told = [];
  screens.onScreenChange(() => told.push(screens.heldLook().style));

  screens.holdScreenLook({ team: 'nova', style: 'cybertron', monday: false });
  assert.equal(styleModule.chooseStyle('original', null), 'cybertron');
  assert.deepEqual(screens.heldLook(), { team: 'nova', style: 'cybertron', monday: false });
  teamsModule.useTeams({ teams: [prime, nova], settings: { teamMode: 'prime' } }, new Date());
  assert.equal(teamsModule.wantedTeam().code, 'nova');

  screens.holdScreenLook({ team: 'prime', style: 'cybertron', monday: false });
  screens.holdScreenLook({ team: 'prime', style: 'minimal', monday: true });
  assert.deepEqual(told, ['cybertron', 'minimal'], 'a team alone does not tell; a new style does');
  assert.equal(styleModule.chooseStyle('original', 'original'), 'original', 'the address wins');

  clean();
  assert.equal(styleModule.chooseStyle('original', null), 'original');
  assert.equal(told.length, 3, 'letting go is a change of style');
});

test('the screen starts in the Screen of the day, with the team of the first row, or the first team when no row has one', () => {
  clean();
  const content = contentWith();
  assert.deepEqual(screens.bootLook(content, mondayNoon), { team: 'prime', style: 'original', monday: false });
  assert.deepEqual(screens.bootLook(content, dayAfter(1)), { team: 'prime', style: 'cybertron', monday: false }, 'Tuesday');

  const novaFirst = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: [{ panel: 'photo' }, { panel: 'tasks', team: 'nova' }, { panel: 'tasks', team: 'prime' }] })];
  });
  assert.equal(screens.bootLook(novaFirst, mondayNoon).team, 'nova', 'a row with no team first: the team of the first row that has one');

  const noTeams = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: [{ panel: 'photo' }, { panel: 'events' }] })];
  });
  assert.equal(screens.bootLook(noTeams, mondayNoon).team, 'prime');
  const novaOnly = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: [{ panel: 'photo' }] })];
    raw.teams = raw.teams.filter(team => team.code === 'nova');
  });
  assert.equal(screens.bootLook(novaOnly, mondayNoon).team, 'nova', 'the first team that is switched on');

  const mondayFirst = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: [{ panel: 'monday-tasks', team: 'nova' }, { panel: 'tasks', team: 'nova' }], mondayStyle: 'cybertron' })];
  });
  assert.deepEqual(screens.bootLook(mondayFirst, mondayNoon), { team: 'nova', style: 'cybertron', monday: true }, 'a first row that is a Monday row starts in the Monday style');

  const empty = contentWith(raw => {
    raw.screens = [doc('original', { mainRows: [{ panel: 'monday-tasks', team: 'nova' }], sideRows: [] })];
    raw.tasks = [];
  });
  assert.deepEqual(screens.bootLook(empty, mondayNoon), { team: 'prime', style: 'original', monday: false }, 'no row to play: the style of the day and the first team');
});

test('holdBootScreen holds the look the screen starts with and returns it', () => {
  clean();
  const content = contentWith();
  const look = screens.holdBootScreen(content, dayAfter(1));

  assert.deepEqual(look, { team: 'prime', style: 'cybertron', monday: false });
  assert.deepEqual(screens.heldLook(), look);
  assert.equal(styleModule.chooseStyle('original', null), 'cybertron');
  assert.deepEqual(screens.holdBootScreen(null, mondayNoon), { team: '', style: '', monday: false });
  assert.equal(styleModule.chooseStyle('minimal', null), 'minimal', 'nothing held: the setting decides');
  clean();
});

test('a team can be asked about without being held, and nothing is told', () => {
  clean();
  const content = { teams: [prime, nova], settings: { teamMode: 'prime' } };
  const items = [{ team: 'nova' }, { team: 'prime' }, {}];
  teamsModule.useTeams(content, new Date());

  const names = () => items.map(item => teamsModule.showsForTeam(item));
  assert.deepEqual(names(), [false, true, true], 'Prime is on the screen');
  assert.deepEqual(teamsModule.asTeam('nova', names), [true, false, true]);
  assert.deepEqual(names(), [false, true, true], 'and it is as it was');
  assert.deepEqual(teamsModule.asTeam('', names), [false, true, true], 'an empty code asks about the team now');
  assert.throws(() => teamsModule.asTeam('nova', () => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(names(), [false, true, true], 'also after a question that failed');
  assert.equal(teamsModule.wantedTeam().code, 'prime');
});


// What follows the Screen

test('the effects follow the minutes of the Screen, and a swap is as long as the Screen says', () => {
  const screen = screens.tidyScreen({ nameEffectEveryMinutes: 4, hawkEveryMinutes: 20, swapSeconds: 2.5 }, 'original', 'minimal');
  assert.deepEqual(screens.cadenceOf(screen), { nameEverySeconds: 240, hawkEverySeconds: 1200 });
  assert.deepEqual(screens.cadenceOf(screens.tidyScreen(null, 'original', 'minimal')), { nameEverySeconds: 600, hawkEverySeconds: 900 });

  assert.equal(screens.swapScaleOf(screen), 2);
  assert.equal(screens.swapScaleOf(screens.tidyScreen(null, 'original', 'minimal')), 1, '1.25 seconds is the swap as it was built');
  assert.equal(screens.swapScaleOf(screens.tidyScreen({ swapSeconds: 0.5 }, 'original', 'minimal')), 0.4);
  assert.equal(screens.swapScaleOf(screens.tidyScreen({ swapSeconds: 3 }, 'original', 'minimal')), 2.4);
  assert.equal(config.standardSwapSeconds, 1.25);
});

test('the sample teams draw the name solid, and the switch Outlined name is what outlines it', () => {
  const solid = normalizeContent({ teams: [{ code: 'prime', name: 'Prime' }, { code: 'nova', name: 'Nova', outlinedName: false, nameStyle: 'outline' }] }).teams;
  assert.deepEqual(solid.map(team => team.nameStyle), ['solid', 'solid'], 'the stored name look is not read');

  const outlined = normalizeContent({ teams: [{ code: 'nova', name: 'Nova', outlinedName: true, nameStyle: 'solid' }, { code: 'prime', name: 'Prime', outlinedName: 'yes' }] }).teams;
  assert.deepEqual(outlined.map(team => team.nameStyle), ['outline', 'solid'], 'only true outlines it');
  assert.deepEqual(teamsModule.trimClassesOf(outlined[0]), ['name-outline']);
  assert.deepEqual(teamsModule.trimClassesOf(outlined[1]), []);

  const sample = normalizeSample(sampleRaw());
  assert.deepEqual(sample.teams.map(team => team.nameStyle), ['solid', 'solid']);
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
process.exit(failures === 0 ? 0 : 1);
