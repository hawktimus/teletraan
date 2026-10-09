// Tests for dashboard/core/calendar.js, and for how dashboard/core/events.js applies the
// Calendar filters to the events it reads. Run with:  node tools/test-calendar.mjs
// Exits with a non-zero code when a test fails. The fixtures are in tools/testdata.

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The dashboard files are browser modules with a .js name, and Node does not
// treat a .js file as a module unless it is told to. So the two files are
// copied under .mjs names and those are imported instead.
async function loadCalendarModule() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-calendar-'));
  const core = new URL('../dashboard/core/', import.meta.url);
  const importLine = "from './time.js'";

  const source = fs.readFileSync(new URL('calendar.js', core), 'utf8');
  assert.ok(source.includes(importLine), 'calendar.js no longer imports ./time.js, so this loader needs updating');
  fs.writeFileSync(path.join(folder, 'calendar.mjs'), source.replace(importLine, "from './time.mjs'"));
  fs.copyFileSync(new URL('time.js', core), path.join(folder, 'time.mjs'));

  try {
    return await import(pathToFileURL(path.join(folder, 'calendar.mjs')).href);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

// events.js and sanity.js reach the Theme settings and the other core files, so the folder
// is copied as it is, next to a package.json that says "type": "module".
async function loadFilterModules() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-filters-'));
  const dashboard = new URL('../dashboard/', import.meta.url);
  fs.writeFileSync(path.join(folder, 'package.json'), '{ "type": "module" }\n');
  fs.mkdirSync(path.join(folder, 'dashboard/core'), { recursive: true });
  fs.mkdirSync(path.join(folder, 'dashboard/themes/overlays'), { recursive: true });

  fs.copyFileSync(new URL('config.js', dashboard), path.join(folder, 'dashboard/config.js'));
  fs.readdirSync(new URL('core/', dashboard))
    .filter(file => file.endsWith('.js'))
    .forEach(file => fs.copyFileSync(new URL('core/' + file, dashboard), path.join(folder, 'dashboard/core', file)));
  ['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
    fs.copyFileSync(new URL(file, dashboard), path.join(folder, 'dashboard', file));
  });

  try {
    const base = pathToFileURL(path.join(folder, 'dashboard')).href + '/';
    const events = await import(base + 'core/events.js');
    const sanity = await import(base + 'core/sanity.js');
    return { mergeEvents: events.mergeEvents, hidingRule: events.hidingRule, normalizeSample: sanity.normalizeSample };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

const { parseIcs, expandEvents, loadEvents } = await loadCalendarModule();
const { mergeEvents, hidingRule, normalizeSample } = await loadFilterModules();

// Dates written in UTC give the same moment on any computer. Dates written
// with local() are on this computer's own clock, like a calendar time with no zone.
const utc = (year, month, day, hour = 0, minute = 0) => new Date(Date.UTC(year, month - 1, day, hour, minute));
const local = (year, month, day, hour = 0, minute = 0) => new Date(year, month - 1, day, hour, minute);
const iso = date => date.toISOString();

const fixtureFolder = new URL('./testdata/', import.meta.url);
const fixtureText = name => fs.readFileSync(new URL(name + '.ics', fixtureFolder), 'utf8');
const expandFixture = (name, from, to) => expandEvents(parseIcs(fixtureText(name)), from, to);
const titlesOf = events => events.map(event => event.title);

// The start of every occurrence with this title, as UTC text
function startsOf(name, title, from, to) {
  return expandFixture(name, from, to)
    .filter(event => event.title === title)
    .map(event => iso(event.start));
}

// The same, as dates only, such as 2027-01-12
function daysOf(name, title, from, to) {
  return startsOf(name, title, from, to).map(text => text.slice(0, 10));
}

function occurrencesOf(name, title, from, to) {
  return expandFixture(name, from, to).filter(event => event.title === title);
}

function occurrenceNamed(name, title, from, to) {
  const found = occurrencesOf(name, title, from, to);
  assert.strictEqual(found.length, 1, 'expected one "' + title + '", found ' + found.length);
  return found[0];
}

// What the clock on a wall in the given zone shows at that moment
function clockIn(zone, date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(date);
}

const tests = [];
function test(name, body) {
  tests.push({ name: name, body: body });
}

const january = [utc(2027, 1, 1), utc(2027, 3, 1)];

test('reads each event in a file and nothing else', () => {
  const parsed = parseIcs(fixtureText('single-events'));
  assert.deepStrictEqual(titlesOf(parsed), [
    '[UTC event]', '[New York event]', '[Floating event]', '[All day event]', '[Three day event]',
    '[All day no end]', '[Duration event]', '[Duration with a day]', '[Alarm event]', '[No end event]', '',
  ]);
});

test('reads a time in UTC', () => {
  const event = occurrenceNamed('single-events', '[UTC event]', ...january);
  assert.deepStrictEqual([iso(event.start), iso(event.end)], ['2027-01-12T23:00:00.000Z', '2027-01-13T00:00:00.000Z']);
  assert.strictEqual(event.allDay, false);
  assert.strictEqual(event.location, '[Room A]');
  assert.strictEqual(event.uid, 'single-utc');
});

test('reads a time with a TZID', () => {
  const event = occurrenceNamed('single-events', '[New York event]', ...january);
  assert.deepStrictEqual([iso(event.start), iso(event.end)], ['2027-01-13T23:00:00.000Z', '2027-01-14T00:30:00.000Z']);
});

test('reads a time with no zone as the local clock', () => {
  const event = occurrenceNamed('single-events', '[Floating event]', ...january);
  assert.deepStrictEqual([event.start, event.end], [local(2027, 1, 14, 17), local(2027, 1, 14, 18, 30)]);
});

test('reads an all-day event, whose end date does not count', () => {
  const event = occurrenceNamed('single-events', '[All day event]', ...january);
  assert.strictEqual(event.allDay, true);
  assert.deepStrictEqual([event.start, event.end], [local(2027, 1, 15), local(2027, 1, 16)]);
});

test('reads an all-day event that lasts several days', () => {
  const event = occurrenceNamed('single-events', '[Three day event]', ...january);
  assert.deepStrictEqual([event.start, event.end], [local(2027, 1, 20), local(2027, 1, 23)]);
});

test('gives an all-day event with no end one day', () => {
  const event = occurrenceNamed('single-events', '[All day no end]', ...january);
  assert.deepStrictEqual([event.start, event.end], [local(2027, 1, 25), local(2027, 1, 26)]);
});

test('uses DURATION when there is no DTEND', () => {
  const short = occurrenceNamed('single-events', '[Duration event]', ...january);
  assert.deepStrictEqual([iso(short.start), iso(short.end)], ['2027-01-27T20:00:00.000Z', '2027-01-27T21:30:00.000Z']);

  const long = occurrenceNamed('single-events', '[Duration with a day]', ...january);
  assert.deepStrictEqual([iso(long.start), iso(long.end)], ['2027-01-28T09:00:00.000Z', '2027-01-29T11:00:00.000Z']);
});

test('gives an event with no end a length of nothing', () => {
  const event = occurrenceNamed('single-events', '[No end event]', ...january);
  assert.strictEqual(event.end.getTime(), event.start.getTime());
});

test('skips cancelled events, events with no start and the contents of alarms and time zones', () => {
  const titles = titlesOf(expandFixture('single-events', ...january));
  assert.ok(!titles.includes('[Cancelled event]'));
  assert.ok(!titles.includes('[No start event]'));
  assert.ok(!titles.includes('[Alarm text]'));
  assert.strictEqual(occurrenceNamed('single-events', '[Alarm event]', ...january).location, '');
});

test('leaves the title and location empty when the file has none', () => {
  const event = expandFixture('single-events', ...january).find(item => item.uid === 'single-untitled');
  assert.strictEqual(event.title, '');
  assert.strictEqual(event.location, '');
});

test('ignores properties it does not know, and parameters on the ones it does', () => {
  const event = occurrenceNamed('text', '[Language parameter]', ...january);
  assert.strictEqual(event.location, '[Quoted parameter location]');
});

test('joins lines that were folded with a space or a tab', () => {
  const titles = titlesOf(expandFixture('text', ...january));
  assert.ok(titles.includes('[Folded inside the word and after a comma, then a space]'), titles.join(' | '));

  const event = occurrenceNamed('text', '[Folded with a tab]', ...january);
  assert.strictEqual(event.location, '[Building one, room two]');
});

test('reads escaped text', () => {
  const event = occurrenceNamed('text', '[Line one\nLine two, comma; semicolon\\ backslash]', ...january);
  assert.strictEqual(event.location, '[Back\\slash and \\n is not a newline]');
});

test('reads a quoted TZID', () => {
  const event = occurrenceNamed('text', '[Quoted zone name]', ...january);
  assert.strictEqual(iso(event.start), '2027-02-03T23:00:00.000Z');
});

test('gives the same result for CRLF and LF line endings, with or without a byte order mark', () => {
  ['single-events', 'weekly', 'text', 'overrides'].forEach(name => {
    const text = fixtureText(name);
    const expected = parseIcs(text);
    assert.ok(expected.length > 0);
    assert.deepStrictEqual(parseIcs(text.replace(/\n/g, '\r\n')), expected, name + ' with CRLF');
    assert.deepStrictEqual(parseIcs('\uFEFF' + text.replace(/\n/g, '\r\n')), expected, name + ' with a byte order mark');
  });
});

test('repeats weekly on the listed weekdays', () => {
  const events = expandFixture('weekly', local(2027, 1, 1), local(2027, 1, 21)).filter(event => event.title === '[Mon and Wed]');
  assert.deepStrictEqual(events.map(event => event.start), [
    local(2027, 1, 4, 17), local(2027, 1, 6, 17), local(2027, 1, 11, 17),
    local(2027, 1, 13, 17), local(2027, 1, 18, 17), local(2027, 1, 20, 17),
  ]);
});

test('repeats weekly on the weekday the event starts on, every other week', () => {
  assert.deepStrictEqual(startsOf('weekly', '[Every other Tuesday]', ...january), [
    '2027-01-05T23:00:00.000Z', '2027-01-19T23:00:00.000Z', '2027-02-02T23:00:00.000Z', '2027-02-16T23:00:00.000Z',
  ]);
});

test('stops after COUNT occurrences', () => {
  assert.deepStrictEqual(startsOf('weekly', '[Three times]', utc(2027, 1, 1), utc(2028, 1, 1)), [
    '2027-01-06T12:00:00.000Z', '2027-01-13T12:00:00.000Z', '2027-01-20T12:00:00.000Z',
  ]);
});

test('stops at UNTIL, which is included, as a time or as a date', () => {
  const expected = ['2027-01-05T10:00:00.000Z', '2027-01-12T10:00:00.000Z', '2027-01-19T10:00:00.000Z'];
  assert.deepStrictEqual(startsOf('weekly', '[Until a time]', utc(2027, 1, 1), utc(2028, 1, 1)), expected);
  assert.deepStrictEqual(startsOf('weekly', '[Until a date]', utc(2027, 1, 1), utc(2028, 1, 1)), expected);
});

test('skips dates in EXDATE, one or several, on separate lines or with commas', () => {
  assert.deepStrictEqual(startsOf('weekly', '[Daily with exceptions]', ...january), [
    '2027-02-01T15:00:00.000Z', '2027-02-03T15:00:00.000Z', '2027-02-05T15:00:00.000Z', '2027-02-07T15:00:00.000Z',
  ]);
});

test('matches EXDATE by moment, whatever zone it was written in, or by day', () => {
  assert.deepStrictEqual(daysOf('weekly', '[Exception with a zone]', ...january), ['2027-02-01', '2027-02-03']);
  assert.deepStrictEqual(daysOf('weekly', '[Exception in UTC]', ...january), ['2027-02-02', '2027-02-03']);
  assert.deepStrictEqual(daysOf('weekly', '[Exception by day]', ...january), ['2027-02-01', '2027-02-03']);
});

test('counts the week from WKST', () => {
  assert.deepStrictEqual(startsOf('weekly', '[Week starts Monday]', ...january), [
    '2027-01-05T09:00:00.000Z', '2027-01-10T09:00:00.000Z', '2027-01-19T09:00:00.000Z', '2027-01-24T09:00:00.000Z',
  ]);
  assert.deepStrictEqual(startsOf('weekly', '[Week starts Sunday]', ...january), [
    '2027-01-05T09:00:00.000Z', '2027-01-17T09:00:00.000Z', '2027-01-19T09:00:00.000Z', '2027-01-31T09:00:00.000Z',
  ]);

  const notGiven = startsOf('weekly', '[Week start not given]', ...january);
  assert.deepStrictEqual(notGiven, startsOf('weekly', '[Week starts Monday]', ...january), 'Monday is the default');
});

test('repeats daily on some weekdays only', () => {
  assert.deepStrictEqual(startsOf('weekly', '[Weekdays only]', ...january), [
    '2027-01-11T14:00:00.000Z', '2027-01-12T14:00:00.000Z', '2027-01-13T14:00:00.000Z', '2027-01-14T14:00:00.000Z',
    '2027-01-15T14:00:00.000Z', '2027-01-18T14:00:00.000Z', '2027-01-19T14:00:00.000Z',
  ]);
});

test('always counts the start as the first occurrence', () => {
  assert.deepStrictEqual(startsOf('weekly', '[Starts on a Thursday]', utc(2027, 1, 1), utc(2027, 2, 2)), [
    '2027-01-07T14:00:00.000Z', '2027-01-11T14:00:00.000Z', '2027-01-18T14:00:00.000Z',
    '2027-01-25T14:00:00.000Z', '2027-02-01T14:00:00.000Z',
  ]);
});

test('repeats monthly on a numbered weekday such as 2TU', () => {
  const events = occurrencesOf('monthly', '[Second Tuesday]', local(2027, 1, 1), local(2027, 5, 1));
  assert.deepStrictEqual(events.map(event => event.start), [
    local(2027, 1, 12, 17), local(2027, 2, 9, 17), local(2027, 3, 9, 17), local(2027, 4, 13, 17),
  ]);
});

test('repeats monthly on the last Friday', () => {
  assert.deepStrictEqual(startsOf('monthly', '[Last Friday]', utc(2027, 1, 1), utc(2027, 5, 1)), [
    '2027-01-29T17:00:00.000Z', '2027-02-26T17:00:00.000Z', '2027-03-26T17:00:00.000Z', '2027-04-30T17:00:00.000Z',
  ]);
});

test('repeats monthly on a day of the month, counting from the end when negative', () => {
  assert.deepStrictEqual(startsOf('monthly', '[Fifteenth]', utc(2027, 1, 1), utc(2027, 5, 1)), [
    '2027-01-15T15:00:00.000Z', '2027-02-15T15:00:00.000Z', '2027-03-15T15:00:00.000Z', '2027-04-15T15:00:00.000Z',
  ]);
  assert.deepStrictEqual(startsOf('monthly', '[Last day of the month]', utc(2027, 1, 1), utc(2027, 5, 1)), [
    '2027-01-31T15:00:00.000Z', '2027-02-28T15:00:00.000Z', '2027-03-31T15:00:00.000Z', '2027-04-30T15:00:00.000Z',
  ]);
});

test('skips months that have no day 31', () => {
  assert.deepStrictEqual(daysOf('monthly', '[Thirty first]', utc(2027, 1, 1), utc(2028, 1, 1)), [
    '2027-01-31', '2027-03-31', '2027-05-31', '2027-07-31', '2027-08-31', '2027-10-31', '2027-12-31',
  ]);
});

test('repeats monthly with an interval and with COUNT', () => {
  assert.deepStrictEqual(daysOf('monthly', '[Every third month]', utc(2027, 1, 1), utc(2028, 2, 1)), [
    '2027-01-10', '2027-04-10', '2027-07-10', '2027-10-10', '2028-01-10',
  ]);
  assert.deepStrictEqual(daysOf('monthly', '[Twice only]', utc(2027, 1, 1), utc(2028, 1, 1)), ['2027-01-20', '2027-02-20']);
});

test('repeats yearly, including on a numbered weekday and on 29 February', () => {
  const years = [utc(2027, 1, 1), utc(2030, 1, 1)];
  const allDay = occurrencesOf('monthly', '[Every year]', ...years);
  assert.deepStrictEqual(allDay.map(event => event.start), [local(2027, 3, 1), local(2028, 3, 1), local(2029, 3, 1)]);

  assert.deepStrictEqual(daysOf('monthly', '[Fourth Thursday of November]', ...years), ['2027-11-25', '2028-11-23', '2029-11-22']);
  assert.deepStrictEqual(daysOf('monthly', '[Leap day]', utc(2028, 1, 1), utc(2033, 1, 1)), ['2028-02-29', '2032-02-29']);
  assert.deepStrictEqual(daysOf('monthly', '[Twentieth Monday of the year]', utc(2027, 1, 1), utc(2029, 1, 1)), ['2027-05-17', '2028-05-15']);
});

test('keeps a 6:00 PM New York event at 6:00 PM through both clock changes', () => {
  const events = occurrencesOf('daylight-saving', '[Wednesday 6 PM New York]', utc(2027, 1, 1), utc(2028, 1, 1));
  assert.strictEqual(events.length, 52);
  events.forEach(event => {
    assert.strictEqual(clockIn('America/New_York', event.start), '18:00', iso(event.start));
    assert.strictEqual(event.end - event.start, 90 * 60000);
  });

  const starts = events.map(event => iso(event.start));
  ['2027-03-10T23:00:00.000Z', '2027-03-17T22:00:00.000Z', '2027-11-03T22:00:00.000Z', '2027-11-10T23:00:00.000Z']
    .forEach(expected => assert.ok(starts.includes(expected), expected));
});

test('gets the day of the clock change right', () => {
  assert.deepStrictEqual(startsOf('daylight-saving', '[Daily 6 PM New York]', utc(2027, 3, 1), utc(2027, 4, 1)), [
    '2027-03-12T23:00:00.000Z', '2027-03-13T23:00:00.000Z', '2027-03-14T22:00:00.000Z', '2027-03-15T22:00:00.000Z',
  ]);
});

test('takes the later time when the clocks skip an hour, and the first when one repeats', () => {
  assert.deepStrictEqual(startsOf('daylight-saving', '[Sunday 2:30 AM New York]', utc(2027, 3, 1), utc(2027, 4, 1)), [
    '2027-03-07T07:30:00.000Z', '2027-03-14T07:30:00.000Z', '2027-03-21T06:30:00.000Z',
  ]);
  assert.deepStrictEqual(startsOf('daylight-saving', '[Sunday 1:30 AM New York]', utc(2027, 10, 1), utc(2027, 12, 1)), [
    '2027-10-31T05:30:00.000Z', '2027-11-07T05:30:00.000Z', '2027-11-14T06:30:00.000Z',
  ]);
});

test('follows the clock changes of other zones', () => {
  assert.deepStrictEqual(startsOf('daylight-saving', '[Wednesday 6 PM London]', utc(2027, 3, 1), utc(2027, 5, 1)), [
    '2027-03-24T18:00:00.000Z', '2027-03-31T17:00:00.000Z', '2027-04-07T17:00:00.000Z',
  ]);
  assert.deepStrictEqual(startsOf('daylight-saving', '[Kolkata evening]', utc(2027, 3, 1), utc(2027, 4, 1)), ['2027-03-12T12:30:00.000Z']);
});

test('reads midnight in a zone', () => {
  const event = occurrenceNamed('daylight-saving', '[Midnight New York]', utc(2027, 3, 1), utc(2027, 4, 1));
  assert.deepStrictEqual([iso(event.start), iso(event.end)], ['2027-03-14T05:00:00.000Z', '2027-03-14T06:00:00.000Z']);
});

test('keeps a time with no zone on the local clock, and a UTC time on UTC', () => {
  const march = [local(2027, 3, 1), local(2027, 4, 1)];
  const floating = occurrencesOf('daylight-saving', '[Daily 6 PM floating]', ...march);
  assert.deepStrictEqual(floating.map(event => event.start), [12, 13, 14, 15].map(day => local(2027, 3, day, 18)));

  const fixed = occurrencesOf('daylight-saving', '[Daily 10 PM UTC]', ...march);
  assert.deepStrictEqual(fixed.map(event => event.start), [12, 13, 14, 15].map(day => utc(2027, 3, day, 22)));
});

test('keeps an all-day event from midnight to midnight across a clock change', () => {
  const events = occurrencesOf('daylight-saving', '[Two days across the change]', local(2027, 3, 1), local(2027, 4, 1));
  assert.deepStrictEqual(events.map(event => [event.start, event.end]), [
    [local(2027, 3, 13), local(2027, 3, 15)],
    [local(2027, 3, 20), local(2027, 3, 22)],
  ]);
});

test('lets a changed occurrence replace the one it changes, and drops cancelled and excluded ones', () => {
  const found = expandFixture('overrides', utc(2027, 1, 1), utc(2027, 2, 14))
    .filter(event => event.uid === 'meeting-1' || event.uid === 'orphan-change')
    .map(event => [iso(event.start), event.title, event.location]);
  assert.deepStrictEqual(found, [
    ['2027-01-05T23:00:00.000Z', '[Weekly meeting]', '[Room A]'],
    ['2027-01-14T00:00:00.000Z', '[Weekly meeting moved]', '[Room B]'],
    ['2027-02-02T23:00:00.000Z', '[Weekly meeting with a guest]', ''],
    ['2027-02-08T15:00:00.000Z', '[Change with no series]', ''],
    ['2027-02-09T17:00:00.000Z', '[Weekly meeting moved earlier]', ''],
    ['2027-02-09T23:00:00.000Z', '[Weekly meeting]', '[Room A]'],
  ]);
});

test('shows an occurrence that was moved into the range, and not one moved out of it', () => {
  const titles = titlesOf(expandFixture('overrides', utc(2027, 2, 9), utc(2027, 2, 10)));
  assert.ok(titles.includes('[Weekly meeting moved earlier]'));

  const later = titlesOf(expandFixture('overrides', utc(2027, 2, 20), utc(2027, 2, 28)));
  assert.ok(!later.includes('[Weekly meeting moved out of range]'));
  assert.ok(!later.includes('[Weekly meeting]'), 'the occurrence on 23 February was moved away');
});

test('moves an all-day occurrence that was changed by date', () => {
  const found = expandFixture('overrides', local(2027, 1, 30), local(2027, 2, 20)).filter(event => event.uid === 'all-day-series');
  assert.deepStrictEqual(found.map(event => [event.title, event.start]), [
    ['[All day series]', local(2027, 2, 1)],
    ['[All day series moved a day]', local(2027, 2, 9)],
    ['[All day series]', local(2027, 2, 15)],
  ]);
});

test('shows only the first occurrence of a rule it cannot use', () => {
  const found = expandFixture('odd-input', utc(2027, 1, 1), utc(2028, 1, 1));
  ['[Rule with a set position]', '[Hourly rule]', '[Garbage rule]', '[Rule with a week number]',
    '[Rule with a bad weekday]', '[Interval of zero]', '[Until nothing readable]']
    .forEach(title => {
      const matching = found.filter(event => event.title === title);
      assert.strictEqual(matching.length, 1, title);
      assert.strictEqual(iso(matching[0].start), '2027-02-01T15:00:00.000Z', title);
    });
});

test('reads a zone name it does not know as the local clock', () => {
  const found = expandFixture('odd-input', utc(2027, 1, 1), utc(2028, 1, 1));
  const unknown = found.find(event => event.title === '[Zone nobody knows]');
  assert.deepStrictEqual([unknown.start, unknown.end], [local(2027, 2, 1, 18), local(2027, 2, 1, 19)]);
  assert.deepStrictEqual(found.find(event => event.title === '[Zone with an object name]').start, local(2027, 2, 2, 18));
});

test('accepts dates with dashes, fractions of a second and lower case names', () => {
  const titles = titlesOf(expandFixture('odd-input', utc(2027, 1, 1), utc(2028, 1, 1)));
  ['[Dates with dashes]', '[Seconds with a fraction]', '[Lower case names]', '[Quoted parameter]']
    .forEach(title => assert.ok(titles.includes(title), title));
});

test('skips events with a date that makes no sense, and gives an event that ends early no length', () => {
  const found = expandFixture('odd-input', utc(2027, 1, 1), utc(2028, 12, 1));
  assert.ok(!titlesOf(found).includes('[Bad date]'));
  assert.ok(!titlesOf(found).includes('[Month thirteen]'));

  const early = found.find(event => event.title === '[Ends before it starts]');
  assert.strictEqual(early.end.getTime(), early.start.getTime());
});

test('returns the occurrences that overlap the range, including one already under way', () => {
  const found = expandFixture('single-events', utc(2027, 1, 13, 23, 30), utc(2027, 1, 14, 0, 10));
  assert.deepStrictEqual(titlesOf(found), ['[New York event]']);
});

test('sorts the occurrences by start', () => {
  const everything = expandFixture('weekly', utc(2027, 1, 1), utc(2027, 3, 1));
  assert.ok(everything.length > 20);
  for (let index = 1; index < everything.length; index++) {
    assert.ok(everything[index - 1].start <= everything[index].start, 'out of order at ' + index);
  }
});

test('counts the start of the range but not the end', () => {
  assert.strictEqual(expandFixture('single-events', utc(2027, 1, 1), utc(2027, 1, 12, 23)).length, 0, 'the range ends as the event starts');
  assert.strictEqual(expandFixture('single-events', utc(2027, 1, 1), utc(2027, 1, 12, 23, 1)).length, 1);
  assert.strictEqual(expandFixture('single-events', utc(2027, 1, 13), utc(2027, 1, 13, 1)).length, 0, 'ended as the range starts');
});

// Runs something and fails when it takes longer than the limit, in milliseconds.
// The limits are many times what a slow computer needs.
function finishesWithin(limit, run) {
  const began = Date.now();
  const result = run();
  const took = Date.now() - began;

  assert.ok(took < limit, 'took ' + took + ' ms, and the limit is ' + limit + ' ms');
  return result;
}

test('finishes quickly on a rule that never matches, and on an event that started long ago', () => {
  const never = parseIcs([
    'BEGIN:VEVENT', 'UID:never', 'DTSTART:20270101T120000Z', 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30',
    'SUMMARY:[Never]', 'END:VEVENT',
  ].join('\n'));
  const foundNever = finishesWithin(1000, () => expandEvents(never, utc(2027, 1, 1), utc(2090, 1, 1)));
  assert.strictEqual(foundNever.length, 1);

  const longAgo = parseIcs('BEGIN:VEVENT\nUID:old\nDTSTART:20150101T120000Z\nRRULE:FREQ=DAILY\nSUMMARY:[Old]\nEND:VEVENT');
  const foundOld = finishesWithin(1000, () => expandEvents(longAgo, utc(2027, 1, 1), utc(2027, 1, 8)));
  assert.strictEqual(foundOld.length, 7);
});

// A series that repeats three times, with its second occurrence moved an hour later
function seriesWithChange(number) {
  return [
    'BEGIN:VEVENT', 'UID:series-' + number, 'DTSTART:20270105T150000Z', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:[Series ' + number + ']', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:series-' + number, 'RECURRENCE-ID:20270112T150000Z', 'DTSTART:20270112T160000Z', 'SUMMARY:[Moved ' + number + ']', 'END:VEVENT',
  ];
}

test('finishes quickly on a big calendar where every series has a changed occurrence', () => {
  const lines = ['BEGIN:VCALENDAR'];
  for (let number = 0; number < 16000; number++) lines.push(...seriesWithChange(number));
  lines.push('END:VCALENDAR');

  const parsed = parseIcs(lines.join('\n'));
  const found = finishesWithin(1000, () => expandEvents(parsed, utc(2027, 1, 1), utc(2027, 3, 1)));

  assert.strictEqual(found.length, 48000);
  assert.strictEqual(found.filter(event => event.title.startsWith('[Moved ')).length, 16000);
  assert.strictEqual(found.filter(event => iso(event.start) === '2027-01-12T15:00:00.000Z').length, 0, 'the moved occurrence is gone from its old time');
});

test('limits how many occurrences it makes from a rule that has no end', () => {
  const daily = parseIcs('BEGIN:VEVENT\nUID:daily\nDTSTART:20270101T120000Z\nRRULE:FREQ=DAILY\nSUMMARY:[Daily]\nEND:VEVENT');
  const found = expandEvents(daily, utc(2027, 1, 1), utc(2100, 1, 1));
  assert.ok(found.length > 0 && found.length <= 5000, 'found ' + found.length);
});

test('copes with a file that is cut short or missing END lines', () => {
  const cut = [
    'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a', 'DTSTART:20270105T150000Z', 'SUMMARY:[First]',
    'BEGIN:VEVENT', 'UID:b', 'DTSTART:20270106T150000Z', 'SUMMARY:[Second]',
  ].join('\n');
  assert.deepStrictEqual(titlesOf(parseIcs(cut)), ['[First]', '[Second]']);
  assert.deepStrictEqual(parseIcs('BEGIN:VEVENT\nUID:a\nSUMMARY:[No start]\nEND:VEVENT'), []);
});

test('never throws on input that is not a calendar', () => {
  const notCalendars = [
    undefined, null, '', ' ', 0, 42, {}, [], true, '\u0000\u0001', 'BEGIN:VEVENT', 'BEGIN:VEVENT\nEND:VEVENT',
    ':::;;;===', '"unclosed:quote', 'DTSTART:20270101',
  ];
  notCalendars.forEach(input => {
    assert.deepStrictEqual(parseIcs(input), [], String(input));
  });
  [undefined, null, {}, 'text', []].forEach(input => {
    assert.deepStrictEqual(expandEvents(input, utc(2027, 1, 1), utc(2027, 2, 1)), []);
  });
  assert.deepStrictEqual(expandEvents(parseIcs(fixtureText('weekly')), undefined, undefined), []);
  assert.deepStrictEqual(expandEvents(parseIcs(fixtureText('weekly')), 'not a date', utc(2027, 2, 1)), []);
});

test('accepts the range as text as well as Date objects', () => {
  const parsed = parseIcs(fixtureText('single-events'));
  assert.strictEqual(expandEvents(parsed, '2027-01-12T00:00:00Z', '2027-01-13T12:00:00Z').length, 1);
});

// A small, repeatable source of random numbers, so a failure can be run again
function randomNumbers(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function damage(text, random) {
  const junk = '\n:;=,\\" TZ0123456789-';
  const cut = Math.floor(random() * text.length);
  const length = Math.floor(random() * 40);

  switch (Math.floor(random() * 5)) {
    case 0: return text.slice(0, cut);
    case 1: return text.slice(0, cut) + text.slice(cut + length);
    case 2: return text.slice(0, cut) + junk[Math.floor(random() * junk.length)] + text.slice(cut + 1);
    case 3: return text.slice(0, cut) + text.slice(cut, cut + length) + text.slice(cut);
    default: return text.split('\n').sort(() => random() - 0.5).join('\n');
  }
}

test('survives damaged copies of every fixture', () => {
  const random = randomNumbers(3229);
  ['single-events', 'weekly', 'monthly', 'daylight-saving', 'overrides', 'odd-input', 'text'].forEach(name => {
    for (let round = 0; round < 40; round++) {
      let text = fixtureText(name);
      for (let hits = 0; hits <= round % 4; hits++) text = damage(text, random);

      const found = expandEvents(parseIcs(text), utc(2026, 1, 1), utc(2029, 1, 1));
      found.forEach(event => {
        assert.ok(!isNaN(event.start) && !isNaN(event.end), name + ' round ' + round + ': a date is not valid');
        assert.ok(event.end >= event.start, name + ' round ' + round + ': ends before it starts');
        assert.strictEqual(typeof event.title, 'string');
        assert.strictEqual(typeof event.location, 'string');
      });
    }
  });
});

test('the sample calendar always has something coming up, whatever the date', () => {
  const parsed = parseIcs(fs.readFileSync(new URL('../dashboard/data/sample/calendars/team.ics', import.meta.url), 'utf8'));
  assert.ok(parsed.length >= 4 && parsed.length <= 6, 'the sample should have 4 to 6 events');
  assert.ok(parsed.every(event => event.rule), 'every sample event repeats');
  assert.ok(parsed.some(event => event.allDay), 'one sample event lasts all day');
  assert.ok(parsed.some(event => event.start.zone === 'America/New_York'), 'one sample event has a TZID');

  for (let offset = 0; offset < 3 * 365; offset++) {
    const day = local(2026, 1, 1 + offset);
    const soon = expandEvents(parsed, day, local(2026, 1, 15 + offset));
    assert.ok(soon.length > 0, 'nothing within 14 days of ' + day.toDateString());
  }

  const month = expandEvents(parsed, local(2026, 10, 2), local(2026, 12, 2));
  assert.strictEqual(new Set(titlesOf(month)).size, parsed.length, 'every sample event turns up within 60 days');
  month.forEach(event => {
    assert.ok(/^\[.+\]$/.test(event.title), event.title);
    assert.ok(/^\[.+\]$/.test(event.location), event.location);
  });
});

// loadEvents reads files with fetch, so these tests give it a fetch that
// serves the fixtures. An address under sample/ serves the sample calendar.
const noon = local(2027, 1, 15, 12);
const team = [{ id: 'single-events', name: '[Team]' }];
const sampleFolder = new URL('../dashboard/data/sample/calendars/', import.meta.url);

function serveFixtures(inline) {
  const calls = [];
  globalThis.fetch = async (address, options) => {
    calls.push({ address: address, options: options });
    const id = address.replace(/^(calendars|sample)\//, '').replace(/\.ics$/, '');
    const answer = text => ({ ok: true, status: 200, text: async () => text });

    if (id === 'offline') throw new TypeError('Failed to fetch');
    if (inline[id] !== undefined) return answer(inline[id]);
    if (address.startsWith('sample/')) return answer(fs.readFileSync(new URL(id + '.ics', sampleFolder), 'utf8'));
    if (!fs.existsSync(new URL(id + '.ics', fixtureFolder))) return { ok: false, status: 404, text: async () => '' };
    return answer(fixtureText(id));
  };
  return calls;
}

async function withoutWarnings(body) {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return await body();
  } finally {
    console.warn = warn;
  }
}

test('loadEvents merges the calendars that are switched on and tags each event with its name', async () => {
  const calls = serveFixtures({});
  const { events, failed } = await loadEvents({
    folder: 'calendars/',
    calendars: [
      { id: 'single-events', name: '[Team]', show: true },
      { id: 'weekly', name: '[Robotics]' },
      { id: 'monthly', name: '[Hidden]', show: false },
    ],
    now: noon,
    daysAhead: 14,
  });

  assert.deepStrictEqual(failed, []);
  assert.deepStrictEqual(calls.map(call => call.address), ['calendars/single-events.ics', 'calendars/weekly.ics']);
  calls.forEach(call => assert.deepStrictEqual(call.options, { cache: 'no-store' }));

  assert.ok(events.some(event => event.calendar === '[Team]'));
  assert.ok(events.some(event => event.calendar === '[Robotics]'));
  assert.ok(!events.some(event => event.calendar === '[Hidden]'));
  for (let index = 1; index < events.length; index++) {
    assert.ok(events[index - 1].start <= events[index].start, 'out of order at ' + index);
  }
});

test('loadEvents drops events that have ended, keeps one under way, and stops at daysAhead', async () => {
  serveFixtures({});
  const { events } = await loadEvents({ folder: 'calendars/', calendars: team, now: noon, daysAhead: 10 });
  const titles = titlesOf(events);

  assert.ok(!titles.includes('[UTC event]'), 'ended days ago');
  assert.ok(!titles.includes('[New York event]'), 'ended days ago');
  assert.ok(!titles.includes('[Floating event]'), 'ended yesterday, but starts inside the range');
  assert.ok(titles.includes('[All day event]'), 'all day, and today');
  assert.ok(titles.includes('[Three day event]'));
  assert.ok(!titles.includes('[Duration event]'), 'more than ten days away');
  assert.ok(!titles.includes('[Alarm event]'), 'more than ten days away');
});

test('loadEvents finds an event that is on right now, and not one that just ended', async () => {
  serveFixtures({});
  const now = local(2027, 1, 14, 17, 45);
  const early = await loadEvents({ folder: 'calendars/', calendars: team, now: now, daysAhead: 1 });
  assert.deepStrictEqual(titlesOf(early.events), ['[Floating event]', '[All day event]'], 'the first is on until 6:30 PM');
});

test('loadEvents lists the calendars it could not read and carries on with the others', async () => {
  serveFixtures({
    broken: '<html><body>Not found</body></html>',
    empty: '',
    quiet: 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR\n',
  });

  const result = await withoutWarnings(() => loadEvents({
    folder: 'calendars/',
    calendars: [
      { id: 'single-events', name: '[Team]' },
      { id: 'missing', name: '[Missing]' },
      { id: 'broken', name: '[Broken]' },
      { id: 'offline', name: '[Offline]' },
      { id: 'empty', name: '[Empty]' },
      { id: 'quiet', name: '[Quiet]' },
      { id: 'weekly', name: '[Robotics]' },
    ],
    now: noon,
    daysAhead: 14,
  }));

  assert.deepStrictEqual(result.failed, ['missing', 'broken', 'offline', 'empty']);
  assert.ok(result.events.some(event => event.calendar === '[Team]'));
  assert.ok(result.events.some(event => event.calendar === '[Robotics]'));
});

// A calendar with one event, padded with a long note line to the given length
function paddedCalendar(length) {
  const event = ['BEGIN:VEVENT', 'UID:padded', 'DTSTART:20270116T150000Z', 'SUMMARY:[Padded event]', 'END:VEVENT'];
  const head = 'BEGIN:VCALENDAR\nX-NOTE:';
  const tail = '\n' + event.join('\n') + '\nEND:VCALENDAR\n';
  return head + 'a'.repeat(length - head.length - tail.length) + tail;
}

test('loadEvents refuses a file over 2 MB as a failed read, and still reads a file just under it', async () => {
  serveFixtures({ huge: paddedCalendar(2000001), large: paddedCalendar(2000000) });

  const result = await withoutWarnings(() => loadEvents({
    folder: 'calendars/',
    calendars: [
      { id: 'huge', name: '[Huge]' },
      { id: 'large', name: '[Large]' },
      { id: 'single-events', name: '[Team]' },
    ],
    now: noon,
    daysAhead: 14,
  }));

  assert.deepStrictEqual(result.failed, ['huge']);
  assert.deepStrictEqual(result.events.filter(event => event.calendar === '[Large]').map(event => event.title), ['[Padded event]']);
  assert.ok(result.events.some(event => event.calendar === '[Team]'));
  assert.ok(!result.events.some(event => event.calendar === '[Huge]'));
});

test('loadEvents copes with no calendars, odd entries and a missing name', async () => {
  serveFixtures({});
  const nothing = { events: [], failed: [] };
  assert.deepStrictEqual(await loadEvents(), nothing);
  assert.deepStrictEqual(await loadEvents({ folder: 'calendars/', calendars: [] }), nothing);
  assert.deepStrictEqual(await loadEvents({ folder: 'calendars/', calendars: null }), nothing);
  assert.deepStrictEqual(await loadEvents({ folder: 'calendars/', calendars: [null, {}, { name: '[No id]' }] }), nothing);

  const unnamed = await loadEvents({ folder: 'calendars/', calendars: [{ id: 'single-events' }], now: noon, daysAhead: 14 });
  assert.ok(unnamed.events.length > 0);
  unnamed.events.forEach(event => assert.strictEqual(event.calendar, ''));
});

test('loadEvents shows the sample calendar for any date', async () => {
  serveFixtures({});
  for (const now of [local(2026, 10, 2, 12), local(2027, 1, 9, 12), local(2028, 2, 29, 23, 59)]) {
    const sample = [{ id: 'team', name: '[Team calendar]', show: true }];
    const { events, failed } = await loadEvents({ folder: 'sample/', calendars: sample, now: now, daysAhead: 60 });
    assert.deepStrictEqual(failed, []);
    assert.ok(events.length >= 10, 'found ' + events.length);
    assert.ok(events.every(event => event.calendar === '[Team calendar]' && event.end > now));
  }
});

// The Calendar filters (core/events.js), run on the events of the weekly and overrides
// calendars after their repeating events are expanded. The rules are shaped the way
// core/sanity.js cleans them. The Look time zone is New York, and the clock reads noon
// on 1 January 2027.
const newYork = 'America/New_York';
const filterNow = utc(2027, 1, 1, 17);
const bothCalendars = [{ id: 'weekly', name: '[Robotics]' }, { id: 'overrides', name: '[Meetings]' }];
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function filterRule(action, fields) {
  return Object.assign({ name: '[Rule]', action: action, words: [], days: [], calendar: '', fromDate: '', toDate: '' }, fields);
}
const hide = fields => filterRule('hide', fields);
const alwaysShow = fields => filterRule('show', fields);

// Events that start at the given UTC moments, such as 20270111T220000Z
function calendarOf(events) {
  const lines = ['BEGIN:VCALENDAR'];
  events.forEach(([title, startsAt], place) => {
    lines.push('BEGIN:VEVENT', 'UID:filter-' + place, 'DTSTART:' + startsAt, 'SUMMARY:' + title, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\n') + '\n';
}

// What the screen would list: the calendars read, merged with the Events Calendar entries and filtered.
// options: calendars, inline (calendar files by id), extra (Events Calendar entries), zone, now
async function shownWith(rules, options = {}) {
  serveFixtures(options.inline || {});
  const { events } = await loadEvents({ folder: 'calendars/', calendars: options.calendars || bothCalendars, now: filterNow, daysAhead: 60 });
  return mergeEvents(events, options.extra || [], options.zone || newYork, options.now || filterNow, rules);
}

const lineOf = event => event.firstDay + ' ' + event.title;
const linesOf = events => events.map(lineOf);
const firstDaysOf = (events, title) => events.filter(event => event.title === title).map(event => event.firstDay);

// The day of the week on the wall in New York, worked out here and not by events.js. An all-day
// event is on the day of this computer's clock, the way the calendar reader makes it.
function newYorkWeekday(event) {
  if (event.allDay) return weekdayNames[event.start.getDay()];
  return new Intl.DateTimeFormat('en-US', { timeZone: newYork, weekday: 'short' }).format(event.start);
}

test('a Hide rule on Monday and Thursday takes away every event on those days and nothing else', async () => {
  const everything = await shownWith([]);
  const filtered = await shownWith([hide({ name: '[Monday and Thursday]', days: [1, 4] })]);

  const expected = everything.filter(event => !['Mon', 'Thu'].includes(newYorkWeekday(event)));
  assert.ok(everything.length - expected.length >= 15, 'the calendars have events on those days');
  assert.deepStrictEqual(linesOf(filtered), linesOf(expected));
  filtered.forEach(event => assert.ok(!['Mon', 'Thu'].includes(newYorkWeekday(event)), lineOf(event)));

  assert.deepStrictEqual(firstDaysOf(everything, '[Weekdays only]'), ['2027-01-11', '2027-01-12', '2027-01-13', '2027-01-14', '2027-01-15', '2027-01-18', '2027-01-19']);
  assert.deepStrictEqual(firstDaysOf(filtered, '[Weekdays only]'), ['2027-01-12', '2027-01-13', '2027-01-15', '2027-01-19']);
  assert.deepStrictEqual(firstDaysOf(filtered, '[Starts on a Thursday]'), [], 'a Thursday and a string of Mondays');
  assert.deepStrictEqual(firstDaysOf(filtered, '[Weekly meeting]'), ['2027-01-05', '2027-02-09'], 'a Tuesday meeting is left alone');
});

test('a Thursday-only rule takes the Thursday occurrence of a series and leaves its Mondays', async () => {
  const everything = await shownWith([]);
  const filtered = await shownWith([hide({ days: [4] })]);

  assert.deepStrictEqual(firstDaysOf(everything, '[Starts on a Thursday]'), [
    '2027-01-07', '2027-01-11', '2027-01-18', '2027-01-25', '2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22', '2027-03-01',
  ]);
  assert.deepStrictEqual(firstDaysOf(filtered, '[Starts on a Thursday]'), [
    '2027-01-11', '2027-01-18', '2027-01-25', '2027-02-01', '2027-02-08', '2027-02-15', '2027-02-22', '2027-03-01',
  ]);
  assert.deepStrictEqual(firstDaysOf(filtered, '[Weekdays only]'), ['2027-01-11', '2027-01-12', '2027-01-13', '2027-01-15', '2027-01-18', '2027-01-19']);
  assert.deepStrictEqual(linesOf(filtered), linesOf(everything.filter(event => newYorkWeekday(event) !== 'Thu')));
});

test('a rule judges each occurrence by the day it falls on, also one that was moved to another day', async () => {
  const everything = await shownWith([]);
  assert.deepStrictEqual(firstDaysOf(everything, '[Weekly meeting moved]'), ['2027-01-13'], 'moved from the Tuesday to the Wednesday');

  const wednesdays = await shownWith([hide({ days: [3] })]);
  assert.deepStrictEqual(firstDaysOf(wednesdays, '[Weekly meeting moved]'), []);
  assert.deepStrictEqual(firstDaysOf(wednesdays, '[Weekly meeting]'), ['2027-01-05', '2027-02-09']);

  const tuesdays = await shownWith([hide({ days: [2] })]);
  assert.deepStrictEqual(firstDaysOf(tuesdays, '[Weekly meeting moved]'), ['2027-01-13']);
  assert.deepStrictEqual(firstDaysOf(tuesdays, '[Weekly meeting]'), []);
});

test('an Always show rule keeps the events a Hide rule would take, in whatever order the rules come', async () => {
  const everything = await shownWith([]);
  const mondayAndThursday = hide({ name: '[Monday and Thursday]', days: [1, 4] });
  const keepWeekdays = alwaysShow({ name: '[Keep weekdays]', words: ['weekdays'] });

  const forward = await shownWith([mondayAndThursday, keepWeekdays]);
  const backward = await shownWith([keepWeekdays, mondayAndThursday]);
  assert.deepStrictEqual(linesOf(backward), linesOf(forward));
  assert.deepStrictEqual(firstDaysOf(forward, '[Weekdays only]'), firstDaysOf(everything, '[Weekdays only]'), 'every Monday and Thursday is back');
  assert.deepStrictEqual(firstDaysOf(forward, '[Starts on a Thursday]'), [], 'and the other events of those days are still hidden');

  assert.deepStrictEqual(linesOf(await shownWith([keepWeekdays])), linesOf(everything), 'on its own it hides nothing');
  const unrelated = alwaysShow({ words: ['kickoff'] });
  assert.deepStrictEqual(linesOf(await shownWith([mondayAndThursday, unrelated])), linesOf(await shownWith([mondayAndThursday])), 'a rule that does not match keeps nothing');

  // an Always show rule has to match on every condition it has, like any rule
  const keepMondays = alwaysShow({ words: ['weekdays'], days: [1] });
  const mondaysBack = await shownWith([mondayAndThursday, keepMondays]);
  assert.deepStrictEqual(firstDaysOf(mondaysBack, '[Weekdays only]'), ['2027-01-11', '2027-01-12', '2027-01-13', '2027-01-15', '2027-01-18', '2027-01-19']);
});

test('a rule for one date hides the events of that date and no other', async () => {
  const everything = await shownWith([]);
  const filtered = await shownWith([hide({ fromDate: '2027-01-11', toDate: '2027-01-11' })]);

  assert.ok(everything.some(event => event.firstDay === '2027-01-11'));
  assert.deepStrictEqual(linesOf(filtered), linesOf(everything.filter(event => event.firstDay !== '2027-01-11')));
  assert.deepStrictEqual(firstDaysOf(filtered, '[Weekdays only]'), ['2027-01-12', '2027-01-13', '2027-01-14', '2027-01-15', '2027-01-18', '2027-01-19']);

  const oneTitle = await shownWith([hide({ words: ['weekdays'], fromDate: '2027-01-18', toDate: '2027-01-18' })]);
  assert.deepStrictEqual(firstDaysOf(oneTitle, '[Weekdays only]'), ['2027-01-11', '2027-01-12', '2027-01-13', '2027-01-14', '2027-01-15', '2027-01-19']);
  assert.deepStrictEqual(firstDaysOf(oneTitle, '[Starts on a Thursday]'), firstDaysOf(everything, '[Starts on a Thursday]'), 'the other events of that date are not named');
});

test('a date range counts its first and last day, an open end goes on for ever, and an event is judged by the day it starts', async () => {
  const everything = await shownWith([]);

  const range = await shownWith([hide({ fromDate: '2027-01-12', toDate: '2027-01-14' })]);
  assert.deepStrictEqual(firstDaysOf(range, '[Weekdays only]'), ['2027-01-11', '2027-01-15', '2027-01-18', '2027-01-19']);
  assert.deepStrictEqual(linesOf(range), linesOf(everything.filter(event => event.firstDay < '2027-01-12' || event.firstDay > '2027-01-14')));

  const from = await shownWith([hide({ fromDate: '2027-01-15' })]);
  assert.ok(from.length > 0 && from.every(event => event.firstDay < '2027-01-15'), 'nothing from the 15th on');
  assert.deepStrictEqual(linesOf(from), linesOf(everything.filter(event => event.firstDay < '2027-01-15')));

  const until = await shownWith([hide({ toDate: '2027-01-15' })]);
  assert.ok(until.length > 0 && until.every(event => event.firstDay > '2027-01-15'), 'nothing up to the 15th');
  assert.deepStrictEqual(linesOf(until), linesOf(everything.filter(event => event.firstDay > '2027-01-15')));

  const mixed = await shownWith([hide({ words: ['weekdays'], fromDate: '2027-01-12', toDate: '2027-01-14' })]);
  assert.deepStrictEqual(firstDaysOf(mixed, '[Weekdays only]'), ['2027-01-11', '2027-01-15', '2027-01-18', '2027-01-19']);
  assert.deepStrictEqual(firstDaysOf(mixed, '[Starts on a Thursday]'), firstDaysOf(everything, '[Starts on a Thursday]'));

  // the three day event is on the 20th, 21st and 22nd of January
  const team = { calendars: [{ id: 'single-events', name: '[Team]' }] };
  const threeDays = async (fromDate, toDate) => firstDaysOf(await shownWith([hide({ fromDate: fromDate, toDate: toDate })], team), '[Three day event]');
  assert.deepStrictEqual(await threeDays('', ''), ['2027-01-20'], 'a rule with no date at all is no rule');
  assert.deepStrictEqual(await threeDays('2027-01-21', '2027-01-22'), ['2027-01-20'], 'it started before the range');
  assert.deepStrictEqual(await threeDays('2027-01-20', '2027-01-20'), []);
  assert.deepStrictEqual(await threeDays('2027-01-19', '2027-01-20'), []);
});

test('a rule for one calendar hides that calendar only, and a calendar nobody has hides nothing', async () => {
  const everything = await shownWith([]);
  assert.ok(everything.some(event => event.calendarId === 'overrides') && everything.some(event => event.calendarId === 'weekly'));

  const meetings = await shownWith([hide({ name: '[Hide the meetings]', calendar: 'overrides' })]);
  assert.deepStrictEqual(linesOf(meetings), linesOf(everything.filter(event => event.calendarId !== 'overrides')));
  assert.ok(meetings.every(event => event.calendarId === 'weekly'));

  const robotics = await shownWith([hide({ calendar: 'weekly' })]);
  assert.deepStrictEqual(linesOf(robotics), linesOf(everything.filter(event => event.calendarId === 'overrides')));

  // the calendar and a day together: a Tuesday on the other calendar stays
  const tuesdays = await shownWith([hide({ calendar: 'overrides', days: [2] })]);
  assert.deepStrictEqual(firstDaysOf(tuesdays, '[Weekly meeting]'), []);
  assert.deepStrictEqual(firstDaysOf(tuesdays, '[Weekly meeting moved]'), ['2027-01-13']);
  assert.deepStrictEqual(firstDaysOf(tuesdays, '[Every other Tuesday]'), firstDaysOf(everything, '[Every other Tuesday]'));

  assert.deepStrictEqual(linesOf(await shownWith([hide({ calendar: 'boosters' })])), linesOf(everything));
  assert.deepStrictEqual(linesOf(await shownWith([hide({ calendar: 'weekly' }), alwaysShow({ calendar: 'weekly', days: [1] })])), linesOf(everything.filter(event => event.calendarId === 'overrides' || newYorkWeekday(event) === 'Mon')));
});

test('a rule that is off or past its Hide after time does nothing, and one that has not expired yet still works', async () => {
  const everything = await shownWith([]);
  const rule = hide({ name: '[Monday and Thursday]', days: [1, 4] });
  const working = await shownWith([rule]);
  assert.ok(working.length < everything.length);

  assert.deepStrictEqual(linesOf(await shownWith([Object.assign({}, rule, { show: false })])), linesOf(everything), 'switched off');
  assert.deepStrictEqual(linesOf(await shownWith([Object.assign({}, rule, { show: true })])), linesOf(working), 'switched on');

  // the Hide after time is noon on the 20th in New York, and the clock decides
  const expires = '2027-01-20T17:00:00Z';
  const expiring = Object.assign({}, rule, { expires: expires });
  const lastMoment = new Date(Date.parse(expires) - 1);
  const noEvents = await shownWith([], { now: lastMoment });
  const withRule = await shownWith([rule], { now: lastMoment });
  assert.ok(withRule.length < noEvents.length);
  assert.deepStrictEqual(linesOf(await shownWith([expiring], { now: lastMoment })), linesOf(withRule), 'a millisecond before it');

  const atExpiry = new Date(expires);
  assert.deepStrictEqual(linesOf(await shownWith([expiring], { now: atExpiry })), linesOf(await shownWith([], { now: atExpiry })), 'at it the rule has stopped');

  // an Always show rule that is off or past its time keeps nothing
  const switchedOff = Object.assign({}, alwaysShow({ words: ['weekdays'] }), { show: false });
  const pastTime = Object.assign({}, alwaysShow({ words: ['weekdays'] }), { expires: '2027-01-01T12:00:00Z' });
  assert.deepStrictEqual(linesOf(await shownWith([rule, switchedOff])), linesOf(working));
  assert.deepStrictEqual(linesOf(await shownWith([rule, pastTime])), linesOf(working));
});

test('title words match inside the title in any capitals, and one of the words is enough', async () => {
  const everything = await shownWith([]);
  const titlesGone = async words => {
    const kept = titlesOf(await shownWith([hide({ words: words })]));
    return Array.from(new Set(titlesOf(everything))).filter(title => !kept.includes(title)).sort();
  };

  assert.deepStrictEqual(await titlesGone(['weekdays']), ['[Weekdays only]']);
  assert.deepStrictEqual(await titlesGone(['WEEKDAYS']), ['[Weekdays only]']);
  assert.deepStrictEqual(await titlesGone(['wEeKdAyS oNlY']), ['[Weekdays only]'], 'a word with a space in it');
  assert.deepStrictEqual(await titlesGone(['eekday']), ['[Weekdays only]'], 'inside another word');
  assert.deepStrictEqual(await titlesGone(['kickoff', 'weekdays']), ['[Weekdays only]'], 'one match is enough');
  assert.deepStrictEqual(await titlesGone(['kickoff']), []);
  assert.deepStrictEqual(await titlesGone([]), [], 'no words and no other condition is no rule');
  assert.deepStrictEqual(await titlesGone(['weekly MEETING']), [
    '[Weekly meeting moved earlier]', '[Weekly meeting moved out of range]', '[Weekly meeting moved]', '[Weekly meeting with a guest]', '[Weekly meeting]',
  ]);
});

test('the day of an event is the day on the clock of the Look time zone', async () => {
  // 3:30 AM UTC on Tuesday 12 January is 10:30 PM on Monday the 11th in New York and 12:30 PM on Tuesday in Tokyo
  const inline = { late: calendarOf([['[Late event]', '20270112T033000Z']]) };
  const options = zone => ({ calendars: [{ id: 'late', name: '[Late]' }], inline: inline, zone: zone });
  const mondays = [hide({ days: [1] })];
  const tuesdays = [hide({ days: [2] })];

  assert.deepStrictEqual(titlesOf(await shownWith(mondays, options(newYork))), []);
  assert.deepStrictEqual(titlesOf(await shownWith(tuesdays, options(newYork))), ['[Late event]']);
  assert.deepStrictEqual(titlesOf(await shownWith(mondays, options('Asia/Tokyo'))), ['[Late event]']);
  assert.deepStrictEqual(titlesOf(await shownWith(tuesdays, options('Asia/Tokyo'))), []);
  assert.deepStrictEqual(titlesOf(await shownWith(tuesdays, options('UTC'))), []);
});

test('a rule with no condition matches nothing, so a slip in the Studio cannot hide every event', async () => {
  const everything = await shownWith([]);
  assert.deepStrictEqual(linesOf(await shownWith([hide({})])), linesOf(everything));
  assert.deepStrictEqual(linesOf(await shownWith([hide({ name: '[Nothing]', words: [], days: [], calendar: '', fromDate: '', toDate: '' })])), linesOf(everything));
  assert.deepStrictEqual(linesOf(await shownWith([hide({ days: [4] }), alwaysShow({})])), linesOf(await shownWith([hide({ days: [4] })])), 'and an Always show with none keeps nothing');
});

test('no rules, a list that is not a list, and entries that are not rules leave every event on the screen', async () => {
  const everything = await shownWith([]);
  const unfiltered = linesOf(everything);

  assert.deepStrictEqual(linesOf(await shownWith(undefined)), unfiltered);
  assert.deepStrictEqual(linesOf(await shownWith(null)), unfiltered);
  assert.deepStrictEqual(linesOf(await shownWith('hide everything')), unfiltered);
  assert.deepStrictEqual(linesOf(await shownWith({ days: [1] })), unfiltered);
  assert.deepStrictEqual(linesOf(await shownWith([null, 'rule', 7, [], undefined])), unfiltered);

  const withJunk = await shownWith([null, hide({ days: [4] }), 'rule']);
  assert.deepStrictEqual(linesOf(withJunk), linesOf(await shownWith([hide({ days: [4] })])));
});

test('hidingRule gives the Hide rule that took an event away, and nothing for an event that shows', async () => {
  const everything = await shownWith([]);
  const monday = everything.find(event => event.title === '[Weekdays only]' && event.firstDay === '2027-01-11');
  const tuesday = everything.find(event => event.title === '[Weekdays only]' && event.firstDay === '2027-01-12');
  const byTitle = hide({ name: '[By title]', words: ['weekdays'] });
  const byDay = hide({ name: '[By day]', days: [1] });
  const keep = alwaysShow({ name: '[Keep]', words: ['weekdays'] });

  assert.strictEqual(hidingRule(monday, [byDay, byTitle], newYork, filterNow), byDay, 'the first rule in the list');
  assert.strictEqual(hidingRule(monday, [byTitle, byDay], newYork, filterNow), byTitle);
  assert.strictEqual(hidingRule(tuesday, [byDay], newYork, filterNow), null);
  assert.strictEqual(hidingRule(tuesday, [byDay, byTitle], newYork, filterNow), byTitle);
  assert.strictEqual(hidingRule(monday, [byDay, byTitle, keep], newYork, filterNow), null, 'an Always show rule wins');
  assert.strictEqual(hidingRule(monday, [keep], newYork, filterNow), null);

  [undefined, null, 'rules', {}, []].forEach(rules => assert.strictEqual(hidingRule(monday, rules, newYork, filterNow), null, JSON.stringify(rules)));
  [undefined, null, {}, { title: '[No start]' }, { title: '[Bad start]', start: 'soon' }].forEach(event => {
    assert.strictEqual(hidingRule(event, [byTitle, byDay], newYork, filterNow), null, JSON.stringify(event));
  });

  // an event that did not go through mergeEvents has no days yet, and gets them in the zone that is passed
  serveFixtures({ late: calendarOf([['[Late event]', '20270112T033000Z']]) });
  const { events } = await loadEvents({ folder: 'calendars/', calendars: [{ id: 'late', name: '[Late]' }], now: filterNow, daysAhead: 60 });
  assert.strictEqual('firstDay' in events[0], false);
  assert.strictEqual(hidingRule(events[0], [byDay], newYork, filterNow), byDay);
  assert.strictEqual(hidingRule(events[0], [byDay], 'UTC', filterNow), null);
});

test('the filters never touch an Events Calendar entry, and one that copies a hidden BAND event shows in its place', async () => {
  const typed = { title: '[Typed in Studio]', startDate: '2027-01-11', startTime: '10:00' };
  const rules = [hide({ name: '[Mondays]', days: [1] })];

  const shown = await shownWith(rules, { extra: [typed] });
  assert.deepStrictEqual(shown.filter(event => event.calendarId === 'extra').map(lineOf), ['2027-01-11 [Typed in Studio]']);
  assert.deepStrictEqual(firstDaysOf(shown.filter(event => event.calendarId === 'weekly'), '[Weekdays only]'), ['2027-01-12', '2027-01-13', '2027-01-14', '2027-01-15', '2027-01-19']);

  // the same event typed in and on BAND: with no rule the BAND one stays, with a rule that hides it the typed one does
  const copy = { title: '[Weekdays only]', startDate: '2027-01-11', startTime: '09:00' };
  const onJanuary11 = events => events.filter(event => event.title === '[Weekdays only]' && event.firstDay === '2027-01-11');
  assert.deepStrictEqual(onJanuary11(await shownWith([], { extra: [copy] })).map(event => event.calendarId), ['weekly']);
  assert.deepStrictEqual(onJanuary11(await shownWith(rules, { extra: [copy] })).map(event => event.calendarId), ['extra']);
});

test('the two example rules in the sample content hide Pre-Season on Monday and Thursday and keep Kickoff', async () => {
  const sample = normalizeSample(JSON.parse(fs.readFileSync(new URL('../dashboard/data/sample/content.json', import.meta.url), 'utf8')));
  assert.strictEqual(sample.calendarFilters.length, 2);
  sample.calendarFilters.forEach(rule => assert.ok(/^\[.+\]$/.test(rule.name), rule.name + ' is a marked placeholder'));

  const inline = {
    season: calendarOf([
      ['[Pre-Season build]', '20270111T220000Z'],
      ['[Pre-Season build]', '20270112T220000Z'],
      ['[PRE-SEASON mentors]', '20270114T220000Z'],
      ['[Kickoff Pre-Season party]', '20270118T220000Z'],
      ['[Build session]', '20270111T230000Z'],
    ]),
  };
  const options = { calendars: [{ id: 'season', name: '[Season]' }], inline: inline };
  assert.strictEqual((await shownWith([], options)).length, 5);

  assert.deepStrictEqual(linesOf(await shownWith(sample.calendarFilters, options)), [
    '2027-01-11 [Build session]',
    '2027-01-12 [Pre-Season build]',
    '2027-01-18 [Kickoff Pre-Season party]',
  ]);
});

let failures = 0;
for (const item of tests) {
  try {
    await item.body();
  } catch (error) {
    failures++;
    const details = String(error.stack || error).split('\n').slice(0, 14);
    console.log('FAIL  ' + item.name + '\n' + details.map(line => '      ' + line).join('\n'));
  }
}

const zoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
console.log((tests.length - failures) + ' of ' + tests.length + ' calendar tests passed (computer time zone ' + zoneName + ')');
process.exit(failures > 0 ? 1 : 0);
