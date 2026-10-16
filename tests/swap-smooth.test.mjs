// Tests for the smooth swap (docs/layouts.md, "The swap"): that the pieces of the old look all go somewhere in the
// new one and the new pieces all come from somewhere, that nothing jumps at the moment between the pull and the
// travel, that something is always moving, and that the swap changes the layout of the running page, with no
// reload, in the cases that used to reload it: the calm and no motion paths, the other areas waiting at the gate, the
// layout put on the page and taken off it, the small frame that comes with a layout, and the look that waits for a swap.
// The pieces are the ones measured in a render of each look at 1920 x 1080 (tests/data/swap-pieces.json). Nothing
// touches the network or a browser. tests/swap.test.mjs has the plan and the player of the swap, and the stylesheets.
//
//   node tests/swap-smooth.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(root, 'dashboard');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(line => !line.trim().startsWith('//')).join('\n');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-swap-smooth-'));

function makeTree(name, files) {
  const folder = path.join(workFolder, name);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'package.json'), '{ "type": "module" }\n');
  files.forEach(file => {
    fs.mkdirSync(path.dirname(path.join(folder, 'dashboard', file)), { recursive: true });
    fs.copyFileSync(path.join(dashboardFolder, file), path.join(folder, 'dashboard', file));
  });
  return folder;
}

const urlOf = (folder, file) => pathToFileURL(path.join(folder, 'dashboard', file)).href;

async function withGlobals(values, run) {
  const kept = {};
  Object.keys(values).forEach(name => {
    kept[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value: values[name], configurable: true, writable: true });
  });
  try {
    return await run();
  } finally {
    Object.keys(values).forEach(name => {
      if (kept[name]) Object.defineProperty(globalThis, name, kept[name]);
      else delete globalThis[name];
    });
  }
}

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const planTree = makeTree('plan', ['config.js', 'core/transitions.js', 'core/swap-plan.js']);
const plan = await import(urlOf(planTree, 'core/swap-plan.js'));
const { bezierAt, contentFade, destinationsOf, matchPieces, planPull, planReform, poseAt, pullEase, pullProgress, reformEase, reformPoseAt, reformProgress, swapReform, swapTimes } = plan;


// The pieces of each look

// Each look is { layout, pieces, logos }: the plates, the boxes and the bolts as core/swap-run.js measures them, and where the logos are
const looks = JSON.parse(fs.readFileSync(path.join(root, 'tests/data/swap-pieces.json'), 'utf8'));
const middleOf = piece => ({ x: piece.left + piece.width / 2, y: piece.top + piece.height / 2 });
const seeds = [3, 17, 4242];

// The cases the owner asked about, as [old look, new look]. Prime to Nova is the same layout turned round, Original to
// Cybertron the same layout with other frames, and the rest change the layout
const cases = {
  'Prime to Nova in Original (the mirror)': ['original-prime', 'original-nova'],
  'Nova to Prime in Original': ['original-nova', 'original-prime'],
  'Original to Cybertron': ['original-prime', 'cybertron-prime'],
  'Cybertron to Original': ['cybertron-prime', 'original-prime'],
  'Original Nova to Cybertron Prime (the mirror and the frames)': ['original-nova', 'cybertron-prime'],
  'Original to Minimal': ['original-prime', 'minimal-prime'],
  'Minimal to Original': ['minimal-prime', 'original-prime'],
  'Cybertron to Minimal': ['cybertron-prime', 'minimal-prime'],
  'Minimal Prime to Original Nova (the Monday block ends and the team changes)': ['minimal-prime', 'original-nova'],
  'Minimal to Cybertron': ['minimal-nova', 'cybertron-prime'],
  'Original to the sidebar layout': ['original-prime', 'sidebar-prime'],
  'the sidebar layout to Minimal': ['sidebar-prime', 'minimal-prime'],
};

// Runs the plan for a case, as core/swap-run.js does: the pull of the old pieces, and the re-form of the new ones from the pose
// the old ones had at the moment the look went on
function planFor(oldName, newName, seed) {
  const olds = looks[oldName].pieces;
  const news = looks[newName].pieces;
  const pull = planPull(olds, seed);
  const reform = planReform(pull, olds, news, swapTimes.switchMs, seed + 1);
  return { olds: olds, news: news, pull: pull, reform: reform };
}

test('the fixtures are the pieces of seven looks, in the three layouts', () => {
  assert.deepEqual(Object.keys(looks).sort(), ['cybertron-nova', 'cybertron-prime', 'minimal-nova', 'minimal-prime', 'original-nova', 'original-prime', 'sidebar-prime']);
  assert.deepEqual(Object.keys(looks).map(name => looks[name].layout).filter((layout, index, all) => all.indexOf(layout) === index).sort(), ['bar', 'sidebar', 'standard']);
  Object.keys(looks).forEach(name => {
    const pieces = looks[name].pieces;
    assert.ok(pieces.length > 10, name + ' has ' + pieces.length + ' pieces');
    assert.ok(pieces.every(piece => piece.width > 0 && piece.height > 0 && piece.left > -200 && piece.left < 1920 && piece.top > -200 && piece.top < 1080), name + ' is on the screen');
    assert.ok(pieces.some(piece => piece.kind === 'bolt') && pieces.some(piece => piece.kind === 'plate'), name + ' has plates and bolts');
  });
  assert.ok(Object.keys(cases).length >= 10);
});


// One gesture

test('the pull and the travel both start slowly and end softly, and every piece is out and at rest when the look goes on', () => {
  [pullEase, reformEase].forEach((curve, index) => {
    const name = index === 0 ? 'the pull' : 'the travel';
    assert.ok(bezierAt(curve, 0.1) < 0.08, name + ' starts slowly: ' + bezierAt(curve, 0.1));
    assert.ok(bezierAt(curve, 0.9) > 0.97, name + ' ends softly: ' + bezierAt(curve, 0.9));
    assert.ok(curve[0] > 0 && curve[1] === 0, name + ' leaves from rest');
    assert.ok(curve[3] === 1 && curve[2] < 0.5, name + ' arrives at rest, with a long tail');

    let last = 0;
    for (let step = 1; step <= 50; step++) {
      const value = bezierAt(curve, step / 50);
      assert.ok(value >= last, name + ' never goes back');
      last = value;
    }
  });

  assert.equal(swapTimes.switchMs, swapTimes.pullMs, 'the look goes on when the pull is over');
  seeds.forEach(seed => {
    planPull(looks['original-prime'].pieces, seed).pieces.forEach(entry => {
      assert.equal(pullProgress(entry, swapTimes.switchMs), 1, entry.id + ' is out');
      assert.deepEqual(poseAt(entry, swapTimes.switchMs), { x: entry.out.x, y: entry.out.y, tip: entry.out.tip, twist: entry.out.twist, sx: entry.out.sx, sy: entry.out.sy });
      assert.ok(pullProgress(entry, swapTimes.switchMs - 20) > 0.97, entry.id + ' has all but stopped');
    });
  });
});

test('the travel leaves after a delay of its own, 0 to 150 ms, from rest, and every piece is home by 1250 ms', () => {
  assert.deepEqual(swapReform, { reformDelayMostMs: 150, travelLeastMs: 300, dipLeast: 0.4, dipBeforeMs: 100, dipAfterMs: 140 });
  seeds.forEach(seed => {
    const { reform } = planFor('original-prime', 'cybertron-prime', seed);
    const delays = reform.pieces.map(entry => entry.delayMs);

    reform.pieces.forEach(entry => {
      assert.ok(Number.isInteger(entry.delayMs) && entry.delayMs >= 0 && entry.delayMs <= 150, entry.id + ' leaves after ' + entry.delayMs);
      assert.equal(swapTimes.switchMs + entry.delayMs + entry.ms, swapTimes.reformEndMs, entry.id + ' is home at 1250');
      assert.equal(reformProgress(entry, swapTimes.switchMs, swapTimes.switchMs + entry.delayMs), 0, 'it has not moved when it leaves');
      assert.equal(reformProgress(entry, swapTimes.switchMs, swapTimes.reformEndMs), 1);
      assert.deepEqual(reformPoseAt(entry, swapTimes.switchMs, swapTimes.reformEndMs), { x: 0, y: 0, tip: 0, twist: 0, sx: 1, sy: 1 }, entry.id + ' is in its place');
      assert.deepEqual(entry.to, plan.restPose);
    });
    assert.ok(Math.min.apply(null, delays) < 40 && Math.max.apply(null, delays) > 100, 'the delays are spread over the range: ' + Math.min.apply(null, delays) + ' to ' + Math.max.apply(null, delays));
  });

  const first = planFor('original-prime', 'original-nova', 5).reform;
  assert.deepEqual(first, planFor('original-prime', 'original-nova', 5).reform, 'the same pieces and the same seed give the same plan');
  assert.notDeepEqual(first, planFor('original-prime', 'original-nova', 6).reform);
});

