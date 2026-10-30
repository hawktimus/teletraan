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

// A list stops at 20 rows. How many rows are in view at a time depends on the room: see pagesOf. The Studio page draws the first four.
export const rowsPerPage = 4;
export const mostRows = 20;

// The room a page of rows has, in pixels, for each layout (bar is the one the Robotics view plays in). row is the height of a row
// of one line of 44px text, and extra what a second line of 44px text adds (the note of a Stuck task, the helpers of a project). The
// window is what is left of the body (544 high, 532 in Cybertron) under the count line: seven rows in the bar layout, and four in the
// standard one, whose count is two lines. The stylesheets have the same numbers.
export const rowRoom = {
  bar: { window: 476, row: 68, extra: 48 },
  standard: { window: 384, row: 96, extra: 48 },
};

// The order of the open list, and the words of each status
export const openOrder = ['blocked', 'in-progress', 'in-review', 'up-next'];
export const statusWords = { 'up-next': 'TO DO', 'in-progress': 'IN PROGRESS', 'in-review': 'IN REVIEW', blocked: 'STUCK', done: 'DONE' };
const priorityWords = { high: 'High', medium: 'Medium', low: 'Low' };

// What a row says for a value the board does not have. The panel draws a column only when a row of the list has a value in it, and
// leaves the place of the others empty (columnsOf), so these words are for the Studio page and the control page, which print every row.
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

