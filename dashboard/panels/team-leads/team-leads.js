// The lead of each department, one row each, four to a page. When there are
// more departments, each time the panel comes round it shows the next page
// (core/team-leads.js).

import { doubleSlash } from '../../core/marks.js';
import { makePages } from '../../core/turns.js';
import { departmentRows } from '../../core/team-leads.js';
import { personNamed, photoAddress, preloadPhotos, rowsMarkup, rowsPerPage, watchPhotos } from '../../core/portrait.js';

const nextPage = makePages(rowsPerPage);

export function hasContent(content) {
  return departmentRows(content.subteams).length > 0;
}

export function mount(host, content) {
  const page = nextPage(departmentRows(content.subteams));
  const rows = page.items.map(row => leadRow(row, content));

  host.innerHTML = `
    <section class="page team-leads">
      <div class="header">
        <h2 class="title" data-slat="title">TEAM</h2>
        <div class="tag" data-slat="tag">
          <span class="tag-text">TEAM LEADS</span>
          ${doubleSlash()}
        </div>
      </div>

      ${rowsMarkup(rows, content.settings && content.settings.portraitScale)}
    </section>`;

  watchPhotos(host);
  preloadPhotos(page.upcoming.map(row => personNamed(content.people, row.lead)));
}

// A department has only the lead's name. The photo is the photo of the person
// with that name under Leadership, if there is one.
function leadRow(row, content) {
  return {
    name: row.name,
    role: row.role,
    address: photoAddress(personNamed(content.people, row.lead)),
  };
}
