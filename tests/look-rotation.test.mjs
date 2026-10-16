// Tests for the page side of the Screens: what the large panel asks the Screens (core/schedule.js, run for
// real with stand-ins for the page), the files that hand a look to the screen (core/views-run.js), the style
// and the team being held the way a preview holds them, the Next look now guard, and the swap being the one way a
// look goes on. The Screens themselves (the documents, the weekday, the rows and the choices between rows) are in
// tests/screens.test.mjs. Nothing is drawn and no clock runs.
//
//   node tests/look-rotation.test.mjs

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
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-look-rotation-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard/themes/overlays'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  copyModule(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});
const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const screens = await import(base + 'core/screens.js');
const styleModule = await import(base + 'core/style.js');
const teamsModule = await import(base + 'core/teams.js');
const previewModule = await import(base + 'core/preview.js');
const { handledKey: announceKey } = await import(base + 'core/announce.js');

const { makeNextLookRunner, tidyNextLookRequest } = screens;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// The calendar in New York, which is the time zone of the Look page. October 12 2026 is a Monday.
const noonOnTheTwelfth = new Date('2026-10-12T16:00:00Z');
const seconds = (from, count) => new Date(from.getTime() + count * 1000);

const prime = { code: 'prime', name: 'HAWKTIMUS PRIME', active: true };
const nova = { code: 'nova', name: 'HAWKTIMUS NOVA', active: true };

// A stand-in for localStorage that keeps its values in an object
function fakeStorage() {
  const kept = {};
  return {
    kept: kept,
    getItem: name => (name in kept ? kept[name] : null),
    setItem: (name, value) => { kept[name] = String(value); },
  };
}

// A storage that is switched off, the way a browser can have it: every call throws
const brokenStorage = {
  getItem: () => { throw new Error('storage is off'); },
  setItem: () => { throw new Error('storage is off'); },
};


// Style and team are held, not set

// Style and team are held, not set

test('a style the Screens hold wins over the setting and loses to the address and to a preview', () => {
  const later = new Date(Date.now() + 60000);
  styleModule.rotateStyle('cybertron');
  try {
    assert.equal(styleModule.chooseStyle('original', null), 'cybertron');
    assert.equal(styleModule.chooseStyle('minimal', null), 'cybertron');
    assert.equal(styleModule.chooseStyle('original', 'minimal'), 'minimal', 'the address wins');

    styleModule.previewStyle('minimal', later.getTime());
    assert.equal(styleModule.chooseStyle('original', 'cybertron'), 'minimal', 'a preview wins over both');
    styleModule.previewStyle('', 0);
    assert.equal(styleModule.chooseStyle('original', null), 'cybertron', 'and it comes back when the preview is over');

    styleModule.rotateStyle('');
    assert.equal(styleModule.chooseStyle('minimal', null), 'minimal', 'an empty name lets go');
    styleModule.rotateStyle('plain');
    assert.equal(styleModule.chooseStyle('minimal', null), 'minimal', 'and so does a name that is not a style');
  } finally {
    styleModule.rotateStyle('');
    styleModule.previewStyle('', 0);
  }
});

test('a team the Screens hold wins over Team mode and loses to a preview and the address', () => {
  const content = { teams: [prime, nova], settings: { teamMode: 'prime', alternateMinutes: 5 } };
  const now = new Date();
  const wantedAfter = (rotated, extra) => {
    teamsModule.rotateTeam(rotated);
    if (extra) extra();
    teamsModule.useTeams(content, now);
    return teamsModule.wantedTeam().code;
  };

  try {
    assert.equal(wantedAfter('nova'), 'nova', 'Team mode says Prime and the Screens say Nova');
    assert.equal(wantedAfter(''), 'prime', 'an empty code lets go');
    assert.equal(wantedAfter('ghost'), 'prime', 'a team that is not there lets go');

    teamsModule.rotateTeam('nova');
    teamsModule.useTeams(Object.assign({}, content, { teams: [prime, Object.assign({}, nova, { active: false })] }), now);
    assert.equal(teamsModule.wantedTeam().code, 'prime', 'a team that is switched off lets go');

    assert.equal(wantedAfter('nova', () => teamsModule.previewTeam('prime', now.getTime() + 60000)), 'prime', 'a preview wins');
    assert.equal(wantedAfter('nova', () => teamsModule.previewTeam('', 0)), 'nova', 'and it comes back when the preview is over');
    assert.equal(wantedAfter('prime', () => teamsModule.askForTeam('nova')), 'nova', 'the address wins');
  } finally {
    teamsModule.rotateTeam('');
    teamsModule.askForTeam('');
    teamsModule.previewTeam('', 0);
  }
});

