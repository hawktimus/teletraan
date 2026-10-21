// Tests for the Retro kit of the panel and view transitions (dashboard/styles/retro/transitions.js and reform-kit.css,
// docs/transitions.md): it is its own kit and not the Original one, it draws every role the engine asks for, its stylesheet
// keeps to the theme and to tokens, and the tracks it changes still move only by transform and opacity.
//
//   node tests/reform-retro.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(root + file, 'utf8');
const noComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');
const load = file => import(pathToFileURL(root + file).href);

// The kit makes elements for its parts, so the test gives it a stand in for the page
globalThis.document = { createElement: () => ({ className: '', style: { cssText: '' }, children: [], appendChild(child) { this.children.push(child); return child; }, after() {} }) };

const { kit: original } = await load('dashboard/styles/original/transitions.js');
const { kit } = await load('dashboard/styles/retro/transitions.js');
const plan = await load('dashboard/core/reform-plan.js');

let passed = 0;
async function test(name, run) {
  try { await run(); passed += 1; console.log('ok    ' + name); } catch (error) { console.log('FAIL  ' + name + '\n' + error.stack); process.exitCode = 1; }
}

// The roles the engine asks the kit to draw (core/reform-plan.js, hardwareList, and the chassis in core/reform-draw.js)
const roles = ['screw', 'latch', 'brace', 'rivet', 'gear', 'piston', 'tooth'];

await test('the Retro kit is its own and not the Original kit', () => {
  assert.notEqual(kit, original);
  assert.equal(kit.id, 'retro');
  assert.equal(typeof kit.draw, 'function');
  assert.equal(typeof kit.extras, 'function');
  assert.equal(typeof kit.squares, 'function');
  assert.equal(original.extras, undefined);
});

await test('the Retro kit draws every piece of hardware, in its own drawing, and nothing for the chassis or an unknown role', () => {
  roles.forEach(role => {
    const drawing = kit.draw(role);
    assert.match(drawing, /^<svg viewBox="0 0 40 40"/, role);
    assert.notEqual(drawing, original.draw(role), role + ' is the Original drawing');
    assert.ok(!/rk-/.test(drawing), role + ' uses a class of the Original kit');
  });
  assert.equal(kit.draw('chassis'), '');
  assert.equal(kit.draw('nothing'), '');
});

await test('every Retro rule starts with the theme or is a class of this kit, and no color is a hex or a function of color', () => {
  const css = noComments(read('dashboard/styles/retro/reform-kit.css'));
  css.split('}').map(rule => rule.split('{')[0].trim()).filter(Boolean).forEach(selectors => {
    selectors.split(',').map(item => item.trim()).forEach(selector => {
      assert.ok(selector.startsWith('html[data-style="retro"]') || selector.startsWith('.rr-layer'), 'a rule outside the theme: ' + selector);
    });
  });
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css), 'a hex color');
  assert.ok(!/\b(rgb|rgba|hsl|hsla)\(/.test(css), 'a color function');
});

await test('the Retro stylesheet has no filter, no blur, no animation of its own and no transition', () => {
  const css = noComments(read('dashboard/styles/retro/reform-kit.css'));
  assert.ok(!/filter|blur|@keyframes|animation|transition\s*:|text-shadow/.test(css));
});

await test('every --retro token the kit uses is defined in the tokens file of the theme', () => {
  const css = noComments(read('dashboard/styles/retro/reform-kit.css'));
  const tokens = noComments(read('dashboard/styles/retro/tokens.css'));
  const used = new Set(css.match(/--retro-[a-z-]+/g));
  assert.ok(used.size >= 4);
  used.forEach(name => assert.ok(new RegExp(name + '\\s*:').test(tokens), name + ' is not defined'));
});

await test('index.html links the Retro kit stylesheet, on a line of its own', () => {
  const lines = read('dashboard/index.html').split('\n').filter(line => line.includes('styles/retro/reform-kit.css'));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\s*<link rel="stylesheet" href="styles\/retro\/reform-kit\.css\?v=0">\s*$/);
});

// A stand in for an element, enough for the kit to find the joint of a segment and the axis of its chain
function fake(className, parent) {
  const names = className.split(' ');
  return { classList: { contains: name => names.includes(name) }, parentElement: parent || null, closest: () => parent && parent.chain ? parent.chain : null };
}