// The pose of a piece on the screen: the middle and the size, from the piece's own box and the pose it is in
const onScreen = (piece, pose) => ({ x: middleOf(piece).x + pose.x, y: middleOf(piece).y + pose.y, width: piece.width * pose.sx, height: piece.height * pose.sy, tip: pose.tip, twist: pose.twist });

Object.keys(cases).forEach(name => {
  test('nothing jumps at the switch: ' + name + ', each new piece starts as its old piece was', () => {
    const [oldName, newName] = cases[name];
    seeds.forEach(seed => {
      const { olds, news, pull, reform } = planFor(oldName, newName, seed);
      const oldById = {};
      const newById = {};
      olds.forEach(piece => { oldById[piece.id] = piece; });
      news.forEach(piece => { newById[piece.id] = piece; });

      reform.pieces.forEach(entry => {
        const old = oldById[entry.partner];
        assert.ok(old, entry.id + ' takes over from a piece of the old look');
        const pulled = pull.pieces.find(item => item.id === old.id) || pull.pieces.find(item => item.id === old.parent);
        const was = onScreen(old, pulled ? poseAt(pulled, swapTimes.switchMs) : plan.restPose);
        const starts = onScreen(newById[entry.id], reformPoseAt(entry, swapTimes.switchMs, swapTimes.switchMs));

        ['x', 'y', 'width', 'height', 'tip', 'twist'].forEach(key => {
          assert.ok(Math.abs(was[key] - starts[key]) < 0.6, name + ': ' + entry.id + ' ' + key + ' is ' + starts[key] + ' and the old piece ' + old.id + ' had ' + was[key]);
        });
      });
    });
  });
});

Object.keys(cases).forEach(name => {
  test('every piece of the old look has a place in the new one and every new piece has a source: ' + name, () => {
    const [oldName, newName] = cases[name];
    seeds.forEach(seed => {
      const { olds, news, reform } = planFor(oldName, newName, seed);
      const newIds = new Set(news.map(piece => piece.id));
      const mergedOut = new Set(reform.merged);

      // no old piece is dropped: each one has a destination, which is a piece of the new look
      assert.deepEqual(Object.keys(reform.destinations).sort(), olds.map(piece => piece.id).sort(), 'every old piece has a destination');
      olds.forEach(piece => assert.ok(newIds.has(reform.destinations[piece.id]), piece.id + ' goes to ' + reform.destinations[piece.id]));

      // every new piece starts from an old one, and moves unless it is folded into the plate it rides on
      const matched = matchPieces(olds, news);
      news.forEach(piece => assert.ok(matched[piece.id] !== '', piece.id + ' has an old piece to take over from'));
      news.filter(piece => !mergedOut.has(piece.id)).forEach(piece => assert.ok(reform.pieces.some(entry => entry.id === piece.id), piece.id + ' moves'));
      assert.equal(reform.pieces.length + reform.merged.length, news.length, 'and nothing else');

      // every old piece that a new piece took over from is the partner of one: those are not folded away
      const taken = new Set(Object.keys(matched).map(id => matched[id]));
      olds.forEach(piece => {
        if (taken.has(piece.id)) assert.equal(newIds.has(reform.destinations[piece.id]) && matched[reform.destinations[piece.id]] === piece.id, true, piece.id + ' goes to the piece that took over from it');
      });
    });
  });
});

test('where an old piece has no new piece to take over from, it goes to the nearest piece of its kind', () => {
  const olds = [
    { id: 'o1', kind: 'plate', region: 'a', index: 0, left: 0, top: 0, width: 100, height: 100, parent: '' },
    { id: 'o2', kind: 'plate', region: 'a', index: 1, left: 800, top: 0, width: 100, height: 100, parent: '' },
    { id: 'o3', kind: 'plate', region: 'a', index: 2, left: 840, top: 600, width: 100, height: 100, parent: '' },
    { id: 'ob', kind: 'bolt', region: 'a', index: 0, left: 400, top: 400, width: 48, height: 48, parent: 'o1' },
  ];
  const news = [
    { id: 'n1', kind: 'plate', region: 'a', index: 0, left: 10, top: 10, width: 100, height: 100, parent: '' },
    { id: 'n2', kind: 'plate', region: 'a', index: 1, left: 790, top: 10, width: 100, height: 100, parent: '' },
  ];
  const partner = matchPieces(olds, news);
  const where = destinationsOf(olds, news, partner);

  assert.deepEqual(partner, { n1: 'o1', n2: 'o2' });
  assert.deepEqual(where, { o1: 'n1', o2: 'n2', o3: 'n2', ob: 'n1' }, 'o3 is nearest n2, and the bolt, which has no bolt to go to, goes to the nearest piece');
  assert.deepEqual(destinationsOf(olds, [], {}), { o1: '', o2: '', o3: '', ob: '' }, 'with no new piece at all there is nowhere to go');
});

test('a piece with the same number takes over from the old one of its place when the two are of a like size, and from the most like one when they are not', () => {
  const old = (id, index, left, top, width, height) => ({ id: id, kind: 'plate', region: 'r', index: index, left: left, top: top, width: width, height: height, parent: '' });
  const olds = [old('edge', 0, 0, 0, 1200, 60), old('body', 1, 0, 60, 1200, 700), old('side', 2, 1140, 60, 60, 700)];

  // the same frame in the same places: every piece has its own
  const same = olds.map(piece => Object.assign({}, piece, { id: piece.id + '-new', left: piece.left + 20 }));
  assert.deepEqual(matchPieces(olds, same), { 'edge-new': 'edge', 'body-new': 'body', 'side-new': 'side' });

  // another frame numbers its pieces another way: the body is number 0 and the edge number 2. The numbers do not decide
  const other = [old('body-new', 0, 300, 60, 1300, 700), old('side-new', 1, 1540, 60, 60, 700), old('edge-new', 2, 300, 0, 1300, 60)];
  assert.deepEqual(matchPieces(olds, other), { 'body-new': 'body', 'side-new': 'side', 'edge-new': 'edge' });
});

test('a plate is stretched by at most a factor of 6 where it takes over from another in the same layout, and 10 where the layout changes', () => {
  Object.keys(cases).forEach(name => {
    const [oldName, newName] = cases[name];
    const { reform, news } = planFor(oldName, newName, 3);
    const byId = {};
    news.forEach(piece => { byId[piece.id] = piece; });
    const most = looks[oldName].layout === looks[newName].layout ? 6 : 10;

    reform.pieces.filter(entry => byId[entry.id].kind === 'plate').forEach(entry => {
      const ratios = [entry.from.sx, entry.from.sy].map(scale => Math.max(scale, 1 / scale));
      assert.ok(Math.max.apply(null, ratios) <= most, name + ': ' + entry.id + ' is stretched by ' + ratios.join(' and '));
    });
  });
});


// Something is always moving

