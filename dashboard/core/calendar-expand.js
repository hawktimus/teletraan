// Time zones and repeating events: the days an event falls on (part of calendar.js).

import { asDate } from './time.js';
import { dayMs, dayNumber, dayOfStamp, daysInMonth, defaultDaysAhead, maxFileCharacters, maxOccurrences, maxPeriods, parseIcs, partsOfDay, weekdayOf } from './calendar-parse.js';

const formatters = new Map();

// null when Intl does not know the zone name
function formatterFor(zone) {
  if (!formatters.has(zone)) {
    try {
      formatters.set(zone, new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour12: false,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      }));
    } catch (error) {
      formatters.set(zone, null);
    }
  }
  return formatters.get(zone);
}

// How far ahead of UTC the zone's clock is at that moment, in milliseconds
function offsetAt(formatter, instant) {
  const parts = {};
  formatter.formatToParts(new Date(instant)).forEach(part => {
    parts[part.type] = Number(part.value);
  });

  // some browsers write midnight as hour 24
  const clock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return clock - Math.floor(instant / 1000) * 1000;
}

// The moment when a zone's clock shows the given time. The time is passed as
// if it were UTC. The offset is read a day either side because it can change
// in between. When the clocks go forward the skipped hour gives the later
// time, and when they go back the repeated hour gives the first one.
function zonedInstant(clock, formatter) {
  const before = offsetAt(formatter, clock - dayMs);
  const after = offsetAt(formatter, clock + dayMs);
  const early = clock - before;
  const late = clock - after;

  if (offsetAt(formatter, early) === before) return early;
  if (offsetAt(formatter, late) === after) return late;
  return early;
}

// The moment a date and time means. fallbackZone is used when the stamp has
// no zone of its own. A zone name Intl does not know is read as the Mini's
// own time zone.
function toDate(stamp, fallbackZone) {
  const zone = stamp.zone || fallbackZone || null;
  const parts = [stamp.year, stamp.month - 1, stamp.day, stamp.hour, stamp.minute, stamp.second];
  if (stamp.dateOnly || !zone) return new Date(...parts);

  const clock = Date.UTC(...parts);
  if (zone === 'UTC') return new Date(clock);

  const formatter = formatterFor(zone);
  return formatter ? new Date(zonedInstant(clock, formatter)) : new Date(...parts);
}

function listDays(first, length) {
  const days = [];
  for (let index = 0; index < length; index++) days.push(first + index);
  return days;
}

// The days of one period of the rule: a day, a week, a month or a year.
// Period 0 is the one the event starts in. Each step after it moves on by
// the rule's interval.
function periodDays(rule, start, index) {
  const step = index * rule.interval;
  const startDay = dayOfStamp(start);

  if (rule.freq === 'DAILY') return [startDay + step];

  if (rule.freq === 'WEEKLY') {
    const daysIntoWeek = (weekdayOf(startDay) - rule.weekStart + 7) % 7;
    return listDays(startDay - daysIntoWeek + step * 7, 7);
  }

  if (rule.freq === 'MONTHLY') {
    const months = start.year * 12 + start.month - 1 + step;
    const year = Math.floor(months / 12);
    const month = (months % 12) + 1;
    return listDays(dayNumber(year, month, 1), daysInMonth(year, month));
  }

  const year = start.year + step;
  return listDays(dayNumber(year, 1, 1), dayNumber(year + 1, 1, 1) - dayNumber(year, 1, 1));
}

// -1 is the last day of the month, -2 the one before it
function matchesMonthDay(list, date) {
  const length = daysInMonth(date.year, date.month);
  return list.includes(date.day) || list.includes(date.day - length - 1);
}

