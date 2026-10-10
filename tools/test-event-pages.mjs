// Tests for the two pages of the Events panel (dashboard/core/event-pages.js, panels/events and the
// step for each page in core/panel-order.js): four events a page, no second page for four or fewer,
// the kind chip of each row, Group events by kind, and the pinned events of an Always show rule. The
// plain functions are run for real. The panel is run against a fake page that records what it draws,
// and core/schedule.js is run with stand-ins for the page. The stylesheet is checked by reading it,
// because the sizes need a browser to be seen.
//
//   node tools/test-event-pages.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const docsFolder = fileURLToPath(new URL('../docs/', import.meta.url));
const sampleFile = path.join(dashboardFolder, 'data/sample/content.json');
const read = file => fs.readFileSync(path.join(dashboardFolder, file), 'utf8');

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-event-pages-'));
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
fs.mkdirSync(path.join(root, 'panels/events'), { recursive: true });
fs.copyFileSync(path.join(dashboardFolder, 'panels/events/events.js'), path.join(root, 'panels/events/events.js'));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const registry = await import(base + 'registry.js');
const pages = await import(base + 'core/event-pages.js');
const eventsModule = await import(base + 'core/events.js');
const panelOrder = await import(base + 'core/panel-order.js');
const calendar = await import(base + 'core/calendar.js');
const { normalizeContent, normalizeSample } = await import(base + 'core/sanity.js');
const { withDefaults } = await import(base + 'core/content.js');
const eventsPanel = await import(base + 'panels/events/events.js');

const { chipWord, eventPages, eventsPerPage, kindOf, kindTitle, mostForcedEvents, pageRows } = pages;
const { forcingRule, hidingRule, mergeEvents } = eventsModule;
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

// A timed event of one hour that starts this many days from now, in the calendar with this code.
// The title says the number, so a page can be read as a list of numbers.
function band(number, daysAhead, calendarId, more) {
  const start = new Date(now.getTime() + daysAhead * day + 2 * hour);
  return Object.assign({ title: 'Event ' + number, start: start, end: new Date(start.getTime() + hour), allDay: false, location: '', calendarId: calendarId || 'meetings' }, more);
}

// One calendar for each kind, one with a kind that is not in the list and one with no kind
const calendarRows = [
  { id: 'meetings', name: '[Meetings]', show: true, kind: 'meetings' },
  { id: 'competitions', name: '[Competitions]', show: true, kind: 'competitions' },
  { id: 'outreach', name: '[Outreach]', show: true, kind: 'outreach' },
  { id: 'deadlines', name: '[Deadlines]', show: true, kind: 'deadlines' },
  { id: 'other', name: '[Other]', show: true, kind: 'other' },
  { id: 'odd', name: '[Odd]', show: true, kind: 'parties' },
  { id: 'plain', name: '[Plain]', show: true },
];

// A rule as core/sanity.js cleans it
function rule(action, fields) {
  return Object.assign({ name: '[Rule]', action: action, words: [], days: [], calendar: '', fromDate: '', toDate: '' }, fields);
}
const pin = words => rule('show', { words: [].concat(words), force: true });

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

// The numbers of the events on a page, such as [1, 2, 3, 4]
function numbersOn(content, page) {
  return pageRows(content, page, now).map(row => Number(row.event.title.replace('Event ', '')));
}

// Events 1 to count, a day apart, in the calendar with this code
function inOrder(count, calendarId) {
  const list = [];
  for (let number = 1; number <= count; number++) list.push(band(number, number, calendarId));
  return list;
}

