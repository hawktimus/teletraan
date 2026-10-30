// Projects: the projects of the Projects (Mentors) board, for the Robotics view only (both teams, no Team on a row). A row is the mentor's first
// name, the project name, an optional bar with the percent complete and the status chip; the helpers are a second line when a project
// has some. A value the project does not have is not drawn, and a column no project has is not drawn either. The order is Stuck, In
// Progress, In Review, To Do and then up to 3 done in the last 14 days (core/monday-views.js, projectsView). A longer list holds, then
// moves up one page at a time (scrollPages). With no project to show the rotation leaves the row out.

import { boardHeader, chipMarkup, countLineMarkup, emptyLineMarkup, layoutNow, pageMarkup, pagePlaces, pagesMarkup } from '../../core/monday-draw.js';
import { projectsEmpty, projectsView } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export function hasContent(content, page) {
  return projectsView(content, new Date(), page, layoutNow()) !== null;
}

export function scrollPages(content, page) {
  const view = projectsView(content, new Date(), page, layoutNow());
  return view ? view.pages : 1;
}

function percentMarkup(percent) {
  return `<span class="percent"><i class="percent-track"><i class="percent-fill" style="width: ${percent}%"></i></i><b>${percent}%</b></span>`;
}

function rowMarkup(row, columns) {
  const cells = [];
  if (columns.mentor) cells.push(`<span class="mentor">${escapeHtml(row.mentor)}</span>`);
  if (columns.percent) cells.push(row.percent === null ? '<span class="percent"></span>' : percentMarkup(row.percent));

  const helpers = row.helperWords === '' ? '' : `<span class="note">${escapeHtml(row.helperWords)}</span>`;
  return `<div class="row"><span class="project">${escapeHtml(row.project)}</span><span class="details">${cells.join('')}</span>${chipMarkup(row.status)}${helpers}</div>`;
}

// The grid of a row: the mentor at the left, the name, the bar and the chip. The widths are in panel.css.
function gridOf(columns) {
  const wanted = ['mentor', 'percent'].filter(name => columns[name]);
  const parts = (columns.mentor ? ['var(--w-mentor)'] : []).concat('minmax(0, 1fr)', columns.percent ? ['var(--w-percent)'] : [], 'var(--w-chip)');
  return { cols: parts.join(' '), count: wanted.length };
}

export function markupFor(content, now, page) {
  const view = projectsView(content, now, page, layoutNow());
  if (!view) {
    const empty = projectsEmpty(content);
    return pageMarkup('monday-projects', boardHeader(empty.title, empty.team, content, now), emptyLineMarkup(empty.line));
  }

  const grid = gridOf(view.columns);
  const more = view.more > 0 ? `+${view.more} MORE ON MONDAY` : '';
  const inner = `
      ${countLineMarkup(view.countWords, [view.tallyWords, more], pagePlaces(view.pages))}
      <div class="rows cols-${grid.count}" style="--cols: ${grid.cols}">${pagesMarkup(view.pageRows, row => rowMarkup(row, view.columns))}</div>`;

  return pageMarkup('monday-projects', boardHeader(view.title, view.team, content, now), inner, view.pages > 1);
}

export function mount(host, content, page) {
  host.innerHTML = markupFor(content, new Date(), page);
}