// How far the pieces of a look have moved in a time: the sum, over the pieces, of the pixels their middle moves and the
// pixels the corners of the box move for the size, the tip and the turn
function travelled(old, news, pull, reform, from, to, at) {
  const poseOf = (piece, pose) => onScreen(piece, pose);
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) + Math.abs(a.width - b.width) / 4 + Math.abs(a.height - b.height) / 4 + Math.abs(a.tip - b.tip) * 2 + Math.abs(a.twist - b.twist) * 2;
  let total = 0;

  if (to <= at) {
    pull.pieces.forEach(entry => {
      const piece = old.find(item => item.id === entry.id);
      total += gap(poseOf(piece, poseAt(entry, from)), poseOf(piece, poseAt(entry, to)));
    });
  } else if (from >= at) {
    reform.pieces.forEach(entry => {
      const piece = news.find(item => item.id === entry.id);
      total += gap(poseOf(piece, reformPoseAt(entry, at, from)), poseOf(piece, reformPoseAt(entry, at, to)));
    });
  }
  return total;
}

test('there is no moment when the screen is still: in every 100 ms of the pieces something moves, from the first piece to the last', () => {
  ['original-prime>original-nova', 'original-prime>cybertron-prime', 'original-prime>minimal-prime', 'minimal-prime>original-nova'].forEach(pair => {
    const [oldName, newName] = pair.split('>');
    seeds.forEach(seed => {
      const { olds, news, pull, reform } = planFor(oldName, newName, seed);
      const at = swapTimes.switchMs;
      // the pull is over at the switch and the travel begins there: windows on either side of it, and none across it, because the look goes on in it
      const windows = [];
      for (let from = 0; from + 100 <= at; from += 25) windows.push([from, from + 100]);
      for (let from = at; from + 100 <= swapTimes.reformEndMs - 25; from += 25) windows.push([from, from + 100]);

      windows.forEach(([from, to]) => {
        const moved = travelled(olds, news, pull, reform, from, to, at);
        assert.ok(moved > 120, pair + ' seed ' + seed + ': the pieces moved ' + Math.round(moved) + ' between ' + from + ' and ' + to + ' ms');
      });
    });
  });
});

test('the travel is the visible part: at the middle of it a piece is neither at the pose it left nor at its place', () => {
  const { reform } = planFor('original-prime', 'original-nova', 3);
  const at = swapTimes.switchMs;

  reform.pieces.filter(entry => Math.abs(entry.from.x) > 100).forEach(entry => {
    const middle = reformProgress(entry, at, at + entry.delayMs + entry.ms / 2);
    assert.ok(middle > 0.4 && middle < 0.9, entry.id + ' is ' + middle + ' of the way at the middle of its travel');
    const late = reformProgress(entry, at, swapTimes.reformEndMs - 250);
    assert.ok(late > 0.8 && late < 1, entry.id + ' is not yet home 250 ms before the end: ' + late);
  });
  assert.deepEqual(contentFade().in, { delayMs: 1000, ms: 250 }, 'the content comes in over the last 250 ms of the travel');
});

test('a look that goes on late still gets a travel of at least 300 ms after the last delay, and the content comes back at the end of it', () => {
  const olds = looks['original-prime'].pieces;
  const news = looks['minimal-prime'].pieces;
  const pull = planPull(olds, 9);
  const at = 950;
  const end = Math.max(swapTimes.reformEndMs, at + swapReform.reformDelayMostMs + swapReform.travelLeastMs);
  const reform = planReform(pull, olds, news, at, 10, end);

  assert.equal(end, 1400);
  reform.pieces.forEach(entry => {
    assert.equal(at + entry.delayMs + entry.ms, end);
    assert.ok(entry.ms >= 300);
  });
  assert.deepEqual(contentFade(end).in, { delayMs: 1150, ms: 250 }, 'the content comes back over the last 250 ms of the travel');
});


// The player of the swap, with stand-ins for the page

// core/swap-run.js is copied into a tree of its own. What it asks of the page is a small stand-in: a stage, the
// content that fades, and a clock that the test moves by hand. This page has no pieces, which is the page of calm
// motion and of no motion, and is enough to see in what order the swap does things.
const runTree = makeTree('run', ['config.js', 'registry.js', 'core/transitions.js', 'core/swap-plan.js', 'core/swap-run.js', 'core/busy.js']);
const standIns = {
  'frame.js': [
    'export const pace = () => globalThis.world.pace;',
    'export const motionNow = () => globalThis.world.motion;',
    'export const wait = milliseconds => globalThis.world.sleep(milliseconds);',
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
    '    waitForRegions: (regions, maxMs) => {',
    "      globalThis.world.log.push('waitForRegions ' + regions.join(' ') + ' ' + maxMs + ' at ' + globalThis.world.now);",
    '      return globalThis.world.sleep(globalThis.world.regionsLate);',
    '    },',
    '  };',
    '}',
  ],
  'core/hidden-pile.js': [
    'export const boltBox = 48;',
    'export const findPlates = () => [];',
    'export const findBoxes = () => [];',
    'export const findContent = () => globalThis.world.content.slice();',
    'export const findBolts = () => [];',
    'export const screenPlace = () => ({ left: 0, top: 0, scale: 1 });',
    'export const boxOf = element => Object.assign({ zoom: 1 }, element.rect);',
    'export const boltCopy = () => null;',
  ],
  'core/layout-apply.js': ['export const layoutIsReloading = () => globalThis.world.reloading;'],
  'core/schedule.js': [
    "export const holdClock = on => globalThis.world.log.push('clock ' + on);",
    "export const moveOn = regions => globalThis.world.log.push('moveOn ' + regions.join(' ') + ' at ' + globalThis.world.now);",
  ],
  'core/takeover.js': ['export const takeoverRunning = () => globalThis.world.takeover;'],
  'core/teams.js': ['export const teamPending = () => globalThis.world.teamPending;'],
  'core/theme-apply.js': ['export const lookIsWaiting = () => globalThis.world.lookWaiting;'],
};
Object.keys(standIns).forEach(file => fs.writeFileSync(path.join(runTree, 'dashboard', file), standIns[file].join('\n') + '\n'));

// An object that stands for an element of the page, that can be animated
class Fake {
  constructor(name, id) {
    this.name = name;
    this.id = id || '';
    this.rect = { left: 0, top: 0, width: 0, height: 0 };
    this.dataset = {};
    this.hidden = false;
    this.animations = [];
  }

  animate(frames, options) {
    const animation = { element: this, frames: frames, options: options, startedAt: globalThis.world.now, cancelled: false, cancel() { this.cancelled = true; } };
    this.animations.push(animation);
    globalThis.world.animations.push(animation);
    return animation;
  }
}