// events.js draws each row bar with a shape that plate.js puts in the page once. This stands in for the page.
function withFakePage(run) {
  const drawn = [];
  globalThis.document = {
    getElementById: id => {
      if (id === 'metal-shapes') return { insertAdjacentHTML: (where, markup) => drawn.push(markup.match(/id="([^"]+)"/)[1]) };
      return drawn.includes(id) ? {} : null;
    },
  };

  try {
    return run(drawn);
  } finally {
    delete globalThis.document;
  }
}

// What the Events panel draws for a page. pageRows() judges by the clock, so the events here are
// ahead of it, and the clock of the test is the same one.
function drawn(content, page) {
  const host = { innerHTML: '' };
  return withFakePage(() => {
    eventsPanel.mount(host, content, page);
    return host.innerHTML;
  });
}

const titlesIn = html => Array.from(html.matchAll(/<span class="event-name">([^<]*)<\/span>/g)).map(match => match[1]);
const chipsIn = html => Array.from(html.matchAll(/<span class="kind-chip">([^<]*)<\/span>/g)).map(match => match[1]);

// A rule of a selector in a stylesheet, or '' when there is none
function ruleOf(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp('(?:^|[}\\s])' + escaped + '\\s*\\{([^}]*)\\}').exec(css);
  return found ? found[1] : '';
}

// The two pages -------------------------------------------------------------------------

test('four events are a page: the next four on page one, the four after them on page two, and the rest on neither', () => {
  const content = contentFor(inOrder(10));

  assert.equal(eventsPerPage, 4);
  assert.deepEqual(numbersOn(content, 1), [1, 2, 3, 4]);
  assert.deepEqual(numbersOn(content, 2), [5, 6, 7, 8]);
  assert.deepEqual(numbersOn(content, 3), [], 'there is no third page');
  assert.equal(eventPages(content, now).length, 2);
});

test('events go by date whatever order the list is in, and two on the same day keep the order of the list', () => {
  const events = [band(3, 3), band(1, 1), band(4, 4), band(2, 2)];
  assert.deepEqual(numbersOn(contentFor(events), 1), [1, 2, 3, 4]);

  const together = contentFor([band(2, 1), band(1, 1)]);
  assert.deepEqual(numbersOn(together, 1).sort(), [1, 2]);
});

test('with four events or fewer the second page does not run, with five it has one row, and with none there is no page', () => {
  [0, 1, 3, 4].forEach(count => {
    const content = contentFor(inOrder(count));
    assert.equal(pageRows(content, 2, now).length, 0, count + ' events');
    assert.equal(eventsPanel.hasContent(content, 2), false, count + ' events: page two has no content');
    assert.equal(eventsPanel.hasContent(content, 1), count > 0, count + ' events: page one');
  });

  const five = contentFor(inOrder(5));
  assert.deepEqual(numbersOn(five, 2), [5]);
  assert.equal(eventsPanel.hasContent(five, 2), true);

  const none = contentFor([]);
  assert.deepEqual(eventPages(none, now), [[], []]);
  assert.equal(eventsPanel.hasContent(none, 1), false);
  assert.equal(eventsPanel.hasContent({}, 1), false, 'a screen with no events and no settings yet');
});

test('an event that has finished is on no page, and one that is happening now stays', () => {
  const finished = band(1, 0, 'meetings', { start: new Date(now.getTime() - 3 * hour), end: new Date(now.getTime() - hour) });
  const happening = band(2, 0, 'meetings', { start: new Date(now.getTime() - hour), end: new Date(now.getTime() + hour) });
  const later = band(3, 1);

  assert.deepEqual(numbersOn(contentFor([finished, happening, later]), 1), [2, 3]);
});

test('an all-day event lasts to the end of its day, and an event with no usable start is left out', () => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = band(1, 0, 'meetings', { allDay: true, start: start, end: start });
  const content = contentFor([today, band(2, 1)]);
  content.events.push({ title: 'Event 3', start: 'not a date', calendarId: 'meetings' });

  assert.deepEqual(numbersOn(content, 1), [1, 2]);
});

test('the panel draws the page it is given, four rows to a page, with the same header on both and a bar under every row but the last', () => {
  const content = contentFor(inOrder(10));
  const first = drawn(content, 1);
  const second = drawn(content, 2);

  assert.deepEqual(titlesIn(first), ['Event 1', 'Event 2', 'Event 3', 'Event 4']);
  assert.deepEqual(titlesIn(second), ['Event 5', 'Event 6', 'Event 7', 'Event 8']);
  [first, second].forEach(html => {
    assert.equal(countOf(html, 'class="row"'), 4);
    assert.equal(countOf(html, 'class="row-bar"'), 3);
    assert.ok(html.includes('<h2 class="title" data-slat="title">EVENTS</h2>'));
    assert.equal(countOf(html, 'class="day-name"'), 4, 'the weekday and the date stay in their own column');
    assert.equal(countOf(html, 'class="month-day"'), 4);
  });

  assert.equal(drawn(content).includes('Event 1'), true, 'no page is page one');
  assert.deepEqual(titlesIn(drawn(contentFor(inOrder(6)), 2)), ['Event 5', 'Event 6'], 'a short second page keeps its rows at the top');
});

// The kind ---------------------------------------------------------------------------------

test('the kind of an event is the kind of its calendar, and Other when the calendar has none, a kind that is not in the list, or no row', () => {
  const kinds = calendarRows.map(row => kindOf({ calendarId: row.id }, calendarRows));
  assert.deepEqual(kinds, ['meetings', 'competitions', 'outreach', 'deadlines', 'other', 'other', 'other']);

  assert.equal(kindOf({ calendarId: 'missing' }, calendarRows), 'other');
  assert.equal(kindOf({}, calendarRows), 'other');
  assert.equal(kindOf({ calendarId: 'meetings' }, undefined), 'other');
  assert.equal(kindOf({ calendarId: 'meetings' }, [null, 'text', {}]), 'other');
  assert.deepEqual(config.calendarKinds, ['meetings', 'competitions', 'outreach', 'deadlines', 'other']);
  assert.equal(config.defaultCalendarKind, 'other');
});

