// The Node half of check-calendars.sh. It uses the dashboard's own code to read
// a calendar file and to apply the Calendar filters, so what it prints is what
// the screen would do.
//
//   node check-calendars.mjs address
//       prints the address that asks Sanity for the content, as the dashboard does
//   node check-calendars.mjs <Sanity answer file> <calendar code> <calendar file>
//       prints a line for each event of the next 30 days, SHOWN or HIDDEN, and then
//       how many of each. Only the code, the dates, the titles and the rule names
//       are printed.

import fs from 'node:fs';
import { sanity } from '../../dashboard/config.js';
import { expandEvents, parseIcs } from '../../dashboard/core/calendar.js';
import { eventDate, hidingRule, timeText } from '../../dashboard/core/events.js';
import { normalizeContent, queryUrl } from '../../dashboard/core/sanity.js';

const daysAhead = 30;
const dayMs = 86400000;

function line(word, id, text) {
  console.log(word.padEnd(8) + id + '  ' + text);
}

function check(content, id, text) {
  const zone = content.theme.timeZone;
  const now = new Date();

  const row = content.settings.calendars.find(calendar => calendar.id === id);
  if (!row) {
    line('NOTE', id, 'has no row in Dashboard Settings, Calendars, so the screen shows none of it');
  } else if (row.show === false) {
    line('NOTE', id, 'is switched off in Dashboard Settings, Calendars, so the screen shows none of it');
  }

  // Starting a day back finds an event that is on right now, as the screen does
  const from = new Date(now.getTime() - dayMs);
  const to = new Date(now.getTime() + daysAhead * dayMs);
  const events = expandEvents(parseIcs(text), from, to)
    .filter(event => event.end > now || event.start >= now);

  let shown = 0;
  let hidden = 0;
  events.forEach(event => {
    event.calendarId = id;
    const rule = hidingRule(event, content.calendarFilters, zone, now);
    const when = [eventDate(event, zone).text.padEnd(10), timeText(event)].join('  ').trim();

    if (rule) {
      hidden += 1;
      line('HIDDEN', id, when + '  ' + event.title + '  (hidden by ' + (rule.name || 'a rule with no name') + ')');
    } else {
      shown += 1;
      line('SHOWN', id, when + '  ' + event.title);
    }
  });

  line('TOTAL', id, shown + ' shown, ' + hidden + ' hidden');
}

const [first, id, calendarFile] = process.argv.slice(2);

if (first === 'address') {
  console.log(queryUrl(sanity));
} else {
  const answer = JSON.parse(fs.readFileSync(first, 'utf8'));
  check(normalizeContent(answer.result), id, fs.readFileSync(calendarFile, 'utf8'));
}