// The tasks of a page. A page for Prime or Nova has the tasks of that team and the General ones (no team). A page for both
// teams, which is the Condensed view, has only the General ones: a task of one team never plays there.
export function ofTeam(tasks, team) {
  return team === '' ? tasks.filter(task => !hasText(task.team)) : tasks.filter(task => !hasText(task.team) || task.team === team);
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

// Stuck first, then In Progress (with In Review) and then To Do
function openRank(task) {
  if (task.status === 'blocked') return 0;
  return task.status === 'in-progress' || task.status === 'in-review' ? 1 : 2;
}

const priorityOrder = ['high', 'medium', 'low'];

function priorityRank(task) {
  const at = priorityOrder.indexOf(task.priority);
  return at === -1 ? priorityOrder.length : at;
}

// Open: Stuck, then In Progress and In Review by the soonest end of the Timeline, then To Do by priority (High first) and then by the
// soonest end. A task with no date comes after the ones that have one. Done: the newest date completed first. The list given is
// not changed.
export function sortTasks(tasks, list) {
  return tasks.slice().sort((a, b) => (list === 'done'
    ? byDate(dateOf(a, 'completedOn'), dateOf(b, 'completedOn'), true) || byTitle(a, b)
    : openRank(a) - openRank(b) || (openRank(a) === 2 ? priorityRank(a) - priorityRank(b) : 0) || byDate(dateOf(a, 'dueDate'), dateOf(b, 'dueDate'), false) || byTitle(a, b)));
}

// A task is late when it is not done and the last day of its Timeline is before today. The panel says LATE instead of the date.
export function isLate(task, today) {
  return listOf(task) === 'open' && dateOf(task, 'dueDate') !== '' && dateOf(task, 'dueDate') < today;
}

// The rows of a list cut into pages by the room they take: a page takes rows while they fit in the window of the layout, and a
// page holds one row at least. A row with extra true has a second line of text under the name.
export function pagesOf(rows, layout) {
  const room = rowRoom[layout] || rowRoom.bar;
  const pages = [];
  let page = [];
  let used = 0;

  rows.forEach(row => {
    const height = room.row + (row.extra ? room.extra : 0);
    if (page.length > 0 && used + height > room.window) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(row);
    used += height;
  });
  if (page.length > 0) pages.push(page);
  return pages;
}

// The columns a list needs: one is drawn when a row of the whole list has a value in it, so a board with no contact on any task
// has no Contact column and the name takes its room.
export function columnsOf(rows) {
  return {
    contact: rows.some(row => row.contact !== emptyWords.contact),
    priority: rows.some(row => row.priorityLevel !== 'none'),
    date: rows.some(row => row.late || row.date !== emptyWords.date),
  };
}

// The status a row shows: a task of the open list is never DONE (it sits in the open list only while it is not done), and
// one of the done list always is
function shownStatus(task, list) {
  if (list === 'done') return 'done';
  return openOrder.includes(task.status) ? task.status : 'up-next';
}


// Department tasks

// { title, team, rows, pages, pageRows, columns, countWords, tallyWords, counts, more } for a page, or null when the department has nothing
// in the list. A row is { status, statusWord, project, contact, priority, priorityLevel, date, late, note, extra }, every value a word:
// an empty one reads Unassigned, No Priority or No Date. late says the task is past the end of its Timeline and not done; the panel
// draws LATE in place of the date. note is the note of a Stuck task, one line, and nothing for any other task. counts are the open
// and done tasks of the department for the team. layout is bar (the default) or standard, and says how many rows a page holds.
export function departmentView(content, now, page, layout = 'bar') {
  const options = pageOptions(page);
  if (options.department === '') return null;

  const own = ofTeam(boardTasks(content, now), options.team).filter(task => task.department === options.department);
  const listed = sortTasks(own.filter(task => listOf(task) === options.list), options.list);
  if (listed.length === 0) return null;

  const today = todayOf(content, now);
  const rowOf = task => {
    const status = shownStatus(task, options.list);
    const note = status === 'blocked' && hasText(task.note) ? String(task.note).replace(/\s+/g, ' ').trim() : '';
    return {
      status: status,
      statusWord: statusWords[status],
      project: String(task.title || '').trim(),
      contact: hasText(task.contact) ? String(task.contact).trim().split(/\s+/)[0] : emptyWords.contact,
      priority: priorityWords[task.priority] || emptyWords.priority,
      priorityLevel: priorityWords[task.priority] ? task.priority : 'none',
      date: dateWords(dateOf(task, 'dueDate')) || emptyWords.date,
      late: isLate(task, today),
      note: note,
      extra: note !== '',
    };
  };

  const every = listed.map(rowOf);
  const rows = every.slice(0, mostRows);
  const pageRows = pagesOf(rows, layout);
  const counts = { open: own.filter(task => listOf(task) === 'open').length, done: own.filter(task => listOf(task) === 'done').length };

  const name = departmentTitle(options.department).toUpperCase();
  return {
    title: name + (options.list === 'done' ? ' DONE' : ' TASKS'),
    team: teamWords(content, options.team),
    list: options.list,
    rows: rows,
    more: listed.length - rows.length,
    pages: Math.max(1, pageRows.length),
    pageRows: pageRows,
    columns: columnsOf(every),
    countWords: countWords(options.list, listed),
    tallyWords: counts.open + ' OPEN · ' + counts.done + ' DONE',
    counts: counts,
  };
}

// The count in the header: 6 IN PROGRESS · 2 STUCK · 4 TO DO for the open list, 5 DONE for the done one. In Review counts with In Progress.
// Stuck and To Do are left out when there are none.
function countWords(list, tasks) {
  if (list === 'done') return tasks.length + ' DONE';
  const stuck = tasks.filter(task => task.status === 'blocked').length;
  const todo = tasks.filter(task => task.status !== 'blocked' && task.status !== 'in-progress' && task.status !== 'in-review').length;
  const words = [(tasks.length - stuck - todo) + ' IN PROGRESS'];
  if (stuck > 0) words.push(stuck + ' STUCK');
  if (todo > 0) words.push(todo + ' TO DO');
  return words.join(' · ');
}

// What a Department tasks page says when its list has nothing: { title, team, line }. The rotation leaves such a row out, so this is for
// a preview and a held page. One line, with the title of the department when the row names one.
export function departmentEmpty(content, page) {
  const options = pageOptions(page);
  const name = departmentTitle(options.department).toUpperCase();
  const waiting = !(content && content.monday && content.monday.lastSyncAt);

  return {
    title: name === '' ? 'DEPARTMENT TASKS' : name + (options.list === 'done' ? ' DONE' : ' TASKS'),
    team: teamWords(content, options.team),
    line: waiting ? 'Waiting for the first read of the board.' : options.list === 'done' ? 'Nothing done yet' : 'Nothing in progress',
  };
}


// Projects

// A done project is drawn when it was finished in the last 14 days, and only the newest 3 of those
export const projectDoneDays = 14;
export const projectDoneMost = 3;
const projectOrder = ['blocked', 'in-progress', 'in-review', 'up-next'];

// The mentors by first name: when two different people on the page share one (their last initials differ), each gets the initial
// after the name, Dan K and Dan M. A mentor with no initial is written as it is.
function mentorWords(projects) {
  const initials = {};
  projects.forEach(project => {
    if (!hasText(project.mentor)) return;
    const key = project.mentor.toLowerCase();
    initials[key] = initials[key] || new Set();
    initials[key].add(project.mentorInitial || '');
  });

  return project => {
    if (!hasText(project.mentor)) return '';
    const same = initials[project.mentor.toLowerCase()];
    return same.size > 1 && hasText(project.mentorInitial) ? project.mentor + ' ' + project.mentorInitial : project.mentor;
  };
}

function byProjectTitle(a, b) {
  return byTitle({ title: a.title }, { title: b.title });
}

// { title, team, rows, pages, pageRows, columns, countWords, tallyWords, more } for the Projects panel, or null when there is nothing
// to draw. The panel plays only for both teams (the Robotics view): a page for Prime or Nova has nothing. A row is { status,
// statusWord, project, mentor, helpers, helperWords, percent, extra }, with a mentor, helpers and percent only when the project has
// them. Order: Stuck, In Progress, In Review, To Do, then up to 3 done in the last 14 days, the newest first.
export function projectsView(content, now, page, layout = 'bar') {
  if (pageOptions(page).team !== '') return null;

  const today = dayNumber(todayOf(content, now));
  const all = Array.isArray(content && content.monday && content.monday.projects) ? content.monday.projects : [];
  const open = [].concat(...projectOrder.map(status => all.filter(project => project.status === status).sort(byProjectTitle)));
  const age = project => today - dayNumber(project.completedOn);
  const done = all
    .filter(project => project.status === 'done' && dateOf(project, 'completedOn') !== '' && age(project) >= 0 && age(project) <= projectDoneDays)
    .sort((a, b) => byDate(a.completedOn, b.completedOn, true) || byProjectTitle(a, b))
    .slice(0, projectDoneMost);
  const shown = open.concat(done);
  if (shown.length === 0) return null;

  const mentor = mentorWords(shown);
  const rows = shown.slice(0, mostRows).map(project => {
    const helpers = Array.isArray(project.helpers) ? project.helpers : [];
    return {
      status: project.status,
      statusWord: statusWords[project.status],
      project: String(project.title || '').trim(),
      mentor: mentor(project),
      helpers: helpers,
      helperWords: helpers.length > 0 ? 'with ' + helpers.join(', ') : '',
      percent: typeof project.percent === 'number' ? project.percent : null,
      extra: helpers.length > 0,
    };
  });
  const pageRows = pagesOf(rows, layout);
  const going = shown.filter(project => project.status === 'in-progress' || project.status === 'in-review').length;
  const stuck = shown.filter(project => project.status === 'blocked').length;
  const todo = shown.filter(project => project.status === 'up-next').length;
  const words = [going + ' IN PROGRESS'];
  if (stuck > 0) words.push(stuck + ' STUCK');
  if (todo > 0) words.push(todo + ' TO DO');

  return {
    title: 'PROJECTS',
    team: '',
    rows: rows,
    more: shown.length - rows.length,
    pages: Math.max(1, pageRows.length),
    pageRows: pageRows,
    columns: { mentor: rows.some(row => row.mentor !== ''), percent: rows.some(row => row.percent !== null) },
    countWords: words.join(' · '),
    tallyWords: done.length > 0 ? done.length + ' DONE' : '',
  };
}

// What the Projects panel says with nothing to draw
export function projectsEmpty(content) {
  const waiting = !(content && content.monday && content.monday.lastSyncAt);
  return { title: 'PROJECTS', team: '', line: waiting ? 'Waiting for the first read of the board.' : 'Nothing in progress' };
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
    return {
      name: entry.title.toUpperCase(), done: counts.done, progress: counts.progress, todo: counts.todo, total: own.length,
      blocked: own.filter(task => listOf(task) === 'open' && task.status === 'blocked').length,
    };
  }).filter(row => row.total > 0);

  return rows.length === 0 ? null : { chart: 'status', rows: rows, longest: Math.max(...rows.map(row => row.total)) };
}

