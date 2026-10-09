// Tests for the Cybertron style on the arrangement of Original: which layout each style has,
// the four frames of Cybertron (the large frame, the small frame, the banner and the ticker),
// the stage that holds them, the banner and the ticker on their plates, the wide war clock
// in the countdown's place, the mirror, and that the frames are drawn again when the style
// changes while the screen runs. Original is held to the numbers it has always had. Nothing
// touches the network or a browser.
//
//   node tools/test-cybertron.mjs
//
// What it looks like is checked by looking at the screen (docs/layouts.md, "Looking at a layout").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(root, 'dashboard');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-cybertron-'));

function copyInto(folder, from, to) {
  fs.mkdirSync(path.dirname(path.join(folder, to)), { recursive: true });
  fs.copyFileSync(path.join(root, from), path.join(folder, to));
}

function makeTree(name, files) {
  const folder = path.join(workFolder, name);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'package.json'), '{ "type": "module" }\n');
  files.forEach(file => copyInto(folder, file, file));
  return folder;
}

const urlOf = (folder, file) => pathToFileURL(path.join(folder, file)).href;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

// The files every tree has: the configuration, the registries and everything in core/
const baseFiles = ['dashboard/config.js', 'dashboard/frame.js', 'dashboard/registry.js', 'dashboard/themes/registry.js', 'dashboard/themes/overlays/registry.js']
  .concat(fs.readdirSync(path.join(dashboardFolder, 'core')).filter(name => name.endsWith('.js')).map(name => 'dashboard/core/' + name));

const mainTree = makeTree('main', baseFiles);
const layout = await import(urlOf(mainTree, 'dashboard/core/layout.js'));
const styles = await import(urlOf(mainTree, 'dashboard/core/style.js'));
const plate = await import(urlOf(mainTree, 'dashboard/core/plate.js'));
const { themes } = await import(urlOf(mainTree, 'dashboard/themes/registry.js'));

const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

// Runs something with a fake global, and puts the real one back
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

