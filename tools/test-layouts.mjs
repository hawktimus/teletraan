// Tests for the layouts: which layout a theme and a style have, the numbers of the
// sidebar layout (dashboard/core/layout.js: the strip, the sidebar, the pane and the
// ticker) and of the bar layout (the banner, the side column, the main panel and the
// ticker), how the page is set up for them
// (core/layout-apply.js, with a fake page), that the scheduler leaves out the
// small frame, which blocks fly apart in a hidden transition, that seasonal packs
// draw only what a layout allows, how the mirror turns the layouts round, that the
// screen is always 1920 x 1080, the frames of the bar layout (their shapes, their
// parts and where they land on the screen), the steel and what Cybertron paints,
// and that the stylesheets and the docs agree with the numbers. Nothing touches the
// network or a browser.
//
//   node tools/test-layouts.mjs
//
// What the layouts look like is checked by looking at the screen
// (docs/layouts.md, "Looking at a layout").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(root, 'dashboard');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-layouts-'));

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

// The real layout code, with the files it reads
const mainTree = makeTree('main', [
  'dashboard/config.js', 'dashboard/registry.js', 'dashboard/themes/registry.js', 'dashboard/themes/overlays/registry.js',
  'dashboard/core/layout.js', 'dashboard/core/layout-apply.js', 'dashboard/core/theme.js', 'dashboard/core/style.js',
  'dashboard/core/season.js', 'dashboard/core/marks.js',
]);
const layout = await import(urlOf(mainTree, 'dashboard/core/layout.js'));
const apply = await import(urlOf(mainTree, 'dashboard/core/layout-apply.js'));
const season = await import(urlOf(mainTree, 'dashboard/core/season.js'));
const styles = await import(urlOf(mainTree, 'dashboard/core/style.js'));
const { themes } = await import(urlOf(mainTree, 'dashboard/themes/registry.js'));
const { panels } = await import(urlOf(mainTree, 'dashboard/registry.js'));
const config = await import(urlOf(mainTree, 'dashboard/config.js'));

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

// A page that only has an html element with a data-layout, and the corners of its frames when it has some
const pageWith = (name, shapes) => ({ documentElement: { dataset: Object.assign(name === undefined ? {} : { layout: name }, shapes ? { shapes: shapes } : {}) } });


// Which layout a theme has

test('the standard layout is the default, and Neon Prime has the sidebar layout', () => {
  assert.deepEqual(layout.layouts, ['standard', 'sidebar', 'bar']);
  assert.equal(layout.defaultLayout, 'standard');
  assert.equal(layout.layoutOf('hawktimus'), 'standard');
  assert.equal(layout.layoutOf('alternate'), 'standard');
  assert.equal(layout.layoutOf('neon-prime'), 'sidebar');
  themes.forEach(theme => assert.notEqual(layout.layoutOf(theme.id), 'bar', theme.id + ': no theme has the bar layout, a style does'));
});

test('a theme with no layout, an unknown layout or no registry entry gets the standard layout', () => {
  const list = [{ id: 'a' }, { id: 'b', layout: 'sidebar' }, { id: 'c', layout: 'upside-down' }, { id: 'd', layout: 'standard' }];
  assert.equal(layout.layoutOf('a', list), 'standard');
  assert.equal(layout.layoutOf('b', list), 'sidebar');
  assert.equal(layout.layoutOf('c', list), 'standard');
  assert.equal(layout.layoutOf('d', list), 'standard');
  [undefined, null, '', 'no-such-theme', 7, {}].forEach(odd => assert.equal(layout.layoutOf(odd), 'standard', String(odd)));
});

test('every layout the registry names is a layout, and the registry and the Studio copy say the same', () => {
  themes.forEach(theme => assert.ok(theme.layout === undefined || layout.isLayout(theme.layout), theme.id));
  assert.ok(themes.some(theme => theme.layout === 'sidebar'), 'at least one theme has the sidebar layout');

  const studio = read('studio/themes.js');
  themes.forEach(theme => {
    const entry = studio.slice(studio.indexOf("id: '" + theme.id + "'"));
    const own = entry.slice(0, entry.indexOf('},'));
    assert.equal(/layout: '([a-z]+)'/.exec(own) ? /layout: '([a-z]+)'/.exec(own)[1] : 'standard', theme.layout || 'standard', theme.id + ' in studio/themes.js');
  });
});


// The layout the screen starts in, before any content is read

const noon = new Date('2026-10-10T16:00:00Z');
const dayOf = date => date.toISOString().slice(0, 10);

test('with nothing saved and nothing asked the layout is standard', () => {
  assert.equal(layout.chooseLayout(null, null, noon), 'standard');
  assert.equal(layout.chooseLayout(undefined, undefined, noon), 'standard');
  assert.equal(layout.chooseLayout({}, '', noon), 'standard');
});

test('the address wins over the saved Theme document, and an unknown theme in the address is ignored', () => {
  assert.equal(layout.chooseLayout(null, 'neon-prime', noon), 'sidebar');
  assert.equal(layout.chooseLayout({ defaultTheme: 'neon-prime' }, 'hawktimus', noon), 'standard');
  assert.equal(layout.chooseLayout({ defaultTheme: 'neon-prime' }, 'no-such-theme', noon), 'sidebar');
});

test('the saved Theme document decides: the default theme, Use now with its Until time, and the schedule', () => {
  assert.equal(layout.chooseLayout({ defaultTheme: 'neon-prime' }, null, noon), 'sidebar');
  assert.equal(layout.chooseLayout({ useNow: { theme: 'neon-prime', until: '' } }, null, noon), 'sidebar');
  assert.equal(layout.chooseLayout({ useNow: { theme: 'neon-prime', until: '2026-10-10T15:00:00Z' } }, null, noon), 'standard', 'Use now has run out');
  assert.equal(layout.chooseLayout({ useNow: { theme: 'neon-prime', until: '2026-10-10T17:00:00Z' } }, null, noon), 'sidebar');

  const rule = { name: '[Rule]', kind: 'theme', theme: 'neon-prime', startDate: dayOf(noon), endDate: dayOf(noon), repeatsEveryYear: false };
  assert.equal(layout.chooseLayout({ schedule: [rule] }, null, noon), 'sidebar');
  assert.equal(layout.chooseLayout({ schedule: [rule] }, null, new Date('2026-10-12T16:00:00Z')), 'standard', 'the rule has ended');
});

test('anything that goes wrong gives the standard layout', () => {
  assert.equal(layout.chooseLayout('oops', null, noon), 'standard');
  assert.equal(layout.chooseLayout({ schedule: 'oops', useNow: 5 }, null, noon), 'standard');
  assert.equal(layout.chooseLayout({ defaultTheme: 'neon-prime' }, null, new Date('not a date')), 'standard', 'a clock that cannot be read');
  assert.equal(layout.chooseLayout({ get defaultTheme() { throw new Error('broken'); } }, null, noon), 'standard');
});

test('layoutNow reads data-layout from the page, and is standard with no page or no attribute', async () => {
  assert.equal(layout.layoutNow(), 'standard', 'node has no page');
  await withGlobals({ document: pageWith('sidebar') }, () => assert.equal(layout.layoutNow(), 'sidebar'));
  await withGlobals({ document: pageWith('standard') }, () => assert.equal(layout.layoutNow(), 'standard'));
  await withGlobals({ document: pageWith(undefined) }, () => assert.equal(layout.layoutNow(), 'standard'));
  await withGlobals({ document: pageWith('upside-down') }, () => assert.equal(layout.layoutNow(), 'standard'));
});


// The numbers of the sidebar layout

const g = layout.sidebarGeometry;
const settings = layout.sidebarSettings;
const margins = settings.margin;
// HAWKTIMUS PRIME in the display font, 700 weight, on one line, measured in a real render
const nameWidth = { 96: 984.6, 104: 1066.6, 112: 1148.7, 120: 1230.7, 128: 1312.8 };

const within = (inner, outer) => inner.x >= outer.x - 1e-9 && inner.y >= outer.y - 1e-9 &&
  inner.x + inner.width <= outer.x + outer.width + 1e-9 && inner.y + inner.height <= outer.y + outer.height + 1e-9;
const apart = (a, b) => a.x + a.width <= b.x + 1e-9 || b.x + b.width <= a.x + 1e-9 || a.y + a.height <= b.y + 1e-9 || b.y + b.height <= a.y + 1e-9;
const insideMargins = { x: margins.left, y: margins.top, width: layout.screen.width - margins.left - margins.right, height: layout.screen.height - margins.top - margins.bottom };

test('the sidebar is 384 wide, 20 percent of the screen, which is the widest of the 15 to 20 percent the layout allows', () => {
  assert.equal(settings.sidebarWidth, 384);
  assert.equal(settings.sidebarWidth, layout.screen.width * 0.2, '20 percent');
  assert.ok(settings.sidebarWidth >= layout.screen.width * 0.15 && settings.sidebarWidth <= layout.screen.width * 0.2, 'between 15 and 20 percent (288 and 384)');
  assert.equal(g.sidebar.width, settings.sidebarWidth);
});

test('the strip runs the whole width between the margins, and holds HAWKTIMUS PRIME on one line at 96 px or more', () => {
  assert.ok(settings.nameSize >= 96, 'the name is a heading, and a heading is 96 px or more');
  assert.equal(g.strip.x, margins.left);
  assert.equal(g.strip.y, margins.top, 'the strip is at the top margin');
  assert.equal(g.strip.width, layout.screen.width - margins.left - margins.right, 'across the whole width');
  assert.ok(g.strip.height >= settings.nameSize, 'the line of the name is as high as its size, and the strip is at least that high');

  const width = nameWidth[settings.nameSize];
  assert.ok(width, 'the width of the name at ' + settings.nameSize + ' px has been measured (nameWidth in this file)');
  assert.ok(width + 64 <= g.strip.width, 'the name and the 32 px each side of its slot fit on one line');
  assert.ok(g.strip.width - 64 - width >= 400, 'and 400 px or more are left at the right end of the strip');
});

// The widths of the parts at their worst case text, in the display font at the sizes side.css uses, measured
// in a real render (px). The clock is 10:59 PM, MON MAR 29 and 104°F, the countdown ROLLOUT IN, MAR 29, 399
// days and 49 for the hours, minutes and seconds, the plate TEAM 32290, and the school HOLLY SPRINGS HIGH SCHOOL.
const worst = {
  time: 280, suffix: 71, date: 288, weatherIcon: 48, temperature: 126,
  rolloutIn: 277, mar29: 177, daysWord: 118, days399: 285, unit: 95, team32290: 298, highSchool: 311, sampleBadge: 230,
  wordmarkAt44: 385.4, // 876 by 100 at 44 px high
};

test('the clock, the date and the weather have the right end of the strip, and the name keeps the rest of it on one line with a gap between', () => {
  const clock = settings.stripClockWidth;
  assert.ok(clock >= worst.time + 14 + worst.suffix, 'the time with AM or PM fits on its row (14 between them, as side.css has)');
  assert.ok(clock >= worst.date + 16 + worst.weatherIcon + 12 + worst.temperature, 'the date and the weather fit on their row with 16 between them');

  const nameSlot = g.strip.width - 32 - clock - 16 - 32; // the slot of the name: 32 at the left, then 16 short of the clock
  assert.ok(nameWidth[settings.nameSize] <= nameSlot, 'the name is not squeezed: ' + nameWidth[settings.nameSize] + ' in ' + nameSlot);

  // the clock block is as high as the strip allows
  const css = withoutComments(read('dashboard/panels/side/side.css'));
  const block = name => new RegExp('html\\[data-layout="sidebar"\\] \\.' + name + ' \\{([^}]*)\\}').exec(css)[1];
  const number = (text, name) => Number(new RegExp('(?:^|[;\\s])' + name + ': (\\d+)px').exec(text)[1]);
  assert.equal(number(block('side-clock'), 'width'), clock, 'side.css gives the clock the width layout.js does');
  assert.ok(number(block('side-clock'), 'top') + number(block('side-clock'), 'height') <= g.strip.height, 'the time and the date are inside the strip');
  assert.ok(number(block('side-weather'), 'top') + number(block('side-weather'), 'height') <= g.strip.height, 'and so is the weather');
  assert.ok(number(block('side-clock'), 'top') >= 0);
});

test('384 is the narrowest of the sidebar widths 288, 320, 352 and 384 in which every part fits at its worst case text, and the wordmark does not fit in any', () => {
  // The width each part needs, from the measurements above and the offsets in side.css
  const needs = {
    'the label (16 at each side)': 32 + worst.rolloutIn,
    'DAYS and the date on their rows': Math.max(32 + worst.daysWord + 16 + 36 + 16 + 20, 32 + worst.mar29), // DAYS, one bar, the lamp
    'the days with the two chevrons (44 each side)': 88 + worst.days399,
    'HRS, MIN and SEC in three columns (8 between)': 32 + 3 * (worst.unit + 8),
    'the TEAM plate: its words stay 8 short of the cut corner': Math.ceil(2 * ((worst.team32290 / 2 - 8) + 32.75 + 8)),
    'the school in three lines': 32 + worst.highSchool,
    'the logo (112, 14 from the edge) and the SAMPLE CONTENT label': 14 + 112 + 12 + worst.sampleBadge,
  };
  const widest = Math.max(...Object.keys(needs).map(name => needs[name]));
  assert.ok(widest <= settings.sidebarWidth, 'everything fits at ' + settings.sidebarWidth + ': ' + JSON.stringify(needs));
  [288, 320, 352].forEach(width => assert.ok(Object.keys(needs).some(name => needs[name] > width), 'something does not fit at ' + width));
  assert.ok(widest > 352, 'so 352 is too narrow');
  assert.ok(worst.wordmarkAt44 > settings.sidebarWidth, 'the wordmark is 44 px high and ' + worst.wordmarkAt44 + ' wide, wider than the column, so it is left out');
  assert.ok(!read('dashboard/panels/side/side.js').includes('teletraan-wordmark'), 'and the panel does not draw it');
});

test('the strip, the sidebar, the pane space and the ticker are on the screen, inside the margins, with the gaps between them, and none overlaps another', () => {
  [g.strip, g.sidebar, g.space, g.pane, g.frame, g.ticker].forEach(rectangle => assert.ok(within(rectangle, insideMargins), JSON.stringify(rectangle) + ' is inside the margins'));
  const parts = { strip: g.strip, sidebar: g.sidebar, space: g.space, ticker: g.ticker };
  Object.keys(parts).forEach(a => Object.keys(parts).filter(b => b > a).forEach(b => assert.ok(apart(parts[a], parts[b]), a + ' and ' + b + ' overlap')));
  [g.pane, g.frame].forEach(pane => Object.keys(parts).filter(name => name !== 'space').forEach(name => assert.ok(apart(pane, parts[name]), 'the pane and the ' + name + ' overlap')));

  assert.equal(g.sidebar.y - (g.strip.y + g.strip.height), settings.rowGap, 'the row gap under the strip');
  assert.equal(g.space.y, g.sidebar.y, 'the sidebar and the pane space are one row');
  assert.equal(g.space.height, g.sidebar.height);
  assert.equal(g.ticker.y - (g.sidebar.y + g.sidebar.height), settings.rowGap, 'the row gap above the ticker');
  assert.equal(g.space.x - (g.sidebar.x + g.sidebar.width), settings.columnGap, 'a gap between the sidebar and the pane space');
  assert.equal(g.sidebar.x, margins.left);
  assert.equal(g.space.x + g.space.width, layout.screen.width - margins.right, 'the pane space reaches the right margin');
  assert.equal(g.ticker.y + g.ticker.height, layout.screen.height - margins.bottom, 'the ticker is at the bottom margin');
});

test('the frame, with the screws that reach out of the pane, is inside its space, so it is clear of the strip, the sidebar, the ticker and the edge of the screen', () => {
  assert.ok(within(g.frame, g.space), 'inside the space');
  assert.ok(g.frame.x - (g.sidebar.x + g.sidebar.width) >= settings.columnGap, 'at least the column gap from the sidebar');
  assert.ok(g.frame.y - (g.strip.y + g.strip.height) >= settings.rowGap, 'at least the row gap under the strip');
  assert.ok(g.ticker.y - (g.frame.y + g.frame.height) >= settings.rowGap, 'at least the row gap above the ticker');
  assert.ok(layout.screen.width - (g.frame.x + g.frame.width) >= margins.right, 'at least the margin from the right edge of the screen');

  // the frame is the pane and what reaches past it, at the scale
  assert.ok(Math.abs(g.pane.x - g.frame.x - settings.overhang.left * g.scale) < 1e-6);
  assert.ok(Math.abs(g.pane.y - g.frame.y - settings.overhang.top * g.scale) < 1e-6);
  assert.ok(Math.abs(g.frame.width - (g.pane.width / g.scale + settings.overhang.left + settings.overhang.right) * g.scale) < 0.2, 'the right overhang');
  assert.ok(Math.abs(g.frame.height - (g.pane.height / g.scale + settings.overhang.top + settings.overhang.bottom) * g.scale) < 0.2, 'the bottom overhang');
});

test('the large area is scaled the same across and down, never shrinks, and is the biggest that fits its space', () => {
  const area = settings.area;
  assert.deepEqual(area, { width: 1152, height: 708 }, 'the size the panels are drawn for (base.css, plate.js)');
  assert.ok(g.scale >= 1, 'text grows with the pane and never shrinks');
  assert.ok(Math.abs(g.pane.width / area.width - g.scale) < 0.001 && Math.abs(g.pane.height / area.height - g.scale) < 0.001, 'one scale for both directions');

  // what has to fit is the frame with its screws, which is the area and the overhang
  const frameAtOne = { width: area.width + settings.overhang.left + settings.overhang.right, height: area.height + settings.overhang.top + settings.overhang.bottom };
  const fit = Math.min((g.space.width - 1) / frameAtOne.width, (g.space.height - 1) / frameAtOne.height);
  assert.ok(g.scale <= fit, 'no bigger than what fits');
  assert.ok(fit - g.scale < 0.0001 + 1e-9, 'and no more than four decimals below it');
  assert.equal(String(g.scale).replace(/^\d\./, '').length <= 4, true, 'four decimals');
  assert.ok(g.space.height - g.frame.height < 3 || g.space.width - g.frame.width < 3, 'it is as big as the space allows, in one direction at least');

  const roomLeft = g.frame.x - g.space.x;
  const roomRight = g.space.x + g.space.width - (g.frame.x + g.frame.width);
  const roomAbove = g.frame.y - g.space.y;
  const roomBelow = g.space.y + g.space.height - (g.frame.y + g.frame.height);
  assert.ok(Math.abs(roomLeft - roomRight) <= 1.1, 'centred across');
  assert.ok(Math.abs(roomAbove - roomBelow) <= 1.1, 'centred down');
  assert.equal(g.pane.x, Math.floor(g.pane.x), 'whole pixel at the left');
  assert.equal(g.pane.y, Math.floor(g.pane.y), 'whole pixel at the top');
});

test('the ticker is the standard layout\'s, the whole width at the bottom: its size, its one line and its tag are the standard rules', () => {
  const base = withoutComments(read('dashboard/base.css'));
  const standard = /\.area\[data-area="ticker"\] \{ width: (\d+)px; height: (\d+)px; \}/.exec(base);
  assert.ok(standard, 'base.css has the size of the ticker area');
  assert.equal(g.ticker.width, Number(standard[1]), 'as wide as the standard ticker');
  assert.equal(g.ticker.height, Number(standard[2]), 'as high as the standard ticker');
  assert.equal(g.ticker.x, margins.left);
  assert.equal(g.ticker.width, layout.screen.width - margins.left - margins.right, 'the whole width between the margins, under the sidebar and the pane');
  assert.ok(g.ticker.x <= g.sidebar.x && g.ticker.x + g.ticker.width >= g.space.x + g.space.width, 'under both');
  assert.ok(g.ticker.height >= 72, 'the tag is 72 high');

  // one line, tag on the left, and nothing of its own in this layout: the standard rules apply
  const css = withoutComments(read('dashboard/layouts/sidebar.css'));
  assert.ok(!/\.ticker|\.tag|\.message/.test(css), 'sidebar.css has no rule for the ticker\'s parts');
  assert.ok(!/line-clamp|white-space: normal|\.area\[data-area="ticker"\]/.test(css), 'no second line, and no size of its own');
  const ticker = withoutComments(read('dashboard/panels/ticker/ticker.css'));
  const message = /\.ticker \.message \{([^}]*)\}/.exec(ticker)[1];
  assert.ok(/overflow: hidden/.test(message) && /text-overflow: ellipsis/.test(message), 'one line, cut with an ellipsis');
  const line = /font: \d+ var\(--size-body\)\/(\d+)px/.exec(message);
  assert.ok(line && Number(line[1]) <= g.ticker.height, 'one line of body text fits the ticker');
  assert.ok(/--size-body: (\d+)px/.exec(read('dashboard/tokens.css'))[1] >= 44, 'body text is at least 44 px');

  // the connection text is capped to the ticker's width by the standard rule
  assert.ok(new RegExp('#connection-status \\{[^}]*max-width: ' + g.ticker.width + 'px;').test(base), 'the connection text is as wide as the ticker at most');
  assert.ok(!/#connection-status/.test(css), 'sidebar.css leaves the connection text alone');
});

test('the height of the row limits the pane: a taller strip or ticker makes it smaller, and a narrower sidebar only moves it', () => {
  const taller = layout.makeSidebarGeometry(Object.assign({}, settings, { stripHeight: settings.stripHeight + 40 }));
  assert.ok(taller.scale < g.scale, 'less room under a taller strip');
  assert.ok(within(taller.frame, taller.space));
  assert.equal(taller.sidebar.height, g.sidebar.height - 40, 'and a shorter sidebar');

  const tall = layout.makeSidebarGeometry(Object.assign({}, settings, { tickerHeight: 400 }));
  assert.ok(tall.scale < g.scale, 'less room above a taller ticker');
  assert.ok(tall.frame.width < tall.space.width, 'so the pane is narrower than its space');
  assert.ok(within(tall.frame, tall.space));

  const narrow = layout.makeSidebarGeometry(Object.assign({}, settings, { sidebarWidth: 288 }));
  assert.equal(narrow.scale, g.scale, 'the height is what limits the pane, so a narrower sidebar does not make it bigger');
  assert.ok(narrow.pane.x < g.pane.x, 'it only gives the pane room to move left');
  assert.ok(within(narrow.frame, narrow.space));

  const low = layout.makeSidebarGeometry(Object.assign({}, settings, { stripHeight: 24 }));
  assert.ok(low.space.width - low.frame.width < 3, 'with a strip that low the width is what limits it');
  assert.ok(within(low.frame, low.space));
});

test('the variables the stylesheet reads are the ones layout.js writes, and all of them are used', () => {
  const variables = layout.cssVariables();
  const css = read('dashboard/layouts/sidebar.css');
  const used = new Set((withoutComments(css).match(/var\(--(?:strip|sidebar|pane|ticker)-[a-z-]+\)/g) || []).map(text => text.slice(4, -1)));

  used.forEach(name => assert.ok(name in variables, name + ' is used in sidebar.css and is not written by layout.js'));
  Object.keys(variables).forEach(name => assert.ok(used.has(name), name + ' is written by layout.js and not used in sidebar.css'));
  assert.equal(variables['--sidebar-width'], '384px');
  assert.equal(variables['--strip-height'], g.strip.height + 'px');
  assert.equal(variables['--strip-name-size'], settings.nameSize + 'px');
  assert.equal(variables['--strip-clock-width'], settings.stripClockWidth + 'px');
  assert.equal(variables['--ticker-width'], g.ticker.width + 'px');
  assert.equal(variables['--pane-scale'], String(g.scale));
  Object.keys(variables).filter(name => name !== '--pane-scale').forEach(name => assert.ok(/^-?\d+(\.\d+)?px$/.test(variables[name]), name + ' is a length'));
});


// The reload guard

