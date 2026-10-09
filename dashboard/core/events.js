// The list of events the screen shows. They come from the BAND calendars
// (core/calendar.js). shell.js calls mergeEvents() each time the calendars or the
// content change, and once a minute so an event that has finished disappears. The
// Events panel and the Next event tile show the list it returns. The Calendar
// filters from the Studio take events out of it, after the repeating events are
// expanded. The Events Calendar entries in the Studio are not read.
//
// Every event has the shape core/calendar.js makes, with Date objects:
//   { title, start, end, allDay, location, uid, calendar, calendarId }
// An event that comes out of mergeEvents() also has firstDay and lastDay, the
// dates it covers written like 2027-04-02. An all-day event ends at the
// midnight after its last day.
//
// Dates are read in the Time zone on the Look page, so "today" is the same
// day for the editors and for the screen. eventDate() at the bottom writes the
// date of an event for the screen, and every panel that shows one uses it, so
// they all agree. Plain functions only, so tools/test-content.mjs can run them.

import { defaultThemeSettings } from '../config.js';
import { visibleItems } from './content.js';
import { dateIn, isTimeZone } from './theme.js';
import { asDate, formatTimeOfDay, pad } from './time.js';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Dates written like 2027-04-02

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

function localDay(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
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
// first day, in the Look time zone for a timed event, so a long event is judged
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

function byStart(first, second) {
  return first.start - second.start || first.end - second.end || String(first.title).localeCompare(String(second.title));
}

// The events as one list sorted by start.
//   bandEvents   what core/calendar.js read, a list of events
//   timeZone     content.theme.timeZone
//   now          the moment to judge by, for the tests
//   filterList   content.calendarFilters, the rules from the Studio
// An event is dropped once the day it ends on (the day it starts on, if it has
// no end) is before today in that time zone. An event that a filter hides is
// left out. An event with no usable start is left out.
// The list passed in is not changed.
export function mergeEvents(bandEvents, timeZone, now, filterList) {
  const zone = isTimeZone(timeZone) ? timeZone : defaultThemeSettings.timeZone;
  const moment = now || new Date();
  const today = dateIn(zone, moment);

  return (Array.isArray(bandEvents) ? bandEvents : [])
    .filter(event => isRecord(event) && !isNaN(asDate(event.start)))
    .map(event => withDays(event, zone))
    .filter(event => hidingRule(event, filterList, zone, moment) === null)
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
