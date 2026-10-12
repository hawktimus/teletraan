// Tests for the Role on the Leadership rows (dashboard/core/leadership.js, panels/leadership and the
// rows in core/portrait.js and base.css): the Role is the chip at the right end, in capitals, there is no
// second line under the name, the typed line is the only text under it and only on a page of three rows
// or fewer, and every picture has the panel's own frame. The panel is run against a fake page that
// records what it draws. The stylesheet is checked by reading it, because the sizes need a browser to be seen.
//
//   node tools/test-leadership-role.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-role-'));
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
fs.mkdirSync(path.join(root, 'panels/leadership'), { recursive: true });
fs.copyFileSync(path.join(dashboardFolder, 'panels/leadership/leadership.js'), path.join(root, 'panels/leadership/leadership.js'));

const base = pathToFileURL(root).href + '/';
const leadership = await import(base + 'core/leadership.js');
const sanity = await import(base + 'core/sanity.js');
const textWidth = (await import(base + 'core/text-width.js')).textWidth;
const { chipOf, leaders } = leadership;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const countOf = (text, piece) => text.split(piece).length - 1;
const sample = () => sanity.normalizeSample(JSON.parse(fs.readFileSync(sampleFile, 'utf8')));

// plate.js draws each card shape once into a hidden group of the page. This stands in for the page.
async function withFakePage(run) {
  const drawn = [];
  globalThis.document = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => drawn.push(markup.match(/id="([^"]+)"/)[1]) };
      return drawn.includes(id) ? {} : null;
    },
  };

  try {
    await run();
  } finally {
    delete globalThis.document;
  }
}

// A panel keeps the page it showed last, so each page is drawn by a copy of its own
let copies = 0;
async function mount(people, settings) {
  copies += 1;
  const panel = await import(base + 'panels/leadership/leadership.js?copy=' + copies);
  const host = { innerHTML: '', querySelectorAll: () => [] };
  panel.mount(host, { people: people, settings: settings });
  return host.innerHTML;
}

const textsOf = (html, name) => Array.from(html.matchAll(new RegExp('<div class="person-' + name + '">([^<]*)</div>', 'g'))).map(match => match[1]);

function person(role, name, more) {
  return Object.assign({ role: role, name: name }, more);
}

// The rule of a selector in a stylesheet, or '' when there is none
function ruleOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|[}\\s])' + escaped + '\\s*\\{([^}]*)\\}').exec(css);
  return found ? found[1] : '';
}

// How many lines a chip of this text takes in a box of this inner width, breaking at spaces and, for a word
// that is wider than the box, anywhere
function chipLines(text, inner) {
  let lines = 1;
  let used = 0;
  text.split(' ').forEach(word => {
    const width = textWidth(word, 700, 44);
    const space = used === 0 ? 0 : textWidth(' ', 700, 44);

    if (used + space + width <= inner) {
      used += space + width;
      return;
    }
    if (used > 0) lines += 1;
    const extra = Math.max(Math.ceil(width / inner) - 1, 0);
    lines += extra;
    used = width - extra * inner;
  });
  return lines;
}

test('a leader with the Role Co-President has the chip CO-PRESIDENT and no second line', () => withFakePage(async () => {
  const html = await mount([person('Captain', '[Dillon]', { title: 'Co-President' })]);

  assert.deepEqual(textsOf(html, 'chip'), ['CO-PRESIDENT']);
  assert.deepEqual(textsOf(html, 'name'), ['[Dillon]']);
  assert.deepEqual(textsOf(html, 'role'), [''], 'the role line is empty');
  assert.equal(html.includes('CAPTAIN'), false, 'the role of the group is not shown anywhere');
  assert.ok(ruleOf(read('base.css'), '.person-name:empty,\n.person-role:empty,\n.person-line:empty,\n.person-chip:empty').includes('display: none;'), 'an empty line takes no room');
}));

test('the Role is shown in capitals and trimmed, and a person with no Role shows the role of the group', () => withFakePage(async () => {
  const html = await mount([
    person('Coach', '[A]', { title: 'Head Coach' }),
    person('Captain', '[B]', { title: '  Co-President ' }),
    person('Mentor', '[C]', { title: 'parent' }),
    person('Mentor', '[D]'),
  ]);

  assert.deepEqual(textsOf(html, 'chip'), ['HEAD COACH', 'CO-PRESIDENT', 'PARENT', 'MENTOR']);
  assert.equal(chipOf({ role: 'Mentor', title: 'Parent', group: 'COACH' }), 'PARENT', 'the old group is not read');
}));

test('the line is the only text under the name, on pages of three rows or fewer, and a page of four rows is the name and the chip', () => withFakePage(async () => {
  const people = [
    person('Coach', '[A]', { title: 'Coach', line: '[Since 2019]' }),
    person('Captain', '[B]', { title: 'Co-President', line: '  [Junior]  ' }),
    person('Mentor', '[C]', { title: 'Parent' }),
    person('Mentor', '[D]', { title: 'Mentor', line: '[Alumni]' }),
  ];
  const css = read('base.css');

  // 100 percent is four rows: the line is drawn but the stylesheet leaves it out
  const four = await mount(people);
  assert.ok(four.includes('<div class="person-rows rows-4">'));
  assert.deepEqual(textsOf(four, 'role'), ['', '', '', '']);
  assert.ok(/display: none;/.test(ruleOf(css, '.person-rows.rows-4 .person-line')), 'four rows have no line');

  // three rows, two rows and one row show it
  for (const [percent, count] of [[101, 3], [150, 2], [210, 1]]) {
    const html = await mount(people, { leadershipPortrait: percent });
    assert.ok(html.includes('class="person-rows rows-' + count + '"'), percent + ' percent is ' + count + ' rows');
    assert.deepEqual(textsOf(html, 'role'), people.slice(0, count).map(() => ''), 'no role line at ' + count + ' rows');
    assert.deepEqual(textsOf(html, 'line'), ['[Since 2019]', '[Junior]', ''].slice(0, count), 'the typed line at ' + count + ' rows');
    assert.equal(ruleOf(css, '.person-rows.rows-' + count + ' .person-line'), '', count + ' rows do not hide the line');
  }
}));

