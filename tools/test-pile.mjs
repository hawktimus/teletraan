// Tests for the end of the red eyes and the blue screen, where the frames fall into a pile, a cube
// rises out of it and the frames fly back (docs/hidden-transitions.md, "The frames fall and come
// back"). The plan is run for real: planPile in dashboard/core/transitions.js decides which piece
// lets go when and how it lies. The file that finds the pieces on the page, dashboard/core/hidden-pile.js,
// is run against a small fake page. The stylesheets and the runner are checked by reading them,
// because the moves need a browser to be seen.
//
//   node tools/test-pile.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them. frame.js
// needs a page, so hidden-pile.js is given a small stand-in that notes what it was asked.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-pile-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'core/transitions.js', 'core/hidden-pile.js', 'core/plate.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});
fs.writeFileSync(path.join(root, 'frame.js'), [
  'export const entered = [];',
  'export function enter(panel, contentOnly) { entered.push({ panel: panel, contentOnly: contentOnly }); }',
  'export function pace() { return globalThis.testPace || 1; }',
  '',
].join('\n'));

const base = pathToFileURL(root).href + '/';
const transitions = await import(base + 'core/transitions.js');
const plate = await import(base + 'core/plate.js');
const pileModule = await import(base + 'core/hidden-pile.js');
const frameStandIn = await import(base + 'frame.js');

const { boxInPose, inPlace, mergeSmall, pieceLimit, pileShape, pileTimes, planPile, seededRandom } = transitions;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}


// The plan

// Pieces of different sizes spread over the screen. The first count are plates and the rest are bolts,
// each riding on one of the plates
function somePieces(plates, bolts) {
  const pieces = [];
  for (let index = 0; index < plates; index++) {
    pieces.push({
      id: 'plate-' + index,
      left: (index * 97) % 1500,
      top: (index * 53) % 800,
      width: 80 + (index * 37) % 560,
      height: 40 + (index * 41) % 580,
      parent: '',
    });
  }
  for (let index = 0; index < bolts; index++) {
    pieces.push({ id: 'bolt-' + index, left: 300 + index * 20, top: 200 + index * 15, width: 48, height: 48, parent: 'plate-' + (index % plates) });
  }
  return pieces;
}

const byId = (list, id) => list.find(item => item.id === id);

test('the same pieces and the same seed always give the same plan, and another seed gives another', () => {
  const pieces = somePieces(20, 10);
  assert.deepEqual(planPile(pieces, 7), planPile(pieces, 7));
  assert.notDeepEqual(planPile(pieces, 7), planPile(pieces, 8));

  const random = seededRandom(5);
  const numbers = Array.from({ length: 1000 }, () => random());
  assert.ok(numbers.every(number => number >= 0 && number < 1));
  assert.deepEqual(Array.from({ length: 5 }, seededRandom(5)), numbers.slice(0, 5));
  assert.notEqual(new Set(numbers).size, 1);
});

test('every piece lets go between 0 and 400 ms, tips between 20 and 70 degrees, turns up to 25 degrees in the plane, and falls for 1.2 s', () => {
  [1, 2, 3, 99, 4242].forEach(seed => {
    const plan = planPile(somePieces(30, 10), seed);
    plan.pieces.forEach(piece => {
      assert.ok(piece.fall.delayMs >= 0 && piece.fall.delayMs <= pileTimes.letGoMs, piece.id + ' lets go at ' + piece.fall.delayMs);
      assert.ok(Number.isInteger(piece.fall.delayMs));
      assert.ok(piece.pose.tip >= 20 && piece.pose.tip <= 70, piece.id + ' tips ' + piece.pose.tip);
      assert.ok(Math.abs(piece.pose.twist) <= 25, piece.id + ' turns ' + piece.pose.twist);
      assert.equal(piece.fall.ms, 1200);
    });
    assert.ok(plan.fellMs <= pileTimes.fallMs, 'the last piece is down by ' + plan.fellMs);
    assert.equal(pileTimes.fallMs, 1600);
  });

  // the delays are spread over the whole range, not all the same
  const delays = planPile(somePieces(40, 0), 11).pieces.map(piece => piece.fall.delayMs);
  assert.ok(Math.min(...delays) < 100 && Math.max(...delays) > 300, 'from ' + Math.min(...delays) + ' to ' + Math.max(...delays));
});

test('at most 40 pieces fall: more are folded into the piece they ride on, the smallest first, and a piece with no parent is never folded in', () => {
  assert.equal(pieceLimit, 40);

  const plan = planPile(somePieces(30, 22), 3);
  assert.equal(plan.pieces.length, 40);
  assert.equal(plan.merged.length, 12);
  plan.merged.forEach(id => assert.ok(id.startsWith('bolt-'), id + ' is a bolt'));
  assert.ok(plan.pieces.filter(piece => piece.id.startsWith('plate-')).length === 30, 'every plate falls');
  assert.ok(plan.pieces.every(piece => !plan.merged.includes(piece.id)));

  // the smallest go first, whatever their order
  const mixed = [
    { id: 'a', left: 0, top: 0, width: 300, height: 300, parent: '' },
    { id: 'big', left: 0, top: 0, width: 100, height: 100, parent: 'a' },
    { id: 'small', left: 0, top: 0, width: 10, height: 10, parent: 'a' },
    { id: 'middle', left: 0, top: 0, width: 50, height: 50, parent: 'a' },
    { id: 'alone', left: 0, top: 0, width: 1, height: 1, parent: '' },
  ];
  const folded = mergeSmall(mixed, 3);
  assert.deepEqual(folded.merged.map(piece => piece.id), ['small', 'middle']);
  assert.deepEqual(folded.kept.map(piece => piece.id), ['a', 'big', 'alone'], 'the others stay in the order they came');

  // nothing to fold into: the limit is not reached, and nothing is lost
  const lonely = mergeSmall(somePieces(45, 0), 40);
  assert.equal(lonely.kept.length, 45);
  assert.deepEqual(lonely.merged, []);

  // a piece whose parent was folded away is no longer riding on anything
  const nested = mergeSmall([
    { id: 'p', left: 0, top: 0, width: 100, height: 100, parent: '' },
    { id: 'q', left: 0, top: 0, width: 20, height: 20, parent: 'p' },
    { id: 'r', left: 0, top: 0, width: 5, height: 5, parent: 'q' },
  ], 1);
  assert.deepEqual(nested.kept.map(piece => piece.id), ['p']);
});

test('the pile lies in the bottom 120 px, with every piece inside the band however big it was, and they lie from left to right in the order they fell', () => {
  assert.equal(pileShape.bandHeight, 120);

  [5, 6, 7, 8].forEach(seed => {
    const pieces = somePieces(34, 6);
    const plan = planPile(pieces, seed);

    plan.pieces.forEach(entry => {
      const piece = byId(pieces, entry.id);
      const box = boxInPose(piece.width, piece.height, entry.pose);
      const middleY = piece.top + piece.height / 2 + entry.pose.y;
      assert.ok(middleY + box.top >= pileShape.screenHeight - pileShape.bandHeight - 0.5, entry.id + ' starts at ' + (middleY + box.top));
      assert.ok(middleY + box.bottom <= pileShape.screenHeight + 0.5, entry.id + ' ends at ' + (middleY + box.bottom));
      assert.ok(entry.pose.scale > 0 && entry.pose.scale <= 1);
    });

    // a piece that is small enough keeps its size, and a big one is scaled down to fit
    assert.equal(byId(plan.pieces, 'bolt-0').pose.scale, 1);
    assert.ok(plan.pieces.some(entry => entry.pose.scale < 0.5));

    // the order they fell in is the order they lie in, from the left
    const fallen = plan.pieces.slice().sort((a, b) => a.rank - b.rank);
    assert.deepEqual(fallen.map(entry => entry.rank), fallen.map((entry, index) => index));
    fallen.slice(1).forEach((entry, index) => {
      assert.ok(entry.fall.delayMs >= fallen[index].fall.delayMs, 'the rank follows the moment of letting go');
      const middle = id => byId(pieces, id).left + byId(pieces, id).width / 2;
      assert.ok(middle(entry.id) + entry.pose.x > middle(fallen[index].id) + fallen[index].pose.x, 'each lies to the right of the one before');
    });
  });
});

