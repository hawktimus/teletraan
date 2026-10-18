// Tests for the Cybertron kit of the panel and view transitions (dashboard/styles/cybertron/transitions.js, docs/transitions.md).
// The kit is data and small functions, so it runs here without a page: a stand-in for document.createElement is enough.
//
//   node tests/reform-cybertron.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboard = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboard, file), 'utf8');

// the smallest document the kit needs: elements with a class, a style text and children
globalThis.document = {
  createElement: () => ({ className: '', style: { cssText: '' }, children: [], appendChild(child) { this.children.push(child); return child; } }),
};

const plan = await import(pathToFileURL(path.join(dashboard, 'core', 'reform-plan.js')).href);
const { kit } = await import(pathToFileURL(path.join(dashboard, 'styles', 'cybertron', 'transitions.js')).href);
const { kit: originalKit } = await import(pathToFileURL(path.join(dashboard, 'styles', 'original', 'transitions.js')).href);
const css = read('styles/cybertron/reform-kit.css');
const script = read('styles/cybertron/transitions.js');

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

const main = { x: 40, y: 256, w: 1152, h: 708 };
const strip = { x: 32, y: 32, w: 1856, h: 160 };
const walk = (element, found = []) => { found.push(element); element.children.forEach(child => walk(child, found)); return found; };

await test('the cybertron kit is its own kit, not the Original kit under another id', () => {
  assert.equal(kit.id, 'cybertron');
  assert.notEqual(kit, originalKit);
  assert.notEqual(kit.draw, originalKit.draw);
  assert.equal(typeof kit.hardware, 'function');
  assert.equal(typeof kit.squares, 'function');
  assert.equal(typeof kit.extras, 'function');
});

await test('it draws the roles it must: a core for the screw, a bracket for the brace, and nothing for the chassis', () => {
  assert.match(kit.draw('screw'), /^<svg/);
  assert.match(kit.draw('brace'), /^<svg/);
  assert.notEqual(kit.draw('screw'), originalKit.draw('screw'));
  assert.notEqual(kit.draw('brace'), originalKit.draw('brace'));
  assert.equal(kit.draw('chassis'), '');
  assert.equal(kit.draw('nothing'), '');
});

await test('the hardware of the other kits (latches, rivets, gears, pistons, teeth) is left out', () => {
  ['latch', 'rivet', 'gear', 'piston', 'tooth'].forEach(role => assert.equal(kit.hardware({ role: role, stops: [[0, 'none']] }), null));
});

await test('a core swells and spins past two turns, and is back to its size at the end', () => {
  const stops = kit.hardware({ role: 'screw', stops: plan.screwStops() });
  assert.equal(stops[0][0], 0);
  assert.equal(stops[stops.length - 1][0], plan.reformTimes.totalMs);
  assert.match(stops[1][1], /scale\(1\.5\)/);
  assert.match(stops[stops.length - 1][1], /scale\(1\) rotate\(1440deg\)/);
});

await test('a bracket retracts to nothing in loosen, keeps its slant, and is back by the end', () => {
  const corner = { sx: 1, sy: -1 };
  const stops = kit.hardware({ role: 'brace', stops: plan.braceStops(corner) });
  assert.ok(stops.every(stop => /rotate\(-45deg\)/.test(stop[1])));
  assert.ok(stops.some(stop => /scale\(0\)/.test(stop[1]) && stop[0] <= plan.reformTimes.loosen[1] + 200));
  assert.match(stops[stops.length - 1][1], /scale\(1\)/);
});

