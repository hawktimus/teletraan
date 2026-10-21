// The clean up of expired items, as plain functions. expired-cleanup.sh (started by teletraan-cleanup.timer once a night)
// does the fetching, the files and the deleting, and asks this file what to delete. The control page
// (control/support/cleanup.js) uses the same starting values and limits, so the page, the Studio and the timer cannot
// disagree about what a setting means.
//
// The settings are three fields of Dashboard Settings (studio/schemas/settingsCleanup.js):
//   cleanupEnabled          off to start with
//   cleanupDeleteAfterDays  how many days after an item expired it may be deleted, 1 to 365, 14 to start with
//   cleanupMode             list (only show what would be deleted, to start with) or delete
//
// Deleting is the one thing in Teletraan I that cannot be undone from the Studio, so this file only ever picks from a short
// list of types (rules below), and every rule that says "skip" wins over every rule that says "delete":
//   - a type that is not in the rules is never touched (teams, settings, looks, views, screens, Monday tasks, the status
//     documents of the Mini, FRC news, the Events Calendar)
//   - a document with no value in its date fields, or a value that cannot be read, is skipped
//   - a document is skipped when any copy of it (published or draft) was edited in the last 48 hours
//   - a draft with no published copy is skipped when it was edited in the last 14 days
//   - every copy has to be past the grace period, so a draft with a later date keeps the published copy too
//   - the run stops, and deletes nothing, when the list holds more than 40 percent of the documents of one type
//   - at most 100 documents are deleted in one run, oldest first; the rest wait for the next run
//
//   node cleanup-plan.mjs plan <input.json>            prints the decision as JSON; writes nothing
//   node cleanup-plan.mjs verify <plan.json> <docs.json>  prints the plan with only the documents that are still as planned
//   node cleanup-plan.mjs lines <plan.json>            prints the list for the control page, one tab separated line each
//   node cleanup-plan.mjs text <plan.json> <when> <mode>  prints the list as plain text for the file in the data folder
//   node cleanup-plan.mjs stop <plan.json>             prints the sentence for a run that stopped
//   node cleanup-plan.mjs types | fields               the types it may delete, and the fields the query asks for

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const defaults = {
  cleanupEnabled: false,
  cleanupDeleteAfterDays: 14,
  cleanupMode: 'list',
};

export const daysRange = { min: 1, max: 365 };
export const modes = ['list', 'delete'];

export const maxDeletions = 100;
export const maxShare = 0.4;
export const recentHours = 48;
export const draftOnlyDays = 14;

const hour = 3600000;
const day = 86400000;

// The types that may be deleted and the fields that say when each one ended. 'day' fields hold a date and end with that
// day; 'time' fields hold a date and time. When a type has more than one field, every field that has a value counts and the
// latest one decides.
export const rules = {
  tipOrNews: { label: 'Tip or news', fields: [['expires', 'time']], title: ['text'] },
  announcement: { label: 'Announcement', fields: [['end', 'time']], title: ['text'] },
  photo: { label: 'Photo', fields: [['expires', 'time']], title: ['caption', 'credit'] },
  plan: { label: 'Agenda item', fields: [['date', 'day'], ['expires', 'time']], title: ['heading'] },
  person: { label: 'Leadership', fields: [['expires', 'time']], title: ['name'] },
  rosterPerson: { label: 'Team lead', fields: [['expires', 'time']], title: ['firstName'] },
  subteam: { label: 'Subteam', fields: [['expires', 'time']], title: ['name'] },
  sponsor: { label: 'Sponsor', fields: [['expires', 'time']], title: ['name'] },
  calendarFilter: { label: 'Calendar filter', fields: [['toDate', 'day'], ['expires', 'time']], title: ['name'] },
  presentation: { label: 'Presentation', fields: [['start', 'time']], title: ['topic', 'name'] },
};

export const types = Object.keys(rules);

// Documents that are never deleted even if a rule above would match them. The types already keep them out; this is the
// second lock on the door.
const neverIds = /^(dashboardSettings|theme|status-mini|calendar-status|monday-status|frc-status|frc-news|task-monday-.*|milestone-.*)$/;

