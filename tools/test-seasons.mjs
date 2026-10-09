// Tests for the seasonal packs: how a pack is chosen, loaded and drawn
// (dashboard/core/season.js, with a fake page), what happens when a pack is
// missing, broken or slow, the zones, and that tools/check-seasons.mjs really
// fails for each kind of mistake. Nothing touches the network or a browser.
//
//   node tools/test-seasons.mjs
//
// What a pack looks like to the eye is checked by looking at the screen
// (docs/seasonal-packs.md, "Looking at a pack").

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(root, 'dashboard');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-seasons-'));

function copyInto(folder, from, to) {
  fs.mkdirSync(path.dirname(path.join(folder, to)), { recursive: true });
  fs.copyFileSync(path.join(root, from), path.join(folder, to));
}

// A tree with just the files the layer and the check read
function makeTree(folder) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'package.json'), '{ "type": "module" }\n');
  ['dashboard/core/season.js', 'dashboard/core/marks.js', 'dashboard/core/corner-art.js', 'dashboard/core/pack-extras.js', 'dashboard/base.css', 'dashboard/themes/overlays/registry.js', 'dashboard/index.html', 'tools/check-seasons.mjs', 'docs/seasonal-packs.md'].forEach(file => copyInto(folder, file, file));
  fs.readdirSync(path.join(dashboardFolder, 'seasons')).forEach(name => copyInto(folder, 'dashboard/seasons/' + name, 'dashboard/seasons/' + name));
}

const mainTree = path.join(workFolder, 'main');
makeTree(mainTree);

const base = pathToFileURL(path.join(mainTree, 'dashboard')).href + '/';
const season = await import(base + 'core/season.js');
const { overlays } = await import(base + 'themes/overlays/registry.js');
const { zones, motions, hasDecorations, pieceProblems, packProblems, layersMarkup, pieceMarkup, loadPack } = season;
const { overMotions, markProblems, cornerPlaces, cornerArtPieceMarkup } = season;
const marks = await import(base + 'core/marks.js');
const cornerArt = await import(base + 'core/corner-art.js');
const packExtras = await import(base + 'core/pack-extras.js');

const packIds = ['halloween', 'thanksgiving', 'christmas', 'new-years', 'valentines-day', 'competition-day', 'summer-break'];
const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

// A small pack that uses only what is in the lists

const shapes = {
  flake: { viewBox: '0 0 24 24', markup: '<polygon points="12,0 24,12 12,24 0,12"/>' },
  wide: { viewBox: '0 0 100 20', markup: '<rect width="100" height="20"/>' },
};

function makePack(extra) {
  return Object.assign({
    shapes: shapes,
    scene: { viewBox: '0 0 ' + zones.ground.width + ' ' + zones.ground.height, markup: '<rect width="1920" height="22"/>' },
    back: [{ shape: 'flake', x: 100, y: 200, size: 24, motion: 'fall', seconds: 20, delay: -5, travel: 900, opacity: 0.5 }],
    front: [
      { zone: 'left', shape: 'flake', x: 4, y: 40, size: 12, motion: 'fall', seconds: 15 },
      { zone: 'top', shape: 'wide', x: 0, y: 0, size: 100 },
    ],
  }, extra);
}

// Which pack is chosen

test('the seven packs are listed and say they have decorations, and the example does not', () => {
  packIds.forEach(id => assert.equal(hasDecorations(id), true, id));
  assert.equal(overlays.filter(overlay => overlay.decorations === true).length, 7);
  assert.equal(hasDecorations('example'), false);
  assert.equal(hasDecorations(''), false);
  assert.equal(hasDecorations('no-such-pack'), false);
  assert.equal(hasDecorations(undefined), false);
  assert.equal(hasDecorations(null), false);
});

test('the zones are the ones the packs may use, and every zone is a rectangle of the screen', () => {
  ['top', 'ground', 'left', 'right', 'gutter', 'string-a', 'string-b', 'corner-a', 'corner-b'].forEach(name => assert.ok(zones[name], 'zone ' + name));
  Object.keys(zones).forEach(name => {
    const zone = zones[name];
    assert.ok(zone.width > 0 && zone.height > 0 && zone.x >= 0 && zone.y >= 0 && zone.x + zone.width <= 1920 && zone.y + zone.height <= 1080, name + ' is on the screen');
  });
  assert.ok(zones.ground.y + zones.ground.height === 1080, 'the ground is the bottom edge');
  assert.ok(zones.ground.height >= 20, 'the strip under the ticker is at least 20 px');
  assert.ok(zones.ground.y >= 1053, 'the ticker text is cut off at y 1052, so the ground starts below it');
});

// The data format

test('a good pack has no problems, and an empty one is fine', () => {
  assert.deepEqual(packProblems(makePack()), []);
  assert.deepEqual(packProblems({ shapes: {}, scene: null, back: [], front: [] }), []);
  assert.deepEqual(packProblems({}), []);
});

test('every kind of mistake in a piece is named in plain words', () => {
  const front = piece => pieceProblems(Object.assign({ zone: 'left', shape: 'flake', x: 4, y: 40, size: 12 }, piece), 'front', shapes);

  assert.deepEqual(front({}), []);
  assert.match(front({ zone: 'nowhere' }).join(), /zone "nowhere"/);
  assert.match(front({ zone: undefined }).join(), /zone "undefined"/);
  assert.match(front({ shape: 'missing' }).join(), /shape "missing"/);
  assert.match(front({ motion: 'wobble', seconds: 5 }).join(), /motion "wobble"/);
  assert.match(front({ motion: 'fall' }).join(), /needs seconds/);
  assert.match(front({ motion: 'fall', seconds: 0.2 }).join(), /needs seconds/);
  assert.match(front({ seconds: 5 }).join(), /no motion/);
  assert.match(front({ secs: 5 }).join(), /"secs"/);
  assert.match(front({ x: 'left' }).join(), /x should be a number/);
  assert.match(front({ size: 0 }).join(), /size should be more than 0/);
  assert.match(front({ opacity: 2 }).join(), /opacity/);
  assert.match(front({ delay: 'soon', motion: 'fall', seconds: 5 }).join(), /delay/);
  assert.match(front({ travel: -1, motion: 'fall', seconds: 5 }).join(), /travel/);
  assert.match(pieceProblems(null, 'front', shapes).join(), /not a piece/);
});

test('a piece must fit its zone when it rests, and a back piece must fit the screen', () => {
  // the left zone is 30 wide and a little under 700 high
  const low = zones.left.height - 24;
  assert.deepEqual(pieceProblems({ zone: 'left', shape: 'flake', x: 6, y: low, size: 24 }, 'front', shapes), []);
  assert.match(pieceProblems({ zone: 'left', shape: 'flake', x: 7, y: 40, size: 24 }, 'front', shapes).join(), /does not fit at rest/);
  assert.match(pieceProblems({ zone: 'left', shape: 'flake', x: 4, y: low + 1, size: 24 }, 'front', shapes).join(), /does not fit at rest/);
  assert.match(pieceProblems({ zone: 'left', shape: 'flake', x: -1, y: 40, size: 12 }, 'front', shapes).join(), /does not fit at rest/);
  // the height follows the shape: 100 wide and 20 high, so 50 wide is 10 high
  assert.deepEqual(pieceProblems({ zone: 'top', shape: 'wide', x: 0, y: 16, size: 50 }, 'front', shapes), []);
  assert.match(pieceProblems({ zone: 'top', shape: 'wide', x: 0, y: 17, size: 50 }, 'front', shapes).join(), /does not fit at rest/);

  assert.deepEqual(pieceProblems({ shape: 'flake', x: 1896, y: 1056, size: 24 }, 'back', shapes), []);
  assert.match(pieceProblems({ shape: 'flake', x: 1900, y: 100, size: 24 }, 'back', shapes).join(), /does not fit at rest/);
  assert.match(pieceProblems({ zone: 'top', shape: 'flake', x: 0, y: 0, size: 12 }, 'back', shapes).join(), /no zone/);
});

test('a pack with too many pieces, a wrong scene or an unknown part is refused', () => {
  const many = count => Array.from({ length: count }, (item, index) => ({ zone: 'left', shape: 'flake', x: 4, y: 10 + index * 10, size: 10, motion: 'twinkle', seconds: 3 }));

  assert.deepEqual(packProblems(makePack({ back: [], front: many(season.mostMovingPieces) })), []);
  assert.match(packProblems(makePack({ back: [], front: many(season.mostMovingPieces + 1) })).join(), /pieces that move/);
  assert.match(packProblems(makePack({ front: many(season.mostMovingPieces) })).join(), /pieces that move/, 'the back layer counts too');
  const still = Array.from({ length: season.mostPieces + 1 }, (item, index) => ({ zone: 'left', shape: 'flake', x: 4, y: 10 + (index % 60) * 10, size: 10 }));
  assert.match(packProblems(makePack({ front: still })).join(), /the most is 60/);

  assert.match(packProblems(makePack({ scene: { viewBox: '0 0 1000 1000', markup: '<rect/>' } })).join(), /stretched/);
  assert.match(packProblems(makePack({ scene: 'sea' })).join(), /scene/);
  assert.match(packProblems(makePack({ sceen: null })).join(), /"sceen"/);
  assert.match(packProblems(makePack({ shapes: { Bad: shapes.flake } })).join(), /shape name "Bad"/);
  assert.match(packProblems(makePack({ shapes: { flake: { viewBox: '0 0 0 0', markup: '<rect/>' } } })).join(), /viewBox/);
  assert.match(packProblems('a pack').join(), /should be an object/);
});

