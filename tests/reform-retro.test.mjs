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

await test('every joint swings past its fold and springs back, folding and unfolding, by rotation only', () => {
  const chain = fake('reform-chain reform-chain-h');
  const first = fake('reform-seg', chain);
  const second = Object.assign(fake('reform-seg', first), { closest: () => chain });
  first.closest = () => chain;
  const tracks = { list: [{ element: second, property: 'transform', stops: plan.jointStops('h', 1) }] };
  kit.extras({ tracks: tracks, back: {}, front: {}, regions: [] });

  const values = tracks.list[0].stops.map(stop => stop[1]);
  assert.ok(values.includes('rotateY(206deg)'), 'no overshoot of the fold');
  assert.ok(values.includes('rotateY(180deg)'));
  assert.ok(values.includes('rotateY(-26deg)'), 'no overshoot of the unfold');
  values.forEach(value => assert.match(value, /^rotateY\(-?\d+deg\)$/));
  const times = tracks.list[0].stops.map(stop => stop[0]);
  assert.deepEqual(times, times.slice().sort((a, b) => a - b));
  assert.ok(times.at(-1) <= plan.reformTimes.totalMs);
});

await test('a square squashes before its flip and stretches after it, and keeps the move of a region that changes place', () => {
  const square = { axis: 'y', startMs: 1300 };
  const move = { dx: 40, dy: -12, sx: 1.5, sy: 0.8 };
  const original = plan.squareStops(square, move);
  const tracks = { list: [{ element: fake('reform-square'), property: 'transform', stops: original }] };
  kit.extras({ tracks: tracks, back: {}, front: {}, regions: [] });

  const stops = tracks.list[0].stops;
  const values = stops.map(stop => stop[1]);
  assert.ok(values.some(value => value.includes('rotateY(0deg)') && value.endsWith('scale(1.12,0.84)')), 'no squash before the flip');
  assert.ok(values.some(value => value.includes('rotateY(180deg)') && value.endsWith('scale(0.84,1.14)')), 'no stretch after the flip');
  assert.equal(values.at(-1), original.at(-1)[1].replace(/scale\(1\)$/, 'scale(1,1)'));
  assert.ok(values.some(value => value.startsWith('translate3d(' + move.dx)), 'the move of the region is lost');
  values.forEach(value => assert.match(value, /^translate3d\([^)]*\) rotateY\(-?[\d.]+deg\) scale\([^)]*\) scale\([\d.,]+\)$/));
  const times = stops.map(stop => stop[0]);
  assert.deepEqual(times, times.slice().sort((a, b) => a - b));
  assert.equal(times.at(-1), plan.reformTimes.totalMs);
});

console.log('\n' + passed + ' passed');
