// The Motion setting: full, light and calm (docs/transitions.md, "Full, Light and Calm"). What the screen plays comes from the address,
// the setting Motion, the setting Motion on the TV computer and whether the page runs on the Teletraan computer. The frame budget of a
// Full transition decides when a screen gives Full up. The rest is checked where it lives: the Studio fields in tests/schemas.test.mjs,
// the Display tab in tests/control-display.test.mjs, the classes of each theme in tests/transition-vocabulary.test.mjs.
//
//   node tests/motion-setting.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = file => import(pathToFileURL(path.join(root, file)).href);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const motion = await load('dashboard/core/motion.js');
const plan = await load('dashboard/core/reform-plan.js');
const config = await load('dashboard/config.js');
const display = await load('control/support/display.js');

let passed = 0;
async function test(name, run) {
  try {
    await run();
    passed += 1;
    console.log('ok    ' + name);
  } catch (error) {
    console.log('FAIL  ' + name + '\n' + error.stack);
    process.exitCode = 1;
  }
}

await test('the stored field motion takes full, light and calm, and the old values still work', () => {
  assert.deepEqual(config.motions, ['full', 'light', 'calm']);
  assert.deepEqual(config.kioskMotions, ['light', 'full']);
  assert.equal(config.defaultSettings.motion, 'full');
  assert.equal(config.defaultSettings.motionOnKiosk, 'light', 'the TV computer plays Light unless told otherwise');
  // a document that stored full or calm before Light existed is read as it always was
  assert.equal(motion.motionToPlay({ asked: '', setting: 'calm', kioskSetting: 'light', onKiosk: true }), 'calm');
  assert.equal(motion.motionToPlay({ asked: '', setting: 'full', kioskSetting: 'full', onKiosk: true }), 'full');
});

await test('the address wins, then the setting, and the TV computer plays Light when the setting says Full', () => {
  const play = (asked, setting, kioskSetting, onKiosk) => motion.motionToPlay({ asked: asked, setting: setting, kioskSetting: kioskSetting, onKiosk: onKiosk });

  // a laptop plays what the setting says
  assert.equal(play('', 'full', 'light', false), 'full');
  assert.equal(play('', 'light', 'light', false), 'light');
  assert.equal(play('', 'calm', 'light', false), 'calm');
  // the TV computer: Full becomes Light, unless Motion on the TV computer says Full
  assert.equal(play('', 'full', 'light', true), 'light');
  assert.equal(play('', 'full', undefined, true), 'light', 'a document with no such field is the starting value, light');
  assert.equal(play('', 'full', 'full', true), 'full');
  assert.equal(play('', 'light', 'full', true), 'light');
  assert.equal(play('', 'calm', 'light', true), 'calm');
  // the address wins everywhere, so a spare computer can be told to play Full
  assert.equal(play('full', 'calm', 'light', true), 'full');
  assert.equal(play('light', 'full', 'full', false), 'light');
  assert.equal(play('calm', 'full', 'full', false), 'calm');
  assert.equal(play('none', 'full', 'full', false), 'none');
  // nothing known is Full, and a word that is not a motion is ignored
  assert.equal(play('', undefined, undefined, false), 'full');
  assert.equal(play('fast', 'light', 'light', false), 'light');
  assert.equal(play('', 'sparkly', 'light', true), 'light');
});

await test('motionOf reads ?motion= from the address and the kiosk it was told about', () => {
  motion.useKiosk(false);
  assert.equal(motion.motionOf(new URLSearchParams(''), { motion: 'full', motionOnKiosk: 'light' }), 'full');
  assert.equal(motion.motionOf(new URLSearchParams('motion=light'), { motion: 'full' }), 'light');
  motion.useKiosk(true);
  assert.equal(motion.motionOf(new URLSearchParams(''), { motion: 'full', motionOnKiosk: 'light' }), 'light');
  assert.equal(motion.motionOf(new URLSearchParams('?motion=full'), { motion: 'full', motionOnKiosk: 'light' }), 'full');
  assert.equal(motion.motionOf(new URLSearchParams(''), null), 'light', 'before the content is read the TV computer is already light');
  motion.useKiosk(false);
});

await test('the Teletraan computer is told apart by device.json, which only its kiosk script writes', async () => {
  assert.equal(motion.deviceIsKiosk({ hostname: 'hawktimus-mini', wifi: '192.168.1.23' }), true);
  assert.equal(motion.deviceIsKiosk({}), false);
  assert.equal(motion.deviceIsKiosk(null), false);
  assert.equal(motion.deviceIsKiosk({ hostname: 'bad host!' }), false);
  const answer = (ok, json) => async () => ({ ok: ok, json: async () => json });
  assert.equal(await motion.readKiosk(answer(true, { hostname: 'hawktimus-mini' })), true);
  assert.equal(await motion.readKiosk(answer(false, {})), false, 'a missing file is a laptop');
  assert.equal(await motion.readKiosk(async () => { throw new Error('offline'); }), false);
  assert.equal(await motion.readKiosk(async () => ({ ok: true, json: async () => { throw new Error('bad json'); } })), false);
  assert.equal(await motion.readKiosk(null), false);
  const ask = [];
  await motion.readKiosk(async (url, options) => { ask.push([url, options]); return { ok: false }; });
  assert.ok(ask[0][0].endsWith('data/live/device.json') && ask[0][1].cache === 'no-store');
});

