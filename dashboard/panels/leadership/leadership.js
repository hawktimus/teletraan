// Coaches, captains and mentors, one card each.

import { plateMarkup, scanMarkup, boltMarkup } from '../../core/plate.js';
import { doubleSlash } from '../../core/marks.js';
import { escapeHtml, hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';

// Two columns by three rows. People after the sixth are not shown.
const MAX_CARDS = 6;

// Roles are shown in this order. Any other role comes after them.
const roleOrder = ['coach', 'captain', 'mentor'];

function rankOf(person) {
  const rank = roleOrder.indexOf(String(person.role || '').trim().toLowerCase());
  return rank === -1 ? roleOrder.length : rank;
}

function peopleFor(content) {
  return visibleItems(content.people)
    .filter(person => hasText(person.name) || hasText(person.role))
    .map((person, position) => ({ person: person, position: position, rank: rankOf(person) }))
    // the position keeps people with the same role in the order they were typed,
    // which older browsers do not promise when sorting
    .sort((first, second) => first.rank - second.rank || first.position - second.position)
    .map(entry => entry.person)
    .slice(0, MAX_CARDS);
}

export function hasContent(content) {
  return peopleFor(content).length > 0;
}

export function mount(host, content) {
  const cards = peopleFor(content).map((person, index) => cardMarkup(person, index)).join('');

  host.innerHTML = `
    <section class="panel leadership" data-sequence="grid1">
      ${plateMarkup('grid1')}
      ${scanMarkup('grid1')}

      <div class="header">
        <h2 class="title" data-part="title">LEADERS</h2>
        <div data-part="tag">${doubleSlash()}</div>
      </div>

      <div class="cards">${cards}</div>
    </section>`;
}

// A pocket cut into the plate. Its bottom right corner is cut at the same
// angle as the panel's. The first polygon is only the light edge that shows
// below the pocket.
function cardMarkup(person, index) {
  const role = String(person.role || '').toUpperCase();

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
        <div class="card-role">${escapeHtml(role)}</div>
        <div class="card-name">${escapeHtml(person.name)}</div>
      </div>
    </div>`;
}
