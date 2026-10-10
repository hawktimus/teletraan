// Tests for the Hide buttons of the Calendars page in Studio. The rules they make and read are
// plain functions in studio/calendars-view-parts.js, so nothing is installed and nothing touches the
// network: the Studio's client is a small fake one. The same file checks the Node file that the Mini
// runs for the page (deploy/scripts/calendar-status.mjs): it lists 40 events with their days, and the
// document stays small enough to send. The page that draws the buttons is checked by
// studio/check-schemas.mjs, which also runs every rule through the Calendar filters schema.
//
//   node tools/test-calendars-hide.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const parts = await import(pathToFileURL(path.join(root, 'studio/calendars-view-parts.js')).href);
const dashboardEvents = await import(pathToFileURL(path.join(root, 'dashboard/core/events.js')).href);
const dashboardSanity = await import(pathToFileURL(path.join(root, 'dashboard/core/sanity.js')).href);
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-calendars-hide-'));

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const now = new Date('2026-10-09T15:00:00.000Z');
const zone = 'America/New_York';

function ruleOf(code, title, day, all) {
  return parts.hideRuleFor(code, { title: title, day: day }, all);
}

test('the word of a rule is the title without the three dots the Mini adds, cut to 30 characters, and an untitled event has none', () => {
  assert.deepEqual(parts.titleWords('Team meeting'), ['Team meeting']);
  assert.deepEqual(parts.titleWords('Pre-Season Meeting...'), ['Pre-Season Meeting']);
  assert.deepEqual(parts.titleWords('A'.repeat(60) + '...'), ['A'.repeat(30)]);
  assert.deepEqual(parts.titleWords('Team meeting with the parents and coaches'), ['Team meeting with the parents'], 'no space is left at the end');
  assert.deepEqual(parts.titleWords('x'.repeat(29) + '\u{1F600}'), ['x'.repeat(29)], 'a character is not cut in two');
  assert.deepEqual(parts.titleWords('x'.repeat(28) + '\u{1F600}'), ['x'.repeat(28) + '\u{1F600}']);
  ['No title', '', '   ', '...', ' ... ', null, undefined, 5, {}].forEach(title => assert.deepEqual(parts.titleWords(title), [], String(title)));
});

test('the name of a rule is Hide: with the title and the day, or Hide all: with the title, and never more than 40 characters', () => {
  assert.equal(parts.ruleName('Team meeting', '2026-10-12'), 'Hide: Team meeting, 2026-10-12');
  assert.equal(parts.ruleName('Team meeting', ''), 'Hide all: Team meeting');
  assert.equal(parts.ruleName('A'.repeat(22), '2026-10-12'), 'Hide: ' + 'A'.repeat(22) + ', 2026-10-12', '22 characters of title fit with the day');
  assert.equal(parts.ruleName('A'.repeat(23), '2026-10-12'), 'Hide: ' + 'A'.repeat(19) + '..., 2026-10-12', 'a longer title is cut and keeps the day');
  assert.equal(parts.ruleName('A'.repeat(30), ''), 'Hide all: ' + 'A'.repeat(30), 'the longest word fits in the name of a rule for every day');

  ['A'.repeat(30), 'Team meeting', 'B', '会議'.repeat(15)].forEach(word => ['', '2026-10-12', '2099-12-31'].forEach(day => {
    assert.ok(parts.ruleName(word, day).length <= 40, word + ' ' + day);
  }));
});

test('a rule has a stable id, and the same rule for the same title, calendar and day is the same id however the title is written', () => {
  const rule = ruleOf('team', 'Team meeting', '2026-10-12', false);
  assert.equal(rule._id, 'calendarFilter-hide-2eb3e2fca562025c', 'a rule made last week must be found by the same id this week');
  assert.equal(ruleOf('team', 'Team meeting', '2026-10-12', true)._id, 'calendarFilter-hide-b0c40c43775f9d6d');
  assert.equal(ruleOf('team', 'TEAM MEETING', '2026-10-12', false)._id, rule._id, 'capitals do not matter to a rule');
  assert.equal(ruleOf('team', 'Team meeting...', '2026-10-12', false)._id, rule._id, 'the three dots of the Mini are not part of the title');
  assert.equal(ruleOf('team', 'Team meeting', '2026-10-12', true)._id, ruleOf('team', 'Team meeting', '2030-01-01', true)._id, 'a rule for every day has no day in it');

  const ids = [
    rule._id,
    ruleOf('team', 'Team meeting', '2026-10-13', false)._id,
    ruleOf('group', 'Team meeting', '2026-10-12', false)._id,
    ruleOf('team', 'Team meetings', '2026-10-12', false)._id,
    ruleOf('team', 'Team meeting', '2026-10-12', true)._id,
  ];
  assert.equal(new Set(ids).size, ids.length, 'another day, calendar, title or kind of rule is another id');
  ids.forEach(id => assert.match(id, /^calendarFilter-hide-[0-9a-f]{16}$/));
  assert.equal(parts.hideIdPrefix, 'calendarFilter-hide-');
});

test('Hide this one makes a published calendarFilter for the title, the calendar and the day, and Hide all like this the same with no dates', () => {
  assert.deepEqual(ruleOf('team', 'Team meeting', '2026-10-12', false), {
    _id: 'calendarFilter-hide-2eb3e2fca562025c',
    _type: 'calendarFilter',
    name: 'Hide: Team meeting, 2026-10-12',
    action: 'hide',
    words: ['Team meeting'],
    calendar: 'team',
    fromDate: '2026-10-12',
    toDate: '2026-10-12',
    show: true,
  });
  assert.deepEqual(ruleOf('team', 'Team meeting', '2026-10-12', true), {
    _id: 'calendarFilter-hide-b0c40c43775f9d6d',
    _type: 'calendarFilter',
    name: 'Hide all: Team meeting',
    action: 'hide',
    words: ['Team meeting'],
    calendar: 'team',
    show: true,
  });
  assert.equal(ruleOf('team', 'Team meeting', undefined, true).fromDate, undefined);
});

