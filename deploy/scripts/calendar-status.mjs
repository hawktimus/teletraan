// The Node half of calendar-status.sh. It uses the dashboard's own code to read a
// calendar file and to apply the Calendar filters, so the events it lists are
// what the screen would do. It never sees a calendar address: it reads the files
// that fetch-calendars.sh saved.
//
//   node calendar-status.mjs address
//       prints the address that asks Sanity for the content, as the dashboard does
//   node calendar-status.mjs build <Sanity answer file> <calendar-sync.txt> <calendars folder>
//       prints the calendar status document as one line of JSON: for each calendar
//       its code, when it was last downloaded, why the last download failed, how
//       many events it has in the next 30 days, how many of those the filters
//       hide, and the next 40 with their title, date, day and time, whether the
//       screen shows each one, and the name of the rule that hides it

import fs from 'node:fs';
import path from 'node:path';
import { sanity } from '../../dashboard/config.js';
import { expandEvents, parseIcs } from '../../dashboard/core/calendar.js';
import { eventDate, firstDayOf, hidingRule, timeText } from '../../dashboard/core/events.js';
import { normalizeContent, queryUrl } from '../../dashboard/core/sanity.js';

const daysAhead = 30;
const dayMs = 86400000;
const listed = 40;
const mostCalendars = 20;
const longestText = 60;

// status-write.sh refuses a document of more than 100000 bytes, and then the page
// would stop changing. 7 calendars of 40 events come to about 65000 at the most
// with plain letters, so this only matters for titles that take several bytes
// to a character.
const largestDocument = 90000;

const codePattern = /^[a-z0-9_]+$/;
const timePattern = /^\d{4}-\d{2}-\d{2}T[0-9:]+Z$/;

// The reasons fetch-calendars.sh gives are plain words. Anything else in the
// file is not one of them and is not passed on to the dataset.
const reasonPattern = /^[A-Za-z0-9 ,.:/()_'-]{1,120}$/;

// A title or a rule name on one line, cut at 60 characters
function plainText(text, empty) {
  const line = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (line === '') return empty;
  if (line.length <= longestText) return line;

  // The cut stops before half of an emoji, which the document would carry as a broken character
  const last = line.charCodeAt(longestText - 1);
  const end = last >= 0xd800 && last <= 0xdbff ? longestText - 1 : longestText;
  return line.slice(0, end).trim() + '...';
}

// calendar-sync.txt has a line for each calendar: its code, the time of its last
// good download and why the last try failed, with a | between them
function readSyncRows(text) {
  const rows = [];
  text.split('\n').forEach(line => {
    const parts = line.split('|');
    const code = parts[0];
    if (!codePattern.test(code) || rows.some(row => row.code === code)) return;

    const fetchedAt = parts[1] || '';
    const reason = parts.slice(2).join('|');
    rows.push({
      code: code,
      fetchedAt: timePattern.test(fetchedAt) ? fetchedAt : '',
      error: reason === '' || reasonPattern.test(reason) ? reason : 'the download failed',
    });
  });
  return rows.slice(0, mostCalendars);
}

// Every event of the next 30 days of one calendar file, in order, judged by the
// Calendar filters. A day back is read as well, so an event that is on right now
// is found, as the screen does.
function occurrencesOf(content, code, text, now) {
  const zone = content.theme.timeZone;
  const from = new Date(now.getTime() - dayMs);
  const to = new Date(now.getTime() + daysAhead * dayMs);

  return expandEvents(parseIcs(text), from, to)
    .filter(event => event.end > now || event.start >= now)
    .map(event => {
      event.calendarId = code;
      const rule = hidingRule(event, content.calendarFilters, zone, now);
      const listing = {
        title: plainText(event.title, 'No title'),
        date: eventDate(event, zone).text,
        day: firstDayOf(event, zone),
        time: timeText(event),
        shown: rule === null,
        rule: rule ? plainText(rule.name, 'a rule with no name') : '',
      };
      // The day the filters judge by, so a rule made on the Calendars page matches this event
      if (listing.day === '') delete listing.day;
      return listing;
    });
}

function calendarEntry(row, content, folder, now) {
  const entry = { _key: row.code, code: row.code };
  if (row.fetchedAt) entry.fetchedAt = row.fetchedAt;
  if (row.error) entry.error = row.error;

  const file = path.join(folder, row.code + '.ics');
  if (!fs.existsSync(file)) return entry;

  // The file of an earlier download stays in use after a failed one, as it does on the screen
  try {
    const found = occurrencesOf(content, row.code, fs.readFileSync(file, 'utf8'), now);
    entry.eventCount = found.length;
    entry.hiddenCount = found.filter(event => !event.shown).length;
    entry.occurrences = found.slice(0, listed).map((event, index) => Object.assign({ _key: 'o' + (index + 1) }, event));
  } catch (error) {
    entry.error = entry.error || 'the calendar file could not be read';
  }
  return entry;
}

// The calendar with the most listed events gives one up, from its end, until the document fits
function fitIntoSize(document) {
  const longest = () => document.calendars.reduce((most, entry) => ((entry.occurrences || []).length > (most.occurrences || []).length ? entry : most), { occurrences: [] });

  while (Buffer.byteLength(JSON.stringify(document)) > largestDocument && longest().occurrences.length > 0) {
    longest().occurrences.pop();
  }
  return document;
}

function statusDocument(content, rows, folder, now) {
  return fitIntoSize({
    _id: 'calendar-status',
    _type: 'calendarStatus',
    updatedAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    calendars: rows.map(row => calendarEntry(row, content, folder, now)),
  });
}

const [mode, answerFile, syncFile, folder] = process.argv.slice(2);

if (mode === 'address') {
  console.log(queryUrl(sanity));
} else if (mode === 'build') {
  const answer = JSON.parse(fs.readFileSync(answerFile, 'utf8'));
  if (!answer || typeof answer.result !== 'object' || answer.result === null) {
    throw new Error('Sanity did not send the content');
  }

  const rows = readSyncRows(fs.readFileSync(syncFile, 'utf8'));
  console.log(JSON.stringify(statusDocument(normalizeContent(answer.result), rows, folder, new Date())));
} else {
  console.error('Usage: node calendar-status.mjs address | build <Sanity answer file> <calendar-sync.txt> <calendars folder>');
  process.exitCode = 2;
}
