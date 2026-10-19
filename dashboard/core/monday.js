// The Monday status and the rules the other panels share about the board tasks. The board sync on the Teletraan computer
// (computer/scripts/monday-sync.sh, docs/monday.md) writes the tasks of the two boards into Sanity, with the source monday,
// and the document monday-status with the time of the last read and one count of open tasks a day. The two Monday panels
// work out what they draw in core/monday-views.js.

import { isVisible } from './content.js';
import { isFromBoard } from './task-source.js';
import { hasText, isRecord } from './text.js';

export const plainDate = /^\d{4}-\d{2}-\d{2}$/;
const mostSnapshots = 120;

// The monday-status document as the panels use it, or null when there is none: the time of the last read, the last error
// and the daily counts. A sample may say sample: true, which the panels then write in their header.
export function tidyMondayStatus(raw) {
  if (!isRecord(raw)) return null;

  const status = {
    lastSyncAt: typeof raw.lastSyncAt === 'string' && !isNaN(Date.parse(raw.lastSyncAt)) ? raw.lastSyncAt : '',
    lastError: typeof raw.lastError === 'string' ? raw.lastError.trim().slice(0, 300) : '',
    snapshots: tidySnapshots(raw.snapshots),
  };
  if (raw.sample === true) status.sample = true;
  return status;
}

// One count of open items for each day, oldest first. A day that comes twice keeps its last count, and a count that is not
// a number of items is left out.
function tidySnapshots(list) {
  const counts = {};

  (Array.isArray(list) ? list : []).forEach(raw => {
    if (!isRecord(raw) || typeof raw.date !== 'string' || !plainDate.test(raw.date)) return;
    if (typeof raw.open !== 'number' || !isFinite(raw.open) || raw.open < 0) return;

    counts[raw.date] = Math.round(raw.open);
  });
  return Object.keys(counts).sort().map(date => ({ date: date, open: counts[date] })).slice(-mostSnapshots);
}

// The board tasks the roster and Drive hours count (core/roster.js): from the board, switched on, shown on the board, and
// with a Team lead for their department (subteamId). A task the older sync marked with no department is never counted.
export function visibleTasks(content, now = new Date()) {
  return (Array.isArray(content && content.tasks) ? content.tasks : []).filter(task => {
    if (!isVisible(task, now) || !isFromBoard(task) || task.showOnBoard === false) return false;
    if (task.hiddenReason === 'unassigned' || task.isSubitem === true || hasText(task.parentId)) return false;

    return hasText(task.subteamId);
  });
}

// The tasks of a team. General (no team) counts for every team, and no code means everything.
export function forTeam(tasks, code) {
  if (code === null || code === undefined || code === '') return tasks.slice();
  return tasks.filter(task => !hasText(task.team) || task.team === code);
}

// The number of the day of a plain date, so that two dates can be subtracted. NaN for anything else.
export function dayNumber(date) {
  if (typeof date !== 'string' || !plainDate.test(date)) return NaN;

  const parts = date.split('-').map(Number);
  return Math.round(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
}


// How old the board read is

// How many minutes the Teletraan computer reads the boards apart. Dashboard Settings, Monday tab, 5 to 120, 30 when it is not set.
const defaultEveryMinutes = 30;

export function everyMinutesOf(content) {
  const value = content && content.settings ? content.settings.mondayEveryMinutes : undefined;
  return typeof value === 'number' && isFinite(value) ? Math.min(120, Math.max(5, Math.round(value))) : defaultEveryMinutes;
}

// Whole minutes since the Teletraan computer last read the boards, or null when that is not known
export function minutesSince(status, now) {
  const read = status && typeof status.lastSyncAt === 'string' ? Date.parse(status.lastSyncAt) : NaN;
  return isNaN(read) ? null : Math.max(0, Math.floor((now.getTime() - read) / 60000));
}

// True when the last read is older than twice the read interval, so a 30 minute setting is stale after an hour.
// It is also true while Sanity cannot be reached (markUnreachable), and for a board that has never been read.
// A sample is never stale.
export function stale(status, now, everyMinutes = defaultEveryMinutes) {
  if (status && status.sample === true) return false;
  if (!status || status.unreachable === true) return true;

  const minutes = minutesSince(status, now);
  return minutes === null || minutes > everyMinutes * 2;
}

// The words of the amber chip: STALE · 75 MIN, or STALE alone when the age is not known
export function staleWords(status, now) {
  const minutes = minutesSince(status, now);
  return minutes === null ? 'STALE' : 'STALE · ' + minutes + ' MIN';
}

// The content with its Monday status marked as read from the saved copy while Sanity cannot be reached. content.js
// uses it, so every Monday panel shows the chip at once.
export function markUnreachable(content) {
  const status = content && content.monday ? content.monday : { lastSyncAt: '', lastError: '', snapshots: [] };
  return Object.assign({}, content, { monday: Object.assign({}, status, { unreachable: true }) });
}
