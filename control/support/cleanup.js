// What the Clean up expired items card reads and writes in Dashboard Settings: the three cleanup fields the Studio shows in the
// Advanced tab (studio/schemas/settingsCleanup.js). Same stored names, same limits, written to the draft only.
// The meaning of a setting (the starting values and the limits) is in computer/scripts/cleanup-plan.mjs, which the nightly job on
// the Teletraan computer uses too, so the card, the Studio and the job cannot disagree.

import { daysRange, modes, settingFrom } from '../../computer/scripts/cleanup-plan.mjs';
import { Refusal } from './http.js';

export const cleanupFieldNames = ['cleanupEnabled', 'cleanupDeleteAfterDays', 'cleanupMode'];

// What the card shows for the last run: the lines the job wrote to status-mini
export const statusQuery = '{ "status": *[_id == "status-mini"][0]{ lastCleanupAt, cleanupWouldDelete, cleanupDeleted, cleanupError } }';

// The setting the card shows: the stored values, with the starting value for anything missing
export function settingOf(source) {
  return settingFrom(source);
}

function text(value, longest) {
  return typeof value === 'string' ? value.trim().slice(0, longest) : '';
}

function count(value) {
  return Number.isInteger(value) && value >= 0 && value < 100000 ? value : null;
}

// The status lines for the card: plain text and counts only
export function statusOf(result) {
  const status = result && result.status && typeof result.status === 'object' ? result.status : {};
  return {
    lastAt: text(status.lastCleanupAt, 40),
    wouldDelete: count(status.cleanupWouldDelete),
    deleted: count(status.cleanupDeleted),
    error: text(status.cleanupError, 160),
  };
}

// The fields that were sent, checked. A field that was not sent is not touched. Out of range values are refused in
// words, not corrected, so nobody finds a number changed behind them.
export function cleanSetting(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Refusal(400, 'The clean up settings should be an object.');
  const out = {};

  if (input.cleanupEnabled !== undefined) {
    if (typeof input.cleanupEnabled !== 'boolean') throw new Refusal(400, 'Clean up expired items should be on or off.');
    out.cleanupEnabled = input.cleanupEnabled;
  }
  if (input.cleanupDeleteAfterDays !== undefined) {
    const days = input.cleanupDeleteAfterDays;
    if (!Number.isInteger(days) || days < daysRange.min || days > daysRange.max) throw new Refusal(400, 'Wait this many days should be a whole number from ' + daysRange.min + ' to ' + daysRange.max + '.');
    out.cleanupDeleteAfterDays = days;
  }
  if (input.cleanupMode !== undefined) {
    if (!modes.includes(input.cleanupMode)) throw new Refusal(400, 'Mode should be Only show or Delete.');
    out.cleanupMode = input.cleanupMode;
  }
  if (Object.keys(out).length === 0) throw new Refusal(400, 'There is nothing to save.');
  return out;
}

// The lines the helper prints (cleanup-plan.mjs lines), tab separated: item, note, stop, result or error
export function parseLines(output) {
  const items = [];
  const notes = [];
  let stop = '';
  let result = '';
  let error = '';
  String(output || '').split('\n').forEach(line => {
    const parts = line.split('\t');
    if (parts[0] === 'item' && parts.length >= 5) items.push({ kind: parts[1].slice(0, 40), title: parts[2].slice(0, 80), expiredOn: parts[3].slice(0, 10), ageDays: Number(parts[4]) || 0 });
    else if (parts[0] === 'note' && parts[1]) notes.push(parts[1].slice(0, 300));
    else if (parts[0] === 'stop' && parts[1]) stop = parts[1].slice(0, 300);
    else if (parts[0] === 'result' && parts[1]) result = parts[1].slice(0, 300);
    else if (parts[0] === 'error' && parts[1]) error = parts[1].slice(0, 300);
  });
  return { items: items, notes: notes, stop: stop, result: result, error: error };
}
