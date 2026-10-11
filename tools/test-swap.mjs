// Tests for the swap (docs/layouts.md, "The swap"): the one move the screen makes for every change of
// style, team or Monday panel, and for entering or leaving the Monday block. The plan is run for real:
// dashboard/core/swap-plan.js decides which piece starts when, where it is pulled to, where it re-forms and
// how the hawk flies. dashboard/core/swap-run.js, which measures the page and plays the plan, is run
// against a small stand-in for the page and a clock that the test moves by hand. The stylesheets are
// checked by reading them, because the moves need a browser to be seen.
//
//   node tools/test-swap.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-swap-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'core/transitions.js', 'core/swap-plan.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});

const base = pathToFileURL(root).href + '/';
const plan = await import(base + 'core/swap-plan.js');
const { boxInPose } = await import(base + 'core/transitions.js');

const { bezierAt, contentFade, flapFrames, hawkShape, hawkTransform, matchPieces, outPose, planHawk, planPull, planReform, poseAt, poseFrames, poseTransform, pullProgress, reformEnd, restPose, standardEase, standardEaseText, swapMs, swapShape, swapTimes } = plan;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}


// The plan

// Pieces of different sizes spread over the screen: plates, and bolts riding on them
function somePieces(plates, bolts) {
  const pieces = [];
  for (let index = 0; index < plates; index++) {
    pieces.push({
      id: 'plate-' + index,
      kind: 'plate',
      region: 'region-' + ['banner', 'grid1', 'grid2', 'ticker'][index % 4],
      index: Math.floor(index / 4),
      left: (index * 97) % 1500,
      top: (index * 53) % 800,
      width: 80 + (index * 37) % 560,
      height: 40 + (index * 41) % 580,
      parent: '',
    });
  }
  for (let index = 0; index < bolts; index++) {
    pieces.push({ id: 'bolt-' + index, kind: 'bolt', region: 'region-grid1', index: index, left: 300 + index * 20, top: 200 + index * 15, width: 48, height: 48, parent: 'plate-' + (index % plates) });
  }
  return pieces;
}

const byId = (list, id) => list.find(item => item.id === id);
const middleOf = piece => ({ x: piece.left + piece.width / 2, y: piece.top + piece.height / 2 });

test('the times are the ones of the order: pull apart, re-form, content, and the hawk', () => {
  assert.deepEqual(swapTimes, { fadeMs: 250, delayMostMs: 180, pullMs: 450, switchMs: 350, reformEndMs: 1250, hawkMs: 2000 });
  assert.equal(swapShape.outwardShare, 0.18);
  assert.deepEqual([swapShape.tipLeast, swapShape.tipMost, swapShape.twistMost], [20, 70, 25]);
  assert.ok(swapTimes.switchMs >= swapTimes.delayMostMs && swapTimes.switchMs < swapTimes.pullMs, 'the new pieces take over while the old ones are still on their way out');
  assert.deepEqual(contentFade(), { out: { delayMs: 0, ms: 250 }, in: { delayMs: 1000, ms: 250 } });
  assert.equal(swapMs(false), 1250);
  assert.equal(swapMs(true), 2000);
});

test('the same pieces and the same seed always give the same plan, and another seed gives another', () => {
  const pieces = somePieces(20, 10);
  assert.deepEqual(planPull(pieces, 7), planPull(pieces, 7));
  assert.notDeepEqual(planPull(pieces, 7), planPull(pieces, 8));
});

test('every piece starts after a delay of its own, 0 to 180 ms, tips 20 to 70 degrees, turns up to 25, and is out at 450 ms', () => {
  [1, 2, 3, 99, 4242].forEach(seed => {
    const pull = planPull(somePieces(30, 10), seed);
    pull.pieces.forEach(entry => {
      assert.ok(Number.isInteger(entry.delayMs) && entry.delayMs >= 0 && entry.delayMs <= 180, entry.id + ' starts at ' + entry.delayMs);
      assert.ok(entry.out.tip >= 20 && entry.out.tip <= 70, entry.id + ' tips ' + entry.out.tip);
      assert.ok(Math.abs(entry.out.twist) <= 25, entry.id + ' turns ' + entry.out.twist);
      assert.equal(entry.delayMs + entry.ms, 450, entry.id + ' is out at 450 ms');
    });
    const ranks = pull.pieces.map(entry => entry.rank).sort((a, b) => a - b);
    assert.deepEqual(ranks, ranks.map((rank, index) => index), 'the ranks are 0, 1, 2 ... with no gap');
    const started = pull.pieces.slice().sort((a, b) => a.rank - b.rank);
    started.slice(1).forEach((entry, index) => assert.ok(entry.delayMs >= started[index].delayMs, 'rank 0 starts first'));
  });

  const delays = planPull(somePieces(40, 0), 11).pieces.map(entry => entry.delayMs);
  assert.ok(Math.min(...delays) < 60 && Math.max(...delays) > 120, 'the delays are spread over the range: ' + Math.min(...delays) + ' to ' + Math.max(...delays));
});

test('a piece in the middle of the screen is pulled out by 18 percent of its distance from the middle, away from it', () => {
  const piece = { id: 'a', kind: 'plate', region: 'r', index: 0, left: 1260, top: 140, width: 200, height: 100, parent: '' };
  const out = outPose(piece, 30, 10);
  const middle = middleOf(piece);

  assert.equal(out.x, Math.round((middle.x - 960) * 0.18 * 10) / 10);
  assert.equal(out.y, Math.round((middle.y - 540) * 0.18 * 10) / 10);
  assert.ok(out.x > 0 && out.y < 0, 'to the upper right of the middle it moves to the upper right');
  assert.deepEqual([out.tip, out.twist, out.sx, out.sy], [30, 10, 1, 1]);

  const centred = outPose({ id: 'b', kind: 'plate', region: 'r', index: 0, left: 860, top: 490, width: 200, height: 100, parent: '' }, 30, 10);
  assert.deepEqual([centred.x, centred.y], [0, 0], 'a piece in the middle stays there');
});

test('no piece leaves the screen, however near the edge it is and however far it tips', () => {
  [3, 5, 8, 13].forEach(seed => {
    const pieces = somePieces(40, 0).concat([
      { id: 'left', kind: 'plate', region: 'r', index: 0, left: 0, top: 400, width: 600, height: 300, parent: '' },
      { id: 'right', kind: 'plate', region: 'r', index: 1, left: 1500, top: 400, width: 420, height: 300, parent: '' },
      { id: 'top', kind: 'plate', region: 'r', index: 2, left: 300, top: 0, width: 1300, height: 160, parent: '' },
      { id: 'bottom', kind: 'plate', region: 'r', index: 3, left: 100, top: 920, width: 1700, height: 160, parent: '' },
      { id: 'whole', kind: 'plate', region: 'r', index: 4, left: 0, top: 0, width: 1920, height: 1080, parent: '' },
    ]);
    const pull = planPull(pieces, seed);

    pull.pieces.forEach(entry => {
      const piece = byId(pieces, entry.id);
      const box = boxInPose(piece.width, piece.height, { tip: entry.out.tip, twist: entry.out.twist, scale: entry.out.sx });
      const middle = middleOf(piece);
      const where = { left: middle.x + entry.out.x + box.left, right: middle.x + entry.out.x + box.right, top: middle.y + entry.out.y + box.top, bottom: middle.y + entry.out.y + box.bottom };
      const reach = { left: Math.min(0, piece.left), right: Math.max(1920, piece.left + piece.width), top: Math.min(0, piece.top), bottom: Math.max(1080, piece.top + piece.height) }; // a piece that is out of the screen in its place may stay as far out

      assert.ok(where.left >= reach.left - 0.5 && where.right <= reach.right + 0.5 && where.top >= reach.top - 0.5 && where.bottom <= reach.bottom + 0.5, entry.id + ' is at ' + JSON.stringify(where));
      assert.ok(entry.out.sx > 0 && entry.out.sx <= 1 && entry.out.sx === entry.out.sy);
    });
  });
});