// plate.js adds each frame's shapes to a hidden group of the page, once. A page with only that group stands in for it.
// run is given the set of ids that were drawn into the group
function withPlatePage(run) {
  const known = new Set();
  return withGlobals({
    document: {
      getElementById: id => {
        if (id !== 'metal-shapes') return known.has(id) ? {} : null;
        return { insertAdjacentHTML: (where, markup) => (markup.match(/ id="[^"]+"/g) || []).forEach(found => known.add(found.slice(5, -1))) };
      },
    },
  }, () => run(known));
}

const countOf = (text, word) => (text.match(new RegExp(word, 'g')) || []).length;
const hasText = (markup, text) => markup.indexOf(text) !== -1;
const elements = markup => (markup.match(/<(svg|g|polygon|polyline|path|use|circle|ellipse|span|div)[ >]/g) || []).length;
const staticIds = new Set((read('dashboard/index.html').match(/ id="[^"]+"/g) || []).map(found => found.slice(5, -1)));

// True when every tag that opens is closed, in order. An element that ends with /> closes itself.
function isBalanced(markup) {
  const open = [];
  const tags = markup.match(/<\/?[a-zA-Z]+[^>]*>/g) || [];
  return tags.every(tag => {
    const name = /^<\/?([a-zA-Z]+)/.exec(tag)[1];
    if (tag.endsWith('/>')) return true;
    if (tag.startsWith('</')) return open.pop() === name;
    open.push(name);
    return true;
  }) && open.length === 0;
}

const lengthOf = (from, to) => Math.hypot(to[0] - from[0], to[1] - from[1]);
const distanceToLine = (point, from, to) => Math.abs((to[0] - from[0]) * (from[1] - point[1]) - (from[0] - point[0]) * (to[1] - from[1])) / lengthOf(from, to);
const distanceToSegment = (point, from, to) => {
  const length = lengthOf(from, to);
  const along = Math.max(0, Math.min(1, ((point[0] - from[0]) * (to[0] - from[0]) + (point[1] - from[1]) * (to[1] - from[1])) / (length * length)));
  return lengthOf(point, [from[0] + (to[0] - from[0]) * along, from[1] + (to[1] - from[1]) * along]);
};
const signedArea = outline => outline.reduce((sum, point, index) => {
  const next = outline[(index + 1) % outline.length];
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;
const within = (inner, outer) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
const apart = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

const cybertronKinds = ['cybertron-grid1', 'cybertron-grid2', 'cybertron-banner', 'cybertron-ticker'];
const sizes = { 'cybertron-grid1': [1152, 708], 'cybertron-grid2': [656, 372], 'cybertron-banner': [1840, 228], 'cybertron-ticker': [1840, 72] };


// Which layout each style has

test('Original and Cybertron keep the layout of the theme, and Minimal is the only style with the bar layout', () => {
  themes.forEach(theme => {
    const own = layout.layoutOf(theme.id);
    assert.equal(styles.layoutFor('original', own), own, theme.id + ' with Original');
    assert.equal(styles.layoutFor('cybertron', own), own, theme.id + ' with Cybertron');
    assert.equal(styles.layoutFor('minimal', own), 'bar', theme.id + ' with Minimal');
    assert.equal(layout.chooseLayout({ defaultTheme: theme.id }, null, new Date(), 'cybertron'), own, 'the layout at the start with ' + theme.id);
  });
  assert.equal(styles.layoutFor('cybertron', 'standard'), 'standard');
  assert.equal(styles.layoutFor('cybertron', 'sidebar'), 'sidebar', 'Neon Prime with Cybertron is the sidebar layout');
  assert.ok(themes.some(theme => theme.layout === 'sidebar'));

  const code = read('dashboard/core/style.js');
  assert.ok(code.includes("const forcedLayout = { original: null, cybertron: null, minimal: 'bar' };"));
});

test('each style names the corners its frames have, and Cybertron and Minimal are the styles with steel', () => {
  assert.equal(styles.shapesFor('original'), '');
  assert.equal(styles.shapesFor('cybertron'), 'cybertron');
  assert.equal(styles.shapesFor('minimal'), 'minimal');
  ['oops', undefined, null, 'toString'].forEach(odd => assert.equal(styles.shapesFor(odd), '', String(odd)));

  assert.equal(styles.hasSteel('original'), false);
  assert.equal(styles.hasSteel('cybertron'), true);
  assert.equal(styles.hasSteel('minimal'), true);
  ['oops', undefined, null].forEach(odd => assert.equal(styles.hasSteel(odd), false, String(odd)));

  // Original and Cybertron are the same page: a change between them is not a reload
  assert.equal(layout.drawnFor('standard', styles.shapesFor('cybertron')), layout.drawnFor('standard', styles.shapesFor('original')));
  assert.equal(layout.drawnFor('sidebar', styles.shapesFor('cybertron')), 'sidebar');
  assert.notEqual(layout.drawnFor('bar', styles.shapesFor('minimal')), layout.drawnFor('standard', ''), 'and Minimal is another page');
});

test('frameKind gives Cybertron a frame for each region of the standard layout, and the sidebar layout has the same large frame and ticker', () => {
  ['standard', 'sidebar'].forEach(name => {
    assert.equal(plate.frameKind('grid1', name, 'cybertron'), 'cybertron-grid1', name);
    assert.equal(plate.frameKind('grid2', name, 'cybertron'), 'cybertron-grid2', name);
    assert.equal(plate.frameKind('ticker', name, 'cybertron'), 'cybertron-ticker', name);
    assert.equal(plate.frameKind('banner', name, 'cybertron'), 'cybertron-banner', name);
    ['grid1', 'grid2', 'ticker', 'banner'].forEach(region => assert.equal(plate.frameKind(region, name, ''), region, name + ' ' + region + ' with the usual corners'));
    ['grid1', 'grid2', 'ticker', 'banner'].forEach(region => assert.equal(plate.frameKind(region, name, 'minimal'), region, name + ' ' + region + ' with the corners of Minimal'));
  });
  assert.equal(plate.frameKind('countdown', 'standard', 'cybertron'), 'countdown', 'the countdown is the war clock, which is not a frame of this table');
  assert.equal(plate.frameKind('grid1', 'bar', 'minimal'), 'bar-main-minimal', 'Minimal is as it was');
  assert.equal(plate.frameKind('grid1', 'bar', 'cybertron'), 'bar-main', 'a bar page with the corners of Cybertron has the usual bar frames');
  cybertronKinds.forEach(kind => assert.ok(plate.barShape(kind), kind + ' is a frame'));
});


// The four frames

test('the four frames are ten-cornered plates with a cut corner at the top left and the bottom right (56 on the panels, 32 on the banner and the ticker) and a step at the other two, 4 inside the box of the frame they stand in for', () => {
  const chamfers = { 'cybertron-grid1': 56, 'cybertron-grid2': 56, 'cybertron-banner': 32, 'cybertron-ticker': 32 };
  const steps = { 'cybertron-grid1': 24, 'cybertron-grid2': 24, 'cybertron-banner': 16, 'cybertron-ticker': 16 };
  const runs = { 'cybertron-grid1': 150, 'cybertron-grid2': 120, 'cybertron-banner': 100, 'cybertron-ticker': 100 };

  cybertronKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    const outline = shape.outline;

    assert.deepEqual([shape.width, shape.height], sizes[kind], kind + ': drawn for the box of the frame it stands in for');
    assert.equal(outline.length, 10, kind + ': ten corners');
    assert.ok(signedArea(outline) > 0, kind + ': clockwise on the screen');

    const xs = outline.map(point => point[0]);
    const ys = outline.map(point => point[1]);
    assert.deepEqual([Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys)], [4, shape.width - 4, 4, shape.height - 4], kind + ': the line is 4 inside the box');

    // the cut corners at the top left and the bottom right are 45 degrees
    assert.deepEqual([outline[1][1] - outline[2][1], outline[2][0] - outline[1][0]], [chamfers[kind], chamfers[kind]], kind + ': the cut corner at the top left');
    assert.deepEqual([outline[6][1] - outline[7][1], outline[7][0] - outline[6][0]].map(Math.abs), [chamfers[kind], chamfers[kind]], kind + ': and at the bottom right');

    // the second, stepped notch is at the top right and the bottom left: the line drops by the step over the same run
    assert.equal(outline[4][1] - outline[3][1], steps[kind], kind + ': the step at the top right');
    assert.equal(outline[4][0] - outline[3][0], steps[kind], kind + ': at 45 degrees');
    assert.equal(outline[5][1] - outline[3][1], steps[kind], kind + ': the top right corner is one step below the top line');
    assert.equal(outline[0][1], shape.height - 4 - steps[kind], kind + ': the bottom left corner is one step above the bottom line');
    assert.equal(outline[9][1], outline[0][1], kind + ': the step at the bottom left');
    assert.equal(outline[8][1] - outline[9][1], steps[kind]);
    assert.equal(shape.width - 4 - outline[3][0], runs[kind], kind + ': the run');
  });

  assert.equal(plate.barShape('cybertron-grid1').outline[2][0] - plate.barShape('cybertron-grid1').outline[1][0], Number(/--style-chamfer: (\d+)px;/.exec(withoutComments(read('dashboard/styles/cybertron.css')))[1]), '--style-chamfer is the cut corner of the large frame');
});

test('every frame has a hex bolt at each joint of its cut corners and steps, and the ticker the two at the ends of its cut corner', () => {
  const bolts = shape => shape.screws.a.concat(shape.screws.b);
  ['cybertron-grid1', 'cybertron-grid2', 'cybertron-banner'].forEach(kind => {
    const shape = plate.barShape(kind);
    assert.equal(bolts(shape).length, 6, kind + ': six joints');
    [1, 2, 5, 6, 7, 0].forEach(index => assert.ok(bolts(shape).some(bolt => bolt[0] === shape.outline[index][0] && bolt[1] === shape.outline[index][1]), kind + ' has a bolt at corner ' + index));
  });
  const ticker = plate.barShape('cybertron-ticker');
  assert.equal(bolts(ticker).length, 2);
  assert.deepEqual(bolts(ticker), [ticker.outline[2], ticker.outline[7]]);
});

test('the large and the small frame have an armor header, a hazard stripe in the team accent under it, three or two plate seams, the pink conduit, slashes and brackets, and the banner and the ticker have less', () => {
  const grid1 = plate.barShape('cybertron-grid1');
  const grid2 = plate.barShape('cybertron-grid2');

  // The header is as high as the one it stands in for: 120 on the large frame, 84 on the small one, from the top of the box
  assert.equal(grid1.tab[4][1], 120);
  assert.equal(grid2.tab[4][1], 84);
  [grid1, grid2].forEach(shape => {
    assert.equal(shape.tab.length, 5);
    assert.deepEqual(shape.tab.slice(0, 2), [shape.outline[1], shape.outline[2]], 'the tab starts at the cut corner');
    assert.ok(shape.tab[3][0] < shape.tab[2][0], 'and ends in a slant');
    assert.ok(shape.headerRight.some(point => point[0] === shape.outline[3][0] && point[1] === shape.outline[3][1]), 'the rest of the header goes to the step');
    // slanted bars 22 wide every 44 and 12 high, from 10 inside the line at the left to 10 inside it at the right
    const stripes = Math.floor((shape.width - 4 - 10 - (4 + 10) - 12 - 22) / 44) + 1;
    assert.equal(shape.art.hazard.split('M').length - 1, stripes, 'the stripes across the width');
  });
  assert.ok(grid1.art.hazard.startsWith('M14 132L26 120L48 120L36 132Z'), 'the hazard stripe is under the header, which ends at 120, and starts 10 inside the line');
  assert.equal(grid1.art.seams.split('M').length - 1, 3, 'three seams on the large frame');
  assert.equal(grid2.art.seams.split('M').length - 1, 2, 'and two on the small one');
  [grid1, grid2].forEach(shape => {
    assert.equal(shape.art.slashes.split('M').length - 1, 6, 'six slashes');
    assert.equal(shape.bracketLines.length, 2);
    assert.ok(shape.art.conduit.length > 0);
  });

  // The pink brackets stand outside the cut corners at the top left and the bottom right, and the legs are 60 and 70, and 40 and 50
  [[grid1, [60, 70]], [grid2, [40, 50]], [plate.barShape('cybertron-banner'), [40, 50]], [plate.barShape('cybertron-ticker'), [40, 50]]].forEach(([shape, legs]) => {
    const top = shape.bracketLines[0];
    assert.ok(Math.abs(top[0][1] - top[1][1] - legs[0]) < 1e-6, 'a leg down the side');
    assert.ok(Math.abs(top[3][0] - top[2][0] - legs[1]) < 1e-6, 'and along the top');
    assert.ok(top[1][0] < shape.outline[1][0] && top[2][1] < shape.outline[2][1], 'outside the corner');
  });

  // No header, no hazard, no slashes and no seams on the banner and the ticker, which would cross their text
  ['cybertron-banner', 'cybertron-ticker'].forEach(kind => {
    const shape = plate.barShape(kind);
    assert.equal(shape.tab, undefined, kind + ' has no header');
    ['hazard', 'slashes', 'seams'].forEach(name => assert.equal(shape.art[name], undefined, kind + ' has no ' + name));
    assert.equal(shape.pieces.length, 0, kind + ' is not broken into pieces');
    assert.equal(shape.rivets, undefined);
    assert.equal(shape.wear, undefined, 'no rust on the frames of Cybertron');
    assert.equal(shape.number, undefined, 'and no stamped plate id');
  });
  assert.ok(plate.barShape('cybertron-banner').art.conduit.length > 0);
  assert.equal(plate.barShape('cybertron-ticker').art.conduit, '', 'the ticker has no conduit, which would cross its text');
  assert.equal(plate.barShape('cybertron-ticker').still, true, 'the ticker holds still while its message changes');
  assert.equal(plate.barShape('cybertron-banner').still, false);
});

test('the neon is 10 inside the edge with two wider and fainter lines behind it, and the frames have no rivets, no rust and no stamped id', async () => {
  await withPlatePage(() => {
    cybertronKinds.forEach(kind => {
      const shape = plate.barShape(kind);
      assert.equal(shape.wide, true, kind + ': the wide neon lines');
      const neon = shape.neon.a.concat(shape.neon.b);
      assert.equal(neon.length, 12, 'the line is the outline moved in, with two points where the halves meet');
      shape.outline.forEach((corner, index) => {
        const inner = plate.offsetPoint(shape.outline, corner, 10);
        assert.ok(shape.neon.a.concat(shape.neon.b).some(point => Math.abs(point[0] - inner[0]) < .05 && Math.abs(point[1] - inner[1]) < .05), kind + ': corner ' + index + ' has its neon corner');
      });

      const markup = kind === 'cybertron-banner' ? plate.plateMarkup(kind) : plate.areaMarkup(kind);
      assert.ok(isBalanced(markup), kind + ' is balanced');
      ['edge-neon-wide-2', 'edge-neon-wide-1', 'edge-neon'].forEach(name => assert.ok(countOf(markup, 'class="' + name + '"') >= 2, kind + ' has ' + name));
      ['rivets', 'plate-id', 'war-', 'class="wear"', 'art-smudge', 'art-minimal', 'glint', 'screw-shape', 'screw-shadow'].forEach(text => assert.ok(!hasText(markup, text), kind + ' has no ' + text));
      assert.ok(hasText(markup, 'href="#bolt-shape"'), kind + ' has hex bolts');
    });
  });
});

test('the markup of the large and the small frame is the frame in two halves with their shadows, the fills, the decoration, and the 12 pieces of the mechanical page change', async () => {
  await withPlatePage(drawn => {
    ['cybertron-grid1', 'cybertron-grid2'].forEach(kind => {
      const markup = plate.areaMarkup(kind);
      (markup.match(/href="#[a-z0-9-]+"/g) || []).forEach(found => assert.ok(drawn.has(found.slice(7, -1)) || staticIds.has(found.slice(7, -1)), kind + ': ' + found + ' is not drawn anywhere'));

      assert.equal(countOf(markup, 'class="plate fills"'), 1, 'the fills');
      ['frame-a', 'frame-b', 'shadow-a', 'shadow-b'].forEach(name => assert.equal(countOf(markup, 'data-part="' + name + '"'), 1, kind + ' ' + name));
      assert.equal(countOf(markup, 'class="plate piece"'), 12, kind + ': 12 pieces');
      assert.equal(countOf(markup, 'data-part="decor"'), 1, 'the decoration in the fills, in one group');
      ['art-seams', 'art-hazard', 'art-conduit', 'art-slashes', 'art-brackets'].forEach(name => assert.equal(countOf(markup, 'art-cybertron ' + name), 2, kind + ' ' + name + ' once in the frame and once in the piece that is the decoration'));
      assert.equal(countOf(markup, 'class="tab-inset"'), 2, 'the team plate color inset in the tab, in the fills and in its piece');
      assert.equal(countOf(markup, 'href="#bolt-shape"'), 12, 'six bolts in the halves, and each of them in one piece as well');
      assert.ok(elements(markup) <= 150, kind + ' is under 150 elements: ' + elements(markup));
    });

    // the pieces have the names the page change moves: the large frame's of Original
    const names = shape => shape.pieces.map(piece => piece.name);
    assert.deepEqual(names(plate.barShape('cybertron-grid1')), names(plate.barShape('cybertron-grid2')));
    const css = read('dashboard/frame.css');
    names(plate.barShape('cybertron-grid1')).forEach(name => assert.ok(css.includes('[data-piece="' + name + '"]'), name + ' has a line in frame.css'));
  });
});

test('the bars of the pieces, put end to end, are the whole outline, and each bolt is in one piece', async () => {
  ['cybertron-grid1', 'cybertron-grid2'].forEach(kind => {
    const shape = plate.barShape(kind);
    const named = name => shape.pieces.filter(piece => piece.name === name)[0];
    const order = ['corner-top-left', 'edge-top-left', 'edge-top-right', 'edge-right', 'corner-bottom-right', 'edge-bottom', 'edge-bottom-left'];
    const lines = order.map(name => named(name).line);
    const same = (one, other) => one[0] === other[0] && one[1] === other[1];

    // every end of a bar is the end of exactly one other bar, so they make one closed line
    const ends = {};
    lines.forEach(line => [line[0], line[line.length - 1]].forEach(point => { ends[point.join(',')] = (ends[point.join(',')] || 0) + 1; }));
    assert.equal(Object.keys(ends).length, 7, kind + ': seven joints');
    Object.keys(ends).forEach(point => assert.equal(ends[point], 2, kind + ': the joint at ' + point + ' is the end of two bars'));

    // every point of every line is on the outline
    lines.forEach((line, index) => line.forEach(point => assert.doesNotThrow(() => plate.offsetPoint(shape.outline, point, 10), kind + ': ' + order[index] + ' has a point off the outline: ' + point)));

    // the corners of the outline are all in the lines, in order
    shape.outline.forEach((corner, index) => assert.ok(lines.some(line => line.some(point => same(point, corner))), kind + ': corner ' + index + ' is in a piece'));

    const bolts = shape.screws.a.concat(shape.screws.b);
    bolts.forEach(bolt => assert.equal(shape.pieces.filter(piece => (piece.screws || []).some(own => own[0] === bolt[0] && own[1] === bolt[1])).length, 1, kind + ': the bolt at ' + bolt + ' is in one piece'));
  });
});

test('the banner and the ticker are one plate each: the fills and the two halves, no pieces and no glint, and the ticker has frames of its own that the page change does not lift', async () => {
  await withPlatePage(drawn => {
    const banner = plate.plateMarkup('cybertron-banner');
    (banner.match(/href="#[a-z0-9-]+"/g) || []).forEach(found => assert.ok(drawn.has(found.slice(7, -1)) || staticIds.has(found.slice(7, -1)), found + ' is not drawn anywhere'));
    assert.ok(/^<svg class="plate fills"/.test(banner), 'the fills come first, so the halves are over them');
    assert.equal(countOf(banner, 'data-part="frame-a"'), 1);
    assert.equal(countOf(banner, 'data-part="frame-b"'), 1);
    assert.equal(countOf(banner, 'class="plate piece"'), 0);
    assert.equal(countOf(banner, 'art-cybertron'), 2, 'the conduit and the brackets');
    assert.equal(countOf(banner, 'href="#bolt-shape"'), 6);
    assert.equal(countOf(banner, 'data-part="stud"'), 6, 'the bolts arrive with the banner: they are in the table of frame.js');
    assert.ok(elements(banner) <= 40, 'the banner is under 40 elements: ' + elements(banner));
    assert.ok(banner.includes('width="1840" height="228" viewBox="0 0 1840 228"'));

    const ticker = plate.areaMarkup('cybertron-ticker');
    ['still-frame-a', 'still-frame-b', 'still-shadow-a', 'still-shadow-b'].forEach(name => assert.equal(countOf(ticker, 'data-part="' + name + '"'), 1, name));
    ['frame-a', 'frame-b', 'shadow-a', 'shadow-b'].forEach(name => assert.equal(countOf(ticker, 'data-part="' + name + '"'), 0, name + ' is what the page change lifts'));
    assert.equal(countOf(ticker, 'class="plate piece"'), 0);
    assert.equal(countOf(ticker, 'art-brackets'), 1, 'only the brackets');
    assert.equal(countOf(ticker, 'href="#bolt-shape"'), 2);
    assert.ok(elements(ticker) <= 40, 'the ticker is under 40 elements: ' + elements(ticker));
    assert.ok(ticker.includes('width="1840" height="72" viewBox="0 0 1840 72"'));

    const frameCss = withoutComments(read('dashboard/frame.css'));
    assert.ok(/html\[data-layout="bar"\] \.area\[data-area="ticker"\] \.screw,\s*html\[data-style="cybertron"\] \.area\[data-area="ticker"\] \.screw \{ animation-name: none; \}/.test(frameCss), 'its bolts do not turn');
  });
});

test('the frames of Original are the ones they were: the same outlines, the same pieces, no steel decoration, and the rivets and the id still in their markup', async () => {
  await withPlatePage(() => {
    const expected = {
      grid1: { outline: [[4, 704], [4, 68], [84, 4], [1148, 4], [1148, 640], [1068, 704]], pieces: 13 },
      grid2: { outline: [[4, 368], [4, 52], [64, 4], [652, 4], [652, 320], [592, 368]], pieces: 12 },
    };
    Object.keys(expected).forEach(kind => {
      const markup = plate.areaMarkup(kind);
      assert.equal(countOf(markup, 'class="plate piece"'), expected[kind].pieces, kind + ' pieces');
      assert.ok(!hasText(markup, 'art-cybertron') && !hasText(markup, 'bolt-shape') && !hasText(markup, 'edge-neon'), kind + ' has none of the steel decoration');
      assert.ok(hasText(markup, 'class="glint"') && hasText(markup, 'class="plate-id"') && hasText(markup, 'class="rivets"'), kind + ' has its glint, its id and its rivets');
    });

    // the outlines are in the group of shapes the first time a frame is drawn
    const shapes = [];
    return withGlobals({ document: { getElementById: id => (id === 'metal-shapes' ? { insertAdjacentHTML: (where, markup) => shapes.push(markup) } : null) } }, () => {
      plate.areaMarkup('grid1');
      plate.areaMarkup('grid2');
      const text = shapes.join('');
      Object.keys(expected).forEach(kind => assert.ok(text.includes('<polygon id="' + kind + '-outline" pathLength="1" points="' + expected[kind].outline.map(point => point.join(',')).join(' ') + '"/>'), kind + ' has the outline it always had'));
    });
  });

  // The countdown, the banner and the layout of the stage are Original's own, and nothing in base.css or the panel files was moved
  const base = withoutComments(read('dashboard/base.css'));
  assert.ok(/#stage \{[^}]*padding: 24px 40px;[^}]*grid-template-columns: 1152px 656px;[^}]*grid-template-rows: 212px 708px 72px;[^}]*gap: 20px 32px;/.test(base), 'the stage of the standard layout');
  assert.ok(/#region-right \{[^}]*grid-template-rows: 320px 372px;[^}]*gap: 16px;/.test(base), 'the countdown over the small frame');
  assert.ok(/\.area\[data-area="grid1"\] \{ width: 1152px; height: 708px; \}/.test(base) && /\.area\[data-area="grid2"\] \{ width: 656px; height: 372px; \}/.test(base) && /\.area\[data-area="ticker"\] \{ width: 1840px; height: 72px; \}/.test(base));
  const banner = withoutComments(read('dashboard/panels/banner/banner.css'));
  assert.ok(/\.banner \{\s*display: grid;\s*grid-template-columns: 219px minmax\(0, 1fr\);\s*column-gap: 28px;\s*height: 212px;\s*\}/.test(banner), 'the banner of Original');
  assert.ok(/\.banner \.banner-text \{[^}]*height: 212px;/.test(banner) && /\.banner \.banner-top \{[^}]*height: 160px;/.test(banner));
  assert.ok(!/cybertron|war-/.test(banner), 'the banner\'s own stylesheet says nothing about Cybertron');
  assert.ok(!/#stage \{[^}]*cybertron/.test(base));
});


// Where the frames are on the screen

// The stage of Cybertron, read from its stylesheet: padding, rows and gaps
function cybertronStage() {
  const css = withoutComments(read('dashboard/styles/cybertron.css'));
  const rule = /html\[data-style="cybertron"\]\[data-layout="standard"\] #stage \{([^}]*)\}/.exec(css);
  assert.ok(rule, 'styles/cybertron.css has a rule for the stage');

  const padding = /padding: (\d+)px (\d+)px (\d+)px;/.exec(rule[1]).slice(1).map(Number);
  const rows = /grid-template-rows: (\d+)px (\d+)px (\d+)px;/.exec(rule[1]).slice(1).map(Number);
  const gaps = /gap: (\d+)px (\d+)px;/.exec(rule[1]).slice(1).map(Number);
  return { top: padding[0], side: padding[1], bottom: padding[2], rows: rows, rowGap: gaps[0], columnGap: gaps[1] };
}

// The boxes of the regions on the screen, with the columns of the standard layout (1152 and 656) and the stage given
function boxesOn(stage) {
  const left = stage.side;
  const banner = { x: left, y: stage.top, width: 1840, height: stage.rows[0] };
  const grid1 = { x: left, y: banner.y + banner.height + stage.rowGap, width: 1152, height: stage.rows[1] };
  const rightX = left + 1152 + stage.columnGap;
  const countdown = { x: rightX, y: grid1.y, width: 656, height: 320 };
  const grid2 = { x: rightX, y: countdown.y + 320 + 16, width: 656, height: 372 };
  const ticker = { x: left, y: grid1.y + grid1.height + stage.rowGap, width: 1840, height: stage.rows[2] };
  return { banner: banner, grid1: grid1, countdown: countdown, grid2: grid2, ticker: ticker };
}

test('the stage of Cybertron gives the banner 228 and takes the 16 from the top margin and the two gaps, so the frames under it keep their sizes and the ticker stays where it is', () => {
  const stage = cybertronStage();
  assert.deepEqual([stage.top, stage.side, stage.bottom], [20, 40, 24]);
  assert.deepEqual(stage.rows, [228, 708, 72]);
  assert.deepEqual([stage.rowGap, stage.columnGap], [14, 32]);
  assert.equal(stage.top + stage.rows[0] + stage.rowGap + stage.rows[1] + stage.rowGap + stage.rows[2] + stage.bottom, layout.screen.height, 'the rows and the margins are the screen');
  assert.equal(2 * stage.side + 1152 + stage.columnGap + 656, layout.screen.width, 'and so are the columns');

  const original = boxesOn({ top: 24, side: 40, bottom: 24, rows: [212, 708, 72], rowGap: 20, columnGap: 32 });
  const own = boxesOn(stage);
  assert.deepEqual([own.grid1.width, own.grid1.height, own.countdown.width, own.countdown.height, own.grid2.width, own.grid2.height], [1152, 708, 656, 320, 656, 372], 'the frames keep their sizes');
  assert.deepEqual(own.ticker, original.ticker, 'the ticker is where it is in Original, which the connection text under the screen reads');
  assert.equal(own.banner.height - original.banner.height, 16);
  assert.equal(own.grid1.y - original.grid1.y, 6, 'the large frame is 6 lower');
  assert.equal(own.grid1.y + own.grid1.height + stage.rowGap, own.ticker.y);
  assert.equal(own.grid2.y + own.grid2.height, own.grid1.y + own.grid1.height, 'the small frame ends where the large one does');
  assert.equal(own.banner.width, plate.barShape('cybertron-banner').width);
  assert.equal(own.banner.height, plate.barShape('cybertron-banner').height);

  // The standard layout only: the sidebar layout is not touched by it
  const css = withoutComments(read('dashboard/styles/cybertron.css'));
  assert.ok(!/data-layout="sidebar"/.test(css));
  assert.ok(css.includes('html[data-style="cybertron"] #season-front {\n  display: none;\n}'), 'the zones of a seasonal pack were measured on Original, so they are not drawn');
});

test('every frame of Cybertron, with its bolts, its brackets and its shadow, is inside the screen where the stage puts it, in the standard layout and in its mirror', () => {
  const boxes = boxesOn(cybertronStage());
  const place = (kind, box) => {
    const extent = plate.frameExtent(kind);
    return { x: box.x + extent.left, y: box.y + extent.top, width: extent.right - extent.left, height: extent.bottom - extent.top };
  };
  const mirror = box => ({ x: layout.screen.width - box.x - box.width, y: box.y, width: box.width, height: box.height });
  const screen = { x: 0, y: 0, width: layout.screen.width, height: layout.screen.height };

  [['cybertron-banner', boxes.banner], ['cybertron-grid1', boxes.grid1], ['cybertron-grid2', boxes.grid2], ['cybertron-ticker', boxes.ticker]].forEach(([kind, box]) => {
    assert.ok(within(place(kind, box), screen), kind + ' is inside the screen');
    assert.ok(within(place(kind, mirror(box)), screen), kind + ' is inside the screen when mirrored');
  });
  // the countdown's clock is inside its region, and the region is in the right column
  assert.ok(within({ x: boxes.countdown.x + 20, y: boxes.countdown.y + 60, width: 616, height: 200 }, boxes.countdown));
  assert.ok(apart({ x: boxes.countdown.x + 20, y: boxes.countdown.y + 60, width: 616, height: 200 }, place('cybertron-banner', boxes.banner)), 'the war clock is clear of the banner\'s frame');
  assert.ok(apart({ x: boxes.countdown.x + 20, y: boxes.countdown.y + 60, width: 616, height: 200 }, place('cybertron-grid2', boxes.grid2)), 'and of the small frame\'s');
});


// The banner and the ticker on their plates

// The numbers of one rule of a stylesheet: width, height and the others, by name
function ruleOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|\\})\\s*' + escaped + ' \\{([^{}]*)\\}').exec(css);
  assert.ok(found, 'no rule for ' + selector);
  return found[1];
}
const numberIn = (rule, name) => {
  const found = new RegExp('(?:^|[;\\s])' + name + ': (-?\\d*\\.?\\d+)(?:px)?[;\\s]').exec(rule + ' ');
  return found ? Number(found[1]) : null;
};

test('the banner is laid out inside its plate: the steel and the neon are clear of the logo, the name, the TEAM plate, the clock and the bottom row', () => {
  const css = withoutComments(read('dashboard/styles/cybertron.css'));
  const original = withoutComments(read('dashboard/panels/banner/banner.css'));
  const banner = ruleOf(css, 'html[data-style="cybertron"] .banner');
  const shape = plate.barShape('cybertron-banner');

  // The box: 1840 by 228 with the content in what is left of it, 192 high
  const padding = /padding: (\d+)px (\d+)px (\d+)px (\d+)px;/.exec(banner).slice(1).map(Number);
  assert.equal(numberIn(banner, 'height'), shape.height);
  assert.equal(padding[0] + numberIn(ruleOf(css, 'html[data-style="cybertron"] .banner .banner-text'), 'height') + padding[2], shape.height, 'the content has the rest of the box');
  assert.ok(/box-sizing: border-box;/.test(banner));
  assert.ok(/position: relative;/.test(ruleOf(css, 'html[data-style="cybertron"] .banner .banner-text')), 'the text is over the plate, which is first in the banner');

  // The column: the name and the TEAM plate, then the bottom row, which are the 192
  const top = numberIn(ruleOf(css, 'html[data-style="cybertron"] .banner .banner-top'), 'height');
  const name = numberIn(ruleOf(css, 'html[data-style="cybertron"] .banner .team-name'), 'height');
  const teamPlate = numberIn(ruleOf(original, '.banner .team-plate'), 'height');
  const bottom = numberIn(ruleOf(original, '.banner .banner-bottom'), 'height');
  assert.equal(name + teamPlate, top, 'the name and the TEAM plate, with no gap');
  assert.ok(/gap: 0;/.test(ruleOf(css, 'html[data-style="cybertron"] .banner .banner-left')));
  assert.equal(top + bottom, numberIn(ruleOf(css, 'html[data-style="cybertron"] .banner .banner-text'), 'height'), 'and the bottom row, which is 44');
  assert.equal(bottom, 44);

  // The hawk is Original's at the scale that fits: its box is 1100 by 884 at --k
  const logo = ruleOf(css, 'html[data-style="cybertron"] .banner .logo');
  const k = numberIn(logo, '--k');
  const box = { width: numberIn(logo, 'width'), height: numberIn(logo, 'height') };
  assert.equal(Math.round(1100 * k), box.width, 'the width is the grid of the drawing at --k');
  assert.ok(Math.abs(884 * k - box.height) < 1, 'and so is the height');
  assert.ok(banner.includes('grid-template-columns: ' + box.width + 'px minmax(0, 1fr);'), 'the first column is as wide as the hawk');

  // The clearances, from the frame's own outline: the logo's corner, the end of the clock, the bottom row's corner, and the bolts
  const logoBox = { x: padding[3], y: padding[0] + (192 - box.height) / 2, width: box.width, height: box.height };
  const outline = shape.outline;
  const clear = 10 + 2 + 4; // from the line of the frame: the neon is 10 in and 4 wide, and 4 more
  assert.ok(distanceToLine([logoBox.x, logoBox.y], outline[1], outline[2]) >= clear, 'the hawk is clear of the cut corner at the top left');
  assert.ok(logoBox.y + logoBox.height <= outline[0][1] - 10 - 2, 'and of the step at the bottom left');
  assert.ok(logoBox.x >= outline[0][0] + 19 + 4, 'and of the bolt at the bottom left');
  const right = shape.width - padding[1];
  assert.ok(right <= outline[5][0] - 19, 'the clock ends before the bolt at the top right');
  assert.ok(distanceToLine([right, padding[0] + 192], outline[6], outline[7]) >= clear, 'the bottom row is clear of the cut corner at the bottom right');
  assert.ok(padding[0] >= 10 + 4 + 4, 'the top is under the neon');
});

test('the banner draws its plate only when the page has the frames of Cybertron: Original\'s banner has no plate, and the table of frame.js brings the plate in as the bar banner\'s does', async () => {
  await onPage(async world => {
    await world.draw(teamContent(), 'dashboard/panels/banner/banner.js');
    assert.ok(!hasText(world.markup, 'class="plate'), 'no plate in the banner of Original');
    assert.ok(!hasText(world.markup, 'bolt-shape'));
    assert.ok(/<section class="panel banner" data-sequence="banner">\s*<div class="logo">/.test(world.markup), 'the logo is the first part, as it was');
  });

  await onPage(async world => {
    await world.draw(teamContent(), 'dashboard/panels/banner/banner.js');
    assert.ok(/<section class="panel banner" data-sequence="banner">\s*<svg class="plate fills"/.test(world.markup), 'the plate is first, under everything');
    assert.equal(countOf(world.markup, 'data-part="frame-a"'), 1);
    assert.equal(countOf(world.markup, 'href="#bolt-shape"'), 6);
    assert.ok(world.markup.indexOf('<svg class="plate fills"') < world.markup.indexOf('<div class="logo">'));
    assert.equal(countOf(world.markup, 'class="team-name"'), 1, 'the name is still there once');
  }, 'cybertron');

  // The banner's table has the plate's parts, and they are the bar banner's
  const frame = read('dashboard/frame.js');
  const sequence = /\n  banner: \{([^}]*)\}/.exec(frame)[1];
  ['body', 'outline', 'decor', 'stud'].forEach(part => assert.ok(new RegExp("'" + part + "':").test(sequence), 'the banner has a line for ' + part));
  const bar = /'bar-banner': \{([^}]*)\}/.exec(frame)[1];
  ['body', 'outline', 'decor', 'stud'].forEach(part => assert.equal(new RegExp("'" + part + "':\\s*(\\[[^\\]]*\\])").exec(sequence)[1], new RegExp("'" + part + "':\\s*(\\[[^\\]]*\\])").exec(bar)[1], part + ' comes in as it does in the bar banner'));
});

test('the ticker is as high as its plate and has the same 16 at both ends as in the bar layout, and the mirror turns it', () => {
  const css = withoutComments(read('dashboard/styles/cybertron.css'));
  const rule = ruleOf(css, 'html[data-style="cybertron"] .ticker');
  assert.ok(/box-sizing: border-box;/.test(rule) && /padding: 0 16px;/.test(rule));
  const shape = plate.barShape('cybertron-ticker');
  assert.deepEqual([shape.width, shape.height], [1840, 72], 'the area of the ticker (.area[data-area="ticker"] in base.css)');

  // the tag is 72 high, as high as the plate, and starts over the cut corner
  const tag = withoutComments(read('dashboard/panels/ticker/ticker.css'));
  assert.equal(numberIn(ruleOf(tag, '.ticker .tag'), 'height'), shape.height);

  // the mirror turns the ticker's row and puts the message against the tag, for Cybertron as for Original
  const mirror = withoutComments(read('dashboard/styles/original.css'));
  assert.ok(/html\.mirrored\[data-layout="standard"\] \.ticker \{\s*flex-direction: row-reverse;/.test(mirror));
  assert.ok(mirror.includes('html.mirrored[data-layout="standard"] .ticker .message { text-align: right; }'));
});

test('the mirror of the standard layout is the same for Original and Cybertron: no style in its selectors, and Cybertron\'s banner changes the sides of its margins', () => {
  const mirror = withoutComments(read('dashboard/styles/original.css'));
  const selectors = [];
  mirror.replace(/([^{}]+)\{[^{}]*\}/g, (all, list) => {
    list.split(',').forEach(selector => selectors.push(selector.trim()));
    return all;
  });
  assert.ok(selectors.length >= 18);
  selectors.forEach(selector => assert.ok(selector.startsWith('html.mirrored[data-layout="standard"] '), selector));
  assert.ok(!/data-style/.test(mirror), 'so the one set of rules turns the standard layout in either style');

  // the banner of Cybertron has the hawk first and the name after it, and the margins are the other way round when mirrored
  const css = withoutComments(read('dashboard/styles/cybertron.css'));
  const normal = ruleOf(css, 'html[data-style="cybertron"] .banner');
  const turned = ruleOf(css, 'html[data-style="cybertron"].mirrored[data-layout="standard"] .banner');
  const padding = text => /padding: (\d+)px (\d+)px (\d+)px (\d+)px;/.exec(text).slice(1).map(Number);
  assert.deepEqual([padding(turned)[1], padding(turned)[3]], [padding(normal)[3], padding(normal)[1]]);
  assert.ok(/grid-template-columns: minmax\(0, 1fr\) 187px;/.test(turned));

  // the stylesheets are in this order in index.html, so the rule of Cybertron wins over the mirror of equal weight
  const page = read('dashboard/index.html');
  assert.ok(page.indexOf('styles/original.css') < page.indexOf('styles/cybertron.css'));
});


// The wide war clock

const warCss = () => withoutComments(read('dashboard/panels/countdown/countdown.css'));
const wideSection = () => {
  const css = warCss();
  return css.slice(css.indexOf('.war-clock.war-wide {'));
};
const wideRule = selector => ruleOf(wideSection(), '.war-clock.war-wide' + (selector ? ' ' + selector : ''));
const wideNumber = (selector, name) => numberIn(wideRule(selector), name);

const fontAdvances = {
  700: {
    digits: [692, 478, 683, 695, 709, 708, 715, 603, 696, 730],
    space: 246,
    letters: { A: 736, B: 747, C: 670, D: 744, E: 680, F: 639, G: 818, H: 765, I: 420, J: 681, K: 692, L: 610, M: 885, N: 766, O: 754, P: 689, Q: 754, R: 742, S: 722, T: 609, U: 777, V: 708, W: 1010, X: 702, Y: 678, Z: 680 },
  },
  600: {
    digits: [682, 455, 672, 668, 672, 666, 695, 569, 689, 699],
    space: 239,
    letters: { A: 711, B: 727, C: 673, D: 732, E: 657, F: 611, G: 737, H: 749, I: 408, J: 635, K: 686, L: 591, M: 892, N: 752, O: 729, P: 657, Q: 729, R: 718, S: 696, T: 587, U: 745, V: 697, W: 964, X: 683, Y: 669, Z: 669 },
  },
};

// How wide text is in px, with the letter spacing as a fraction of the size, after every character
function textWidth(text, weight, size, spacing) {
  const table = fontAdvances[weight];
  return Array.from(text).reduce((sum, character) => {
    const advance = /\d/.test(character) ? table.digits[Number(character)] : character === ' ' ? table.space : table.letters[character];
    return sum + advance / 1000 * size + spacing * size;
  }, 0);
}

// Where each part of the wide clock is, in the housing's own pixels, from the stylesheet
const wideParts = () => ({
  'war-status': { top: wideNumber('.war-status', 'top'), height: wideNumber('.war-status', 'height'), left: wideNumber('.war-status', 'left'), width: wideNumber('.war-status', 'width') },
  'war-lines': { top: wideNumber('.war-lines', 'top'), height: wideNumber('.war-lines', 'height'), left: wideNumber('.war-lines', 'left'), width: wideNumber('.war-lines', 'width') },
  'war-days-plate': { top: wideNumber('.war-plate', 'top'), height: wideNumber('.war-plate', 'height'), left: wideNumber('.war-days-plate', 'left'), width: wideNumber('.war-days-plate', 'width') },
  'war-time-plate': { top: wideNumber('.war-plate', 'top'), height: wideNumber('.war-plate', 'height'), left: wideNumber('.war-time-plate', 'left'), width: wideNumber('.war-time-plate', 'width') },
});
const boxOf = part => ({ x: part.left, y: part.top, width: part.width, height: part.height });

const rivetsIn = markup => {
  const found = /<path class="war-rivet" d="([^"]*)"/.exec(markup)[1];
  return (found.match(/M[\d.]+ [\d.]+/g) || []).map(text => /M([\d.]+) ([\d.]+)/.exec(text)).map(match => [Number(match[1]) + 5, Number(match[2])]);
};

