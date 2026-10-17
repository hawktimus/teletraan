// The rules the Hide buttons of the Calendars page make and read, and the words around them.
// Plain functions only: the ones that write take the Studio's client as an argument, so node can
// test them with a fake one. calendars-view-parts.js exports everything here again.

import { isRecord, sentence } from './plain-values.js';

// Words the Hide buttons show when they cannot make a rule
export const noDayLine = 'This list has no day for the event yet, so only Hide all like this works. The Teletraan computer adds the day on its next run.';
export const longCodeLine = 'The code of this calendar is too long for a rule made here. Use Calendar filters.';

// The id of a rule made on this page starts like this, and the id of no other rule does. The page
// reads and deletes only rules with such an id. Their names start with Hide: or Hide all:.
export const hideIdPrefix = 'calendarFilter-hide-';

// The limits of schemas/calendarFilter.js, so that every rule made here can be published.
// tests/schemas.test.mjs runs the rules through the schema's own checks.
const longestWord = 30;
const longestName = 40;
const longestCode = 20;
const earliestDay = '2020-01-01';
const latestDay = '2099-12-31';
const codePattern = /^[a-z0-9_]+$/;
const plainDay = /^\d{4}-\d{2}-\d{2}$/;

// What the Teletraan computer lists for an event that has no title (computer/scripts/calendar-status.mjs)
const noTitle = 'No title';

// The text cut to at most limit characters, without splitting a character in two
function cutAt(text, limit) {
  let result = '';
  for (const letter of text) {
    if (result.length + letter.length > limit) break;
    result += letter;
  }
  return result;
}

// The text as it is when it fits, otherwise cut short with three dots to fit in room characters
function fitText(text, room) {
  return text.length <= room ? text : cutAt(text, room - 3).trim() + '...';
}

