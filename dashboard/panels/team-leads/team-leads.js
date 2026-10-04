// A card for the lead of each subteam.

import { cardMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';

// Two columns by three rows. Subteams after the sixth are not shown.
const MAX_CARDS = 6;

function subteamsFor(content) {
  return visibleItems(content.subteams)
    .filter(subteam => hasText(subteam.lead))
    .slice(0, MAX_CARDS);
}

export function hasContent(content) {
  return subteamsFor(content).length > 0;
}

export function mount(host, content) {
  const cards = subteamsFor(content).map(leadCard).join('');

  host.innerHTML = `
    <section class="page team-leads">
      <div class="header">
        <h2 class="title" data-slat="title">TEAM</h2>
        <div class="tag" data-slat="tag">
          <span class="tag-text">TEAM LEADS</span>
          ${doubleSlash()}
        </div>
      </div>

      <div class="cards">${cards}</div>
    </section>`;
}

// SUBTEAM NAME LEAD, or just LEAD when the subteam has no name
function labelFor(subteam) {
  const name = String(subteam.name || '').trim().toUpperCase();
  return name ? name + ' LEAD' : 'LEAD';
}

// Each card turns over as one piece: its purple plate, its metal edge and
// its words
function leadCard(subteam) {
  return `
    <div class="card" data-slat="item">
      ${cardMarkup(538, 168)}
      <div class="card-text">
        <div class="card-label">${escapeHtml(labelFor(subteam))}</div>
        <div class="card-name">${escapeHtml(subteam.lead)}</div>
      </div>
    </div>`;
}
