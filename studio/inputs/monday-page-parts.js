// The parts of the Monday page that need no Studio: its words, the questions it asks of Sanity, the cards
// of the boards, the rows of the items, and the three things it writes. monday-page.js draws them.
// tests/monday-page.test.mjs reads this file with node, so nothing here imports React or sanity.
//
// The page writes in two places and nowhere else, and always to a draft, never to the published document:
//   Dashboard Settings   mondayTaskBoard.boardId, mondayMilestoneBoard.boardId and mondayEveryMinutes
//   a task               showOnTv, and nothing else of the task
// Publish all puts the drafts on the screen.

import { ageText } from './time-text.js';
import { isRecord, sentence } from './plain-values.js';
import { mondayStatusId, settingsId, taskBoardStart, milestoneBoardStart } from './monday-boards-parts.js';

export { mondayStatusId, settingsId };

export const settingsDraftId = 'drafts.' + settingsId;

// The reads the Teletraan computer may make in a day (computer/scripts/monday-sync.sh, daily_limit)
export const dailyBudget = 900;

export const words = {
  title: 'Monday',
  intro: 'The team keeps its tasks and its milestones on two Monday boards. Here you choose which board gives the tasks and which gives the milestones, look at the items, and keep an item off the TV.',
  saveNote: 'A change is saved as a draft at once. Click Publish all in the top bar to put it on the screen.',
  tabs: { boards: 'Boards', items: 'Items', milestones: 'Milestones', preview: 'Preview the panels' },
  reading: 'Reading Monday data.',
  nothingYet: 'Nothing yet. The Teletraan computer writes this after it has read Monday. Open the Monday check on the control page, then wait for the next read.',
  statusUnreadable: 'The list of boards could not be read. Refresh the page to try again.',
  settingsUnreadable: 'Dashboard Settings could not be read, so the boards it names are not marked below.',
  notPublished: 'Dashboard Settings has not been published yet. Open it, click Publish once, and come back.',
  noBoards: 'The token of the Teletraan computer can see no boards. Open Monday, share the team boards with the account the token belongs to, then open the Monday check on the control page.',
  saved: 'Saved as a draft. Click Publish all in the top bar.',
  problem: 'The change was not saved. ',
  taskRole: 'Show tasks from this board',
  milestoneRole: 'Show milestones from this board',
  canRead: 'The Teletraan computer can read this board.',
  cannotRead: 'The token cannot see this board: open the board in Monday, click Share, and add the account the token belongs to, or choose another board.',
  intervalLabel: 'Read Monday every (minutes)',
  intervalHelp: 'From 5 to 120. The free plan of Monday allows about 1,000 reads a day, and 30 minutes uses about 150.',
  intervalProblem: 'Use a whole number of minutes from 5 to 120.',
  budgetLabel: 'Reads used today',
  publicLine: 'These board names are saved in the dataset, which anyone can read. That includes the boards the screen does not use.',
  multiLevel: 'Robotics Tasks, the board the team works in, is a multi-level board: a task is a parent item and its steps are subitems. Monday may not list a multi-level board for a token, even when the token can read it. If Robotics Tasks is missing below, that may be the reason and the board number may be right. Ask a coach to press Monday debug on the control page, Settings, Monday, and see docs/monday.md.',
  itemsIntro: 'These are the tasks the Teletraan computer read from the task board. Turn Show on TV off to keep a task off every panel. Nothing else here can be changed: change the task in Monday.',
  itemsNoBoard: 'No task board is chosen. Choose one on the Boards tab.',
  itemsNone: 'No tasks from this board yet. Check the board on the Boards tab, then wait for the next read.',
  itemsUnreadable: 'The tasks could not be read. Refresh the page to try again.',
  itemsNoMatch: 'No task matches. Change the filters or the search.',
  search: 'Search',
  searchHelp: 'A word of the title or an owner',
  department: 'Department',
  status: 'Status',
  shown: 'On the TV',
  allDepartments: 'All departments',
  allStatuses: 'All statuses',
  allShown: 'Shown and hidden',
  onlyOn: 'Only on the TV',
  onlyOff: 'Only off the TV',
  showOnTv: 'Show on TV',
  hideGroup: 'Hide all in this group',
  showGroup: 'Show all in this group',
  noDepartment: 'No department',
  oldTasks: 'Old manual tasks',
  oldTasksLine: 'Tasks typed by hand before the team board was connected, and tasks of other boards, are in two lists, On the TV and Hidden. Manual tasks are never shown on the screen.',
  milestonesIntro: 'The milestones the Teletraan computer read from the milestones board. Nothing here can be changed: change them in Monday.',
  milestonesNone: 'No milestones yet. Check the milestones board on the Boards tab, then wait for the next read.',
  milestonesUnreadable: 'The milestones could not be read. Refresh the page to try again.',
  checking: 'Asking Monday.',
};