test('the style and the team go on the page only through the modules a preview uses, and the page change puts both on in one step', () => {
  const run = read('core/views-run.js');
  const held = read('core/screens.js');
  const areas = read('core/areas.js');

  assert.ok(/function holdLook\(look\) \{\s*holdScreenLook\(look\);\s*useTeams\(getContent\(\), new Date\(\)\);\s*noteWantedTeam\(\);\s*checkTheme\(\);\s*\}/.test(run));
  assert.ok(/held = \{ team: look\.team, style: look\.style, monday: look\.monday === true \};\s*rotateStyle\(held\.style\);\s*rotateTeam\(held\.team\);/.test(held), 'holdScreenLook hands both to the modules a preview uses');
  ['applyStyle', 'applyTeamLook', 'dataset.style', 'classList', 'setProperty'].forEach(name => {
    assert.ok(!run.includes(name), 'views-run.js should not touch the page with ' + name);
    assert.ok(!held.includes(name), 'screens.js should not touch the page with ' + name);
  });
  assert.ok(areas.includes('if (region === themeRegion) changeThemeNow();\n    if (region === themeRegion) changeTeamNow();'), 'the page change still puts the style and the team on together');
  assert.ok(previewModule.previewKinds.cybertron.style === 'cybertron', 'the previews hold the style in the same module');
});

// Next look now

test('a click is read as a time, and a time that is not one is no click', () => {
  assert.deepEqual(tidyNextLookRequest({ requestedAt: '2026-10-12T16:00:00.000Z' }), { requestedAt: '2026-10-12T16:00:00.000Z' });
  [undefined, null, {}, [], 'text', { requestedAt: 'soon' }, { requestedAt: 5 }, { requestedAt: '' }].forEach(raw => assert.deepEqual(tidyNextLookRequest(raw), { requestedAt: '' }, JSON.stringify(raw)));
});

// A runner with the rotation behind it. busy and the storage are the test's to change.
function runnerFor(requestedAt, extra) {
  const world = { calls: [], busy: false, requestedAt: requestedAt, storage: fakeStorage() };
  Object.assign(world, extra);
  world.runner = makeNextLookRunner({
    getContent: () => ({ settings: { nextLookRequest: { requestedAt: world.requestedAt } } }),
    storage: world.storage,
    busy: () => world.busy,
    next: now => world.calls.push(now.toISOString()),
  });
  return world;
}

test('a click from the last minute that is not the one handled before moves the look once', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const world = runnerFor(asked);

  world.runner.look(seconds(new Date(asked), 0));
  world.runner.look(seconds(new Date(asked), 1));
  world.runner.look(seconds(new Date(asked), 30));
  assert.equal(world.calls.length, 1, 'once, not every second');

  world.requestedAt = '2026-10-12T16:00:40.000Z';
  world.runner.look(new Date('2026-10-12T16:00:41Z'));
  assert.equal(world.calls.length, 2, 'a new click is a new request');
});