// The fields the query asks Sanity for, so the shell script and this file agree
export const fieldNames = Array.from(new Set(['_id', '_type', '_updatedAt'].concat(...types.map(type => rules[type].fields.map(field => field[0])), ...types.map(type => rules[type].title))));

// ----- the setting -----

// What Sanity holds, with the starting value for anything missing or not usable. An old or damaged copy still gives a
// setting that is safe: off, 14 days, list only.
export function settingFrom(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const days = source.cleanupDeleteAfterDays;
  return {
    cleanupEnabled: source.cleanupEnabled === true,
    cleanupDeleteAfterDays: Number.isInteger(days) && days >= daysRange.min && days <= daysRange.max ? days : defaults.cleanupDeleteAfterDays,
    cleanupMode: source.cleanupMode === 'delete' ? 'delete' : 'list',
  };
}

// ----- dates -----

const dayPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

// The moment a value ends, in milliseconds: the end of a day for a date, the moment itself for a time. NaN when it cannot be read.
export function endOf(value, kind) {
  if (typeof value !== 'string') return NaN;
  if (kind === 'day') {
    const found = dayPattern.exec(value);
    if (!found) return NaN;
    const start = Date.UTC(Number(found[1]), Number(found[2]) - 1, Number(found[3]));
    // 2026-02-30 would roll over to March, so it is not a date
    if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== value) return NaN;
    return start + day;
  }
  if (!timePattern.test(value)) return NaN;
  return Date.parse(value);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

// The latest end among the fields of a document that have a value. 'none' when no field has a value, 'unreadable' when one
// has a value that cannot be read.
function expiryOf(doc, rule) {
  let latest = NaN;
  let shownDay = '';
  let found = false;
  for (const [name, kind] of rule.fields) {
    if (!hasValue(doc[name])) continue;
    found = true;
    const end = endOf(doc[name], kind);
    if (!Number.isFinite(end)) return { state: 'unreadable', field: name };
    if (!Number.isFinite(latest) || end > latest) {
      latest = end;
      // A date ends at the start of the next day, but the day it names is the day before
      shownDay = dayText(kind === 'day' ? end - 1 : end);
    }
  }
  return found ? { state: 'ok', ms: latest, day: shownDay } : { state: 'none' };
}

