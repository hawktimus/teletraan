// Tests for the Portrait size above 100: the range of the setting, the rows a page holds, the height of
// a row, where the role goes, and the paging of the Leadership and Team Leads panels, which must show
// everyone however few rows fit (dashboard/core/portrait.js, core/turns.js, core/leadership.js,
// core/team-leads.js, base.css and the three panels). The plain functions are run for real. The panels
// are run against a fake page that records what they draw. The stylesheet is checked by reading it,
// because the sizes need a browser to be seen. The rows at 100 and below are in
// tools/test-person-rows.mjs, and the photo of a team lead is in tools/test-lead-photo.mjs.
//
//   node tools/test-portrait-size.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-portrait-size-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
fs.copyFileSync(path.join(dashboardFolder, 'config.js'), path.join(root, 'config.js'));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  fs.copyFileSync(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file));
});
['leadership/leadership.js', 'team-leads/team-leads.js', 'roster/roster.js'].forEach(file => {
  fs.mkdirSync(path.join(root, 'panels', path.dirname(file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, 'panels', file), path.join(root, 'panels', file));
});

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const content = await import(base + 'core/content.js');
const portrait = await import(base + 'core/portrait.js');
const turns = await import(base + 'core/turns.js');
const sanity = await import(base + 'core/sanity.js');
const images = await import(base + 'core/images.js');

// A panel keeps the page it showed last, so a test that counts visits asks for a copy of its own
let copies = 0;
async function freshPanel(name) {
  copies += 1;
  return import(base + 'panels/' + name + '/' + name + '.js?copy=' + copies);
}

const { rowSizes, rowLayout, rowsMarkup, rowsPerPage, portraitSizes, slotMarkup } = portrait;
const { makePages } = turns;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const countOf = (text, piece) => text.split(piece).length - 1;

// plate.js draws each card and bar shape once into a hidden group of the page. This
// stands in for the page.
async function withFakePage(run) {
  const drawn = [];
  globalThis.document = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => drawn.push(markup.match(/id="([^"]+)"/)[1]) };
      return drawn.includes(id) ? {} : null;
    },
  };

  try {
    await run(drawn);
  } finally {
    delete globalThis.document;
  }
}

// The photos of the page after this one are asked for with an image. The test says which.
async function withFakeImages(run) {
  const asked = [];
  globalThis.Image = class {
    set src(address) {
      asked.push(address);
    }
  };

  try {
    await run(asked);
  } finally {
    delete globalThis.Image;
  }
}

function mount(panel, data) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  panel.mount(host, data);
  return host.innerHTML;
}

const namesIn = html => Array.from(html.matchAll(/<div class="person-name">([^<]*)<\/div>/g)).map(match => match[1]);

function crew(role, count, more) {
  const people = [];
  for (let number = 1; number <= count; number++) {
    people.push(Object.assign({ role: role, name: '[' + role + ' ' + number + ']' }, more));
  }
  return people;
}

function departments(count) {
  const list = [];
  for (let number = 1; number <= count; number++) {
    list.push({ name: '[Dept ' + number + ']', lead: '[Lead ' + number + ']', members: [] });
  }
  return list;
}

const photoRecord = number => ({
  url: 'https://cdn.sanity.io/images/abc123/production/0123abc' + number + '-800x600.jpg',
  width: 800,
  height: 600,
  crop: { left: 0, right: 0, top: 0, bottom: 0 },
  hotspot: { x: 0.5, y: 0.5 },
});

// The rule of a selector in a stylesheet, or '' when there is none
function ruleOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|[}\\s])' + escaped + '\\s*\\{([^}]*)\\}').exec(css);
  return found ? found[1] : '';
}

const numberIn = (rule, property) => Number(new RegExp('(?:^|[;\\s])' + property + ': (\\d+)(?:px)?[;\\s]').exec(rule)[1]);

// The body of the large panel is 576 high and 1152 wide, and the rows start 124 down the frame
const bodyHeight = 576;
const bodyWidth = 1152;
const bodyTop = 124;
// What is left for the role beside a name of 560px, at 100 in the last row, which stops 16px sooner
// (tools/test-person-rows.mjs pins it)
const roleBesideMinimum = 336;
const percents = [];
for (let percent = 60; percent <= 200; percent++) percents.push(percent);

// The setting