test('a piece that already reaches past an edge keeps what it reaches and is not pushed in', () => {
  const piece = { id: 'wide', kind: 'plate', region: 'r', index: 0, left: -30, top: 100, width: 400, height: 200, parent: '' };
  const out = outPose(piece, 0, 0);
  assert.ok(piece.left + out.x >= -30 - 0.5, 'it is not moved out past where it was');
});

test('the standard easing is the one of the first assembly, and the curve is the one the browser draws', () => {
  const tokens = withoutComments(read('tokens.css'));
  assert.ok(tokens.includes('--ease-in: ' + standardEaseText + ';'), 'tokens.css has --ease-in as ' + standardEaseText);
  assert.deepEqual(standardEase, [0.2, 0.8, 0.2, 1]);

  assert.equal(bezierAt(standardEase, 0), 0);
  assert.ok(Math.abs(bezierAt(standardEase, 1) - 1) < 1e-9);
  // cubic-bezier(.25, .1, .25, 1), the CSS ease, is about .8024 half way
  assert.ok(Math.abs(bezierAt([0.25, 0.1, 0.25, 1], 0.5) - 0.8024) < 0.001);
  let last = 0;
  for (let step = 1; step <= 20; step++) {
    const value = bezierAt(standardEase, step / 20);
    assert.ok(value >= last, 'the standard easing never goes back');
    last = value;
  }
  assert.ok(bezierAt(standardEase, 0.2) > 0.4, 'it starts fast and ends slowly');
});

test('a piece is in place until its delay, out at the end of the pull, and on the way in between', () => {
  const pull = planPull(somePieces(12, 0), 5);
  pull.pieces.forEach(entry => {
    assert.deepEqual(poseAt(entry, 0), entry.delayMs === 0 ? poseAt(entry, 0) : { x: 0, y: 0, tip: 0, twist: 0, sx: 1, sy: 1 });
    assert.equal(pullProgress(entry, entry.delayMs), 0);
    assert.equal(pullProgress(entry, 450), 1);
    assert.equal(pullProgress(entry, 5000), 1);
    assert.deepEqual(poseAt(entry, 450), { x: entry.out.x, y: entry.out.y, tip: entry.out.tip, twist: entry.out.twist, sx: entry.out.sx, sy: entry.out.sy });

    const middle = pullProgress(entry, entry.delayMs + entry.ms / 2);
    assert.ok(middle > 0 && middle < 1);
    assert.ok(pullProgress(entry, 350) >= pullProgress(entry, 300), 'and it only goes one way');
  });
});

test('at 350 ms the pieces are nearly out: the new pieces take over from the pose the old ones had', () => {
  const pull = planPull(somePieces(30, 0), 9);
  pull.pieces.forEach(entry => {
    assert.ok(pullProgress(entry, swapTimes.switchMs) > 0.9, entry.id + ' is ' + pullProgress(entry, swapTimes.switchMs) + ' of the way out');
  });
});


// Matching and re-forming

test('a new piece takes over from the old piece of its kind in the same part of the screen with the same number', () => {
  const olds = somePieces(12, 4);
  const news = olds.map(piece => Object.assign({}, piece, { id: piece.id + '-new', left: piece.left + 10 }));
  const partner = matchPieces(olds, news);

  news.forEach(piece => assert.equal(partner[piece.id], piece.id.replace('-new', '')));
});

test('the pieces that are left take the nearest old piece of their kind, and a piece with nothing to take over from has none', () => {
  const olds = [
    { id: 'o1', kind: 'plate', region: 'a', index: 0, left: 0, top: 0, width: 100, height: 100, parent: '' },
    { id: 'o2', kind: 'plate', region: 'a', index: 1, left: 800, top: 0, width: 100, height: 100, parent: '' },
    { id: 'ob', kind: 'bolt', region: 'a', index: 0, left: 400, top: 400, width: 48, height: 48, parent: 'o1' },
  ];
  const news = [
    { id: 'n1', kind: 'plate', region: 'a', index: 0, left: 0, top: 0, width: 100, height: 100, parent: '' },
    { id: 'n2', kind: 'plate', region: 'b', index: 0, left: 780, top: 20, width: 100, height: 100, parent: '' },
    { id: 'n3', kind: 'plate', region: 'b', index: 1, left: 10, top: 20, width: 100, height: 100, parent: '' },
    { id: 'n4', kind: 'box', region: 'b', index: 0, left: 700, top: 700, width: 100, height: 100, parent: '' },
  ];
  const partner = matchPieces(olds, news);

  assert.equal(partner.n1, 'o1');
  assert.equal(partner.n2, 'o2', 'the nearest plate, not the nearest piece of any kind');
  assert.equal(partner.n3, 'o1', 'a plate that has a partner already can be taken again');
  assert.equal(partner.n4, 'ob', 'a kind with no old piece takes the nearest of any kind');
  assert.deepEqual(matchPieces([], news), { n1: '', n2: '', n3: '', n4: '' });
});

test('every new piece ends in its place with no tip, no turn and no offset, and starts where its old piece was', () => {
  const olds = somePieces(20, 10);
  const news = olds.map(piece => Object.assign({}, piece, { id: piece.id + '-new' }));
  const pull = planPull(olds, 21);
  const reform = planReform(pull, olds, news, swapTimes.switchMs, 22);

  reform.pieces.forEach(entry => {
    assert.deepEqual(entry.to, restPose, entry.id + ' returns to its origin');
    assert.deepEqual(entry.to, { x: 0, y: 0, tip: 0, twist: 0, sx: 1, sy: 1 });
    assert.equal(entry.delayMs, 0);
    assert.equal(entry.ms, 900);

    const old = byId(olds, entry.partner);
    const wasAt = poseAt(byId(pull.pieces, entry.partner), swapTimes.switchMs);
    assert.deepEqual(entry.from, { x: wasAt.x, y: wasAt.y, tip: wasAt.tip, twist: wasAt.twist, sx: wasAt.sx, sy: wasAt.sy }, entry.id + ' starts exactly where ' + old.id + ' was');
  });
  assert.equal(reform.pieces.length, pull.pieces.length);
});

