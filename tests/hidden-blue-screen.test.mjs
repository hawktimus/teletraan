// Tests that the blue screen of the desktop reveal shows (dashboard/core/hidden-pictures.js,
// hidden-transitions.js, hidden.js, hidden-run.js, areas.js): the pictures are files of the repository and
// are all there, the desktop reveal cuts to a blue screen picture, a picture that did not load gives
// the other one or the plain backdrop, a push from the Studio and the chance both reach the screen, and
// no swap or panel transition takes the page change a due hidden transition needs. The settings that
// start it come through the cleaning of the content. Nothing is drawn and nothing touches the network.
//
//   node tests/hidden-blue-screen.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { readModule } from './helpers/read-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => readModule(path.join(dashboardFolder, file), 'utf8');

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-hidden-blue-'));
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
const hidden = await import(base + 'core/hidden.js');
const pictures = await import(base + 'core/hidden-pictures.js');
const { hiddenTransitions } = await import(base + 'core/hidden-transitions.js');
const { normalizeContent } = await import(base + 'core/sanity.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const now = new Date('2026-10-17T19:00:00Z');
const freeScreen = { motion: 'full', takeover: false, demo: false, night: false, playing: false };
const sixty = overrides => Object.assign({}, config.defaultSettings, { desktopEveryHours: 60, redEyesEveryHours: 60 }, overrides);
const choose = (settings, extra) => hidden.chooseHidden(Object.assign({ settings: settings, state: freeScreen, handled: '', lastFired: 0, now: now, random: () => 0.5, address: '' }, extra));
const secondsBefore = seconds => new Date(now.getTime() - seconds * 1000).toISOString();

function fakeStorage() {
  const kept = {};
  return { kept: kept, getItem: name => (name in kept ? kept[name] : null), setItem: (name, value) => { kept[name] = String(value); } };
}

// The pictures

test('the two blue screen pictures are files of the dashboard and are the size the list says', () => {
  const list = pictures.hiddenPictures.blueScreen;
  assert.equal(list.length, 2);
  list.forEach(picture => {
    const file = path.join(dashboardFolder, pictures.pictureAddress(picture));
    assert.ok(fs.existsSync(file), picture.file + ' is missing');
    assert.ok(fs.statSync(file).size > 1000, picture.file + ' is empty');
    const head = fs.readFileSync(file);
    assert.equal(head.readUInt32BE(16), picture.width, picture.file + ' width');
    assert.equal(head.readUInt32BE(20), picture.height, picture.file + ' height');
  });
});

test('the screen loads every picture of every set when the hidden transitions start', () => {
  const run = read('core/hidden-run.js');
  assert.match(run, /allPictures\(\)/);
  assert.match(run, /preloadImages\(pictures\.map\(pictureAddress\)\)/);
  assert.match(run, /pictureElements\[picture\.file\] = image/);
  assert.equal(pictures.allPictures().filter(picture => picture.set === 'blueScreen').length, 2);
});

test('the desktop reveal glitches blue, collapses, glitches again and cuts to the blue screen set', async () => {
  const steps = [];
  const scene = new Proxy({}, { get: (target, name) => async (...args) => { steps.push([name].concat(args).join(' ')); } });
  await hiddenTransitions.desktop.run(scene);
  assert.deepEqual(steps, ['glitch 2 blue', 'collapse blue', 'glitch 1 blue', 'pictureCut blueScreen 3', 'rebuild']);
});

test('the blue screen pictures take turns, and a picture that did not load is skipped', () => {
  const both = () => true;
  const chooser = pictures.makePictureChooser(fakeStorage());
  assert.equal(chooser.next('blueScreen', both).file, 'blue-screen-1.png');
  assert.equal(chooser.next('blueScreen', both).file, 'blue-screen-2.png');
  assert.equal(chooser.next('blueScreen', both).file, 'blue-screen-1.png');

  const onlySecond = pictures.makePictureChooser(fakeStorage());
  assert.equal(onlySecond.next('blueScreen', file => file === 'blue-screen-2.png').file, 'blue-screen-2.png');
  assert.equal(onlySecond.next('blueScreen', file => file === 'blue-screen-2.png').file, 'blue-screen-2.png');
});

test('with no picture loaded the step gets none, and the run falls back to the plain backdrop', () => {
  const chooser = pictures.makePictureChooser(fakeStorage());
  assert.equal(chooser.next('blueScreen', () => false), null);
  const run = read('core/hidden-run.js');
  assert.match(run, /if \(!picture\) return;/);
  assert.match(run, /did not load, so it is skipped/);
});

test('a storage that cannot be read still lets the blue screen set take turns', () => {
  const broken = { getItem: () => { throw new Error('off'); }, setItem: () => { throw new Error('off'); } };
  const chooser = pictures.makePictureChooser(broken);
  assert.equal(chooser.next('blueScreen', () => true).file, 'blue-screen-1.png');
  assert.equal(chooser.next('blueScreen', () => true).file, 'blue-screen-2.png');
});

// Starting it

test('a push for the desktop reveal that is a few seconds old plays, and one past a minute does not', () => {
  const fresh = sixty({ hiddenEnabled: true, hiddenRequest: { kind: 'desktop', requestedAt: secondsBefore(5) } });
  assert.deepEqual(choose(fresh), { kind: 'desktop', how: 'push' });
  const old = sixty({ hiddenEnabled: true, hiddenRequest: { kind: 'desktop', requestedAt: secondsBefore(75) } });
  assert.equal(choose(old), null);
});

test('the chance of the desktop reveal is still there with the hours of the live settings', () => {
  const settings = sixty({ hiddenEnabled: true });
  assert.deepEqual(choose(settings, { random: () => 0 }), { kind: 'desktop', how: 'chance' });
  assert.equal(choose(settings, { random: () => 0.5 }), null);
});

test('the settings reach the screen with the hours, the switch and the push the Studio wrote', () => {
  const saved = { hiddenEnabled: true, desktopEveryHours: 60, redEyesEveryHours: 60, hiddenRequest: { kind: 'desktop', requestedAt: secondsBefore(3) } };
  const settings = normalizeContent({ settings: saved }).settings;
  assert.equal(settings.hiddenEnabled, true);
  assert.equal(settings.desktopEveryHours, 60);
  assert.deepEqual(settings.hiddenRequest, saved.hiddenRequest);
});

test('the content query asks for the whole settings page, so every hidden transition field comes', () => {
  const query = read('core/sanity-query.js');
  assert.match(query, /"settings": \*\[_id == "dashboardSettings"\]\[0\] \{\s*\.\.\./);
});

// The page change

test('a due hidden transition is asked before the swap and the panel and view transitions', () => {
  const areas = read('core/areas.js');
  const hiddenAt = areas.indexOf('hiddenOffer()');
  const swapAt = areas.indexOf('swapOffer(old, next)');
  assert.ok(hiddenAt > 0 && swapAt > 0, 'both offers are asked');
  assert.ok(hiddenAt < swapAt, 'the hidden transition is asked first, so a swap cannot use up every page change of a push');
  assert.ok(!/yields/.test(areas) && !/yields/.test(read('core/transition-kinds.js')), 'no kind of change is let past a due hidden transition');
});

test('a swap that is waiting is not used up by a hidden transition that goes first', () => {
  const swap = read('core/swap-run-play.js');
  // The queue is read in offer(), which areas.js asks only after the hidden transition declined
  assert.match(swap, /const looked = queued \|\| lookWaiting\(\);\s*queued = false;/);
  const areas = read('core/areas.js');
  assert.match(areas, /if \(swapped\) return took;[\s\S]*if \(eligible && swapOffer\)/);
});

test('the Studio buttons write the kinds the screen has', () => {
  const kinds = Object.keys(hiddenTransitions);
  assert.deepEqual(kinds, ['desktop', 'redEyes']);
  const studio = fs.readFileSync(new URL('../studio/inputs/hidden-transitions.js', import.meta.url), 'utf8');
  kinds.forEach(kind => assert.ok(studio.includes("id: '" + kind + "'"), kind));
});

let failures = 0;
try {
  for (const item of tests) {
    try {
      await item.run();
      console.log('  ok   ' + item.name);
    } catch (error) {
      failures += 1;
      console.log('  FAIL ' + item.name + '\n       ' + String(error.message).split('\n').join('\n       '));
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
