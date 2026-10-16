// What each panel of the one task board draws, worked out and with no markup: the plain functions that
// tests/monday-panels.test.mjs runs. A panel (panels/monday-tasks, monday-done, monday-status-depts,
// monday-overall, monday-timeline and monday-board) asks for its view, and draws it with core/monday-draw.js.
// The rules that say which task is where are in core/monday.js. A view is null when the panel has nothing to show,
// and the Screens leave the row out then.
//
// The page a panel is given is { team, department, turn }: the code of the team of the row, the id of the Team lead
// of the row and, for the board, which time in a row that the panel runs twice in a row it is, counting from 1.
// An empty team is the team on the screen. An empty department is the first one with tasks. A number is the
// page of an older row, the nth department with tasks.

import { todayOf } from './competition.js';
import { isVisible } from './content.js';
import { bothTeamDepartments, designDepartment } from '../config.js';
import { dayNumber, forTeam, nextMilestones, milestoneProgress, overdue, plainDateOf, progressHours, rank, visibleTasks } from './monday.js';
import { teamsOf } from './screens.js';
import { teamNameOf } from './team-title.js';
import { wantedTeam } from './teams.js';
import { hasText } from './text.js';
import { firstNameOf } from './sanity.js';
import { pieSlices } from './monday-pie.js';

const mostTaskRows = 10;
export const rowsPerPage = 5;
const doneRows = 6;
const statusRowsMost = 8;
const timelineRowsMost = 6;
const timelineWeeks = 8;
const boardCardsPerColumn = 2;

const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// A plain date as it reads on a panel, OCT 17. Nothing for a date that is not one.
export function dateWords(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  return months[Number(date.slice(5, 7)) - 1] + ' ' + Number(date.slice(8, 10));
}

function pageOptions(page) {
  if (typeof page === 'number') return { team: '', department: '', number: page, turn: 1 };

  const source = page && typeof page === 'object' ? page : {};
  return {
    team: typeof source.team === 'string' ? source.team : '',
    department: typeof source.department === 'string' ? source.department : '',
    number: 1,
    turn: typeof source.turn === 'number' && source.turn > 1 ? Math.floor(source.turn) : 1,
  };
}

// The team of a page: its code, its short name in capitals (the chip) and its Team document
function teamOfPage(content, options) {
  const code = options.team !== '' && options.team !== 'both' ? options.team : wantedTeam().code;
  const found = (Array.isArray(content && content.teams) ? content.teams : []).find(team => team.code === code);
  const team = found || (code === wantedTeam().code ? wantedTeam() : null);

  return { code: code, name: team ? teamNameOf(team) : String(code).toUpperCase(), team: team };
}

// The Team lead entries that can be a department: shown, with a name and an id, in the order of the Team leads list
export function departmentEntries(content, now) {
  return (Array.isArray(content && content.subteams) ? content.subteams : []).filter(entry => isVisible(entry, now) && hasText(entry.name) && hasText(entry.id));
}

// Design and CNC are one department on the screen, DESIGN · CNC
function isDesignOrCnc(name) {
  const text = String(name).trim().toLowerCase();
  return text === 'design' || text === 'cnc' || (/\bdesign\b/.test(text) && /\bcnc\b/.test(text));
}

// True for a department that belongs to both teams (Business, Operations, Marketing): its panels sit in the Robotics view
export function isBothTeamDepartment(name) {
  return bothTeamDepartments.includes(String(name).trim().toLowerCase());
}

// The departments of the Team leads list as they are on the screen: { id, ids, name, entry }. Design and CNC are one, with
// the id of the first and the ids of both.
function groupedEntries(entries) {
  const groups = [];
  let design = null;

  entries.forEach(entry => {
    if (!isDesignOrCnc(entry.name)) {
      groups.push({ id: entry.id, ids: [entry.id], name: String(entry.name).trim(), entry: entry });
    } else if (design) {
      design.ids.push(entry.id);
    } else {
      design = { id: entry.id, ids: [entry.id], name: designDepartment, entry: entry };
      groups.push(design);
    }
  });
  return groups;
}

// The tasks of a department as departmentsOf gives it: the tasks of any of its ids
export function tasksOfDepartment(tasks, department) {
  return tasks.filter(task => department.ids.includes(task.subteamId));
}

// The departments that have tasks among the ones given, as { id, ids, name }, in the order of the Team leads list
export function departmentsOf(content, tasks, now) {
  return groupedEntries(departmentEntries(content, now))
    .filter(group => tasksOfDepartment(tasks, group).length > 0)
    .map(group => ({ id: group.id, ids: group.ids, name: group.name }));
}

