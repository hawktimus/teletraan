// DRIVE HOURS: the hours of the Monday board added up for each person, the most hours first, six rows a page. The people and
// their hours are the ones of the roster (core/roster.js, peopleOf), for every department of the team on the screen, or of
// both teams on the Robotics view. A board that has no owner has nothing to show, and the rotation skips the panel. With more
// than six people the list scrolls up by six rows (scrollPages, which core/schedule.js reads).

import { escapeHtml } from '../../core/text.js';
import { driveHoursPages } from '../../core/roster.js';
import { titleClass } from '../../core/team-title.js';
import { wantedTeam } from '../../core/teams.js';
import { viewNow } from '../../core/view-apply.js';
import { rosterPageRows } from '../../config.js';

const title = 'DRIVE HOURS';

function teamCode() {
  return viewNow() === 'general' ? '' : wantedTeam().code;
}

export function hasContent(content) {
  return driveHoursPages(content, new Date(), teamCode()).rows.length > 0;
}

export function scrollPages(content) {
  return Math.max(1, driveHoursPages(content, new Date(), teamCode()).pages);
}

export function mount(host, content) {
  const view = driveHoursPages(content, new Date(), teamCode());
  const people = view.rows.map(row => `<div class="person" data-slat="item"><span class="person-name">${escapeHtml(row.name)}</span><span class="person-hours">${row.hours} HRS</span></div>`);
  while (people.length < view.pages * rosterPageRows) people.push('<div class="person person-blank"></div>');

  host.innerHTML = `
    <section class="page roster roster-board drive-hours" data-scroll-page="1">
      <div class="header">
        <h2 class="${titleClass(title)}" data-slat="title">${title}</h2>
        <div class="tag" data-slat="tag"></div>
      </div>
      <div class="body"><div class="people people-window"><div data-scroll-list>${people.join('')}</div></div></div>
    </section>`;
}