test('each kind has a chip word and a name, and anything else is OTHER', () => {
  assert.deepEqual(config.calendarKinds.map(chipWord), ['MEETING', 'COMP', 'OUTREACH', 'DEADLINE', 'OTHER']);
  assert.deepEqual(config.calendarKinds.map(kindTitle), ['Meetings', 'Competitions', 'Outreach', 'Deadlines', 'Other']);
  ['parties', '', undefined, null].forEach(kind => {
    assert.equal(chipWord(kind), 'OTHER');
    assert.equal(kindTitle(kind), 'Other');
  });
});

test('every row has a chip with the word of its calendar kind, before the title', () => {
  const events = ['meetings', 'competitions', 'outreach', 'deadlines', 'other', 'plain'].map((id, index) => band(index + 1, index + 1, id));
  const html = drawn(contentFor(events), 1);

  assert.deepEqual(chipsIn(html), ['MEETING', 'COMP', 'OUTREACH', 'DEADLINE']);
  assert.deepEqual(chipsIn(drawn(contentFor(events), 2)), ['OTHER', 'OTHER']);
  assert.equal(countOf(html, 'class="kind-chip"'), countOf(html, 'class="row"'), 'one chip in each row');
  assert.ok(html.indexOf('class="kind-chip"') < html.indexOf('class="event-name"'), 'the chip comes before the title');
  assert.equal(/<span class="kind-chip">[^<]*<\/span>\s*<span class="event-name">/.test(html), true);
});

test('what editors typed in the title is escaped, and the chip is plain words the editors cannot change', () => {
  const html = drawn(contentFor([band(1, 1, 'meetings', { title: '<b>Pizza</b> & more' })]), 1);

  assert.ok(html.includes('&lt;b&gt;Pizza&lt;/b&gt; &amp; more') && !html.includes('<b>'));
  assert.deepEqual(chipsIn(html), ['MEETING']);
});

// Group events by kind -------------------------------------------------------------------

// Eight events a day apart in calendars of the five kinds: 1 meetings, 2 competitions, 3 outreach,
// 4 deadlines, 5 other, 6 meetings, 7 competitions, 8 outreach, then 9 deadlines and 10 meetings
const mixed = [
  band(1, 1, 'meetings'), band(2, 2, 'competitions'), band(3, 3, 'outreach'), band(4, 4, 'deadlines'), band(5, 5, 'other'),
  band(6, 6, 'meetings'), band(7, 7, 'competitions'), band(8, 8, 'outreach'), band(9, 9, 'deadlines'), band(10, 10, 'meetings'),
];

test('Group events by kind off keeps both pages in date order whatever the kinds', () => {
  const content = contentFor(mixed);
  assert.deepEqual(numbersOn(content, 1), [1, 2, 3, 4]);
  assert.deepEqual(numbersOn(content, 2), [5, 6, 7, 8]);

  const missing = contentFor(mixed, { settings: { groupEventsByKind: undefined } });
  assert.deepEqual(numbersOn(missing, 1), [1, 2, 3, 4], 'a screen that never had the switch is in date order');
  const wrong = contentFor(mixed, { settings: { groupEventsByKind: 'yes' } });
  assert.deepEqual(numbersOn(wrong, 1), [1, 2, 3, 4], 'only true turns it on');
});

test('Group events by kind on makes page one the next four Meetings, Deadlines and Other events and page two the next four Competitions and Outreach events', () => {
  const content = contentFor(mixed, { settings: { groupEventsByKind: true } });

  assert.deepEqual(numbersOn(content, 1), [1, 4, 5, 6], 'meetings, deadlines and other, in date order');
  assert.deepEqual(numbersOn(content, 2), [2, 3, 7, 8], 'competitions and outreach, in date order');
  assert.deepEqual(pageRows(content, 1, now).map(row => row.kind), ['meetings', 'deadlines', 'other', 'meetings']);
  assert.deepEqual(pageRows(content, 2, now).map(row => row.kind), ['competitions', 'outreach', 'competitions', 'outreach']);
});