test('a new piece of another size and place starts with the middle, the size and the tilt of the old one', () => {
  const old = { id: 'old', kind: 'plate', region: 'a', index: 0, left: 100, top: 200, width: 400, height: 100, parent: '' };
  const fresh = { id: 'new', kind: 'plate', region: 'a', index: 0, left: 1000, top: 600, width: 200, height: 50, parent: '' };
  const pull = planPull([old], 4);
  const reform = planReform(pull, [old], [fresh], 350, 5);
  const from = reform.pieces[0].from;
  const wasAt = poseAt(pull.pieces[0], 350);

  // the new piece, moved by from, is where the old piece was, in the middle and in size
  assert.ok(Math.abs(middleOf(fresh).x + from.x - (middleOf(old).x + wasAt.x)) < 0.1);
  assert.ok(Math.abs(middleOf(fresh).y + from.y - (middleOf(old).y + wasAt.y)) < 0.1);
  assert.ok(Math.abs(fresh.width * from.sx - old.width * wasAt.sx) < 0.5);
  assert.ok(Math.abs(fresh.height * from.sy - old.height * wasAt.sy) < 0.5);
  assert.equal(from.tip, wasAt.tip);
  assert.equal(from.twist, wasAt.twist);
});

test('a piece with no old piece to take over from starts out and tipped, and is home with the rest', () => {
  const news = somePieces(6, 0);
  const reform = planReform(planPull([], 1), [], news, 350, 2);

  assert.equal(reform.pieces.length, 6);
  reform.pieces.forEach(entry => {
    assert.equal(entry.partner, '');
    assert.ok(entry.from.tip >= 20 && entry.from.tip <= 70);
    assert.deepEqual(entry.to, restPose);
  });
  assert.deepEqual(planReform(planPull([], 1), [], [], 350, 2), { pieces: [], merged: [] });
});

test('at most 40 pieces move: more are folded into the piece they ride on, and a bolt that rode on a piece starts with it', () => {
  const olds = somePieces(30, 30);
  const news = olds.map(piece => Object.assign({}, piece, { id: piece.id + '-new', parent: piece.parent ? piece.parent + '-new' : '' }));
  const pull = planPull(olds, 3);
  const reform = planReform(pull, olds, news, 350, 4);

  assert.equal(pull.pieces.length, 40);
  assert.equal(pull.merged.length, 20);
  assert.ok(pull.merged.every(id => id.startsWith('bolt-')), 'only bolts are folded in');
  assert.equal(reform.pieces.length, 40);
  assert.equal(reform.merged.length, 20);

  // a bolt that was folded into its plate went out with the plate, so its new piece starts from the plate's pose
  const foldedOld = olds.find(piece => pull.merged.indexOf(piece.id) !== -1 && news.some(other => other.id === piece.id + '-new' && !reform.merged.includes(other.id)));
  if (foldedOld) {
    const entry = byId(reform.pieces, foldedOld.id + '-new');
    const plate = poseAt(byId(pull.pieces, foldedOld.parent), 350);
    assert.equal(entry.from.tip, plate.tip);
  }
});

test('the pieces are home by 1250 ms, whatever the time the look went on at', () => {
  const olds = somePieces(24, 8);
  const pull = planPull(olds, 31);

  [300, 350, 400, 449].forEach(at => {
    const reform = planReform(pull, olds, olds.map(piece => Object.assign({}, piece)), at, 32);
    assert.equal(reformEnd(reform, at), 1250, 'at ' + at);
    assert.ok(reformEnd(reform, at) <= swapTimes.reformEndMs);
  });
  assert.equal(reformEnd({ pieces: [] }, 350), 350);
});

test('a pose is one transform with the same functions in the same order, and a frame that is scaled to fit is moved by its own pixels', () => {
  assert.equal(poseTransform(restPose), 'translate(0px, 0px) perspective(1600px) rotateZ(0deg) rotateX(0deg) scale(1, 1)');
  assert.equal(poseTransform({ x: 120, y: -60, tip: 45, twist: -10, sx: 0.5, sy: 0.25 }), 'translate(120px, -60px) perspective(1600px) rotateZ(-10deg) rotateX(45deg) scale(0.5, 0.25)');
  assert.equal(poseTransform({ x: 120, y: -60, tip: 45, twist: -10, sx: 1, sy: 1 }, 0.6), 'translate(200px, -100px) perspective(1600px) rotateZ(-10deg) rotateX(45deg) scale(1, 1)');
  assert.equal(poseFrames(restPose, restPose).length, 2);

  const names = transform => transform.replace(/\([^)]*\)/g, '');
  assert.equal(names(poseTransform(restPose)), names(poseTransform({ x: 1, y: 2, tip: 3, twist: 4, sx: 5, sy: 6 })));
  assert.ok(read('core/transitions.js').includes('lens: 1600'), 'the lens is the one of the pile');
});


// The hawk

const logoAt = (x, y) => ({ x: x, y: y, width: 219, height: 176 });

test('the hawk flies in one arc 300 px high from the old place to the new one, and faces the way it flies', () => {
  const right = planHawk(logoAt(300, 700), logoAt(1500, 700));
  const left = planHawk(logoAt(1500, 700), logoAt(300, 700));

  assert.equal(right.hop, false);
  assert.equal(right.direction, 1);
  assert.equal(left.direction, -1, 'it turns over to fly to the left');
  [right, left].forEach(flight => {
    assert.equal(flight.durationMs, 2000);
    assert.equal(flight.height, 300);
    assert.equal(flight.rise, 300);
    assert.deepEqual(flight.keyframes[0], { offset: 0, x: 0, y: 0, tilt: 20, scale: 1 }, 'it lifts from the old place');
    const last = flight.keyframes[flight.keyframes.length - 1];
    assert.equal(last.offset, 1);
    assert.equal(last.y, 0, 'and settles on the same height');
    assert.ok(Math.abs(Math.min(...flight.keyframes.map(keyframe => keyframe.y)) + 300) < 1, 'the top of the arc is 300 px above the line');
  });
  const last = right.keyframes[right.keyframes.length - 1];
  assert.equal(last.x, 1200, 'and settles on the new place');
  assert.equal(left.keyframes[left.keyframes.length - 1].x, -1200);
  assert.equal(hawkTransform(right.keyframes[0], 1).endsWith('scaleX(1)'), true);
  assert.equal(hawkTransform(left.keyframes[0], -1).endsWith('scaleX(-1)'), true, 'scaleX(-1) when heading left');
});

test('the hawk tilts into the climb, is level at the top and tilts out of the descent', () => {
  const flight = planHawk(logoAt(300, 700), logoAt(1500, 700));
  const tilts = flight.keyframes.map(keyframe => keyframe.tilt);
  const top = Math.floor(tilts.length / 2);

  assert.ok(tilts[0] > 0 && tilts[1] > 0, 'nose up while it climbs');
  assert.equal(tilts[top], 0, 'level at the top');
  assert.ok(tilts[tilts.length - 1] < 0 && tilts[tilts.length - 2] < 0, 'nose down while it comes down');
  assert.ok(Math.max(...tilts.map(Math.abs)) <= hawkShape.tiltMost);
  assert.ok(tilts.every((tilt, index) => index === 0 || tilt <= tilts[index - 1]), 'from the climb to the descent without turning back');

  // nose up is a turn to the left for a hawk that faces right, and to the right for one that faces left (it is turned over first)
  assert.ok(hawkTransform({ x: 0, y: 0, tilt: 15, scale: 1 }, 1).includes('rotate(-15deg)'));
  assert.ok(hawkTransform({ x: 0, y: 0, tilt: 15, scale: 1 }, -1).includes('rotate(15deg)'));
});

