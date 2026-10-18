// Tests for the panel and view transitions (docs/transitions.md): the skeleton, the squares, the folding edges, the tracks and
// the rule that says which transition a page change gets. The plan has no page in it, so it runs here. The motion tests
// (tests/motion/reform.mjs) play the transitions in a browser.
//
//   node tests/reform.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboard = fileURLToPath(new URL('../dashboard/', import.meta.url));
const plan = await import(pathToFileURL(path.join(dashboard, 'core', 'reform-plan.js')).href);
const read = file => fs.readFileSync(path.join(dashboard, file), 'utf8');

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

await test('the skeleton has the five phases of the order, in seconds of a three second transition', () => {
  const times = plan.reformTimes;
  assert.deepEqual(times.loosen, [0, 400]);
  assert.deepEqual(times.fold, [400, 1050]);
  assert.deepEqual(times.turn, [1100, 1900]);
  assert.deepEqual(times.unfold, [1950, 2600]);
  assert.deepEqual(times.tighten, [2450, 3000]);
  assert.equal(times.totalMs, 3000);
});

await test('transitionSeconds stretches the skeleton, from 2 to 4 seconds, and 3 is the skeleton', () => {
  assert.equal(plan.reformScale(3), 1);
  assert.equal(plan.reformScale(2), 2 / 3);
  assert.equal(plan.reformScale(4), 4 / 3);
  assert.equal(plan.reformScale(1), 2 / 3);
  assert.equal(plan.reformScale(9), 4 / 3);
  assert.equal(plan.reformScale(undefined), 1);
  assert.equal(plan.reformScale('slow'), 1);
});

await test('the grids are 12 by 6 on the main panel, 3 by 8 on the side column and 16 by 1 on the banner and the ticker', () => {
  assert.deepEqual(plan.grids.main, { cols: 12, rows: 6 });
  assert.deepEqual(plan.grids.side, { cols: 3, rows: 8 });
  assert.deepEqual(plan.grids.banner, { cols: 16, rows: 1 });
  assert.deepEqual(plan.grids.ticker, { cols: 16, rows: 1 });
  assert.equal(plan.squaresOf(main, 'main', 1).length, 72);
  assert.equal(plan.squaresOf({ x: 32, y: 216, w: 336, h: 736 }, 'side', 1).length, 24);
  assert.equal(plan.squaresOf({ x: 32, y: 32, w: 1856, h: 160 }, 'banner', 1).length, 16);
});

await test('the squares fill the window with no gap and no overlap, and the window is inside the straps', () => {
  const squares = plan.squaresOf(main, 'main', 7);
  const win = plan.windowOf(main);
  const area = squares.reduce((sum, square) => sum + square.w * square.h, 0);

  assert.equal(area, win.w * win.h);
  assert.ok(win.x > main.x && win.y > main.y && win.x + win.w < main.x + main.w && win.y + win.h < main.y + main.h);
  squares.forEach(square => {
    assert.ok(square.x >= win.x && square.y >= win.y && square.x + square.w <= win.x + win.w && square.y + square.h <= win.y + win.h);
  });
});

await test('the turn is a wave from the top left corner, with a little jitter, and every square turns inside 1.10 to 1.90 seconds', () => {
  const squares = plan.squaresOf(main, 'main', 3);
  const first = squares.find(square => square.col === 0 && square.row === 0);
  const last = squares.find(square => square.col === 11 && square.row === 5);

  assert.ok(first.startMs < last.startMs);
  assert.ok(first.startMs - 1100 < 45);
  squares.forEach(square => {
    assert.ok(square.startMs >= plan.reformTimes.turn[0]);
    assert.ok(square.startMs + plan.squareTurnMs <= plan.reformTimes.turn[1], 'square ' + square.col + ',' + square.row + ' ends in time');
  });
  assert.deepEqual(plan.squaresOf(main, 'main', 3), squares, 'the same seed gives the same jitter');
  assert.notDeepEqual(plan.squaresOf(main, 'main', 4).map(square => square.startMs), squares.map(square => square.startMs));
});