function fakeStorage(options) {
  const opts = options || {};
  const data = {};
  return {
    data: data,
    getItem(key) {
      if (opts.failRead) throw new Error('storage is switched off');
      return key in data ? data[key] : null;
    },
    setItem(key, value) {
      if (opts.failWrite) throw new Error('storage is full');
      if (!opts.dropWrites) data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

test('no reload when the layout on the page is the layout wanted', () => {
  const storage = fakeStorage();
  assert.equal(layout.mustReload('standard', 'standard', storage), false);
  assert.equal(layout.mustReload('sidebar', 'sidebar', storage), false);
  assert.deepEqual(storage.data, {});
});

test('a different layout reloads once, and never twice for the same target', () => {
  const storage = fakeStorage();
  assert.equal(layout.mustReload('standard', 'sidebar', storage), true, 'the first time');
  assert.equal(storage.data[layout.reloadKey], 'sidebar', 'the layout it reloads for is written down');
  assert.equal(layout.mustReload('standard', 'sidebar', storage), false, 'the page came back in the wrong layout: it does not try again');
  assert.equal(layout.mustReload('standard', 'sidebar', storage), false);
});

test('once the page is in the layout wanted the note is rubbed out, so a later change reloads again', () => {
  const storage = fakeStorage();
  assert.equal(layout.mustReload('standard', 'sidebar', storage), true);
  assert.equal(layout.mustReload('sidebar', 'sidebar', storage), false);
  assert.deepEqual(storage.data, {}, 'rubbed out');
  assert.equal(layout.mustReload('sidebar', 'standard', storage), true, 'back again');
  assert.equal(layout.mustReload('sidebar', 'standard', storage), false);
  assert.equal(layout.mustReload('standard', 'standard', storage), false);
  assert.equal(layout.mustReload('standard', 'sidebar', storage), true, 'and forward again');
});

test('a change to the other layout is its own target, so it still reloads', () => {
  const storage = fakeStorage();
  storage.setItem(layout.reloadKey, 'sidebar');
  assert.equal(layout.mustReload('sidebar', 'standard', storage), true);
  assert.equal(storage.data[layout.reloadKey], 'standard');
});

test('storage that throws, drops what it is given, or is missing never reloads', () => {
  assert.equal(layout.mustReload('standard', 'sidebar', fakeStorage({ failRead: true })), false);
  assert.equal(layout.mustReload('standard', 'sidebar', fakeStorage({ failWrite: true })), false);
  assert.equal(layout.mustReload('standard', 'sidebar', fakeStorage({ dropWrites: true })), false, 'a note that did not stick would let it repeat');
  assert.equal(layout.mustReload('standard', 'sidebar', null), false);
  assert.equal(layout.mustReload('standard', 'sidebar', undefined), false);
  assert.doesNotThrow(() => layout.mustReload('standard', 'standard', null));
  assert.doesNotThrow(() => layout.mustReload('standard', 'standard', fakeStorage({ failRead: true })));
});

test('a layout that is not a layout never reloads', () => {
  const storage = fakeStorage();
  ['upside-down', '', undefined, null].forEach(odd => assert.equal(layout.mustReload('standard', odd, storage), false, String(odd)));
  assert.deepEqual(storage.data, {});
});


// Setting up the page

// Enough of a page for layout-apply.js: elements with a parent, attributes,
// hidden and data, and the html element with a style
function fakePage() {
  const elements = {};
  const make = (id, attributes) => {
    const element = {
      id: id,
      hidden: false,
      attributes: Object.assign({}, attributes),
      parent: null,
      children: [],
      appendChild(child) {
        if (child.parent) child.parent.children = child.parent.children.filter(other => other !== child);
        child.parent = element;
        element.children.push(child);
        return child;
      },
      setAttribute(name, value) {
        element.attributes[name] = value;
      },
      removeAttribute(name) {
        delete element.attributes[name];
      },
      insertAdjacentHTML(where, markup) {
        element.inserted.push({ where: where, markup: markup });
      },
      inserted: [],
    };
    elements[id] = element;
    return element;
  };

  ['banner', 'grid1', 'countdown', 'grid2', 'ticker'].forEach(name => make('region-' + name, { 'data-block': '' }));
  make('region-strip').hidden = true;
  make('strip-name');
  make('strip-clock');
  make('region-sidebar').hidden = true;
  ['sidebar-top', 'sidebar-countdown', 'sidebar-bottom'].forEach(id => make(id));
  make('bar-middle').hidden = true;
  make('region-column').hidden = true;

  const style = { values: {}, setProperty(name, value) { style.values[name] = value; } };
  const html = { dataset: {}, style: style };
  return { elements: elements, html: html, document: { getElementById: id => elements[id] || null, documentElement: html } };
}

const blocksOn = page => Object.keys(page.elements).filter(id => 'data-block' in page.elements[id].attributes);

test('the sidebar layout shows the strip and the sidebar, moves the banner and the countdown into the sidebar, and blocks fly as strip, sidebar, pane and ticker', async () => {
  const page = fakePage();
  await withGlobals({ document: page.document }, () => {
    const started = apply.startLayout('neon-prime', () => null, page.html);
    assert.equal(started, 'sidebar');
  });

  assert.equal(page.html.dataset.layout, 'sidebar');
  assert.equal(page.elements['region-strip'].hidden, false);
  assert.equal(page.elements['region-sidebar'].hidden, false);
  assert.equal(page.elements['region-banner'].parent, page.elements['sidebar-top']);
  assert.equal(page.elements['region-countdown'].parent, page.elements['sidebar-countdown']);
  assert.equal(page.elements['region-grid1'].parent, null, 'the large frame stays where it was');
  assert.equal(page.elements['region-ticker'].parent, null);
  assert.deepEqual(blocksOn(page).sort(), layout.blocksOf('sidebar').map(name => 'region-' + name).sort());
  assert.deepEqual(page.html.style.values, layout.cssVariables());
});

test('the standard layout leaves the page exactly as index.html has it', async () => {
  const page = fakePage();
  await withGlobals({ document: page.document }, () => {
    assert.equal(apply.startLayout(null, () => null, page.html), 'standard');
  });

  assert.equal(page.html.dataset.layout, 'standard');
  assert.equal(page.elements['region-strip'].hidden, true);
  assert.equal(page.elements['region-sidebar'].hidden, true);
  assert.equal(page.elements['bar-middle'].hidden, true);
  assert.equal(page.elements['region-column'].hidden, true);
  assert.equal(page.elements['region-grid1'].parent, null, 'the large frame is not moved into the bar row');
  assert.equal(page.elements['region-banner'].parent, null);
  assert.equal(page.elements['region-countdown'].parent, null);
  assert.deepEqual(page.html.style.values, {}, 'no variables');
  assert.deepEqual(blocksOn(page).sort(), layout.blocksOf('standard').map(name => 'region-' + name).sort());
});

test('the layout comes from the saved theme, and from the address when there is one', async () => {
  const saved = { defaultTheme: 'neon-prime' };
  await withGlobals({ document: fakePage().document }, () => {
    assert.equal(apply.startLayout(null, () => saved, fakePage().html), 'sidebar');
    assert.equal(apply.startLayout('hawktimus', () => saved, fakePage().html), 'standard');
    assert.equal(apply.startLayout('neon-prime', () => null, fakePage().html), 'sidebar');
  });
});

test('if the layout cannot be set up the screen starts in the standard layout, and says so', async () => {
  const logged = [];
  const real = console.error;
  console.error = (...parts) => logged.push(parts.join(' '));

  try {
    // readTheme fails
    let page = fakePage();
    await withGlobals({ document: page.document }, () => {
      assert.equal(apply.startLayout('neon-prime', () => { throw new Error('storage is off'); }, page.html), 'standard');
    });
    assert.equal(page.html.dataset.layout, 'standard');

    // index.html has no sidebar to put the banner in
    page = fakePage();
    delete page.elements['region-sidebar'];
    await withGlobals({ document: page.document }, () => {
      assert.equal(apply.startLayout('neon-prime', () => null, page.html), 'standard');
    });
    assert.equal(page.html.dataset.layout, 'standard');
    assert.equal(page.html.style.values['--pane-scale'], undefined, 'nothing half set up');

    // index.html has no strip: the same, and the page is left as it was
    page = fakePage();
    delete page.elements['strip-name'];
    await withGlobals({ document: page.document }, () => {
      assert.equal(apply.startLayout('neon-prime', () => null, page.html), 'standard');
    });
    assert.equal(page.html.dataset.layout, 'standard');
    assert.equal(page.elements['region-banner'].parent, null, 'nothing was moved');
    assert.equal(page.elements['region-strip'].hidden, true, 'and nothing was shown');
    assert.equal(page.elements['region-sidebar'].hidden, true);

    // the strip has no slot for the clock: the same
    page = fakePage();
    delete page.elements['strip-clock'];
    await withGlobals({ document: page.document }, () => {
      assert.equal(apply.startLayout('neon-prime', () => null, page.html), 'standard');
    });
    assert.equal(page.html.dataset.layout, 'standard');
    assert.equal(page.elements['region-banner'].parent, null, 'nothing was moved');
    assert.equal(page.elements['region-strip'].hidden, true, 'and nothing was shown');
  } finally {
    console.error = real;
  }
  assert.ok(logged.length >= 1 && logged.some(line => /standard layout/.test(line)));
});

test('a theme with another layout reloads the page once and not again, never while something has the screen, and a failing storage never reloads', async () => {
  let reloads = 0;
  const store = fakeStorage();
  const window = { sessionStorage: store, location: { reload: () => { reloads += 1; } } };

  await withGlobals({ window: window, document: pageWith('standard') }, () => {
    assert.equal(apply.holdForLayout({ theme: 'hawktimus', overlay: '' }), false, 'the same layout goes on as usual');
    assert.equal(reloads, 0);

    assert.equal(apply.holdForLayout({ theme: 'neon-prime', overlay: '' }, () => true), true, 'held while something has the screen');
    assert.equal(reloads, 0);
    assert.deepEqual(store.data, {}, 'nothing was written down, because nothing was done');

    assert.equal(apply.holdForLayout({ theme: 'neon-prime', overlay: '' }, () => false), true, 'reloading, so the look is not put on this page');
    assert.equal(reloads, 1);
    assert.equal(apply.holdForLayout({ theme: 'neon-prime', overlay: '' }, () => false), false, 'back in the wrong layout: no second reload, and the colours go on');
    assert.equal(reloads, 1);
  });

  await withGlobals({ window: window, document: pageWith('sidebar') }, () => {
    assert.equal(apply.holdForLayout({ theme: 'neon-prime', overlay: '' }), false, 'the page is in the layout now');
    assert.deepEqual(store.data, {}, 'so the note is gone');
    assert.equal(apply.holdForLayout({ theme: 'hawktimus', overlay: '' }), true, 'a later change reloads again');
    assert.equal(reloads, 2);
  });

  const broken = { get sessionStorage() { throw new Error('no storage'); }, location: { reload: () => { reloads += 1; } } };
  await withGlobals({ window: broken, document: pageWith('standard') }, () => {
    assert.equal(apply.holdForLayout({ theme: 'neon-prime', overlay: '' }), false);
    assert.equal(reloads, 2);
  });
});


// Regions and blocks

test('the sidebar layout has no small frame, and every other region of the standard layout', () => {
  assert.equal(layout.hasRegion('standard', 'grid2'), true);
  assert.equal(layout.hasRegion('sidebar', 'grid2'), false);
  ['banner', 'countdown', 'grid1', 'ticker', 'overlay'].forEach(region => {
    assert.equal(layout.hasRegion('standard', region), true, region);
    assert.equal(layout.hasRegion('sidebar', region), true, region);
  });
  assert.equal(layout.hasRegion('upside-down', 'grid2'), true, 'a layout nobody knows is the standard one');
  assert.deepEqual(layout.areasOf('standard'), ['grid1', 'grid2', 'ticker']);
  assert.deepEqual(layout.areasOf('sidebar'), ['grid1', 'ticker']);
  assert.deepEqual(layout.otherAreas('standard'), ['grid2', 'ticker']);
  assert.deepEqual(layout.otherAreas('sidebar'), ['ticker'], 'a hidden transition waits for no small frame');
});

test('the small panels are the ones the sidebar layout skips, and the Large panels list is untouched', () => {
  // a panel that names a layout of its own (the bar layout's two) is not one the sidebar skips for its region
  const skipped = panels.filter(panel => !panel.layout && !layout.hasRegion('sidebar', panel.region)).map(panel => panel.id);
  assert.deepEqual(skipped.sort(), ['forecast', 'next-event', 'safety-days', 'sponsor-logo', 'stand-in-tile', 'task-counts']);
  assert.ok(panels.filter(panel => panel.region === 'grid2').every(panel => skipped.indexOf(panel.id) !== -1), 'every small panel');

  const regionOf = id => panels.filter(panel => panel.id === id)[0].region;
  config.defaultSettings.rotation.grid2.forEach(step => assert.ok(skipped.indexOf(step.panel) !== -1, step.panel + ' in the small list is skipped'));
  config.defaultSettings.rotation.grid1.forEach(step => assert.ok(layout.hasRegion('sidebar', regionOf(step.panel)), step.panel + ' in the large list is shown'));
  ['banner', 'countdown', 'ticker', 'alert', 'announcement'].forEach(id => assert.ok(layout.hasRegion('sidebar', regionOf(id)), id));
});

test('the blocks that fly apart: five on the standard layout, as index.html marks them, and strip, sidebar, pane and ticker on the sidebar layout', () => {
  const html = read('dashboard/index.html');
  const marked = (html.match(/<div id="region-([a-z0-9]+)" data-block><\/div>/g) || []).map(text => /region-([a-z0-9]+)/.exec(text)[1]);
  assert.deepEqual(marked, layout.blocksOf('standard'), 'index.html marks the blocks of the standard layout');
  assert.deepEqual(layout.blocksOf('sidebar'), ['strip', 'sidebar', 'grid1', 'ticker']);
  assert.deepEqual(layout.blocksOf('upside-down'), layout.blocksOf('standard'));

  layout.layouts.forEach(name => layout.blocksOf(name).forEach(block => {
    assert.ok(layout.everyBlock.indexOf(block) !== -1, block + ' is in everyBlock');
    assert.ok(html.indexOf('id="region-' + block + '"') !== -1, 'index.html has #region-' + block);
  }));
  assert.ok(/<div id="region-sidebar" hidden>/.test(html), 'the sidebar is hidden until the sidebar layout shows it');
  assert.ok(/<div id="region-strip" hidden>\s*<div id="strip-name"><\/div>\s*<div id="strip-clock"><\/div>\s*<\/div>/.test(html), 'the strip is hidden until the sidebar layout shows it, and has the slots for the name and the clock');
  ['sidebar-top', 'sidebar-countdown', 'sidebar-bottom'].forEach(id => assert.ok(html.indexOf('<div id="' + id + '"></div>') !== -1, id));
  assert.ok(!/<div id="region-sidebar"[^>]*data-block/.test(html) && !/<div id="region-strip"[^>]*data-block/.test(html), 'only layout-apply.js makes them blocks');
});

test('every block of the sidebar layout has a pose with all seven numbers, turns under 90 degrees, starts by .3 and flies away from the viewer, and the blocks start one after another', () => {
  const frame = read('dashboard/frame.css');
  const sidebarCss = read('dashboard/layouts/sidebar.css');
  const lineFor = block => {
    const own = sidebarCss.split('\n').find(text => text.startsWith('html[data-layout="sidebar"] #region-' + block + ' ') && text.includes('--tx:'));
    return own || frame.split('\n').find(text => text.startsWith('#region-' + block + ' '));
  };

  const holds = [];
  layout.blocksOf('sidebar').forEach(block => {
    const line = lineFor(block);
    assert.ok(line, block + ' has no pose');
    ['--tx', '--ty', '--tz', '--rx', '--ry', '--rz', '--hold'].forEach(name => assert.ok(line.includes(name + ':'), block + ' lacks ' + name));
    (line.match(/--r[xyz]: -?\d+deg/g) || []).forEach(turn => assert.ok(Math.abs(parseInt(turn.split(': ')[1], 10)) < 90, block + ' turns past 90 degrees: ' + turn));
    assert.ok(Number(/--hold: ([0-9.]+)/.exec(line)[1]) <= 0.3, block + ' starts too late');
    assert.ok(Number(/--tz: (-?\d+)px/.exec(line)[1]) < 0, block + ' flies away from the viewer');
    holds.push(Number(/--hold: ([0-9.]+)/.exec(line)[1]));
  });
  holds.slice(1).forEach((hold, index) => assert.ok(hold > holds[index], 'the blocks start one after another, in the order of blocksOf: ' + holds.join(', ')));
});

test('hidden-run.js waits for the areas of the layout, and areas.js and schedule.js leave out a region the layout has not got', () => {
  const run = read('dashboard/core/hidden-run.js');
  assert.ok(run.includes('moveOn(otherAreas(layoutNow()));'), 'the areas it asks to move on come from the layout');
  assert.ok(!/moveOn\(\['grid2'/.test(run), 'the small frame is not named');

  const areas = read('dashboard/core/areas.js');
  const change = areas.slice(areas.indexOf('export async function changePage('));
  assert.ok(change.indexOf('if (!hasRegion(layoutNow(), region)) return 0;') > 0, 'no area is made for a region the layout has not got');
  assert.ok(change.indexOf('if (!hasRegion(layoutNow(), region)) return 0;') < change.indexOf('const old = showing[region]'), 'before anything is looked at');

  const schedule = read('dashboard/core/schedule.js');
  assert.ok(/export function startRotation\(region, getPlaylist, getContent\) \{\s*if \(!hasRegion\(layoutNow\(\), region\)\) return;/.test(schedule));
  assert.ok(/ids = ids\.filter\(id => regionOf\(id\) === null \|\| hasRegion\(layoutNow\(\), regionOf\(id\)\)\);/.test(schedule));
});


// The scheduler, with stand-ins for the page

// schedule.js is the real file. What it imports from the page is replaced by
// small stand-ins that note what they were asked, so the test can see which
// regions the scheduler gave pages to.
const schedulerTree = makeTree('scheduler', ['dashboard/config.js', 'dashboard/registry.js', 'dashboard/core/schedule.js', 'dashboard/core/layout.js', 'dashboard/core/theme.js', 'dashboard/core/style.js',
  'dashboard/themes/registry.js', 'dashboard/themes/overlays/registry.js']);
const standIns = {
  'dashboard/frame.js': 'export const wait = () => new Promise(() => {});\nexport const pace = () => 1;\nexport const turnMs = () => 1000;\nexport const isPaused = () => false;\n',
  'dashboard/core/photos.js': 'export const ownSeconds = () => 0;\n',
  'dashboard/core/areas.js': 'export async function changePage(region, next) { globalThis.schedulerCalls.push(["changePage", region, next && next.id]); return 0; }\nexport function clearRegion(region) { globalThis.schedulerCalls.push(["clearRegion", region]); }\n',
  'dashboard/core/panels.js': [
    "import { panels } from '../registry.js';",
    'export const regionOf = id => (panels.filter(panel => panel.id === id)[0] || { region: null }).region;',
    'export const topicOf = id => (panels.filter(panel => panel.id === id)[0] || {}).topic || null;',
    'export const moduleOf = () => null;',
    'export const canShow = () => true;',
    "export function buildPage(id) { globalThis.schedulerCalls.push(['buildPage', id]); return { id: id, region: regionOf(id), element: {} }; }",
  ].join('\n') + '\n',
};
Object.keys(standIns).forEach(file => {
  fs.mkdirSync(path.dirname(path.join(schedulerTree, file)), { recursive: true });
  fs.writeFileSync(path.join(schedulerTree, file), standIns[file]);
});
let schedulers = 0;

// Runs a scheduler call on a page in this layout and says what it asked the areas to do. Each run
// has a copy of schedule.js of its own, because the file remembers which topic each region shows.
async function schedulerCalls(name, run) {
  const calls = [];
  const scheduler = await import(urlOf(schedulerTree, 'dashboard/core/schedule.js') + '?run=' + (schedulers += 1));
  await withGlobals({ document: pageWith(name), schedulerCalls: calls }, async () => {
    run(scheduler);
    await new Promise(resolve => setImmediate(resolve)); // lets the loops run up to their first wait, which never ends
  });
  return calls;
}

const content = { settings: Object.assign({}, config.defaultSettings, { rotation: config.defaultSettings.rotation }) };
const small = [{ panel: 'task-counts', show: true, seconds: 10 }, { panel: 'next-event', show: true, seconds: 10 }];
const large = [{ panel: 'tasks', show: true, seconds: 10 }, { panel: 'events', show: true, seconds: 10 }];

test('the standard layout rotates the small frame as it always did', async () => {
  const asked = [];
  const calls = await schedulerCalls('standard', scheduler => scheduler.startRotation('grid2', () => { asked.push('playlist'); return small; }, () => content));
  assert.ok(asked.length > 0, 'the playlist is read');
  assert.deepEqual(calls, [['buildPage', 'task-counts'], ['changePage', 'grid2', 'task-counts']]);
});

test('the sidebar layout never starts the small frame: no playlist is read, no page is built and no area is asked for', async () => {
  const asked = [];
  const calls = await schedulerCalls('sidebar', scheduler => scheduler.startRotation('grid2', () => { asked.push('playlist'); return small; }, () => content));
  assert.deepEqual(asked, []);
  assert.deepEqual(calls, []);
});

test('the sidebar layout rotates the large frame exactly as the standard layout does', async () => {
  const standard = await schedulerCalls('standard', scheduler => scheduler.startRotation('grid1', () => large, () => content));
  const sidebar = await schedulerCalls('sidebar', scheduler => scheduler.startRotation('grid1', () => large, () => content));
  assert.deepEqual(standard, [['buildPage', 'tasks'], ['changePage', 'grid1', 'tasks']]);
  assert.deepEqual(sidebar, standard);
});

test('the sidebar layout starts the ticker as the standard layout does', async () => {
  const withTicker = { settings: content.settings, tipsAndNews: [{ kind: 'tip', text: 'A tip', show: true }], sponsors: [] };
  const ticker = async name => schedulerCalls(name, scheduler => scheduler.startTicker(() => withTicker));
  // with the stand-ins the ticker has no lines to show, so both layouts ask for the same thing: an empty ticker
  assert.deepEqual(await ticker('sidebar'), await ticker('standard'));
});

test('?show and ?stress leave out a panel of a region the layout has not got, and keep the rest', async () => {
  const sidebar = await schedulerCalls('sidebar', scheduler => scheduler.startTogether(['tasks', 'task-counts', 'stand-in-ticker'], () => content, 30));
  assert.deepEqual(sidebar.filter(call => call[0] === 'buildPage').map(call => call[1]), ['tasks', 'stand-in-ticker']);
  assert.deepEqual(sidebar.filter(call => call[0] === 'changePage').map(call => call[1]).sort(), ['grid1', 'ticker']);

  const standard = await schedulerCalls('standard', scheduler => scheduler.startTogether(['tasks', 'task-counts', 'stand-in-ticker'], () => content, 30));
  assert.deepEqual(standard.filter(call => call[0] === 'buildPage').map(call => call[1]), ['tasks', 'task-counts', 'stand-in-ticker']);

  assert.deepEqual(await schedulerCalls('sidebar', scheduler => scheduler.startTogether(['task-counts'], () => content, 30)), [], 'nothing at all when every panel is skipped');
});

// The bar layout has no small frame either: the same mechanism, the same answers

const smallPanels = panels.filter(panel => panel.region === 'grid2').map(panel => panel.id);

test('the bar layout never starts the small frame: no playlist is read, no page is built and no area is asked for', async () => {
  assert.ok(smallPanels.length >= 5, 'the small panels the registry has: ' + smallPanels.join(', '));
  const asked = [];
  const calls = await schedulerCalls('bar', scheduler => scheduler.startRotation('grid2', () => { asked.push('playlist'); return small; }, () => content));
  assert.deepEqual(asked, []);
  assert.deepEqual(calls, []);
});

test('the bar layout rotates the large frame and starts the ticker exactly as the standard layout does', async () => {
  const standard = await schedulerCalls('standard', scheduler => scheduler.startRotation('grid1', () => large, () => content));
  const bar = await schedulerCalls('bar', scheduler => scheduler.startRotation('grid1', () => large, () => content));
  assert.deepEqual(standard, [['buildPage', 'tasks'], ['changePage', 'grid1', 'tasks']]);
  assert.deepEqual(bar, standard);

  const withTicker = { settings: content.settings, tipsAndNews: [{ kind: 'tip', text: 'A tip', show: true }], sponsors: [] };
  const ticker = async name => schedulerCalls(name, scheduler => scheduler.startTicker(() => withTicker));
  assert.deepEqual(await ticker('bar'), await ticker('standard'));
});

test('?show and ?stress in the bar layout leave out every small panel and keep the large ones and the ticker', async () => {
  const everything = smallPanels.concat(['tasks', 'events', 'stand-in-ticker']);
  const bar = await schedulerCalls('bar', scheduler => scheduler.startTogether(everything, () => content, 30));
  assert.deepEqual(bar.filter(call => call[0] === 'buildPage').map(call => call[1]), ['tasks', 'events', 'stand-in-ticker']);
  assert.deepEqual(bar.filter(call => call[0] === 'changePage').map(call => call[1]).sort(), ['grid1', 'grid1', 'ticker']);

  smallPanels.forEach(id => assert.ok(!bar.some(call => call[1] === id || call[2] === id), id + ' was asked for'));
  assert.deepEqual(await schedulerCalls('bar', scheduler => scheduler.startTogether(smallPanels, () => content, 30)), [], 'nothing at all when every panel is skipped');
});


// Seasonal packs

const pieces = {
  back: { shape: 'flake', x: 100, y: 200, size: 24 },
  front: { zone: 'left', shape: 'flake', x: 4, y: 40, size: 12 },
  over: { shape: 'flake', x: 300, y: 0, size: 24, motion: 'fall', seconds: 20, opacity: 0.5 },
};
const packShapes = { flake: { viewBox: '0 0 24 24', markup: '<polygon points="12,0 24,12 12,24 0,12"/>' } };
const mark = { viewBox: '0 0 60 76', markup: '<rect width="60" height="76"/>' };
const scene = { viewBox: '0 0 1920 26', markup: '<rect width="1920" height="22"/>' };
const fullPack = { shapes: packShapes, scene: scene, mark: mark, back: [pieces.back], front: [pieces.front], over: [pieces.over] };

const countOf = (text, word) => (text.match(new RegExp(word, 'g')) || []).length;

test('a pack is drawn in full by default, and the standard layout draws the same', () => {
  const drawn = season.layersMarkup(fullPack);
  assert.equal(countOf(drawn.back, 'season-piece'), 1);
  assert.ok(drawn.front.includes('data-zone="left"') && drawn.front.includes('season-scene'), 'the zone and the scene');
  assert.equal(countOf(drawn.over, 'season-piece'), 1);
  assert.deepEqual(season.layersMarkup(fullPack, layout.decorationLayers('standard')), drawn);
  assert.deepEqual(layout.decorationLayers('standard'), ['back', 'front', 'over']);
});

test('the sidebar layout draws only the header mark and the over layer of a pack', () => {
  assert.deepEqual(layout.decorationLayers('sidebar'), ['over']);
  const drawn = season.layersMarkup(fullPack, layout.decorationLayers('sidebar'));

  assert.equal(drawn.front, '', 'no zones and no scene');
  assert.equal(countOf(drawn.back, 'season-piece'), 0, 'no back pieces');
  assert.ok(drawn.back.includes('id="season-shape-flake"'), 'the shapes are still defined, which the over pieces point at');
  assert.equal(countOf(drawn.over, 'season-piece'), 1, 'the over layer is drawn');
  assert.equal(drawn.mark, mark, 'the header mark is drawn');
  assert.equal(drawn.empty, false);
  assert.deepEqual(drawn.skipped, []);
});

test('a pack with nothing but zone and back decorations draws nothing in the sidebar layout, and still has its mark', () => {
  const pack = { shapes: packShapes, scene: scene, mark: mark, back: [pieces.back], front: [pieces.front] };
  assert.equal(season.layersMarkup(pack).empty, false);

  const drawn = season.layersMarkup(pack, layout.decorationLayers('sidebar'));
  assert.equal(drawn.empty, true);
  assert.equal(drawn.mark, mark);
});

test('a layer that is left out is not looked at, so a mistake in it is not reported for a layout that does not draw it', () => {
  const pack = { shapes: packShapes, back: [{ shape: 'missing', x: 1, y: 1, size: 5 }], front: [{ zone: 'nowhere', shape: 'flake', x: 0, y: 0, size: 5 }], over: [pieces.over] };
  assert.equal(season.layersMarkup(pack).skipped.length, 2, 'both are reported when they would be drawn');
  assert.deepEqual(season.layersMarkup(pack, ['over']).skipped, []);
});

test('the real packs follow the same rule: in the sidebar layout every one still has an over layer and a mark', async () => {
  const packFolder = makeTree('packs', ['dashboard/themes/overlays/registry.js']);
  fs.readdirSync(path.join(dashboardFolder, 'seasons')).filter(name => name.endsWith('.js')).forEach(name => copyInto(packFolder, 'dashboard/seasons/' + name, 'dashboard/seasons/' + name));

  for (const name of fs.readdirSync(path.join(packFolder, 'dashboard/seasons')).filter(file => file.endsWith('.js'))) {
    const { pack } = await import(urlOf(packFolder, 'dashboard/seasons/' + name));
    const drawn = season.layersMarkup(pack, layout.decorationLayers('sidebar'));
    assert.equal(drawn.front, '', name + ' has no zones');
    assert.equal(countOf(drawn.back, 'season-piece'), 0, name + ' has no back pieces');
    assert.ok(countOf(drawn.over, 'season-piece') >= 8, name + ' keeps its over layer');
    assert.ok(drawn.mark, name + ' keeps its mark');
    assert.deepEqual(drawn.skipped, [], name);
  }
});

test('shell.js gives season.js the layers before it asks for a pack, and the page code uses them', () => {
  const shell = read('dashboard/shell.js');
  assert.ok(shell.indexOf('module.setLayers(decorationLayers(layoutNow()));') !== -1);
  assert.ok(shell.indexOf('module.setLayers(') < shell.indexOf('return module.showSeason(look.overlay);'));

  const code = read('dashboard/core/season.js');
  assert.ok(code.includes('const drawn = layersMarkup(pack, layersWanted);'));
  assert.ok(/export function setLayers\(layers\) \{\s*layersWanted = Array\.isArray\(layers\) \? layers : allLayers;\s*\}/.test(code));
});


// The wiring, the stylesheet and the docs

test('shell.js sets the layout before anything else is drawn, and keeps an alert or announcement from being lost to a reload', () => {
  const shell = read('dashboard/shell.js');
  const code = shell.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
  const first = code.indexOf('startLayout(params.get(\'theme\'), savedTheme, document.documentElement, style);');

  assert.ok(first !== -1, 'startLayout is called with ?theme=, the saved theme and the style');
  assert.ok(code.indexOf('const style = startStyle(params.get(\'style\'), savedStyle);') < first, 'the style is chosen before the layout, which needs it');
  assert.ok(first < code.indexOf('makeSilverGradients();'), 'before the gradients');
  assert.ok(first < code.indexOf('frame.start('), 'before the frame starts');
  assert.ok(first < code.indexOf('await Promise.race([waitForFonts()'), 'before the fonts, the panels and the content');
  assert.ok(first < code.indexOf('startWhatStays();'), 'before anything is drawn');
  assert.ok(code.indexOf('holdLooksFor(look => holdForLayout(look, takeoverRunning));') > code.indexOf('async function run()'));
  assert.ok(code.indexOf('holdLooksFor(') < code.indexOf('await startThemes('), 'the hold is in place before the first theme goes on');
});

test('core/content.js and core/source.js give the saved theme and the saved source, with the same rules as the real ones', () => {
  const content = read('dashboard/core/content.js');
  const source = read('dashboard/core/source.js');
  assert.ok(/export function savedTheme\(\)/.test(content) && content.includes("import { chooseSource, savedSource } from './source.js';"));
  assert.ok(content.includes("if (savedSource(new Date()) !== 'production') return null;"), 'the sample has its own theme');
  assert.ok(/export function savedSource\(now\) \{\s*if \(sanity\.projectId === ''\) return 'sample';\s*const known = readSavedSettings\(\);\s*if \(known\) return pickSource\(known, now\);\s*return useSampleContent \? 'sample' : 'production';\s*\}/.test(source));
});

test('index.html links the sidebar stylesheet after frame.css, so its rules come later in the cascade', () => {
  const html = read('dashboard/index.html');
  assert.ok(html.indexOf('href="layouts/sidebar.css"') > html.indexOf('href="frame.css"'));
  assert.equal(countOf(html, 'href="layouts/sidebar.css"'), 1);
  assert.ok(fs.existsSync(path.join(dashboardFolder, 'layouts/sidebar.css')));
});

test('every rule in sidebar.css is for the sidebar layout only, so the standard layout is never touched, and nothing in it moves or glows', () => {
  const css = withoutComments(read('dashboard/layouts/sidebar.css'));
  const selectors = [];
  css.replace(/([^{}]+)\{[^{}]*\}/g, (all, list) => {
    list.split(',').forEach(selector => selectors.push(selector.trim()));
    return all;
  });

  assert.ok(selectors.length > 10, 'the file has rules');
  selectors.forEach(selector => assert.ok(selector.startsWith('html[data-layout="sidebar"] '), 'not scoped to the sidebar layout: ' + selector));
  assert.ok(!/(animation|transition|@keyframes|filter|box-shadow|text-shadow|blur\(|gradient|blend)/.test(css), 'no animation, glow, shadow, blur or gradient in a layout');
  assert.ok(/transform: scale\(var\(--pane-scale\)\);\s*transform-origin: 0 0;/.test(css), 'the pane is scaled by one number, from its corner');
  assert.ok(!/scale(X|Y)|scale\([^)]*,/.test(css), 'never scaled by two different numbers');
  assert.ok(!/font(-size)?: [^;]*\b([0-3]\d|4[0-3])px/.test(css), 'no text below 44 px');
});

test('the large frame is scaled, and not the region the hidden transitions move', () => {
  const css = withoutComments(read('dashboard/layouts/sidebar.css'));
  const scaled = css.split('}').filter(block => /transform: scale/.test(block)).map(block => block.split('{')[0].trim());
  assert.deepEqual(scaled, ['html[data-layout="sidebar"] .area[data-area="grid1"]']);
});

test('the numbers in docs/layouts.md are the numbers in layout.js', () => {
  const doc = read('docs/layouts.md');
  const row = label => {
    const line = doc.split('\n').find(text => text.startsWith('| ' + label + ' |'));
    assert.ok(line, 'docs/layouts.md has no table row for ' + label);
    return line.split('|').slice(2, 6).map(cell => Number(cell.trim()));
  };
  const numbers = rectangle => [rectangle.x, rectangle.y, rectangle.width, rectangle.height];

  assert.deepEqual(row('Strip'), numbers(g.strip));
  assert.deepEqual(row('Clock slot (in the strip)'), [g.strip.x + g.strip.width - 32 - settings.stripClockWidth, g.strip.y, settings.stripClockWidth, g.strip.height], 'the clock slot is at the right end of the strip, 32 from its end');
  assert.deepEqual(row('Sidebar'), numbers(g.sidebar));
  assert.deepEqual(row('Pane space'), numbers(g.space));
  assert.deepEqual(row('Pane'), numbers(g.pane));
  assert.deepEqual(row('Ticker'), numbers(g.ticker));
  assert.ok(doc.includes('**The strip**') && doc.includes(String(settings.nameSize) + ' px'), 'the strip and the size of the name are described');
  assert.ok(doc.includes('scale ' + g.scale) || doc.includes('scale of ' + g.scale) || doc.includes(String(g.scale)), 'the scale is written down');
});

test('the tests and the docs list this file and the new ones', () => {
  assert.ok(read('README.md').includes('docs/layouts.md'));
  const where = read('docs/where-things-are.md');
  assert.ok(where.includes('node tools/test-layouts.mjs'));
  assert.ok(where.includes('test-layouts.mjs '));
  assert.ok(where.includes('layouts/') && where.includes('layout.js') && where.includes('layout-apply.js'));
  assert.ok(read('docs/adding-a-theme.md').includes('## Layouts'));
});


// The sidebar's content (panels/side, core/countdown.js, core/name.js)
//
// side.js is the real file, on a fake page: a clock the test moves, timers that
// wait in a list, a canvas that measures text, and one fake node for each
// selector the panel asks for. Every write to a node goes in a log.

const sideFiles = ['dashboard/config.js', 'dashboard/frame.js', 'dashboard/registry.js', 'dashboard/panels/side/side.js', 'dashboard/panels/countdown/countdown.js',
  'dashboard/panels/bar-banner/bar-banner.js', 'dashboard/panels/bar-column/bar-column.js']
  .concat(fs.readdirSync(path.join(dashboardFolder, 'core')).filter(name => name.endsWith('.js')).map(name => 'dashboard/core/' + name));
const nameTree = makeTree('name', ['dashboard/core/name.js', 'dashboard/core/text.js']);
const nameModule = await import(urlOf(nameTree, 'dashboard/core/name.js'));
const registryModule = await import(urlOf(mainTree, 'dashboard/registry.js'));
let sideWorlds = 0;

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

// Runs run(world) with the real side.js, core/countdown.js and frame.js on a fake page whose clock is at atMs
async function onSidebar(run, atMs) {
  const folder = makeTree('side-' + (sideWorlds += 1), sideFiles);
  const RealDate = Date;
  const world = { now: atMs || new RealDate(2026, 9, 28, 12, 59, 20, 250).getTime(), timers: [], nextTimer: 1, measured: [], log: [], widthOfOneLetter: 22, stripNodes: {} };

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
  world.pen = { font: '', measureText: text => { world.measured.push(text); return { width: text.length * world.widthOfOneLetter }; } };

  // A panel on the fake page: host.innerHTML is kept, and the panel's element answers for each selector
  world.draw = (content, panelFile) => {
    const element = makeBox(world.log, 'panel');
    const countdown = makeBox(world.log, 'countdown');
    const real = element.querySelector;
    element.querySelector = selector => {
      if (selector === '.side-countdown') return countdown;
      if (selector === '.side-name' && world.nameMoved) return null; // the panel's name was moved into the strip
      if (world.clockMoved && /^\.(side-clock|side-weather|time|suffix|weather-icon|temperature)\b/.test(selector)) return null; // and so were the clock and the weather
      return real(selector);
    };
    const host = { set innerHTML(markup) { world.markup = markup; }, get firstElementChild() { return element; } };

    world.element = element;
    world.countdown = countdown;
    return import(urlOf(folder, panelFile || 'dashboard/panels/side/side.js')).then(module => {
      module.mount(host, content);
      world.module = module;
      return module;
    });
  };

  await withGlobals({
    Date: FakeDate,
    setTimeout: (action, milliseconds) => { world.timers.push({ at: world.now + (milliseconds || 0), id: world.nextTimer++, action: action }); return world.nextTimer; },
    setInterval: () => 0,
    document: {
      documentElement: { dataset: {}, style: { setProperty() {} } },
      createElement: () => ({ getContext: () => world.pen }),
      getElementById: id => (id === 'metal-shapes' ? { insertAdjacentHTML() {} } : id === 'strip-name' ? world.slot || null : id === 'strip-clock' ? world.clockSlot || null : null),
      querySelector: selector => {
        if (selector === '#region-strip .side-name') return world.slot ? world.slot.children[0] || null : null;
        if (world.clockSlot && selector.startsWith('#region-strip ')) {
          const inner = selector.slice('#region-strip '.length);
          if (!world.stripNodes[inner]) world.stripNodes[inner] = makeNode(world.log, 'strip ' + inner);
          return world.stripNodes[inner];
        }
        return null;
      },
      querySelectorAll: () => [],
    },
  }, async () => {
    world.frame = await import(urlOf(folder, 'dashboard/frame.js'));
    world.frame.start({ motion: 'full', speed: 'normal' });
    world.folder = folder;
    world.core = await import(urlOf(folder, 'dashboard/core/countdown.js'));
    await run(world);
  });
}

const teamContent = fields => Object.assign({
  team: { name: 'HAWKTIMUS PRIME', number: '3229', school: 'HOLLY SPRINGS HIGH SCHOOL' },
  weather: { temperature: 104, code: 3, isDay: true },
  status: { source: 'sanity' },
  settings: { countdown: { kickoff: '2027-03-01T12:00', kickoffLabel: 'KICKOFF', rollout: '2027-04-01T12:00', rolloutLabel: 'ROLLOUT' } },
}, fields);

const classesIn = markup => {
  const found = [];
  markup.replace(/class="([^"]*)"/g, (all, list) => { list.split(/\s+/).filter(Boolean).forEach(name => found.push(name)); return all; });
  return found;
};
const sideClasses = ['side', 'side-name', 'side-clock', 'side-weather', 'side-countdown', 'side-brand', 'side-logo', 'side-team', 'side-school', 'side-sample'];


// The name on two lines

test('a name goes on two lines where the longer line is shortest, and a name of one word stays on one line', () => {
  const split = nameModule.splitName;
  assert.deepEqual(split('HAWKTIMUS PRIME'), ['HAWKTIMUS', 'PRIME']);
  assert.deepEqual(split('WE ARE HAWKS'), ['WE ARE', 'HAWKS'], 'three words: 6 and 5 beat 2 and 9');
  assert.deepEqual(split('A B C D'), ['A B', 'C D']);
  assert.deepEqual(split('AA BBBB CC'), ['AA', 'BBBB CC'], 'a tie goes to the first place');
  assert.deepEqual(split('RAM'), ['RAM']);
  assert.deepEqual(split('A'), ['A']);
});

test('spaces at the ends and doubled spaces are dropped, and a name with nothing in it is one empty line', () => {
  assert.deepEqual(nameModule.splitName('  HAWKTIMUS   PRIME  '), ['HAWKTIMUS', 'PRIME']);
  [undefined, null, '', '   '].forEach(odd => assert.deepEqual(nameModule.splitName(odd), [''], JSON.stringify(odd)));
  assert.deepEqual(nameModule.splitName(2026), ['2026'], 'a number is text');
});

test('a letter that is made of two pieces of text stays in one piece: an emoji is one letter', () => {
  const lines = nameModule.splitName('RAM \u{1F40F}');
  assert.deepEqual(lines, ['RAM', '\u{1F40F}']);
  assert.equal(countOf(nameModule.nameLinesMarkup('RAM \u{1F40F}'), 'class="letter"'), 4);
});

test('the name effect gets every letter in order: each line is a name-line and the letters are numbered straight through both', () => {
  const markup = nameModule.nameLinesMarkup('HAWKTIMUS PRIME');
  assert.equal(countOf(markup, 'class="name-line"'), 2);
  assert.equal(countOf(markup, 'class="letter"'), 14, 'no letter for the space that became the line break');
  assert.equal(countOf(markup, 'class="cut cut-1"'), 14);
  assert.deepEqual((markup.match(/--i: \d+/g) || []).map(text => Number(text.slice(5))), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 'PRIME starts at 9, after the S');
  assert.ok(markup.startsWith('<span class="name-line">'));
  assert.equal(markup.split('<span class="name-line">').length, 3, 'two lines');

  const spoken = markup.replace(/<span class="cut[^>]*><\/span>/g, '').replace(/<[^>]+>/g, '|').split('|').filter(Boolean);
  assert.equal(spoken.join(''), 'HAWKTIMUSPRIME');
});

test('a name of one word, or a short odd name, is drawn the same way, and the name on one line is as it was', () => {
  assert.equal(countOf(nameModule.nameLinesMarkup('RAM'), 'class="name-line"'), 1);
  assert.equal(countOf(nameModule.nameLinesMarkup('RAM'), 'class="letter"'), 3);
  assert.equal(countOf(nameModule.nameLinesMarkup(''), 'class="name-line"'), 1, 'one empty line, so the heading keeps its height');
  assert.equal(countOf(nameModule.nameLinesMarkup(''), 'class="letter"'), 0);
  assert.equal(countOf(nameModule.nameLinesMarkup('WE ARE HAWKS'), 'class="letter"'), 11, 'the space inside a line is a letter, as it is in the banner');

  const one = nameModule.nameMarkup('AB');
  assert.equal(countOf(one, 'name-line'), 0, 'the banner has no lines');
  assert.deepEqual((one.match(/--i: \d+/g) || []), ['--i: 0', '--i: 1']);
});


// Which panels stay on screen

test('the sidebar layout draws the side panel in place of the banner and the countdown, and every other layout keeps them', () => {
  assert.deepEqual(registryModule.fixedPanels('standard'), ['banner', 'countdown']);
  assert.deepEqual(registryModule.fixedPanels('sidebar'), ['side']);
  ['upside-down', undefined, null, ''].forEach(odd => assert.deepEqual(registryModule.fixedPanels(odd), ['banner', 'countdown'], String(odd)));

  const side = registryModule.panels.filter(panel => panel.id === 'side')[0];
  assert.equal(side.region, 'banner', 'it is drawn into the banner region');
  assert.equal(side.layout, 'sidebar');
  assert.ok(layout.isLayout(side.layout));
  assert.ok(fs.existsSync(path.join(dashboardFolder, 'panels/side/side.js')) && fs.existsSync(path.join(dashboardFolder, 'panels/side/side.css')));
  assert.equal(new Set(registryModule.panels.map(panel => panel.id)).size, registryModule.panels.length, 'no id twice');
  registryModule.panels.filter(panel => panel.layout).forEach(panel => assert.ok(layout.hasRegion(panel.layout, panel.region), panel.id + ' is in a region its layout has'));
});

test('shell.js draws the panels the layout names, starts the logo of the one that has it, and tells the side panel about new content', () => {
  const shell = read('dashboard/shell.js');
  assert.ok(shell.includes("import { fixedPanels, panels } from './registry.js';"));
  assert.ok(shell.includes('fixedPanels(layoutNow()).forEach(id => {'));
  assert.ok(shell.includes("if (logo) frame.startLogo(logo);"));
  assert.ok(shell.includes("updatePanel('side', content);"));
  assert.equal(countOf(shell, "mountPanel\\('banner'"), 0, 'the banner is no longer named by hand');
});


// What the panel draws

test('the markup has each part of the sidebar once, with its class, and no other class that starts with side-', async () => {
  await onSidebar(async world => {
    const side = await import(urlOf(world.folder, 'dashboard/panels/side/side.js'));
    const markup = side.sideMarkup();
    const classes = classesIn(markup);

    sideClasses.forEach(name => assert.equal(classes.filter(found => found === name).length, 1, name + ' appears once'));
    assert.deepEqual(Array.from(new Set(classes.filter(name => name === 'side' || name.startsWith('side-')))).sort(), sideClasses.slice().sort(), 'no other');
    assert.ok(/<section class="panel side" data-sequence="side">/.test(markup), 'the container is the panel');
    assert.ok(/<div class="logo side-logo">/.test(markup), 'the logo has the class the effects look for, and its own');
    assert.equal(countOf(markup, 'class="team-fill"'), 1, 'the TEAM plate is drawn once');
    assert.equal(countOf(markup, 'wordmark'), 0, 'no wordmark: it is 44 px high and wider than the column');
    assert.equal(countOf(markup, 'data-name-effect'), 1, 'one name for the effect to find');
    assert.equal(countOf(markup, 'class="segment"'), 12, 'the rail has its 12 blocks');

    // the parts of the brand are inside it, and the countdown parts inside the countdown
    const brand = markup.slice(markup.indexOf('class="side-brand"'));
    ['side-logo', 'side-sample', 'side-team', 'side-school'].forEach(name => assert.ok(brand.includes(name), name + ' is in the brand'));
    ['side-clock', 'side-weather', 'side-name'].forEach(name => assert.ok(!brand.includes(name), name + ' is not in the brand'));
    const countdown = markup.slice(markup.indexOf('class="side-countdown"'), markup.indexOf('class="side-brand"'));
    ['top-line', 'days-number', 'time-row', 'segments'].forEach(name => assert.ok(countdown.includes(name), name + ' is in the countdown'));
  });
});

test('every part that arrives has a line in the table of frame.js, and every line is for a part', async () => {
  await onSidebar(async world => {
    const side = await import(urlOf(world.folder, 'dashboard/panels/side/side.js'));
    const parts = new Set((side.sideMarkup().match(/data-part="([a-z-]+)"/g) || []).map(text => /"([a-z-]+)"/.exec(text)[1]));
    const table = world.frame.sequences.side;

    assert.ok(table, 'frame.js has a side table');
    parts.forEach(part => assert.ok(table[part], part + ' has no line in sequences.side'));
    Object.keys(table).forEach(part => assert.ok(parts.has(part), 'sequences.side has a line for ' + part + ', which the panel does not have'));
    Object.keys(table).forEach(part => assert.ok(Array.isArray(table[part]) && table[part].length >= 2, part));
  });
});

test('the clock is two digit hours and PM at 12:59, then the next minute at 1:00 with nothing else written, and the date turns over at midnight', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent());
    const shown = selector => world.element.nodes[selector].textContent;

    assert.equal(shown('.time'), '12:59');
    assert.equal(shown('.suffix'), 'PM');
    assert.equal(shown('.side-clock .date'), 'WED OCT 28');

    world.log.length = 0;
    for (let tick = 0; tick < 39; tick++) world.nextTick();
    assert.equal(shown('.time'), '12:59', 'still the same minute');
    assert.ok(!world.log.includes('panel .time.text'), 'the clock was not written in that minute');

    world.nextTick(); // 1:00:00 PM
    assert.equal(shown('.time'), '1:00');
    assert.equal(shown('.suffix'), 'PM');
    assert.equal(world.log.filter(entry => entry === 'panel .time.text').length, 1);
    assert.ok(!world.log.includes('panel .suffix.text') && !world.log.includes('panel .side-clock .date.text'), 'the PM and the date are the same, so they are not written');
  });
});

test('the clock shows 12:00 AM and the new date at midnight, and a single digit hour in the morning', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent());
    const shown = selector => world.element.nodes[selector].textContent;
    assert.equal(shown('.time'), '11:59');
    assert.equal(shown('.suffix'), 'PM');
    assert.equal(shown('.side-clock .date'), 'WED OCT 28');

    world.nextTick(); // 11:59:59
    world.nextTick(); // 12:00:00 the next day
    assert.equal(shown('.time'), '12:00');
    assert.equal(shown('.suffix'), 'AM');
    assert.equal(shown('.side-clock .date'), 'THU OCT 29');
  }, new Date(2026, 9, 28, 23, 59, 58, 250).getTime());

  await onSidebar(async world => {
    await world.draw(teamContent());
    const shown = selector => world.element.nodes[selector].textContent;
    assert.deepEqual([shown('.time'), shown('.suffix'), shown('.side-clock .date')], ['9:07', 'AM', 'SUN JAN 3']);
  }, new Date(2027, 0, 3, 9, 7, 30, 250).getTime());
});

