// The Keys tab: what is shown of a key, how a form is checked, and how it is merged into local.env.
// The rules are those of tools/teletraan/merge-env.sh and the Mac tool's key menu, so the two ways in
// treat the file alike. Nothing here logs or returns a value except the merged file that goes to
// the helper.

import { Refusal } from './http.js';

export const keyNames = ['SANITY_WRITE_TOKEN', 'MONDAY_API_TOKEN', 'TBA_AUTH_KEY', 'GOOGLE_API_KEY', 'SANITY_AUTH_TOKEN'];

export const labels = {
  SANITY_WRITE_TOKEN: 'Sanity write key',
  MONDAY_API_TOKEN: 'Monday token',
  TBA_AUTH_KEY: 'The Blue Alliance key',
  GOOGLE_API_KEY: 'Google key for the photo folder',
  SANITY_AUTH_TOKEN: 'Sanity read key (optional)',
};

const keyPattern = /^[A-Za-z0-9_.-]+$/;
const linkPattern = /^[A-Za-z0-9._~:/?#@!&()*+,;=%-]+$/;
const calendarName = /^CALENDAR_[A-Za-z0-9_]+_URL$/;

// The first four characters then dots, for a value of 12 or more. Shorter values are all dots.
// Nothing, or the placeholder that starts with [, is not set.
export function mask(value) {
  const text = typeof value === 'string' ? value : '';
  if (text === '' || text.startsWith('[')) return 'not set';
  return text.length >= 12 ? text.slice(0, 4) + '........' : '........';
}

// "Build season" becomes BUILD_SEASON, the middle of CALENDAR_BUILD_SEASON_URL
export function calendarId(name) {
  return String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_/, '').replace(/_$/, '');
}

// The lowercase code Studio uses for CALENDAR_<ID>_URL
export function calendarCode(envName) {
  return envName.replace(/^CALENDAR_/, '').replace(/_URL$/, '').toLowerCase();
}

// The link to store, with webcal:// turned into https://. Throws a refusal that never holds the link.
function cleanLink(value) {
  let link = String(value || '').trim();
  if (link.startsWith('webcal://')) link = 'https://' + link.slice('webcal://'.length);
  if (link.startsWith('http://')) throw new Refusal(400, 'The link starts with http://, which is not secure. Use the https:// link.');
  if (!link.startsWith('https://')) throw new Refusal(400, 'A calendar link starts with https:// or webcal://.');
  if (!linkPattern.test(link)) throw new Refusal(400, 'The link has a space, a quote or another character a calendar link does not have.');
  return link;
}

function cleanKey(name, value) {
  const text = String(value || '').trim();
  if (!keyPattern.test(text)) throw new Refusal(400, 'A key has letters, digits, dots, dashes and underscores only, with nothing else on the line.');
  return text;
}

// The lines to merge, from the form. input is
//   keys       { NAME: { action: 'keep' | 'set' | 'clear', value } }
//   calendars  [{ name, action, value }]   name is the words of the calendar, or CALENDAR_<ID>_URL itself
// Returns { lines, changed } where lines are NAME='value' (empty for a clear) and changed are
// names with what was done, never values.
export function incomingLines(input) {
  const source = input && typeof input === 'object' ? input : {};
  const lines = [];
  const changed = [];

  Object.keys(source.keys || {}).forEach(name => {
    if (!keyNames.includes(name)) throw new Refusal(400, name + ' is not a key this page can change.');
    const row = source.keys[name] || {};
    if (row.action === 'set') {
      lines.push(name + "='" + cleanKey(name, row.value) + "'");
      changed.push({ name: name, did: 'set' });
    } else if (row.action === 'clear') {
      lines.push(name + "=''");
      changed.push({ name: name, did: 'cleared' });
    }
  });

  (Array.isArray(source.calendars) ? source.calendars : []).forEach(row => {
    if (!row || (row.action !== 'set' && row.action !== 'clear')) return;
    const wanted = String(row.name || '').trim();
    const envName = calendarName.test(wanted) ? wanted : 'CALENDAR_' + calendarId(wanted) + '_URL';
    if (!calendarName.test(envName) || envName === 'CALENDAR__URL') throw new Refusal(400, 'Give each calendar a name.');
    if (row.action === 'set') {
      lines.push(envName + "='" + cleanLink(row.value) + "'");
      changed.push({ name: envName, did: 'set' });
    } else {
      lines.push(envName + "=''");
      changed.push({ name: envName, did: 'cleared' });
    }
  });

  return { lines: lines, changed: changed };
}

function isEmptyValue(value) {
  return value === '' || value === "''" || value === '""';
}

// The same merge as tools/teletraan/merge-env.sh. A name in the new lines replaces the first place of
// that name in the file, repeats of it are dropped, an empty value takes the name out, a new name is
// added at the end, and every other line stays.
export function mergeEnv(existing, lines) {
  const wanted = new Map();
  const order = [];

  lines.forEach(line => {
    const at = line.indexOf('=');
    if (at < 1) return;
    const name = line.slice(0, at);
    if (!wanted.has(name)) order.push(name);
    wanted.set(name, { line: line, empty: isEmptyValue(line.slice(at + 1)) });
  });

  const written = new Set();
  const out = [];
  const old = String(existing || '').split('\n');
  if (old[old.length - 1] === '') old.pop();

  old.forEach(line => {
    const at = line.indexOf('=');
    const name = at > 0 ? line.slice(0, at) : '';
    if (name === '' || !wanted.has(name)) {
      out.push(line);
      return;
    }
    if (written.has(name)) return;
    written.add(name);
    if (!wanted.get(name).empty) out.push(wanted.get(name).line);
  });

  order.forEach(name => {
    if (!written.has(name) && !wanted.get(name).empty) out.push(wanted.get(name).line);
  });

  return out.join('\n') + '\n';
}
