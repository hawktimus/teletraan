// Tests for a panel the control page holds that has no row in the rotation list (Daily Agenda, Tasks, an Extra panel).
// The large panel plays it anyway, in the view that is on the screen, and does not stay empty for the whole hold.
// A panel that has a row still plays that row, and no hold plays the list. core/views-play.js, with the stand-ins of
// tests/views.test.mjs.
//
//   node tests/hold-absent-panel.test.mjs

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
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-hold-absent-'));
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


test('a held panel that has no row in the list is played in the view on the screen', async () => {
  const world = await start();
  views.holdBootView(world.content, new Date());
  const registry = await import(base + 'registry.js');
  const rows = views.viewPlaylist(world.content, new Date()).map(step => step.panel);
  const absent = registry.panels.find(item => item.region === 'grid1' && !item.testOnly && !item.monday && !item.competition && !rows.includes(item.id) && ['tasks', 'tonight', 'photo', 'sponsor-feature', 'leadership', 'spotlight'].includes(item.id));
  assert.ok(absent, 'a panel of the large frame that the list does not play');

  views.holdPanelId(absent.id);
  const held = views.viewPlaylist(world.content, new Date());
  assert.deepEqual(held.map(step => step.panel), [absent.id], 'only the held panel plays');
  assert.equal(held[0].view, views.cycleKey());
  views.holdPanelId('');
});

test('a held panel that has a row plays that row, and a hold that is let go plays the list again', async () => {
  const world = await start();
  views.holdBootView(world.content, new Date());
  const before = views.viewPlaylist(world.content, new Date());
  const some = before[0].panel;

  views.holdPanelId(some);
  const held = views.viewPlaylist(world.content, new Date());
  assert.ok(held.length >= 1 && held.every(step => step.panel === some));

  views.holdPanelId('');
  assert.deepEqual(views.viewPlaylist(world.content, new Date()).map(step => step.panel), before.map(step => step.panel));
});

test('a name that is no panel of the large frame plays nothing, and does not throw', async () => {
  const world = await start();
  views.holdBootView(world.content, new Date());
  ['nothing-like-it', 'forecast', ''].forEach(id => {
    views.holdPanelId(id);
    const played = views.viewPlaylist(world.content, new Date());
    if (id === '') assert.ok(played.length > 0);
    else assert.deepEqual(played, [], id);
  });
  views.holdPanelId('');
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