test('the weather is the picture and the temperature, three digits and below zero too, and dashes with no picture until there is a reading', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent());
    const shown = selector => world.element.nodes[selector].textContent;
    const icon = world.element.nodes['.weather-icon'];

    assert.equal(shown('.temperature'), '104°F');
    assert.ok(/<svg [^>]*width="48" height="48"/.test(icon.innerHTML), 'the picture is 48, which is more than the 44 the weather pictures may be');

    world.module.update(world.element, teamContent({ weather: { temperature: -10, code: 0, isDay: false } }));
    assert.equal(shown('.temperature'), '-10°F');

    world.module.update(world.element, teamContent({ weather: null }));
    assert.equal(shown('.temperature'), '--°F', 'no reading yet, or one too old');
    assert.equal(icon.innerHTML, '');

    world.module.update(world.element, teamContent({ weather: undefined }));
    assert.equal(shown('.temperature'), '--°F');
  });
});

test('the team number, the school and the SAMPLE CONTENT label follow the content, and the label is empty for the editors\' own', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent({ status: { source: 'sample' } }));
    const shown = selector => world.element.nodes[selector].textContent;

    assert.equal(shown('.team-number'), '3229');
    assert.equal(shown('.school-text'), 'HOLLY SPRINGS HIGH SCHOOL');
    assert.equal(shown('.side-sample'), 'SAMPLE CONTENT');

    world.module.update(world.element, teamContent({ team: { name: 'HAWKTIMUS PRIME', number: '32290', school: 'HOLLY SPRINGS HS' }, status: { source: 'sanity' } }));
    assert.equal(shown('.team-number'), '32290');
    assert.equal(shown('.school-text'), 'HOLLY SPRINGS HS');
    assert.equal(shown('.side-sample'), '', 'gone the moment the content is not the sample');

    world.module.update(world.element, teamContent({ status: undefined }));
    assert.equal(shown('.side-sample'), '', 'a content with no status is not the sample');
  });
});

// A team document as core/sanity.js hands it over
const novaDocument = { code: 'nova', name: 'HAWKTIMUS NOVA', shortName: 'NOVA', number: '3230', logo: '', colors: { primary: '#1F7AE0', plate: '#1E3A6E', accent: '#9BF0FF', neon: '#FF2E8C', pink: '#35F0FF', background: '#060D1A', text: '#FFFFFF' }, mirror: true, active: true, order: 20 };

test('the sidebar draws the team that is on the screen: its name and number, the school of the Team box, and its logo in place of the hawk, which comes back when there is none', async () => {
  await onSidebar(async world => {
    const teams = await import(urlOf(world.folder, 'dashboard/core/teams.js'));
    document.documentElement.classList = { add() {}, remove() {} };

    const base = teamContent();
    const withTeam = team => teamContent({ teams: [team], settings: Object.assign({}, base.settings, { teamMode: 'nova' }) });
    const first = withTeam(novaDocument);
    teams.useTeams(first, new Date(0));
    await world.draw(first);
    const shown = selector => world.element.nodes[selector].textContent;

    assert.equal(world.element.nodes['.side-name'].dataset.name, 'HAWKTIMUS NOVA');
    assert.equal(shown('.team-number'), '3230');
    assert.equal(shown('.school-text'), 'HOLLY SPRINGS HIGH SCHOOL', 'the school is the same for both teams');

    // the logo is a picture put in the logo box, and the hawk is hidden by the stylesheet while it shows
    const box = world.element.nodes['.side-logo'];
    const appended = [];
    const removed = [];
    box.appendChild = child => appended.push(child);
    const realCreate = document.createElement;
    document.createElement = tag => {
      if (tag !== 'img') return realCreate(tag);
      const attributes = {};
      return { className: '', alt: 'x', setAttribute: (name, value) => { attributes[name] = value; }, getAttribute: name => (name in attributes ? attributes[name] : null), remove: () => removed.push('img'), attributes: attributes };
    };

    try {
      const logo = 'https://cdn.sanity.io/images/abc123/production/0123abcd-800x600.jpg?w=600&fit=max&auto=format';
      const second = withTeam(Object.assign({}, novaDocument, { logo: logo }));
      teams.useTeams(second, new Date(0)); // the team that is on the screen with a new logo: it goes on at once
      world.module.update(world.element, second);

      assert.equal(appended.length, 1);
      assert.equal(appended[0].className, 'team-logo');
      assert.equal(appended[0].alt, '');
      assert.equal(appended[0].attributes.src, logo);
      assert.equal(box.dataset.teamLogo, 'on');

      world.module.update(world.element, second);
      assert.equal(appended.length, 1, 'the same logo is not put in again');

      teams.useTeams(first, new Date(0));
      world.module.update(world.element, first);
      assert.deepEqual(removed, ['img'], 'no logo: the picture goes');
      assert.equal(box.dataset.teamLogo, undefined, 'and the hawk is back');
    } finally {
      document.createElement = realCreate;
    }
  });
});

test('the name is built on one line, and is rebuilt only when it changes, so a rebuild never starts the effect again', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent());
    const name = world.element.nodes['.side-name'];

    assert.equal(name.dataset.name, 'HAWKTIMUS PRIME');
    assert.equal(countOf(name.innerHTML, 'name-line'), 0, 'one line: no lines inside the heading');
    assert.equal(countOf(name.innerHTML, 'class="letter"'), 15, 'every letter, and the space between the words');
    assert.equal(countOf(name.innerHTML, 'class="cut cut-1"'), 14, 'a space has no pieces for the effect');

    world.log.length = 0;
    world.module.update(world.element, teamContent());
    assert.ok(!world.log.includes('panel .side-name.html'), 'the same name is not drawn again');

    world.module.update(world.element, teamContent({ team: { name: 'RAM', number: '1', school: 'S' } }));
    assert.equal(countOf(name.innerHTML, 'class="letter"'), 3);

    world.module.update(world.element, teamContent({ team: { name: '', number: '', school: '' } }));
    assert.equal(name.dataset.name, '');
    assert.equal(countOf(name.innerHTML, 'class="letter"'), 0);
    assert.equal(world.element.nodes['.school-text'].textContent, '');
  });
});

test('the name goes into the strip\'s slot when there is one, and is still built and updated there, with the name effect looking for the same heading', async () => {
  await onSidebar(async world => {
    world.slot = { innerHTML: 'old', children: [], appendChild(node) { world.slot.children.push(node); world.nameMoved = true; } };
    await world.draw(teamContent());
    const heading = world.element.nodes['.side-name'];

    assert.equal(world.slot.innerHTML, '', 'the slot is emptied first');
    assert.deepEqual(world.slot.children, [heading], 'the one heading is in the slot');
    assert.equal(heading.dataset.name, 'HAWKTIMUS PRIME', 'and was built');
    assert.equal(countOf(heading.innerHTML, 'class="letter"'), 15);

    // the panel no longer has the heading, so update finds it in the strip
    assert.equal(world.element.querySelector('.side-name'), null);
    world.module.update(world.element, teamContent({ team: { name: 'RAM', number: '1', school: 'S' } }));
    assert.equal(heading.dataset.name, 'RAM', 'the name is updated in the strip');
    assert.equal(countOf(heading.innerHTML, 'class="letter"'), 3);
    assert.equal(world.slot.children.length, 1, 'and nothing else is put in the slot');
  });

  // with no slot the heading stays in the panel, and nothing breaks
  await onSidebar(async world => {
    await world.draw(teamContent());
    assert.equal(world.element.nodes['.side-name'].dataset.name, 'HAWKTIMUS PRIME');
  });

  const code = read('dashboard/panels/side/side.js');
  assert.ok(code.includes("moveTo('strip-name', element, ['.side-name'])") && code.includes("document.getElementById(id)") && code.includes("document.querySelector('#region-strip ' + selector)"));
  assert.ok(/data-name-effect/.test(read('dashboard/panels/side/side.js')) && !/data-part="title"/.test(code), 'the name keeps the mark the effect looks for, and no part name that nothing would enter');
});

test('the clock, the date and the weather go into the strip\'s second slot when there is one, and are still written and updated there', async () => {
  await onSidebar(async world => {
    world.clockSlot = { innerHTML: 'old', children: [], appendChild(node) { world.clockSlot.children.push(node); world.clockMoved = world.clockSlot.children.length >= 2; } };
    await world.draw(teamContent());

    assert.equal(world.clockSlot.innerHTML, '', 'the slot is emptied first');
    assert.equal(world.clockSlot.children.length, 2, 'the clock and the weather, and nothing else');
    assert.equal(world.element.querySelector('.time'), null, 'the panel no longer has them');

    const shown = selector => world.stripNodes[selector].textContent;
    assert.equal(shown('.time'), '12:59', 'the clock is written in the strip');
    assert.equal(shown('.suffix'), 'PM');
    assert.equal(shown('.side-clock .date'), 'WED OCT 28');
    assert.equal(shown('.temperature'), '104°F', 'and so is the weather');
    assert.ok(/<svg [^>]*width="48" height="48"/.test(world.stripNodes['.weather-icon'].innerHTML));

    world.module.update(world.element, teamContent({ weather: { temperature: -10, code: 0, isDay: false } }));
    assert.equal(shown('.temperature'), '-10°F', 'new weather goes to the strip');
    world.nextTick(); // another second of the same minute: nothing is written
    for (let tick = 0; tick < 39; tick++) world.nextTick();
    world.nextTick(); // 1:00:00 PM
    assert.equal(shown('.time'), '1:00', 'the next minute is written in the strip');
  });

  // with no slot the clock stays in the panel, and nothing breaks
  await onSidebar(async world => {
    await world.draw(teamContent());
    assert.equal(world.element.nodes['.time'].textContent, '12:59');
    assert.equal(world.element.nodes['.temperature'].textContent, '104°F');
  });
});


// The countdown

test('the countdown stages: Kickoff, then NOW for the rest of the day, then Rollout, then over, and no date at all', async () => {
  await onSidebar(async world => {
    const stage = (settings, at) => world.core.currentStage(settings, at);
    const settings = { kickoff: '2027-01-09T12:00', kickoffLabel: 'Kickoff in', rollout: '2027-03-01T12:00', rolloutLabel: '' };

    let now = stage(settings, new Date(2026, 9, 28, 12, 0, 0));
    assert.deepEqual([now.label, now.reached], ['KICKOFF', false], 'the label is capitals without the closing IN');

    now = stage(settings, new Date(2027, 0, 9, 12, 0, 0));
    assert.deepEqual([now.label, now.reached], ['KICKOFF', true], 'NOW starts at the second of the zeros');
    now = stage(settings, new Date(2027, 0, 9, 23, 59, 59));
    assert.equal(now.reached, true, 'and lasts to the end of that day');

    now = stage(settings, new Date(2027, 0, 10, 0, 0, 0));
    assert.deepEqual([now.label, now.reached], ['ROLLOUT', false], 'an empty label is the starting one');
    now = stage(settings, new Date(2027, 2, 2, 0, 0, 0));
    assert.deepEqual([now.label, now.target], ['COUNTDOWN OVER', null]);

    now = stage({ kickoff: '', rollout: '' }, new Date(2026, 9, 28));
    assert.deepEqual([now.label, now.target], ['DATE NOT SET', null]);
    now = stage({ kickoff: 'soon', rollout: undefined }, new Date(2026, 9, 28));
    assert.equal(now.label, 'DATE NOT SET', 'a date that cannot be read is no date');
  });
});

test('the last month is tense and the last week is critical, from the numbers in config.js', async () => {
  await onSidebar(async world => {
    assert.deepEqual([config.threat.tenseDays, config.threat.criticalDays], [30, 7]);
    [[400, 'calm'], [31, 'calm'], [30, 'tense'], [8, 'tense'], [7, 'critical'], [1, 'critical'], [0, 'critical']].forEach(([days, level]) => {
      assert.equal(world.core.threatLevel(days), level, days + ' days');
    });
  });
});

test('the sidebar countdown starts calm with the days, hours, minutes and seconds to the date, a three digit day count included', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent());
    const shown = selector => world.countdown.nodes[selector].textContent;
    const left = Math.floor((new Date(2027, 2, 1, 12, 0) - new Date(world.now)) / 1000);

    assert.equal(world.countdown.dataset.level, 'calm');
    assert.equal(shown('.days-number span'), String(Math.floor(left / 86400)));
    assert.ok(Math.floor(left / 86400) > 99, 'three digits in this test');
    assert.equal(shown('.days-word'), 'DAYS');
    assert.equal(shown('.label'), 'KICKOFF IN');
    assert.equal(shown('.date'), 'MAR 1');
    assert.equal(shown('.hours span'), String(Math.floor(left % 86400 / 3600)).padStart(2, '0'));
    assert.equal(shown('.minutes span'), String(Math.floor(left % 3600 / 60)).padStart(2, '0'));
    assert.equal(shown('.seconds span'), String(left % 60).padStart(2, '0'));

    // the clock's own date is not the countdown's: they are different nodes
    assert.notEqual(world.element.nodes['.side-clock .date'], world.countdown.nodes['.date']);
    assert.equal(world.element.nodes['.side-clock .date'].textContent, 'WED OCT 28');
  });
});

test('the sidebar countdown goes tense, then critical, then NOW, then Rollout, as the dates come, from the settings the editors typed', async () => {
  const settingsFor = kickoff => ({ countdown: { kickoff: kickoff, kickoffLabel: 'KICKOFF', rollout: '2027-04-01T12:00', rolloutLabel: 'ROLLOUT' } });
  const states = [
    ['2026-11-20T12:00', 'tense', 'KICKOFF IN'],
    ['2026-11-02T12:00', 'critical', 'KICKOFF IN'],
    ['2026-10-28T09:00', 'critical', 'KICKOFF'], // earlier today: NOW, and NOW has no IN
    ['2026-09-01T09:00', 'calm', 'ROLLOUT IN'],
  ];

  for (const [kickoff, level, label] of states) {
    await onSidebar(async world => {
      await world.draw(teamContent({ settings: settingsFor(kickoff) }));
      assert.equal(world.countdown.dataset.level, level, kickoff);
      assert.equal(world.countdown.nodes['.label'].textContent, label, kickoff);
    });
  }

  await onSidebar(async world => {
    await world.draw(teamContent({ settings: settingsFor('2026-10-28T09:00') }));
    assert.equal(world.countdown.nodes['.date'].textContent, 'NOW');
    assert.equal(world.countdown.nodes['.days-number span'].textContent, '0');
  });

  // new dates from the editors are used on the next second
  await onSidebar(async world => {
    await world.draw(teamContent());
    assert.equal(world.countdown.dataset.level, 'calm');
    world.module.update(world.element, teamContent({ settings: settingsFor('2026-11-02T12:00') }));
    world.nextTick();
    assert.equal(world.countdown.dataset.level, 'critical');
    assert.equal(world.countdown.nodes['.date'].textContent, 'NOV 2');
  });

  // no dates, and dates that are over
  await onSidebar(async world => {
    await world.draw(teamContent({ settings: { countdown: { kickoff: '', rollout: '' } } }));
    assert.equal(world.countdown.nodes['.label'].textContent, 'DATE NOT SET');
    assert.equal(world.countdown.nodes['.date'].textContent, '');
    assert.equal(world.countdown.dataset.level, 'calm');
  });
});

test('the top line has the room of the label\'s own 352 px line, the gap and the widest date (553 px), where the standard countdown has 528', async () => {
  await onSidebar(async world => {
    world.widthOfOneLetter = 35; // KICKOFF IN and JAN 9 together are 15 letters and the gap: 549 px
    const stage = { label: 'KICKOFF', target: new Date(2027, 0, 9), reached: false };

    assert.deepEqual(world.core.topLine(stage), { label: 'KICKOFF', date: 'JAN 9' }, 'the standard room: the IN goes first');
    assert.deepEqual(world.core.topLine(stage, 553), { label: 'KICKOFF IN', date: 'JAN 9' }, 'the sidebar room');
    assert.equal(553, 352 + 24 + 177, 'the room is the 352 line, the 24 gap and the widest date, MAR 29 (177 px)');
    assert.ok(read('dashboard/panels/side/side.js').includes('const COUNTDOWN_LINE_ROOM = 553;'), 'and the panel asks for it');

    await world.draw(teamContent({ settings: { countdown: { kickoff: '2027-01-09T12:00', kickoffLabel: 'KICKOFF', rollout: '', rolloutLabel: '' } } }));
    assert.equal(world.countdown.nodes['.label'].textContent, 'KICKOFF IN', 'the side panel asked for 553');

    world.widthOfOneLetter = 60; // nothing fits beside the date: the date goes, and the IN with it
    assert.deepEqual(world.core.topLine(stage, 553), { label: 'KICKOFF', date: '' });
    assert.deepEqual(world.core.topLine({ label: 'KICKOFF', target: new Date(2027, 0, 9), reached: true }, 553), { label: 'KICKOFF', date: '' });
  });
});

test('the countdown writes only the seconds on most ticks: the sidebar draws no more per second than the standard countdown', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent());
    world.log.length = 0;
    const queries = Object.keys(world.countdown.nodes).length;

    world.nextTick();
    const first = world.log.splice(0).filter(entry => entry.startsWith('countdown'));
    assert.deepEqual(first, ['countdown .seconds span.text', 'countdown .seconds span.animate'], 'only the seconds, and the roll of the new number');
    assert.equal(Object.keys(world.countdown.nodes).length, queries, 'nothing was looked up in the page');
  });
});


// The stylesheet and the docs

