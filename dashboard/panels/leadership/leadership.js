// Coaches, captains and mentors, a portrait each, three to a page. When there
// are more people, each time the panel comes round it shows the next page.

import { doubleSlash } from '../../core/marks.js';
import { hasText } from '../../core/text.js';
import { visibleItems } from '../../core/content.js';
import { makePages } from '../../core/turns.js';
import { photoAddress, preloadPhotos, slotMarkup, slotsPerPage, watchPhotos } from '../../core/portrait.js';

const nextPage = makePages(slotsPerPage);

// Roles are shown in this order. Any other role comes after them.
const roleOrder = ['coach', 'captain', 'mentor'];

// The role also decides the metal of the frame round the portrait: gold, silver
// or red. To change a colour, change a word here. A role that is not in this
// list keeps the colour of the panel's own frame.
const roleMetals = { coach: 'red', captain: 'gold', mentor: 'silver' };

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
    .map(entry => entry.person);
}

export function hasContent(content) {
  return peopleFor(content).length > 0;
}

export function mount(host, content) {
  const page = nextPage(peopleFor(content));
  const slots = page.items.map(personSlot).join('');

  host.innerHTML = `
    <section class="page leadership">
      <div class="header">
        <h2 class="title" data-slat="title">TEAM</h2>
        <div class="tag" data-slat="tag">
          <span class="tag-text">LEADERSHIP</span>
          ${doubleSlash()}
        </div>
      </div>

      <div class="slots">${slots}</div>
    </section>`;

  watchPhotos(host);
  preloadPhotos(page.upcoming);
}

// What is written under the name is the typed title, or the role if there is none
function personSlot(person) {
  const role = String(person.role || '').trim().toLowerCase();
  return slotMarkup({
    name: person.name,
    role: String(person.title || person.role || '').toUpperCase(),
    address: photoAddress(person),
    metal: roleMetals[role],
  });
}