test('no rule is made where Studio would refuse one: no title, a bad calendar code, or for one day no day or a day outside 2020 to 2099', () => {
  const none = [['team', 'No title'], ['team', ''], ['team', '...'], ['Team', 'x'], ['a'.repeat(21), 'x'], ['bad-code', 'x'], ['', 'x'], [undefined, 'x'], ['has space', 'x']];
  none.forEach(item => {
    assert.equal(ruleOf(item[0], item[1], '2026-10-12', false), null, item.join());
    assert.equal(ruleOf(item[0], item[1], '2026-10-12', true), null, item.join());
  });
  assert.ok(ruleOf('a'.repeat(20), 'x', '2026-10-12', false), 'a code of 20 characters is allowed');

  ['2019-12-31', '2100-01-01', '2026-02-30', '2026-13-01', '26-10-12', '', undefined, null, 5, '2026-10-12T10:00'].forEach(day => {
    assert.equal(ruleOf('team', 'x', day, false), null, 'one day: ' + day);
    assert.ok(ruleOf('team', 'x', day, true), 'every day: ' + day);
  });
  ['2020-01-01', '2099-12-31', '2028-02-29'].forEach(day => assert.ok(ruleOf('team', 'x', day, false), day));
  assert.equal(parts.hideRuleFor('team', null, false), null);
  assert.equal(parts.hideRuleFor('team', 'text', true), null);
});

// The rules of the grid, as Sanity stores them. A rule that is switched off or past its time does nothing.
const gridRules = [
  { name: 'r1', action: 'hide', words: ['team'], calendar: 'team' },
  { name: 'r2', action: 'hide', words: ['Team Meeting '], calendar: 'team', fromDate: '2026-10-12', toDate: '2026-10-12' },
  { name: 'r3', action: 'hide', words: [], calendar: 'outreach' },
  { name: 'r4', action: 'hide', days: [1, 3] },
  { name: 'r5', action: 'hide', words: ['food'], fromDate: '2026-10-13' },
  { name: 'r6', action: 'hide', words: ['food'], toDate: '2026-10-13' },
  { name: 'r7', action: 'hide', words: ['', '  '] },
  { name: 'r8', action: 'hide' },
  { name: 'r9', action: 'hide', words: ['team'], show: false },
  { name: 'r10', action: 'hide', words: ['team'], expires: '2020-01-01T00:00:00.000Z' },
  { name: 'r11', action: 'hide', words: ['team'], expires: '2099-01-01T00:00:00.000Z' },
  { name: 'r12', action: 'show', words: ['team'] },
  { name: 'r13', action: 'hide', words: ['meeting', 'drive'], calendar: 'team', days: [2], fromDate: '2026-10-01', toDate: '2026-10-31' },
  { name: 'r14', action: 'hide', words: ['house'], days: [] },
  { name: 'r15', action: 'hide', calendar: ' group ' },
  { name: 'r16', action: 'hide', words: ['\u0001'] },
  { name: 'r17', action: 'hide', words: ['\u0001\u0002', 'food'] },
  { name: 'r18', action: 'hide', words: ['\u007f'], calendar: 'team' },
];

test('the page judges an event by a rule exactly as the screen does, for every rule, title, calendar and day of a grid', () => {
  const titles = ['Team meeting', 'TEAM MEETING', 'Food drive', 'Open house', 'No title', 'Pre-Season', 'Meeting'];
  const days = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-31', '2026-11-01'];
  const calendars = ['team', 'outreach', 'group'];
  let hidden = 0;
  let judged = 0;

  gridRules.forEach(rule => {
    const kept = dashboardSanity.normalizeContent({ calendarFilters: [rule] }).calendarFilters;
    titles.forEach(title => calendars.forEach(code => days.forEach(day => {
      const screen = dashboardEvents.hidingRule({ title: title === 'No title' ? '' : title, calendarId: code, firstDay: day, lastDay: day }, kept, zone, now) !== null;
      const page = parts.stillHides(rule, now) && parts.ruleMatchesEvent(rule, code, { title: title, day: day });
      assert.equal(page, screen, rule.name + ' for "' + title + '" in ' + code + ' on ' + day);
      judged += 1;
      if (screen) hidden += 1;
    })));
  });
  assert.ok(judged === gridRules.length * titles.length * calendars.length * days.length && hidden > 100 && hidden < judged / 2, 'the grid has rules that hide and rules that do not: ' + hidden + ' of ' + judged);
});

test('a title with doubled spaces or a line break, which the Mini lists with single spaces, is found by the rule the page makes from the list', () => {
  const rule = ruleOf('team', 'Team meeting room', '2026-10-12', false);
  const kept = dashboardSanity.normalizeContent({ calendarFilters: [rule] }).calendarFilters;
  const seenOnScreen = title => dashboardEvents.hidingRule({ title: title, calendarId: 'team', firstDay: '2026-10-12', lastDay: '2026-10-12' }, kept, zone, now) !== null;

  ['Team meeting room', 'Team  meeting room', 'Team meeting\nroom', 'TEAM \t meeting   ROOM', 'Weekly Team meeting room B'].forEach(title => assert.equal(seenOnScreen(title), true, JSON.stringify(title)));
  ['Team meetingroom', 'Team meeting', 'Teammeeting room'].forEach(title => assert.equal(seenOnScreen(title), false, JSON.stringify(title)));
  assert.equal(parts.ruleMatchesEvent({ words: ['Team  meeting\nroom'] }, 'team', { title: 'Team meeting room' }), true, 'the page squeezes the words of a rule the same way');
});