test('with the grouping on, a kind with more than four events leaves the later ones off, and Other and a calendar with no kind are on page one', () => {
  const crowded = [];
  for (let number = 1; number <= 6; number++) crowded.push(band(number, number, 'competitions'));
  crowded.push(band(7, 7, 'plain'), band(8, 8, 'odd'), band(9, 9, 'deadlines'));
  const content = contentFor(crowded, { settings: { groupEventsByKind: true } });

  assert.deepEqual(numbersOn(content, 1), [7, 8, 9]);
  assert.deepEqual(numbersOn(content, 2), [1, 2, 3, 4], 'the fifth and sixth competitions are not shown');
});

test('with the grouping on, a page with none of its kinds does not run, and the other page still does', () => {
  const onlyCompetitions = contentFor(inOrder(3, 'competitions'), { settings: { groupEventsByKind: true } });
  assert.equal(eventsPanel.hasContent(onlyCompetitions, 1), false, 'no meetings, deadlines or other events: page one is skipped');
  assert.equal(eventsPanel.hasContent(onlyCompetitions, 2), true);
  assert.deepEqual(numbersOn(onlyCompetitions, 2), [1, 2, 3]);

  const onlyMeetings = contentFor(inOrder(3, 'meetings'), { settings: { groupEventsByKind: true } });
  assert.equal(eventsPanel.hasContent(onlyMeetings, 2), false);
  assert.equal(eventsPanel.hasContent(onlyMeetings, 1), true);
});

// Pinned events ---------------------------------------------------------------------------

test('a pinned event is first on page one even when it is not one of the next eight, and the other places fill by date as before', () => {
  const events = inOrder(10);
  const content = contentFor(events, { rules: [pin('Event 10')] });

  assert.deepEqual(numbersOn(content, 1), [10, 1, 2, 3]);
  assert.deepEqual(numbersOn(content, 2), [4, 5, 6, 7]);
  assert.deepEqual(pageRows(content, 1, now).map(row => row.forced), [true, false, false, false]);
  assert.deepEqual(pageRows(content, 2, now).map(row => row.forced), [false, false, false, false]);
});

test('a pinned event that was already one of the next eight moves to the top of page one, and is not shown twice', () => {
  const content = contentFor(inOrder(10), { rules: [pin('Event 6')] });
  const shown = numbersOn(content, 1).concat(numbersOn(content, 2));

  assert.deepEqual(numbersOn(content, 1), [6, 1, 2, 3]);
  assert.deepEqual(numbersOn(content, 2), [4, 5, 7, 8]);
  assert.equal(new Set(shown).size, shown.length);
});

test('pinned events are in date order among themselves, at most three of them, and the earliest win', () => {
  assert.equal(mostForcedEvents, 3);
  const content = contentFor(inOrder(12), { rules: [pin(['Event 11', 'Event 9', 'Event 12', 'Event 10'])] });

  assert.deepEqual(numbersOn(content, 1), [9, 10, 11, 1], 'three pinned by date, then the next event');
  assert.deepEqual(numbersOn(content, 2), [2, 3, 4, 5]);
  assert.deepEqual(pageRows(content, 1, now).map(row => row.forced), [true, true, true, false]);
  assert.ok(!numbersOn(content, 1).concat(numbersOn(content, 2)).includes(12), 'the fourth pinned event is an ordinary event that is far off');

  const near = contentFor(inOrder(12), { rules: [pin(['Event 1', 'Event 2', 'Event 3', 'Event 4', 'Event 5'])] });
  assert.deepEqual(numbersOn(near, 1), [1, 2, 3, 4], 'a fourth pinned event that is near is shown in its place by date');
  assert.deepEqual(pageRows(near, 1, now).map(row => row.forced), [true, true, true, false]);
  assert.deepEqual(numbersOn(near, 2), [5, 6, 7, 8]);
});

test('one pinned event takes one place, and with grouping on it is first on page one whatever its kind', () => {
  const settings = { groupEventsByKind: true };
  const content = contentFor(mixed, { settings: settings, rules: [pin('Event 7')] });

  assert.deepEqual(numbersOn(content, 1), [7, 1, 4, 5], 'a competition, pinned, then the first three meetings, deadlines and other events');
  assert.deepEqual(numbersOn(content, 2), [2, 3, 8], 'and it is not on page two as well');
  assert.deepEqual(pageRows(content, 1, now).map(row => row.forced), [true, false, false, false]);
});