test('the Portrait size goes from 60 to 200, starts at 100, and anything outside is brought to the nearest end', () => {
  assert.deepEqual(config.limits.portraitScale, { min: 60, max: 200 });
  assert.equal(config.defaultSettings.portraitScale, 100);
  assert.deepEqual(config.limits.photoScale, { min: 60, max: 100 }, 'the Photo size did not change');

  [[60, 60], [100, 100], [150, 150], [200, 200], [149.6, 150], [59, 60], [0, 60], [-5, 60], [201, 200], [500, 200]].forEach(([value, wanted]) => {
    assert.equal(content.tidyScale('portraitScale', value), wanted, 'portraitScale ' + value);
    assert.equal(sanity.normalizeContent({ settings: { portraitScale: value } }).settings.portraitScale, wanted, 'through the reader ' + value);
  });
  ['big', NaN, undefined, null, Infinity].forEach(value => {
    assert.equal(content.tidyScale('portraitScale', value), 100, String(value));
  });
  assert.equal(content.tidyScale('photoScale', 150), 100, 'the Photo size still stops at 100');
});

// The portrait in a row

test('a row portrait is 124 square at 100, 74 at 60, 149 at 120 and 248 at 200, and never shrinks when the setting grows', () => {
  assert.deepEqual(rowSizes(100), { card: 124, photo: 118, inset: 3 });
  assert.deepEqual(rowSizes(60), { card: 74, photo: 70, inset: 2 });
  assert.deepEqual(rowSizes(120), { card: 149, photo: 143, inset: 3 });
  assert.deepEqual(rowSizes(200), { card: 248, photo: 238, inset: 5 });
  assert.ok(Math.abs(rowSizes(120).card - 2 * rowSizes(60).card) <= 1, 'twice the saved 60 is twice the portrait, to the pixel');
  assert.equal(rowSizes(200).card, 2 * rowSizes(100).card);

  let before = 0;
  percents.forEach(percent => {
    const size = rowSizes(percent);
    assert.equal(size.photo, size.card - 2 * size.inset, 'the picture is the card less its space on both sides at ' + percent);
    assert.ok(size.card >= before, 'a bigger setting never gives a smaller portrait at ' + percent);
    before = size.card;
  });
});

// Rows per page

test('a page holds 4 rows up to 100, 3 from 101 to 139 and 2 from 140 to 200, and a row is the body divided by the rows', () => {
  assert.equal(rowsPerPage, 4);
  [[60, 4, 144], [100, 4, 144], [101, 3, 192], [113, 3, 192], [120, 3, 192], [139, 3, 192], [140, 2, 288], [150, 2, 288], [200, 2, 288]].forEach(([percent, rows, height]) => {
    assert.deepEqual([rowLayout(percent).rows, rowLayout(percent).height], [rows, height], 'at ' + percent);
  });

  percents.forEach(percent => {
    const card = rowSizes(percent).card;
    const layout = rowLayout(percent);
    const wanted = percent <= 100 ? 4 : Math.floor(bodyHeight / (card + 20));

    assert.equal(layout.rows, wanted, 'rows at ' + percent);
    assert.equal(layout.rows * layout.height, bodyHeight, 'the rows fill the body at ' + percent);
    assert.ok(layout.rows >= 2, 'a page holds at least two rows at ' + percent);
    assert.ok(card + 20 <= layout.height, 'the portrait and 10px above and below it for the bar fit the row at ' + percent);
    assert.ok(layout.rows === 4 || bodyHeight / (layout.rows + 1) < card + 20, 'one more row would not fit at ' + percent);
  });

  // 100 is exactly full: 124 and 20 for the bar is 144, and four of them are 576. A single percent more has 3 rows.
  assert.equal(rowSizes(100).card + 20, bodyHeight / 4);
  assert.equal(Math.floor(bodyHeight / (rowSizes(101).card + 20)), 3);
});

test('the rows at 100 and below are what they always were: four of 144, not stacked, the same for every setting', () => {
  for (let percent = 60; percent <= 100; percent++) {
    assert.deepEqual(rowLayout(percent), { rows: 4, height: 144, stacked: false }, 'at ' + percent);
  }
  assert.deepEqual(rowLayout(), rowLayout(100));
  assert.deepEqual(rowLayout('big'), rowLayout(100));
  assert.deepEqual(rowLayout(30), rowLayout(60));
  assert.deepEqual(rowLayout(900), rowLayout(200));
});

// Where the role goes

