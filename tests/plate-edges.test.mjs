// Tests for the thin plate edge: the TEAM plate, the ticker's tag and the frame round the ticker (base.css,
// "The thin plate edge", and docs/layouts.md, "The thin plate edge"). The edge is a third to a half thinner than
// the other frames', the other frames keep theirs, and the text on these plates is clear of the metal:
// the TEAM text and the longest numbers the plates hold, the name above the plate, TELETRAAN I under it,
// the ticker's line and the word on its tag. Nothing touches the network or a browser.
//
//   node tests/plate-edges.test.mjs
//
// The sizes of the letters (how high they are, where they sit in their line) are measured on a
// render and written below. What it looks like is checked by looking at the screen (docs/layouts.md,
// "Looking at a layout").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { readModule } from './helpers/read-module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-plate-edges-'));

function copyInto(folder, from, to) {
  fs.mkdirSync(path.dirname(path.join(folder, to)), { recursive: true });
  copyModule(path.join(root, from), path.join(folder, to));
}

function makeTree(name, files) {
  const folder = path.join(workFolder, name);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'package.json'), '{ "type": "module" }\n');
  files.forEach(file => copyInto(folder, file, file));
  return folder;
}

const urlOf = (folder, file) => pathToFileURL(path.join(folder, file)).href;
const read = file => readModule(path.join(root, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

const tree = makeTree('plate', ['dashboard/core/plate.js', 'dashboard/core/text-width.js']);
const plate = await import(urlOf(tree, 'dashboard/core/plate.js'));
const { textWidth } = await import(urlOf(tree, 'dashboard/core/text-width.js'));

const tests = [];

function test(name, run) {
  tests.push({ name: name, run: run });
}

// plate.js adds each frame's shapes to a hidden group of the page, once. A page with only that group stands in for it.
async function withPlatePage(run) {
  const kept = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    value: { getElementById: id => (id === 'metal-shapes' ? { insertAdjacentHTML: () => {} } : null) },
    configurable: true,
    writable: true,
  });
  try {
    return await run();
  } finally {
    if (kept) Object.defineProperty(globalThis, 'document', kept);
    else delete globalThis.document;
  }
}


// The stylesheets, read as a list of rules with their numbers

function rulesOf(file) {
  const rules = [];
  withoutComments(read(file)).replace(/([^{}]+)\{([^{}]*)\}/g, (all, list, body) => {
    const declarations = {};
    body.split(';').forEach(part => {
      const at = part.indexOf(':');
      if (at > 0) declarations[part.slice(0, at).trim()] = part.slice(at + 1).trim();
    });
    rules.push({ selectors: list.split(',').map(selector => selector.trim()), declarations: declarations });
    return all;
  });
  return rules;
}

// What a stylesheet declares for a selector: the last rule that names it and has the property wins, as it does on the page
function declared(rules, selector, property) {
  const found = rules.filter(rule => rule.selectors.includes(selector) && rule.declarations[property] !== undefined).pop();
  assert.ok(found, selector + ' has no ' + property);
  return found.declarations[property];
}

const px = value => Number(/^-?[\d.]+/.exec(value)[0]);
const baseRules = rulesOf('dashboard/base.css');
const tokens = rulesOf('dashboard/tokens.css');
const tokenPx = name => px(declared(tokens, ':root', name));

// The size of the text in a font shorthand: a number of px, or a token
function sizeOf(font) {
  const found = /^\d+ (?:var\((--[a-z-]+)\)|(\d+)px)\//.exec(font);
  assert.ok(found, 'cannot read the size in ' + font);
  return found[1] ? tokenPx(found[1]) : Number(found[2]);
}

const thinSelectors = ['.team-plate-art', '.tag-plate', '.area[data-area="ticker"]'];
const layers = ['edge-shadow', 'edge-rim', 'edge-face', 'edge-shade', 'edge-ridge'];