// The order of the groups on the Items tab: the departments of the task board as the sync writes them.
// A department the team adds later comes after these, and tasks with no department come last.
export const departmentOrder = ['Build', 'Electrical', 'Programming', 'Design', 'CNC', 'Strategy', 'Business', 'Operations', 'Marketing', 'General'];

export const statusChoices = [
  { value: 'blocked', title: 'Blocked' },
  { value: 'in-progress', title: 'In progress' },
  { value: 'in-review', title: 'In review' },
  { value: 'up-next', title: 'Up next' },
  { value: 'done', title: 'Done' },
];

export const statusQuestion = '*[_id == $id][0] { connectedAs, lastSyncAt, lastError, callsToday, callsDate, "boards": boards[] { id, name, itemCount }, "readings": readings[] { boardId, itemsRead, readAt, note } }';

export const itemsQuestion =
  '*[_type == "task" && source == "monday" && mondayBoardId == $board] { _id, title, status, priority, startDate, dueDate, estHours, owners, contact, showOnTv, showOnBoard, show, expires, hiddenReason, "department": subteam->name, "team": team->name }';

export const milestonesQuestion = '*[_type == "milestone" && !(_id in path("drafts.**"))] | order(targetDate asc) { _id, name, targetDate, status, show, "team": team->name, "department": subteam->name }';