// MO is every Monday. 2TU is the second Tuesday of the month, and -1FR the
// last Friday. A yearly rule that names no month counts in the year instead.
function matchesWeekday(rule, entry, day, date) {
  if (weekdayOf(day) !== entry.weekday) return false;

  const countsOrdinals = rule.freq === 'MONTHLY' || rule.freq === 'YEARLY';
  if (!entry.ordinal || !countsOrdinals) return true;

  const inYear = rule.freq === 'YEARLY' && rule.byMonth.length === 0;
  const first = inYear ? dayNumber(date.year, 1, 1) : dayNumber(date.year, date.month, 1);
  const length = inYear ? dayNumber(date.year + 1, 1, 1) - first : daysInMonth(date.year, date.month);
  const fromStart = Math.ceil((day - first + 1) / 7);
  const fromEnd = Math.ceil((first + length - day) / 7);
  return entry.ordinal > 0 ? fromStart === entry.ordinal : fromEnd === -entry.ordinal;
}

function matchesRule(rule, day) {
  const date = partsOfDay(day);

  if (rule.byMonth.length && !rule.byMonth.includes(date.month)) return false;
  if (rule.byMonthDay.length && !matchesMonthDay(rule.byMonthDay, date)) return false;
  if (rule.byDay.length && !rule.byDay.some(entry => matchesWeekday(rule, entry, day, date))) return false;
  return true;
}

// The moment the event starts on the given day. The time of day stays the
// same on the clock, which is what keeps a 6:00 PM event at 6:00 PM when the
// clocks change.
function startOn(event, day) {
  return toDate(Object.assign({}, event.start, partsOfDay(day)));
}

// The length of the event: in whole days for an all-day event, otherwise in
// milliseconds. Never less than one day or less than nothing.
function lengthOf(event) {
  const { start, end, duration } = event;

  if (event.allDay) {
    const days = end ? dayOfStamp(end) - dayOfStamp(start) : Math.round((duration || 0) / dayMs);
    return Math.max(days, 1);
  }

  const milliseconds = end ? toDate(end, start.zone) - toDate(start) : duration || 0;
  return Math.max(milliseconds, 0);
}

// An all-day event ends on the morning after its last day
function endFor(event, day, start, length) {
  return event.allDay ? startOn(event, day + length) : new Date(start.getTime() + length);
}

function isAfterUntil(event, day) {
  const until = event.rule.until;
  if (!until) return false;
  if (until.dateOnly || event.allDay) return day > dayOfStamp(until);
  return startOn(event, day) > toDate(until, event.start.zone);
}

// The days the event happens on, from its own first day on. Days before
// firstDay are counted (COUNT=10 includes them) but not kept.
function occurrenceDays(event, firstDay, lastDay) {
  const rule = event.rule;
  const startDay = dayOfStamp(event.start);
  const days = [];
  let counted = 0;

  function take(day) {
    counted++;
    if (day >= firstDay) days.push(day);
  }

  // The first day counts even when the rule would not pick it
  take(startDay);
  if (!rule) return days;

  for (let index = 0; index < maxPeriods; index++) {
    const period = periodDays(rule, event.start, index);
    if (period[0] > lastDay) break;

    for (const day of period) {
      if (day <= startDay || !matchesRule(rule, day)) continue;

      const finished = day > lastDay
        || isAfterUntil(event, day)
        || (rule.count > 0 && counted >= rule.count)
        || days.length >= maxOccurrences;
      if (finished) return days;

      take(day);
    }
  }
  return days;
}

// A date in EXDATE or RECURRENCE-ID names an occurrence. A date without a
// time names every occurrence on that day.
function isExcluded(event, day, start, excluded) {
  return excluded.some(stamp => {
    if (stamp.dateOnly) return dayOfStamp(stamp) === day;
    return toDate(stamp, event.start.zone).getTime() === start.getTime();
  });
}

function overlaps(start, end, from, to) {
  return start < to && (end > from || start >= from);
}

