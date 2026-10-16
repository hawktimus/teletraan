// Tests for the scroll of the Events panel (panels/events, core/event-pages.js, core/schedule.js and frame.js,
// scrollCard): the panel draws the events of both pages in one list, holds the first four, scrolls up by four rows
// and holds the next four, in one step of the Screen. Eight events are two pages, five are a page of four and a page
// of one, and four or fewer are one page with no scroll. The same holds when Group events by kind is on, with the pinned
// events, and in calm and none the list moves at once. The order and the kinds of the events are in
// tests/event-pages.test.mjs. frame.js and core/schedule.js are run with stand-ins for the page, and the stylesheets
// are checked by reading them, because the sizes need a browser to be seen.
//
//   node tests/events-scroll.test.mjs
//
// What it looks like is checked by looking at the screen (docs/editing-content.md, "The two pages of the Events panel").

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
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-events-scroll-'));
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
fs.mkdirSync(path.join(root, 'panels/events'), { recursive: true });
fs.copyFileSync(path.join(dashboardFolder, 'panels/events/panel.js'), path.join(root, 'panels/events/panel.js'));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const registry = await import(base + 'registry.js');
const pages = await import(base + 'core/event-pages.js');
const eventsModule = await import(base + 'core/events.js');
const panelOrder = await import(base + 'core/panel-order.js');
const eventsPanel = await import(base + 'panels/events/panel.js');

const { eventsPerPage, shownPages } = pages;
const { mergeEvents } = eventsModule;
const { withPages } = panelOrder;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const countOf = (text, piece) => text.split(piece).length - 1;
const hour = 3600 * 1000;
const day = 24 * hour;
const zone = 'America/New_York';
const now = new Date();

// A timed event of one hour that starts this many days from now, in the calendar with this code. The title says the number.
function band(number, daysAhead, calendarId) {
  const start = new Date(now.getTime() + daysAhead * day + 2 * hour);
  return { title: 'Event ' + number, start: start, end: new Date(start.getTime() + hour), allDay: false, location: '', calendarId: calendarId || 'meetings' };
}

const calendarRows = [
  { id: 'meetings', name: '[Meetings]', show: true, kind: 'meetings' },
  { id: 'competitions', name: '[Competitions]', show: true, kind: 'competitions' },
  { id: 'outreach', name: '[Outreach]', show: true, kind: 'outreach' },
  { id: 'deadlines', name: '[Deadlines]', show: true, kind: 'deadlines' },
];

// The content the panel gets: the events the way the screen merges them, after the rules
function contentFor(events, more) {
  const extra = more || {};
  const rules = extra.rules || [];
  return {
    theme: { timeZone: zone },
    settings: Object.assign({ calendars: calendarRows, groupEventsByKind: false }, extra.settings),
    calendarFilters: rules,
    events: mergeEvents(events, zone, now, rules),
  };
}

// Events 1 to count, a day apart, in the calendar with this code
function inOrder(count, calendarId) {
  const list = [];
  for (let number = 1; number <= count; number++) list.push(band(number, number, calendarId));
  return list;
}

// events.js draws each row bar with a shape that plate.js puts in the page once. This stands in for the page.
function drawn(content) {
  const known = [];
  globalThis.document = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => known.push(markup.match(/id="([^"]+)"/)[1]) };
      return known.includes(id) ? {} : null;
    },
  };

  try {
    const host = { innerHTML: '' };
    eventsPanel.mount(host, content);
    return host.innerHTML;
  } finally {
    delete globalThis.document;
  }
}

const titlesIn = html => Array.from(html.matchAll(/<span class="event-name">([^<]*)<\/span>/g)).map(match => match[1]);
// The places of the list, in order: an event is a row and an empty place is a row-blank
const placesIn = html => Array.from(html.matchAll(/<div class="row(?: (row-blank))?"/g)).map(match => (match[1] ? 'blank' : 'event'));

// A rule of a selector in a stylesheet, or '' when there is none
function ruleOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|[}\\s])' + escaped + '\\s*\\{([^}]*)\\}').exec(css);
  return found ? found[1] : '';
}
const pixels = (rule, property) => Number(new RegExp('(?:^|[;\\s])' + property + ':\\s*(\\d+)px').exec(rule)[1]);


