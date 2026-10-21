// Tests for the Foundry kit of the panel and view transitions (dashboard/styles/foundry/transitions.js, reform-kit.css): it is its
// own kit and not the Original one, it adds deadbolts, a hand wheel with a clamp ring, rams with rods, gauges, shutters and a train of cogs, the bolts are drawn back
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

await test('the foundry kit is its own object with its own id, and draws every piece itself', () => {
  assert.notEqual(kit, original.kit);
  assert.equal(kit.id, 'foundry');
  ['screw', 'latch', 'brace', 'rivet', 'gear', 'piston', 'tooth'].forEach(role => {
    assert.ok(kit.draw(role).startsWith('<svg'), role);
    assert.notEqual(kit.draw(role), original.kit.draw(role), role + ' is not the Original drawing');
    assert.ok(!/class="rk-/.test(kit.draw(role)), role + ' uses a class of the Original kit');
  });
  assert.ok(kit.squares, 'the squares are steel plates of its own');
  assert.equal(kit.lockParts, undefined, 'no cells with lock pins');
  assert.equal(kit.draw('chassis'), '');
  assert.equal(kit.draw('nothing'), '');
});

await test('the kit draws the extra roles as svg (the shutter leaf is a span for the plate that slides in it), and the extras only use roles the kit draws', () => {
  ['deadbolt', 'wheel', 'ring', 'ram', 'rod', 'gauge', 'needle', 'cog', 'cogs', 'seam'].forEach(role => assert.ok(kit.draw(role).startsWith('<svg'), role));
  assert.ok(kit.draw('leaf').startsWith('<span class="fk-leaf-plate"'));
  roles(kit.partsOf(main, false).concat(kit.partsOf(banner, true), kit.partsOf(main, false, { mode: 'view', main: true }))).forEach(role => assert.ok(kit.draw(role) !== '', role));
});

await test('a large panel gets three deadbolts on the top and bottom, two on each side, a wheel in a clamp ring, four rams with their rods, two gauges, two shutters with a locking bar and a train of seven cogs', () => {
  const list = kit.partsOf(main, false);
  assert.equal(count(list, 'deadbolt'), 10);
  assert.equal(list.filter(item => item.edge === 'top').length, 3);
  assert.equal(list.filter(item => item.edge === 'bottom').length, 3);
  assert.equal(list.filter(item => item.edge === 'left').length, 2);
  assert.equal(list.filter(item => item.edge === 'right').length, 2);
  assert.equal(count(list, 'wheel'), 1);
  assert.equal(count(list, 'ring'), 1);
  assert.equal(count(list, 'ram'), 4);
  assert.equal(count(list, 'rod'), 4);
  assert.equal(count(list, 'gauge'), 2);
  assert.equal(count(list, 'needle'), 2);
  assert.equal(count(list, 'leaf'), 2);
  assert.equal(count(list, 'seam'), 1);
  assert.equal(count(list, 'cog') + count(list, 'cogs'), 7);
  const wheel = list.find(item => item.role === 'wheel');
  const ring = list.find(item => item.role === 'ring');
  assert.ok(wheel.x > main.x + main.w / 2 && wheel.y < main.y + 40, 'the wheel is at the top right');
  assert.deepEqual([ring.x, ring.y], [wheel.x, wheel.y], 'the ring is round the wheel');
});

await test('a thin strip keeps the deadbolts, the ring and the wheel and has no rams, gauges, shutters or cogs, and a region that moves has the same pieces in the same order', () => {
  const list = kit.partsOf(banner, true);
  assert.equal(count(list, 'deadbolt'), 10);
  assert.equal(count(list, 'wheel'), 1);
  assert.equal(count(list, 'ring'), 1);
  assert.equal(count(list, 'ram') + count(list, 'rod') + count(list, 'gauge') + count(list, 'needle') + count(list, 'leaf') + count(list, 'cog'), 0);
  assert.deepEqual(roles(kit.partsOf(main, false)), roles(kit.partsOf({ x: 40, y: 256, w: 1152, h: 708 }, false)));
});

await test('the view draws fewer parts so that it stays under the 500 animated elements: no gauges, no cogs, two bolts on each long edge of a strip, and only the large panel has the shutters and the ring', () => {
  const side = { x: 40, y: 256, w: 360, h: 708 };
  const panel = kit.partsOf(main, false, { mode: 'view', main: true });
  const column = kit.partsOf(side, false, { mode: 'view', main: false });
  const strip = kit.partsOf(banner, true, { mode: 'view', main: false });
  assert.equal(count(panel, 'gauge') + count(panel, 'cog') + count(panel, 'cogs'), 0);
  assert.equal(count(panel, 'leaf'), 2);
  assert.equal(count(panel, 'ring'), 1);
  assert.equal(count(column, 'leaf') + count(column, 'ring'), 0);
  assert.equal(count(column, 'rod'), 4);
  assert.equal(count(strip, 'deadbolt'), 8);
  assert.equal(count(strip, 'ring'), 0);
  assert.equal(count(strip, 'wheel'), 1);
});

await test('every deadbolt is drawn back before the folding starts, is slammed home, goes on by 3 pixels and settles, and every track runs the whole skeleton', () => {
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
    const over = bolt.stops.find(stop => /translate\((3|-3)px,0px\)|translate\(0px,(3|-3)px\)/.test(stop[1]));
    assert.ok(over, 'the bolt goes on by 3 pixels when it is driven home');
    assert.ok(over[0] >= plan.reformTimes.tighten[0] && over[0] < times[times.length - 3], 'the seat is in the tighten phase: ' + over[0]);
    const home = bolt.stops.filter(stop => /translate\(0px,0px\) rotate\(\d+deg\) scale\(1\)/.test(stop[1]));
    assert.ok(home.some(stop => stop[0] > over[0]), 'and settles back');
    assert.ok(home[home.length - 1][0] >= plan.reformTimes.tighten[0] + 200, 'home late in the tighten phase: ' + home[home.length - 1][0]);
    bolt.stops.forEach(stop => assert.ok(/^translate\(.+\) rotate\(.+\) scale\(.+\)$/.test(stop[1]), 'one list of functions: ' + stop[1]));
  });
});