test('a rule pins only when it is an Always show rule with Pin to page one on, switched on and not past its Hide after time', () => {
  const events = inOrder(10);
  const noPin = contentFor(events, { rules: [rule('show', { words: ['Event 10'] })] });
  assert.deepEqual(numbersOn(noPin, 1), [1, 2, 3, 4], 'Always show without the switch keeps the event and does not move it');

  const hideRule = contentFor(events, { rules: [rule('hide', { words: ['Event 3'], force: true })] });
  assert.deepEqual(numbersOn(hideRule, 1), [1, 2, 4, 5], 'a Hide rule hides, and its switch does nothing');

  const off = contentFor(events, { rules: [Object.assign(pin('Event 10'), { show: false })] });
  assert.deepEqual(numbersOn(off, 1), [1, 2, 3, 4], 'a rule that is off pins nothing');

  const past = contentFor(events, { rules: [Object.assign(pin('Event 10'), { expires: '2020-01-01T00:00:00.000Z' })] });
  assert.deepEqual(numbersOn(past, 1), [1, 2, 3, 4], 'a rule past its time pins nothing');

  const future = contentFor(events, { rules: [Object.assign(pin('Event 10'), { expires: '2999-01-01T00:00:00.000Z' })] });
  assert.deepEqual(numbersOn(future, 1), [10, 1, 2, 3]);
});

test('a pin follows the other conditions of its rule: the calendar, the days and the dates', () => {
  const events = [band(1, 1, 'meetings'), band(2, 2, 'meetings'), band(3, 3, 'meetings'), band(4, 4, 'meetings'), band(5, 5, 'meetings'), band(6, 6, 'competitions')];
  const inCalendar = contentFor(events, { rules: [rule('show', { calendar: 'competitions', force: true })] });
  assert.deepEqual(numbersOn(inCalendar, 1), [6, 1, 2, 3]);

  const otherCalendar = contentFor(events, { rules: [rule('show', { calendar: 'outreach', force: true })] });
  assert.deepEqual(numbersOn(otherCalendar, 1), [1, 2, 3, 4]);

  const event = contentFor([band(1, 1)]).events[0];
  assert.equal(forcingRule(event, [pin('Event 1')], zone, now) !== null, true);
  assert.equal(forcingRule(event, [pin('Event 2')], zone, now), null);
  assert.equal(forcingRule(event, undefined, zone, now), null);
  assert.equal(forcingRule(null, [pin('Event 1')], zone, now), null);
});

test('an Always show rule with Pin to page one also keeps an event that a Hide rule would hide, and pins it', () => {
  const rules = [rule('hide', { words: ['Event'] }), pin('Event 5')];
  const content = contentFor(inOrder(8), { rules: rules });

  assert.equal(hidingRule(content.events[0], rules, zone, now), null);
  assert.deepEqual(content.events.map(event => event.title), ['Event 5'], 'every event but the one that is always shown is hidden');
  assert.deepEqual(numbersOn(content, 1), [5]);
  assert.equal(pageRows(content, 1, now)[0].forced, true);
});

test('only a pinned row has the pin mark, and the mark is 44 square', () => {
  const content = contentFor(inOrder(10), { rules: [pin('Event 10')] });
  const first = drawn(content, 1);
  const second = drawn(content, 2);

  assert.equal(countOf(first, 'class="pin-mark"'), 1);
  assert.equal(countOf(second, 'class="pin-mark"'), 0);
  assert.ok(first.includes('viewBox="0 0 44 44" width="44" height="44"'));
  assert.ok(first.indexOf('class="event-name">Event 10') < first.indexOf('class="pin-mark"'), 'the mark comes after the title');
  assert.equal(countOf(drawn(contentFor(inOrder(10)), 1), 'pin-mark'), 0, 'with no rule there is no mark');
});

// What the reader and the settings give -------------------------------------------------------

test('the reader keeps force on a rule when it is true, and drops it when it is false or missing', () => {
  const rules = [
    { _id: 'a', _type: 'calendarFilter', name: '[A]', action: 'show', words: ['Kickoff'], force: true },
    { _id: 'b', _type: 'calendarFilter', name: '[B]', action: 'show', words: ['Kickoff'], force: false },
    { _id: 'c', _type: 'calendarFilter', name: '[C]', action: 'show', words: ['Kickoff'] },
    { _id: 'd', _type: 'calendarFilter', name: '[D]', action: 'show', words: ['Kickoff'], force: 'yes' },
  ];
  const cleaned = normalizeContent({ calendarFilters: rules }, new Date()).calendarFilters;

  assert.deepEqual(cleaned.map(item => item.force), [true, undefined, undefined, undefined]);
  assert.equal('force' in cleaned[1], false);
});

test('each calendar keeps its kind through the reader, Group events by kind starts off, and anything but true is off', () => {
  const settings = normalizeContent({ settings: { calendars: [{ id: 'a', name: '[A]', show: true, kind: 'outreach' }, { id: 'b', name: '[B]', show: true }], groupEventsByKind: true } }, new Date()).settings;
  assert.deepEqual(settings.calendars.map(row => row.kind), ['outreach', undefined]);
  assert.equal(settings.groupEventsByKind, true);

  assert.equal(config.defaultSettings.groupEventsByKind, false);
  assert.equal(withDefaults(null).settings.groupEventsByKind, false);
  ['yes', 1, null, undefined].forEach(value => {
    assert.equal(normalizeContent({ settings: { groupEventsByKind: value } }, new Date()).settings.groupEventsByKind, false, String(value));
  });
  config.defaultSettings.calendars.forEach(row => assert.ok(config.calendarKinds.includes(row.kind), 'the starting calendar has a kind'));
});