test('the role stays beside the name while it keeps 336px, and goes under the name from a portrait of 141px, which is 114 percent', () => {
  const css = read('base.css');
  const row = ruleOf(css, '.person-row');
  const stacked = ruleOf(css, '.person-rows.stacked .person-row');
  const name = ruleOf(css, '.person-name');
  const padding = /padding: 0 (\d+)px 0 (\d+)px;/.exec(row);
  const gap = numberIn(row, 'column-gap');
  const nameWidth = numberIn(name, 'max-width');
  const inner = bodyWidth - Number(padding[1]) - Number(padding[2]);

  assert.deepEqual([Number(padding[1]), Number(padding[2]), gap, nameWidth], [40, 28, 24, 560], 'the numbers the widths are worked out from');

  // beside the name the role has what is left of the row, and it has the 336px of the rows at 100
  const widest = 476 - roleBesideMinimum;
  assert.equal(inner - 2 * gap - nameWidth - widest, roleBesideMinimum);
  assert.equal(widest, 140, 'the widest portrait that leaves the role its 336px');

  percents.forEach(percent => {
    const card = rowSizes(percent).card;
    const layout = rowLayout(percent);

    assert.equal(layout.stacked, card > widest, 'stacked at ' + percent);
    if (!layout.stacked) {
      assert.ok(inner - card - 2 * gap - nameWidth >= roleBesideMinimum, 'the role has 336px beside the longest name at ' + percent);
    }
  });
  assert.equal(rowLayout(113).stacked, false);
  assert.equal(rowSizes(114).card, 141);
  assert.equal(rowLayout(114).stacked, true);
  assert.ok(inner - 141 - 2 * gap - nameWidth < roleBesideMinimum, '141px would leave the role under 336px beside the name');

  // stacked, the role is in the column the name is in, in the row under the name, at the left
  assert.ok(/grid-template-columns: auto minmax\(0, 1fr\);/.test(stacked) && /grid-template-rows: minmax\(0, 1fr\) max-content max-content minmax\(0, 1fr\);/.test(stacked), 'the portrait, then one column for the name and the role');
  // an auto row round a box that cuts its text (overflow: hidden) shrinks to 20px in a browser, and the role lands on the name
  assert.equal(/grid-template-rows:[^;]*\bauto\b/.test(stacked), false, 'the rows of the name and the role are max-content, never auto');
  assert.ok(/grid-row: 2;/.test(ruleOf(css, '.person-rows.stacked .person-name')), 'the name is in the row above the role');
  const role = ruleOf(css, '.person-rows.stacked .person-role');
  assert.ok(/grid-column: 2;/.test(role) && /grid-row: 3;/.test(role) && /text-align: left;/.test(role), 'the role is under the name, at the left');
  assert.ok(/grid-row: 1 \/ 5;/.test(ruleOf(css, '.person-rows.stacked .person-row .portrait')), 'the portrait spans the rows, so it is centred in the row');

  // the column of a stacked row is as wide as the longest name, whatever the portrait
  const right = numberIn(stacked, 'padding-right');
  assert.equal(right, 64);
  percents.filter(percent => rowLayout(percent).stacked).forEach(percent => {
    assert.ok(bodyWidth - Number(padding[2]) - right - rowSizes(percent).card - gap >= nameWidth, 'the name and the role have 560px beside the portrait at ' + percent);
  });
});