// The edge of a plate or the ticker's frame: the stroke of each layer, and where the shadow falls
function thinEdge() {
  const width = layer => px(declared(baseRules, thinSelectors[0] + ' .' + layer, 'stroke-width'));
  const shadow = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(declared(baseRules, thinSelectors[0] + ' .edge-shadow', 'transform'));
  return { rim: width('edge-rim'), face: width('edge-face'), shadowWidth: width('edge-shadow'), shade: width('edge-shade'), shadowX: Number(shadow[1]), shadowY: Number(shadow[2]) };
}

// The edge the other frames have, in the rules at the top of "The edge" in base.css
function fullEdge() {
  const width = layer => px(declared(baseRules, '.' + layer, 'stroke-width'));
  return { rim: width('edge-rim'), face: width('edge-face'), shadowWidth: width('edge-shadow'), shade: width('edge-shade') };
}


// What was measured on a render of the letters (1920 x 1080, the fonts of the screen)

// The display face (Tomorrow 700): the capitals and the digits are .75 of the size high, and they sit .03 of the size
// under the middle of their line
const capHeight = 0.75;
const belowMiddle = 0.03;
// The same face at 96 px, the name: the foot of the capitals is 38 under the middle of its line
const nameFoot = 38;
// The text of the ticker (Atkinson Hyperlegible Next 500, 56 px, in a line of 64 centred in the row of 72): from the top of the
// tall letters to the foot of the descenders it is 53 high, and it spans 12 to 65 of the row
const messageInk = { top: 12, bottom: 65 };
// The room to keep round the ink, in px. The places of the letters are known to half a pixel (the measure is of whole pixels),
// so the tests ask for 1.5 where the docs say 2
const clear = 2;
const known = 0.5;


// The edge

test('the thin edge is between a third and a half thinner than the edge of the other frames, in the same five layers', () => {
  const thin = thinEdge();
  const full = fullEdge();

  assert.deepEqual([full.rim, full.face, full.shadowWidth], [16, 12, 16], 'the other frames have the edge they had: a rim of 16 and a face of 12');
  [['rim', thin.rim], ['face', thin.face], ['shadow', thin.shadowWidth]].forEach(([name, width]) => {
    const less = 1 - width / (name === 'face' ? full.face : full.rim);
    assert.ok(less >= 1 / 3 - 1e-9 && less <= 1 / 2 + 1e-9, name + ' is ' + width + ' wide, which is ' + Math.round(less * 100) + ' percent less');
  });
  assert.ok(thin.shade <= full.shade && thin.shade >= 3, 'the shade is no wider, and no line is thinner than 3 px');
  assert.ok(thin.face >= 3 && thin.rim > thin.face, 'the face is inside the rim, and no line is thinner than 3 px');

  // the rules are there for each of the five layers of each of the three, and each is one of the layers plate.js draws
  thinSelectors.forEach(selector => layers.forEach(layer => {
    const rule = baseRules.filter(item => item.selectors.includes(selector + ' .' + layer)).pop();
    assert.ok(rule, selector + ' has a rule for ' + layer);
  }));
  const code = read('dashboard/core/plate.js');
  layers.forEach(layer => assert.ok(code.includes("'" + layer + "'"), 'plate.js draws ' + layer));
  assert.equal(thin.shadowX, thin.shadowY, 'the shadow falls down and to the right by the same');
});

