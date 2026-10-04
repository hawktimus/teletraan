// A card for the lead of each subteam.

import { plateMarkup, scanMarkup, boltMarkup } from '../../core/plate.js';
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
  const cards = subteamsFor(content).map((subteam, index) => cardMarkup(subteam, index)).join('');

  host.innerHTML = `
    <section class="panel team-leads" data-sequence="grid1">
      ${plateMarkup('grid1')}
      ${scanMarkup('grid1')}

      <div class="header">
        <h2 class="title" data-part="title">LEADS</h2>
        <div data-part="tag">${doubleSlash()}</div>
      </div>

      <div class="cards">${cards}</div>
    </section>`;
}

// SUBTEAM NAME LEAD, or just LEAD when the subteam has no name
function labelFor(subteam) {
  const name = String(subteam.name || '').trim().toUpperCase();
  return name ? name + ' LEAD' : 'LEAD';
}

// A pocket cut into the plate. Its bottom right corner is cut at the same
// angle as the panel's. The first polygon is only the light edge that shows
// below the pocket.
function cardMarkup(subteam, index) {
  return `
    <div class="card" data-part="row" data-index="${index}">
      <svg class="card-shape" width="538" height="168" viewBox="0 0 538 168">
        <polygon class="pocket-lit" points="2,4 536,4 536,136 496,168 2,168"/>
        <polygon class="pocket" points="2,2 536,2 536,134 496,166 2,166"/>
        <rect class="card-cap" x="4" y="4" width="16" height="160"/>
        <rect class="card-cap-edge" x="20" y="4" width="2" height="160"/>
        ${boltMarkup(518, 20, 20)}
      </svg>
      <div class="card-text">
        <div class="card-label">${escapeHtml(labelFor(subteam))}</div>
        <div class="card-name">${escapeHtml(subteam.lead)}</div>
      </div>
    </div>`;
}
