// Tests for the row a hold carries (holdRow of Dashboard Settings, docs/control-page.md, "Show a panel"). The wall plays the row the
// control page showed in its picture: the department, the list, the chart and the team of the menus, in the view the row
// names. A hold with no readable row plays the first row of the Rotation that has the panel, as before. core/screen-requests.js,
// core/views-play.js and core/views-run.js, with the stand-ins of tests/views.test.mjs.
//
//   node tests/hold-row.test.mjs

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
const requests = await import(base + 'core/screen-requests.js');
const rowPreview = await import(base + 'core/row-preview.js');
const still = await import(base + 'core/still.js');
const controlPush = await import('../control/support/push.js');
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


const sampleTasks = () => {
  const task = fields => Object.assign({
    title: '[Task]', department: 'build', list: 'open', subteam: '[Build]', subteamId: 'lead-build', status: 'up-next', team: undefined,
    source: 'monday', mondayId: '[item]', showOnBoard: true, showOnTv: true, priority: 'medium', contact: '[Jordan]', startDate: '2026-10-12', dueDate: '2026-10-30',
  }, fields);
  return [
    task({ title: '[build both]' }),
    task({ title: '[build prime]', team: 'prime', status: 'blocked' }),
    task({ title: '[build nova]', team: 'nova', status: 'in-progress' }),
    task({ title: '[build done]', list: 'done', status: 'done', finishedOn: new Date().toISOString() }),
    task({ title: '[business both]', department: 'business', subteam: '[Business]', subteamId: 'lead-business' }),
    task({ title: '[electrical nova]', department: 'electrical', team: 'nova', subteam: '[Electrical]', subteamId: 'lead-electrical' }),
    task({ title: '[cnc nova]', department: 'cnc', team: 'nova', subteam: '[CNC]', subteamId: 'lead-cnc' }),
  ];
};

// The sample content with a known board of tasks, the rotation list the Studio would hold and the hold of the control page
function heldContent(hold, row) {
  return contentWith(raw => {
    raw.tasks = sampleTasks();
    raw.monday = { lastSyncAt: new Date().toISOString(), lastError: '', snapshots: [] };
    raw.settings.mondayEveryMinutes = 30;
    raw.settings.rotationRows = [
      { view: 'robotics', panel: 'leadership', seconds: 20, shown: true },
      { view: 'robotics', panel: 'monday-department', department: 'build', list: 'done', seconds: 30, shown: true },
    ];
    if (hold) raw.settings.holdPanel = { panel: hold, until: new Date(Date.now() + 30 * 60000).toISOString() };
    if (row !== undefined) raw.settings.holdRow = typeof row === 'string' ? row : JSON.stringify(row);
  });
}

// The held steps of a row the way the screen asks for them: the request is acted on, the clock forces the view, the playlist is read
async function heldSteps(hold, row) {
  const world = await start({ content: heldContent(hold, row) });
  views.holdBootView(world.content, new Date());
  const at = new Date();
  world.seconds(at);
  const steps = views.viewPlaylist(world.content, at);
  const result = { world: world, at: at, steps: steps, key: views.cycleKey() };
  views.holdPanelId('');
  views.holdRowOf(null);
  return result;
}

const departmentTasks = { view: 'prime', panel: 'monday-department', department: 'build', list: 'open', team: 'prime' };