test('the sample content has a kind on its calendar and enough events for both pages, in date order', () => {
  const content = normalizeSample(JSON.parse(fs.readFileSync(sampleFile, 'utf8')));
  const row = content.settings.calendars[0];
  assert.ok(config.calendarKinds.includes(row.kind), 'the sample calendar has a kind from the list');
  assert.equal(content.settings.groupEventsByKind, false);

  const text = fs.readFileSync(path.join(dashboardFolder, 'data/sample/calendars/team.ics'), 'utf8');
  const events = calendar.expandEvents(calendar.parseIcs(text), new Date(now.getTime() - day), new Date(now.getTime() + 60 * day));
  events.forEach(event => {
    event.calendarId = row.id;
  });
  const shown = Object.assign({}, content, { events: mergeEvents(events, zone, now, content.calendarFilters) });
  const [first, second] = eventPages(shown, now);

  assert.equal(first.length, 4);
  assert.equal(second.length, 4);
  const starts = first.concat(second).map(item => item.event.start.getTime());
  assert.deepEqual(starts.slice().sort((a, b) => a - b), starts, 'the eight are in date order');
  assert.equal(first.concat(second).every(item => item.kind === row.kind), true);
});

// The step for each page in the rotation -----------------------------------------------------------

test('the registry gives the Events panel two pages and every other panel one', () => {
  registry.panels.forEach(panel => {
    if (panel.id === 'events') assert.equal(panel.pages, 2);
    else assert.equal(panel.pages, undefined, panel.id);
  });
});

test('the Events row of the list is two steps one after the other, page 1 and page 2, each with the row\'s switch and seconds', () => {
  const list = [{ panel: 'tasks', show: true }, { panel: 'events', show: true, seconds: 15 }, { panel: 'photo', show: false }];
  const steps = withPages(list);

  assert.deepEqual(steps, [
    { panel: 'tasks', show: true },
    { panel: 'events', show: true, seconds: 15, page: 1 },
    { panel: 'events', show: true, seconds: 15, page: 2 },
    { panel: 'photo', show: false },
  ]);
  assert.deepEqual(list[1], { panel: 'events', show: true, seconds: 15 }, 'the list that was given is not changed');

  const off = withPages([{ panel: 'events', show: false }]);
  assert.deepEqual(off.map(step => step.show), [false, false], 'a row that is off switches both pages off');
});

test('the steps are the same however many events there are, and the default order has the Events panel twice in a row', () => {
  const steps = withPages(panelOrder.playlistOf(config.defaultSettings.rotation, 'grid1'));
  const ids = steps.map(step => step.panel);
  const at = ids.indexOf('events');

  assert.deepEqual(ids.slice(at, at + 2), ['events', 'events']);
  assert.deepEqual(steps.slice(at, at + 2).map(step => step.page), [1, 2]);
  assert.equal(ids.filter(id => id === 'events').length, 2);
  assert.equal(steps.filter(step => step.panel !== 'events').every(step => !('page' in step)), true);

  assert.deepEqual(withPages([]), []);
  assert.deepEqual(withPages(panelOrder.playlistOf(config.defaultSettings.rotation, 'grid2')).map(step => step.panel), panelOrder.playlistOf(config.defaultSettings.rotation, 'grid2').map(step => step.panel), 'the small panels have one page each');
});

test('shell.js gives the rotation of the large and the small panels through withPages', () => {
  const shell = read('shell.js');
  assert.ok(shell.includes("import { playlistOf, withPages } from './core/panel-order.js';"));
  assert.ok(shell.includes("withPages(playlistOf(rotation(), 'grid1'))"));
  assert.ok(shell.includes("withPages(playlistOf(rotation(), 'grid2'))"));
  assert.ok(read('core/schedule.js').includes('buildPage(step.panel, getContent(), step.page)'));
  assert.ok(read('core/schedule.js').includes('canShow(step.panel, content, step.page)'));
});

// core/schedule.js, with stand-ins for the files it reads. The waits are held by the test, which lets
// them go a quarter of a second at a time, so a page that stays 20 seconds takes no time to pass.

