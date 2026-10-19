// Tests for the clock of a block while a competition card is on the large panel. The cards are mixed into the list
// by the page and the clock of the block does not know them, so while one is on screen the clock stands still: the cards
// do not take the seconds of the rows after them (a Team leads page 2 or a Photos row cut short). dashboard/core/views-run.js
// runs for real with the stand-ins of tests/views.test.mjs.
//
//   node tests/card-clock.test.mjs

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
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-card-clock-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js'].forEach(file => copyModule(path.join(dashboardFolder, file), path.join(root, file)));
// The tests of this file are about the lists of the views and the clock of their minutes, which the screen plays only when the
// rotation has no block. The default rotation is turned off in this copy, so those lists are what plays. The default rotation
// is tested in tests/default-rotation.test.mjs.
copyModule(path.join(dashboardFolder, 'config-rotation.js'), path.join(root, 'config-rotation.js'));
fs.writeFileSync(path.join(root, 'config-rotation.js'), fs.readFileSync(path.join(root, 'config-rotation.js'), 'utf8').replace('export function defaultRotationRows() {', 'export function defaultRotationRows() {\n  return [];'));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(root, file));
});

// The parts of the screen that need a page are stand-ins that write down what they were asked
const standIns = {
  'frame.js': ['export const onSecond = listener => { globalThis.viewsWorld.seconds = listener; };'],
  'core/schedule.js': [
    'export const setLookHooks = hooks => { globalThis.viewsWorld.hooks = hooks; };',
    "export const skipRow = () => globalThis.viewsWorld.log.push('skipRow');",
    "export const startListsOver = () => globalThis.viewsWorld.log.push('startListsOver');",
    'export const pauseRotation = () => globalThis.viewsWorld.log.push("pauseRotation");',
    'export const resumeRotation = () => globalThis.viewsWorld.log.push("resumeRotation");',
    "export const moveOn = regions => globalThis.viewsWorld.log.push('moveOn ' + regions.join(' '));",
  ],
  'core/swap-run.js': [
    "export const queueSwap = () => globalThis.viewsWorld.log.push('queueSwap');",
    'export const startSwaps = (busy, scale) => { globalThis.viewsWorld.swapBusy = busy; globalThis.viewsWorld.swapScale = scale; };',
    'export const swapRunning = () => globalThis.viewsWorld.swapping;',
  ],
  'core/team-run.js': ['export const noteWantedTeam = () => {};'],
  'core/takeover.js': ['export const takeoverRunning = () => globalThis.viewsWorld.takeover;'],
  'core/theme-apply.js': ["export const checkTheme = () => globalThis.viewsWorld.log.push('checkTheme');"],
  'core/demo-runner.js': ['export const demoRunning = () => false;'],
  'core/night-screen.js': ['export const nightIsUp = () => false;'],
  'core/hidden-run.js': ['export const hiddenPlaying = () => false;'],
  'core/panels.js': ['export const canShow = (panel, content, page) => globalThis.viewsWorld.canShow(panel, page);'],
};
Object.keys(standIns).forEach(file => fs.writeFileSync(path.join(root, file), standIns[file].join('\n') + '\n'));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const views = await import(base + 'core/views.js');
const viewApply = await import(base + 'core/view-apply.js');
const screens = await import(base + 'core/screens.js');
const sanity = await import(base + 'core/sanity.js');
const contentModule = await import(base + 'core/content.js');
const teamsModule = await import(base + 'core/teams.js');
const weather = await import(base + 'core/weather.js');

const tests = [];
function test(name, body) {
  tests.push({ name: name, run: body });
}

const at = text => new Date(text);
const monday12 = at('2026-10-12T16:00:00Z');

const sampleRaw = () => JSON.parse(readModule(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));

// The sample, cleaned as the screen cleans it, with every day of the week on Original. change is given the raw sample.
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

function setPage(layout) {
  const page = { dataset: { layout: layout, style: layout === 'bar' ? 'minimal' : 'original' }, style: { setProperty: () => {} }, classList: { add: () => {}, remove: () => {} } };
  if (layout === 'bar') page.dataset.shapes = 'minimal';
  globalThis.document = { documentElement: page };
  return page;
}

// Starts the page side of the views over this content and gives back what it hands to the schedule and the swap
async function start(options = {}) {
  const content = options.content || contentWith();
  const world = { log: [], hooks: null, seconds: null, swapBusy: null, swapScale: null, swapping: false, takeover: false, canShow: () => true, content: content };
  globalThis.viewsWorld = world;
  setPage('standard');
  globalThis.window = { localStorage: fakeStorage(), sessionStorage: fakeStorage() };
  views.resetViews();
  screens.holdScreenLook({ team: '', style: '', monday: false });
  teamsModule.rotateTeam('');

  const module = await import(base + 'core/views-run.js?' + Math.random());
  await module.startViews(() => content, options.addressAsks === true);
  return world;
}


function areaShowing(page) {
  return { dataset: { page: page } };
}

async function startWith(page) {
  const world = await start();
  world.shows = page;
  globalThis.document = Object.assign({}, globalThis.document, { querySelector: () => areaShowing(world.shows) });
  views.holdBootView(world.content, new Date());
  world.hooks.begin(views.viewSteps(world.content, 'general', new Date())[0]);
  return world;
}

test('while a competition card is on the large panel the clock of the view counts nothing', async () => {
  const world = await startWith('competition-rank');
  const at = new Date();
  for (let second = 0; second < 100; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  assert.equal(views.cycleSeconds(), 0, 'a card on screen stops the clock');

  world.shows = 'leadership';
  for (let second = 0; second < 100; second += 1) world.seconds(new Date(at.getTime() + second * 1000));
  assert.ok(views.cycleSeconds() >= 99, 'and an ordinary panel lets it run');
});

test('every competition card of the registry stops the clock, and no other panel does', async () => {
  const registry = await import(base + 'registry.js');
  const cards = registry.panels.filter(item => item.competition).map(item => item.id);
  assert.ok(cards.length >= 7);

  for (const id of registry.panels.map(item => item.id)) {
    const world = await startWith(id);
    const before = views.cycleSeconds();
    world.seconds(new Date());
    world.seconds(new Date());
    assert.equal(views.cycleSeconds() === before, cards.includes(id), id);
  }
});

test('the clock does not fail when the page has no large panel yet', async () => {
  const world = await startWith('leadership');
  globalThis.document = { documentElement: globalThis.document.documentElement, querySelector: () => null };
  const before = views.cycleSeconds();
  world.seconds(new Date());
  assert.equal(views.cycleSeconds(), before + 1);
});


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