test('a hawk that stays where it is hops 120 px and lands', () => {
  const same = planHawk(logoAt(300, 700), logoAt(300, 700));
  const near = planHawk(logoAt(300, 700), logoAt(310, 705));
  [same, near].forEach(flight => {
    assert.equal(flight.hop, true);
    assert.equal(flight.height, 120);
    assert.ok(Math.abs(Math.min(...flight.keyframes.map(keyframe => keyframe.y)) + 120) < 3, 'the top is 120 px above the line between the two places');
    assert.equal(flight.keyframes[flight.keyframes.length - 1].y, near === flight ? 5 : 0);
  });
  assert.equal(planHawk(logoAt(300, 700), logoAt(300 + hawkShape.sameSpot, 700)).hop, false, 'a place 24 px away is another place');
});

test('where the logo is too near the top for the arc to rise, it dips down instead, and the whole hawk stays on the screen', () => {
  const banner = planHawk(logoAt(150, 110), logoAt(1700, 110));
  assert.equal(banner.height, 300);
  assert.equal(banner.rise, -300, 'a dip');
  assert.ok(Math.min(...banner.keyframes.map(keyframe => keyframe.y)) > -1, 'it never goes above the old place');
  assert.ok(Math.max(...banner.keyframes.map(keyframe => keyframe.y)) > 299);
  assert.ok(banner.keyframes[0].tilt < 0 && banner.keyframes[0].tilt >= -hawkShape.tiltMost, 'and tilts down into the dip');

  const squeezed = planHawk(logoAt(150, 300), logoAt(1700, 300));
  assert.ok(squeezed.height <= 300 && squeezed.height > 0);
  [banner, squeezed].forEach(flight => flight.keyframes.forEach(keyframe => {
    const absoluteY = (flight === banner ? 110 : 300) + keyframe.y;
    assert.ok(absoluteY - 88 >= -1 && absoluteY + 88 <= 1081, 'on the screen at ' + absoluteY);
  }));
});

test('the hawk lifts first: a flight that starts higher than the old place still has its top where it was asked to be', () => {
  const flight = planHawk(logoAt(300, 700), logoAt(1500, 700), 1650, 40);
  assert.equal(flight.durationMs, 1650);
  assert.equal(flight.keyframes[0].y, -40, 'it starts 40 px up');
  assert.ok(Math.abs(Math.min(...flight.keyframes.map(keyframe => keyframe.y)) + 300) < 1.5, 'the top is 300 px above the line');
  assert.equal(flight.keyframes[flight.keyframes.length - 1].y, 0);
  assert.equal(flight.apexMs, 825, 'the colors change half way along the flight');
});

test('the hawk changes size from the old logo to the new one, and the colors change at the top of the arc', () => {
  const flight = planHawk(logoAt(300, 700), { x: 1500, y: 700, width: 438, height: 352 });
  assert.equal(flight.keyframes[0].scale, 1);
  assert.equal(flight.keyframes[flight.keyframes.length - 1].scale, 2);
  assert.equal(hawkShape.colorAt, 0.5);
  assert.equal(flight.apexMs, 1000);
  const top = flight.keyframes.reduce((best, keyframe) => (keyframe.y < best.y ? keyframe : best));
  assert.ok(Math.abs(top.offset - 0.5) < 0.07, 'the top of the arc is half way');
});

test('the wings beat every 320 ms, to 35 percent of the beat of the flying logo, from the resting wing and back', () => {
  assert.equal(hawkShape.flapMs, 320);
  assert.equal(hawkShape.wingShare, 0.35);

  const frames = flapFrames();
  const css = withoutComments(read('frame.css'));
  const flapNear = /@keyframes flap-near \{[\s\S]*?\n\}/.exec(css)[0];
  const flapFar = /@keyframes flap-far \{[\s\S]*?\n\}/.exec(css)[0];

  // the resting angles and the shoulders are the ones of the logo in frame.css, and the full beat is the flap of the flying logo
  assert.ok(frames.near[0].transform.includes('rotate3d(320, -50, 0, -18deg)') && css.includes('.logo .hawk-near-wing { transform: var(--lens) var(--view) translate(-30px, -137px) rotate3d(320, -50, 0, -18deg) translate(30px, 137px); }'));
  assert.ok(frames.far[0].transform.includes('rotate3d(160, -18, 0, 18deg)') && css.includes('.logo .hawk-far-wing { transform: var(--lens) var(--view) translate(140px, -161px) rotate3d(160, -18, 0, 18deg) translate(-140px, 161px); }'));
  assert.ok(flapNear.includes('rotate3d(320, -50, 0, 138deg)') && flapFar.includes('rotate3d(160, -18, 0, -138deg)'));
  assert.ok(css.includes('--lens: perspective(2400px);') && css.includes('--view: rotateX(-14deg) rotateY(-24deg);'));
  assert.ok(frames.near[0].transform.startsWith('perspective(2400px) rotateX(-14deg) rotateY(-24deg) translate(-30px, -137px)'));

  // -18 to 138 is 156 degrees, and 35 percent of it is 54.6
  assert.ok(frames.near[1].transform.includes('rotate3d(320, -50, 0, 36.6deg)'), frames.near[1].transform);
  assert.ok(frames.far[1].transform.includes('rotate3d(160, -18, 0, -36.6deg)'), frames.far[1].transform);
  assert.equal(frames.near[1].offset, 0.58);
  assert.equal(frames.near[2].transform, frames.near[0].transform, 'the beat ends where it began');
  assert.notEqual(flapFrames(1).near[1].transform, frames.near[1].transform);
  assert.ok(flapFrames(1).near[1].transform.includes('138deg'));
});


// The pieces of the page, played

