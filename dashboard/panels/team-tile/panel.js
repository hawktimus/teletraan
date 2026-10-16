// The team's logo, number, name and school. It is the panel the small frame falls back on when no
// other small panel has anything to show, so the frame is never empty (registry.js, lastResort).
// It needs nothing but the team, so it always has content.

import { logoMarkup, logoTeamOf, showLogoTeam, showTeamLogo } from '../../core/logo.js';
import { escapeHtml } from '../../core/text.js';
import { teamShown, wantedTeam } from '../../core/teams.js';
import { viewNow } from '../../core/view-apply.js';

// The page is built for the team that is about to go on the screen, as the items of the other
// panels are (core/teams.js), so after a swap of team it is not the old team's.
export function mount(host, content) {
  const team = teamShown(content, wantedTeam());
  const school = content && content.team && content.team.school ? content.team.school : '';

  host.innerHTML = `
    <section class="page team-tile">
      <div class="label" data-slat="label">TEAM</div>

      <div class="content" data-slat="content">
        <div class="mark">
          <div class="logo tile-logo">${logoMarkup(logoTeamOf(team.code, viewNow()))}</div>
          <div class="number">${escapeHtml(team.number)}</div>
        </div>
        <div class="name">${escapeHtml(team.name)}</div>
        <div class="school">${escapeHtml(school)}</div>
      </div>
    </section>`;

  showTeamLogo(host.querySelector('.tile-logo'), team.logo);
}
