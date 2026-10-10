// Tests for the rows and lines of the Calendars page in Studio (studio/calendars-view-parts.js):
// what the left side says about each calendar of Dashboard Settings, what the right side says
// about the one picked, and what each says before the Mini has written anything. The helpers
// are plain functions, so nothing is installed and nothing touches the network. The page that
// draws them, and the reading of the two documents, are checked by studio/check-schemas.mjs.
//
//   node tools/test-calendars-view.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const studio = path.join(root, 'studio');
const parts = await import(pathToFileURL(path.join(studio, 'calendars-view-parts.js')).href);
const { ageText, clockText } = await import(pathToFileURL(path.join(studio, 'time-text.js')).href);

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

const now = new Date('2026-10-09T15:00:00.000Z');
const ago = minutes => new Date(now.getTime() - minutes * 60000).toISOString();

const entries = [
  { _key: 'a', id: 'team', name: 'Team calendar', show: true },
  { _key: 'b', id: 'outreach', name: 'Outreach', show: false },
  { _key: 'c', id: 'gears', name: 'Gears' },
];

const status = {
  _id: 'calendar-status',
  _type: 'calendarStatus',
  updatedAt: ago(1),
  calendars: [
    {
      code: 'team',
      fetchedAt: ago(5),
      eventCount: 14,
      hiddenCount: 3,
      occurrences: [
        { _key: 'o1', title: 'Team meeting', date: 'MON OCT 12', time: '6:00 PM', shown: true, rule: '' },
        { _key: 'o2', title: 'Pre-Season Meeting', date: 'TUE OCT 13', time: '6:30 PM', shown: false, rule: 'Hide Pre-Season' },
        { _key: 'o3', title: 'Open house', date: 'WED OCT 14', time: '', shown: false, rule: '' },
      ],
    },
    { code: 'outreach', fetchedAt: ago(130), error: 'download failed, the server said no, so the address may be wrong or expired', eventCount: 1, hiddenCount: 0, occurrences: [] },
    { code: 'gears', fetchedAt: ago(30), eventCount: 0, hiddenCount: 0, occurrences: [] },
    { code: 'old', error: 'no address set yet' },
  ],
};

function rowFor(rows, code) {
  return rows.filter(row => row.code === code)[0];
}

test('the left side lists the calendars of Dashboard Settings in their order, then any calendar only the Mini knows', () => {
  const rows = parts.rowsOf(entries, status, now);

  assert.deepEqual(rows.map(row => row.code), ['team', 'outreach', 'gears', 'old']);
  assert.deepEqual(rows.map(row => row.name), ['Team calendar', 'Outreach', 'Gears', 'old'], 'a calendar with no row in Dashboard Settings is named by its code');
});

test('each row says whether the screen shows the calendar, how many events it has, and when it was downloaded', () => {
  const rows = parts.rowsOf(entries, status, now);
  const team = rowFor(rows, 'team');

  assert.equal(team.screen, 'On the screen');
  assert.equal(team.count, '14 events, 3 hidden');
  assert.equal(team.download, 'Downloaded 5 minutes ago');
  assert.equal(team.problem, '');

  assert.equal(rowFor(rows, 'outreach').screen, 'Switched off on the screen');
  assert.equal(rowFor(rows, 'outreach').count, '1 event', 'one event is not events');
  assert.equal(rowFor(rows, 'outreach').download, 'Downloaded 2 hours ago');
  assert.equal(rowFor(rows, 'gears').screen, 'On the screen', 'a row with no switch set shows, as the screen reads it');
  assert.equal(rowFor(rows, 'gears').count, '0 events');
  assert.equal(rowFor(rows, 'old').screen, 'Not in Dashboard Settings, so the screen shows none of it');
});

test('a calendar that failed to download shows why, as a sentence, and keeps the time of the last good download', () => {
  const rows = parts.rowsOf(entries, status, now);

  assert.equal(rowFor(rows, 'outreach').problem, 'Download failed, the server said no, so the address may be wrong or expired.');
  assert.equal(rowFor(rows, 'old').problem, 'No address set yet.');
  assert.equal(rowFor(rows, 'old').download, 'Not downloaded yet');
  assert.equal(rowFor(rows, 'old').count, 'Events not listed', 'a calendar the Mini never read has no count');

  const stopped = parts.rowsOf(entries, { calendars: [{ code: 'team', error: 'the address starts with http://, which is not secure. Use the https:// address' }] }, now);
  assert.equal(rowFor(stopped, 'team').problem, 'The address starts with http://, which is not secure. Use the https:// address.', 'one full stop, not two');
});

