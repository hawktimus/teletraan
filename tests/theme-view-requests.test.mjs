// A theme or a view asked for from the control page or from the Studio menu (previewTheme, showView) must really
// reach the wall: the look the screen chooses, while the rotation plays and when it ends. views-run.js runs for
// real with the rotation list on (the default rotation), with stand-ins for the swap, the schedule and the page.
//
//   node tests/theme-view-requests.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { readModule } from './helpers/read-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-requests-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'config-rotation.js', 'registry.js'].forEach(file => copyModule(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(root, file));
});

const standIns = {
  'frame.js': ['export const onSecond = listener => { globalThis.requestWorld.seconds = listener; };'],
  'core/schedule.js': [
    'export const setLookHooks = hooks => { globalThis.requestWorld.hooks = hooks; };',
    "export const skipRow = () => globalThis.requestWorld.log.push('skipRow');",
    "export const startListsOver = () => globalThis.requestWorld.log.push('startListsOver');",
    'export const pauseRotation = () => globalThis.requestWorld.log.push("pauseRotation");',
    'export const resumeRotation = () => globalThis.requestWorld.log.push("resumeRotation");',
    "export const moveOn = regions => globalThis.requestWorld.log.push('moveOn ' + regions.join(' '));",
  ],
  'core/swap-run.js': [
    "export const queueSwap = () => globalThis.requestWorld.log.push('queueSwap');",
    'export const startSwaps = () => {};',
    'export const swapRunning = () => false;',
  ],
  'core/team-run.js': ['export const noteWantedTeam = () => {};'],
  'core/takeover.js': ['export const takeoverRunning = () => false;'],
  'core/theme-apply.js': ["export const checkTheme = () => globalThis.requestWorld.log.push('checkTheme');"],
  'core/demo-runner.js': ['export const demoRunning = () => false;'],
  'core/night-screen.js': ['export const nightIsUp = () => false;'],
  'core/hidden-run.js': ['export const hiddenPlaying = () => false;'],
  'core/panels.js': ['export const canShow = () => true;'],
};
Object.keys(standIns).forEach(file => fs.writeFileSync(path.join(root, file), standIns[file].join('\n') + '\n'));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const views = await import(base + 'core/views.js');
const style = await import(base + 'core/style.js');
const screens = await import(base + 'core/screens.js');
const sanity = await import(base + 'core/sanity.js');
const teamsModule = await import(base + 'core/teams.js');
const requests = await import(base + 'core/screen-requests.js');
const poll = await import(base + 'core/request-poll.js');

const tests = [];
function test(name, body) {
  tests.push({ name: name, run: body });
}

