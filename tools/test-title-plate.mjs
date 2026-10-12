// Tests for the header of a large panel: where the line that ends the colored tab is, what the title of a panel
// has room for before it, and what the words at the right end have after it (dashboard/core/header-room.js,
// core/plate.js, core/team-title.js, core/marks.js, core/monday-draw.js and the stylesheets of the panels). The
// numbers of the rooms are held to the shapes of every frame the large panel can have: Original, Cybertron and
// Minimal, the usual tab and the slanted one, the usual corners and the other two. The Photo panel has no title.
// Nothing touches the network or a browser. The numbers of the letters are the ones in core/text-width.js,
// measured on a render. What it looks like is checked by looking at the screen (docs/layouts.md, "Looking at a
// layout").
//
//   node tools/test-title-plate.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const dashboardFolder = path.join(repo, 'dashboard');
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '');

// The dashboard files are browser modules named .js. Copying them next to a package.json that says "type": "module"
// lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-title-plate-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js', 'frame.js'].forEach(file => fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});

const base = pathToFileURL(root).href + '/';
const plate = await import(base + 'core/plate.js');
const headerRoom = await import(base + 'core/header-room.js');
const marks = await import(base + 'core/marks.js');
const teamTitle = await import(base + 'core/team-title.js');
const draw = await import(base + 'core/monday-draw.js');
const competition = await import(base + 'core/competition-draw.js');
const time = await import(base + 'core/time.js');
const { textWidth } = await import(base + 'core/text-width.js');
const { titleLeft, titleRoom, wordsRoom, markRoom } = headerRoom;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// plate.js adds each frame's shapes to a hidden group of the page, once. A page with only that group stands in for it.
function withPlatePage(run) {
  const kept = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    value: { getElementById: id => (id === 'metal-shapes' ? { insertAdjacentHTML: () => {} } : null) },
    configurable: true,
    writable: true,
  });
  try {
    return run();
  } finally {
    if (kept) Object.defineProperty(globalThis, 'document', kept);
    else delete globalThis.document;
  }
}


// The line that ends the tab, as the points it goes through, read from the two header plates a frame draws: the
// line is what the plates share. A plate is a polygon, and the line is the run of its corners that the other plate has.

const pointsOf = (markup, name) => {
  const found = new RegExp('<polygon class="' + name + '"[^>]*points="([^"]+)"').exec(markup);
  assert.ok(found, 'the frame draws a ' + name + ' plate');
  return found[1].trim().split(/\s+/).map(pair => pair.split(',').map(Number));
};
const same = (one, other) => one[0] === other[0] && one[1] === other[1];

function lineOf(kind) {
  const markup = plate.areaMarkup(kind);
  const left = pointsOf(markup, 'header-left');
  const right = pointsOf(markup, 'header-right');
  const shared = right.map(point => left.some(other => same(point, other)));
  const start = shared.findIndex((isShared, index) => isShared && !shared[(index + right.length - 1) % right.length]);
  const line = [];

  for (let step = 0; step < right.length && shared[(start + step) % right.length]; step++) line.push(right[(start + step) % right.length]);
  return line;
}

// How far left and right the line gets between two heights: where a segment of it crosses a height it is at x
function reachBetween(line, top, bottom) {
  const xs = [];

  line.slice(1).forEach((to, index) => {
    const from = line[index];
    const low = Math.min(from[1], to[1]);
    const high = Math.max(from[1], to[1]);
    if (high < top || low > bottom) return;

    const at = y => (from[1] === to[1] ? from[0] : from[0] + (to[0] - from[0]) * (y - from[1]) / (to[1] - from[1]));
    if (from[1] === to[1]) xs.push(from[0], to[0]);
    else xs.push(at(Math.max(low, top)), at(Math.min(high, bottom)));
  });
  return { left: Math.min(...xs), right: Math.max(...xs) };
}

// Every frame the large panel gets, for every layout, style and trim the page can have
function framesOfTheLargePanel() {
  const kinds = new Set();
  ['standard', 'sidebar', 'bar'].forEach(layout => {
    ['', 'cybertron', 'minimal'].forEach(shapes => {
      ['tl', 'tr'].forEach(corner => {
        ['step', 'slant'].forEach(notch => {
          kinds.add(plate.frameKind('grid1', layout, shapes, { corner: corner, notch: notch }));
        });
      });
    });
  });
  return Array.from(kinds);
}