function installWorld(options = {}) {
  const world = {
    now: 0,
    pace: options.pace || 1,
    motion: options.motion || 'full',
    takeover: false,
    reloading: false,
    teamPending: false,
    lookWaiting: false,
    regionsLate: options.regionsLate || 0,
    log: [],
    animations: [],
    timers: [],
    offer: null,
    areaState: 'shown',
    content: [new Fake('host')],
  };
  world.sleep = milliseconds => new Promise(resolve => world.timers.push({ due: world.now + Math.max(0, milliseconds), run: resolve }));
  const stage = new Fake('stage', 'stage');
  const pile = new Fake('pile', 'pile');
  pile.hidden = true;
  const cube = new Fake('cube', 'cube');
  world.elements = { world: new Fake('world', 'world'), stage: stage, pile: pile, cube: cube };
  stage.querySelectorAll = () => [];
  pile.insertBefore = () => {};

  globalThis.world = world;
  globalThis.document = {
    getElementById: id => world.elements[id] || null,
    querySelectorAll: () => [],
    querySelector: selector => {
      assert.equal(selector, '.area:not([data-state="shown"])');
      return world.areaState === 'shown' ? null : {};
    },
  };
  globalThis.window = { getComputedStyle: () => ({ getPropertyValue: () => '' }) };
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

const runModuleUrl = pathToFileURL(path.join(runTree, 'dashboard/core/swap-run.js')).href;
let swapRun = null;

async function loadRun(options) {
  const world = installWorld(options);
  swapRun = swapRun || await import(runModuleUrl + '?first');
  swapRun.startSwaps(() => world.elsewhere === true);
  return world;
}

const page = id => ({ id: id, region: 'grid1', element: {} });
const swapPage = world => () => world.log.push('swapPage at ' + world.now);

test('a held look is offered a swap in calm motion and with no motion, and a Monday card turn is not', async () => {
  const world = await loadRun();
  const offer = world.offer;

  ['calm', 'none'].forEach(motion => {
    world.motion = motion;
    assert.equal(offer(page('monday-tasks'), page('monday-milestones')), null, 'one Monday card to the next is the usual page change in ' + motion);
    assert.equal(offer(page('events'), page('monday-tasks')), null, 'and so is going into the Monday block, unless a look was held');

    swapRun.queueSwap();
    assert.ok(offer(page('tasks'), page('events')), 'a look was held, in ' + motion);
    assert.equal(offer(page('tasks'), page('events')), null, 'and the next page change is the usual one');
  });

  world.motion = 'full';
  assert.ok(offer(page('monday-tasks'), page('monday-milestones')), 'in full motion the Monday card turn is a swap');
  world.takeover = true;
  swapRun.queueSwap();
  assert.equal(offer(page('tasks'), page('events')), null, 'nothing is offered while an alert, an announcement or a talk has the screen');
  world.takeover = false;
  world.elsewhere = true;
  swapRun.queueSwap();
  assert.equal(offer(page('tasks'), page('events')), null, 'or while the demo, the night screen or a hidden transition does');
});

test('a look that is waiting goes on in a swap, though nobody queued one: a preview, a team of Alternate mode, a theme', async () => {
  const world = await loadRun();
  const offer = world.offer;

  assert.equal(offer(page('tasks'), page('events')), null);
  world.lookWaiting = true;
  assert.ok(offer(page('tasks'), page('events')), 'a look is waiting');
  world.lookWaiting = false;
  world.teamPending = true;
  assert.ok(offer(page('tasks'), page('events')), 'a team is waiting');
  world.teamPending = false;
  world.motion = 'calm';
  world.lookWaiting = true;
  assert.ok(offer(page('tasks'), page('events')), 'and in calm motion');
});

test('in calm motion the stage fades out, the look goes on while it is out of sight, and the stage fades in', async () => {
  const world = await loadRun({ motion: 'calm' });
  const stage = world.elements.stage;
  const swapped = swapPage(world);
  swapRun.queueSwap();
  const took = await drive(world.offer(page('tasks'), page('events')).play(swapped));

  assert.deepEqual(world.log.filter(line => !line.startsWith('moveOn') && !line.startsWith('waitForRegions')), ['gate false', 'swapPlaying true', 'clock true', 'swapPage at 300', 'apart', 'together', 'end', 'clock false', 'swapPlaying false']);
  assert.ok(world.log.includes('moveOn grid2 ticker at 0'), 'the other areas are asked to move on at once, so their pages wait at the gate');
  assert.ok(world.log.includes('waitForRegions grid2 ticker 1200 at 300'), 'and the look waits for them');
  assert.equal(stage.animations.length, 2, 'the stage fades twice and nothing else moves');
  assert.deepEqual(stage.animations[0].frames, [{ opacity: 1 }, { opacity: 0 }]);
  assert.deepEqual([stage.animations[0].options.duration, stage.animations[0].options.fill], [300, 'forwards']);
  assert.deepEqual(stage.animations[1].frames, [{ opacity: 0 }, { opacity: 1 }]);
  assert.equal(stage.animations[1].startedAt, 300, 'it comes back at once when the look has gone on');
  assert.equal(stage.animations[0].cancelled, true, 'the fade out is taken off, so the stage is whole at the end');
  assert.equal(stage.animations[1].cancelled, true);
  assert.equal(world.now, 600);
  assert.equal(took, 300);
  assert.equal(world.elements.world.dataset.pieces, undefined, 'there are no pieces');
  assert.ok(world.animations.every(animation => animation.element === stage), 'no piece, no content and no hawk moves');
});

test('with no motion the look goes on at once and nothing is animated', async () => {
  const world = await loadRun({ motion: 'none' });
  swapRun.queueSwap();
  const took = await drive(world.offer(page('tasks'), page('events')).play(swapPage(world)));

  assert.deepEqual(world.log.filter(line => !line.startsWith('moveOn') && !line.startsWith('waitForRegions')), ['gate false', 'swapPlaying true', 'clock true', 'swapPage at 0', 'apart', 'together', 'end', 'clock false', 'swapPlaying false']);
  assert.equal(world.animations.length, 0);
  assert.equal(world.now, 0);
  assert.equal(took, 0);
});

test('the Speed setting stretches the fades of calm motion, and a page that is about to reload stays apart until it is gone', async () => {
  const slow = await loadRun({ motion: 'calm', pace: 2 });
  swapRun.queueSwap();
  await drive(slow.offer(page('tasks'), page('events')).play(swapPage(slow)));
  assert.ok(slow.log.includes('swapPage at 600'), 'the look goes on after a fade of 600');
  assert.equal(slow.now, 1200);

  const reloading = await loadRun({ motion: 'calm' });
  reloading.reloading = true;
  swapRun.queueSwap();
  await drive(reloading.offer(page('tasks'), page('events')).play(swapPage(reloading)));
  assert.ok(reloading.now >= 300 + 8000, 'the screen waited for the page to go: ' + reloading.now);
});

test('in full motion the look waits for the other areas to be at the gate, and the pieces wait with it', async () => {
  const world = await loadRun({ regionsLate: 500 });
  swapRun.queueSwap();
  const took = await drive(world.offer(page('tasks'), page('events')).play(swapPage(world)));

  assert.deepEqual(world.log.filter(line => !line.startsWith('moveOn') && !line.startsWith('waitForRegions')), ['gate false', 'swapPlaying true', 'clock true', 'swapPage at 950', 'apart', 'together', 'end', 'clock false', 'swapPlaying false']);
  assert.ok(world.log.includes('moveOn grid2 ticker at 0'), 'the other areas are asked at the start, so they have the time of the pull to choose their pages');
  assert.ok(world.log.includes('waitForRegions grid2 ticker 1200 at 450'), 'and the swap asks for them when the pieces are out');
  assert.equal(took, 450, 'the travel after the look went on at 950 ms is 450 ms, to 1400');
  assert.equal(world.now, 1400);
});

test('when the areas are there at once the look goes on at 450 ms and the pieces are home at 1250 ms', async () => {
  const world = await loadRun();
  swapRun.queueSwap();
  const took = await drive(world.offer(page('tasks'), page('events')).play(swapPage(world)));

  assert.ok(world.log.includes('swapPage at 450'));
  assert.equal(took, 800);
  assert.equal(world.now, 1250, 'with no hawk the swap ends when the content is back');
  const content = world.content[0];
  assert.deepEqual(content.animations[0].frames, [{ opacity: 1 }, { opacity: 0 }], 'the content fades out');
  const back = content.animations[1];
  assert.deepEqual(back.frames.map(frame => frame.opacity), [0, 0, 1]);
  assert.ok(Math.abs(back.frames[1].offset - (1000 - 450) / 800) < 0.0001, 'and in over the last 250 ms');
});

test('the swap waits as long as 8 seconds for the areas to be at rest, and gives up after that', async () => {
  const world = await loadRun();
  world.areaState = 'changing';
  let swapped = false;
  swapRun.queueSwap();
  const took = await drive(world.offer(page('tasks'), page('events')).play(() => { swapped = true; }));

  assert.equal(took, 0);
  assert.equal(swapped, false, 'the usual page change runs instead');
  assert.ok(world.now >= 8000 && world.now < 8200, 'it waited ' + world.now + ' ms');

  const late = await loadRun();
  late.areaState = 'changing';
  late.sleep(5000).then(() => { late.areaState = 'shown'; });
  swapRun.queueSwap();
  await drive(late.offer(page('tasks'), page('events')).play(swapPage(late)));
  assert.ok(late.log.some(line => line.startsWith('swapPage')), 'areas that finish a page change in 5 seconds are waited for');
});


// The layout, changed on the page that is running (core/layout-apply.js)

const layoutTree = makeTree('layout', [
  'config.js', 'registry.js', 'themes/registry.js', 'themes/overlays/registry.js',
  'core/layout.js', 'core/layout-apply.js', 'core/theme.js', 'core/style.js',
  'core/season.js', 'core/marks.js', 'core/header-room.js', 'core/corner-art.js', 'core/pack-extras.js',
]);
const layout = await import(urlOf(layoutTree, 'core/layout.js'));

// The page of index.html, as far as the layouts move it: the stage with its regions in order, the hidden ones, and the html
// element with a style. An element knows its parent and its children, so that where it is can be compared.
function fakePage() {
  const elements = {};
  const make = (id, attributes) => {
    const element = {
      id: id,
      hidden: false,
      attributes: Object.assign({}, attributes),
      parent: null,
      children: [],
      innerHTML: '',
      remove() {
        if (element.parent) element.parent.children = element.parent.children.filter(other => other !== element);
        element.parent = null;
      },
      appendChild(child) {
        if (child.parent) child.parent.children = child.parent.children.filter(other => other !== child);
        child.parent = element;
        element.children.push(child);
        return child;
      },
      insertBefore(child, before) {
        if (child.parent) child.parent.children = child.parent.children.filter(other => other !== child);
        child.parent = element;
        const at = element.children.indexOf(before);
        if (at === -1) element.children.push(child);
        else element.children.splice(at, 0, child);
        return child;
      },
      setAttribute(name, value) { element.attributes[name] = value; },
      removeAttribute(name) { delete element.attributes[name]; },
      insertAdjacentHTML(where, markup) {
        const kit = make('kit-' + elements.kits.length, {});
        kit.kit = true;
        elements.kits.push(kit);
        element.appendChild(kit);
      },
      get firstChild() { return element.children[0] || null; },
    };
    elements[id] = element;
    return element;
  };
  elements.kits = [];

  const stage = make('stage');
  const inStage = (child, parent) => (parent || stage).appendChild(child);
  inStage(make('region-banner', { 'data-block': '' }));
  const strip = inStage(make('region-strip'));
  strip.hidden = true;
  strip.appendChild(make('strip-name'));
  strip.appendChild(make('strip-clock'));
  const sidebar = inStage(make('region-sidebar'));
  sidebar.hidden = true;
  ['sidebar-top', 'sidebar-countdown', 'sidebar-bottom'].forEach(id => sidebar.appendChild(make(id)));
  const middle = inStage(make('bar-middle'));
  middle.hidden = true;
  const column = make('region-column');
  column.hidden = true;
  middle.appendChild(column);
  inStage(make('region-grid1', { 'data-block': '' }));
  const right = inStage(make('region-right'));
  right.appendChild(make('region-countdown', { 'data-block': '' }));
  right.appendChild(make('region-grid2', { 'data-block': '' }));
  inStage(make('region-ticker', { 'data-block': '' }));

  const properties = {};
  const html = {
    dataset: { layout: 'standard', style: 'original' },
    style: { properties: properties, setProperty(name, value) { properties[name] = value; }, removeProperty(name) { delete properties[name]; } },
  };
  const document = {
    getElementById: id => elements[id] || null,
    documentElement: html,
    querySelectorAll: selector => {
      assert.equal(selector, '.kit');
      return elements.kits.filter(kit => kit.parent !== null);
    },
  };
  return { elements: elements, html: html, document: document };
}

// Where everything is: the tree of the stage, the hidden regions, the blocks, the variables and what the html element carries
function whereIs(fake) {
  const lines = [];
  const walk = (element, depth) => {
    lines.push('  '.repeat(depth) + element.id + (element.hidden ? ' hidden' : '') + ('data-block' in element.attributes ? ' block' : '') + (element.innerHTML ? ' filled' : ''));
    element.children.forEach(child => walk(child, depth + 1));
  };
  walk(fake.elements.stage, 0);
  lines.push(JSON.stringify(fake.html.dataset) + ' ' + JSON.stringify(fake.html.style.properties));
  return lines.join('\n');
}

const lookOf = (style, theme = 'hawktimus') => ({ theme: theme, overlay: '', style: style });

async function onLayoutPage(run, extra = {}) {
  const fake = fakePage();
  const apply = await import(urlOf(layoutTree, 'core/layout-apply.js') + '?page=' + Math.random());
  await withGlobals(Object.assign({ document: fake.document }, extra), () => run(fake, apply));
}

test('a running page changes to the bar layout and back, and is then exactly as index.html has it', async () => {
  await onLayoutPage((fake, apply) => {
    const before = whereIs(fake);

    assert.equal(apply.changeLayout(lookOf('minimal'), fake.html), true);
    assert.equal(fake.html.dataset.layout, 'bar');
    assert.equal(fake.html.dataset.style, 'minimal', 'the style goes on first, because the frames of the layout are drawn for its corners');
    assert.equal(fake.html.dataset.shapes, 'minimal');
    assert.equal(fake.elements['bar-middle'].hidden, false);
    assert.equal(fake.elements['region-column'].hidden, false);
    assert.equal(fake.elements['region-grid1'].parent, fake.elements['bar-middle'], 'the large frame is in the row');
    assert.deepEqual(Object.keys(fake.html.style.properties).sort(), Object.keys(layout.barCssVariables()).sort());
    ['banner', 'column', 'grid1', 'ticker'].forEach(name => assert.ok('data-block' in fake.elements['region-' + name].attributes, name + ' is a block'));
    ['countdown', 'grid2'].forEach(name => assert.ok(!('data-block' in fake.elements['region-' + name].attributes), name + ' is not'));

    assert.equal(apply.changeLayout(lookOf('original'), fake.html), true);
    assert.equal(whereIs(fake).replace(/"style":"minimal"/, ''), before.replace(/"style":"minimal"/, ''));
    assert.equal(fake.html.dataset.layout, 'standard');
    assert.equal(fake.html.dataset.style, 'original');
    assert.equal(fake.html.dataset.shapes, undefined, 'the corners are the usual ones again');
    assert.deepEqual(fake.html.style.properties, {});
    assert.equal(apply.changeLayout(lookOf('cybertron'), fake.html), false, 'Original to Cybertron is the same layout: only the frames change, and shell.js draws them');
    assert.equal(whereIs(fake), before);
  });
});

test('a running page goes between all three layouts, in any order, and leaves nothing of the one it came from', async () => {
  await onLayoutPage((fake, apply) => {
    const standard = whereIs(fake);
    const withoutStyle = text => text.replace(/"style":"[a-z]+"/, '').replace(/,"shapes":"[a-z]+"/, '');
    const kitsOn = () => fake.elements.kits.filter(kit => kit.parent !== null).length;

    const asked = [['neon-prime', 'original', 'sidebar'], ['hawktimus', 'minimal', 'bar'], ['neon-prime', 'cybertron', 'sidebar'], ['hawktimus', 'original', 'standard'], ['hawktimus', 'minimal', 'bar'], ['hawktimus', 'original', 'standard']];

    asked.forEach(([theme, style, wanted]) => {
      apply.changeLayout(lookOf(style, theme), fake.html);
      assert.equal(fake.html.dataset.layout, wanted, theme + ' with ' + style);

      if (wanted === 'sidebar') {
        assert.equal(fake.elements['region-strip'].hidden, false);
        assert.equal(fake.elements['region-sidebar'].hidden, false);
        assert.equal(fake.elements['region-banner'].parent, fake.elements['sidebar-top'], 'the banner is in the column');
        assert.equal(fake.elements['region-countdown'].parent, fake.elements['sidebar-countdown']);
        assert.equal(kitsOn(), 4, 'the neon kit is in the four blocks');
        assert.deepEqual(Object.keys(fake.html.style.properties).sort(), Object.keys(layout.cssVariables()).sort());
        assert.equal(fake.elements['bar-middle'].hidden, true, 'nothing of the bar layout is left');
        assert.equal(fake.elements['region-grid1'].parent, fake.elements.stage);
      }
      if (wanted === 'bar') {
        assert.equal(fake.elements['region-strip'].hidden, true, 'nothing of the sidebar layout is left');
        assert.equal(fake.elements['region-sidebar'].hidden, true);
        assert.equal(fake.elements['region-banner'].parent, fake.elements.stage, 'the banner is back where index.html has it');
        assert.equal(fake.elements['region-countdown'].parent, fake.elements['region-right']);
        assert.deepEqual(Object.keys(fake.html.style.properties).sort(), Object.keys(layout.barCssVariables()).sort(), 'only the variables of this layout');
        assert.equal(kitsOn(), 0, 'and none of the neon kit');
        assert.equal(fake.elements['region-grid1'].parent, fake.elements['bar-middle']);
      }
      if (wanted === 'standard') {
        assert.equal(withoutStyle(whereIs(fake)), withoutStyle(standard), 'the page is as index.html has it');
        assert.equal(kitsOn(), 0);
      }
    });
  });
});

test('the order of the stage after any number of changes is the order of index.html', async () => {
  await onLayoutPage((fake, apply) => {
    const order = () => fake.elements.stage.children.map(child => child.id).join(' ');
    const first = order();
    for (let round = 0; round < 6; round++) {
      apply.changeLayout(lookOf('minimal'), fake.html);
      apply.changeLayout(lookOf('original', 'neon-prime'), fake.html);
      apply.changeLayout(lookOf('original'), fake.html);
    }
    assert.equal(order(), first);
    assert.equal(fake.elements['region-right'].children.map(child => child.id).join(' '), 'region-countdown region-grid2');
    assert.equal(fake.elements.stage.children.filter(child => child.id === 'region-grid1').length, 1, 'no region was made twice');
  });
});

test('a look with another layout waits for a swap, and goes on while one plays, while something covers the screen, or after a minute', async () => {
  await onLayoutPage((fake, apply) => {
    const minimal = lookOf('minimal');

    assert.equal(apply.holdForLayout(lookOf('original'), () => false), false, 'a look with the layout the page has goes on at once');
    assert.equal(apply.holdForLayout(lookOf('cybertron'), () => false), false, 'and so does one with the same layout and other frames');
    assert.equal(apply.holdForLayout(minimal, () => false, 0, () => false), true, 'a look with another layout waits');
    assert.equal(apply.holdForLayout(minimal, () => false, 59999, () => false), true, 'for a minute');
    assert.equal(apply.holdForLayout(minimal, () => false, 60000, () => false), false, 'and goes on then');
    assert.equal(apply.holdForLayout(minimal, () => false, 0, () => true), false, 'it goes on while a swap has the screen');
    assert.equal(apply.holdForLayout(minimal, () => true, 0, () => false), false, 'and while an alert or an announcement covers the screen');
    assert.equal(apply.holdForLayout(minimal, undefined, 0, () => false), true, 'with nothing that covers it, it waits');
    assert.equal(apply.layoutsChangeLive(), true);
  });
});

test('a look with the layout the page has but other corners on its frames goes on at once: the frames are drawn again, and the layout does not change', async () => {
  await onLayoutPage((fake, apply) => {
    apply.changeLayout(lookOf('minimal'), fake.html);
    fake.html.dataset.shapes = ''; // a bar page drawn with the usual corners
    assert.equal(apply.holdForLayout(lookOf('minimal'), () => false, 0, () => false), false);
  });
});

test('a layout that cannot be changed in the page falls back to one reload, and never two', async () => {
  const reloads = [];
  const stored = {};
  const window = {
    location: { reload: () => reloads.push('reload') },
    sessionStorage: { getItem: name => (name in stored ? stored[name] : null), setItem: (name, value) => { stored[name] = String(value); }, removeItem: name => { delete stored[name]; } },
  };
  const quiet = console.error;
  console.error = () => {};

  try {
    await onLayoutPage((fake, apply) => {
      delete fake.elements['bar-middle']; // index.html has no row for the bar layout
      const look = lookOf('minimal');

      assert.equal(apply.changeLayout(look, fake.html), false, 'the change failed');
      assert.equal(fake.html.dataset.layout, 'standard', 'the page is as it was');
      assert.equal(fake.elements['region-grid1'].parent, fake.elements.stage, 'nothing was moved');
      assert.equal(look.style, 'original', 'the look keeps the style the page has');
      assert.deepEqual(reloads, ['reload'], 'the page reloads, once');
      assert.equal(stored[layout.reloadKey], 'bar-minimal', 'and writes down what it reloads for');
      assert.equal(apply.layoutsChangeLive(), false, 'and the layout is not changed in the page again');
      assert.equal(apply.layoutIsReloading(), true);

      assert.equal(apply.holdForLayout(lookOf('minimal'), () => false), false, 'the page that comes back in the old layout does not reload again');
      assert.deepEqual(reloads, ['reload']);
      delete stored[layout.reloadKey];
      assert.equal(apply.holdForLayout(lookOf('minimal'), () => true), true, 'while something covers the screen it waits, now that the page must reload for a layout');
    }, { window: window });
  } finally {
    console.error = quiet;
  }
});


// The gate of a whole screen move, and the regions that wait at it (core/areas.js)

const areaFiles = ['config.js', 'frame.js', 'registry.js', 'themes/registry.js', 'themes/overlays/registry.js']
  .concat(fs.readdirSync(path.join(dashboardFolder, 'core')).filter(name => name.endsWith('.js')).map(name => 'core/' + name));
const areaTree = makeTree('areas', areaFiles);

// Elements that remember where they are in the tree: just enough of a page for core/areas.js
function fakeElement(name) {
  const element = {
    name: name,
    dataset: {},
    children: [],
    className: '',
    classList: { contains: token => element.className.split(/\s+/).includes(token) },
    remove() {
      if (element.parent) element.parent.children.splice(element.parent.children.indexOf(element), 1);
      element.parent = null;
    },
    appendChild(child) {
      child.parent = element;
      element.children.push(child);
    },
    insertAdjacentHTML(where, markup) {
      const child = fakeElement('markup');
      child.markup = markup;
      child.parent = element;
      element.children.unshift(child);
    },
    querySelector: selector => (selector === '.page-host' ? element.children.filter(child => child.className === 'page-host')[0] || null : null),
  };
  return element;
}

let areaRuns = 0;

async function onAreas(run) {
  const html = { dataset: { layout: 'standard', style: 'original' }, style: { setProperty() {} } };
  const regions = {};
  const known = new Set();
  const document = {
    documentElement: html,
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => (markup.match(/ id="[^"]+"/g) || []).forEach(found => known.add(found.slice(5, -1))) };
      if (id.startsWith('region-')) {
        if (!regions[id]) regions[id] = fakeElement(id);
        return regions[id];
      }
      return known.has(id) ? {} : null;
    },
    createElement: () => {
      const element = fakeElement('area');
      let markup = '';
      Object.defineProperty(element, 'innerHTML', { get: () => markup, set: value => {
        markup = value;
        element.children.length = 0;
        const frame = fakeElement('frame');
        frame.markup = value.replace('<div class="page-host"></div>', '');
        const host = fakeElement('page-host');
        host.className = 'page-host';
        [frame, host].forEach(child => element.appendChild(child));
      } });
      return element;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    fonts: null,
  };

  await withGlobals({ document: document, setTimeout: () => 0, setInterval: () => 0 }, async () => {
    const world = { html: html, regions: regions };
    world.frameModule = await import(urlOf(areaTree, 'frame.js'));
    areaRuns += 1;
    world.areas = await import(urlOf(areaTree, 'core/areas.js') + '?run=' + areaRuns); // its own areas for each test
    world.frameModule.start({ motion: 'full', speed: 'normal' });
    world.areaOf = region => (regions['region-' + region] ? regions['region-' + region].children[0] || null : null);
    world.settle = async () => {
      for (let turn = 0; turn < 10; turn++) await new Promise(resolve => setImmediate(resolve));
    };
    await run(world);
  });
}

const pageOf = (id, region = 'grid1') => ({ id: id, region: region, element: { id: id } });

test('the regions that wait at the gate swap their pages in the step apart() runs, so that nothing is drawn between one and the next', async () => {
  await onAreas(async world => {
    const screen = world.areas.startWholeScreen(false);
    const done = [];
    const waiting = [['grid2', 'forecast'], ['ticker', 'tip']].map(([region, id]) => world.areas.changePage(region, pageOf(id, region)).then(result => done.push(region + ' ' + result)));
    await world.settle();

    assert.equal(world.areaOf('grid2'), null, 'nothing is drawn while the screen is held');
    assert.equal(world.areaOf('ticker'), null);
    assert.equal(await screen.waitForRegions(['grid2', 'ticker'], 0), true, 'both are at the gate');
    assert.equal(await screen.waitForRegions(['grid2', 'grid1'], 0), false, 'the large panel is not');

    screen.apart();
    assert.ok(world.areaOf('grid2') && world.areaOf('ticker'), 'both have their area in the same step as apart()');
    assert.equal(world.areaOf('grid2').dataset.state, 'shown', 'at rest: nobody sees a first assembly');
    assert.equal(world.areaOf('grid2').children[1].children[0].id, 'forecast', 'with its page in the host');
    assert.equal(world.areaOf('ticker').children[1].children[0].id, 'tip');

    await Promise.all(waiting);
    assert.deepEqual(done.sort(), ['grid2 0', 'ticker 0']);
    screen.together();
    screen.end();
  });
});

test('a region that the layout has not got waits at the gate like the others, and the look that goes on may give it the region', async () => {
  await onAreas(async world => {
    world.html.dataset.layout = 'bar';
    assert.equal(await world.areas.changePage('grid2', pageOf('forecast', 'grid2')), 0, 'with no gate, a layout without the small frame draws nothing for it');
    assert.equal(world.areaOf('grid2'), null);

    const screen = world.areas.startWholeScreen(false);
    const waiting = world.areas.changePage('grid2', pageOf('forecast', 'grid2'));
    await world.settle();
    assert.equal(await screen.waitForRegions(['grid2'], 0), true, 'it is at the gate though the layout has no such region');
    assert.equal(world.areaOf('grid2'), null);

    world.html.dataset.layout = 'standard'; // the look that goes on in the step brings the standard layout
    screen.apart();
    assert.ok(world.areaOf('grid2'), 'the small frame is made, in the same step');
    assert.equal(world.areaOf('grid2').children[1].children[0].id, 'forecast');
    assert.equal(await waiting, 0);
    screen.together();
    screen.end();
  });
});

test('a region that the look takes away loses its area in the step, and its page is dropped', async () => {
  await onAreas(async world => {
    const first = world.areas.changePage('grid2', pageOf('forecast', 'grid2'));
    await world.settle();
    await Promise.race([first, new Promise(resolve => setImmediate(resolve))]);
    assert.ok(world.areaOf('grid2'), 'the small frame is on screen in the standard layout');

    const screen = world.areas.startWholeScreen(false);
    const waiting = world.areas.changePage('grid2', pageOf('safety', 'grid2'));
    await world.settle();
    world.html.dataset.layout = 'bar';
    screen.apart();

    assert.equal(world.areaOf('grid2'), null, 'the area is gone');
    assert.equal(await waiting, 0);
    screen.together();
    screen.end();
  });
});

test('a hidden transition has the same gate: the regions swap when it says it is apart, and a look is not put on', async () => {
  await onAreas(async world => {
    const screen = world.areas.startWholeScreen(true);
    const waiting = world.areas.changePage('grid1', pageOf('tasks'));
    await world.settle();
    assert.equal(world.areaOf('grid1'), null);
    screen.apart();
    assert.ok(world.areaOf('grid1'), 'the large panel swaps its own page when the transition says it is apart');
    await waiting;
    screen.together();
    screen.end();
  });
});


// The list of the small frame, which runs in every layout (core/schedule.js)

const scheduleTree = path.join(workFolder, 'schedule-tree');
['config.js', 'core/schedule.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(scheduleTree, 'dashboard', file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(scheduleTree, 'dashboard', file));
});
fs.writeFileSync(path.join(scheduleTree, 'package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/frame.js'), [
  'export const pace = () => 1;',
  'export const turnMs = () => 0;',
  'export const isPaused = () => false;',
  'export const wait = () => new Promise(resolve => globalThis.scheduleWorld.waits.push(resolve));',
].join('\n') + '\n');
fs.mkdirSync(path.join(scheduleTree, 'dashboard/core'), { recursive: true });
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/panels.js'), [
  'export function buildPage(id) {',
  "  globalThis.scheduleWorld.log.push('build ' + id);",
  '  return { id: id, element: {} };',
  '}',
  'export const canShow = id => globalThis.scheduleWorld.canShow(id);',
  'export const moduleOf = () => null;',
  'export const regionOf = id => globalThis.scheduleWorld.regions[id] || null;',
  'export const topicOf = () => null;',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/photos.js'), 'export const ownSeconds = () => 0;\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/layout.js'), [
  'export const hasRegion = (layout, region) => globalThis.scheduleWorld.has[region] !== false;',
  "export const layoutNow = () => 'standard';",
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/areas.js'), [
  'export async function changePage(region, page) {',
  '  const world = globalThis.scheduleWorld;',
  "  world.log.push(region + ' ' + (page ? page.id : 'none'));",
  '  return 0;',
  '}',
  'export function clearRegion(region) {',
  "  globalThis.scheduleWorld.log.push('clear ' + region);",
  '}',
].join('\n') + '\n');
let scheduleRuns = 0;

