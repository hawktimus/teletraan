// Tests that the dashboard honours a Calendar filter of scope one (schemas/calendarFilter.js), the rule
// the switch of the Calendars page makes: it matches a single event by its calendar, its exact title and
// its exact start, and nothing else. The code is dashboard/core/events.js and the cleaning of the rules
// is dashboard/core/sanity-people.js.
//
//   node tests/calendar-one-event.test.mjs

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const events = await import(pathToFileURL(path.join(root, 'dashboard/core/events.js')).href);
const sanity = await import(pathToFileURL(path.join(root, 'dashboard/core/sanity.js')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const zone = 'America/New_York';
const now = new Date('2026-10-09T15:00:00.000Z');
const cleaned = rules => sanity.normalizeContent({ calendarFilters: rules }).calendarFilters;

function band(title, startText, calendarId) {
  const start = new Date(startText);
  return { title: title, start: start, end: new Date(start.getTime() + 3600000), allDay: false, location: '', uid: 'u', calendar: 'x', calendarId: calendarId || 'team' };
}

const monday = '2026-10-12T22:00:00.000Z';
const thursday = '2026-10-15T22:00:00.000Z';

const oneRule = (extra) => Object.assign({
  name: 'One event: Pre-Season, 2026-10-12',
  action: 'hide',
  scope: 'one',
  eventCalendar: 'team',
  eventTitle: 'Pre-Season',
  eventStart: monday,
  expires: '2026-10-14T00:00:00.000Z',
  show: true,
}, extra);

test('the screen keeps a one event rule with its three fields, and the usual conditions typed on it change nothing', () => {
  const [rule] = cleaned([oneRule({ words: ['Pre'], days: [4], calendar: 'outreach', fromDate: '2026-01-01' })]);
  assert.equal(rule.scope, 'one');
  assert.equal(rule.eventCalendar, 'team');
  assert.equal(rule.eventTitle, 'Pre-Season');
  assert.equal(rule.eventStart, monday);
  const hidden = event => events.hidingRule(event, [rule], zone, now) !== null;
  assert.equal(hidden(band('Pre-Season', monday)), true);
  assert.equal(hidden(band('Pre-Season', thursday)), false, 'the word and the day typed on the rule are not used');
});

test('a one event rule with a field missing or a start that is not a time is dropped, so it can never hide the wrong event', () => {
  assert.equal(cleaned([oneRule({ eventCalendar: '' })]).length, 0);
  assert.equal(cleaned([oneRule({ eventTitle: '  ' })]).length, 0);
  assert.equal(cleaned([oneRule({ eventStart: 'soon' })]).length, 0);
  assert.equal(cleaned([oneRule({ eventStart: undefined })]).length, 0);
  assert.equal(cleaned([oneRule({ scope: 'many', eventTitle: undefined })]).length, 0, 'a usual rule with no condition is still dropped');
});

test('it hides the one occurrence and no other: same title on another start, another title, another calendar all show', () => {
  const rules = cleaned([oneRule()]);
  const hidden = event => events.hidingRule(event, rules, zone, now) !== null;
  assert.equal(hidden(band('Pre-Season', monday)), true);
  assert.equal(hidden(band('Pre-Season', thursday)), false, 'the Thursday meeting of the same title shows');
  assert.equal(hidden(band('Pre-Season', '2026-10-12T22:00:01.000Z')), false, 'one second later is another event');
  assert.equal(hidden(band('Pre-Season Kickoff', monday)), false, 'the title is exact, not a part of it');
  assert.equal(hidden(band('pre-season', monday)), false, 'capitals count');
  assert.equal(hidden(band('Pre-Season', monday, 'outreach')), false, 'another calendar');
});

test('a week of repeating meetings loses only the one occurrence', () => {
  const week = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'].map(day => band('Pre-Season', day + 'T22:00:00.000Z'));
  const kept = events.mergeEvents(week, zone, now, cleaned([oneRule({ expires: '2026-10-30T00:00:00.000Z' })]));
  assert.deepEqual(kept.map(event => event.start.toISOString().slice(0, 10)), ['2026-10-19', '2026-10-26', '2026-11-02']);
});

test('the title is judged as the Teletraan computer lists it: on one line and cut at 60 characters', () => {
  const long = 'Regional planning meeting with the parents and the coaches about travel';
  const listed = events.listedTitle(long);
  assert.equal(listed.length <= 63, true);
  assert.match(listed, /\.\.\.$/);
  const rules = cleaned([oneRule({ eventTitle: listed })]);
  assert.notEqual(events.hidingRule(band(long, monday), rules, zone, now), null);
  assert.notEqual(events.hidingRule(band('Team  meeting\nroom', monday), cleaned([oneRule({ eventTitle: 'Team meeting room' })]), zone, now), null);
  assert.equal(events.listedTitle(''), 'No title');
  assert.equal(events.listedTitle('x'.repeat(59) + '\u{1F600}').length <= 62, true);
});

test('it expires by itself, and a rule that is switched off does nothing', () => {
  const hides = rule => events.hidingRule(band('Pre-Season', monday), cleaned([rule]), zone, now) !== null;
  assert.equal(hides(oneRule()), true);
  assert.equal(hides(oneRule({ expires: '2026-10-09T14:00:00.000Z' })), false, 'past its Hide after time');
  assert.equal(hides(oneRule({ show: false })), false);
});

test('a one event Always show rule wins over an ordinary Hide rule, as every Always show rule does', () => {
  const hide = { name: 'Hide Pre-Season', action: 'hide', words: ['Pre-Season'] };
  const keep = oneRule({ action: 'show', name: 'One event shown: Pre-Season, 2026-10-12' });
  const rules = cleaned([hide, keep]);
  assert.equal(events.hidingRule(band('Pre-Season', monday), rules, zone, now), null, 'the one event shows');
  assert.notEqual(events.hidingRule(band('Pre-Season', thursday), rules, zone, now), null, 'the others stay hidden');
});

test('rules that are not of scope one read exactly as before', () => {
  const rules = cleaned([{ name: 'Hide Pre-Season', action: 'hide', words: ['Pre-Season'], days: [1] }, { name: 'Odd', action: 'hide', scope: 'many', words: ['Kickoff'] }]);
  assert.equal(rules.length, 2);
  assert.equal(rules[0].scope, undefined);
  assert.notEqual(events.hidingRule(band('Pre-Season', monday), rules, zone, now), null);
  assert.equal(events.hidingRule(band('Pre-Season', thursday), rules, zone, now), null);
  assert.notEqual(events.hidingRule(band('Kickoff', thursday), rules, zone, now), null);
});

let failures = 0;
for (const entry of tests) {
  try {
    entry.run();
    console.log('ok    ' + entry.name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + entry.name);
    console.log(error);
  }
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