test('a stacked row holds the name and two lines of role inside it, and the last row stays inside the cut corner of the frame', () => {
  const css = read('base.css');
  const row = ruleOf(css, '.person-row');
  const lineOf = rule => Number(/\/(\d+)px var\(--font-/.exec(rule)[1]);
  const nameLine = lineOf(ruleOf(css, '.person-name'));
  const roleLine = lineOf(ruleOf(css, '.person-role'));
  const stackedRight = numberIn(ruleOf(css, '.person-rows.stacked .person-row'), 'padding-right');
  const rowRight = Number(/padding: 0 (\d+)px 0 \d+px;/.exec(row)[1]);
  const roleLines = Number(/-webkit-line-clamp: (\d+);/.exec(ruleOf(css, '.person-role'))[1]);

  assert.deepEqual([nameLine, roleLine, roleLines], [72, 48, 2], 'the name keeps its 72px line and the role its 48px lines, two at most');
  assert.equal(/font(-size)?:/.test(ruleOf(css, '.person-rows.stacked .person-name') + ruleOf(css, '.person-rows.stacked .person-role') + ruleOf(css, '.person-rows.stacked .person-row')), false, 'the stacked rows do not change a text size');

  // the cut corner of the large frame runs from (1148, 640) to (1068, 704)
  const cornerAt = y => (y <= 640 ? 1148 : 1148 - (y - 640) * 80 / 64);
  assert.ok(read('core/plate.js').includes('body: [[4, 120], [1148, 120], [1148, 640], [1068, 704], [4, 704]]'));

  percents.forEach(percent => {
    const layout = rowLayout(percent);
    const lastCentre = bodyTop + (layout.rows - 1) * layout.height + layout.height / 2;

    assert.ok(bodyTop + bodyHeight <= 704, 'the rows end above the foot of the frame');
    if (layout.stacked) {
      const pair = nameLine + roleLines * roleLine;
      assert.ok((layout.height - pair) / 2 >= 10, 'the name and two lines of role fit the row with the bar clear at ' + percent);
      assert.ok(bodyWidth - stackedRight <= cornerAt(lastCentre + pair / 2), 'the role in the last row stays inside the cut corner at ' + percent);
    } else if (layout.rows < 4) {
      assert.ok(bodyWidth - rowRight <= cornerAt(lastCentre + roleLines * roleLine / 2), 'the role in the last row stays inside the cut corner at ' + percent);
    }
  });
  // the number the stylesheet comment gives: the lowest line of a page of three rows ends at 688, where the corner is at 1088
  assert.equal(bodyTop + 2 * 192 + 96 + 84, 688);
  assert.equal(cornerAt(688), 1088);
});

// The screen keeps every line on one line (white-space: nowrap on #screen, inherited by everything), so a role
// beside a 17 character name, which leaves it 366px, was cut at the frame (DRIVE TEA) instead of taking the
// second line that the two line clamp and the comment promise. Found by rendering it.
test('the role beside a name takes a second line instead of being cut: its rule turns wrapping back on', () => {
  const css = read('base.css');
  assert.ok(/white-space: nowrap;/.test(ruleOf(css, '#screen')), 'the screen keeps lines whole, so a role has to ask for wrapping');
  assert.ok(/white-space: normal;/.test(ruleOf(css, '.person-role')), 'the role may wrap');
  assert.ok(/white-space: nowrap;/.test(ruleOf(css, '.person-name')), 'the name stays on one line and ends in three dots');
  assert.ok(/-webkit-line-clamp: 2;/.test(ruleOf(css, '.person-role')), 'at most two lines');
});

test('the stylesheet takes the height of a row and the place of the bar from one variable, which is 144px without it', () => {
  const css = read('base.css');
  assert.ok(/height: var\(--row-height, 144px\);/.test(ruleOf(css, '.person-row')));
  assert.ok(/top: calc\(var\(--row-height, 144px\) - 10px\);/.test(ruleOf(css, '.person-row .row-bar')), 'the bar stays on the foot of the row');
  assert.ok(ruleOf(css, '.person-rows').includes('height: 576px;'));
  assert.equal(/--row-height/.test(read('tokens.css')), false, 'only the rows set it');
});

test('the rows markup is the old markup up to 100, and above it has the height of a row, and the class stacked from 114', () => withFakePage(() => {
  const rows = [{ name: '[Alex]', role: 'CAPTAIN', address: 'https://example.test/a.jpg' }, { name: '[Sam]', role: 'COACH', address: '' }];

  [undefined, 60, 80, 100].forEach(percent => {
    const html = rowsMarkup(rows, percent);
    assert.ok(html.startsWith('<div class="person-rows">'), 'at ' + percent);
    assert.equal(html.includes('--row-height'), false, 'at ' + percent);
  });
  assert.ok(rowsMarkup(rows, 101).startsWith('<div class="person-rows" style="--row-height: 192px">'));
  assert.ok(rowsMarkup(rows, 113).startsWith('<div class="person-rows" style="--row-height: 192px">'));
  assert.ok(rowsMarkup(rows, 114).startsWith('<div class="person-rows stacked" style="--row-height: 192px">'));
  assert.ok(rowsMarkup(rows, 139).startsWith('<div class="person-rows stacked" style="--row-height: 192px">'));
  assert.ok(rowsMarkup(rows, 140).startsWith('<div class="person-rows stacked" style="--row-height: 288px">'));
  assert.ok(rowsMarkup(rows, 200).startsWith('<div class="person-rows stacked" style="--row-height: 288px">'));

  // the portrait and the picture follow the setting to 248 and 238 at double
  const at200 = rowsMarkup(rows, 200);
  assert.ok(at200.includes('--portrait-card: 248px; --portrait-photo: 238px; --portrait-inset: 5px'));
  assert.ok(at200.includes('<img src="https://example.test/a.jpg" width="238" height="238" alt="">'));
  assert.equal(rowsMarkup(rows, 500), at200, 'a setting past 200 is 200');

  // the rest is the same markup: the text, the bar and the metal do not depend on the size
  const withoutSizes = html => html
    .replace(/^<div class="person-rows( stacked)?"( style="--row-height: \d+px")?>/, '<div class="person-rows">')
    .replace(/ style="--portrait[^"]*"/g, '')
    .replace(/ width="\d+" height="\d+" alt=""/g, '');
  assert.equal(withoutSizes(at200), withoutSizes(rowsMarkup(rows, 100)));
  assert.equal(countOf(at200, 'class="row-bar"'), 1, 'a bar under every row but the last');
}));

// The Roster slot

test('the portrait of the Roster slot never grows past 100, and a smaller setting still makes it smaller', () => withFakePage(async () => {
  assert.deepEqual(portraitSizes(100), { card: 292, photo: 280, inset: 6 });
  [101, 150, 200, 500].forEach(percent => assert.deepEqual(portraitSizes(percent), portraitSizes(100), 'at ' + percent));
  assert.deepEqual(portraitSizes(60), { card: 175, photo: 167, inset: 4 });

  const slot = { name: '[Lead]', role: 'TEAM LEAD', address: '' };
  assert.equal(slotMarkup(Object.assign({ scale: 200 }, slot)), slotMarkup(Object.assign({ scale: 100 }, slot)));
  assert.notEqual(slotMarkup(Object.assign({ scale: 60 }, slot)), slotMarkup(Object.assign({ scale: 100 }, slot)));

  const roster = await freshPanel('roster');
  const data = settings => ({ people: [], subteams: [{ name: '[Build]', lead: '[Lead A]', members: ['[Alex]'] }], settings: settings });
  assert.equal(mount(roster, data({ portraitScale: 200 })), mount(await freshPanel('roster'), data({ portraitScale: 100 })));
  assert.ok(mount(await freshPanel('roster'), data({ portraitScale: 200 })).includes('--portrait-card: 292px; --portrait-photo: 280px; --portrait-inset: 6px'));
}));

// Paging

test('makePages takes the size at each turn, and a new size starts at the first item not shown yet', () => {
  const list = Array.from({ length: 10 }, (_, index) => index);
  const next = makePages(4);

  assert.deepEqual(next(list).items, [0, 1, 2, 3], 'a turn with no size uses the size it was made with');
  assert.deepEqual(next(list, 4).items, [4, 5, 6, 7]);
  const two = next(list, 2);
  assert.deepEqual([two.items, two.upcoming, two.number, two.count], [[8, 9], [0, 1], 5, 5], 'the new size goes on from the item after the last one shown');
  assert.deepEqual(next(list, 2).items, [0, 1], 'and the first page comes after the last');

  // after the last page, a new size starts again at the top, and does not land in the middle of the list
  const last = makePages(4);
  last(list, 4);
  last(list, 4);
  assert.deepEqual(last(list, 4).items, [8, 9]);
  assert.deepEqual(last(list, 2).items, [0, 1], 'the first page of the new size comes after the last page of the old');

  // a size that does not divide what was shown repeats an item rather than skipping one
  const repeat = makePages(4);
  repeat(list, 4);
  assert.deepEqual(repeat(list, 3).items, [3, 4, 5], 'items 0 to 3 were shown, so the pages of three begin at 3');
  const bigger = makePages(2);
  bigger(list, 2);
  bigger(list, 2);
  assert.deepEqual(bigger(list, 4).items, [4, 5, 6, 7], 'items 0 to 3 were shown, so the pages of four go on at 4');

  // one page has nothing upcoming, at any size
  assert.deepEqual(makePages(4)(list.slice(0, 2), 2).upcoming, []);
  assert.deepEqual(makePages(4)(list.slice(0, 2), 4).upcoming, []);
  assert.equal(makePages(4)([], 2).count, 1);
});

test('whatever sizes the turns ask for, a page begins no later than where the page before it ended, and the first page comes after the last', () => {
  let seed = 20240607;
  const random = limit => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % limit;
  };

  for (let trial = 0; trial < 2000; trial++) {
    const length = 1 + random(14);
    const list = Array.from({ length: length }, (_, index) => index);
    const next = makePages(4);
    let shownUpTo = -1;

    for (let turn = 0; turn < 24; turn++) {
      const size = 1 + random(4);
      const page = next(list, size);
      const begins = page.items[0];

      if (shownUpTo !== -1) {
        const where = 'length ' + length + ', turn ' + turn + ', size ' + size + ', page begins at ' + begins + ' after ' + shownUpTo;
        if (shownUpTo >= length) assert.equal(begins, 0, 'the first page comes after the last: ' + where);
        else assert.ok(begins <= shownUpTo, 'nobody is skipped: ' + where);
      }
      assert.ok(page.items.length >= 1 && page.items.length <= size, 'a page has at least one item and at most its size');
      shownUpTo = begins + page.items.length;
    }
  }
});