test('the wide housing is one steel plate 616 by 200 with the edge of the frames, a cut corner of 34 at the top left and the bottom right, four rivets clear of the rim, one weld seam and rust at two corners, and the narrow one is as it was', async () => {
  await withPlatePage(() => {
    const markup = plate.warHousingMarkup('wide');
    assert.ok(isBalanced(markup));
    assert.ok(/^<svg class="war-housing" width="616" height="200" viewBox="0 0 616 200">/.test(markup));
    assert.equal(countOf(markup, '<svg '), 1, 'one drawing');

    const points = /<polygon class="war-housing-fill" points="([^"]*)"/.exec(markup)[1].split(' ').map(pair => pair.split(',').map(Number));
    assert.deepEqual(points, [[4, 196], [4, 38], [38, 4], [612, 4], [612, 162], [578, 196]]);
    assert.deepEqual([points[1][1] - points[2][1], points[2][0] - points[1][0]], [34, 34], 'the cut at the top left');
    assert.deepEqual([points[4][0] - points[5][0], points[5][1] - points[4][1]], [34, 34], 'and at the bottom right');
    assert.ok(signedArea(points) > 0, 'clockwise on the screen, like the frames');

    const layers = (markup.match(/<use class="edge-[a-z]+" href="#war-housing-wide-shape"\/>/g) || []).map(text => /edge-([a-z]+)/.exec(text)[1]);
    assert.deepEqual(layers, ['shadow', 'rim', 'face', 'shade', 'ridge'], 'the five layers of the edge, on a shape of its own');

    const rivets = rivetsIn(markup);
    assert.equal(rivets.length, 4);
    const edges = points.map((point, index) => [point, points[(index + 1) % points.length]]);
    edges.forEach(([from, to]) => rivets.forEach(center => assert.ok(distanceToSegment(center, from, to) >= 5 + 8, 'a rivet is clear of the rim of the edge: ' + center)));
    assert.ok(rivets.some(([x, y]) => x < 100 && y < 100) && rivets.some(([x, y]) => x > 500 && y < 100) && rivets.some(([x, y]) => x < 100 && y > 100) && rivets.some(([x, y]) => x > 500 && y > 100), 'one in each corner');

    assert.ok(/class="war-weld-dark" d="M16 64L600 64"/.test(markup) && /class="war-weld-light" d="M16 68L600 68"/.test(markup), 'the seam, with the light line 4 below the dark one');
    const patches = (markup.match(/<ellipse class="war-smudge" cx="(\d+)" cy="(\d+)"/g) || []).map(text => /cx="(\d+)" cy="(\d+)"/.exec(text).slice(1).map(Number));
    assert.equal(patches.length, 2);
    assert.ok(patches.some(([x, y]) => x < 308 && y > 100) && patches.some(([x, y]) => x > 308 && y < 100), 'rust at the bottom left and the top right');
    assert.ok((markup.match(/<(svg|g|polygon|path|use|ellipse)[ >]/g) || []).length <= 20, 'a handful of elements');
    assert.ok(!/(filter|animate|<set|clipPath|<image|<mask|<pattern)/i.test(markup));

    // The narrow one is what it was: 700 by 120, on a shape of its own, with the id it had
    const narrow = plate.warHousingMarkup();
    assert.equal(narrow, plate.warHousingMarkup('narrow'));
    assert.ok(/^<svg class="war-housing" width="700" height="120" viewBox="0 0 700 120">/.test(narrow));
    assert.ok(narrow.includes('href="#war-housing-shape"') && !narrow.includes('wide'));
    assert.deepEqual(rivetsIn(narrow), [[30, 22], [672, 22], [30, 92], [672, 92]]);
  });
});

