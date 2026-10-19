// What the two Monday panels draw, worked out with no markup, so tests/monday-panels.test.mjs can run it with node:
// Department tasks (panels/monday-department) and the TV charts (panels/monday-charts). A view is null when the panel has
// nothing to show, and the rotation leaves the row out then (stepsOfRow in core/screens-plan.js).
//
// The tasks are the documents the board sync writes (computer/scripts/monday-sync.sh, docs/monday.md). Each has a
// department (one of the nine), a list (open or done), a status (up-next, in-progress, in-review, blocked or done), a team
// code or none (General), a contact first name, a priority, dueDate (the estimated completion date), startDate, completedOn
// and estHours. The page a panel is given is what its row says: { team, department, list, chart }, where team is prime,
// nova, or '' for both teams.

import { mondayDepartments } from '../config.js';
import { todayOf } from './competition.js';
import { isVisible } from './content.js';
import { dayNumber } from './monday.js';
import { isFromBoard } from './task-source.js';
import { teamNameOf } from './team-title.js';
import { hasText, isRecord } from './text.js';

// Four rows are in view at a time, and a list stops at 20 rows: five pages of four
export const rowsPerPage = 4;
export const mostRows = 20;

// The order of the open list, and the words of each status
export const openOrder = ['in-progress', 'in-review', 'blocked', 'up-next'];
export const statusWords = { 'up-next': 'TO DO', 'in-progress': 'IN PROGRESS', 'in-review': 'IN REVIEW', blocked: 'STUCK', done: 'DONE' };
const priorityWords = { high: 'High', medium: 'Medium', low: 'Low' };

// What a row says for a value the board does not have
export const emptyWords = { contact: 'Unassigned', priority: 'No Priority', date: 'No Date' };

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const plainDate = /^\d{4}-\d{2}-\d{2}$/;

// A plain date as it reads on the panel, Oct 17. Nothing for a date that is not one.
export function dateWords(date) {
  if (typeof date !== 'string' || !plainDate.test(date)) return '';
  return months[Number(date.slice(5, 7)) - 1] + ' ' + Number(date.slice(8, 10));
}

export function departmentTitle(value) {
  const found = mondayDepartments.find(entry => entry.value === value);
  return found ? found.title : '';
}

// The words for the team a row names: the short name of its Team document, or nothing for both teams
function teamWords(content, code) {
  if (code === '') return '';
  const found = (Array.isArray(content && content.teams) ? content.teams : []).find(team => team && team.code === code);
  return found ? teamNameOf(found) : code.toUpperCase();
}

function pageOptions(page) {
  const source = isRecord(page) ? page : {};
  return {
    team: source.team === 'prime' || source.team === 'nova' ? source.team : '',
    department: mondayDepartments.some(entry => entry.value === source.department) ? source.department : '',
    list: source.list === 'done' ? 'done' : 'open',
    chart: source.chart === 'progress' || source.chart === 'timeline' ? source.chart : 'status',
  };
}

// The tasks the Monday panels may draw: from the board, switched on in the Studio (show, Show on TV and the expiry), shown on
// the board (Show on TV? is not Hide) and with one of the nine departments
export function boardTasks(content, now = new Date()) {
  return (Array.isArray(content && content.tasks) ? content.tasks : []).filter(task =>
    isRecord(task) && isVisible(task, now) && isFromBoard(task) && task.showOnBoard !== false && departmentTitle(task.department) !== '');
}

// The tasks of a team: General (no team) counts for both teams, and no team means every task
export function ofTeam(tasks, team) {
  return team === '' ? tasks.slice() : tasks.filter(task => !hasText(task.team) || task.team === team);
}

// The list a task is in. A task the older sync wrote has no list, and its status says it.
export function listOf(task) {
  if (task.list === 'open' || task.list === 'done') return task.list;
  return task.status === 'done' ? 'done' : 'open';
}

function dateOf(task, name) {
  return typeof task[name] === 'string' && plainDate.test(task[name]) ? task[name] : '';
}

// Two plain dates, earliest first or newest first, and a task with no date after the ones that have one
function byDate(a, b, newestFirst) {
  if (a === b) return 0;
  if (a === '') return 1;
  if (b === '') return -1;
  return (a < b ? -1 : 1) * (newestFirst ? -1 : 1);
}