test('every rule in side.css is for the sidebar layout only, and nothing in it moves, glows or is smaller than 44 px', () => {
  const css = withoutComments(read('dashboard/panels/side/side.css'));
  const selectors = [];
  css.replace(/([^{}]+)\{[^{}]*\}/g, (all, list) => {
    list.split(',').forEach(selector => selectors.push(selector.trim()));
    return all;
  });

  assert.ok(selectors.length > 40, 'the file has rules');
  selectors.forEach(selector => assert.ok(selector.startsWith('html[data-layout="sidebar"] .side'), 'not scoped to the sidebar layout: ' + selector));
  assert.ok(!/(animation|transition|@keyframes|filter|box-shadow|text-shadow|blur\(|gradient|blend|will-change)/.test(css), 'no animation, glow, shadow, blur or gradient');

  // every text size is one of the tokens, and every token it uses is 44 px or more
  const tokens = read('dashboard/tokens.css');
  const sizes = css.match(/font(-size)?: [^;]*/g) || [];
  assert.ok(sizes.length >= 12, 'found the text sizes');
  sizes.forEach(text => {
    assert.ok(!/font(-size)?: [^;]*\b\d+px\//.test(text) || /var\(--size-[a-z-]+\)\/\d+px/.test(text), 'a size of its own: ' + text);
    (text.match(/var\(--size-[a-z-]+\)/g) || []).forEach(token => {
      const size = Number(new RegExp(token.slice(4, -1) + ': (\\d+)px').exec(tokens)[1]);
      assert.ok(size >= 44, token + ' is ' + size);
    });
  });
  assert.ok(!/(^|[^-])font(-size)?: [^;]*\b([0-3]\d|4[0-3])px/.test(css), 'no text below 44 px');
});

test('the budget in docs/layouts.md is the top and height of each part in side.css, the parts follow one another, and the brand ends at the bottom of the column', () => {
  const css = withoutComments(read('dashboard/panels/side/side.css'));
  const doc = read('docs/layouts.md');
  const prefix = 'html[data-layout="sidebar"] ';
  const valueIn = (block, name) => { const found = new RegExp('(?:^|[;\\s])' + name + ': (-?\\d+)(?:px)?[;\\s]').exec(block); return found ? Number(found[1]) : null; };
  const blockOf = selector => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp('(?:^|\\})\\s*' + escaped + ' \\{([^{}]*)\\}').exec(css);
    return found ? found[1] : null;
  };

  const sideParts = ['side-clock', 'side-weather', 'side-countdown', 'side-brand', 'side-logo', 'side-sample', 'side-team', 'side-school'];
  const countdownParts = ['top-line', 'days', 'days-word', 'stripes', 'lamp', 'time-row', 'segments'];

  const measured = {};
  sideParts.forEach(name => { measured[name] = blockOf(prefix + '.' + name); });
  countdownParts.forEach(name => { measured[name] = blockOf(prefix + '.side-countdown .' + name); });

  const rows = {};
  doc.split('\n').forEach(line => {
    const row = /^\| `\.([a-z-]+)` \| (\d+) \| (\d+) \| ([^|]+) \| ([^|]+) \|/.exec(line);
    if (row) rows[row[1]] = { top: Number(row[2]), height: Number(row[3]), left: /^\d+$/.test(row[4].trim()) ? Number(row[4]) : null, width: /^\d+$/.test(row[5].trim()) ? Number(row[5]) : null };
  });

  sideParts.concat(countdownParts).forEach(name => {
    assert.ok(rows[name], 'docs/layouts.md has no budget row for .' + name);
    assert.ok(measured[name], 'side.css has no rule for .' + name);
    // the lamp is counted from the top of the top line in side.css and from the top of the countdown in the docs
    const top = valueIn(measured[name], 'top') + (name === 'lamp' ? valueIn(measured['top-line'], 'top') : 0);
    assert.equal(rows[name].top, top, '.' + name + ' top in the docs and in side.css');
    ['height', 'left', 'width'].forEach(property => {
      const written = valueIn(measured[name], property);
      if (written !== null && rows[name][property] !== null) assert.equal(rows[name][property], written, '.' + name + ' ' + property + ' in the docs and in side.css');
    });
  });
  assert.equal(rows.stripes.height, Number(/height="(\d+)"/.exec(read('dashboard/core/countdown.js').slice(read('dashboard/core/countdown.js').indexOf('function barsMarkup')))[1]), 'the bars are as high as countdown.js draws them');
  assert.equal(rows.stripes.width, Number(/const STRIPES_WIDTH = (\d+);/.exec(read('dashboard/panels/side/side.js'))[1]), 'and as wide as side.js draws them');
  ['side-name', 'side-wordmark'].forEach(name => {
    assert.equal(rows[name], undefined, name + ' has no row: the name is in the strip, and the wordmark is left out');
    assert.equal(blockOf(prefix + '.' + name), null, 'and side.css does not place it');
  });

  // in the strip: the clock and the weather are inside it, the weather on the date row
  const { 'side-clock': clock, 'side-weather': weather } = rows;
  assert.ok(clock.top >= 0 && clock.top + clock.height <= g.strip.height, 'the clock is inside the strip');
  assert.ok(weather.top >= clock.top && weather.top + weather.height <= clock.top + clock.height, 'the weather is on the clock\'s date row');
  assert.equal(clock.width, settings.stripClockWidth, 'the clock is as wide as its slot');

  // in the column: the countdown at the top, 24 above the brand, and the brand to the bottom
  const column = rows['side-countdown'], brand = rows['side-brand'];
  assert.equal(column.top, 0, 'the first part starts at the top of the column');
  assert.equal(brand.top - (column.top + column.height), 24, 'the gap between the countdown and the brand');
  assert.equal(brand.top + brand.height, g.sidebar.height, 'the brand ends where the column ends');
  ['side-countdown', 'side-brand', 'side-team'].forEach(name => assert.equal(rows[name].left + rows[name].width, g.sidebar.width, name + ' is as wide as the column'));
  ['side-countdown', 'side-brand', 'side-logo', 'side-sample', 'side-team', 'side-school'].forEach(name => assert.ok(rows[name].left + rows[name].width <= g.sidebar.width, name + ' is not wider than the column'));

  // in the brand, from the top: the logo and the label side by side, then the plate, then the school
  const { 'side-logo': logo, 'side-sample': sample, 'side-team': team, 'side-school': school } = rows;
  assert.ok(logo.left + logo.width <= sample.left, 'the label is at the right of the logo');
  assert.ok(logo.top + logo.height <= team.top && sample.top + sample.height <= team.top, 'the logo and the label are above the plate');
  assert.ok(team.top + team.height <= school.top, 'the plate is above the school');
  assert.ok(school.top + school.height <= brand.height, 'the school is inside the brand');
  assert.equal(sample.height, 88, 'the label is two lines of 44 px');
  assert.equal(school.height, 3 * 46, 'the school has room for three lines of 46 px');

  // in the countdown, from the top: the label and date, the days, the DAYS row, the hours, minutes and seconds, the rail
  const line = rows['top-line'], days = rows.days, word = rows['days-word'], bars = rows.stripes, lamp = rows.lamp, time = rows['time-row'], rail = rows.segments;
  assert.equal(line.height, 88, 'the label and the date, 44 each');
  assert.ok(line.top + line.height <= days.top && days.top + days.height <= word.top, 'the label and date, then the days, then the DAYS row');
  [bars, lamp].forEach(part => assert.ok(part.top >= word.top && part.top + part.height <= word.top + word.height, 'the bars and the lamp are on the DAYS row'));
  assert.ok(bars.left >= word.left + 118 + 16, 'the bars start 16 after DAYS (118 wide)');
  assert.ok(bars.left + bars.width + 16 <= g.sidebar.width - 16 - lamp.width, 'and end 16 before the lamp');
  assert.ok(word.top + word.height <= time.top, 'the DAYS row is above the hours, minutes and seconds');
  assert.equal(time.height, 56 + 44, 'the numbers (56) and their units (44)');
  assert.ok(time.top + time.height <= rail.top && rail.top + rail.height <= column.height, 'the rail is under them, inside the countdown');
  [line, days, word, bars, time, rail].forEach(part => { if (part.left !== null && part.width !== null) assert.ok(part.left + part.width <= g.sidebar.width, 'inside the column'); });

  assert.ok(new RegExp('\\.side \\{[^}]*width: ' + g.sidebar.width + 'px;[^}]*height: ' + g.sidebar.height + 'px;').test(css), 'the panel is as big as the column');
});

test('docs/layouts.md has a section called The sidebar that names every part by its class', () => {
  const doc = read('docs/layouts.md');
  assert.ok(/\n## The sidebar\n/.test(doc), 'the section');
  const section = doc.slice(doc.indexOf('\n## The sidebar\n'));
  sideClasses.forEach(name => assert.ok(section.includes('`.' + name + '`'), 'the section does not name .' + name));
});

test('side.js has no animation code, and reads nothing about the size or place of anything', () => {
  const code = read('dashboard/panels/side/side.js');
  assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(|getAnimations|classList/.test(code), false, 'animation code in the panel');
  assert.equal(/offsetWidth|offsetHeight|offsetTop|offsetLeft|getBoundingClientRect|getComputedStyle|clientWidth|clientHeight|scrollWidth|scrollHeight|getClientRects|innerWidth|innerHeight/.test(code), false, 'reads layout');
  ['frame.', 'nameMarkup', 'logoMarkup', 'startCountdown', 'teamPlateMarkup'].forEach(piece => assert.ok(code.includes(piece), 'does not use ' + piece));
  assert.ok(!code.includes('nameLinesMarkup'), 'the name is one line');
});


// The Neon Prime kit (docs/layouts.md, "The kit"): the few elements that core/layout-apply.js adds to the
// blocks, and what neon-kit.css may do with them. Whether the kit moves is tested in tools/test-effects.mjs
// (frame.js) and tools/test-themes.mjs (the check for its stylesheet).

test('the kit is for Neon Prime in the sidebar layout, and for nothing else', () => {
  assert.equal(layout.kitTheme, 'neon-prime');
  assert.equal(layout.hasKit('neon-prime', 'sidebar'), true);
  assert.equal(layout.hasKit('neon-prime', 'standard'), false, 'the sample shows Neon Prime in the standard layout, and the kit has no shapes there');
  assert.equal(layout.hasKit('hawktimus', 'sidebar'), false);
  assert.equal(layout.hasKit('alternate', 'standard'), false);
  assert.equal(layout.hasKit(undefined, undefined), false);
  assert.ok(themes.some(theme => theme.id === layout.kitTheme && theme.layout === 'sidebar'), 'the registry has the theme, with the sidebar layout');
});

test('the kit has a few empty elements for each block of the sidebar layout, and for no other', () => {
  assert.deepEqual(Object.keys(layout.kitMarkup).sort(), layout.blocksOf('sidebar').slice().sort(), 'one list for each block that flies apart');

  let elements = 0;
  Object.keys(layout.kitMarkup).forEach(block => {
    const markup = layout.kitMarkup[block];
    assert.ok(!/<(script|style|img|svg|a|button|input)\b|\son[a-z]+=|href=|src=/i.test(markup), block + ' holds only empty boxes');
    assert.ok(!/>[^<\s]/.test(markup), block + ' holds no text');
    (markup.match(/<(div|i)\b[^>]*>/g) || []).forEach(tag => {
      elements += 1;
      if (tag.indexOf('<div') === 0) assert.ok(/class="kit kit-[a-z]+"/.test(tag), 'a kit box has the classes kit and kit-<name>: ' + tag);
    });
  });
  assert.ok(elements <= 12, 'a few elements, not many: ' + elements);
  assert.equal(elements, 10, 'six boxes and the four bars of the burst');
  assert.ok(/<i><\/i><i><\/i><i><\/i><i><\/i>/.test(layout.kitMarkup.grid1), 'the four bars are in the layer of the large frame');
});

test('the sidebar layout adds the kit inside the four blocks, and the standard layout adds nothing', async () => {
  const page = fakePage();
  await withGlobals({ document: page.document }, () => {
    assert.equal(apply.startLayout('neon-prime', () => null, page.html), 'sidebar');
  });
  layout.blocksOf('sidebar').forEach(block => {
    const element = page.elements['region-' + block];
    assert.deepEqual(element.inserted, [{ where: 'beforeend', markup: layout.kitMarkup[block] }], 'the kit of ' + block + ' goes in its block');
  });
  ['region-banner', 'region-countdown', 'region-grid2', 'sidebar-top', 'sidebar-countdown', 'sidebar-bottom', 'strip-name', 'strip-clock'].forEach(id => {
    assert.deepEqual(page.elements[id].inserted, [], id + ' is left alone: the panels draw into it');
  });

  const standard = fakePage();
  await withGlobals({ document: standard.document }, () => {
    assert.equal(apply.startLayout(null, () => null, standard.html), 'standard');
  });
  Object.keys(standard.elements).forEach(id => assert.deepEqual(standard.elements[id].inserted, [], 'nothing is added to ' + id));
});

test('a page that cannot take the kit still starts in the sidebar layout, and says so', async () => {
  const logged = [];
  const real = console.error;
  console.error = (...parts) => logged.push(parts.join(' '));

  try {
    const page = fakePage();
    page.elements['region-ticker'].insertAdjacentHTML = () => { throw new Error('no markup here'); };
    await withGlobals({ document: page.document }, () => {
      assert.equal(apply.startLayout('neon-prime', () => null, page.html), 'sidebar');
    });
    assert.equal(page.html.dataset.layout, 'sidebar');
    assert.equal(page.elements['region-strip'].hidden, false, 'the layout is set up');
    assert.equal(page.elements['region-banner'].parent, page.elements['sidebar-top']);
    assert.deepEqual(page.html.style.values, layout.cssVariables());
  } finally {
    console.error = real;
  }
  assert.ok(logged.some(line => /Could not add the kit/.test(line)));
});

test('the kit stylesheet draws the boxes inside the blocks, lets every click through, and uses the numbers of the layout', () => {
  const css = withoutComments(read('dashboard/neon-kit.css'));
  const rules = [];
  css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/([^{}]+)\{([^{}]*)\}/g, (all, selectors, body) => {
    rules.push({ selectors: selectors.split(',').map(selector => selector.trim()), body: body });
    return all;
  });
  assert.ok(rules.length > 40, 'the rules were found');

  // every rule is for the theme in the sidebar layout, for the kit being on in full motion, or is the base of a box
  rules.forEach(rule => rule.selectors.forEach(selector => {
    const fine = /^html\.theme-neon-prime(\[data-layout="sidebar"\])?( |$)/.test(selector) || selector.indexOf('html[data-kit="on"][data-motion="full"] ') === 0 || selector === '.kit';
    assert.ok(fine, 'a rule of the kit for every theme or layout: ' + selector);
  }));

  const base = rules.filter(rule => rule.selectors.indexOf('.kit') !== -1)[0];
  assert.ok(base && /display:\s*none/.test(base.body) && /position:\s*absolute/.test(base.body) && /pointer-events:\s*none/.test(base.body), 'a kit box is hidden, out of the flow and lets clicks through, until the theme and the layout show it');
  const shown = rules.filter(rule => rule.selectors.indexOf('html.theme-neon-prime[data-layout="sidebar"] .kit') !== -1)[0];
  assert.ok(shown && /display:\s*block/.test(shown.body));

  // the places come from the variables core/layout.js hands over, so a change of the numbers there moves the kit
  const variables = Object.keys(layout.cssVariables());
  (css.match(/var\(--[a-z-]+/g) || []).map(name => name.slice(4)).forEach(name => {
    if (/^--(kit-|neon-|pace$)/.test(name)) return;
    assert.ok(variables.indexOf(name) !== -1, 'the kit uses ' + name + ', which core/layout.js does not give the page');
  });

  assert.ok(!/will-change|z-index:\s*[1-9][0-9]/.test(css), 'no layers promoted by hand, and no big z-index');
});

test('the kit moves few things at once: at most 12 parts play all the time, and each of them has its own time', () => {
  const css = withoutComments(read('dashboard/neon-kit.css'));
  const playing = [];
  css.replace(/([^{}]+)\{([^{}]*)\}/g, (all, selectors, body) => {
    const animation = /(^|;|\s)animation:\s*([^;]*)/.exec(body);
    if (animation && /infinite/.test(animation[2])) playing.push({ selector: selectors.trim().replace(/\s+/g, ' '), value: animation[2].trim() });
    return all;
  });

  assert.ok(playing.length >= 8 && playing.length <= 12, 'about as many as the render counted (9 in a real page): ' + playing.length);
  const durations = playing.map(item => /calc\(([\d.]+)s \* var\(--pace\)\)/.exec(item.value)[1]);
  const delays = playing.map(item => /calc\((-?[\d.]+)s \* var\(--pace\)\)\s+infinite/.exec(item.value));
  assert.ok(delays.every(found => found && Number(found[1]) < 0), 'each starts part of the way in (a negative delay), so none starts with another');
  assert.equal(new Set(durations).size, durations.length, 'every part has a time of its own, so the kit never falls into a loop: ' + durations.join(', '));
  assert.equal(new Set(delays.map(found => found[1])).size, delays.length, 'and a delay of its own');
});

test('the kit stylesheet is linked after the sidebar layout and the decor, so its rules come later in the cascade', () => {
  const html = read('dashboard/index.html');
  const kit = html.indexOf('href="neon-kit.css"');
  assert.ok(kit !== -1, 'index.html links it');
  assert.ok(kit > html.indexOf('layouts/sidebar.css') && kit > html.indexOf('themes/decor/neon-prime-decor.css'));
});

// The look of Neon Prime in this layout (dashboard/themes/decor/neon-prime-decor.css)

const decorText = withoutComments(read('dashboard/themes/decor/neon-prime-decor.css'));
const decorRules = [];
decorText.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/([^{}]+)\{([^{}]*)\}/g, (all, selectors, body) => {
  decorRules.push({ selectors: selectors.split(',').map(selector => selector.trim().replace(/\s+/g, ' ')), body: body });
  return all;
});
const decorValue = (rule, name) => {
  const found = new RegExp('(?:^|[;\\s])' + name + ':\\s*([^;]*)').exec(rule.body);
  return found ? found[1].trim() : undefined;
};
const decorPx = (rule, name) => {
  const found = /^(-?[\d.]+)px$/.exec(decorValue(rule, name) || '');
  return found ? Number(found[1]) : NaN;
};
const decorRuleFor = selector => decorRules.filter(rule => rule.selectors.indexOf('html.theme-neon-prime' + selector) !== -1 || rule.selectors.indexOf('html.theme-neon-prime[data-layout="sidebar"]' + selector) !== -1)[0];

test('the decor draws on the blocks of the sidebar layout only where it fits: the strip\'s frame is the strip, the rail is in the left margin, the ticker\'s bar is under the tag, and nothing is drawn on the pane\'s own box', () => {
  // A box drawn on a block with ::before or ::after starts where the block starts. A layout with other numbers
  // (the decor was once drawn for a column 640 wide and a strip over the pane, and ran over the name and the ticker)
  // must be looked at again, so a new one has to be put in this list on purpose.
  const onBlocks = [];
  decorRules.forEach(rule => rule.selectors.forEach(selector => {
    if (/#region-[a-z0-9]+::(before|after)$/.test(selector)) onBlocks.push(selector.replace('html.theme-neon-prime[data-layout="sidebar"] ', '').replace('html.theme-neon-prime ', ''));
  }));
  assert.deepEqual(onBlocks.sort(), ['#region-sidebar::before', '#region-strip::before'], 'a box on #region-grid1 would draw over the strip or the ticker: ' + onBlocks.join(', '));

  const strip = decorRuleFor(' #region-strip::before');
  assert.ok(strip, 'the strip has its frame');
  assert.deepEqual(['left', 'top', 'width', 'height'].map(name => decorValue(strip, name)), ['0', '0', '100%', '100%'], 'the frame is the strip\'s own box and no bigger, so it never covers the name or the clock');
  assert.ok(/box-sizing:\s*border-box/.test(strip.body) && /pointer-events:\s*none/.test(strip.body));

  const rail = decorRuleFor(' #region-sidebar::before');
  assert.ok(rail, 'the sidebar has its rail');
  const railLeft = g.sidebar.x + decorPx(rail, 'left');
  assert.ok(railLeft >= 0 && railLeft + decorPx(rail, 'width') <= margins.left, 'the rail is in the left margin: ' + railLeft + ' to ' + (railLeft + decorPx(rail, 'width')));
  assert.equal(decorValue(rail, 'top'), '0');
  assert.equal(decorValue(rail, 'height'), '100%', 'and as high as the column');

  const bar = decorRuleFor(' .ticker .tag::after');
  assert.ok(bar, 'the ticker\'s tag has its hazard bar');
  assert.ok(decorPx(bar, 'top') >= settings.tickerHeight, 'the bar is under the 72 px tag, and so never under the message');
  assert.ok(decorPx(bar, 'top') + decorPx(bar, 'height') <= settings.tickerHeight + margins.bottom, 'and on the screen, in the bottom margin');
});

test('the decor names only elements the page has: a class or id that nothing in the dashboard writes would style nothing, or the wrong thing', () => {
  const files = [];
  const walk = folder => fs.readdirSync(path.join(root, folder), { withFileTypes: true }).forEach(entry => {
    const relative = folder + '/' + entry.name;
    if (entry.isDirectory()) { if (!['fonts', 'data', 'assets'].includes(entry.name)) walk(relative); }
    else if (/\.(js|html)$/.test(entry.name)) files.push(relative);
  });
  walk('dashboard');
  const corpus = files.map(read).join('\n');

  // Written by a prefix and a number or an id, and so not found as they stand: the theme class (theme-apply.js),
  // and the three spare pieces of each letter of the name (core/name.js)
  const made = ['theme-neon-prime', 'cut-1', 'cut-2', 'cut-3'];
  const stylesheets = ['dashboard/themes/decor/neon-prime-decor.css', 'dashboard/neon-kit.css'];
  stylesheets.forEach(file => {
    const names = new Set();
    withoutComments(read(file)).replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '').replace(/([^{}]+)\{[^{}]*\}/g, (all, selectors) => {
      selectors.replace(/\[[^\]]*\]/g, '').replace(/[.#]([A-Za-z][\w-]*)/g, (found, name) => { names.add(name); return found; });
      return all;
    });
    assert.ok(names.size > 8, file + ' names classes and ids');
    Array.from(names).filter(name => made.indexOf(name) === -1).forEach(name => assert.ok(corpus.indexOf(name) !== -1, file + ' names "' + name + '", which nothing in the dashboard has'));
  });
  assert.ok(corpus.indexOf("'theme-'") !== -1 || corpus.indexOf('"theme-"') !== -1 || corpus.indexOf('theme-') !== -1, 'the theme class is written by theme-apply.js');
  assert.ok(read('dashboard/core/name.js').indexOf('cut-') !== -1, 'the spare pieces of a letter are numbered by core/name.js');
});

// The style, and the layout it asks for (dashboard/core/style.js)

const everyTheme = themes.map(theme => theme.id);

test('the styles are original, cybertron and minimal, and original is the default', () => {
  assert.deepEqual(config.styles, ['original', 'cybertron', 'minimal']);
  assert.equal(config.defaultSettings.style, 'original');
  config.styles.forEach(name => assert.ok(styles.isStyle(name), name));
  ['', 'Original', 'sidebar', 'bar', 'toString', undefined, null, 7].forEach(odd => assert.equal(styles.isStyle(odd), false, String(odd)));
});

test('the style comes from the setting, the address wins, and anything that is not a style is ignored', () => {
  // saved (Dashboard Settings), asked (?style=), the style that results
  const table = [
    [undefined, undefined, 'original'],
    [null, null, 'original'],
    ['cybertron', null, 'cybertron'],
    ['minimal', '', 'minimal'],
    ['original', undefined, 'original'],
    ['cybertron', 'minimal', 'minimal'],
    ['minimal', 'original', 'original'],
    ['original', 'cybertron', 'cybertron'],
    ['oops', 'minimal', 'minimal'],
    ['minimal', 'oops', 'minimal'],
    ['oops', 'nope', 'original'],
    ['toString', 'constructor', 'original'],
    [7, {}, 'original'],
  ];
  table.forEach(row => assert.equal(styles.chooseStyle(row[0], row[1]), row[2], JSON.stringify(row)));
});

test('Original keeps the layout of the theme, and Cybertron and Minimal have the bar layout whatever the theme says', () => {
  everyTheme.forEach(id => {
    const own = layout.layoutOf(id);
    assert.equal(styles.layoutFor('original', own), own, id + ' with Original');
    assert.equal(styles.layoutFor('cybertron', own), 'bar', id + ' with Cybertron');
    assert.equal(styles.layoutFor('minimal', own), 'bar', id + ' with Minimal');
  });
  ['sidebar', 'standard'].forEach(own => [undefined, null, '', 'oops', 'toString'].forEach(odd => assert.equal(styles.layoutFor(odd, own), own, String(odd) + ' is not a style: the theme decides')));
  assert.ok(everyTheme.includes('neon-prime') && layout.layoutOf('neon-prime') === 'sidebar', 'the sidebar theme is in the table');
});

test('the layout at the start follows the style, the saved theme and the address', () => {
  const sidebarTheme = { defaultTheme: 'neon-prime' };

  assert.equal(layout.chooseLayout(null, null, noon, 'original'), 'standard');
  assert.equal(layout.chooseLayout(null, null, noon), 'standard', 'no style is Original');
  assert.equal(layout.chooseLayout(sidebarTheme, null, noon, 'original'), 'sidebar', 'Original leaves the sidebar theme as it is');
  assert.equal(layout.chooseLayout(null, 'neon-prime', noon, 'original'), 'sidebar');
  ['cybertron', 'minimal'].forEach(style => {
    assert.equal(layout.chooseLayout(null, null, noon, style), 'bar', style);
    assert.equal(layout.chooseLayout(sidebarTheme, null, noon, style), 'bar', style + ' with the sidebar theme saved');
    assert.equal(layout.chooseLayout(null, 'neon-prime', noon, style), 'bar', style + ' with ?theme=neon-prime');
    assert.equal(layout.chooseLayout({ schedule: 'oops', useNow: 5 }, null, noon, style), 'bar', style + ' with a theme that cannot be read');
    assert.equal(layout.chooseLayout({ get defaultTheme() { throw new Error('broken'); } }, null, noon, style), 'bar', style + ' with a theme that throws');
  });
  assert.equal(layout.chooseLayout({ get defaultTheme() { throw new Error('broken'); } }, null, noon, 'original'), 'standard', 'Original and a theme that throws');
});

// A page that records every write to data-style
function stylePage(first) {
  const writes = [];
  const dataset = {};
  Object.defineProperty(dataset, 'style', {
    get: () => first,
    set: value => { writes.push(value); first = value; },
    enumerable: true,
  });
  return { dataset: dataset, writes: writes };
}

test('the style goes on the page as data-style, and only when it changes', () => {
  const page = stylePage('original');
  styles.applyStyle('original', page);
  assert.deepEqual(page.writes, [], 'the same style is not written again');

  styles.applyStyle('cybertron', page);
  styles.applyStyle('cybertron', page);
  styles.applyStyle('minimal', page);
  assert.deepEqual(page.writes, ['cybertron', 'minimal']);

  styles.applyStyle('oops', page);
  styles.applyStyle(undefined, page);
  assert.deepEqual(page.writes, ['cybertron', 'minimal'], 'a name that is not a style is left off the page');
  assert.doesNotThrow(() => styles.applyStyle('minimal', null), 'no page, no error');
});

test('startStyle chooses from the address and the saved setting, and starts in Original when it cannot choose', () => {
  const asked = (query, saved) => {
    const page = { dataset: {} };
    const style = styles.startStyle(query, () => saved, page);
    assert.equal(page.dataset.style, style, 'what it returns is what is on the page');
    return style;
  };
  assert.equal(asked(null, null), 'original');
  assert.equal(asked(null, 'cybertron'), 'cybertron');
  assert.equal(asked('minimal', 'cybertron'), 'minimal');
  assert.equal(asked('oops', 'oops'), 'original');

  const logged = [];
  const real = console.error;
  console.error = (...parts) => logged.push(parts.join(' '));
  try {
    const page = { dataset: {} };
    assert.equal(styles.startStyle(null, () => { throw new Error('storage is off'); }, page), 'original');
    assert.equal(page.dataset.style, 'original');
    assert.equal(styles.startStyle('minimal', () => { throw new Error('storage is off'); }, { dataset: {} }), 'original', 'a saved copy that cannot be read: even the address is not looked at, the start is Original');
  } finally {
    console.error = real;
  }
  assert.ok(logged.length === 2 && logged.every(line => /original style/.test(line)));
});

test('styleNow reads data-style from the page, and is Original with no page, no attribute or a name that is not a style', () => {
  assert.equal(styles.styleNow(null), 'original');
  assert.equal(styles.styleNow({}), 'original');
  assert.equal(styles.styleNow({ dataset: {} }), 'original');
  assert.equal(styles.styleNow({ dataset: { style: 'minimal' } }), 'minimal');
  assert.equal(styles.styleNow({ dataset: { style: 'oops' } }), 'original');
});

test('a style that gives another layout than the page has reloads once, and two styles with the same layout and the same corners never reload', async () => {
  let reloads = 0;
  const store = fakeStorage();
  const window = { sessionStorage: store, location: { reload: () => { reloads += 1; } } };
  const look = (theme, style) => ({ theme: theme, overlay: '', style: style });

  await withGlobals({ window: window, document: pageWith('standard') }, () => {
    assert.equal(apply.holdForLayout(look('hawktimus', 'original')), false, 'Original and the standard theme: the same layout');
    assert.equal(apply.holdForLayout(look('hawktimus', 'cybertron'), () => true), true, 'held while something has the screen');
    assert.equal(reloads, 0);
    assert.equal(apply.holdForLayout(look('hawktimus', 'cybertron'), () => false), true, 'reloading');
    assert.equal(reloads, 1);
    assert.equal(store.data[layout.reloadKey], 'bar');
    assert.equal(apply.holdForLayout(look('hawktimus', 'cybertron'), () => false), false, 'back in the wrong layout: no second reload');
    assert.equal(reloads, 1);
  });

  await withGlobals({ window: window, document: pageWith('bar') }, () => {
    assert.equal(apply.holdForLayout(look('hawktimus', 'cybertron')), false, 'the page is in the bar layout now');
    assert.deepEqual(store.data, {}, 'so the note is gone');
    assert.equal(apply.holdForLayout(look('neon-prime', 'cybertron')), false, 'Cybertron and a sidebar theme: still the bar layout with the same corners, so colours only');
    assert.equal(apply.holdForLayout(look('hawktimus', 'original')), true, 'back to Original reloads again');
    assert.equal(reloads, 2);
  });

  await withGlobals({ window: window, document: pageWith('sidebar') }, () => {
    assert.equal(apply.holdForLayout(look('neon-prime', 'original')), false, 'the sidebar theme with Original is the sidebar layout');
    assert.equal(apply.holdForLayout(look('neon-prime', 'minimal')), true, 'Minimal takes the sidebar theme to the bar layout');
    assert.equal(reloads, 3);
  });

  await withGlobals({ window: window, document: pageWith('standard') }, () => {
    assert.equal(apply.holdForLayout({ theme: 'hawktimus', overlay: '' }), false, 'a look with no style is Original');
    assert.equal(reloads, 3);
  });
});

test('theme-apply.js carries the style in the look and waits for the page change with it, and index.html starts in Original', () => {
  const code = read('dashboard/core/theme-apply.js');
  assert.ok(code.includes("import { chooseStyle } from './style.js';"));
  assert.ok(code.includes('look.style = chooseStyle(content.settings ? content.settings.style : null, asked.style);'), 'the setting, and ?style= over it');
  assert.ok(code.includes('a.theme === b.theme && a.overlay === b.overlay && a.style === b.style'), 'a new style is a new look, so it waits for the same moment as a new theme');
  assert.ok(!/dataset/.test(code), 'the page side is core/style.js, which shell.js asks in the same step (showDecorations)');

  const shell = read('dashboard/shell.js');
  assert.ok(shell.includes("style: params.get('style') }, showDecorations);"), 'the address goes to theme-apply');
  assert.ok(shell.includes('applyStyle(look.style);'), 'the style goes on in the same step as the classes');
  assert.ok(shell.includes("updatePanel('bar-banner', content);") && shell.includes("updatePanel('bar-column', content);"), 'the bar panels follow new content');

  assert.ok(/<html [^>]*data-style="original"/.test(read('dashboard/index.html')), 'the page starts in Original, as it was');
});


// The bar layout's numbers (dashboard/core/layout.js, barSettings and makeBarGeometry)

const b = layout.barGeometry;
const bs = layout.barSettings;
const barInside = { x: bs.margin.left, y: bs.margin.top, width: layout.screen.width - bs.margin.left - bs.margin.right, height: layout.screen.height - bs.margin.top - bs.margin.bottom };

test('the bar layout has the numbers of the pictures: a banner 1856 by 160, a column 300 wide with a rail of 12, a main panel 1484 by 736 with a header of 120, and a ticker 1856 by 72', () => {
  assert.deepEqual([b.banner.width, b.banner.height], [1856, 160]);
  assert.deepEqual([b.war.width, b.war.height], [700, 120]);
  assert.equal(b.column.width, 300);
  assert.equal(b.rail.width, 12);
  assert.deepEqual([b.main.width, b.main.height], [1484, 736]);
  assert.equal(b.header.height, 120);
  assert.equal(b.header.width, b.main.width, 'the header is as wide as the main panel');
  assert.deepEqual([b.ticker.width, b.ticker.height], [1856, 72]);
  assert.equal(b.column.height, b.main.height, 'the column and the main panel are one row');
  assert.equal(b.rail.height, b.main.height);
});

test('the rows add up to the screen: the margins, the banner, 24, the main panel, 24 and the ticker are 1080 high, and the margins, the side column, 36 and the main panel are 1920 wide', () => {
  assert.equal(bs.margin.top + b.banner.height + bs.rowGap + b.main.height + bs.rowGap + b.ticker.height + bs.margin.bottom, layout.screen.height);
  assert.equal(bs.margin.left + b.side.width + bs.columnGap + b.main.width + bs.margin.right, layout.screen.width);
  assert.equal(b.side.width, bs.railWidth + bs.railGap + bs.columnWidth);
  assert.equal(b.middle.y - (b.banner.y + b.banner.height), bs.rowGap, 'the gap under the banner');
  assert.equal(b.ticker.y - (b.middle.y + b.middle.height), bs.rowGap, 'the gap above the ticker');
  assert.equal(b.main.x - (b.side.x + b.side.width), bs.columnGap, 'the gap between the side column and the main panel');
  assert.equal(b.ticker.y + b.ticker.height, layout.screen.height - bs.margin.bottom, 'the ticker is at the bottom margin');
  assert.equal(b.main.x + b.main.width, layout.screen.width - bs.margin.right, 'the main panel is at the right margin');
});

// Every rectangle is on the screen and inside the margins, the parts of a row stand apart, and the parts of a
// block are inside it. label says which geometry it is, so a failure names it.
function checkBarFits(geometry, label) {
  const all = layout.rectanglesOf(geometry);
  assert.deepEqual(Object.keys(all).sort(), ['banner', 'column', 'header', 'main', 'middle', 'name', 'page', 'rail', 'side', 'ticker', 'war'], label + ': the rectangles');
  Object.keys(all).forEach(name => {
    const box = all[name];
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= layout.screen.width && box.y + box.height <= layout.screen.height, label + ': ' + name + ' is on the 1920 x 1080 screen');
    assert.ok(within(box, barInside), label + ': ' + name + ' is inside the margins');
  });

  // The three rows never overlap
  const rows = { banner: geometry.banner, middle: geometry.middle, ticker: geometry.ticker };
  Object.keys(rows).forEach(a => Object.keys(rows).filter(other => other > a).forEach(other => assert.ok(apart(rows[a], rows[other]), label + ': ' + a + ' and ' + other + ' overlap')));

  // In the banner: the name and the war clock, apart, with the gap between them
  [geometry.name, geometry.war].forEach(part => assert.ok(within(part, geometry.banner), label + ': a banner part is inside the banner'));
  assert.ok(apart(geometry.name, geometry.war), label + ': the name and the war clock overlap');
  const gap = geometry.name.x < geometry.war.x ? geometry.war.x - (geometry.name.x + geometry.name.width) : geometry.name.x - (geometry.war.x + geometry.war.width);
  assert.equal(gap, bs.nameGap, label + ': the gap between the name and the war clock');

  // In the row: the side column and the main panel, apart, with the column gap between them. The rail and the column are in the side column
  [geometry.side, geometry.main].forEach(part => assert.ok(within(part, geometry.middle), label + ': a row part is inside the row'));
  assert.ok(apart(geometry.side, geometry.main), label + ': the side column and the main panel overlap');
  [geometry.rail, geometry.column].forEach(part => assert.ok(within(part, geometry.side), label + ': the rail and the column are inside the side column'));
  assert.ok(apart(geometry.rail, geometry.column), label + ': the rail and the column overlap');
  assert.ok(within(geometry.header, geometry.main), label + ': the header is inside the main panel');
  assert.ok(within(geometry.page, geometry.main), label + ': the scaled page is inside the main panel');
}

test('every rectangle of the bar layout is on the screen and inside the margins, and nothing overlaps', () => {
  checkBarFits(b, 'bar');
  assert.equal(bs.margin.left, bs.margin.right, 'the same margin at both sides, so a mirror puts everything back inside the same margins');
});

test('the name has the room it needs: HAWKTIMUS PRIME at the heading size is 985 wide, and its slot is 1052', () => {
  assert.equal(b.name.width, b.banner.width - 2 * bs.bannerPadding - b.war.width - bs.nameGap);
  assert.equal(b.name.x, b.banner.x + bs.bannerPadding);
  assert.equal(b.war.x + b.war.width, b.banner.x + b.banner.width - bs.bannerPadding);
  assert.equal(b.war.y - b.banner.y, b.banner.y + b.banner.height - (b.war.y + b.war.height), 'the war clock is in the middle of the banner\'s height');
  assert.ok(nameWidth[96] <= b.name.width, 'the name at 96 px is not squeezed: ' + nameWidth[96] + ' in ' + b.name.width);
  assert.ok(nameWidth[96] / b.name.width > 0.9, 'and 96 is the biggest heading size that fits, the next is not a token');
});

test('the large frame is scaled by the height of the main panel over 708, the same across and down, never shrinks, and its area is as wide as the panel needs', () => {
  const area = bs.area;
  assert.deepEqual(area, { width: 1152, height: 708 }, 'the size the panels are drawn for (base.css, plate.js)');
  assert.ok(b.scale >= 1, 'text grows with the panel and never shrinks');
  assert.ok(b.scale <= bs.main.height / area.height, 'no bigger than the height allows');
  assert.ok(bs.main.height / area.height - b.scale < 0.0001 + 1e-9, 'and no more than four decimals below it');
  assert.equal(String(b.scale).replace(/^\d\./, '').length <= 4, true, 'four decimals');
  assert.ok(Math.abs(area.height * b.scale - b.page.height) < 0.01, 'the page is as high as the area at that scale');
  assert.ok(b.page.height <= b.main.height && b.main.height - b.page.height < 1, 'it fills the height of the panel');

  assert.ok(b.areaWidth * b.scale <= b.main.width + 1e-9, 'the area at that scale is not wider than the panel');
  assert.ok(b.main.width - b.areaWidth * b.scale < b.scale, 'and is less than one unit short of it');
  assert.ok(b.areaWidth > area.width, 'so the area is wider than the 1152 the panels are written for');
  assert.equal(b.areaWidth, Math.floor(b.main.width / b.scale));
  assert.equal(b.page.x, b.main.x);
  assert.equal(b.page.y, b.main.y);
});

test('the numbers are one set: a taller banner makes a shorter main panel only if the row is made shorter, and a wider column moves the main panel', () => {
  const wider = layout.makeBarGeometry(Object.assign({}, bs, { columnWidth: bs.columnWidth + 20 }));
  assert.equal(wider.main.x, b.main.x + 20);
  assert.equal(wider.column.width, 320);
  assert.equal(wider.name.x, b.name.x, 'the banner does not move');

  const taller = layout.makeBarGeometry(Object.assign({}, bs, { bannerHeight: bs.bannerHeight + 10 }));
  assert.equal(taller.main.y, b.main.y + 10);
  assert.equal(taller.ticker.y, b.ticker.y + 10, 'the rows below it move down. Whether they still fit is what the tests above check');
  assert.ok(taller.ticker.y + taller.ticker.height > layout.screen.height - bs.margin.bottom, 'and this one would not fit, so the tests would fail for it');

  assert.deepEqual(layout.makeBarGeometry(), b, 'with no settings it is the layout\'s own');
});


// The mirror

test('mirroring turns every rectangle across the screen: x becomes 1920 less x and the width, and nothing else changes, so twice is the same as never', () => {
  const rectangles = layout.rectanglesOf(b);
  const mirrored = layout.mirrorGeometry(b);

  Object.keys(rectangles).filter(name => name !== 'page').forEach(name => {
    const was = rectangles[name];
    const now = mirrored[name];
    assert.equal(now.x, layout.screen.width - was.x - was.width, name + ' x');
    assert.deepEqual([now.y, now.width, now.height], [was.y, was.width, was.height], name + ' keeps its height, its size and its row');
  });
  assert.deepEqual(mirrored.page, { x: mirrored.main.x, y: b.page.y, width: b.page.width, height: b.page.height }, 'the page is not turned: it stays at the left edge of the main panel, which has moved, because the panels read from the left');
  assert.equal(mirrored.scale, b.scale, 'the numbers that are not rectangles are the same');
  assert.equal(mirrored.areaWidth, b.areaWidth);
  assert.deepEqual(layout.mirrorGeometry(mirrored), b, 'twice is the same as never');
  assert.deepEqual(layout.mirrorRectangle({ x: 0, y: 5, width: 1920, height: 7 }), { x: 0, y: 5, width: 1920, height: 7 });
});

test('the mirrored layout has the side column and its rail at the right, the war clock at the left and the name at the right, and the banner, the row and the ticker where they were', () => {
  const m = layout.mirrorGeometry(b);

  assert.ok(b.side.x < b.main.x && m.side.x > m.main.x, 'the side column goes to the other side of the main panel');
  assert.ok(b.rail.x < b.column.x && m.rail.x > m.column.x, 'and its rail is at the edge of the screen, outside it');
  assert.equal(m.rail.x + m.rail.width, layout.screen.width - bs.margin.right, 'the rail is at the right margin');
  assert.equal(m.main.x, bs.margin.left, 'the main panel is at the left margin');
  assert.ok(b.name.x < b.war.x && m.name.x > m.war.x, 'the name and the war clock change ends');
  assert.equal(m.war.x, bs.margin.left + bs.bannerPadding, 'the war clock is 40 in from the left end');

  ['banner', 'middle', 'ticker'].forEach(name => assert.deepEqual(m[name], b[name], name + ' is as wide as the screen between the margins, so it is its own mirror'));
  assert.equal(m.header.x, m.main.x, 'the header goes with the main panel');
  assert.equal(b.column.x - (b.rail.x + b.rail.width), bs.railGap, 'the space between the rail and the column');
  assert.equal(m.rail.x - (m.column.x + m.column.width), bs.railGap, 'and the same space, on the other side of the column');
});

test('the layout and its mirror never put anything outside the screen, which is always 1920 x 1080, and nothing overlaps in either', () => {
  assert.deepEqual(layout.screen, { width: 1920, height: 1080 });
  checkBarFits(b, 'bar');
  checkBarFits(layout.mirrorGeometry(b), 'mirrored bar');
  checkBarFits(layout.mirrorGeometry(layout.mirrorGeometry(b)), 'mirrored twice');

  // The sidebar layout is the other one that places things by number. It is not mirrored, and is inside the screen
  [g.strip, g.sidebar, g.space, g.pane, g.frame, g.ticker].forEach(box => assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= layout.screen.width && box.y + box.height <= layout.screen.height, 'the sidebar layout is on the screen: ' + JSON.stringify(box)));
});