const scheduleTree = path.join(workFolder, 'schedule-tree');
['config.js', 'core/schedule.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(scheduleTree, 'dashboard', file)), { recursive: true });
  fs.copyFileSync(path.join(dashboardFolder, file), path.join(scheduleTree, 'dashboard', file));
});
fs.writeFileSync(path.join(scheduleTree, 'package.json'), '{ "type": "module" }\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/frame.js'), [
  'export const pace = () => 1;',
  'export const turnMs = () => 0;',
  'export const isPaused = () => false;',
  'export const wait = () => new Promise(resolve => globalThis.scheduleWorld.waits.push(resolve));',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/panels.js'), [
  'export function buildPage(id, content, page) {',
  "  const name = id + (page ? ' ' + page : '');",
  "  globalThis.scheduleWorld.log.push('build ' + name);",
  '  return { id: name, element: {} };',
  '}',
  'export const canShow = (id, content, page) => globalThis.scheduleWorld.canShow(id, page);',
  'export const moduleOf = () => null;',
  "export const regionOf = id => (id === 'forecast' ? 'grid2' : 'grid1');",
  'export const topicOf = () => null;',
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/photos.js'), 'export const ownSeconds = step => step.seconds || 0;\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/layout.js'), [
  'export const hasRegion = () => true;',
  "export const layoutNow = () => 'standard';",
].join('\n') + '\n');
fs.writeFileSync(path.join(scheduleTree, 'dashboard/core/areas.js'), [
  'export async function changePage(region, page) {',
  '  const world = globalThis.scheduleWorld;',
  "  world.log.push(region + ' ' + (page ? page.id : 'none'));",
  '  return 0;',
  '}',
  'export function clearRegion(region) {',
  "  globalThis.scheduleWorld.log.push('clear ' + region);",
  '}',
].join('\n') + '\n');
let scheduleRuns = 0;

async function inRotation(run) {
  const world = { log: [], waits: [], canShow: () => true };
  globalThis.scheduleWorld = world;

  try {
    scheduleRuns += 1;
    world.module = await import(pathToFileURL(path.join(scheduleTree, 'dashboard/core/schedule.js')).href + '?run=' + scheduleRuns);
    world.content = { settings: { pageSeconds: 20, rotation: {} } };
    world.settle = async () => {
      for (let turn = 0; turn < 8; turn++) await new Promise(resolve => setImmediate(resolve));
    };
    // lets every wait go, a quarter of a second at a time, until this many seconds have passed
    world.pass = async seconds => {
      for (let quarter = 0; quarter < seconds * 4; quarter++) {
        world.waits.splice(0).forEach(resolve => resolve());
        await world.settle();
      }
    };
    world.pagesOf = region => world.log.filter(line => line.startsWith(region + ' ')).map(line => line.slice(region.length + 1));
    await run(world);
  } finally {
    delete globalThis.scheduleWorld;
  }
}

const rotationRows = [{ panel: 'tasks', show: true }, { panel: 'events', show: true }, { panel: 'photo', show: true }];

test('the large panel shows the Events panel as page one and then page two, in the place of its one row', async () => {
  await inRotation(async world => {
    world.module.startRotation('grid1', () => withPages(rotationRows), () => world.content);
    await world.settle();
    for (let page = 0; page < 5; page++) await world.pass(20);

    assert.deepEqual(world.pagesOf('grid1'), ['tasks', 'events 1', 'events 2', 'photo', 'tasks', 'events 1']);
    assert.deepEqual(world.log.filter(line => line.startsWith('build events')), ['build events 1', 'build events 2', 'build events 1']);
  });
});

test('a page with nothing on it is skipped, so with four events or fewer the rotation goes from page one to the next panel', async () => {
  await inRotation(async world => {
    world.canShow = (id, page) => !(id === 'events' && page === 2);
    world.module.startRotation('grid1', () => withPages(rotationRows), () => world.content);
    await world.settle();
    for (let page = 0; page < 4; page++) await world.pass(20);

    assert.deepEqual(world.pagesOf('grid1'), ['tasks', 'events 1', 'photo', 'tasks', 'events 1']);
  });
});

test('page two is asked about with its own page number, and a panel with one page is asked with none', async () => {
  await inRotation(async world => {
    const asked = [];
    world.canShow = (id, page) => {
      asked.push(id + ' ' + page);
      return true;
    };
    world.module.startRotation('grid1', () => withPages(rotationRows), () => world.content);
    await world.settle();
    await world.pass(20);
    await world.pass(20);

    assert.ok(asked.includes('tasks undefined'));
    assert.ok(asked.includes('events 1'));
    assert.ok(asked.includes('events 2'));
  });
});