// The pages of the list

test('eight events are two scroll pages of four, five are a page of four and a page of one, and four or fewer are one page that does not scroll', () => {
  const expected = { 0: [], 1: [1], 3: [3], 4: [4], 5: [4, 1], 7: [4, 3], 8: [4, 4], 12: [4, 4] };

  Object.keys(expected).forEach(count => {
    const content = contentFor(inOrder(Number(count)));
    assert.deepEqual(shownPages(content, now).map(rows => rows.length), expected[count], count + ' events');
    assert.equal(eventsPanel.scrollPages(content), Math.max(1, expected[count].length), count + ' events: the pages the panel is held for');
    assert.equal(eventsPanel.hasContent(content), expected[count].length > 0, count + ' events: content');
  });
  assert.equal(eventsPerPage, 4);
  assert.equal(eventsPanel.scrollPages({}), 1, 'a screen with no events and no settings yet');
});

test('the list has the events of both pages in order, one under the other, and the second page starts at the fifth place', () => {
  const eight = drawn(contentFor(inOrder(8)));
  assert.deepEqual(titlesIn(eight), ['Event 1', 'Event 2', 'Event 3', 'Event 4', 'Event 5', 'Event 6', 'Event 7', 'Event 8']);
  assert.deepEqual(placesIn(eight), Array(8).fill('event'));
  assert.equal(countOf(eight, 'data-scroll-list'), 1, 'one list, which frame.js moves');
  assert.ok(eight.indexOf('data-scroll-list') < eight.indexOf('class="row"'), 'the rows are in it');
  assert.ok(eight.indexOf('class="header"') < eight.indexOf('data-scroll-list'), 'and the header is not');

  const five = drawn(contentFor(inOrder(5)));
  assert.deepEqual(titlesIn(five), ['Event 1', 'Event 2', 'Event 3', 'Event 4', 'Event 5']);
  assert.deepEqual(placesIn(five), Array(5).fill('event'), 'the last page is not filled up');

  const four = drawn(contentFor(inOrder(4)));
  assert.deepEqual(placesIn(four), Array(4).fill('event'));
  assert.equal(countOf(four, 'class="row-bar"'), 3, 'four events are drawn as they always were: a bar under every row but the last');
});

test('with Group events by kind on the first page is the meetings, deadlines and other events, the second the competitions and outreach events, and a short first page is filled up so the second starts at the fifth place', () => {
  const settings = { groupEventsByKind: true };
  const full = contentFor([band(1, 1, 'meetings'), band(2, 2, 'deadlines'), band(3, 3, 'meetings'), band(4, 4, 'meetings'), band(5, 5, 'competitions'), band(6, 6, 'outreach'), band(7, 7, 'competitions')], { settings: settings });
  const html = drawn(full);

  assert.deepEqual(shownPages(full, now).map(rows => rows.map(row => row.kind)), [['meetings', 'deadlines', 'meetings', 'meetings'], ['competitions', 'outreach', 'competitions']]);
  assert.deepEqual(titlesIn(html), ['Event 1', 'Event 2', 'Event 3', 'Event 4', 'Event 5', 'Event 6', 'Event 7']);
  assert.equal(eventsPanel.scrollPages(full), 2);

  const short = contentFor([band(1, 1, 'meetings'), band(2, 2, 'deadlines'), band(3, 3, 'competitions'), band(4, 4, 'outreach')], { settings: settings });
  const shortHtml = drawn(short);
  assert.deepEqual(placesIn(shortHtml), ['event', 'event', 'blank', 'blank', 'event', 'event'], 'two events, two empty places, then the two of the second page');
  assert.deepEqual(titlesIn(shortHtml), ['Event 1', 'Event 2', 'Event 3', 'Event 4']);
  assert.equal(countOf(shortHtml, 'class="row-bar"'), 3, 'a bar under the two events of the first page, which have an empty place after them, and under the first of the second, and none under the last');
  assert.equal(eventsPanel.scrollPages(short), 2);

  const onlyOutreach = contentFor([band(1, 1, 'outreach'), band(2, 2, 'competitions')], { settings: settings });
  assert.equal(eventsPanel.scrollPages(onlyOutreach), 1, 'with no meeting there is one page and the list does not scroll');
  assert.deepEqual(placesIn(drawn(onlyOutreach)), ['event', 'event'], 'and it is at the top');
});

