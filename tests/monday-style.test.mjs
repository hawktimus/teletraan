// Tests for the Monday rows in the Monday style (docs/views.md and docs/layouts.md, "The swap"): a Monday row is in
// the Monday style or it waits, going into the Monday cards and out of them is a swap, and a held look goes on in
// a swap. The choices between rows are in dashboard/core/screens.js and tests/screens.test.mjs. Here the page side of
// them, dashboard/core/views-run.js, is run for real, with stand-ins for the swap, the schedule and the other parts
// of the screen, and a small page that says which layout it is drawn for. The swap itself is in tests/swap.test.mjs.
//
//   node tests/monday-style.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { readModule } from './helpers/read-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));
const read = file => readModule(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-monday-style-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js'].forEach(file => copyModule(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(root, file));
});

// The parts of the screen that need a page are stand-ins that write down what they were asked
const standIns = {
  'frame.js': ['export const onSecond = listener => { globalThis.mondayWorld.seconds = listener; };'],
  'core/schedule.js': [
    'export const setLookHooks = hooks => { globalThis.mondayWorld.hooks = hooks; };',
    "export const skipRow = () => globalThis.mondayWorld.log.push('skipRow');",
    'export const pauseRotation = () => {};',
    'export const resumeRotation = () => {};',
    "export const startListsOver = () => globalThis.mondayWorld.log.push('startListsOver');",
    "export const moveOn = regions => globalThis.mondayWorld.log.push('moveOn ' + regions.join(' '));",
  ],
  'core/panels.js': ['export const canShow = () => true;'],
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
const views = await import(base + 'core/views.js');

const { styleCanGoOn } = screens;

const tests = [];
function test(name, body) {
  tests.push({ name: name, run: body });
}


// The content: the sample, with the Screens it has, every day of the week on Original

// The sample also holds the tasks of the one task board (showOnBoard), which these tests were not written for and which
// tests/monday-panels.test.mjs uses. They run on the tasks that came before.
const sampleRaw = () => {
  const raw = JSON.parse(readModule(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));
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
  views.resetViews();
  screens.holdScreenLook({ team: '', style: '', monday: false });
  teamsModule.rotateTeam('');

  const file = pathToFileURL(path.join(root, 'core/views-run.js')).href + '?' + Math.random();
  const module = await import(file);
  await module.startViews(() => content, options.addressAsks === true);

  world.content = content;
  return world;
}

const step = (panel, team, view) => ({ panel: panel, show: true, team: team || '', view: view || 'general' });


// The cards and the style

test('the Monday cards are the six panels of the task board and the four older ones the registry flags, and a team is seeded with three rows', () => {
  const cards = registry.panels.filter(panel => panel.monday).map(panel => panel.id);
  assert.deepEqual(cards, ['monday-tasks', 'monday-done', 'monday-status-depts', 'monday-overall', 'monday-timeline', 'monday-board', 'monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both', 'monday-pie']);
  assert.deepEqual(config.mondayRows, ['monday-tasks', 'monday-done', 'monday-board']);
  assert.deepEqual(config.mondayOldPanels, cards.slice(6, 10));
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

test('a step of a bar view is in the theme of the day with a swap into the view, the cards between hold one look, and the next view comes out with a swap', async () => {
  const world = await start();

  world.hooks.begin(step('tasks', '', 'general'));
  assert.deepEqual(world.log, ['checkTheme'], 'the first step holds its look, and there is nothing to swap from');
  assert.deepEqual(screens.heldLook(), { team: '', style: 'original', monday: false });

  world.log.length = 0;
  world.hooks.begin(step('monday-tasks', 'prime', 'prime'));
  assert.deepEqual(world.log, ['checkTheme', 'queueSwap'], 'Prime in the bar layout: the look is held and the next page change is a swap');
  assert.deepEqual(screens.heldLook(), { team: 'prime', style: 'original', monday: true });

  world.log.length = 0;
  world.hooks.begin(step('monday-done', 'prime', 'prime'));
  world.hooks.begin(step('monday-board', 'prime', 'prime'));
  assert.deepEqual(world.log, [], 'the cards between are one look');

  world.hooks.begin(step('tasks', '', 'general'));
  assert.deepEqual(world.log, ['checkTheme', 'queueSwap'], 'General back in the standard layout and the style of the day');
  assert.deepEqual(screens.heldLook(), { team: '', style: 'original', monday: false });
});

test('a Monday card in the General view is never in the bar style: the standard layout keeps the style of the day, and a Monday style of the standard layout is kept', async () => {
  const world = await start();
  world.hooks.begin(step('tasks'));
  world.log.length = 0;
  world.hooks.begin(step('monday-overall'));
  assert.deepEqual(world.log, ['checkTheme', 'queueSwap'], 'the style is the same, but Robotics draws this card in the wide layout and the tasks in the split one, so the change of layout is a swap');
  assert.equal(screens.heldLook().style, 'original');
  assert.equal(screens.heldLook().monday, true, 'but the screen knows it is in the Monday cards');

  const same = await start({ content: contentWith(raw => { raw.screens.forEach(screen => { screen.mondayStyle = 'cybertron'; }); }) });
  same.hooks.begin(step('tasks'));
  same.hooks.begin(step('monday-overall'));
  assert.equal(screens.heldLook().style, 'original', 'Robotics draws its Monday cards in the wide layout, which is the bar layout in the style of the day');

  world.log.length = 0;
  world.hooks.begin(step('photo'));
  assert.equal(screens.heldLook().monday, false, 'and out again');

  const swap = read('core/swap-run.js');
  assert.ok(swap.includes("if (!looked && (frame.motionNow() !== 'full' || (!isMondayCard(old.id) && !isMondayCard(next.id)))) return null;"), 'a Monday card on either side is a swap in full motion');
});

test('a step that comes from outside the views, a competition card, plays in the view on the screen and in its team', async () => {
  const world = await start();

  world.hooks.begin(step('monday-tasks', 'nova', 'nova'));
  world.log.length = 0;
  world.hooks.begin({ panel: 'competition-rank', show: true });
  assert.deepEqual(world.log, ['checkTheme'], 'the Monday cards end, and no swap is queued');
  assert.deepEqual(screens.heldLook(), { team: 'nova', style: 'original', monday: false }, 'in the team and the style of the view');
});

test('a step is asked about as the team it is drawn for, without that team being held', async () => {
  const world = await start();
  world.hooks.begin(step('monday-tasks', 'prime', 'prime'));
  teamsModule.useTeams(world.content, new Date());

  const items = [{ team: 'nova' }, { team: 'prime' }, {}];
  const asked = (team, view) => world.hooks.viewAs(step('tasks', team, view), () => items.map(item => teamsModule.showsForTeam(item)));
  assert.deepEqual(asked('nova', 'nova'), [true, false, true]);
  assert.deepEqual(asked('prime', 'prime'), [false, true, true]);
  assert.deepEqual(asked('', 'general'), [false, true, true], 'a step with no team is asked as the team on the screen');
  assert.deepEqual(screens.heldLook().team, 'prime');
  assert.equal(teamsModule.wantedTeam().code, 'prime');
});

test('the theme of the weekday decides the style of the standard view', async () => {
  const world = await start({ content: contentWith(raw => {
    raw.settings.themeByWeekday = {};
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => { raw.settings.themeByWeekday[day] = 'cybertron'; });
  }) });

  world.hooks.begin(step('tasks'));
  assert.equal(screens.heldLook().style, 'cybertron');
  world.hooks.begin(step('monday-tasks', 'prime', 'prime'));
  assert.equal(screens.heldLook().style, 'cybertron', 'a bar view is the theme of the day, in the bar layout');
  world.hooks.begin(step('tasks'));
  assert.equal(screens.heldLook().style, 'cybertron');
});


// A step waits when its style cannot go on the page

test('a step waits while its style cannot go on the page, and is back when it can', async () => {
  const world = await start();
  const fits = (id, view) => world.hooks.fits(step(id, view === 'prime' ? 'prime' : '', view));
  const noted = fakeStorage();
  noted.setItem(layoutModule.reloadKey, 'bar-minimal');

  ['tasks', 'events', 'photo', 'competition-rank'].forEach(id => assert.equal(fits(id, 'general'), true, id));
  ['monday-tasks', 'monday-done', 'monday-board'].forEach(id => assert.equal(fits(id, 'prime'), true, id + ' fits a page that changes layout as it runs'));

  for (const session of [noted, brokenStorage, null]) {
    const again = await start({ session: session });
    assert.equal(again.hooks.fits(step('monday-tasks', 'prime', 'prime')), true);
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

  const bar = async options => (await start(options)).hooks.fits(step('monday-tasks', 'prime', 'prime'));
  assert.equal(await bar({}), true, 'a page that may reload goes into the bar layout and out of it');
  assert.equal(await bar({ session: noted }), false, 'a page that reloaded a moment ago for that layout does not reload again, so the bar layout does not come');
  assert.equal(await bar({ session: brokenStorage }), false, 'nor does a page that cannot keep the note');
  assert.equal(await bar({ session: null }), false, 'or has no storage');
  assert.equal(await bar({ session: noted, page: 'bar-minimal' }), true, 'a page that is drawn for the bar layout already needs no reload, whatever the note says');

  const plain = await start({ session: noted });
  assert.equal(plain.hooks.fits(step('tasks')), true, 'and the steps of the standard layout fit a standard page');
});


// Next look now

test('Next look now moves the large panel to the next row, once for each click, and holds no look of its own', async () => {
  const world = await start();
  world.seconds(new Date()); // the clock takes its first view
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
  const file = read('core/views-run.js');

  assert.ok(file.includes("return styleFits(lookOf(step).style, layoutOfStep(getContent(), placed(step)));"));
  assert.ok(file.includes('const wanted = drawnFor(wantedLayout, shapesFor(style, wantedLayout));'), 'the layout is worked out as layout-apply.js does');
  assert.ok(read('core/layout-apply.js').includes('const wanted = drawnFor(wantedLayout, shapesFor(look.style, wantedLayout));'));
  assert.ok(file.includes('window.sessionStorage.getItem(reloadKey) !== wanted'), 'the note of mustReload');
  assert.ok(file.includes("canReload = false; // a note that cannot be kept"), 'and a note that cannot be kept stops the reload');
  assert.ok(file.includes('asTeam(lookOf(step).team, run)'));
  ['applyStyle', 'dataset.style', 'classList', 'setProperty'].forEach(name => assert.ok(!file.includes(name), 'the page side does not touch the page with ' + name));
  assert.equal(config.defaultSettings.mondayStyle, 'minimal');
});

test('the docs say where the Monday cards come and in what style, and the Panel order rows that name them are ignored', () => {
  const layouts = fs.readFileSync(path.join(docsFolder, 'layouts.md'), 'utf8').replace(/\s+/g, ' ');
  ['Monday style', 'Monday rows of a view', 'a saved Panel order that still names one is ignored'].forEach(word => assert.ok(layouts.includes(word), 'layouts.md names ' + word));
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
