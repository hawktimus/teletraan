// Tests that the hidden transitions come about once every so many hours of screen time
// (dashboard/core/hidden.js): the chance of one page change from the hours and the pace of
// the large panel, the older percent that a page saved before the hours existed still
// uses, the cleaning of the hours, and the gap of hiddenGapHours after any transition
// has played, with the time kept in localStorage. Nothing is drawn and nothing touches
// the network.
//
//   node tools/test-hidden-hours.mjs

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
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-hidden-hours-'));
fs.mkdirSync(path.join(workFolder, 'dashboard/core'), { recursive: true });
fs.mkdirSync(path.join(workFolder, 'dashboard/themes/overlays'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(workFolder, 'dashboard', file));
});
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(workFolder, 'dashboard/core', file));
});
const base = pathToFileURL(path.join(workFolder, 'dashboard')).href + '/';
const config = await import(base + 'config.js');
const hidden = await import(base + 'core/hidden.js');
const registry = await import(base + 'core/hidden-transitions.js');
const { normalizeContent, normalizeSample } = await import(base + 'core/sanity.js');
const { withDefaults } = await import(base + 'core/content.js');

const { chancePerChange, chooseHidden, gapHolds, hoursFields, paceSecondsOf, readLastFired, rememberLastFired, tidyHours } = hidden;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const hour = 3600 * 1000;
const now = new Date('2026-10-08T19:00:00Z');
const before = milliseconds => now.getTime() - milliseconds;
const freeScreen = { motion: 'full', takeover: false, demo: false, night: false, playing: false };

// Settings with both transitions at 60 hours, and the starting values for the rest
const sixty = overrides => Object.assign({}, config.defaultSettings, { desktopEveryHours: 60, redEyesEveryHours: 60 }, overrides);

// Asks chooseHidden what happens at one page change, with the number the random function gives.
// calls counts how many times it was asked for one.
function chooseAt(roll, settings, extra) {
  const calls = { random: 0 };
  const choice = chooseHidden(Object.assign({
    settings: settings,
    state: freeScreen,
    handled: '',
    lastFired: 0,
    now: now,
    random: () => { calls.random += 1; return roll; },
    address: '',
  }, extra));
  return { choice: choice, calls: calls.random };
}

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

// The three ways a settings page reaches the screen
function settingsThrough(settings) {
  return [
    normalizeContent({ settings: settings }).settings,
    normalizeSample({ settings: settings }).settings,
    withDefaults({ settings: settings }).settings,
  ];
}

// The chance

test('a page change every 20 seconds and 60 hours give 1 chance in 10800', () => {
  assert.equal(Math.round(1 / chancePerChange(60, 20)), 10800);
  assert.equal(Math.round(1 / chancePerChange(1, 20)), 180);
  assert.equal(Math.round(1 / chancePerChange(1000, 20)), 180000);

  // the first 1 in 10800 of the rolls is the desktop reveal and the next 1 in 10800 is red eyes
  const settings = sixty();
  const share = 1 / 10800;
  assert.deepEqual(chooseAt(0, settings).choice, { kind: 'desktop', how: 'chance' });
  assert.deepEqual(chooseAt(share * 0.99, settings).choice, { kind: 'desktop', how: 'chance' });
  assert.deepEqual(chooseAt(share * 1.01, settings).choice, { kind: 'redEyes', how: 'chance' });
  assert.deepEqual(chooseAt(share * 1.99, settings).choice, { kind: 'redEyes', how: 'chance' });
  assert.equal(chooseAt(share * 2.01, settings).choice, null);
  assert.equal(chooseAt(0.5, settings).choice, null);
  assert.equal(chooseAt(0.9999, settings).choice, null);
});

test('over many page changes at 60 hours a transition plays about once in 10800', () => {
  // a plain generator with a fixed start, so the test gives the same answer every time
  let seed = 4242;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const settings = sixty({ desktopEveryHours: 1, redEyesEveryHours: 2 });
  const counts = { desktop: 0, redEyes: 0 };
  const draws = 200000;
  for (let count = 0; count < draws; count++) {
    const choice = chooseHidden({ settings: settings, state: freeScreen, handled: '', lastFired: 0, now: now, random: random, address: '' });
    if (choice) counts[choice.kind] += 1;
  }
  // once an hour is 1 page change in 180, and once in two hours is 1 in 360
  assert.ok(Math.abs(counts.desktop / draws - 1 / 180) < 0.0005, 'desktop ' + counts.desktop / draws);
  assert.ok(Math.abs(counts.redEyes / draws - 1 / 360) < 0.0005, 'red eyes ' + counts.redEyes / draws);
});

