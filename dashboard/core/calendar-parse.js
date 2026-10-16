// Reading an iCal file into events (part of calendar.js).

export const dayMs = 86400000;
export const defaultDaysAhead = 60;

// Limits that stop a strange rule from looping for ever
export const maxPeriods = 20000;
export const maxOccurrences = 5000;

// Reading a file bigger than this would freeze the screen for seconds. A real
// team calendar is a few hundred kilobytes at most.
export const maxFileCharacters = 2000000;

// Calendar sums use day numbers, the days counted from 1 January 1970. Whole
// days have no clock changes in them, unlike hours.
export function dayNumber(year, month, day) {
  return Math.floor(Date.UTC(year, month - 1, day) / dayMs);
}

export function dayOfStamp(stamp) {
  return dayNumber(stamp.year, stamp.month, stamp.day);
}

export function partsOfDay(day) {
  const date = new Date(day * dayMs);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

// 0 is Sunday. 1 January 1970 was a Thursday.
export function weekdayOf(day) {
  return (((day + 4) % 7) + 7) % 7;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

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
// (zone is null) is on the Teletraan computer's own clock.
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