await test('each edge is two chains of four segments, with three knuckle pins, and top and bottom fold before left and right', () => {
  const chains = plan.chainsOf(main);
  assert.equal(chains.length, 8);
  chains.forEach(chain => {
    assert.equal(chain.segments, 4);
    assert.ok(Math.abs(chain.segment * 4 - chain.length) < 0.001);
  });
  ['top', 'bottom', 'left', 'right'].forEach(edge => assert.equal(chains.filter(chain => chain.edge === edge).length, 2, edge));

  const horizontal = plan.jointTimes('h', 3);
  const vertical = plan.jointTimes('v', 1);
  assert.equal(horizontal.foldStart, 400, 'the outer joint of the top edge folds first');
  assert.ok(horizontal.foldStart < vertical.foldStart);
  assert.equal(vertical.foldEnd, 1050, 'the fold ends at 1.05');
  assert.ok(vertical.unfoldStart < plan.jointTimes('h', 1).unfoldStart, 'left and right unfold before top and bottom');
  assert.equal(plan.jointTimes('h', 3).unfoldEnd, 2600, 'the unfold ends at 2.60');
  [1, 2, 3].forEach(joint => ['h', 'v'].forEach(axis => {
    const times = plan.jointTimes(axis, joint);
    assert.ok(times.foldEnd <= 1050 && times.unfoldStart >= 1950 && times.unfoldEnd <= 2600);
  }));
});

await test('the rivets pop up in a run from the corners to the middle of each edge and seat in the other order', () => {
  const rivets = plan.rivetsOf(main).filter(rivet => rivet.edge === 'top');
  assert.equal(rivets.length, 4);
  assert.ok(plan.rivetStops(0)[1][0] < plan.rivetStops(1)[1][0], 'the one nearer the corner pops first');
  assert.ok(plan.rivetStops(1)[2][0] < plan.rivetStops(0)[2][0], 'and the one nearer the middle seats first');
});

await test('the screws spin out two turns and lift, and spin in last', () => {
  const stops = plan.screwStops();
  assert.ok(/rotate\(-720deg\)/.test(stops[1][1]));
  assert.ok(/scale\(1.35\)/.test(stops[1][1]), 'it lifts: it is larger, as it is nearer');
  assert.ok(stops[1][0] <= 400, 'out by 0.40');
  assert.ok(stops[stops.length - 2][0] >= 2700, 'in during the last part of the tighten');
});

await test('every track moves transform or opacity, and no track names a color, a size or a shadow', () => {
  const squares = plan.squaresOf(main, 'main', 1);
  const tracks = [
    ['transform', plan.cameraStops()], ['transform', plan.squareStops(squares[10])], ['opacity', plan.squareShadeStops(squares[10])],
    ['transform', plan.jointStops('h', 2)], ['opacity', plan.jointShadeStops('v', 3)], ['opacity', plan.chassisStops()],
    ['opacity', plan.coverOldStops()], ['opacity', plan.coverNewStops()], ['opacity', plan.coverNewStops(true)], ['opacity', plan.coverEdgesStops()], ['opacity', plan.hiddenStops()],
  ];
  plan.hardwareList(main).forEach(item => tracks.push(['transform', item.stops]));

  tracks.forEach(([property, stops]) => {
    plan.framesOf(property, stops).forEach(frame => {
      assert.deepEqual(Object.keys(frame).filter(key => key !== 'offset' && key !== 'easing'), [property]);
      assert.ok(frame.offset >= 0 && frame.offset <= 1);
    });
    assert.equal(plan.framesOf(property, stops)[0].offset, 0, 'a track starts at 0');
    assert.equal(plan.framesOf(property, stops).slice(-1)[0].offset, 1, 'and ends at 1');
  });
});

