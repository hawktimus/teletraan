// A repeating event keeps its clock time across the days the clocks change: 18:00 in New York stays 18:00 when the
// offset changes from -4 to -5 (November 1, 2026) and from -5 to -4 (March 14, 2027), so the UTC time moves by an hour,
// and a calendar written in another zone does the same in its own zone. core/calendar-expand.js, docs/audit.md item 20.
//
//   node tests/calendar-dst.test.mjs

import assert from 'node:assert/strict';
import { load, runTests, test } from './helpers/monday-world.mjs';

const { parseIcs } = await load('core/calendar-parse.js');
const { expandEvents } = await load('core/calendar-expand.js');

const file = lines => ['BEGIN:VCALENDAR', 'VERSION:2.0'].concat(lines, ['END:VCALENDAR']).join('\r\n');
const event = (...lines) => ['BEGIN:VEVENT', 'UID:dst-' + lines.length].concat(lines, ['END:VEVENT']);
const utc = list => list.map(item => item.start.toISOString());
const range = (from, to) => [new Date(from), new Date(to)];

test('a weekly event at 18:00 New York stays at 18:00 across the end of daylight time', () => {
  const [from, to] = range('2026-10-20T00:00:00Z', '2026-11-30T00:00:00Z');
  const found = expandEvents(parseIcs(file(event('SUMMARY:Build meeting', 'DTSTART;TZID=America/New_York:20261020T180000', 'DTEND;TZID=America/New_York:20261020T200000', 'RRULE:FREQ=WEEKLY;COUNT=6'))), from, to);
  assert.deepEqual(utc(found), [
    '2026-10-20T22:00:00.000Z', '2026-10-27T22:00:00.000Z', // EDT, UTC-4
    '2026-11-03T23:00:00.000Z', '2026-11-10T23:00:00.000Z', '2026-11-17T23:00:00.000Z', '2026-11-24T23:00:00.000Z', // EST, UTC-5, after November 1
  ]);
  assert.equal(found[2].end.toISOString(), '2026-11-04T01:00:00.000Z', 'and it still lasts two hours');
});

test('a daily event on the night the clocks change keeps its clock time the next morning', () => {
  const [from, to] = range('2026-10-30T00:00:00Z', '2026-11-04T00:00:00Z');
  const found = expandEvents(parseIcs(file(event('SUMMARY:Open shop', 'DTSTART;TZID=America/New_York:20261030T090000', 'DTEND;TZID=America/New_York:20261030T100000', 'RRULE:FREQ=DAILY;COUNT=5'))), from, to);
  assert.deepEqual(utc(found), [
    '2026-10-30T13:00:00.000Z', '2026-10-31T13:00:00.000Z', // 09:00 EDT
    '2026-11-01T14:00:00.000Z', '2026-11-02T14:00:00.000Z', '2026-11-03T14:00:00.000Z', // 09:00 EST: Sunday November 1 is the day the clocks go back
  ]);
});

test('a weekly event keeps its clock time across the start of daylight time in March', () => {
  const [from, to] = range('2027-03-01T00:00:00Z', '2027-04-01T00:00:00Z');
  const found = expandEvents(parseIcs(file(event('SUMMARY:Sunday build', 'DTSTART;TZID=America/New_York:20270307T100000', 'DTEND;TZID=America/New_York:20270307T120000', 'RRULE:FREQ=WEEKLY;COUNT=4'))), from, to);
  assert.deepEqual(utc(found), [
    '2027-03-07T15:00:00.000Z', // EST
    '2027-03-14T14:00:00.000Z', '2027-03-21T14:00:00.000Z', '2027-03-28T14:00:00.000Z', // EDT: the clocks went forward on March 14
  ]);
});

test('a time that does not exist on the night the clocks go forward is not lost, and an UNTIL after the change still counts', () => {
  const [from, to] = range('2027-03-10T00:00:00Z', '2027-03-20T00:00:00Z');
  const found = expandEvents(parseIcs(file(event('SUMMARY:Early start', 'DTSTART;TZID=America/New_York:20270313T023000', 'DTEND;TZID=America/New_York:20270313T033000', 'RRULE:FREQ=DAILY;UNTIL=20270316T120000Z'))), from, to);
  assert.equal(found.length, 4, 'March 13 to 16 is four days, the day with no 02:30 included');
});

test('an excluded date keeps working after the change: the EXDATE is in the same zone as the event', () => {
  const [from, to] = range('2026-10-25T00:00:00Z', '2026-11-20T00:00:00Z');
  const found = expandEvents(parseIcs(file(event('SUMMARY:Weekly', 'DTSTART;TZID=America/New_York:20261027T180000', 'DTEND;TZID=America/New_York:20261027T190000', 'RRULE:FREQ=WEEKLY;COUNT=4', 'EXDATE;TZID=America/New_York:20261110T180000'))), from, to);
  assert.deepEqual(utc(found), ['2026-10-27T22:00:00.000Z', '2026-11-03T23:00:00.000Z', '2026-11-17T23:00:00.000Z'], 'November 10 at 18:00 is 23:00 UTC and is the one that goes');
});

test('an event written in UTC does not move with the clocks, and one in another zone moves in its own', () => {
  const [from, to] = range('2026-10-25T00:00:00Z', '2026-11-12T00:00:00Z');
  const inUtc = expandEvents(parseIcs(file(event('SUMMARY:Utc', 'DTSTART:20261027T220000Z', 'DTEND:20261027T230000Z', 'RRULE:FREQ=WEEKLY;COUNT=3'))), from, to);
  assert.deepEqual(utc(inUtc), ['2026-10-27T22:00:00.000Z', '2026-11-03T22:00:00.000Z', '2026-11-10T22:00:00.000Z']);
  const london = expandEvents(parseIcs(file(event('SUMMARY:London', 'DTSTART;TZID=Europe/London:20261020T180000', 'DTEND;TZID=Europe/London:20261020T190000', 'RRULE:FREQ=WEEKLY;COUNT=3'))), from, to);
  // London goes back on October 25, a week before New York: 18:00 is 17:00 UTC in daylight time and 18:00 UTC after it
  assert.deepEqual(utc(london), ['2026-10-27T18:00:00.000Z', '2026-11-03T18:00:00.000Z']);
});

await runTests();