test('the pace is Seconds per page made longer or shorter by Speed, and 20 seconds when the settings say nothing', () => {
  assert.equal(paceSecondsOf(config.defaultSettings), 20);
  assert.equal(paceSecondsOf({}), 20);
  assert.equal(paceSecondsOf({ pageSeconds: 30 }), 30);
  assert.equal(paceSecondsOf({ pageSeconds: 20, speed: 'slow' }), 30);
  assert.equal(paceSecondsOf({ pageSeconds: 20, speed: 'fast' }), 15);
  [0, -5, NaN, '30', null].forEach(value => assert.equal(paceSecondsOf({ pageSeconds: value }), 20, String(value)));
  assert.equal(paceSecondsOf({ speed: 'sideways' }), 20);

  // a longer pace gives a bigger chance for each page change, so the hours stay the hours
  const slow = sixty({ pageSeconds: 40 });
  const share = 40 / (60 * 3600);
  assert.deepEqual(chooseAt(share * 0.99, slow).choice, { kind: 'desktop', how: 'chance' });
  assert.deepEqual(chooseAt(share * 1.01, slow).choice, { kind: 'redEyes', how: 'chance' });
});

test('hours set on a transition win over its percent, and each transition has its own', () => {
  const sure = sixty({ desktopChance: 100, redEyesChance: 100 });
  assert.equal(chooseAt(0.5, sure).choice, null, 'the percent is not read');

  // desktop has no hours and a percent of 0, so red eyes has the first of the rolls: 1 in 180 is 0.0055
  const onlyRed = sixty({ desktopEveryHours: 0, desktopChance: 0, redEyesEveryHours: 1 });
  [0, 0.001, 0.005].forEach(roll => assert.deepEqual(chooseAt(roll, onlyRed).choice, { kind: 'redEyes', how: 'chance' }, 'roll ' + roll));
  assert.equal(chooseAt(0.006, onlyRed).choice, null);
});

// The percent, for a page saved before the hours

test('a page with no hours rolls by its percent, as it always did', () => {
  [undefined, null, 0, -5, 0.5, NaN, Infinity, '60', true, [], {}].forEach(value => {
    const settings = Object.assign({}, config.defaultSettings, { desktopEveryHours: value, redEyesEveryHours: value });
    const label = String(value);
    assert.deepEqual(chooseAt(0.005, settings).choice, { kind: 'desktop', how: 'chance' }, label);
    assert.deepEqual(chooseAt(0.015, settings).choice, { kind: 'redEyes', how: 'chance' }, label);
    assert.equal(chooseAt(0.02, settings).choice, null, label);
  });

  const noFields = Object.assign({}, config.defaultSettings);
  delete noFields.desktopEveryHours;
  delete noFields.redEyesEveryHours;
  assert.deepEqual(chooseAt(0.005, noFields).choice, { kind: 'desktop', how: 'chance' });

  const fivePercent = Object.assign({}, noFields, { desktopChance: 5, redEyesChance: 0 });
  assert.deepEqual(chooseAt(0.049, fivePercent).choice, { kind: 'desktop', how: 'chance' });
  assert.equal(chooseAt(0.05, fivePercent).choice, null);
});

test('one transition can have hours while the other still has a percent', () => {
  const mixed = Object.assign({}, config.defaultSettings, { desktopEveryHours: 60, desktopChance: 50, redEyesEveryHours: 0, redEyesChance: 10 });
  const share = 1 / 10800;
  assert.deepEqual(chooseAt(0, mixed).choice, { kind: 'desktop', how: 'chance' });
  assert.deepEqual(chooseAt(share * 1.01, mixed).choice, { kind: 'redEyes', how: 'chance' });
  assert.deepEqual(chooseAt(0.05, mixed).choice, { kind: 'redEyes', how: 'chance' });
  assert.equal(chooseAt(0.11, mixed).choice, null);
});

