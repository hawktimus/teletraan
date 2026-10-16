// Cleaning what Sanity sends, and the tasks and Monday boards (part of sanity.js).

import { parseLocalDateTime, sameDay } from './time.js';
import { isVisible } from './content.js';

// A plain date as Monday writes it, 2026-09-25
export const plainDate = /^\d{4}-\d{2}-\d{2}$/;

// An empty field is left out, so the defaults in config.js can fill it, and
// so is a row or block with nothing left in it. Names that start with an
// underscore are Sanity's own and are dropped.
function clean(value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (Array.isArray(value)) return value.map(clean).filter(item => item !== undefined);

  if (typeof value === 'object') {
    const result = cleanObject(value);
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return value;
}

export function cleanObject(object) {
  const result = {};
  Object.keys(object).forEach(key => {
    if (key.charAt(0) === '_') return;

    const value = clean(object[key]);
    if (value !== undefined) result[key] = value;
  });
  return result;
}

function hasOrder(item) {
  return typeof item.order === 'number' && isFinite(item.order);
}

// Items with an order come first, lowest first. The rest follow in the order
// they were stored. The position is kept so equal orders also stay in place.
export function sortByOrder(list) {
  function compare(a, b) {
    const aHas = hasOrder(a.item);
    const bHas = hasOrder(b.item);
    if (aHas && bHas && a.item.order !== b.item.order) return a.item.order - b.item.order;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.position - b.position;
  }

  return list
    .map((item, position) => ({ item: item, position: position }))
    .sort(compare)
    .map(entry => entry.item);
}

export function objectsIn(list) {
  return (Array.isArray(list) ? list : []).filter(item => item && typeof item === 'object');
}

// The team an item is for is the code of its team, or nothing when it is for both. The query
// sends the code. Anything else, such as the reference object in a copy saved before the
// query asked for the code, counts as nothing, so the item shows for both teams.
export function withTeamCode(item) {
  const code = typeof item.team === 'string' ? item.team.trim().toLowerCase() : '';
  if (code === '') delete item.team;
  else item.team = code;
  return item;
}

export function itemsFrom(list) {
  return sortByOrder(objectsIn(list).map(cleanObject).map(withTeamCode));
}

// A plan with no date, or a date that cannot be read, is for any day
function isForToday(plan, now) {
  const date = parseLocalDateTime(plan.date);
  return !date || sameDay(date, now);
}

export function withRows(plan) {
  plan.rows = Array.isArray(plan.rows) ? plan.rows : [];
  return plan;
}

export function showingPlans(plans, now) {
  return itemsFrom(plans).filter(item => isVisible(item, now) && isForToday(item, now)).map(withRows);
}

// A task's contact (a first name) and location (a place's name) are plain text
// or not there at all. The location goes when its place is hidden, deleted or
// has no name, and the flag the query adds is not kept. Nothing else about the
// task changes, so a hidden place never hides a task.
export function normalizeTask(raw) {
  const task = Object.assign({}, raw);
  const placeHidden = task.locationShown === false;
  delete task.locationShown;

  ['contact', 'location'].forEach(name => {
    const text = typeof task[name] === 'string' ? task[name].trim() : '';
    if (text === '' || (name === 'location' && placeHidden)) delete task[name];
    else task[name] = text;
  });
  return normalizeBoardFields(task);
}

// The first name in a text: the part before the first space. A text with an at sign is an address and
// is never a name, so it is nothing. The screen shows first names only, whatever the board holds.
export function firstNameOf(text) {
  const word = typeof text === 'string' ? text.trim().split(/\s+/)[0] : '';
  return word.indexOf('@') === -1 ? word : '';
}

// The fields the board sync writes on a task (docs/monday.md). A task written before them lacks them, and
// is left as it was. A date that is not a plain date, hours that are not a number and a list that is not a
// list are left out. Notes are never read.
function normalizeBoardFields(task) {
  ['startDate', 'dueDate', 'completedOn'].forEach(name => {
    if (task[name] !== undefined && !(typeof task[name] === 'string' && plainDate.test(task[name]))) delete task[name];
  });
  if (task.estHours !== undefined && !(typeof task.estHours === 'number' && isFinite(task.estHours) && task.estHours >= 0)) delete task.estHours;
  if (task.showOnBoard !== undefined && typeof task.showOnBoard !== 'boolean') delete task.showOnBoard;
  ['subteamId', 'hiddenReason'].forEach(name => {
    if (task[name] !== undefined && !(typeof task[name] === 'string' && task[name].trim() !== '')) delete task[name];
  });
  if (task.milestoneIds !== undefined) {
    task.milestoneIds = Array.isArray(task.milestoneIds) ? task.milestoneIds.filter(id => typeof id === 'string' && id !== '') : [];
  }
  if (task.owners !== undefined) {
    task.owners = Array.isArray(task.owners) ? task.owners.map(firstNameOf).filter(name => name !== '') : [];
  }
  delete task.notes;
  return task;
}

const milestoneStatuses = ['not-started', 'on-track', 'at-risk', 'done'];

// The milestones the Mini wrote, by target date. One with no target date, one whose name starts with EXAMPLE (the
// placeholder row of the board) and one with no name are left out.
export function milestonesFrom(list) {
  return objectsIn(list)
    .map(cleanObject)
    .map(withTeamCode)
    .filter(item => typeof item.name === 'string' && item.name.trim() !== '' && !/^EXAMPLE/i.test(item.name.trim()) && typeof item.targetDate === 'string' && plainDate.test(item.targetDate))
    .map(item => Object.assign({}, item, { id: String(item.id === undefined ? '' : item.id), name: item.name.trim(), status: milestoneStatuses.includes(item.status) ? item.status : 'not-started' }))
    .sort((first, second) => (first.targetDate < second.targetDate ? -1 : first.targetDate > second.targetDate ? 1 : 0));
}
