// The status pie of a Monday row: a donut of the tasks of a team, or of one department of it, by status (To do, In progress,
// Review, Stuck, Done), with the number of tasks in the middle and a legend of words beside it. The rows of the board come from
// core/monday-views.js (pieView) and the slices from core/monday-pie.js. Nothing in it moves: the page change brings it in.

import { boardEmptyMarkup, boardHeader, pageMarkup } from '../../core/monday-draw.js';
import { pieGeometry, pieView, viewOf } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export function hasContent(content, page) {
  return viewOf('monday-pie', content, new Date(), page) !== null;
}

function legendRow(item) {
  return `<div class="pie-row"><i class="swatch chip-${item.status}"></i><span class="pie-name">${escapeHtml(item.name)}</span><span class="pie-count">${item.count}</span><span class="pie-percent">${item.percent}%</span></div>`;
}

export function markupFor(content, now, page) {
  const view = pieView(content, now, page);
  if (!view) return pageMarkup('monday-pie', boardHeader('STATUS', '', content, now), boardEmptyMarkup(content));

  const slices = view.slices.map(slice => `<path class="slice slice-${slice.status}" d="${slice.path}"/>`).join('');
  const middle = pieGeometry.cx;
  const inner = `
      <div class="pie-body">
        <svg class="pie" viewBox="0 0 ${pieGeometry.cx * 2} ${pieGeometry.cy * 2}" role="img" aria-label="${escapeHtml(view.title)}">
          ${slices}
          <text class="pie-total" x="${middle}" y="${pieGeometry.cy + 20}">${view.total}</text>
          <text class="pie-unit" x="${middle}" y="${pieGeometry.cy + 70}">TASKS</text>
        </svg>
        <div class="pie-legend">${view.legend.map(legendRow).join('')}</div>
      </div>`;

  return pageMarkup('monday-pie', boardHeader(view.title, view.team.name, content, now, 'BY STATUS'), inner);
}

export function mount(host, content, page) {
  host.innerHTML = markupFor(content, new Date(), page);
}
