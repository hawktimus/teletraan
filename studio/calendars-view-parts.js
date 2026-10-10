// The parts of the Calendars page that need no Studio: its words, and the rows and lines it
// shows for the calendars of Dashboard Settings and the document the Mini writes
// (schemas/calendarStatus.js). calendars-view.js draws them. check-schemas.mjs and
// tools/test-calendars-view.mjs read them with node.

import { ageText, clockText } from './time-text.js';

// The id the Mini writes to. deploy/scripts/status-write.sh and calendar-status.sh have the same one.
export const calendarStatusId = 'calendar-status';

// The one line at the top of the page
export const helpLine = 'To hide a repeating meeting, add a rule under Calendar filters. To add a calendar, ask a coach to add its address on the Mini.';

export const nothingYet = 'Nothing yet. The Mini writes this after it has downloaded the calendars.';
export const settingsLine = 'To rename a calendar or switch it off, open Dashboard Settings and use the Calendars tab.';
export const publicLine = 'These titles are saved in the dataset, which anyone can read. That includes the ones a rule hides from the screen.';
export const noCalendarsLine = 'Dashboard Settings has no calendars yet. Add one on its Calendars tab.';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The words of a reason as a sentence: a capital letter first and a full stop last
function sentence(text) {
  const trimmed = capital(String(text).trim());
  return /[.?]$/.test(trimmed) ? trimmed : trimmed + '.';
}

function eventsWord(count) {
  return count + (count === 1 ? ' event' : ' events');
}

// The calendars of the status document that have a code, in the order the Mini wrote them
function statusCalendars(status) {
  const list = isRecord(status) && Array.isArray(status.calendars) ? status.calendars : [];
  return list.filter(item => isRecord(item) && typeof item.code === 'string' && item.code !== '');
}

// How many events a calendar has, and how many of them a rule hides. Both are numbers only
// when the Mini listed the events.
function countsOf(calendar) {
  if (!calendar || typeof calendar.eventCount !== 'number') return null;
  const hidden = typeof calendar.hiddenCount === 'number' ? calendar.hiddenCount : 0;
  return { total: calendar.eventCount, hidden: hidden };
}

function countText(calendar) {
  if (!calendar) return 'Nothing yet';

  const counts = countsOf(calendar);
  if (!counts) return 'Events not listed';
  return eventsWord(counts.total) + (counts.hidden > 0 ? ', ' + counts.hidden + ' hidden' : '');
}

function downloadText(calendar, now) {
  if (!calendar) return 'Nothing yet';

  const age = ageText(calendar.fetchedAt, now);
  return age ? 'Downloaded ' + age : 'Not downloaded yet';
}

function screenText(entry) {
  if (!entry) return 'Not in Dashboard Settings, so the screen shows none of it';
  return entry.show === false ? 'Switched off on the screen' : 'On the screen';
}

// The rows on the left: the calendars of Dashboard Settings in their order, then any calendar
// that only the Mini knows about. entries is the calendars field of Dashboard Settings, status
// is the document the Mini wrote or null, and now is the time to count the ages from.
// Each row has what the left side shows, and calendar, which the right side reads.
export function rowsOf(entries, status, now) {
  const listed = (Array.isArray(entries) ? entries : []).filter(item => isRecord(item) && typeof item.id === 'string' && item.id !== '');
  const known = statusCalendars(status);
  const found = code => known.filter(item => item.code === code)[0] || null;

  const rows = listed.map(entry => ({ code: entry.id, name: entry.name || entry.id, entry: entry }));
  known.forEach(calendar => {
    if (!rows.some(row => row.code === calendar.code)) rows.push({ code: calendar.code, name: calendar.code, entry: null });
  });

  return rows.map(row => {
    const calendar = found(row.code);
    return {
      code: row.code,
      name: row.name,
      screen: screenText(row.entry),
      count: countText(calendar),
      download: downloadText(calendar, now),
      problem: calendar && calendar.error ? sentence(calendar.error) : '',
      calendar: calendar,
    };
  });
}

// One coming event for the right side: the words the screen would show, and whether it shows
function eventLine(event, index) {
  const item = isRecord(event) ? event : {};
  const hidden = item.shown === false;
  const rule = typeof item.rule === 'string' ? item.rule : '';

  return {
    key: typeof item._key === 'string' ? item._key : 'event' + index,
    date: typeof item.date === 'string' ? item.date : '',
    time: typeof item.time === 'string' && item.time !== '' ? item.time : 'All day',
    title: typeof item.title === 'string' && item.title !== '' ? item.title : 'No title',
    badge: hidden ? 'HIDDEN' : 'SHOWN',
    hidden: hidden,
    rule: hidden ? 'Hidden by ' + (rule || 'a rule with no name') : '',
  };
}

// The right side for one row: the facts, the problem, the note from the Mini and the coming
// events. status is the whole document, for its note.
export function detailOf(row, status, now) {
  const calendar = row.calendar;
  const counts = countsOf(calendar);
  const events = calendar && Array.isArray(calendar.occurrences) ? calendar.occurrences.map(eventLine) : [];
  const note = isRecord(status) && typeof status.eventsNote === 'string' ? status.eventsNote : '';

  const clock = calendar ? clockText(calendar.fetchedAt) : '';
  const age = calendar ? ageText(calendar.fetchedAt, now) : '';
  const facts = [
    { label: 'On the screen', text: row.screen },
    { label: 'Last download', text: age && clock ? age + ' (' + clock + ')' : row.download },
    { label: 'Events in the next 30 days', text: counts ? row.count : calendar ? 'Not listed' : 'Nothing yet' },
  ];

  let empty = '';
  if (!calendar) empty = nothingYet;
  else if (!counts) empty = note ? sentence(note) : 'The Mini has not listed the events of this calendar yet.';
  else if (events.length === 0) empty = 'No events in the next 30 days.';

  return { name: row.name, code: row.code, facts: facts, problem: row.problem, events: events, empty: empty };
}

// When the Mini wrote the document, in words, or nothing when the document has no time
export function updatedText(status, now) {
  const age = isRecord(status) ? ageText(status.updatedAt, now) : '';
  return age ? 'The Mini wrote this ' + age + '.' : '';
}

// What was read: { entries, status, entriesUnreadable, statusUnreadable }, or null while
// it is being read. The words that go above the two sides, one line each.
export function notesFor(read) {
  if (!read) return [];

  const notes = [];
  if (read.entriesUnreadable) notes.push('Dashboard Settings could not be read, so the names and switches are missing.');
  if (read.statusUnreadable) notes.push('The status of the calendars could not be read.');
  return notes;
}