test('before the Mini has written anything every row says Nothing yet, and the calendars of Dashboard Settings are still listed', () => {
  [null, undefined, {}, { calendars: [] }, 'text', 5].forEach(missing => {
    const rows = parts.rowsOf(entries, missing, now);

    assert.deepEqual(rows.map(row => row.code), ['team', 'outreach', 'gears'], JSON.stringify(missing));
    rows.forEach(row => {
      assert.equal(row.count, 'Nothing yet');
      assert.equal(row.download, 'Nothing yet');
      assert.equal(row.problem, '');
      assert.equal(row.calendar, null);
    });
  });
});

test('a status that has no entry for a calendar says Nothing yet for that calendar only', () => {
  const rows = parts.rowsOf(entries, { calendars: [{ code: 'team', fetchedAt: ago(1), eventCount: 2, hiddenCount: 0, occurrences: [] }] }, now);

  assert.equal(rowFor(rows, 'team').count, '2 events');
  assert.equal(rowFor(rows, 'team').download, 'Downloaded 1 minute ago');
  assert.equal(rowFor(rows, 'outreach').count, 'Nothing yet');
});

test('rows and details survive documents that are not what they should be', () => {
  const oddStatuses = [null, undefined, 'text', 5, [], {}, { calendars: 'text' }, { calendars: [null, 5, 'x', [], {}, { code: 5 }, { code: '' }] }];
  const oddLists = [null, undefined, 'text', 5, {}, [], [null, 5, { id: 5 }, { id: '' }, { id: 'ok' }], entries];

  oddStatuses.forEach(status => {
    oddLists.forEach(list => {
      const rows = parts.rowsOf(list, status, now);
      assert.ok(Array.isArray(rows));
      rows.forEach(row => {
        const detail = parts.detailOf(row, status, now);
        assert.ok(typeof detail.name === 'string' && Array.isArray(detail.facts) && Array.isArray(detail.events));
      });
    });
  });

  const rows = parts.rowsOf([{ id: 'team' }], { calendars: [{ code: 'team', fetchedAt: 'soon', eventCount: 'many', hiddenCount: 'some', occurrences: [null, 5, { title: 5, date: 5, time: 5, shown: 'yes', rule: 5 }] }] }, now);
  assert.equal(rows[0].name, 'team', 'a row with no name is named by its code');
  assert.equal(rows[0].download, 'Not downloaded yet', 'a time that cannot be read is not a time');
  assert.equal(rows[0].count, 'Events not listed', 'a count that is not a number is not a count');
  const events = parts.detailOf(rows[0], null, now).events;
  assert.equal(events.length, 3);
  assert.deepEqual(events.map(event => event.badge), ['SHOWN', 'SHOWN', 'SHOWN'], 'only a false switch means hidden');
});

test('the right side has the facts, and each event with its date, time, title, SHOWN or HIDDEN and the rule that hides it', () => {
  const rows = parts.rowsOf(entries, status, now);
  const detail = parts.detailOf(rowFor(rows, 'team'), status, now);

  assert.equal(detail.name, 'Team calendar');
  assert.equal(detail.code, 'team');
  assert.deepEqual(detail.facts.map(fact => fact.label), ['On the screen', 'Last download', 'Events in the next 30 days']);
  assert.equal(detail.facts[0].text, 'On the screen');
  assert.match(detail.facts[1].text, /^5 minutes ago \(.+\)$/);
  assert.equal(detail.facts[2].text, '14 events, 3 hidden');
  assert.equal(detail.empty, '');

  assert.deepEqual(detail.events.map(event => [event.key, event.date, event.time, event.title, event.badge, event.rule]), [
    ['o1', 'MON OCT 12', '6:00 PM', 'Team meeting', 'SHOWN', ''],
    ['o2', 'TUE OCT 13', '6:30 PM', 'Pre-Season Meeting', 'HIDDEN', 'Hidden by Hide Pre-Season'],
    ['o3', 'WED OCT 14', 'All day', 'Open house', 'HIDDEN', 'Hidden by a rule with no name'],
  ]);
  assert.deepEqual(detail.events.map(event => event.hidden), [false, true, true]);
});