test('a word of only control characters says nothing, so it never matches every title, on the screen or on the page', () => {
  ['\u0001', '\u0001\u0002', '\u007f', ' \u0001 '].forEach(word => {
    const rule = { name: 'odd', action: 'hide', words: [word] };
    const kept = dashboardSanity.normalizeContent({ calendarFilters: [rule] }).calendarFilters;
    ['Team meeting', 'Food drive', 'x'].forEach(title => {
      const event = { title: title, calendarId: 'team', firstDay: '2026-10-12', lastDay: '2026-10-12' };
      assert.equal(dashboardEvents.hidingRule(event, kept, zone, now), null, JSON.stringify(word) + ' on the screen for ' + title);
      assert.equal(parts.ruleMatchesEvent(rule, 'team', { title: title, day: '2026-10-12' }), false, JSON.stringify(word) + ' on the page for ' + title);
    });
  });

  const withFood = { name: 'odd', action: 'hide', words: ['\u0001', 'food'] };
  const kept = dashboardSanity.normalizeContent({ calendarFilters: [withFood] }).calendarFilters;
  const seen = title => dashboardEvents.hidingRule({ title: title, calendarId: 'team', firstDay: '2026-10-12', lastDay: '2026-10-12' }, kept, zone, now) !== null;
  assert.equal(seen('Food drive'), true, 'the other word still works');
  assert.equal(seen('Team meeting'), false);
});

test('an event with no day cannot match a rule that asks for days or dates, and matches one with words and a calendar only', () => {
  const event = { title: 'Team meeting' };
  assert.equal(parts.ruleMatchesEvent({ words: ['team'], calendar: 'team' }, 'team', event), true);
  assert.equal(parts.ruleMatchesEvent({ words: ['team'], fromDate: '2026-10-12' }, 'team', event), false);
  assert.equal(parts.ruleMatchesEvent({ words: ['team'], toDate: '2026-10-12' }, 'team', event), false);
  assert.equal(parts.ruleMatchesEvent({ words: ['team'], days: [1] }, 'team', event), false);
  assert.equal(parts.ruleMatchesEvent({ words: ['team'], calendar: 'group' }, 'team', event), false);
  assert.equal(parts.ruleMatchesEvent({}, 'team', event), false, 'a rule with no condition matches nothing');
});

const eventShown = { _key: 'o1', title: 'Team meeting', date: 'MON OCT 12', day: '2026-10-12', time: '6:00 PM', shown: true, rule: '' };

function marksOf(rules, gone) {
  return { rules: rules, gone: gone || [], now: now };
}

test('an event nothing hides offers both buttons, with their rules, and says why when one is missing', () => {
  const control = parts.controlFor('team', eventShown, marksOf([]));
  assert.equal(control.state, 'shown');
  assert.deepEqual(control.one, ruleOf('team', 'Team meeting', '2026-10-12', false));
  assert.deepEqual(control.all, ruleOf('team', 'Team meeting', '2026-10-12', true));
  assert.equal(control.note, '');

  const older = parts.controlFor('team', { title: 'Team meeting', shown: true }, marksOf([]));
  assert.equal(older.one, null);
  assert.deepEqual(older.all, ruleOf('team', 'Team meeting', '', true));
  assert.equal(older.note, parts.noDayLine, 'an event from a list with no days gets only Hide all like this');

  const untitled = parts.controlFor('team', { title: 'No title', day: '2026-10-12', shown: true }, marksOf([]));
  assert.deepEqual([untitled.one, untitled.all, untitled.note], [null, null, ''], 'an untitled event gets no button and no note');

  const longCode = parts.controlFor('a'.repeat(21), eventShown, marksOf([]));
  assert.deepEqual([longCode.one, longCode.all, longCode.note], [null, null, parts.longCodeLine]);
});

test('a rule made on the page hides an event at once, and Show again belongs to the rule that does it', () => {
  const one = ruleOf('team', 'Team meeting', '2026-10-12', false);
  const all = ruleOf('team', 'Team meeting', '2026-10-12', true);

  assert.deepEqual(parts.controlFor('team', eventShown, marksOf([one])), { state: 'made', rule: one });
  assert.deepEqual(parts.controlFor('team', eventShown, marksOf([all])), { state: 'made', rule: all });
  assert.equal(parts.controlFor('team', { title: 'Team meeting', day: '2026-10-13', shown: true }, marksOf([one])).state, 'shown', 'the rule is for one day');
  assert.equal(parts.controlFor('group', eventShown, marksOf([one])).state, 'shown', 'the rule is for one calendar');
  assert.equal(parts.controlFor('team', eventShown, marksOf([Object.assign({}, one, { show: false })])).state, 'shown', 'a rule that is off does nothing');
  assert.equal(parts.controlFor('team', eventShown, marksOf([Object.assign({}, one, { expires: '2020-01-01T00:00:00.000Z' })])).state, 'shown', 'a rule past its time does nothing');
  assert.equal(parts.controlFor('team', eventShown, marksOf([Object.assign({}, one, { expires: '2099-01-01T00:00:00.000Z' })])).state, 'made');
});