test('the screen is a fixed 1920 x 1080 canvas: index.html, base.css, shell.js and the size constants of every layout say so, and nothing is responsive', () => {
  assert.equal(layout.screen.width, 1920);
  assert.equal(layout.screen.height, 1080);
  assert.equal(settings.margin.left + settings.margin.right + g.strip.width, 1920, 'the sidebar layout\'s strip spans the screen between its margins');
  assert.equal(settings.margin.top + g.strip.height + settings.rowGap + g.sidebar.height + settings.rowGap + g.ticker.height + settings.margin.bottom, 1080, 'the sidebar layout\'s rows add up to the height');
  assert.equal(bs.margin.left + bs.margin.right + b.banner.width, 1920, 'the bar layout\'s banner spans the screen between its margins');

  const base = withoutComments(read('dashboard/base.css'));
  const sizeOf = selector => {
    const found = new RegExp('(?:^|\\})\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(base);
    assert.ok(found, 'base.css has a rule for ' + selector);
    return [/(?:^|[;\s])width: (\d+)px/.exec(found[1]), /(?:^|[;\s])height: (\d+)px/.exec(found[1])].map(match => match && Number(match[1]));
  };
  ['#screen', '#world', '#stage', '#overlay', '#night'].forEach(selector => assert.deepEqual(sizeOf(selector), [1920, 1080], selector));
  assert.deepEqual(sizeOf('#backdrop,\n#red-wash,\n#blue-glitch'), [1920, 1080], 'the layers of the hidden transitions');
  assert.ok(!/[\d.]+(vw|vh|vmin|vmax)\b/.test(base), 'base.css sizes nothing in the window\'s units');
  assert.ok(!/@media/.test(base), 'base.css has no media query: nothing reflows');

  const html = read('dashboard/index.html');
  assert.ok(!/<meta[^>]*viewport/i.test(html), 'index.html asks for no viewport');
  assert.ok(/<div id="screen">/.test(html), 'index.html has the one screen');

  const shell = read('dashboard/shell.js');
  const fit = shell.slice(shell.indexOf('function fitToScreen()'), shell.indexOf('// A wall display must never sit blank'));
  assert.ok(fit.includes('window.innerWidth / 1920') && fit.includes('window.innerHeight / 1080'), 'the page is fitted to the window by one scale, from 1920 x 1080');
  assert.ok(fit.includes('screen.style.transform = \'scale(\' + scale + \')\';'));

  ['bar.css', 'sidebar.css'].forEach(file => {
    const css = withoutComments(read('dashboard/layouts/' + file));
    assert.ok(!/@media|@container|[\d.]+(vw|vh|vmin|vmax)\b/.test(css), file + ' has no media query and no size in the window\'s units');
  });
});

test('the mirror in the bar layout is one rule for every flex row of the layout, and the text that stays in reading order is named', () => {
  const css = withoutComments(read('dashboard/layouts/bar.css'));
  const rows = css.match(/html\.mirrored\[data-layout="bar"\][^{}]*\{[^{}]*flex-direction: row-reverse;[^{}]*\}/g) || [];
  assert.equal(rows.length, 1, 'one rule turns the rows');
  const turned = rows[0].slice(0, rows[0].indexOf('{')).split(',').map(selector => selector.trim().replace('html.mirrored[data-layout="bar"] ', ''));
  assert.deepEqual(turned, ['#bar-middle', '.bar-banner', '.bar-column', '.ticker']);

  // Every flex row that the layout declares, in its own stylesheet or in a panel's, is one of them or is a part that keeps its order
  const files = ['layouts/bar.css', 'panels/bar-banner/bar-banner.css', 'panels/bar-column/bar-column.css', 'panels/ticker/ticker.css'];
  const flexRows = [];
  files.forEach(file => {
    withoutComments(read('dashboard/' + file)).replace(/([^{}]+)\{([^{}]*)\}/g, (all, selectors, body) => {
      const direction = /flex-direction: ([a-z-]+)/.exec(body);
      if (/display: flex/.test(body) && (!direction || direction[1] === 'row')) {
        selectors.split(',').forEach(selector => flexRows.push(selector.trim().replace('html[data-layout="bar"] ', '')));
      }
    });
  });
  // A part that is read one way, whatever the layout does: the letters of the name, the time and AM or PM, the picture and the
  // temperature, the TEAM plate's words, the school and the word on the ticker's tag. The mirror only moves them to the other
  // end of their box.
  const keepOrder = ['.bar-name', '.bar-time', '.bar-weather', '.bar-team span', '.bar-school', '.ticker .tag span'];
  const declared = flexRows.filter(selector => !selector.startsWith('html.mirrored'));
  assert.ok(declared.length >= 8, 'found the flex rows: ' + declared.join(', '));
  declared.forEach(selector => assert.ok(turned.indexOf(selector) !== -1 || keepOrder.indexOf(selector) !== -1, selector + ' is a flex row that the mirror does not turn and is not named as keeping its order'));
  turned.forEach(selector => assert.ok(declared.indexOf(selector) !== -1, selector + ' is turned and is not a flex row'));
  keepOrder.forEach(selector => assert.ok(declared.indexOf(selector) !== -1, selector + ' is named and is not a flex row'));
  assert.ok(!/\.bar-time[^{}]*\{[^{}]*row-reverse/.test(css), 'the time is never turned round');

  // The text at the other end of its box
  assert.ok(/html\.mirrored\[data-layout="bar"\] \.bar-name,\s*html\.mirrored\[data-layout="bar"\] \.bar-time \{\s*justify-content: flex-end;\s*\}/.test(css), 'the name and the time go to the other end of their boxes');
  assert.ok(/html\.mirrored\[data-layout="bar"\] \.ticker \.message \{\s*text-align: right;\s*\}/.test(css), 'the ticker\'s message ends at the tag');

  // Text is never mirrored: only a class for decoration is turned, and nothing in a panel carries it
  assert.deepEqual(css.match(/transform: [^;]+;/g).filter(text => /scaleX/.test(text)), ['transform: scaleX(-1);']);
  assert.ok(/html\.mirrored\[data-layout="bar"\] \.mirror-art \{\s*transform: scaleX\(-1\);\s*\}/.test(css));
  const panelFolders = fs.readdirSync(path.join(dashboardFolder, 'panels'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => 'panels/' + entry.name);
  panelFolders.forEach(folder => fs.readdirSync(path.join(dashboardFolder, folder)).forEach(file => assert.ok(!/mirror-art/.test(read('dashboard/' + folder + '/' + file)), folder + '/' + file + ' has text in it, or may have, and carries mirror-art')));
  assert.ok(!/scaleX|scale\(-|rotateY/.test(read('dashboard/styles/original.css')), 'the standard layout\'s mirror turns no picture either');

  // The same answer as the numbers: the row is [side, main] and turns to [main, side], the banner [name, war] to [war, name]
  const m = layout.mirrorGeometry(b);
  const order = geometry => ({ row: geometry.side.x < geometry.main.x ? 'side main' : 'main side', banner: geometry.name.x < geometry.war.x ? 'name war' : 'war name' });
  assert.deepEqual(order(b), { row: 'side main', banner: 'name war' });
  assert.deepEqual(order(m), { row: 'main side', banner: 'war name' });
});

test('the mirror of the standard layout is in original.css: the columns change places and the banner and the ticker turn, as the numbers of base.css say', () => {
  const css = withoutComments(read('dashboard/styles/original.css'));
  const base = withoutComments(read('dashboard/base.css'));
  const prefix = 'html[data-style="original"].mirrored[data-layout="standard"]';

  const selectors = [];
  css.replace(/([^{}]+)\{[^{}]*\}/g, (all, list) => {
    list.split(',').forEach(selector => selectors.push(selector.trim()));
    return all;
  });
  assert.ok(selectors.length >= 12, 'the file has rules');
  selectors.forEach(selector => assert.ok(selector.startsWith(prefix + ' '), 'a rule that is not for the mirrored standard layout would change the screen of a team that is not mirrored: ' + selector));
  assert.ok(!/--[a-z-]+: [^;]*;/.test(css.replace(/--(tx|ty|tz|rx|ry|rz): [^;]*;/g, '')), 'Original sets no custom property of its own, only the poses of the blocks');

  const columns = /grid-template-columns: (\d+)px (\d+)px;/.exec(/#stage \{[^}]*\}/.exec(base)[0]);
  const mirroredColumns = new RegExp(prefix.replace(/[[\]".]/g, '\\$&') + ' #stage \\{\\s*grid-template-columns: (\\d+)px (\\d+)px;').exec(css);
  assert.ok(columns && mirroredColumns);
  assert.deepEqual([mirroredColumns[1], mirroredColumns[2]], [columns[2], columns[1]], 'the two columns of base.css, the other way round');
  assert.ok(css.includes(prefix + ' #region-grid1 { grid-column: 2; }') && css.includes(prefix + ' #region-right { grid-column: 1; }'));
  assert.ok(/#region-grid1 \{ grid-column: 1; grid-row: 2; \}/.test(base), 'base.css has the large frame in column 1');
  assert.ok(/#region-right \{\s*grid-column: 2;/.test(base), 'and the countdown and the small frame in column 2');

  // The flex rows of the banner and the ticker are the ones in their own stylesheets
  const banner = withoutComments(read('dashboard/panels/banner/banner.css'));
  const ticker = withoutComments(read('dashboard/panels/ticker/ticker.css'));
  ['.banner-top', '.banner-bottom'].forEach(name => assert.ok(new RegExp('\\.banner ' + name.replace('.', '\\.') + ' \\{[^}]*display: flex;').test(banner), name + ' is a flex row in banner.css'));
  assert.ok(/\.ticker \{\s*display: flex;/.test(ticker));
  const turnedRule = new RegExp(prefix.replace(/[[\]".]/g, '\\$&') + ' \\.banner \\.banner-top,\\s*' + prefix.replace(/[[\]".]/g, '\\$&') + ' \\.banner \\.banner-bottom,\\s*' + prefix.replace(/[[\]".]/g, '\\$&') + ' \\.ticker \\{\\s*flex-direction: row-reverse;');
  assert.ok(turnedRule.test(css), 'the banner\'s two rows and the ticker are turned by one rule');
  assert.ok(!/data-layout="sidebar"/.test(css), 'the sidebar layout is not mirrored');
  assert.ok(css.includes(prefix + ' #season-front {\n  display: none;\n}'), 'the zones of a seasonal pack, which were measured on the layout as it is not mirrored, are not drawn');
});


// The bar layout on the page, and its stylesheets

test('the bar layout shows the row, moves the large frame into it after the side column, and blocks fly as banner, column, main panel and ticker', async () => {
  const page = fakePage();
  await withGlobals({ document: page.document }, () => {
    assert.equal(apply.startLayout(null, () => null, page.html, 'cybertron'), 'bar');
  });

  assert.equal(page.html.dataset.layout, 'bar');
  assert.equal(page.elements['bar-middle'].hidden, false);
  assert.equal(page.elements['region-column'].hidden, false);
  assert.equal(page.elements['region-grid1'].parent, page.elements['bar-middle'], 'the large frame is in the row');
  assert.equal(page.elements['region-grid1'].parent.children[page.elements['bar-middle'].children.length - 1], page.elements['region-grid1'], 'last, after the side column');
  assert.equal(page.elements['region-strip'].hidden, true, 'the sidebar layout\'s parts stay hidden');
  assert.equal(page.elements['region-sidebar'].hidden, true);
  assert.equal(page.elements['region-banner'].parent, null, 'the banner stays where index.html has it');
  assert.equal(page.elements['region-ticker'].parent, null);
  assert.deepEqual(blocksOn(page).sort(), layout.blocksOf('bar').map(name => 'region-' + name).sort());
  assert.deepEqual(page.html.style.values, layout.barCssVariables());
  assert.equal(page.elements['region-countdown'].attributes['data-block'], undefined, 'the countdown and the small frame are not blocks');
  assert.equal(page.elements['region-grid2'].attributes['data-block'], undefined);
  assert.deepEqual(page.elements['region-banner'].inserted, [], 'the kit is only for the sidebar layout');
});

test('the style and the theme both count at the start: Minimal with the sidebar theme is the bar layout, Original with it is the sidebar layout', async () => {
  const saved = { defaultTheme: 'neon-prime' };
  await withGlobals({ document: fakePage().document }, () => {
    assert.equal(apply.startLayout(null, () => saved, fakePage().html, 'original'), 'sidebar');
    assert.equal(apply.startLayout(null, () => saved, fakePage().html, 'minimal'), 'bar');
    assert.equal(apply.startLayout('hawktimus', () => saved, fakePage().html, 'cybertron'), 'bar');
    assert.equal(apply.startLayout(null, () => saved, fakePage().html), 'sidebar', 'no style: as before');
  });
});

test('if the bar layout cannot be set up the screen starts in the standard layout, with nothing moved or shown', async () => {
  const real = console.error;
  console.error = () => {};
  try {
    ['bar-middle', 'region-column', 'region-grid1', 'region-banner', 'region-ticker'].forEach(missing => {
      const page = fakePage();
      delete page.elements[missing];
      return withGlobals({ document: page.document }, () => {
        assert.equal(apply.startLayout(null, () => null, page.html, 'minimal'), 'standard', 'no #' + missing);
        assert.equal(page.html.dataset.layout, 'standard');
        assert.equal(page.html.style.values['--bar-scale'], undefined, 'nothing half set up');
        assert.equal(page.elements['region-grid1'] ? page.elements['region-grid1'].parent : null, null, 'nothing was moved');
        assert.equal((page.elements['bar-middle'] || { hidden: true }).hidden, true, 'and nothing was shown');
      });
    });
  } finally {
    console.error = real;
  }
});

test('index.html has the bar row hidden, with the side column in it, links the bar stylesheet and the three style files after frame.css, and the standard blocks are as they were', () => {
  const html = read('dashboard/index.html');
  assert.ok(/<div id="bar-middle" hidden>\s*<div id="region-column" hidden><\/div>\s*<\/div>\s*<div id="region-grid1" data-block><\/div>/.test(html), 'the row is hidden, holds the column, and the large frame follows it');
  assert.ok(!/<div id="bar-middle"[^>]*data-block|<div id="region-column"[^>]*data-block/.test(html), 'only layout-apply.js makes the column a block');

  const link = name => html.indexOf('href="' + name + '"');
  ['layouts/bar.css', 'styles/original.css', 'styles/cybertron.css', 'styles/minimal.css'].forEach(name => {
    assert.equal(countOf(html, 'href="' + name + '"'), 1, name);
    assert.ok(fs.existsSync(path.join(dashboardFolder, name)), name + ' exists');
    assert.ok(link(name) > link('frame.css'), name + ' comes after frame.css, so its rules come later in the cascade');
    assert.ok(link(name) > link('teams.css'), name + ' comes after the team colors, which it reads');
  });
  assert.ok(link('layouts/bar.css') > link('layouts/sidebar.css'));
  assert.ok(link('styles/original.css') > link('layouts/bar.css'), 'the styles come after the layouts');
  assert.ok(link('styles/minimal.css') > link('styles/cybertron.css') && link('styles/cybertron.css') > link('styles/original.css'));
  assert.ok(link('themes/decor/neon-prime-decor.css') > link('styles/minimal.css'), 'a theme\'s own decoration still comes after a style');
  assert.ok(layout.blocksOf('bar').every(block => layout.everyBlock.indexOf(block) !== -1));
  assert.deepEqual(layout.blocksOf('bar'), ['banner', 'column', 'grid1', 'ticker']);
  assert.ok(layout.areasOf('bar').indexOf('grid2') === -1 && layout.hasRegion('bar', 'column') && !layout.hasRegion('bar', 'grid2') && !layout.hasRegion('bar', 'countdown'));
  assert.deepEqual(layout.areasOf('bar'), ['grid1', 'ticker']);
  assert.deepEqual(layout.otherAreas('bar'), ['ticker']);
  assert.deepEqual(layout.decorationLayers('bar'), ['over'], 'a seasonal pack\'s zones were measured on the standard layout');
  assert.equal(layout.hasKit('neon-prime', 'bar'), false, 'the neon kit is for the sidebar layout');
});

test('the bar layout draws two fixed panels, the banner and the side column, and none of the standard layout\'s or the sidebar layout\'s', () => {
  const regionOf = id => panels.filter(panel => panel.id === id)[0].region;
  assert.equal(regionOf('bar-banner'), 'banner');
  assert.equal(regionOf('bar-column'), 'column');
  ['bar-banner', 'bar-column'].forEach(id => assert.equal(panels.filter(panel => panel.id === id)[0].layout, 'bar', id));
  ['banner', 'countdown', 'side', 'bar-banner', 'bar-column'].forEach(id => assert.ok(fs.existsSync(path.join(dashboardFolder, 'panels', id, id + '.js')) && fs.existsSync(path.join(dashboardFolder, 'panels', id, id + '.css')), id));

  const registry = read('dashboard/registry.js');
  const stays = new Function(registry.slice(registry.indexOf('export const panels = [')).replace('export const panels', 'const panels').replace('export function fixedPanels', 'function fixedPanels') + '\nreturn fixedPanels;')();
  assert.deepEqual(stays('bar'), ['bar-banner', 'bar-column']);
  assert.deepEqual(stays('sidebar'), ['side']);
  assert.deepEqual(stays('standard'), ['banner', 'countdown'], 'the standard layout draws what it always did');

  // both panels have an entrance in frame.js, with a rule for every data-part they draw
  const frame = read('dashboard/frame.js');
  ['bar-banner', 'bar-column'].forEach(id => {
    const code = read('dashboard/panels/' + id + '/' + id + '.js');
    const sequence = new RegExp("'" + id + "': \\{([^}]*)\\}").exec(frame);
    assert.ok(sequence, 'frame.js has a sequence for ' + id);
    assert.ok(code.includes('data-sequence="' + id + '"'));
    (code.match(/data-part="[a-z-]+"/g) || []).forEach(part => assert.ok(sequence[1].includes("'" + part.slice(11, -1) + "'"), id + ' draws ' + part + ' and its sequence has no rule for it'));
  });
});

test('the variables the bar stylesheets read are the ones layout.js writes, and all of them are used', () => {
  const variables = layout.barCssVariables();
  const files = ['layouts/bar.css', 'panels/bar-banner/bar-banner.css', 'panels/bar-column/bar-column.css'];
  const used = new Set();
  files.forEach(file => (withoutComments(read('dashboard/' + file)).match(/var\(--bar-[a-z-]+\)/g) || []).forEach(text => used.add(text.slice(4, -1))));

  used.forEach(name => assert.ok(name in variables, name + ' is used and is not written by layout.js'));
  Object.keys(variables).forEach(name => assert.ok(used.has(name), name + ' is written by layout.js and not used in a bar stylesheet'));
  assert.equal(variables['--bar-banner-width'], '1856px');
  assert.equal(variables['--bar-banner-height'], '160px');
  assert.equal(variables['--bar-side-width'], '336px');
  assert.equal(variables['--bar-column-width'], '300px');
  assert.equal(variables['--bar-main-width'], '1484px');
  assert.equal(variables['--bar-main-height'], '736px');
  assert.equal(variables['--bar-war-width'], '700px');
  assert.equal(variables['--bar-war-height'], '120px');
  assert.equal(variables['--bar-ticker-width'], '1856px');
  assert.equal(variables['--bar-scale'], String(b.scale));
  assert.equal(variables['--bar-area-width'], b.areaWidth + 'px');
  Object.keys(variables).filter(name => name !== '--bar-scale').forEach(name => assert.ok(/^-?\d+(\.\d+)?px$/.test(variables[name]), name + ' is a length'));
});

test('every rule in bar.css and in the two bar panels\' stylesheets is for the bar layout only, nothing in them moves or glows, and every text size is a token of 44 px or more', () => {
  const tokens = read('dashboard/tokens.css');
  ['layouts/bar.css', 'panels/bar-banner/bar-banner.css', 'panels/bar-column/bar-column.css'].forEach(file => {
    const css = withoutComments(read('dashboard/' + file));
    const selectors = [];
    css.replace(/([^{}]+)\{[^{}]*\}/g, (all, list) => {
      list.split(',').forEach(selector => selectors.push(selector.trim()));
      return all;
    });

    assert.ok(selectors.length >= 3, file + ' has rules');
    selectors.forEach(selector => assert.ok(/^html(\.mirrored)?\[data-layout="bar"\] /.test(selector), file + ': not scoped to the bar layout: ' + selector));
    assert.ok(!/(animation|transition|@keyframes|filter|box-shadow|text-shadow|blur\(|gradient|blend|will-change)/.test(css), file + ': no animation, glow, shadow, blur or gradient');
    assert.ok(!/(^|[^-])font(-size)?: [^;]*\b([0-3]\d|4[0-3])px/.test(css), file + ': no text below 44 px');
    (css.match(/font(-size)?: [^;]*/g) || []).forEach(text => {
      assert.ok(!/font(-size)?: [^;]*\b\d+px\//.test(text) || /var\(--size-[a-z-]+\)\/(\d+px|var\(--size-[a-z-]+\))/.test(text), file + ': a size of its own: ' + text);
      (text.match(/var\(--size-[a-z-]+\)/g) || []).forEach(token => {
        const size = Number(new RegExp(token.slice(4, -1) + ': (\\d+)px').exec(tokens)[1]);
        assert.ok(size >= 44, token + ' is ' + size);
      });
    });
  });
  assert.ok(/--size-clock: 84px;/.test(tokens), 'the clock in the side column is 84 px, a token');

  // the main panel is scaled by one number, from its corner, on the area, which hidden transitions do not move
  const bar = withoutComments(read('dashboard/layouts/bar.css'));
  assert.ok(/transform: scale\(var\(--bar-scale\)\);\s*transform-origin: 0 0;/.test(bar));
  assert.ok(!/scale(X|Y)\(var|scale\([^)]*,/.test(bar.replace(/scaleX\(-1\)/g, '')), 'never scaled by two different numbers');
  const scaled = bar.split('}').filter(block => /transform: scale\(var/.test(block)).map(block => block.split('{')[0].trim());
  assert.deepEqual(scaled, ['html[data-layout="bar"] .area[data-area="grid1"]']);
});

test('the text sizes below 44 px in the whole dashboard are an explicit list: the war clock labels at 20 and 24 px and the stamped plate ids at 20 px, and no bar or style file has one', () => {
  const allowed = [];
  const walk = folder => fs.readdirSync(path.join(root, folder), { withFileTypes: true }).forEach(entry => {
    const relative = folder + '/' + entry.name;
    if (entry.isDirectory()) { if (!['fonts', 'data', 'assets'].includes(entry.name)) walk(relative); }
    else if (entry.name.endsWith('.css') && (relative.startsWith('dashboard/styles/') || relative.startsWith('dashboard/layouts/bar') || relative.startsWith('dashboard/panels/bar-'))) allowed.push(relative);
  });
  walk('dashboard');
  assert.ok(allowed.length >= 6, 'found the style and bar files: ' + allowed.join(', '));

  // Text of 20 or 24 px is allowed only for the war clock's labels and the plate ids, and neither is drawn yet in these files
  const small = [{ what: 'the war clock labels', sizes: [20, 24] }, { what: 'the stamped plate ids', sizes: [20] }];
  assert.deepEqual(small.map(item => item.what), ['the war clock labels', 'the stamped plate ids']);
  allowed.forEach(file => {
    const css = withoutComments(read(file));
    assert.ok(!/(^|[^-])font(-size)?: [^;]*\b([0-3]\d|4[0-3])px/.test(css), file + ' has text below 44 px, which only the war clock labels and the plate ids may have');
  });
});

test('every literal text size under 44 px in the dashboard stylesheets is on a list: so far only the stamped plate id, 20 px in base.css', () => {
  const found = [];
  const walk = folder => fs.readdirSync(path.join(root, folder), { withFileTypes: true }).forEach(entry => {
    const relative = folder + '/' + entry.name;
    if (entry.isDirectory()) { if (!['fonts', 'data', 'assets'].includes(entry.name)) walk(relative); return; }
    if (!entry.name.endsWith('.css')) return;

    withoutComments(read(relative)).replace(/([^{}]+)\{([^{}]*)\}/g, (all, selectors, body) => {
      (body.match(/font(-size)?: [^;]*/g) || []).forEach(declaration => {
        // a size is a length that does not follow a slash, which is the line height of the font shorthand
        (declaration.match(/(?<![\/\d.])\d+(\.\d+)?px/g) || []).filter(size => parseFloat(size) < 44).forEach(size => {
          found.push({ file: relative, selector: selectors.trim(), size: parseFloat(size) });
        });
      });
      return all;
    });
  });
  walk('dashboard');

  const allowed = [{ file: 'dashboard/base.css', selector: '.plate-id', size: 20 }];
  assert.deepEqual(found, allowed);
});

test('the mirror leaves the frames, their rivets and their ids as they are, and the ids are drawn for Original whether the layout is mirrored or not', () => {
  const css = withoutComments(read('dashboard/styles/original.css'));
  assert.equal(/rivets|plate-id|\.plate\b|\.area|scaleX|rotateY\(180/.test(css), false, 'the mirror of the standard layout moves the regions and never turns a frame round');

  const base = withoutComments(read('dashboard/base.css'));
  assert.ok(base.includes('html[data-style="original"] .rivets { display: inline; }') && base.includes('html[data-style="original"] .plate-id { display: block; }'), 'drawn for Original, mirrored or not');
  assert.equal(/\.mirrored[^{]*(rivets|plate-id)/.test(base), false);
  assert.ok(/--team-initials, "HP"/.test(base), 'before a team is on the page the letters are the Prime team\'s');
});

test('the three style files each set their own custom properties for their own style only', () => {
  const read2 = name => withoutComments(read('dashboard/styles/' + name + '.css'));
  const rules = css => {
    const found = [];
    css.replace(/([^{}]+)\{([^{}]*)\}/g, (all, list, body) => {
      found.push({ selectors: list.split(',').map(selector => selector.trim()), body: body });
      return all;
    });
    return found;
  };

  ['cybertron', 'minimal'].forEach(name => {
    const own = rules(read2(name));
    assert.deepEqual(own[0].selectors, ['html[data-style="' + name + '"]'], name + ' starts with the rule that sets its custom properties');
    own.slice(1).forEach(rule => rule.selectors.forEach(selector => assert.ok(selector.startsWith('html[data-style="' + name + '"]'), name + ': a rule that is not for its own style would change the other: ' + selector)));

    const properties = own[0].body.split(';').map(line => line.trim()).filter(Boolean).map(line => line.split(':')[0].trim());
    assert.ok(properties.length >= 5 && properties.every(property => /^--style-[a-z-]+$/.test(property)), name + ' only sets --style- custom properties: ' + properties.join(', '));
    ['--style-chamfer', '--style-neon', '--style-digits', '--style-grid-size', '--style-grid-opacity'].forEach(property => assert.ok(properties.indexOf(property) !== -1, name + ' sets ' + property));
    assert.ok(!/(^|[^-])font(-size)?:/.test(read2(name)), name + ' has no text of its own');
  });

  // The numbers the order gives
  const value = (name, property) => new RegExp(property + ': ([^;]+);').exec(read2(name))[1];
  assert.equal(value('cybertron', '--style-chamfer'), '56px');
  assert.equal(value('minimal', '--style-chamfer'), '34px');
  assert.equal(value('cybertron', '--style-digits'), '#ffb327', 'amber in Cybertron');
  assert.equal(value('minimal', '--style-digits'), 'var(--team-neon)', 'the team\'s neon in Minimal');
  assert.equal(value('cybertron', '--style-grid-size'), '96px');
  assert.equal(value('minimal', '--style-grid-size'), '48px');
  ['cybertron', 'minimal'].forEach(name => assert.equal(value(name, '--style-grid-opacity'), '.07', name));
  assert.equal(value('cybertron', '--style-scan-opacity'), '.035');
  assert.equal(value('cybertron', '--style-body'), '#15181f');
  assert.equal(value('cybertron', '--style-raised'), '#262b33');

  // Every custom property a style file or a bar panel reads comes from a style, a team or a token
  const known = new Set();
  ['cybertron', 'minimal'].forEach(name => (read2(name).match(/--[a-z-]+(?=:)/g) || []).forEach(property => known.add(property)));
  ['panels/bar-banner/bar-banner.css', 'panels/bar-column/bar-column.css'].forEach(file => {
    (withoutComments(read('dashboard/' + file)).match(/var\(--style-[a-z-]+/g) || []).forEach(text => assert.ok(known.has(text.slice(4)), file + ' reads ' + text.slice(4) + ', which no style sets'));
  });
  assert.ok(/--team-neon: #35f0ff;/.test(read('dashboard/teams.css')), 'the team neon the styles use is set in teams.css');
});

test('the numbers in docs/layouts.md are the numbers of the bar layout in layout.js', () => {
  const doc = read('docs/layouts.md');
  const section = doc.slice(doc.indexOf('\n## The bar layout\n'));
  assert.ok(section.length > 100, 'docs/layouts.md has a section called The bar layout');

  const row = label => {
    const line = section.split('\n').find(text => text.startsWith('| ' + label + ' |'));
    assert.ok(line, 'the bar layout section has no table row for ' + label);
    return line.split('|').slice(2, 6).map(cell => Number(cell.trim()));
  };
  const numbers = rectangle => [rectangle.x, rectangle.y, rectangle.width, rectangle.height];

  assert.deepEqual(row('Banner'), numbers(b.banner));
  assert.deepEqual(row('Name slot'), numbers(b.name));
  assert.deepEqual(row('War clock slot'), numbers(b.war));
  assert.deepEqual(row('Row'), numbers(b.middle));
  assert.deepEqual(row('Rail'), numbers(b.rail));
  assert.deepEqual(row('Side column'), numbers(b.column));
  assert.deepEqual(row('Main panel'), numbers(b.main));
  assert.deepEqual(row('Header'), numbers(b.header));
  assert.deepEqual(row('Page'), [b.page.x, b.page.y, b.page.width, b.page.height]);
  assert.deepEqual(row('Bar ticker'), numbers(b.ticker));
  assert.ok(section.includes(String(b.scale)) && section.includes(String(b.areaWidth)), 'the scale and the width of the area are written down');

  // The mirrored numbers are in the doc too
  const m = layout.mirrorGeometry(b);
  assert.deepEqual(row('Mirrored rail'), numbers(m.rail));
  assert.deepEqual(row('Mirrored side column'), numbers(m.column));
  assert.deepEqual(row('Mirrored main panel'), numbers(m.main));
  assert.deepEqual(row('Mirrored name slot'), numbers(m.name));
  assert.deepEqual(row('Mirrored war clock slot'), numbers(m.war));
  ['The width of the main panel', 'The mirror', 'Styles'].forEach(title => assert.ok(section.includes('### ' + title), 'the section has "' + title + '"'));
});

// The side column's parts (panels/bar-column/bar-column.css), and the budget in docs/layouts.md

test('the budget of the side column in docs/layouts.md is the top and height of each part in bar-column.css, and the parts follow one another inside the column', () => {
  const css = withoutComments(read('dashboard/panels/bar-column/bar-column.css'));
  const doc = read('docs/layouts.md');
  const section = doc.slice(doc.indexOf('### The side column'), doc.indexOf('### The width of the main panel'));
  const prefix = 'html[data-layout="bar"] ';
  const blockOf = selector => {
    const escaped = (prefix + selector).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp('(?:^|\\})\\s*' + escaped + ' \\{([^{}]*)\\}').exec(css);
    return found ? found[1] : null;
  };
  const valueIn = (block, name) => { const found = new RegExp('(?:^|[;\\s])' + name + ': (-?\\d+)(?:px)?[;\\s]').exec(block || ''); return found ? Number(found[1]) : null; };

  const parts = ['bar-clock', 'bar-time', 'bar-date', 'bar-weather', 'bar-team', 'bar-school', 'bar-sample', 'bar-logo'];
  const rows = {};
  section.split('\n').forEach(line => {
    const row = /^\| `\.([a-z-]+)` \| (\d+) \| (\d+) \| (\d+) \| (\d+) \|/.exec(line);
    if (row) rows[row[1]] = { top: Number(row[2]), height: Number(row[3]), left: Number(row[4]), width: Number(row[5]) };
  });
  assert.deepEqual(Object.keys(rows).sort(), parts.slice().sort(), 'the budget has a row for each part, and no other');

  // the parts the stylesheet places by hand have a top, a height and a left of their own. The three parts of the clock follow one another
  const placed = ['bar-clock', 'bar-team', 'bar-school', 'bar-sample', 'bar-logo'];
  placed.forEach(name => {
    const block = blockOf('.' + name);
    assert.ok(block, 'bar-column.css has no rule for .' + name);
    assert.equal(rows[name].top, valueIn(block, 'top'), '.' + name + ' top in the docs and in bar-column.css');
    assert.equal(rows[name].height, valueIn(block, 'height'), '.' + name + ' height');
    if (valueIn(block, 'left') !== null) assert.equal(rows[name].left, valueIn(block, 'left'), '.' + name + ' left');
    if (valueIn(block, 'width') !== null) assert.equal(rows[name].width, valueIn(block, 'width'), '.' + name + ' width');
  });
  ['bar-time', 'bar-date', 'bar-weather'].forEach(name => assert.equal(rows[name].height, valueIn(blockOf('.' + name), 'height'), '.' + name + ' height'));
  assert.equal(rows['bar-time'].top, 0);
  assert.equal(rows['bar-date'].top, rows['bar-time'].height + valueIn(blockOf('.bar-time'), 'margin-bottom'), 'the date is under the time and the gap');
  assert.equal(rows['bar-weather'].top, rows['bar-date'].top + rows['bar-date'].height, 'the weather is under the date');
  assert.equal(rows['bar-clock'].height, rows['bar-weather'].top + rows['bar-weather'].height, 'the clock is as high as its three rows');

  // everything is inside the column, and the parts do not touch
  const column = { x: 0, y: 0, width: b.column.width, height: b.column.height };
  parts.forEach(name => assert.ok(within({ x: rows[name].left, y: rows[name].top, width: rows[name].width, height: rows[name].height }, column), name + ' is inside the column'));
  const stack = ['bar-clock', 'bar-team', 'bar-school', 'bar-sample', 'bar-logo'];
  stack.slice(1).forEach((name, index) => {
    const above = rows[stack[index]];
    assert.ok(above.top + above.height < rows[name].top, stack[index] + ' ends above ' + name);
  });
  assert.equal(rows['bar-logo'].top + rows['bar-logo'].height, b.column.height, 'the logo is at the foot of the column');
  assert.equal(rows['bar-logo'].left + rows['bar-logo'].width / 2, b.column.width / 2, 'in the middle of it');
  assert.equal(rows['bar-sample'].left + rows['bar-sample'].width / 2, b.column.width / 2, 'and so is the label');
  assert.ok(rows['bar-logo'].top - (rows['bar-sample'].top + rows['bar-sample'].height) >= 23, 'the logo\'s parts reach 23 px past its box while the show plays, and have the room above it too');
  assert.equal(rows['bar-school'].height, 4 * 46, 'the school has room for four lines of 46 px');
  assert.equal(rows['bar-sample'].height, 2 * 44, 'the label is two lines of 44 px');
  assert.equal(rows['bar-team'].height, 76, 'the TEAM plate is the banner\'s height');
  assert.ok(/\.bar-logo \{[^}]*--k: \.1545;[^}]*width: 170px;[^}]*height: 137px;/.test(css.replace(/html\[data-layout="bar"\] /g, '')), '--k is the width over 1100');
  assert.ok(Math.abs(170 / 1100 - 0.1545) < 0.0001 && Math.abs(170 * 884 / 1100 - 137) < 0.5, 'and the height is the width times 884 over 1100');
  assert.equal(Number(/const TEAM_PLATE_WIDTH = (\d+);/.exec(read('dashboard/panels/bar-column/bar-column.js'))[1]), b.column.width, 'the TEAM plate is drawn as wide as the column');
});

test('the clock in the side column fits at its worst case: 10:59 with PM at 84 px, with the letters of the time 5 px closer together', () => {
  const css = withoutComments(read('dashboard/panels/bar-column/bar-column.css'));
  const clockSize = 84;
  assert.ok(new RegExp('--size-clock: ' + clockSize + 'px;').test(read('dashboard/tokens.css')));

  const time = worst.time * clockSize / 96; // the widths of the table above were measured at 96 px
  const spacing = Number(/letter-spacing: (-?[\d.]+)em;/.exec(css)[1]) * clockSize;
  const gap = Number(/\.bar-time \{[^}]*gap: (\d+)px;/.exec(css)[1]);
  const together = time + spacing * 5 + gap + worst.suffix; // five characters, each followed by its spacing
  assert.ok(time + worst.suffix > b.column.width, 'with no spacing it does not fit, so the spacing is needed: ' + (time + worst.suffix));
  assert.ok(together <= b.column.width, 'with it, it does: ' + together + ' in ' + b.column.width);
  assert.ok(Math.abs(spacing) <= 6, 'and the letters are not squeezed by more than 6 px');
  assert.ok(worst.date <= b.column.width, 'the date at its widest, MON MAR 29, fits the column');
  assert.ok(worst.weatherIcon + 12 + worst.temperature <= b.column.width, 'and so do the weather picture and 104°F');
});

// The bar layout's two panels (panels/bar-banner and panels/bar-column), on the same fake page as the side panel

const barColumnFile = 'dashboard/panels/bar-column/bar-column.js';
const barBannerFile = 'dashboard/panels/bar-banner/bar-banner.js';
const barClasses = ['bar-column', 'bar-rail', 'bar-body', 'bar-clock', 'bar-time', 'bar-date', 'bar-weather', 'bar-team', 'bar-school', 'bar-sample', 'bar-logo'];

test('the side column has each part once with its class, in the order of the budget, the rail first, and every part that arrives has a line in the table of frame.js', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent(), barColumnFile);
    const classes = classesIn(world.markup);

    barClasses.forEach(name => assert.equal(classes.filter(found => found === name).length, 1, name + ' appears once'));
    assert.deepEqual(Array.from(new Set(classes.filter(name => name.startsWith('bar-')))).sort(), barClasses.slice().sort(), 'no other class that starts with bar-');
    assert.ok(/<section class="panel bar-column" data-sequence="bar-column">/.test(world.markup), 'the container is the panel');
    assert.ok(/<div class="logo bar-logo">/.test(world.markup), 'the logo has the class the effects look for, and its own');
    assert.equal(countOf(world.markup, 'class="team-fill"'), 1, 'the TEAM plate is drawn once');
    assert.equal(countOf(world.markup, 'data-name-effect'), 0, 'the name is in the banner');
    assert.equal(countOf(world.markup, 'wordmark'), 0);

    const at = name => world.markup.search(new RegExp('class="[^"]*\\b' + name + '\\b'));
    assert.ok(at('bar-rail') < at('bar-body'), 'the rail is first in the row, so the mirror puts it at the edge of the screen');
    ['bar-clock', 'bar-team', 'bar-school', 'bar-sample', 'bar-logo'].reduce((before, name) => { assert.ok(at(name) > before, name + ' follows the part before it'); return at(name); }, at('bar-body'));
    ['bar-time', 'bar-date', 'bar-weather'].forEach(name => assert.ok(at(name) > at('bar-clock') && at(name) < at('bar-team'), name + ' is in the clock'));

    const parts = new Set((world.markup.match(/data-part="([a-z-]+)"/g) || []).map(text => /"([a-z-]+)"/.exec(text)[1]));
    const table = world.frame.sequences['bar-column'];
    assert.ok(table, 'frame.js has a table for the side column');
    parts.forEach(part => assert.ok(table[part], part + ' has no line in the table'));
    Object.keys(table).forEach(part => assert.ok(parts.has(part), 'the table has a line for ' + part + ', which the panel does not have'));
  });
});

test('the side column writes the clock, the date, the weather, the team number, the school and the SAMPLE CONTENT label, and writes nothing in a minute that is the same', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent(), barColumnFile);
    const shown = selector => world.element.nodes[selector].textContent;

    assert.deepEqual([shown('.time'), shown('.suffix'), shown('.bar-date')], ['12:59', 'PM', 'WED OCT 28']);
    assert.equal(shown('.team-number'), '3229');
    assert.equal(shown('.school-text'), 'HOLLY SPRINGS HIGH SCHOOL');
    assert.equal(shown('.temperature'), '104°F');
    assert.ok(/<svg [^>]*width="48" height="48"/.test(world.element.nodes['.weather-icon'].innerHTML), 'the picture is 48');
    assert.equal(shown('.bar-sample'), '', 'the editors\' own content has no label');

    world.module.update(world.element, teamContent({ status: { source: 'sample' }, weather: null }));
    assert.equal(shown('.bar-sample'), 'SAMPLE CONTENT');
    assert.equal(shown('.temperature'), '--°F');
    assert.equal(world.element.nodes['.weather-icon'].innerHTML, '');
    world.module.update(world.element, teamContent({ team: { name: 'HAWKTIMUS PRIME', number: '32290', school: 'HOLLY SPRINGS HS' } }));
    assert.deepEqual([shown('.team-number'), shown('.school-text'), shown('.bar-sample')], ['32290', 'HOLLY SPRINGS HS', '']);

    world.log.length = 0;
    for (let tick = 0; tick < 39; tick++) world.nextTick();
    assert.equal(shown('.time'), '12:59', 'still the same minute');
    assert.ok(!world.log.includes('panel .time.text'), 'the clock was not written in that minute');
    world.nextTick(); // 1:00:00 PM
    assert.deepEqual([shown('.time'), shown('.suffix')], ['1:00', 'PM']);
    assert.ok(!world.log.includes('panel .suffix.text') && !world.log.includes('panel .bar-date.text'), 'the PM and the date are the same, so they are not written');
  });
});

test('the banner has the name and the war clock\'s empty slot, draws the name as letters once, and draws a new name when the team changes', async () => {
  await onSidebar(async world => {
    await world.draw(teamContent(), barBannerFile);
    const classes = classesIn(world.markup);
    assert.deepEqual(classes.filter(name => name === 'panel' || name.startsWith('bar-')), ['panel', 'bar-banner', 'bar-name', 'bar-war']);
    assert.ok(/<section class="panel bar-banner" data-sequence="bar-banner">/.test(world.markup));
    assert.ok(world.markup.indexOf('bar-name') < world.markup.indexOf('bar-war'), 'the name is first, so the mirror puts the war clock at the other end');
    assert.ok(world.markup.indexOf('class="plate fills"') < world.markup.indexOf('bar-name'), 'the frame is drawn first, so the name is over it');
    assert.equal(countOf(world.markup, 'class="plate fills"'), 1, 'one frame');
    assert.equal(countOf(world.markup, 'data-name-effect'), 1, 'one name for the effect to find');
    assert.ok(/class="bar-war"[^>]*><\/div>/.test(world.markup), 'the slot is empty');

    const name = world.element.nodes['.bar-name'];
    assert.equal(countOf(name.innerHTML, 'class="letter"'), 'HAWKTIMUS PRIME'.length, 'a letter for each character');
    assert.equal(name.dataset.name, 'HAWKTIMUS PRIME');

    world.log.length = 0;
    world.module.update(world.element, teamContent());
    assert.deepEqual(world.log, [], 'the same name is not drawn again, which would start the name effect again');

    world.module.update(world.element, teamContent({ team: { name: 'HAWKTIMUS NOVA', number: '3230', school: 'HOLLY SPRINGS HIGH SCHOOL' } }));
    assert.equal(name.dataset.name, 'HAWKTIMUS NOVA');
    assert.equal(countOf(name.innerHTML, 'class="letter"'), 'HAWKTIMUS NOVA'.length);
    assert.ok(name.innerHTML.includes('data-letter="N"'));
  });

  ['bar-banner', 'bar-column'].forEach(id => {
    const code = read('dashboard/panels/' + id + '/' + id + '.js');
    assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(|getAnimations|classList/.test(code), false, id + ' has animation code');
    assert.equal(/offsetWidth|offsetHeight|offsetTop|offsetLeft|getBoundingClientRect|getComputedStyle|clientWidth|clientHeight|scrollWidth|scrollHeight|getClientRects|innerWidth|innerHeight/.test(code), false, id + ' reads layout');
  });
});

// The frames of the bar layout (core/plate.js, "The frames of the bar layout"), and the steel, the neon and
// the page background of Cybertron (tokens.css, index.html, base.css, styles/cybertron.css)

const plateTree = makeTree('plate', ['dashboard/core/plate.js']);
const plate = await import(urlOf(plateTree, 'dashboard/core/plate.js'));
const frameKinds = ['bar-main', 'bar-banner', 'bar-ticker'];

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

// The ids that index.html draws once, which the frames point at as well
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

const edgesOf = outline => outline.map((point, index) => [point, outline[(index + 1) % outline.length]]);
const lengthOf = (from, to) => Math.hypot(to[0] - from[0], to[1] - from[1]);
const distanceToLine = (point, from, to) => Math.abs((to[0] - from[0]) * (from[1] - point[1]) - (from[0] - point[0]) * (to[1] - from[1])) / lengthOf(from, to);
const signedArea = outline => outline.reduce((sum, point, index) => {
  const next = outline[(index + 1) % outline.length];
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0) / 2;
const hasText = (markup, text) => markup.indexOf(text) !== -1;

test('the three bar frames are drawn for the boxes of the layout: the main panel for its area, the banner and the ticker for their regions, with the header as high as the large frame\'s', () => {
  const main = plate.barShape('bar-main');
  const banner = plate.barShape('bar-banner');
  const ticker = plate.barShape('bar-ticker');

  assert.deepEqual([main.width, main.height], [b.areaWidth, bs.area.height], 'the area before it is scaled (core/layout.js, areaWidth)');
  assert.deepEqual([banner.width, banner.height], [b.banner.width, b.banner.height]);
  assert.deepEqual([ticker.width, ticker.height], [b.ticker.width, b.ticker.height]);
  assert.equal(plate.barShape('grid1'), null, 'the frames of the other layouts are not bar frames');

  assert.equal(main.tab[4][1], 120, 'the header band ends at y = 120, as the large frame\'s does');
  assert.ok(Math.abs((main.tab[4][1] - 4) * b.scale - b.header.height) < 1, 'which is the header of 120 on the screen: 116 from the line at 4, after the scale');
  assert.equal(main.tab[0][1] > 0 && main.tab[2][0] < main.width, true);
  assert.equal(banner.tab, undefined, 'the banner has no header');
  assert.equal(ticker.tab, undefined, 'and neither has the ticker');

  // The area of each region has its frame, and the ticker has one only in the bar layout
  assert.equal(plate.frameKind('grid1', 'bar'), 'bar-main');
  assert.equal(plate.frameKind('ticker', 'bar'), 'bar-ticker');
  ['standard', 'sidebar'].forEach(name => ['grid1', 'grid2', 'ticker'].forEach(region => assert.equal(plate.frameKind(region, name), region, name + ' ' + region)));
  assert.equal(plate.frameKind('grid2', 'bar'), 'grid2');
});

test('every bar frame is a rectangle with ten corners, 4 inside its box, with a cut corner at the top left and the bottom right and a step at the other two, the same turned half way round', () => {
  const chamfers = { 'bar-main': 56, 'bar-banner': 56, 'bar-ticker': 32 };
  const steps = { 'bar-main': 24, 'bar-banner': 24, 'bar-ticker': 16 };

  frameKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    const outline = shape.outline;
    assert.equal(outline.length, 10, kind + ': ten corners');
    assert.ok(signedArea(outline) > 0, kind + ': the outline runs clockwise on the screen, which the offsets rely on');

    const xs = outline.map(point => point[0]);
    const ys = outline.map(point => point[1]);
    assert.deepEqual([Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys)], [4, shape.width - 4, 4, shape.height - 4], kind + ': the line is 4 inside the box');

    edgesOf(outline).forEach(([from, to], index) => {
      const across = Math.abs(to[0] - from[0]);
      const down = Math.abs(to[1] - from[1]);
      assert.ok(across === 0 || down === 0 || across === down, kind + ': edge ' + index + ' is straight or at 45 degrees');
    });

    const cut = (from, to) => [Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])];
    assert.deepEqual(cut(outline[1], outline[2]), [chamfers[kind], chamfers[kind]], kind + ': the cut corner at the top left');
    assert.deepEqual(cut(outline[6], outline[7]), [chamfers[kind], chamfers[kind]], kind + ': and at the bottom right');
    assert.deepEqual(cut(outline[3], outline[4]), [steps[kind], steps[kind]], kind + ': the step at the top right');
    assert.deepEqual(cut(outline[8], outline[9]), [steps[kind], steps[kind]], kind + ': and at the bottom left');
    assert.equal(outline[4][1] - outline[3][1], steps[kind], kind + ': the top right corner is a step lower');
    assert.equal(outline[8][1] - outline[9][1], steps[kind], kind + ': the bottom left corner is a step higher');

    outline.forEach((point, index) => {
      const opposite = outline[(index + 5) % 10];
      assert.deepEqual([point[0] + opposite[0], point[1] + opposite[1]], [shape.width, shape.height], kind + ': corner ' + index + ' and corner ' + ((index + 5) % 10) + ' are one turn half way round from each other');
    });
  });

  // The cut corner of Cybertron is the one the style names
  const css = withoutComments(read('dashboard/styles/cybertron.css'));
  assert.equal(Number(/--style-chamfer: (\d+)px;/.exec(css)[1]), plate.barShape('bar-main').outline[2][0] - plate.barShape('bar-main').outline[1][0], '--style-chamfer is the cut corner of the large frame and the banner');
});

test('a point of the outline moves along the line half way between its two edges, so every edge of the neon line, the conduit and the brackets is the same distance from the edge it follows', () => {
  frameKinds.forEach(kind => {
    const outline = plate.barShape(kind).outline;

    [10, 16, -22].forEach(distance => {
      const moved = plate.offsetOutline(outline, distance);
      edgesOf(outline).forEach(([from, to], index) => {
        const next = (index + 1) % outline.length;
        [moved[index], moved[next]].forEach(point => assert.ok(Math.abs(distanceToLine(point, from, to) - Math.abs(distance)) < 0.15, kind + ': corner ' + index + ' moved ' + distance + ' is ' + distanceToLine(point, from, to) + ' from its edge'));
      });
      // inward is inside and outward is outside
      assert.ok(distance > 0 ? signedArea(moved) < signedArea(outline) : signedArea(moved) > signedArea(outline), kind + ': ' + distance + ' makes the outline smaller or bigger');
    });

    // a point in the middle of an edge moves straight in, and one that is not on the outline is refused
    const [from, to] = [outline[2], outline[3]];
    const middle = [(from[0] + to[0]) / 2, from[1]];
    assert.deepEqual(plate.offsetPoint(outline, middle, 10), [middle[0], from[1] + 10]);
    assert.deepEqual(plate.offsetPoint(outline, middle, -10), [middle[0], from[1] - 10]);
    assert.throws(() => plate.offsetPoint(outline, [middle[0], from[1] + 30], 10), /not on the outline/);
  });
});

test('the neon line is the outline 10 inside, in two halves that join where the halves of the edge join, and the conduit and the brackets are made from the same corners', () => {
  frameKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    const inner = plate.offsetOutline(shape.outline, 10);

    assert.deepEqual(shape.neon.a, inner.slice(0, shape.split + 1), kind + ': the first half');
    assert.deepEqual(shape.neon.b, inner.slice(shape.split).concat([inner[0]]), kind + ': and the second');
    assert.deepEqual(shape.neon.a[shape.neon.a.length - 1], shape.neon.b[0], kind + ': they meet at the top right');
    assert.deepEqual(shape.neon.b[shape.neon.b.length - 1], shape.neon.a[0], kind + ': and at the bottom left');
    assert.equal(shape.split, 5);

    // Every bolt is at a corner of the outline, and the halves share them
    const bolts = shape.screws.a.concat(shape.screws.b);
    bolts.forEach(point => assert.ok(shape.outline.some(corner => corner[0] === point[0] && corner[1] === point[1]), kind + ': a bolt at ' + point));
    assert.equal(new Set(bolts.map(point => point.join(','))).size, bolts.length, kind + ': no bolt twice');
  });
  assert.equal(plate.barShape('bar-main').screws.a.length + plate.barShape('bar-main').screws.b.length, 6, 'a bolt at every joint of the large frame');
  assert.equal(plate.barShape('bar-banner').screws.a.length + plate.barShape('bar-banner').screws.b.length, 6, 'and of the banner');
  assert.equal(plate.barShape('bar-ticker').screws.a.length + plate.barShape('bar-ticker').screws.b.length, 2, 'the ticker is 72 high, so it has the two at the ends of its cut corners');

  // The brackets are outside the two cut corners, and the conduit is inside
  frameKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    assert.equal(shape.bracketLines.length, 2, kind + ': two brackets');
    const [top, bottom] = shape.bracketLines;
    assert.ok(top.every(point => point[0] < shape.outline[2][0] || point[1] < shape.outline[1][1]), kind + ': the first is at the top left');
    assert.ok(bottom.every(point => point[0] > shape.outline[7][0] || point[1] > shape.outline[6][1]), kind + ': the second is at the bottom right');
    assert.ok(top[1][0] < 4 && top[2][1] < 4 && bottom[1][0] > shape.width - 4 && bottom[2][1] > shape.height - 4, kind + ': outside the line of the edge');
  });
});

test('the main panel\'s frame is cut into 12 pieces with the names the large frame\'s pieces have, the bars tile the outline, and every bolt is in one piece', () => {
  const shape = plate.barShape('bar-main');
  const names = shape.pieces.map(piece => piece.name);

  assert.equal(names.length, 12);
  assert.equal(new Set(names).size, 12, 'no name twice');
  ['plate-header-left', 'plate-header-right', 'plate-body-left', 'plate-body-right', 'edge-top-left', 'edge-top-right', 'edge-right', 'edge-bottom', 'edge-bottom-left', 'corner-top-left', 'corner-bottom-right'].forEach(name => assert.ok(names.indexOf(name) !== -1, name));
  assert.ok(names.indexOf('plate-decor') !== -1, 'the decoration is a plate of its own');
  ['seam-line', 'seam-notch'].forEach(name => assert.equal(names.indexOf(name), -1, 'there is no steel seam under the header: ' + name));

  // The bars are made of points of the outline, and put end to end they are the whole of it
  const bars = shape.pieces.filter(piece => piece.line);
  assert.equal(bars.length, 7);
  const barLength = bars.reduce((sum, piece) => sum + edgesOf(piece.line).slice(0, -1).reduce((all, [from, to]) => all + lengthOf(from, to), 0), 0);
  const outlineLength = edgesOf(shape.outline).reduce((sum, [from, to]) => sum + lengthOf(from, to), 0);
  assert.ok(Math.abs(barLength - outlineLength) < 0.01, 'the bars are ' + barLength + ' long and the outline ' + outlineLength);
  bars.forEach(piece => {
    piece.line.forEach(point => assert.doesNotThrow(() => plate.offsetPoint(shape.outline, point, 1), piece.name + ' starts and ends on the outline'));
    assert.equal(piece.neon.length, piece.line.length, piece.name + ' has its neon line');
    piece.neon.forEach((point, index) => assert.deepEqual(point, plate.offsetPoint(shape.outline, piece.line[index], 10)));
  });

  // Each bolt is in one piece only
  const placed = bars.reduce((all, piece) => all.concat(piece.screws.map(point => point.join(','))), []);
  assert.deepEqual(placed.slice().sort(), shape.screws.a.concat(shape.screws.b).map(point => point.join(',')).sort());
  assert.equal(new Set(placed).size, placed.length);

  // The plates fill the body and the header, between them
  const platesArea = ['plate-header-left', 'plate-header-right', 'plate-body-left', 'plate-body-right'].reduce((sum, name) => sum + Math.abs(signedArea(shape.pieces.filter(piece => piece.name === name)[0].points)), 0);
  assert.ok(Math.abs(platesArea - signedArea(shape.outline)) < 1, 'the four plates are the whole of the plate: ' + platesArea + ' of ' + signedArea(shape.outline));

  assert.equal(plate.barShape('bar-banner').pieces.length, 0, 'the banner leaves as one piece');
  assert.equal(plate.barShape('bar-ticker').pieces.length, 0, 'and the ticker only turns its slats, so it has no pieces');
});

test('the main panel\'s frame has each of its parts once, in the order that puts the shadows under both halves and the page over all of it', async () => {
  await withPlatePage(drawn => {
    const markup = plate.areaMarkup('bar-main');
    assert.ok(isBalanced(markup), 'every tag is closed');
    const once = text => assert.equal(countOf(markup, text), 1, text);

    ['data-part="body"', 'data-part="header-left"', 'data-part="header-right"', 'data-part="decor"', 'data-part="frame-a"', 'data-part="frame-b"', 'data-part="shadow-a"', 'data-part="shadow-b"'].forEach(once);
    ['class="tab-inset"', 'class="tab-bevel"', 'class="tab-line"'].forEach(text => assert.equal(countOf(markup, text), 2, text + ' on the tab and on the piece that is the tab'));
    ['art-seams', 'art-hazard', 'art-conduit', 'art-slashes', 'art-brackets'].forEach(name => assert.equal(countOf(markup, 'art-cybertron ' + name), 2, name + ' once in the frame and once in the piece that is the decoration'));
    assert.equal(countOf(markup, 'class="plate piece"'), 12, 'the pieces');
    assert.equal(countOf(markup, 'class="plate fills"'), 1);
    assert.equal(countOf(markup, 'class="plate shadow-layer"'), 2);

    // The edge has its five layers and its three neon ones in each half, drawn together by the group that has the outline's part
    ['edge-rim', 'edge-face', 'edge-shade', 'edge-ridge', 'edge-neon-wide-2', 'edge-neon-wide-1', 'edge-neon'].forEach(layer => assert.equal(countOf(markup, '<use class="' + layer + '"'), 2 + 7, layer + ' in the two halves and in the seven bars'));
    assert.equal(countOf(markup, '<use class="edge-shadow"'), 2 + 7, 'the shadows of the halves are in svgs of their own');
    assert.equal(countOf(markup, 'data-part="outline"'), 4, 'the four svgs of the frame draw their lines');
    assert.equal(countOf(markup, 'href="#bolt-shape"'), 6 + 6, 'six bolts in the frame and six in the pieces');
    assert.ok(!hasText(markup, 'bolt-shadow') && !hasText(markup, 'screw-shadow'), 'the bolts have no shadow');

    // The order: the fills, the two shadows, the two halves, then the pieces. The page is added after all of it (core/areas.js)
    const at = text => markup.indexOf(text);
    assert.ok(at('class="plate fills"') < at('data-part="shadow-a"') && at('data-part="shadow-a"') < at('data-part="shadow-b"') && at('data-part="shadow-b"') < at('data-part="frame-a"') && at('data-part="frame-a"') < at('data-part="frame-b"') && at('data-part="frame-b"') < at('class="plate piece"'));

    // Every shape the markup points at was drawn into the page, or is one index.html draws once
    const pointedAt = (markup.match(/href="#[a-z0-9-]+"/g) || []).map(text => text.slice(7, -1));
    ['bar-main-a', 'bar-main-b', 'bar-main-neon-a', 'bar-main-neon-b', 'bolt-shape'].forEach(id => assert.ok(pointedAt.indexOf(id) !== -1, id));
    pointedAt.forEach(id => assert.ok(drawn.has(id) || staticIds.has(id), id + ' is not drawn anywhere'));
    assert.ok(drawn.has('bar-main-piece-edge-top-left-neon'), 'each bar has its neon line drawn');
  });
});

test('the ticker\'s frame holds still: its four svgs have names the page change does not lift, and it has no pieces, no glint and no decoration but its brackets', async () => {
  await withPlatePage(drawn => {
    const markup = plate.areaMarkup('bar-ticker');
    (markup.match(/href="#[a-z0-9-]+"/g) || []).forEach(found => assert.ok(drawn.has(found.slice(7, -1)) || staticIds.has(found.slice(7, -1)), found + ' is not drawn anywhere'));
    assert.ok(isBalanced(markup));

    ['still-frame-a', 'still-frame-b', 'still-shadow-a', 'still-shadow-b'].forEach(name => assert.equal(countOf(markup, 'data-part="' + name + '"'), 1, name));
    ['frame-a', 'frame-b', 'shadow-a', 'shadow-b'].forEach(name => assert.equal(countOf(markup, 'data-part="' + name + '"'), 0, name + ' is what the page change lifts'));
    assert.equal(countOf(markup, 'class="plate piece"'), 0);
    assert.ok(!hasText(markup, 'glint') && !hasText(markup, 'plate-id') && !hasText(markup, 'rivets'));
    assert.equal(countOf(markup, 'art-cybertron'), 1);
    assert.equal(countOf(markup, 'art-brackets'), 1, 'only the brackets');
    assert.equal(countOf(markup, 'href="#bolt-shape"'), 2);
    assert.equal(countOf(markup, 'data-part="outline"'), 4, 'but its lines are drawn when it arrives');

    // The part names are the ones frame.css moves, and the page change moves none of the ticker\'s
    const frameCss = read('dashboard/frame.css');
    ['still-frame-a', 'still-frame-b', 'still-shadow-a', 'still-shadow-b'].forEach(name => assert.ok(!hasText(frameCss, '"' + name + '"'), name + ' is not moved'));
    assert.ok(/html\[data-layout="bar"\] \.area\[data-area="ticker"\] \.screw \{ animation-name: none; \}/.test(frameCss), 'and its bolts do not turn');
  });
});

test('the banner draws its own frame like the countdown does: the plate, the two halves with their bolts, and a part for each thing that arrives, every one in the table of frame.js', async () => {
  await withPlatePage(() => {
    const markup = plate.plateMarkup('bar-banner');
    assert.ok(isBalanced(markup));

    assert.equal(countOf(markup, 'class="plate fills"'), 1);
    ['data-part="body"', 'data-part="decor"', 'data-part="frame-a"', 'data-part="frame-b"'].forEach(text => assert.equal(countOf(markup, text), 1, text));
    assert.equal(countOf(markup, 'data-part="outline"'), 2);
    assert.equal(countOf(markup, 'data-part="stud"'), 6, 'six bolts');
    assert.ok(!hasText(markup, 'header-left') && !hasText(markup, 'glint') && !hasText(markup, 'plate-id') && !hasText(markup, 'class="plate piece"'));

    const frame = read('dashboard/frame.js');
    const sequence = /'bar-banner': \{([^}]*)\}/.exec(frame)[1];
    const parts = new Set((markup.match(/data-part="[a-z-]+"/g) || []).map(text => text.slice(11, -1)));
    parts.forEach(part => ['frame-a', 'frame-b'].indexOf(part) !== -1 || assert.ok(sequence.includes("'" + part + "':"), part + ' has no line in the banner\'s table'));
    ['body', 'outline', 'decor', 'stud', 'title', 'war'].forEach(part => assert.ok(sequence.includes("'" + part + "':"), part));
    assert.ok(/'outline':\s*\['draw', (\d+)\]/.test(sequence) && /'decor':\s*\['fade', (\d+)\]/.test(sequence));
    assert.ok(Number(/'decor':\s*\['fade', (\d+)\]/.exec(sequence)[1]) >= Number(/'outline':\s*\['draw', (\d+)\]/.exec(sequence)[1]) + 650, 'the decoration comes after the lines are drawn, which takes 650 ms');
  });
});

test('the frames are small: a handful of svg elements and five new gradients, and no filter, no image and no animation of their own', async () => {
  await withPlatePage(() => {
    const elements = markup => (markup.match(/<(svg|g|polygon|polyline|path|use|circle)[ >]/g) || []).length;
    assert.ok(elements(plate.areaMarkup('bar-main')) <= 150, 'the main panel');
    assert.ok(elements(plate.plateMarkup('bar-banner')) <= 40, 'the banner');
    assert.ok(elements(plate.areaMarkup('bar-ticker')) <= 40, 'the ticker');
    assert.ok(elements(plate.areaMarkup('bar-main-minimal')) <= 150, 'the main panel in Minimal, with its rivets, rust and ticks');
    assert.ok(elements(plate.plateMarkup('bar-banner-minimal')) <= 40, 'the banner in Minimal');
    assert.ok(elements(plate.areaMarkup('bar-ticker-minimal')) <= 40, 'the ticker in Minimal');
  });

  const html = read('dashboard/index.html');
  const gradients = html.match(/<linearGradient id="[a-z-]+"/g) || [];
  ['edge-steel', 'edge-ridge-steel', 'edge-shade-steel', 'armor-face'].forEach(id => assert.ok(gradients.some(text => text.includes('"' + id + '"')), id));
  assert.equal(gradients.length, 12, 'gold 3, red 3, the screw, the logo, steel 3 and the armor plate: ' + gradients.length);
  assert.ok(!/<(filter|image|pattern|mask|clipPath|animate|set)\b/i.test(html), 'no filter, image, pattern, mask, clip or SMIL in the page\'s own drawing');
  assert.deepEqual(html.match(/<radialGradient id="[a-z-]+"/g), ['<radialGradient id="wear-rust"'], 'the one radial gradient is the patch of rust under a Minimal frame\'s wear');
  assert.ok(!/(feGaussianBlur|feDropShadow|box-shadow|text-shadow|backdrop-filter|filter=|filter:)/.test(read('dashboard/core/plate.js')), 'plate.js draws no glow');
});

test('on the screen every frame stays inside 0 to 1920 by 0 to 1080 with its bolts and brackets, in the layout and in its mirror, and the frames are never turned round', () => {
  const place = (kind, box, scale) => {
    const reach = plate.frameExtent(kind);
    return { x: box.x + reach.left * scale, y: box.y + reach.top * scale, width: (reach.right - reach.left) * scale, height: (reach.bottom - reach.top) * scale };
  };
  const onScreen = (box, label) => assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= layout.screen.width && box.y + box.height <= layout.screen.height, label + ' is on the 1920 x 1080 screen: ' + JSON.stringify(box));

  [['the layout', b], ['its mirror', layout.mirrorGeometry(b)]].forEach(([label, geometry]) => {
    onScreen(place('bar-main', geometry.main, b.scale), 'the main panel\'s frame in ' + label);
    onScreen(place('bar-banner', geometry.banner, 1), 'the banner\'s frame in ' + label);
    onScreen(place('bar-ticker', geometry.ticker, 1), 'the ticker\'s frame in ' + label);
  });

  // A frame has the same shape in both: the mirror turns the regions and not the pictures in them, as the pictures of Nova show
  const css = withoutComments(read('dashboard/layouts/bar.css') + read('dashboard/styles/cybertron.css'));
  assert.ok(!/mirrored[^{}]*\.(area|plate)\b|\.(area|plate)\b[^{}]*mirrored/.test(css), 'no rule turns an area or a frame');
  assert.ok(!/mirror-art/.test(read('dashboard/core/plate.js')), 'and plate.js does not ask for it');
});

test('the ticker\'s tag is a plate that is the same at both ends, so the mirror moves it to the other end and has nothing to turn', async () => {
  await withPlatePage(() => {
    const tag = plate.tagMarkup(328);
    const points = /<polygon class="tag-fill" points="([^"]*)"/.exec(tag)[1].split(' ').map(pair => pair.split(',').map(Number));
    assert.equal(points.length, 4);
    // top left, top right, bottom right, bottom left: the slants at the two ends are the same
    assert.ok(Math.abs((points[0][0] - points[3][0]) - (points[2][0] - points[1][0])) < 0.01, 'the same slant at both ends');
    assert.equal(points[0][1], points[1][1]);
    assert.equal(points[2][1], points[3][1]);
  });
});


