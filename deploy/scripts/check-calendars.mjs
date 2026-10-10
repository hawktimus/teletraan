// The Node half of check-calendars.sh. It uses the dashboard's own code to read
// a calendar file and to apply the Calendar filters, so what it prints is what
// the screen would do.
//
//   node check-calendars.mjs address
//       prints the address that asks Sanity for the content, as the dashboard does
//   node check-calendars.mjs <Sanity answer file> <calendar code> <calendar file> [folder]
//       prints a line for each event of the next 30 days, SHOWN or HIDDEN, and then
//       how many of each. A SHOWN line also says which page of the Events panel the
//       event is on, and the kind of its calendar. The page depends on every calendar
//       that is switched on, so the folder holds the downloaded file of each one,
//       named <code>.ics. Without the folder only this calendar is counted.
//       Only the code, the dates, the titles and the rule names are printed.

import fs from 'node:fs';
import path from 'node:path';
import { sanity } from '../../dashboard/config.js';
import { expandEvents, parseIcs } from '../../dashboard/core/calendar.js';
import { eventPages, kindOf, kindTitle } from '../../dashboard/core/event-pages.js';
import { eventDate, hidingRule, mergeEvents, timeText } from '../../dashboard/core/events.js';
import { normalizeContent, queryUrl } from '../../dashboard/core/sanity.js';

const daysAhead = 30;
const dayMs = 86400000;

// The screen reads its calendars this far ahead (shell.js), so the pages are worked out from that many
const screenDaysAhead = 60;

function line(word, id, text) {
  console.log(word.padEnd(8) + id + '  ' + text);
}

// The same events the screen reads from a calendar file: every occurrence from a day back to the end
// of the window, named for its calendar
function readEvents(text, id, name, now, days) {
  const from = new Date(now.getTime() - dayMs);
  const to = new Date(now.getTime() + days * dayMs);
  const events = expandEvents(parseIcs(text), from, to);

  events.forEach(event => {
    event.calendar = name;
    event.calendarId = id;
  });
  return events;
}

function keyOf(event) {
  return event.calendarId + '|' + event.start.getTime() + '|' + event.title;
}

// Where the screen puts each event: a map from keyOf() to { page, forced }. An event that is on
// neither page is not in it. Every calendar with a row that is switched on and a file in the folder
// counts, the way the screen merges them.
function placesOf(content, id, text, folder, now) {
  const rows = content.settings.calendars.filter(row => row.show !== false && /^[a-z0-9_]+$/.test(row.id));
  const events = [];

  rows.forEach(row => {
    const file = path.join(folder || '', row.id + '.ics');
    const own = row.id === id ? text : folder && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (own !== null) events.push(...readEvents(own, row.id, row.name, now, screenDaysAhead));
  });

  const kept = events.filter(event => event.end > now || event.start >= now);
  const merged = mergeEvents(kept, content.theme.timeZone, now, content.calendarFilters);
  const places = new Map();

  eventPages(Object.assign({}, content, { events: merged }), now).forEach((rowsOnPage, index) => {
    rowsOnPage.forEach(row => places.set(keyOf(row.event), { page: index + 1, forced: row.forced }));
  });
  return places;
}

// page 1, page 1 pinned, page 2, later (it is shown, but not one of the first eight) or no page
// (the calendar has no row or is switched off, so none of it is read)
function placeText(place, isRead) {
  if (!isRead) return 'no page';
  if (!place) return 'later';
  return 'page ' + place.page + (place.forced ? ' pinned' : '');
}

function check(content, id, text, folder) {
  const zone = content.theme.timeZone;
  const now = new Date();

  const row = content.settings.calendars.find(calendar => calendar.id === id);
  if (!row) {
    line('NOTE', id, 'has no row in Dashboard Settings, Calendars, so the screen shows none of it');
  } else if (row.show === false) {
    line('NOTE', id, 'is switched off in Dashboard Settings, Calendars, so the screen shows none of it');
  }
  const isRead = Boolean(row) && row.show !== false;
  const places = placesOf(content, id, text, folder, now);

  const events = readEvents(text, id, row ? row.name : '', now, daysAhead)
    .filter(event => event.end > now || event.start >= now);

  let shown = 0;
  let hidden = 0;
  events.forEach(event => {
    const rule = hidingRule(event, content.calendarFilters, zone, now);
    const when = [eventDate(event, zone).text.padEnd(10), timeText(event)].join('  ').trim();

    if (rule) {
      hidden += 1;
      line('HIDDEN', id, when + '  ' + event.title + '  (hidden by ' + (rule.name || 'a rule with no name') + ')');
    } else {
      shown += 1;
      const place = placeText(places.get(keyOf(event)), isRead) + ' · ' + kindTitle(kindOf(event, content.settings.calendars));
      line('SHOWN', id, when + '  ' + place + '  ' + event.title);
    }
  });

  line('TOTAL', id, shown + ' shown, ' + hidden + ' hidden');
}

const [first, id, calendarFile, folder] = process.argv.slice(2);

if (first === 'address') {
  console.log(queryUrl(sanity));
} else {
  const answer = JSON.parse(fs.readFileSync(first, 'utf8'));
  check(normalizeContent(answer.result), id, fs.readFileSync(calendarFile, 'utf8'), folder);
}