await test('the wheel spins open and shut, the ring opens and clamps with a settle, the rods are pushed out while the frame is open and the needles sweep over a span of the run', () => {
  const list = kit.partsOf(main, false);
  const wheel = list.find(item => item.role === 'wheel');
  assert.ok(wheel.stops.some(stop => stop[1] === 'rotate(-540deg)'));
  assert.equal(wheel.stops[wheel.stops.length - 1][1], 'rotate(0deg)');
  const ring = list.find(item => item.role === 'ring');
  assert.ok(ring.stops.some(stop => /rotate\(-70deg\) scale\(1\.22\)/.test(stop[1])), 'the ring opens');
  assert.ok(ring.stops.some(stop => /rotate\(6deg\) scale\(0\.97\)/.test(stop[1])) && ring.stops[ring.stops.length - 1][1] === 'rotate(0deg) scale(1)', 'and clamps with a settle');
  list.filter(item => item.role === 'rod').forEach(rod => {
    const out = rod.stops.filter(stop => /translateX\(34px\)/.test(stop[1]));
    assert.ok(out.length >= 2);
    assert.ok(out[0][0] <= plan.reformTimes.fold[1] + 20 && out[out.length - 1][0] >= plan.reformTimes.turn[1]);
    assert.ok(rod.stops.some(stop => /translateX\(-3px\)/.test(stop[1])), 'the rod seats');
  });
  list.filter(item => item.role === 'ram').forEach(ram => assert.equal(ram.stops.length, 1, 'the cylinder stays'));
  list.filter(item => item.role === 'needle').forEach(needle => {
    const values = new Set(needle.stops.map(stop => stop[1]));
    assert.ok(values.size >= 4, 'the needle sweeps');
    assert.ok(needle.stops[needle.stops.length - 1][0] >= 2300);
  });
});