// 2026-10-09, and a day that exists
function isDay(text) {
  if (typeof text !== 'string' || !plainDay.test(text)) return false;

  const date = new Date(text + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// The day of a listed event, or nothing for an event from a document that was written before the
// computer listed days
export function dayOf(event) {
  return isDay(event.day) ? event.day : '';
}

// 0 for Sunday to 6 for Saturday, as the days of a rule are
function weekdayOf(day) {
  return new Date(day + 'T00:00:00Z').getUTCDay();
}

// Sixteen letters and digits that depend on every character of the text. Two sums are made, so that
// two different rules do not get the same id.
export function shortHash(text) {
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = (Math.imul(second, 33) + code) >>> 0;
  }
  return first.toString(16).padStart(8, '0') + second.toString(16).padStart(8, '0');
}

// The words a rule looks for in a title: the title without the three dots the Teletraan computer adds to a long
// one, cut to 30 characters. An event with no title gives none.
export function titleWords(title) {
  const text = typeof title === 'string' ? title.trim().replace(/\.\.\.$/, '').trim() : '';
  if (text === '' || title === noTitle) return [];

  const word = cutAt(text, longestWord).trim();
  return word === '' ? [] : [word];
}

// The name of a rule: Hide: and the title and the day, or Hide all: and the title. The title is cut
// to fit in 40 characters, and the day stays.
export function ruleName(word, day) {
  if (day) return 'Hide: ' + fitText(word, longestName - 'Hide: '.length - ', '.length - day.length) + ', ' + day;
  return 'Hide all: ' + fitText(word, longestName - 'Hide all: '.length);
}

// The rule that hides an event: a Hide rule for the words of its title in its calendar, on its day,
// or on every day when all is true. The id is the same every time for the same rule, so a second
// click finds the rule that is there. It is null when no rule can be made that Studio would accept:
// no title, a calendar code the schema refuses, or, for one day, no day or a day outside 2020 to 2099.
export function hideRuleFor(code, event, all) {
  const item = isRecord(event) ? event : {};
  const words = titleWords(item.title);
  const day = all ? '' : dayOf(item);

  if (words.length === 0 || typeof code !== 'string' || code.length > longestCode || !codePattern.test(code)) return null;
  if (!all && (day === '' || day < earliestDay || day > latestDay)) return null;

  const key = [code, words.join('|').toLowerCase(), all ? 'all' : day].join('|');
  const rule = { _id: hideIdPrefix + shortHash(key), _type: 'calendarFilter', name: ruleName(words[0], day), action: 'hide', words: words, calendar: code };
  if (day) {
    rule.fromDate = day;
    rule.toDate = day;
  }
  rule.show = true;
  return rule;
}

// A rule does nothing when it is switched off or past its Hide after time, and an Always show rule
// does not hide. The Hide after time is the one in the rule, as an ISO time.
function isActive(rule, now) {
  if (rule.show === false || rule.action === 'show') return false;

  const ends = typeof rule.expires === 'string' ? Date.parse(rule.expires) : NaN;
  return isNaN(ends) || ends > now.getTime();
}

// Capitals do not matter and a run of spaces or line breaks counts as one space, as on the screen
function squeezed(text) {
  return String(text || '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim().toLowerCase();
}

// Whether a rule matches a listed event of the calendar with this code, read as ruleMatches in
// dashboard/core/events.js reads it: every condition the rule has must match, and a rule with no
// condition matches nothing. An event with no day cannot match a rule that asks for days or dates.
// tests/calendars-hide.test.mjs runs both on the same cases.
export function ruleMatchesEvent(rule, code, event) {
  const typed = (Array.isArray(rule.words) ? rule.words : []).filter(word => typeof word === 'string' && word.trim() !== '');
  const words = typed.map(squeezed).filter(word => word !== '');
  const days = (Array.isArray(rule.days) ? rule.days : []).filter(day => Number.isInteger(day) && day >= 0 && day <= 6);
  const calendar = typeof rule.calendar === 'string' ? rule.calendar.trim() : '';
  const from = plainDay.test(rule.fromDate) ? rule.fromDate : '';
  const to = plainDay.test(rule.toDate) ? rule.toDate : '';
  if (typed.length === 0 && days.length === 0 && calendar === '' && from === '' && to === '') return false;
  if (typed.length > 0 && words.length === 0) return false;

  const title = squeezed(typeof event.title === 'string' && event.title !== noTitle ? event.title : '');
  const day = dayOf(event);
  if (words.length > 0 && !words.some(word => title.includes(word))) return false;
  if (days.length > 0 && (day === '' || !days.includes(weekdayOf(day)))) return false;
  if (calendar !== '' && calendar !== code) return false;
  if (from !== '' && (day === '' || day < from)) return false;
  if (to !== '' && (day === '' || day > to)) return false;
  return true;
}

// What the page does with one listed event of the calendar with this code. marks is
//   rules  the rules made on this page that are published, see tidyRules
//   gone   the names of rules this page deleted since it opened, which the list may still name
//   now    the time, for the Hide after time of a rule
// The answer has a state:
//   made   a rule made on this page hides it: rule is that rule, and Show again deletes it
//   other  the list says another rule hides it: name is that rule, and the rule is changed under
//          Calendar filters
//   shown  nothing hides it: one and all are the rules the two Hide buttons make (null for a button
//          that cannot be offered), and note says why when one is missing for a reason to tell
// The list is up to 15 minutes old, so a rule made on this page is judged by itself.
export function controlFor(code, event, marks) {
  const item = isRecord(event) ? event : {};
  const listedName = typeof item.rule === 'string' ? item.rule : '';
  const listed = item.shown === false && marks.gone.indexOf(listedName) === -1;
  const matching = marks.rules.filter(rule => isActive(rule, marks.now) && ruleMatchesEvent(rule, code, item));

  if (listed) {
    const own = matching.filter(rule => rule.name === listedName)[0];
    return own ? { state: 'made', rule: own } : { state: 'other', name: listedName || 'a rule with no name' };
  }
  if (matching.length > 0) return { state: 'made', rule: matching[0] };

  const one = hideRuleFor(code, item, false);
  const all = hideRuleFor(code, item, true);
  let note = '';
  if (titleWords(item.title).length > 0 && all === null) note = longCodeLine;
  else if (one === null && all !== null && dayOf(item) === '') note = noDayLine;
  return { state: 'shown', one: one, all: all, note: note };
}

// Puts what controlFor found on the line of an event: a rule made here hides it, or nothing does
// because the list is out of date
export function applyControl(line, control) {
  line.control = control;
  if (control.state === 'made') {
    line.hidden = true;
    line.badge = 'HIDDEN';
    line.rule = 'Hidden by ' + control.rule.name;
  } else if (control.state === 'shown') {
    line.hidden = false;
    line.badge = 'SHOWN';
    line.rule = '';
  }
}

// The rules made on this page, from the answer of the question below: the ones whose id starts
// with hideIdPrefix, and that are not Always show rules
export function tidyRules(list) {
  return (Array.isArray(list) ? list : []).filter(item => isRecord(item) && typeof item._id === 'string' && item._id.indexOf(hideIdPrefix) === 0 && typeof item.name === 'string' && item.action !== 'show');
}

// The list with the rule added, or in place of the rule that has its id
export function withRule(list, rule) {
  return list.filter(item => item._id !== rule._id).concat([rule]);
}

export function withoutRule(list, id) {
  return list.filter(item => item._id !== id);
}

// Only the fields a rule is judged by
const rulesQuestion = '*[_type == "calendarFilter"]{ _id, name, action, words, days, calendar, fromDate, toDate, show, expires }';

// The published rules made on this page. This never fails: rules that cannot be read are reported
// as unreadable, and the page turns the Hide buttons off.
export async function readHideRules(client) {
  try {
    const found = await client.fetch(rulesQuestion, {}, { perspective: 'published' });
    return { rules: tidyRules(found), unreadable: false };
  } catch (error) {
    return { rules: [], unreadable: true };
  }
}

// Makes the rule, unless the same rule is there already, and gives back the rule that is stored.
// A rule that is there is left as it is, so a second click makes no second rule.
export async function hideEvent(client, rule) {
  const stored = await client.createIfNotExists(rule);
  return isRecord(stored) ? stored : rule;
}

// Whether a stored rule hides events now, and so whether the page may say its events are hidden
export function stillHides(rule, now) {
  return isActive(rule, now);
}

// Deletes the published rule and a draft of it, if one exists. A draft is an unsaved change to
// the rule that someone opened under Calendar filters, and would come back as a new rule.
export async function showAgain(client, rule) {
  await client.delete(rule._id);
  try {
    await client.delete('drafts.' + rule._id);
  } catch (error) {
    // The rule is gone either way, so a draft that cannot be deleted does not undo that
  }
}

// One plain line about a change that failed. A refusal says that the account may not be allowed to
// edit the rules. The reason is what Sanity said, cut short.
export function failureText(error) {
  const reason = isRecord(error) && typeof error.message === 'string' ? error.message.replace(/\s+/g, ' ').trim() : '';
  const status = isRecord(error) ? error.statusCode : undefined;
  const refused = status === 401 || status === 403 || /permission|not allowed|unauthori[sz]ed/i.test(reason);

  const start = refused ? 'Studio refused the change, so your account may not be allowed to edit Calendar filters.' : 'The change was not saved.';
  return reason === '' ? start : start + ' Sanity said: ' + sentence(cutAt(reason, 160));
}

// For a rule that is there already but does nothing, such as one that was switched off
export function restingText(name) {
  return 'The rule ' + name + ' is there already but does nothing now. Check Rule on and Hide after under Calendar filters.';
}