test('the wide war clock markup has the same parts as the narrow one, once each, with the class war-wide, and the panel is one slot that arrives as a piece', async () => {
  await onPage(async world => {
    const countdown = await import(urlOf(world.folder, 'dashboard/panels/countdown/countdown.js'));
    const wide = countdown.warMarkup('wide');
    const narrow = countdown.warMarkup();
    assert.ok(isBalanced(wide));
    assert.ok(/^\s*<div class="war-clock war-wide" data-level="calm" data-over="no">/.test(wide), 'one root, calm, and not over');
    assert.ok(/^\s*<div class="war-clock" data-level="calm" data-over="no">/.test(narrow), 'the narrow form is as it was');
    assert.equal(wide.replace(/<svg class="war-housing"[\s\S]*?<\/svg>/, '').replace(' war-wide', ''), narrow.replace(/<svg class="war-housing"[\s\S]*?<\/svg>/, ''), 'the same parts in the same order, apart from the housing');
    assert.equal(countOf(wide, 'data-part'), 0, 'no part of the clock arrives of its own');
    assert.ok(wide.includes('width="616" height="200"'));

    const classes = [];
    wide.replace(/class="([^"]*)"/g, (all, list) => { list.split(/\s+/).filter(Boolean).forEach(name => classes.push(name)); return all; });
    ['war-clock', 'war-wide', 'war-housing', 'war-status', 'war-lines', 'label', 'date', 'war-days-plate', 'war-days-group', 'days-number', 'days-word', 'war-time-plate', 'hours', 'minutes', 'seconds'].forEach(name => assert.equal(classes.filter(found => found === name).length, 1, name + ' appears once'));
    assert.equal(classes.filter(found => found === 'war-cell').length, 3);
    ['lamp', 'chevron', 'segment', 'stripes', 'top-line', 'time-row', 'days-row'].forEach(name => assert.ok(!classes.some(found => found.includes(name)), 'no ' + name + ' of the red countdown'));
  });

  // The panel of Cybertron: one section with the sequence of its own, and a slot that is its only part
  await onPage(async world => {
    await world.draw(teamContent(), 'dashboard/panels/countdown/countdown.js');
    assert.ok(/<section class="panel countdown-war" data-sequence="countdown-war">\s*<div class="war-slot" data-part="war">/.test(world.markup));
    assert.equal(countOf(world.markup, 'data-part'), 1, 'the slot is the one part');
    assert.ok(!hasText(world.markup, 'class="panel countdown"') && !hasText(world.markup, 'red-metal') && !hasText(world.markup, 'plate-id'), 'no red frame, no stamped id');
    assert.equal(world.countdown.dataset.over, 'no');
    assert.equal(world.countdown.dataset.level, 'calm');
    assert.equal(world.countdown.nodes['.label'].textContent, 'KICKOFF');
    assert.equal(world.countdown.nodes['.days-number span'].textContent, String(Math.floor((new Date(2027, 2, 1, 12, 0) - new Date(world.now)) / 86400000)).padStart(2, '0'));
    assert.ok(!world.log.some(entry => entry.endsWith('.animate')), 'the first numbers just appear');
  }, 'cybertron');

  const frame = read('dashboard/frame.js');
  const sequence = /'countdown-war': \{([^}]*)\}/.exec(frame)[1];
  assert.deepEqual((sequence.match(/'[a-z-]+':/g) || []).map(part => part.slice(1, -2)), ['war'], 'the table has a line for the slot and none for a part of the clock');
});