test('the box of a piece in a pose is the box of the piece when it is in place, and the bottom edge comes towards the viewer when it tips', () => {
  const flat = boxInPose(200, 100, inPlace);
  assert.deepEqual(flat, { left: -100, top: -50, right: 100, bottom: 50 });

  const tipped = boxInPose(200, 100, { x: 0, y: 0, tip: 60, twist: 0, scale: 1 });
  assert.ok(tipped.bottom - tipped.top < 60, 'tipped back it is shorter: ' + (tipped.bottom - tipped.top));
  assert.ok(tipped.bottom > -tipped.top, 'the near edge is bigger than the far one');
  assert.ok(tipped.right > 100, 'and wider');

  const half = boxInPose(200, 100, { x: 0, y: 0, tip: 0, twist: 0, scale: 0.5 });
  assert.deepEqual(half, { left: -50, top: -25, right: 50, bottom: 25 });

  const turned = boxInPose(200, 100, { x: 0, y: 0, tip: 0, twist: 90, scale: 1 });
  assert.ok(Math.abs(turned.right - 50) < 1e-9 && Math.abs(turned.bottom - 100) < 1e-9, 'a quarter turn swaps the sides');
});

test('the pieces lift in the opposite order, 60 ms apart, each flies back in 500 ms to where it was with no tip, no turn and no offset', () => {
  const pieces = somePieces(20, 10);
  const plan = planPile(pieces, 21);
  const fallen = plan.pieces.slice().sort((a, b) => a.rank - b.rank);

  fallen.forEach(entry => {
    assert.deepEqual(entry.fall.from, inPlace, entry.id + ' starts in its place');
    assert.deepEqual(entry.fall.to, entry.pose, entry.id + ' falls to the pile');
    assert.deepEqual(entry.lift.from, entry.pose, entry.id + ' lifts from the pile');
    assert.deepEqual(entry.lift.to, inPlace, entry.id + ' returns to its origin');
    assert.equal(entry.lift.ms, 500);
  });
  assert.deepEqual(inPlace, { x: 0, y: 0, tip: 0, twist: 0, scale: 1 });

  const lifted = plan.pieces.slice().sort((a, b) => a.lift.delayMs - b.lift.delayMs);
  assert.deepEqual(lifted.map(entry => entry.id), fallen.slice().reverse().map(entry => entry.id), 'the last to fall lifts first');
  assert.equal(lifted[0].lift.delayMs, 0);
  lifted.slice(1).forEach((entry, index) => assert.ok(Math.abs(entry.lift.delayMs - lifted[index].lift.delayMs - 60) < 1e-9, 'one every 60 ms'));
});

test('the three parts take 5 seconds at the most, with 40 pieces too, and the cube starts to rise before the last piece is down', () => {
  assert.equal(pileTimes.totalMs, 5000);
  [0, 1, 2, 10, 39, 40].forEach(count => {
    const plan = planPile(somePieces(count, 0), count);
    assert.equal(plan.pieces.length, count);
    assert.ok(plan.lockedMs <= pileTimes.totalMs, count + ' pieces are home at ' + plan.lockedMs);
    assert.ok(plan.lockedMs >= pileTimes.liftAtMs + (count > 0 ? pileTimes.flyMs : 0));
  });

  const full = planPile(somePieces(40, 0), 40);
  assert.ok(full.lockedMs > 4500, 'with 40 pieces the 60 ms gap is kept: ' + full.lockedMs);
  const gaps = full.pieces.map(entry => entry.lift.delayMs).sort((a, b) => a - b);
  assert.equal(gaps[1] - gaps[0], 60);

  // fewer pieces than the limit are home sooner
  assert.ok(planPile(somePieces(10, 0), 1).lockedMs < full.lockedMs);

  // the cube rises while the last pieces are falling, so that the 60 ms gap fits in 5 seconds
  assert.ok(pileTimes.cubeAtMs < pileTimes.fallMs);
  // and the pieces lift when the second pulse starts
  const cube = pileTimes.cube;
  assert.equal(pileTimes.cubeAtMs + cube.pulseAfterMs + cube.pulseMs, pileTimes.liftAtMs, 'the second pulse starts when the pieces lift');
  assert.ok(cube.riseMs <= cube.pulseAfterMs, 'the cube is up before the first pulse');
  assert.ok(pileTimes.cubeAtMs + cube.turnAfterMs + cube.turnMs < pileTimes.liftAtMs + 200, 'and has turned by about the time the pieces lift');
});

test('no pieces make an empty plan that is over when the pieces would lift', () => {
  const plan = planPile([], 1);
  assert.deepEqual(plan, { pieces: [], merged: [], fellMs: 0, lockedMs: pileTimes.liftAtMs });
});


// The stylesheets

const frameCss = withoutComments(read('frame.css'));
const baseCss = withoutComments(read('base.css'));

// The steps of a keyframes rule, as { at, text }
function stepsOf(css, name) {
  const start = css.indexOf('@keyframes ' + name + ' {');
  assert.ok(start !== -1, 'no keyframes called ' + name);
  let depth = 0;
  let end = css.indexOf('{', start);
  for (let index = end; index < css.length; index++) {
    if (css[index] === '{') depth++;
    if (css[index] === '}') depth--;
    if (depth === 0) { end = index; break; }
  }
  const body = css.slice(css.indexOf('{', start) + 1, end);
  const steps = [];
  body.replace(/([^{}]+)\{([^{}]*)\}/g, (all, at, text) => {
    steps.push({ at: at.trim(), text: text });
    return all;
  });
  return steps;
}

