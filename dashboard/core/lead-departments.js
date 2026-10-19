// The departments of the Team leads list, which the roster and Drive hours group the board tasks by (core/roster.js). A task
// carries the id of the Team lead with the name of its department (subteamId), which the board sync writes.

import { isVisible } from './content.js';
import { designDepartment } from '../config.js';
import { hasText } from './text.js';

// The Team lead entries that can be a department: shown, with a name and an id, in the order of the Team leads list
export function departmentEntries(content, now) {
  return (Array.isArray(content && content.subteams) ? content.subteams : []).filter(entry => isVisible(entry, now) && hasText(entry.name) && hasText(entry.id));
}

// Design and CNC are one department on the screen, DESIGN · CNC
function isDesignOrCnc(name) {
  const text = String(name).trim().toLowerCase();
  return text === 'design' || text === 'cnc' || (/\bdesign\b/.test(text) && /\bcnc\b/.test(text));
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