test('the hours are cleaned to 1 to 1000, and anything else is 0, which is not set', () => {
  assert.deepEqual(hoursFields(), ['desktopEveryHours', 'redEyesEveryHours']);

  [[1, 1], [60, 60], [1000, 1000], [2.5, 2.5], [1001, 1000], [99999, 1000], [0, 0], [0.5, 0], [-3, 0]].forEach(([value, wanted]) => {
    assert.equal(tidyHours(value, 'desktopEveryHours'), wanted, String(value));
    settingsThrough({ desktopEveryHours: value, redEyesEveryHours: value }).forEach(settings => {
      assert.deepEqual([settings.desktopEveryHours, settings.redEyesEveryHours], [wanted, wanted], String(value));
    });
  });
  [undefined, null, '', '60', NaN, Infinity, true, [], {}].forEach(value => {
    assert.equal(tidyHours(value, 'redEyesEveryHours'), 0, String(value));
    settingsThrough({ desktopEveryHours: value, redEyesEveryHours: value }).forEach(settings => {
      assert.deepEqual([settings.desktopEveryHours, settings.redEyesEveryHours], [0, 0], String(value));
    });
  });
  assert.equal(tidyHours(60, 'notAField'), 0, 'a name with no limits');

  // a page with no hours at all stays at 0 on the way in, so it keeps its percent
  settingsThrough({ desktopChance: 5 }).forEach(settings => {
    assert.deepEqual([settings.desktopEveryHours, settings.redEyesEveryHours, settings.desktopChance], [0, 0, 5]);
    assert.deepEqual(chooseAt(0.049, settings).choice, { kind: 'desktop', how: 'chance' });
  });
});

test('every transition in the registry has hours with limits, a starting value of 0 and a place in the sample content', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(dashboardFolder, 'data/sample/content.json'), 'utf8'));

  Object.keys(registry.hiddenTransitions).forEach(id => {
    const name = registry.hiddenTransitions[id].hoursField;
    assert.equal(typeof name, 'string', id);
    assert.deepEqual(config.limits[name], { min: 1, max: 1000 }, name);
    assert.equal(config.defaultSettings[name], 0, name + ' starts as not set');
    assert.equal(sample.settings[name], 60, name + ' in the sample content');
  });
});

// The gap

test('after a transition has played none comes about by chance for 4 hours', () => {
  assert.equal(config.hiddenGapHours, 4);
  const sure = sixty({ desktopEveryHours: 0, desktopChance: 100 });

  assert.deepEqual(chooseAt(0, sure, { lastFired: 0 }).choice, { kind: 'desktop', how: 'chance' }, 'none has played yet');
  assert.equal(chooseAt(0, sure, { lastFired: before(1000) }).choice, null, 'a second ago');
  assert.equal(chooseAt(0, sure, { lastFired: before(3 * hour) }).choice, null, '3 hours ago');
  assert.equal(chooseAt(0, sure, { lastFired: before(4 * hour - 1) }).choice, null, 'a millisecond short of 4 hours');
  assert.deepEqual(chooseAt(0, sure, { lastFired: before(4 * hour) }).choice, { kind: 'desktop', how: 'chance' }, '4 hours ago');
  assert.deepEqual(chooseAt(0, sure, { lastFired: before(30 * hour) }).choice, { kind: 'desktop', how: 'chance' }, '30 hours ago');
});

test('the gap blocks a second play: play one, remember its time, and the next page changes are plain until 4 hours have passed', () => {
  const storage = fakeStorage();
  const sure = sixty({ desktopEveryHours: 0, desktopChance: 100 });
  const at = milliseconds => new Date(now.getTime() + milliseconds);

  let lastFired = readLastFired(storage);
  const first = chooseAt(0, sure, { lastFired: lastFired, now: at(0) });
  assert.deepEqual(first.choice, { kind: 'desktop', how: 'chance' });

  rememberLastFired(storage, at(0).getTime());
  lastFired = readLastFired(storage);
  [20 * 1000, 10 * 60 * 1000, 3 * hour, 4 * hour - 20 * 1000].forEach(later => {
    assert.equal(chooseAt(0, sure, { lastFired: lastFired, now: at(later) }).choice, null, later + ' ms later');
  });
  assert.deepEqual(chooseAt(0, sure, { lastFired: lastFired, now: at(4 * hour) }).choice, { kind: 'desktop', how: 'chance' }, '4 hours later');
});