function byTitle(a, b) {
  const first = String(a.title || '').toLowerCase();
  const second = String(b.title || '').toLowerCase();
  return first === second ? 0 : first < second ? -1 : 1;
}

function openRank(task) {
  const at = openOrder.indexOf(task.status);
  return at === -1 ? openOrder.length - 1 : at;
}

// Open: In Progress, In Review, Stuck, To Do, and in each the earliest estimated completion date first. Done: the newest
// date completed first. The list given is not changed.
export function sortTasks(tasks, list) {
  return tasks.slice().sort((a, b) => (list === 'done'
    ? byDate(dateOf(a, 'completedOn'), dateOf(b, 'completedOn'), true) || byTitle(a, b)
    : openRank(a) - openRank(b) || byDate(dateOf(a, 'dueDate'), dateOf(b, 'dueDate'), false) || byTitle(a, b)));
}

// The status a row shows: a task of the open list is never DONE (it sits in the open list only while it is not done), and
// one of the done list always is
function shownStatus(task, list) {
  if (list === 'done') return 'done';
  return openOrder.includes(task.status) ? task.status : 'up-next';
}


// Department tasks

// { title, team, rows, pages, counts } for a page, or null when the department has nothing in the list. A row is
// { status, statusWord, project, contact, priority, date }, every value a word: an empty one reads Unassigned, No Priority or
// No Date. counts are the open and done tasks of the department for the team.
export function departmentView(content, now, page) {
  const options = pageOptions(page);
  if (options.department === '') return null;

  const own = ofTeam(boardTasks(content, now), options.team).filter(task => task.department === options.department);
  const listed = sortTasks(own.filter(task => listOf(task) === options.list), options.list);
  if (listed.length === 0) return null;

  const rows = listed.slice(0, mostRows).map(task => {
    const status = shownStatus(task, options.list);
    return {
      status: status,
      statusWord: statusWords[status],
      project: String(task.title || '').trim(),
      contact: hasText(task.contact) ? String(task.contact).trim().split(/\s+/)[0] : emptyWords.contact,
      priority: priorityWords[task.priority] || emptyWords.priority,
      priorityLevel: priorityWords[task.priority] ? task.priority : 'none',
      date: dateWords(dateOf(task, 'dueDate')) || emptyWords.date,
    };
  });

  const name = departmentTitle(options.department).toUpperCase();
  return {
    title: name + (options.list === 'done' ? ' DONE' : ' TASKS'),
    team: teamWords(content, options.team),
    rows: rows,
    more: listed.length - rows.length,
    pages: Math.max(1, Math.ceil(rows.length / rowsPerPage)),
    counts: { open: own.filter(task => listOf(task) === 'open').length, done: own.filter(task => listOf(task) === 'done').length },
  };
}


// The TV charts

// The three parts of a bar of the status chart. In review and stuck are counted with in progress.
function partOf(task) {
  if (listOf(task) === 'done') return 'done';
  return task.status === 'up-next' ? 'todo' : 'progress';
}

// Status by department: one row for each department with tasks, in the order of the nine, with the counts of Done, In
// Progress and To Do. longest is the most tasks of any row, which the bars are drawn against.
export function statusChart(tasks) {
  const rows = mondayDepartments.map(entry => {
    const own = tasks.filter(task => task.department === entry.value);
    const counts = { done: 0, progress: 0, todo: 0 };
    own.forEach(task => { counts[partOf(task)] += 1; });
    return { name: entry.title.toUpperCase(), done: counts.done, progress: counts.progress, todo: counts.todo, total: own.length };
  }).filter(row => row.total > 0);

  return rows.length === 0 ? null : { chart: 'status', rows: rows, longest: Math.max(...rows.map(row => row.total)) };
}

function hoursOf(task) {
  return typeof task.estHours === 'number' && isFinite(task.estHours) && task.estHours > 0 ? task.estHours : 0;
}

