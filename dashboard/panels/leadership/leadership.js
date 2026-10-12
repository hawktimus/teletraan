// The coaches and captains, one row each. A page holds four rows at the standard
// portrait size and fewer at a bigger one, and each time the panel comes round it
// shows the next page, so everyone is shown (core/leadership.js).

import { doubleSlash } from '../../core/marks.js';
import { makePages } from '../../core/turns.js';
import { portraitPercentOf } from '../../core/content.js';
import { chipOf, leaders } from '../../core/leadership.js';
import { photoAddress, portraitLook, preloadPhotos, rowLayout, rowsMarkup, rowsPerPage, watchPhotos } from '../../core/portrait.js';
import { pageTeamName, teamChipMarkup, teamNameOf, titleClass } from '../../core/team-title.js';
import { wantedTeam } from '../../core/teams.js';

const nextPage = makePages(rowsPerPage);

export function hasContent(content) {
  return leaders(content.people).length > 0;
}

export function mount(host, content) {
  const scale = portraitPercentOf(content.settings, 'leadershipPortrait');
  const page = nextPage(leaders(content.people), rowLayout(scale).rows);
  const rows = page.items.map(personRow);

  // the header names the team: the team on the screen, or both teams when everyone on the list is for both
  const chip = pageTeamName(leaders(content.people), teamNameOf(wantedTeam()));

  host.innerHTML = `
    <section class="page leadership">
      <div class="header">
        <h2 class="${titleClass('LEADERSHIP', chip)}" data-slat="title">LEADERSHIP</h2>
        <div class="tag" data-slat="tag">
          ${teamChipMarkup(chip)}
          ${doubleSlash()}
        </div>
      </div>

      ${rowsMarkup(rows, scale, portraitLook(content.settings))}
    </section>`;

  watchPhotos(host);
  preloadPhotos(page.upcoming);
}

// The Role is the chip at the right end, and nothing is under the name but the typed line. The line is
// hidden on a page of four rows, which has no room for it (base.css). The frame of the picture is the
// panel's own, in the team's colours, for everyone.
function personRow(person) {
  return {
    name: person.name,
    role: '',
    line: String(person.line || '').trim(),
    chip: chipOf(person),
    address: photoAddress(person),
  };
}
