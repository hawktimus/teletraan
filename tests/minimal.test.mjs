// Tests for the Minimal style on the bar layout: what it is meant to have (the banner with
// the narrow war clock, the side column and its rail, the one main panel, the ticker, the steel
// frames with the thin neon line, the 34 px cuts, four hex bolts, rivets, the weld seam, the rust
// and the ticks), what it must not have (any serial text, hazard
// stripes, scanlines, slashes, conduit and corner brackets, which are Cybertron's), and what it
// shares with Cybertron. The two stylesheets are compared rule by rule, so a rule that makes the
// two read alike has to be named here. Nothing touches the network or a browser.
//
//   node tests/minimal.test.mjs
//
// What it looks like is checked by looking at the screen (docs/layouts.md, "Looking at a layout").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';
import { readModule } from './helpers/read-module.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(root, 'dashboard');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-toolmal-'));

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

// The files every tree has: the configuration, the registries and everything in core/
const baseFiles = ['dashboard/config.js', 'dashboard/frame.js', 'dashboard/registry.js', 'dashboard/themes/registry.js', 'dashboard/themes/overlays/registry.js']
  .concat(fs.readdirSync(path.join(dashboardFolder, 'core')).filter(name => name.endsWith('.js')).map(name => 'dashboard/core/' + name));

