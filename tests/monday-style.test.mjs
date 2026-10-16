// Tests for the Monday rows in the Monday style (docs/layouts.md, "The Screens" and "The swap"): a Monday row is in
// the Monday style or it waits, going into the Monday cards and out of them is a swap, and a held look goes on in
// a swap. The choices between rows are in dashboard/core/screens.js and tests/screens.test.mjs. Here the page side of
// them, dashboard/core/screens-run.js, is run for real, with stand-ins for the swap, the schedule and the other parts
// of the screen, and a small page that says which layout it is drawn for. The swap itself is in tests/swap.test.mjs.
//
//   node tests/monday-style.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-monday-style-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js'].forEach(file => fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});

// The parts of the screen that need a page are stand-ins that write down what they were asked
const standIns = {
  'frame.js': ['export const onSecond = listener => { globalThis.mondayWorld.seconds = listener; };'],
  'core/schedule.js': [
    'export const setLookHooks = hooks => { globalThis.mondayWorld.hooks = hooks; };',
    "export const skipRow = () => globalThis.mondayWorld.log.push('skipRow');",
  ],
  'core/swap-run.js': [
    "export const queueSwap = () => globalThis.mondayWorld.log.push('queueSwap');",
    "export const startSwaps = (busy, scale) => { globalThis.mondayWorld.swapBusy = busy; globalThis.mondayWorld.swapScale = scale; };",
    'export const swapRunning = () => globalThis.mondayWorld.swapping;',
  ],
  'core/team-run.js': ['export const noteWantedTeam = () => {};'],
  'core/takeover.js': ['export const takeoverRunning = () => false;'],
  'core/theme-apply.js': ["export const checkTheme = () => globalThis.mondayWorld.log.push('checkTheme');"],
  'core/demo-runner.js': ['export const demoRunning = () => false;'],
  'core/night-screen.js': ['export const nightIsUp = () => false;'],
  'core/hidden-run.js': ['export const hiddenPlaying = () => false;'],
};
Object.keys(standIns).forEach(file => fs.writeFileSync(path.join(root, file), standIns[file].join('\n') + '\n'));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const screens = await import(base + 'core/screens.js');
const layoutModule = await import(base + 'core/layout.js');
const sanity = await import(base + 'core/sanity.js');
const registry = await import(base + 'registry.js');
const teamsModule = await import(base + 'core/teams.js');

const { styleCanGoOn } = screens;

const tests = [];
function test(name, body) {
  tests.push({ name: name, run: body });
}


// The content: the sample, with the Screens it has, every day of the week on Original

// The sample also holds the tasks of the one task board (showOnBoard), which these tests were not written for and which
// tests/monday-panels.test.mjs uses. They run on the tasks that came before.
const sampleRaw = () => {
  const raw = JSON.parse(fs.readFileSync(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));
  raw.tasks = raw.tasks.filter(task => task.showOnBoard === undefined);
  return raw;
};
function contentWith(change) {
  const raw = sampleRaw();
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  Object.keys(raw.settings.screenSchedule).forEach(day => { raw.settings.screenSchedule[day] = 'original'; });
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}

function fakeStorage() {
  const kept = {};
  return {
    kept: kept,
    getItem: name => (name in kept ? kept[name] : null),
    setItem: (name, value) => { kept[name] = String(value); },
    removeItem: name => { delete kept[name]; },
  };
}
const brokenStorage = { getItem: () => { throw new Error('storage is off'); }, setItem: () => { throw new Error('storage is off'); }, removeItem: () => { throw new Error('storage is off'); } };

// A page drawn for a layout: 'standard' for Original and Cybertron, and 'bar' with the corners of Minimal for Minimal
function setPage(drawn) {
  const page = { dataset: {}, style: { setProperty: () => {} }, classList: { add: () => {}, remove: () => {} } };
  if (drawn === 'bar-minimal') {
    page.dataset.layout = 'bar';
    page.dataset.shapes = 'minimal';
    page.dataset.style = 'minimal';
  } else {
    page.dataset.layout = 'standard';
    page.dataset.style = 'original';
  }
  globalThis.document = { documentElement: page };
}

