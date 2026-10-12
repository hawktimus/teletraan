// The progress card of both teams, the last of the two (core/monday.js, bothSteps). A
// row for each department and each team that has board tasks: the team, the department, one bar of its
// tasks in three stacks, done, in progress and backlog, and how many are done out of all of them. The rows
// alternate between the teams, a department's rows together, and there are ten at the most, five at a time,
// scrolled like the tasks card (scrollPages and scrollCard in frame.js). The bars are as long as the tasks
// are many, the longest filling its room. The card always draws, with a sentence when there are no rows.

import { emptyMarkup } from '../../core/competition-draw.js';
import { bothRows, mostRows, pagesOf, statuses } from '../../core/monday.js';
import { headerMarkup, markerMarkup, noRowsSentence, pageMarkup, rowsWindow, teamTagMarkup, teamsForBoth } from '../../core/monday-draw.js';
import { escapeHtml } from '../../core/text.js';

// The bar is 44 high and as wide as this at the most. The stacks follow each other in this order.
const BAR = { width: 400, height: 44 };
const stackOrder = ['done', 'progress', 'backlog'].map(id => statuses.find(stack => stack.id === id));

// The rows of the card: { rows, total }. A row is { team, lead, backlog, progress, done, total }, counting
// that team's board tasks of the department. total is the rows there are before the card cuts them to ten.
export function progressFor(content, now) {
  const rows = bothRows(content, teamsForBoth(content), now).map(row => {
    const counts = { team: row.team, lead: row.lead };
    statuses.forEach(stack => {
      counts[stack.id] = row.tasks.filter(task => task.status === stack.status).length;
    });
    counts.total = counts.backlog + counts.progress + counts.done;
    return counts;
  }).filter(row => row.total > 0);

  return { rows: rows.slice(0, mostRows), total: rows.length };
}

// How many pages the card has to hold for
export function scrollPages(content) {
  return pagesOf(progressFor(content, new Date()).rows.length);
}

// One bar, the stacks each as long as the count so far says, so that rounding never makes it too long
function barMarkup(row, widest) {
  const parts = [];
  let counted = 0;
  let left = 0;

  stackOrder.forEach(stack => {
    counted += row[stack.id];
    const end = Math.round((counted / widest) * BAR.width);
    if (end > left) parts.push(`<rect class="seg seg-${stack.id}" x="${left}" y="0" width="${end - left}" height="${BAR.height}"/>`);
    left = end;
  });
  return `<svg class="stack" width="${BAR.width}" height="${BAR.height}" viewBox="0 0 ${BAR.width} ${BAR.height}" aria-hidden="true">${parts.join('')}</svg>`;
}

// tagged is true when any row of the card has a team, so a row with none keeps the room of the label
function rowMarkup(row, widest, tagged) {
  return `<div class="row">${teamTagMarkup(row.team, tagged)}<span class="department">${escapeHtml(row.lead.toUpperCase())}</span>${barMarkup(row, widest)}<span class="count">${row.done}/${row.total}</span></div>`;
}

// A square and a word for each stack, along the top, in the order of the bars
function legendMarkup() {
  return `<div class="legend">${stackOrder.map(stack => `<span class="key"><span class="swatch seg-${stack.id}"></span>${stack.label}</span>`).join('')}</div>`;
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const found = progressFor(content, now);
  const header = headerMarkup('PROGRESS', '', content.monday, now);
  if (found.rows.length === 0) return pageMarkup('monday-progress-both', header, emptyMarkup(noRowsSentence(content)));

  const widest = Math.max(1, ...found.rows.map(row => row.total));
  const tagged = found.rows.some(row => row.team);
  const inner = `
      ${legendMarkup()}
      ${rowsWindow(found.rows.map(row => rowMarkup(row, widest, tagged)))}
      ${markerMarkup(found.rows.length, 'ROWS')}`;

  return pageMarkup('monday-progress-both', header, inner, true);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