async function inRotation(run) {
  const world = { log: [], waits: [], has: {}, canShow: () => true, regions: { a: 'grid1', d: 'grid2' } };
  globalThis.scheduleWorld = world;

  try {
    scheduleRuns += 1;
    world.module = await import(pathToFileURL(path.join(scheduleTree, 'dashboard/core/schedule.js')).href + '?run=' + scheduleRuns);
    world.content = { settings: { pageSeconds: 20, rotation: {} } };
    world.settle = async () => {
      for (let turn = 0; turn < 8; turn++) await new Promise(resolve => setImmediate(resolve));
    };
    // lets every wait go, a quarter of a second at a time, until this many seconds have passed
    world.pass = async count => {
      for (let quarter = 0; quarter < count * 4; quarter++) {
        world.waits.splice(0).forEach(resolve => resolve());
        await world.settle();
      }
    };
    world.pagesOf = region => world.log.filter(line => line.startsWith(region + ' ')).map(line => line.slice(region.length + 1));
    await run(world);
  } finally {
    delete globalThis.scheduleWorld;
  }
}

const steps = ids => ids.map(panel => ({ panel: panel, show: true }));

test('the list of the small frame waits while the layout has no small frame, and wakes at once when it is asked to move on', async () => {
  await inRotation(async world => {
    world.has.grid2 = false;
    world.module.startRotationForLayouts('grid2', () => steps(['d']), () => world.content);
    await world.settle();
    await world.pass(30);
    assert.deepEqual(world.pagesOf('grid2'), [], 'no page is chosen for a region the layout has not got');
    assert.deepEqual(world.log.filter(line => line.startsWith('build')), []);

    world.module.moveOn(['grid2']); // the swap asks, so that the first page is at the gate when the layout changes
    await world.settle();
    world.waits.splice(0).forEach(resolve => resolve());
    await world.settle();
    assert.deepEqual(world.pagesOf('grid2'), ['d'], 'the page is chosen at the first quarter of a second');
  });
});