test('the gap draws no random number, and a time in the future holds nothing back', () => {
  const sure = sixty({ desktopEveryHours: 0, desktopChance: 100 });
  assert.equal(chooseAt(0, sure, { lastFired: before(hour) }).calls, 0);
  assert.equal(chooseAt(0, sure, { lastFired: before(5 * hour) }).calls, 1);

  assert.equal(gapHolds(before(hour), now), true);
  assert.equal(gapHolds(before(5 * hour), now), false);
  assert.equal(gapHolds(now.getTime() + hour, now), false, 'a clock that moved back');
  [0, -1, NaN, null, undefined, '5', 'soon'].forEach(value => assert.equal(gapHolds(value, now), false, String(value)));
});

test('a push from the Studio and the address ignore the gap, and the other rules still hold', () => {
  const recent = { lastFired: before(1000) };
  const pushed = sixty({ hiddenRequest: { kind: 'redEyes', requestedAt: new Date(now.getTime() - 5000).toISOString() } });

  assert.deepEqual(chooseAt(0.9, pushed, recent).choice, { kind: 'redEyes', how: 'push' });
  assert.deepEqual(chooseAt(0.9, sixty(), Object.assign({ address: 'desktop' }, recent)).choice, { kind: 'desktop', how: 'address' });

  const off = Object.assign({}, pushed, { hiddenEnabled: false });
  assert.equal(chooseAt(0.9, off, recent).choice, null, 'the master switch');
  const calm = Object.assign({}, freeScreen, { motion: 'calm' });
  assert.equal(chooseAt(0.9, pushed, Object.assign({ state: calm }, recent)).choice, null, 'calm motion');
});

test('the time is read from localStorage, kept there, and lost without a fuss when the storage fails', () => {
  const storage = fakeStorage();
  assert.equal(readLastFired(storage), 0, 'nothing kept yet');
  assert.equal(rememberLastFired(storage, 1791486000000), true);
  assert.equal(readLastFired(storage), 1791486000000);
  assert.equal(storage.kept['teletraan-hidden-last-fired'], '1791486000000');

  // what is kept is not a time
  ['', 'soon', '-5', '0', 'NaN', 'Infinity'].forEach(text => {
    const odd = fakeStorage();
    odd.kept['teletraan-hidden-last-fired'] = text;
    assert.equal(readLastFired(odd), 0, JSON.stringify(text));
  });

  // storage that throws, and no storage at all
  assert.equal(readLastFired(brokenStorage), 0);
  assert.equal(rememberLastFired(brokenStorage, 1791486000000), false);
  assert.equal(readLastFired(null), 0);
  assert.equal(rememberLastFired(null, 1791486000000), false);

  // with no storage the gap still works from the time the runner keeps in memory
  const sure = sixty({ desktopEveryHours: 0, desktopChance: 100 });
  const inMemory = before(hour);
  assert.equal(rememberLastFired(brokenStorage, inMemory), false);
  assert.equal(chooseAt(0, sure, { lastFired: inMemory }).choice, null);
});

test('the runner passes the time of the last transition in, and keeps it when one starts', () => {
  const run = read('core/hidden-run.js');
  assert.ok(run.includes('lastFired = readLastFired(storage);'), 'read at the start');
  assert.ok(run.includes('lastFired: lastFired,'), 'given to chooseHidden');
  assert.ok(run.includes('lastFired = Date.now();') && run.includes('rememberLastFired(storage, lastFired);'), 'kept when one starts');

  // kept whatever started it, so after the check for how
  const started = run.indexOf('lastFired = Date.now();');
  const check = run.indexOf("if (choice.how === 'address') addressKind = '';");
  assert.ok(check !== -1 && started > check, 'after the push and the address are marked as played');
});

test('the docs give the same hours and gap as the code', () => {
  const doc = fs.readFileSync(path.join(docsFolder, 'hidden-transitions.md'), 'utf8').replace(/\s+/g, ' ');
  assert.ok(doc.includes('hiddenGapHours'), 'names the gap constant');
  assert.ok(new RegExp(config.hiddenGapHours + ' hours').test(doc), 'gives the gap');
  assert.ok(doc.includes('1 in 10800'), 'gives the example');
  assert.ok(doc.includes('teletraan-hidden-last-fired'), 'names the localStorage key');
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
