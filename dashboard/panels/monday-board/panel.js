// The board panel of a Monday row: four columns, To Do, In Progress, Review and Done, each with its count and two cards
// in the order of rank (core/monday.js), then how many more there are. A stuck task is in Review with a red edge and
// a STUCK tag. A card is its department, its title on at most two lines and the first name of who to ask. When a Screen plays
// the panel twice in a row, the second time shows the third and fourth cards of each column (page.turn, which
// core/screens.js sets from the rows).

import { boardEmptyMarkup, boardHeader, pageMarkup } from '../../core/monday-draw.js';
import { boardView, viewOf } from '../../core/monday-views.js';
import { escapeHtml } from '../../core/text.js';

export function hasContent(content, page) {
  return viewOf('monday-board', content, new Date(), page) !== null;
}

function cardMarkup(card) {
  const tag = card.stuck ? '<span class="stuck-tag">STUCK</span>' : '';
  return `<div class="card${card.stuck ? ' card-stuck' : ''}"><div class="card-department">${escapeHtml(card.department)}</div><div class="card-title">${escapeHtml(card.title)}</div><div class="card-poc"><span>${escapeHtml(card.poc)}</span>${tag}</div></div>`;
}

function columnMarkup(column) {
  const more = column.more > 0 ? `<div class="more">+${column.more} MORE</div>` : '';
  return `<div class="column column-${column.id}"><div class="column-head"><span class="column-name">${column.name}</span><span class="count">${column.count}</span></div>${column.cards.map(cardMarkup).join('')}${more}</div>`;
}

export function markupFor(content, now, page) {
  const view = boardView(content, now, page);
  if (!view) return pageMarkup('monday-board', boardHeader('BOARD', '', content, now), boardEmptyMarkup(content));

  return pageMarkup('monday-board', boardHeader(view.title, view.team.name, content, now), `<div class="columns">${view.columns.map(columnMarkup).join('')}</div>`);
}

export function mount(host, content, page) {
  host.innerHTML = markupFor(content, new Date(), page);
}