test('the list of the small frame starts by itself when the layout gets the region, with no ask', async () => {
  await inRotation(async world => {
    world.has.grid2 = false;
    world.module.startRotationForLayouts('grid2', () => steps(['d']), () => world.content);
    await world.settle();
    await world.pass(10);
    assert.deepEqual(world.pagesOf('grid2'), []);

    world.has.grid2 = true;
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid2'), ['d']);
  });
});

test('an ask that wakes the list from its stay is not lost when the layout has no small frame any more', async () => {
  await inRotation(async world => {
    world.module.startRotationForLayouts('grid2', () => steps(['d']), () => world.content);
    await world.settle();
    await world.pass(2);
    assert.deepEqual(world.pagesOf('grid2'), ['d'], 'the page is on screen and the list is in its stay');

    // the look that is about to go on has no small frame, and the swap asks the region to move on, in the same moment
    world.has.grid2 = false;
    world.module.moveOn(['grid2']);
    await world.pass(1);
    assert.deepEqual(world.pagesOf('grid2'), ['d', 'd'], 'the list chose its next page, which waits at the gate and is dropped there');

    await world.pass(30);
    assert.deepEqual(world.pagesOf('grid2'), ['d', 'd'], 'and then waits, with the layout that has no small frame');
  });
});

test('a list with nothing to show ends its wait when it is asked to move on, so the swap does not wait for it', async () => {
  await inRotation(async world => {
    world.canShow = () => false;
    world.module.startRotationForLayouts('grid2', () => steps(['d']), () => world.content);
    await world.settle();
    await world.pass(1);
    const before = world.pagesOf('grid2').length;
    assert.ok(before >= 1, 'it asked the area for an empty region');

    world.waits.splice(0).forEach(resolve => resolve());
    await world.settle();
    assert.equal(world.pagesOf('grid2').length, before, 'a tenth of a second later it is still waiting');

    world.module.moveOn(['grid2']);
    world.waits.splice(0).forEach(resolve => resolve());
    await world.settle();
    assert.equal(world.pagesOf('grid2').length, before + 1, 'and it is back at the gate at the next step of its wait');
  });
});