// The capitals of a heading stand between y 28 and 100 of the panel (measured on a render of a title at 96 px, whose capitals
// are 29 to 99), and the words at the right end, in a line of 44, between 36 and 88
const titleBand = { top: 28, bottom: 100 };
const wordsBand = { top: 36, bottom: 88 };

// The metal of the line. The notch of Original is an edge 16 wide with a shadow 5 to the right of it. The line of the steel
// styles is a bevel 3 wide
const metal = kind => (/^grid1/.test(kind) ? { left: 8, right: 13 } : { left: 2, right: 2 });

// What a title keeps clear of the metal, and what the words keep
const titleClear = 16;
const wordsClear = 14;


// The numbers

test('the rooms of the header are the numbers the stylesheets and the docs have', () => {
  assert.deepEqual([titleLeft, titleRoom, wordsRoom, markRoom], [76, 656, 289, 78]);

  // the title, the clear space, the metal and the notch of Original, the words and the padding of 40 are the 1152 of the panel
  const notch = 24 + 16;
  assert.equal(titleLeft + titleRoom + titleClear + metal('grid1').left + notch + metal('grid1').right + wordsClear + wordsRoom + 40, 1152);

  // the slashes are 54 wide, with the gap of 24 before them
  assert.equal(markRoom, 54 + 24);
});

test('every frame of the large panel ends the tab so that the title has its room before the line and the words have theirs after it', () => {
  withPlatePage(() => {
    const kinds = framesOfTheLargePanel();
    assert.ok(kinds.length >= 16, 'the frames are found: ' + kinds.join(' '));

    kinds.forEach(kind => {
      const line = lineOf(kind);
      assert.ok(line.length >= 2, kind + ' has a line');

      const title = reachBetween(line, titleBand.top, titleBand.bottom);
      const words = reachBetween(line, wordsBand.top, wordsBand.bottom);
      assert.ok(title.left - metal(kind).left - titleClear >= titleLeft + titleRoom - 0.5, kind + ': the line is at ' + title.left + ' where a title is, and the title is at ' + (titleLeft + titleRoom));
      assert.ok(words.right + metal(kind).right + wordsClear <= 1112 - wordsRoom + 0.5, kind + ': the line is at ' + words.right + ' where the words are, and they start at ' + (1112 - wordsRoom));

      // the room is not wasted: no frame leaves more than 20 px unused before its line
      assert.ok(title.left - metal(kind).left - titleClear - (titleLeft + titleRoom) < 20, kind + ' leaves the title more room than it has');
    });
  });
});

test('Original ends the tab in the notch at 772, and the steel styles end it in a line that leans 22 to the left, 60 degrees for the slanted tab', () => {
  withPlatePage(() => {
    assert.deepEqual(lineOf('grid1').map(point => point[0]).sort((a, b) => a - b), [756, 772, 773.3, 796]);
    assert.deepEqual(lineOf('grid1').filter(point => point[1] === 4), [[772, 4]]);

    ['cybertron-grid1', 'bar-main', 'bar-main-minimal'].forEach(kind => {
      const [foot, top] = lineOf(kind);
      assert.deepEqual([top[0], foot[0], top[1], foot[1]], [772, 750, 4, 120], kind);

      const slanted = lineOf(kind + '-slant');
      const slant = Math.atan2(slanted[0][1] - slanted[1][1], slanted[1][0] - slanted[0][0]) * 180 / Math.PI;
      assert.ok(Math.abs(slant - 60) < .3, kind + ' slants at ' + slant);
      assert.equal(slanted[1][0], 811, kind + ' starts the slant at 811, so it is at the left end of the notch by the foot of the capitals');
    });

    // the small frame is not changed: its labels are short
    assert.deepEqual(lineOf('grid2').find(point => point[1] === 4), [480, 4]);
    assert.deepEqual(lineOf('cybertron-grid2').find(point => point[1] === 4), [480, 4]);
  });
});


// The titles