await test('the transforms of one track have the same functions in the same order, so the browser can blend them', () => {
  const squares = plan.squaresOf(main, 'main', 1);
  const lists = [plan.squareStops(squares[3], { dx: 12, dy: -4, sx: 1.2, sy: 0.9 }), plan.jointStops('h', 1), plan.jointStops('v', 2), plan.cameraStops(), plan.screwStops(), plan.latchStops(-70), plan.gearStops(1), plan.pistonStops('h')];
  plan.hardwareList(main).forEach(item => lists.push(item.stops));

  lists.forEach(stops => {
    const shape = value => String(value).replace(/\(.*?\)/g, '()').replace(/\s+/g, ' ');
    const first = shape(plan.framesOf('transform', stops).find(frame => frame.transform !== undefined).transform);
    plan.framesOf('transform', stops).forEach(frame => assert.equal(shape(frame.transform), first, JSON.stringify(stops).slice(0, 80)));
  });
});

await test('a region that changes place moves while its edges are folded, by one step that the tracks hold around', () => {
  const stops = plan.movedStops(plan.screwStops(), { dx: 100, dy: -20 });
  const before = stops.filter(stop => stop[0] < plan.relocateMs);
  const after = stops.filter(stop => stop[0] >= plan.relocateMs);

  assert.ok(before.every(stop => stop[1].startsWith('translate(0px,0px) ')));
  assert.ok(after.every(stop => stop[1].startsWith('translate(100px,-20px) ')));
  assert.ok(plan.relocateMs >= plan.reformTimes.fold[1] && plan.relocateMs <= plan.reformTimes.unfold[0], 'it is while the edges are folded');
  const still = plan.screwStops();
  assert.equal(plan.movedStops(still, { dx: 0, dy: 0 }), still, 'no move leaves the track as it is');
});

await test('the flat copies: the old one covers the squares until the turn starts, the new one from the last seat, and both are opacity only', () => {
  const old = plan.coverOldStops();
  assert.equal(old[0][1], 1);
  assert.equal(old.find(stop => stop[0] === plan.reformTimes.coverOldOut)[1], 0);
  const fresh = plan.coverNewStops();
  assert.equal(fresh[0][1], 0);
  assert.equal(fresh.find(stop => stop[0] === plan.reformTimes.coverNewIn[1])[1], 1);
  assert.ok(plan.reformTimes.coverNewIn[0] >= plan.reformTimes.turn[1], 'after the last square has seated');
  assert.equal(plan.coverNewStops(true).slice(-1)[0][1], 0, 'a cover of the whole stage goes at the end and shows the real page');
});

await test('the chassis shows for the turn only, and the squares are over it', () => {
  const stops = plan.chassisStops();
  assert.equal(stops[0][1], 0);
  assert.ok(plan.trackAt(stops, 1500) === 1);
  assert.ok(plan.trackAt(stops, 600) === 0 && plan.trackAt(stops, 2500) === 0);
});

await test('the camera leans five degrees down and three to the side, drifts to the other side and settles', () => {
  const frames = plan.cameraStops();
  assert.ok(/rotateX\(5deg\) rotateY\(-3deg\)/.test(frames[1][1]));
  assert.ok(/rotateX\(5deg\) rotateY\(3deg\)/.test(frames[2][1]));
  assert.ok(/rotateX\(0deg\) rotateY\(0deg\)/.test(frames[3][1]));
  assert.equal(frames[3][0], 3000);
});

await test('a page change gets the panel transition inside a view and the view transition between views, in full motion only', () => {
  const free = { motion: 'full', busy: false, running: false, looked: false, monday: false };

  assert.equal(plan.kindToPlay('reform', free), 'reform');
  assert.equal(plan.kindToPlay('reformView', Object.assign({}, free, { looked: true })), 'reformView');
  assert.equal(plan.kindToPlay('reformView', free), '', 'a view transition goes with the look that was held for it');
  assert.equal(plan.kindToPlay('reform', Object.assign({}, free, { looked: true })), '', 'a look that is waiting is the swap');
  assert.equal(plan.kindToPlay('reform', Object.assign({}, free, { monday: true })), '', 'a Monday card is the swap');
  assert.equal(plan.kindToPlay('', free), '', 'before the views have started nothing is noted');
  ['calm', 'none'].forEach(motion => {
    assert.equal(plan.kindToPlay('reform', Object.assign({}, free, { motion: motion })), '');
    assert.equal(plan.kindToPlay('reformView', Object.assign({}, free, { motion: motion, looked: true })), '');
  });
  assert.equal(plan.kindToPlay('reform', Object.assign({}, free, { busy: true })), '');
  assert.equal(plan.kindToPlay('reformView', Object.assign({}, free, { running: true, looked: true })), '', 'only one transition plays');
  assert.equal(plan.kindToPlay('reform', Object.assign({}, free, { slow: true })), '', 'a screen that draws slowly gets the plain change');
  assert.equal(plan.kindToPlay('reformView', Object.assign({}, free, { off: true, looked: true })), '', '?reform=off gives the older swap');
});