test('a click older than a minute never runs, so a screen that restarts does not move on for an old click', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const old = runnerFor(asked);
  old.runner.look(seconds(new Date(asked), 61));
  assert.equal(old.calls.length, 0);

  const edge = runnerFor(asked);
  edge.runner.look(seconds(new Date(asked), 60));
  assert.equal(edge.calls.length, 1, 'a minute exactly still counts');
  const empty = runnerFor('');
  empty.runner.look(new Date(asked));
  assert.equal(empty.calls.length, 0, 'no click, no move');
});

test('the click handled before is kept in localStorage under a name of its own, so a restart does not move on again', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const world = runnerFor(asked);
  world.runner.look(new Date(asked));

  assert.equal(world.storage.kept[screens.handledKey], asked);
  assert.notEqual(screens.handledKey, announceKey, 'apart from the announcements');
  assert.equal(screens.handledKey, 'teletraan-next-look-handled');

  const restarted = runnerFor(asked, { storage: world.storage });
  restarted.runner.look(seconds(new Date(asked), 10));
  assert.equal(restarted.calls.length, 0, 'the new page knows it was handled');
});

test('a storage that fails still stops the same click from running twice while the page is open', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const world = runnerFor(asked, { storage: brokenStorage });
  world.runner.look(new Date(asked));
  world.runner.look(seconds(new Date(asked), 1));
  assert.equal(world.calls.length, 1);

  const none = runnerFor(asked, { storage: null });
  none.runner.look(new Date(asked));
  none.runner.look(seconds(new Date(asked), 1));
  assert.equal(none.calls.length, 1);
});

test('a click waits while something has the screen, and runs when it is free if it is still under a minute old', () => {
  const asked = '2026-10-12T16:00:00.000Z';
  const world = runnerFor(asked, { busy: true });
  world.runner.look(seconds(new Date(asked), 1));
  world.runner.look(seconds(new Date(asked), 20));
  assert.equal(world.calls.length, 0);

  world.busy = false;
  world.runner.look(seconds(new Date(asked), 30));
  assert.equal(world.calls.length, 1);

  const late = runnerFor(asked, { busy: true });
  late.runner.look(seconds(new Date(asked), 10));
  late.busy = false;
  late.runner.look(seconds(new Date(asked), 90));
  assert.equal(late.calls.length, 0, 'but not after the minute is over');
});

test('a click in the settings of content that has none is no click', () => {
  const world = runnerFor('');
  const runner = makeNextLookRunner({ getContent: () => null, storage: world.storage, busy: () => false, next: () => world.calls.push('x') });
  runner.look(noonOnTheTwelfth);
  const bare = makeNextLookRunner({ getContent: () => ({}), storage: world.storage, busy: () => false, next: () => world.calls.push('x') });
  bare.look(noonOnTheTwelfth);
  assert.equal(world.calls.length, 0);
});

test('a press moves the large panel to the next row, and the page gives the runner nothing else to do', () => {
  const run = read('core/views-run.js');

  assert.ok(/function pressed\(\) \{\s*skipRow\(\);\s*\}/.test(run));
  assert.ok(run.includes('makeNextLookRunner({ getContent: getContent, storage: savedStorage(), busy: busy, next: pressed })'));
  assert.ok(/function begin\(step\) \{[\s\S]*?holdLook\(to\);\s*if \(changes\.swap \|\| moved\) queueSwap\(\);\s*\}/.test(run), 'a look that is held is a swap at the next page change of the large panel');
  assert.ok(run.includes('setLookHooks({ viewAs: viewAs, fits: fits, begin: begin });'));
  assert.ok(run.includes('startSwaps(busyElsewhere, swapScaleNow);'));
});