// Starts the page side of the Screens over this content and page, and gives back what it hands to the schedule
async function start(options = {}) {
  const content = options.content || contentWith();
  const world = { log: [], hooks: null, seconds: null, swapBusy: null, swapScale: null, swapping: false };
  globalThis.mondayWorld = world;
  setPage(options.page || 'standard');
  globalThis.window = { localStorage: fakeStorage(), sessionStorage: options.session === undefined ? fakeStorage() : options.session };
  screens.holdScreenLook({ team: '', style: '', monday: false });
  teamsModule.rotateTeam('');

  const file = pathToFileURL(path.join(root, 'core/screens-run.js')).href + '?' + Math.random();
  const module = await import(file);
  await module.startScreens(() => content, options.addressAsks === true);

  world.content = content;
  return world;
}

const step = (panel, team) => ({ panel: panel, show: true, team: team || '' });


// The cards and the style

test('the Monday cards are the six panels of the task board and the four older ones the registry flags, and a team is seeded with three rows', () => {
  const cards = registry.panels.filter(panel => panel.monday).map(panel => panel.id);
  assert.deepEqual(cards, ['monday-tasks', 'monday-done', 'monday-status-depts', 'monday-overall', 'monday-timeline', 'monday-board', 'monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both']);
  assert.deepEqual(config.mondayRows, ['monday-tasks', 'monday-done', 'monday-board']);
  assert.deepEqual(config.mondayOldPanels, cards.slice(6));
  cards.forEach(id => assert.equal(screens.isMondayPanel(id), true, id));
  ['tasks', 'events', 'photo', 'forecast', 'no-such-panel'].forEach(id => assert.equal(screens.isMondayPanel(id), false, id));
});

test('a style of the layout the page has goes on, and a style of another layout goes on only while the page may reload for it', () => {
  assert.equal(styleCanGoOn('standard', 'standard', false), true, 'the same layout needs no reload');
  assert.equal(styleCanGoOn('bar-minimal', 'bar-minimal', false), true);
  assert.equal(styleCanGoOn('standard', 'bar-minimal', true), true, 'another layout, and the page may reload');
  assert.equal(styleCanGoOn('standard', 'bar-minimal', false), false, 'another layout, and it may not: the reload note is there, or cannot be kept');
  assert.equal(styleCanGoOn('bar-minimal', 'standard', false), false);
  assert.equal(styleCanGoOn('bar-minimal', 'standard', undefined), false, 'anything but true is no');
});

test('the Screens hand the schedule three questions, and the swap its length', async () => {
  const world = await start();
  assert.deepEqual(Object.keys(world.hooks).sort(), ['begin', 'fits', 'viewAs']);
  assert.equal(typeof world.swapBusy, 'function');
  assert.equal(world.swapScale(), 1, 'a Screen with the standard 1.25 seconds');

  const slow = await start({ content: contentWith(raw => { raw.screens[0].swapSeconds = 2.5; }) });
  assert.equal(slow.swapScale(), 2);
  const quick = await start({ content: contentWith(raw => { raw.screens[0].swapSeconds = 0.5; }) });
  assert.equal(quick.swapScale(), 0.4);
});

test('when the address asks for a style or a team the Screens hold nothing and ask nothing', async () => {
  const world = await start({ addressAsks: true });
  assert.equal(world.hooks, null);
  assert.equal(world.swapBusy, null);
  assert.deepEqual(world.log, []);
});


// A step is chosen: the look it needs is held

test('a Monday row goes into the Monday style with a swap, the cards between hold one look, and the next row comes out with a swap', async () => {
  const world = await start();

  world.hooks.begin(step('tasks', 'prime'));
  assert.deepEqual(world.log, ['checkTheme'], 'the first row holds its look, and there is nothing to swap from');
  assert.deepEqual(screens.heldLook(), { team: 'prime', style: 'original', monday: false });

  world.log.length = 0;
  world.hooks.begin(step('monday-tasks', 'prime'));
  assert.deepEqual(world.log, ['checkTheme', 'queueSwap'], 'Prime in Minimal: the look is held and the next page change is a swap');
  assert.deepEqual(screens.heldLook(), { team: 'prime', style: 'minimal', monday: true });

  world.log.length = 0;
  world.hooks.begin(step('monday-milestones', 'prime'));
  world.hooks.begin(step('monday-progress', 'prime'));
  assert.deepEqual(world.log, [], 'the cards between are one look');

  world.hooks.begin(step('tasks', 'nova'));
  assert.deepEqual(world.log, ['checkTheme', 'queueSwap'], 'Nova back in the style of the day');
  assert.deepEqual(screens.heldLook(), { team: 'nova', style: 'original', monday: false });
});