test('startRotation still starts nothing for a region the layout has not got, and the large panel is not changed', async () => {
  await inRotation(async world => {
    world.has.grid2 = false;
    world.module.startRotation('grid2', () => steps(['d']), () => world.content);
    await world.settle();
    await world.pass(30);
    world.module.moveOn(['grid2']);
    await world.pass(3);
    assert.deepEqual(world.pagesOf('grid2'), []);

    world.module.startRotation('grid1', () => steps(['a']), () => world.content);
    await world.settle();
    assert.deepEqual(world.pagesOf('grid1'), ['a']);
  });
});


// The Screen of each day

test('the Screen of the day changes once a day, at midnight, and follows the weekday in the time zone of the Look page', async () => {
  const screens = await import(urlOf(areaTree, 'core/screens.js'));
  const zone = 'America/New_York';
  const at = text => new Date(text);

  // two moments of every day, a second after midnight and a second before the next one, in the time zone of the kiosk
  const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
  const styles = days.map(day => {
    const early = screens.screenStyleFor(undefined, zone, at(day + 'T00:00:01-04:00'));
    const late = screens.screenStyleFor(undefined, zone, at(day + 'T23:59:59-04:00'));
    assert.equal(early, late, day + ' has one Screen from its first second to its last');
    return early;
  });
  assert.deepEqual(styles, ['original', 'cybertron', 'original', 'cybertron', 'original', 'cybertron', 'original'], 'Monday to Sunday');
  assert.equal(screens.screenStyleFor(undefined, zone, at('2026-10-12T23:59:59-04:00')) === screens.screenStyleFor(undefined, zone, at('2026-10-13T00:00:00-04:00')), false, 'the Screen changes at midnight');

  // a screen in another time zone than the kiosk's has the same Screen at the same moment, because the day is the Look page's
  assert.equal(screens.weekdayIn(zone, at('2026-10-13T03:30:00Z')), screens.weekdayIn(zone, at('2026-10-12T23:30:00-04:00')), 'the day is counted in the time zone of the Look page');
});