test('the edge of every other frame is as it was, and only the three ticker frames and the two plates ask for the thin one', async () => {
  const full = fullEdge();
  assert.deepEqual([full.rim, full.face, full.shade], [16, 12, 4]);
  assert.equal(declared(baseRules, '.edge-shadow', 'transform'), 'translate(5px, 6px)');
  assert.equal(declared(baseRules, '.edge-ridge', 'transform'), 'translate(-4px, -4px)');
  assert.equal(px(declared(baseRules, '.edge-ridge', 'stroke-width')), 3);

  // the shapes: the line of every bar frame is 4 inside its box, the ticker's is 1 inside
  const lineOf = kind => {
    const shape = plate.barShape(kind);
    return Math.min.apply(null, shape.outline.map(point => point[0]));
  };
  ['bar-main', 'bar-banner', 'bar-main-minimal', 'bar-banner-minimal', 'cybertron-grid1', 'cybertron-grid2', 'cybertron-banner'].forEach(kind => assert.equal(lineOf(kind), 4, kind + ' keeps its line'));
  ['bar-ticker', 'bar-ticker-minimal', 'cybertron-ticker'].forEach(kind => assert.equal(lineOf(kind), 1, kind + ' has the thin edge'));
  assert.equal(plate.barShape('cybertron-grid1').neon.a[0][0], 14, 'the neon of the large frame is 10 inside its line, as it was');

  // the frames of the other layouts are not bar frames, and no thin rule is for one of them
  assert.equal(plate.barShape('grid1'), null);
  thinSelectors.forEach(selector => assert.ok(!/grid|countdown|banner|screen|card|main/.test(selector), selector + ' is not a panel frame'));
});

test('the flat finish and the plain look still make these edges one plain stroke: the thin rules set widths and one shadow offset, and nothing the flat rules take away or colour', () => {
  const flat = baseRules.filter(rule => rule.selectors.some(selector => selector.startsWith('[data-finish="flat"]')));
  const hidden = flat.filter(rule => rule.declarations.display === 'none').reduce((all, rule) => all.concat(rule.selectors), []);
  ['edge-shadow', 'edge-rim', 'edge-shade', 'edge-ridge'].forEach(layer => assert.ok(hidden.includes('[data-finish="flat"] .' + layer), 'the flat finish hides ' + layer));
  assert.equal(declared(baseRules, '[data-finish="flat"] .edge-face', 'stroke'), 'var(--edge-flat)', 'and colours the face one plain colour');

  baseRules.filter(rule => rule.selectors.some(selector => thinSelectors.some(thin => selector.startsWith(thin + ' .edge-')))).forEach(rule => {
    Object.keys(rule.declarations).forEach(property => assert.ok(['stroke-width', 'transform'].includes(property), rule.selectors[0] + ' sets ' + property));
  });
  assert.ok(thinEdge().face >= 3, 'the one plain stroke of the flat finish is not thinner than 3 px');
  assert.ok(/:root\[data-look="plain"\] \.screw/.test(withoutComments(read('dashboard/base.css'))), 'the plain look takes away the screws, as it did');
});


// The TEAM plate

// The three places the plate is drawn, with the stylesheet of each: the banner, the side column of the bar layout (Minimal) and the
// sidebar. The width of each is the number in its script.
const widthIn = file => Number(/const TEAM_PLATE_WIDTH = (\d+);/.exec(read(file))[1]);
const plates = {
  banner: { width: 520, file: 'dashboard/panels/banner/panel.css', span: '.banner .team-plate span', number: '.banner .team-plate b' },
  bar: { width: widthIn('dashboard/panels/bar-column/panel.js'), file: 'dashboard/panels/bar-column/panel.css', span: 'html[data-layout="bar"] .bar-team span', number: 'html[data-layout="bar"] .bar-team b' },
  side: { width: widthIn('dashboard/panels/side/panel.js'), file: 'dashboard/panels/side/panel.css', span: 'html[data-layout="sidebar"] .side-team span', number: 'html[data-layout="sidebar"] .side-team b' },
};

// The points of the plate's polygon, as plate.js draws it for a width
async function pointsOf(width) {
  return withPlatePage(() => {
    const markup = plate.teamPlateMarkup(width);
    return /<polygon class="team-fill" points="([^"]*)"/.exec(markup)[1].split(' ').map(pair => pair.split(',').map(Number));
  });
}

