// The pages of the Subteam roster panel. A page shows one subteam: its lead
// and up to 16 members. A subteam with more members than that continues on
// the next page. The panel shows one page each time it comes round.

import { hasText } from './text.js';
import { visibleItems } from './content.js';
import { makePages } from './turns.js';
import { leadPhotoOf } from './team-leads.js';
import { rosterPageRows } from '../config.js';
import { departmentsOf, tasksOfDepartment } from './monday-views.js';
import { forTeam, visibleTasks } from './monday.js';

export const rowsPerColumn = 8;
export const membersPerPage = rowsPerColumn * 2;

function membersOf(subteam) {
  return Array.isArray(subteam.members) ? subteam.members.filter(hasText) : [];
}

// Every page, subteam by subteam in the order of the Team leads list in Studio
// (the order content.subteams already has). Each page is
//   { subteam, lead, members, pageNumber, pageCount }
// subteam and lead are the typed texts, lead is empty when there is none, and
// members are the names on this page. When the lead has a photo of its own, or
// its switch is off, the page also has photo or showPhoto: false, for the
// portrait (leadAddress in core/portrait.js). Hidden and expired subteams are
// left out, and so is one with neither a lead nor a member, because there would
// be nothing to show.
export function rosterPages(subteams) {
  const pages = [];

  visibleItems(subteams).forEach(subteam => {
    const lead = hasText(subteam.lead) ? String(subteam.lead).trim() : '';
    const members = membersOf(subteam);
    if (lead === '' && members.length === 0) return;

    // A subteam with a lead and no members still gets one page
    const pageCount = Math.max(1, Math.ceil(members.length / membersPerPage));
    for (let index = 0; index < pageCount; index++) {
      pages.push(Object.assign({
        subteam: String(subteam.name || '').trim(),
        lead: lead,
        members: members.slice(index * membersPerPage, (index + 1) * membersPerPage),
        pageNumber: index + 1,
        pageCount: pageCount,
      }, lead === '' ? {} : leadPhotoOf(subteam)));
    }
  });
  return pages;
}

// The turn counter. next(subteams) gives the next page and the one after it,
// whose lead's photo can be loaded early, and starts again after the last
// page: { page, upcoming }. Both are null when there is no page, and upcoming
// is null when there is only one.
export function makeRosterTurns() {
  const nextTurn = makePages(1);

  return function next(subteams) {
    const turn = nextTurn(rosterPages(subteams));
    return { page: turn.items[0] || null, upcoming: turn.upcoming[0] || null };
  };
}


// The roster from the Monday board
//
// A roster page is one department: the people who own its tasks (the person column of the board) and the hours of those
// tasks (the hours number column), six rows to a page. A task with several owners gives each an equal share of its hours.
// Design and CNC are one department. The panel draws these pages while the board has any, and the pages of the Team leads
// above only when it has none. The Robotics view counts the tasks of both teams, and a team view the tasks of its team.

function ownersOf(task) {
  const owners = Array.isArray(task.owners) ? task.owners.filter(hasText) : [];
  return owners.length > 0 ? owners : hasText(task.contact) ? [String(task.contact).trim()] : [];
}

// The people of a list of tasks, as { name, hours }, the most hours first and then by name
export function peopleOf(tasks) {
  const hours = {};

  tasks.forEach(task => {
    const owners = ownersOf(task);
    const each = typeof task.estHours === 'number' && task.estHours > 0 && owners.length > 0 ? task.estHours / owners.length : 0;
    owners.forEach(name => {
      hours[name] = (hours[name] || 0) + each;
    });
  });
  return Object.keys(hours)
    .map(name => ({ name: name, hours: Math.round(hours[name]) }))
    .sort((a, b) => b.hours - a.hours || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// Every page: { department, rows: [{ name, hours }], pageNumber, pageCount }, department by department in the order of the
// Team leads list. team is the code of the team on the screen, or '' for both teams.
export function mondayRosterPages(content, now = new Date(), team = '') {
  const tasks = forTeam(visibleTasks(content, now), team);
  const pages = [];

  departmentsOf(content, tasks, now).forEach(department => {
    const people = peopleOf(tasksOfDepartment(tasks, department));
    const pageCount = Math.ceil(people.length / rosterPageRows);

    for (let index = 0; index < pageCount; index++) {
      pages.push({ department: department.name, rows: people.slice(index * rosterPageRows, (index + 1) * rosterPageRows), pageNumber: index + 1, pageCount: pageCount });
    }
  });
  return pages;
}

export function makeMondayRosterTurns() {
  const nextTurn = makePages(1);

  return function next(content, now, team) {
    return nextTurn(mondayRosterPages(content, now, team)).items[0] || null;
  };
}