const mainTree = makeTree('main', baseFiles);
const layout = await import(urlOf(mainTree, 'dashboard/core/layout.js'));
const styles = await import(urlOf(mainTree, 'dashboard/core/style.js'));
const plate = await import(urlOf(mainTree, 'dashboard/core/plate.js'));

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
function withPlatePage(run) {
  const known = new Set();
  return withGlobals({
    document: {
      getElementById: id => {
        if (id !== 'metal-shapes') return known.has(id) ? {} : null;
        return { insertAdjacentHTML: (where, markup) => (markup.match(/ id="[^"]+"/g) || []).forEach(found => known.add(found.slice(5, -1))) };
      },
    },
  }, run);
}

const countOf = (text, word) => (text.match(new RegExp(word, 'g')) || []).length;
const hasText = (markup, text) => markup.indexOf(text) !== -1;

// The rules of a stylesheet as { selectors, body }, with the comments taken out
function rulesOf(file) {
  const found = [];
  withoutComments(read(file)).replace(/([^{}]+)\{([^{}]*)\}/g, (all, list, body) => {
    found.push({ selectors: list.split(',').map(selector => selector.trim()), body: body.replace(/\s+/g, ' ').trim() });
    return all;
  });
  return found;
}

// The custom properties of the first rule of a style's stylesheet, by name
function propertiesOf(file) {
  const found = {};
  rulesOf(file)[0].body.split(';').map(text => text.trim()).filter(Boolean).forEach(text => {
    found[text.slice(0, text.indexOf(':')).trim()] = text.slice(text.indexOf(':') + 1).trim();
  });
  return found;
}

// A selector with the name of its style taken out, so one style's rule can be set beside the other's
const unstyled = selector => selector.replace(/\[data-(style|layout)="[a-z]+"\]/, '[style]');

const minimalKinds = ['bar-main-minimal', 'bar-banner-minimal', 'bar-ticker-minimal'];
const cybertronOnly = ['art-cybertron', 'art-hazard', 'art-conduit', 'art-slashes', 'art-brackets', 'art-seams'];
const b = layout.barGeometry;


// What Minimal must not have

test('no frame of Minimal has a stamped plate id or any serial text, a hazard stripe, conduit, slashes, brackets, plate seams or a glint, and its wide neon lines are the glow of a team that has it', async () => {
  await withPlatePage(() => {
    const markups = { 'bar-main-minimal': plate.areaMarkup('bar-main-minimal'), 'bar-banner-minimal': plate.plateMarkup('bar-banner-minimal'), 'bar-ticker-minimal': plate.areaMarkup('bar-ticker-minimal') };

    minimalKinds.forEach(kind => {
      const shape = plate.barShape(kind);
      const markup = markups[kind];

      assert.equal(shape.number, undefined, kind + ' has no number for a stamped id');
      assert.deepEqual(shape.bracketLines, [], kind + ' has no brackets');
      ['edge-neon-wide-2', 'edge-neon-wide-1', 'edge-neon'].forEach(name => assert.ok(countOf(markup, 'class="' + name + '"') >= 2, kind + ' has ' + name + ', and the wider ones are hidden unless the team has Glow (base.css)'));
      ['plate-id', 'data-number', 'HP-', 'glint', 'screw-shape', 'screw-shadow'].concat(cybertronOnly).forEach(text => assert.ok(!hasText(markup, text), kind + ' has no ' + text));
      ['hazard', 'conduit', 'slashes', 'brackets', 'seams'].forEach(name => assert.ok(!shape.art[name], kind + ' draws no ' + name));
    });

    // The only decoration is the weld seam and the header line with its ticks, on the tall panel
    const drawn = kind => Object.keys(plate.barShape(kind).art).filter(name => plate.barShape(kind).art[name]).sort();
    assert.deepEqual(drawn('bar-main-minimal'), ['headerLine', 'ticks', 'weldDark', 'weldLight']);
    assert.deepEqual(drawn('bar-banner-minimal'), []);
    assert.deepEqual(drawn('bar-ticker-minimal'), []);

    // The header line has its two wider lines for the glow, behind it
    const main = plate.areaMarkup('bar-main-minimal');
    assert.equal(countOf(main, 'class="art-glow art-glow-header-2"'), 2, 'once in the frame and once in the piece that it is cut into');
    assert.equal(countOf(main, 'class="art-glow art-glow-header-1"'), 2);
    assert.ok(main.indexOf('art-glow-header-2') < main.indexOf('art-glow-header-1') && main.indexOf('art-glow-header-1') < main.indexOf('art-header-line'), 'the wider lines are drawn first, so the line is over them');
  });

  // The option that gave a bar frame a stamped id is gone, and so is the code that drew it for a bar frame
  const code = read('dashboard/core/plate.js');
  assert.ok(!/\bid: '0\d'/.test(code) && !code.includes('options.id') && !code.includes('stampMarkup'), 'plate.js cannot stamp a bar frame');
  const sequence = /'bar-banner': \{([^}]*)\}/.exec(read('dashboard/frame.js'))[1];
  assert.ok(!sequence.includes('plate-id'), 'and the banner\'s table of frame.js has no line for an id');
});

test('the page of Minimal has no scanlines, no raised plate, no stamped id and no mark of Cybertron: its stylesheet and the files of the bar layout say so', () => {
  const css = withoutComments(read('dashboard/layouts/bar-minimal.css'));

  assert.ok(!/repeating-linear-gradient|scan-opacity|--style-raised|plate-id|#screen::after/.test(css), 'no scanlines, no raised plate, no id, and nothing painted over the stage');
  cybertronOnly.forEach(name => assert.ok(!css.includes(name), 'Minimal does not paint ' + name));
  assert.ok(css.includes('html[data-layout="bar"] .header svg.double-slash { display: none; }'), 'the // mark of a header is off, because the pictures have no slashes');

  // The bar layout and its panels have no id, serial text, hazard stripe, slash, conduit, bracket or scanline of their own
  const files = ['dashboard/layouts/bar.css', 'dashboard/panels/bar-banner/panel.css', 'dashboard/panels/bar-banner/panel.js', 'dashboard/panels/bar-column/panel.css', 'dashboard/panels/bar-column/panel.js'];
  files.forEach(file => {
    const text = withoutComments(read(file));
    assert.ok(!/plate-id|teamInitials|team-initials|\bHP-|serial|hazard|conduit|bracket|slash|scanline|repeating-linear-gradient/i.test(text), file + ' has none of them');
    assert.equal(/content: ["'][^"']/.test(text), false, file + ' writes no text with css');
  });

  // No stylesheet shows a stamped id any more: Original had one and it was taken out
  const shown = [];
  const walk = folder => fs.readdirSync(path.join(root, folder), { withFileTypes: true }).forEach(entry => {
    const relative = folder + '/' + entry.name;
    if (entry.isDirectory()) { if (!['fonts', 'data', 'assets'].includes(entry.name)) walk(relative); return; }
    if (!entry.name.endsWith('.css')) return;

    rulesOf(relative).forEach(rule => rule.selectors.filter(selector => /plate-id/.test(selector) && /display: (block|inline)/.test(rule.body)).forEach(selector => shown.push(relative + ' ' + selector)));
  });
  walk('dashboard');
  assert.deepEqual(shown, [], 'no style shows an id');
});


// What Minimal has

test('the layout of Minimal has fixed numbers: the banner 1856 x 160 with the war clock 766 x 128 at one end, the rail 12 and the column 300, the main panel 1484 x 736, and the ticker 1856 x 72', () => {
  assert.deepEqual([b.banner.width, b.banner.height], [1856, 160]);
  assert.deepEqual([b.war.width, b.war.height], [766, 128]);
  assert.equal(b.war.x + b.war.width, b.banner.x + b.banner.width - layout.barSettings.bannerPadding, 'the clock is at the right end of the banner');
  assert.ok(b.name.x < b.war.x && b.name.x + b.name.width <= b.war.x, 'the name is at the other end');
  assert.deepEqual([b.rail.width, b.column.width], [12, 300]);
  assert.deepEqual([b.main.width, b.main.height], [1484, 736]);
  assert.deepEqual([b.ticker.width, b.ticker.height], [1856, 72]);
  assert.equal(b.rail.height, b.main.height, 'the rail and the column are as high as the main panel');
  assert.equal(b.column.height, b.main.height);
  assert.ok(b.rail.x < b.column.x && b.column.x + b.column.width < b.main.x, 'the rail, the column, then the main panel');
  assert.equal(b.ticker.y + b.ticker.height + layout.barSettings.margin.bottom, layout.screen.height, 'the ticker is the bottom row');

  // One layout, one main panel: Minimal is the only style with the bar layout, and there is no small frame
  assert.equal(styles.layoutFor('minimal', 'standard'), 'bar');
  assert.equal(styles.layoutFor('minimal', 'sidebar'), 'bar');
  ['original', 'cybertron'].forEach(style => assert.notEqual(styles.layoutFor(style, 'standard'), 'bar', style + ' has the layout of its theme'));
  assert.equal(layout.hasRegion('bar', 'grid2'), false);
  assert.equal(layout.hasRegion('bar', 'countdown'), false);

  const column = read('dashboard/panels/bar-column/panel.js');
  const parts = ['class="bar-rail"', 'class="bar-time"', 'class="bar-date"', 'class="bar-weather"', 'class="bar-team"', 'class="bar-school"', 'class="logo bar-logo"'];
  parts.forEach(part => assert.ok(column.includes(part), 'the column has ' + part));
  assert.deepEqual(parts.slice().sort((one, other) => column.indexOf(one) - column.indexOf(other)), parts, 'the rail, then the clock, the date, the weather, the TEAM plate, the school and the hawk, from the top');
});

test('the frames of Minimal are steel with a thin neon line 10 inside, cuts of 34, a hex bolt at each of the four joints, rivets along the long edges, one weld seam on the tall panel, rust at two corners and ticks along the header line', async () => {
  await withPlatePage(() => {
    ['bar-main-minimal', 'bar-banner-minimal'].forEach(kind => {
      const shape = plate.barShape(kind);
      assert.equal(shape.outline[2][0] - shape.outline[1][0], 34, kind + ': the cut corner');
      assert.equal(shape.outline[7][0] - shape.outline[6][0] < 0 ? shape.outline[6][0] - shape.outline[7][0] : shape.outline[7][0] - shape.outline[6][0], 34, kind + ': and the other');
    });
    assert.equal(plate.barShape('bar-ticker-minimal').outline[2][0] - plate.barShape('bar-ticker-minimal').outline[1][0], 20, 'the ticker is 72 high and has a smaller cut');

    minimalKinds.forEach(kind => {
      const shape = plate.barShape(kind);
      const bolts = shape.screws.a.concat(shape.screws.b).map(point => point.join(',')).sort();
      assert.deepEqual(bolts, [1, 2, 6, 7].map(index => shape.outline[index].join(',')).sort(), kind + ': a bolt at each of the four joints');
      const neonIn = kind === 'bar-ticker-minimal' ? 7 : 10; // the ticker has the thin plate edge (base.css), so its neon is 7 inside the line
      assert.deepEqual(shape.neon.a, plate.offsetOutline(shape.outline, neonIn).slice(0, 6), kind + ': the neon line is the outline ' + neonIn + ' inside');
      assert.ok(shape.rivets.a.length + shape.rivets.b.length >= 10, kind + ': rivets along the long edges');
      assert.equal(shape.wear.length, 2, kind + ': rust at two corners');
      assert.ok(shape.wear.every(item => /^M[\d. ]+Q[\d. -]+$/.test(item.arc)), kind + ': each arc is a stroked curve');
    });

    const main = plate.barShape('bar-main-minimal');
    assert.ok(main.art.weldDark && main.art.weldLight, 'the weld seam is on the tall panel');
    assert.equal(main.art.weldDark.split('M').length - 1, 1, 'one seam, and it is vertical');
    assert.ok(/^M(\d+) \d+L\1 \d+$/.test(main.art.weldDark));
    assert.ok(main.art.headerLine && main.art.ticks, 'the ticks are along the header line');
    ['bar-banner-minimal', 'bar-ticker-minimal'].forEach(kind => assert.ok(!plate.barShape(kind).art.weldDark, kind + ' is not tall, so it has no seam'));

    // The header is a raised armor tab with the team's plate color inset
    const markup = plate.areaMarkup('bar-main-minimal');
    ['class="tab-inset"', 'class="tab-bevel"', 'class="tab-line"'].forEach(text => assert.ok(hasText(markup, text), 'the tab has ' + text));
    assert.equal(countOf(markup, 'href="#bolt-shape"'), 4 + 4, 'hex bolts, four in the frame and four in the pieces');
  });

  const properties = propertiesOf('dashboard/layouts/bar-minimal.css');
  assert.equal(properties['--style-chamfer'], '34px');
  assert.equal(properties['--style-grid-size'], '48px');
  assert.equal(properties['--style-grid-opacity'], '.07');
  assert.equal(properties['--style-body'], 'var(--team-body)', 'the plates are the team\'s body color');
  assert.equal(properties['--style-digits'], 'var(--team-neon)', 'the digits of the war clock are the team\'s neon');
});

test('the war clock is the narrow form, 766 x 128, in Minimal and the wide form, 616 x 200, in Cybertron, and Original has neither', async () => {
  await withPlatePage(() => {
    const narrow = plate.warHousingMarkup('narrow');
    const wide = plate.warHousingMarkup('wide');
    assert.ok(hasText(narrow, 'width="766" height="128" viewBox="0 0 766 128"'));
    assert.ok(hasText(wide, 'width="616" height="200" viewBox="0 0 616 200"'));
    assert.ok(hasText(plate.warHousingMarkup(), 'width="766" height="128"'), 'narrow is the form when none is asked for');
    assert.ok(hasText(plate.warHousingMarkup('narrow', {}, true), 'width="766" height="144" viewBox="0 0 766 144"'), 'and 16 higher for a title on two lines');
    assert.ok(hasText(plate.warHousingMarkup('wide', {}, true), 'width="616" height="240" viewBox="0 0 616 240"'), 'and the wide one 40 higher');
  });

  const minimal = withoutComments(read('dashboard/layouts/bar-minimal.css'));
  const cybertron = withoutComments((read('dashboard/styles/cybertron/tokens.css') + read('dashboard/styles/cybertron/theme.css')));
  const original = withoutComments(read('dashboard/styles/original/theme.css'));
  assert.ok(minimal.includes('html[data-layout="bar"] .war-clock { display: block; }'));
  assert.ok(cybertron.includes('html[data-style="cybertron"] .war-clock { display: block; }'));
  assert.ok(!/war-/.test(original), 'Original has no war clock');

  assert.ok(/--style-digits: var\(--team-neon\);/.test(minimal) && /--style-digits: #ffb327;/.test(cybertron), 'team neon in Minimal, amber in Cybertron');
  assert.ok(read('dashboard/panels/bar-banner/panel.js').includes('${warMarkup()}'), 'the banner of Minimal draws the narrow form');
  assert.ok(read('dashboard/panels/countdown/panel.js').includes("warMarkup('wide')"), 'the countdown of Cybertron draws the wide one');
});

test('the mirror turns the regions of Minimal and nothing in them: the rail, the column and the main panel change places, and no rule of its style turns a frame', () => {
  const m = layout.mirrorGeometry(b);
  assert.deepEqual([m.rail.x, m.column.x, m.main.x, m.war.x], [1876, 1552, 32, 72], 'the rail and the column at the right, the main panel and the war clock at the left');
  assert.deepEqual([m.main.width, m.main.height, m.war.width, m.war.height], [1484, 736, 766, 128], 'the same sizes');

  const css = withoutComments(read('dashboard/layouts/bar.css') + read('dashboard/layouts/bar-minimal.css'));
  assert.ok(/html\.mirrored\[data-layout="bar"\] #bar-middle/.test(css), 'the row turns with the mirror');
  assert.ok(!/mirrored[^{}]*\.(area|plate|rivets|art-[a-z-]+)\b|scaleX\(-1\)[^}]*\.(area|plate)/.test(css), 'no rule turns a frame or what is drawn on it');
});


// What the two steel styles share

test('Minimal and Cybertron share an explicit list of rules and of values, and every other rule and value is one style\'s', () => {
  const minimal = rulesOf('dashboard/layouts/bar-minimal.css');
  const cybertron = rulesOf('dashboard/styles/cybertron/theme.css');
  const bodyOf = (rules, selector) => (rules.filter(rule => rule.selectors.map(unstyled).includes(selector))[0] || {}).body;

  // A rule with the same selectors (the style's name left out) and the same body in both stylesheets, apart from the first rule,
  // which sets the custom properties and is compared value by value below
  const shared = [];
  minimal.slice(1).forEach(rule => {
    const other = cybertron.slice(1).filter(candidate => candidate.selectors.map(unstyled).join() === rule.selectors.map(unstyled).join())[0];
    if (other && other.body === rule.body) shared.push(rule.selectors.map(unstyled).join(', '));
  });
  assert.deepEqual(shared, [
    'html[style] #screen::before', // the grid layer: it reads --style-grid-size, which is 96 px in one and 48 px in the other
    'html[style] .area .plate .header-left', // the armor tab, which both have
    'html[style] .area .plate .header-right',
    'html[style] .team-fill, html[style] .tag-fill, html[style] .card-fill', // the TEAM plate, the ticker's tag and the cards in the team's plate color
    'html[style] .sponsor-feature .card-fill, html[style] .photo .card-fill', // the cards that only hold a picture have no fill
    'html[style] .header svg.double-slash', // off in both, because the pictures of both have no // mark
    'html[style] .war-clock', // shown by both: the narrow form in one and the wide form in the other
  ]);
  // The face of a plate is the same rule for the banner of each layout, and it reads --style-body, which is the team's body color in both
  assert.equal(bodyOf(minimal, 'html[style] .bar-banner'), '--panel-face: var(--style-body);');
  assert.equal(bodyOf(cybertron, 'html[style] .banner'), '--panel-face: var(--style-body);');

  // The custom properties: what is the same, what differs, and what only Cybertron has
  const one = propertiesOf('dashboard/layouts/bar-minimal.css');
  const other = propertiesOf('dashboard/styles/cybertron/tokens.css');
  const same = Object.keys(one).filter(name => other[name] === one[name]).sort();
  const differ = Object.keys(one).filter(name => other[name] !== undefined && other[name] !== one[name]).sort();
  // the armor colors and the rust are tokens (tokens.css), the same for the bar layout and for Cybertron
  assert.deepEqual(same, ['--style-body', '--style-grid-opacity', '--style-neon', '--style-pink']);
  assert.deepEqual(differ, ['--style-chamfer', '--style-digits', '--style-grid-size']);
  assert.deepEqual(Object.keys(other).filter(name => one[name] === undefined).sort(), ['--style-armor-bottom', '--style-armor-top', '--style-raised', '--style-rust', '--style-scan-opacity']);
  assert.deepEqual(Object.keys(one).filter(name => other[name] === undefined), [], 'Minimal sets nothing that Cybertron does not');

  // Both plates are the team's body color, and the cuts and the grids are different
  assert.equal(other['--style-body'], 'var(--team-body)');
  assert.equal(other['--style-raised'], '#262b33');
  assert.equal(other['--style-chamfer'], '56px');
  assert.equal(other['--style-grid-size'], '96px');
  assert.equal(other['--style-scan-opacity'], '.035');
  assert.equal(one['--style-body'], 'var(--team-body)');
  assert.equal(one['--style-chamfer'], '34px');
  assert.equal(one['--style-grid-size'], '48px');

  // Each paints the parts of a frame that only it has, and neither names the other's
  const text = { minimal: withoutComments(read('dashboard/layouts/bar-minimal.css')), cybertron: withoutComments((read('dashboard/styles/cybertron/tokens.css') + read('dashboard/styles/cybertron/theme.css'))) };
  assert.ok(!/art-(minimal|weld|header-line|ticks|smudge|wear)|rivets|plate-id|bar-rail/.test(text.cybertron), 'Cybertron paints none of Minimal\'s');
  cybertronOnly.forEach(name => assert.ok(!text.minimal.includes(name), 'Minimal paints none of Cybertron\'s: ' + name));
  rulesOf('dashboard/layouts/bar-minimal.css').forEach(rule => rule.selectors.forEach(selector => assert.ok(selector.startsWith('html[data-layout="bar"]'), 'the bar drawing only has rules for the bar layout: ' + selector)));
  rulesOf('dashboard/styles/cybertron/theme.css').concat(rulesOf('dashboard/styles/cybertron/tokens.css')).forEach(rule => rule.selectors.forEach(selector => assert.ok(selector.startsWith('html[data-style="cybertron"]'), 'cybertron only has rules for itself: ' + selector)));

  // The sheets that every theme loads name a theme in only three places: the metal and the screws in tokens.css for Cybertron, the rivets
  // in base.css for Original, and the bolts of Cybertron's ticker in frame.css. The bar layout is named by data-layout, not by a style.
  const named = [];
  const walk = folder => fs.readdirSync(path.join(root, folder), { withFileTypes: true }).forEach(entry => {
    const relative = folder + '/' + entry.name;
    if (entry.isDirectory()) { if (!['fonts', 'data', 'assets', 'styles'].includes(entry.name)) walk(relative); return; }
    if (!entry.name.endsWith('.css')) return;

    (withoutComments(read(relative)).match(/data-style="[a-z]+"/g) || []).forEach(found => named.push(relative + ' ' + found));
  });
  walk('dashboard');
  assert.deepEqual(named.filter(text => !text.endsWith('data-style="black"')).sort(), [
    'dashboard/base.css data-style="original"',
    'dashboard/frame.css data-style="cybertron"',
    'dashboard/tokens.css data-style="cybertron"',
    'dashboard/tokens.css data-style="cybertron"',
    'dashboard/tokens.css data-style="cybertron"',
    'dashboard/tokens.css data-style="cybertron"',
    'dashboard/tokens.css data-style="cybertron"',
  ]);
});

test('docs/layouts.md says what Minimal does not have and what it shares with Cybertron', () => {
  const doc = read('docs/layouts.md');
  const section = doc.slice(doc.indexOf('#### Minimal'), doc.indexOf('## Cybertron'));
  assert.ok(section.length > 500, 'docs/layouts.md has a section called Minimal');

  ['serial text', 'scanlines', 'raised plate', 'hazard stripe', 'conduit', 'slashes', 'brackets', 'plate seams', 'wide neon lines', '`//` mark'].forEach(text => assert.ok(section.includes(text), 'the section says ' + text));
  assert.ok(section.includes('What Minimal and Cybertron share, and why'));
  assert.ok(section.includes('tests/minimal.test.mjs'));
  assert.ok(!/HP-0\d/.test(section) && !section.includes('| Stamped id |'), 'and no id for Minimal');
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