await test('a square collapses to a line of light, flips as a line and opens back out inside its own turn', () => {
  const squares = plan.squaresOf(main, 'main', 5);
  squares.forEach(square => {
    const own = kit.squares(square, { dx: 0, dy: 0, sx: 1, sy: 1 });
    const start = square.startMs;
    const end = start + plan.squareTurnMs;
    const lit = own.shade.filter(stop => stop[1] === 1);

    assert.ok(own.transform.every(stop => /^translate3d\(.*\) rotate[XY]\(.*\) scale\(.*\) scale\(.*\)$/.test(stop[1])), 'one list of functions, so the browser can blend it');
    assert.ok(own.transform.every(stop => stop[0] === 0 || stop[0] >= start || stop[0] === plan.reformTimes.totalMs));
    assert.ok(lit.length >= 2 && lit[0][0] > start && lit[lit.length - 1][0] < end, 'the line is lit between the start and the end of the turn');
    assert.equal(own.shade[0][1], 0);
    assert.equal(own.shade[own.shade.length - 1][1], 0);
    assert.ok(own.transform.some(stop => /rotate[XY]\(180deg\)/.test(stop[1])), 'it flips');
    assert.ok(own.transform.some(stop => /scale\((0\.07,1|1,0\.07)\)/.test(stop[1])), 'it is a line');
    assert.match(own.transform[own.transform.length - 1][1], /scale\(1,1\)$/, 'and it opens back out');
  });
});

await test('a square of a region that changes place travels to its new cell while it turns', () => {
  const [square] = plan.squaresOf(main, 'main', 5);
  const own = kit.squares(square, { dx: 100, dy: -50, sx: 2, sy: 0.5 });
  assert.match(own.transform[0][1], /translate3d\(100px,-50px,0px\)/);
  assert.match(own.transform[own.transform.length - 1][1], /translate3d\(0px,0px,0px\)/);
});

await test('a panel gets a conduit and a bolt on each of its eight chains and a scan bar; a strip gets them on its two long edges only', () => {
  const made = (rect, isStrip) => {
    const added = [];
    const tracks = { add: (element, property, stops) => added.push({ element: element, property: property, stops: stops }) };
    const group = kit.extras({ from: rect, to: rect }, tracks, isStrip);
    return { group: group, added: added, all: walk(group) };
  };
  const panel = made(main, false);
  const bar = made(strip, true);
  const count = (found, name) => found.all.filter(element => element.className.split(' ').includes(name)).length;

  assert.equal(count(panel, 'ck-conduit'), 8);
  assert.equal(count(panel, 'ck-bolt'), 8);
  assert.equal(count(panel, 'ck-scan'), 1);
  assert.equal(count(bar, 'ck-conduit'), 4);
  assert.equal(count(bar, 'ck-bolt'), 4);
  assert.equal(panel.added.length, 8 + 8 + 1);
  [panel, bar].forEach(found => found.added.forEach(item => {
    assert.equal(item.property, 'transform');
    assert.ok(item.stops.every((stop, index) => index === 0 || stop[0] >= item.stops[index - 1][0]), 'the stops are in time order');
  }));
});

await test('every bolt, conduit and the scan bar is at rest and out of sight at 0 ms and at the end', () => {
  const added = [];
  kit.extras({ from: main, to: main }, { add: (element, property, stops) => added.push({ element: element, stops: stops }) }, false);
  added.forEach(item => {
    const first = item.stops[0][1];
    const last = item.stops[item.stops.length - 1][1];
    const hidden = value => /scale(X|Y)?\(0\)/.test(value) || /translateY\(0px\)/.test(value);
    assert.ok(hidden(first), item.element.className + ' at 0 ms: ' + first);
    assert.ok(/scale(X|Y)?\(0\)/.test(last) || /translateY\((1[0-9]{3}|[0-9]{3,})/.test(last), item.element.className + ' at the end: ' + last);
  });
});

await test('the stylesheet moves nothing by itself and uses only tokens: no animation, transition, filter, blur or color written in it', () => {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /@keyframes|animation|transition|filter|blur|backdrop/);
  assert.doesNotMatch(code, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(code, /\b(rgba?|hsla?)\(/);
  assert.doesNotMatch(code.replace(/box-shadow: inset 0 0 0 2px var\(--style-ground\);/g, ''), /box-shadow/, 'the only shadow is the static inset line of an edge');
  assert.ok(/var\(--style-neon\)/.test(code) && /var\(--style-ground\)/.test(code));
  assert.doesNotMatch(script, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(script, /filter|boxShadow|backdrop/);
});

await test('the stylesheet is linked from index.html, once', () => {
  const links = read('index.html').split('\n').filter(line => line.includes('styles/cybertron/reform-kit.css'));
  assert.equal(links.length, 1);
});

console.log(passed + ' passed');