test('every picture has the frame of the panel, whatever the role, and the rows keep the order of role and then Order', () => withFakePage(async () => {
  const people = [
    person('Mentor', '[M]', { title: 'Parent', order: 1 }),
    person('Captain', '[C]', { title: 'Co-President', order: 2 }),
    person('Coach', '[K]', { title: 'Head Coach', order: 9 }),
    person('Coach', '[L]', { title: 'Coach', order: 3 }),
  ];
  const sorted = sanity.normalizeContent({ people: people }).people;
  const html = await mount(sorted);

  assert.equal(countOf(html, 'red-metal'), 0);
  assert.equal(countOf(html, 'data-metal'), 0);
  assert.equal(countOf(html, '<div class="portrait" style='), 4, 'four plain portraits');
  assert.equal(/roleMetals|metal:/.test(read('panels/leadership/leadership.js')), false, 'the panel has no metal for a role');

  assert.deepEqual(leaders(sorted).map(item => item.name), ['[L]', '[K]', '[C]', '[M]']);
  assert.deepEqual(textsOf(html, 'name'), ['[L]', '[K]', '[C]', '[M]']);
}));

test('the sample people have a Role each, with a Mentor and a Parent, and no second line', () => withFakePage(async () => {
  const people = sample().people;

  assert.equal(people.every(item => typeof item.title === 'string' && item.title.length > 0 && item.title.length <= 22), true);
  assert.ok(people.some(item => item.title === 'Mentor') && people.some(item => item.title === 'Parent'));
  assert.deepEqual(textsOf(await mount(people), 'chip'), ['HEAD COACH', 'COACH', 'CO-PRESIDENT', 'CAPTAIN']);
  assert.equal(textsOf(await mount(people, { leadershipPortrait: 138 }), 'chip').length, 3);
  assert.deepEqual(textsOf(await mount(people.slice(4)), 'chip'), ['MENTOR', 'PARENT']);
}));

test('the chip is 44px with 14px each side, up to 400px wide, and a longer Role takes a second line, so 22 characters fit', () => {
  const css = read('base.css');
  const chip = ruleOf(css, '.person-chip');
  const inner = 400 - 2 * 14;

  assert.ok(/box-sizing: border-box;/.test(chip) && /max-width: 400px;/.test(chip) && /white-space: normal;/.test(chip) && /overflow-wrap: anywhere;/.test(chip) && /text-align: center;/.test(chip));
  assert.ok(/font: 700 var\(--size-label\)\/52px var\(--font-display\);/.test(chip), 'the text is 44px with a line of 52');

  assert.equal(chipLines('CO-PRESIDENT', inner), 1, 'the Role of the order is one line');
  ['HEAD COACH', 'COACH', 'MENTOR', 'PARENT', 'CAPTAIN', 'CO-CAPTAIN'].forEach(role => assert.equal(chipLines(role, inner), 1, role));
  // 22 characters of ordinary words are at most two lines. Two lines of 52 are 104, which fit the shortest
  // row of a page of four, 144 less its 2px rule, and leave the name its 516px
  ['ASSISTANT HEAD COACH', 'ALUMNI AND PARENT', 'ELECTRICAL TEAM LEAD', 'BUSINESS TEAM CO-LEAD', 'COMMUNICATIONS MENTORS'].forEach(role => {
    assert.ok(role.length <= 22 && chipLines(role, inner) <= 2, role + ' is two lines at most');
  });
  assert.ok(2 * 52 <= 144 - 2);
  assert.ok(1152 - 28 - 40 - 120 - 2 * 24 - 400 >= 516, 'the name has 516px beside the widest chip');
});

test('a chip of two lines in the last row stays inside the cut corner of the large frame on every page', () => {
  const css = read('base.css');
  const right = Number(/padding-right: (\d+)px;/.exec(ruleOf(css, '.person-row:last-child'))[1]);
  const cornerAt = y => (y <= 640 ? 1148 : 1148 - (y - 640) * 80 / 64);

  [4, 3, 2, 1].forEach(count => {
    const height = 576 / count;
    const centre = 124 + (count - 1) * height + height / 2;
    assert.ok(1152 - right <= cornerAt(centre + 104 / 2), 'the chip of two lines in the last row of ' + count + ' rows');
  });
});

test('the panel and the rows keep no group, no role metal and no animation code', () => {
  const code = read('panels/leadership/leadership.js');
  const core = read('core/leadership.js');

  assert.equal(/groupOf|groupNames|roleMetals/.test(code + core), false);
  assert.ok(code.includes('chipOf(person)') && code.includes("role: ''"));
  assert.equal(/setTimeout|setInterval|requestAnimationFrame|animate\(/.test(code), false);
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
