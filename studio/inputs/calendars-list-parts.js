// The parts of the Calendars page that need no Studio: the list of coming events, how they are
// grouped by day, the state each one is in, and the one event rules that the Show and Hide switch
// writes. calendars-view.js draws them. Plain functions only: the ones that write take the
// Studio's client as an argument, so node can test them with a fake one.
// tests/calendars-list.test.mjs reads this file with node.

import { ageText } from './time-text.js';
import { isRecord, sentence } from './plain-values.js';
import { shortHash, ruleMatchesEvent } from './calendars-hide-rules.js';

// The id the Teletraan computer writes the list to (computer/scripts/calendar-status.mjs)
export const statusId = 'calendar-status';

export const words = {
  noCalendars: 'No calendars are set up on the Teletraan computer. Add the links on the control page, Settings, Keys.',
  nothingYet: 'Nothing yet. The Teletraan computer writes this list after it has downloaded the calendars. If no calendars are set up, add the links on the control page, Settings, Keys.',
  linksNote: 'The calendar links are secret, so they are not kept here. They live on the control page, Settings, Keys.',
  help: 'These are the events the Teletraan computer downloaded from BAND, from now on. The switch on an event shows it on the TV or hides it. Past events are not listed.',
  applyNote: 'Click Publish all to apply.',
  publicNote: 'The titles of events the TV shows are saved in the dataset, which anyone can read. A hidden event is saved without its title.',
  hiddenTitle: 'Hidden event',
  titleNotKept: 'The title of a hidden event is not kept, so this switch cannot be used. Change or remove the rule that hides it under Calendar filters.',
  shown: 'Shows on the TV',
  hiddenByYou: 'Hidden by you',
  hiddenCalendar: 'The calendar is hidden',
  earlier: 'Earlier today',
  undo: 'Undo',
  noStart: 'The Teletraan computer adds what this switch needs on its next run.',
  calendarOff: 'Switch the calendar on in Dashboard Settings, on the Calendars tab.',
  noEvents: 'No coming events.',
  noMatch: 'No event matches. Clear the search or the filters.',
  rulesUnreadable: 'The rules could not be read, so the reasons shown may be out of date. Refresh the page.',
};

// The prefix of the name of every one event rule, so the page knows its own rules by name too
export const oneEventPrefix = 'One event';
export const oneEventIdPrefix = 'calendarFilter-one-';

const dayMs = 86400000;
const longestName = 40;

// 2026-10-09 in a time zone, for a moment given as ISO text or a Date. A zone that is not known
// falls back to the zone of the editor's own computer.
export function dayIn(moment, zone) {
  const date = moment instanceof Date ? moment : new Date(moment);
  if (isNaN(date.getTime())) return '';
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  try {
    return date.toLocaleDateString('en-CA', zone ? Object.assign({ timeZone: zone }, options) : options);
  } catch (error) {
    return date.toLocaleDateString('en-CA', options);
  }
}

