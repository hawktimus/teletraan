// Running the syncs from the page. Sync everything calls the helper for each source in the order of control/support/sync-all.js,
// one after another, and a source that fails never stops the ones after it. Each source ends as Ran, Failed or Skipped,
// with a plain sentence, and the result is kept in this browser so a card still shows it after you leave and come back.
// The service also has POST sync-all for the tools; the page asks per source so every call has its own 60 seconds and the
// cards can show which source is running.

import { api } from './tabs/api.js';
import { syncs, readOff, saveOff } from './tabs/settings-sync.js';
import { recallJson } from './dom.js';
import { classify, doneWords, failedWords, nameOf, plainReason } from './words.js';
import { recordOutput } from './output-log.js';
import { saveResult, timing } from './action-run.js';

export const sources = syncs.map(item => ({ target: item.target, name: item.name, label: item.label }));

export const progress = { running: false, current: '', results: {} };
const listeners = new Set();

export function onSyncProgress(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function tell() {
  listeners.forEach(listener => listener(progress));
}

export function offList() {
  try { return readOff(window.localStorage); } catch (error) { return []; }
}

export function setIncluded(target, included) {
  const off = offList().filter(item => item !== target);
  if (!included) off.push(target);
  try { saveOff(window.localStorage, off); } catch (error) { /* no storage */ }
}

export function isIncluded(target) {
  return !offList().includes(target);
}

// The last result of a source: { state: done | bad | skipped, words, at }, or null
export function lastSync(target) {
  const found = recallJson('last.sync-' + target, null);
  return found && found.state ? found : null;
}

// A result is kept the way actionButton keeps one, so a card and a button read the same entry
function keep(target, outcome) {
  const state = outcome.state === 'ok' ? 'done' : outcome.state;
  saveResult('sync-' + target, state, outcome.words, 'Sync ' + nameOf(target));
  recordOutput({ id: 'sync-' + target, label: 'Sync ' + nameOf(target), ok: outcome.state !== 'bad', raw: outcome.raw === undefined ? outcome.words : outcome.raw });
}

// One source. Gives { state: ok | bad | skipped, reason, words, raw }. Nothing is kept: the caller keeps it (keep above for
// Sync everything, actionButton for a card's own button).
export async function runSyncOne(target) {
  const label = nameOf(target);
  progress.current = target;
  tell();
  const controller = new AbortController();
  const hard = setTimeout(() => controller.abort(), timing.hardMs);
  const result = await api('POST', '/helper/sync-now', { target: target }, controller.signal);
  clearTimeout(hard);
  progress.current = '';
  let outcome;
  if (result.ok) {
    outcome = { state: 'ok', reason: '', words: doneWords(new Date()), raw: String((result.data && result.data.output) || '') };
  } else if (result.aborted) {
    outcome = { state: 'bad', reason: label + ' took too long and was stopped.', raw: result.error };
  } else if (classify(result.error) === 'notInstalled') {
    outcome = { state: 'skipped', reason: label + " isn't set up on this computer, so it was skipped.", raw: result.error };
  } else {
    outcome = { state: 'bad', reason: plainReason(result.error), raw: result.error };
  }
  if (!outcome.words) outcome.words = outcome.state === 'bad' ? failedWords(outcome.reason) : outcome.reason;
  progress.results[target] = outcome;
  tell();
  return outcome;
}

// Every source that is not switched off for Sync all. Gives { ran, skipped, failed, words }.
export async function runSyncAll() {
  progress.running = true;
  progress.results = {};
  tell();
  const off = offList();
  const total = { ran: 0, skipped: 0, failed: 0 };
  for (const item of sources) {
    if (off.includes(item.target)) {
      progress.results[item.target] = { state: 'skipped', reason: 'Switched off for Sync all.', words: 'Switched off for Sync all.' };
      keep(item.target, progress.results[item.target]);
      total.skipped += 1;
      tell();
      continue;
    }
    const outcome = await runSyncOne(item.target);
    keep(item.target, outcome);
    if (outcome.state === 'ok') total.ran += 1;
    else if (outcome.state === 'skipped') total.skipped += 1;
    else total.failed += 1;
  }
  progress.running = false;
  tell();
  const parts = [total.ran + ' ran'];
  if (total.skipped) parts.push(total.skipped + ' skipped');
  if (total.failed) parts.push(total.failed + ' failed');
  return Object.assign(total, { words: parts.join(', ') + '.' });
}

// The run function of the Sync everything button, for actionButton: failed when any source failed
export async function syncEverythingRun() {
  const total = await runSyncAll();
  return { ok: total.failed === 0, words: total.failed === 0 ? total.words : total.failed + ' of ' + (total.ran + total.skipped + total.failed) + ' did not finish. ' + total.words, raw: Object.keys(progress.results).map(key => key + ': ' + progress.results[key].words).join('\n') };
}