test('the page asks for the screen through one busy check that has every one of those, and the swap itself', () => {
  const run = read('core/views-run.js');
  const busy = /function busy\(\) \{\s*return ([^;]+);/.exec(run);
  const elsewhere = /function busyElsewhere\(\) \{\s*return ([^;]+);/.exec(run);

  assert.ok(busy && elsewhere, 'views-run.js has a busy function and one for what is not the swap');
  assert.ok(busy[1].includes('swapRunning()') && busy[1].includes('busyElsewhere()'), 'busy checks the swap and the rest');
  ['takeoverRunning()', 'demoRunning()', 'nightIsUp()', 'hiddenPlaying()'].forEach(name => assert.ok(elsewhere[1].includes(name), 'busy checks ' + name));
  assert.ok(!elsewhere[1].includes('swapRunning'), 'a swap asks about everything but itself');
  assert.ok(read('core/takeover.js').includes('return running !== null || frame.isPaused();'), 'takeoverRunning is true for an alert, an announcement and a talk');
});

test('a swap never starts while something else has the screen: swap-run.js refuses, and the look goes on in the usual page change', () => {
  const run = read('core/swap-run.js');
  assert.ok(/if \(playing \|\| takeoverRunning\(\) \|\| askBusy\(\)\) return null;/.test(run));
  assert.ok(run.includes('askBusy = busyElsewhere;'));
});

test('the swap holds the clock of the pages with its own count, and gives it back whatever happens', () => {
  const run = read('core/swap-run.js');
  const schedule = read('core/schedule.js');
  assert.equal((read('core/views-run.js').match(/\bpauseRotation\(\)/g) || []).length, 1, 'the views pause the pages only when the control page asks: the swap holds the clock');
  assert.ok(/holdClock\(true\);\s*try \{[\s\S]*\} finally \{[\s\S]*holdClock\(false\);/.test(run), 'the clock is held in play() and let go in finally');
  assert.equal((run.match(/holdClock\(true\)/g) || []).length, 1);
  assert.equal((run.match(/holdClock\(false\)/g) || []).length, 1);
  assert.ok(schedule.includes('if (!rotationPaused() && clockHeld === 0) left -= 250;'), 'a page does not use up its seconds while the clock is held');
  assert.ok(!/clockHeld[^;]*waitWhilePaused/.test(schedule), 'and the areas still pick and swap their pages, which a pause would stop');
});

test('a swap takes as long as the Screen it goes to says: every time of it follows the one pace, and nothing else in swap-run.js reads the speed', () => {
  const run = withoutComments(read('core/swap-run.js'));

  assert.equal((run.match(/frame\.pace\(\)/g) || []).length, 1, 'frame.pace() is read in one place');
  assert.ok(/function paceNow\(\) \{\s*const scale = swapScale\(\);\s*return frame\.pace\(\) \* \(typeof scale === 'number' && isFinite\(scale\) && scale > 0 \? scale : 1\);\s*\}/.test(run));
  assert.equal((run.match(/const pace = paceNow\(\);/g) || []).length, 2, 'the swap and the fade take the pace from it');
  assert.ok(run.includes('flyHawk(run, after.logos, pace, icon, left);'), 'the icon of the logo too');
  assert.ok(/export function startSwaps\(busyElsewhere, scaleNow = \(\) => 1\) \{/.test(run));
});


// The swaps

test('there is one swap: lookSwap stays in config.js and the Studio, and nothing in the page reads it', () => {
  assert.deepEqual(config.lookSwaps, ['assemble', 'slats', 'cut']);
  assert.equal(config.defaultSettings.lookSwap, 'assemble');
  assert.equal(config.lookCutMilliseconds, undefined, 'the length of the cut is gone with the cut');

  const files = fs.readdirSync(path.join(dashboardFolder, 'core')).map(file => 'core/' + file).concat(['shell.js', 'frame.js']).filter(file => file.endsWith('.js'));
  const readers = files.filter(file => /lookSwap|useSlatsOnce|cutScreen|retireAreas|lookCutMilliseconds/.test(fs.readFileSync(path.join(dashboardFolder, file), 'utf8').replace(/\/\/.*$/gm, '')));
  assert.deepEqual(readers, ['core/content-tidy.js'], 'only the tidying of the saved settings names the field');
});

test('the swap is the page change of the large panel: areas.js asks for it first, then for a hidden transition, and a look goes on at the moment the screen is apart', () => {
  const areas = read('core/areas.js');
  const asked = areas.indexOf('swapOffer(old, next)');
  assert.ok(asked !== -1 && asked < areas.indexOf('const offered = hiddenOffer();'), 'a swap is asked for before a hidden transition');
  assert.ok(/export function setSwapOffer\(offer\) \{\s*swapOffer = offer;\s*\}/.test(areas));
  assert.ok(/export function startWholeScreen\(keepLook = false\) \{\s*const mine = \{ state: 'before', keepLook: keepLook \};/.test(areas), 'a hidden transition keeps the look, a swap does not');
  assert.ok(/if \(region === themeRegion && !\(gate && gate\.keepLook\)\) \{\s*changeThemeNow\(\);\s*changeTeamNow\(\);\s*\}/.test(areas), 'the style and the team go on together, when the screen is apart');
  assert.ok(areas.includes('if (swapped) return took;'), 'a swap that did not start leaves the usual page change to run');
  ['slatsFor', 'useSlatsOnce', 'cutScreen', 'retireAreas'].forEach(name => assert.ok(!areas.includes(name), 'areas.js has no ' + name + ' now'));
});

test('the swaps move only transform, opacity and lines: the new code has no animation of its own', () => {
  ['core/screens.js', 'core/views-run.js'].forEach(file => {
    const source = read(file);
    ['blur', 'box-shadow', 'drop-shadow', 'requestAnimationFrame', '.animate(', 'keyframes', 'style.transform', 'style.opacity'].forEach(word => assert.ok(!source.includes(word), file + ' should not contain ' + word));
  });
});

test('the page holds the Screen of the day before it draws, starts the Screens after the team, and leaves them out of the test views and when the address asks', () => {
  const shell = read('shell.js');
  const team = shell.indexOf("askForTeam(params.get('team'));");
  const held = shell.indexOf('holdSavedScreen();', team);
  const style = shell.indexOf("startStyle(params.get('style'), savedStyle);");
  assert.ok(team !== -1 && held > team && style > held, 'the look is held after the team is asked for and before the style is chosen');
  assert.ok(shell.includes("if (params.get('show') || stress || onlyTasks) return;"));
  assert.ok(shell.includes('holdBootView(savedContent(), new Date());'));
  assert.ok(shell.includes("module.startViews(getContent, params.has('style') || params.has('team'))"));
  assert.ok(shell.indexOf("'./core/views-run.js'") > shell.indexOf("'./core/team-run.js'"), 'after the ones it asks about');
  assert.ok(/if \(addressAsks\) return;/.test(read('core/views-run.js')));
});

test('the lists come from the Screen on the screen, and the name effect and the hawk follow its minutes', () => {
  const shell = read('shell.js');

  assert.ok(shell.includes("withPages(withCompetition(viewPlaylist(shellState.content, new Date()), shellState.content, new Date()))"), 'the competition cards are mixed in first and then every panel with more than one page becomes its steps');
  assert.ok(shell.includes("startRotationForLayouts('grid2', () => withStandIns(withPages(viewSidePlaylist(shellState.content))), getContent);"), 'the small frame has its list in every layout, with its spares and its last resort');
  assert.ok(shell.includes('frame.setHawk(settings.logoHawk, cadence.hawkEverySeconds, settings.logoHawkDuration);'));
  assert.ok(shell.includes('frame.setNameEffect(settings.nameTransform, cadence.nameEverySeconds, settings.nameDuration);'));
  assert.ok(shell.includes('useLogoSettings(shellState.content.settings, currentScreen(shellState.content));'));
  assert.ok(/onScreenChange\(\(\) => \{\s*if \(shellState\.content\) useLogoSettings\(shellState\.content\.settings, currentScreen\(shellState\.content\)\);\s*\}\);/.test(shell), 'and they follow it when it changes');
});

test('nothing in the page reads Styles by day, Team order or the seconds between the name effect and the hawk any more', () => {
  const files = [];
  const walk = folder => fs.readdirSync(path.join(dashboardFolder, folder), { withFileTypes: true }).forEach(entry => {
    const place = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'data' && entry.name !== 'fonts' && entry.name !== 'assets') walk(place);
    } else if (entry.name.endsWith('.js')) {
      files.push(place);
    }
  });
  walk('.');

  const readers = pattern => files.filter(file => pattern.test(withoutComments(fs.readFileSync(path.join(dashboardFolder, file), 'utf8'))));
  assert.deepEqual(readers(/dailyStyles|teamOrder|teamsInOrder|styleForDay|planCycle/), ['config-settings.js'], 'only the starting values the Studio copies');
  assert.deepEqual(readers(/\bnameEvery\b|\blogoHawkEvery\b/), ['config-lists.js', 'config-settings.js', path.join('core', 'content-tidy.js')], 'the setting is kept tidy and no more');
  assert.deepEqual(readers(/look-rotation|rewindRotation|lookShortestSeconds|lookResumeSeconds/), []);
  assert.equal(fs.existsSync(path.join(dashboardFolder, 'core/look-rotation.js')), false);
  assert.equal(fs.existsSync(path.join(dashboardFolder, 'core/look-rotation-run.js')), false);
});

// core/schedule.js, with stand-ins for the page

const scheduleTree = path.join(workFolder, 'schedule-tree');
['config.js', 'core/schedule.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(scheduleTree, 'dashboard', file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(scheduleTree, 'dashboard', file));
});
fs.writeFileSync(path.join(scheduleTree, 'package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/frame.js'), [
  'export const pace = () => 1;',
  'export const turnMs = () => 0;',
  'export const isPaused = () => false;',
  'export const wait = () => new Promise(resolve => globalThis.scheduleWorld.waits.push(resolve));',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/panels.js'), [
  'export function buildPage(id) {',
  "  globalThis.scheduleWorld.log.push('build ' + id);",
  '  return { id: id, element: {} };',
  '}',
  'export const canShow = id => globalThis.scheduleWorld.canShow(id);',
  'export const moduleOf = () => null;',
  'export const regionOf = id => globalThis.scheduleWorld.regions[id] || null;',
  'export const topicOf = () => null;',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/photos.js'), 'export const ownSeconds = () => 0;\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/layout.js'), [
  'export const hasRegion = () => true;',
  "export const layoutNow = () => 'standard';",
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/areas.js'), [
  'export async function changePage(region, page) {',
  '  const world = globalThis.scheduleWorld;',
  "  world.log.push(region + ' ' + (page ? page.id : 'none'));",
  '  world.shown[region] = page;',
  '  return 0;',
  '}',
  'export function clearRegion(region) {',
  "  globalThis.scheduleWorld.log.push('clear ' + region);",
  '  globalThis.scheduleWorld.shown[region] = null;',
  '}',
].join('\n') + '\n');
let scheduleRuns = 0;

async function inRotation(run) {
  const world = { log: [], waits: [], shown: {}, canShow: () => true, regions: { a: 'grid1', b: 'grid1', c: 'grid1', x: 'grid1', y: 'grid1', d: 'grid2' } };
  globalThis.scheduleWorld = world;

  try {
    scheduleRuns += 1;
    world.module = await import(pathToFileURL(path.join(scheduleTree, 'dashboard/core/schedule.js')).href + '?run=' + scheduleRuns);
    world.content = { settings: { pageSeconds: 20, rotation: {} } };
    world.settle = async () => {
      for (let turn = 0; turn < 8; turn++) await new Promise(resolve => setImmediate(resolve));
    };
    // lets every wait go, a quarter of a second at a time, until this many seconds have passed
    world.pass = async count => {
      for (let quarter = 0; quarter < count * 4; quarter++) {
        world.waits.splice(0).forEach(resolve => resolve());
        await world.settle();
      }
    };
    world.pagesOf = region => world.log.filter(line => line.startsWith(region + ' ')).map(line => line.slice(region.length + 1));
    await run(world);
  } finally {
    delete globalThis.scheduleWorld;
  }
}

const steps = ids => ids.map(panel => ({ panel: panel, show: true }));
const gridPlaylist = steps(['a', 'b', 'c']);

// What a Screens stand-in writes in the log of the world, for the order of the questions
function hooksFor(world, extra) {
  return Object.assign({
    viewAs: (step, run) => run(),
    fits: () => true,
    begin: step => world.log.push('begin ' + step.panel),
  }, extra);
}

test('the large panel tells the Screens which step it has chosen before it builds the page, once for each step, and in order', async () => {
  await inRotation(async world => {
    world.module.setLookHooks(hooksFor(world));
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(60);

    assert.deepEqual(world.log.slice(0, 9), ['begin a', 'build a', 'grid1 a', 'begin b', 'build b', 'grid1 b', 'begin c', 'build c', 'grid1 c']);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'c', 'a'], 'and the list goes round');
    assert.equal(world.log.filter(line => line === 'begin a').length, 2);
  });
});

