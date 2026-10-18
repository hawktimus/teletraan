// Tests for the Foundry kit of the panel and view transitions (dashboard/styles/foundry/transitions.js, reform-kit.css): it is its
// own kit and not the Original one, it adds deadbolts, a hand wheel, rams and gauges to every region, the bolts are drawn back
// before anything folds and are home last, the stage is jolted twice, and the stylesheet moves transform and opacity only and
// writes no color. The motion tests (tests/motion/reform.mjs) play it in a browser.
//
//   node tests/reform-foundry.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboard = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboard, file), 'utf8');
const load = file => import(pathToFileURL(path.join(dashboard, file)).href);
const plan = await load('core/reform-plan.js');
const original = await load('styles/original/transitions.js');
const foundry = await load('styles/foundry/transitions.js');
const kit = foundry.kit;

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

const main = { x: 356, y: 216, w: 1532, h: 736 };
const banner = { x: 32, y: 32, w: 1856, h: 160 };
const roles = list => list.map(item => item.role);
const count = (list, role) => list.filter(item => item.role === role).length;

await test('the foundry kit is its own object with its own id, and keeps the Original pieces', () => {
  assert.notEqual(kit, original.kit);
  assert.equal(kit.id, 'foundry');
  ['screw', 'latch', 'brace', 'rivet', 'gear', 'piston', 'tooth'].forEach(role => assert.equal(kit.draw(role), original.kit.draw(role), role));
  assert.equal(kit.draw('chassis'), '');
  assert.equal(kit.draw('nothing'), '');
});

await test('the kit draws the extra roles as svg, and the extras only use roles the kit draws', () => {
  ['deadbolt', 'wheel', 'ram', 'gauge', 'needle'].forEach(role => assert.ok(kit.draw(role).startsWith('<svg'), role));
  roles(kit.partsOf(main, false).concat(kit.partsOf(banner, true))).forEach(role => assert.ok(kit.draw(role) !== '', role));
});

await test('a large region gets three deadbolts on the top and bottom, two on each side, a wheel, four rams and two gauges', () => {
  const list = kit.partsOf(main, false);
  assert.equal(count(list, 'deadbolt'), 10);
  assert.equal(list.filter(item => item.edge === 'top').length, 3);
  assert.equal(list.filter(item => item.edge === 'bottom').length, 3);
  assert.equal(list.filter(item => item.edge === 'left').length, 2);
  assert.equal(list.filter(item => item.edge === 'right').length, 2);
  assert.equal(count(list, 'wheel'), 1);
  assert.equal(count(list, 'ram'), 4);
  assert.equal(count(list, 'gauge'), 2);
  assert.equal(count(list, 'needle'), 2);
  const wheel = list.find(item => item.role === 'wheel');
  assert.ok(wheel.x > main.x + main.w / 2 && wheel.y < main.y + 40, 'the wheel is at the top right');
});

await test('a thin strip keeps the deadbolts and the wheel and has no rams or gauges, and a region that moves has the same pieces in the same order', () => {
  const list = kit.partsOf(banner, true);
  assert.equal(count(list, 'deadbolt'), 10);
  assert.equal(count(list, 'wheel'), 1);
  assert.equal(count(list, 'ram') + count(list, 'gauge') + count(list, 'needle'), 0);
  assert.deepEqual(roles(kit.partsOf(main, false)), roles(kit.partsOf({ x: 40, y: 256, w: 1152, h: 708 }, false)));
});

