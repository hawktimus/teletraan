// Department tasks: the tasks of one department of the Monday boards, in one list (Open or Done), for both teams or one.
// The row of the rotation says which: page is { team, department, list }. core/monday-views.js works out the rows, their order and the
// pages. A row is the project name, which takes the room the other columns leave, and fixed columns at the right: the due date (or a
// LATE chip), the priority, the contact and the status chip. A column is drawn only when a task of the list has a value for it. The
// pages are as many rows as fit the body; a longer list holds, then moves up one page at a time (scrollPages, which core/schedule.js
// reads, and scrollCard in frame.js). A department with nothing in the list has nothing to show, and the rotation leaves the row out.

import { chipMarkup, countLineMarkup, emptyLineMarkup, layoutNow, pageMarkup, pagePlaces, pagesMarkup, boardHeader } from '../../core/monday-draw.js';
import { departmentEmpty, departmentView, emptyWords } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export function hasContent(content, page) {
  return departmentView(content, new Date(), page, layoutNow()) !== null;
}

// How many pages the panel holds for: as many as the rows need
export function scrollPages(content, page) {
  const view = departmentView(content, new Date(), page, layoutNow());
  return view ? view.pages : 1;
}

function rowMarkup(row, columns) {
  const cells = [];
  if (columns.date) {
    cells.push(row.late ? '<span class="date"><span class="chip chip-late">LATE</span></span>' : `<span class="date${row.date === emptyWords.date ? ' blank' : ''}">${row.date === emptyWords.date ? '' : escapeHtml(row.date)}</span>`);
  }
  if (columns.priority) cells.push(`<span class="priority priority-${row.priorityLevel}">${row.priorityLevel === 'none' ? '' : escapeHtml(row.priority)}</span>`);
  if (columns.contact) cells.push(`<span class="contact">${row.contact === emptyWords.contact ? '' : escapeHtml(row.contact)}</span>`);

  const note = row.note === '' ? '' : `<span class="note">${escapeHtml(row.note)}</span>`;
  return `<div class="row"><span class="project">${escapeHtml(row.project)}</span><span class="details">${cells.join('')}</span>${chipMarkup(row.status)}${note}</div>`;
}

// The widths of the fixed columns are in panel.css (--w-date and the others); the grid is made here from the columns in use, and the
// project takes the rest. Each optional column that is used makes the name a little narrower, so with three the name is at 44px.
function gridOf(columns) {
  const wanted = ['date', 'priority', 'contact'].filter(name => columns[name]);
  return { cols: 'minmax(0, 1fr) ' + wanted.map(name => `var(--w-${name})`).concat('var(--w-chip)').join(' '), count: wanted.length };
}

export function markupFor(content, now, page) {
  const view = departmentView(content, now, page, layoutNow());
  if (!view) {
    const empty = departmentEmpty(content, page);
    return pageMarkup('monday-department', boardHeader(empty.title, empty.team, content, now), emptyLineMarkup(empty.line));
  }

  const grid = gridOf(view.columns);
  const more = view.more > 0 ? `+${view.more} MORE ON MONDAY` : '';
  const inner = `
      ${countLineMarkup(view.countWords, [view.tallyWords, more], pagePlaces(view.pages))}
      <div class="rows cols-${grid.count}" style="--cols: ${grid.cols}">${pagesMarkup(view.pageRows, row => rowMarkup(row, view.columns))}</div>`;

  return pageMarkup('monday-department', boardHeader(view.title, view.team, content, now), inner, view.pages > 1);
}

export function mount(host, content, page) {
  host.innerHTML = markupFor(content, new Date(), page);
}