test('Original keeps the red countdown with its frame, its id and its rivets, and the war clock is only drawn for Cybertron', async () => {
  await onPage(async world => {
    await world.draw(teamContent(), 'dashboard/panels/countdown/countdown.js');
    assert.ok(/<section class="panel countdown" data-sequence="countdown" data-level="calm">/.test(world.markup));
    assert.ok(hasText(world.markup, 'red-metal') && hasText(world.markup, 'class="plate-id"') && hasText(world.markup, 'class="rivets"'));
    assert.ok(!hasText(world.markup, 'war-') && !hasText(world.markup, 'countdown-war'));
    assert.equal(countOf(world.markup, 'class="segment"'), 12, 'and the row of blocks');
  });
});

test('the wide war clock shows the same data as the countdown: the label without IN, the date, the days (three digits from 100), the time, the levels and the end states', async () => {
  const kickoffIn = days => {
    const at = new Date(2026, 9, 28 + days, 14, 0);
    const two = number => String(number).padStart(2, '0');
    return at.getFullYear() + '-' + two(at.getMonth() + 1) + '-' + two(at.getDate()) + 'T' + two(at.getHours()) + ':' + two(at.getMinutes());
  };
  const content = (kickoff, rollout) => teamContent({ settings: { countdown: { kickoff: kickoff, kickoffLabel: 'KICKOFF', rollout: rollout === undefined ? '2027-04-01T12:00' : rollout, rolloutLabel: 'ROLLOUT' } } });

  for (const [days, shown] of [[0, '00'], [4, '04'], [92, '92'], [99, '99'], [100, '100'], [146, '146']]) {
    await onPage(async world => {
      await world.draw(content(kickoffIn(days)), 'dashboard/panels/countdown/countdown.js');
      const text = selector => world.countdown.nodes[selector].textContent;
      const left = Math.floor((new Date(kickoffIn(days)) - new Date(world.now)) / 1000);
      assert.equal(text('.days-number span'), shown, days + ' days');
      assert.equal(text('.days-word'), 'DAYS');
      assert.equal(text('.hours span'), String(Math.floor(left % 86400 / 3600)).padStart(2, '0'));
      assert.equal(text('.minutes span'), String(Math.floor(left % 3600 / 60)).padStart(2, '0'));
      assert.equal(text('.seconds span'), String(left % 60).padStart(2, '0'));
    }, 'cybertron');
  }

  const states = [
    ['2027-03-01T12:00', '2027-04-01T12:00', 'KICKOFF', 'MAR 1', 'calm', 'no'],
    ['2026-11-20T12:00', '2027-04-01T12:00', 'KICKOFF', 'NOV 20', 'tense', 'no'],
    ['2026-11-02T12:00', '2027-04-01T12:00', 'KICKOFF', 'NOV 2', 'critical', 'no'],
    ['2026-10-28T09:00', '2027-04-01T12:00', 'KICKOFF', 'NOW', 'critical', 'no'],
    ['2026-09-01T09:00', '2027-04-01T12:00', 'ROLLOUT', 'APR 1', 'calm', 'no'],
    ['2026-09-01T09:00', '2026-10-01T09:00', 'COUNTDOWN OVER', '', 'calm', 'yes'],
    ['', '', 'DATE NOT SET', '', 'calm', 'yes'],
  ];
  for (const [kickoff, rollout, label, date, level, over] of states) {
    await onPage(async world => {
      await world.draw(content(kickoff, rollout), 'dashboard/panels/countdown/countdown.js');
      const name = kickoff + ' ' + rollout;
      assert.equal(world.countdown.nodes['.label'].textContent, label, name);
      assert.equal(world.countdown.nodes['.date'].textContent, date, name);
      assert.equal(world.countdown.dataset.level, level, name);
      assert.equal(world.countdown.dataset.over, over, name);
      assert.equal(world.measured.length, 0, 'nothing is measured: the label has a line of its own');
    }, 'cybertron');
  }

  // New dates from the editors reach the clock through the panel's update, which finds the clock inside the panel
  await onPage(async world => {
    await world.draw(content('2027-03-01T12:00'), 'dashboard/panels/countdown/countdown.js');
    world.module.update(world.element, content('2026-11-02T12:00', '2026-12-01T12:00'));
    world.nextTick();
    assert.deepEqual([world.countdown.dataset.level, world.countdown.nodes['.date'].textContent], ['critical', 'NOV 2']);
    world.module.update(world.element, content('2026-09-01T12:00', '2026-10-01T12:00'));
    world.nextTick();
    assert.deepEqual([world.countdown.nodes['.label'].textContent, world.countdown.dataset.over], ['COUNTDOWN OVER', 'yes']);
  }, 'cybertron');
});