function addDays(day, count) {
  return new Date(Date.parse(day + 'T00:00:00Z') + count * dayMs).toISOString().slice(0, 10);
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Today, Tomorrow, or Mon Oct 12
export function dayLabel(day, today) {
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'Date not known';

  const date = new Date(day + 'T00:00:00Z');
  return weekdayNames[date.getUTCDay()] + ' ' + monthNames[date.getUTCMonth()] + ' ' + date.getUTCDate();
}

function textOf(value) {
  return typeof value === 'string' ? value : '';
}

function millis(isoText) {
  const time = typeof isoText === 'string' ? Date.parse(isoText) : NaN;
  return isNaN(time) ? null : time;
}

// What the page knows about the calendars of Dashboard Settings: the name, the kind and the switch
function entryFor(entries, code) {
  return (Array.isArray(entries) ? entries : []).filter(item => isRecord(item) && item.id === code)[0] || null;
}

const kindTitles = { meetings: 'Meetings', competitions: 'Competitions', outreach: 'Outreach', deadlines: 'Deadlines' };

// The coming events as rows, in time order, with none from before today. A day is judged in the time
// zone of the screen. An event that began on an earlier day and is still on is kept, under Today. An event that
// has finished today is kept and marked earlier. status is the document of the Teletraan computer,
// entries the calendars of Dashboard Settings.
export function eventRows(status, entries, now, zone) {
  const today = dayIn(now, zone);
  const calendars = isRecord(status) && Array.isArray(status.calendars) ? status.calendars : [];
  const rows = [];

  calendars.filter(item => isRecord(item) && textOf(item.code) !== '').forEach(calendar => {
    const entry = entryFor(entries, calendar.code);
    (Array.isArray(calendar.occurrences) ? calendar.occurrences : []).filter(isRecord).forEach((event, index) => {
      const start = millis(event.start);
      const end = millis(event.end);
      const day = /^\d{4}-\d{2}-\d{2}$/.test(textOf(event.day)) ? event.day : start === null ? '' : dayIn(new Date(start), zone);
      const over = end !== null && end <= now.getTime();
      if (day !== '' && day < today && (end === null || over)) return;

      // A hidden event is written without its title, because the dataset is public (computer/scripts/calendar-status.mjs)
      const titleKept = textOf(event.title) !== '' || event.shown !== false;
      const title = textOf(event.title) || (titleKept ? 'No title' : words.hiddenTitle);
      rows.push({
        key: calendar.code + '|' + (textOf(event.start) || textOf(event._key) || index) + '|' + title,
        code: calendar.code,
        calendarName: entry && entry.name ? entry.name : calendar.code,
        kind: entry ? kindTitles[entry.kind] || '' : '',
        calendarOn: entry !== null && entry.show !== false,
        title: title,
        titleKept: titleKept,
        time: textOf(event.time) || 'All day',
        start: textOf(event.start),
        end: textOf(event.end),
        day: day,
        listDay: day !== '' && day < today ? today : day,
        earlier: over,
        listedShown: event.shown !== false,
        listedRule: textOf(event.rule),
        order: start === null ? Infinity : start,
        index: rows.length,
      });
    });
  });

  return rows.sort((a, b) => (a.listDay < b.listDay ? -1 : a.listDay > b.listDay ? 1 : 0) || a.order - b.order || a.index - b.index);
}

// The rows in groups by day: [{ day, label, rows }]. A row with no day goes last.
export function groupByDay(rows, today) {
  const groups = [];
  rows.forEach(row => {
    const last = groups[groups.length - 1];
    if (last && last.day === row.listDay) last.rows.push(row);
    else groups.push({ day: row.listDay, label: dayLabel(row.listDay, today), rows: [row] });
  });
  return groups.sort((a, b) => (a.day === '' ? 1 : b.day === '' ? -1 : a.day < b.day ? -1 : 1));
}

// One event rules

export function isOneEventRule(rule) {
  return isRecord(rule) && rule.scope === 'one';
}

// A rule does nothing when it is switched off or past its Hide after time
export function isLive(rule, now) {
  if (rule.show === false) return false;
  const ends = millis(rule.expires);
  return ends === null || ends > now.getTime();
}

export function oneEventMatches(rule, row) {
  return isOneEventRule(rule) && rule.eventCalendar === row.code && rule.eventTitle === row.title && millis(rule.eventStart) !== null && millis(rule.eventStart) === millis(row.start);
}

export function oneEventId(row, action) {
  return oneEventIdPrefix + shortHash([row.code, row.title, row.start, action].join('|'));
}

function fitName(start, title, day) {
  const room = longestName - start.length - ', '.length - day.length;
  const shortTitle = title.length <= room ? title : title.slice(0, Math.max(room - 3, 1)).trim() + '...';
  return start + shortTitle + ', ' + day;
}

// The rule that hides (action hide) or shows (action show) one event. It stops a day after the event
// ends, so old rules do nothing. null when the event has no start to match by.
export function oneEventRule(row, action) {
  const start = millis(row.start);
  if (start === null || row.code === '' || row.title === '') return null;

  const end = millis(row.end);
  const ends = Math.max(start, end === null ? start : end) + dayMs;
  return {
    _id: oneEventId(row, action),
    _type: 'calendarFilter',
    name: fitName(action === 'hide' ? oneEventPrefix + ': ' : oneEventPrefix + ' shown: ', row.title, row.day || row.start.slice(0, 10)),
    action: action,
    scope: 'one',
    eventCalendar: row.code,
    eventTitle: row.title,
    eventStart: row.start,
    expires: new Date(ends).toISOString(),
    show: true,
  };
}

// The rules of the list: { id, published, draft }, one for each rule that has a published version
// or a draft. raw is every calendarFilter document, drafts included.
export function ruleGroups(raw) {
  const groups = {};
  (Array.isArray(raw) ? raw : []).filter(item => isRecord(item) && typeof item._id === 'string').forEach(item => {
    const draft = item._id.indexOf('drafts.') === 0;
    const id = draft ? item._id.slice('drafts.'.length) : item._id;
    groups[id] = groups[id] || { id: id, published: null, draft: null };
    groups[id][draft ? 'draft' : 'published'] = item;
  });
  return Object.keys(groups).map(id => groups[id]);
}

// The rules as they will be after Publish all (a draft wins), or as the TV has them now
export function effectiveRules(groups) {
  return groups.map(group => group.draft || group.published).filter(Boolean);
}

export function publishedRules(groups) {
  return groups.map(group => group.published).filter(Boolean);
}

// How a rule list judges a row, ignoring the status the computer wrote: a one event Show rule wins,
// then a one event Hide rule, then the ordinary rules, where Always show beats Hide as it does on the
// TV. rules is a list of rules, or null when they could not be read, and then the computer's own
// word for the event is used.
export function judge(row, rules, now) {
  if (rules === null || row.titleKept === false) return row.listedShown ? { visible: true, by: '' } : { visible: false, by: 'rule', rule: row.listedRule || 'a rule with no name' };

  const live = rules.filter(rule => isLive(rule, now));
  const own = live.filter(rule => oneEventMatches(rule, row));
  if (own.some(rule => rule.action === 'show')) return { visible: true, by: 'you' };
  if (own.some(rule => rule.action !== 'show')) return { visible: false, by: 'you' };

  const ordinary = live.filter(rule => !isOneEventRule(rule) && ruleMatchesEvent(rule, row.code, { title: row.title, day: row.day }));
  if (ordinary.some(rule => rule.action === 'show')) return { visible: true, by: '' };
  const hiding = ordinary.filter(rule => rule.action !== 'show')[0];
  return hiding ? { visible: false, by: 'rule', rule: hiding.name || 'a rule with no name' } : { visible: true, by: '' };
}

// What a row says and what its switch does. groups are the rules of ruleGroups, or null when they
// could not be read. The answer:
//   id        shown, hidden-you, hidden-rule, hidden-calendar or earlier
//   text      the state in words
//   reason    the reason in words, or empty
//   on        whether the switch is on (the TV shows the event after Publish all)
//   pending   true when that differs from what the TV does now, so Publish all is needed
//   canSwitch false with note when the switch is off for a reason
export function stateOf(row, groups, now) {
  const after = judge(row, groups === null ? null : effectiveRules(groups), now);
  const before = judge(row, groups === null ? null : publishedRules(groups), now);
  const pending = after.visible !== before.visible;
  const state = { on: after.visible, pending: pending, canSwitch: true, note: '', reason: '' };

  if (row.earlier) return Object.assign(state, { id: 'earlier', text: words.earlier, on: false, pending: false, canSwitch: false });
  if (!row.calendarOn) return Object.assign(state, { id: 'hidden-calendar', text: words.hiddenCalendar, on: false, pending: false, canSwitch: false, note: words.calendarOff });
  if (oneEventRule(row, 'hide') === null) Object.assign(state, { canSwitch: false, note: words.noStart });
  if (row.titleKept === false) Object.assign(state, { canSwitch: false, note: words.titleNotKept });

  if (after.visible) {
    const reason = after.by === 'you' ? 'Shown by you although a rule hides it.' : '';
    return Object.assign(state, { id: 'shown', text: words.shown, reason: reason });
  }
  if (after.by === 'you') return Object.assign(state, { id: 'hidden-you', text: words.hiddenByYou });
  return Object.assign(state, { id: 'hidden-rule', text: 'Hidden', reason: 'Hidden by the rule ' + after.rule + '.' });
}

// What a click on the switch of a row changes: { make: [rules to draft], withdraw: [ids] }. The
// switch always asks for the opposite of what it shows. If that is what the ordinary rules and
// calendars already give, the one event rules are withdrawn. Otherwise one is made.
export function planSwitch(row, groups, now) {
  const rules = effectiveRules(groups);
  const current = judge(row, rules, now);
  const wantVisible = !current.visible;
  const base = judge(row, rules.filter(rule => !isOneEventRule(rule)), now);

  if (wantVisible === base.visible) {
    const withdraw = groups.filter(group => {
      const rule = group.draft || group.published;
      return oneEventMatches(rule, row) && isLive(rule, now);
    }).map(group => group.id);
    return { make: [], withdraw: withdraw };
  }
  const made = oneEventRule(row, wantVisible ? 'show' : 'hide');
  return { make: made ? [made] : [], withdraw: [] };
}

// Writes. The Studio's client is passed in. Everything goes to the draft, so nothing reaches the TV
// before Publish all.
export async function saveDraft(client, rule) {
  return client.createOrReplace(Object.assign({}, rule, { _id: 'drafts.' + rule._id }));
}

// A rule that was published cannot be removed by a draft, so its draft says it is off. A rule that
// has only a draft is deleted.
export async function withdrawRule(client, group) {
  if (group.published) {
    return client.createOrReplace(Object.assign({}, group.published, { _id: 'drafts.' + group.id, show: false }));
  }
  return client.delete('drafts.' + group.id);
}

export async function applySwitch(client, plan, groups) {
  for (const rule of plan.make) await saveDraft(client, rule);
  for (const id of plan.withdraw) await withdrawRule(client, groups.filter(group => group.id === id)[0]);
}

// The groups after a plan, so the page need not read again
export function groupsAfter(groups, plan) {
  let next = groups.slice();
  plan.make.forEach(rule => {
    const found = next.filter(group => group.id === rule._id)[0];
    const draft = Object.assign({}, rule, { _id: 'drafts.' + rule._id });
    next = found ? next.map(group => (group === found ? Object.assign({}, group, { draft: draft }) : group)) : next.concat([{ id: rule._id, published: null, draft: draft }]);
  });
  plan.withdraw.forEach(id => {
    const found = next.filter(group => group.id === id)[0];
    if (!found) return;
    next = found.published
      ? next.map(group => (group === found ? Object.assign({}, group, { draft: Object.assign({}, found.published, { _id: 'drafts.' + id, show: false }) }) : group))
      : next.filter(group => group !== found);
  });
  return next;
}

// The question for the rules: every calendarFilter, drafts too
export const rulesQuestion = '*[_type == "calendarFilter"]{ _id, name, action, words, days, calendar, fromDate, toDate, show, expires, force, scope, eventCalendar, eventTitle, eventStart }';

// The rules, or null when they cannot be read
export async function readRuleGroups(client) {
  try {
    return ruleGroups(await client.fetch(rulesQuestion, {}, { perspective: 'raw' }));
  } catch (error) {
    return null;
  }
}

// Filters

// The rows that pass the calendar picked ('' for every one), the search words and Hidden only
export function filterRows(rows, states, options) {
  const search = textOf(options.search).trim().toLowerCase();
  return rows.filter(row => {
    if (options.calendar && row.code !== options.calendar) return false;
    if (options.hiddenOnly && (states[row.key].on || states[row.key].id === 'earlier')) return false;
    if (search === '') return true;
    return [row.title, row.calendarName].join(' ').toLowerCase().includes(search);
  });
}

// The lines about the downloads

// Last downloaded 4 minutes ago from 6 calendars. null when no calendar was downloaded properly.
export function downloadLine(status, now) {
  const calendars = isRecord(status) && Array.isArray(status.calendars) ? status.calendars : [];
  const times = calendars.map(item => millis(isRecord(item) ? item.fetchedAt : null)).filter(time => time !== null);
  if (times.length === 0) return '';

  const age = ageText(new Date(Math.max.apply(null, times)).toISOString(), now);
  return 'Last downloaded ' + age + ' from ' + times.length + (times.length === 1 ? ' calendar' : ' calendars') + '.';
}

// One line for each calendar: works, or failed with the reason in plain words
export function calendarLines(status, entries, now) {
  const calendars = isRecord(status) && Array.isArray(status.calendars) ? status.calendars : [];
  return calendars.filter(item => isRecord(item) && textOf(item.code) !== '').map(item => {
    const entry = entryFor(entries, item.code);
    const age = ageText(item.fetchedAt, now);
    const failed = textOf(item.error) !== '';
    return {
      code: item.code,
      name: entry && entry.name ? entry.name : item.code,
      failed: failed,
      text: failed ? 'Failed. ' + sentence(item.error) : age ? 'Works. Downloaded ' + age + '.' : 'Not downloaded yet.',
    };
  });
}

// The notice for a computer with no calendars, a document not written yet, or nothing
export function emptyNotice(status) {
  if (!isRecord(status)) return words.nothingYet;
  const calendars = Array.isArray(status.calendars) ? status.calendars.filter(item => isRecord(item) && textOf(item.code) !== '') : [];
  return calendars.length === 0 ? words.noCalendars : '';
}

// The rules, in plain sentences

function listWords(list) {
  return list.map(word => '"' + word + '"').join(' or ');
}

// Hides events with "Pre-Season" in the title, on Mon and Thu, in the team calendar.
export function ruleSentence(rule, now) {
  const verb = rule.action === 'show' ? 'Always shows' : 'Hides';
  const typed = (Array.isArray(rule.words) ? rule.words : []).filter(word => typeof word === 'string' && word.trim() !== '');
  const days = (Array.isArray(rule.days) ? rule.days : []).filter(day => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const parts = [verb + (typed.length > 0 ? ' events with ' + listWords(typed) + ' in the title' : ' events')];

  if (days.length > 0) parts.push('on ' + days.map(day => weekdayNames[day]).join(' and '));
  if (rule.calendar) parts.push('in the ' + rule.calendar + ' calendar');
  if (rule.fromDate && rule.toDate) parts.push('from ' + rule.fromDate + ' to ' + rule.toDate);
  else if (rule.fromDate) parts.push('from ' + rule.fromDate);
  else if (rule.toDate) parts.push('until ' + rule.toDate);

  let text = parts.join(', ') + '.';
  if (rule.action === 'show' && rule.force) text += ' It pins them to page one.';
  if (rule.show === false) text += ' The rule is switched off.';
  else if (!isLive(rule, now)) text += ' The rule has ended.';
  return text;
}

// The rules to list: every rule that is not a one event rule, by name
export function rulesList(groups, now) {
  return effectiveRules(groups)
    .filter(rule => !isOneEventRule(rule))
    .sort((a, b) => textOf(a.name).localeCompare(textOf(b.name)))
    .map(rule => ({ name: textOf(rule.name) || 'Rule with no name', text: ruleSentence(rule, now) }));
}

export function failureText(error) {
  const reason = isRecord(error) && typeof error.message === 'string' ? error.message.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  const status = isRecord(error) ? error.statusCode : undefined;
  const refused = status === 401 || status === 403 || /permission|not allowed|unauthori[sz]ed/i.test(reason);
  const start = refused ? 'Studio refused the change, so your account may not be allowed to edit Calendar filters.' : 'The change was not saved. Check the connection and try again.';
  return reason === '' ? start : start + ' Sanity said: ' + sentence(reason);
}