test('the small panel and the ticker never ask the Screens', async () => {
  await inRotation(async world => {
    const asked = [];
    world.module.setLookHooks({
      viewAs: (step, run) => { asked.push('viewAs'); return run(); },
      fits: () => { asked.push('fits'); return true; },
      begin: () => asked.push('begin'),
    });
    world.module.startRotation('grid2', () => steps(['d']), () => world.content);
    await world.settle();
    await world.pass(120);

    assert.deepEqual(asked, []);
    assert.ok(world.pagesOf('grid2').length >= 4);
    assert.ok(world.pagesOf('grid2').every(page => page === 'd'));
  });
});

test('a step is asked whether it has content as the team it is drawn for, so the team is on the screen only once the step is chosen', async () => {
  await inRotation(async world => {
    world.team = 'prime';
    world.viewing = '';
    world.canShow = id => (id === 'x' ? (world.viewing || world.team) === 'nova' : true);
    const list = [{ panel: 'a', show: true, team: 'prime' }, { panel: 'x', show: true, team: 'nova' }, { panel: 'b', show: true }];
    world.module.setLookHooks({
      viewAs: (step, run) => {
        world.viewing = step.team || world.team;
        try {
          return run();
        } finally {
          world.viewing = '';
        }
      },
      fits: () => true,
      begin: step => { if (step.team) world.team = step.team; world.log.push('begin ' + step.panel + ' as ' + world.team); },
    });
    world.module.startRotation('grid1', () => list, () => world.content);
    await world.settle();
    await world.pass(60);

    assert.deepEqual(world.log.filter(line => line.startsWith('begin')).slice(0, 4), ['begin a as prime', 'begin x as nova', 'begin b as nova', 'begin a as prime'], 'the Nova step has content while Prime is on the screen');
  });
});

