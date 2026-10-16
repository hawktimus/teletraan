// Tidying the Monday status, and picking, ranking and paging the tasks of a panel (part of monday.js).

import { isVisible, visibleItems } from './content.js';
import { isFromBoard } from './task-source.js';
import { hasText, isRecord } from './text.js';

export const plainDate = /^\d{4}-\d{2}-\d{2}$/;

// None of these is a Studio field. The tasks card shows at most ten rows, five at a time, and in this mix:
// two done, three in the backlog and the rest in progress. A status with fewer than its share leaves its
// slots to the others.
export const mostRows = 10;
export const rowsPerPage = 5;
export const shares = { done: 2, backlog: 3 };
const mostSnapshots = 120;

// The three statuses a card shows and the task status each one holds. A blocked task is not one of them.
export const statuses = [
  { id: 'backlog', label: 'BACKLOG', status: 'up-next' },
  { id: 'progress', label: 'IN PROGRESS', status: 'in-progress' },
  { id: 'done', label: 'DONE', status: 'done' },
];

// Most urgent first. A task with no priority, or one that is not in the list, comes after all of them.
export const priorities = ['high', 'medium', 'low'];

// The monday-status document as the cards use it, or null when there is none. The Teletraan computer writes more
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
// team on the screen when teamCode is left out.
export function tasksFor(content, now = new Date(), teamCode) {
  return visibleItems(content && content.tasks, now, teamCode);
}

// The ones of those that come from the team board. Every Monday card counts these and nothing else, so
// the cards always agree on how many rows there are.
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

// The groups of a team's board tasks, one for each lead entry that has some. This is what the tasks card
// and the progress card both count.
export function groupsFor(content, now = new Date(), teamCode) {
  return groupByLead(boardTasksFor(content, now, teamCode), leadEntries(content, now, teamCode));
}


// Ranking

export function plainDateOf(task, name) {
  return typeof task[name] === 'string' && plainDate.test(task[name]) ? task[name] : '';
}

function byDate(first, second, name, descending) {
  const a = plainDateOf(first, name);
  const b = plainDateOf(second, name);
  if (a === b) return 0;
  if (a === '') return 1;
  if (b === '') return -1;
  return (a < b ? -1 : 1) * (descending ? -1 : 1);
}

function group(task) {
  if (task.status === 'done') return 3;
  if (task.status === 'up-next') return 2;
  return task.status === 'blocked' ? 0 : 1;
}

// In progress, in review and stuck first (stuck first of them), then To Do by priority (high, medium,
// low, none) and then by the start of the Timeline, and Done last, the one finished last first. Tasks that
// are the same in all of it stay in the order they came.
export function rank(tasks) {
  return tasks
    .map((task, position) => ({ task: task, position: position }))
    .sort((first, second) => {
      const a = first.task;
      const b = second.task;
      if (group(a) !== group(b)) return group(a) - group(b);
      if (group(a) === 3) return byDate(a, b, 'completedOn', true) || first.position - second.position;

      return priorityRank(a) - priorityRank(b) || byDate(a, b, 'startDate', false) || first.position - second.position;
    })
    .map(entry => entry.task);
}

function priorityRank(task) {
  const rank = priorities.indexOf(task.priority);
  return rank === -1 ? priorities.length : rank;
}

// The due date of a task as a plain date, or '' when it has none or it cannot be read
export function dueDateOf(task) {
  return typeof task.dueDate === 'string' && plainDate.test(task.dueDate) ? task.dueDate : '';
}

function compare(first, second) {
  const priority = priorityRank(first.task) - priorityRank(second.task);
  if (priority !== 0) return priority;

  // the earliest due date first, and a task with none after the ones that have one
  const firstDue = dueDateOf(first.task);
  const secondDue = dueDateOf(second.task);
  if (firstDue !== secondDue) return firstDue === '' ? 1 : secondDue === '' ? -1 : firstDue < secondDue ? -1 : 1;

  const firstTitle = String(first.task.title || '').toLowerCase();
  const secondTitle = String(second.task.title || '').toLowerCase();
  if (firstTitle !== secondTitle) return firstTitle < secondTitle ? -1 : 1;

  return first.position - second.position;
}

// Priority (high, medium, low, none), then the earliest due date, then the title. Tasks that are the same
// in all three stay in the order they came. The list given is not changed.
export function rankTasks(tasks) {
  return tasks
    .map((task, position) => ({ task: task, position: position }))
    .sort(compare)
    .map(entry => entry.task);
}

// The earliest due date first, for the tasks that have one. Tasks with the same date are in the order
// rankTasks gives them, so the high priority ones come first.
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

// The rows of one lead's card: at most mostRows tasks, ranked, in the mix of shares. Each status takes up
// to its share, and the slots a status leaves empty go to the others, in progress first, then the backlog,
// then done. A blocked task has no row.
export function pickRows(tasks) {
  const ranked = rankTasks(tasks);
  const withStatus = status => ranked.filter(task => task.status === status);
  const done = withStatus('done');
  const backlog = withStatus('up-next');
  const progress = withStatus('in-progress');

  const chosen = [].concat(
    done.slice(0, shares.done),
    backlog.slice(0, shares.backlog),
    progress.slice(0, mostRows - shares.done - shares.backlog),
  );
  const rest = [].concat(progress, backlog, done).filter(task => chosen.indexOf(task) === -1);

  return rankTasks(chosen.concat(rest.slice(0, mostRows - chosen.length)));
}