// The department a row names, among the ones given: it can be the id of a Team lead of the department, or its name in any
// case (build, electrical, design). Design and CNC name the one department DESIGN · CNC. Null when none matches.
export function departmentIn(departments, value) {
  const wanted = String(value || '').trim().toLowerCase();
  if (wanted === '') return null;

  return departments.find(entry => entry.ids.includes(value)) ||
    departments.find(entry => (isDesignOrCnc(wanted) ? entry.name === designDepartment : entry.name.toLowerCase() === wanted)) ||
    null;
}

// The tasks a card of a team (and perhaps one department) draws, with the department. A row with a department and no team is
// for both teams. { team, tasks, department } where department is null when the page names none, and tasks is null when it
// names one that has no visible task.
export function pageTasks(content, now, options) {
  const team = teamOfPage(content, options);
  const bothTeams = options.team === '' && options.department !== '';
  const tasks = forTeam(visibleTasks(content, now), bothTeams ? '' : team.code);
  if (options.department === '') return { team: team, tasks: tasks, department: null, bothTeams: false };

  const department = departmentIn(departmentsOf(content, tasks, now), options.department);
  return { team: team, tasks: department ? tasksOfDepartment(tasks, department) : null, department: department, bothTeams: bothTeams };
}

// The name of the department of each id, for the cards that name the department of a task
function departmentNames(content, now, shape) {
  const names = {};
  groupedEntries(departmentEntries(content, now)).forEach(group => group.ids.forEach(id => {
    names[id] = shape(group.name);
  }));
  return names;
}

// The tasks of a team that a panel may draw, and the department the page asks for
function teamTasks(content, now, code) {
  return forTeam(visibleTasks(content, now), code);
}

// The person to ask about a task: a first name, and never anything else. The board may hold a whole name.
function pocOf(task) {
  return firstNameOf(task.contact);
}


// Tasks by team and department

export function tasksView(content, now, page) {
  const options = pageOptions(page);
  const team = teamOfPage(content, options);
  // a row with a department and no team is a department of both teams: all its tasks, with no team in the title
  const bothTeams = options.team === '' && options.department !== '';
  const tasks = teamTasks(content, now, bothTeams ? '' : team.code);
  const departments = departmentsOf(content, tasks, now);
  const department = options.department !== '' ? departmentIn(departments, options.department) : departments[options.number - 1];
  if (!department) return null;

  const own = tasksOfDepartment(tasks, department);
  const today = todayOf(content, now);
  const ranked = rank(own).slice(0, mostTaskRows);
  const open = own.filter(task => task.status !== 'done');

  return {
    team: team,
    department: department,
    title: department.name.toUpperCase() + ' TASKS',
    rows: ranked.map(task => ({
      status: task.status,
      title: task.title || '',
      poc: pocOf(task),
      due: dateWords(plainDateOf(task, 'dueDate')),
      overdue: overdue(task, today),
      priority: task.priority || '',
    })),
    counts: { overdue: open.filter(task => overdue(task, today)).length, open: open.length, done: own.length - open.length },
    pages: Math.max(1, Math.ceil(ranked.length / rowsPerPage)),
  };
}


// Done by team

export function doneView(content, now, page) {
  const options = pageOptions(page);
  const picked = pageTasks(content, now, options);
  const team = picked.team;
  if (picked.tasks === null) return null;

  const today = todayOf(content, now);
  const done = rank(picked.tasks.filter(task => task.status === 'done'));
  if (done.length === 0) return null;

  const names = departmentNames(content, now, name => name);
  const week = done.filter(task => {
    const gone = dayNumber(today) - dayNumber(plainDateOf(task, 'completedOn'));
    return gone >= 0 && gone < 7;
  });

  return {
    team: team,
    title: picked.department ? picked.department.name.toUpperCase() + ' DONE' : 'DONE',
    rows: done.slice(0, doneRows).map(task => ({ department: names[task.subteamId] || '', title: task.title || '', poc: pocOf(task), date: dateWords(plainDateOf(task, 'completedOn')) })),
    counts: {
      week: week.length,
      season: done.length,
      hours: Math.round(done.reduce((sum, task) => sum + (typeof task.estHours === 'number' && task.estHours > 0 ? task.estHours : 0), 0)),
    },
  };
}


// Status by department

export const statusOrder = ['up-next', 'in-progress', 'in-review', 'blocked', 'done'];