// Drawing

test('a piece is drawn with its place, its size, its motion and its timing', () => {
  const piece = { shape: 'wide', x: 10, y: 6, size: 50, motion: 'sway', seconds: 5, delay: -1.5, travel: 40, opacity: 0.5 };
  const html = pieceMarkup(piece, shapes);

  assert.ok(html.includes('left: 10px; top: 6px; width: 50px; height: 10px;'), 'the height keeps the proportions of the shape');
  assert.ok(html.includes('data-move="sway"') && html.includes('--seconds: 5;') && html.includes('--delay: -1.5;') && html.includes('--travel: 40px;'));
  assert.ok(html.includes('style="opacity: 0.5"'), 'the opacity is on the picture inside, not on the moving piece');
  assert.ok(html.includes('href="#season-shape-wide"'));

  const still = pieceMarkup({ shape: 'flake', x: 0, y: 0, size: 12 }, shapes);
  assert.ok(!still.includes('data-move') && !still.includes('--seconds'), 'a piece with no motion has none');
});

test('the layers hold the pieces in their zones, and the scene is in the ground zone', () => {
  const drawn = layersMarkup(makePack());

  assert.equal(drawn.empty, false);
  assert.deepEqual(drawn.skipped, []);
  assert.ok(drawn.back.includes('<symbol id="season-shape-flake"') && drawn.back.includes('<symbol id="season-shape-wide"'), 'the shapes are drawn once, in the back layer');
  assert.equal((drawn.back.match(/season-piece/g) || []).length, 1);

  const left = zones.left;
  assert.ok(drawn.front.includes('data-zone="left" style="left: ' + left.x + 'px; top: ' + left.y + 'px; width: ' + left.width + 'px; height: ' + left.height + 'px;"'));
  assert.ok(drawn.front.includes('data-zone="top"') && drawn.front.includes('data-zone="ground"'));
  assert.ok(!drawn.front.includes('data-zone="right"'), 'a zone with nothing in it is not drawn');
  assert.ok(drawn.front.indexOf('data-zone="top"') < drawn.front.indexOf('data-zone="ground"') && drawn.front.indexOf('data-zone="ground"') < drawn.front.indexOf('data-zone="left"'), 'the zones follow the order of the list');
  assert.ok(drawn.front.includes('class="season-scene"'));
});

test('a piece with a problem is left out and the rest are drawn', () => {
  const drawn = layersMarkup(makePack({
    front: [
      { zone: 'nowhere', shape: 'flake', x: 0, y: 0, size: 10 },
      { zone: 'left', shape: 'flake', x: 4, y: 40, size: 12 },
      { zone: 'left', shape: 'flake', x: 4, y: 90, size: 99 },
    ],
  }));

  assert.equal(drawn.skipped.length, 2);
  assert.match(drawn.skipped[0], /^front piece 1 .*zone "nowhere"/);
  assert.match(drawn.skipped[1], /^front piece 3 .*does not fit/);
  assert.equal((drawn.front.match(/season-piece/g) || []).length, 1);
});

test('an empty pack draws nothing, and a pack with only a scene draws the scene', () => {
  assert.equal(layersMarkup({ shapes: {}, scene: null, back: [], front: [] }).empty, true);
  assert.equal(layersMarkup({}).empty, true);

  const onlyScene = layersMarkup({ scene: { viewBox: '0 0 1920 22', markup: '<rect/>' } });
  assert.equal(onlyScene.empty, false);
  assert.ok(onlyScene.front.includes('season-scene'));
});

// Loading

test('a pack is read from its file once, and a failure is tried again next time', async () => {
  let reads = 0;
  const good = path => { reads += 1; assert.equal(path, '../seasons/halloween.js'); return Promise.resolve({ pack: makePack() }); };

  const first = await loadPack('halloween', good);
  const second = await loadPack('halloween', good);
  assert.equal(reads, 1);
  assert.equal(first, second);

  let tries = 0;
  const flaky = () => { tries += 1; return tries === 1 ? Promise.reject(new Error('no file')) : Promise.resolve({ pack: makePack() }); };
  await assert.rejects(loadPack('thanksgiving', flaky), /no file/);
  assert.ok(await loadPack('thanksgiving', flaky));
  assert.equal(tries, 2);

  await assert.rejects(loadPack('christmas', () => Promise.resolve({})), /should export a pack/);
  await assert.rejects(loadPack('christmas', () => Promise.resolve({ pack: 'text' })), /should export a pack/);
  await assert.rejects(loadPack('example', good), /no decorations/);
  await assert.rejects(loadPack('no-such-pack', good), /no decorations/);
});

// The page

// Just enough of a page for the layer: #world holds #backdrop, #stage and #red-wash, in that order
function makePage(parts) {
  function element(id) {
    const node = {
      id: id || '',
      className: '',
      innerHTML: '',
      parent: null,
      remove() {
        if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
        this.parent = null;
      },
      get nextSibling() {
        const list = this.parent ? this.parent.children : [];
        return list[list.indexOf(this) + 1] || null;
      },
      insertBefore(child, before) {
        child.remove();
        const index = before ? this.children.indexOf(before) : this.children.length;
        this.children.splice(index, 0, child);
        child.parent = this;
        return child;
      },
      children: [],
    };
    return node;
  }

  const world = element('world');
  const kept = parts === undefined ? ['backdrop', 'stage', 'red-wash'] : parts;
  kept.forEach(id => world.insertBefore(element(id), null));

  return {
    world: world,
    order: () => world.children.map(child => child.id),
    getElementById: id => (id === 'world' ? world : world.children.filter(child => child.id === id)[0] || null),
    createElement: () => element(),
  };
}

let instance = 0;

async function onPage(run, parts) {
  const real = globalThis.document;
  const realError = console.error;
  const page = makePage(parts);
  const logged = [];

  // A new copy of the module for each test, because it remembers the packs it has loaded and what is on the page
  instance += 1;
  const fresh = await import(base + 'core/season.js?test=' + instance);

  globalThis.document = page;
  console.error = (...items) => logged.push(items.map(String).join(' '));
  try {
    await run(page, logged, fresh);
  } finally {
    console.error = realError;
    if (real === undefined) delete globalThis.document;
    else globalThis.document = real;
  }
}

const importPack = pack => () => Promise.resolve({ pack: pack });

test('a pack goes in as two layers: the back one before the backdrop, the front one right after the stage', async () => {
  await onPage(async (page, logged, season) => {
    await season.showSeason('halloween', importPack(makePack()));

    assert.deepEqual(page.order(), ['season-back', 'backdrop', 'stage', 'season-front', 'red-wash']);
    assert.equal(season.seasonShown(), 'halloween');

    const back = page.getElementById('season-back');
    const front = page.getElementById('season-front');
    assert.ok(back.className.split(' ').indexOf('season-layer') !== -1 && back.className.split(' ').indexOf('season-back') !== -1);
    assert.ok(front.className.split(' ').indexOf('season-front') !== -1);
    assert.ok(back.innerHTML.includes('season-piece') && front.innerHTML.includes('data-zone="left"'));
  });
});

test('another overlay replaces both layers in one step, and the same overlay again changes nothing', async () => {
  await onPage(async (page, logged, season) => {
    await season.showSeason('halloween', importPack(makePack()));
    const firstBack = page.getElementById('season-back');

    await season.showSeason('halloween', importPack(makePack()));
    assert.equal(page.getElementById('season-back'), firstBack, 'the same pack is not drawn again');

    await season.showSeason('thanksgiving', importPack(makePack({ back: [] })));
    assert.deepEqual(page.order(), ['season-back', 'backdrop', 'stage', 'season-front', 'red-wash']);
    assert.notEqual(page.getElementById('season-back'), firstBack);
    assert.ok(!page.getElementById('season-back').innerHTML.includes('season-piece'));
    assert.equal(season.seasonShown(), 'thanksgiving');
  });
});

test('with no overlay, or one that has no decorations, the layers are gone completely', async () => {
  await onPage(async (page, logged, season) => {
    await season.showSeason('halloween', importPack(makePack()));
    await season.showSeason('', importPack(makePack()));
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash']);
    assert.equal(season.seasonShown(), '');

    await season.showSeason('halloween', importPack(makePack()));
    await season.showSeason('example', importPack(makePack()));
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash'], 'the example overlay has no decorations');

    await season.showSeason('no-such-pack', importPack(makePack()));
    await season.showSeason(undefined, importPack(makePack()));
    await season.showSeason(42, importPack(makePack()));
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash']);
  });
});

