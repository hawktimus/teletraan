// Turns the .ics files the Mini downloads into upcoming events. Nobody needs to
// edit this file to add or change events: that is done in BAND.

import { asDate } from './time.js';

const dayMs = 86400000;
const defaultDaysAhead = 60;

// Limits that stop a strange rule from looping for ever
const maxPeriods = 20000;
const maxOccurrences = 5000;

// Reading a file bigger than this would freeze the screen for seconds. A real
// team calendar is a few hundred kilobytes at most.
const maxFileCharacters = 2000000;

const weekdayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const supportedFrequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const knownRuleParts = ['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'WKST'];

// A line that starts with a space or a tab carries on from the line before it
function unfold(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
}

// NAME;PARAM=value:the value  becomes  { name, params, value }.
// Colons and semicolons inside double quotes belong to the parameter.
function readLine(line) {
  const parts = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') quoted = !quoted;

    if (!quoted && (character === ';' || character === ':')) {
      parts.push(current);
      current = '';
      if (character === ':') return lineFrom(parts, line.slice(index + 1));
    } else {
      current += character;
    }
  }
  return null;
}

function lineFrom(parts, value) {
  const params = {};
  parts.slice(1).forEach(part => {
    const equals = part.indexOf('=');
    if (equals < 1) return;

    const name = part.slice(0, equals).trim().toUpperCase();
    params[name] = part.slice(equals + 1).replace(/"/g, '').trim();
  });
  return { name: parts[0].trim().toUpperCase(), params: params, value: value };
}

// Calendar text writes a newline as \n and puts a backslash before , ; and \
function unescapeText(text) {
  return text.replace(/\\([nN,;\\])/g, (match, character) => {
    return character.toLowerCase() === 'n' ? '\n' : character;
  });
}

// 20270112T180000Z, 20270112T180000 and 20270112 become the parts of that
// date and time, plus the zone the calendar wrote it in. A time with no zone
// (zone is null) is on the Mini's own clock.
function readStamp(value, zone) {
  const cleaned = String(value).trim().replace(/[-:]/g, '');
  const match = cleaned.match(/^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?(?:\.\d+)?)?(Z)?$/i);
  if (!match) return null;

  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(part => Number(part || 0));
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 60) return null;

  return {
    year: year,
    month: month,
    day: day,
    hour: hour,
    minute: minute,
    second: second,
    zone: match[7] ? 'UTC' : zone || null,
    dateOnly: match[4] === undefined,
  };
}

