// Coaches, captains and mentors, a portrait each. A page never mixes the
// roles, and a role with more people than fit on a page is split evenly over
// more pages (core/leadership.js). Each time the panel comes round it shows the
// next page.

import { doubleSlash } from '../../core/marks.js';
import { makePages } from '../../core/turns.js';
import { leadershipPages } from '../../core/leadership.js';
import { photoAddress, preloadPhotos, slotMarkup, watchPhotos } from '../../core/portrait.js';

// One page at a time: each item of the list given to nextPage is a whole page
const nextPage = makePages(1);

// The role also decides the metal of the frame round the portrait: gold, silver
// or red. To change a colour, change a word here. A role that is not in this
// list keeps the colour of the panel's own frame.
const roleMetals = { coach: 'red', captain: 'gold', mentor: 'silver' };

export function hasContent(content) {
  return leadershipPages(content.people).length > 0;
}

export function mount(host, content) {
  const turn = nextPage(leadershipPages(content.people));
  const people = turn.items[0] || [];
  const slots = people.map(personSlot).join('');

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
  preloadPhotos(turn.upcoming[0] || []);
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
