// Which tasks a panel may draw, progress, milestones and how stale the data is (part of monday.js).

import { hasText } from './text.js';
import { plainDate } from './monday-tasks.js';

// The number of the day of a plain date, so that two dates can be subtracted. NaN for anything else.
export function dayNumber(date) {
  if (typeof date !== 'string' || !plainDate.test(date)) return NaN;

  const parts = date.split('-').map(Number);
  return Math.round(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
}

// The hours of a task as the progress counts them: a task with none counts as one hour
function hoursOf(task) {
  return typeof task.estHours === 'number' && isFinite(task.estHours) && task.estHours > 0 ? task.estHours : 1;
}

// { done, total, unestimated, percent }: the hours of the done tasks over all the hours. unestimated is how many tasks
// have no hours. percent is a whole number, 0 for no tasks.
export function progressHours(tasks) {
  let done = 0;
  let total = 0;
  let unestimated = 0;

  tasks.forEach(task => {
    const hours = hoursOf(task);
    total += hours;
    if (task.status === 'done') done += hours;
    if (!(typeof task.estHours === 'number' && task.estHours > 0)) unestimated += 1;
  });
  return { done: done, total: total, unestimated: unestimated, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

// What the Teletraan computer wrote for a milestone has the id milestone-monday-<id>, and a task lists the plain <id>
function milestoneKey(milestone) {
  return String(milestone.id || '').replace(/^milestone-monday-/, '');
}

function linkedTasks(milestone, tasks) {
  const key = milestoneKey(milestone);
  return tasks.filter(task => Array.isArray(task.milestoneIds) && (task.milestoneIds.includes(key) || task.milestoneIds.includes(milestone.id)));
}

// { percent, daysLeft, done, total } for a milestone: the hours-weighted progress of the tasks that name it
// and the days from today to its target date (negative when it has passed). A milestone with no tasks
// is 100 when it is done and 0 when it is not. today is a plain date.
export function milestoneProgress(milestone, tasks, today) {
  const linked = linkedTasks(milestone, tasks);
  const hours = progressHours(linked);
  const percent = linked.length === 0 ? (milestone.status === 'done' ? 100 : 0) : hours.percent;

  return { percent: percent, daysLeft: dayNumber(milestone.targetDate) - dayNumber(today), done: linked.filter(task => task.status === 'done').length, total: linked.length };
}

// The next milestones for a team (or all with no code): not done, by target date, the earliest first
export function nextMilestones(content, code, count = 3) {
  const list = Array.isArray(content && content.milestones) ? content.milestones : [];

  return list
    .filter(milestone => milestone.status !== 'done' && (code === null || code === undefined || !hasText(milestone.team) || milestone.team === code))
    .sort((first, second) => (first.targetDate < second.targetDate ? -1 : first.targetDate > second.targetDate ? 1 : 0))
    .slice(0, count);
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