test('a step that has no content for its team is left out and the Screens are not told about it', async () => {
  await inRotation(async world => {
    world.canShow = id => id !== 'b';
    world.module.setLookHooks(hooksFor(world));
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(60);

    assert.deepEqual(world.pagesOf('grid1').slice(0, 4), ['a', 'c', 'a', 'c']);
    assert.equal(world.log.some(line => line === 'begin b'), false);
  });
});

test('a step the Screens say does not fit is left out for now, and comes back when it fits', async () => {
  await inRotation(async world => {
    let fits = false;
    world.module.setLookHooks(hooksFor(world, { fits: step => step.panel !== 'b' || fits }));
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(60);
    assert.deepEqual(world.pagesOf('grid1').slice(0, 4), ['a', 'c', 'a', 'c']);

    fits = true;
    await world.pass(40);
    assert.ok(world.pagesOf('grid1').includes('b'));
  });
});

test('Screens that fail leave the step as it is: it is drawn, and the problem is written in the console', async () => {
  await inRotation(async world => {
    const complaints = [];
    const real = console.error;
    console.error = (...args) => complaints.push(args.join(' '));
    try {
      world.module.setLookHooks({
        viewAs: () => { throw new Error('broken'); },
        fits: () => { throw new Error('broken too'); },
        begin: () => { throw new Error('broken again'); },
      });
      world.module.startRotation('grid1', () => steps(['a', 'b']), () => world.content);
      await world.settle();
      await world.pass(60);
    } finally {
      console.error = real;
    }
    assert.deepEqual(world.pagesOf('grid1').slice(0, 3), ['a', 'b', 'a']);
    assert.ok(complaints.some(line => line.includes('could not answer fits')));
    assert.ok(complaints.some(line => line.includes('could not say which team')));
    assert.ok(complaints.some(line => line.includes('could not answer begin')));
  });
});