await test('every deadbolt is drawn back before the folding starts and is home after the last screw begins to turn in, and every track runs the whole skeleton', () => {
  const bolts = kit.partsOf(main, false).filter(item => item.role === 'deadbolt');
  bolts.forEach(bolt => {
    assert.equal(bolt.own, true, 'the bolt has its own stops');
    const times = bolt.stops.map(stop => stop[0]);
    assert.deepEqual(times, times.slice().sort((a, b) => a - b), 'the times go forward');
    assert.equal(times[0], 0);
    assert.equal(times[times.length - 1], plan.reformTimes.totalMs);
    const out = bolt.stops.find(stop => /translate\((-?44)px,0px\)|translate\(0px,(-?44)px\)/.test(stop[1]));
    assert.ok(out, 'the bolt has a stop where it is drawn back');
    assert.ok(out[0] <= plan.reformTimes.fold[0] + 20, 'drawn back by the time the edges fold: ' + out[0]);
    const home = bolt.stops.filter(stop => /translate\(0px,0px\) rotate\(\d+deg\) scale\(1\)/.test(stop[1])).pop();
    assert.ok(home[0] >= plan.reformTimes.tighten[0] + 200, 'home late in the tighten phase: ' + home[0]);
    bolt.stops.forEach(stop => assert.ok(/^translate\(.+\) rotate\(.+\) scale\(.+\)$/.test(stop[1]), 'one list of functions: ' + stop[1]));
  });
});

await test('the wheel spins open and shut, the rams push out while the frame is open and the needles sweep over a span of the run', () => {
  const list = kit.partsOf(main, false);
  const wheel = list.find(item => item.role === 'wheel');
  assert.ok(wheel.stops.some(stop => stop[1] === 'rotate(-540deg)'));
  assert.equal(wheel.stops[wheel.stops.length - 1][1], 'rotate(0deg)');
  list.filter(item => item.role === 'ram').forEach(ram => {
    const out = ram.stops.filter(stop => /translateX\(26px\)/.test(stop[1]));
    assert.ok(out.length >= 2);
    assert.ok(out[0][0] <= plan.reformTimes.fold[1] + 20 && out[out.length - 1][0] >= plan.reformTimes.turn[1]);
  });
  list.filter(item => item.role === 'needle').forEach(needle => {
    const values = new Set(needle.stops.map(stop => stop[1]));
    assert.ok(values.size >= 4, 'the needle sweeps');
    assert.ok(needle.stops[needle.stops.length - 1][0] >= 2300);
  });
});

await test('the stage is jolted when the bolts first break and again when they lock, and only by a translate', () => {
  const stops = kit.jolt();
  const moves = stops.filter(stop => stop[1] !== 'translate(0px,0px)');
  assert.ok(moves.length >= 4);
  moves.forEach(stop => assert.ok(/^translate\(-?\d+px,-?\d+px\)$/.test(stop[1]), stop[1]));
  assert.ok(moves[0][0] <= 200, 'the first jolt is at the start');
  assert.ok(moves[moves.length - 1][0] >= 2800, 'the second is when the bolts lock');
  const times = stops.map(stop => stop[0]);
  assert.deepEqual(times, times.slice().sort((a, b) => a - b));
});

await test('the stylesheet of the kit moves nothing by itself, has no filter or blur or animated shadow, and writes no color', () => {
  const css = read('styles/foundry/reform-kit.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/animation|transition\s*:|@keyframes/.test(css), false, 'the engine makes every move');
  assert.equal(/(^|[\s;{(])(-webkit-)?(backdrop-)?filter\s*:|blur\(|drop-shadow\(/.test(css), false);
  assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(css), false, 'colors are tokens');
  assert.equal(/perspective/.test(css), false);
  const code = read('styles/foundry/transitions.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  assert.equal(/#[0-9a-fA-F]{3,8}\b|rgba?\(|filter\s*:|blur|perspective\(/.test(code), false, 'the kit code writes no color and no filter');
  assert.equal(/\bid="/.test(code), false, 'no id in the markup, they must be unique');
  ['--style-steel-dark', '--style-hazard'].forEach(token => assert.ok(css.includes(token), token));
});

await test('the kit is linked from index.html on a line of its own, after the engine styles, and the engine asks the kit for its extras', () => {
  const page = read('index.html');
  const lines = page.split('\n');
  const own = lines.findIndex(line => line.includes('styles/foundry/reform-kit.css'));
  assert.ok(own > 0);
  assert.ok(own > lines.findIndex(line => line.includes('href="reform-kit.css')));
  assert.equal(lines.filter(line => line.includes('styles/foundry/reform-kit.css')).length, 1);
  const draw = read('core/reform-draw.js');
  assert.ok(draw.includes('kit.extras') && draw.includes('kit.jolt'));
});

console.log('\n' + passed + ' passed');