test('the parts of the wide war clock are inside the housing, clear of each other and of the rivets and the cut corners, and the budget in docs/layouts.md is the numbers in countdown.css', async () => {
  const parts = wideParts();
  const doc = read('docs/layouts.md');
  const start = doc.indexOf('\n### The wide war clock\n');
  assert.ok(start !== -1, 'docs/layouts.md has a section called The wide war clock');
  const section = doc.slice(start, doc.indexOf('\n### ', start + 10));
  assert.ok(section.length > 800, 'and it is long enough to say what the clock is');

  const rows = {};
  section.split('\n').forEach(line => {
    const row = /^\| `\.([a-z-]+)` \| (\d+) \| (\d+) \| (\d+) \| (\d+) \|/.exec(line);
    if (row) rows[row[1]] = { top: Number(row[2]), height: Number(row[3]), left: Number(row[4]), width: Number(row[5]) };
  });
  assert.deepEqual(Object.keys(rows).sort(), Object.keys(parts).sort(), 'the budget has a row for each part, and no other');
  Object.keys(parts).forEach(name => assert.deepEqual(rows[name], parts[name], name + ' in the docs and in countdown.css'));

  const housing = { x: 0, y: 0, width: 616, height: 200 };
  assert.deepEqual([wideNumber('', 'width'), wideNumber('', 'height')], [616, 200], 'the clock is the size of the housing');
  Object.keys(parts).forEach(name => assert.ok(within(boxOf(parts[name]), housing), name + ' is inside the housing'));
  const names = Object.keys(parts);
  names.forEach((name, index) => names.slice(index + 1).forEach(other => assert.ok(apart(boxOf(parts[name]), boxOf(parts[other])), name + ' and ' + other + ' overlap')));
  assert.ok(parts['war-days-plate'].left + parts['war-days-plate'].width < parts['war-time-plate'].left, 'the days, a gap, the time');
  assert.equal(parts['war-status'].top + parts['war-status'].height / 2, parts['war-lines'].top + parts['war-lines'].height / 2, 'the square is level with the middle of the line');
  assert.equal(parts['war-status'].left + parts['war-status'].width + 8, parts['war-lines'].left, 'the label is 8 from its square');
  assert.equal(parts['war-days-plate'].top, parts['war-time-plate'].top);
  assert.equal(parts['war-days-plate'].height, parts['war-time-plate'].height);

  // The slot is the clock's place in the region of the countdown: 20 from the sides and in the middle of the 320
  const css = warCss();
  const slot = ruleOf(css, '.war-slot');
  assert.deepEqual([numberIn(slot, 'left'), numberIn(slot, 'top'), numberIn(slot, 'width'), numberIn(slot, 'height')], [20, 60, 616, 200]);
  assert.equal(numberIn(slot, 'left') * 2 + 616, 656, 'the same on both sides');
  assert.equal(numberIn(slot, 'top') * 2 + 200, 320, 'and above and below');
  assert.deepEqual([numberIn(ruleOf(css, '.countdown-war'), 'width'), numberIn(ruleOf(css, '.countdown-war'), 'height')], [656, 320], 'the region of the red countdown');

  // The rivets stand in the corners and no part covers one. The time plate keeps clear of the cut corner at the bottom right
  await withPlatePage(() => {
    const markup = plate.warHousingMarkup('wide');
    rivetsIn(markup).forEach(([x, y]) => names.forEach(name => assert.ok(apart({ x: x - 5, y: y - 5, width: 10, height: 10 }, boxOf(parts[name])), 'a rivet is under ' + name)));
    const time = parts['war-time-plate'];
    const corner = [time.left + time.width, time.top + time.height];
    assert.ok(distanceToLine(corner, [612, 162], [578, 196]) >= 8 + 6, 'the time plate is 6 clear of the rim at the cut corner');
    const days = parts['war-days-plate'];
    assert.ok(distanceToLine([days.left, days.top], [4, 38], [38, 4]) >= 8 + 6, 'and the days plate at the top left');
    const dark = Number(/war-weld-dark" d="M\d+ (\d+)/.exec(markup)[1]);
    assert.ok(dark > parts['war-lines'].top + parts['war-lines'].height && dark < parts['war-days-plate'].top, 'the weld seam is between the label and the plates');
  });
});