test('without the Screens the lists go round as they always did', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    await world.pass(60);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'c', 'a']);
  });
});

// Five steps in three rows: a is row 0, b c and x are row 1, y is row 2
const rowsList = [['a', 0], ['b', 1], ['c', 1], ['x', 1], ['y', 2]].map(entry => ({ panel: entry[0], show: true, row: entry[1] }));

test('Next look now leaves the row on screen with every step of it, and plays the first step of the next row', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid1', () => rowsList, () => world.content);
    await world.settle();
    await world.pass(20);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b'], 'b is on screen, the first step of row 1');

    world.module.skipRow();
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'y'], 'c and x are the rest of its row');
  });
});

test('Next look now on a row of one step, or on steps that have no row, plays the step after it', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid1', () => rowsList, () => world.content);
    await world.settle();
    world.module.skipRow();
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b'], 'a is a row of one step');
    world.module.skipRow();
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'y']);
    world.module.skipRow();
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b', 'y', 'a'], 'and over again');
  });

  await inRotation(async world => {
    world.module.startRotation('grid1', () => gridPlaylist, () => world.content);
    await world.settle();
    world.module.skipRow();
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid1'), ['a', 'b'], 'steps with no row number are one step each');
  });
});

test('Next look now moves nothing but the large panel', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid2', () => steps(['d']), () => world.content);
    await world.settle();
    const before = world.pagesOf('grid2').length;
    world.module.skipRow();
    await world.pass(1);
    assert.equal(world.pagesOf('grid2').length, before, 'the small panel keeps its own timer');
  });
});

