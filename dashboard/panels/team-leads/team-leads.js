// The lead of each department, one row each, four to a page at the standard
// portrait size and fewer at a bigger one. When there are more departments, each
// time the panel comes round it shows the next page (core/team-leads.js).

import { doubleSlash } from '../../core/marks.js';
import { makePages } from '../../core/turns.js';
import { portraitPercentOf, visibleItems } from '../../core/content.js';
import { departmentRows } from '../../core/team-leads.js';
import { leadAddress, portraitLook, preloadLeadPhotos, rowLayout, rowsMarkup, rowsPerPage, watchPhotos } from '../../core/portrait.js';
import { pageTeamName, teamChipMarkup, teamNameOf, titleClass } from '../../core/team-title.js';
import { wantedTeam } from '../../core/teams.js';

const nextPage = makePages(rowsPerPage);

export function hasContent(content) {
  return departmentRows(content.subteams).length > 0;
}

export function mount(host, content) {
  const scale = portraitPercentOf(content.settings, 'rosterPortrait');
  const page = nextPage(departmentRows(content.subteams), rowLayout(scale).rows);
  const rows = page.items.map(row => leadRow(row, content));

  // the header names the team: the team on the screen, or both teams when every department is for both
  const chip = pageTeamName(visibleItems(content.subteams), teamNameOf(wantedTeam()));

  host.innerHTML = `
    <section class="page team-leads">
      <div class="header">
        <h2 class="${titleClass('TEAM LEADS', chip)}" data-slat="title">TEAM LEADS</h2>
        <div class="tag" data-slat="tag">
          ${teamChipMarkup(chip)}
          ${doubleSlash()}
        </div>
      </div>

      ${rowsMarkup(rows, scale, portraitLook(content.settings))}
    </section>`;

  watchPhotos(host);
  preloadLeadPhotos(page.upcoming, content.people);
}

// The photo is the one of the Team lead entry. Without one, it is the photo of
// the person with the lead's name under Leadership, if there is one.
function leadRow(row, content) {
  return {
    name: row.name,
    role: row.role,
    line: row.line,
    chip: row.chip,
    address: leadAddress(row, content.people),
  };
}
