// One subteam on each page: the team lead as a portrait on the left and the
// members in two columns on the right. A subteam with more than 16 members
// continues on the next page. Each time the panel comes round it shows the
// next page (core/roster.js).

import { markBeside } from '../../core/marks.js';
import { escapeHtml } from '../../core/text.js';
import { portraitPercentOf, visibleItems } from '../../core/content.js';
import { makeMondayRosterTurns, makeRosterTurns, mondayRosterPages, rosterPages, rosterRowView, rowsPerColumn } from '../../core/roster.js';
import { leadAddress, portraitLook, preloadLeadPhotos, slotMarkup, watchPhotos } from '../../core/portrait.js';
import { chipWidth, departmentTitle, pageTeamName, teamChipMarkup, teamNameOf, titleClass } from '../../core/team-title.js';
import { wantedTeam } from '../../core/teams.js';
import { viewNow } from '../../core/view-apply.js';
import { rosterPageRows } from '../../config.js';

const nextTurn = makeRosterTurns();
const nextMondayTurn = makeMondayRosterTurns();

// The Robotics view counts both teams, and a team view the team on the screen
function teamCode() {
  return viewNow() === 'general' ? '' : wantedTeam().code;
}

// A row of the rotation names a department: the page is { team, department, part }
function rowOf(page) {
  return page && typeof page === 'object' && typeof page.department === 'string' && page.department !== '' ? page : null;
}

function rowView(content, page) {
  const row = rowOf(page);
  return row ? rosterRowView(content, new Date(), teamCode(), row.department, row.part) : null;
}

// How many windows of six rows the row is held for: the second part scrolls through the people after the first six
export function scrollPages(content, page) {
  const view = rowView(content, page);
  return view ? view.pages : 1;
}

export function hasContent(content, page) {
  if (rowOf(page)) return rowView(content, page) !== null;

  return mondayRosterPages(content, new Date(), teamCode()).length > 0 || rosterPages(content.subteams).length > 0;
}

// The roster from the Monday board: one department a page, the person and the hours, six rows
function mondayMount(host, page) {
  const title = page.department.toUpperCase() + ' ROSTER';
  const rows = page.rows.map(row => `<div class="person" data-slat="item"><span class="person-name">${escapeHtml(row.name)}</span><span class="person-hours">${row.hours} HRS</span></div>`).join('');
  const pages = page.pageCount > 1 ? `<span class="page-count">${page.pageNumber}/${page.pageCount}</span>` : '';

  host.innerHTML = `
    <section class="page roster roster-board">
      <div class="header">
        <h2 class="${titleClass(title)}" data-slat="title">${escapeHtml(title)}</h2>
        <div class="tag" data-slat="tag">${pages}</div>
      </div>
      <div class="body"><div class="people">${rows}</div></div>
    </section>`;
}

// One department of a row of the rotation: the first six people, or the rest in windows of six that scroll
function rowMount(host, view) {
  const blanks = (view.pages * rosterPageRows) - view.rows.length;
  const people = view.rows.map(row => `<div class="person" data-slat="item"><span class="person-name">${escapeHtml(row.name)}</span><span class="person-hours">${row.hours} HRS</span></div>`);
  for (let at = 0; at < blanks; at += 1) people.push('<div class="person person-blank"></div>');
  const pages = view.parts > 1 ? `<span class="page-count">${view.part}/${view.parts}</span>` : '';

  host.innerHTML = `
    <section class="page roster roster-board" data-scroll-page="1">
      <div class="header">
        <h2 class="${titleClass(view.title)}" data-slat="title">${escapeHtml(view.title)}</h2>
        <div class="tag" data-slat="tag">${pages}</div>
      </div>
      <div class="body"><div class="people people-window"><div data-scroll-list>${people.join('')}</div></div></div>
    </section>`;
}

export function mount(host, content, asked) {
  const named = rowView(content, asked);
  if (named) {
    rowMount(host, named);
    return;
  }

  const board = nextMondayTurn(content, new Date(), teamCode());
  if (board) {
    mondayMount(host, board);
    return;
  }

  const turn = nextTurn(content.subteams);
  const page = turn.page || { subteam: '', lead: '', members: [], pageNumber: 1, pageCount: 1 };

  // the header names the department and the team: BUILD TEAM and PRIME, and has no chip when the subteam is for both teams
  const owner = visibleItems(content.subteams).filter(item => String(item.name || '').trim() === page.subteam);
  const chip = pageTeamName(owner.slice(0, 1), teamNameOf(wantedTeam()));
  const title = departmentTitle(page.subteam);

  host.innerHTML = `
    <section class="page roster">
      <div class="header">
        <h2 class="${titleClass(title)}" data-slat="title">${escapeHtml(title)}</h2>
        <div class="tag" data-slat="tag">
          ${teamChipMarkup(chip)}
          ${markBeside(chipWidth(chip))}
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
