// Tests for the list of the Calendars page in Studio (studio/inputs/calendars-list-parts.js): the
// coming events, with none from before today, grouped by day; the state words and reasons; and the
// Show and Hide switch, which makes and withdraws draft Calendar filters of scope one. Plain
// functions, so nothing is installed and nothing touches the network: the Studio's client is a
// small fake one. The page that draws the list is checked by tests/schemas.test.mjs.
//
//   node tests/calendars-list.test.mjs

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const parts = await import(pathToFileURL(path.join(root, 'studio/inputs/calendars-list-parts.js')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// Friday 9 October 2026, 11:00 in New York
const now = new Date('2026-10-09T15:00:00.000Z');
const zone = 'America/New_York';
const at = (day, hour) => '2026-10-' + day + 'T' + hour + ':00:00.000Z';

const entries = [
  { id: 'team', name: 'Team calendar', show: true, kind: 'meetings' },
  { id: 'outreach', name: 'Outreach', show: false, kind: 'outreach' },
  { id: 'gears', name: 'Gears', show: true },
];

function event(key, title, start, end, extra) {
  return Object.assign({ _key: key, title: title, date: 'X', day: dayOfStart(start), time: '6:00 PM', shown: true, rule: '', start: start, end: end }, extra || {});
}
function dayOfStart(start) {
  return parts.dayIn(start, zone);
}

const status = {
  _id: 'calendar-status',
  updatedAt: '2026-10-09T14:59:00.000Z',
  calendars: [
    {
      code: 'team',
      fetchedAt: '2026-10-09T14:56:00.000Z',
      occurrences: [
        event('a', 'Yesterday meeting', at('08', '22'), at('08', '23')),
        event('b', 'Morning stand-up', at('09', '12'), at('09', '13')),
        event('c', 'Team meeting', at('09', '22'), at('09', '23')),
        event('d', 'Pre-Season', at('10', '22'), at('10', '23')),
        event('e', 'Build day', at('12', '14'), at('12', '20')),
        event('f', 'Long camp', at('07', '14'), at('11', '20')),
      ],
    },
    { code: 'outreach', fetchedAt: '2026-10-09T14:00:00.000Z', occurrences: [event('g', 'Food drive', at('11', '15'), at('11', '17'))] },
    { code: 'gears', error: 'download failed, the server said no, so the address may be wrong or expired' },
  ],
};

const rows = () => parts.eventRows(status, entries, now, zone);
const rowTitled = title => rows().filter(row => row.title === title)[0];

test('events from before today are never listed, an event on now or later today is, and a long event that is still on is', () => {
  const titles = rows().map(row => row.title);
  assert.ok(!titles.includes('Yesterday meeting'), 'yesterday is gone');
  assert.ok(titles.includes('Long camp'), 'an event that began on Wednesday and ends on Sunday is on now');
  assert.deepEqual(titles, ['Long camp', 'Morning stand-up', 'Team meeting', 'Pre-Season', 'Food drive', 'Build day']);
});

test('an event that finished earlier today is listed greyed as earlier today, and one that has not finished is not', () => {
  assert.equal(rowTitled('Morning stand-up').earlier, true);
  assert.equal(rowTitled('Team meeting').earlier, false);
  const state = parts.stateOf(rowTitled('Morning stand-up'), [], now);
  assert.equal(state.id, 'earlier');
  assert.equal(state.text, 'Earlier today');
  assert.equal(state.canSwitch, false);
});

test('events are grouped by day, with Today and Tomorrow first and then the date', () => {
  const groups = parts.groupByDay(rows(), parts.dayIn(now, zone));
  assert.deepEqual(groups.map(group => group.label), ['Today', 'Tomorrow', 'Sun Oct 11', 'Mon Oct 12']);
  assert.deepEqual(groups.find(group => group.label === 'Today').rows.map(row => row.title), ['Long camp', 'Morning stand-up', 'Team meeting']);
  assert.equal(parts.dayLabel('2026-10-10', '2026-10-09'), 'Tomorrow');
  assert.equal(parts.dayLabel('2026-10-12', '2026-10-09'), 'Mon Oct 12');
});

test('each row carries the time, title, calendar name and a kind only when one is set', () => {
  const meeting = rowTitled('Team meeting');
  assert.equal(meeting.time, '6:00 PM');
  assert.equal(meeting.calendarName, 'Team calendar');
  assert.equal(meeting.kind, 'Meetings');
  assert.equal(parts.eventRows(status, [{ id: 'team', name: 'Team calendar', show: true }], now, zone)[0].kind, '', 'no kind, no chip');
  assert.equal(parts.eventRows(status, [{ id: 'team', name: 'Team calendar', show: true, kind: 'other' }], now, zone)[0].kind, '', 'Other has no chip');
});

test('a plain event shows on the TV, and a switched off calendar says the calendar is hidden and cannot be switched', () => {
  const shown = parts.stateOf(rowTitled('Team meeting'), [], now);
  assert.equal(shown.id, 'shown');
  assert.equal(shown.text, 'Shows on the TV');
  assert.equal(shown.on, true);
  assert.equal(shown.canSwitch, true);

  const off = parts.stateOf(rowTitled('Food drive'), [], now);
  assert.equal(off.id, 'hidden-calendar');
  assert.equal(off.text, 'The calendar is hidden');
  assert.equal(off.canSwitch, false);
  assert.match(off.note, /Dashboard Settings/);
});

const published = rule => ({ id: rule._id, published: rule, draft: null });

test('an event hidden by an ordinary rule says Hidden and names the rule in words', () => {
  const rule = { _id: 'calendarFilter-1', name: 'Hide Pre-Season', action: 'hide', words: ['Pre-Season'], show: true };
  const state = parts.stateOf(rowTitled('Pre-Season'), [published(rule)], now);
  assert.equal(state.id, 'hidden-rule');
  assert.equal(state.on, false);
  assert.equal(state.reason, 'Hidden by the rule Hide Pre-Season.');
  assert.equal(state.canSwitch, true, 'the switch can still show it');
  const always = { _id: 'calendarFilter-2', name: 'Keep it', action: 'show', words: ['Pre-Season'], show: true };
  assert.equal(parts.stateOf(rowTitled('Pre-Season'), [published(rule), published(always)], now).on, true, 'Always show wins, as on the TV');
  const off = Object.assign({}, rule, { show: false });
  assert.equal(parts.stateOf(rowTitled('Pre-Season'), [published(off)], now).on, true, 'a rule that is off does nothing');
});

test('when the rules cannot be read the word of the Teletraan computer is used and the switches stay off for the page', () => {
  const hidden = Object.assign({}, rowTitled('Pre-Season'), { listedShown: false, listedRule: 'Hide Pre-Season' });
  const state = parts.stateOf(hidden, null, now);
  assert.equal(state.on, false);
  assert.match(state.reason, /Hide Pre-Season/);
});

// A client that keeps documents in a list, as the Studio's does for drafts
function fakeClient() {
  const documents = {};
  const calls = [];
  return {
    documents: documents,
    calls: calls,
    createOrReplace: async doc => {
      calls.push('replace ' + doc._id);
      documents[doc._id] = doc;
      return doc;
    },
    delete: async id => {
      calls.push('delete ' + id);
      delete documents[id];
    },
    create: async () => assert.fail('the page never creates a published document'),
  };
}

test('the switch makes a DRAFT one event rule with the calendar, exact title, exact start and an expiry after the event', async () => {
  const row = rowTitled('Team meeting');
  const plan = parts.planSwitch(row, [], now);
  assert.equal(plan.make.length, 1);
  assert.deepEqual(plan.withdraw, []);

  const client = fakeClient();
  await parts.applySwitch(client, plan, []);
  const ids = Object.keys(client.documents);
  assert.equal(ids.length, 1);
  assert.match(ids[0], /^drafts\.calendarFilter-one-[0-9a-f]{16}$/);
  const doc = client.documents[ids[0]];
  assert.equal(doc._type, 'calendarFilter');
  assert.equal(doc.action, 'hide');
  assert.equal(doc.scope, 'one');
  assert.equal(doc.eventCalendar, 'team');
  assert.equal(doc.eventTitle, 'Team meeting');
  assert.equal(doc.eventStart, at('09', '22'));
  assert.equal(doc.show, true);
  assert.equal(doc.expires, '2026-10-10T23:00:00.000Z', 'a day after the event ends');
  assert.match(doc.name, /^One event: Team meeting, 2026-10-09$/);
  assert.ok(doc.name.length <= 40);
});

test('the same event always gets the same rule id, so a second click does not pile up rules', () => {
  const first = parts.oneEventRule(rowTitled('Team meeting'), 'hide');
  assert.equal(parts.oneEventRule(rowTitled('Team meeting'), 'hide')._id, first._id);
  assert.notEqual(parts.oneEventRule(rowTitled('Team meeting'), 'show')._id, first._id);
  assert.notEqual(parts.oneEventRule(rowTitled('Pre-Season'), 'hide')._id, first._id);
});

test('after the draft the event says Hidden by you, with Click Publish all pending, and it is not live on the TV yet', () => {
  const row = rowTitled('Team meeting');
  const plan = parts.planSwitch(row, [], now);
  const groups = parts.groupsAfter([], plan);
  const state = parts.stateOf(row, groups, now);
  assert.equal(state.id, 'hidden-you');
  assert.equal(state.text, 'Hidden by you');
  assert.equal(state.on, false);
  assert.equal(state.pending, true);
  assert.match(parts.words.applyNote, /^Click Publish all to apply\.$/);
});

test('the switch back removes a rule that is only a draft, and turns off a rule that is published', async () => {
  const row = rowTitled('Team meeting');
  const rule = parts.oneEventRule(row, 'hide');

  const draftOnly = [{ id: rule._id, published: null, draft: Object.assign({}, rule, { _id: 'drafts.' + rule._id }) }];
  const back = parts.planSwitch(row, draftOnly, now);
  assert.deepEqual(back.withdraw, [rule._id]);
  assert.deepEqual(back.make, []);
  const client = fakeClient();
  client.documents['drafts.' + rule._id] = draftOnly[0].draft;
  await parts.applySwitch(client, back, draftOnly);
  assert.deepEqual(client.calls, ['delete drafts.' + rule._id], 'a draft that was never published is deleted');
  assert.equal(parts.stateOf(row, parts.groupsAfter(draftOnly, back), now).on, true);

  const live = [published(rule)];
  const off = parts.planSwitch(row, live, now);
  const second = fakeClient();
  await parts.applySwitch(second, off, live);
  assert.equal(second.documents['drafts.' + rule._id].show, false, 'a published rule gets a draft that turns it off');
  assert.equal(second.calls.some(call => call.startsWith('delete')), false, 'the published rule is not deleted');
  const afterwards = parts.groupsAfter(live, off);
  const state = parts.stateOf(row, afterwards, now);
  assert.equal(state.on, true);
  assert.equal(state.pending, true, 'the TV still hides it until Publish all');
});

test('showing an event that a rule hides makes a Show one event rule, and hiding it again withdraws that rule', () => {
  const rule = { _id: 'calendarFilter-1', name: 'Hide Pre-Season', action: 'hide', words: ['Pre-Season'], show: true };
  const row = rowTitled('Pre-Season');
  const plan = parts.planSwitch(row, [published(rule)], now);
  assert.equal(plan.make.length, 1);
  assert.equal(plan.make[0].action, 'show');
  const groups = parts.groupsAfter([published(rule)], plan);
  const state = parts.stateOf(row, groups, now);
  assert.equal(state.on, true);
  assert.match(state.reason, /Shown by you/);
  const back = parts.planSwitch(row, groups, now);
  assert.deepEqual(back.make, []);
  assert.equal(back.withdraw.length, 1);
});

test('only draft documents are written, and nothing outside calendarFilter is touched', async () => {
  const row = rowTitled('Team meeting');
  const client = fakeClient();
  client.documents['other-doc'] = { _id: 'other-doc' };
  await parts.applySwitch(client, parts.planSwitch(row, [], now), []);
  assert.ok(client.calls.every(call => /^replace drafts\.calendarFilter-one-/.test(call)));
  assert.ok(client.documents['other-doc']);
});

test('a refused write is reported in words and leaves the page as it was', async () => {
  const row = rowTitled('Team meeting');
  const client = { createOrReplace: async () => { throw Object.assign(new Error('Insufficient permissions'), { statusCode: 403 }); } };
  await assert.rejects(parts.applySwitch(client, parts.planSwitch(row, [], now), []));
  assert.match(parts.failureText({ statusCode: 403, message: 'Insufficient permissions' }), /Studio refused the change/);
  assert.match(parts.failureText(new Error('offline')), /was not saved/);
});

test('rules are read with drafts, grouped by id, and a draft wins over the published version', async () => {
  const asked = [];
  const client = { fetch: async (question, params, options) => { asked.push(options); return [{ _id: 'calendarFilter-1', name: 'a' }, { _id: 'drafts.calendarFilter-1', name: 'a draft' }, { _id: 'drafts.calendarFilter-2', name: 'new' }, null]; } };
  const groups = await parts.readRuleGroups(client);
  assert.equal(asked[0].perspective, 'raw');
  assert.equal(groups.length, 2);
  assert.deepEqual(parts.effectiveRules(groups).map(rule => rule.name), ['a draft', 'new']);
  assert.deepEqual(parts.publishedRules(groups).map(rule => rule.name), ['a']);
  assert.equal(await parts.readRuleGroups({ fetch: async () => { throw new Error('offline'); } }), null);
});

test('filters: by calendar, by search words in the title or calendar, and Hidden only', () => {
  const list = rows().filter(row => row.calendarOn);
  const states = {};
  const rule = { _id: 'calendarFilter-1', name: 'Hide Pre-Season', action: 'hide', words: ['Pre-Season'], show: true };
  list.forEach(row => { states[row.key] = parts.stateOf(row, [published(rule)], now); });
  const titles = options => parts.filterRows(list, states, Object.assign({ calendar: '', search: '', hiddenOnly: false }, options)).map(row => row.title);
  assert.equal(titles({}).length, list.length);
  assert.deepEqual(titles({ search: 'team meet' }), ['Team meeting']);
  assert.deepEqual(titles({ search: 'TEAM CAL', calendar: 'team' }).length, list.length);
  assert.deepEqual(titles({ calendar: 'gears' }), []);
  assert.deepEqual(titles({ hiddenOnly: true }), ['Pre-Season']);
});

test('the header says when and from how many calendars, each calendar works or failed with the reason, and a computer with no calendars says so', () => {
  assert.equal(parts.downloadLine(status, now), 'Last downloaded 4 minutes ago from 2 calendars.');
  assert.equal(parts.downloadLine({ calendars: [] }, now), '');
  const lines = parts.calendarLines(status, entries, now);
  assert.match(lines[0].text, /^Works\. Downloaded 4 minutes ago\.$/);
  assert.equal(lines[2].failed, true);
  assert.match(lines[2].text, /^Failed\. Download failed, the server said no/);
  assert.equal(parts.emptyNotice({ calendars: [] }), 'No calendars are set up on the Teletraan computer. Add the links on the control page, Keys tab.');
  assert.match(parts.emptyNotice(null), /^Nothing yet\./);
  assert.equal(parts.emptyNotice(status), '');
});

test('empty states: no document, no calendars and no coming events give no rows and no error', () => {
  assert.deepEqual(parts.eventRows(null, entries, now, zone), []);
  assert.deepEqual(parts.eventRows({ calendars: [] }, entries, now, zone), []);
  assert.deepEqual(parts.eventRows({ calendars: [{ code: 'team', occurrences: [] }] }, entries, now, zone), []);
  assert.deepEqual(parts.groupByDay([], '2026-10-09'), []);
});

test('an event from an older document with no start cannot be switched, and says why', () => {
  const old = parts.eventRows({ calendars: [{ code: 'team', occurrences: [{ _key: 'o1', title: 'Team meeting', day: '2026-10-09', time: '6:00 PM', shown: true, rule: '' }] }] }, entries, now, zone)[0];
  const state = parts.stateOf(old, [], now);
  assert.equal(state.canSwitch, false);
  assert.match(state.note, /next run/);
  assert.equal(parts.oneEventRule(old, 'hide'), null);
});

test('rules are told in plain sentences, and one event rules are not in the list', () => {
  const list = [
    { _id: 'calendarFilter-1', name: 'Pre-Season', action: 'hide', words: ['Pre-Season'], days: [4, 1], calendar: 'team', show: true },
    { _id: 'calendarFilter-2', name: 'Kickoff', action: 'show', force: true, words: ['Kickoff'], show: true },
    { _id: 'calendarFilter-3', name: 'Old', action: 'hide', fromDate: '2026-01-01', toDate: '2026-02-01', show: false },
    parts.oneEventRule(rowTitled('Team meeting'), 'hide'),
  ].map(rule => published(rule));
  const told = parts.rulesList(list, now);
  assert.deepEqual(told.map(rule => rule.name), ['Kickoff', 'Old', 'Pre-Season']);
  assert.equal(told[2].text, 'Hides events with "Pre-Season" in the title, on Mon and Thu, in the team calendar.');
  assert.equal(told[0].text, 'Always shows events with "Kickoff" in the title. It pins them to page one.');
  assert.equal(told[1].text, 'Hides events, from 2026-01-01 to 2026-02-01. The rule is switched off.');
});

test('the helpers import only each other and the plain-value files, so node can run them', async () => {
  const fs = await import('node:fs');
  const text = fs.readFileSync(path.join(root, 'studio/inputs/calendars-list-parts.js'), 'utf8');
  const imports = Array.from(text.matchAll(/^import .* from '([^']+)';$/gm)).map(match => match[1]);
  assert.deepEqual(imports, ['./time-text.js', './plain-values.js', './calendars-hide-rules.js']);
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

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
