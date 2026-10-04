// Coaches, captains and mentors, one card each.

import { cardMarkup } from '../../core/plate.js';
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
  const cards = peopleFor(content).map(personCard).join('');

  host.innerHTML = `
    <section class="page leadership">
      <div class="header">
        <h2 class="title" data-slat="title">TEAM</h2>
        <div class="tag" data-slat="tag">
          <span class="tag-text">LEADERSHIP</span>
          ${doubleSlash()}
        </div>
      </div>

      <div class="cards">${cards}</div>
    </section>`;
}

// Each card turns over as one piece: its purple plate, its metal edge and
// its words
function personCard(person) {
  const role = String(person.role || '').toUpperCase();

  return `
    <div class="card" data-slat="item">
      ${cardMarkup(538, 168)}
      <div class="card-text">
        <div class="card-role">${escapeHtml(role)}</div>
        <div class="card-name">${escapeHtml(person.name)}</div>
      </div>
    </div>`;
}
