// How fresh the sources of the sync service are (computer/scripts/sync-service.mjs). The service writes
// data/live/sync-status.json every 10 seconds:
//   { generatedAt, sources: { sanity, weather, images, monday, competition, calendars: { lastSuccessAt, lastFailureAt, lastFailureReason } } }
// The first half of this file is plain functions that take values and give values back, so tests can try them. The second half
// reads the file and keeps the newest answer. The status pill (core/sync-pill.js) and the Sanity dot (core/dots-run.js) draw from it.
//
// Nothing here ever shows an error. A file that cannot be read keeps the last answer, whose age then grows by itself.

import { liveFolder } from '../config.js';
import { syncCheckSeconds, syncDownMinutes, syncSourceMinutes, syncStaleMinutes } from './constants.js';

export const syncStatusFile = liveFolder + 'sync-status.json';
export const sourceNames = ['sanity', 'weather', 'images', 'monday', 'competition', 'calendars'];

function toMs(text) {
  const time = typeof text === 'string' ? Date.parse(text) : NaN;
  return isNaN(time) ? null : time;
}

// The file cleaned: every time in milliseconds or null, every source present. null when it is not the file.
export function parseSyncStatus(raw) {
  if (!raw || typeof raw !== 'object' || !raw.sources || typeof raw.sources !== 'object') return null;

  const sources = {};
  sourceNames.forEach(name => {
    const source = raw.sources[name] && typeof raw.sources[name] === 'object' ? raw.sources[name] : {};
    sources[name] = { success: toMs(source.lastSuccessAt), failure: toMs(source.lastFailureAt) };
  });
  return { generatedAt: toMs(raw.generatedAt), sources: sources };
}

// How old a source may be before it counts as late (amber) and as down (red), in minutes. A slow source (the calendars
// every 15 minutes, Monday every 30 or more) is late after twice its own gap, so it is not late just for being slow.
export function limitsOf(name, mondayMinutes) {
  const every = name === 'monday' ? (mondayMinutes || syncSourceMinutes.monday) : syncSourceMinutes[name];
  return { late: Math.max(syncStaleMinutes, 2 * every), down: Math.max(syncDownMinutes, 3 * every) };
}

const minutes = ms => ms / 60000;

// What the pill says: { state: 'ok' | 'late' | 'down', since: Date or null }.
//   ok     everything is fresh, or there is nothing to say: no status file yet means the sync service is not on
//          this computer (a laptop), and the pill stays hidden
//   late   a source has not had a good read for longer than its limit (10 minutes at least), or the status file itself
//          is older than 10 minutes, which counts as every source late
//   down   every source in use is late by its down limit (30 minutes at least)
// since is when the oldest late source last had a good read. A source that never had a good read and never failed is not in
// use (the competition feed in the off season), and does not count.
export function pillState(status, now, mondayMinutes) {
  if (!status) return { state: 'ok', since: null };

  const nowMs = now.getTime();
  const fileAge = status.generatedAt === null ? Infinity : minutes(nowMs - status.generatedAt);
  const fileStale = fileAge > syncStaleMinutes;

  const used = sourceNames.filter(name => status.sources[name].success !== null || status.sources[name].failure !== null);
  const ages = {};
  used.forEach(name => {
    const success = status.sources[name].success;
    ages[name] = success === null ? Infinity : minutes(nowMs - success);
  });

  const late = used.filter(name => fileStale || ages[name] > limitsOf(name, mondayMinutes).late);
  if (late.length === 0 && !fileStale) return { state: 'ok', since: null };

  const allDown = fileStale ? fileAge > syncDownMinutes : used.length > 0 && used.every(name => ages[name] > limitsOf(name, mondayMinutes).down);
  const times = late.map(name => status.sources[name].success).filter(time => time !== null);
  const sinceMs = times.length > 0 ? Math.min(...times) : status.generatedAt;

  return { state: allDown ? 'down' : 'late', since: sinceMs === null ? null : new Date(sinceMs) };
}

// ----- reading the file -----

let latest = null; // the newest cleaned answer, kept when a later read fails
let timer = null;
const listeners = [];

export function currentSyncStatus() {
  return latest;
}

// When the content was last read well from Sanity, as a Date, or null while that is not known
export function sanityReadTime() {
  return latest && latest.sources.sanity.success !== null ? new Date(latest.sources.sanity.success) : null;
}

async function readFile() {
  try {
    const response = await fetch(syncStatusFile, { cache: 'no-store' });
    if (response.ok) {
      const parsed = parseSyncStatus(await response.json());
      if (parsed) latest = parsed;
    }
  } catch (error) {
    console.error('Could not read the sync status, keeping the last answer', error);
  }
  listeners.forEach(listener => {
    try {
      listener(latest);
    } catch (error) {
      console.error('The sync status could not be used', error);
    }
  });
}

// onChange(status) is called after every read, with the newest cleaned answer or null. One timer serves every caller.
export function watchSyncStatus(onChange) {
  listeners.push(onChange);
  if (timer === null) {
    readFile();
    timer = setInterval(readFile, syncCheckSeconds * 1000);
  } else {
    onChange(latest);
  }
}