// The page side

test('the page does not reload for a change of look: only a layout change that failed does, in core/layout-apply.js', () => {
  ['core/swap-run.js', 'core/swap-plan.js', 'core/views-run.js', 'core/areas.js', 'core/schedule.js', 'core/theme-apply.js'].forEach(file => {
    assert.ok(!/location\.reload/.test(withoutComments(read(file))), file + ' does not reload the page');
  });
  const apply = withoutComments(read('core/layout-apply.js'));
  assert.equal((apply.match(/location\.reload\(\)/g) || []).length, 1, 'the one reload is the fallback');
  assert.ok(/function reloadFor\(wanted, onPage, look\) \{\s*if \(!mustReload\(onPage, wanted, savedStorage\(\)\)\)/.test(apply), 'and it asks the guard first');
  assert.ok(apply.includes('const wanted = drawnFor(wantedLayout, shapesFor(look.style, wantedLayout));'), 'the layout is worked out as it always was');
});

test('shell.js puts the layout on in the step that puts the look on, before the style, and keeps the swap in charge of when', () => {
  const shell = read('shell.js');
  assert.ok(/function showDecorations\(look\) \{\s*useLayout\(look\);\s*useStyle\(look\);/.test(shell), 'the layout, then the style, in one step');
  const body = /function useLayout\(look\) \{([\s\S]*?)\n\}/.exec(shell)[1];
  assert.ok(body.indexOf('changeLayout(look)') !== -1 && body.indexOf('changeLayout(look)') < body.indexOf('redrawFrames();') && body.indexOf('redrawFrames();') < body.indexOf('drawWhatStays();'), 'the layout, the frames, then the panels that stay');
  assert.ok(body.includes('catch'), 'a problem never stops the colors');
  assert.ok(/holdLooksFor\(\(look, waitedMs\) => holdForLayout\(look, takeoverRunning, waitedMs, \(\) => !stayStarted \|\| swapIsPlaying\(\)\)\);/.test(shell), 'a look with another layout goes on when a swap has the screen, or before anything is drawn');
  assert.ok(shell.includes("startOptional('./core/swap-run.js', module => { swapIsPlaying = module.swapRunning; });"));
  assert.ok(shell.includes("startRotationForLayouts('grid2', () => withStandIns(withPages(viewSidePlaylist(content))), getContent);"), 'the small frame has its list in every layout, with its spares and its last resort');
  assert.ok(shell.includes("['banner', 'countdown', 'column'].forEach(region => { document.getElementById('region-' + region).innerHTML = ''; });"), 'the panels of the old layout are taken away');
  assert.ok(/fixedPanels\(layoutNow\(\)\)\.forEach\(id => showFixedPanel\(id, false\)\);\n\}/.test(shell), 'and the panels of the new one are drawn');
});

test('the Screens take the Monday style as one a page can always show while its layout changes live', () => {
  const run = read('core/views-run.js');
  assert.ok(run.includes("import { layoutsChangeLive } from './layout-apply.js';"));
  assert.ok(run.includes('if (wanted === onPage || layoutsChangeLive()) return true;'));
  assert.ok(run.includes('window.sessionStorage.getItem(reloadKey) !== wanted'), 'the old answer is still there for a page whose change has failed');
});

test('the swap keeps to transform and opacity, and the plan has no page in it', () => {
  const run = withoutComments(read('core/swap-run.js'));
  const frames = [...run.matchAll(/\.animate\(\s*\[([^\]]*)\]/g)].map(match => match[1]);
  assert.ok(frames.length >= 8, 'the animations were found');
  frames.forEach(text => assert.ok(!/(filter|blur|box-shadow|text-shadow|color|background|width|height|left|top)\s*:/.test(text), 'only transform and opacity move: ' + text));
  assert.ok(!/\bdocument\b|\bwindow\b/.test(withoutComments(read('core/swap-plan.js'))), 'the plan has no page in it');
});

test('the docs say how the swap goes now: one gesture, no reload, the layout changed in the page, calm and no motion', () => {
  const layouts = fs.readFileSync(path.join(root, 'docs/layouts.md'), 'utf8').replace(/\s+/g, ' ');
  ['one gesture', 'the page does not reload', 'changeLayout', 'In **calm** motion', 'With motion **off**', 'up to 8 seconds', 'startRotationForLayouts', 'destinationsOf', 'swap-smooth.test.mjs'].forEach(word => assert.ok(layouts.includes(word), 'layouts.md names ' + word));
  assert.ok(!/A change of layout[^.]* reloads/.test(layouts), 'and no longer says that a change of layout reloads the page');
  assert.ok(!/cannot be drawn in the page that is on screen/.test(layouts));
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