test('the numbers in the Frames section of docs/layouts.md are the numbers of the shapes in plate.js', () => {
  const doc = read('docs/layouts.md');
  const section = doc.slice(doc.indexOf('\n### Frames\n'), doc.indexOf('\n## What else works in each layout'));
  assert.ok(section.length > 500, 'docs/layouts.md has a section called Frames');

  const chamfers = { 'bar-main': 56, 'bar-banner': 56, 'bar-ticker': 32 };
  frameKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    const line = section.split('\n').find(text => text.startsWith('| `' + kind + '` |'));
    assert.ok(line, 'the table has a row for ' + kind);

    const cells = line.split('|').map(cell => cell.trim());
    const outline = shape.outline;
    assert.equal(cells[2], shape.width + ' x ' + shape.height, kind + ': drawn for');
    assert.equal(Number(cells[3]), chamfers[kind], kind + ': the cut corner');
    assert.equal(Number(cells[3]), outline[2][0] - outline[1][0], kind + ': is what the shape has');
    assert.equal(Number(cells[4]), outline[4][1] - outline[3][1], kind + ': the step');
    assert.equal(Number(cells[5]), (shape.width - 4) - outline[3][0], kind + ': the run');
    assert.equal(Number(cells[6]), shape.screws.a.length + shape.screws.b.length, kind + ': the bolts');
  });

  // The parts and their sizes, as plate.js and the stylesheets have them
  const css = withoutComments(read('dashboard/base.css') + read('dashboard/styles/cybertron.css'));
  ['4 px, `--style-neon`', '14 px and .25 opacity', '24 px and .12', '12 px high, slanted bars 22 px wide every 44', 'six slanted bars in the neon, 22 px wide every 40', 'a leg of 60 px down the side and 70 px along the top', '3 px pink line'].forEach(text => assert.ok(section.includes(text), text));
  assert.ok(/stroke-width: 4px;/.test(css) && /stroke-width: 14px;/.test(css) && /stroke-width: 24px;/.test(css));
  const main = plate.barShape('bar-main');
  assert.equal(main.art.hazard.split('M').length - 1, 32, 'the stripes across the 1399 px under the header');
  assert.equal(main.art.slashes.split('M').length - 1, 6, 'six slashes');
  assert.deepEqual(main.bracketLines.map(line => line.length), [4, 4]);
  assert.ok(Math.abs(main.bracketLines[0][0][1] - main.bracketLines[0][1][1] - 60) < 1e-6, 'a leg of 60 down the side');
  assert.ok(Math.abs(main.bracketLines[0][3][0] - main.bracketLines[0][2][0] - 70) < 1e-6, 'and 70 along the top');
});


