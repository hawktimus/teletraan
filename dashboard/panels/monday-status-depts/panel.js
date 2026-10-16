// The status by department panel of a Monday row, for both teams: one row for each department that has a task, with
// its tasks as a bar of five segments (to do, in progress, in review, stuck, done) and done out of all of them at
// the right. The longest bar is the width of its track, and the others are in proportion. The header says the totals.

import { boardEmptyMarkup, boardHeader, agoWords, legendMarkup, pageMarkup } from '../../core/monday-draw.js';
import { statusOrder, statusView } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export function hasContent(content) {
  return statusView(content, new Date()) !== null;
}

function rowMarkup(row, longest) {
  const segments = statusOrder
    .filter(status => row.counts[status] > 0)
    .map(status => `<i class="segment chip-${status}" style="flex: ${row.counts[status]} 0 0"></i>`)
    .join('');

  return `<div class="row"><span class="department">${escapeHtml(row.name)}</span><span class="track"><span class="bar" style="width: ${(row.total / longest) * 100}%">${segments}</span></span><span class="share">${row.done}/${row.total}</span></div>`;
}

export function markupFor(content, now) {
  const view = statusView(content, now);
  if (!view) return pageMarkup('monday-status-depts', boardHeader('STATUS BY DEPARTMENT', '', content, now, '', true), boardEmptyMarkup(content));

  const totals = `${view.totals.tasks} TASKS · ${view.totals.stuck} STUCK · ${view.totals.overdue} OVERDUE`;
  const inner = `
      <div class="rows">${view.rows.map(row => rowMarkup(row, view.longest)).join('')}</div>
      ${legendMarkup()}
      <span class="age">${escapeHtml(agoWords(content.monday, now))}</span>`;

  return pageMarkup('monday-status-depts', boardHeader('STATUS BY DEPARTMENT', '', content, now, totals, true), inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