function list(value) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function itemsWord(count) {
  return count + (count === 1 ? ' item' : ' items');
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// ---------------------------------------------------------------- the choice in Dashboard Settings

// The boards and the interval that Dashboard Settings holds, the draft first and the published document
// after it. documents is what client.getDocument gave for the draft and for the published id, in any order.
// A document saved before the Monday tab had its blocks reads as the starting boards.
export function chosenFrom(documents) {
  const found = (Array.isArray(documents) ? documents : []).filter(isRecord);
  const source = found.filter(doc => doc._id === settingsDraftId)[0] || found.filter(doc => doc._id === settingsId)[0] || null;
  const block = name => (source && isRecord(source[name]) ? source[name] : {});
  const board = (name, start) => (text(block(name).boardId) !== '' ? text(block(name).boardId) : start);
  const minutes = source && typeof source.mondayEveryMinutes === 'number' ? source.mondayEveryMinutes : 30;

  return { found: Boolean(source), taskBoard: board('mondayTaskBoard', taskBoardStart), milestoneBoard: board('mondayMilestoneBoard', milestoneBoardStart), everyMinutes: minutes };
}

// ---------------------------------------------------------------- the Boards tab

// One card for every board the token can see, then one for a chosen board it cannot see. A card has:
// id, name, items (words), read (words), visible, task and milestones (this board is the one chosen for that
// role), status (the plain line) and note (what the last read said about it, or empty).
export function boardCards(status, chosen, now) {
  const boards = isRecord(status) ? list(status.boards).filter(board => typeof board.id === 'string' && board.id !== '') : [];
  const readings = isRecord(status) ? list(status.readings) : [];
  const readingOf = id => readings.filter(reading => reading.boardId === id)[0] || null;

  function cardFor(id, board) {
    const reading = readingOf(id);
    const age = reading ? ageText(reading.readAt, now) : '';
    const note = reading && text(reading.note) !== '' ? sentence(reading.note) : '';
    return {
      id: id,
      name: board && text(board.name) !== '' ? board.name : 'Board ' + id,
      items: board && typeof board.itemCount === 'number' ? itemsWord(board.itemCount) : 'Items not counted',
      read: age ? 'Read ' + age : 'Not read yet',
      visible: Boolean(board),
      task: id === chosen.taskBoard,
      milestones: id === chosen.milestoneBoard,
      status: board ? words.canRead : words.cannotRead,
      note: note,
    };
  }

  const cards = boards.map(board => cardFor(board.id, board));
  [chosen.taskBoard, chosen.milestoneBoard].forEach(id => {
    if (id && !cards.some(card => card.id === id)) cards.push(cardFor(id, null));
  });
  // the boards that have a role come first, so the choice is the first thing on the page
  return cards.filter(card => card.task || card.milestones).concat(cards.filter(card => !card.task && !card.milestones));
}

// The red lines at the top of the page: one for each chosen board that the token cannot see, with what to do.
// Nothing while the status document is missing, because then nobody knows yet what the token sees.
// Each is { text, kind } where kind is 'task' or 'milestones'.
export function missingLines(status, chosen) {
  if (!isRecord(status)) return [];

  const seen = list(status.boards).map(board => board.id);
  const lines = [];
  const add = (id, kind, what) => {
    if (!id || seen.indexOf(id) !== -1) return;
    lines.push({ kind: kind, text: 'The ' + what + ' you chose, board ' + id + ', is not one the token can see, so nothing can be read from it. In Monday, open the board, click Share, and add the account the token belongs to, or choose another board below.' });
  };
  add(chosen.taskBoard, 'task', 'task board');
  if (chosen.milestoneBoard !== chosen.taskBoard) add(chosen.milestoneBoard, 'milestones', 'milestones board');
  return lines;
}

// Whether to show the note about multi-level boards: the task board is chosen and the token does not list it
export function showMultiLevelNote(status, chosen) {
  return missingLines(status, chosen).some(line => line.kind === 'task');
}

// When the Teletraan computer last read Monday, in words, or nothing when the document has no time
export function updatedText(status, now) {
  const age = isRecord(status) ? ageText(status.lastSyncAt, now) : '';
  return age ? 'The Teletraan computer last read Monday ' + age + '.' : '';
}

export function errorText(status) {
  return isRecord(status) && text(status.lastError) !== '' ? sentence(status.lastError) : '';
}

// The reads used today, in words such as "42 of 900", or nothing when the day of the count is not today
export function budgetText(status, today) {
  if (!isRecord(status) || typeof status.callsToday !== 'number') return '';
  if (typeof status.callsDate === 'string' && typeof today === 'string' && status.callsDate !== today) return '0 of ' + dailyBudget;
  return status.callsToday + ' of ' + dailyBudget;
}

// The minutes typed, as a whole number from 5 to 120, or null when it is not one
export function minutesFrom(value) {
  const trimmed = String(value === undefined || value === null ? '' : value).trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const number = Number(trimmed);
  return number >= 5 && number <= 120 ? number : null;
}

// ---------------------------------------------------------------- what the page writes to Dashboard Settings

const roleFields = { task: 'mondayTaskBoard', milestones: 'mondayMilestoneBoard' };

// The operations of one choice, ready for client.patch: the block is made when it is missing, and only the
// board number inside it is set, so the columns and labels of the block are kept
export function choiceOperations(role, boardId) {
  const block = roleFields[role];
  if (!block) throw new Error('The role must be task or milestones.');
  if (!/^[0-9]{1,20}$/.test(String(boardId))) throw new Error('The board number must be digits only.');
  return { setIfMissing: { [block]: {} }, set: { [block + '.boardId']: String(boardId) } };
}

export function intervalOperations(minutes) {
  if (minutesFrom(minutes) === null) throw new Error(words.intervalProblem);
  return { set: { mondayEveryMinutes: Number(minutes) } };
}

// Makes the draft of Dashboard Settings from the published document when there is none, so the other fields
// are kept, and applies the operations to it. It never publishes.
export async function saveToDraft(client, operations) {
  const published = await client.getDocument(settingsId);
  const draft = await client.getDocument(settingsDraftId);
  if (!draft && !published) throw new Error(words.notPublished);
  if (!draft) {
    const copy = Object.assign({}, published, { _id: settingsDraftId });
    ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
    await client.createIfNotExists(copy);
  }

  let patch = client.patch(settingsDraftId);
  if (operations.setIfMissing) patch = patch.setIfMissing(operations.setIfMissing);
  if (operations.set) patch = patch.set(operations.set);
  return patch.commit();
}

export async function saveBoardChoice(client, role, boardId) {
  return saveToDraft(client, choiceOperations(role, boardId));
}

export async function saveInterval(client, minutes) {
  return saveToDraft(client, intervalOperations(minutes));
}

// ---------------------------------------------------------------- the Items tab

function baseId(id) {
  return String(id).replace(/^drafts\./, '');
}

// One document for each task: the draft when there is one, because a switch turned here is in the draft
export function mergeDrafts(documents) {
  const byId = {};
  const order = [];
  list(documents).forEach(doc => {
    if (typeof doc._id !== 'string') return;
    const id = baseId(doc._id);
    const isDraft = doc._id !== id;
    if (!byId[id]) order.push(id);
    if (!byId[id] || isDraft) byId[id] = Object.assign({}, doc, { _id: id, draft: isDraft });
  });
  return order.map(id => byId[id]);
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Oct 14, from 2026-10-14
export function dayText(date) {
  const parts = typeof date === 'string' ? date.split('-') : [];
  const month = months[Number(parts[1]) - 1];
  return month && Number(parts[2]) > 0 ? month + ' ' + Number(parts[2]) : '';
}

// Why the screen keeps a task off, in words, or nothing when only the switch of this page could. The sync sets
// the first three; the last is the Show on TV switch of the task.
export function reasonOf(doc, now) {
  if (doc.hiddenReason === 'unassigned') return 'The task has no department in Monday, so it stays off the TV until it has one.';
  if (doc.showOnBoard === false) return 'The Show on TV column in Monday says Hide.';
  if (doc.show === false) return 'The Teletraan computer switched it off, usually because the item left the board.';
  if (typeof doc.expires === 'string' && Date.parse(doc.expires) <= now.getTime()) return 'It has expired.';
  return '';
}

function titleOfStatus(value) {
  const found = statusChoices.filter(choice => choice.value === value)[0];
  return found ? found.title : '';
}

// A row of the Items tab: id, title (the whole title), department, status, statusTitle, priority, owners (words),
// due (words), hours (words), switchOn (the Show on TV switch), reason, onTv (the screen would show it), draft.
export function itemRow(doc, now) {
  const reason = reasonOf(doc, now);
  const switchOn = doc.showOnTv !== false;
  const owners = (Array.isArray(doc.owners) ? doc.owners : []).filter(name => typeof name === 'string' && name !== '');
  const people = owners.length > 0 ? owners : text(doc.contact) !== '' ? [doc.contact] : [];

  return {
    id: doc._id,
    title: text(doc.title) !== '' ? doc.title : 'Task with no name',
    department: text(doc.department),
    status: doc.status,
    statusTitle: titleOfStatus(doc.status) || 'No status',
    priority: typeof doc.priority === 'string' && doc.priority !== '' ? doc.priority.charAt(0).toUpperCase() + doc.priority.slice(1) : '',
    owners: people.join(', '),
    due: dayText(doc.dueDate),
    hours: typeof doc.estHours === 'number' ? doc.estHours + (doc.estHours === 1 ? ' hour' : ' hours') : '',
    switchOn: switchOn,
    reason: reason,
    onTv: switchOn && reason === '',
    draft: Boolean(doc.draft),
  };
}

export function itemRows(documents, now) {
  return mergeDrafts(documents).map(doc => itemRow(doc, now));
}

function rank(name) {
  if (name === '') return departmentOrder.length + 1;
  const at = departmentOrder.map(item => item.toLowerCase()).indexOf(name.toLowerCase());
  return at === -1 ? departmentOrder.length : at;
}

// The departments the rows have, in the order of the groups. The empty name is No department.
export function departmentsOf(rows) {
  const names = [];
  rows.forEach(row => {
    if (names.indexOf(row.department) === -1) names.push(row.department);
  });
  return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function departmentTitle(name) {
  return name === '' ? words.noDepartment : name;
}

// filters is { department ('' for all, or a name; the key none means No department), status, shown (all, on, off), search }.
export const noDepartmentKey = '(none)';

export function matches(row, filters) {
  const wanted = filters && typeof filters === 'object' ? filters : {};
  if (wanted.department && wanted.department !== (row.department === '' ? noDepartmentKey : row.department)) return false;
  if (wanted.status && wanted.status !== row.status) return false;
  if (wanted.shown === 'on' && !row.onTv) return false;
  if (wanted.shown === 'off' && row.onTv) return false;

  const search = text(wanted.search).toLowerCase();
  if (search === '') return true;
  return (row.title + ' ' + row.owners).toLowerCase().indexOf(search) !== -1;
}

// The groups of the Items tab: [{ department, title, rows }] in the order of the departments, with the rows that match
export function groupRows(rows, filters) {
  return departmentsOf(rows)
    .map(name => ({ department: name, title: departmentTitle(name), rows: rows.filter(row => row.department === name && matches(row, filters)) }))
    .filter(group => group.rows.length > 0);
}

// The words under the title of a row
export function detailLine(row) {
  return [row.statusTitle, row.priority ? row.priority + ' priority' : '', row.owners, row.due ? 'Due ' + row.due : '', row.hours].filter(Boolean).join(' · ');
}

// The words beside the switch of a row
export function shownText(row) {
  if (row.reason) return 'Off the TV. ' + row.reason;
  return row.switchOn ? 'On the TV' : 'Off the TV by your switch';
}

// The counts above the list: how many tasks, how many are on the TV
export function countLine(rows) {
  const on = rows.filter(row => row.onTv).length;
  return rows.length + (rows.length === 1 ? ' task' : ' tasks') + ', ' + on + ' on the TV.';
}

// Copies a published task as its draft, the way Studio does when someone opens the task: everything stays as it was
function draftOf(published) {
  const copy = Object.assign({}, published, { _id: 'drafts.' + published._id });
  ['_rev', '_createdAt', '_updatedAt'].forEach(name => delete copy[name]);
  return copy;
}

// Sets the Show on TV switch of one or many tasks, in the drafts. The draft of a task is made from the published
// task when there is none. Only showOnTv is written to a task. ids are the ids without drafts.
export async function setShowOnTv(client, ids, value) {
  const wanted = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && id !== '').map(baseId)));
  if (wanted.length === 0) return null;

  const found = list(await client.fetch('*[_type == "task" && _id in $ids]', { ids: wanted.concat(wanted.map(id => 'drafts.' + id)) }, { perspective: 'raw' }));
  const transaction = client.transaction();
  wanted.forEach(id => {
    const draft = found.filter(doc => doc._id === 'drafts.' + id)[0];
    const published = found.filter(doc => doc._id === id)[0];
    if (!draft && !published) throw new Error('A task could not be found. Refresh the page and try again.');
    if (!draft) transaction.createIfNotExists(draftOf(published));
    transaction.patch('drafts.' + id, { set: { showOnTv: Boolean(value) } });
  });
  return transaction.commit();
}

// ---------------------------------------------------------------- the Milestones tab

const milestoneStatuses = { 'not-started': 'Not started', 'on-track': 'On track', 'at-risk': 'At risk', done: 'Done' };

export function milestoneRows(documents) {
  return list(documents).map(doc => ({
    id: doc._id,
    name: text(doc.name) !== '' ? doc.name : 'Milestone with no name',
    date: dayText(doc.targetDate) || 'No date',
    status: milestoneStatuses[doc.status] || 'No status',
    team: text(doc.team) !== '' ? doc.team : 'Both teams',
    department: text(doc.department) !== '' ? doc.department : 'All departments',
    gone: doc.show === false,
  }));
}

export function milestoneLine(row) {
  return [row.date, row.status, row.team, row.department, row.gone ? 'Gone from the board' : ''].filter(Boolean).join(' · ');
}