test('a list that grows or shrinks between turns, and a size that stays, count round as they always did', () => {
  const next = makePages(3);
  assert.deepEqual(next([1, 2, 3, 4, 5, 6, 7]).items, [1, 2, 3]);
  assert.deepEqual(next([1, 2, 3, 4, 5, 6, 7]).items, [4, 5, 6]);
  assert.deepEqual(next([1, 2, 3, 4]).items, [1, 2, 3], 'the list is shorter, so the pages are counted again');
  assert.deepEqual(next([1, 2, 3, 4], 3).items, [4]);
  assert.deepEqual(next([1, 2, 3, 4], 3).items, [1, 2, 3]);
});

// Leadership and Team Leads

// n people spread over the three roles, coaches first
function leadershipOf(count) {
  const coaches = Math.min(count, 2);
  const captains = Math.min(Math.max(count - 2, 0), 3);
  const mentors = Math.max(count - 5, 0);
  return [].concat(crew('Coach', coaches), crew('Captain', captains), crew('Mentor', mentors));
}

const settingsOf = percent => ({ portraitScale: percent });
const namesOf = list => list.map(item => item.name);

test('Leadership shows everyone at every setting: each visit is one page, and the visits together are the whole list in order', () => withFakePage(async () => {
  for (const percent of [undefined, 60, 100, 101, 113, 114, 120, 139, 140, 175, 200]) {
    for (let count = 1; count <= 9; count++) {
      const panel = await freshPanel('leadership');
      const people = leadershipOf(count);
      const data = { people: people, settings: percent === undefined ? undefined : settingsOf(percent) };
      const rows = percent === undefined ? 4 : rowLayout(percent).rows;
      const pages = Math.ceil(count / rows);
      const visits = [];

      for (let visit = 0; visit < pages + 1; visit++) visits.push(namesIn(mount(panel, data)));

      const where = count + ' people at ' + percent;
      assert.deepEqual([].concat(...visits.slice(0, pages)), namesOf(people), 'everyone is shown, once, in order: ' + where);
      visits.slice(0, pages).forEach((names, index) => assert.equal(names.length, index < pages - 1 ? rows : count - rows * (pages - 1), 'a full page, then the rest: ' + where));
      assert.deepEqual(visits[pages], visits[0], 'then the first page again: ' + where);
    }
  }
}));