await test('Light has no swap: a held look or a Monday card is changed under the plates of the view transition, and calm and no motion have none', () => {
  const base = { motion: 'full', busy: false, running: false, slow: false, off: false };
  assert.equal(plan.kindToPlay('reform', Object.assign({}, base, { looked: true, light: true })), 'reformView');
  assert.equal(plan.kindToPlay('reform', Object.assign({}, base, { monday: true, light: true })), 'reformView');
  assert.equal(plan.kindToPlay('reform', Object.assign({}, base, { light: true })), 'reform');
  assert.equal(plan.kindToPlay('reformView', Object.assign({}, base, { looked: true, light: true })), 'reformView');
  assert.equal(plan.kindToPlay('', Object.assign({}, base, { looked: true, light: true })), '');
  // Full still hands a held look to the swap
  assert.equal(plan.kindToPlay('reform', Object.assign({}, base, { looked: true })), '');
  ['calm', 'none'].forEach(mode => assert.equal(plan.kindToPlay('reform', Object.assign({}, base, { motion: mode, light: true })), ''));
  assert.equal(plan.kindToPlay('reform', Object.assign({}, base, { light: true, slow: true })), '', 'the slow screen guard stays');
  assert.equal(plan.kindToPlay('reform', Object.assign({}, base, { light: true, off: true })), '', '?reform=off stays');
});

await test('a Light transition is never longer than the shortest Full one, and a Full run is capped in animated elements', () => {
  const light = plan.lightTimes.closeMs + plan.lightTimes.openMs;
  assert.ok(light <= plan.reformSeconds.min * 1000 / 2, 'Light takes ' + light + ' ms');
  assert.ok(plan.animatedLimit.panel >= 387 && plan.animatedLimit.panel <= 500);
  assert.ok(plan.animatedLimit.view <= 500, "a view animates at most 500 elements");
  // the view draws coarser grids than the panel, which is what keeps a view under its limit
  Object.keys(plan.viewGrids).forEach(name => assert.ok(plan.viewGrids[name].cols * plan.viewGrids[name].rows <= plan.grids[name].cols * plan.grids[name].rows, name));
  assert.equal(plan.grids['view-main'], plan.viewGrids.main);
});

await test('a Full screen gives up after two transitions in a row that miss their frame budget, and says so once', () => {
  motion.forgetRuns();
  const good = Array.from({ length: 100 }, () => 17);
  const slow = Array.from({ length: 100 }, (item, index) => (index % 3 === 0 ? 67 : 20));
  const warnings = [];
  const realWarn = console.warn;
  console.warn = line => warnings.push(line);

  try {
    assert.equal(motion.missedBudget(good), false);
    assert.equal(motion.missedBudget(slow), true);
    assert.equal(motion.missedBudget(good.concat([250])), true, 'one frame over 200 ms is a miss');
    assert.equal(motion.missedBudget([100, 100]), false, 'too few frames to judge');

    assert.equal(motion.noteRun(slow), false);
    assert.equal(motion.noteRun(good), false, 'a good run in between starts the count again');
    assert.equal(motion.noteRun(slow), false);
    assert.equal(motion.isDegraded(), false);
    assert.equal(motion.noteRun(slow), true, 'the second miss in a row');
    assert.equal(motion.isDegraded(), true);
    assert.equal(motion.noteRun(slow), false, 'once');
    assert.equal(warnings.length, 1);
    assert.ok(/Light/.test(warnings[0]));
  } finally {
    console.warn = realWarn;
    motion.forgetRuns();
  }
});

await test('the page writes the weight, the idle sweeps rest while a transition plays and stand still in Light, and Light has no hidden transition', () => {
  const pages = read('dashboard/frame-pages.js');
  assert.ok(pages.includes("'light'") && pages.includes('page.dataset.weight') && pages.includes('onDegraded(writeWeight)'));
  const busy = read('dashboard/core/busy.js');
  assert.ok(busy.includes('page.dataset.moving'));
  const frame = read('dashboard/frame.css');
  assert.ok(frame.includes('[data-moving] .glint') && frame.includes('[data-weight="light"] .glint-layer'));
  assert.ok(read('dashboard/base.css').includes('html[data-weight="light"] #theme-bg *'));
  assert.ok(read('dashboard/seasons/motion.css').includes('[data-weight="light"] .season-piece'));
  const hidden = read('dashboard/core/hidden-run.js');
  assert.ok(hidden.includes("frame.weightNow() === 'light'"), 'a hidden transition is not played in Light');
  const kinds = read('dashboard/core/transition-kinds.js');
  assert.ok(kinds.includes('found.light(swapPage, context)') && kinds.includes('playWatched'), 'Light plays its own run, and a Full run is watched');
});

await test('the Display tab reads and writes motion and motionOnKiosk into the draft, and nothing else of the tab changes', () => {
  assert.deepEqual(display.motionOf(null), { motion: 'full', motionOnKiosk: 'light' });
  assert.deepEqual(display.motionOf({ motion: 'light', motionOnKiosk: 'full' }), { motion: 'light', motionOnKiosk: 'full' });
  assert.deepEqual(display.motionOf({ motion: 'sparkly', motionOnKiosk: 'x' }), { motion: 'full', motionOnKiosk: 'light' });
  assert.deepEqual(display.cleanMotion({ motion: 'calm' }), { motion: 'calm' });
  assert.deepEqual(display.cleanMotion({ motion: 'light', motionOnKiosk: 'full' }), { motion: 'light', motionOnKiosk: 'full' });
  assert.deepEqual(display.cleanMotion(undefined), {});
  assert.throws(() => display.cleanMotion({ motion: 'none' }), error => error.status === 400);
  assert.throws(() => display.cleanMotion({ motionOnKiosk: 'calm' }), error => error.status === 400);
  assert.throws(() => display.cleanMotion('full'), error => error.status === 400);
  const route = read('control/routes/display.js');
  assert.ok(route.includes('cleanMotion(body.motion)') && route.includes('motion: motionOf(source)'));
});

console.log('\n' + passed + ' passed');