// How many pages a card of this many rows has: it scrolls up by rowsPerPage rows, so 1 for five rows or fewer
export function pagesOf(rows) {
  return Math.max(1, Math.ceil(rows / rowsPerPage));
}


// The cards of both teams

// The rows of the both-teams cards: one for each lead entry and each team that has board tasks for it, as
// { team, lead, tasks }. The entries are in the order of the Team leads list, and under each one the teams
// are in the order given, so the rows alternate between the teams. teams is a list of { code, ... }.
// An entry whose tasks all have no team, because their boards have none, is one row with no team (null):
// it is not the row of either team.
export function bothRows(content, teams, now = new Date()) {
  const order = [];
  const groups = teams.map(team => ({ team: team, groups: groupsFor(content, now, team.code) }));

  groups.forEach(entry => entry.groups.forEach(group => {
    if (order.indexOf(leadKey(group.name)) === -1) order.push(leadKey(group.name));
  }));
  const place = key => {
    const found = (content && Array.isArray(content.subteams) ? content.subteams : []).findIndex(entry => hasText(entry.name) && leadKey(entry.name) === key);
    return found === -1 ? Number.MAX_SAFE_INTEGER : found;
  };
  order.sort((first, second) => place(first) - place(second));

  const rows = [];
  order.forEach(key => {
    const found = groups
      .map(entry => ({ team: entry.team, group: entry.groups.find(item => leadKey(item.name) === key) }))
      .filter(entry => entry.group);

    if (found.every(entry => entry.group.tasks.every(task => !hasText(task.team)))) {
      rows.push({ team: null, lead: found[0].group.name, tasks: found[0].group.tasks });
    } else {
      found.forEach(entry => rows.push({ team: entry.team, lead: entry.group.name, tasks: entry.group.tasks }));
    }
  });
  return rows;
}


// The steps of the Monday rows

// The steps of the Monday cards of a team: one page of the tasks card for each lead entry that has tasks,
// then the milestones card and the progress card. A team with no board tasks has none, and then its Monday
// rows are left out. teamCode is the team of the rows.
export function mondaySteps(content, teamCode, now = new Date()) {
  if (!isRecord(content) || boardTasksFor(content, now, teamCode).length === 0) return [];

  const pages = groupsFor(content, now, teamCode).length;
  const steps = [];
  for (let page = 1; page <= pages; page++) steps.push({ panel: 'monday-tasks', show: true, page: page });

  return steps.concat({ panel: 'monday-milestones', show: true }, { panel: 'monday-progress', show: true });
}

// The steps of the cards of both teams: the milestones and the progress of both teams together. codes are
// the teams that are switched on. There are steps only when two or more of them have board tasks, because
// one team alone has its own cards.
export function bothSteps(content, codes, now = new Date()) {
  if (!isRecord(content) || !Array.isArray(codes)) return [];

  const withRows = codes.filter(code => boardTasksFor(content, now, code).length > 0);
  if (withRows.length < 2) return [];
  return [{ panel: 'monday-milestones-both', show: true }, { panel: 'monday-progress-both', show: true }];
}


// The rules of the Monday panels (docs/monday.md)
//
// The Teletraan computer writes the one task board into Sanity (computer/scripts/monday-sync.sh) and every Monday panel
// asks these functions, so the panels agree on which task is where. A task is a document with a status
// (up-next, in-progress, in-review, blocked or done), a team code or none (General), the id of its Team
// lead (subteamId, the department), a priority, dates as plain dates (startDate, dueDate, completedOn),
// estHours, milestoneIds and a showOnBoard switch that comes from the board. showOnTv is the editors'
// switch. None of these functions changes what it is given.

// The words and the order of the five statuses wherever a panel writes them
export const statusWords = { 'up-next': 'TO DO', 'in-progress': 'IN PROGRESS', 'in-review': 'IN REVIEW', blocked: 'STUCK', done: 'DONE' };

// The tasks a Monday panel may draw, whatever team is on the screen (forTeam says the team): from the board, switched on in Studio (show, showOnTv and the expiry)
// and on the board (Show on TV is Show), with a department, and not a subitem. A task the Teletraan computer wrote
// before the board had Show on TV has no showOnBoard, and counts as shown. A task with no department
// (Unassigned is written hidden, with hiddenReason unassigned) never renders.
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

// The tasks of a department, which is a Team lead entry given by its id
export function forDepartment(tasks, subteamId) {
  return tasks.filter(task => hasText(subteamId) && task.subteamId === subteamId);
}

// today is a plain date in the time zone of the Look page (todayOf in core/competition.js)
export function overdue(task, today) {
  return dueDateOf(task) !== '' && dueDateOf(task) < today && task.status !== 'done';
}