await test('every joint winds up, swings past its fold and bounces back with smaller overshoots, folding and unfolding, by rotation only', () => {
  const chain = fake('reform-chain reform-chain-h');
  const first = fake('reform-seg', chain);
  const second = Object.assign(fake('reform-seg', first), { closest: () => chain });
  first.closest = () => chain;
  const tracks = { list: [{ element: second, property: 'transform', stops: plan.jointStops('h', 1) }], add() {} };
  const layer = kit.extras({ role: 'side', from: { x: 40, y: 40, w: 300, h: 700 }, to: { x: 40, y: 40, w: 300, h: 700 }, grid: 'side' }, tracks, false, { chassis: {} });
  assert.ok(layer, 'the other regions of a run have poofs');

  const values = tracks.list[0].stops.map(stop => stop[1]);
  const degrees = values.map(value => Number(/\((-?[\d.]+)deg\)/.exec(value)[1]));
  values.forEach(value => assert.match(value, /^rotateY\(-?\d+deg\)$/));
  assert.ok(degrees.includes(-14), 'no wind-up before the fold');
  assert.ok(degrees.includes(208) && degrees.includes(-28), 'no overshoot of the fold and of the unfold');
  // each bounce past 180 (and past 0) is smaller than the one before
  const swings = degrees.slice(0, 8).map((value, index) => (index > 0 && index < 7 && (value - degrees[index - 1]) * (degrees[index + 1] - value) < 0 ? value : null)).filter(value => value !== null);
  const away = swings.filter(value => value > 100).map(value => Math.abs(value - 180));
  assert.ok(away.length >= 3 && away.every((value, index) => index === 0 || value <= away[index - 1] + 0.5), 'the fold does not settle with smaller bounces: ' + away);
  const times = tracks.list[0].stops.map(stop => stop[0]);
  assert.deepEqual(times, times.slice().sort((a, b) => a - b));
  assert.ok(times.at(-1) <= plan.reformTimes.totalMs);
});

await test('a square winds up squashed, stretches while it turns, lands squashed and bounces to rest, and keeps the move of a region that changes place', () => {
  const square = { axis: 'y', startMs: 1300 };
  const move = { dx: 40, dy: -12, sx: 1.5, sy: 0.8 };
  const original = plan.squareStops(square, move);
  const stops = kit.squares(square, move).transform;
  const values = stops.map(stop => stop[1]);
  assert.ok(values.some(value => value.includes('rotateY(0deg)') && value.endsWith('scale(1.16,0.8)')), 'no squash before the flip');
  assert.ok(values.some(value => value.includes('rotateY(90deg)') && value.endsWith('scale(0.8,1.22)')), 'no stretch while it turns');
  assert.ok(values.some(value => value.includes('rotateY(180deg)') && value.endsWith('scale(1.2,0.78)')), 'no squash on landing');
  // after the landing every squash is smaller than the one before
  const landed = values.filter(value => value.includes('rotateY(180deg)')).map(value => /scale\(([\d.]+),([\d.]+)\)$/.exec(value)).map(found => Math.abs(Number(found[1]) - 1));
  assert.ok(landed.length >= 5 && landed.every((value, index) => index === 0 || value <= landed[index - 1] + 0.001), 'the landing does not settle with smaller bounces: ' + landed);
  assert.equal(values.at(-1), original.at(-1)[1].replace(/scale\(1\)$/, 'scale(1,1)').replace(/ rotateY/, ' rotateZ(0deg) rotateY'));
  assert.ok(values.some(value => value.startsWith('translate3d(' + move.dx)), 'the move of the region is lost');
  values.forEach(value => assert.match(value, /^translate3d\([^)]*\) rotateZ\(-?[\d.]+deg\) rotateY\(-?[\d.]+deg\) scale\([^)]*\) scale\([\d.,]+\)$/));
  const times = stops.map(stop => stop[0]);
  assert.deepEqual(times, times.slice().sort((a, b) => a - b));
  assert.equal(times.at(-1), plan.reformTimes.totalMs);
});

await test('the stage wobbles on the wind-up, the launch and the landing, by transform only, and rests at both ends', () => {
  const stops = kit.jolt();
  const times = stops.map(stop => stop[0]);
  assert.deepEqual(times, times.slice().sort((a, b) => a - b));
  assert.equal(times.at(-1), plan.reformTimes.totalMs);
  assert.equal(stops[0][1], stops.at(-1)[1]);
  stops.forEach(stop => assert.match(stop[1], /^translate\(0px,-?[\d.]+px\) scale\([\d.]+,[\d.]+\) rotate\(-?[\d.]+deg\)$/));
  const moving = ms => stops.some(stop => stop[0] > ms[0] && stop[0] < ms[1] && stop[1] !== stops[0][1]);
  [[100, 500], [1200, 1500], [1850, 2000], [2650, 2900]].forEach(window => assert.ok(moving(window), 'no wobble from ' + window[0] + ' to ' + window[1]));
});