test('a held row is read by the cleaner of the Rotation, and what cannot be played is ignored', () => {
  const soon = new Date(Date.now() + 60000).toISOString();
  const settings = (row, panel = 'monday-department') => ({ holdPanel: { panel: panel, until: soon }, holdRow: typeof row === 'string' ? row : JSON.stringify(row) });
  const asked = requests.activeRequests(settings(departmentTasks), new Date());
  assert.equal(asked.holdPanel, 'monday-department');
  assert.deepEqual(asked.heldRow, { view: 'prime', panel: 'monday-department', shown: true, department: 'build', list: 'open', team: 'prime' });
  assert.equal(asked.heldRowView, 'prime');

  const condensed = requests.activeRequests(settings({ view: 'family', panel: 'monday-department', department: 'business' }), new Date());
  assert.equal(condensed.heldRowView, 'family', 'Condensed is kept, though a row of the Rotation cannot name it');
  assert.equal(condensed.heldRow.view, 'robotics');
  assert.equal(requests.activeRequests(settings({ panel: 'monday-department', department: 'build' }), new Date()).heldRowView, '', 'a row with no view names none');

  const ignored = [
    ['not JSON', 'not json'], ['an array', '[1]'], ['a number', '3'], ['a row for another panel', JSON.stringify({ view: 'prime', panel: 'monday-charts' })],
    ['a panel that is unknown', JSON.stringify({ view: 'prime', panel: 'no-such-panel' })], ['a view that is unknown', JSON.stringify({ view: 'sideways', panel: 'monday-department' })],
    ['more than 400 characters', JSON.stringify({ view: 'prime', panel: 'monday-department', department: 'x'.repeat(401) })],
  ];
  ignored.forEach(([name, text]) => {
    const found = requests.activeRequests(settings(text), new Date());
    assert.equal(found.heldRow, null, name);
    assert.equal(found.holdPanel, 'monday-department', name + ': the hold itself stays');
  });

  const over = requests.activeRequests({ holdPanel: { panel: 'monday-department', until: new Date(Date.now() - 1000).toISOString() }, holdRow: JSON.stringify(departmentTasks) }, new Date());
  assert.equal(over.heldRow, null, 'a row is not obeyed once the hold is over');
  assert.equal(over.holdPanel, '');
  assert.equal(requests.activeRequests({ holdRow: JSON.stringify(departmentTasks) }, new Date()).heldRow, null, 'a row with no hold is not obeyed');
});

test('Department tasks for Build, Open, Prime plays that page in the Prime view', async () => {
  const found = await heldSteps('monday-department', departmentTasks);
  assert.equal(found.key, 'prime');
  assert.equal(found.steps.length, 1);
  assert.equal(found.steps[0].panel, 'monday-department');
  assert.deepEqual(found.steps[0].page, { team: 'prime', department: 'build', list: 'open', chart: 'status' });
  assert.equal(found.steps[0].view, 'prime');
  assert.equal(found.steps[0].team, 'prime');

  // the first row of the Rotation with the panel is Build, Done: the menus won over it
  const old = await heldSteps('monday-department');
  assert.equal(old.steps[0].page.list, 'done', 'with no row the first row of the Rotation plays');
});

test('TV charts for one department plays that chart, and Both teams plays it in the Condensed view', async () => {
  const found = await heldSteps('monday-charts', { view: 'robotics', panel: 'monday-charts', chart: 'progress', department: 'electrical', team: 'nova' });
  assert.equal(found.key, 'general');
  assert.equal(found.steps.length, 1);
  assert.deepEqual(found.steps[0].page, { team: 'nova', department: 'electrical', list: 'open', chart: 'progress' });
  assert.equal(found.steps[0].view, 'nova', 'a Robotics Monday row of a team plays in the view of that team');

  const both = await heldSteps('monday-charts', { view: 'robotics', panel: 'monday-charts', chart: 'status', department: 'business' });
  assert.equal(both.steps[0].view, 'family');
  assert.equal(both.steps[0].page.team, '');
  assert.equal(views.layoutOfStep(both.world.content, both.steps[0]), 'bar');
});

test('Condensed Business plays the Business tasks for both teams in the Condensed view', async () => {
  const found = await heldSteps('monday-department', { view: 'family', panel: 'monday-department', department: 'business', list: 'open' });
  assert.equal(found.key, 'family');
  assert.equal(found.steps.length, 1);
  assert.equal(found.steps[0].view, 'family');
  assert.deepEqual(found.steps[0].page, { team: '', department: 'business', list: 'open', chart: 'status' });
  assert.equal(views.layoutOfStep(found.world.content, found.steps[0]), 'bar');
});

test('Subteam roster for Nova Electrical plays that department in the Nova view', async () => {
  const found = await heldSteps('roster', { view: 'robotics', panel: 'roster', team: 'nova', department: 'electrical' });
  assert.equal(found.key, 'general');
  assert.equal(found.steps.length, 1);
  assert.equal(found.steps[0].panel, 'roster');
  assert.equal(found.steps[0].page.team, 'nova');
  assert.equal(found.steps[0].page.department, 'electrical');
  assert.equal(found.steps[0].view, 'nova');
});