function countStatuses(tasks) {
  const counts = {};
  statusOrder.forEach(status => {
    counts[status] = tasks.filter(task => task.status === status).length;
  });
  return counts;
}

// One row for each department that has a visible task, both teams together (General once), at most eight; the
// departments after the eighth are one row, OTHER.
export function statusView(content, now) {
  const tasks = visibleTasks(content, now);
  const departments = departmentsOf(content, tasks, now);
  const shown = tasks.filter(task => departments.some(entry => entry.ids.includes(task.subteamId)));
  if (shown.length === 0) return null;

  const rows = departments.map(entry => ({ name: entry.name.toUpperCase(), tasks: tasksOfDepartment(shown, entry) }));
  if (rows.length > statusRowsMost) {
    const rest = rows.splice(statusRowsMost - 1);
    rows.push({ name: 'OTHER', tasks: [].concat(...rest.map(row => row.tasks)) });
  }

  const sized = rows.map(row => ({ name: row.name, counts: countStatuses(row.tasks), total: row.tasks.length, done: row.tasks.filter(task => task.status === 'done').length }));
  const today = todayOf(content, now);
  return {
    rows: sized,
    longest: Math.max(...sized.map(row => row.total)),
    totals: { tasks: shown.length, stuck: shown.filter(task => task.status === 'blocked').length, overdue: shown.filter(task => overdue(task, today)).length },
  };
}


// Overall progress

function hoursOfTeam(tasks) {
  const hours = progressHours(tasks);
  return { done: Math.round(hours.done), total: Math.round(hours.total), percent: hours.percent };
}

export function overallView(content, now) {
  const tasks = visibleTasks(content, now).filter(task => hasText(task.subteamId));
  if (tasks.length === 0) return null;

  const today = todayOf(content, now);
  const hours = progressHours(tasks);

  return {
    percent: hours.percent,
    hours: { done: Math.round(hours.done), total: Math.round(hours.total), unestimated: hours.unestimated },
    teams: teamsOf(content).map(team => ({ code: team.code, name: teamNameOf(team), team: team, hours: hoursOfTeam(tasks.filter(task => task.team === team.code)) })),
    milestones: nextMilestones(content, null, 3).map(milestone => {
      const progress = milestoneProgress(milestone, tasks, today);
      return { name: milestone.name, date: dateWords(milestone.targetDate), daysLeft: progress.daysLeft, percent: progress.percent };
    }),
    counts: { done: tasks.filter(task => task.status === 'done').length, total: tasks.length, overdue: tasks.filter(task => overdue(task, today)).length, stuck: tasks.filter(task => task.status === 'blocked').length },
  };
}

// The words for the days left of a milestone
export function daysWords(daysLeft) {
  if (!isFinite(daysLeft)) return '';
  if (daysLeft < 0) return 'LATE';
  return daysLeft === 1 ? '1 DAY' : daysLeft + ' DAYS';
}


// Timeline by team

// The day number of the Monday on or before a plain date
export function mondayBefore(today) {
  const day = dayNumber(today);
  return day - ((new Date(day * 86400000).getUTCDay() + 6) % 7);
}

export function timelineView(content, now, page) {
  const options = pageOptions(page);
  const picked = pageTasks(content, now, options);
  const team = picked.team;
  if (picked.tasks === null) return null;

  const tasks = picked.tasks;
  const today = todayOf(content, now);
  const first = mondayBefore(today);
  const days = timelineWeeks * 7;

  const drawn = tasks.filter(task => plainDateOf(task, 'startDate') !== '' && plainDateOf(task, 'dueDate') !== '');
  const without = tasks.length - drawn.length;
  const inside = drawn.filter(task => dayNumber(task.dueDate) >= first && dayNumber(task.startDate) < first + days);
  const rows = departmentsOf(content, inside, now).slice(0, timelineRowsMost).map(entry => ({
    id: entry.id,
    name: entry.name.toUpperCase(),
    bars: laneBars(tasksOfDepartment(inside, entry), first, days),
  }));

  const weeks = [];
  for (let week = 0; week < timelineWeeks; week++) weeks.push(dateWords(new Date((first + week * 7) * 86400000).toISOString().slice(0, 10)));

  return rows.length === 0 && without === 0 ? null : { team: team, title: picked.department ? picked.department.name.toUpperCase() + ' TIMELINE' : 'TIMELINE', weeks: weeks, rows: rows, without: without, todayAt: (dayNumber(today) - first) / days, days: days, first: first };
}