test('an event that the list says a rule hides is that rule if the page made it, and another rule if not', () => {
  const one = ruleOf('team', 'Team meeting', '2026-10-12', false);
  const listed = Object.assign({}, eventShown, { shown: false, rule: one.name });

  assert.deepEqual(parts.controlFor('team', listed, marksOf([one])), { state: 'made', rule: one });
  assert.deepEqual(parts.controlFor('team', Object.assign({}, listed, { rule: 'Hide Team' }), marksOf([one])), { state: 'other', name: 'Hide Team' }, 'the rule of the list is another rule, so there is no button');
  assert.deepEqual(parts.controlFor('team', Object.assign({}, listed, { rule: '' }), marksOf([])), { state: 'other', name: 'a rule with no name' });
  assert.equal(parts.controlFor('team', listed, marksOf([])).state, 'other', 'a rule that is not there, and was not deleted here, is changed under Calendar filters');
});

test('after Show again the list may still name the deleted rule, and the event reads as shown until the Mini lists it again', () => {
  const one = ruleOf('team', 'Team meeting', '2026-10-12', false);
  const listed = Object.assign({}, eventShown, { shown: false, rule: one.name });

  const after = parts.controlFor('team', listed, marksOf([], [one.name]));
  assert.equal(after.state, 'shown');
  assert.ok(after.one && after.all, 'and the buttons are back');

  const other = ruleOf('team', 'Team', '', true);
  assert.deepEqual(parts.controlFor('team', listed, marksOf([other], [one.name])), { state: 'made', rule: other }, 'another rule made here still hides it');
});

test('the lines of an event get the rules made here: hidden at once, shown again, and the Mini list is left alone without them', () => {
  const entries = [{ id: 'team', name: 'Team calendar', show: true, kind: 'meetings' }];
  const status = {
    calendars: [{
      code: 'team',
      fetchedAt: '2026-10-09T14:55:00.000Z',
      eventCount: 3,
      hiddenCount: 1,
      occurrences: [
        eventShown,
        { _key: 'o2', title: 'Pre-Season Meeting', date: 'TUE OCT 13', day: '2026-10-13', time: '6:30 PM', shown: false, rule: 'Hide Pre-Season' },
        { _key: 'o3', title: 'Food drive', date: 'WED OCT 14', day: '2026-10-14', time: '', shown: true, rule: '' },
      ],
    }],
  };
  const row = parts.rowsOf(entries, status, now)[0];

  const plain = parts.detailOf(row, status, now);
  assert.deepEqual(plain.events.map(event => event.control), [null, null, null], 'without rules there is no control');
  assert.deepEqual(plain.events.map(event => event.badge), ['SHOWN', 'HIDDEN', 'SHOWN']);

  const one = ruleOf('team', 'Team meeting', '2026-10-12', false);
  const marked = parts.detailOf(row, status, now, marksOf([one]));
  assert.deepEqual(marked.events.map(event => event.badge), ['HIDDEN', 'HIDDEN', 'SHOWN']);
  assert.equal(marked.events[0].rule, 'Hidden by Hide: Team meeting, 2026-10-12');
  assert.equal(marked.events[0].hidden, true);
  assert.equal(marked.events[1].rule, 'Hidden by Hide Pre-Season', 'a rule of the list keeps its words');
  assert.deepEqual(marked.events.map(event => event.control.state), ['made', 'other', 'shown']);
  assert.deepEqual(marked.events.map(event => event.rowKey), ['team:o1', 'team:o2', 'team:o3']);
  assert.deepEqual(marked.events.map(event => event.day), ['2026-10-12', '2026-10-13', '2026-10-14']);
});

test('the list says when it shows fewer events than the calendar has, and nothing when it shows them all', () => {
  const entries = [{ id: 'team', name: 'Team calendar', show: true }];
  const listing = count => ({ calendars: [{ code: 'team', eventCount: count, hiddenCount: 0, occurrences: Array.from({ length: 40 }, (value, index) => ({ _key: 'o' + (index + 1), title: 'Event', shown: true })) }] });

  assert.equal(parts.detailOf(parts.rowsOf(entries, listing(57), now)[0], listing(57), now).more, 'The list shows the next 40 of the 57 events.');
  assert.equal(parts.detailOf(parts.rowsOf(entries, listing(40), now)[0], listing(40), now).more, '');
  assert.equal(parts.detailOf(parts.rowsOf(entries, listing(12), now)[0], listing(12), now).more, '');
  assert.equal(parts.detailOf(parts.rowsOf(entries, null, now)[0], null, now).more, '');
});

test('the kind of each calendar is a line in its row and a fact, and a calendar with no kind, or an unknown one, is Other (not set)', () => {
  const entries = [
    { id: 'a', name: 'A', kind: 'meetings' },
    { id: 'b', name: 'B', kind: 'competitions' },
    { id: 'c', name: 'C', kind: 'outreach' },
    { id: 'd', name: 'D', kind: 'deadlines' },
    { id: 'e', name: 'E', kind: 'other' },
    { id: 'f', name: 'F' },
    { id: 'g', name: 'G', kind: 'party' },
    { id: 'h', name: 'H', kind: 5 },
    { id: 'i', name: 'I', kind: 'constructor' },
  ];
  const rows = parts.rowsOf(entries, { calendars: [{ code: 'only', error: 'no address set yet' }] }, now);

  assert.deepEqual(rows.map(row => row.kind), ['Kind: Meetings', 'Kind: Competitions', 'Kind: Outreach', 'Kind: Deadlines', 'Kind: Other', 'Kind: Other (not set)', 'Kind: Other (not set)', 'Kind: Other (not set)', 'Kind: Other (not set)', 'Kind: Not set']);
  assert.deepEqual(rows.map(row => row.kindMissing), [false, false, false, false, false, true, true, true, true, false], 'a calendar the Mini only knows about is not on the screen, so it has no kind to miss');
  assert.equal(parts.detailOf(rows[3], null, now).facts.filter(fact => fact.label === 'Kind')[0].text, 'Deadlines');
  assert.equal(parts.detailOf(rows[5], null, now).facts.filter(fact => fact.label === 'Kind')[0].text, 'Other (not set)');
  assert.equal(parts.detailOf(rows[9], null, now).facts.filter(fact => fact.label === 'Kind')[0].text, 'Not set');
  assert.deepEqual(parts.calendarKinds.map(kind => kind.value), ['meetings', 'competitions', 'outreach', 'deadlines', 'other']);
});