test('pinned events are on the first page, and the second page starts one event later for each pin', () => {
  const pin = words => ({ name: '[Rule]', action: 'show', words: [].concat(words), days: [], calendar: '', fromDate: '', toDate: '', force: true });
  const content = contentFor(inOrder(10), { rules: [pin('Event 10')] });
  const html = drawn(content);

  assert.deepEqual(shownPages(content, now).map(rows => rows.map(row => row.event.title)), [['Event 10', 'Event 1', 'Event 2', 'Event 3'], ['Event 4', 'Event 5', 'Event 6', 'Event 7']]);
  assert.deepEqual(titlesIn(html), ['Event 10', 'Event 1', 'Event 2', 'Event 3', 'Event 4', 'Event 5', 'Event 6', 'Event 7']);
  assert.equal(countOf(html, 'class="pin-mark"'), 1);
  assert.ok(html.indexOf('class="pin-mark"') < html.indexOf('class="event-name">Event 4'), 'the pin is on the first page');
  assert.equal(eventsPanel.scrollPages(content), 2);
});

test('a bar is under every row but the fourth of a page and the last of the list, so the frame is at the foot of the window and nothing is under the last row', () => {
  const html = drawn(contentFor(inOrder(8)));
  const rows = html.split('class="row" data-slat="item"').slice(1);

  assert.equal(rows.length, 8);
  rows.forEach((row, index) => assert.equal(row.includes('class="row-bar"'), index % 4 !== 3, 'row ' + (index + 1)));
  assert.equal(countOf(html, 'data-slat="item"'), 8, 'every row is a slat, and the empty places are not');
});


// The window, the step and the stylesheets