test('a Monday row in the style of the day holds no new style and queues no swap: the cards are a swap by themselves in full motion', async () => {
  const world = await start({ content: contentWith(raw => { raw.screens.forEach(screen => { screen.mondayStyle = 'original'; }); }) });

  world.hooks.begin(step('tasks', 'prime'));
  world.log.length = 0;
  world.hooks.begin(step('monday-progress', 'prime'));
  assert.deepEqual(world.log, ['checkTheme'], 'the look is the same, so nothing is queued');
  assert.equal(screens.heldLook().style, 'original');
  assert.equal(screens.heldLook().monday, true, 'but the screen knows it is in the Monday cards');

  world.log.length = 0;
  world.hooks.begin(step('photo'));
  assert.deepEqual(world.log, ['checkTheme'], 'and out again');
  assert.equal(screens.heldLook().monday, false);

  const swap = read('core/swap-run.js');
  assert.ok(swap.includes("if (!looked && (frame.motionNow() !== 'full' || (!isMondayCard(old.id) && !isMondayCard(next.id)))) return null;"), 'a Monday card on either side is a swap in full motion');
});

test('a row with no team, and a row for both teams, keep the team and hold no look when the style is the same', async () => {
  const world = await start();

  world.hooks.begin(step('tasks', 'nova'));
  world.log.length = 0;
  world.hooks.begin(step('photo'));
  world.hooks.begin(step('events'));
  world.hooks.begin({ panel: 'competition-rank', show: true });
  assert.deepEqual(world.log, []);
  assert.equal(screens.heldLook().team, 'nova');

  world.hooks.begin(step('monday-milestones-both', 'both'));
  assert.deepEqual(world.log, ['checkTheme', 'queueSwap'], 'the cards of both teams are in the Monday style');
  assert.deepEqual(screens.heldLook(), { team: 'nova', style: 'minimal', monday: true }, 'in the colors of the team that was on the screen');
});

test('a step is asked about as the team it is drawn for, without that team being held', async () => {
  const world = await start();
  world.hooks.begin(step('tasks', 'prime'));
  teamsModule.useTeams(world.content, new Date());

  const items = [{ team: 'nova' }, { team: 'prime' }, {}];
  const asked = team => world.hooks.viewAs(step('tasks', team), () => items.map(item => teamsModule.showsForTeam(item)));
  assert.deepEqual(asked('nova'), [true, false, true]);
  assert.deepEqual(asked('prime'), [false, true, true]);
  assert.deepEqual(asked(''), [false, true, true], 'a step with no team is asked as the team on the screen');
  assert.deepEqual(asked('both'), [false, true, true]);
  assert.deepEqual(screens.heldLook().team, 'prime');
  assert.equal(teamsModule.wantedTeam().code, 'prime');
});

test('the Screen of the day decides the style of the plain rows, and the Monday style of that Screen the style of the Monday rows', async () => {
  const world = await start({ content: contentWith(raw => {
    Object.keys(raw.settings.screenSchedule).forEach(day => { raw.settings.screenSchedule[day] = 'cybertron'; });
    raw.screens.filter(screen => screen._id === 'screen-cybertron')[0].mondayStyle = 'original';
  }) });

  world.hooks.begin(step('tasks', 'prime'));
  assert.equal(screens.heldLook().style, 'cybertron');
  world.hooks.begin(step('monday-tasks', 'prime'));
  assert.equal(screens.heldLook().style, 'original', 'the Monday style of Cybertron, which is Original');
  world.hooks.begin(step('tasks', 'prime'));
  assert.equal(screens.heldLook().style, 'cybertron');
});


// Monday rows wait when their style cannot go on the page