// The steel

test('steel is one more metal next to gold and silver: its tokens, its three gradients, and the same edge tokens, for Cybertron and Minimal and for nothing else', () => {
  const tokens = withoutComments(read('dashboard/tokens.css'));
  const found = /([^{}]*\[data-metal="steel"\][^{}]*)\{([^{}]*)\}/.exec(tokens);
  assert.ok(found, 'tokens.css has a rule for the steel');

  const selectors = found[1].split(',').map(selector => selector.trim());
  assert.deepEqual(selectors, ['[data-metal="steel"]', 'html[data-style="cybertron"]', 'html[data-style="cybertron"] [data-metal]', 'html[data-style="minimal"]', 'html[data-style="minimal"] [data-metal]']);
  assert.ok(!selectors.some(selector => /original/.test(selector)), 'Original has the metal it always had');

  const declared = {};
  found[2].split(';').map(line => line.trim()).filter(Boolean).forEach(line => { declared[line.split(':')[0].trim()] = line.slice(line.indexOf(':') + 1).trim(); });
  ['--metal-1', '--metal-2', '--metal-3', '--metal-4', '--metal-5', '--metal-6', '--metal-7', '--metal-8', '--metal-grime', '--metal-rim', '--metal-ridge', '--metal-glint', '--metal-shade', '--metal-flat'].forEach(name => assert.ok(declared[name], 'steel sets ' + name));
  assert.equal(declared['--edge-face'], 'url(#edge-steel)');
  assert.equal(declared['--edge-ridge'], 'url(#edge-ridge-steel)');
  assert.equal(declared['--edge-shade'], 'url(#edge-shade-steel)');

  // Gold and silver keep their rules: the steel never reaches the selectors the others have
  assert.ok(/:root,\s*\[data-metal="gold"\] \{\s*--metal-1: #efe6c4;/.test(tokens));
  assert.ok(/\[data-metal="silver"\] \{\s*--metal-1: #c3c4c3;/.test(tokens));

  // The brightest stop is below pure white and the metal is cool: more blue than red at every stop
  ['--metal-1', '--metal-2', '--metal-3', '--metal-4', '--metal-5', '--metal-6', '--metal-7', '--metal-8', '--metal-grime', '--metal-rim', '--metal-ridge', '--metal-glint', '--metal-flat'].forEach(name => {
    const hex = /^#([0-9a-f]{6})$/.exec(declared[name]);
    assert.ok(hex, name + ' is a plain color');
    const [red, , blue] = [0, 2, 4].map(offset => parseInt(hex[1].slice(offset, offset + 2), 16));
    assert.ok(blue >= red, name + ' is not warm');
    assert.ok(name === '--metal-glint' || red < 240, name + ' is below pure white');
  });

  const html = read('dashboard/index.html');
  ['edge-steel', 'edge-ridge-steel', 'edge-shade-steel'].forEach(id => {
    assert.equal(countOf(html, '<linearGradient id="' + id + '" data-metal="steel"'), 1, id + ' has the steel metal');
    const body = html.slice(html.indexOf('<linearGradient id="' + id + '"'), html.indexOf('</linearGradient>', html.indexOf('<linearGradient id="' + id + '"')));
    assert.ok(countOf(body, '<stop ') >= 7, id + ' has its stops');
    (body.match(/var\(--metal-[a-z0-9]+\)/g) || []).forEach(text => assert.ok(declared[text.slice(4, -1)], id + ' reads ' + text + ', which the steel sets'));
  });
  ['edge-gold', 'edge-ridge-gold', 'edge-shade-gold'].forEach(id => assert.equal(countOf(html, '<linearGradient id="' + id + '" data-metal="gold"'), 1, id + ' is as it was'));

  // The steel is in the same place as the others in the page: after the gold and the red, before the screws
  assert.ok(html.indexOf('id="edge-steel"') > html.indexOf('id="edge-shade-red"') && html.indexOf('id="edge-steel"') < html.indexOf('id="screw-face-silver"'));
});

test('the neon and the bolt are shared by both styles in base.css: the neon line is on, the wider ones are off until a style turns them on, and the flat finish has none of them', () => {
  const base = withoutComments(read('dashboard/base.css'));
  const rule = selector => {
    const found = new RegExp('(?:^|\\})\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(base);
    assert.ok(found, 'base.css has a rule for ' + selector);
    return found[1];
  };

  assert.ok(/stroke: var\(--style-neon, var\(--team-neon\)\);/.test(base), 'the neon is the style\'s, and the team\'s without one');
  assert.ok(/stroke-width: 4px;/.test(rule('.edge-neon')));
  assert.ok(/display: none;/.test(rule('.edge-neon-wide-1')) && /display: none;/.test(rule('.edge-neon-wide-2')), 'the wide lines are off');
  assert.ok(/stroke-width: 14px;/.test(rule('.edge-neon-wide-1')) && /stroke-opacity: \.25;/.test(rule('.edge-neon-wide-1')));
  assert.ok(/stroke-width: 24px;/.test(rule('.edge-neon-wide-2')) && /stroke-opacity: \.12;/.test(rule('.edge-neon-wide-2')));
  assert.ok(/\[data-finish="flat"\] \.edge-neon-wide-1,\s*\[data-finish="flat"\] \.edge-neon-wide-2/.test(base), 'the flat finish has no wide lines');
  assert.ok(/\.art-cybertron \{ display: none; \}/.test(base), 'what only Cybertron draws is off until it is on');

  // The armor tab: a bevel, a bright line and the team plate color, in lines of 3px or more
  assert.ok(/stroke-width: 3px;/.test(rule('.tab-bevel')) && /stroke-width: 3px;/.test(rule('.tab-line')));
  assert.ok(/fill: var\(--team-plate\);/.test(rule('.tab-inset')), 'the team plate color is inset in the tab');

  // Nothing in what the two styles share moves, glows or is a picture, and every line is 3px or more
  const shared = [rule('.edge-neon'), rule('.edge-neon-wide-1'), rule('.edge-neon-wide-2'), rule('.tab-bevel'), rule('.tab-line'), rule('.tab-inset'), rule('.bolt-rim'), rule('.bolt-face'), rule('.bolt-dot')].join(' ');
  assert.ok(!/(animation|transition|filter|shadow|blur|url\()/.test(shared));
  (shared.match(/stroke-width: [\d.]+px/g) || []).forEach(text => assert.ok(parseFloat(/[\d.]+px/.exec(text)[0]) >= 3, text));
});


// What Cybertron paints

test('the Cybertron stylesheet paints with the team\'s colors and gradients and no picture: the page background, the plates, the rail and what it draws on a frame, in lines of 3px or more, for its own style only', () => {
  const css = withoutComments(read('dashboard/styles/cybertron.css'));
  const rules = [];
  css.replace(/([^{}]+)\{([^{}]*)\}/g, (all, list, body) => {
    rules.push({ selectors: list.split(',').map(selector => selector.trim()), body: body });
    return all;
  });

  assert.ok(rules.length >= 15, 'the style has its rules');
  rules.forEach(rule => rule.selectors.forEach(selector => assert.ok(selector.startsWith('html[data-style="cybertron"]'), 'for Cybertron only: ' + selector)));
  assert.ok(!/(animation|transition|@keyframes|filter|box-shadow|text-shadow|blur\(|will-change|font(-size)?:)/.test(css), 'nothing moves, glows or has text of its own');

  // Static, and drawn with gradients and paths: the only url is the armor plate's gradient
  const urls = css.match(/url\([^)]*\)/g) || [];
  assert.deepEqual(urls, ['url(#armor-face)']);
  assert.ok(!/\.(png|jpe?g|gif|webp|svg)\b/.test(css), 'no picture');

  // Every color is a team color, a style color or the dark of the plate seams
  const hexes = css.slice(css.indexOf('}') + 1).match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  hexes.forEach(hex => assert.ok(hex === '#05070a', 'a color of its own after the first rule: ' + hex));
  ['#6c18b6', '#3b2a7a', '#faca2a', '#35f0ff', '#ff2e8c', '#1f7ae0', '#1e3a6e', '#9bf0ff'].forEach(team => assert.ok(!css.toLowerCase().includes(team), 'a team color written out: ' + team));
  ['--team-accent', '--team-plate', '--style-neon', '--style-pink', '--style-body', '--style-grid-size', '--style-grid-opacity', '--style-scan-opacity'].forEach(name => assert.ok(css.includes('var(' + name + ')'), 'it reads ' + name));

  // The page background: scanlines over the team's background, and a grid in a layer behind the stage, both faint
  const screen = rules.filter(rule => rule.selectors[0] === 'html[data-style="cybertron"] #screen')[0].body;
  assert.ok(/repeating-linear-gradient\(to bottom, rgba\(255, 255, 255, var\(--style-scan-opacity\)\)/.test(screen) && /var\(--ground\)/.test(screen));
  const grid = rules.filter(rule => rule.selectors[0] === 'html[data-style="cybertron"] #screen::before')[0].body;
  assert.ok(/background-size|\/ var\(--style-grid-size\) var\(--style-grid-size\)/.test(grid) && /opacity: var\(--style-grid-opacity\);/.test(grid) && /pointer-events: none;/.test(grid));
  assert.ok(/width: 1920px;/.test(grid) && /height: 1080px;/.test(grid), 'as big as the screen');
  assert.ok(/#screen::before/.test(css) && !/#screen::after/.test(css), 'both are behind the stage: a layer after it would be over the text');
  const properties = withoutComments(read('dashboard/styles/cybertron.css'));
  assert.ok(/--style-grid-size: 96px;/.test(properties) && /--style-grid-opacity: \.07;/.test(properties) && /--style-scan-opacity: \.035;/.test(properties));

  // Every line it draws is 3px or more (the strokes the two styles share are checked with them, in base.css)
  const widths = css.match(/(stroke-width|border-[a-z]*-width|outline-width): [\d.]+px/g) || [];
  assert.ok(widths.length >= 3);
  widths.forEach(text => assert.ok(parseFloat(/[\d.]+px/.exec(text)[0]) >= 3, text));
  rules.filter(rule => /\.bar-rail::before/.test(rule.selectors[0])).forEach(rule => assert.ok(/width: 4px;/.test(rule.body), 'the rail\'s line is 4px'));

  // The hazard stripe is the team's accent, the conduit and the brackets are pink and the slashes are neon
  const paint = name => rules.filter(rule => rule.selectors[0] === 'html[data-style="cybertron"] .art-' + name)[0].body;
  assert.ok(/fill: var\(--team-accent\);/.test(paint('hazard')));
  assert.ok(/stroke: var\(--style-pink\);/.test(paint('conduit')) && /stroke: var\(--style-pink\);/.test(paint('brackets')));
  assert.ok(/fill: var\(--style-neon\);/.test(paint('slashes')));
  assert.ok(/stroke-opacity: \.6;/.test(paint('seams')), 'the seams are faint');

  // The wide neon lines are on, except in the flat finish
  assert.ok(css.includes('html[data-style="cybertron"]:not([data-finish="flat"]) .edge-neon-wide-1'));
  // and the plates are the gunmetal: the body is the style's, the tab an armor plate, the TEAM plate and the tag the team's plate color
  assert.ok(/--panel-face: var\(--style-body\);/.test(css) && css.includes('fill: url(#armor-face);'));
  assert.ok(/\.team-fill,\s*html\[data-style="cybertron"\] \.tag-fill \{ fill: var\(--team-plate\); \}/.test(css));
});

test('the page background of Cybertron is the grid at 96px and the scanlines, nothing else on the screen is drawn behind the stage, and Original has none of it', () => {
  const originalCss = withoutComments(read('dashboard/styles/original.css'));
  const base = withoutComments(read('dashboard/base.css'));
  assert.ok(!/#screen/.test(originalCss), 'Original does not touch the page background');
  assert.ok(/#screen \{[^}]*background: var\(--ground\);/.test(base), 'it is the team\'s background color, as it was');
  assert.ok(!/#screen::(before|after)/.test(base), 'and base.css draws nothing over it');
  assert.ok(/--style-scan-opacity: \.035;/.test(withoutComments(read('dashboard/styles/cybertron.css'))));
  assert.equal(/--style-scan-opacity/.test(withoutComments(read('dashboard/styles/minimal.css'))), false, 'Minimal has a grid and no scanlines');
});

test('the steel and the bolts reach the frames of Cybertron through the tokens: the edge, the row bars and the banner follow the style, the logo has the team accent, and the standard layout\'s frames are untouched', () => {
  const css = withoutComments(read('dashboard/styles/cybertron.css'));
  assert.ok(css.includes('html[data-style="cybertron"] .bar-logo .drawing { --logo-edge: var(--team-accent); }'));

  // The tokens file gives the steel to the html element and to each element with a data-metal: that is the banner and every area
  const tokens = withoutComments(read('dashboard/tokens.css'));
  assert.ok(tokens.includes('html[data-style="cybertron"] [data-metal]'), 'every area, whichever metal the page change gave it');
  assert.ok(/:root,\s*\[data-metal\] \{\s*--edge-rim: var\(--metal-rim\);/.test(tokens), 'the rim is worked out on each of them from the steel');

  // The code that picks the metal of a page change never has to know: the bar layout makes no finish change at all
  const areas = read('dashboard/core/areas.js');
  assert.ok(/function planFor\(area\) \{\s*const change = frame\.planChange\(area\);\s*return layoutNow\(\) === 'bar' \? \{ style: change\.style, finish: null \} : change;\s*\}/.test(areas));
  assert.equal(countOf(areas, 'frame\\.planChange\\(area\\)'), 1, 'planFor is the one place that asks');
  assert.equal(countOf(areas, 'const change = planFor\\(area\\);'), 2, 'and areas.js calls it for the two changes, the page change and the swap of a hidden transition');
  assert.ok(/frameKind\(region, layoutNow\(\), shapesNow\(\)\)/.test(areas) && /kind === 'ticker' \? '' : areaMarkup\(kind\)/.test(areas), 'the ticker has a frame in the bar layout and none in the others, with the corners of the page\'s style');
});

// Minimal: the frames with corners of their own, and what the style paints
// (core/plate.js, core/style.js, styles/minimal.css)

const minimalKinds = ['bar-main-minimal', 'bar-banner-minimal', 'bar-ticker-minimal'];
const usualKind = { 'bar-main-minimal': 'bar-main', 'bar-banner-minimal': 'bar-banner', 'bar-ticker-minimal': 'bar-ticker' };

test('only Minimal has frames with corners of its own, and the page records them once, at the start', () => {
  assert.deepEqual(styles.shapeSets, ['minimal']);
  assert.equal(styles.shapesFor('minimal'), 'minimal');
  ['original', 'cybertron', 'oops', undefined, null, 'toString', 7].forEach(odd => assert.equal(styles.shapesFor(odd), '', String(odd)));

  assert.equal(styles.shapesNow(null), '');
  assert.equal(styles.shapesNow({}), '');
  assert.equal(styles.shapesNow({ dataset: {} }), '');
  assert.equal(styles.shapesNow({ dataset: { shapes: 'minimal' } }), 'minimal');
  ['oops', 'original', 'cybertron', ''].forEach(odd => assert.equal(styles.shapesNow({ dataset: { shapes: odd } }), '', 'data-shapes is ' + odd));

  const started = (asked, saved) => {
    const page = { dataset: {} };
    styles.startStyle(asked, () => saved, page);
    return page.dataset;
  };
  assert.equal(started(null, 'minimal').shapes, 'minimal');
  assert.equal('shapes' in started(null, 'cybertron'), false);
  assert.equal('shapes' in started(null, 'original'), false);
  assert.equal(started('minimal', 'original').shapes, 'minimal', 'the address wins');

  const again = { dataset: { shapes: 'minimal' } };
  styles.startStyle(null, () => 'original', again);
  assert.equal('shapes' in again.dataset, false, 'a start in another style takes it away');

  // A look that goes on later changes the style and never the corners, which were drawn at the start
  const page = { dataset: { style: 'cybertron' } };
  styles.applyStyle('minimal', page);
  assert.equal(page.dataset.style, 'minimal');
  assert.equal('shapes' in page.dataset, false);
});

test('frameKind gives the frames of Minimal for its corners, in the bar layout only, and the usual ones for anything else', () => {
  assert.equal(plate.frameKind('grid1', 'bar', 'minimal'), 'bar-main-minimal');
  assert.equal(plate.frameKind('ticker', 'bar', 'minimal'), 'bar-ticker-minimal');
  assert.equal(plate.frameKind('banner', 'bar', 'minimal'), 'bar-banner-minimal');
  assert.equal(plate.frameKind('grid1', 'bar', ''), 'bar-main');
  assert.equal(plate.frameKind('grid1', 'bar'), 'bar-main');
  assert.equal(plate.frameKind('banner', 'bar'), 'bar-banner');
  assert.equal(plate.frameKind('grid1', 'bar', 'oops'), 'bar-main', 'corners that no frame has: the usual ones');
  ['standard', 'sidebar'].forEach(name => ['grid1', 'grid2', 'ticker', 'banner'].forEach(region => assert.equal(plate.frameKind(region, name, 'minimal'), region, name + ' ' + region)));
  assert.equal(plate.frameKind('grid2', 'bar', 'minimal'), 'grid2', 'there is no small frame in the bar layout');
  minimalKinds.forEach(kind => assert.ok(plate.barShape(kind), kind + ' is a frame'));
});

test('a style with other corners on its frames reloads once, like a layout: Cybertron to Minimal and back, and never between two looks with the same corners', async () => {
  assert.equal(layout.drawnFor('bar', 'minimal'), 'bar-minimal');
  assert.equal(layout.drawnFor('bar', ''), 'bar');
  assert.equal(layout.drawnFor('bar', 'oops'), 'bar');
  assert.equal(layout.drawnFor('standard', 'minimal'), 'standard', 'only the bar layout has them');
  assert.equal(layout.drawnFor('sidebar', 'minimal'), 'sidebar');
  assert.ok(layout.isDrawn('bar-minimal') && layout.isDrawn('bar') && layout.isDrawn('standard'));
  ['bar-oops', 'standard-minimal', 'minimal', '', undefined, null].forEach(odd => assert.equal(layout.isDrawn(odd), false, String(odd)));

  const storage = fakeStorage();
  assert.equal(layout.mustReload('bar', 'bar-minimal', storage), true);
  assert.equal(storage.data[layout.reloadKey], 'bar-minimal');
  assert.equal(layout.mustReload('bar', 'bar-minimal', storage), false, 'back in the wrong corners: no second reload');
  assert.equal(layout.mustReload('bar-minimal', 'bar-minimal', storage), false);
  assert.deepEqual(storage.data, {}, 'the note is rubbed out once the page is drawn for it');
  assert.equal(layout.mustReload('bar-minimal', 'bar', storage), true, 'and back again');
  assert.equal(layout.mustReload('bar-minimal', 'bar-oops', fakeStorage()), false);

  let reloads = 0;
  const store = fakeStorage();
  const window = { sessionStorage: store, location: { reload: () => { reloads += 1; } } };
  const look = (theme, style) => ({ theme: theme, overlay: '', style: style });

  await withGlobals({ window: window, document: pageWith('bar') }, () => {
    assert.equal(apply.holdForLayout(look('hawktimus', 'cybertron')), false, 'a page of Cybertron, and Cybertron');
    assert.equal(apply.holdForLayout(look('hawktimus', 'minimal'), () => true), true, 'held while something has the screen');
    assert.equal(reloads, 0);
    assert.equal(apply.holdForLayout(look('hawktimus', 'minimal'), () => false), true, 'Minimal has other corners, so the page is drawn again');
    assert.equal(reloads, 1);
    assert.equal(store.data[layout.reloadKey], 'bar-minimal');
    assert.equal(apply.holdForLayout(look('hawktimus', 'minimal'), () => false), false, 'back in the wrong corners: no second reload, and the colors go on');
    assert.equal(reloads, 1);
  });

  await withGlobals({ window: window, document: pageWith('bar', 'minimal') }, () => {
    assert.equal(apply.holdForLayout(look('neon-prime', 'minimal')), false, 'drawn for Minimal, and Minimal on any theme');
    assert.deepEqual(store.data, {});
    assert.equal(apply.holdForLayout(look('hawktimus', 'cybertron')), true, 'Minimal to Cybertron');
    assert.equal(reloads, 2);
  });

  await withGlobals({ window: window, document: pageWith('bar', 'minimal') }, () => {
    assert.equal(apply.holdForLayout(look('hawktimus', 'original')), true, 'Minimal to Original');
    assert.equal(reloads, 3);
  });

  await withGlobals({ window: window, document: pageWith('standard') }, () => {
    assert.equal(apply.holdForLayout(look('hawktimus', 'minimal')), true, 'Original to Minimal is a layout change as before');
    assert.equal(reloads, 4);
    assert.equal(store.data[layout.reloadKey], 'bar-minimal');
  });
  assert.ok(read('dashboard/core/layout-apply.js').includes('drawnFor(layoutFor(look.style, layoutOf(look.theme)), shapesFor(look.style))'), 'holdForLayout asks for the layout and the corners of the look');
});

test('the Minimal frames are the same ten-cornered plates with smaller cuts, 34 on the main panel and the banner and 20 on the ticker, with a bolt at each of the four joints', () => {
  const chamfers = { 'bar-main-minimal': 34, 'bar-banner-minimal': 34, 'bar-ticker-minimal': 20 };
  const steps = { 'bar-main-minimal': 16, 'bar-banner-minimal': 16, 'bar-ticker-minimal': 10 };

  minimalKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    const usual = plate.barShape(usualKind[kind]);
    const outline = shape.outline;

    assert.deepEqual([shape.width, shape.height], [usual.width, usual.height], kind + ' is drawn for the box the usual frame has');
    assert.equal(outline.length, 10, kind + ': ten corners');
    assert.ok(signedArea(outline) > 0, kind + ': clockwise on the screen');

    const xs = outline.map(point => point[0]);
    const ys = outline.map(point => point[1]);
    assert.deepEqual([Math.min.apply(null, xs), Math.max.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, ys)], [4, shape.width - 4, 4, shape.height - 4], kind + ': the line is 4 inside the box');
    edgesOf(outline).forEach(([from, to], index) => {
      const across = Math.abs(to[0] - from[0]);
      const down = Math.abs(to[1] - from[1]);
      assert.ok(across === 0 || down === 0 || across === down, kind + ': edge ' + index + ' is straight or at 45 degrees');
    });

    const cut = (from, to) => [Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1])];
    assert.deepEqual(cut(outline[1], outline[2]), [chamfers[kind], chamfers[kind]], kind + ': the cut corner at the top left');
    assert.deepEqual(cut(outline[6], outline[7]), [chamfers[kind], chamfers[kind]], kind + ': and at the bottom right');
    assert.deepEqual(cut(outline[3], outline[4]), [steps[kind], steps[kind]], kind + ': the step at the top right');
    assert.deepEqual(cut(outline[8], outline[9]), [steps[kind], steps[kind]], kind + ': and at the bottom left');
    outline.forEach((point, index) => {
      const opposite = outline[(index + 5) % 10];
      assert.deepEqual([point[0] + opposite[0], point[1] + opposite[1]], [shape.width, shape.height], kind + ': corner ' + index + ' and its opposite are one turn half way round from each other');
    });

    // a bolt at each of the four joints, which are the two ends of each cut corner, and no other part of Cybertron
    const bolts = shape.screws.a.concat(shape.screws.b).map(point => point.join(','));
    assert.deepEqual(bolts.slice().sort(), [1, 2, 6, 7].map(index => outline[index].join(',')).sort(), kind + ': four bolts');
    assert.equal(shape.wide, false, kind + ': one neon line and no wide ones');
    assert.equal(usual.wide, true, 'Cybertron keeps its two wide ones');
    assert.deepEqual(shape.bracketLines, [], kind + ': no brackets');
    ['hazard', 'conduit', 'slashes', 'seams', 'brackets'].forEach(name => assert.ok(!shape.art[name], kind + ' has no ' + name));
    assert.deepEqual(shape.neon.a, plate.offsetOutline(outline, 10).slice(0, 6), kind + ': the neon line is the outline 10 inside');
  });

  // Cybertron's frames have none of what Minimal adds
  frameKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    assert.ok(shape.rivets === undefined && shape.wear === undefined && shape.number === undefined, kind + ' has no rivets, rust or id');
    ['weldDark', 'weldLight', 'headerLine', 'ticks'].forEach(name => assert.ok(!shape.art[name], kind + ' has no ' + name));
  });

  // The rivets are the Original style's: every long straight edge, one every 90 and 5 in radius, which are the numbers of rivetsAlong
  minimalKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    const half = { a: shape.outline.slice(0, 6), b: shape.outline.slice(5).concat([shape.outline[0]]) };
    assert.deepEqual(shape.rivets, { a: plate.rivetsOf(half.a), b: plate.rivetsOf(half.b) }, kind + ': the rivets of each half');
    const all = shape.rivets.a.concat(shape.rivets.b);
    assert.ok(all.length >= 30, kind + ' has a row of rivets along each long edge');
    const between = (value, one, other) => value >= Math.min(one, other) - 0.1 && value <= Math.max(one, other) + 0.1;
    all.forEach(center => assert.ok(edgesOf(shape.outline).some(([from, to]) => distanceToLine(center, from, to) < 0.1 && between(center[0], from[0], to[0]) && between(center[1], from[1], to[1])), kind + ': a rivet at ' + center + ' is on an edge'));
    const top = shape.rivets.a.filter(center => center[1] === 4);
    top.slice(1).forEach((center, index) => assert.ok(Math.abs(center[0] - top[index][0] - 90) < 0.11, kind + ': 90 apart along the top'));
  });
});

test('the rust, the stamped id, the weld seam and the header line of Minimal are where the order puts them: rust at the two bottom corners of every frame, an id on the main panel and the banner, a seam on the tall panel only, ticks along the header line', () => {
  frameKinds.forEach(kind => assert.equal(plate.barShape(kind).wear, undefined));

  minimalKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    assert.equal(shape.wear.length, 2, kind + ': rust at two corners');
    const [left, bottom] = shape.wear;
    assert.equal(left.anchor[0], 4, kind + ': the first arc is on the left edge');
    assert.ok(left.anchor[1] > shape.outline[1][1] && left.anchor[1] < shape.outline[0][1], kind + ': above the step at the bottom left');
    assert.equal(bottom.anchor[1], shape.height - 4, kind + ': the second is on the bottom edge');
    assert.ok(bottom.anchor[0] < shape.outline[7][0] && bottom.anchor[0] > shape.width / 2, kind + ': before the cut corner at the bottom right');
    shape.wear.forEach(item => assert.doesNotThrow(() => plate.offsetPoint(shape.outline, item.anchor, 1), kind + ': the anchor is on the outline'));
    assert.ok(shape.wear.every(item => /^M[\d. ]+Q[\d. -]+$/.test(item.arc)), kind + ': each is one stroked curve');
  });

  // The id: HP-01 on the main panel, HP-02 on the banner where the war clock is, none on the ticker, whose message would cover it
  assert.equal(plate.barShape('bar-main-minimal').number, '01');
  assert.equal(plate.barShape('bar-banner-minimal').number, '02');
  assert.equal(plate.barShape('bar-ticker-minimal').number, undefined);

  // The weld seam is on the main panel only, under the header and clear of the 1152 the pages are written for
  const main = plate.barShape('bar-main-minimal');
  assert.equal(main.art.weldDark, 'M1188 134L1188 690');
  assert.equal(main.art.weldLight, 'M1192 134L1192 690', 'the light line is 4 beside the dark one');
  assert.ok(1188 - 1152 >= 36 && 1188 + 4 < main.width - 4 - 10, 'between the 1152 of the pages and the neon line');
  assert.ok(!plate.barShape('bar-banner-minimal').art.weldDark && !plate.barShape('bar-ticker-minimal').art.weldDark, 'the banner and the ticker are not tall');

  // The header line is a neon line along the foot of the header, with ticks standing on it
  assert.equal(main.art.headerLine, 'M14 120L1413 120');
  const ticks = main.art.ticks.split('Z').filter(Boolean).map(text => /^M(\d+) (\d+)h4v10h-4$/.exec(text));
  assert.ok(ticks.every(Boolean), 'each tick is a bar 4 wide and 10 high');
  assert.equal(ticks.length, 39);
  ticks.forEach((found, index) => {
    assert.equal(Number(found[1]), 702 + 18 * index, 'a tick every 18');
    assert.equal(Number(found[2]) + 10, 118, 'standing on the line');
  });
  assert.ok(Number(ticks[0][1]) > main.tab[3][0], 'the first is past the slanted end of the tab');
  assert.ok(Number(ticks[ticks.length - 1][1]) + 4 <= main.width - 4 - 10, 'and the last is inside the neon line');
  assert.ok(!plate.barShape('bar-banner-minimal').art.headerLine && !plate.barShape('bar-ticker-minimal').art.ticks);
});

test('the main panel of Minimal has each of its parts where the frame has them: the rivets and the rust in the frame and in the pieces, once each, the id under the page, and nothing of Cybertron\'s', async () => {
  await withPlatePage(drawn => {
    const markup = plate.areaMarkup('bar-main-minimal');
    assert.ok(isBalanced(markup), 'every tag is closed');
    const shape = plate.barShape('bar-main-minimal');
    const split = markup.indexOf('class="plate piece"');
    const inFrame = markup.slice(0, split);
    const inPieces = markup.slice(split);
    const rivet = 'a5 5 0 1 0 10 0';

    assert.equal(countOf(inFrame, rivet), shape.rivets.a.length + shape.rivets.b.length, 'a dot for each rivet');
    assert.equal(countOf(inPieces, rivet), countOf(inFrame, rivet), 'and each one is in one piece');
    assert.equal(countOf(inFrame, 'data-part="rivets"'), 2, 'the rivets of each half come in after the lines');
    assert.equal(countOf(inFrame, 'data-part="wear"'), 1, 'the rust is in the second half, where the bottom corners are');
    assert.equal(countOf(inFrame, 'class="art-minimal art-wear"'), 1, 'one path for both arcs');
    assert.equal(countOf(inFrame, 'class="art-minimal art-smudge"'), 2);
    assert.equal(countOf(inPieces, 'class="art-minimal art-wear"'), 2, 'in the pieces each arc is in the bar it is on');
    assert.equal(countOf(inPieces, 'class="art-minimal art-smudge"'), 2);
    assert.ok(markup.indexOf('data-part="wear"') > markup.indexOf('data-part="frame-b"'), 'the rust is on the steel of the second half');
    assert.ok(markup.indexOf('data-part="wear"') < markup.indexOf('href="#bolt-shape"', markup.indexOf('data-part="frame-b"')), 'under its bolts');

    const foot = shape.outline[7];
    assert.equal(countOf(markup, 'data-part="plate-id"'), 1);
    assert.ok(markup.includes(`data-number="01" style="left: ${foot[0] - 34 - 112}px; top: ${foot[1] - 14 - 20}px; width: 112px;"`), 'the id stands 34 left of the foot of the bottom right cut corner and 14 above the bottom line, as Original\'s does');
    assert.ok(markup.indexOf('data-part="plate-id"') > markup.indexOf('class="plate fills"') && markup.indexOf('data-part="plate-id"') < markup.indexOf('data-part="shadow-a"'), 'it is under the frame, over the plate');

    ['art-weld-dark', 'art-weld-light', 'art-header-line', 'art-ticks'].forEach(name => assert.equal(countOf(markup, 'class="art-minimal ' + name + '"'), 2, name + ' once in the frame and once in the piece that is the decoration'));
    assert.equal(countOf(markup, 'data-part="decor"'), 1);
    assert.equal(countOf(markup, 'href="#bolt-shape"'), 4 + 4, 'four bolts in the frame and four in the pieces');
    assert.equal(countOf(markup, 'class="plate piece"'), 12, 'the same twelve pieces');
    assert.equal(countOf(markup, '<use class="edge-neon"'), 2 + 7, 'one neon line in each half and in each of the seven bars');
    ['art-cybertron', 'edge-neon-wide', 'art-brackets', 'art-hazard', 'art-conduit', 'art-slashes', 'art-seams', 'screw-shadow', 'bolt-shadow', 'glint'].forEach(name => assert.ok(!hasText(markup, name), 'nothing of ' + name));
    ['class="tab-inset"', 'class="tab-bevel"', 'class="tab-line"'].forEach(text => assert.equal(countOf(markup, text), 2, text + ': the armor tab is the same as Cybertron\'s'));

    // the frame is the same order of parts as the other bar frames, and every shape it points at is drawn
    const at = text => markup.indexOf(text);
    assert.ok(at('class="plate fills"') < at('data-part="shadow-a"') && at('data-part="shadow-b"') < at('data-part="frame-a"') && at('data-part="frame-b"') < at('class="plate piece"'));
    (markup.match(/href="#[a-z0-9-]+"/g) || []).forEach(found => assert.ok(drawn.has(found.slice(7, -1)) || staticIds.has(found.slice(7, -1)), found + ' is not drawn anywhere'));
    ['bar-main-minimal-a', 'bar-main-minimal-b', 'bar-main-minimal-neon-a', 'bar-main-minimal-neon-b'].forEach(id => assert.ok(drawn.has(id), id));

    // Original's frames have the rivets and the id and none of the rest
    const original = plate.areaMarkup('grid1');
    assert.ok(hasText(original, 'data-part="plate-id"') && hasText(original, 'class="rivets"'));
    ['art-minimal', 'art-wear', 'wear'].forEach(name => assert.ok(!hasText(original, name), 'the large frame of Original has no ' + name));
  });
});

test('the banner and the ticker of Minimal: rivets, rust and bolts, the banner\'s id, and a line in the table of frame.js for every part that arrives', async () => {
  await withPlatePage(drawn => {
    const banner = plate.plateMarkup('bar-banner-minimal');
    assert.ok(isBalanced(banner));
    assert.equal(countOf(banner, 'class="plate fills"'), 1);
    assert.equal(countOf(banner, 'data-part="rivets"'), 2);
    assert.equal(countOf(banner, 'data-part="wear"'), 1);
    assert.equal(countOf(banner, 'data-part="stud"'), 4, 'four bolts');
    assert.equal(countOf(banner, 'data-number="02"'), 1);
    assert.equal(countOf(banner, 'data-part="decor"'), 0, 'the banner has nothing else on it');
    assert.ok(!hasText(banner, 'art-cybertron') && !hasText(banner, 'glint') && !hasText(banner, 'class="plate piece"'));

    const sequence = /'bar-banner': \{([^}]*)\}/.exec(read('dashboard/frame.js'))[1];
    const parts = new Set((banner.match(/data-part="[a-z-]+"/g) || []).map(text => text.slice(11, -1)));
    ['body', 'outline', 'rivets', 'wear', 'plate-id', 'stud'].forEach(part => assert.ok(parts.has(part) && sequence.includes("'" + part + "':"), part + ' is in the banner and in its table'));
    parts.forEach(part => ['frame-a', 'frame-b'].indexOf(part) !== -1 || assert.ok(sequence.includes("'" + part + "':"), part + ' has no line in the banner\'s table'));
    ['rivets', 'wear', 'plate-id'].forEach(part => assert.ok(Number(new RegExp("'" + part + "':\\s*\\['fade', (\\d+)").exec(sequence)[1]) >= 1350, part + ' comes after the lines are drawn'));
    (banner.match(/href="#[a-z0-9-]+"/g) || []).forEach(found => assert.ok(drawn.has(found.slice(7, -1)) || staticIds.has(found.slice(7, -1)), found));

    const ticker = plate.areaMarkup('bar-ticker-minimal');
    assert.ok(isBalanced(ticker));
    ['still-frame-a', 'still-frame-b', 'still-shadow-a', 'still-shadow-b'].forEach(name => assert.equal(countOf(ticker, 'data-part="' + name + '"'), 1, name));
    assert.equal(countOf(ticker, 'data-part="rivets"'), 2);
    assert.equal(countOf(ticker, 'data-part="wear"'), 1);
    assert.equal(countOf(ticker, 'href="#bolt-shape"'), 4);
    assert.ok(!hasText(ticker, 'plate-id') && !hasText(ticker, 'glint') && !hasText(ticker, 'class="plate piece"') && !hasText(ticker, 'data-part="decor"'), 'no id, no pieces, no decoration');
    (ticker.match(/href="#[a-z0-9-]+"/g) || []).forEach(found => assert.ok(drawn.has(found.slice(7, -1)) || staticIds.has(found.slice(7, -1)), found));
  });
});

