// The Monday cards: the plain functions that pick and rank what the cards draw. They know nothing
// about the page, so tools/test-monday-cards.mjs can run them. The board sync on the Mini
// (docs/editing-content.md, "The Monday cards") writes the rows of the team board into Sanity as
// tasks with the source monday, and keeps one count of open items a day in the document
// monday-status. The cards are the panels monday-tasks, monday-milestones and monday-progress.
//
// A team has board rows when a task from the board shows on the TV for it. Only then does the look
// rotation give it a Monday pass (mondaySteps below, which mondayCards in core/look-rotation.js
// calls), and the pass is these three cards one after the other, one page of the tasks card for
// each Team lead entry that has tasks.

import { visibleItems } from './content.js';
import { isFromBoard } from './task-source.js';
import { hasText } from './text.js';

const plainDate = /^\d{4}-\d{2}-\d{2}$/;

// Rows per card is not a Studio field: each column of the tasks card holds two cards
export const cardsPerColumn = 2;
export const mostSnapshots = 120;

// The three columns of the tasks card and the task status each one holds. A blocked task has no column.
export const columns = [
  { id: 'backlog', label: 'BACKLOG', status: 'up-next' },
  { id: 'progress', label: 'IN PROGRESS', status: 'in-progress' },
  { id: 'done', label: 'DONE', status: 'done' },
];

// Most urgent first. A task with no priority, or one that is not in the list, comes after all of them.
export const priorities = ['high', 'medium', 'low'];
export const priorityText = { high: 'HIGH', medium: 'MED', low: 'LOW' };

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// The monday-status document as the cards use it, or null when there is none. The Mini writes more
// into it (the boards and their columns for the Studio): only the sync time and the daily counts are
// kept. A sample may say sample: true, which the cards then write in their header.
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

// One count of open items for each day, oldest first. A day that comes twice keeps its last count, and
// a count that is not a number of items is left out.
function tidySnapshots(list) {
  const counts = {};

  (Array.isArray(list) ? list : []).forEach(raw => {
    if (!isRecord(raw) || typeof raw.date !== 'string' || !plainDate.test(raw.date)) return;
    if (typeof raw.open !== 'number' || !isFinite(raw.open) || raw.open < 0) return;

    counts[raw.date] = Math.round(raw.open);
  });
  return Object.keys(counts).sort().map(date => ({ date: date, open: counts[date] })).slice(-mostSnapshots);
}


// Which tasks and which leads

// A task and a Team lead entry are matched by name, without regard to capitals, as the board sync matches them
function leadKey(name) {
  return String(name).trim().toLowerCase();
}

// The tasks that show on the TV for a team: switched on, not expired, and for the team or for both. The
// team on the screen when teamCode is left out. A pinned task is in with the ones from the board.
export function tasksFor(content, now = new Date(), teamCode) {
  return visibleItems(content && content.tasks, now, teamCode);
}

// The ones of those that come from the team board
export function boardTasksFor(content, now = new Date(), teamCode) {
  return tasksFor(content, now, teamCode).filter(isFromBoard);
}

// The Team lead entries that show for a team, in the order of the Team leads list. An entry whose name
// is the same as an earlier one, apart from capitals, is left out, so no task is on two cards.
export function leadEntries(content, now = new Date(), teamCode) {
  const seen = [];

  return visibleItems(content && content.subteams, now, teamCode).filter(entry => {
    const key = hasText(entry.name) ? leadKey(entry.name) : '';
    if (key === '' || seen.indexOf(key) !== -1) return false;

    seen.push(key);
    return true;
  });
}

// The tasks of each lead entry, as { name, tasks }, in the order of the entries. An entry with no tasks
// has no group, and a task with no subteam, or one that no entry has, is in none.
export function groupByLead(tasks, entries) {
  return entries
    .map(entry => ({ name: entry.name.trim(), tasks: tasks.filter(task => hasText(task.subteam) && leadKey(task.subteam) === leadKey(entry.name)) }))
    .filter(group => group.tasks.length > 0);
}


// Ranking

function priorityRank(task) {
  const rank = priorities.indexOf(task.priority);
  return rank === -1 ? priorities.length : rank;
}

// The due date of a task as a plain date, or '' when it has none or it cannot be read
export function dueDateOf(task) {
  return typeof task.dueDate === 'string' && plainDate.test(task.dueDate) ? task.dueDate : '';
}

function compare(first, second) {
  // pinned tasks first, then the ones from the board
  const board = Number(isFromBoard(first.task)) - Number(isFromBoard(second.task));
  if (board !== 0) return board;

  const priority = priorityRank(first.task) - priorityRank(second.task);
  if (priority !== 0) return priority;

  // the earliest due date first, and a task with none after the ones that have one
  const firstDue = dueDateOf(first.task);
  const secondDue = dueDateOf(second.task);
  if (firstDue !== secondDue) return firstDue === '' ? 1 : secondDue === '' ? -1 : firstDue < secondDue ? -1 : 1;

  return first.position - second.position;
}

// Pinned tasks first, then priority (high, medium, low, none), then the earliest due date. Tasks that
// are the same in all three stay in the order they came. The list given is not changed.
export function rankTasks(tasks) {
  return tasks
    .map((task, position) => ({ task: task, position: position }))
    .sort(compare)
    .map(entry => entry.task);
}

// The earliest due date first, for the tasks that have one. Tasks with the same date are in the order
// rankTasks gives them, so the pinned ones and the high priority ones come first.
export function dueSoonestFirst(tasks) {
  return rankTasks(tasks)
    .map((task, position) => ({ task: task, position: position }))
    .sort((first, second) => {
      const firstDue = dueDateOf(first.task);
      const secondDue = dueDateOf(second.task);
      return firstDue === secondDue ? first.position - second.position : firstDue < secondDue ? -1 : 1;
    })
    .map(entry => entry.task);
}

// The three columns of one lead, as { id, label, status, shown, total }. shown is the tasks the column
// has room for, ranked, and total is how many the status has in all.
export function columnsOf(tasks) {
  const ranked = rankTasks(tasks);

  return columns.map(column => {
    const inColumn = ranked.filter(task => task.status === column.status);
    return { id: column.id, label: column.label, status: column.status, shown: inColumn.slice(0, cardsPerColumn), total: inColumn.length };
  });
}


// The Monday pass of the look rotation

// The steps of the large panel's list while a team's Monday pass is up: one page of the tasks card for
// each lead entry that has tasks, then the milestones card and the progress card. A team with no
// board tasks has none, and then it has no Monday pass. teamCode is the team of the pass.
export function mondaySteps(content, teamCode, now = new Date()) {
  if (!isRecord(content) || boardTasksFor(content, now, teamCode).length === 0) return [];

  const pages = groupByLead(tasksFor(content, now, teamCode), leadEntries(content, now, teamCode)).length;
  const steps = [];
  for (let page = 1; page <= pages; page++) steps.push({ panel: 'monday-tasks', show: true, page: page });

  return steps.concat({ panel: 'monday-milestones', show: true }, { panel: 'monday-progress', show: true });
}