// The box of the ink of TEAM and a number, and the plain purple of the plate
async function layoutOf(name, number) {
  const spec = plates[name];
  const rules = rulesOf(spec.file);
  const edge = thinEdge();
  const points = await pointsOf(spec.width);
  const inner = plate.offsetOutline(points, edge.rim / 2);

  const font = declared(rules, spec.span, 'font');
  const size = sizeOf(font);
  // a number the stylesheet gives the span, or 0 when it does not
  const given = (key, unit) => {
    const rule = rules.filter(item => item.selectors.includes(spec.span) && item.declarations[key] !== undefined).pop();
    if (!rule) return 0;
    assert.ok(rule.declarations[key].endsWith(unit), key + ' is written in ' + unit);
    return px(rule.declarations[key]);
  };
  const padding = { top: given('padding-top', 'px'), bottom: given('padding-bottom', 'px'), right: given('padding-right', 'px') };
  const spacing = given('letter-spacing', 'em') * size; // the stylesheet writes the space between letters in em
  const gap = px(declared(rules, spec.number, 'margin-left'));

  // the space after TEAM is dropped at the end of the line of the flex row, and the number is gap away from the word
  const letters = 4 + number.length;
  const width = textWidth('TEAM', 700, size) + gap + textWidth(number, 700, size) + spacing * letters;
  const left = (spec.width - padding.right - width) / 2;
  const ink = {
    left: left,
    right: left + width - spacing,
    top: (padding.top + 76 - padding.bottom) / 2 + belowMiddle * size - capHeight * size / 2,
    bottom: (padding.top + 76 - padding.bottom) / 2 + belowMiddle * size + capHeight * size / 2,
  };

  // the plain purple: the metal's inner edge, and inside the top and the left the dark that the shadow throws
  const plain = { left: points[0][0] + edge.rim / 2 + edge.shadowX, top: points[0][1] + edge.rim / 2 + edge.shadowY, bottom: inner[3][1] };
  const cut = (y, from, to) => from[0] + (y - from[1]) * (to[0] - from[0]) / (to[1] - from[1]);
  const right = Math.min(inner[1][0], ink.bottom >= inner[2][1] ? cut(ink.bottom, inner[2], inner[3]) : inner[1][0]);
  return { ink, plain: Object.assign(plain, { right: right }), points, size };
}

test('the TEAM plate has its metal where the plate was, sideways, and inside its box up and down, so it never reaches the name above it or TELETRAAN I under it', async () => {
  const edge = thinEdge();
  for (const name of Object.keys(plates)) {
    const width = plates[name].width;
    const points = await pointsOf(width);
    const half = edge.rim / 2;
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);

    assert.equal(Math.min.apply(null, xs) - half, -4, name + ': the metal starts 4 left of the box, as the thick edge did');
    assert.equal(Math.max.apply(null, xs) + half, width + 4, name + ': and ends 4 right of it');
    assert.ok(Math.min.apply(null, ys) - half >= 0, name + ': the metal starts inside the box');
    assert.ok(Math.max.apply(null, ys) + half + edge.shadowY <= 76, name + ': and so does its shadow, at the foot');
    assert.equal(points.length, 5, name + ': the plate has its one cut corner');
    assert.equal(points[2][0], width - 1);
    assert.equal(points[3][0], width - 41, name + ': the cut corner is 40 wide, as it was');
    assert.ok(Math.abs((points[3][1] - points[2][1]) / 40 - 0.775) < 0.01, name + ': and at the same slant');
  }
});

test('the TEAM text has 2 px clear of the metal, and of the dark inside the plate, above and below, on the three plates', async () => {
  for (const name of Object.keys(plates)) {
    const found = await layoutOf(name, '3229');
    assert.ok(found.ink.top - found.plain.top >= clear - known, name + ': ' + (found.ink.top - found.plain.top).toFixed(1) + ' clear above the capitals');
    assert.ok(found.plain.bottom - found.ink.bottom >= clear - known, name + ': ' + (found.plain.bottom - found.ink.bottom).toFixed(1) + ' clear below them');
  }
});