// Where each bar of a department goes, as fractions of the eight weeks, and in which of two lanes. A task that
// would lie over both lanes is left out.
function laneBars(tasks, first, days) {
  const lanes = [-Infinity, -Infinity];
  const bars = [];

  tasks
    .slice()
    .sort((a, b) => dayNumber(a.startDate) - dayNumber(b.startDate) || dayNumber(a.dueDate) - dayNumber(b.dueDate))
    .forEach(task => {
      const start = Math.max(dayNumber(task.startDate), first);
      const end = Math.min(dayNumber(task.dueDate) + 1, first + days);
      const lane = lanes.findIndex(last => last <= start);
      if (lane === -1 || end <= start) return;

      lanes[lane] = end;
      bars.push({ title: task.title || '', status: task.status, from: (start - first) / days, to: (end - first) / days, lane: lane });
    });

  const used = bars.some(bar => bar.lane === 1) ? 2 : 1;
  bars.forEach(bar => {
    bar.lanes = used;
  });
  return bars;
}


// Board by team

// The four columns: To Do, In Progress, Review (with the stuck tasks, which rank first there) and Done. A column
// has its count, two cards for the turn it is, and how many more there are. The second time the panel runs in a
// row, cards three and four.
export function boardView(content, now, page) {
  const options = pageOptions(page);
  const picked = pageTasks(content, now, options);
  const team = picked.team;
  if (picked.tasks === null || picked.tasks.length === 0) return null;

  const tasks = picked.tasks;

  const names = departmentNames(content, now, name => name.toUpperCase());
  const ranked = rank(tasks);
  const columns = [
    { id: 'up-next', name: 'TO DO', list: ranked.filter(task => task.status === 'up-next') },
    { id: 'in-progress', name: 'IN PROGRESS', list: ranked.filter(task => task.status === 'in-progress') },
    { id: 'in-review', name: 'REVIEW', list: ranked.filter(task => task.status === 'in-review' || task.status === 'blocked') },
    { id: 'done', name: 'DONE', list: ranked.filter(task => task.status === 'done') },
  ];
  const skip = (options.turn - 1) * boardCardsPerColumn;

  return {
    team: team,
    title: picked.department ? picked.department.name.toUpperCase() + ' BOARD' : 'BOARD',
    columns: columns.map(column => {
      const cards = column.list.slice(skip, skip + boardCardsPerColumn);
      return {
        id: column.id,
        name: column.name,
        count: column.list.length,
        more: Math.max(0, column.list.length - skip - cards.length),
        cards: cards.map(task => ({ department: names[task.subteamId] || '', title: task.title || '', poc: pocOf(task), stuck: task.status === 'blocked' })),
      };
    }),
  };
}


// Status pie of a team, or of one department of it

export const pieGeometry = { cx: 240, cy: 240, outer: 230, inner: 130 };
const pieWords = { 'up-next': 'TO DO', 'in-progress': 'IN PROGRESS', 'in-review': 'REVIEW', blocked: 'STUCK', done: 'DONE' };

export function pieView(content, now, page) {
  const options = pageOptions(page);
  const picked = pageTasks(content, now, options);
  if (picked.tasks === null || picked.tasks.length === 0) return null;

  const counts = countStatuses(picked.tasks);
  const all = statusOrder.map(status => ({ status: status, name: pieWords[status], count: counts[status] }));
  const slices = pieSlices(all, pieGeometry.cx, pieGeometry.cy, pieGeometry.outer, pieGeometry.inner);

  return {
    team: picked.team,
    title: picked.department ? picked.department.name.toUpperCase() + ' STATUS' : 'STATUS',
    total: picked.tasks.length,
    legend: all.map(item => Object.assign({ percent: (slices.find(slice => slice.status === item.status) || { percent: 0 }).percent }, item)),
    slices: slices,
  };
}


// The view of a panel by its id, or null when it has nothing to show. The Screens ask it before they make a step of a Monday row,
// so a row for a department with no visible task, or a team with no task, is left out as an empty row always was.
export function viewOf(panelId, content, now, page) {
  if (panelId === 'monday-tasks') return tasksView(content, now, page);
  if (panelId === 'monday-done') return doneView(content, now, page);
  if (panelId === 'monday-status-depts') return statusView(content, now);
  if (panelId === 'monday-overall') return overallView(content, now);
  if (panelId === 'monday-timeline') return timelineView(content, now, page);
  if (panelId === 'monday-pie') return pieView(content, now, page);
  if (panelId !== 'monday-board') return null;

  const view = boardView(content, now, page);
  return view && view.columns.some(column => column.cards.length > 0) ? view : null;
}