const monday12 = new Date('2026-10-12T16:00:00Z');
const minutes = (from, count) => new Date(from.getTime() + count * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');

function contentWith() {
  const raw = JSON.parse(readModule(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  Object.keys(raw.settings.themeByWeekday || {}).forEach(day => { raw.settings.themeByWeekday[day] = 'original'; });
  return sanity.normalizeSample(raw);
}

function fakeStorage() {
  const kept = {};
  return { getItem: name => (name in kept ? kept[name] : null), setItem: (name, value) => { kept[name] = String(value); }, removeItem: name => { delete kept[name]; } };
}

async function start() {
  const content = contentWith();
  const world = { log: [], hooks: null, seconds: null, content: content };
  globalThis.requestWorld = world;
  globalThis.document = { documentElement: { dataset: { layout: 'standard', style: 'original' }, style: { setProperty: () => {} }, classList: { add: () => {}, remove: () => {} } } };
  globalThis.window = { localStorage: fakeStorage(), sessionStorage: fakeStorage() };
  views.resetViews();
  style.previewStyle('', 0);
  style.requestStyle('', 0);
  style.rotateStyle('');
  screens.holdScreenLook({ team: '', style: '', monday: false });
  teamsModule.rotateTeam('');

  const module = await import(base + 'core/views-run.js?' + Math.random());
  await module.startViews(() => content, false);
  views.holdBootView(content, monday12);
  return world;
}

// What the screen chooses as its style at this moment, with the setting empty
const chosen = now => style.chooseStyle(null, null, now);

test('the rotation list is on, and it plays Robotics, Prime and Nova only', async () => {
  const world = await start();
  const keys = [];
  for (let second = 0; second < 40 * 60; second += 1) {
    world.seconds(new Date(monday12.getTime() + second * 1000));
    if (keys[keys.length - 1] !== views.cycleKey()) keys.push(views.cycleKey());
  }
  assert.ok(keys.includes('general') && keys.includes('prime') && keys.includes('nova'));
  assert.ok(!keys.includes('family'), 'Condensed is not in the rotation, so only a request can show it');
});

config.themeIds.forEach(theme => {
  test('a theme preview of ' + theme + ' reaches the screen at once, holds while the rotation plays, and ends by itself', async () => {
    const world = await start();
    world.content.settings.previewTheme = { theme: theme, until: minutes(monday12, 10) };
    world.log.length = 0;
    world.seconds(monday12);
    assert.equal(chosen(monday12), theme, 'the look is the theme asked for');
    assert.ok(world.log.includes('checkTheme'), 'the page is told to check the look');
    assert.ok(world.log.includes('moveOn grid1'), 'the large panel moves on, so the swap that carries the theme plays now');

    // the rotation goes on and changes view and look: the theme of the day is held back, the request is not
    for (let second = 1; second < 9 * 60; second += 1) {
      const now = new Date(monday12.getTime() + second * 1000);
      world.seconds(now);
      const steps = views.viewSteps(world.content, views.cycleKey(), now);
      if (steps.length > 0 && second % 30 === 0) world.hooks.begin(steps[0]);
      assert.equal(chosen(now), theme, 'still ' + theme + ' at second ' + second);
    }

    // the request has run out
    const after = new Date(monday12.getTime() + 11 * 60000);
    world.log.length = 0;
    world.seconds(after);
    assert.equal(chosen(after), 'original', 'the theme of the day comes back');
    assert.ok(world.log.includes('checkTheme') && world.log.includes('moveOn grid1'), 'and goes on in a swap');
  });
});

test('an old Preview button that ends does not end a theme the control page asked for, and the other way round', async () => {
  const world = await start();
  world.content.settings.previewTheme = { theme: 'retro', until: minutes(monday12, 10) };
  world.seconds(monday12);
  style.previewStyle('cybertron', monday12.getTime() + 120000);
  assert.equal(chosen(monday12), 'retro', 'the request wins over an older preview');
  style.previewStyle('', 0);
  assert.equal(chosen(monday12), 'retro', 'the end of an older preview leaves the request');
  style.requestStyle('', 0);
  assert.equal(chosen(monday12), 'original');
});

test('a theme the screen does not know is not obeyed, and the control page and Studio words agree with the screen', () => {
  const now = monday12;
  assert.equal(requests.activeRequests({ previewTheme: { theme: 'minimal', until: minutes(now, 10) } }, now).previewTheme, '');
  assert.deepEqual(requests.themeIds, config.themeIds);
  assert.deepEqual(requests.viewKeys, config.viewKeys);
  config.themeIds.forEach(theme => assert.ok(style.isStyle(theme), theme + ' is a style'));
});

config.viewKeys.forEach(key => {
  test('a view held by the control page, ' + key + ', is shown, played from its own rows and kept for as long as the request lasts', async () => {
    const world = await start();
    world.content.settings.showView = { key: key, until: minutes(monday12, 30) };
    world.log.length = 0;
    world.seconds(monday12);
    assert.equal(views.cycleKey(), key);
    if (key !== 'general') assert.ok(world.log.includes('moveOn grid1 grid2'), 'both lists begin again');
    const steps = views.viewPlaylist(world.content, monday12);
    assert.ok(steps.length > 0, 'the large panel has steps to play in ' + key);
    assert.ok(steps.every(step => step.view === key));
    for (let second = 1; second < 25 * 60; second += 1) world.seconds(new Date(monday12.getTime() + second * 1000));
    assert.equal(views.cycleKey(), key, 'held for the whole request');

    const after = new Date(monday12.getTime() + 31 * 60000);
    for (let second = 0; second < 5; second += 1) world.seconds(new Date(after.getTime() + second * 1000));
    assert.notEqual(views.cycleKey(), '', 'the rotation takes over again');
    if (key === 'family') assert.notEqual(views.cycleKey(), 'family', 'Condensed is not in the rotation');
  });
});

test('the screen asks for the request fields every 10 seconds, and the Studio request has the same shape as the control page', () => {
  assert.equal(poll.requestPollSeconds, 10);
  ['previewTheme', 'showView', 'holdPanel', 'pauseRotation'].forEach(name => assert.ok(poll.requestFields.includes(name), name));
  ['previewTheme', 'showView'].forEach(name => assert.ok(poll.requestsQuery.includes(name), 'the query asks for ' + name));
  const asked = poll.pickRequests({ previewTheme: { theme: 'foundry', until: minutes(monday12, 10) }, other: 1 });
  assert.equal(asked.previewTheme.theme, 'foundry');
  assert.equal('other' in asked, false);
  assert.equal(poll.sameRequests(asked, { previewTheme: asked.previewTheme }), true);
  assert.equal(poll.sameRequests(asked, {}), false);
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
      console.log('      ' + String(error && error.stack ? error.stack : error).split('\n').slice(0, 8).join('\n      '));
    }
  }
} finally {
  teamsModule.rotateTeam('');
  teamsModule.askForTeam('');
  fs.rmSync(workFolder, { recursive: true, force: true });
}
console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exit(1);
