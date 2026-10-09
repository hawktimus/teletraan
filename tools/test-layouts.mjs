// Tests for the layouts: which layout a theme has, the numbers of the sidebar
// layout (dashboard/core/layout.js: the strip, the sidebar, the pane and the
// ticker), how the page is set up for it
// (core/layout-apply.js, with a fake page), that the scheduler leaves out the
// small frame, which blocks fly apart in a hidden transition, that seasonal packs
// draw only what a layout allows, and that the stylesheet and the docs agree with
// the numbers. Nothing touches the network or a browser.
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
  'dashboard/core/layout.js', 'dashboard/core/layout-apply.js', 'dashboard/core/theme.js',
  'dashboard/core/season.js', 'dashboard/core/marks.js',
]);
const layout = await import(urlOf(mainTree, 'dashboard/core/layout.js'));
const apply = await import(urlOf(mainTree, 'dashboard/core/layout-apply.js'));
const season = await import(urlOf(mainTree, 'dashboard/core/season.js'));
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

// A page that only has an html element with a data-layout
const pageWith = name => ({ documentElement: { dataset: name === undefined ? {} : { layout: name } } });


// Which layout a theme has

test('the standard layout is the default, and Neon Prime has the sidebar layout', () => {
  assert.deepEqual(layout.layouts, ['standard', 'sidebar']);
  assert.equal(layout.defaultLayout, 'standard');
  assert.equal(layout.layoutOf('hawktimus'), 'standard');
  assert.equal(layout.layoutOf('alternate'), 'standard');
  assert.equal(layout.layoutOf('neon-prime'), 'sidebar');
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
  const skipped = panels.filter(panel => !layout.hasRegion('sidebar', panel.region)).map(panel => panel.id);
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
const schedulerTree = makeTree('scheduler', ['dashboard/config.js', 'dashboard/registry.js', 'dashboard/core/schedule.js', 'dashboard/core/layout.js', 'dashboard/core/theme.js',
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
  const first = code.indexOf('startLayout(params.get(\'theme\'), savedTheme);');

  assert.ok(first !== -1, 'startLayout is called with ?theme= and the saved theme');
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

const sideFiles = ['dashboard/config.js', 'dashboard/frame.js', 'dashboard/registry.js', 'dashboard/panels/side/side.js', 'dashboard/panels/countdown/countdown.js']
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