test('the words of the buttons are short plain sentences with no dash, exclamation mark or emoji, and none of the filler words', () => {
  const words = [
    parts.helpLine, parts.kindLine, parts.hideLine, parts.changeLine, parts.noDayLine, parts.longCodeLine, parts.rulesUnreadableLine,
    parts.askText('Team calendar', 'Team meeting'), parts.restingText('Hide all: Team meeting'),
    parts.failureText({ statusCode: 403, message: 'Insufficient permissions' }), parts.failureText(new Error('offline')), parts.failureText(null),
    parts.hideOneLabel, parts.hideAllLabel, parts.showAgainLabel, parts.confirmLabel, parts.cancelLabel,
  ];
  words.forEach(text => {
    text.split(/[.?]\s+|[.?]$/).forEach(sentence => assert.ok(sentence.trim().split(/\s+/).filter(Boolean).length <= 20, 'a sentence is too long: ' + sentence));
    assert.ok(!/[\u2014\u2013!]/.test(text), 'a dash or an exclamation mark in: ' + text);
    assert.ok(!/\p{Extended_Pictographic}/u.test(text), 'an emoji in: ' + text);
    assert.ok(!/\b(simply|just|basically|really|very|actually|easily)\b/i.test(text), 'a filler word in: ' + text);
  });

  assert.equal(parts.askText('Team calendar', 'Team meeting'), 'This hides every event in Team calendar with Team meeting in its title, on every day.');
  assert.equal(parts.hideOneLabel + '|' + parts.hideAllLabel + '|' + parts.showAgainLabel + '|' + parts.confirmLabel + '|' + parts.cancelLabel, 'Hide this one|Hide all like this|Show again|Hide|Cancel');
  assert.equal(parts.helpLine, 'Hide this one, beside an event, takes that one event off the screen. Hide all like this hides every event with the same title in the same calendar. Both make a rule, and the rules are listed under Calendar filters. To add a calendar, ask a coach to add its address on the Mini.');
  assert.ok(parts.helpLine.includes(parts.hideOneLabel) && parts.helpLine.includes(parts.hideAllLabel), 'the help line names the two buttons as they are written on them');
  assert.ok(!/repeating meeting/.test(parts.helpLine), 'the help line no longer sends people to a rule for a repeating meeting');
  assert.equal(parts.changeLine, 'Change it under Calendar filters.');
  assert.ok(/at once/.test(parts.hideLine) && /Calendar filters/.test(parts.hideLine) && /edit or delete/.test(parts.hideLine));
  assert.ok(/no kind shows Other/.test(parts.kindLine) && /Dashboard Settings/.test(parts.kindLine) && /Calendars tab/.test(parts.kindLine));
});

test('a refused change says so and gives the reason, and any other failure gives the reason too', () => {
  assert.equal(parts.failureText({ statusCode: 403, message: 'Insufficient permissions; permission "create" required' }), 'Studio refused the change, so your account may not be allowed to edit Calendar filters. Sanity said: Insufficient permissions; permission "create" required.');
  assert.match(parts.failureText({ statusCode: 401 }), /^Studio refused the change/);
  assert.match(parts.failureText(new Error('Request error while attempting to reach')), /^The change was not saved\. Sanity said: Request error while attempting to reach\.$/);
  assert.equal(parts.failureText(null), 'The change was not saved.');
  assert.ok(parts.failureText(new Error('x'.repeat(500))).length < 260, 'a long reason is cut');
});

// A fake Studio client that keeps the documents it is given
function fakeClient() {
  const documents = {};
  const calls = [];
  return {
    documents: documents,
    calls: calls,
    createIfNotExists: async doc => {
      calls.push('create ' + doc._id);
      if (!documents[doc._id]) documents[doc._id] = doc;
      return documents[doc._id];
    },
    delete: async id => {
      calls.push('delete ' + id);
      delete documents[id];
    },
    fetch: async (question, params, options) => {
      calls.push('fetch ' + options.perspective);
      return Object.keys(documents).filter(id => id.indexOf('drafts.') !== 0).map(id => documents[id]);
    },
  };
}

test('Hide makes the rule once, however many times it is pressed, and leaves a rule that is there as it is', async () => {
  const client = fakeClient();
  const rule = ruleOf('team', 'Team meeting', '2026-10-12', false);

  const first = await parts.hideEvent(client, rule);
  const second = await parts.hideEvent(client, rule);
  assert.deepEqual(Object.keys(client.documents), [rule._id]);
  assert.equal(first, second);
  assert.deepEqual(client.calls, ['create ' + rule._id, 'create ' + rule._id], 'only createIfNotExists is used');

  const switchedOff = fakeClient();
  switchedOff.documents[rule._id] = Object.assign({}, rule, { show: false });
  const stored = await parts.hideEvent(switchedOff, rule);
  assert.equal(stored.show, false, 'the rule that is there is handed back, not the one that was asked for');
  assert.equal(parts.stillHides(stored, now), false, 'and the page can see that it does nothing');
  assert.equal(parts.stillHides(rule, now), true);
  assert.equal(parts.stillHides(Object.assign({}, rule, { action: 'show' }), now), false);
  assert.equal(parts.stillHides(Object.assign({}, rule, { expires: '2020-01-01T00:00:00.000Z' }), now), false);
  assert.equal(parts.stillHides(Object.assign({}, rule, { expires: '2099-01-01T00:00:00.000Z' }), now), true);

  assert.deepEqual(await parts.hideEvent({ createIfNotExists: async () => undefined }, rule), rule, 'a client that gives nothing back leaves the rule as it was asked for');
});

