// Tests for the width of the Monday cards (dashboard/monday.css and the stylesheets and scripts of panels/monday-*,
// core/areas.js and styles/minimal.css). The bar layout of Minimal gives the large panel a page 1427 wide, and the
// five cards use all of it: the header and the body are as wide as the area, the cells and the bars take the room, and
// the weld seam, the vertical line that stands where a 1152 page ends, is not drawn under a card. The standard layout
// is as it was. The stylesheets are checked by reading them, because the sizes need a browser to be seen. core/areas.js
// is run against stand-ins for the files it reads.
//
//   node tools/test-monday-fill.mjs
//
// What it looks like is checked by looking at the screen (docs/layouts.md, "The width of the Monday cards").

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-monday-fill-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js'].forEach(file => fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});

const cardNames = ['tasks', 'milestones', 'progress', 'milestones-both', 'progress-both'];
const cardIds = cardNames.map(name => 'monday-' + name);
cardIds.forEach(id => {
  fs.mkdirSync(path.join(root, 'panels', id), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', id, id + '.js'), path.join(root, 'panels', id, id + '.js'));
});

const base = pathToFileURL(root).href + '/';
const layout = await import(base + 'core/layout.js');
const sanity = await import(base + 'core/sanity.js');
const panels = {};
for (const name of cardNames) panels[name] = await import(base + 'panels/monday-' + name + '/monday-' + name + '.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const countOf = (text, piece) => text.split(piece).length - 1;

// The rules of a stylesheet by selector. Rules that share a selector are put together, in the order they are written.
function rulesOf(css) {
  const rules = {};
  Array.from(withoutComments(css).matchAll(/([^{}]+)\{([^}]*)\}/g)).forEach(match => {
    match[1].split(',').forEach(selector => {
      const key = selector.trim();
      rules[key] = (rules[key] ? rules[key] + ' ' : '') + match[2];
    });
  });
  return rules;
}

const pixels = (rule, property) => Number(new RegExp('(?:^|[;\\s])' + property + ':\\s*(\\d+)px').exec(rule)[1]);

// What a rule says a size is when it is written as calc(var(--bar-area-width) - 48px - 404px): the area minus the numbers
function calcOf(rule, property) {
  const found = new RegExp('(?:^|[;\\s])' + property + ':\\s*calc\\(var\\(--bar-area-width\\)((?: - \\d+px)+)\\)').exec(rule);
  assert.ok(found, 'a ' + property + ' of the area less some pixels in: ' + rule);
  return areaWidth - found[1].match(/\d+/g).reduce((sum, number) => sum + Number(number), 0);
}

const areaWidth = layout.barGeometry.areaWidth;
const bar = selector => 'html[data-layout="bar"] ' + selector;

const shared = rulesOf(read('monday.css'));
const sheetOf = name => rulesOf(read('panels/monday-' + name + '/monday-' + name + '.css'));

// The sample, cleaned as the screen cleans it, with the Monday tasks kept or taken out
function contentWith(change) {
  const raw = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
  raw.settings.countdown = { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN', rollout: '' };
  if (change) change(raw);
  return sanity.normalizeSample(raw);
}
const noBoardTasks = raw => {
  raw.tasks = raw.tasks.filter(task => task.source !== 'monday');
};
const noDueDates = raw => {
  raw.tasks.forEach(task => {
    if (task.source === 'monday') delete task.dueDate;
  });
};

// The markup of every card, with tasks, with tasks that have no due dates, and with no tasks at all
function everyMarkup() {
  const now = new Date('2026-10-12T16:00:00Z');
  const contents = [contentWith(), contentWith(noDueDates), contentWith(noBoardTasks)];
  const found = [];
  cardNames.forEach(name => contents.forEach(content => [1, 2].forEach(page => {
    const host = { innerHTML: '' };
    panels[name].mount(host, content, page);
    found.push({ name: name, html: host.innerHTML });
  })));
  return found;
}


// The width of a card

test('the area of the bar layout is 1427 wide, and a Monday card is as wide as it in the bar layout and 1152 and 1104 wide anywhere else', () => {
  assert.equal(areaWidth, 1427);

  // the rules for every layout are the ones the cards always had
  assert.equal(pixels(shared['.monday .header'], 'width'), 1152);
  assert.equal(pixels(shared['.monday .body'], 'width'), 1104);
  assert.deepEqual(['left', 'top', 'height'].map(name => pixels(shared['.monday .body'], name)), [24, 132, 544]);
  assert.equal(pixels(shared['.monday .header'], 'height'), 116);

  // and in the bar layout the header is the area and the body is the area less 24 at each side
  assert.ok(/(?:^|[;\s])width:\s*var\(--bar-area-width\);/.test(shared[bar('.monday .header')]), 'the header is the whole area');
  assert.equal(calcOf(shared[bar('.monday .body')], 'width'), 1379, 'the body is 48 less');
});

test('the body is 24px from the frame at each side in the bar layout as it is in the standard one, and its corner is clear of the cut', () => {
  const body = calcOf(shared[bar('.monday .body')], 'width');
  const left = pixels(shared['.monday .body'], 'left');
  const bottom = pixels(shared['.monday .body'], 'top') + pixels(shared['.monday .body'], 'height');

  assert.equal(left + body + 24, areaWidth, 'the same 24 at the right as at the left');
  assert.equal(left + 1104 + 24, 1152, 'as in the standard layout');

  // Minimal cuts the bottom right corner of the frame by 34, from 34 up the right edge to 34 along the bottom: the body ends 676 down,
  // and the cut is 2 in from the edge at that height, which the 24 of room at the right clears
  const cut = 34;
  const cutIn = Math.max(0, bottom - (708 - cut));
  assert.equal(cutIn, 2);
  assert.ok(left + body <= areaWidth - cutIn - 8, 'the body ends before the cut');
  assert.ok(pixels(shared['.monday .marker'], 'right') >= 68, 'the page marker keeps the 68 it has from the end of the body');
});

test('every rule that makes a card wider, and the one that shows the words about the board, is for the bar layout, so the standard layout and the sidebar layout are drawn as they were', () => {
  const files = ['monday.css'].concat(cardIds.map(id => 'panels/' + id + '/' + id + '.css'));
  const forBar = [];

  files.forEach(file => {
    const rules = rulesOf(read(file));
    Object.keys(rules).forEach(selector => {
      if (selector.startsWith('html[data-layout="bar"]')) {
        assert.ok(selector.startsWith(bar('.monday')), file + ' ' + selector + ' is for a card');
        forBar.push(selector);
      } else {
        assert.equal(/--bar-area-width|vector-effect/.test(rules[selector]), false, file + ' ' + selector + ' is for every layout and leaves the bar layout alone');
      }
    });

    // the sidebar layout (Neon Prime) has no rule of its own for a card
    assert.equal(/data-layout="sidebar"/.test(read(file)), false, file);
  });

  assert.deepEqual(forBar.sort(), [
    bar('.monday .ago-wide'),
    bar('.monday .body'),
    bar('.monday .header'),
    bar('.monday .tag-with-chip .ago'),
    bar('.monday-progress .bars'),
    bar('.monday-progress .chart'),
    bar('.monday-progress .seg'),
    bar('.monday-progress .stack'),
    bar('.monday-progress-both .seg'),
    bar('.monday-progress-both .stack'),
  ].sort(), 'the header, the body, the words about the board beside the chip, the line, the bars and the two bars of both teams');
});


// What the content does with the room

test('the milestones card has cells 391 wide in the bar layout where it had 254, and the department and the chip keep their columns', () => {
  const rules = sheetOf('milestones');
  const columns = /grid-template-columns:\s*(\d+)px repeat\(2, minmax\(0, 1fr\)\) (\d+)px/.exec(rules['.monday-milestones .milestone-row']);
  const gap = pixels(rules['.monday-milestones .milestone-row'], 'column-gap');
  const cellIn = body => (body - Number(columns[1]) - Number(columns[2]) - 3 * gap) / 2;

  assert.equal(cellIn(1104), 254, 'the standard layout');
  assert.equal(cellIn(areaWidth - 48), 391.5, 'the bar layout: 137 more than before, which the two columns of cells share');
  assert.equal(/minmax\(0, 1fr\)/.test(rules['.monday-milestones .milestone-row']), true, 'the cells are the part of the row that gives');
  assert.equal(Object.keys(rules).some(selector => selector.includes('data-layout')), false, 'and no rule of its own is needed');
});

test('the progress card puts the line at the right of the wider body, clear of the frame and of the bars, and the bars take the rest', () => {
  const rules = sheetOf('progress');
  const html = panels.progress.markupFor(contentWith(), new Date('2026-10-12T16:00:00Z'));
  const left = calcOf(rules[bar('.monday-progress .chart')], 'left');

  assert.equal(left, 251, 'the line is 251 further right than the 1104 body it was drawn for');
  assert.ok(html.includes('<svg class="chart" width="1096" height="512" viewBox="0 0 1096 512"'), 'the line is still drawn once, 1096 by 512');

  // the line ends 56 short of the frame at the right, which is clear of the rust that Minimal draws on it, and 32 short of the body
  assert.equal(24 + left + 1096, 1371);
  assert.equal(areaWidth - (24 + left + 1096), 56);

  // the bars have the room to the left of the words of the line, with the 16 that they had
  const bars = calcOf(rules[bar('.monday-progress .bars')], 'width');
  assert.equal(bars, 951);
  assert.equal(716 + left - bars, 16, 'the words of the line start 16 after the bars');
  assert.equal(pixels(rules['.monday-progress .bars'], 'width'), 700, 'and 700 in the standard layout');

  // a row is the department in 330, the bar and done out of all, with 12 between: the bar is what is left
  const gap = pixels(rules['.monday-progress .bar-row'], 'gap');
  const stack = bars - 330 - pixels(rules['.monday-progress .count'], 'width') - 2 * gap;
  assert.equal(stack, 457);
  const standard = 700 - 330 - pixels(rules['.monday-progress .count'], 'width') - 2 * gap;
  assert.equal(standard, 206, 'the bar of the standard layout');
  assert.equal(/flex:\s*1 1 0;/.test(rules[bar('.monday-progress .stack')]), true);
  assert.equal(/width:\s*auto;/.test(rules[bar('.monday-progress .stack')]), true);
  assert.equal(/flex:\s*none;/.test(rules['.monday-progress .stack']), true, 'the bar of the standard layout does not give');
});

test('the progress card of both teams has a bar 689 long in the bar layout and 400 in the standard one', () => {
  const rules = sheetOf('progress-both');
  const row = rules['.monday-progress-both .row'];
  const widths = [174, 330, 150].map(Number); // the team label, the department and the count
  const gaps = 3 * pixels(row, 'gap');

  assert.equal(pixels(shared['.monday .team-tag'], 'width'), widths[0]);
  assert.equal(pixels(shared['.monday .department'], 'width'), widths[1]);
  assert.equal(pixels(rules['.monday-progress-both .count'], 'width'), widths[2]);
  assert.equal(areaWidth - 48 - widths[0] - widths[1] - widths[2] - gaps, 689);
  assert.equal(/flex:\s*none;/.test(rules['.monday-progress-both .stack']), true);
  assert.equal(/flex:\s*1 1 0;/.test(rules[bar('.monday-progress-both .stack')]), true);

  const html = panels['progress-both'].markupFor(contentWith(), new Date('2026-10-12T16:00:00Z'));
  assert.ok(html.includes('width="400" height="44" viewBox="0 0 400 44"'), 'the bar is still drawn 400 by 44');
});

test('a bar is stretched along its length only: the svg says so, and the edge between two stacks keeps its width, in the bar layout only', () => {
  ['progress', 'progress-both'].forEach(name => {
    const html = panels[name].markupFor(contentWith(), new Date('2026-10-12T16:00:00Z'));
    const stacks = Array.from(html.matchAll(/<svg class="stack"[^>]*>/g)).map(match => match[0]);

    assert.ok(stacks.length >= 3, name + ' draws bars');
    stacks.forEach(tag => {
      assert.ok(/preserveAspectRatio="none"/.test(tag), name + ': ' + tag);
      const [, width, height] = /width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/.exec(tag).slice(0, 3);
      assert.ok(tag.includes('viewBox="0 0 ' + width + ' ' + height + '"'), 'the picture is as big as the box, so the standard layout draws it as it was');
    });

    const rules = sheetOf(name);
    assert.ok(/vector-effect:\s*non-scaling-stroke/.test(rules[bar('.monday-' + name + ' .seg')]), name + ' keeps the edge at its width in the bar layout');
    assert.equal(/vector-effect/.test(rules['.monday-' + name + ' .seg']), false, name + ' leaves the standard layout as it was');
  });
});

test('the tasks card and the cards of both teams of milestones take the wider body without a rule of their own, and no text on a card is smaller than before', () => {
  const tasks = sheetOf('tasks');
  const both = sheetOf('milestones-both');

  assert.ok(/flex:\s*1 1 0;/.test(tasks['.monday-tasks .row-title']), 'the title of a task takes what the other parts leave');
  assert.ok(/flex:\s*1 1 0;/.test(both['.monday-milestones-both .milestone']), 'the milestone takes what the label, the department and the date leave');
  assert.equal(Object.keys(tasks).concat(Object.keys(both)).some(selector => selector.includes('data-layout')), false);

  // 20 letters of 52px still fit the title of a task: the room only grew
  const title = areaWidth - 48 - pixels(tasks['.monday-tasks .status'], 'width') - pixels(tasks['.monday-tasks .owner'], 'max-width') - pixels(tasks['.monday-tasks .priority'], 'width') - 3 * pixels(tasks['.monday-tasks .row'], 'gap');
  assert.equal(title, 1379 - 236 - 200 - 36 - 48);
  assert.ok(title > 1104 - 236 - 200 - 36 - 48);

  cardIds.forEach(id => {
    const css = withoutComments(read('panels/' + id + '/' + id + '.css'));
    assert.equal(Array.from(css.matchAll(/html\[data-layout="bar"\][^{]*\{[^}]*\}/g)).some(match => /font/.test(match[0])), false, id + ' sets no font in the bar layout');
  });
});


// No line at the right

test('no card draws a vertical rule of its own at the right end, in any style or state', () => {
  const files = ['monday.css'].concat(cardIds.map(id => 'panels/' + id + '/' + id + '.css'));
  files.forEach(file => {
    const css = withoutComments(read(file));
    assert.equal(/border-right|border-inline-end|column-rule|outline:|box-shadow/.test(css), false, file + ' draws no line at the right');
  });

  everyMarkup().forEach(entry => {
    assert.equal(/<hr|class="[^"]*\b(rule|divider|separator|seam)\b/.test(entry.html), false, entry.name + ' has no rule in its markup');
  });
});

test('the weld seam of Minimal is not drawn while a Monday card is on screen, and is drawn for every other panel', () => {
  const css = withoutComments(read('styles/minimal.css'));
  const rules = rulesOf(css);
  const hidden = 'html[data-style="minimal"] .area[data-page^="monday-"] ';

  assert.ok(/display:\s*none;/.test(rules[hidden + '.art-weld-dark']), 'the dark line is hidden');
  assert.ok(/display:\s*none;/.test(rules[hidden + '.art-weld-light']), 'and the light line beside it');
  assert.equal(Object.keys(rules).filter(selector => selector.includes('data-page')).length, 2, 'nothing else is hidden by the page');

  // every id of a Monday card starts with monday-, and no other panel does
  const registry = read('registry.js');
  cardIds.forEach(id => assert.ok(registry.includes("{ id: '" + id + "', region: 'grid1', topic: 'monday', monday: true }"), id));
  assert.deepEqual(Array.from(registry.matchAll(/\{ id: '(monday-[a-z-]+)'/g)).map(match => match[1]), cardIds, 'the cards are the panels with the prefix');

  // the seam is still in the frame of the main panel, which is where the other panels see it
  assert.ok(/html\[data-style="minimal"\] \.art-weld-dark \{/.test(css) && /html\[data-style="minimal"\] \.art-weld-light \{/.test(css), 'the seam is still painted');
});

// core/areas.js, with stand-ins for the files it reads. Elements are objects that keep what is put on them.
const areasTree = path.join(workFolder, 'areas-tree');
fs.mkdirSync(path.join(areasTree, 'dashboard/core'), { recursive: true });
fs.writeFileSync(path.join(areasTree, 'package.json'), '{ "type": "module" }\n');
fs.copyFileSync(path.join(dashboardFolder, 'core/areas.js'), path.join(areasTree, 'dashboard/core/areas.js'));
fs.writeFileSync(path.join(areasTree, 'dashboard/frame.js'), [
  "export const firstFinish = () => 'gold';",
  "export const planChange = () => ({ style: 'slat', finish: null });",
  'export const leave = async () => {};',
  'export const arrive = async () => {};',
  'export const retire = async () => {};',
  'export const enter = async () => {};',
  'export const exit = async () => {};',
  'export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));',
].join('\n') + '\n');
fs.writeFileSync(path.join(areasTree, 'dashboard/core/plate.js'), [
  "export const areaMarkup = () => '<svg></svg>';",
  "export const frameKind = () => 'bar-main-minimal';",
].join('\n') + '\n');
fs.writeFileSync(path.join(areasTree, 'dashboard/core/panels.js'), [
  'export const hostFor = () => null;',
  'export const placeWholePanel = () => {};',
].join('\n') + '\n');
fs.writeFileSync(path.join(areasTree, 'dashboard/core/theme-apply.js'), 'export const changeThemeNow = () => {};\n');
fs.writeFileSync(path.join(areasTree, 'dashboard/core/teams.js'), [
  'export const changeTeamNow = () => {};',
  'export const trimNow = () => ({});',
].join('\n') + '\n');
fs.writeFileSync(path.join(areasTree, 'dashboard/core/layout.js'), [
  'export const hasRegion = () => true;',
  "export const layoutNow = () => 'bar';",
].join('\n') + '\n');
fs.writeFileSync(path.join(areasTree, 'dashboard/core/style.js'), [
  'export const hasSteel = () => true;',
  "export const shapesNow = () => 'minimal';",
  "export const styleNow = () => 'minimal';",
].join('\n') + '\n');

function fakeElement(name) {
  const element = {
    name: name,
    dataset: {},
    children: [],
    className: '',
    remove() {},
    appendChild(child) {
      element.children.push(child);
    },
    querySelector: selector => (selector === '.page-host' ? element.host || null : null),
  };
  return element;
}

let areaRuns = 0;

async function inAreas(run) {
  const regions = {};
  globalThis.document = {
    getElementById: id => {
      regions[id] = regions[id] || fakeElement(id);
      return regions[id];
    },
    createElement: () => {
      const element = fakeElement('area');
      Object.defineProperty(element, 'innerHTML', { set: () => {
        element.host = fakeElement('page-host');
        element.host.innerHTML = '';
      } });
      return element;
    },
  };

  try {
    areaRuns += 1;
    const areas = await import(pathToFileURL(path.join(areasTree, 'dashboard/core/areas.js')).href + '?run=' + areaRuns);
    await run(areas, () => regions['region-grid1'].children[0]);
  } finally {
    delete globalThis.document;
  }
}

test('the area says which panel is in it, at a page change and at a swap, so that a stylesheet can tell a Monday card from another panel', async () => {
  await inAreas(async (areas, area) => {
    const page = id => ({ id: id, region: 'grid1', element: { id: id } });

    await areas.changePage('grid1', page('tasks'));
    assert.equal(area().dataset.page, 'tasks', 'the first page makes the area');

    await areas.changePage('grid1', page('monday-milestones'));
    assert.equal(area().dataset.page, 'monday-milestones', 'a page change');

    areas.setSwapOffer(() => ({ play: async swapPage => {
      swapPage();
      return 0;
    } }));
    await areas.changePage('grid1', page('monday-progress'));
    assert.equal(area().dataset.page, 'monday-progress', 'a swap, which puts the page in while the screen is apart');

    areas.setSwapOffer(null);
    await areas.changePage('grid1', page('events'));
    assert.equal(area().dataset.page, 'events', 'and the next panel that is not a card takes the name away');
  });
});

test('core/areas.js writes the panel in one place that both ways of putting a page in use, and the stylesheet reads it', () => {
  const areas = read('core/areas.js');

  assert.equal(countOf(areas, 'markPage('), 3, 'the function and the two places that put a page in');
  assert.ok(/markPage\(made, next\);\n  const host = made\.querySelector\('\.page-host'\);/.test(areas), 'the swap');
  assert.ok(/markPage\(areaOf\[region\], next\);\n  host\.innerHTML = '';/.test(areas), 'the page change');
  assert.ok(/data-page is the id of the panel/.test(areas), 'the comment at the top says what data-page is');
});


// The docs

test('the docs say that the Monday cards fill the main panel, what each card does with the room, and that there is no seam under one', () => {
  const doc = fs.readFileSync(path.join(docsFolder, 'layouts.md'), 'utf8').replace(/\s+/g, ' ');

  ['### The width of the Monday cards', '1427', '1379', 'data-page', 'markPage', 'preserveAspectRatio="none"', 'non-scaling-stroke', 'test-monday-fill.mjs', 'weld seam'].forEach(word => assert.ok(doc.includes(word), 'layouts.md names ' + word));
  assert.ok(doc.includes('to the extra width, except the Monday cards'), 'the width of the main panel names the exception');
  assert.ok(doc.includes('A Monday card is as wide as the panel and has no seam'), 'the check by hand says so');
  assert.ok(fs.readFileSync(path.join(docsFolder, 'where-things-are.md'), 'utf8').includes('test-monday-fill.mjs'), 'where-things-are.md lists this test');
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