test('four leaders are one page of four at 100, two pages of two at double, and three and one at 120, the double of the saved 60', () => withFakePage(async () => {
  const leaders = [].concat(crew('Coach', 2), crew('Captain', 2));
  const run = async percent => {
    const panel = await freshPanel('leadership');
    const data = { people: leaders, settings: settingsOf(percent) };
    return [mount(panel, data), mount(panel, data), mount(panel, data)];
  };

  const at100 = await run(100);
  assert.deepEqual(at100.map(namesIn), [namesOf(leaders), namesOf(leaders), namesOf(leaders)]);
  assert.ok(at100[0].includes('<section class="page leadership">') && at100[0].includes('<div class="person-rows">'));

  const at200 = await run(200);
  assert.deepEqual(at200.map(namesIn), [['[Coach 1]', '[Coach 2]'], ['[Captain 1]', '[Captain 2]'], ['[Coach 1]', '[Coach 2]']]);
  at200.forEach(html => assert.ok(html.includes('<div class="person-rows stacked" style="--row-height: 288px">')));
  assert.equal(countOf(at200[0], 'class="row-bar"'), 1);

  const at120 = await run(120);
  assert.deepEqual(at120.map(namesIn), [['[Coach 1]', '[Coach 2]', '[Captain 1]'], ['[Captain 2]'], ['[Coach 1]', '[Coach 2]', '[Captain 1]']]);
  assert.ok(at120[0].includes('<div class="person-rows stacked" style="--row-height: 192px">'));
  assert.equal(countOf(at120[0], 'class="row-bar"'), 2);
  assert.equal(countOf(at120[1], 'class="row-bar"'), 0);
}));