test('Show again deletes the published rule and a draft of it, tells when the rule cannot be deleted, and does not mind a draft that cannot', async () => {
  const client = fakeClient();
  const rule = ruleOf('team', 'Team meeting', '2026-10-12', false);
  client.documents[rule._id] = rule;
  client.documents['drafts.' + rule._id] = Object.assign({}, rule, { _id: 'drafts.' + rule._id });
  client.documents['calendarFilter-other'] = { _id: 'calendarFilter-other' };

  await parts.showAgain(client, rule);
  assert.deepEqual(client.calls, ['delete ' + rule._id, 'delete drafts.' + rule._id]);
  assert.deepEqual(Object.keys(client.documents), ['calendarFilter-other'], 'no other document is touched');

  await parts.showAgain({ delete: async id => { if (id.indexOf('drafts.') === 0) throw new Error('no draft'); } }, rule);
  await assert.rejects(parts.showAgain({ delete: async () => { throw new Error('Insufficient permissions'); } }, rule), /Insufficient permissions/);
  await assert.rejects(parts.hideEvent({ createIfNotExists: async () => { throw new Error('Insufficient permissions'); } }, rule), /Insufficient permissions/);
});

test('the rules made on the page are read from the published calendarFilter documents by their id, and a client that fails gives them as unreadable', async () => {
  const client = fakeClient();
  const rule = ruleOf('team', 'Team meeting', '2026-10-12', false);
  client.documents[rule._id] = rule;
  client.documents['calendarFilter-1234'] = { _id: 'calendarFilter-1234', name: 'Hide Pre-Season', words: ['Pre-Season'] };
  client.documents['calendarFilter-hide-ffffffffffffffff'] = { _id: 'calendarFilter-hide-ffffffffffffffff', name: 'Always: Kickoff', action: 'show', words: ['Kickoff'] };
  client.documents['drafts.' + rule._id] = rule;

  const found = await parts.readHideRules(client);
  assert.equal(found.unreadable, false);
  assert.deepEqual(found.rules.map(item => item._id), [rule._id], 'the other rules are not the page\'s to change');
  assert.deepEqual(client.calls, ['fetch published']);

  assert.deepEqual(await parts.readHideRules({ fetch: async () => { throw new Error('offline'); } }), { rules: [], unreadable: true });
  assert.deepEqual(await parts.readHideRules({}), { rules: [], unreadable: true });
  assert.deepEqual(await parts.readHideRules({ fetch: async () => null }), { rules: [], unreadable: false });
  assert.deepEqual(parts.tidyRules('text'), []);
});

test('the list of rules the page keeps is a new list each time', () => {
  const list = [{ _id: 'a' }, { _id: 'b' }];
  assert.deepEqual(parts.withRule(list, { _id: 'c' }).map(item => item._id), ['a', 'b', 'c']);
  assert.deepEqual(parts.withRule(list, { _id: 'a', x: 1 }), [{ _id: 'b' }, { _id: 'a', x: 1 }]);
  assert.deepEqual(parts.withoutRule(list, 'a'), [{ _id: 'b' }]);
  assert.deepEqual(list, [{ _id: 'a' }, { _id: 'b' }]);
});

// The Node file the Mini runs

const helper = path.join(root, 'deploy/scripts/calendar-status.mjs');

function noon(daysFromToday) {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysFromToday, 12));
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace('.000', '');
}

// Two events every day for 40 days from tomorrow, so a calendar has about 58 events in the next 30 days
function busyCalendar(title) {
  const parts = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Teletraan test//EN'];
  ['a', 'b'].forEach(series => {
    parts.push('BEGIN:VEVENT', 'UID:busy-' + series, 'DTSTART:' + stamp(noon(1)), 'DTEND:' + stamp(new Date(noon(1).getTime() + 3600000)), 'RRULE:FREQ=DAILY;COUNT=40', 'SUMMARY:' + title + series, 'END:VEVENT');
  });
  parts.push('END:VCALENDAR');
  return parts.join('\r\n') + '\r\n';
}

