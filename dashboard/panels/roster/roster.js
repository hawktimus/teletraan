// One subteam on each page: the team lead as a portrait on the left and the
// members in two columns on the right. A subteam with more than 16 members
// continues on the next page. Each time the panel comes round it shows the
// next page (core/roster.js).

import { doubleSlash } from '../../core/marks.js';
import { escapeHtml } from '../../core/text.js';
import { portraitPercentOf, visibleItems } from '../../core/content.js';
import { makeRosterTurns, rosterPages, rowsPerColumn } from '../../core/roster.js';
import { leadAddress, portraitLook, preloadLeadPhotos, slotMarkup, watchPhotos } from '../../core/portrait.js';
import { departmentTitle, pageTeamName, teamChipMarkup, teamNameOf, titleClass } from '../../core/team-title.js';
import { wantedTeam } from '../../core/teams.js';

const nextTurn = makeRosterTurns();

export function hasContent(content) {
  return rosterPages(content.subteams).length > 0;
}

export function mount(host, content) {
  const turn = nextTurn(content.subteams);
  const page = turn.page || { subteam: '', lead: '', members: [], pageNumber: 1, pageCount: 1 };

  // the header names the department and the team: BUILD TEAM and PRIME, and has no chip when the subteam is for both teams
  const owner = visibleItems(content.subteams).filter(item => String(item.name || '').trim() === page.subteam);
  const chip = pageTeamName(owner.slice(0, 1), teamNameOf(wantedTeam()));
  const title = departmentTitle(page.subteam);

  host.innerHTML = `
    <section class="page roster">
      <div class="header">
        <h2 class="${titleClass(title, chip)}" data-slat="title">${escapeHtml(title)}</h2>
        <div class="tag" data-slat="tag">
          ${teamChipMarkup(chip)}
          ${doubleSlash()}
        </div>
      </div>

      <div class="body">
        ${leadMarkup(page, content)}
        <div class="members">${columnsMarkup(page.members)}</div>
      </div>
    </section>`;

  watchPhotos(host);
  if (turn.upcoming) preloadLeadPhotos([turn.upcoming], content.people);
}

// A subteam with no lead has no portrait, and the names take the whole page. The
// slot does not grow with a Roster size above 100 (portraitSizes in core/portrait.js)
function leadMarkup(page, content) {
  if (page.lead === '') return '';

  return slotMarkup({
    name: page.lead,
    role: 'TEAM LEAD',
    address: leadAddress(page, content.people),
    scale: portraitPercentOf(content.settings, 'rosterPortrait'),
    look: portraitLook(content.settings),
  });
}

// The first column is filled before the second, up to 8 names. Fewer names are
// shared between the two columns, so a short list is not one long column.
function columnsMarkup(members) {
  const firstSize = Math.min(rowsPerColumn, Math.ceil(members.length / 2));

  return [members.slice(0, firstSize), members.slice(firstSize)]
    .filter(names => names.length > 0)
    .map(names => `<div class="column">${names.map(nameMarkup).join('')}</div>`)
    .join('');
}

function nameMarkup(name) {
  return `<div class="member" data-slat="item">${escapeHtml(name)}</div>`;
}
