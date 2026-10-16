// The tasks panel of a Monday row: the tasks of one team and one department, up to ten, five at a time. The row of
// the Screen says the team and the department (a Team lead): page is { team, department }. A department of ''
// is the first one that has tasks, and a number is the page of an older row, the nth department with tasks. Which
// tasks and in what order are the rules in core/monday.js (visibleTasks, forTeam, forDepartment, rank), and
// core/monday-views.js works out the rows. With more than five rows the panel holds, then the list scrolls up by
// five rows and holds again (scrollPages, which core/schedule.js reads, and scrollCard in frame.js). A department
// with no visible task has nothing to show, and the Screens leave the row out.

import { boardEmptyMarkup, boardHeader, chipMarkup, countersMarkup, markerMarkup, pageMarkup, priorityMark, rowsWindow } from '../../core/monday-draw.js';
import { tasksView } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export function hasContent(content, page = 1) {
  return tasksView(content, new Date(), page) !== null;
}

// How many pages the panel has to hold for: one, and one more for each five rows past the first five
export function scrollPages(content, page = 1) {
  const view = tasksView(content, new Date(), page);
  return view ? view.pages : 1;
}

// A row: the status, the title on one line, who to ask, the due date (with OVERDUE before it when it is past) and the priority
function rowMarkup(row) {
  const late = row.overdue ? '<span class="chip chip-overdue">OVERDUE</span>' : '';
  return `<div class="row${row.overdue ? ' row-overdue' : ''}">${chipMarkup(row.status)}<span class="row-title">${escapeHtml(row.title)}</span><span class="poc">${escapeHtml(row.poc)}</span><span class="due">${late}<span class="due-date">${escapeHtml(row.due)}</span></span>${priorityMark(row.priority)}</div>`;
}

export function markupFor(content, now, page = 1) {
  const view = tasksView(content, now, page);
  if (!view) return pageMarkup('monday-tasks', boardHeader('TASKS', '', content, now), boardEmptyMarkup(content));

  const inner = `
      ${rowsWindow(view.rows.map(rowMarkup))}
      ${countersMarkup([{ label: 'OVERDUE', value: view.counts.overdue }, { label: 'OPEN', value: view.counts.open }, { label: 'DONE', value: view.counts.done }])}
      ${markerMarkup(view.rows.length, 'TASKS', true)}`;

  return pageMarkup('monday-tasks', boardHeader(view.title, view.team.name, content, now), inner, true);
}

export function mount(host, content, page = 1) {
  host.innerHTML = markupFor(content, new Date(), page);
}