// The titles of the panels that write one, at the size the stylesheet gives them. Each is found in the script of its panel.
const fixedTitles = [
  ['tasks', 'TASKS'], ['events', 'EVENTS'], ['tonight', 'AGENDA'], ['spotlight', 'SPOTLIGHT'], ['sponsor-feature', 'SPONSOR'],
  ['competition-next-match', 'MATCH'], ['competition-rank', 'RANK'], ['competition-results', 'RESULTS'], ['competition-alliance', 'ALLIANCE'],
  ['competition-timeline', 'SEASON'], ['competition-district', 'DISTRICT'], ['competition-last-season', 'LAST YR'],
];

test('every title that is always the same fits before the line at 96 px, and the widest title there is, LEADERSHIP, fits with 4 to spare', () => {
  fixedTitles.forEach(([panel, title]) => {
    assert.ok(read('dashboard/panels/' + panel + '/' + panel + '.js').includes(title), panel + ' writes ' + title);
    assert.ok(textWidth(title, 700, 96) <= titleRoom, title + ' is ' + Math.round(textWidth(title, 700, 96)) + ' wide');
  });

  const widest = ['LEADERSHIP', 'TEAM LEADS'].concat(fixedTitles.map(pair => pair[1])).sort((a, b) => textWidth(b, 700, 96) - textWidth(a, 700, 96))[0];
  assert.equal(widest, 'LEADERSHIP');
  assert.ok(textWidth(widest, 700, 96) <= titleRoom && titleRoom - textWidth(widest, 700, 96) < 5);

  // the Monday cards write theirs at 60 px
  ['MILESTONES', 'PROGRESS'].forEach(title => assert.ok(textWidth(title, 700, 60) <= titleRoom, title));
});

test('Leadership, Team leads and a department stay at 96 px when they fit before the line, and drop to 60 px when they do not, whatever chip is beside them', () => {
  assert.equal(teamTitle.titleClass('LEADERSHIP'), 'title');
  assert.equal(teamTitle.titleClass('TEAM LEADS'), 'title');
  assert.equal(teamTitle.titleClass('BUILD TEAM'), 'title');
  assert.equal(teamTitle.titleClass('ELECTRICAL TEAM'), 'title title-small');
  assert.equal(teamTitle.titleClass('PROGRAMMING TEAM'), 'title title-tight');

  // a department of 11 letters is the longest the Studio allows (studio/schemas/subteam.js): PROGRAMMING TEAM is 685 wide at 60 px and 639 at 56
  assert.ok(read('studio/schemas/subteam.js').includes('Up to 11 characters fit.'));
  assert.ok(textWidth('PROGRAMMING TEAM', 700, 60) > titleRoom && textWidth('PROGRAMMING TEAM', 700, 56) <= titleRoom);
  ['LEADERSHIP', 'TEAM LEADS', 'BUILD TEAM', 'DESIGN TEAM', 'BUSINESS TEAM', 'ELECTRICAL TEAM', 'ENGINEERING TEAM', 'PROGRAMMING TEAM'].forEach(title => {
    const sizes = { title: 96, 'title title-small': 60, 'title title-tight': 56 };
    const size = sizes[teamTitle.titleClass(title)];
    assert.ok(textWidth(title, 700, size) <= titleRoom, title + ' at ' + size);
    assert.equal(teamTitle.titleClass(title) === 'title', textWidth(title, 700, 96) <= titleRoom, title);
  });
  assert.equal(teamTitle.smallTitleClass('MILESTONES'), 'title');
  assert.equal(teamTitle.smallTitleClass('PROGRAMMING TEAM'), 'title title-tight', 'a Monday card, which starts at 60 px');
  assert.equal(teamTitle.titleClass.length, 1, 'the chip is on the other side of the line, so the title does not ask about it');
});

