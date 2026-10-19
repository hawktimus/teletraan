// Department tasks: the tasks of one department of the Monday boards, in one list (Open or Done), for both teams or one.
// The row of the rotation says which: page is { team, department, list }. core/monday-views.js works out the rows and their
// order. The table has five columns: Status, Project, Contact, Priority and Estimated Completion Date. With more than four
// rows the list holds, then moves up four rows and holds again (scrollPages, which core/schedule.js reads, and scrollCard in
// frame.js). A department with nothing in the list has nothing to show, and the rotation leaves the row out.

import { boardEmptyMarkup, boardHeader, chipMarkup, countersMarkup, pageMarkup } from '../../core/monday-draw.js';
import { departmentView, emptyWords } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export function hasContent(content, page) {
  return departmentView(content, new Date(), page) !== null;
}

// How many pages the panel holds for: one for each four rows
export function scrollPages(content, page) {
  const view = departmentView(content, new Date(), page);
  return view ? view.pages : 1;
}

// A project name longer than this is drawn at 44px on up to two lines, and a shorter one at the body size on one
const shortProject = 13;

const columns = ['STATUS', 'PROJECT', 'CONTACT', 'PRIORITY', 'ESTIMATED COMPLETION DATE'];

function cell(name, text, empty) {
  return `<span class="${name}${text === empty ? ' none' : ''}">${escapeHtml(text)}</span>`;
}

function rowMarkup(row) {
  const long = row.project.length > shortProject ? ' project-long' : '';
  return `<div class="row">${chipMarkup(row.status)}<span class="project${long}">${escapeHtml(row.project)}</span>` +
    cell('contact', row.contact, emptyWords.contact) +
    `<span class="priority priority-${row.priorityLevel}">${escapeHtml(row.priority)}</span>` +
    cell('date', row.date, emptyWords.date) + '</div>';
}

// The place of the page in words, 1 OF 3. The stylesheet shows the one of the page in view (data-scroll-page).
function markerMarkup(view) {
  const more = view.more > 0 ? `<span class="more">+${view.more} MORE ON MONDAY</span>` : '';
  if (view.pages < 2) return more === '' ? '' : `<div class="marker">${more}</div>`;

  const places = [];
  for (let page = 1; page <= view.pages; page++) places.push(`<span class="place place-${page}">${page} OF ${view.pages}</span>`);
  return `<div class="marker">${more}${places.join('')}</div>`;
}

export function markupFor(content, now, page) {
  const view = departmentView(content, now, page);
  if (!view) return pageMarkup('monday-department', boardHeader('DEPARTMENT TASKS', '', content, now), boardEmptyMarkup(content));

  const inner = `
      <div class="columns">${columns.map(name => `<span>${name}</span>`).join('')}</div>
      <div class="rows-window"><div data-scroll-list>${view.rows.map(rowMarkup).join('')}</div></div>
      ${countersMarkup([{ label: 'OPEN', value: view.counts.open }, { label: 'DONE', value: view.counts.done }])}
      ${markerMarkup(view)}`;

  return pageMarkup('monday-department', boardHeader(view.title, view.team, content, now), inner, view.pages > 1);
}

export function mount(host, content, page) {
  host.innerHTML = markupFor(content, new Date(), page);
}
