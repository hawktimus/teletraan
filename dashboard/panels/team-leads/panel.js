// The lead of each department, one row each, four to a page at the standard
// portrait size and fewer at a bigger one. When there are more departments, each
// time the panel comes round it shows the next page (core/team-leads.js).

import { markBeside } from '../../core/marks.js';
import { makePages } from '../../core/turns.js';
import { portraitPercentOf, visibleItems } from '../../core/content.js';
import { departmentRows } from '../../core/team-leads.js';
import { leadAddress, portraitLook, preloadLeadPhotos, rowLayout, rowsMarkup, rowsPerPage, watchPhotos } from '../../core/portrait.js';
import { chipWidth, pageTeamName, teamChipMarkup, teamNameOf, titleClass } from '../../core/team-title.js';
import { wantedTeam } from '../../core/teams.js';

const nextPage = makePages(rowsPerPage);

// A row of the rotation can ask for one page of the list: part 1 is the first page and part 2 the second
function partOf(page) {
  return page && typeof page === 'object' && (page.part === 1 || page.part === 2) ? page.part : 0;
}

// The departments on the page a row asked for, or all of them when it asked for none
function rowsOfPart(content, page) {
  const all = departmentRows(content.subteams);
  const part = partOf(page);
  if (part === 0) return all;

  const per = rowLayout(portraitPercentOf(content.settings, 'rosterPortrait')).rows;
  return all.slice((part - 1) * per, part * per);
}

export function hasContent(content, page) {
  return rowsOfPart(content, page).length > 0;
}

export function mount(host, content, asked) {
  const scale = portraitPercentOf(content.settings, 'rosterPortrait');
  const page = partOf(asked) === 0 ? nextPage(departmentRows(content.subteams), rowLayout(scale).rows) : { items: rowsOfPart(content, asked), upcoming: [] };
  const rows = page.items.map(row => leadRow(row, content));

  // the header names the team on the screen, and has no chip when every department is for both teams
  const chip = pageTeamName(visibleItems(content.subteams), teamNameOf(wantedTeam()));

  host.innerHTML = `
    <section class="page team-leads">
      <div class="header">
        <h2 class="${titleClass('TEAM LEADS')}" data-slat="title">TEAM LEADS</h2>
        <div class="tag" data-slat="tag">
          ${teamChipMarkup(chip)}
          ${markBeside(chipWidth(chip))}
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
