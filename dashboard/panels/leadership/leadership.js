// The coaches and captains, one row each. A page holds four rows at the standard
// portrait size and fewer at a bigger one, and each time the panel comes round it
// shows the next page, so everyone is shown (core/leadership.js).

import { doubleSlash } from '../../core/marks.js';
import { makePages } from '../../core/turns.js';
import { leaders } from '../../core/leadership.js';
import { photoAddress, preloadPhotos, rowLayout, rowsMarkup, rowsPerPage, watchPhotos } from '../../core/portrait.js';

const nextPage = makePages(rowsPerPage);

// The role also decides the metal of the frame round the picture: gold, silver
// or red. To change a colour, change a word here. A role that is not in this
// list keeps the colour of the panel's own frame.
const roleMetals = { coach: 'red', captain: 'gold', mentor: 'silver' };

export function hasContent(content) {
  return leaders(content.people).length > 0;
}

export function mount(host, content) {
  const scale = content.settings && content.settings.portraitScale;
  const page = nextPage(leaders(content.people), rowLayout(scale).rows);
  const rows = page.items.map(personRow);

  host.innerHTML = `
    <section class="page leadership">
      <div class="header">
        <h2 class="title" data-slat="title">TEAM</h2>
        <div class="tag" data-slat="tag">
          <span class="tag-text">LEADERSHIP</span>
          ${doubleSlash()}
        </div>
      </div>

      ${rowsMarkup(rows, scale)}
    </section>`;

  watchPhotos(host);
  preloadPhotos(page.upcoming);
}

// What is written at the right end is the typed title, or the role if there is none.
function personRow(person) {
  const role = String(person.role || '').trim().toLowerCase();
  return {
    name: person.name,
    role: String(person.title || person.role || '').toUpperCase(),
    address: photoAddress(person),
    metal: roleMetals[role],
  };
}