function plain(text, longest) {
  return String(text).replace(/[\u0000-\u001f\u007f|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, longest);
}

function titleOf(doc, rule) {
  for (const name of rule.title) {
    if (typeof doc[name] === 'string' && doc[name].trim() !== '') return plain(doc[name], 60);
  }
  return '(no title)';
}

function dayText(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// ----- the plan -----

// input: { setting, nowMs, docs }. docs are every copy of the allowed types, published and drafts, with the fields in
// fieldNames. Gives { setting, candidates, skipped, quiet, waiting, stop, totals }.
export function makePlan(input) {
  const setting = settingFrom(input && input.setting);
  const now = Number(input && input.nowMs);
  const docs = Array.isArray(input && input.docs) ? input.docs : [];
  if (!Number.isFinite(now) || now <= 0) throw new Error('The plan needs the time now.');
  const grace = setting.cleanupDeleteAfterDays * day;

  // One group for each document: its published copy and its draft
  const groups = new Map();
  const skipped = [];
  let quiet = 0;
  for (const doc of docs) {
    if (!doc || typeof doc._id !== 'string' || typeof doc._type !== 'string') continue;
    if (!rules[doc._type]) continue;
    const isDraft = doc._id.startsWith('drafts.');
    const base = isDraft ? doc._id.slice(7) : doc._id;
    // A copy that belongs to a release (versions.<release>.<id>) or an id with odd signs is not touched
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(base) || neverIds.test(base)) {
      skipped.push({ id: doc._id, type: doc._type, label: rules[doc._type].label, title: '', reason: 'the id is not one this clean up may delete' });
      continue;
    }
    if (!groups.has(base)) groups.set(base, { id: base, type: doc._type, published: null, draft: null, mixed: false });
    const group = groups.get(base);
    if (group.type !== doc._type) group.mixed = true;
    if (isDraft) group.draft = doc;
    else group.published = doc;
  }

  const totals = {};
  groups.forEach(group => { totals[group.type] = (totals[group.type] || 0) + 1; });

  let candidates = [];
  groups.forEach(group => {
    const rule = rules[group.type];
    const copies = [group.published, group.draft].filter(Boolean);
    const note = reason => skipped.push({ id: group.id, type: group.type, label: rule.label, title: titleOf(group.published || group.draft, rule), reason: reason });

    if (group.mixed) return note('the published copy and the draft are different types');

    let latest = NaN;
    let latestDay = '';
    let overdue = true;
    let unreadable = '';
    let withDate = 0;
    for (const copy of copies) {
      const expiry = expiryOf(copy, rule);
      if (expiry.state === 'unreadable') unreadable = expiry.field;
      else if (expiry.state === 'none') overdue = false;
      else {
        withDate += 1;
        if (!(expiry.ms + grace <= now)) overdue = false;
        if (copy === (group.published || group.draft)) {
          latest = expiry.ms;
          latestDay = expiry.day;
        }
      }
    }
    if (unreadable) return note('the date in ' + unreadable + ' cannot be read');
    if (withDate === 0 || !overdue || !Number.isFinite(latest)) {
      quiet += 1;
      return;
    }

    // From here the document is old enough, so the guards that follow are worth telling the owner about
    for (const copy of copies) {
      const updated = Date.parse(copy._updatedAt);
      if (!Number.isFinite(updated)) return note('its edit time cannot be read');
      if (now - updated < recentHours * hour) return note('it was edited in the last ' + recentHours + ' hours');
    }
    if (!group.published && group.draft && now - Date.parse(group.draft._updatedAt) < draftOnlyDays * day) {
      return note('it is a draft that was never published and was edited in the last ' + draftOnlyDays + ' days');
    }

    candidates.push({
      id: group.id,
      type: group.type,
      label: rule.label,
      title: titleOf(group.published || group.draft, rule),
      expiredOn: latestDay,
      expiredAt: latest,
      ageDays: Math.floor((now - latest) / day),
      ids: copies.map(copy => copy._id),
      updated: Object.fromEntries(copies.map(copy => [copy._id, copy._updatedAt])),
    });
  });

  candidates.sort((a, b) => a.expiredAt - b.expiredAt || (a.id < b.id ? -1 : 1));

  // The share of one type: a list this big is more likely a wrong date or a wrong setting than a clean up
  let stop = null;
  const counts = {};
  candidates.forEach(candidate => { counts[candidate.type] = (counts[candidate.type] || 0) + 1; });
  for (const type of types) {
    if (counts[type] && counts[type] > totals[type] * maxShare) {
      stop = { type: type, label: rules[type].label, count: counts[type], total: totals[type] };
      break;
    }
  }

  const waiting = Math.max(0, candidates.length - maxDeletions);
  candidates = candidates.slice(0, maxDeletions);
  return { setting: setting, candidates: candidates, skipped: skipped, quiet: quiet, waiting: waiting, stop: stop, totals: totals };
}

// Keeps only the planned documents that are still the same copies: each id must be there with the same edit time, and
// nothing else changed in between. A document that was edited or removed while the run was going is left alone.
export function verifyPlan(plan, fresh) {
  const seen = new Map();
  (Array.isArray(fresh) ? fresh : []).forEach(doc => { if (doc && typeof doc._id === 'string') seen.set(doc._id, doc._updatedAt); });
  const kept = [];
  const changed = [];
  plan.candidates.forEach(candidate => {
    const same = candidate.ids.every(id => seen.has(id) && seen.get(id) === candidate.updated[id]);
    (same ? kept : changed).push(candidate);
  });
  return Object.assign({}, plan, { candidates: kept, changedWhileRunning: changed.length });
}

// ----- the words -----

function howMany(count, one, many) {
  return count + ' ' + (count === 1 ? one : many);
}

// One line for each thing, tab separated, for the control page: item, note or stop
export function linesOf(plan) {
  const out = [];
  plan.candidates.forEach(candidate => {
    out.push(['item', candidate.label, candidate.title, candidate.expiredOn, String(candidate.ageDays)].join('\t'));
  });
  if (plan.stop) {
    out.push('stop\t' + stopWords(plan.stop));
  }
  if (plan.waiting > 0) out.push('note\t' + howMany(plan.waiting, 'more document waits', 'more documents wait') + ' for the next run (the limit is ' + maxDeletions + ' a run).');
  plan.skipped.slice(0, 20).forEach(item => out.push('note\tKept ' + (item.title ? '"' + item.title + '"' : item.id) + ' (' + item.label + '): ' + item.reason + '.'));
  if (plan.skipped.length > 20) out.push('note\t' + (plan.skipped.length - 20) + ' more were kept; the list file in the data folder has them all.');
  return out;
}

export function stopWords(stop) {
  return 'Stopped, nothing is deleted: ' + stop.count + ' of ' + stop.total + ' ' + stop.label.toLowerCase() + ' items are on the list, which is more than ' + Math.round(maxShare * 100) + ' percent. Look at the dates in the Studio, or delete the old ones by hand.';
}

// The plain text file that is kept in the data folder
export function textOf(plan, when, mode) {
  const out = [];
  out.push('Teletraan I: clean up expired items');
  out.push('List made ' + when + '. Mode: ' + (mode === 'delete' ? 'delete' : 'list only, nothing is deleted') + '. Grace: ' + plan.setting.cleanupDeleteAfterDays + ' days after the item expired.');
  out.push('');
  if (plan.candidates.length === 0) out.push('Nothing is old enough to delete.');
  else out.push(howMany(plan.candidates.length, 'document is', 'documents are') + ' on the list:');
  plan.candidates.forEach(candidate => {
    out.push('  ' + candidate.label + ' | ' + candidate.title + ' | expired ' + candidate.expiredOn + ' | ' + candidate.ageDays + ' days ago | id ' + candidate.id + (candidate.ids.length > 1 ? ' (and its draft)' : candidate.ids[0].startsWith('drafts.') ? ' (a draft only)' : ''));
  });
  if (plan.stop) out.push('', stopWords(plan.stop));
  if (plan.waiting > 0) out.push('', howMany(plan.waiting, 'more document waits', 'more documents wait') + ' for the next run.');
  if (plan.skipped.length > 0) {
    out.push('', 'Kept, and why:');
    plan.skipped.forEach(item => out.push('  ' + item.label + ' | ' + (item.title || '') + ' | id ' + item.id + ' | ' + item.reason));
  }
  return out.join('\n') + '\n';
}

// ----- the command line -----

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main(argv) {
  const [command, first, second, third] = argv;
  if (command === 'plan') {
    const plan = makePlan(readJson(first));
    process.stdout.write(JSON.stringify(plan) + '\n');
  } else if (command === 'verify') {
    const plan = verifyPlan(readJson(first), readJson(second));
    process.stdout.write(JSON.stringify(plan) + '\n');
  } else if (command === 'lines') {
    process.stdout.write(linesOf(readJson(first)).join('\n') + '\n');
  } else if (command === 'text') {
    process.stdout.write(textOf(readJson(first), second || new Date().toISOString(), third));
  } else if (command === 'stop') {
    process.stdout.write(stopWords(readJson(first).stop) + '\n');
  } else if (command === 'types') {
    process.stdout.write(types.join(' ') + '\n');
  } else if (command === 'fields') {
    process.stdout.write(fieldNames.join(', ') + '\n');
  } else {
    console.error('Usage: node cleanup-plan.mjs plan|verify|lines|text <file>, types, or fields');
    process.exit(2);
  }
}

// The real path is compared, because a temporary folder can be reached by a link (/var is /private/var on a Mac)
if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main(process.argv.slice(2));
