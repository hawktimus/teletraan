// One list of events from two places: the BAND calendars (core/calendar.js)
// and the Events Calendar entries that editors type into the Studio for things
// that are not on BAND. shell.js calls mergeEvents() each time either changes, and once
// a minute so an event that has finished disappears. The Events panel and the
// Next event tile show the list it returns. The Calendar filters from the Studio
// take BAND events out of it, after the repeating events are expanded.
//
// Every event has the shape core/calendar.js makes, with Date objects:
//   { title, start, end, allDay, location, uid, calendar, calendarId }
// An event that comes out of mergeEvents() also has firstDay and lastDay, the
// dates it covers written like 2027-04-02. An all-day event ends at the
// midnight after its last day, the same as a BAND one.
//
// Dates are read in the Time zone on the Theme page, so "today" is the same
// day for the editors and for the screen. eventDate() at the bottom writes the
// date of an event for the screen, and every panel that shows one uses it, so
// they all agree. Plain functions only, so tools/test-content.mjs can run them.

import { defaultThemeSettings } from '../config.js';
import { visibleItems } from './content.js';
import { dateIn, isTimeZone } from './theme.js';
import { asDate, formatTimeOfDay, pad } from './time.js';

export const extraCalendarId = 'extra';
const extraCalendarName = 'Extra';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Dates and clock times as the Studio writes them

function dayParts(day) {
  const numbers = day.split('-').map(Number);
  return { year: numbers[0], month: numbers[1], day: numbers[2] };
}

// 2027-04-02, and a day that exists. 2027-02-30 is refused.
export function isDay(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

  const parts = dayParts(text);
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return check.getUTCFullYear() === parts.year && check.getUTCMonth() === parts.month - 1 && check.getUTCDate() === parts.day;
}

// 24 hour time with two digits, such as 09:05 or 18:30
export function isTime(text) {
  return typeof text === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
}

function addDays(day, count) {
  const parts = dayParts(day);
  const moved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + count));
  return moved.getUTCFullYear() + '-' + pad(moved.getUTCMonth() + 1) + '-' + pad(moved.getUTCDate());
}

// Midnight at the start of that day on this computer's clock. This is how the
// calendar reader makes an all-day event, so the day of an all-day event is
// the same one whatever time zone the computer is in.
function localMidnight(day) {
  const parts = dayParts(day);
  return new Date(parts.year, parts.month - 1, parts.day);
}