test('the TEAM text has 2 px clear at both ends for the numbers each plate holds: six digits of the widest kind in the banner, five in the sidebar and four in the bar layout', async () => {
  const holds = [['banner', '999999'], ['banner', '123456'], ['banner', '3229'], ['side', '99999'], ['side', '3229'], ['bar', '3229'], ['bar', '3426']];
  for (const [name, number] of holds) {
    const found = await layoutOf(name, number);
    assert.ok(found.ink.left - found.plain.left >= clear - known, name + ' ' + number + ': ' + (found.ink.left - found.plain.left).toFixed(1) + ' clear at the left');
    assert.ok(found.plain.right - found.ink.right >= clear - known, name + ' ' + number + ': ' + (found.plain.right - found.ink.right).toFixed(1) + ' clear at the right, which is the cut corner at the foot of the letters');
  }

  // The bar layout's plate is 300 wide: five digits at 44 px do not fit it, which the docs say
  const five = await layoutOf('bar', '99999');
  assert.ok(five.plain.right - five.ink.right < 0 || five.ink.left - five.plain.left < 0, 'five digits do not fit the bar layout\'s plate');
  assert.ok(read('docs/layouts.md').includes('the bar layout\'s plate cannot hold five at 44 px'), 'and the docs say so');
});

test('the TEAM text is as large as it was: the banner keeps 60 px and the other two the label size, none under 44', async () => {
  assert.equal((await layoutOf('banner', '3229')).size, 60);
  assert.equal((await layoutOf('bar', '3229')).size, 44);
  assert.equal((await layoutOf('side', '3229')).size, 44);
});

test('the metal and the shadow of the plate stay clear of the name above it and of TELETRAAN I under it, in Original and in Cybertron', () => {
  const edge = thinEdge();
  const banner = rulesOf('dashboard/panels/banner/panel.css');
  const cybertron = rulesOf('dashboard/styles/cybertron/theme.css');
  const half = edge.rim / 2;
  const top = 8; // the line of the plate at the top (teamPlateMarkup)
  const foot = 69; // and at the bottom

  // Original: the name is in a box of 76 with a line of 76, then a gap of 8, then the plate
  const name = { height: px(declared(banner, '.banner .team-name', 'height')), line: Number(/\/(\d+)px/.exec(declared(banner, '.banner .team-name', 'font'))[1]) };
  const gap = px(declared(banner, '.banner .banner-left', 'gap'));
  const original = { plateTop: name.height + gap, nameFoot: name.line / 2 + nameFoot };
  assert.ok(original.plateTop + top - half - original.nameFoot >= clear, 'Original: the metal is ' + (original.plateTop + top - half - original.nameFoot) + ' under the foot of the name');

  // Cybertron: no gap, a name box of 72 with a line of 70
  const own = { height: px(declared(cybertron, 'html[data-style="cybertron"] .banner .team-name', 'height')), line: px(declared(cybertron, 'html[data-style="cybertron"] .banner .team-name', 'line-height')) };
  assert.equal(px(declared(cybertron, 'html[data-style="cybertron"] .banner .banner-left', 'gap')), 0, 'Cybertron has no gap under the name');
  const cybertronFoot = own.line / 2 + nameFoot;
  assert.ok(own.height + top - half - cybertronFoot >= 1, 'Cybertron: the metal is ' + (own.height + top - half - cybertronFoot) + ' under the foot of the name');
  assert.ok(own.line < name.line, 'and the line of 76 that left the foot of the name 4 under the box is gone');
  // the outline of the letters of a team with Outline (Nova) is 2 wider, the 4 px stroke of trim.css, and touches the metal at the most
  const stroke = Number(/-webkit-text-stroke: (\d+)px/.exec(withoutComments(read('dashboard/trim.css')))[1]);
  assert.ok(own.height + top - half - (cybertronFoot + stroke / 2) >= 0, 'and the outline of Nova\'s name does not go under it');

  // The wordmark is 44 high and fills its row, which starts where the plate's box ends in Cybertron and 8 under it in Original
  assert.ok(foot + half + edge.shadowY <= 76, 'the shadow of the plate ends inside its box, so it is not over the top of TELETRAAN I');
  assert.equal(px(declared(banner, '.banner .team-plate', 'height')), 76);
});


