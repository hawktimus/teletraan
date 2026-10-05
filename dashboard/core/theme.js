// Which theme and which holiday overlay the screen should show right now.
// Everything here is plain functions with no page in sight, so the tests in
// tools/test-themes.mjs can run them. core/theme-apply.js puts the answer on
// the page.
//
// The Theme document in the Studio holds four things (defaultThemeSettings in
// config.js has the starting values). resolveTheme() reads them in this order:
//
//   1. Use now. A theme and an overlay to show at once. Each can be left
//      empty to follow the rules instead, and the overlay can be 'none'. It
//      stops when its Until time passes.
//   2. The schedule. The first rule of each kind that covers today. Themes
//      and overlays are picked on their own, so a theme rule and an overlay
//      rule can both apply.
//   3. The default theme, and no overlay.

import { defaultThemeSettings } from '../config.js';
import { themes } from '../themes/registry.js';
import { overlays } from '../themes/overlays/registry.js';

const kinds = ['theme', 'overlay'];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function idsOf(list) {
  return list.map(item => item.id);
}

export function isKnownTheme(id) {
  return idsOf(themes).indexOf(id) !== -1;
}

export function isKnownOverlay(id) {
  return idsOf(overlays).indexOf(id) !== -1;
}

// Dates and time zones

// The date today in a time zone, written 2026-12-31. en-CA is used because
// it puts the year, month and day in the order we want. The parts are read by
// name, never by position, and never in the browser's own time zone.
export function dateIn(timeZone, now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = type => parts.filter(part => part.type === type)[0].value;
  return get('year') + '-' + get('month') + '-' + get('day');
}

// True when Intl knows the name, for example America/New_York
export function isTimeZone(name) {
  if (typeof name !== 'string' || name === '') return false;

  try {
    dateIn(name, new Date(0));
    return true;
  } catch (error) {
    return false;
  }
}

const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // February has room for the 29th

function isRealMonthAndDay(month, day) {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

// Reads 2026-12-20 or 12-20. Gives back { year: '2026' or '', monthDay: '12-20' },
// or null when the text is neither, or names a day that does not exist.
function readDate(text) {
  const match = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(typeof text === 'string' ? text.trim() : '');
  if (!match) return null;

  const year = match[1] || '';
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealMonthAndDay(month, day)) return null;
  if (year && month === 2 && day === 29 && !isLeapYear(Number(year))) return null;

  return { year: year, monthDay: match[2] + '-' + match[3] };
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Cleaning what the Studio sent

function tidyUseNow(raw) {
  const source = isRecord(raw) ? raw : {};
  const untilTime = typeof source.until === 'string' ? new Date(source.until).getTime() : NaN;

  return {
    theme: isKnownTheme(source.theme) ? source.theme : '',
    overlay: isKnownOverlay(source.overlay) || source.overlay === 'none' ? source.overlay : '',
    until: isNaN(untilTime) ? '' : source.until,
  };
}

// A rule that cannot be used is left out, so one slip in a rule never stops
// the ones after it. A rule with only a month and a day has no year to run
// out, so it repeats every year whatever its switch says.
function tidyRule(raw) {
  if (!isRecord(raw) || kinds.indexOf(raw.kind) === -1) return null;

  const id = raw[raw.kind];
  const known = raw.kind === 'theme' ? isKnownTheme(id) : isKnownOverlay(id);
  const start = readDate(raw.startDate);
  const end = readDate(raw.endDate);
  if (!known || !start || !end) return null;

  const rule = {
    name: typeof raw.name === 'string' ? raw.name : '',
    kind: raw.kind,
    startDate: raw.startDate.trim(),
    endDate: raw.endDate.trim(),
    repeatsEveryYear: raw.repeatsEveryYear === true || !start.year || !end.year,
  };
  rule[raw.kind] = id;
  return rule;
}

// Takes whatever the Theme document holds, or nothing, and gives back all
// four settings with a value the screen can use. Anything missing or
// unusable is the default, so the screen never has to check.
export function tidyTheme(raw) {
  const source = isRecord(raw) ? raw : {};
  const defaults = defaultThemeSettings;

  return {
    defaultTheme: isKnownTheme(source.defaultTheme) ? source.defaultTheme : defaults.defaultTheme,
    useNow: tidyUseNow(source.useNow),
    schedule: (Array.isArray(source.schedule) ? source.schedule : []).map(tidyRule).filter(rule => rule !== null),
    timeZone: isTimeZone(source.timeZone) ? source.timeZone : defaults.timeZone,
  };
}

// The rules

// today is a date like 2026-12-31 in the schedule's time zone. A rule
// covers its start day and its end day. A rule that repeats every year looks
// only at the month and the day, and when its start comes after its end
// (12-20 to 01-05) it runs over New Year. A rule that does not repeat looks
// at the whole date, and one that ends before it starts never applies.
export function ruleCovers(rule, today) {
  const start = readDate(rule.startDate);
  const end = readDate(rule.endDate);
  if (!start || !end) return false;

  const repeats = rule.repeatsEveryYear === true || !start.year || !end.year;
  if (!repeats) return start.year + '-' + start.monthDay <= today && today <= end.year + '-' + end.monthDay;

  const monthDay = today.slice(5);
  if (start.monthDay <= end.monthDay) return start.monthDay <= monthDay && monthDay <= end.monthDay;
  return monthDay >= start.monthDay || monthDay <= end.monthDay;
}

function firstRuleFor(schedule, kind, today) {
  const rule = schedule.filter(item => item.kind === kind && ruleCovers(item, today))[0];
  return rule ? rule[kind] : '';
}

// Use now counts only until its Until time. With no Until it stays until it is changed.
function activeUseNow(useNow, now) {
  const stillOn = useNow.until === '' || new Date(useNow.until).getTime() > now.getTime();
  return stillOn ? useNow : { theme: '', overlay: '', until: '' };
}

// The theme and overlay to show at this moment: { theme: 'hawktimus', overlay: '' }.
// settings is the Theme document, or content.theme. An empty overlay means none.
export function resolveTheme(settings, now) {
  const theme = tidyTheme(settings);
  const moment = now || new Date();
  const today = dateIn(theme.timeZone, moment);
  const useNow = activeUseNow(theme.useNow, moment);

  let overlay = useNow.overlay || firstRuleFor(theme.schedule, 'overlay', today);
  if (overlay === 'none') overlay = '';

  return {
    theme: useNow.theme || firstRuleFor(theme.schedule, 'theme', today) || theme.defaultTheme,
    overlay: overlay,
  };
}