test('a pack that cannot be loaded is logged, takes the old layers away and breaks nothing', async () => {
  await onPage(async (page, logged, season) => {
    await season.showSeason('halloween', importPack(makePack()));
    await assert.doesNotReject(season.showSeason('thanksgiving', () => Promise.reject(new Error('Failed to fetch'))));

    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash'], 'the old pack is not the right one any more, so it goes');
    assert.ok(logged.some(line => /thanksgiving/.test(line) && /Failed to fetch/.test(line)));

    await assert.doesNotReject(season.showSeason('christmas', () => Promise.resolve({ pack: null })));
    await assert.doesNotReject(season.showSeason('christmas', () => { throw new Error('a syntax error in the pack'); }));
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash']);
  });
});

test('a page without the layers it needs is logged, and a pack that is empty or half wrong still goes in', async () => {
  await onPage(async (page, logged, season) => {
    await assert.doesNotReject(season.showSeason('halloween', importPack(makePack())));
    assert.ok(logged.some(line => /#stage/.test(line)));
    assert.deepEqual(page.order(), ['backdrop']);
  }, ['backdrop']);

  await onPage(async (page, logged, season) => {
    await season.showSeason('halloween', importPack({ shapes: {}, scene: null, back: [], front: [] }));
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash'], 'an empty pack puts nothing on the page');
    assert.equal(season.seasonShown(), 'halloween');
    assert.deepEqual(logged, []);

    await season.showSeason('thanksgiving', importPack(makePack({ front: [{ zone: 'nowhere', shape: 'flake', x: 0, y: 0, size: 5 }] })));
    assert.deepEqual(page.order(), ['season-back', 'backdrop', 'stage', 'season-front', 'red-wash'], 'the good pieces are drawn');
    assert.equal(logged.length, 1);
    assert.match(logged[0], /thanksgiving pack: the front piece 1/);
  });
});

test('a slow load never lands after a newer ask', async () => {
  await onPage(async (page, logged, season) => {
    let release = null;
    const slow = () => new Promise(resolve => { release = () => resolve({ pack: makePack() }); });

    const waiting = season.showSeason('halloween', slow);
    await season.showSeason('', null); // the look changed to no overlay while the pack was loading
    release();
    await waiting;
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash'], 'the late pack is dropped');

    const first = season.showSeason('halloween', slow);
    const releaseFirst = release;
    const second = season.showSeason('thanksgiving', importPack(makePack({ back: [] })));
    await second;
    releaseFirst();
    await first;
    assert.equal(season.seasonShown(), 'thanksgiving', 'the newer ask wins');
  });
});

// The real packs

test('every pack in the registry loads from its file and draws, and the Christmas pack is full', async () => {
  const folder = pathToFileURL(path.join(mainTree, 'dashboard', 'seasons')).href + '/';

  for (const id of packIds) {
    const { pack } = await import(folder + id + '.js');
    assert.deepEqual(packProblems(pack), [], id + ' has problems');
    assert.deepEqual(layersMarkup(pack).skipped, [], id + ' leaves pieces out');
  }

  const { pack } = await import(folder + 'christmas.js');
  const counts = season.countPieces(pack);
  const drawn = layersMarkup(pack);
  assert.ok(counts.moving > 15 && counts.moving <= season.mostMovingPieces, 'it moves ' + counts.moving + ' pieces');
  assert.equal(counts.over, 12, 'twelve snowflakes over the panels');
  ['top', 'ground', 'string-a', 'string-b', 'corner-a', 'corner-b'].forEach(zone => assert.ok(drawn.front.includes('data-zone="' + zone + '"'), 'something in the zone ' + zone));
  assert.ok(pack.scene && drawn.front.includes('season-scene'));
  assert.ok(pack.front.every(piece => piece.motion === undefined || motions.indexOf(piece.motion) !== -1));
});

// The header mark (core/marks.js, set by core/season.js)

const treeMark = { viewBox: '0 0 60 76', markup: '<polygon points="30,0 60,76 0,76"/>' };
const slashes = /class="double-slash" viewBox="0 0 70 94" width="54" height="72"/;

test('doubleSlash draws the slashes, then the mark of a pack at the right size, then the slashes again', () => {
  try {
    marks.setPackMark(null);
    assert.match(marks.doubleSlash(), slashes);

    marks.setPackMark(treeMark);
    const html = marks.doubleSlash();
    assert.ok(html.includes('class="pack-mark"') && html.includes('viewBox="0 0 60 76" width="60" height="76"') && html.includes(treeMark.markup));
    assert.ok(!html.includes('class="double-slash"'), 'the svg is not the slashes, so base.css does not paint all of it one colour');

    // with no size given it is the biggest that fits the box and keeps the proportions of the viewBox
    marks.setPackMark({ viewBox: '0 0 100 50', markup: '<rect/>' });
    assert.match(marks.doubleSlash(), /width="60" height="30"/);
    marks.setPackMark({ viewBox: '0 0 20 40', markup: '<rect/>' });
    assert.match(marks.doubleSlash(), /width="38" height="76"/);
    marks.setPackMark({ viewBox: '0 0 100 100', markup: '<rect/>', width: 40, height: 50 });
    assert.match(marks.doubleSlash(), /width="40" height="50"/);

    marks.setPackMark(null);
    assert.match(marks.doubleSlash(), slashes);
  } finally {
    marks.setPackMark(null);
  }
});

test('a mark that cannot be drawn, or is bigger than the box, leaves the slashes', () => {
  const bad = [
    null, undefined, 'a tree', {}, { viewBox: '0 0 60 76' }, { viewBox: '0 0 60 76', markup: '   ' },
    { viewBox: 'big', markup: '<rect/>' }, { viewBox: '0 0 0 0', markup: '<rect/>' },
    { viewBox: '0 0 60 76', markup: '<rect/>', width: 61, height: 76 },
    { viewBox: '0 0 60 76', markup: '<rect/>', width: 60, height: 77 },
    { viewBox: '0 0 60 76', markup: '<rect/>', width: 0, height: 10 },
  ];

  try {
    bad.forEach(mark => {
      marks.setPackMark(treeMark);
      marks.setPackMark(mark);
      assert.match(marks.doubleSlash(), slashes, JSON.stringify(mark));
    });
  } finally {
    marks.setPackMark(null);
  }
});

test('the box for a mark is 60 x 76, and every panel with a header mark draws it through doubleSlash', () => {
  assert.deepEqual(marks.markBox, { width: 60, height: 76 });

  // a panel that drew its own picture would keep the slashes while a pack is on
  ['tasks', 'events', 'photo', 'leadership', 'roster', 'tonight', 'spotlight', 'team-leads', 'sponsor-feature', 'custom'].forEach(name => {
    const code = fs.readFileSync(path.join(dashboardFolder, 'panels', name, name + '.js'), 'utf8');
    assert.ok(code.includes('import { doubleSlash') && code.includes('${doubleSlash()}'), name + ' should draw its mark with doubleSlash()');
    assert.ok(!code.includes('class="double-slash"'), name + ' should not draw the slashes itself');
  });
});

test('every kind of mistake in a mark is named in plain words', () => {
  const mark = extra => Object.assign({ viewBox: '0 0 60 76', markup: '<rect/>' }, extra);

  assert.deepEqual(markProblems(treeMark), []);
  assert.deepEqual(markProblems(mark({ viewBox: '0 0 100 50' })), [], 'a wide drawing is scaled down to fit');
  assert.deepEqual(markProblems(mark({ width: 60, height: 76 })), []);
  assert.deepEqual(markProblems(mark({ width: 30, height: 40 })), []);

  assert.match(markProblems('a tree').join(), /viewBox, markup/);
  assert.match(markProblems({ markup: '<rect/>' }).join(), /viewBox/);
  assert.match(markProblems({ viewBox: '0 0 60 76' }).join(), /no markup/);
  assert.match(markProblems(mark({ colour: 'red' })).join(), /"colour"/);
  assert.match(markProblems(mark({ width: 60 })).join(), /not both/);
  assert.match(markProblems(mark({ width: 0, height: 5 })).join(), /above 0/);
  assert.match(markProblems(mark({ width: 61, height: 76 })).join(), /is 61 by 76 pixels, and the box for a mark is 60 by 76/);
  assert.match(markProblems(mark({ width: 40, height: 77 })).join(), /is 40 by 77 pixels/);

  assert.deepEqual(packProblems(makePack({ mark: treeMark })), []);
  assert.match(packProblems(makePack({ mark: { viewBox: 'x', markup: '<rect/>' } })).join(), /the mark has a viewBox/);
  assert.match(packProblems(makePack({ mark: 'tree' })).join(), /the mark should be/);
});

test('a pack puts its mark in the headers when it goes on, and the slashes come back when the pack goes', async () => {
  await onPage(async (page, logged, season) => {
    try {
      await season.showSeason('halloween', importPack(makePack({ mark: treeMark })));
      assert.ok(marks.doubleSlash().includes('class="pack-mark"'));

      await season.showSeason('thanksgiving', importPack(makePack()));
      assert.match(marks.doubleSlash(), slashes, 'another pack with no mark');

      await season.showSeason('halloween', importPack(makePack({ mark: treeMark })));
      assert.ok(marks.doubleSlash().includes('class="pack-mark"'));
      await season.showSeason('', null);
      assert.match(marks.doubleSlash(), slashes, 'no overlay');

      await season.showSeason('halloween', importPack(makePack({ mark: treeMark })));
      await season.showSeason('example', importPack(makePack({ mark: treeMark })));
      assert.match(marks.doubleSlash(), slashes, 'an overlay with no decorations');

      await season.showSeason('halloween', importPack(makePack({ mark: treeMark })));
      await season.showSeason('christmas', () => Promise.reject(new Error('Failed to fetch')));
      assert.match(marks.doubleSlash(), slashes, 'a pack that cannot be loaded takes the old mark away');
    } finally {
      marks.setPackMark(null);
    }
  });
});

test('a pack with only a mark still changes the headers, and a mark with a mistake is logged and left out', async () => {
  await onPage(async (page, logged, season) => {
    try {
      await season.showSeason('halloween', importPack({ mark: treeMark }));
      assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash'], 'a pack with nothing to draw adds nothing to the page');
      assert.ok(marks.doubleSlash().includes('class="pack-mark"'));
      assert.deepEqual(logged, []);

      await season.showSeason('thanksgiving', importPack(makePack({ mark: { viewBox: '0 0 60 76', markup: '<rect/>', width: 90, height: 90 } })));
      assert.match(marks.doubleSlash(), slashes);
      assert.equal(logged.length, 1);
      assert.match(logged[0], /thanksgiving pack: the mark is 90 by 90 pixels/);
      assert.deepEqual(page.order(), ['season-back', 'backdrop', 'stage', 'season-front', 'red-wash'], 'the rest of the pack is drawn');
    } finally {
      marks.setPackMark(null);
    }
  });
});

// The over layer

// A flake of the test shapes that obeys every rule of the over layer
function flakes(count, extra) {
  return Array.from({ length: count }, (item, index) => Object.assign({ shape: 'flake', x: 100 + index * 100, y: 500, size: 24, opacity: 0.6, motion: 'flutter', seconds: 30, delay: -index, travel: 1300 }, extra));
}

test('a piece of the over layer is held to the rules of the layer: small, faint, slow and moving', () => {
  const over = piece => pieceProblems(Object.assign({ shape: 'flake', x: 100, y: 500, size: 24, opacity: 0.6, motion: 'flutter', seconds: 30 }, piece), 'over', shapes);

  assert.deepEqual(over({}), []);

  // size 18 to 44
  assert.match(over({ size: 17 }).join(), /is 17 px wide, and the over layer allows 18 to 44/);
  assert.match(over({ size: 45 }).join(), /is 45 px wide/);
  assert.deepEqual(over({ size: 18 }), []);
  assert.deepEqual(over({ size: 44 }), []);

  // opacity .85 at the most, and it has to be given
  assert.match(over({ opacity: 0.86 }).join(), /opacity of 0.85 or less/);
  assert.match(over({ opacity: undefined }).join(), /opacity of 0.85 or less/);
  assert.deepEqual(over({ opacity: 0.85 }), []);

  // only the slow motions, and a piece has to move
  assert.match(over({ motion: undefined, seconds: undefined }).join(), /needs a motion/);
  ['bob', 'spin', 'pulse', 'draw', 'sweep', 'slide'].forEach(name => assert.match(over({ motion: name, seconds: 60 }).join(), /too quick for the over layer/, name));
  assert.match(over({ motion: 'wobble' }).join(), /motion "wobble"/);
  overMotions.forEach(name => assert.ok(motions.indexOf(name) !== -1, name + ' is a motion'));

  // the fewest seconds for a round
  ['fall', 'flutter', 'drift', 'rise'].forEach(name => {
    assert.match(over({ motion: name, seconds: 11.9 }).join(), /the least the over layer allows is 12/, name);
    assert.deepEqual(over({ motion: name, seconds: 12 }), [], name);
  });
  ['twinkle', 'sway'].forEach(name => {
    assert.match(over({ motion: name, seconds: 1.9 }).join(), /the least the over layer allows is 2/, name);
    assert.deepEqual(over({ motion: name, seconds: 2 }), [], name);
  });

  // x and y are screen pixels, and it has to fit the screen at rest
  assert.match(over({ x: 1900 }).join(), /does not fit at rest/);
  assert.match(over({ y: -5 }).join(), /does not fit at rest/);
  assert.match(over({ zone: 'left' }).join(), /no zone/);
});

test('a pack has at most 14 over pieces, and they count with the others towards the pieces that move', () => {
  assert.deepEqual(packProblems(makePack({ over: flakes(14) })), []);
  assert.match(packProblems(makePack({ over: flakes(15) })).join(), /15 over pieces, and the most is 14/);

  const front = Array.from({ length: 9 }, (item, index) => ({ zone: 'left', shape: 'flake', x: 4, y: 10 + index * 20, size: 12, motion: 'twinkle', seconds: 3 }));
  const crowded = makePack({ front: front, over: flakes(14) });
  assert.deepEqual(season.countPieces(crowded), { all: 24, moving: 24, over: 14 });
  assert.deepEqual(packProblems(crowded), []);
  assert.match(packProblems(makePack({ front: front.concat([front[0]]), over: flakes(14) })).join(), /25 pieces that move/);
});

test('an over piece with a mistake is left out and logged, and the rest are drawn', () => {
  const drawn = layersMarkup(makePack({
    over: flakes(3).concat([
      { shape: 'flake', x: 100, y: 500, size: 60, opacity: 0.5, motion: 'fall', seconds: 30 },
      { shape: 'flake', x: 100, y: 500, size: 24, opacity: 0.5, motion: 'fall', seconds: 5 },
    ]),
  }));

  assert.equal(drawn.skipped.length, 2);
  assert.match(drawn.skipped[0], /^over piece 4 .*60 px wide/);
  assert.match(drawn.skipped[1], /^over piece 5 .*the least the over layer allows is 12/);
  assert.equal((drawn.over.match(/season-piece/g) || []).length, 3);
  assert.ok(drawn.over.includes('data-move="flutter"') && !drawn.back.includes('data-move="flutter"'));
});

test('every layer that takes over the screen is after the stage in index.html, so the seasonal layers are under all of them', () => {
  const index = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const world = index.slice(index.indexOf('<div id="world">'), index.indexOf('<div id="crt">'));
  const ids = (world.match(/<div id="[a-z-]+"/g) || []).map(text => text.slice(9, -1)).filter(id => ['backdrop', 'stage', 'red-wash', 'blue-glitch', 'connection-status', 'night', 'overlay'].indexOf(id) !== -1);

  // season.js puts the front and over layers straight after #stage, and the back layer before #backdrop
  assert.deepEqual(ids, ['backdrop', 'stage', 'red-wash', 'blue-glitch', 'connection-status', 'night', 'overlay']);
  assert.ok(index.indexOf('<div id="crt">') > index.indexOf('<div id="overlay">'), 'the old television effect is over everything');
  assert.ok(!/id="season-/.test(index), 'the layers are added by the script');
});

test('the over layer goes in straight after the front layer, and shares the shapes of the back layer', async () => {
  await onPage(async (page, logged, season) => {
    await season.showSeason('halloween', importPack(makePack({ over: flakes(8) })));

    assert.deepEqual(page.order(), ['season-back', 'backdrop', 'stage', 'season-front', 'season-over', 'red-wash']);
    const over = page.getElementById('season-over');
    assert.ok(over.className.split(' ').indexOf('season-layer') !== -1 && over.className.split(' ').indexOf('season-over') !== -1);
    assert.equal((over.innerHTML.match(/season-piece/g) || []).length, 8);
    assert.ok(over.innerHTML.includes('data-move="flutter"') && over.innerHTML.includes('href="#season-shape-flake"'));
    assert.ok(page.getElementById('season-back').innerHTML.includes('<symbol id="season-shape-flake"'), 'the shapes are drawn once, in the back layer');
  });
});

test('a pack with no over list has no over layer, and a pack with only an over list is drawn', async () => {
  await onPage(async (page, logged, season) => {
    await season.showSeason('halloween', importPack(makePack()));
    assert.equal(page.getElementById('season-over'), null);

    await season.showSeason('thanksgiving', importPack({ shapes: shapes, over: flakes(8) }));
    assert.deepEqual(page.order(), ['season-back', 'backdrop', 'stage', 'season-front', 'season-over', 'red-wash']);

    await season.showSeason('christmas', importPack({ shapes: shapes, over: [] }));
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash'], 'a pack with no pieces at all draws nothing');
  });
});

test('the Look switch takes the over layer away and brings it back while the screen runs', async () => {
  await onPage(async (page, logged, season) => {
    const withOver = ['season-back', 'backdrop', 'stage', 'season-front', 'season-over', 'red-wash'];
    const without = ['season-back', 'backdrop', 'stage', 'season-front', 'red-wash'];

    await season.showSeason('halloween', importPack(makePack({ over: flakes(8) })));
    assert.deepEqual(page.order(), withOver, 'it starts on');

    season.setOverPanels(false);
    assert.deepEqual(page.order(), without, 'the rest of the pack stays');
    season.setOverPanels(false);
    assert.deepEqual(page.order(), without);

    season.setOverPanels(true);
    assert.deepEqual(page.order(), withOver);
    assert.equal((page.getElementById('season-over').innerHTML.match(/season-piece/g) || []).length, 8, 'the same pieces come back');

    // anything that is not a real false is on, like a missing value on the Look page
    [undefined, null, 0, '', 'off', 'false', {}].forEach(odd => {
      season.setOverPanels(false);
      season.setOverPanels(odd);
      assert.deepEqual(page.order(), withOver, JSON.stringify(odd));
    });
  });
});

test('the switch counts when it is set before the pack comes, and with no pack it draws nothing', async () => {
  await onPage(async (page, logged, season) => {
    season.setOverPanels(false);
    await season.showSeason('halloween', importPack(makePack({ over: flakes(8) })));
    assert.deepEqual(page.order(), ['season-back', 'backdrop', 'stage', 'season-front', 'red-wash'], 'off: no over layer');

    await season.showSeason('thanksgiving', importPack(makePack({ over: flakes(8) })));
    assert.equal(page.getElementById('season-over'), null, 'a new pack keeps the switch');
    season.setOverPanels(true);
    assert.ok(page.getElementById('season-over'));

    await season.showSeason('', null);
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash'], 'a pack that goes takes the over layer with it');
    season.setOverPanels(false);
    season.setOverPanels(true);
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash'], 'the switch with no pack on draws nothing');
  });
});

test('the over layer is drawn in full motion only, and follows the front layer through a hidden transition', () => {
  const read = file => fs.readFileSync(path.join(mainTree, 'dashboard/seasons', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rulesOf = css => css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').split('}').map(chunk => chunk.split('{')).filter(parts => parts.length === 2)
    .map(parts => ({ selector: parts[0].trim(), body: parts[1] }));

  // calm and none motion: the layer is display: none, and only full motion turns it on
  const layer = rulesOf(read('season.css'));
  const hide = layer.filter(rule => rule.selector === '.season-over')[0];
  assert.ok(hide && /display:\s*none/.test(hide.body), 'the layer is hidden by default');
  const asked = layer.filter(rule => /\.season-over/.test(rule.selector) && /display:\s*block/.test(rule.body));
  assert.equal(asked.length, 1);
  assert.equal(asked[0].selector, 'html[data-motion="full"] .season-over', 'only full motion shows it');

  // the hidden transitions treat it as they treat the front layer
  const motion = rulesOf(read('motion.css'));
  const front = motion.filter(rule => rule.selector.indexOf('.season-front') !== -1);
  assert.equal(front.length, 3);
  front.forEach(rule => assert.ok(rule.selector.indexOf('.season-over') !== -1, 'a rule for the front layer should name the over layer too: ' + rule.selector.slice(0, 80)));
  assert.ok(motion.some(rule => rule.selector === 'html[data-night] .season-piece' && /animation-play-state:\s*paused/.test(rule.body)), 'the night screen pauses the pieces of every layer');
});

test('the Look switch reaches the screen through config.js, theme.js, shell.js, the sample content and the Studio schema', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');

  assert.match(read('dashboard/config.js'), /export const defaultThemeSettings = \{[\s\S]*?seasonOverPanels: true,[\s\S]*?\};/);
  assert.ok(read('dashboard/core/theme.js').includes("seasonOverPanels: typeof source.seasonOverPanels === 'boolean' ? source.seasonOverPanels : defaults.seasonOverPanels"), 'a missing or odd value is the default');
  assert.equal(JSON.parse(read('dashboard/data/sample/content.json')).theme.seasonOverPanels, true);

  const shell = read('dashboard/shell.js');
  assert.ok(shell.includes("params.get('seasonover')"), 'the address can switch it, for trying');
  assert.ok(shell.includes('module.setOverPanels(wantOverPanels())'));
  assert.ok(/function rebuild\(\)[\s\S]*?useSeasonSwitch\(\);[\s\S]*?\n}/.test(shell), 'rebuild() hands the switch over each time the content changes, so a change in Studio shows at once');

  const schema = read('studio/schemas/theme.js');
  assert.match(schema, /name: 'seasonOverPanels',\s*title: 'Seasonal pieces over the panels',\s*type: 'boolean',/);
  assert.match(schema, /initialValue: true,/);
  assert.ok(/fields: \[[^\]]*seasonOverPanelsField\]/.test(schema), 'the field is on the Look page');
  assert.ok(read('studio/check-schemas.mjs').includes("seasonOverPanels: 'boolean'"), 'check-schemas.mjs lists the field');
});

// Corner art (core/corner-art.js): four ornaments of line art in the two cut corners

const ornamentIds = ['leaves', 'snowflakes', 'gears', 'fireworks'];

test('there are four ornaments, and each is a few paths of line art with no fill, inside a 28 by 28 box with its line and the room it needs', () => {
  assert.deepEqual(cornerArt.cornerArtIds, ornamentIds);
  assert.deepEqual(cornerArt.cornerArtChoices, ornamentIds.concat(['none']));
  assert.equal(cornerArt.cornerArtSize, 28);
  assert.ok(cornerArt.cornerArtLine >= 3, 'no line is thinner than 3 px');

  const half = cornerArt.cornerArtLine / 2;
  ornamentIds.forEach(id => {
    const paths = cornerArt.cornerArtPaths(id);
    assert.ok(paths.length >= 2, id + ' is drawn with more than one path');
    paths.forEach(d => assert.match(d, /^M[-\d. ]+((L|A)[-\d. ]+)*Z?$/, id + ' uses only M, L, A and Z with plain numbers: ' + d));

    const markup = cornerArt.cornerArtMarkup(id);
    const elements = markup.match(/<[a-z]+/g);
    assert.equal(elements.length, paths.length, id + ' is nothing but paths');
    assert.ok(elements.every(tag => tag === '<path'));
    assert.equal(countOf(markup, 'fill="none"'), paths.length, 'every path has no fill');
    assert.equal(countOf(markup, 'fill='), paths.length, 'and nothing has any other fill');
    assert.equal(countOf(markup, 'stroke="currentColor"'), paths.length, 'every path is a line in the accent colour');
    assert.equal(countOf(markup, 'stroke-width="3"'), paths.length);
    assert.equal(countOf(markup, 'pathLength="1" stroke-dasharray="1"'), paths.length, 'and every path can be drawn in by the draw keyframes');
    assert.doesNotMatch(markup, /filter|blur|shadow|glow|gradient|pattern|mask|clip|<style|<script|href|opacity|transform|animate/i, id + ' has no effect words');

    cornerArt.cornerArtPoints(id).forEach(point => {
      assert.ok(point[0] - half >= 0 && point[0] + half <= 28 && point[1] - half >= 0 && point[1] + half <= 28, id + ' stays inside its box with the line: ' + point.map(round2).join(','));
    });
  });

  const reach = id => cornerArt.cornerArtPoints(id).reduce((all, point) => ({ left: Math.min(all.left, point[0]), right: Math.max(all.right, point[0]), top: Math.min(all.top, point[1]), bottom: Math.max(all.bottom, point[1]) }), { left: 99, right: 0, top: 99, bottom: 0 });
  ornamentIds.forEach(id => {
    const box = reach(id);
    assert.ok(box.right - box.left >= 20 && box.bottom - box.top >= 20, id + ' fills most of the box, so it reads from across the room');
  });

  assert.deepEqual(cornerArt.cornerArtPaths('sparkles'), []);
  assert.deepEqual(cornerArt.cornerArtPaths('none'), []);
  assert.equal(cornerArt.cornerArtMarkup('none'), '');
  assert.equal(cornerArt.isCornerArt('gears'), true);
  assert.equal(cornerArt.isCornerArt('none'), false, 'none is a choice, not an ornament');
  assert.equal(cornerArt.isCornerArt(undefined), false);
});

function round2(number) {
  return Math.round(number * 100) / 100;
}

function countOf(text, part) {
  return text.split(part).length - 1;
}

test('a path with a command the box check does not know is refused, and the arcs of the gear are sampled round the hub', () => {
  const gears = cornerArt.cornerArtPoints('gears');
  assert.ok(gears.some(point => Math.abs(point[0] - 10.8) < 0.1 && Math.abs(point[1] - 14) < 0.5), 'a point at the left of the hub');
  assert.ok(gears.some(point => Math.abs(point[0] - 17.2) < 0.1 && Math.abs(point[1] - 14) < 0.5), 'and at the right');
  gears.slice(-48).forEach(point => assert.ok(Math.abs(Math.hypot(point[0] - 14, point[1] - 14) - 3.2) < 0.01 || Math.hypot(point[0] - 14, point[1] - 14) > 3.2), 'no point of the hub is nearer its middle than its radius');
});

test('corner art goes in the two cut corners, which are corner zones, and fits each of them', () => {
  assert.deepEqual(cornerPlaces.map(place => place.zone), ['corner-a', 'corner-b']);
  cornerPlaces.forEach(place => {
    const zone = zones[place.zone];
    assert.ok(zone, place.zone + ' is a zone');
    assert.ok(place.x >= 0 && place.y >= 0 && place.x + cornerArt.cornerArtSize <= zone.width && place.y + cornerArt.cornerArtSize <= zone.height, place.zone + ' is big enough for the ornament at its place: ' + zone.width + ' by ' + zone.height);
  });
  assert.equal(new Set(cornerPlaces.map(place => place.zone)).size, cornerPlaces.length, 'one ornament in each');
});

test('the front layer draws the ornament in each corner place, after the pack\'s own pieces, and draws none for none, an odd id or a layout without the front layer', () => {
  const pack = makePack({ front: [{ zone: 'corner-a', shape: 'flake', x: 4, y: 0, size: 24 }] });
  const drawn = layersMarkup(pack, undefined, 'snowflakes');

  assert.equal(countOf(drawn.front, 'season-corner-art'), 2);

  // corner-a and corner-b are the last two zones of the list
  const inA = drawn.front.slice(drawn.front.indexOf('data-zone="corner-a"'), drawn.front.indexOf('data-zone="corner-b"'));
  const inB = drawn.front.slice(drawn.front.indexOf('data-zone="corner-b"'));
  assert.equal(countOf(inA, 'season-corner-art'), 1);
  assert.equal(countOf(inB, 'season-corner-art'), 1, 'a corner with no piece of the pack is drawn for the ornament');
  assert.ok(inA.indexOf('class="season-piece"') < inA.indexOf('season-corner-art'), 'the ornament is after the pack\'s own piece, so it lies over it');

  assert.equal(countOf(drawn.front, cornerArt.cornerArtPaths('snowflakes')[0]), 2, 'the paths of the ornament, in each corner');
  ornamentIds.forEach(id => assert.ok(layersMarkup(pack, undefined, id).front.includes(cornerArt.cornerArtPaths(id)[0]), id));

  ['none', 'sparkles', '', undefined, null, 7].forEach(art => assert.equal(countOf(layersMarkup(pack, undefined, art).front, 'season-corner-art'), 0, String(art)));
  assert.equal(countOf(layersMarkup(pack, undefined).front, 'season-corner-art'), 0, 'with no corner art asked for');
  assert.equal(countOf(layersMarkup(pack, ['over'], 'snowflakes').front, 'season-corner-art'), 0, 'a layout that draws only the over layer has no corner');
  assert.equal(countOf(layersMarkup(pack, ['back', 'over'], 'snowflakes').front, 'season-corner-art'), 0);
  assert.equal(layersMarkup({}, undefined, 'gears').empty, false, 'a pack of nothing but corner art is not empty');
  assert.equal(layersMarkup({}, undefined, 'none').empty, true);
});

test('an ornament is a piece the size of the box at its place, with a view box of its own, its paths and no motion of a pack', () => {
  const html = cornerArtPieceMarkup('gears', { zone: 'corner-b', x: 12, y: 3 });

  assert.ok(html.startsWith('<div class="season-piece season-corner-art" style="left: 12px; top: 3px; width: 28px; height: 28px;">'));
  assert.ok(html.includes('<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">'));
  assert.ok(html.includes(cornerArt.cornerArtMarkup('gears')));
  assert.ok(!html.includes('data-move') && !html.includes('--seconds'), 'the draw is in motion.css, not a motion the pack names');
});

test('the corner art on the page is the one typed on the rule, else the pack\'s own, else none, and a change draws the front layer again', async () => {
  const front = page => page.getElementById('season-front');
  const countArt = page => countOf(front(page).innerHTML, 'season-corner-art');

  await onPage(async (page, logged, fresh) => {
    await fresh.showSeason('christmas', importPack(makePack({ defaults: { cornerArt: 'snowflakes' } })));
    assert.ok(front(page).innerHTML.includes(cornerArt.cornerArtPaths('snowflakes')[0]), 'the pack\'s own, with nothing typed');
    assert.equal(countArt(page), 2);

    const first = front(page);
    fresh.setCornerArt('');
    assert.equal(front(page), first, 'nothing typed again changes nothing');
    fresh.setCornerArt('snowflakes');
    assert.equal(front(page), first, 'typing the art the pack already has changes nothing');

    fresh.setCornerArt('gears');
    assert.notEqual(front(page), first, 'a different art is drawn at once');
    assert.ok(front(page).innerHTML.includes(cornerArt.cornerArtPaths('gears')[0]) && !front(page).innerHTML.includes(cornerArt.cornerArtPaths('snowflakes')[0]), 'the typed one wins');
    const second = front(page);
    fresh.setCornerArt('gears');
    assert.equal(front(page), second, 'the same art again is not drawn again');
    fresh.setCornerArt('none');
    assert.equal(countArt(page), 0, 'None on the rule wins over the pack\'s own');
    fresh.setCornerArt('');
    assert.equal(countArt(page), 2, 'and empty goes back to the pack\'s own');
    fresh.setCornerArt('sparkles');
    assert.equal(countArt(page), 2, 'an id that is not an ornament counts as empty');
    assert.deepEqual(logged, []);
  });

  await onPage(async (page, logged, fresh) => {
    fresh.setCornerArt('leaves');
    await fresh.showSeason('thanksgiving', importPack(makePack()));
    assert.ok(front(page).innerHTML.includes(cornerArt.cornerArtPaths('leaves')[0]), 'typed before the pack comes on');

    await fresh.showSeason('halloween', importPack(makePack({ defaults: { cornerArt: 'gears' } })));
    assert.ok(front(page).innerHTML.includes(cornerArt.cornerArtPaths('leaves')[0]), 'a rule of the next pack is given by shell.js before it asks for the pack');
    fresh.setCornerArt('');
    await fresh.showSeason('christmas', importPack(makePack({ defaults: { cornerArt: 'gears' } })));
    assert.ok(front(page).innerHTML.includes(cornerArt.cornerArtPaths('gears')[0]));

    await fresh.showSeason('', null);
    assert.equal(page.getElementById('season-front'), null);
    fresh.setCornerArt('leaves');
    assert.deepEqual(page.order(), ['backdrop', 'stage', 'red-wash'], 'a corner art with no pack draws nothing');
  });

  await onPage(async (page, logged, fresh) => {
    fresh.setLayers(['over']);
    fresh.setCornerArt('gears');
    await fresh.showSeason('christmas', importPack(makePack({ defaults: { cornerArt: 'gears' }, over: flakes(8) })));
    assert.equal(page.getElementById('season-front').innerHTML, '', 'a layout without the front layer has no corner art');
    const layer = page.getElementById('season-front');
    fresh.setCornerArt('leaves');
    assert.equal(page.getElementById('season-front'), layer, 'and a change of art does not draw it again');
  });
});

test('a pack may carry defaults for the three extras, and every mistake in them is named', () => {
  assert.deepEqual(packProblems(makePack({ defaults: { cornerArt: 'gears', tickerPrefix: 'HAPPY', bannerLine: 'A line' } })), []);
  assert.deepEqual(packProblems(makePack({ defaults: {} })), []);
  assert.deepEqual(packProblems(makePack({ defaults: { cornerArt: 'none' } })), [], 'a pack may say none');
  assert.match(packProblems(makePack({ defaults: { cornerArt: 'sparkles' } })).join(), /the defaults has the corner art "sparkles", which is not one of: leaves, snowflakes, gears, fireworks, none/);
  assert.match(packProblems(makePack({ defaults: { tickerPrefix: 'A PREFIX THAT IS TOO LONG' } })).join(), /tickerPrefix should be text of 12 characters or fewer/);
  assert.match(packProblems(makePack({ defaults: { bannerLine: 'x'.repeat(41) } })).join(), /bannerLine should be text of 40 characters or fewer/);
  assert.match(packProblems(makePack({ defaults: { bannerLine: 7 } })).join(), /bannerLine should be text/);
  assert.match(packProblems(makePack({ defaults: { corner: 'gears' } })).join(), /"corner", which defaults do not use/);
  assert.match(packProblems(makePack({ defaults: 'gears' })).join(), /the defaults should be/);
});

test('the four packs that carry a corner art have the one the order names, and the other three have none of their own', async () => {
  const folder = pathToFileURL(path.join(mainTree, 'dashboard', 'seasons')).href + '/';
  const expected = { christmas: 'snowflakes', thanksgiving: 'leaves', 'competition-day': 'gears', 'new-years': 'fireworks' };

  for (const id of packIds) {
    const { pack } = await import(folder + id + '.js');
    if (expected[id]) assert.deepEqual(pack.defaults, { cornerArt: expected[id] }, id);
    else assert.equal(pack.defaults, undefined, id + ' has no corner art of its own');
    assert.deepEqual(packProblems(pack), [], id);
  }
});

test('loading a pack remembers its defaults, and a pack whose defaults are wrong has none', async () => {
  await loadPack('summer-break', importPack(makePack({ defaults: { cornerArt: 'leaves', tickerPrefix: 'SUN' } })));
  assert.deepEqual(packExtras.defaultsOf('summer-break'), { cornerArt: 'leaves', tickerPrefix: 'SUN' });
  assert.deepEqual(packExtras.defaultsOf('no-such-pack'), {});

  await loadPack('valentines-day', importPack(makePack({ defaults: { cornerArt: 'sparkles' } })));
  assert.deepEqual(packExtras.defaultsOf('valentines-day'), {});
});

test('corner art draws in once and holds: one rule, in full motion only, that plays the first 35 percent of the draw keyframes and stays there', () => {
  const css = fs.readFileSync(path.join(mainTree, 'dashboard/seasons/motion.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutKeyframes = css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const rules = withoutKeyframes.split('}').map(chunk => chunk.split('{')).filter(parts => parts.length === 2).map(parts => ({ selector: parts[0].trim(), body: parts[1] }));
  const art = rules.filter(rule => rule.selector.indexOf('.season-corner-art') !== -1);

  assert.equal(art.length, 1);
  assert.equal(art[0].selector, 'html[data-motion="full"] .season-corner-art', 'calm and none motion draw it whole and still');
  assert.match(art[0].body, /animation-name:\s*season-draw;/, 'the keyframes that are already there');
  assert.match(art[0].body, /animation-iteration-count:\s*\.35;/, 'it stops at their 35 percent step');
  assert.match(art[0].body, /animation-fill-mode:\s*both;/, 'and holds it');
  assert.doesNotMatch(art[0].body, /infinite/);

  // that step is where every line is whole, and a corner art adds no keyframes of its own
  const draw = /@keyframes season-draw \{([^}]*(?:\}[^}]*)*?)\n\}/.exec(css);
  assert.ok(draw && /35%\s*\{\s*stroke-dashoffset:\s*0;\s*\}/.test(draw[1]), 'at 35 percent the dash offset is 0');
  assert.deepEqual((css.match(/@keyframes\s+[\w-]+/g) || []).map(text => text.replace('@keyframes ', '')).filter(name => /corner|art/.test(name)), []);

  const layer = fs.readFileSync(path.join(mainTree, 'dashboard/seasons/season.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(layer, /\.season-corner-art \{ color: var\(--yellow\); \}/, 'in the accent colour of the pack');
});

// Calm and none motion

test('only full motion plays any motion, and the layers let every click through', () => {
  const css = fs.readFileSync(path.join(mainTree, 'dashboard/seasons/motion.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutKeyframes = css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const rules = withoutKeyframes.split('}').map(chunk => chunk.split('{')).filter(parts => parts.length === 2);

  const playing = rules.filter(parts => /animation-name|animation:/.test(parts[1]));
  assert.ok(playing.length >= motions.length, 'a rule for each motion');
  playing.forEach(parts => assert.ok(parts[0].trim().indexOf('html[data-motion="full"]') === 0, 'not under full motion: ' + parts[0].trim()));

  const layer = fs.readFileSync(path.join(mainTree, 'dashboard/seasons/season.css'), 'utf8');
  assert.ok(/\.season-layer\s*\{[^}]*pointer-events: none/.test(layer));
  assert.ok(!/animation|@keyframes|transition/.test(layer.replace(/\/\*[\s\S]*?\*\//g, '')), 'season.css holds no animation');
});

test('a hidden transition fades the front layer out and in, and hides it in every other step, in full motion only', () => {
  const css = fs.readFileSync(path.join(mainTree, 'dashboard/seasons/motion.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').split('}').map(chunk => chunk.split('{')).filter(parts => parts.length === 2)
    .map(parts => ({ selector: parts[0].trim(), body: parts[1] }));
  const forFront = rules.filter(rule => rule.selector.indexOf('.season-front') !== -1);

  const hides = forFront.filter(rule => /visibility:\s*hidden/.test(rule.body));
  assert.equal(hides.length, 1, 'one rule hides the front layer');
  assert.ok(hides[0].selector.indexOf('html[data-motion="full"] #world[data-hidden]') === 0, 'only in full motion, whenever a step is playing');
  // A selector with more :not() parts wins over one with fewer, so the hiding rule has to leave the steps that fade out of its reach
  ['glitch', 'break', 'build'].forEach(step => assert.ok(hides[0].selector.indexOf(':not([data-hidden="' + step + '"])') !== -1, 'the hiding rule leaves ' + step + ' alone'));

  ['break', 'build'].forEach(step => {
    const rule = forFront.filter(item => item.selector.indexOf('#world[data-hidden="' + step + '"]') !== -1)[0];
    assert.ok(rule, 'a rule for ' + step);
    assert.ok(/animation:\s*season-(out|in)\b/.test(rule.body) && !/visibility/.test(rule.body), step + ' fades the layer and does not hide it');
    assert.ok(rule.selector.indexOf('html[data-motion="full"]') === 0);
  });
  assert.ok(/season-out/.test(forFront.filter(item => item.selector.indexOf('#world[data-hidden="break"]') !== -1)[0].body));
  assert.ok(/season-in/.test(forFront.filter(item => item.selector.indexOf('#world[data-hidden="build"]') !== -1)[0].body));

  const night = rules.filter(rule => rule.selector === 'html[data-night] .season-piece')[0];
  assert.ok(night && /animation-play-state:\s*paused/.test(night.body), 'the pieces wait while the night screen covers them');
});

test('shell.js gives theme-apply the decorations callback, and index.html links the two stylesheets', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell.js'), 'utf8');
  assert.ok(/await startThemes\([^\n]*showDecorations\);/.test(shell), 'startThemes should be given showDecorations');
  assert.ok(shell.includes("module.showSeason(look.overlay)"), 'showDecorations should ask core/season.js for the overlay');
  assert.ok(shell.includes("startOptional('./core/season.js'"), 'the module is optional, so a problem in it cannot stop the screen');

  const index = fs.readFileSync(path.join(dashboardFolder, 'index.html'), 'utf8');
  assert.ok(index.includes('href="seasons/season.css"') && index.includes('href="seasons/motion.css"'));
});

// The check really fails

// Runs tools/check-seasons.mjs on a copy of the tree with one file changed
function checkAfter(name, changes) {
  const folder = path.join(workFolder, 'copy-' + name);
  makeTree(folder);

  Object.keys(changes).forEach(file => {
    const target = path.join(folder, file);
    if (changes[file] === null) return fs.rmSync(target);
    if (typeof changes[file] === 'string') return fs.writeFileSync(target, changes[file]);

    const before = fs.readFileSync(target, 'utf8');
    const after = changes[file](before);
    assert.notEqual(after, before, 'the test change to ' + file + ' did nothing, so the anchor text is gone');
    fs.writeFileSync(target, after);
  });

  const run = spawnSync(process.execPath, [path.join(folder, 'tools/check-seasons.mjs')], { encoding: 'utf8' });
  return { failed: run.status !== 0, text: run.stdout + run.stderr };
}

const christmas = 'dashboard/seasons/christmas.js';
const motionFile = 'dashboard/seasons/motion.css';

test('the check passes on the real files', () => {
  const run = spawnSync(process.execPath, [path.join(mainTree, 'tools/check-seasons.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /(\d+) of \1 checks passed/, 'every check passes');
});

const markLine = "const mark = { viewBox: '0 0 60 76', markup: treeMarkup };";
const withoutFlakes = pattern => before => before.split('\n').filter(line => !pattern.test(line)).join('\n');

const mistakes = [
  ['a finished pack with no mark', { [christmas]: before => before.replace('  mark: mark,\n', '') }, /christmas: the pack has no mark/],
  ['a mark bigger than its box', { [christmas]: before => before.replace(markLine, "const mark = { viewBox: '0 0 60 76', width: 80, height: 90, markup: treeMarkup };") }, /the mark is 80 by 90 pixels, and the box for a mark is 60 by 76/],
  ['a mark with a script in it', { [christmas]: before => before.replace(markLine, "const mark = { viewBox: '0 0 60 76', markup: treeMarkup + '<script>1</script>' };") }, /christmas: the mark holds a script/],
  ['a gradient in a mark', { [christmas]: before => before.replace(markLine, "const mark = { viewBox: '0 0 60 76', markup: treeMarkup + '<linearGradient id=\"g\"/>' };") }, /christmas: the mark holds a gradient/],
  ['the word glow in a mark', { [christmas]: before => before.replace(markLine, "const mark = { viewBox: '0 0 60 76', markup: treeMarkup + '<g id=\"glow\"/>' };") }, /christmas: the mark uses the word "glow"/],
  ['an over piece that is too big', { [christmas]: before => before.replace('x: 235, y: 518, size: 44,', 'x: 235, y: 518, size: 60,') }, /over piece 2 \(snowflake\) is 60 px wide, and the over layer allows 18 to 44/],
  ['an over piece that is too solid', { [christmas]: before => before.replace("size: 44, opacity: 0.7, motion: 'flutter', seconds: 24,", "size: 44, opacity: 0.95, motion: 'flutter', seconds: 24,") }, /over piece 2 \(snowflake\) needs an opacity of 0.85 or less/],
  ['an over piece that is too quick', { [christmas]: before => before.replace("motion: 'flutter', seconds: 24,", "motion: 'flutter', seconds: 8,") }, /takes 8 seconds for a round of flutter, and the least the over layer allows is 12/],
  ['an over piece with a motion that is too quick for the layer', { [christmas]: before => before.replace("motion: 'flutter', seconds: 24,", "motion: 'pulse', seconds: 24,") }, /the motion "pulse", which is too quick for the over layer/],
  ['an over piece that does not move', { [christmas]: before => before.replace("opacity: 0.85, motion: 'flutter', seconds: 44, delay: -3.1, travel: 1300", 'opacity: 0.85') }, /needs a motion, because a piece that stays still/],
  ['an over piece that leaves the screen at rest', { [christmas]: before => before.replace('x: 1850, y: 518, size: 44', 'x: 1900, y: 518, size: 44') }, /over piece 12 .*does not fit at rest/],
  ['fewer than 8 over pieces', { [christmas]: withoutFlakes(/shape: 'snowflake', x: (1075|1245|1395|1565|1715|1850),/) }, /christmas: the pack has 6 over pieces, and a finished pack has at least 8/],
  ['more than 14 over pieces', { [christmas]: before => before.replace("x: 1850, y: 518, size: 44, opacity: 0.7, motion: 'flutter', seconds: 30, delay: -26.1, travel: 1300 },", "x: 1850, y: 518, size: 44, opacity: 0.7, motion: 'flutter', seconds: 30, delay: -26.1, travel: 1300 },\n    { shape: 'snowflake', x: 40, y: 500, size: 20, opacity: 0.8, motion: 'fall', seconds: 40 },\n    { shape: 'snowflake', x: 80, y: 500, size: 20, opacity: 0.8, motion: 'fall', seconds: 40 },\n    { shape: 'snowflake', x: 120, y: 500, size: 20, opacity: 0.8, motion: 'fall', seconds: 40 },") }, /christmas: the pack has 15 over pieces, and the most is 14/],
  ['a stillToDo id that is not a pack', { 'tools/check-seasons.mjs': before => before.replace('const stillToDo = [', "const stillToDo = ['spring', ") }, /stillToDo lists "spring"/],
  ['the over layer shown in calm motion', { 'dashboard/seasons/season.css': before => before.replace('html[data-motion="full"] .season-over { display: block; }', '.season-over { display: block; }') }, /so that only full motion draws the over layer/],
  ['a mark that would push the text beside it', { 'dashboard/base.css': before => before.replace('margin-right: -6px;', 'margin-right: 0;') }, /\.pack-mark should set margin-right: -6px/],
  ['a mark size that the docs do not mention', { 'docs/seasonal-packs.md': before => before.replace(/60 x 76/g, '70 x 90') }, /docs\/seasonal-packs.md should say that the box for a mark is 60 x 76/],
  ['a missing pack file', { 'dashboard/seasons/halloween.js': null }, /halloween.*does not exist/],
  ['a pack file with no overlay', { 'dashboard/seasons/spring.js': 'export const pack = { shapes: {}, scene: null, back: [], front: [] };\n' }, null],
  ['an unknown motion', { [christmas]: before => before.replace("motion: 'sway'", "motion: 'wobble'") }, /motion "wobble"/],
  ['an unknown zone', { [christmas]: before => before.replace("zone: 'corner-b'", "zone: 'corner-z'") }, /zone "corner-z"/],
  ['a piece outside its zone at rest', { [christmas]: before => before.replace("zone: 'corner-a', shape: 'star', x: 78, y: 7", "zone: 'corner-a', shape: 'star', x: 90, y: 7") }, /does not fit at rest/],
  ['an unknown shape', { [christmas]: before => before.replace("zone: 'corner-a', shape: 'star'", "zone: 'corner-a', shape: 'comet'") }, /shape "comet"/],
  ['too many moving pieces', { [christmas]: before => before.replace("{ zone: 'corner-b', shape: 'bell', x: 15, y: 0, size: 22, motion: 'sway', seconds: 5, delay: -1.5 },", "{ zone: 'corner-b', shape: 'bell', x: 15, y: 0, size: 22, motion: 'sway', seconds: 5, delay: -1.5 },\n    { zone: 'gutter', shape: 'snowflake', x: 4, y: 160, size: 10, motion: 'fall', seconds: 16 },\n    { zone: 'gutter', shape: 'snowflake', x: 4, y: 180, size: 10, motion: 'fall', seconds: 16 },\n    { zone: 'gutter', shape: 'snowflake', x: 4, y: 200, size: 10, motion: 'fall', seconds: 16 },") }, /pieces that move/],
  ['the word glow in a pack', { [christmas]: before => before.replace("const cap = '#2d4a3a';", "const cap = '#2d4a3a';\nconst glow = 1;") }, /uses the word "glow"/],
  ['the word shadow in a shape', { [christmas]: before => before.replace('const snowflake = {', "const snowflake = { name: 'shadow',") }, /uses the word "shadow"/],
  ['a gradient in a shape', { [christmas]: before => before.replace("markup: polygon('7,0 8.9,5.1 14,7", "markup: '<linearGradient id=\"g\"/>' + polygon('7,0 8.9,5.1 14,7") }, /gradient/],
  ['a keyframe in a pack file', { [christmas]: before => before.replace("const cap = '#2d4a3a';", "const cap = '#2d4a3a';\nconst css = '@keyframes spin { to { opacity: 0; } }';") }, /@keyframes/],
  ['a keyframe in season.css', { 'dashboard/seasons/season.css': before => before + '\n@keyframes wiggle { to { opacity: 0; } }\n' }, /season.css has @keyframes/],
  ['an animation property in season.css', { 'dashboard/seasons/season.css': before => before + '\n.season-piece { animation: none; }\n' }, /season.css sets animation/],
  ['motion.css animating the width', { [motionFile]: before => before.replace('@keyframes season-bob {\n  0%, 100% { transform:', '@keyframes season-bob {\n  0%, 100% { width: 5px; transform:') }, /animate width/],
  ['motion.css animating the top', { [motionFile]: before => before.replace('@keyframes season-twinkle {\n  0%, 100% { opacity: 1; }', '@keyframes season-twinkle {\n  0%, 100% { opacity: 1; top: 0; }') }, /animate top/],
  ['a motion that plays in calm motion', { [motionFile]: before => before.replace('html[data-motion="full"] .season-piece[data-move="bob"]     {', '.season-piece[data-move="bob"]     {') }, /plays an animation with the selector/],
  ['a motion with no keyframes', { [motionFile]: before => before.replace('@keyframes season-spin {', '@keyframes season-turn {') }, /no @keyframes season-spin/],
  ['a keyframe that is not a motion', { [motionFile]: before => before.replace('@keyframes season-out {', '@keyframes season-leftover { to { opacity: 0; } }\n@keyframes season-out {') }, /season-leftover/],
  ['a motion that is not described at the top', { [motionFile]: before => before.replace('     pulse    swells', '     pulses   swells') }, /"pulse" is not described/],
  ['a transition in motion.css', { [motionFile]: before => before + '\n.season-piece { transition: opacity 1s; }\n' }, /has a transition/],
  ['a decorations flag with no file', { 'dashboard/themes/overlays/registry.js': before => before.replace("id: 'example',\n    name: 'Example overlay (placeholder)',\n    description: 'Placeholder. A paler yellow and quiet text, to show how an overlay is written.',\n    decorations: false,", "id: 'example',\n    name: 'Example overlay (placeholder)',\n    description: 'Placeholder. A paler yellow and quiet text, to show how an overlay is written.',\n    decorations: true,") }, /example.*does not exist/],
  ['zones that overlap', { 'dashboard/core/season.js': before => before.replace("'corner-b': { x: 1198, y: 238,", "'corner-b': { x: 1198, y: 270,") }, /overlap/],
  ['the stylesheets not linked', { 'dashboard/index.html': before => before.replace('<link rel="stylesheet" href="seasons/motion.css">', '') }, /should link seasons\/motion.css/],
];

mistakes.forEach(entry => {
  test('the check fails for ' + entry[0], () => {
    const result = checkAfter('m' + mistakes.indexOf(entry), entry[1]);
    assert.ok(result.failed, 'the check should have failed, and said:\n' + result.text);
    if (entry[2]) assert.match(result.text, entry[2]);
    else assert.match(result.text, /spring.*no overlay that says decorations/);
  });
});

test('the packs in stillToDo are excused from the mark and the over pieces, and only the ones listed', () => {
  const everyPack = "const stillToDo = ['halloween', 'thanksgiving', 'christmas', 'new-years', 'valentines-day', 'competition-day', 'summer-break'];";
  const bare = before => before.replace('  mark: mark,\n', '').replace(/  over: \[[\s\S]*?\n  \],\n/, '');

  const excused = checkAfter('excused', { [christmas]: bare, 'tools/check-seasons.mjs': before => before.replace(/const stillToDo = \[[^\]]*\];/, everyPack) });
  assert.equal(excused.failed, false, 'a pack in stillToDo may have no mark and no over pieces:\n' + excused.text);

  const notExcused = checkAfter('not-excused', { [christmas]: bare });
  assert.ok(notExcused.failed, 'a pack that is not in stillToDo must have both');
  assert.match(notExcused.text, /christmas: the pack has no mark/);
  assert.match(notExcused.text, /christmas: the pack has 0 over pieces/);

  const code = fs.readFileSync(path.join(root, 'tools/check-seasons.mjs'), 'utf8');
  const listed = (/const stillToDo = \[([^\]]*)\];/.exec(code) || [0, ''])[1];
  assert.ok(listed.indexOf("'christmas'") === -1 && listed.indexOf("'example'") === -1, 'Christmas is finished, and the example overlay has no pack');
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