function occurrencesBetween(event, from, to, excluded) {
  const length = lengthOf(event);
  const spanDays = event.allDay ? length : Math.ceil(length / dayMs);

  // A day more on each side, so a time zone can never push one out of the list
  const firstDay = Math.floor(from.getTime() / dayMs) - spanDays - 1;
  const lastDay = Math.floor(to.getTime() / dayMs) + 1;
  const found = [];

  occurrenceDays(event, firstDay, lastDay).forEach(day => {
    const start = startOn(event, day);
    const end = endFor(event, day, start, length);
    if (!overlaps(start, end, from, to) || isExcluded(event, day, start, excluded)) return;

    found.push({
      title: event.title,
      start: start,
      end: end,
      allDay: event.allDay,
      location: event.location,
      uid: event.uid,
    });
  });
  return found;
}

// For each UID, the occurrences that other entries change or move. Built once,
// so a big calendar is not searched again for every event.
function replacedOccurrences(events) {
  const replaced = new Map();
  events.forEach(event => {
    if (!event.uid || !event.recurrenceId) return;

    const list = replaced.get(event.uid) || [];
    list.push(event.recurrenceId);
    replaced.set(event.uid, list);
  });
  return replaced;
}

// The occurrences taken out of a repeating event: the EXDATE ones, and the
// ones that another entry with the same UID changes or moves.
function excludedFor(event, replaced) {
  if (event.recurrenceId) return [];
  return event.exdates.concat(replaced.get(event.uid) || []);
}

function byStart(first, second) {
  return first.start - second.start || first.end - second.end || first.title.localeCompare(second.title);
}

// Takes what parseIcs returned and returns every occurrence that overlaps the
// range, as { title, start, end, allDay, location, uid } with Date objects,
// sorted by start. An all-day event ends at the midnight after its last day.
export function expandEvents(parsed, rangeStart, rangeEnd) {
  const from = asDate(rangeStart);
  const to = asDate(rangeEnd);
  if (isNaN(from) || isNaN(to) || !Array.isArray(parsed)) return [];

  const events = parsed.filter(event => event && event.start);
  const replaced = replacedOccurrences(events);
  const found = [];
  events.forEach(event => {
    occurrencesBetween(event, from, to, excludedFor(event, replaced)).forEach(occurrence => found.push(occurrence));
  });
  return found.sort(byStart);
}

async function readCalendar(folder, calendar, from, to) {
  try {
    const response = await fetch(folder + calendar.id + '.ics', { cache: 'no-store' });
    if (!response.ok) throw new Error('status ' + response.status);

    const text = await response.text();
    if (text.length > maxFileCharacters) throw new Error('the file is too big');

    // A page that is not a calendar, or an empty file, means the download went wrong
    if (!/BEGIN:V(CALENDAR|EVENT)/i.test(text)) throw new Error('not a calendar file');

    const name = String(calendar.name || '');
    const events = expandEvents(parseIcs(text), from, to);
    events.forEach(event => {
      event.calendar = name;
      event.calendarId = calendar.id;
    });
    return { id: calendar.id, events: events };
  } catch (error) {
    console.warn('Could not read calendar "' + calendar.id + '"', error);
    return { id: calendar.id, events: null };
  }
}

// Reads every calendar that is not switched off and returns
// { events, failed }: the upcoming events of all of them together, sorted by
// start, and the ids of the calendars that could not be read. One bad
// calendar never stops the others. Events that have ended are left out.
export async function loadEvents(options = {}) {
  const { folder = '', calendars, daysAhead = defaultDaysAhead } = options;
  const current = asDate(options.now || new Date());

  // Starting a day back means an event that is on right now is still found
  const from = new Date(current.getTime() - dayMs);
  const to = new Date(current.getTime() + daysAhead * dayMs);

  const wanted = (calendars || []).filter(calendar => calendar && calendar.id && calendar.show !== false);
  const results = await Promise.all(wanted.map(calendar => {
    return readCalendar(folder, calendar, from, to);
  }));

  const events = [].concat(...results.map(result => result.events || []))
    .filter(event => event.end > current || event.start >= current)
    .sort(byStart);
  const failed = results.filter(result => result.events === null).map(result => result.id);
  return { events: events, failed: failed };
}