const transformOf = step => /transform: ([^;]+);/.exec(step.text)[1];
const functionNames = transform => (transform.match(/[a-zA-Z]+(?=\()/g) || []).filter(name => name !== 'var' && name !== 'calc');
const identity = 'translate(0px, 0px) perspective(1600px) rotateZ(0deg) rotateX(0deg) scale(1)';
const inThePile = 'translate(var(--pile-x), var(--pile-y)) perspective(1600px) rotateZ(var(--pile-twist)) rotateX(var(--pile-tip)) scale(var(--pile-scale))';

test('piece-fall starts in place, is down after 62 percent, bounces up 30 px by 80 and settles, and the times are the plan\'s', () => {
  const steps = stepsOf(frameCss, 'piece-fall');
  assert.deepEqual(steps.map(step => step.at), ['0%', '62%', '80%', '100%']);

  assert.equal(transformOf(steps[0]), identity, 'the start is the piece in its place');
  assert.equal(transformOf(steps[1]), inThePile);
  assert.equal(transformOf(steps[3]), inThePile, 'and it ends where it came down');
  assert.equal(transformOf(steps[2]), inThePile.replace('var(--pile-y))', 'calc(var(--pile-y) - ' + pileShape.bounceHeight + 'px))'), 'one bounce of ' + pileShape.bounceHeight + ' px');
  assert.equal(pileShape.bounceHeight, 30);
  assert.equal(pileShape.lens, 1600);

  // the same functions in the same order in every step, so the browser can blend them
  const names = steps.map(step => functionNames(transformOf(step)).join(' '));
  assert.equal(new Set(names).size, 1, names.join(' | '));
  assert.equal(names[0], 'translate perspective rotateZ rotateX scale');

  // only transform and the timing of the next step change
  steps.forEach(step => (step.text.match(/[a-z-]+(?=:)/g) || []).forEach(word => assert.ok(['transform', 'animation-timing-function'].includes(word), step.at + ' changes ' + word)));

  const rule = /\[data-motion="full"\] #world\[data-hidden="fall"\] \[data-pile="piece"\] \{\s*animation: piece-fall calc\(var\(--time-hidden\) \* ([.0-9]+)\) linear var\(--pile-delay\) both;\s*\}/.exec(frameCss);
  assert.ok(rule, 'the rule that plays the fall');
  assert.ok(Math.abs(Number(rule[1]) * pileTimes.fallMs - (pileTimes.fallMs - pileTimes.letGoMs)) < 1e-6, 'the fall takes 1.2 s of the 1.6 s');
});

test('piece-lift goes from the pile back to the piece in its place, in 500 ms with the easing of the first assembly, one piece after another', () => {
  const steps = stepsOf(frameCss, 'piece-lift');
  assert.deepEqual(steps.map(step => step.at), ['from', 'to']);
  assert.equal(transformOf(steps[0]), inThePile);
  assert.equal(transformOf(steps[1]), identity, 'it ends in place: no tip, no turn, no offset, full size');
  assert.equal(functionNames(transformOf(steps[0])).join(' '), functionNames(transformOf(steps[1])).join(' '));
  steps.forEach(step => (step.text.match(/[a-z-]+(?=:)/g) || []).forEach(word => assert.equal(word, 'transform')));

  const rule = /\[data-motion="full"\] #world\[data-hidden="fall"\]\[data-lift\] \[data-pile="piece"\] \{\s*animation: piece-lift calc\(([.0-9]+)s \* var\(--pace\)\) var\(--ease-in\) var\(--pile-lift-delay\) both;\s*\}/.exec(frameCss);
  assert.ok(rule, 'the rule that plays the lift');
  assert.equal(Math.round(Number(rule[1]) * 1000), pileTimes.flyMs);
  assert.ok(/--ease-in: cubic-bezier\(\.2, \.8, \.2, 1\);/.test(read('tokens.css')));
  assert.ok(/animation: rise-in var\(--time-move-in\) var\(--ease-in\)/.test(frameCss), 'the easing is the one the first assembly uses');
});

test('the cube rises .6 s from the bottom edge, turns once in .8 s, pulses twice for .4 s each, and shrinks to a point, each move on a box of its own', () => {
  const cube = pileTimes.cube;
  const rules = {};
  frameCss.replace(/\[data-motion="full"\] #cube \.([a-z-]+) \{\s*animation: ([^;]+);\s*\}/g, (all, name, value) => {
    rules[name] = value;
    return all;
  });
  assert.deepEqual(Object.keys(rules).sort(), ['cube-art', 'cube-rise', 'cube-travel', 'cube-turn']);

  const seconds = text => Math.round(Number(/([.0-9]+)s/.exec(text)[1]) * 1000);
  assert.equal(seconds(rules['cube-rise']), cube.riseMs);
  assert.ok(/^cube-rise calc\(\.6s \* var\(--pace\)\) var\(--ease-in\) both$/.test(rules['cube-rise']));
  assert.ok(/^cube-turn calc\(\.8s \* var\(--pace\)\) var\(--ease-hard\) calc\(\.3s \* var\(--pace\)\) both$/.test(rules['cube-turn']));
  assert.equal(cube.turnMs, 800);
  assert.equal(cube.turnAfterMs, 300);
  assert.ok(/^cube-pulse calc\(\.4s \* var\(--pace\)\) linear calc\(\.6s \* var\(--pace\)\) 2 both$/.test(rules['cube-art']), 'two pulses');
  assert.equal(cube.pulseMs, 400);
  assert.equal(cube.pulseAfterMs, 600);
  assert.equal(rules['cube-travel'], 'cube-shrink var(--cube-shrink-time) linear var(--cube-shrink-delay) both');

  // 1 to .4 to 1
  const pulse = stepsOf(frameCss, 'cube-pulse');
  assert.deepEqual(pulse.map(step => [step.at, /opacity: ([.0-9]+)/.exec(step.text)[1]]), [['0%, 100%', '1'], ['50%', '.4']]);

  // one full turn about the upright axis, in the same lens as the pieces
  const turn = stepsOf(frameCss, 'cube-turn');
  assert.equal(transformOf(turn[0]), 'perspective(1600px) rotateY(0deg)');
  assert.equal(transformOf(turn[1]), 'perspective(1600px) rotateY(360deg)');

  // it shrinks to a point, at the place the script gives it
  const shrink = stepsOf(frameCss, 'cube-shrink');
  assert.equal(transformOf(shrink[0]), 'translate(0px, 0px) scale(1)');
  assert.equal(transformOf(shrink[1]), 'translate(var(--cube-dx), var(--cube-dy)) scale(0)');

  // it rises from below the bottom edge: its top is at 840 and it rises the 240 px to the edge of the screen
  const cubeBox = /#cube \{\s*position: absolute;\s*left: (\d+)px;\s*top: (\d+)px;\s*width: (\d+)px;\s*height: (\d+)px;\s*\}/.exec(baseCss);
  assert.ok(cubeBox, 'the place of the cube in base.css');
  const [left, top, width, height] = cubeBox.slice(1).map(Number);
  assert.deepEqual([width, height], [120, 120], 'a cube of 120 px');
  assert.equal(left + width / 2, pileShape.screenWidth / 2, 'in the middle of the bottom edge');
  assert.ok(/@keyframes cube-rise \{\s*from \{ transform: translateY\((\d+)px\); \}/.test(frameCss));
  assert.equal(Number(/@keyframes cube-rise \{\s*from \{ transform: translateY\((\d+)px\); \}/.exec(frameCss)[1]), pileShape.screenHeight - top, 'it starts at the bottom edge');
  assert.ok(top + height <= pileShape.screenHeight - pileShape.bandHeight, 'it rests above the band of the pile');

  const code = read('core/hidden-pile.js');
  const middle = /const cubeMiddle = \{ x: (\d+), y: (\d+) \};/.exec(code);
  assert.deepEqual([Number(middle[1]), Number(middle[2])], [left + width / 2, top + height / 2], 'the script knows where the middle of the cube is');
});

test('the cube is a line drawing in the team accent, 120 px, with lines of 5 px, and nothing glows or blurs', () => {
  const html = read('index.html');
  const cube = html.slice(html.indexOf('<div id="pile" hidden>'), html.indexOf('<div id="connection-status" hidden>'));
  assert.ok(cube.includes('<div id="cube" hidden>'));
  assert.deepEqual(['cube-rise', 'cube-travel', 'cube-turn'].map(name => cube.indexOf('class="' + name + '"')).filter(at => at !== -1).length, 3);
  assert.ok(cube.indexOf('cube-rise') < cube.indexOf('cube-travel') && cube.indexOf('cube-travel') < cube.indexOf('cube-turn') && cube.indexOf('cube-turn') < cube.indexOf('cube-art'));
  assert.ok(cube.includes('<svg class="cube-art" width="120" height="120" viewBox="0 0 120 120">'));

  // an isometric cube: a hexagon of six edges, and the three edges that meet in the middle
  const paths = cube.match(/<path d="([^"]+)"\/>/g).map(text => /d="([^"]+)"/.exec(text)[1]);
  assert.equal(paths.length, 2);
  const points = paths[0].match(/[ML][\d.]+ [\d.]+/g).map(point => point.slice(1).split(' ').map(Number));
  assert.equal(points.length, 6);
  const middle = [60, 60];
  const distances = points.map(point => Math.hypot(point[0] - middle[0], point[1] - middle[1]));
  distances.forEach(distance => assert.ok(Math.abs(distance - distances[0]) < 0.1, 'the six corners are the same distance from the middle'));
  assert.deepEqual(paths[1].match(/[ML][\d.]+ [\d.]+/g), ['M13.2 33', 'L60 60', 'L106.8 33', 'M60 60', 'L60 114'], 'the three inner edges meet in the middle');

  const rule = /\.cube-art path \{([^}]*)\}/.exec(baseCss)[1];
  assert.ok(rule.includes('fill: none;') && rule.includes('stroke: var(--team-accent);'), 'strokes in the team accent');
  assert.ok(Number(/stroke-width: (\d+)px/.exec(rule)[1]) >= 3, 'no line thinner than 3 px');
  const baseSource = read('base.css');
  const pileCss = withoutComments(baseSource.slice(baseSource.indexOf('#pile {'), baseSource.indexOf('/* Full screen panels')));
  assert.ok(pileCss.includes('.cube-art path'), 'the whole of the cube styles is looked at');
  assert.ok(!/(filter|shadow|blur|glow|blend|gradient|opacity)/.test(pileCss), 'no glow, blur or light');
  assert.ok(pileCss.includes('pointer-events: none;'));
  assert.ok(html.indexOf('<div id="pile" hidden>') > html.indexOf('<div id="blue-glitch" hidden>'), 'over the stage and the glitch layers');
  assert.ok(html.indexOf('<div id="pile" hidden>') < html.indexOf('<div id="connection-status" hidden>'), 'under the connection text, the night screen and the overlay');
});

test('the new section of frame.css changes only transform and opacity, promotes nothing, is for full motion only, and every number it reads has a first value', () => {
  const source = read('frame.css');
  const first = source.indexOf('/* The frames fall and come back');
  const start = source.indexOf('/* In their place, until core/hidden-pile.js');
  const end = source.indexOf('/* Hidden transitions. core/hidden-run.js');
  assert.ok(first !== -1 && start > first && end > start, 'the section is found');
  assert.ok(start - first > 1500, 'and has its comment');
  const section = withoutComments(source.slice(start, end));

  ['piece-fall', 'piece-lift', 'cube-rise', 'cube-turn', 'cube-pulse', 'cube-shrink'].forEach(name => {
    stepsOf(frameCss, name).forEach(step => (step.text.match(/[a-z-]+(?=:)/g) || []).forEach(word => {
      assert.ok(['transform', 'opacity', 'animation-timing-function'].includes(word), name + ' changes ' + word);
    }));
  });
  assert.ok(!/(filter|box-shadow|text-shadow|drop-shadow|blur\(|blend|will-change|\bperspective:|preserve-3d)/.test(section), 'no filter, shadow, blur or blend, no layer of its own, no lens on a parent');
  assert.ok(!/data-motion="(calm|none)"/.test(section), 'calm and none motion play nothing');
  section.split('}').map(chunk => chunk.split('{')[0].trim()).filter(selector => /data-hidden|data-content|#cube \./.test(selector)).forEach(selector => {
    selector.split(',').forEach(part => assert.ok(part.trim().startsWith('[data-motion="full"]'), 'full motion only: ' + part.trim()));
  });

  // every time is stretched by the Speed setting
  section.split('\n').filter(line => /animation: /.test(line)).forEach(line => {
    assert.ok(/var\(--pace\)|var\(--time-hidden\)|var\(--time-fade-in\)|var\(--cube-shrink-time\)/.test(line), line);
  });

  // the numbers the script writes: each one that the stylesheet reads has a first value, and the script clears the same ones
  const reads = Array.from(new Set((section.match(/var\((--(?:pile|cube)-[a-z-]+)\)/g) || []).map(text => text.slice(4, -1))));
  const code = read('core/hidden-pile.js');
  const cleared = (code.match(/const (poseProperties|cubeProperties) = \[([^\]]+)\]/g) || []).join(',').match(/--[a-z-]+/g);
  assert.deepEqual(reads.slice().sort(), cleared.slice().sort(), 'the script clears what the stylesheet reads');
  reads.forEach(name => {
    assert.ok(new RegExp('\\n  ' + name + ': [^;]+;').test(section), name + ' has a first value');
    assert.ok(code.includes("'" + name + "'"), 'core/hidden-pile.js writes ' + name);
  });
});