function localDay(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

// The real moment when the clock in a time zone shows a date and a time,
// for example instantIn('America/New_York', '2027-01-09', '18:30'). Written
// with Intl and no library.

const clocks = {};

function clockIn(timeZone) {
  if (!clocks[timeZone]) {
    clocks[timeZone] = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      hour12: false,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  }
  return clocks[timeZone];
}

// How far ahead of UTC the zone's clock is at that moment, in milliseconds
function offsetAt(timeZone, moment) {
  const parts = {};
  clockIn(timeZone).formatToParts(new Date(moment)).forEach(part => {
    parts[part.type] = Number(part.value);
  });

  // some browsers write midnight as hour 24
  const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return shown - Math.floor(moment / 1000) * 1000;
}

// The offset is looked up twice. The first guess treats the time as if it were
// UTC. The second uses the offset at the guess, which is right even when the
// clocks change between the two. A time that the clock change skips (2:30 on
// the night the clocks go forward) comes out an hour off, which does not matter here.
export function instantIn(timeZone, day, time) {
  const date = dayParts(day);
  const clock = time.split(':').map(Number);
  const wanted = Date.UTC(date.year, date.month - 1, date.day, clock[0], clock[1]);

  const guess = wanted - offsetAt(timeZone, wanted);
  return new Date(wanted - offsetAt(timeZone, guess));
}

// Reading an Events Calendar entry

// What the Studio sent for one Events Calendar entry, made safe to use, or
// null when the event cannot be shown: switched off, no title, or no real start date.
// Anything else that is wrong is dropped quietly, so one slip does not hide
// the event: an end date before the start becomes the start, a time that is
// not HH:MM means no time (an all-day event), and an end time with no start
// time, or before the start time on the same day, is ignored.
export function tidyExtraEvent(raw) {
  if (!isRecord(raw) || raw.show === false) return null;

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (title === '' || !isDay(raw.startDate)) return null;

  const startDate = raw.startDate;
  const endDate = isDay(raw.endDate) && raw.endDate >= startDate ? raw.endDate : startDate;
  const startTime = isTime(raw.startTime) ? raw.startTime : '';

  let endTime = startTime !== '' && isTime(raw.endTime) ? raw.endTime : '';
  if (endTime !== '' && endDate === startDate && endTime < startTime) endTime = '';

  return {
    title: title,
    startDate: startDate,
    endDate: endDate,
    startTime: startTime,
    endTime: endTime,
    location: typeof raw.location === 'string' ? raw.location.trim() : '',
  };
}

// An Events Calendar entry as the same kind of event the calendar reader
// makes. With no start time it is all-day. A timed event with no end time ends
// when it starts, like a BAND event with no end, unless it runs over several
// days: then it lasts to the end of its last day.
function eventFrom(extra, timeZone) {
  const allDay = extra.startTime === '';
  let start;
  let end;

  if (allDay) {
    start = localMidnight(extra.startDate);
    end = localMidnight(addDays(extra.endDate, 1));
  } else {
    start = instantIn(timeZone, extra.startDate, extra.startTime);
    if (extra.endTime) end = instantIn(timeZone, extra.endDate, extra.endTime);
    else if (extra.endDate > extra.startDate) end = instantIn(timeZone, addDays(extra.endDate, 1), '00:00');
    else end = start;
  }

  return {
    title: extra.title,
    start: start,
    end: end,
    allDay: allDay,
    location: extra.location,
    uid: 'extra:' + extra.startDate + ':' + extra.title,
    calendar: extraCalendarName,
    calendarId: extraCalendarId,
    firstDay: extra.startDate,
    lastDay: extra.endDate,
  };
}

// Every showing Events Calendar entry in the list, as events. timeZone is a
// name such as America/New_York. The list may be missing, and an event that
// cannot be used is left out.
export function extraEventsToEvents(list, timeZone) {
  const zone = isTimeZone(timeZone) ? timeZone : defaultThemeSettings.timeZone;

  return (Array.isArray(list) ? list : [])
    .map(tidyExtraEvent)
    .filter(extra => extra !== null)
    .map(extra => eventFrom(extra, zone));
}

// Calendar filters

// 0 for Sunday to 6 for Saturday, for a day like 2027-04-02
function weekdayNumber(day) {
  return weekdayNames.indexOf(weekdayOf(day));
}

// A rule matches when every condition it has matches. A rule with no condition
// matches nothing, so a slip in the Studio cannot hide every event.
function ruleMatches(rule, event) {
  const words = rule.words || [];
  const days = rule.days || [];
  if (words.length === 0 && days.length === 0 && !rule.calendar && !rule.fromDate && !rule.toDate) return false;

  const title = String(event.title || '').toLowerCase();
  if (words.length > 0 && !words.some(word => title.includes(String(word).toLowerCase()))) return false;
  if (days.length > 0 && !days.includes(weekdayNumber(event.firstDay))) return false;
  if (rule.calendar && rule.calendar !== event.calendarId) return false;
  if (rule.fromDate && event.firstDay < rule.fromDate) return false;
  if (rule.toDate && event.firstDay > rule.toDate) return false;
  return true;
}

// The Hide rule that takes a BAND event off the screen, or null when the event
// shows. rules is content.calendarFilters, as sanity.js cleans it, and a rule
// that is off or past its Hide after time does nothing. A Hide rule only works
// when no Always show rule matches the event as well. The day of an event is its
// first day, in the Theme time zone for a timed event, so a long event is judged
// by the day it starts. timeZone is only needed for an event with no firstDay,
// and now is the moment to judge the Hide after time by.
export function hidingRule(event, rules, timeZone, now) {
  const dated = daysOf(event || {}, timeZone);
  if (dated === null || !Array.isArray(rules)) return null;

  const matching = visibleItems(rules.filter(isRecord), now).filter(rule => ruleMatches(rule, dated));
  if (matching.some(rule => rule.action === 'show')) return null;
  return matching.find(rule => rule.action === 'hide') || null;
}

// Merging

// A BAND event with the dates it covers added. The last moment of the event is
// one millisecond before it ends, so an event that ends at midnight does not
// count as being on the day after.
function withDays(event, timeZone) {
  const start = asDate(event.start);
  const end = event.end ? asDate(event.end) : start;
  const last = end > start ? new Date(end.getTime() - 1) : start;

  return Object.assign({}, event, {
    firstDay: event.allDay ? localDay(start) : dateIn(timeZone, start),
    lastDay: event.allDay ? localDay(last) : dateIn(timeZone, last),
  });
}

// One title inside the other, whatever the capitals. An empty title matches nothing.
function titlesMatch(first, second) {
  const a = String(first || '').trim().toLowerCase();
  const b = String(second || '').trim().toLowerCase();
  return a !== '' && b !== '' && (a.includes(b) || b.includes(a));
}

// The same event twice: the dates overlap (for events of one day that is the
// same date) and one title contains the other
function isSameEvent(first, second) {
  const overlap = first.firstDay <= second.lastDay && second.firstDay <= first.lastDay;
  return overlap && titlesMatch(first.title, second.title);
}

function byStart(first, second) {
  return first.start - second.start || first.end - second.end || String(first.title).localeCompare(String(second.title));
}

// The events of both kinds, as one list sorted by start.
//   bandEvents   what core/calendar.js read, a list of events
//   extraList    content.extraEvents, the Events Calendar entries from the Studio
//   timeZone     content.theme.timeZone
//   now          the moment to judge by, for the tests
//   filterList   content.calendarFilters, the rules from the Studio
// An event is dropped once the day it ends on (the day it starts on, if it has
// no end) is before today in that time zone. An Events Calendar entry that is
// also on BAND is dropped and the BAND one stays, unless a filter has hidden the
// BAND one. A BAND event that a filter hides is left out. The filters never
// touch an Events Calendar entry. An event with no usable start is left out.
// The lists passed in are not changed.
export function mergeEvents(bandEvents, extraList, timeZone, now, filterList) {
  const zone = isTimeZone(timeZone) ? timeZone : defaultThemeSettings.timeZone;
  const moment = now || new Date();
  const today = dateIn(zone, moment);

  const band = (Array.isArray(bandEvents) ? bandEvents : [])
    .filter(event => isRecord(event) && !isNaN(asDate(event.start)))
    .map(event => withDays(event, zone))
    .filter(event => hidingRule(event, filterList, zone, moment) === null);
  const extra = extraEventsToEvents(extraList, zone)
    .filter(event => !band.some(other => isSameEvent(other, event)));

  return band
    .concat(extra)
    .filter(event => event.lastDay >= today)
    .sort(byStart);
}

// Showing an event

// Apr 2, for the day 2027-04-02
function monthDayLabel(day) {
  const parts = dayParts(day);
  return monthNames[parts.month - 1] + ' ' + parts.day;
}

// Apr 2 for one day, Apr 2-4 for several days in one month, and
// Mar 30-Apr 1 when the months differ (Dec 30-Jan 2 when the year changes too).
// first and last are days like 2027-04-02.
export function rangeLabel(first, last) {
  const from = dayParts(first);
  const to = dayParts(last);
  const start = monthDayLabel(first);
  if (last <= first) return start;

  if (from.year === to.year && from.month === to.month) return start + '-' + to.day;
  return start + '-' + monthNames[to.month - 1] + ' ' + to.day;
}

// FRI for the day 2027-04-02. It is worked out from the date alone, in UTC, so
// the time zone of the computer cannot move it to the day before or after.
function weekdayOf(day) {
  const parts = dayParts(day);
  return weekdayNames[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
}

// The first and last day of an event, or null when it has none that can be
// read. An event from mergeEvents() has them already. One that did not go
// through it (shell.js shows the BAND events as they are when merging fails)
// gets them worked out here, in the same time zone.
function daysOf(event, timeZone) {
  if (isDay(event.firstDay) && isDay(event.lastDay)) return event;
  if (!event.start || isNaN(asDate(event.start))) return null;

  const zone = isTimeZone(timeZone) ? timeZone : defaultThemeSettings.timeZone;
  return withDays(event, zone);
}

// The date of an event as the screen writes it, in capitals. timeZone is
// content.theme.timeZone, and is only needed for an event with no firstDay.
//   weekday   FRI, the first day
//   monthDay  APR 2, the first day
//   range     APR 2-4 or MAR 30-APR 1, and empty for an event of one day
//   text      the whole date on one line: FRI APR 2 for one day, otherwise the
//             range. This is what the Next event tile shows.
// All four are empty when the event has no date that can be read.
export function eventDate(event, timeZone) {
  const days = daysOf(event || {}, timeZone);
  if (days === null) return { weekday: '', monthDay: '', range: '', text: '' };

  const weekday = weekdayOf(days.firstDay);
  const monthDay = monthDayLabel(days.firstDay).toUpperCase();
  const range = days.lastDay > days.firstDay ? rangeLabel(days.firstDay, days.lastDay).toUpperCase() : '';

  return { weekday: weekday, monthDay: monthDay, range: range, text: range || weekday + ' ' + monthDay };
}

// 6:30 PM, or nothing for an all-day event, which shows its date only
export function timeText(event) {
  return event.allDay ? '' : formatTimeOfDay(asDate(event.start));
}
