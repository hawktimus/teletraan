// Turning dates into the text shown on the screen, and reading dates that
// editors typed.

const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function pad(number) {
  return String(number).padStart(2, '0');
}

// 3:07 PM comes back as { time: '3:07', suffix: 'PM' }
export function formatClock(date) {
  let hours = date.getHours() % 12;
  if (hours === 0) hours = 12;

  return {
    time: hours + ':' + pad(date.getMinutes()),
    suffix: date.getHours() < 12 ? 'AM' : 'PM',
  };
}

// 3:07 PM as one piece of text
export function formatTimeOfDay(date) {
  const clock = formatClock(date);
  return clock.time + ' ' + clock.suffix;
}

// FRI OCT 2
export function formatDate(date) {
  return dayNames[date.getDay()] + ' ' + monthNames[date.getMonth()] + ' ' + date.getDate();
}

// JAN 9 2027
export function formatLongDate(date) {
  return monthNames[date.getMonth()] + ' ' + date.getDate() + ' ' + date.getFullYear();
}

export function dayName(date) {
  return dayNames[date.getDay()];
}

export function monthName(date) {
  return monthNames[date.getMonth()];
}

// Reads a date and time that an editor typed, and returns a Date, or null
// when it makes no sense. Write 2027-01-09T12:00 and it means that time on
// the Mini's own clock. A date with no time means the start of that day.
// Text that already carries a time zone (ending in Z, or +01:00) is taken
// as it is.
export function parseLocalDateTime(text) {
  if (!text) return null;

  const value = String(text).trim();
  if (/(Z|[+-]\d\d:?\d\d)$/.test(value) && value.length > 10) {
    const exact = new Date(value);
    return isNaN(exact) ? null : exact;
  }

  const parts = value.match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/);
  if (!parts) return null;

  // new Date(year, month, ...) counts months from 0, so January is 0
  const date = new Date(
    Number(parts[1]),
    Number(parts[2]) - 1,
    Number(parts[3]),
    Number(parts[4] || 0),
    Number(parts[5] || 0)
  );
  return isNaN(date) ? null : date;
}

// Dates arrive as Date objects from the calendar and as text from the
// editors' content. This turns either into a Date.
export function asDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function sameDay(first, second) {
  return startOfDay(first).getTime() === startOfDay(second).getTime();
}

// Whole calendar days from one date to another. Rounded, because a day
// that has a clock change in it is 23 or 25 hours long.
export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
}

// How long until the target, split into days, hours, minutes and seconds.
// Once the target has passed everything is zero. Subtracting two Dates
// gives milliseconds.
export function timeLeft(target, now) {
  let total = Math.floor((target - now) / 1000);
  if (total < 0) total = 0;

  return {
    total: total,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