// swap-run.js is copied into a tree of its own, with stand-ins for the modules that need a page. The stand-ins
// hold a small made-up page (a few plates, two bolts, a logo and some content), written as plain objects that
// can be animated, measured and moved, and a clock that the test moves by hand.
const runTree = path.join(workFolder, 'run-tree');
const runRoot = path.join(runTree, 'dashboard');
fs.mkdirSync(path.join(runRoot, 'core'), { recursive: true });
fs.writeFileSync(path.join(runTree, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'core/transitions.js', 'core/swap-plan.js', 'core/swap-run.js', 'core/busy.js'].forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(runRoot, file));
});
const standIns = {
  'frame.js': [
    'export const pace = () => globalThis.world.pace;',
    "export const motionNow = () => globalThis.world.motion;",
    "export const wait = milliseconds => globalThis.world.sleep(milliseconds);",
    "export const setSwapPlaying = on => globalThis.world.log.push('swapPlaying ' + on);",
  ],
  'core/areas.js': [
    'export function setSwapOffer(offer) { globalThis.world.offer = offer; }',
    'export function startWholeScreen(keepLook) {',
    "  globalThis.world.log.push('gate ' + keepLook);",
    '  return {',
    "    apart: () => globalThis.world.log.push('apart'),",
    "    together: () => globalThis.world.log.push('together'),",
    "    end: () => globalThis.world.log.push('end'),",
    '  };',
    '}',
  ],
  'core/hidden-pile.js': [
    'export const boltBox = 48;',
    'export const findPlates = () => globalThis.world.page.plates.slice();',
    'export const findBoxes = () => globalThis.world.page.boxes.slice();',
    'export const findContent = () => globalThis.world.page.content.slice();',
    'export const findBolts = () => globalThis.world.page.bolts.slice();',
    "export const screenPlace = () => ({ left: 0, top: 0, scale: 1 });",
    'export const boxOf = element => Object.assign({ zoom: 1 }, element.rect);',
    "export const boltCopy = (bolt, middle, size) => globalThis.world.makeBoltCopy(bolt, middle, size);",
  ],
  'core/layout-apply.js': ['export const layoutIsReloading = () => globalThis.world.reloading;'],
  'core/layout.js': [
    "export const layoutNow = () => 'standard';",
    "export const otherAreas = () => ['grid2', 'ticker'];",
  ],
  'core/schedule.js': [
    "export const holdClock = on => globalThis.world.log.push('clock ' + on);",
    "export const moveOn = regions => globalThis.world.log.push('moveOn ' + regions.join(' '));",
  ],
  'core/takeover.js': ['export const takeoverRunning = () => globalThis.world.takeover;'],
};
Object.keys(standIns).forEach(file => fs.writeFileSync(path.join(runRoot, file), standIns[file].join('\n') + '\n'));

// An object that stands for an element of the page
class Fake {
  constructor(name, rect, options = {}) {
    this.name = name;
    this.id = options.id || '';
    this.rect = rect || { left: 0, top: 0, width: 0, height: 0 };
    this.dataset = {};
    this.attributes = {};
    this.classes = new Set(options.classes || []);
    this.children = [];
    this.parent = options.parent || null;
    this.animations = [];
    this.hidden = false;
    this.props = options.props || {};
    this.style = {
      values: {},
      cssText: '',
      setProperty: (name2, value) => { this.style.values[name2] = value; },
      removeProperty: name2 => { delete this.style.values[name2]; },
    };
    Object.defineProperty(this.style, 'visibility', { get: () => this.style.values.visibility, set: value => { this.style.values.visibility = value; } });
    this.classList = { add: name2 => this.classes.add(name2), contains: name2 => this.classes.has(name2) };
  }

  animate(frames, options) {
    const animation = { element: this, frames: frames, options: options, cancelled: false, cancel() { this.cancelled = true; } };
    this.animations.push(animation);
    globalThis.world.animations.push(animation);
    return animation;
  }

  closest(selector) {
    assert.equal(selector, '[id^="region-"]');
    for (let node = this; node; node = node.parent) if (node.id.startsWith('region-')) return node;
    return null;
  }

  querySelectorAll(selector) {
    if (selector === '.logo') return this.found.logos.slice();
    if (selector === '.team-logo') return this.children.filter(child => child.classes.has('team-logo'));
    return [];
  }

  querySelector(selector) {
    const part = selector.replace('.', '');
    return this.children.find(child => child.classes.has(part)) || null;
  }

  cloneNode() {
    const copy = new Fake(this.name + ' copy', Object.assign({}, this.rect), { classes: [...this.classes] });
    this.children.forEach(child => {
      const piece = child.cloneNode();
      piece.parent = copy;
      copy.children.push(piece);
    });
    return copy;
  }

  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = null;
    this.removed = true;
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
  }

  insertBefore(child, before) {
    child.parent = this;
    const at = this.children.indexOf(before);
    if (at === -1) this.children.push(child);
    else this.children.splice(at, 0, child);
  }

  removeAttribute(name2) { delete this.attributes[name2]; }
  getBoundingClientRect() { return this.rect; }
}

// A page with four plates in three regions, two bolts on the large one, a logo in the banner, and content
function makePage() {
  const banner = new Fake('banner', null, { id: 'region-banner' });
  const grid1 = new Fake('grid1', null, { id: 'region-grid1' });
  const ticker = new Fake('ticker', null, { id: 'region-ticker' });
  const plate = (name, parent, rect) => {
    const element = new Fake(name, rect, { parent: parent });
    parent.children.push(element);
    return element;
  };
  const page = {
    plates: [
      plate('banner plate', banner, { left: 40, top: 24, width: 1840, height: 200 }),
      plate('large plate', grid1, { left: 40, top: 260, width: 1152, height: 708 }),
      plate('ticker plate', ticker, { left: 40, top: 984, width: 1840, height: 72 }),
    ],
    boxes: [],
    bolts: [],
    content: [new Fake('host', { left: 40, top: 380, width: 1152, height: 588 }), new Fake('banner text', { left: 300, top: 40, width: 900, height: 160 })],
    logos: [],
  };
  page.bolts = [
    Object.assign(new Fake('bolt 1', { left: 56, top: 276, width: 38, height: 38 }, { parent: grid1 }), { plate: page.plates[1] }),
    Object.assign(new Fake('bolt 2', { left: 1130, top: 920, width: 38, height: 38 }, { parent: grid1 }), { plate: page.plates[1] }),
  ];
  page.bolts.forEach(bolt => {
    bolt.closest = selector => (selector === 'svg.plate' ? bolt.plate : Fake.prototype.closest.call(bolt, selector));
  });
  const logo = new Fake('logo', { left: 60, top: 40, width: 219, height: 176 }, { parent: banner, classes: ['logo'], props: { '--k': '.1991', '--logo-purple': '#6c18b6', '--logo-tail': '#53048f', '--logo-far': '#3d036d' } });
  logo.children.push(Object.assign(new Fake('drawing', null, { classes: ['drawing'] }), { parent: logo }));
  ['hawk-near-wing', 'hawk-far-wing'].forEach(name => logo.children.push(Object.assign(new Fake(name, null, { classes: [name] }), { parent: logo })));
  logo.children.push(Object.assign(new Fake('team picture', null, { classes: ['team-logo'] }), { parent: logo }));
  logo.attributes['data-team-logo'] = 'on';
  page.logos = [logo];
  return page;
}

