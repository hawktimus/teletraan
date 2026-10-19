// The parts of the Monday page that need no Studio: its words, the one question it asks of Sanity, the line about the last
// read and the table of each department. monday-page.js draws them. tests/monday-page.test.mjs reads this file with node, so
// nothing here imports React or sanity. The page writes nothing.
//
// The rules of the tables are the ones of the Department tasks panel (departmentView in dashboard/core/monday-views.js): the
// Studio cannot import from the dashboard folder, so they are copied here, and the test runs both on the same tasks.

import { ageText } from './time-text.js';
import { isRecord, sentence } from './plain-values.js';
import { checkAddress } from '../tools/monday-check.js';

export const mondayStatusId = 'monday-status';

// Settings, Monday on the control page, where Sync Monday now, Check the token and Monday debug are
export const controlLink = checkAddress;

// The Rotation board in the sidebar (structure.js)
export const rotationPath = '/structure/rotation';

export const words = {
  title: 'Monday',
  intro: 'The Teletraan computer reads two Monday boards, Robotics Tasks and Completed Tasks, and this is what it read. Nothing here can be changed: change a task in Monday. The group of a task is its department, and a task in the Done group or on Completed Tasks is done.',
  reading: 'Reading the Monday tasks.',
  unreadable: 'The Monday tasks could not be read. Refresh the page to try again.',
  neverRead: 'The Teletraan computer has not read Monday yet. Open the control page, Settings, Monday, and press Sync Monday now.',
  control: 'Open the control page, Settings, Monday',
  rotation: 'Add a Department tasks row on the Rotation board',
  none: 'Nothing on the TV for this department.',
  columns: ['Status', 'Project', 'Contact', 'Priority', 'Estimated Completion Date'],
};

// The nine departments of the boards, in the order of the panels (mondayDepartments in dashboard/config-lists.js)
export const departments = [
  { value: 'build', title: 'Build' }, { value: 'electrical', title: 'Electrical' }, { value: 'programming', title: 'Programming' },
  { value: 'design', title: 'Design' }, { value: 'cnc', title: 'CNC' }, { value: 'strategy', title: 'Strategy' },
  { value: 'operations', title: 'Operations' }, { value: 'business', title: 'Business' }, { value: 'marketing', title: 'Marketing' },
];

// What the page reads: the status the Teletraan computer wrote and the tasks it made, published only
export const question = `{
  "status": *[_id == $statusId][0] { lastSyncAt, lastError },
  "tasks": *[_type == "task" && source == "monday" && !(_id in path("drafts.**"))] {
    title, department, list, status, "team": team->code, contact, priority, dueDate, completedOn, showOnBoard, showOnTv, show, expires
  }
}`;

// The one line about the last read: when, and that it worked, or the problem in plain words
export function lastReadLine(status, now) {
  if (!isRecord(status) || typeof status.lastSyncAt !== 'string' || status.lastSyncAt === '') {
    return { ok: false, text: isRecord(status) && status.lastError ? 'The last read did not work: ' + sentence(status.lastError) : words.neverRead };
  }
  const when = 'Last read ' + ageText(status.lastSyncAt, now) + '. ';
  return typeof status.lastError === 'string' && status.lastError.trim() !== ''
    ? { ok: false, text: when + 'The last try did not work: ' + sentence(status.lastError) }
    : { ok: true, text: when + 'It worked.' };
}

// The copy of the rules of the panel

const statusWords = { 'up-next': 'To Do', 'in-progress': 'In Progress', 'in-review': 'In Review', blocked: 'Stuck', done: 'Done' };
const openOrder = ['in-progress', 'in-review', 'blocked', 'up-next'];
const priorityWords = { high: 'High', medium: 'Medium', low: 'Low' };
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const plainDate = /^\d{4}-\d{2}-\d{2}$/;

function dateOf(task, name) {
  return typeof task[name] === 'string' && plainDate.test(task[name]) ? task[name] : '';
}

function dateWords(date) {
  return date === '' ? '' : months[Number(date.slice(5, 7)) - 1] + ' ' + Number(date.slice(8, 10));
}

export function listOf(task) {
  if (task.list === 'open' || task.list === 'done') return task.list;
  return task.status === 'done' ? 'done' : 'open';
}

// On the TV: switched on in the Studio, not past its expiry, and not hidden by the Show on TV? column of the board
export function onTv(task, now) {
  if (task.show === false || task.showOnTv === false || task.showOnBoard === false) return false;
  return !task.expires || Date.parse(task.expires) > now.getTime();
}

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

export function sortTasks(tasks, list) {
  return tasks.slice().sort((a, b) => (list === 'done'
    ? byDate(dateOf(a, 'completedOn'), dateOf(b, 'completedOn'), true) || byTitle(a, b)
    : openRank(a) - openRank(b) || byDate(dateOf(a, 'dueDate'), dateOf(b, 'dueDate'), false) || byTitle(a, b)));
}

function rowOf(task, list) {
  const status = list === 'done' ? 'done' : openOrder.includes(task.status) ? task.status : 'up-next';
  return {
    status: statusWords[status],
    project: String(task.title || '').trim(),
    contact: typeof task.contact === 'string' && task.contact.trim() !== '' ? task.contact.trim().split(/\s+/)[0] : 'Unassigned',
    priority: priorityWords[task.priority] || 'No Priority',
    date: dateWords(dateOf(task, 'dueDate')) || 'No Date',
    team: task.team === 'prime' ? 'Prime' : task.team === 'nova' ? 'Nova' : '',
  };
}

// One entry for each of the nine departments: { value, title, open, done, hidden, rows } where rows are the open tasks in
// the order of the TV and then the done ones, newest first. hidden counts the tasks of the department that are not on the TV.
export function departmentTables(tasks, now = new Date()) {
  const all = (Array.isArray(tasks) ? tasks : []).filter(isRecord);
  return departments.map(entry => {
    const own = all.filter(task => task.department === entry.value);
    const shown = own.filter(task => onTv(task, now));
    const open = sortTasks(shown.filter(task => listOf(task) === 'open'), 'open');
    const done = sortTasks(shown.filter(task => listOf(task) === 'done'), 'done');
    return {
      value: entry.value,
      title: entry.title,
      open: open.length,
      done: done.length,
      hidden: own.length - shown.length,
      rows: open.map(task => rowOf(task, 'open')).concat(done.map(task => rowOf(task, 'done'))),
    };
  });
}

// The counts of a department in words, such as "4 open, 2 done, 1 hidden"
export function countLine(table) {
  return [table.open + ' open', table.done + ' done'].concat(table.hidden > 0 ? [table.hidden + ' hidden from the TV'] : []).join(', ');
}