// Makes the document the Mini sends, for seven calendars with the same title and a rule that hides them all
function documentFor(name, title, ruleName) {
  const folder = path.join(work, name);
  fs.mkdirSync(path.join(folder, 'calendars'), { recursive: true });
  const codes = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
  codes.forEach(code => fs.writeFileSync(path.join(folder, 'calendars', code + '.ics'), busyCalendar(title)));
  fs.writeFileSync(path.join(folder, 'sync.txt'), codes.map(code => code + '|2026-10-09T15:00:02Z|').join('\n') + '\n');
  const rules = ruleName ? [{ name: ruleName, action: 'hide', words: [title.charAt(0)] }] : [];
  fs.writeFileSync(path.join(folder, 'answer.json'), JSON.stringify({ result: { calendarFilters: rules, settings: { calendars: [] } } }));

  const result = spawnSync(process.execPath, [helper, 'build', path.join(folder, 'answer.json'), path.join(folder, 'sync.txt'), path.join(folder, 'calendars')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return { text: result.stdout.trim(), document: JSON.parse(result.stdout) };
}

test('seven calendars of 40 events with long titles and long rule names make a document that status-write.sh sends', () => {
  const made = documentFor('long', 'A'.repeat(100), 'R'.repeat(80));

  assert.equal(made.document.calendars.length, 7);
  made.document.calendars.forEach(calendar => {
    assert.equal(calendar.occurrences.length, 40, calendar.code);
    assert.ok(calendar.eventCount >= 58 && calendar.eventCount <= 60, 'the count is of every event: ' + calendar.eventCount);
    calendar.occurrences.forEach(event => {
      assert.match(event.day, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(event.title, 'A'.repeat(60) + '...');
      assert.equal(event.rule, 'R'.repeat(60) + '...');
    });
  });
  assert.ok(Buffer.byteLength(made.text) < 100000, 'status-write.sh refuses more than 100000 bytes, and this one is ' + Buffer.byteLength(made.text));
  assert.ok(Buffer.byteLength(made.text) > 50000, 'the test is of the largest sort of document, not a small one');
});

test('a document of long titles in many bytes each gives up events from the end, evenly, until it fits, and the counts stay true', () => {
  const made = documentFor('wide', '会'.repeat(100), '規'.repeat(80));
  const lengths = made.document.calendars.map(calendar => calendar.occurrences.length);

  assert.ok(Buffer.byteLength(made.text) <= 90000, 'the size is ' + Buffer.byteLength(made.text));
  assert.ok(Math.min.apply(null, lengths) > 20 && Math.max.apply(null, lengths) < 40, 'some events are given up: ' + lengths.join());
  assert.ok(Math.max.apply(null, lengths) - Math.min.apply(null, lengths) <= 1, 'every calendar gives up about the same number: ' + lengths.join());
  made.document.calendars.forEach(calendar => {
    assert.ok(calendar.eventCount >= 58, 'the count still says how many events there are');
    assert.deepEqual(calendar.occurrences.map(event => event._key), Array.from({ length: calendar.occurrences.length }, (value, index) => 'o' + (index + 1)), 'the events that stay are the first ones');
  });
});

test('the Node file lists 40 events and their days, and says so at the top', () => {
  const text = fs.readFileSync(helper, 'utf8');
  assert.ok(/const listed = 40;/.test(text) && /the next 40 with their title, date, day and time/.test(text.replace(/\s*\/\/\s*/g, ' ')), 'the number and the comment agree');
  assert.ok(/firstDayOf\(event, zone\)/.test(text), 'the day comes from the helper the Calendar filters use');
  assert.ok(!/\b12\b/.test(text.replace(/\d{3,}/g, '')), 'no 12 is left in the file');
});

test('the day is the first day in the time zone of the screen, the day the filters judge by, also when the event is late in the evening', () => {
  const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Teletraan test//EN', 'BEGIN:VEVENT', 'UID:late', 'DTSTART:' + stamp(new Date(noon(2).getTime() + 5 * 3600000)), 'DTEND:' + stamp(new Date(noon(2).getTime() + 6 * 3600000)), 'SUMMARY:Late meeting', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  const folder = path.join(work, 'late');
  fs.mkdirSync(path.join(folder, 'calendars'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'calendars', 'late.ics'), calendar);
  fs.writeFileSync(path.join(folder, 'sync.txt'), 'late|2026-10-09T15:00:02Z|\n');
  fs.writeFileSync(path.join(folder, 'answer.json'), JSON.stringify({ result: { calendarFilters: [], settings: { calendars: [] } } }));
  const result = spawnSync(process.execPath, [helper, 'build', path.join(folder, 'answer.json'), path.join(folder, 'sync.txt'), path.join(folder, 'calendars')], { encoding: 'utf8', env: Object.assign({}, process.env, { TZ: 'Asia/Tokyo' }) });
  assert.equal(result.status, 0, result.stderr);

  const [event] = JSON.parse(result.stdout).calendars[0].occurrences;
  const start = new Date(noon(2).getTime() + 5 * 3600000);
  const inTheZone = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(start);
  assert.equal(event.day, inTheZone, 'the day in New York, not the day on the computer that runs the file');
  assert.equal(dashboardEvents.firstDayOf({ start: start, end: new Date(start.getTime() + 3600000), allDay: false }, zone), inTheZone);
  assert.equal(dashboardEvents.firstDayOf({ firstDay: '2026-10-12', lastDay: '2026-10-12' }, zone), '2026-10-12');
  assert.equal(dashboardEvents.firstDayOf({}, zone), '');
  assert.equal(dashboardEvents.firstDayOf(null, zone), '');
});

test('a title written with doubled spaces is listed with single spaces, and the rule made from that listing hides it on the next run', () => {
  const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Teletraan test//EN', 'BEGIN:VEVENT', 'UID:spaced', 'DTSTART:' + stamp(noon(2)), 'DTEND:' + stamp(new Date(noon(2).getTime() + 3600000)), 'SUMMARY:Robotics  Team   Meeting', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  const folder = path.join(work, 'spaced');
  fs.mkdirSync(path.join(folder, 'calendars'), { recursive: true });
  fs.writeFileSync(path.join(folder, 'calendars', 'team.ics'), calendar);
  fs.writeFileSync(path.join(folder, 'sync.txt'), 'team|2026-10-09T15:00:02Z|\n');

  const build = rules => {
    fs.writeFileSync(path.join(folder, 'answer.json'), JSON.stringify({ result: { calendarFilters: rules, settings: { calendars: [] } } }));
    const result = spawnSync(process.execPath, [helper, 'build', path.join(folder, 'answer.json'), path.join(folder, 'sync.txt'), path.join(folder, 'calendars')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout).calendars[0].occurrences[0];
  };

  const before = build([]);
  assert.equal(before.title, 'Robotics Team Meeting');
  assert.equal(before.shown, true);

  const rule = parts.hideRuleFor('team', before, false);
  const after = build([rule]);
  assert.equal(after.shown, false, 'the rule made from the list hides the event as BAND wrote it');
  assert.equal(after.rule, rule.name);
  assert.equal(parts.controlFor('team', after, marksOf([rule])).state, 'made', 'and the page reads the new list as the rule it made');
});

test('a long title is never cut through the middle of an emoji, so the document holds no broken character', () => {
  const lines = title => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Teletraan test//EN', 'BEGIN:VEVENT', 'UID:emoji', 'DTSTART:' + stamp(noon(2)), 'DTEND:' + stamp(new Date(noon(2).getTime() + 3600000)), 'SUMMARY:' + title, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  const brokenHalf = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

  // The emoji starts at character 60 (index 59), 59 letters in front of it, and the cut would fall in its middle
  const cases = [['x'.repeat(59) + '\u{1F600} and more words', 'x'.repeat(59) + '...'], ['x'.repeat(58) + '\u{1F600} and more words', 'x'.repeat(58) + '\u{1F600}...'], ['x'.repeat(60) + '\u{1F600}', 'x'.repeat(60) + '...']];
  cases.forEach((item, index) => {
    const folder = path.join(work, 'emoji-' + index);
    fs.mkdirSync(path.join(folder, 'calendars'), { recursive: true });
    fs.writeFileSync(path.join(folder, 'calendars', 'team.ics'), lines(item[0]));
    fs.writeFileSync(path.join(folder, 'sync.txt'), 'team|2026-10-09T15:00:02Z|\n');
    fs.writeFileSync(path.join(folder, 'answer.json'), JSON.stringify({ result: { calendarFilters: [{ name: 'e'.repeat(59) + '\u{1F600}\u{1F600}', action: 'hide', words: ['x'.repeat(5)] }], settings: { calendars: [] } } }));
    const result = spawnSync(process.execPath, [helper, 'build', path.join(folder, 'answer.json'), path.join(folder, 'sync.txt'), path.join(folder, 'calendars')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const [event] = JSON.parse(result.stdout).calendars[0].occurrences;
    assert.equal(event.title, item[1], 'title ' + index);
    assert.equal(event.rule, 'e'.repeat(59) + '...', 'a rule name is cut the same way');
    assert.ok(!brokenHalf.test(event.title + event.rule), 'no broken character in the text ' + index);
    assert.ok(!/\\ud[89a-f][0-9a-f]{2}/i.test(result.stdout), 'JSON escapes only a half of an emoji, so none may be in the document ' + index);
  });
});

// The docs

const docs =['docs/calendars-page.md', 'docs/hide-a-repeating-meeting.md', 'docs/calendar-filters.md', 'docs/rebuilding-the-mini.md'];

test('the docs start with the button and give the rule form second, and name the rules the page makes', () => {
  const hide = fs.readFileSync(path.join(root, 'docs/hide-a-repeating-meeting.md'), 'utf8');
  assert.ok(hide.indexOf('Hide this one') !== -1 && hide.indexOf('Hide this one') < hide.indexOf('Calendar filters, then the plus button'), 'the button comes before the rule form');
  ['Hide all like this', 'Show again', 'Hide:', 'Hide all:', 'Calendar filters'].forEach(words => assert.ok(hide.includes(words), 'docs/hide-a-repeating-meeting.md should say: ' + words));

  const filters = fs.readFileSync(path.join(root, 'docs/calendar-filters.md'), 'utf8').replace(/\s+/g, ' ');
  assert.ok(filters.includes('Hide:') && filters.includes('Hide all:') && /Calendars page/.test(filters), 'docs/calendar-filters.md should say that rules whose name starts with Hide: or Hide all: come from the Calendars page');

  const page = fs.readFileSync(path.join(root, 'docs/calendars-page.md'), 'utf8').replace(/\s+/g, ' ');
  ['next 40 events', 'Kind', 'no kind', 'Dashboard Settings', 'Hide this one', 'Show again', 'calendarFilter-hide-'].forEach(words => assert.ok(page.includes(words), 'docs/calendars-page.md should say: ' + words));
  assert.ok(!/next 12|up to 12/.test(page), 'docs/calendars-page.md should not still say 12');
  assert.ok(page.includes(parts.helpLine), 'docs/calendars-page.md should quote the help line of the page as it is written');
});

test('the docs are plain: no dash, no exclamation mark, no emoji and no filler word', () => {
  docs.concat(['docs/coaches-guide.md', 'docs/editing-content.md', 'docs/using-the-studio.md', 'deploy/README.md', 'dashboard/package.json']).forEach(file => {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(!/[\u2014\u2013]/.test(text), file + ' has a dash');
    assert.ok(!/\p{Extended_Pictographic}/u.test(text), file + ' has an emoji');
  });

  // docs/rebuilding-the-mini.md quotes words of the Studio and of the TV menu in older steps, so only its step 19 is
  // read for filler words, in tools/test-calendar-node.mjs
  docs.filter(file => file !== 'docs/rebuilding-the-mini.md').forEach(file => {
    const text = fs.readFileSync(path.join(root, file), 'utf8').replace(/`[^`]*`/g, '').replace(/^ {4}.*$/gm, '');
    assert.ok(!/\b(simply|just|basically|really|very|actually|easily)\b/i.test(text), file + ' has a filler word');
    assert.ok(!/[a-z)]!(\s|$)/.test(text), file + ' has an exclamation mark');
  });
});

let failures = 0;
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

fs.rmSync(work, { recursive: true, force: true });
console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