test('the rows are a window of four rows and the list moves up by the height of the window: 576 for rows of 144, and 528 in Cybertron for rows of 132', () => {
  const css = read('panels/events/panel.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const cybertron = read('styles/cybertron.css').replace(/\/\*[\s\S]*?\*\//g, '');

  const windowRule = ruleOf(css, '.events .rows');
  const row = pixels(ruleOf(css, '.events .row'), 'height');
  assert.equal(pixels(windowRule, 'height'), 4 * row, 'the window is four rows');
  assert.ok(/overflow:\s*hidden;/.test(windowRule), 'and the rows under it are not seen');
  assert.equal(pixels(ruleOf(css, '.events'), '--scroll-step'), pixels(windowRule, 'height'), 'the step is the window, so the next four rows start at the top of it');
  assert.equal(pixels(ruleOf(css, '.events'), '--scroll-step'), 576);

  const cybertronRow = pixels(ruleOf(cybertron, 'html[data-style="cybertron"] .events .row'), 'height');
  const cybertronWindow = pixels(ruleOf(cybertron, 'html[data-style="cybertron"] .events .rows'), 'height');
  assert.equal(cybertronWindow, 4 * cybertronRow);
  assert.equal(pixels(ruleOf(cybertron, 'html[data-style="cybertron"] .events'), '--scroll-step'), cybertronWindow, 'Cybertron has its own step, because its window is shorter');
  assert.equal(cybertronWindow, 528);

  // the style sheets that restyle the rows of the Events panel are these two and no other
  const others = ['original.css', 'minimal.css'].filter(file => /\.events\b/.test(read('styles/' + file)));
  assert.deepEqual(others, [], 'Original and Minimal use the rows of panels/events/panel.css');
  ['layouts', 'themes'].forEach(folder => fs.readdirSync(path.join(dashboardFolder, folder)).filter(file => file.endsWith('.css')).forEach(file => {
    assert.equal(/\.events\b/.test(read(folder + '/' + file)), false, folder + '/' + file + ' has no rule for the Events panel');
  }));
});

test('the row at the foot of a page keeps clear of the cut corner, on the fourth and the eighth row, and nothing moves in the stylesheet or the panel script', () => {
  const css = read('panels/events/panel.css').replace(/\/\*[\s\S]*?\*\//g, '');

  assert.equal(ruleOf(css, '.events .row:nth-child(4n)').includes('padding-right: 88px;'), true);
  assert.equal(ruleOf(css, '.events .row:nth-child(4)'), '', 'the rule is not for the fourth row only');
  ['animation', 'transition', 'transform', 'box-shadow', 'text-shadow', 'filter', 'blur'].forEach(word => assert.equal(css.includes(word), false, word));

  const script = read('panels/events/panel.js') + read('core/event-pages.js');
  ['animate', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'style.transform', 'scrollCard(', 'style='].forEach(word => assert.equal(script.includes(word), false, word));

  const frameCss = read('frame.css');
  assert.ok(/\[data-scroll-list\] \{\s*transform: translateY\(calc\(var\(--scroll-page, 0\) \* var\(--scroll-step, 0px\) \* -1\)\);\s*\}/.test(frameCss), 'the move is in frame.css, where the Monday cards have it');
});

test('the Events panel has no pages in the registry and no step for a second page, and it is still one row in the Screens and in the Panel order', () => {
  const events = registry.panels.filter(panel => panel.id === 'events')[0];
  assert.equal(events.pages, undefined);
  assert.equal(events.region, 'grid1');
  assert.equal(events.topic, 'events');

  const steps = withPages([{ panel: 'events', show: true, seconds: 12, row: 3 }]);
  assert.deepEqual(steps, [{ panel: 'events', show: true, seconds: 12, row: 3 }]);
  assert.equal(panelOrder.playlistOf(config.defaultSettings.rotation, 'grid1').filter(step => step.panel === 'events').length, 1, 'one row in Panel order');
});


// frame.js: the move in each motion

// frame.js with a fake page and a fake list that records the animation it is given
async function withFrame(motion, run) {
  const real = globalThis.document;
  globalThis.document = { documentElement: { dataset: {}, style: { setProperty: () => {} } }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };

  try {
    const frame = await import(base + 'frame.js?motion=' + motion);
    frame.setMotion(motion);
    await run(frame);
  } finally {
    globalThis.document = real;
  }
}

function fakeCard(animate) {
  const properties = {};
  const list = { animate: animate };
  return { dataset: {}, style: { setProperty: (name, value) => { properties[name] = value; } }, querySelector: selector => (selector === '[data-scroll-list]' ? list : null), properties: properties };
}

test('in full motion the list moves up by one step in 600 ms, scaled by the Speed setting, with the easing of the slats and the transform only', async () => {
  await withFrame('full', frame => {
    const played = [];
    const card = fakeCard((keyframes, options) => played.push({ keyframes: keyframes, options: options }));

    frame.scrollCard(card, 1);
    assert.equal(card.properties['--scroll-page'], '1');
    assert.equal(played.length, 1);
    assert.deepEqual(played[0].options, { duration: 600, easing: 'cubic-bezier(.5, 0, .2, 1)' });
    assert.deepEqual(played[0].keyframes.map(keyframe => Object.keys(keyframe)), [['transform'], ['transform']]);
    assert.ok(played[0].keyframes[0].transform.startsWith('translateY(calc(0 * var(--scroll-step') && played[0].keyframes[1].transform.startsWith('translateY(calc(1 * var(--scroll-step'));

    frame.setSpeed('slow');
    frame.scrollCard(card, 0);
    assert.equal(played[1].options.duration, 900, 'slow is one and a half times as long');
    frame.setSpeed('fast');
    frame.scrollCard(card, 1);
    assert.equal(played[2].options.duration, 450, 'and fast is three quarters');
    frame.setSpeed('normal');
  });
});

test('in calm and none motion the list is at its place at once and nothing is animated', async () => {
  for (const motion of ['calm', 'none']) {
    await withFrame(motion, frame => {
      const played = [];
      const card = fakeCard(() => played.push('animated'));

      frame.scrollCard(card, 1);
      assert.deepEqual([card.properties['--scroll-page'], card.dataset.scrollPage, played.length], ['1', '2', 0], motion + ': the second page is in place, and the list is not animated');
    });
  }
});


// core/schedule.js, with stand-ins for the page. The waits are held by the test, which lets them go a quarter of a
// second at a time, so a page that stays 20 seconds takes no time to pass.

const scheduleTree = path.join(workFolder, 'schedule-tree');
['config.js', 'core/schedule.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(scheduleTree, 'dashboard', file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(scheduleTree, 'dashboard', file));
});
fs.writeFileSync(path.join(scheduleTree, 'package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/frame.js'), [
  'export const pace = () => globalThis.scheduleWorld.pace;',
  'export const turnMs = () => globalThis.scheduleWorld.turn;',
  'export const isPaused = () => false;',
  'export const wait = () => new Promise(resolve => globalThis.scheduleWorld.waits.push(resolve));',
  'export const scrollCard = (card, index) => globalThis.scheduleWorld.log.push("scroll " + card.name + " " + index);',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/panels.js'), [
  'export function buildPage(id) {',
  "  globalThis.scheduleWorld.log.push('build ' + id);",
  '  return { id: id, element: { name: id } };',
  '}',
  'export const canShow = () => true;',
  'export const moduleOf = id => globalThis.scheduleWorld.modules[id] || null;',
  'export const regionOf = () => "grid1";',
  'export const topicOf = () => null;',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/photos.js'), 'export const ownSeconds = step => step.seconds || 0;\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/layout.js'), [
  'export const hasRegion = () => true;',
  "export const layoutNow = () => 'standard';",
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/areas.js'), [
  'export async function changePage(region, page) {',
  "  globalThis.scheduleWorld.log.push('page ' + (page ? page.id : 'none'));",
  '  return 0;',
  '}',
  'export function clearRegion() {}',
].join('\n') + '\n');
let scheduleRuns = 0;

async function inRotation(modules, run, options = {}) {
  const world = { log: [], waits: [], modules: modules, pace: options.pace || 1, turn: options.turn || 0 };
  globalThis.scheduleWorld = world;

  try {
    scheduleRuns += 1;
    world.module = await import(pathToFileURL(path.join(scheduleTree, 'dashboard/core/schedule.js')).href + '?run=' + scheduleRuns);
    world.content = { settings: { pageSeconds: 20, rotation: {} } };
    world.settle = async () => {
      for (let turn = 0; turn < 8; turn++) await new Promise(resolve => setImmediate(resolve));
    };
    // lets every wait go, a quarter of a second at a time, until this many seconds have passed
    world.pass = async count => {
      for (let quarter = 0; quarter < count * 4; quarter++) {
        world.waits.splice(0).forEach(resolve => resolve());
        await world.settle();
      }
    };
    await run(world);
  } finally {
    delete globalThis.scheduleWorld;
  }
}

const eventsModules = pageCount => ({ events: { scrollPages: () => pageCount } });
const rowsOf = seconds => [{ panel: 'events', show: true, seconds: seconds }, { panel: 'photo', show: true }];

test('the panel is held for the seconds of its row, the list moves up by four rows, and it is held for the same seconds again before the next panel', async () => {
  await inRotation(eventsModules(2), async world => {
    world.module.startRotation('grid1', () => withPages(rowsOf(10)), () => world.content);
    await world.settle();

    await world.pass(9);
    assert.deepEqual(world.log, ['build events', 'page events'], 'held, and not scrolled yet');
    await world.pass(1);
    assert.deepEqual(world.log, ['build events', 'page events', 'scroll events 1'], 'ten seconds in, the list moves to page two');
    await world.pass(9);
    assert.deepEqual(world.log.slice(3), [], 'and page two is held');
    await world.pass(1);
    assert.deepEqual(world.log.slice(3), ['build photo', 'page photo'], 'ten seconds later the next panel comes');
  });
});

test('with no seconds on the row the panel follows Seconds per page for each page, and the second page has the same time as the first', async () => {
  await inRotation(eventsModules(2), async world => {
    world.module.startRotation('grid1', () => withPages(rowsOf(0)), () => world.content);
    await world.settle();

    await world.pass(19);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), []);
    await world.pass(1);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), ['scroll events 1'], 'Seconds per page is 20 here');
    await world.pass(19);
    assert.equal(world.log.includes('page photo'), false);
    await world.pass(1);
    assert.equal(world.log.includes('page photo'), true);
  });
});