test('the rust sits behind the steel of its frame: it is a patch and an arc inside the frame\'s box, and the flat finish takes it away with the wide neon lines', () => {
  frameKinds.concat(minimalKinds).forEach(kind => {
    const shape = plate.barShape(kind);
    (shape.wear || []).forEach(item => {
      const box = { x: 0, y: 0, width: shape.width, height: shape.height };
      assert.ok(item.smudge[0] > 0 && item.smudge[0] < shape.width && item.smudge[1] > 0 && item.smudge[1] < shape.height, kind + ': the middle of the patch is inside the frame');
      const curve = /^M(-?[\d.]+) (-?[\d.]+)Q(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)$/.exec(item.arc);
      assert.ok(curve, kind + ': ' + item.arc);
      [[curve[1], curve[2]], [curve[3], curve[4]], [curve[5], curve[6]]].forEach(point => assert.ok(within({ x: Number(point[0]), y: Number(point[1]), width: 0, height: 0 }, box), kind + ': the arc is inside the frame\'s box'));
    });
  });

  const frameRules = withoutComments(read('dashboard/frame.css'));
  assert.ok(/\[data-motion="full"\] \.area\[data-state="in"\] \[data-part="wear"\] \{\s*animation: fade-in var\(--time-fade-in\) linear calc\(var\(--assemble-draw\) \* var\(--pace\) \+ var\(--time-draw-in\)\) backwards;\s*\}/.test(frameRules), 'the rust fades in after the lines are drawn, like the rivets');

  const css = withoutComments(read('dashboard/styles/minimal.css'));
  assert.ok(/html\[data-style="minimal"\]\[data-finish="flat"\] \.art-smudge,\s*html\[data-style="minimal"\]\[data-finish="flat"\] \.art-wear \{ display: none; \}/.test(css), 'the flat finish has no rust');
});

test('the Minimal stylesheet paints with the team\'s colors and gradients and no picture: the grid, the plates, the rail, the rivets, the id and what it draws on a frame, in lines of 3px or more, for its own style only', () => {
  const css = withoutComments(read('dashboard/styles/minimal.css'));
  const rules = [];
  css.replace(/([^{}]+)\{([^{}]*)\}/g, (all, list, body) => {
    rules.push({ selectors: list.split(',').map(selector => selector.trim()), body: body });
    return all;
  });

  assert.ok(rules.length >= 20, 'the style has its rules');
  rules.forEach(rule => rule.selectors.forEach(selector => assert.ok(selector.startsWith('html[data-style="minimal"]'), 'for Minimal only: ' + selector)));
  assert.ok(!/(animation|transition|@keyframes|filter|box-shadow|text-shadow|blur\(|will-change|font(-size)?:)/.test(css), 'nothing moves or glows, and it has no text of its own');
  assert.ok(!/mirrored/.test(css), 'the frames are never turned by the mirror, so nothing here changes with it');

  // Static, and drawn with gradients and paths: the only urls are the armor plate\'s gradient and the patch of rust
  assert.deepEqual(css.match(/url\([^)]*\)/g) || [], ['url(#armor-face)', 'url(#wear-rust)']);
  assert.ok(!/\.(png|jpe?g|gif|webp|svg)\b/.test(css), 'no picture');

  // Every color after the first rule is a team color, a style color or the dark of the weld seam
  const hexes = css.slice(css.indexOf('}') + 1).match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  hexes.forEach(hex => assert.ok(hex === '#05070a', 'a color of its own after the first rule: ' + hex));
  ['#6c18b6', '#3b2a7a', '#faca2a', '#35f0ff', '#ff2e8c', '#1f7ae0', '#1e3a6e', '#9bf0ff'].forEach(team => assert.ok(!css.toLowerCase().includes(team), 'a team color written out: ' + team));
  ['--team-accent', '--team-plate', '--style-neon', '--style-pink', '--style-body', '--style-rust', '--style-grid-size', '--style-grid-opacity', '--metal-ridge'].forEach(name => assert.ok(css.includes('var(' + name + ')'), 'it reads ' + name));

  const first = rules[0].body;
  assert.ok(/--style-body: var\(--ground\);/.test(first) && /--style-rust: #[0-9a-f]{6};/.test(first) && /--style-armor-top: #[0-9a-f]{6};/.test(first) && /--style-armor-bottom: #[0-9a-f]{6};/.test(first));
  assert.ok(!/--style-raised|--style-scan-opacity/.test(css), 'Minimal has no raised plate and no scanlines');

  // The page background is the team's, with the grid at 48px in a layer behind the stage, and no scanlines
  const grid = rules.filter(rule => rule.selectors[0] === 'html[data-style="minimal"] #screen::before')[0].body;
  assert.ok(/\/ var\(--style-grid-size\) var\(--style-grid-size\)/.test(grid) && /opacity: var\(--style-grid-opacity\);/.test(grid) && /pointer-events: none;/.test(grid));
  assert.ok(/width: 1920px;/.test(grid) && /height: 1080px;/.test(grid), 'as big as the screen');
  assert.ok(!/#screen \{|#screen::after|repeating-linear-gradient/.test(css), 'the color of the page is the team\'s background, as base.css has it, and nothing is drawn over the stage');
  assert.ok(/--style-grid-size: 48px;/.test(first) && /--style-grid-opacity: \.07;/.test(first));

  // Every line it draws is 3px or more
  const widths = css.match(/(stroke-width|border-[a-z]*-width|outline-width): [\d.]+px/g) || [];
  assert.ok(widths.length >= 4);
  widths.forEach(text => assert.ok(parseFloat(/[\d.]+px/.exec(text)[0]) >= 3, text));
  rules.filter(rule => /\.bar-rail::before/.test(rule.selectors[0])).forEach(rule => assert.ok(/width: 4px;/.test(rule.body), 'the rail\'s line is 4px'));

  // The plates: the body is the team's background, the tab an armor plate, the team plate and the tag in the plate color
  assert.ok(/--panel-face: var\(--style-body\);/.test(css) && css.includes('fill: url(#armor-face);'));
  assert.ok(/\.team-fill,\s*html\[data-style="minimal"\] \.tag-fill \{ fill: var\(--team-plate\); \}/.test(css));
  assert.ok(css.includes('html[data-style="minimal"] .bar-logo .drawing { --logo-edge: var(--team-accent); }'));

  // The rivets and the id are shown, the weld seam is dark with a faint light line, the ticks are neon and the rust is a patch and an arc
  assert.ok(css.includes('html[data-style="minimal"] .rivets { display: inline; }') && css.includes('html[data-style="minimal"] .plate-id { display: block; }'));
  const paint = name => rules.filter(rule => rule.selectors[0] === 'html[data-style="minimal"] .art-' + name)[0].body;
  assert.ok(/stroke: #05070a;/.test(paint('weld-dark')) && /stroke-opacity: \.7;/.test(paint('weld-dark')));
  assert.ok(/stroke: var\(--metal-ridge\);/.test(paint('weld-light')) && /stroke-opacity: \.2;/.test(paint('weld-light')), 'faint');
  assert.ok(/stroke: var\(--style-neon\);/.test(paint('header-line')) && /fill: var\(--style-neon\);/.test(paint('ticks')));
  assert.ok(/fill: url\(#wear-rust\);/.test(paint('smudge')) && /stroke: var\(--style-rust\);/.test(paint('wear')) && /fill: none;/.test(paint('wear')));
  assert.ok(css.includes('html[data-style="minimal"] .art-minimal { display: inline; }'));

  // Each style paints its own: Minimal does not draw Cybertron\'s decoration, and Cybertron does not draw Minimal\'s
  assert.ok(!/art-(hazard|conduit|slashes|brackets|seams)|edge-neon-wide|art-cybertron/.test(css));
  assert.ok(!/art-(minimal|weld|header-line|ticks|smudge|wear)|rivets|plate-id/.test(withoutComments(read('dashboard/styles/cybertron.css'))));
  assert.ok(/\.art-minimal \{ display: none; \}/.test(withoutComments(read('dashboard/base.css'))), 'what only Minimal draws is off until it is on');
});

test('Minimal and the mirror: the frames, the rivets, the rust, the ids and the seam are drawn in the coordinates of the frame and are never turned, so only the regions change places', () => {
  const css = withoutComments(read('dashboard/layouts/bar.css') + read('dashboard/styles/cybertron.css') + read('dashboard/styles/minimal.css'));
  assert.ok(!/mirrored[^{}]*\.(area|plate|rivets|plate-id|art-[a-z-]+)\b|\.(area|plate|rivets|plate-id|art-[a-z-]+)\b[^{}]*mirrored/.test(css), 'no rule turns a frame or anything drawn on it');
  assert.ok(!/mirror-art|scaleX/.test(read('dashboard/core/plate.js')));

  // The ids and the rivets are shown in Minimal whether the layout is mirrored or not, as they are in Original
  const base = withoutComments(read('dashboard/base.css'));
  assert.equal(/\.mirrored[^{]*(rivets|plate-id)/.test(base), false);
  assert.ok(/html\[data-style="minimal"\] \.rivets \{ display: inline; \}/.test(withoutComments(read('dashboard/styles/minimal.css'))));

  // Placed on the screen, every Minimal frame stays inside it in the layout and in its mirror, with its bolts and rust
  const place = (kind, box, scale) => {
    const reach = plate.frameExtent(kind);
    return { x: box.x + reach.left * scale, y: box.y + reach.top * scale, width: (reach.right - reach.left) * scale, height: (reach.bottom - reach.top) * scale };
  };
  [['the layout', b], ['its mirror', layout.mirrorGeometry(b)]].forEach(([label, geometry]) => {
    const boxes = { 'bar-main-minimal': [geometry.main, b.scale], 'bar-banner-minimal': [geometry.banner, 1], 'bar-ticker-minimal': [geometry.ticker, 1] };
    minimalKinds.forEach(kind => {
      const box = place(kind, boxes[kind][0], boxes[kind][1]);
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= layout.screen.width && box.y + box.height <= layout.screen.height, kind + ' is on the 1920 x 1080 screen in ' + label + ': ' + JSON.stringify(box));
    });
  });
  minimalKinds.forEach(kind => {
    const reach = plate.frameExtent(kind);
    const shape = plate.barShape(kind);
    assert.ok(reach.left <= -15 && reach.top <= -15 && reach.right >= shape.width + 15 && reach.bottom >= shape.height + 15, kind + ' reaches the bolts, which stand out of the line by 19');
  });
});

test('the numbers in the Frames section of docs/layouts.md for the frames of Minimal are the numbers of the shapes in plate.js', () => {
  const doc = read('docs/layouts.md');
  const section = doc.slice(doc.indexOf('\n### Frames\n'), doc.indexOf('\n## What else works in each layout'));
  const chamfers = { 'bar-main-minimal': 34, 'bar-banner-minimal': 34, 'bar-ticker-minimal': 20 };

  minimalKinds.forEach(kind => {
    const shape = plate.barShape(kind);
    const line = section.split('\n').find(text => text.startsWith('| `' + kind + '` |'));
    assert.ok(line, 'the table has a row for ' + kind);

    const cells = line.split('|').map(cell => cell.trim());
    assert.equal(cells[2], shape.width + ' x ' + shape.height, kind + ': drawn for');
    assert.equal(Number(cells[3]), chamfers[kind], kind + ': the cut corner');
    assert.equal(Number(cells[3]), shape.outline[2][0] - shape.outline[1][0], kind + ': is what the shape has');
    assert.equal(Number(cells[4]), shape.outline[4][1] - shape.outline[3][1], kind + ': the step');
    assert.equal(Number(cells[5]), (shape.width - 4) - shape.outline[3][0], kind + ': the run');
    assert.equal(Number(cells[6]), shape.screws.a.length + shape.screws.b.length, kind + ': the bolts');
  });

  // The parts only Minimal has, and their sizes
  ['one neon line', 'rust at the two bottom corners', '| Stamped id |', '| Weld seam |', '| Header line |', '| Rivets |'].forEach(text => assert.ok(section.includes(text), 'the section says ' + text));
  const main = plate.barShape('bar-main-minimal');
  assert.ok(section.includes('x = 1188') && main.art.weldDark.startsWith('M1188 '), 'the seam is at 1188');
  assert.ok(section.includes('39 ticks') && main.art.ticks.split('Z').filter(Boolean).length === 39);
  assert.ok(section.includes('every 18') && section.includes('4 wide and 10 high'));
  assert.ok(section.includes('HP-01') && section.includes('HP-02'));
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