// The ticker

test('the ticker\'s tag and its three frames have the same line, 1 inside, so the metal of the tag is the metal of the bar, and they are 5 higher than the row', async () => {
  const rows = ['bar-ticker', 'bar-ticker-minimal', 'cybertron-ticker'];
  const edge = thinEdge();
  const tagPoints = await withPlatePage(() => /<polygon class="tag-fill" points="([^"]*)"/.exec(plate.tagMarkup(328))[1].split(' ').map(pair => pair.split(',').map(Number)));

  rows.forEach(kind => {
    const shape = plate.barShape(kind);
    assert.equal(shape.height, 72 + 5, kind + ' is drawn for the row and 5 more');
    const ys = shape.outline.map(point => point[1]);
    assert.deepEqual([Math.min.apply(null, ys), Math.max.apply(null, ys)], [tagPoints[0][1], tagPoints[2][1]], kind + ': the top and the foot are the tag\'s');
    assert.equal(Math.min.apply(null, ys) - edge.rim / 2, -4, kind + ': the metal starts 4 over the row, as the thick edge did');
    assert.equal(shape.still, true, kind + ' holds still');
  });
  assert.equal(tagPoints.length, 4);
  assert.equal(tagPoints[0][1], tagPoints[1][1]);
  assert.equal(tagPoints[2][1], tagPoints[3][1]);
  assert.ok(Math.abs((tagPoints[0][0] - tagPoints[3][0]) - (tagPoints[2][0] - tagPoints[1][0])) < 0.01, 'the same slant at both ends');

  const tag = rulesOf('dashboard/panels/ticker/panel.css');
  assert.equal(px(declared(tag, '.ticker .tag', 'height')), 72, 'the tag is in the row');
  assert.equal(px(declared(tag, '.ticker .tag span', 'height')), 77, 'and its word is in the middle of the picture, which is 77 high');
  assert.equal(px(declared(baseRules, '.area[data-area="ticker"]', 'height')), 72, 'the area of the ticker is the row of 72');
});

test('the ticker\'s line is between the neon lines with 2 px to spare, and the word on the tag is far inside its plate', () => {
  const edge = thinEdge();
  for (const kind of ['bar-ticker', 'bar-ticker-minimal', 'cybertron-ticker']) {
    const shape = plate.barShape(kind);
    const top = Math.min.apply(null, shape.outline.map(point => point[1]));
    const foot = Math.max.apply(null, shape.outline.map(point => point[1]));
    const neonIn = shape.neon.a[0][0] - shape.outline[0][0]; // how far inside the line the neon is, from a point on the left edge
    const band = { top: top + neonIn + 2, bottom: foot - neonIn - 2 }; // the neon is 4 wide
    assert.equal(neonIn, 7, kind + ': the neon is 7 inside the line');
    assert.ok(messageInk.top - band.top >= clear - known, kind + ': ' + (messageInk.top - band.top) + ' under the top neon');
    assert.ok(band.bottom - messageInk.bottom >= clear - known, kind + ': ' + (band.bottom - messageInk.bottom) + ' over the foot neon');
    assert.equal(top + neonIn - 2, top + edge.rim / 2, kind + ': the neon is against the metal');
  }

  // the word on the tag: 44 px, 33 high, in the middle of a plate whose plain purple is 8 to 71
  const word = { size: tokenPx('--size-label') };
  const middle = 77 / 2 + belowMiddle * word.size;
  const ink = { top: middle - capHeight * word.size / 2, bottom: middle + capHeight * word.size / 2 };
  assert.ok(ink.top - (1 + edge.rim / 2 + edge.shadowY) >= 10 && 76 - edge.rim / 2 - ink.bottom >= 10, 'the word has more than 10 px above and below it');
  assert.equal(word.size, 44);
});