test('the time a page takes to leave is taken off each hold, and the Speed setting stretches the holds, as for every other page', async () => {
  await inRotation(eventsModules(2), async world => {
    world.module.startRotation('grid1', () => withPages(rowsOf(10)), () => world.content);
    await world.settle();

    // a page is held 10 seconds less the second it takes to leave, which is 9
    await world.pass(8);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), []);
    await world.pass(1);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), ['scroll events 1']);
  }, { turn: 1000 });

  await inRotation(eventsModules(2), async world => {
    world.module.startRotation('grid1', () => withPages(rowsOf(10)), () => world.content);
    await world.settle();

    await world.pass(14);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), [], 'slow is one and a half times as long: 15 seconds');
    await world.pass(1);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), ['scroll events 1']);
  }, { pace: 1.5 });
});

test('a panel with one page is held once and never scrolled, and a screen with no events does not have the panel at all', async () => {
  await inRotation(eventsModules(1), async world => {
    world.module.startRotation('grid1', () => withPages(rowsOf(10)), () => world.content);
    await world.settle();
    await world.pass(30);

    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), []);
    assert.deepEqual(world.log.filter(line => line.startsWith('page')).slice(0, 2), ['page events', 'page photo']);
  });

  assert.equal(eventsPanel.hasContent(contentFor([])), false, 'schedule.js asks hasContent first, so a step with no events is skipped (tests/event-pages.test.mjs)');
});