test('the frame at rest gives way to its pieces, and the shadows, the glint, the id, the kit and a released bolt are left out while the metal is down', () => {
  assert.ok(/\.piece \{ display: none; \}/.test(frameCss));
  assert.ok(/\[data-motion="full"\] #world\[data-hidden="fall"\] \[data-pile="pieces"\] \.piece \{\s*display: block;\s*\}/.test(frameCss));

  const hidden = /((?:\[data-motion="full"\] #world\[data-hidden="fall"\][^,{]*,\s*)+)\[data-motion="full"\] #world\[data-hidden="fall"\] \[data-pile="released"\] \{\s*display: none;\s*\}/.exec(frameCss);
  assert.ok(hidden, 'the rule that hides them');
  const selectors = (hidden[1] + '[data-pile="released"]').split(',').map(text => text.replace(/\[data-motion="full"\] #world\[data-hidden="fall"\] /, '').trim());
  assert.deepEqual(selectors, [
    '[data-pile="pieces"] .fills',
    '[data-pile="pieces"] [data-part="frame-a"]',
    '[data-pile="pieces"] [data-part="frame-b"]',
    '[data-pile="pieces"] [data-part="shadow-a"]',
    '[data-pile="pieces"] [data-part="shadow-b"]',
    '.shadow-layer',
    '.glint-layer',
    '.plate-id',
    '.screw-shadow',
    '.kit',
    '[data-pile="released"]',
  ]);

  // the content fades in the first .3 s and stays gone until the build, where the first assembly brings it back
  assert.ok(/#world\[data-hidden="fall"\] \[data-pile="content"\] \{\s*animation: fade-out calc\(\.3s \* var\(--pace\)\) linear both;/.test(frameCss));
  assert.ok(/#world\[data-hidden="build"\] \[data-pile="content"\] \{\s*animation: fade-in var\(--time-fade-in\) linear both;/.test(frameCss));
  assert.ok(/\.area\[data-content="in"\] \[data-slat\] \{\s*animation: slat-in calc\(\.5s \* var\(--pace\)\) var\(--ease-turn\) calc\(var\(--n\) \* 90ms \* var\(--pace\)\) both;/.test(frameCss), 'the slats turn in as they do at the first assembly');
  assert.ok(/\.area\[data-state="in"\] \[data-slat\] \{\s*animation: slat-in calc\(\.5s \* var\(--pace\)\) var\(--ease-turn\) calc\(\(1s \+ var\(--n\) \* 90ms\) \* var\(--pace\)\) both;/.test(frameCss), 'and that is the animation of the first assembly');
});


// The runner

test('hidden-run.js holds the rotation clock, plays the three parts at the times of the plan, and puts everything back whatever happened', () => {
  const run = read('core/hidden-run.js');
  const code = run.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

  // one number for the fall: the runner, the stylesheet variable, and the plan
  const fly = Number(/const flySeconds = ([0-9.]+);/.exec(code)[1]);
  assert.equal(fly * 1000, pileTimes.fallMs);
  assert.ok(read('tokens.css').includes('--hidden-seconds: ' + fly + ';'));

  const rebuild = code.slice(code.indexOf('async rebuild() {'), code.indexOf('cameBack: () => cameBackIn'));
  const order = [
    'screen.together();',
    'pauseRotation();',
    'pile = makePile();',
    "world.dataset.hidden = 'fall';",
    'pile.release(',
    'await sleep(pileTimes.cubeAtMs / 1000);',
    'pile.showCube();',
    'await sleep((pileTimes.liftAtMs - pileTimes.cubeAtMs) / 1000);',
    "world.dataset.lift = '';",
    'await sleep((plan.lockedMs - pileTimes.liftAtMs) / 1000);',
    'pile.finish();',
    "world.dataset.hidden = 'build';",
    'pile.contentIn();',
    'await sleep(flySeconds * togetherAfter);',
  ];
  order.forEach((text, index) => {
    assert.ok(rebuild.includes(text), 'rebuild lacks ' + text);
    if (index > 0) assert.ok(rebuild.indexOf(text) > rebuild.indexOf(order[index - 1]), text + ' is out of order');
  });
  assert.ok(rebuild.includes('if (!pile.empty) {'), 'a page with nothing to drop just comes back');

  // the rotation is held with the pause that is there for it, and let go once, in putBack
  assert.ok(code.includes("import { moveOn, pauseRotation, resumeRotation, secondsUntilChange } from './schedule.js';"));
  assert.equal((code.match(/pauseRotation\(\)/g) || []).length, 1);
  assert.equal((code.match(/resumeRotation\(\)/g) || []).length, 1);
  assert.ok(!/isPaused|frame\.pause|frame\.resume/.test(code), 'the whole-screen hold of a talk is not used');

  const putBack = code.slice(code.indexOf('function putBack('));
  ['delete world.dataset.hidden;', 'delete world.dataset.lift;', 'if (rotationHeld) resumeRotation();', 'rotationHeld = false;', 'if (pile) pile.clear();', 'pile = null;'].forEach(text => {
    assert.ok(putBack.includes(text), 'putBack lacks ' + text);
  });
  assert.ok(putBack.indexOf('if (rotationHeld) resumeRotation();') < putBack.indexOf('if (pile) pile.clear();'), 'the clock is let go before anything that could fail');
  assert.ok(putBack.indexOf('screen.end();') > putBack.indexOf('pile = null;') && putBack.indexOf('playing = false;') > putBack.indexOf('screen.end();'));

  // the registry still ends both effects with rebuild, which is now this
  const registry = read('core/hidden-transitions.js');
  assert.equal((registry.match(/await scene\.rebuild\(\);/g) || []).length, 2);
  assert.ok(!registry.includes('piece-build'));
});

test('the frames no longer fly back as blocks, and the seasonal decorations stay out of sight while they fall', () => {
  assert.ok(!/data-hidden="build"\] \[data-block\]/.test(frameCss));
  const seasons = withoutComments(read('seasons/motion.css'));
  assert.ok(seasons.includes(':not([data-hidden="glitch"]):not([data-hidden="break"]):not([data-hidden="build"]) .season-front'), 'fall is not one of the steps the layer is let through in');
  assert.ok(!seasons.includes('data-hidden="fall"'));
});


// The frames of every layout and style

// The svg elements of a frame's markup and what falls, by the rule of core/hidden-pile.js: a frame that is cut into
// pieces falls as its pieces, and one that is not falls as its fills and its halves
function fallersOf(markup) {
  const svgs = (markup.match(/<svg class="[^"]*"[\s\S]*?<\/svg>/g) || []).map(text => ({ classes: /<svg class="([^"]*)"/.exec(text)[1].split(' '), text: text }));
  const cut = svgs.filter(item => item.classes.includes('piece'));
  const falling = cut.length > 0 ? cut : svgs.filter(item => !item.classes.includes('glint-layer') && !item.classes.includes('shadow-layer'));
  return {
    plates: falling.length,
    bolts: falling.reduce((total, item) => total + (item.text.match(/<use class="screw"/g) || []).length, 0),
    cut: cut.length > 0,
  };
}

const knownShapes = new Set();
function withShapes(run) {
  const kept = globalThis.document;
  globalThis.document = { getElementById: id => (id === 'metal-shapes' ? { insertAdjacentHTML: (where, markup) => (markup.match(/ id="[^"]+"/g) || []).forEach(found => knownShapes.add(found.slice(5, -1))) } : null) };
  try {
    return run();
  } finally {
    if (kept === undefined) delete globalThis.document;
    else globalThis.document = kept;
  }
}

// The frames each layout and style draws, as the page draws them (frameKind in core/plate.js, and the panels)
const layouts = {
  'the standard layout in Original': { areas: ['grid1', 'grid2'], plates: ['countdown'], plateCount: 28, boltCount: 10 },
  'the standard layout in Cybertron': { areas: ['cybertron-grid1', 'cybertron-grid2', 'cybertron-ticker'], plates: ['cybertron-banner'], plateCount: 30, boltCount: 20 },
  'the sidebar layout': { areas: ['grid1'], plates: [], plateCount: 13, boltCount: 4 },
  'the bar layout': { areas: ['bar-main', 'bar-ticker'], plates: ['bar-banner'], plateCount: 18, boltCount: 14 },
  'the bar layout in Minimal': { areas: ['bar-main-minimal', 'bar-ticker-minimal'], plates: ['bar-banner-minimal'], plateCount: 18, boltCount: 12 },
};

test('every layout and style draws pieces to drop and bolts on them, and with the folding no more than 40 fall', () => {
  withShapes(() => {
    Object.keys(layouts).forEach(name => {
      const layout = layouts[name];
      const found = layout.areas.map(kind => fallersOf(plate.areaMarkup(kind))).concat(layout.plates.map(kind => fallersOf(plate.plateMarkup(kind))));

      const plates = found.reduce((total, item) => total + item.plates, 0);
      const bolts = found.reduce((total, item) => total + item.bolts, 0);
      assert.equal(plates, layout.plateCount, name + ': pieces');
      assert.equal(bolts, layout.boltCount, name + ': bolts');
      assert.ok(found.every(item => item.plates >= 3 && item.bolts >= 2), name + ': every frame has plates and bolts');

      // the plan, with a plate for every piece and a bolt on the plate it is on
      const pieces = [];
      found.forEach((item, frameIndex) => {
        for (let index = 0; index < item.plates; index++) pieces.push({ id: 'plate-' + frameIndex + '-' + index, left: index * 20, top: 100 + frameIndex * 30, width: 200, height: 100, parent: '' });
        for (let index = 0; index < item.bolts; index++) pieces.push({ id: 'bolt-' + frameIndex + '-' + index, left: index * 30, top: 100, width: 48, height: 48, parent: 'plate-' + frameIndex + '-' + (index % item.plates) });
      });
      const plan = planPile(pieces, 1);
      assert.ok(plan.pieces.length <= pieceLimit, name + ': ' + plan.pieces.length + ' pieces');
      assert.equal(plan.pieces.length + plan.merged.length, plates + bolts);
      assert.ok(plan.lockedMs <= pileTimes.totalMs, name + ': home by ' + plan.lockedMs);
      if (plates + bolts <= pieceLimit) assert.deepEqual(plan.merged, [], name + ' needs no folding');
      else plan.merged.forEach(id => assert.ok(id.startsWith('bolt-'), name + ': only bolts are folded in ' + id));
    });
  });
});

test('the large and the small frame, and the main panel of the bar layout, are cut into pieces that fall in place of the whole frame, and the others fall as their fills and halves', () => {
  withShapes(() => {
    ['grid1', 'grid2', 'cybertron-grid1', 'cybertron-grid2', 'bar-main', 'bar-main-minimal'].forEach(kind => {
      assert.equal(fallersOf(plate.areaMarkup(kind)).cut, true, kind);
    });
    ['cybertron-ticker', 'bar-ticker', 'bar-ticker-minimal'].forEach(kind => {
      const found = fallersOf(plate.areaMarkup(kind));
      assert.equal(found.cut, false, kind);
      assert.equal(found.plates, 3, kind + ' falls as its fills and its two halves');
    });
    ['countdown', 'cybertron-banner', 'bar-banner', 'bar-banner-minimal'].forEach(kind => assert.equal(fallersOf(plate.plateMarkup(kind)).plates, 3, kind));

    // the markup has the classes the script looks for
    const markup = plate.areaMarkup('grid1');
    assert.ok(markup.includes('class="plate shadow-layer"') && markup.includes('class="plate glint-layer"') && markup.includes('class="plate fills"') && markup.includes('class="plate piece"'));
    assert.ok(markup.includes('class="plate-id"') || markup.includes('class="plate-id '), 'the stamped id');
    assert.ok(markup.includes('<use class="screw"') && markup.includes('<use class="screw-shadow"'));
  });
});


// The page

// A page with just enough in it for core/hidden-pile.js: elements with children, classes, attributes, data values and
// styles, a selector that knows tags, classes and attributes, and boxes that the test gives them
function parseCompound(text) {
  return {
    tag: (/^[a-z]+/.exec(text) || [''])[0],
    classes: (text.match(/\.[a-z0-9-]+/g) || []).map(name => name.slice(1)),
    attributes: (text.match(/\[[^\]]+\]/g) || []).map(part => {
      const pieces = part.slice(1, -1).split('=');
      return { name: pieces[0], value: pieces.length === 1 ? null : pieces[1].replace(/"/g, '') };
    }),
  };
}

const camel = name => name.replace(/-([a-z])/g, (all, letter) => letter.toUpperCase());

function makeElement(tag, options = {}) {
  const element = {
    tag: tag,
    classes: new Set((options.classes || '').split(' ').filter(Boolean)),
    attributes: Object.assign({}, options.attributes),
    children: [],
    parentNode: null,
    dataset: {},
    hidden: options.hidden === true,
    rect: options.rect || { left: 0, top: 0, width: 0, height: 0 },
    offsetWidth: options.offsetWidth,
    background: options.background || 'rgba(0, 0, 0, 0)',
    beforeContent: options.beforeContent || 'none',
    properties: {},
    style: {
      left: '',
      top: '',
      zIndex: '',
      setProperty(name, value) { element.properties[name] = value; },
      removeProperty(name) { delete element.properties[name]; },
    },
    classList: { contains: name => element.classes.has(name) },
    getBoundingClientRect: () => element.rect,
    getAttribute(name) {
      if (name.startsWith('data-') && camel(name.slice(5)) in element.dataset) return String(element.dataset[camel(name.slice(5))]);
      return name in element.attributes ? element.attributes[name] : null;
    },
    setAttribute(name, value) {
      if (name === 'class') element.classes = new Set(String(value).split(' ').filter(Boolean));
      else element.attributes[name] = String(value);
    },
    matches(selector) {
      return selector.split(',').some(part => {
        const compound = parseCompound(part.trim());
        return (compound.tag === '' || element.tag === compound.tag)
          && compound.classes.every(name => element.classes.has(name))
          && compound.attributes.every(item => {
            const value = element.getAttribute(item.name);
            return item.value === null ? value !== null : value === item.value;
          });
      });
    },
    closest(selector) {
      for (let node = element; node; node = node.parentNode) if (node.matches(selector)) return node;
      return null;
    },
    querySelectorAll(selector) {
      const found = [];
      const walk = node => node.children.forEach(child => {
        if (child.matches(selector)) found.push(child);
        walk(child);
      });
      walk(element);
      return found;
    },
    appendChild(child) {
      if (child.parentNode) child.remove();
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    insertBefore(child, before) {
      if (child.parentNode) child.remove();
      child.parentNode = element;
      element.children.splice(element.children.indexOf(before), 0, child);
      return child;
    },
    remove() {
      if (element.parentNode) element.parentNode.children.splice(element.parentNode.children.indexOf(element), 1);
      element.parentNode = null;
    },
  };
  if (options.id) element.attributes.id = options.id;
  return element;
}

// Adds children to an element and gives the element back
function holding(element, ...children) {
  children.forEach(child => element.appendChild(child));
  return element;
}

const box = (left, top, width, height) => ({ left: left, top: top, width: width, height: height });

// A bolt is a use in a group in the svg it is bolted to
function bolt(left, top) {
  return holding(makeElement('g'), makeElement('use', { classes: 'screw', attributes: { href: '#bolt-shape' }, rect: box(left, top, 38, 38) }));
}

// The page of the standard layout in Original, in little: the large frame cut into three pieces with two bolts,
// a countdown that is not cut up with a bolt on each half, the banner with no frame, and the small panel and the ticker
// not drawn. extra can change the pieces of the large frame
function standardPage(extra = {}) {
  const screen = makeElement('div', { id: 'screen', rect: box(extra.screenLeft || 0, extra.screenTop || 0, extra.screenWidth || 1920, extra.screenWidth ? extra.screenWidth * 9 / 16 : 1080) });
  const stage = makeElement('div', { id: 'stage' });

  const piece = (name, rect, ...inside) => holding(makeElement('svg', { classes: 'plate piece', attributes: { 'data-piece': name, width: String(rect.width) }, rect: rect }), ...inside);
  const area = makeElement('div', { classes: 'area', attributes: { 'data-area': 'grid1' } });
  holding(area,
    makeElement('svg', { classes: 'plate fills', attributes: { width: '1152' } }),
    makeElement('span', { classes: 'plate-id' }),
    makeElement('svg', { classes: 'plate shadow-layer', attributes: { width: '1152' } }),
    makeElement('svg', { classes: 'plate', attributes: { 'data-part': 'frame-a', width: '1152' } }, ),
    makeElement('svg', { classes: 'plate glint-layer', attributes: { width: '1152' }, rect: box(100, 100, 1152, 708) }),
    piece('plate-header-left', box(100, 100, 580, 150)),
    piece('edge-top-left', box(200, 90, 400, 70), bolt(210, 100), bolt(560, 100)),
    piece('corner-bottom-right', box(900, 700, 300, 100), bolt(1000, 760)),
    holding(makeElement('div', { classes: 'page-host' }), makeElement('div', { classes: 'page' })),
  );
  // in the real page the plain frame is hidden while the pieces show, so its parts have no box
  holding(stage, holding(makeElement('div', { id: 'region-grid1', attributes: { 'data-block': '' } }), area));

  const countdown = makeElement('section', { classes: 'panel countdown', attributes: { 'data-sequence': 'countdown' } });
  holding(countdown,
    makeElement('svg', { classes: 'plate fills', attributes: { width: '656' }, rect: box(1300, 100, 656, 320) }),
    holding(makeElement('svg', { classes: 'plate', attributes: { 'data-part': 'frame-a', width: '656' }, rect: box(1300, 100, 656, 320) }), bolt(1320, 120)),
    holding(makeElement('svg', { classes: 'plate', attributes: { 'data-part': 'frame-b', width: '656' }, rect: box(1300, 100, 656, 320) }), bolt(1900, 400)),
    makeElement('svg', { classes: 'plate glint-layer', attributes: { width: '656' }, rect: box(1300, 100, 656, 320) }),
    makeElement('span', { classes: 'plate-id' }),
    makeElement('div', { classes: 'scan-clip' }),
    makeElement('div', { classes: 'days' }),
  );
  holding(stage, holding(makeElement('div', { id: 'region-countdown', attributes: { 'data-block': '' } }), countdown));

  const banner = holding(makeElement('section', { classes: 'panel banner', attributes: { 'data-sequence': 'banner' } }), makeElement('div', { classes: 'banner-text' }));
  holding(stage, holding(makeElement('div', { id: 'region-banner', attributes: { 'data-block': '' } }), banner));

  const cube = makeElement('div', { id: 'cube', hidden: true });
  const layer = holding(makeElement('div', { id: 'pile', hidden: true }), cube);
  const body = holding(makeElement('body'), screen, stage, layer);

  return { screen: screen, stage: stage, area: area, countdown: countdown, banner: banner, layer: layer, cube: cube, body: body };
}

// Runs something with this page as the document
async function onPage(page, run) {
  const keptDocument = globalThis.document;
  const keptWindow = globalThis.window;
  const everything = element => [element].concat(element.children.reduce((all, child) => all.concat(everything(child)), []));

  globalThis.document = {
    getElementById: id => everything(page.body).find(element => element.attributes.id === id) || null,
    querySelectorAll: selector => page.body.querySelectorAll(selector),
    createElementNS: (namespace, tag) => makeElement(tag),
  };
  globalThis.window = {
    getComputedStyle: (element, pseudo) => (pseudo ? { content: element.beforeContent } : { backgroundColor: element.background, backgroundImage: 'none' }),
  };
  try {
    return await run();
  } finally {
    if (keptDocument === undefined) delete globalThis.document;
    else globalThis.document = keptDocument;
    if (keptWindow === undefined) delete globalThis.window;
    else globalThis.window = keptWindow;
    delete globalThis.testPace;
  }
}

const marksOn = page => page.body.querySelectorAll('[data-pile]').map(element => element.dataset.pile);
const pileProperties = element => Object.keys(element.properties).filter(name => name.startsWith('--pile-'));

test('the script marks the areas whose frames are cut up, and finds the pieces, the halves, the bolts and the content, and nothing else', async () => {
  const page = standardPage();
  await onPage(page, () => {
    const pile = pileModule.makePile();
    assert.equal(pile.empty, false);
    assert.equal(page.area.dataset.pile, 'pieces', 'the large area shows its pieces');
    assert.equal(page.countdown.dataset.pile, undefined, 'the countdown is not cut up');
    assert.deepEqual(marksOn(page), ['pieces'], 'nothing else is marked before the fall');

    // the page shows the pieces now, so they have a box
    const plan = pile.release(5);
    const marked = page.body.querySelectorAll('[data-pile="piece"]');
    const names = marked.map(element => element.attributes['data-piece'] || element.attributes['data-part'] || element.classes.has('fills') && 'fills' || element.classes.has('pile-bolt') && 'bolt');
    assert.deepEqual(names.sort(), ['bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'corner-bottom-right', 'edge-top-left', 'fills', 'frame-a', 'frame-b', 'plate-header-left']);

    // the frame at rest, the shadows, the glint and the id are not marked: the stylesheet hides them
    ['fills', 'shadow-layer', 'glint-layer', 'plate-id'].forEach(name => {
      page.body.querySelectorAll('.' + name).filter(element => element.parentNode === page.area).forEach(element => assert.equal(element.dataset.pile, undefined, name));
    });
    assert.equal(page.area.children.find(child => child.classes.has('glint-layer')).dataset.pile, undefined);
    assert.deepEqual(plan.merged, []);
    assert.equal(plan.pieces.length, 11);

    // the content is the page of the area, and what the banner and the countdown hold apart from their metal
    const content = page.body.querySelectorAll('[data-pile="content"]');
    assert.equal(content.length, 3, 'the page, the banner text and the days');
    assert.ok(content.some(element => element.classes.has('page-host')) && content.some(element => element.classes.has('banner-text')) && content.some(element => element.classes.has('days')));
    assert.ok(!content.some(element => element.classes.has('scan-clip') || element.classes.has('plate-id') || element.tag === 'svg'), 'the sweep, the id and the plates are not content');

    pile.clear();
  });
});

test('a bolt falls as a copy of its own in #pile, the bolt on the frame hides, and the copy has the bolt\'s shape, place and size', async () => {
  const page = standardPage();
  await onPage(page, () => {
    const pile = pileModule.makePile();
    pile.release(9);

    const copies = page.layer.children.filter(child => child.classes.has('pile-bolt'));
    assert.equal(copies.length, 5, 'one for each bolt');
    assert.ok(page.layer.children[page.layer.children.length - 1] === page.cube, 'the cube is on top of them');
    copies.forEach(copy => {
      assert.ok(copy.classes.has('plate') && copy.dataset.pile === 'piece');
      assert.equal(copy.attributes.width, '48');
      assert.equal(copy.attributes.viewBox, '-24 -24 48 48');
      const head = copy.children[0];
      assert.equal(head.tag, 'use');
      assert.equal(head.attributes.href, '#bolt-shape');
      assert.ok(head.classes.has('screw'));
    });

    // the first bolt is at 210,100 with a box of 38: its middle is 229,119
    const first = copies.find(copy => copy.style.left === '205px');
    assert.ok(first, 'a copy is centred on the bolt: left ' + copies.map(copy => copy.style.left).join(', '));
    assert.equal(first.style.top, '95px');

    const released = page.body.querySelectorAll('[data-pile="released"]');
    assert.equal(released.length, 5);
    released.forEach(element => assert.ok(element.classes.has('screw')));

    // finish takes the copies away and shows the bolts again, and the cube and the layer are hidden
    pile.showCube();
    assert.equal(page.cube.hidden, false);
    pile.finish();
    assert.equal(page.layer.children.filter(child => child.classes.has('pile-bolt')).length, 0);
    assert.equal(page.body.querySelectorAll('[data-pile="released"]').length, 0);
    assert.ok(page.cube.hidden && page.layer.hidden);
    assert.equal(page.body.querySelectorAll('[data-pile="piece"]').length, 6, 'the pieces keep their numbers until the page is cleared');
    pile.clear();
  });
});

test('every piece gets its numbers from the plan, the delays are stretched by the Speed setting, and the cube is given the place of the large panel', async () => {
  const page = standardPage();
  page.stage.children[0].rect = box(40, 200, 1152, 708);
  await onPage(page, () => {
    globalThis.testPace = 2;
    const pile = pileModule.makePile();
    const plan = pile.release(3);

    plan.pieces.forEach(entry => {
      const element = page.body.querySelectorAll('[data-pile="piece"]').find(item => item.properties['--pile-lift-delay'] === Math.round(entry.lift.delayMs * 2) + 'ms');
      assert.ok(element, entry.id + ' has its lift delay stretched by 2');
      assert.equal(element.properties['--pile-delay'], Math.round(entry.fall.delayMs * 2) + 'ms');
      assert.equal(element.properties['--pile-tip'], entry.pose.tip + 'deg');
      assert.equal(element.properties['--pile-twist'], entry.pose.twist + 'deg');
      assert.equal(element.properties['--pile-scale'], String(entry.pose.scale));
      assert.equal(pileProperties(element).length, 7);
    });
    // no piece is given a stacking of its own: the words of a panel stay above its plates while they fade
    page.body.querySelectorAll('[data-pile="piece"]').forEach(element => assert.equal(element.style.zIndex, ''));

    // 40 + 576 = 616 across and 200 + 354 = 554 down, from the middle of the cube at 960, 900
    assert.equal(page.cube.properties['--cube-dx'], (616 - 960) + 'px');
    assert.equal(page.cube.properties['--cube-dy'], (554 - 900) + 'px');
    assert.equal(page.cube.properties['--cube-shrink-delay'], (pileTimes.liftAtMs - pileTimes.cubeAtMs) * 2 + 'ms');
    assert.equal(page.cube.properties['--cube-shrink-time'], (plan.lockedMs - pileTimes.liftAtMs) * 2 + 'ms');
    assert.equal(page.layer.hidden, false);
    pile.clear();
  });
});

test('a frame that the layout scales to fit moves by its own pixels, and a window smaller than the screen is allowed for', async () => {
  // the piece is drawn 300 wide and shown at 150: the zoom is a half, so a distance on the screen is twice as many of its own pixels
  const page = standardPage();
  const edge = page.area.children.find(child => child.attributes['data-piece'] === 'edge-top-left');
  edge.rect = box(200, 90, 150, 35);
  edge.attributes.width = '300';
  await onPage(page, () => {
    const pile = pileModule.makePile();
    const plan = pile.release(4);
    const entry = plan.pieces.find(item => item.id === 'plate-1');
    const wanted = Math.round(entry.pose.x / 0.5 * 10) / 10;
    assert.equal(edge.properties['--pile-x'], wanted + 'px');
    assert.equal(edge.properties['--pile-y'], Math.round(entry.pose.y / 0.5 * 10) / 10 + 'px');
    assert.equal(edge.properties['--pile-scale'], String(entry.pose.scale), 'the size is relative, so it is not changed');
    pile.clear();
  });

  // the whole screen shrunk to half, as shell.js does for a smaller window: boxes are measured in the pixels of the
  // 1920 x 1080 screen, so the plan is the one the full size screen gets
  const full = standardPage();
  const small = standardPage();
  small.body.querySelectorAll('*').concat([small.body]).forEach(element => {
    element.rect = box(element.rect.left / 2, element.rect.top / 2, element.rect.width / 2, element.rect.height / 2);
  });
  assert.equal(small.screen.rect.width, 960);

  const planOn = async page => onPage(page, () => {
    const pile = pileModule.makePile();
    const plan = pile.release(4);
    pile.clear();
    return plan;
  });
  const fullPlan = await planOn(full);
  const smallPlan = await planOn(small);
  assert.equal(fullPlan.pieces.length, 11);
  assert.deepEqual(smallPlan, fullPlan);
});

test('more than 40 pieces fold the smallest bolts into their plates: those bolts have no copy and stay on the frame', async () => {
  const page = standardPage();
  const edge = page.area.children.find(child => child.attributes['data-piece'] === 'edge-top-left');
  for (let index = 0; index < 40; index++) edge.appendChild(bolt(300 + index, 120));
  await onPage(page, () => {
    const pile = pileModule.makePile();
    const plan = pile.release(6);
    assert.equal(plan.pieces.length, 40);
    assert.equal(plan.merged.length, 5 + 40 + 6 - 40, 'six plates and the frames\' own pieces make up the rest');

    const copies = page.layer.children.filter(child => child.classes.has('pile-bolt'));
    assert.equal(copies.length + plan.merged.length, 45, 'every bolt is a copy or is folded into its plate');
    assert.equal(page.body.querySelectorAll('[data-pile="released"]').length, copies.length, 'a folded bolt is not hidden');
    assert.equal(page.body.querySelectorAll('[data-pile="piece"]').length, 40);
    pile.clear();
  });
});

test('contentIn turns the pages of the areas in and brings the content of each panel in without its frame, and clear takes everything off the page', async () => {
  const page = standardPage();
  await onPage(page, () => {
    const pile = pileModule.makePile();
    pile.release(8);
    pile.showCube();
    frameStandIn.entered.length = 0;
    pile.contentIn();
    assert.equal(page.area.dataset.content, 'in');
    assert.deepEqual(frameStandIn.entered.map(call => call.panel.attributes['data-sequence']).sort(), ['banner', 'countdown']);
    assert.ok(frameStandIn.entered.every(call => call.contentOnly === true), 'the frame is not drawn again');

    pile.clear();
    assert.deepEqual(marksOn(page), [], 'no mark is left');
    page.body.querySelectorAll('*').forEach(element => {
      assert.deepEqual(pileProperties(element), [], 'no number is left');
    });
    assert.equal(page.area.dataset.content, undefined);
    assert.equal(page.layer.children.filter(child => child.classes.has('pile-bolt')).length, 0);
    assert.ok(page.cube.hidden && page.layer.hidden);
    assert.deepEqual(Object.keys(page.cube.properties), []);

    // clearing twice, or on a page that was never released, does no harm
    pile.clear();
    pileModule.makePile().clear();
  });
});

test('a region that paints a box of its own falls whole, with its content faded and its kit left behind, and a page with no metal is empty', async () => {
  const page = standardPage();
  const strip = makeElement('div', { id: 'region-strip', classes: 'strip', attributes: { 'data-block': '' }, rect: box(0, 24, 1920, 130), background: 'rgb(59, 42, 122)', offsetWidth: 1920 });
  holding(strip, makeElement('div', { id: 'strip-name' }), makeElement('div', { classes: 'kit kit-strip' }));
  page.stage.appendChild(strip);

  // a region with no background that draws its frame in a ::before falls too, as the strip and the sidebar of Neon Prime do
  const sidebar = makeElement('div', { id: 'region-sidebar', classes: 'sidebar', attributes: { 'data-block': '' }, rect: box(40, 170, 384, 776), beforeContent: '""', offsetWidth: 384 });
  holding(sidebar, makeElement('div', { id: 'sidebar-top' }));
  page.stage.appendChild(sidebar);

  await onPage(page, () => {
    const pile = pileModule.makePile();
    pile.release(2);
    assert.equal(strip.dataset.pile, 'piece', 'the strip falls');
    assert.equal(strip.children[0].dataset.pile, 'content', 'what is in it fades');
    assert.equal(strip.children[1].dataset.pile, undefined, 'the kit is hidden by the stylesheet');
    assert.equal(strip.properties['--pile-delay'] !== undefined, true);
    assert.equal(sidebar.dataset.pile, 'piece', 'and so does a region whose frame is a ::before');
    assert.equal(sidebar.children[0].dataset.pile, 'content');
    assert.equal(page.stage.children[0].dataset.pile, undefined, 'a region with nothing painted is not a piece');
    pile.clear();
  });

  // a region that holds plates is not a box, even when it paints one: the plates fall, and it stays
  page.stage.children[0].beforeContent = '""';
  await onPage(page, () => {
    const pile = pileModule.makePile();
    pile.release(2);
    assert.equal(page.stage.children[0].dataset.pile, undefined);
    assert.equal(page.area.dataset.pile, 'pieces');
    pile.clear();
  });

  const bare = makeElement('div', { id: 'stage' });
  const empty = { body: holding(makeElement('body'), bare, holding(makeElement('div', { id: 'pile' }), makeElement('div', { id: 'cube' }))) };
  await onPage(empty, () => {
    const pile = pileModule.makePile();
    assert.equal(pile.empty, true);
    pile.clear();
  });
});

test('hidden-pile.js uses nothing newer than the rest of the dashboard and holds no timer or animation of its own', () => {
  const code = read('core/hidden-pile.js').split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
  assert.ok(!/setTimeout|setInterval|requestAnimationFrame|\.animate\(|frame\.wait/.test(code), 'frame.css moves, hidden-run.js times');
  assert.ok(!/\?\.|\?\?|\.\.\.[a-z]/.test(code));
  assert.equal(code.split('\n').filter(line => /^import /.test(line)).join('\n'), "import { enter, pace } from '../frame.js';\nimport { pileShape, pileTimes, planPile } from './transitions.js';");
  assert.ok(!/\bdocument\b|\bwindow\b/.test(read('core/transitions.js').split('\n').filter(line => !line.trim().startsWith('//')).join('\n')), 'the plan has no page in it');
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