test('the message stops before the stepped end of the frame, the end that has no tag, and the mirror puts the margin at the other end', () => {
  const standard = rulesOf('dashboard/styles/cybertron/theme.css');
  const bar = rulesOf('dashboard/layouts/bar.css');
  const padding = 16; // the row's own padding in both (cybertron.css, bar.css)
  const cases = [
    { kind: 'cybertron-ticker', rules: standard, selector: 'html[data-style="cybertron"] .ticker .message', mirrored: 'html[data-style="cybertron"].mirrored .ticker .message' },
    { kind: 'bar-ticker-minimal', rules: bar, selector: 'html[data-layout="bar"] .ticker .message', mirrored: 'html.mirrored[data-layout="bar"] .ticker .message' },
  ];

  cases.forEach(item => {
    const shape = plate.barShape(item.kind);
    const run = shape.width - 1 - shape.outline[3][0]; // how far from the end of the row the top edge begins to drop
    const margin = px(declared(item.rules, item.selector, 'margin-right'));
    // the metal and the neon at the drop reach about 7 beyond its first point, and the row ends 1 past the line
    assert.ok(padding + margin >= run + 1 + 7, item.kind + ': the message ends ' + (padding + margin) + ' from the end of the row, and the step begins ' + (run + 1) + ' from it');
    assert.equal(px(declared(item.rules, item.mirrored, 'margin-right')), 0, item.kind + ' mirrored: no margin at the tag');
    assert.equal(px(declared(item.rules, item.mirrored, 'margin-left')), margin, item.kind + ' mirrored: the margin is at the other end');
  });
  assert.equal(px(declared(standard, 'html[data-style="cybertron"] .ticker', 'padding').split(' ')[1]), padding);
  assert.equal(px(declared(bar, 'html[data-layout="bar"] .ticker', 'padding').split(' ')[1]), padding);
});

test('the Studio\'s 52 characters still have the room beside the longest tag: the message is wide enough for 52 letters of ordinary text at 56 px', () => {
  // Atkinson Hyperlegible Next 500 takes about .46 of the size per letter in ordinary text (52 letters of a sentence fit exactly, on the render)
  const letter = 0.46 * tokenPx('--size-body');
  const row = 1840;
  const tag = Number(/reminder: \{ word: 'REMINDER', width: (\d+) \}/.exec(read('dashboard/panels/ticker/panel.js'))[1]);
  const gap = px(declared(rulesOf('dashboard/panels/ticker/panel.css'), '.ticker', 'gap'));
  const room = row - 2 * 16 - tag - gap - px(declared(rulesOf('dashboard/styles/cybertron/theme.css'), 'html[data-style="cybertron"] .ticker .message', 'margin-right'));
  assert.ok(room >= 52 * letter, 'the message is ' + room + ' wide and 52 letters are ' + Math.round(52 * letter));
  assert.ok(/Up to 52 characters fit/.test(read('studio/schemas/tipOrNews.js')), 'the Studio says 52');
});


// The docs

test('docs/layouts.md has the numbers of the thin edge and of the plates', () => {
  const doc = read('docs/layouts.md');
  const section = doc.slice(doc.indexOf('#### The thin plate edge'), doc.indexOf('#### Minimal'));
  assert.ok(section.length > 1500, 'docs/layouts.md has a section called The thin plate edge');
  const edge = thinEdge();
  const full = fullEdge();
  const row = text => section.split('\n').find(line => line.startsWith('| ' + text));
  assert.ok(row('Shadow and rim').includes(full.rim + ' px') && row('Shadow and rim').includes(edge.rim + ' px'));
  assert.ok(row('Face').includes(full.face + ' px') && row('Face').includes(edge.face + ' px'));
  assert.ok(row('Shadow offset').includes(edge.shadowX + ' right and down'));
  ['1 px in from the sides', '8 px in from the top and 7 px in from the bottom', '15 to 64', 'line height of 70', '77 high, 5 more than the row', '7 px inside the line', '18 px outside it', '94 px', 'REMINDER'].forEach(text => assert.ok(section.replace(/\s+/g, ' ').includes(text), 'the section says ' + text));
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