test('a Monday panel with no data still gives no step, as it did before a row was held', async () => {
  const none = await heldSteps('monday-department', { view: 'family', panel: 'monday-department', department: 'cnc', list: 'open' });
  assert.deepEqual(none.steps, [], 'the large frame has nothing to show until the hold ends');
  const old = await heldSteps('monday-department');
  assert.ok(old.steps.length >= 1);
});

test('a hold with no row, or a row that cannot be read, plays as the hold of a panel always did', async () => {
  const plain = await heldSteps('monday-department');
  assert.deepEqual(plain.steps.map(step => step.panel), ['monday-department']);
  assert.equal(plain.steps[0].page.department, 'build');

  for (const row of ['', 'not json', JSON.stringify({ view: 'prime', panel: 'monday-charts' })]) {
    const found = await heldSteps('monday-department', row);
    assert.deepEqual(found.steps.map(step => step.page.list), ['done'], JSON.stringify(row));
  }
});

test('a new row for the same panel starts the lists over, and a hold that ends plays the list again', async () => {
  const world = await start({ content: heldContent('monday-department', departmentTasks) });
  views.holdBootView(world.content, new Date());
  const at = new Date();
  world.seconds(at);
  world.log.length = 0;
  world.seconds(at);
  assert.ok(!world.log.includes('startListsOver'), 'the same row is acted on once');

  world.content.settings.holdRow = JSON.stringify(Object.assign({}, departmentTasks, { department: 'electrical', team: 'nova', view: 'nova' }));
  world.seconds(at);
  assert.ok(world.log.includes('startListsOver') && world.log.includes('moveOn grid1'));
  assert.equal(views.viewPlaylist(world.content, at)[0].page.department, 'electrical');

  world.content.settings.holdPanel = { panel: '', until: '' };
  world.content.settings.holdRow = '';
  world.seconds(new Date(at.getTime() + 1000));
  assert.ok(views.viewPlaylist(world.content, at).length >= 1);
  assert.ok(views.viewPlaylist(world.content, at).some(step => step.panel === 'leadership'), 'the schedule plays again');
  views.holdPanelId('');
  views.holdRowOf(null);
});

test('the same row gives the same panel in the row preview and in the held step', async () => {
  const cases = [
    [departmentTasks, 'monday-department'],
    [{ view: 'robotics', panel: 'monday-charts', chart: 'progress', department: 'electrical', team: 'nova' }, 'monday-charts'],
    [{ view: 'family', panel: 'monday-department', department: 'business', list: 'open' }, 'monday-department'],
    [{ view: 'robotics', panel: 'roster', team: 'nova', department: 'electrical' }, 'roster'],
  ];

  for (const [row, panel] of cases) {
    const text = JSON.stringify(row);
    const read = rowPreview.readRowPreview('rowpreview=' + encodeURIComponent(text));
    const params = rowPreview.useRowPreview(new URLSearchParams(), read);
    const ask = still.readStill(params);

    const content = heldContent(panel, row);
    // the page the row preview builds (core/still-run.js, pageFor)
    const drawn = panel === 'roster'
      ? screens.stepsOfRow(screens.tidyMainRow({ panel: 'roster', team: '', tasksTeam: ask.team, department: ask.department, part: ask.part }, false, true), 0, [], content, new Date())[0]
      : screens.stepsOfRow(screens.tidyMainRow(still.stillRow(ask)), 0, [], content, new Date())[0];

    const held = await heldSteps(panel, row);
    assert.equal(held.steps[0].panel, drawn.panel, text);
    assert.deepEqual(held.steps[0].page, drawn.page, text + ': the page');
    assert.equal(held.steps[0].view, ask.view || 'general', text + ': the view');
  }
});

test('the row the control page writes is the row the wall reads', () => {
  const sent = { view: 'prime', panel: 'monday-department', department: 'build', list: 'open', team: 'prime', seconds: 30, junk: 'x', part: 7 };
  const text = controlPush.holdRowText(sent, 'monday-department');
  assert.ok(text.length <= requests.longestHoldRow);
  const read = requests.tidyHoldRow(text, 'monday-department');
  assert.equal(read.view, 'prime');
  assert.equal(read.row.seconds, 30);
  assert.equal(read.row.junk, undefined);
  assert.equal(read.row.part, undefined);
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