// The docs

test('the docs name the views, the Screens that are kept, the hidden fields and the one swap', () => {
  const layouts = fs.readFileSync(path.join(docsFolder, 'layouts.md'), 'utf8').replace(/\s+/g, ' ');
  const editing = fs.readFileSync(path.join(docsFolder, 'editing-content.md'), 'utf8').replace(/\s+/g, ' ');

  assert.ok(layouts.includes('## The views'), 'layouts.md has the section');
  assert.ok(layouts.includes('## The swap'), 'and the swap');
  ['screenSchedule', 'mainRows', 'sideRows', 'swapSeconds', 'nameEffectEveryMinutes', 'hawkEveryMinutes', 'mondayStyle', 'dailyStyles', 'teamOrder', 'lookSwap', 'rotation.order', 'hidden'].forEach(word => assert.ok(layouts.includes(word), 'layouts.md names ' + word));
  ['Weekday schedule', 'Styles by day', 'Monday style', 'Team order', 'How the look changes', 'Order of the views', 'Screens, the second line', 'hidden and keep what was saved'].forEach(word => assert.ok(editing.includes(word), 'editing-content.md names ' + word));
  ['coaches-guide.md', 'switch-the-look.md', 'add-the-nova-team.md'].forEach(file => {
    assert.ok(!/Assemble, Slats or Cut/.test(readModule(path.join(docsFolder, file), 'utf8')), file + ' no longer offers the three swaps');
  });
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
if (failures > 0) process.exitCode = 1;