await test('the screws dip before they pop, and the rest of the hardware pops on the spring ease', () => {
  const screw = kit.hardware({ role: 'screw', stops: [] });
  assert.ok(screw[1][1].includes('scale(0.8)'), 'no dip before the screw pops');
  assert.equal(screw.at(-1)[1], screw[0][1]);
  assert.ok(screw.filter(stop => stop[0] < 2740).at(-1)[1] === screw[0][1], 'the screw is not seated before the parts shrink');
  const rivet = kit.hardware({ role: 'rivet', stops: plan.rivetStops(0) });
  assert.ok(rivet.some(stop => /cubic-bezier\(\.34,1\.56/.test(stop[2] || '')), 'no spring ease');
  assert.ok(!rivet.some(stop => stop[2] === plan.easePop));
});

await test('the cartoon parts are drawn as line art in tokens: a jagged burst, scalloped poof clouds, spinning stars and a scalloped curtain', () => {
  const made = [];
  const tracks = { list: [], add: (element, property, stops) => made.push({ element, property, stops }) };
  const chassis = { after: () => {} };
  const rect = { x: 380, y: 240, w: 1500, h: 740 };
  const layer = kit.extras({ role: 'main', from: rect, to: rect, grid: 'main' }, tracks, false, { chassis });
  const names = made.map(item => item.element.className);
  const count = name => names.filter(item => item.includes(name)).length;
  assert.equal(count('rr-poof'), 4);
  assert.equal(count('rr-flystar'), 4);
  assert.ok(count('rr-speed') >= 10, 'speed lines and motion streaks');
  assert.equal(count('rr-band'), 1);
  assert.equal(count('rr-star'), 1);
  assert.ok(count('rr-sparkle') >= 6);
  assert.ok(made.length <= 40, 'a panel adds ' + made.length + ' animated parts');
  made.forEach(item => assert.equal(item.property, 'transform'));
  made.forEach(item => assert.ok(item.stops.at(-1)[0] <= plan.reformTimes.totalMs));
  // a view keeps fewer of them, so that it stays inside its budget
  const lean = [];
  kit.extras({ role: 'main', from: rect, to: rect, grid: 'view-main' }, { list: [], add: (element) => lean.push(element.className) }, false, { chassis });
  assert.ok(lean.length < made.length);
  assert.ok(lean.filter(name => name.includes('rr-poof')).length === 2);
  assert.ok(layer);
});

await test('the Light curtains close with a squash and a rebound, open with a wind-up, rest in the same place and stay inside the region', () => {
  const parts = kit.light(1532, 736, 'main');
  const curtains = parts.filter(item => item.cls.includes('rr-light-curtain'));
  assert.equal(curtains.length, 2);
  assert.equal(parts.filter(item => item.cls === 'rr-light-star').length, 1);
  assert.ok(parts.length <= 5);
  curtains.forEach(item => {
    assert.ok(item.markup.includes('rr-scallop'), 'no scalloped edge');
    assert.ok(item.x >= 0 && item.x + item.w <= 1533);
    assert.equal(item.close.at(-1).transform, item.open[0].transform);
    assert.equal(item.close.at(-1).transform, 'translateX(0px) scale(1,1)');
    // it passes the middle and comes back: one overshoot, then a smaller one
    const sides = item.close.map(frame => Number(/translateX\((-?\d+)px\)/.exec(frame.transform)[1]));
    const sign = item.cls.includes('left') ? 1 : -1;
    assert.ok(sides.some(value => value * sign > 15), 'it does not overshoot the middle');
    assert.ok(sides.some(value => value * sign < -5), 'it does not rebound');
    assert.ok(item.close.some(frame => /scale\(0\.9\d?,1\.0\d\)/.test(frame.transform)), 'no squash on the slam');
    assert.ok(item.open.some(frame => /scale\(0\.95,1\.04\)/.test(frame.transform)), 'no wind-up before it opens');
  });
});

console.log('\n' + passed + ' passed');