test('Team Leads shows every department at every setting, and twelve of them are three pages of four at 100 and six of two at 200', () => withFakePage(async () => {
  for (const percent of [undefined, 60, 100, 101, 114, 120, 140, 200]) {
    for (const count of [1, 3, 4, 5, 9, 12]) {
      const panel = await freshPanel('team-leads');
      const subteams = departments(count);
      const data = { subteams: subteams, people: [], settings: percent === undefined ? undefined : settingsOf(percent) };
      const rows = percent === undefined ? 4 : rowLayout(percent).rows;
      const pages = Math.ceil(count / rows);
      const visits = [];

      for (let visit = 0; visit < pages + 1; visit++) visits.push(namesIn(mount(panel, data)));

      const where = count + ' departments at ' + percent;
      assert.deepEqual([].concat(...visits.slice(0, pages)), subteams.map(subteam => subteam.lead), 'everyone is shown, once, in order: ' + where);
      assert.deepEqual(visits[pages], visits[0], 'then the first page again: ' + where);
    }
  }

  const sizes = async percent => {
    const panel = await freshPanel('team-leads');
    const data = { subteams: departments(12), people: [], settings: settingsOf(percent) };
    const visits = [];
    for (let visit = 0; visit < 8; visit++) visits.push(namesIn(mount(panel, data)).length);
    return visits;
  };
  assert.deepEqual(await sizes(100), [4, 4, 4, 4, 4, 4, 4, 4]);
  assert.deepEqual(await sizes(120), [3, 3, 3, 3, 3, 3, 3, 3]);
  assert.deepEqual(await sizes(200), [2, 2, 2, 2, 2, 2, 2, 2]);
}));

test('a change of the setting between visits never skips a person, on Leadership or on Team Leads', () => withFakePage(async () => {
  const settings = [100, 200, 200, 100, 120, 60, 200, 140, 100, 100, 113, 200, 200, 200, 114];

  for (const [name, data, namesOfPanel, everyone] of [
    ['leadership', { people: leadershipOf(8) }, namesIn, namesOf(leadershipOf(8))],
    ['team-leads', { subteams: departments(11), people: [] }, namesIn, departments(11).map(subteam => subteam.lead)],
  ]) {
    const panel = await freshPanel(name);
    let shownUpTo = -1;
    const seen = [];

    settings.forEach((percent, visit) => {
      const names = namesOfPanel(mount(panel, Object.assign({ settings: settingsOf(percent) }, data)));
      const begins = everyone.indexOf(names[0]);
      const where = name + ', visit ' + (visit + 1) + ' at ' + percent + ', page begins at ' + begins + ' after ' + shownUpTo;

      assert.ok(names.length >= 1 && names.length <= rowLayout(percent).rows, 'a page fits the setting: ' + where);
      assert.deepEqual(names, everyone.slice(begins, begins + names.length), 'a page is a run of the list: ' + where);
      if (shownUpTo >= everyone.length) assert.equal(begins, 0, 'the first page comes after the last: ' + where);
      else if (shownUpTo !== -1) assert.ok(begins <= shownUpTo, 'nobody is skipped: ' + where);
      shownUpTo = begins + names.length;
      names.forEach(each => seen.indexOf(each) === -1 && seen.push(each));
    });
    assert.deepEqual(seen.slice().sort(), everyone.slice().sort(), name + ': everyone was shown');
  }
}));

test('a panel with no settings at all pages by four, as it always did, and the people it cannot show on one page come on the next', () => withFakePage(async () => {
  const panel = await freshPanel('leadership');
  const data = { people: leadershipOf(6) };
  assert.deepEqual(namesIn(mount(panel, data)), ['[Coach 1]', '[Coach 2]', '[Captain 1]', '[Captain 2]']);
  assert.deepEqual(namesIn(mount(panel, data)), ['[Captain 3]', '[Mentor 1]']);
  assert.deepEqual(namesIn(mount(panel, data)), ['[Coach 1]', '[Coach 2]', '[Captain 1]', '[Captain 2]']);
}));