function hoursOf(task) {
  return typeof task.estHours === 'number' && isFinite(task.estHours) && task.estHours > 0 ? task.estHours : 0;
}

// Overall progress: the estimated hours of the done tasks over the hours of every task. When no task has hours (the total is 0, which is
// how the board is today) it is the done tasks over every task. { percent, bar, done, total, unit, tasks: { done, open } }. bar is false at
// 0 percent: the panel draws no empty bar.
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
    bar: Math.round(part / whole * 100) > 0,
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
// With one department the title is the department and the chart: BUILD STATUS, BUILD PROGRESS, BUILD TIMELINE
const departmentChartWords = { status: 'STATUS', progress: 'PROGRESS', timeline: 'TIMELINE' };

// { title, team, department, chart, ... } for a page of the TV charts, or null when the chart has nothing to draw. A page with a
// department draws that department only: one bar for the status chart, and the progress and the timeline of its tasks.
export function chartsView(content, now, page) {
  const options = pageOptions(page);
  const own = ofTeam(boardTasks(content, now), options.team);
  const tasks = options.department === '' ? own : own.filter(task => task.department === options.department);
  const drawn = options.chart === 'progress' ? progressChart(tasks) : options.chart === 'timeline' ? timelineChart(tasks, todayOf(content, now)) : statusChart(tasks);
  if (drawn === null) return null;

  const title = options.department === '' ? chartTitles[options.chart] : departmentTitle(options.department).toUpperCase() + ' ' + departmentChartWords[options.chart];
  return Object.assign({ title: title, team: teamWords(content, options.team), department: options.department }, drawn);
}


// The view of a panel by its id, or null when it has nothing to show. The rotation asks it before it makes a step of a row.
export function viewOf(panelId, content, now, page) {
  if (panelId === 'monday-department') return departmentView(content, now, page);
  if (panelId === 'monday-charts') return chartsView(content, now, page);
  if (panelId === 'monday-projects') return projectsView(content, now, page);
  return null;
}
