// The parts of the Monday page that need no Studio: its words, the one question it asks of Sanity, the line about the last
// read and the table of each department. monday-page.js draws them. tests/monday-page.test.mjs reads this file with node, so
// nothing here imports React or sanity. The page writes nothing.
//
// The rows and the order of every table are the ones of the Department tasks panel: the page imports departmentView and its
// helpers from dashboard/core/monday-views.js and does not copy them, so the page and the TV cannot disagree. The Studio
// reaches the dashboard folder through the Vite setting in sanity.cli.js.

import { mondayDepartments } from '../../dashboard/config.js';
import { boardTasks, departmentView, ofTeam, rowsPerPage } from '../../dashboard/core/monday-views.js';
import { hasText } from '../../dashboard/core/text.js';
import { ageText } from './time-text.js';
import { isRecord, sentence } from './plain-values.js';
import { checkAddress } from '../tools/monday-check.js';

export const mondayStatusId = 'monday-status';

// Settings, Monitor Monday on the control page has Check the token and Monday debug; Sync Monday now is under Settings, Sync and restart
export const controlLink = checkAddress;

// The Rotation board in the sidebar (structure.js)
export const rotationPath = '/structure/rotation';

export const words = {
  title: 'Monday',
  intro: 'This is what the Teletraan computer read from the Monday boards Robotics Tasks and Completed Tasks. Pick a team to see the tasks of each department that are to do or in progress, and the ones that are done. Nothing here can be changed: change a task in Monday.',
  reading: 'Reading the Monday tasks.',
  unreadable: 'The Monday tasks could not be read. Refresh the page to try again.',
  neverRead: 'The Teletraan computer has not read Monday yet. Open the control page, Settings, Sync and restart, and press Sync Monday now.',
  control: 'Open the control page, Settings, Monitor Monday',
  rotation: 'Add a Department tasks row on the Rotation board',
  teamLabel: 'Team',
  teamHelp: 'A task with no team is for both teams, so it shows under Prime and under Nova.',
  openTitle: 'To Do and In Progress',
  doneTitle: 'Done',
  none: 'No tasks.',
  emptyDepartment: 'No tasks for this department and team.',
  emptyList: 'Nothing here.',
  previewTitle: 'What the TV shows',
  previewHelp: 'The first page of a Department tasks row, drawn with the same rules as the TV. Pick the Department, List and Team of the row.',
  departmentLabel: 'Department',
  listLabel: 'List',
  previewTeamLabel: 'Team',
  previewSkipped: 'The TV leaves this row out, because nothing is in this list.',
  columns: ['Status', 'Project', 'Contact', 'Priority', 'Estimated Completion Date'],
};

// The nine departments of the boards, in the order of the panels (mondayDepartments in dashboard/config-lists.js)
export const departments = mondayDepartments;

export const teamChoices = [{ value: '', title: 'Both' }, { value: 'prime', title: 'Prime' }, { value: 'nova', title: 'Nova' }];
export const listChoices = [{ value: 'open', title: 'Open' }, { value: 'done', title: 'Done' }];

// What the page reads: the status the Teletraan computer wrote, the tasks it made and the teams, published only
export const question = `{
  "status": *[_id == $statusId][0] { lastSyncAt, lastError, hiddenCount },
  "tasks": *[_type == "task" && source == "monday" && !(_id in path("drafts.**"))] {
    title, source, department, list, status, "team": team->code, contact, priority, dueDate, completedOn, showOnBoard, showOnTv, show, expires
  },
  "teams": *[_type == "team" && !(_id in path("drafts.**"))] { code, name, shortName }
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

// The tasks and teams the question found, in the shape the dashboard code reads
export function contentOf(found) {
  const source = isRecord(found) ? found : {};
  return { tasks: Array.isArray(source.tasks) ? source.tasks.filter(isRecord) : [], teams: Array.isArray(source.teams) ? source.teams.filter(isRecord) : [] };
}

// One entry for each of the nine departments, for a team ('' is both): { value, title, open, done, empty, openRows,
// doneRows, openMore, doneMore }. The rows are the ones of the TV, up to the 20 it holds, and more counts the rest.
export function departmentTables(content, team, now = new Date()) {
  return departments.map(entry => {
    const ask = list => departmentView(content, now, { team: team, department: entry.value, list: list });
    const open = ask('open');
    const done = ask('done');
    const counts = (open || done || { counts: { open: 0, done: 0 } }).counts;
    return {
      value: entry.value,
      title: entry.title,
      open: counts.open,
      done: counts.done,
      empty: counts.open + counts.done === 0,
      openRows: open ? open.rows : [],
      doneRows: done ? done.rows : [],
      openMore: open ? open.more : 0,
      doneMore: done ? done.more : 0,
    };
  });
}

// The tasks of the board that have a department and are not on the TV (Show on TV? says Hide, or the Studio switch is off)
export function hiddenCount(content, now = new Date()) {
  const known = content.tasks.filter(task => departments.some(entry => entry.value === task.department));
  return known.length - boardTasks(content, now).length;
}

// The tasks that say Hide in Monday. The computer counts them and does not write them (the dataset is public), so the
// page can say how many there are and no more.
export function hiddenOnMonday(status) {
  return isRecord(status) && Number.isInteger(status.hiddenCount) && status.hiddenCount > 0 ? status.hiddenCount : 0;
}

// The tasks on the TV that have no team: they count for both teams
export function generalCount(content, now = new Date()) {
  return boardTasks(content, now).filter(task => !hasText(task.team)).length;
}

// What a Department tasks row draws on its first page, or null when the TV leaves the row out
export function tvPreview(content, now, choice) {
  const view = departmentView(content, now, choice);
  return view === null ? null : Object.assign({}, view, { rows: view.rows.slice(0, rowsPerPage) });
}

// The counts of a department in words, such as "4 to do, 2 done"
export function countLine(table) {
  return table.open + ' to do, ' + table.done + ' done';
}
