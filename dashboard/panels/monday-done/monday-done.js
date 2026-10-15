// The done panel of a Monday row: the last six tasks a team finished, newest first by the date the board says they
// were completed (completedOn), from every department. A task is done when its Status is Done, whatever group it
// sits in. Under them: how many were done in the last seven days, in all, and the hours they were worth.

import { boardEmptyMarkup, boardHeader, countersMarkup, pageMarkup } from '../../core/monday-draw.js';
import { doneView } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export function hasContent(content, page = 1) {
  return doneView(content, new Date(), page) !== null;
}

function rowMarkup(row) {
  return `<div class="row"><span class="department">${escapeHtml(row.department)}</span><span class="row-title">${escapeHtml(row.title)}</span><span class="poc">${escapeHtml(row.poc)}</span><span class="date"><i class="square"></i>${escapeHtml(row.date)}</span></div>`;
}

export function markupFor(content, now, page = 1) {
  const view = doneView(content, now, page);
  if (!view) return pageMarkup('monday-done', boardHeader('DONE', '', content, now, 'LAST 6', true), boardEmptyMarkup(content));

  const inner = `
      <div class="rows">${view.rows.map(rowMarkup).join('')}</div>
      ${countersMarkup([{ label: 'THIS WEEK', value: view.counts.week }, { label: 'THIS SEASON', value: view.counts.season }, { label: 'HOURS', value: view.counts.hours }])}`;

  return pageMarkup('monday-done', boardHeader(view.title, view.team.name, content, now, 'LAST 6 · BY DATE COMPLETED', true), inner);
}

export function mount(host, content, page = 1) {
  host.innerHTML = markupFor(content, new Date(), page);
}