test('Leadership asks for the photos of the next page early, and a single page asks for nothing', () => withFakePage(() => withFakeImages(async asked => {
  const people = leadershipOf(4).map((person, index) => Object.assign({}, person, { photo: images.tidyPhoto(photoRecord(index)), showPhoto: true }));
  const address = person => portrait.photoAddress(person);

  const two = await freshPanel('leadership');
  mount(two, { people: people, settings: settingsOf(200) });
  assert.deepEqual(asked, [address(people[2]), address(people[3])], 'the second page of two is asked for');

  asked.length = 0;
  const one = await freshPanel('leadership');
  mount(one, { people: people, settings: settingsOf(100) });
  assert.deepEqual(asked, [], 'one page has no next page');
})));

// The words

test('the Leadership and Team Leads panels page with the same machinery, from the size the setting gives, and neither cuts a list', () => {
  const lead = read('panels/leadership/leadership.js');
  const teamLeads = read('panels/team-leads/team-leads.js');
  [lead, teamLeads].forEach(code => {
    assert.ok(code.includes('const nextPage = makePages(rowsPerPage);'));
    assert.ok(/nextPage\(.*rowLayout\(scale\)\.rows\)/.test(code), 'the size of the page comes from the setting at each turn');
  });
  assert.equal(/\.slice\(0,/.test(read('core/leadership.js')), false, 'leaders does not cut the list');
  assert.equal(/import \{[^}]*rowsPerPage[^}]*\} from '.\/portrait.js'/.test(read('core/leadership.js')), false);
  assert.ok(read('registry.js').includes("{ id: 'leadership', region: 'grid1', topic: 'people' },"), 'the registry has no fixed page count for the panel, as for Team Leads');
  assert.ok(read('registry.js').includes("{ id: 'team-leads', region: 'grid1', topic: 'subteams' },"));
});

test('the docs give the rows a page holds and the sizes the code works out', () => {
  const text = fs.readFileSync(path.join(docsFolder, 'editing-content.md'), 'utf8');
  const start = text.indexOf('Portrait size, percent is how big');
  const section = text.slice(start, text.indexOf('Photo size, percent is how big', start));

  assert.ok(start > 0 && section.length > 0, 'the Portrait size item is in the Photos part');
  ['whole number from 60 to 200', '100 is the standard size', '200 is double', 'Subteam roster', 'taller', '3 rows', '2 rows', '248', '74', '120'].forEach(piece => {
    assert.ok(section.replace(/\s+/g, ' ').includes(piece), 'the Portrait size item does not say ' + piece);
  });
  assert.equal(/whole\s+number from 60 to 100/.test(section), false, 'the Portrait size item still gives the old range');

  // every row of the table is what rowLayout and rowSizes give for every size in its range, and the ranges meet
  const table = section.split('\n').filter(line => /^\s*\| \d+ to \d+ \|/.test(line)).map(line => line.split('|').map(cell => cell.trim()).filter(cell => cell !== ''));
  assert.equal(table.length, 4);
  let next = 60;
  table.forEach(([range, rows, height, card, role]) => {
    const [from, to] = range.split(' to ').map(Number);
    const [cardFrom, cardTo] = card.split(' to ').map(Number);

    assert.equal(from, next, 'the ranges of the table meet');
    next = to + 1;
    for (let percent = from; percent <= to; percent++) {
      assert.deepEqual(rowLayout(percent), { rows: Number(rows), height: Number(height), stacked: role === 'under the name' }, range + ' at ' + percent);
    }
    assert.deepEqual([rowSizes(from).card, rowSizes(to).card], [cardFrom, cardTo], 'the portrait in a row for ' + range);
  });
  assert.equal(next, 201, 'the table goes up to 200');

  // the words of the Studio field give the same two changes of the table
  const field = fs.readFileSync(path.join(docsFolder, '..', 'studio', 'schemas', 'settingsPhotos.js'), 'utf8');
  assert.ok(field.includes('holds 3 rows (to ' + table[2][0].split(' to ')[1] + ') or 2 (from ' + table[3][0].split(' to ')[0] + ')'), 'the description in Studio gives the table\'s changes');
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