test('a Monday row waits while the Monday style cannot go on the page, and is back when it can; every other row always fits', async () => {
  const world = await start();
  const fits = id => world.hooks.fits(step(id, 'prime'));
  const noted = fakeStorage();
  noted.setItem(layoutModule.reloadKey, 'bar-minimal');

  ['tasks', 'events', 'photo', 'competition-rank'].forEach(id => assert.equal(fits(id), true, id));
  ['monday-tasks', 'monday-milestones', 'monday-progress', 'monday-milestones-both'].forEach(id => assert.equal(fits(id), true, id + ' fits a page that changes layout as it runs'));

  // a page that changes layout as it runs takes the Monday style whatever the note of a reload says
  for (const session of [noted, brokenStorage, null]) {
    const again = await start({ session: session });
    assert.equal(again.hooks.fits(step('monday-tasks', 'prime')), true);
  }

  // a change of layout fails once: the page then reloads for a layout, and the old rules about the note come back
  const apply = await import(base + 'core/layout-apply.js');
  const html = { dataset: { layout: 'standard' }, style: { setProperty() {}, removeProperty() {} } };
  const quiet = console.error;
  console.error = () => {};
  globalThis.window = { sessionStorage: fakeStorage(), location: { reload() {} } };
  globalThis.document = { documentElement: html, getElementById: () => null };
  try {
    apply.changeLayout({ theme: 'hawktimus', overlay: '', style: 'minimal' }, html);
  } finally {
    console.error = quiet;
  }
  assert.equal(apply.layoutsChangeLive(), false);

  const monday = async options => (await start(options)).hooks.fits(step('monday-tasks', 'prime'));
  assert.equal(await monday({}), true, 'a page that may reload goes into Minimal and out of it');
  assert.equal(await monday({ session: noted }), false, 'a page that reloaded a moment ago for that layout does not reload again, so Minimal does not come');
  assert.equal(await monday({ session: brokenStorage }), false, 'nor does a page that cannot keep the note');
  assert.equal(await monday({ session: null }), false, 'or has no storage');
  assert.equal(await monday({ session: noted, page: 'bar-minimal' }), true, 'a page that is drawn for Minimal already needs no reload, whatever the note says');

  const plain = await start({ session: noted });
  assert.equal(plain.hooks.fits(step('tasks', 'prime')), true, 'and the rows of the style of the day are never asked about');
});


// Next look now

test('Next look now moves the large panel to the next row, once for each click, and holds no look of its own', async () => {
  const world = await start();
  const request = at => { world.content.settings.nextLookRequest = { requestedAt: new Date(at).toISOString() }; };
  world.log.length = 0;

  request(Date.now());
  world.seconds(new Date());
  assert.deepEqual(world.log, ['skipRow']);

  world.seconds(new Date());
  assert.deepEqual(world.log, ['skipRow'], 'the same click is not run twice');

  request(Date.now() + 2000);
  world.seconds(new Date(Date.now() + 2000));
  assert.deepEqual(world.log, ['skipRow', 'skipRow'], 'a new click is a new request');
  assert.deepEqual(screens.heldLook(), { team: '', style: '', monday: false }, 'the look is held when the next row is chosen, not by the press');
});


// The page file

test('the page side names the cards through the screens, asks the layout the way holdForLayout does, and leaves the look to the swap', () => {
  const file = read('core/screens-run.js');

  assert.ok(file.includes("return !isMondayPanel(step.panel) || mondayStyleFits(planFor(getContent(), new Date()).mondayStyle);"));
  assert.ok(file.includes('const wanted = drawnFor(layoutFor(style, layoutOf(theme)), shapesFor(style));'), 'the layout is worked out as layout-apply.js does');
  assert.ok(read('core/layout-apply.js').includes('const wanted = drawnFor(layoutFor(look.style, layoutOf(look.theme)), shapesFor(look.style));'));
  assert.ok(file.includes('window.sessionStorage.getItem(reloadKey) !== wanted'), 'the note of mustReload');
  assert.ok(file.includes("canReload = false; // a note that cannot be kept"), 'and a note that cannot be kept stops the reload');
  assert.ok(file.includes('asTeam(lookOf(step).team, run)'));
  ['applyStyle', 'dataset.style', 'classList', 'setProperty'].forEach(name => assert.ok(!file.includes(name), 'the page side does not touch the page with ' + name));
  assert.equal(config.defaultSettings.mondayStyle, 'minimal');
});

test('the docs say where the Monday cards come and in what style, and the Panel order rows that name them are ignored', () => {
  const layouts = fs.readFileSync(path.join(docsFolder, 'layouts.md'), 'utf8').replace(/\s+/g, ' ');
  ['Monday style', 'Monday rows of a Screen', 'a saved Panel order that still names one is ignored'].forEach(word => assert.ok(layouts.includes(word), 'layouts.md names ' + word));
  assert.ok(fs.readFileSync(path.join(docsFolder, 'switch-the-look.md'), 'utf8').includes('takes the Monday style of the Screen'));
  assert.ok(fs.readFileSync(path.join(docsFolder, 'coaches-guide.md'), 'utf8').includes('Monday style: the style the Screen takes while a Monday row plays'));
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