test('both pages of the Events panel stay on screen as long as the row says', async () => {
  await inRotation(async world => {
    const rows = [{ panel: 'events', show: true, seconds: 8 }, { panel: 'photo', show: true }];
    world.module.startRotation('grid1', () => withPages(rows), () => world.content);
    await world.settle();
    await world.pass(8);
    assert.deepEqual(world.pagesOf('grid1'), ['events 1', 'events 2']);
    await world.pass(8);
    assert.deepEqual(world.pagesOf('grid1'), ['events 1', 'events 2', 'photo']);
  });
});

// The look of a row ----------------------------------------------------------------------------

test('the chip is 44px or more, the title is on one line that ends in an ellipsis, and only the title gives way', () => {
  const css = read('panels/events/events.css');
  const tokens = read('tokens.css');
  const labelSize = Number(/--size-label: (\d+)px;/.exec(tokens)[1]);
  assert.ok(labelSize >= 44);

  const chip = ruleOf(css, '.events .kind-chip');
  assert.ok(chip.includes('font: 700 var(--size-label)/'), 'the chip is at the label size');
  assert.ok(chip.includes('flex: none;'), 'the chip never gets narrower');
  assert.ok(chip.includes('background: var(--yellow);'), 'in the team accent');

  const name = ruleOf(css, '.events .event-name');
  ['overflow: hidden;', 'text-overflow: ellipsis;', 'white-space: nowrap;', 'min-width: 0;'].forEach(piece => assert.ok(name.includes(piece), 'the title has ' + piece));
  assert.ok(ruleOf(css, '.events .pin-mark').includes('flex: none;'));
  assert.ok(ruleOf(css, '.events .event-title').includes('display: flex;'));

  const sizes = Array.from(css.matchAll(/font(?:-size)?: [^;]*?(\d+)px/g)).map(match => Number(match[1]));
  sizes.forEach(size => assert.ok(size >= 44 || size === 0, 'a font size under 44px: ' + size));
});

test('the longest chip and the pin leave the title at least half of the line, in the narrowest row', () => {
  // the widest row of text is the details column: 1152 less the date column (240) and the right space (88 in the last row)
  const details = 1152 - 240 - 88;
  const widest = 0.72 * 44 * 'OUTREACH'.length + 28; // a bold capital in the display font is at most 0.72 of its size wide
  const left = details - widest - 16 - 16 - 44;
  assert.ok(left >= details / 2, 'the title has ' + Math.round(left) + 'px of ' + details);
  assert.equal(Math.max(...config.calendarKinds.map(kind => chipWord(kind).length)), 'OUTREACH'.length);
});

test('the Events stylesheet moves nothing and has no blur, glow, shadow or filter, and the panel has no animation code', () => {
  const css = read('panels/events/events.css').replace(/\/\*[\s\S]*?\*\//g, '');
  ['animation', 'transition', 'transform', 'box-shadow', 'text-shadow', 'filter', 'blur'].forEach(word => assert.equal(css.includes(word), false, word));

  const script = read('panels/events/events.js') + read('core/event-pages.js');
  ['animate', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'style.transform'].forEach(word => assert.equal(script.includes(word), false, word));
});

// The Events Calendar entries --------------------------------------------------------------------

test('nothing in the dashboard reads the Events Calendar entries any more', () => {
  const found = [];
  const walk = folder => {
    fs.readdirSync(folder, { withFileTypes: true }).forEach(entry => {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(js|json|html)$/.test(entry.name) && /extraEvent/.test(fs.readFileSync(file, 'utf8'))) found.push(path.relative(dashboardFolder, file));
    });
  };
  walk(dashboardFolder);

  assert.deepEqual(found, []);
  assert.equal(JSON.stringify(Object.keys(normalizeContent({}, new Date()))).includes('extraEvent'), false);
});

// The docs ----------------------------------------------------------------------------------------

test('the docs say what the two pages are, the kinds, the grouping and the pin', () => {
  const filters = fs.readFileSync(path.join(docsFolder, 'calendar-filters.md'), 'utf8').replace(/\s+/g, ' ');
  const editing = fs.readFileSync(path.join(docsFolder, 'editing-content.md'), 'utf8').replace(/\s+/g, ' ');

  ['Pin to page one', 'page one', 'At most three', 'Always show', 'check-calendars.sh', 'later', 'pinned'].forEach(word => assert.ok(filters.includes(word), 'calendar-filters.md names ' + word));
  ['two pages', 'Kind', 'Meetings', 'Competitions', 'Outreach', 'Deadlines', 'Other', 'Group events by kind', 'Pin to page one', 'COMP'].forEach(word => assert.ok(editing.includes(word), 'editing-content.md names ' + word));
  assert.ok(editing.includes('four or fewer') || editing.includes('4 or fewer'), 'editing-content.md says when page two does not run');
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