await test('the code of the transitions draws no filter, no blur and no shadow animation, and writes no color', () => {
  const files = ['core/reform-plan.js', 'core/reform-bake.js', 'core/reform-draw.js', 'core/reform-hawk.js', 'core/reform-run.js', 'core/reform-panel.js', 'core/reform-view.js', 'reform.css', 'reform-kit.css'];

  files.forEach(file => {
    const text = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    assert.equal(/(^|[\s;{(])(-webkit-)?(backdrop-)?filter\s*:|blur\(|drop-shadow\(/.test(text), false, file + ' has a filter');
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(text.replace(/url\(#[\w-]+\)|href="#[\w-]+"/g, '')), false, file + ' writes a color');
    assert.equal(/perspective\(/.test(text), false, file + ' gives a part a perspective of its own');
  });
  const css = read('reform.css');
  assert.equal((css.match(/perspective:/g) || []).length, 1, 'there is one camera');
  assert.ok(/#reform \{[^}]*perspective: 1600px;[^}]*perspective-origin: 50% 45%;/.test(css));
});

await test('only the parts that have a back face or a folding chain keep their 3D, and a square has a back with the face hidden', () => {
  const css = read('reform.css');
  const kit = read('reform-kit.css');

  assert.ok(/\.reform-face,\s*\.reform-back \{[^}]*backface-visibility: hidden/.test(css));
  assert.ok(/\.reform-square \{[^}]*transform-style: preserve-3d/.test(css));
  assert.equal(/\.reform-part[^{]*\{[^}]*preserve-3d/.test(css + kit), false, 'the hardware is flat');
  assert.equal(/\.reform-cover[^{]*\{[^}]*preserve-3d/.test(css), false, 'the covers are flat');
});

await test('every theme has a kit that draws the hardware, the Original kit draws all of it, and a theme without a kit of its own falls back to it', async () => {
  const original = await import(pathToFileURL(path.join(dashboard, 'styles', 'original', 'transitions.js')).href);
  ['screw', 'latch', 'brace', 'rivet', 'gear', 'piston', 'tooth'].forEach(role => assert.ok(original.kit.draw(role).includes('<svg'), role));
  assert.equal(original.kit.draw('chassis'), '', 'the chassis is drawn by the stylesheet');
  for (const id of ['retro', 'foundry']) {
    const text = read('styles/' + id + '/transitions.js');
    assert.ok(text.includes("from '../original/transitions.js'") && text.includes("id: '" + id + "'"), id);
  }
  // Cybertron has a kit of its own (tests/reform-cybertron.test.mjs)
  assert.ok(!read('styles/cybertron/transitions.js').includes("from '../original/transitions.js'"), 'cybertron');
});

await test('the transition code is in the order the docs say, and the docs name the skeleton', () => {
  const docs = fs.readFileSync(fileURLToPath(new URL('../docs/transitions.md', import.meta.url)), 'utf8');
  ['0.00 to 0.40', '0.40 to 1.05', '1.10 to 1.90', '1.95 to 2.60', '2.45 to 3.00', 'transitionSeconds', '12 by 6', '3 by 8', '16 by 1'].forEach(text => assert.ok(docs.includes(text), text));
  assert.ok(read('core/swap-run-play.js').includes("from './transition-kinds.js'"), 'the swap asks the list first');
  assert.ok(read('core/views-run.js').includes('startReforms(() => transitionSecondsOf(getContent()), transitionKindNow)'), 'the views give the length and the kind');
});

console.log('\n' + passed + ' passed');