test('a title that is longer than its room is cut off with an ellipsis before the line, in the panels that write a name', () => {
  [['custom', 'custom'], ['leadership', 'leadership'], ['team-leads', 'team-leads'], ['roster', 'roster']].forEach(([panel, folder]) => {
    const css = withoutComments(read('dashboard/panels/' + folder + '/' + panel + '.css'));
    const title = new RegExp('\\.' + panel + ' \\.title \\{([^}]*)\\}').exec(css);
    assert.ok(title, panel + ' has a rule for its title');
    assert.ok(title[1].includes('max-width: ' + titleRoom + 'px;') && title[1].includes('text-overflow: ellipsis;'), panel + ' cuts its title off at ' + titleRoom);
  });

  ['roster', 'monday'].forEach(name => {
    const file = name === 'monday' ? 'dashboard/monday.css' : 'dashboard/panels/roster/roster.css';
    assert.ok(new RegExp('\\.' + name + ' \\.title-tight \\{ font: 700 var\\(--size-body\\)/64px').test(withoutComments(read(file))), name + ' writes the tight title at 56 px');
  });

  const monday = new RegExp('\\.monday \\.title \\{([^}]*)\\}').exec(withoutComments(read('dashboard/monday.css')));
  assert.ok(monday[1].includes('max-width: ' + titleRoom + 'px;') && monday[1].includes('text-overflow: ellipsis;'), 'the Monday cards cut their title off at ' + titleRoom);

  // 7 characters is what the Studio says an Extra panel title may have, and the widest ones that anyone writes fit
  assert.ok(read('studio/schemas/customPanel.js').includes('Up to 7 characters fit.'));
  ['AGENDA', 'SAFETY', 'SEASON', 'ROBOT', 'MATCHES', 'SPONSOR'].forEach(title => assert.ok(textWidth(title, 700, 96) <= titleRoom, title));
});


// The words at the right end

test('the widest Daily Agenda date of the year, and every other words the headers write, fit in the room after the line', () => {
  let widest = 0;
  for (let day = 0; day < 366; day++) {
    const date = new Date(2028, 0, 1 + day);
    widest = Math.max(widest, textWidth(time.formatDate(date), 600, 44));
  }
  assert.ok(widest <= wordsRoom && wordsRoom - widest < 3, 'the widest date is ' + widest);

  // the age of the Monday board, the age of the competition data and the team chips
  ['NOW', '4 MIN AGO', '59 MIN AGO', '47 HR AGO', '9 DAYS AGO', 'SAMPLE'].forEach(words => assert.ok(textWidth(words, 600, 44) <= wordsRoom, words));
  ['SAMPLE', '4 HR OLD', '47 HR OLD', '9 DAYS OLD'].forEach(words => assert.ok(textWidth(words, 600, 44) <= wordsRoom, words));
  ['PRIME', 'NOVA'].forEach(name => assert.ok(teamTitle.chipWidth(name) + markRoom <= wordsRoom, name + ' fits with the slashes'));
  assert.equal(teamTitle.chipWidth(''), 0);

  // the tag text of the panels that have one is cut off with an ellipsis at the room
  ['tonight', 'sponsor-feature', 'competition-next-match', 'competition-rank', 'competition-results', 'competition-alliance', 'competition-timeline', 'competition-district', 'competition-last-season'].forEach(panel => {
    const rule = new RegExp('\\.' + panel + ' \\.tag-text \\{([^}]*)\\}').exec(withoutComments(read('dashboard/panels/' + panel + '/' + panel + '.css')));
    assert.ok(rule && rule[1].includes('max-width: ' + wordsRoom + 'px;') && rule[1].includes('text-overflow: ellipsis;'), panel + ' cuts the tag text off at ' + wordsRoom);
  });
});

test('the slashes are left out of a header whose words need their room, and a seasonal pack\'s mark goes the same way', () => {
  assert.equal(headerRoom.markFits(0), true);
  assert.equal(headerRoom.markFits(wordsRoom - markRoom), true);
  assert.equal(headerRoom.markFits(wordsRoom - markRoom + 1), false);

  assert.ok(marks.markBeside(0).includes('class="double-slash"'));
  assert.ok(marks.markBeside(textWidth('SAMPLE', 600, 44)).includes('class="double-slash"'), 'SAMPLE is short');
  assert.equal(marks.markBeside(textWidth('MON MAR 29', 600, 44)), '', 'a long date has no slashes');

  marks.setPackMark({ viewBox: '0 0 60 76', markup: '<rect width="60" height="76"/>' });
  try {
    assert.ok(marks.markBeside(0).includes('class="pack-mark"'));
    assert.equal(marks.markBeside(textWidth('MON MAR 29', 600, 44)), '', 'and neither has the mark of a pack');
  } finally {
    marks.setPackMark(null);
  }

  // the competition cards write the tag text and then the slashes if they fit
  const card = tag => competition.pageMarkup('competition-rank', 'RANK', tag, '');
  assert.ok(card('SAMPLE').includes('class="double-slash"') && card('').includes('class="double-slash"'));
  assert.equal(card('47 HR OLD').includes('class="double-slash"'), false, 'a tag of 47 HR OLD is 230 wide');
  assert.ok(card('47 HR OLD').includes('<span class="tag-text">47 HR OLD</span>'));
});

