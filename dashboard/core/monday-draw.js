// What the Monday cards share: the page with its header, the pieces of a row, the page marker of a card that
// scrolls and the sentence a card says when it has no rows. They are plain functions that return markup, so
// tools/test-monday-cards.mjs can run them. The sentence a card says when it has nothing else to show, the
// text in a chart are the competition cards' too (core/competition-draw.js). A card is a panel in
// panels/monday-*, and core/monday.js decides what it draws.

import { teamsOf } from './screens.js';
import { doubleSlash } from './marks.js';
import { pagesOf, rowsPerPage } from './monday.js';
import { departmentTitle, teamChipMarkup, teamNameOf } from './team-title.js';
import { escapeHtml, hasText } from './text.js';
import { textWidth } from './text-width.js';
import { wantedTeam } from './teams.js';

// The name of the team on the screen in capitals, the one its items follow. The team's short name, PRIME
// or NOVA, which is the one the Studio sends for it.
export function teamNameShown() {
  return teamNameOf(wantedTeam());
}


// The header

// The room the header has for its words: the width of the large panel less 76 at the left and 40 at the
// right, then the slashes at the right end with the gap before them. Sizes are those of the stylesheets.
const headerRoom = 1036;
const markRoom = 84;
const titleGap = 24;
const chipGap = 20;
const chipPadding = 28;
const titleSize = 60;
const chipSize = 44;

// How long ago the board was read, as words: 4 MIN AGO, 3 HR AGO, 2 DAYS AGO. A sample says SAMPLE, and
// nothing is said when the time is not known.
export function agoWords(status, now) {
  if (!status) return '';
  if (status.sample === true) return 'SAMPLE';

  const read = Date.parse(status.lastSyncAt);
  if (isNaN(read)) return '';

  const minutes = Math.max(0, Math.floor((now.getTime() - read) / 60000));
  if (minutes < 1) return 'NOW';
  if (minutes < 60) return minutes + ' MIN AGO';

  const hours = Math.floor(minutes / 60);
  return hours < 48 ? hours + ' HR AGO' : Math.floor(hours / 24) + ' DAYS AGO';
}

// The words beside the chip, BOARD · 4 MIN AGO, as long as the title, the words and the chip fit in the
// header together. When they do not, the words go without BOARD, and when they still do not, they are left out.
// A header with no chip, because the card is for both teams, has the room of the chip for the words.
export function wordsBesideChip(title, chip, words) {
  if (words === '') return '';

  const chipRoom = hasText(chip) ? chipGap + textWidth(chip, 700, chipSize) + chipPadding : 0;
  const taken = textWidth(title, 700, titleSize) + titleGap + chipRoom + markRoom;
  return ['BOARD · ' + words, words].find(text => taken + textWidth(text, 600, chipSize) <= headerRoom) || '';
}

// The header: the title at the left and, at the right end, the words about the board, the chip with the
// name of the team and the slashes. now is a Date, and status is content.monday.
export function headerMarkup(title, chip, status, now) {
  const words = wordsBesideChip(title, chip, agoWords(status, now));
  const ago = words ? `<span class="ago">${escapeHtml(words)}</span>` : '';

  return `
      <div class="header">
        <h2 class="title" data-slat="title">${escapeHtml(title)}</h2>
        <div class="tag" data-slat="tag">${ago}${teamChipMarkup(chip)}${doubleSlash()}</div>
      </div>`;
}

// The teams of the cards of both teams, in the order of the Teams in the Studio. Only teams that are switched on
// are in it.
export function teamsForBoth(content) {
  return teamsOf(content);
}

// The label at the start of a row of the cards of both teams: PRIME in gold and NOVA in silver. The class
// carries the code of the team, which is letters and digits and nothing else. A row of tasks from a board
// with no team has no team, and so no label. It keeps the room of one when other rows of the card have a
// label (kept), so the columns line up.
export function teamTagMarkup(team, kept = false) {
  if (!team) return kept ? '<span class="team-tag team-tag-blank"></span>' : '';

  const code = String(team.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `<span class="team-tag team-tag-${code}">${escapeHtml(teamNameOf(team))}</span>`;
}

// The title of a page about a department, BUILD TEAM
export function departmentHeader(department, chip, status, now) {
  return headerMarkup(departmentTitle(department), chip, status, now);
}

// The page of a card: the header as markup, and the body, which is one slat. A card that scrolls says so with
// data-scroll-page, which frame.js changes and the page marker follows.
export function pageMarkup(cardId, header, inner, scrolls = false) {
  const scroll = scrolls ? ' data-scroll-page="1"' : '';

  return `
    <section class="page monday ${cardId}"${scroll}>${header}

      <div class="body" data-slat="item">${inner}</div>
    </section>`;
}


// The pieces of a row

const statusWords = { 'up-next': 'BACKLOG', 'in-progress': 'IN PROGRESS', done: 'DONE' };

// The status as a colored label with its word
export function statusChip(status) {
  return `<span class="status status-${status}">${statusWords[status] || ''}</span>`;
}

// The priority as a shape: a filled triangle for high, an outlined one for medium and nothing for low. The
// space is kept either way, so the rows line up.
export function priorityMark(priority) {
  const shape = priority === 'high' ? '<polygon class="triangle-high" points="18,4 33,32 3,32"/>' : priority === 'medium' ? '<polygon class="triangle-medium" points="18,6 31,30 5,30"/>' : '';
  return `<span class="priority"><svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">${shape}</svg></span>`;
}

// The rows in a window that is five rows high. A card with more rows than that is moved up in it by frame.js.
export function rowsWindow(rows) {
  return `<div class="rows-window"><div data-scroll-list>${rows.join('')}</div></div>`;
}

// The page marker at the bottom right of a card that scrolls: a square for each page, the one in view filled,
// and its place in words, 1 OF 2 · 10 TASKS. A card of five rows or fewer has none. The stylesheet shows
// the square and the words of the page named in data-scroll-page.
export function markerMarkup(rows, noun) {
  const pages = pagesOf(rows);
  if (rows <= rowsPerPage) return '';

  const squares = [];
  const words = [];
  for (let page = 1; page <= pages; page++) {
    squares.push(`<span class="square square-${page}"></span>`);
    words.push(`<span class="place place-${page}">${page} OF ${pages} · ${rows} ${noun}</span>`);
  }
  return `<div class="marker"><div class="squares">${squares.join('')}</div>${words.join('')}</div>`;
}


// When there is nothing to draw

// The sentence a card says when the cards have no rows, and why. content.settings.mondayBoards are the
// boards that were chosen in Dashboard Settings, and content.monday is the status the Mini wrote.
export function noRowsSentence(content) {
  const settings = content && content.settings ? content.settings : {};
  const boards = Array.isArray(settings.mondayBoards) ? settings.mondayBoards : [];

  if (boards.length === 0) return 'No board is chosen yet.';
  if (!content.monday || content.monday.lastSyncAt === '') return 'Waiting for the first sync from the board.';
  return 'Nothing on the chosen boards is showing yet.';
}