await test('the two shutters close over the window from the sides before the squares turn, seat with a settle, are locked by a bar across the seam and open before the squares are far on', () => {
  const list = kit.partsOf(main, false);
  const leaves = list.filter(item => item.role === 'leaf');
  const win = plan.windowOf(main);
  assert.equal(leaves.length, 2);
  assert.ok(leaves[0].x < leaves[1].x && leaves[0].w + leaves[1].w >= win.w, 'one on each side, the two covering the window');
  assert.ok(leaves[0].x - leaves[0].w / 2 >= win.x - 1 && leaves[1].x + leaves[1].w / 2 <= win.x + win.w + 1, 'inside the window');
  leaves.forEach((leaf, index) => {
    const sign = index === 0 ? -1 : 1;
    const times = leaf.inner.map(stop => stop[0]);
    assert.deepEqual(times, times.slice().sort((a, b) => a - b));
    const closed = leaf.inner.find(stop => stop[1] === 'translateX(0%)');
    assert.ok(closed[0] > plan.reformTimes.fold[0] && closed[0] < plan.reformTimes.turn[0], 'closed while the edges fold: ' + closed[0]);
    assert.ok(leaf.inner.some(stop => stop[1] === 'translateX(' + sign * 1.6 + '%)'), 'the settle');
    const last = leaf.inner[leaf.inner.length - 1];
    assert.equal(last[1], 'translateX(' + sign * 102 + '%)', 'open and out of the clip');
    assert.ok(last[0] <= plan.reformTimes.turn[0] + 400, 'open before the squares are far on');
  });
  const bar = list.find(item => item.role === 'seam');
  assert.ok(Math.abs(bar.x - (leaves[0].x + leaves[0].w / 2)) <= 1, 'the bar is on the seam');
  assert.ok(bar.stops.some(stop => /translate\(0px,0px\) rotate\(90deg\) scale\(1\)/.test(stop[1])) && bar.stops.some(stop => /translate\(0px,4px\)/.test(stop[1])), 'driven home with a seat');
});

await test('the cogs of the train are in mesh: two sizes in turn, each turning the other way from the one before it, through the whole change', () => {
  const train = kit.partsOf(main, false).filter(item => item.role === 'cog' || item.role === 'cogs');
  train.forEach((item, index) => {
    assert.equal(item.role, index % 2 === 0 ? 'cog' : 'cogs');
    const end = item.stops[item.stops.length - 1];
    assert.equal(end[0], plan.reformTimes.totalMs);
    assert.equal(Math.sign(parseFloat(/rotate\((-?[\d.]+)deg\)/.exec(end[1])[1])), index % 2 === 0 ? 1 : -1);
    if (index > 0) {
      const before = train[index - 1];
      const apart = item.x - before.x;
      assert.ok(apart < (item.w + before.w) / 2 && apart > (item.w + before.w) / 2 * 0.85, 'the teeth go between each other: ' + apart);
    }
    assert.ok(item.y + item.h / 2 <= 1080, 'on the canvas');
  });
});

await test('the stage is jolted when the bolts first break, when the shutters meet and again when they lock, and only by a translate', () => {
  const stops = kit.jolt();
  const moves = stops.filter(stop => stop[1] !== 'translate(0px,0px)');
  assert.ok(moves.length >= 6);
  assert.ok(moves.some(stop => stop[0] > 900 && stop[0] < 1050), 'a jolt where the shutters meet');
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
  (css.match(/box-shadow:[^;]*;/g) || []).forEach(rule => assert.ok(/box-shadow: 0 0 0 0 /.test(rule), 'no box-shadow but the empty one that takes the plain one away: ' + rule));
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