test('the digits and the labels of the wide war clock fit their boxes in the display font, every one of them is 44 px or more, and three digit days are drawn smaller', () => {
  const lines = wideRule('.war-lines');
  assert.equal(numberIn(lines, 'gap'), 24, 'the label and the date are 24 apart at the least');
  const plateInside = wideNumber('.war-days-plate', 'width') - 2 * 3;
  const gap = wideNumber('.war-days-group', 'gap');
  const word = textWidth('DAYS', 600, 44, -0.03);
  assert.ok(/letter-spacing: -\.04em;/.test(wideRule('.war-days-group .days-number')) && /letter-spacing: -\.03em;/.test(wideRule('.war-days-group .days-word')));

  // Every two digit count fits the plate, and every three digit count fits at the smaller size
  let widest = 0;
  for (let count = 0; count <= 99; count++) widest = Math.max(widest, textWidth(String(count).padStart(2, '0'), 700, 76, -0.04) + gap + word);
  assert.ok(widest <= plateInside, 'two digits and DAYS are ' + widest + ' in ' + plateInside);
  assert.ok(textWidth('100', 700, 76, -0.04) + gap + word > plateInside, 'three digits at 76 px would not fit, which is why they are smaller');
  assert.equal(wideNumber('.war-days-group .days-number.long', 'font-size'), 56);
  let worst = 0;
  for (let count = 100; count <= 999; count++) worst = Math.max(worst, textWidth(String(count), 700, 56, -0.04) + gap + word);
  assert.ok(worst <= plateInside, 'three digits at 56 px and DAYS are ' + worst + ' in ' + plateInside);

  // The time: two digits at 52 px in the box of 96, and HRS, MIN and SEC at 44 px in the cell of 98
  let pair = 0;
  for (let count = 0; count <= 99; count++) pair = Math.max(pair, textWidth(String(count).padStart(2, '0'), 700, 52, 0));
  assert.ok(pair <= wideNumber('.war-cell .digits', 'width'), 'two digits are ' + pair);
  assert.ok(wideNumber('.war-cell .digits', 'width') <= wideNumber('.war-cell', 'width'));
  ['HRS', 'MIN', 'SEC'].forEach(unit => assert.ok(textWidth(unit, 600, 44, -0.02) <= wideNumber('.war-cell', 'width'), unit));
  assert.equal(3 * wideNumber('.war-cell', 'width') + 2 * 3, wideNumber('.war-time-plate', 'width'), 'three cells inside a 3 px border');
  assert.equal(wideNumber('.war-cell .digits', 'height') + 44, wideNumber('.war-plate', 'height') - 2 * 3, 'the digits and the label fill the plate');

  // The label and the date share the line of 494: KICKOFF and ROLLOUT with the widest date, and NOW, and the end states alone
  const spacing = 0.06;
  const dates = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(month => month + ' 30');
  const widestDate = Math.max.apply(null, dates.map(date => textWidth(date, 700, 44, spacing)));
  ['KICKOFF', 'ROLLOUT'].forEach(label => assert.ok(textWidth(label, 700, 44, spacing) + 24 + widestDate <= numberIn(lines, 'width'), label + ' and the widest date fit the line'));
  ['KICKOFF', 'ROLLOUT'].forEach(label => assert.ok(textWidth(label, 700, 44, spacing) + 24 + textWidth('NOW', 700, 44, spacing) <= numberIn(lines, 'width'), label + ' and NOW'));
  ['COUNTDOWN OVER', 'DATE NOT SET'].forEach(words => assert.ok(textWidth(words, 700, 44, spacing) <= numberIn(lines, 'width'), words + ' fits the line alone'));
  assert.ok(/letter-spacing: \.06em;/.test(wideRule('.war-lines span')));
  assert.ok(/text-overflow: ellipsis;/.test(wideRule('.war-lines span')), 'a label that is too wide for its line is cut off with an ellipsis');

  // No text under 44 px in the wide clock, and no text in the file of the style
  const small = [];
  (wideSection().match(/font(-size)?: [^;]*/g) || []).forEach(text => (text.match(/(?<![\/\d.])\d+(\.\d+)?px/g) || []).filter(size => parseFloat(size) < 44).forEach(size => small.push(size)));
  assert.deepEqual(small, [], 'every text of the wide clock is 44 px or more');
  assert.ok(!/(^|[^-])font(-size)?:/.test(withoutComments(read('dashboard/styles/cybertron.css'))), 'the style file has no text of its own');
});

test('the wide war clock has the colors of the narrow one: amber digits from the style, orange in the last month, white with red borders in the last week, and nothing in it moves', () => {
  const css = wideSection();
  const clock = wideRule('');
  assert.ok(/--war-ink: var\(--style-digits, #ffb327\);/.test(clock) && /color: var\(--war-ink\);/.test(clock), 'the digits and the labels are the style\'s digits, amber when no style sets them');
  assert.ok(/--war-plate: #0c0b09;/.test(clock) && /--war-plate-border: #2b2a26;/.test(clock), 'the plates of the narrow clock');
  assert.ok(/--war-ink: var\(--danger-bright\);/.test(ruleOf(css, '.war-clock.war-wide[data-level="tense"]')));
  const critical = ruleOf(css, '.war-clock.war-wide[data-level="critical"]');
  assert.ok(/--war-ink: var\(--white\);/.test(critical) && /--war-plate-border: var\(--danger\);/.test(critical));
  assert.ok(/background: var\(--danger\);/.test(wideRule('.war-status')), 'the red status square');
  const plateRule = wideRule('.war-plate');
  assert.ok(/border: 3px solid var\(--war-plate-border\);/.test(plateRule) && /box-sizing: border-box;/.test(plateRule));
  assert.ok(/linear-gradient\(180deg, rgba\(255, 255, 255, \.08\) 0, rgba\(255, 255, 255, 0\) 45%, rgba\(0, 0, 0, \.4\) 100%\),\s*var\(--war-plate\);/.test(plateRule), 'the same gradient inside');
  assert.ok(/--style-digits: #ffb327;/.test(withoutComments(read('dashboard/styles/cybertron.css'))), 'amber in Cybertron');

  // The same strokes as the narrow housing, at least 3 px, and nothing moves or glows
  assert.ok(!/(animation|transition|@keyframes|filter|box-shadow|text-shadow|blur\(|will-change|transform|clip-path)/.test(css), 'no animation, glow, shadow or transform');
  assert.ok(!/@media|[\d.]+(vw|vh)\b/.test(css), 'nothing is responsive');
  (css.match(/stroke-width: [\d.]+px/g) || []).concat(css.match(/border: [\d.]+px/g) || []).forEach(text => assert.ok(parseFloat(/[\d.]+/.exec(text)[0]) >= 3, text));
  css.replace(/([^{}]+)\{[^{}]*\}/g, (all, list) => {
    list.split(',').forEach(selector => assert.ok(selector.trim().startsWith('.war-clock.war-wide'), 'a rule that is not for the wide war clock: ' + selector.trim()));
    return all;
  });

  // It is shown by Cybertron, and the flat finish leaves the rust of its housing off
  const style = withoutComments(read('dashboard/styles/cybertron.css'));
  assert.ok(style.includes('html[data-style="cybertron"] .war-clock { display: block; }'));
  assert.ok(style.includes('html[data-style="cybertron"][data-finish="flat"] .war-rust { display: none; }'));
  assert.ok(withoutComments(read('dashboard/panels/countdown/countdown.css')).indexOf('.war-clock { display: none; }') !== -1, 'and no other style shows it');
  const countdownCode = read('dashboard/panels/countdown/countdown.js');
  assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(|getAnimations|classList/.test(countdownCode), false, 'no animation code');
});


// The page draws the frames again when the style changes

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
      assert.equal(where, 'afterbegin');
      const child = fakeElement('markup');
      child.markup = markup;
      child.parent = element;
      element.children.unshift(child);
    },
    querySelector: selector => (selector === '.page-host' ? element.children.filter(child => child.className === 'page-host')[0] || null : null),
  };
  return element;
}

async function onAreas(run) {
  const folder = makeTree('areas', baseFiles);
  const html = { dataset: { layout: 'standard', style: 'original' }, style: { setProperty() {} } };
  const regions = {};
  const made = [];
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
        made.push(element);
      } });
      return element;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    fonts: null,
  };

  await withGlobals({ document: document, setTimeout: () => 0, setInterval: () => 0 }, async () => {
    const world = { html: html, made: made };
    world.frameModule = await import(urlOf(folder, 'dashboard/frame.js'));
    world.areas = await import(urlOf(folder, 'dashboard/core/areas.js'));
    world.style = await import(urlOf(folder, 'dashboard/core/style.js'));
    world.regions = regions;
    await run(world);
  });
}

test('redrawFrames puts the frame of the style on the page round each area that is on screen, and leaves its page where it is', async () => {
  await onAreas(async world => {
    world.frameModule.start({ motion: 'full', speed: 'normal' });
    const pageOf = text => ({ element: { id: text }, id: text });

    // an area that was made under Original gets the usual frame
    const started = world.areas.changePage('grid1', pageOf('tasks'));
    await Promise.race([started, new Promise(resolve => setImmediate(resolve))]);
    const area = world.regions['region-grid1'].children[0];
    assert.ok(area, 'the area is made');
    assert.equal(area.dataset.frame, 'grid1');
    assert.ok(area.children[0].markup.includes('grid1-a'), 'the frame of Original');
    const host = area.children.filter(child => child.className === 'page-host')[0];
    assert.ok(host, 'it has its page host');

    // the page is told to draw its frames for Cybertron, and the area has the new frame
    world.html.dataset.layout = 'standard';
    world.style.recordShapes('cybertron', world.html);
    world.areas.redrawFrames();
    assert.equal(area.dataset.frame, 'cybertron-grid1');
    assert.ok(area.children[0].markup.includes('cybertron-grid1-a') && !area.children[0].markup.includes('class="glint"'), 'the frame of Cybertron');
    assert.equal(area.children.filter(child => child.className === 'page-host')[0], host, 'the page host is the same one');
    assert.equal(area.children.length, 2, 'the old frame is gone, not kept beside the new one');

    // drawn again for the same frames it does nothing, and back to Original it is the first frame again
    const before = area.children[0];
    world.areas.redrawFrames();
    assert.equal(area.children[0], before);
    world.style.recordShapes('original', world.html);
    world.areas.redrawFrames();
    assert.equal(area.dataset.frame, 'grid1');
    assert.ok(area.children[0].markup.includes('grid1-a') && !area.children[0].markup.includes('cybertron'));
  });
});

test('the frames are drawn again in the same step that puts the style on the page, and the banner and the countdown of the standard layout with them', () => {
  const shell = read('dashboard/shell.js');
  assert.ok(shell.includes("import { redrawFrames } from './core/areas.js';"));
  assert.ok(shell.includes("import { applyStyle, recordShapes, shapesFor, shapesNow, startStyle } from './core/style.js';"));
  const body = /function useStyle\(look\) \{([\s\S]*?)\n\}/.exec(shell)[1];
  assert.ok(body.indexOf('applyStyle(look.style);') < body.indexOf('recordShapes(look.style);') && body.indexOf('recordShapes(look.style);') < body.indexOf('redrawFrames();') && body.indexOf('redrawFrames();') < body.indexOf('redrawWhatStays();'), 'the style, then the corners, then the areas, then the panels that stay');
  assert.ok(body.includes('if (shapesFor(look.style) === shapesNow()) return;'), 'a style with the frames the page has changes nothing');
  assert.ok(body.includes('catch'), 'a problem never stops the colors');

  const redraw = /function redrawWhatStays\(\) \{([\s\S]*?)\n\}/.exec(shell)[1];
  assert.ok(redraw.includes("layoutNow() !== 'standard'"), 'only the standard layout draws the banner and the countdown that differ');
  assert.ok(redraw.includes('!stayStarted'), 'and only when they are on screen');
  assert.ok(redraw.includes("showFixedPanel(id, false)"), 'they are there at once');
  assert.ok(/stayStarted = true;/.test(shell));
  assert.ok(shell.includes("else element.dataset.state = 'shown';"), 'a panel that takes the place of one on screen has its parts shown');

  // the areas module draws them again for the frames the page has
  const areas = read('dashboard/core/areas.js');
  assert.ok(areas.includes('export function redrawFrames() {'));
  assert.ok(areas.includes('const kind = frameKind(region, layoutNow(), shapesNow());'));
  assert.ok(areas.includes("if (kind !== 'ticker') area.insertAdjacentHTML('afterbegin', areaMarkup(kind));"));
  assert.ok(areas.includes(".filter(child => !child.classList.contains('page-host'))"), 'the page host stays');

  // theme-apply.js does not reload for it: holdForLayout only looks at the layout and, in the bar layout, the corners
  assert.ok(read('dashboard/core/layout-apply.js').includes('drawnFor(layoutFor(look.style, layoutOf(look.theme)), shapesFor(look.style))'));
});


