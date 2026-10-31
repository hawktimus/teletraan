// The technical text of every action the page ran, kept in this browser so the Details area can show it. This is the only
// place raw output is shown. It holds the last 40 entries, each cut to 4000 characters, and nothing secret: the answers of
// the control service have keys and links taken out already (lib/redact.js).

import { recallJson, remember } from './dom.js';

const keep = 40;
const longest = 4000;
let entries = null;
const listeners = [];

function load() {
  if (entries === null) entries = Array.isArray(recallJson('output', [])) ? recallJson('output', []) : [];
  return entries;
}

export function outputEntries() {
  return load().slice();
}

// entry: { id, label, ok, raw }. The time is added here.
export function recordOutput(entry) {
  const list = load();
  list.unshift({ id: entry.id, label: entry.label, ok: Boolean(entry.ok), at: new Date().toISOString(), raw: String(entry.raw || '').slice(0, longest) });
  list.length = Math.min(list.length, keep);
  remember('output', list);
  listeners.forEach(listener => listener());
}

export function onOutput(listener) {
  listeners.push(listener);
  return () => { const at = listeners.indexOf(listener); if (at >= 0) listeners.splice(at, 1); };
}

export function clearOutput() {
  entries = [];
  remember('output', null);
  listeners.forEach(listener => listener());
}