test('a refresh of the pages while the first page is held ends the hold, and the second page is never scrolled to', async () => {
  await inRotation(eventsModules(2), async world => {
    world.module.startRotation('grid1', () => withPages(rowsOf(10)), () => world.content);
    await world.settle();
    await world.pass(4);

    world.module.showPagesNow();
    await world.pass(2);
    assert.deepEqual(world.log.filter(line => line.startsWith('scroll')), [], 'the next page comes at once');
    assert.ok(world.log.includes('page photo'));
  });
});


// The docs

test('the docs say that the Events panel scrolls from the first four events to the next four, in one step, with nothing moving in calm and none', () => {
  const editing = fs.readFileSync(path.join(docsFolder, 'editing-content.md'), 'utf8').replace(/\s+/g, ' ');
  const coaches = fs.readFileSync(path.join(docsFolder, 'coaches-guide.md'), 'utf8').replace(/\s+/g, ' ');
  const filters = fs.readFileSync(path.join(docsFolder, 'calendar-filters.md'), 'utf8').replace(/\s+/g, ' ');
  const layouts = fs.readFileSync(path.join(docsFolder, 'layouts.md'), 'utf8').replace(/\s+/g, ' ');
  const adding = fs.readFileSync(path.join(docsFolder, 'adding-a-panel.md'), 'utf8').replace(/\s+/g, ' ');

  ['the list scrolls up', 'one step of the Screen', 'Calm or None', 'does not scroll'].forEach(word => assert.ok(editing.includes(word), 'editing-content.md names ' + word));
  assert.ok(coaches.includes('scrolls from its first four events to the next four'), 'the coaches guide says it in the rows of the main panel');
  assert.ok(coaches.includes('the list scrolls up'), 'and in the Events panel section');
  assert.ok(filters.includes('the list scrolls from the first to the second'));
  ['528', '576', 'scrollCard'].forEach(word => assert.ok(layouts.includes(word), 'layouts.md names ' + word));
  assert.ok(adding.includes('`scrollPages(content, page)`') && adding.includes('No panel has it now'), 'adding-a-panel.md says how a panel with more rows than fit does it');
  assert.ok(fs.readFileSync(path.join(docsFolder, 'where-things-are.md'), 'utf8').includes('events-scroll.test.mjs'), 'where-things-are.md lists this test');
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