test('the Monday header keeps the words beside a chip for the bar layout, where the header is as wide as the panel, and the title stays before the line', () => {
  const status = { lastSyncAt: '2026-10-12T15:56:00Z' };
  const now = new Date('2026-10-12T16:00:00Z');

  // 4 MIN AGO is 237 wide: it fits in the 289 alone, and not beside the chip of 178
  const chipped = draw.headerMarkup('MILESTONES', 'PRIME', status, now);
  assert.ok(chipped.includes('<div class="tag tag-with-chip" data-slat="tag"><span class="ago">4 MIN AGO</span><span class="team-chip">PRIME</span>'));
  assert.ok(chipped.includes('class="double-slash"'), 'the slashes fit beside the chip');

  const both = draw.headerMarkup('MILESTONES', '', status, now);
  assert.ok(both.includes('<div class="tag" data-slat="tag"><span class="ago">4 MIN AGO</span>') && !both.includes('class="double-slash"'), 'the words of a card of both teams have the room, and the slashes do not');
  assert.equal(draw.headerMarkup('MILESTONES', 'PRIME', null, now).includes('class="ago"'), false);

  const css = withoutComments(read('dashboard/monday.css'));
  assert.ok(/\.monday \.tag-with-chip \.ago \{ display: none; \}/.test(css), 'in a header 1152 wide the words beside the chip are hidden');
  assert.ok(/html\[data-layout="bar"\] \.monday \.tag-with-chip \.ago \{ display: inline; \}/.test(css), 'and shown in the bar layout');

  const bar = withoutComments(read('dashboard/layouts/bar.css'));
  assert.ok(/html\[data-layout="bar"\] \.area\[data-area="grid1"\] \.page \.header \{\s*width: var\(--bar-area-width\);\s*\}/.test(bar), 'the header of the main panel is as wide as the panel');

  // beside a chip in the bar layout: the chip and the words and the gap fit in the header that is 275 wider
  assert.ok(teamTitle.chipWidth('PRIME') + 20 + textWidth('59 MIN AGO', 600, 44) <= wordsRoom + 275);
});

test('Neon Prime puts the row of ticks to the right of the notch, and stops it before the mark', () => {
  const css = withoutComments(read('dashboard/themes/decor/neon-prime-decor.css'));
  const rule = /\.header::after \{([^}]*)\}/.exec(css)[1];
  const left = Number(/left: (\d+)px/.exec(rule)[1]);
  const width = Number(/width: (\d+)px/.exec(rule)[1]);

  assert.ok(left >= 796 + metal('grid1').right, 'it starts past the notch and its shadow');
  assert.ok(left + width <= 1112 - 54, 'and ends before the slashes, which are 54 wide at the right end');
  assert.equal(width % 15, 0, 'in whole ticks of 15');
});


// The Photo panel

test('the Photo panel has no title and no mark, and its stylesheet has no rule for a header', () => {
  const script = withoutComments(read('dashboard/panels/photo/photo.js'));
  const css = withoutComments(read('dashboard/panels/photo/photo.css'));

  assert.equal(/PHOTOS|<h2|class="header"|class="title"|doubleSlash|markBeside|data-slat="title"|data-slat="tag"/.test(script), false);
  assert.equal(/\.photo \.header|\.photo \.title/.test(css), false);
  assert.ok(script.includes('<div class="photo-body" data-slat="item"'), 'the body is the one slat of the page');
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