// PT1H30M, P1D, P1DT2H and P1W become milliseconds. Anything else is null.
function readDuration(value) {
  const pattern = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i;
  const match = String(value).trim().match(pattern);
  if (!match) return null;

  const [weeks, days, hours, minutes, seconds] = match.slice(2).map(part => Number(part || 0));
  const total = ((((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return match[1] === '-' ? -total : total;
}

// A list of whole numbers such as 1,15,-1. Returns null when one of them is
// outside the allowed range, and an empty list when there is no text.
function readNumbers(text, low, high) {
  if (!text) return [];

  const numbers = text.split(',').map(Number);
  const allowed = numbers.every(number => {
    return Number.isInteger(number) && number !== 0 && number >= low && number <= high;
  });
  return allowed ? numbers : null;
}

// MO, TU,WE or 2TU,-1FR. The number in front picks which one in the month.
function readWeekdays(text) {
  if (!text) return [];

  const matches = text.split(',').map(token => token.trim().match(/^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/));
  if (matches.some(match => !match)) return null;
  return matches.map(match => ({ ordinal: Number(match[1] || 0), weekday: weekdayCodes.indexOf(match[2]) }));
}

// Turns FREQ=WEEKLY;BYDAY=MO,WE into an object. A rule this file does not
// understand comes back as null, and the event is then shown once.
function readRule(value) {
  const parts = {};
  String(value).split(';').forEach(piece => {
    const equals = piece.indexOf('=');
    if (equals < 1) return;

    const name = piece.slice(0, equals).trim().toUpperCase();
    parts[name] = piece.slice(equals + 1).trim().toUpperCase();
  });

  const rule = {
    freq: parts.FREQ,
    interval: Number(parts.INTERVAL || 1),
    count: Number(parts.COUNT || 0),
    until: parts.UNTIL ? readStamp(parts.UNTIL, null) : null,
    byDay: readWeekdays(parts.BYDAY),
    byMonthDay: readNumbers(parts.BYMONTHDAY, -31, 31),
    byMonth: readNumbers(parts.BYMONTH, 1, 12),
    weekStart: weekdayCodes.includes(parts.WKST) ? weekdayCodes.indexOf(parts.WKST) : 1,
  };
  return isUnderstood(rule, parts) ? rule : null;
}

function isUnderstood(rule, parts) {
  const onlyKnownParts = Object.keys(parts).every(key => knownRuleParts.includes(key));
  const untilReadable = !parts.UNTIL || rule.until !== null;
  const listsReadable = rule.byDay !== null && rule.byMonthDay !== null && rule.byMonth !== null;

  return supportedFrequencies.includes(rule.freq)
    && onlyKnownParts
    && untilReadable
    && listsReadable
    && Number.isInteger(rule.interval) && rule.interval >= 1
    && Number.isInteger(rule.count) && rule.count >= 0;
}

// What a rule leaves out is taken from the event's start: a weekly event
// repeats on the weekday it starts on, a monthly one on the same date.
function withStartDefaults(rule, start) {
  const filled = Object.assign({}, rule);
  if (rule.byDay.length || rule.byMonthDay.length) return filled;

  if (rule.freq === 'WEEKLY') filled.byDay = [{ ordinal: 0, weekday: weekdayOf(dayOfStamp(start)) }];
  if (rule.freq === 'MONTHLY') filled.byMonthDay = [start.day];
  if (rule.freq === 'YEARLY') {
    filled.byMonthDay = [start.day];
    if (!rule.byMonth.length) filled.byMonth = [start.month];
  }
  return filled;
}

function newEvent() {
  return {
    uid: '',
    title: '',
    location: '',
    start: null,
    end: null,
    duration: null,
    rule: null,
    exdates: [],
    recurrenceId: null,
    cancelled: false,
  };
}

// Anything that is not listed here is ignored
function addProperty(event, line) {
  const zone = line.params.TZID;

  switch (line.name) {
    case 'UID':
      event.uid = line.value.trim();
      break;
    case 'SUMMARY':
      event.title = unescapeText(line.value).trim();
      break;
    case 'LOCATION':
      event.location = unescapeText(line.value).trim();
      break;
    case 'STATUS':
      event.cancelled = line.value.trim().toUpperCase() === 'CANCELLED';
      break;
    case 'DTSTART':
      event.start = readStamp(line.value, zone);
      break;
    case 'DTEND':
      event.end = readStamp(line.value, zone);
      break;
    case 'DURATION':
      event.duration = readDuration(line.value);
      break;
    case 'RRULE':
      event.rule = readRule(line.value);
      break;
    case 'EXDATE':
      line.value.split(',').forEach(part => {
        const stamp = readStamp(part, zone);
        if (stamp) event.exdates.push(stamp);
      });
      break;
    case 'RECURRENCE-ID':
      event.recurrenceId = readStamp(line.value, zone);
      break;
  }
}

function finishEvent(event) {
  event.allDay = event.start.dateOnly;
  if (event.recurrenceId) event.rule = null; // a changed occurrence is a single event
  if (event.rule) event.rule = withStartDefaults(event.rule, event.start);
  return event;
}

// A cancelled event is left out. A cancelled change to one occurrence of a
// repeating event takes that occurrence out of the series instead.
function applyCancellations(events) {
  events.filter(event => event.cancelled && event.recurrenceId).forEach(cancelled => {
    events
      .filter(event => cancelled.uid && event.uid === cancelled.uid && !event.recurrenceId)
      .forEach(series => series.exdates.push(cancelled.recurrenceId));
  });
  return events.filter(event => !event.cancelled);
}

// Reads the text of an .ics file and returns its events, as they are written
// in the file (a repeating event is still one entry here). Never throws.
export function parseIcs(text) {
  const events = [];
  let event = null;
  let nested = 0; // how many blocks inside the event, such as an alarm, are open

  function save() {
    if (event && event.start) events.push(finishEvent(event));
    event = null;
  }

  unfold(text).forEach(rawLine => {
    const line = readLine(rawLine);
    if (!line) return;

    if (line.name === 'BEGIN' && line.value.trim().toUpperCase() === 'VEVENT') {
      save(); // an event whose END line is missing
      event = newEvent();
      nested = 0;
    } else if (!event) {
      return;
    } else if (line.name === 'BEGIN') {
      nested++;
    } else if (line.name === 'END' && nested > 0) {
      nested--;
    } else if (line.name === 'END') {
      save();
    } else if (nested === 0) {
      addProperty(event, line);
    }
  });
  save();

  return applyCancellations(events);
}

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

// Calendar sums use day numbers, the days counted from 1 January 1970. Whole
// days have no clock changes in them, unlike hours.
function dayNumber(year, month, day) {
  return Math.floor(Date.UTC(year, month - 1, day) / dayMs);
}

function dayOfStamp(stamp) {
  return dayNumber(stamp.year, stamp.month, stamp.day);
}

function partsOfDay(day) {
  const date = new Date(day * dayMs);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

// 0 is Sunday. 1 January 1970 was a Thursday.
function weekdayOf(day) {
  return (((day + 4) % 7) + 7) % 7;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
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
