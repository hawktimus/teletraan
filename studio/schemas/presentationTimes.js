// Dates and times in the lists of Studio, written the way the screen says them.
// A list cannot ask Sanity for the Look page's time zone, so it uses the zone
// the Look page starts with (theme.js and defaultThemeSettings in
// dashboard/config.js).

export const fallbackTimeZone = 'America/New_York';

// The date a moment falls on in a time zone, written 2026-12-31. The name of a
// time zone Intl does not know throws an error.
export function dayIn(isoText, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoText));
}

// True when Intl knows the name, for example America/New_York
export function isTimeZone(name) {
  if (typeof name !== 'string' || name === '') return false;

  try {
    dayIn('2000-01-01T00:00:00Z', name);
    return true;
  } catch (error) {
    return false;
  }
}

// A moment as the clock in a time zone shows it: { weekday: 'Thu', date: 'Oct 8', time: '2:45 PM' }.
// Nothing for text that is not a time. The hour is turned to 12 hour time by
// hand because Intl puts a thin space before AM and PM.
export function clockIn(isoText, timeZone) {
  const moment = new Date(isoText);
  if (typeof isoText !== 'string' || isNaN(moment)) return null;

  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(moment).forEach(part => {
    parts[part.type] = part.value;
  });

  const hour = Number(parts.hour);
  return {
    weekday: parts.weekday,
    date: parts.month + ' ' + parts.day,
    time: (hour % 12 || 12) + ':' + parts.minute + ' ' + (hour < 12 ? 'AM' : 'PM'),
  };
}

// A date with no time, written 2026-10-08, as the screen says it: 'Thu Oct 8'.
// Nothing for text that is not a date. It is read as noon in UTC, so the day stays the one typed.
export function dayWords(dateText) {
  if (typeof dateText !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return '';

  const clock = clockIn(dateText + 'T12:00:00Z', 'UTC');
  return clock ? clock.weekday + ' ' + clock.date : '';
}