test('the right side says why there is nothing to list: nothing yet, no events, or events the Mini did not list', () => {
  const rows = parts.rowsOf(entries, status, now);

  assert.equal(parts.detailOf(rowFor(rows, 'gears'), status, now).empty, 'No events in the next 30 days.');
  assert.equal(parts.detailOf(rowFor(rows, 'old'), status, now).empty, 'The Mini has not listed the events of this calendar yet.');

  const noted = { calendars: [{ code: 'team', fetchedAt: ago(5) }], eventsNote: 'Node is not installed on the Mini, so it does not list the coming events' };
  const detail = parts.detailOf(rowFor(parts.rowsOf(entries, noted, now), 'team'), noted, now);
  assert.equal(detail.empty, 'Node is not installed on the Mini, so it does not list the coming events.', 'the note of the Mini, as a sentence');
  assert.equal(detail.facts[2].text, 'Not listed');

  const nothing = parts.detailOf(rowFor(parts.rowsOf(entries, null, now), 'team'), null, now);
  assert.equal(nothing.empty, parts.nothingYet);
  assert.equal(nothing.facts[2].text, 'Nothing yet');
  assert.deepEqual(nothing.events, []);
});

test('the page says when the Mini wrote the document, and nothing when it has no time', () => {
  assert.equal(parts.updatedText({ updatedAt: ago(0) }, now), 'The Mini wrote this just now.');
  assert.equal(parts.updatedText({ updatedAt: ago(3) }, now), 'The Mini wrote this 3 minutes ago.');
  assert.equal(parts.updatedText({ updatedAt: ago(180) }, now), 'The Mini wrote this 3 hours ago.');
  [null, undefined, {}, 'text', 5, { updatedAt: 'soon' }, { updatedAt: 5 }].forEach(missing => assert.equal(parts.updatedText(missing, now), '', JSON.stringify(missing)));
});

test('the page notes say which document could not be read, and say nothing while it is being read or when both were', () => {
  assert.deepEqual(parts.notesFor(null), []);
  assert.deepEqual(parts.notesFor({ entriesUnreadable: false, statusUnreadable: false }), []);
  assert.deepEqual(parts.notesFor({ entriesUnreadable: true, statusUnreadable: false }), ['Dashboard Settings could not be read, so the names and switches are missing.']);
  assert.deepEqual(parts.notesFor({ entriesUnreadable: false, statusUnreadable: true }), ['The status of the calendars could not be read.']);
  assert.equal(parts.notesFor({ entriesUnreadable: true, statusUnreadable: true }).length, 2);
});

test('the words are short plain sentences: the help line, no dash, no exclamation mark and no emoji', () => {
  assert.equal(parts.helpLine, 'To hide a repeating meeting, add a rule under Calendar filters. To add a calendar, ask a coach to add its address on the Mini.');
  assert.equal(parts.calendarStatusId, 'calendar-status');

  const texts = [parts.helpLine, parts.nothingYet, parts.settingsLine, parts.publicLine, parts.noCalendarsLine].concat(parts.notesFor({ entriesUnreadable: true, statusUnreadable: true }));
  const rows = parts.rowsOf(entries, status, now);
  rows.forEach(row => {
    const detail = parts.detailOf(row, status, now);
    texts.push(row.screen, row.count, row.download, row.problem, detail.empty);
    detail.facts.forEach(fact => texts.push(fact.text));
    detail.events.forEach(event => texts.push(event.rule));
  });

  texts.filter(Boolean).forEach(text => {
    text.split(/[.?]\s+|[.?]$/).forEach(sentence => {
      assert.ok(sentence.trim().split(/\s+/).filter(Boolean).length <= 20, 'a sentence is too long: ' + sentence);
    });
    assert.ok(!/[\u2014\u2013!]/.test(text), 'a dash or an exclamation mark in: ' + text);
    assert.ok(!/\p{Extended_Pictographic}/u.test(text), 'an emoji in: ' + text);
  });

  assert.ok(/dataset/.test(parts.publicLine) && /anyone can read/.test(parts.publicLine) && /rule hides/.test(parts.publicLine), 'the page says the titles are public, even the hidden ones');
});

test('ages are in words, and a time that cannot be read gives nothing', () => {
  assert.equal(ageText(ago(0), now), 'just now');
  assert.equal(ageText(ago(1), now), '1 minute ago');
  assert.equal(ageText(ago(5), now), '5 minutes ago');
  assert.equal(ageText(ago(60), now), '1 hour ago');
  assert.equal(ageText(ago(3 * 24 * 60), now), '3 days ago');
  [undefined, null, '', 'soon', 5, {}].forEach(value => {
    assert.equal(ageText(value, now), '');
    assert.equal(clockText(value), '');
  });
  assert.match(clockText('2026-10-09T15:00:00.000Z'), /2026/);
});

test('the helpers need nothing installed: they import only each other', () => {
  const imports = file => Array.from(fs.readFileSync(path.join(studio, file), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)).map(match => match[1]);

  assert.deepEqual(imports('calendars-view-parts.js'), ['./time-text.js']);
  assert.deepEqual(imports('time-text.js'), []);
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