// Overall progress: the estimated hours of the done tasks over the hours of every task. When no task has hours it is the
// done tasks over every task. { percent, done, total, unit, tasks: { done, open } }
export function progressChart(tasks) {
  if (tasks.length === 0) return null;

  const done = tasks.filter(task => listOf(task) === 'done');
  const allHours = tasks.reduce((sum, task) => sum + hoursOf(task), 0);
  const byHours = allHours > 0;
  const part = byHours ? done.reduce((sum, task) => sum + hoursOf(task), 0) : done.length;
  const whole = byHours ? allHours : tasks.length;

  return {
    chart: 'progress',
    percent: Math.round(part / whole * 100),
    done: Math.round(part),
    total: Math.round(whole),
    unit: byHours ? 'HOURS' : 'TASKS',
    tasks: { done: done.length, open: tasks.length - done.length },
  };
}

// The first day of a month, as a plain date, months after the month of a plain date
function monthStart(date, months) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + months;
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

// How many departments the timeline has room for, and the lanes a department's bars are put in
export const timelineRowsMost = 7;
const lanesMost = 3;

// Timeline: the tasks with a start and an end, in the window of this month and the two after it, grouped by department.
// A bar is { title, part, from, to, lane } where from and to are fractions of the window. A task that would need a fourth
// lane is left out of the drawing, and counted in hidden. { months, todayAt, rows, hidden, without }
export function timelineChart(tasks, today) {
  const first = monthStart(today, 0);
  const end = monthStart(today, 3);
  const start = dayNumber(first);
  const days = dayNumber(end) - start;

  const dated = tasks.filter(task => dateOf(task, 'startDate') !== '' && dateOf(task, 'dueDate') !== '');
  const inside = dated.filter(task => dayNumber(task.dueDate) >= start && dayNumber(task.startDate) < start + days);
  let hidden = 0;

  const rows = mondayDepartments.map(entry => {
    const lanes = [];
    const bars = [];
    inside
      .filter(task => task.department === entry.value)
      .sort((a, b) => dayNumber(a.startDate) - dayNumber(b.startDate) || dayNumber(a.dueDate) - dayNumber(b.dueDate))
      .forEach(task => {
        const from = Math.max(dayNumber(task.startDate), start);
        const to = Math.min(dayNumber(task.dueDate) + 1, start + days);
        let lane = lanes.findIndex(last => last <= from);
        if (lane === -1 && lanes.length < lanesMost) lane = lanes.push(-Infinity) - 1;
        if (lane === -1) {
          hidden += 1;
          return;
        }
        lanes[lane] = to;
        bars.push({ title: String(task.title || ''), part: partOf(task), from: (from - start) / days, to: (to - start) / days, lane: lane });
      });
    return { name: entry.title.toUpperCase(), bars: bars, lanes: Math.max(1, lanes.length) };
  }).filter(row => row.bars.length > 0);

  if (rows.length === 0) return null;
  const shown = rows.slice(0, timelineRowsMost);
  rows.slice(timelineRowsMost).forEach(row => { hidden += row.bars.length; });

  return {
    chart: 'timeline',
    months: [0, 1, 2].map(step => {
      const day = monthStart(today, step);
      return { name: months[Number(day.slice(5, 7)) - 1].toUpperCase(), from: (dayNumber(day) - start) / days };
    }),
    todayAt: (dayNumber(today) - start) / days,
    rows: shown,
    hidden: hidden,
    without: tasks.length - dated.length,
  };
}

const chartTitles = { status: 'STATUS BY DEPARTMENT', progress: 'OVERALL PROGRESS', timeline: 'TIMELINE' };

// { title, team, chart, ... } for a page of the TV charts, or null when the chart has nothing to draw
export function chartsView(content, now, page) {
  const options = pageOptions(page);
  const tasks = ofTeam(boardTasks(content, now), options.team);
  const drawn = options.chart === 'progress' ? progressChart(tasks) : options.chart === 'timeline' ? timelineChart(tasks, todayOf(content, now)) : statusChart(tasks);
  if (drawn === null) return null;

  return Object.assign({ title: chartTitles[options.chart], team: teamWords(content, options.team) }, drawn);
}


// The view of a panel by its id, or null when it has nothing to show. The rotation asks it before it makes a step of a row.
export function viewOf(panelId, content, now, page) {
  if (panelId === 'monday-department') return departmentView(content, now, page);
  if (panelId === 'monday-charts') return chartsView(content, now, page);
  return null;
}
