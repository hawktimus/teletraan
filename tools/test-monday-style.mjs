// Tests for the Monday block in the Monday style (docs/layouts.md, "The look rotation" and "The swap"): the Monday
// cards belong to the Monday pass and to no other, the Monday pass is in the Monday style or it does not happen, and
// a held look goes on in a swap. dashboard/core/look-rotation.js is run for real, and so is the page side of it,
// dashboard/core/look-rotation-run.js, with stand-ins for the swap, the schedule and the other parts of the screen,
// and a small page that says which layout it is drawn for. The swap itself is in tools/test-swap.mjs.
//
//   node tools/test-monday-style.mjs

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
    "export const moveOn = regions => globalThis.mondayWorld.log.push('moveOn ' + regions.join(' '));",
    "export const rewindRotation = () => globalThis.mondayWorld.log.push('rewind');",
  ],
  'core/swap-run.js': [
    "export const queueSwap = () => globalThis.mondayWorld.log.push('queueSwap');",
    "export const startSwaps = busy => { globalThis.mondayWorld.swapBusy = busy; };",
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
const rotation = await import(base + 'core/look-rotation.js');
const layoutModule = await import(base + 'core/layout.js');
const sanity = await import(base + 'core/sanity.js');
const registry = await import(base + 'registry.js');
const run = await import(base + 'core/look-rotation-run.js');

const { makeLookRotation, styleCanGoOn, withoutMondayCards } = rotation;

const tests = [];
function test(name, body) {
  tests.push({ name: name, run: body });
}


// The content: the sample, with a board task for Prime and none for Nova

const sampleRaw = () => JSON.parse(fs.readFileSync(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));
function contentWith(settings, moreTasks) {
  const raw = sampleRaw();
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  raw.tasks = [{ title: '[Task]', subteam: '[Subteam A]', status: 'up-next', team: 'prime', source: 'monday', mondayId: '[item]', showOnTv: true }].concat(moreTasks || []);
  raw.subteams = [{ name: '[Subteam A]' }];
  Object.assign(raw.settings, { dailyStyles: ['original'], mondayStyle: 'minimal', teamOrder: ['prime', 'nova'] }, settings || {});
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

// Starts the look rotation of the page side over this content and page, and gives back what it hands to the schedule
async function start(options = {}) {
  const content = options.content || contentWith();
  const world = { log: [], hooks: null, seconds: null, swapBusy: null, swapping: false };
  globalThis.mondayWorld = world;
  setPage(options.page || 'standard');
  globalThis.window = { localStorage: fakeStorage(), sessionStorage: options.session === undefined ? fakeStorage() : options.session };

  const file = pathToFileURL(path.join(root, 'core/look-rotation-run.js')).href + '?' + Math.random();
  const module = await import(file);
  await module.startLookRotation(() => content, false);

  // moves the rotation to the next pass as the schedule does at the end of one
  world.nextPass = seconds => world.hooks.atPass(new Date(Date.now() + seconds * 1000));
  world.content = content;
  return world;
}

const steps = (...ids) => ids.map(id => ({ panel: id, show: true }));
const idsOf = list => list.map(step => step.panel);


// The cards and the pass

test('the Monday cards are the five panels the registry flags, and a list without them is the list it was', () => {
  const cards = registry.panels.filter(panel => panel.monday).map(panel => panel.id);
  assert.deepEqual(cards, ['monday-tasks', 'monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both']);

  const usual = steps('tasks', 'events', 'tonight');
  assert.deepEqual(withoutMondayCards(usual, cards), usual);
  assert.deepEqual(idsOf(withoutMondayCards(steps('tasks', 'monday-tasks', 'events', 'monday-progress', 'monday-milestones', 'photo'), cards)), ['tasks', 'events', 'photo']);
  const list = steps('monday-tasks');
  withoutMondayCards(list, cards);
  assert.equal(list.length, 1, 'the list that was given is not changed');
  assert.deepEqual(withoutMondayCards([], cards), []);
});

test('a style of the layout the page has goes on, and a style of another layout goes on only while the page may reload for it', () => {
  assert.equal(styleCanGoOn('standard', 'standard', false), true, 'the same layout needs no reload');
  assert.equal(styleCanGoOn('bar-minimal', 'bar-minimal', false), true);
  assert.equal(styleCanGoOn('standard', 'bar-minimal', true), true, 'another layout, and the page may reload');
  assert.equal(styleCanGoOn('standard', 'bar-minimal', false), false, 'another layout, and it may not: the reload note is there, or cannot be kept');
  assert.equal(styleCanGoOn('bar-minimal', 'standard', false), false);
  assert.equal(styleCanGoOn('bar-minimal', 'standard', undefined), false, 'anything but true is no');
});

test('a Monday pass is left out of the cycle while the Monday style cannot go on, and is back when it can', () => {
  const content = contentWith();
  let fits = true;
  const machine = makeLookRotation({ getContent: () => content, storage: fakeStorage(), canShow: () => fits });
  const start = new Date('2026-10-12T16:00:00Z');
  const after = seconds => new Date(start.getTime() + seconds * 1000);

  machine.begin(start);
  assert.deepEqual(machine.boundary(after(20)).kind, 'monday', 'with the style fitting, Prime is followed by its Monday cards');
  assert.equal(machine.pass().kind, 'monday');

  // the cards are up and the style stops fitting: the pass is gone, and the cycle starts again at its first pass
  fits = false;
  const answer = machine.boundary(after(40));
  assert.equal(answer.moved, true);
  assert.deepEqual(machine.pass(), { team: 'prime', kind: 'panels' });

  const kinds = [];
  for (let step = 1; step <= 4; step++) {
    machine.boundary(after(40 + step * 20));
    kinds.push(machine.pass().team + ' ' + machine.pass().kind);
  }
  assert.deepEqual(kinds, ['nova panels', 'prime panels', 'nova panels', 'prime panels'], 'no Monday cards while they cannot be in their style');

  fits = true;
  machine.boundary(after(200));
  machine.boundary(after(220));
  assert.ok(['prime monday', 'nova panels'].includes(machine.pass().team + ' ' + machine.pass().kind));
  const seen = [];
  for (let step = 1; step <= 4; step++) {
    machine.boundary(after(220 + step * 20));
    seen.push(machine.pass().kind);
  }
  assert.ok(seen.includes('monday'), 'and the cards come back');
});

test('canShow is asked about the Monday style only, and only for a team that has Monday cards', () => {
  const content = contentWith();
  const asked = [];
  const machine = makeLookRotation({ getContent: () => content, storage: fakeStorage(), canShow: style => { asked.push(style); return true; } });
  machine.begin(new Date('2026-10-12T16:00:00Z'));
  machine.boundary(new Date('2026-10-12T16:00:20Z'));

  assert.ok(asked.length > 0);
  assert.deepEqual(Array.from(new Set(asked)), [content.settings.mondayStyle], 'never about the style of the day');

  const none = [];
  const without = makeLookRotation({ getContent: () => contentWith(), storage: fakeStorage(), mondayCards: () => [], canShow: style => { none.push(style); return true; } });
  without.begin(new Date('2026-10-12T16:00:00Z'));
  assert.deepEqual(none, [], 'with no Monday cards the question does not come up');
});


test('the pass of both teams is a Monday pass: it needs the Monday style to fit as a team\'s does, and it is the last of the cycle', () => {
  const nova = { title: '[Task N]', subteam: '[Subteam A]', status: 'up-next', team: 'nova', source: 'monday', mondayId: '[item N]', showOnTv: true };
  const content = contentWith({}, [nova]);
  const start = new Date('2026-10-12T16:00:00Z');
  const after = seconds => new Date(start.getTime() + seconds * 1000);
  const walk = fits => {
    const machine = makeLookRotation({ getContent: () => content, storage: fakeStorage(), canShow: () => fits });
    const found = [];
    machine.begin(start);
    found.push(machine.pass());
    for (let step = 1; step <= 5; step++) {
      machine.boundary(after(step * 20));
      found.push(machine.pass());
    }
    return found.map(pass => [pass.team, pass.kind].concat(pass.both ? ['both'] : []).join(' '));
  };

  assert.deepEqual(walk(true), ['prime panels', 'prime monday', 'nova panels', 'nova monday', 'nova monday both', 'prime panels']);
  assert.deepEqual(walk(false), ['prime panels', 'nova panels', 'prime panels', 'nova panels', 'prime panels', 'nova panels'], 'neither the cards of a team nor the cards of both are drawn in another style');
});

// The page side

test('in a Monday pass the large panel follows the cards of the team, and in every other pass the usual list without them', async () => {
  const world = await start();
  const cards = rotation.mondayCards(world.content, 'prime');
  assert.ok(cards.length >= 3, 'Prime has the cards');
  const usual = steps('tasks', 'monday-tasks', 'events', 'monday-milestones', 'monday-progress');

  assert.deepEqual(idsOf(world.hooks.playlist(usual)), ['tasks', 'events'], 'the first pass is Prime\'s panels: no card in it');
  assert.equal(world.hooks.atPass(new Date(Date.now() + 20000)), true, 'the pass is over and another begins');
  assert.deepEqual(world.hooks.playlist(usual), cards, 'now the Monday cards of Prime');
  assert.equal(world.hooks.atPass(new Date(Date.now() + 40000)), true);
  assert.deepEqual(idsOf(world.hooks.playlist(usual)), ['tasks', 'events'], 'and the panels again, without the cards');
});

test('in the pass of both teams the large panel follows the two cards of both, and going into it holds no look: the swap is the move from card to card', async () => {
  const nova = { title: '[Task N]', subteam: '[Subteam A]', status: 'up-next', team: 'nova', source: 'monday', mondayId: '[item N]', showOnTv: true };
  const world = await start({ content: contentWith({}, [nova]) });
  const usual = steps('tasks', 'events');

  for (let step = 1; step <= 3; step++) world.hooks.atPass(new Date(Date.now() + step * 20000));
  assert.equal(world.hooks.playlist(usual)[0].panel, 'monday-tasks', 'the cards of Nova');

  world.log.length = 0;
  assert.equal(world.hooks.atPass(new Date(Date.now() + 80000)), true);
  assert.deepEqual(idsOf(world.hooks.playlist(usual)), ['monday-milestones-both', 'monday-progress-both'], 'the cards of both teams are not taken out of the Monday pass');
  assert.deepEqual(world.log, [], 'the style and the team are Nova in Minimal, as before, so nothing is held');

  world.log.length = 0;
  world.hooks.atPass(new Date(Date.now() + 100000));
  assert.deepEqual(idsOf(world.hooks.playlist(usual)), ['tasks', 'events'], 'and after it the panels of Prime, without the cards');
  assert.deepEqual(world.log, ['checkTheme', 'queueSwap'], 'with the look held, for the swap');
});

test('a held look is handed to the screen and goes on in a swap: the style into the Monday pass, and back after it', async () => {
  const world = await start();
  assert.deepEqual(world.log.filter(line => line !== 'checkTheme'), [], 'nothing is queued at the start');

  world.log.length = 0;
  world.hooks.atPass(new Date(Date.now() + 20000));
  assert.deepEqual(world.log, ['checkTheme', 'queueSwap'], 'Prime in Minimal: the look is held and the next page change is a swap');

  world.log.length = 0;
  world.hooks.atPass(new Date(Date.now() + 40000));
  assert.deepEqual(world.log, ['checkTheme', 'queueSwap'], 'and Nova back in the style of the day');
});

test('a Monday pass in the style of the day holds no look, so no swap is queued for it: the cards are a swap by themselves', async () => {
  const world = await start({ content: contentWith({ mondayStyle: 'original', teamOrder: ['prime'] }) });
  world.log.length = 0;

  assert.equal(world.hooks.atPass(new Date(Date.now() + 20000)), true);
  assert.deepEqual(world.log, [], 'the style and the team are the same, so nothing is held');
  assert.equal(world.hooks.playlist(steps('tasks')).length >= 3, true, 'but the Monday cards are up');
});

test('Next look now holds the look, starts every list again, and moves the pages on; a second press moves past the Monday cards', async () => {
  const world = await start();
  const request = at => { world.content.settings.nextLookRequest = { requestedAt: new Date(at).toISOString() }; };
  world.log.length = 0;

  request(Date.now());
  world.seconds(new Date());
  assert.deepEqual(world.log, ['rewind', 'checkTheme', 'queueSwap', 'moveOn grid1 grid2 ticker']);
  assert.deepEqual(world.hooks.playlist(steps('tasks')).length >= 3, true, 'a press from Prime\'s panels goes to its Monday cards');

  world.log.length = 0;
  request(Date.now() + 2000);
  world.seconds(new Date(Date.now() + 2000));
  assert.deepEqual(world.log, ['rewind', 'checkTheme', 'queueSwap', 'moveOn grid1 grid2 ticker'], 'the second press moves past them, to Nova');
  assert.deepEqual(idsOf(world.hooks.playlist(steps('tasks', 'monday-tasks'))), ['tasks']);
});

test('the Monday pass is skipped when the page cannot reload for the Monday style, and taken when it can', async () => {
  const kinds = async options => {
    const world = await start(options);
    const result = [];
    for (let step = 1; step <= 3; step++) {
      world.hooks.atPass(new Date(Date.now() + step * 20000));
      result.push(world.hooks.playlist(steps('tasks')).length >= 3 ? 'monday' : 'panels');
    }
    return result;
  };

  assert.deepEqual(await kinds({}), ['monday', 'panels', 'panels'], 'a page that may reload goes into Minimal and out of it');

  const noted = fakeStorage();
  noted.setItem(layoutModule.reloadKey, 'bar-minimal');
  assert.deepEqual(await kinds({ session: noted }), ['panels', 'panels', 'panels'], 'a page that has just reloaded for that layout does not reload again, so Minimal does not come');

  assert.deepEqual(await kinds({ session: brokenStorage }), ['panels', 'panels', 'panels'], 'nor does a page that cannot keep the note');
  assert.deepEqual(await kinds({ session: null }), ['panels', 'panels', 'panels'], 'or has no storage');

  // a page that is drawn for Minimal already needs no reload, whatever the note says
  assert.deepEqual((await kinds({ page: 'bar-minimal', session: noted })).slice(0, 1), ['monday']);
});


// The page file and the docs

test('the page side names the cards through the registry, asks the layout the way holdForLayout does, and leaves the look to the swap', () => {
  const file = read('core/look-rotation-run.js');

  assert.ok(file.includes("const mondayCardIds = panels.filter(panel => panel.monday).map(panel => panel.id);"));
  assert.ok(file.includes('const wanted = drawnFor(layoutFor(style, layoutOf(theme)), shapesFor(style));'), 'the layout is worked out as layout-apply.js does');
  assert.ok(read('core/layout-apply.js').includes('const wanted = drawnFor(layoutFor(look.style, layoutOf(look.theme)), shapesFor(look.style));'));
  assert.ok(file.includes('window.sessionStorage.getItem(reloadKey) !== wanted'), 'the note of mustReload');
  assert.ok(file.includes("canReload = false; // a note that cannot be kept"), 'and a note that cannot be kept stops the reload');
  assert.ok(file.includes('canShow: mondayStyleFits'));
  assert.ok(/function playlistNow\(list\) \{[\s\S]*?pass\.kind === 'monday' \? steps : withoutMondayCards\(steps, mondayCardIds\)/.test(file));
  ['applyStyle', 'dataset.style', 'classList', 'setProperty'].forEach(name => assert.ok(!file.includes(name), 'the page side does not touch the page with ' + name));
});

test('the docs say where the Monday cards come and in what style, and the Panel order rows that name them are left out of the other passes', () => {
  const layouts = fs.readFileSync(path.join(docsFolder, 'layouts.md'), 'utf8').replace(/\s+/g, ' ');
  ['withoutMondayCards', 'styleCanGoOn', 'canShow', 'never drawn in the frames of another style', 'come in the Monday pass and nowhere else'].forEach(word => assert.ok(layouts.includes(word), 'layouts.md names ' + word));
  assert.ok(fs.readFileSync(path.join(docsFolder, 'switch-the-look.md'), 'utf8').includes('always in the Monday style'));
  assert.ok(fs.readFileSync(path.join(docsFolder, 'coaches-guide.md'), 'utf8').includes('never in another style'));
  assert.equal(config.defaultSettings.mondayStyle, 'minimal');
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