// What Cybertron paints

test('Cybertron paints the gunmetal plates, the steel edge and the page the order gives, on the layout of Original, and the steel reaches the frames through the tokens', () => {
  const css = withoutComments(read('dashboard/styles/cybertron.css'));
  const value = property => new RegExp(property + ': ([^;]+);').exec(css)[1];
  assert.equal(value('--style-body'), '#15181f', 'the body of a plate');
  assert.equal(value('--style-raised'), '#262b33', 'a raised plate');
  assert.equal(value('--style-chamfer'), '56px');
  assert.equal(value('--style-grid-size'), '96px');
  assert.equal(value('--style-grid-opacity'), '.07');
  assert.equal(value('--style-scan-opacity'), '.035');
  assert.equal(value('--style-neon'), 'var(--team-neon)');
  assert.equal(value('--style-pink'), 'var(--team-pink)');

  // the plate of a frame and of the banner is the body, the header tab is the armor plate with the team's plate color inset
  assert.ok(/html\[data-style="cybertron"\] \.area,\s*html\[data-style="cybertron"\] \.banner \{\s*--panel-face: var\(--style-body\);/.test(css));
  assert.ok(css.includes('html[data-style="cybertron"] .area .plate .header-left { fill: url(#armor-face); }'));
  assert.ok(/fill: var\(--team-plate\);/.test(withoutComments(read('dashboard/base.css'))), 'the tab has the team plate color inset (base.css)');

  // the tokens give the steel to every area and to the page, whatever the page change says, and the style is not a bar style
  const tokens = withoutComments(read('dashboard/tokens.css'));
  assert.ok(tokens.includes('html[data-style="cybertron"] [data-metal]') && tokens.includes('html[data-style="cybertron"],'));
  assert.ok(!/bar-/.test(css), 'nothing in the style file is for the bar layout');

  // the stylesheet of the style is for its own style only, and Original paints none of it
  css.replace(/([^{}]+)\{[^{}]*\}/g, (all, list) => {
    list.split(',').forEach(selector => assert.ok(selector.trim().startsWith('html[data-style="cybertron"]'), 'for Cybertron only: ' + selector.trim()));
    return all;
  });
  const base = withoutComments(read('dashboard/base.css'));
  assert.ok(/\.art-cybertron \{ display: none; \}/.test(base), 'what only Cybertron draws is off until it is on');
  assert.ok(/html\[data-style="original"\] \.rivets \{ display: inline; \}/.test(base), 'Original keeps its rivets and ids, and Cybertron has none');
  assert.ok(!/cybertron/.test(withoutComments(read('dashboard/styles/original.css'))), 'Original has nothing of Cybertron');
});

test('docs/layouts.md describes the two styles and which layout each uses, and the numbers in its Cybertron section are the ones in the code', () => {
  const doc = read('docs/layouts.md');
  const section = doc.slice(doc.indexOf('\n## Cybertron\n'), doc.indexOf('\n## What else works in each layout'));
  assert.ok(section.length > 2000, 'docs/layouts.md has a section called Cybertron');

  // the frames table
  const kinds = { 'cybertron-grid1': [56, 24, 150, 6], 'cybertron-grid2': [56, 24, 120, 6], 'cybertron-banner': [32, 16, 100, 6], 'cybertron-ticker': [32, 16, 100, 2] };
  Object.keys(kinds).forEach(kind => {
    const shape = plate.barShape(kind);
    const line = section.split('\n').find(text => text.startsWith('| `' + kind + '` |'));
    assert.ok(line, 'the table has a row for ' + kind);

    const cells = line.split('|').map(cell => cell.trim());
    assert.equal(cells[2], shape.width + ' x ' + shape.height, kind + ': drawn for');
    assert.equal(Number(cells[3]), shape.outline[2][0] - shape.outline[1][0], kind + ': the cut corner');
    assert.equal(Number(cells[4]), shape.outline[4][1] - shape.outline[3][1], kind + ': the step');
    assert.equal(Number(cells[5]), (shape.width - 4) - shape.outline[3][0], kind + ': the run');
    assert.equal(Number(cells[6]), shape.screws.a.length + shape.screws.b.length, kind + ': the bolts');
    assert.deepEqual([Number(cells[3]), Number(cells[4]), Number(cells[5]), Number(cells[6])], kinds[kind]);
  });

  // the stage
  const stage = cybertronStage();
  ['| Banner | 228 |', '| Top margin | 20 |', '| Gap under the banner and under the large frame | 14 |'].forEach(text => assert.ok(section.includes(text), 'the stage table has ' + text));
  assert.equal(stage.rows[0], 228);

  // the layouts and the styles
  const flat = text => text.replace(/\s+/g, ' ');
  assert.ok(/The style Minimal has it/.test(flat(doc.slice(0, doc.indexOf('## How a layout is chosen')))), 'the list of layouts says which style has the bar layout');
  assert.ok(/Original and Cybertron keep the layout of the theme/.test(flat(doc.slice(doc.indexOf('## How a layout is chosen'), doc.indexOf('## The screen is a fixed canvas')))), 'the choice of the layout says Cybertron keeps the layout of the theme');
  assert.ok(section.includes('redrawFrames') && section.includes('?style=cybertron'));
  assert.ok(section.includes('616 by 200') && section.includes('The wide war clock') && doc.includes('### The wide war clock'));

  // the mirror and the other docs
  assert.ok(section.includes('styles/original.css'));
  ['README.md', 'docs/switch-the-look.md', 'docs/editing-content.md', 'docs/where-things-are.md', 'docs/try-it-on-the-mini.md'].forEach(file => assert.ok(!/Cybertron and Minimal have the bar layout|Cybertron and Minimal have a banner|cybertron` and `minimal` have the bar layout/.test(read(file).replace(/\s+/g, ' ')), file + ' still says Cybertron has the bar layout'));
});

// A page that the banner and the countdown can be drawn on, as in test-layouts.mjs: a fake clock and a fake page, and the real panels

const panelFiles = baseFiles.concat(['dashboard/panels/countdown/countdown.js', 'dashboard/panels/banner/banner.js']);
let pageWorlds = 0;

function makeNode(log, name) {
  let text = '';
  let html = '';
  const node = {
    isConnected: true,
    dataset: {},
    style: {},
    classList: {
      toggle: token => log.push(name + '.class-' + token),
      add: token => log.push(name + '.class-' + token),
      remove: token => log.push(name + '.class-' + token),
    },
    animate: () => { log.push(name + '.animate'); return {}; },
    parentNode: null,
  };
  Object.defineProperty(node, 'textContent', { get: () => text, set: value => { text = String(value); log.push(name + '.text'); } });
  Object.defineProperty(node, 'innerHTML', { get: () => html, set: value => { html = String(value); log.push(name + '.html'); } });
  return node;
}

// A box that gives one node for each selector, and 12 segments for .segment
function makeBox(log, prefix) {
  const nodes = {};
  const segments = Array.from({ length: 12 }, () => makeNode(log, prefix + '.segment'));
  const box = makeNode(log, prefix);

  box.nodes = nodes;
  box.querySelector = selector => {
    if (!nodes[selector]) {
      nodes[selector] = makeNode(log, prefix + ' ' + selector);
      if (selector === '.days-number span') nodes[selector].parentNode = makeNode(log, prefix + ' .days-number');
    }
    return nodes[selector];
  };
  box.querySelectorAll = selector => (selector === '.segment' ? segments : []);
  return box;
}

// Runs run(world) with the real panels and frame.js on a fake page whose clock is at 12:59:20 on Wed Oct 28 2026. shapes is
// the corners the page has been drawn with: '' for Original, or 'cybertron'. world.draw(content, file) mounts a panel
async function onPage(run, shapes) {
  const folder = makeTree('page-' + (pageWorlds += 1), panelFiles);
  const RealDate = Date;
  const world = { now: new RealDate(2026, 9, 28, 12, 59, 20, 250).getTime(), timers: [], nextTimer: 1, measured: [], log: [] };

  class FakeDate extends RealDate {
    constructor(...parts) {
      if (parts.length === 0) super(world.now);
      else super(...parts);
    }
    static now() { return world.now; }
  }

  world.nextTick = () => {
    world.timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const timer = world.timers.shift();
    world.now = Math.max(world.now, timer.at);
    timer.action();
  };
  world.pen = { font: '', measureText: text => { world.measured.push(text); return { width: text.length * 22 }; } };

  world.draw = (content, panelFile) => {
    const element = makeBox(world.log, 'panel');
    const countdown = makeBox(world.log, 'countdown');
    const real = element.querySelector;
    element.querySelector = selector => (selector === '.war-clock' ? countdown : real(selector));
    const host = { set innerHTML(markup) { world.markup = markup; }, get firstElementChild() { return element; }, querySelector: selector => (selector === '.war-clock' ? countdown : null) };

    world.element = element;
    world.countdown = countdown;
    return import(urlOf(folder, panelFile)).then(module => {
      module.mount(host, content);
      world.module = module;
      return module;
    });
  };

  const dataset = { layout: 'standard' };
  if (shapes) dataset.shapes = shapes;
  await withGlobals({
    Date: FakeDate,
    setTimeout: (action, milliseconds) => { world.timers.push({ at: world.now + (milliseconds || 0), id: world.nextTimer++, action: action }); return world.nextTimer; },
    setInterval: () => 0,
    document: {
      documentElement: { dataset: dataset, style: { setProperty() {} } },
      createElement: () => ({ getContext: () => world.pen }),
      getElementById: id => (id === 'metal-shapes' ? { insertAdjacentHTML() {} } : null),
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  }, async () => {
    world.frame = await import(urlOf(folder, 'dashboard/frame.js'));
    world.frame.start({ motion: 'full', speed: 'normal' });
    world.folder = folder;
    await run(world);
  });
}

const teamContent = fields => Object.assign({
  team: { name: 'HAWKTIMUS PRIME', number: '3229', school: 'HOLLY SPRINGS HIGH SCHOOL' },
  weather: { temperature: 104, code: 3, isDay: true },
  status: { source: 'sanity' },
  settings: { countdown: { kickoff: '2027-03-01T12:00', kickoffLabel: 'KICKOFF', rollout: '2027-04-01T12:00', rolloutLabel: 'ROLLOUT' } },
}, fields);


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