function installWorld(options = {}) {
  const world = {
    now: 0,
    pace: options.pace || 1,
    motion: 'full',
    takeover: false,
    reloading: false,
    log: [],
    animations: [],
    timers: [],
    offer: null,
    page: makePage(),
    areaState: 'shown',
  };
  world.sleep = milliseconds => new Promise(resolve => world.timers.push({ due: world.now + Math.max(0, milliseconds), run: resolve }));
  world.makeBoltCopy = (bolt, middle, size) => {
    const copy = new Fake('copy of ' + bolt.name, { left: middle.x - size / 2, top: middle.y - size / 2, width: size, height: size }, { classes: ['pile-bolt'] });
    world.log.push('copy ' + bolt.name);
    return copy;
  };

  const pile = new Fake('pile', null, { id: 'pile' });
  const cube = new Fake('cube', null, { id: 'cube' });
  pile.children.push(cube);
  cube.parent = pile;
  pile.hidden = true;
  const worldElement = new Fake('world', null, { id: 'world' });
  const stage = new Fake('stage', null, { id: 'stage' });
  stage.found = { logos: world.page.logos };
  world.elements = { world: worldElement, stage: stage, pile: pile, cube: cube };

  globalThis.world = world;
  globalThis.document = {
    getElementById: id => world.elements[id] || null,
    querySelectorAll: selector => {
      assert.ok(selector === '[data-pile]' || selector === '[data-pile="released"]', selector);
      const marked = [];
      const visit = node => {
        if (node.dataset && node.dataset.pile !== undefined && (selector === '[data-pile]' || node.dataset.pile === 'released')) marked.push(node);
        node.children.forEach(visit);
      };
      world.page.plates.concat(world.page.bolts, world.page.content, [world.elements.pile]).forEach(visit);
      return marked;
    },
    querySelector: selector => {
      assert.equal(selector, '.area:not([data-state="shown"])');
      return world.areaState === 'shown' ? null : {};
    },
  };
  globalThis.window = { getComputedStyle: element => ({ getPropertyValue: name => element.props[name] || '' }) };
  Object.defineProperty(globalThis, 'performance', { value: { now: () => world.now }, configurable: true });
  globalThis.setTimeout = (run, milliseconds) => {
    const timer = { due: world.now + milliseconds, run: run };
    world.timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = timer => { world.timers = world.timers.filter(item => item !== timer); };
  return world;
}

// Lets the promises settle, moves the clock to the next timer, and does it again until the promise is done or the time is up
async function drive(promise, until = 60000) {
  const world = globalThis.world;
  let done = false;
  let value;
  let failure = null;
  promise.then(result => { done = true; value = result; }, error => { done = true; failure = error; });

  while (!done) {
    for (let flush = 0; flush < 20; flush++) await new Promise(resolve => setImmediate(resolve));
    if (done) break;
    world.timers.sort((a, b) => a.due - b.due);
    const next = world.timers.shift();
    if (!next || next.due > until) throw new Error('the swap did not finish by ' + until + ' ms (the clock is at ' + world.now + ')');
    world.now = Math.max(world.now, next.due);
    next.run();
  }
  if (failure) throw failure;
  return value;
}

const runModuleUrl = pathToFileURL(path.join(runRoot, 'core/swap-run.js')).href;
const busyModuleUrl = pathToFileURL(path.join(runRoot, 'core/busy.js')).href;
let swapRun = null;

async function loadRun(options) {
  const world = installWorld(options);
  swapRun = swapRun || await import(runModuleUrl + '?first');
  swapRun.startSwaps(() => world.elsewhere === true);
  return world;
}

const mondayPage = id => ({ id: id, region: 'grid1', element: {} });
const otherPage = id => ({ id: id, region: 'grid1', element: {} });

test('the swap is offered for a held look, and for a Monday card on either side, and for nothing else', async () => {
  const world = await loadRun();
  const offer = world.offer;

  assert.equal(offer(otherPage('tasks'), otherPage('events')), null, 'an ordinary page change is an ordinary page change');
  assert.ok(offer(mondayPage('monday-tasks'), mondayPage('monday-milestones')), 'one Monday card to the next');
  assert.ok(offer(mondayPage('monday-milestones'), mondayPage('monday-progress')));
  assert.ok(offer(mondayPage('monday-tasks'), mondayPage('monday-tasks')), 'and the next page of the same card');
  assert.ok(offer(otherPage('events'), mondayPage('monday-tasks')), 'into the Monday block');
  assert.ok(offer(mondayPage('monday-progress'), otherPage('tasks')), 'and out of it');

  assert.equal(offer(otherPage('tasks'), otherPage('events')), null, 'asked again, still not');
  swapRun.queueSwap();
  assert.ok(offer(otherPage('tasks'), otherPage('events')), 'a look was held');
  assert.equal(offer(otherPage('tasks'), otherPage('events')), null, 'and the next page change is the usual one');
});

test('a swap is never offered in calm or no motion, while something else has the screen, or while one plays', async () => {
  const world = await loadRun();
  const offer = world.offer;
  const monday = () => offer(mondayPage('monday-tasks'), mondayPage('monday-milestones'));

  assert.ok(monday());
  ['calm', 'none'].forEach(motion => {
    world.motion = motion;
    assert.equal(monday(), null, motion);
  });
  world.motion = 'full';
  world.takeover = true;
  assert.equal(monday(), null, 'an alert, an announcement or a talk');
  world.takeover = false;
  world.elsewhere = true;
  assert.equal(monday(), null, 'the demo, the night screen or a hidden transition');
  world.elsewhere = false;

  swapRun.queueSwap();
  world.motion = 'calm';
  assert.equal(monday(), null);
  world.motion = 'full';
  assert.ok(monday(), 'and a look that was held is not kept for later: the page change took it');
  assert.equal(offer(otherPage('tasks'), otherPage('events')), null);
});

// What a swap does to a page: the look goes on while the pieces are apart, so the page after it is another one
function newLook(world) {
  const grid1 = world.page.plates[1].parent;
  const replaced = new Fake('large plate in the new style', { left: 40, top: 200, width: 1100, height: 760 }, { parent: grid1 });
  const banner = world.page.plates[0].parent;
  const logo = new Fake('new logo', { left: 1500, top: 40, width: 219, height: 176 }, { parent: banner, classes: ['logo'] });

  return () => {
    world.log.push('swapPage at ' + world.now);
    grid1.children = grid1.children.filter(child => child !== world.page.plates[1]).concat(replaced);
    world.page.plates[1] = replaced;
    world.page.bolts = world.page.bolts.slice(0, 1).map(bolt => Object.assign(new Fake('new bolt', { left: 60, top: 220, width: 38, height: 38 }, { parent: grid1 }), { plate: replaced, closest: selector => (selector === 'svg.plate' ? replaced : null) }));
    world.elements.stage.found.logos = [logo];
    world.page.logos = [logo];
    world.newLogo = logo;
  };
}

test('a swap pulls the pieces apart, puts the look on at 350 ms, re-forms them by 1250 ms and lands the hawk at 2000 ms', async () => {
  const world = await loadRun();
  const busy = await import(busyModuleUrl);
  const playing = world.offer(otherPage('events'), mondayPage('monday-tasks')).play(newLook(world));

  assert.equal(swapRun.swapRunning(), true);
  assert.equal(busy.isBusy(), true, 'the glitch of the team name holds');
  const took = await drive(playing);

  // the order of things: the gate, the screen held (so the logo is at rest when it is measured), the clock held, the
  // other areas asked to move on, the look at 350 ms, and everything let go in the reverse order
  const log = world.log.filter(line => !line.startsWith('copy'));
  assert.deepEqual(log, ['gate false', 'swapPlaying true', 'clock true', 'moveOn grid2 ticker', 'swapPage at 350', 'apart', 'together', 'end', 'clock false', 'swapPlaying false']);

  // done, and everything back
  assert.equal(swapRun.swapRunning(), false);
  assert.equal(busy.isBusy(), false);
  assert.equal(world.now, 2000, 'the hawk lands at 2000 ms');
  assert.equal(took, 900, 'the pieces took 900 ms to re-form');
  assert.equal(world.elements.pile.hidden, true);
  assert.equal(world.elements.world.dataset.pieces, undefined);
  assert.deepEqual(world.elements.pile.children, [world.elements.cube], 'the copies of the bolts and the hawk are gone');
  assert.ok(world.animations.every(animation => animation.cancelled || animation.options.iterations !== Infinity || animation.element.removed), 'no animation is left going');
  assert.equal(world.page.logos[0].style.visibility, undefined, 'the logo is back');
  assert.equal(world.page.content.every(node => node.dataset.pile === undefined), true);
});

test('before 350 ms every piece pulls out with the standard easing, the content fades out, and the logo becomes a hawk that flaps and lifts', async () => {
  const world = await loadRun();
  const swapPage = newLook(world);
  const playing = world.offer(otherPage('events'), mondayPage('monday-tasks')).play(swapPage);
  for (let flush = 0; flush < 40; flush++) await new Promise(resolve => setImmediate(resolve));

  assert.equal(world.elements.world.dataset.pieces, '', 'the frames show as their pieces');
  assert.equal(world.elements.pile.hidden, false);
  const [bannerPlate, largePlate, tickerPlate] = world.page.plates;
  [bannerPlate, largePlate, tickerPlate].forEach(piece => {
    assert.equal(piece.animations.length, 1, piece.name + ' moves');
    const options = piece.animations[0].options;
    assert.equal(options.easing, 'cubic-bezier(.2, .8, .2, 1)');
    assert.ok(options.delay >= 0 && options.delay <= 180 && options.delay + options.duration === 450);
    assert.equal(piece.animations[0].frames[0].transform, 'translate(0px, 0px) perspective(1600px) rotateZ(0deg) rotateX(0deg) scale(1, 1)');
    assert.ok(/rotateX\((2\d|[3-6]\d|70)(\.\d)?deg\)/.test(piece.animations[0].frames[1].transform), piece.animations[0].frames[1].transform);
  });
  const copies = world.elements.pile.children.filter(child => child.classes.has('pile-bolt'));
  assert.equal(copies.length, 2, 'a bolt moves as a copy of its own');
  copies.forEach(copy => assert.equal(copy.animations.length, 1));
  world.page.bolts.forEach(bolt => assert.equal(bolt.dataset.pile, 'released', 'and the bolt on the frame is out of sight'));

  world.page.content.forEach(node => {
    assert.equal(node.animations.length, 1);
    assert.deepEqual(node.animations[0].frames, [{ opacity: 1 }, { opacity: 0 }]);
    assert.equal(node.animations[0].options.duration, 250);
  });

  const hawk = world.elements.pile.children.find(child => child.classes.has('swap-hawk'));
  assert.ok(hawk, 'the hawk is in the layer over everything');
  assert.equal(hawk.dataset.act, 'swap');
  assert.equal(hawk.attributes['data-team-logo'], undefined, 'it is the hawk, not the picture of a team');
  assert.equal(hawk.children.some(child => child.classes.has('team-logo')), false);
  assert.equal(hawk.style.values['--logo-purple'], '#6c18b6', 'it keeps the old colors until the top of the arc');
  assert.equal(hawk.style.values['--k'], '.1991');
  assert.equal(world.page.logos[0].style.visibility, 'hidden', 'and the logo waits out of sight');
  const wings = hawk.children.filter(child => child.classes.has('hawk-near-wing') || child.classes.has('hawk-far-wing'));
  assert.equal(wings.length, 2);
  wings.forEach(wing => {
    assert.equal(wing.animations[0].options.duration, 320, 'a beat every 320 ms');
    assert.equal(wing.animations[0].options.iterations, Infinity);
  });
  assert.equal(hawk.animations.length, 1, 'and it lifts');
  assert.equal(hawk.animations[0].options.duration, 350);

  await drive(playing);
});

test('at 350 ms the old animations stop, the new pieces start where the old ones were, and the content comes back at 1000 ms', async () => {
  const world = await loadRun();
  const swapPage = newLook(world);
  const oldPlates = world.page.plates.slice();
  const realRandom = Math.random;
  Math.random = () => 0.25; // the seed of the run is then 1073741824
  try {
    await drive(world.offer(otherPage('events'), mondayPage('monday-tasks')).play(swapPage));
  } finally {
    Math.random = realRandom;
  }

  // The pieces as the runner measures them, and the plan the runner should have asked for
  const piece = (id, kind, region, index, left, top, width, height, parent) => ({ id: id, kind: kind, region: region, index: index, left: left, top: top, width: width, height: height, parent: parent });
  const olds = [
    piece('plate-0', 'plate', 'region-banner', 0, 40, 24, 1840, 200, ''),
    piece('plate-1', 'plate', 'region-grid1', 0, 40, 260, 1152, 708, ''),
    piece('plate-2', 'plate', 'region-ticker', 0, 40, 984, 1840, 72, ''),
    piece('bolt-0', 'bolt', 'region-grid1', 0, 51, 271, 48, 48, 'plate-1'),
    piece('bolt-1', 'bolt', 'region-grid1', 1, 1125, 915, 48, 48, 'plate-1'),
  ];
  const news = [
    piece('plate-0', 'plate', 'region-banner', 0, 40, 24, 1840, 200, ''),
    piece('plate-1', 'plate', 'region-grid1', 0, 40, 200, 1100, 760, ''),
    piece('plate-2', 'plate', 'region-ticker', 0, 40, 984, 1840, 72, ''),
    piece('bolt-0', 'bolt', 'region-grid1', 0, 55, 215, 48, 48, 'plate-1'),
  ];
  const pull = planPull(olds, 1073741824);
  const reform = planReform(pull, olds, news, 350, 1073741825);

  oldPlates.forEach(old => assert.ok(old.animations[0].cancelled, old.name + ' stopped being pulled'));
  const now = world.page.plates;
  assert.equal(now[1].name, 'large plate in the new style');

  // each plate was pulled out by its entry of the plan, and re-forms from where that entry had it at 350 ms
  [0, 1, 2].forEach(index => {
    const entry = byId(pull.pieces, 'plate-' + index);
    const pulled = oldPlates[index].animations[0];
    assert.deepEqual(pulled.frames, poseFrames(restPose, entry.out, 1), 'plate-' + index + ' is pulled to the pose of the plan');
    assert.deepEqual(pulled.options, { delay: entry.delayMs, duration: entry.ms, easing: standardEaseText, fill: 'both' });

    const home = byId(reform.pieces, 'plate-' + index);
    const moving = now[index].animations[now[index].animations.length - 1];
    assert.deepEqual(moving.frames, poseFrames(home.from, home.to, 1), 'plate-' + index + ' re-forms from the pose the old one had');
    assert.deepEqual(moving.options, { delay: 0, duration: 900, easing: standardEaseText, fill: 'both' });
    assert.equal(moving.cancelled, true, 'and the animation is taken off at the end');
  });

  // the one bolt left is a copy of its own that re-forms, and the old copies were taken away at 350 ms
  assert.equal(world.log.filter(line => line.startsWith('copy')).length, 3, 'two copies before, one after');
  assert.equal(byId(reform.pieces, 'bolt-0').partner, 'bolt-0');

  // the content is out of sight until 1000 ms, then comes back in 250 ms
  const host = world.page.content[0];
  const back = host.animations[host.animations.length - 1];
  assert.deepEqual(back.frames.map(frame => frame.opacity), [0, 0, 1]);
  assert.ok(Math.abs(back.frames[1].offset - (1000 - 350) / 900) < 0.0001);
  assert.deepEqual(back.options, { duration: 900, easing: 'linear', fill: 'both' });
  assert.equal(host.animations[0].cancelled, true, 'the fade out is replaced at 350 ms by the wait and the fade in');
});

test('the hawk flies to the new place when it is known, changes color at the top of the arc, and lands', async () => {
  const world = await loadRun();
  const swapPage = newLook(world);
  const playing = world.offer(otherPage('events'), mondayPage('monday-tasks')).play(swapPage);
  const hawkAfter = async milliseconds => {
    while (world.now < milliseconds) {
      for (let flush = 0; flush < 20; flush++) await new Promise(resolve => setImmediate(resolve));
      world.timers.sort((a, b) => a.due - b.due);
      const next = world.timers[0];
      if (!next || next.due > milliseconds) { world.now = milliseconds; break; }
      world.timers.shift();
      world.now = Math.max(world.now, next.due);
      next.run();
    }
    for (let flush = 0; flush < 20; flush++) await new Promise(resolve => setImmediate(resolve));
  };

  await hawkAfter(400);
  const hawk = world.elements.pile.children.find(child => child.classes.has('swap-hawk'));
  assert.equal(hawk.animations[0].cancelled, true, 'the lift is over');
  const flight = hawk.animations[hawk.animations.length - 1];
  assert.equal(flight.options.duration, 1650, 'the flight takes what is left of the 2 seconds');
  const last = flight.frames[flight.frames.length - 1].transform;
  assert.ok(last.includes('translate(1440px, 0px)'), 'it ends on the new place, 1440 px to the right: ' + last);
  assert.ok(last.endsWith('scaleX(1)'));
  assert.equal(hawk.style.values['--logo-purple'], '#6c18b6', 'still the old colors');
  assert.equal(world.newLogo.style.visibility, 'hidden', 'the new logo waits out of sight');

  await hawkAfter(1200);
  assert.equal(hawk.style.values['--logo-purple'], undefined, 'the colors are the new look\'s after the top of the arc');
  await hawkAfter(1900);
  assert.equal(hawk.removed, undefined);
  await drive(playing);
  assert.equal(hawk.removed, true);
  assert.equal(world.newLogo.style.visibility, undefined, 'the logo is back where the hawk landed');
});

test('a page that is about to reload stays apart until it is gone, and the Speed setting stretches every time', async () => {
  const world = await loadRun({ pace: 2 });
  world.reloading = true;
  const swapPage = newLook(world);
  const playing = world.offer(otherPage('events'), mondayPage('monday-tasks')).play(swapPage);
  await drive(playing);

  const log = world.log.filter(line => line.startsWith('swapPage'));
  assert.deepEqual(log, ['swapPage at 700'], 'the look goes on at 350 ms, at half speed');
  assert.ok(world.now >= 700 + 8000, 'the screen waited ' + world.now);
  const oldPlate = world.animations.find(animation => animation.element.name === 'banner plate');
  assert.equal(oldPlate.options.delay + oldPlate.options.duration, 900, 'a pull of 450 ms takes 900 ms');
});

test('a swap that fails puts everything back, and one that finds the areas never at rest does not start', async () => {
  const busy = await import(busyModuleUrl);
  const world = await loadRun();
  const quiet = console.error;
  console.error = () => {};

  try {
    const failing = world.offer(otherPage('events'), mondayPage('monday-tasks')).play(() => { throw new Error('the page cannot swap'); });
    const took = await drive(failing);
    assert.equal(took, 0);
    assert.equal(swapRun.swapRunning(), false);
    assert.equal(busy.isBusy(), false);
    assert.equal(world.elements.world.dataset.pieces, undefined);
    assert.deepEqual(world.elements.pile.children, [world.elements.cube]);
    assert.equal(world.page.logos[0].style.visibility, undefined);
    assert.ok(world.animations.filter(animation => animation.options.iterations !== Infinity || animation.element.removed).every(animation => animation.cancelled || animation.element.removed), 'no piece and no content is left pulled apart or faded out');
    assert.deepEqual(world.log.slice(-4), ['together', 'end', 'clock false', 'swapPlaying false']);
  } finally {
    console.error = quiet;
  }

  const second = await loadRun();
  second.areaState = 'changing';
  let swapped = false;
  const took = await drive(second.offer(otherPage('events'), mondayPage('monday-tasks')).play(() => { swapped = true; }));
  assert.equal(took, 0);
  assert.equal(swapped, false, 'the usual page change runs instead');
  assert.equal(swapRun.swapRunning(), false);
  assert.equal(second.log.includes('end'), true);
  assert.ok(second.now >= 1500 && second.now < 1700, 'it gave up after 1.5 seconds');
});


// The stylesheets
test('frame.css shows the pieces while #world has data-pieces, and has an act for the hawk of the swap', () => {
  const css = withoutComments(read('frame.css'));

  assert.ok(/\[data-motion="full"\] #world\[data-pieces\] \[data-pile="pieces"\] \.piece \{\s*display: block;/.test(css));
  ['.fills', '[data-part="frame-a"]', '[data-part="frame-b"]', '[data-part="shadow-a"]', '[data-part="shadow-b"]'].forEach(part => {
    assert.ok(css.includes('#world[data-pieces] [data-pile="pieces"] ' + part), part + ' is left out while the metal moves');
  });
  ['.shadow-layer', '.glint-layer', '.screw-shadow', '.kit', '[data-pile="released"]'].forEach(part => {
    assert.ok(css.includes('#world[data-pieces] ' + part), part + ' is left out while the metal moves');
  });
  assert.ok(/\.logo\[data-act="swap"\] \.hawk-part[\s\S]*?\{ opacity: 1; \}/.test(css));
  assert.ok(/\.logo\[data-act="swap"\] \.emblem \{ opacity: 0; \}/.test(css));
  assert.ok(!/data-act="swap"[^{]*\{[^}]*animation/.test(css), 'the swap moves the hawk with element.animate(), not with a stylesheet');
});

test('the five Monday cards are marked in the registry, and nothing else is', () => {
  const registry = read('registry.js');
  const marked = [...registry.matchAll(/\{ id: '([^']+)'[^}]*monday: true \}/g)].map(match => match[1]);
  assert.deepEqual(marked, ['monday-tasks', 'monday-milestones', 'monday-progress', 'monday-milestones-both', 'monday-progress-both']);
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
process.exit(failures === 0 ? 0 : 1);
