// What the Monday cards share: the page with its header, the pieces of a row, the page marker of a card that
// scrolls and the sentence a card says when it has no rows. They are plain functions that return markup, so
// tests/monday-cards.test.mjs can run them. The sentence a card says when it has nothing else to show, the
// text in a chart are the competition cards' too (core/competition-draw.js). A card is a panel in
// panels/monday-*, and core/monday.js decides what it draws.

import { teamsOf } from './screens.js';
import { markBeside } from './marks.js';
import { wordsRoom } from './header-room.js';
import { everyMinutesOf, minutesSince, pagesOf, rowsPerPage, stale, staleWords, statusWords as boardStatusWords } from './monday.js';
import { chipWidth, departmentTitle, smallTitleClass, teamChipMarkup, teamNameOf } from './team-title.js';
import { escapeHtml, hasText } from './text.js';
import { textWidth } from './text-width.js';
import { wantedTeam } from './teams.js';

// The name of the team on the screen in capitals, the one its items follow. The team's short name, PRIME
// or NOVA, which is the one the Studio sends for it.
export function teamNameShown() {
  return teamNameOf(wantedTeam());
}


// The header

// The words about the board have the room at the right end of every header, past the line that ends the tab
// (core/header-room.js). The size is the one in the stylesheet.
const wordsSize = 44;

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

// The words about the board, such as 4 MIN AGO, when they fit in the room at the right end of the header
// (core/header-room.js), and nothing when they do not.
export function wordsAtRight(words) {
  return words !== '' && textWidth(words, 600, wordsSize) <= wordsRoom ? words : '';
}

// The header: the title at the left and, at the right end, the words about the board, the chip with the name
// of the team and the slashes. A header that has a chip is marked tag-with-chip: the words do not fit beside
// the chip in a header 1152 wide, and monday.css shows them only where the header is wider, in the bar layout.
// The slashes are left out when they would not fit beside the chip, or beside the words when there is no chip.
// now is a Date, and status is content.monday.
export function headerMarkup(title, chip, status, now) {
  const words = wordsAtRight(agoWords(status, now));
  const ago = words ? `<span class="ago">${escapeHtml(words)}</span>` : '';
  const withChip = hasText(chip) ? ' tag-with-chip' : '';
  const beside = hasText(chip) ? chipWidth(chip) : textWidth(words, 600, wordsSize);

  return `
      <div class="header">
        <h2 class="${smallTitleClass(title)}" data-slat="title">${escapeHtml(title)}</h2>
        <div class="tag${withChip}" data-slat="tag">${ago}${teamChipMarkup(chip)}${markBeside(beside)}</div>
      </div>`;
}

// The header of the panels that read the one task board (docs/monday.md): the title, and at the right end the
// words about the board, the chip of the team and the slashes. lead is what the words start with, BOARD for
// most, and the words are lead · N MIN AGO. A lead of nothing says only the age, and a lead with no age
// (the age is not known) says only the lead. When the board has not been read for twice the read interval,
// or Sanity cannot be reached, an amber chip STALE · N MIN stands in the place of the words (monday.stale),
// and it is there on every one of these panels. content is the whole content, for the status and the interval.
function boardWords(lead, status, now, noAge = false) {
  const age = noAge ? '' : agoWords(status, now);
  return [lead, age].filter(part => hasText(part)).join(' · ');
}

export function boardHeader(title, chip, content, now, lead = 'BOARD', noAge = false) {
  const status = content ? content.monday : null;
  const late = stale(status, now, everyMinutesOf(content));
  const words = late ? '' : boardWords(lead, status, now, noAge);
  const chipText = late ? staleWords(status, now) : '';

  // 30px letters in the amber chip, 44px ones in the words. The words need the room beside the chip: in the
  // 1152 wide panel they get it only when the title is short, and in the bar layout there is always room.
  const staleWidth = late ? textWidth(chipText, 700, 30) + 28 : 0;
  const titleWidth = Math.min(textWidth(title, 700, 60), 656);
  const wordsWidth = words === '' ? 0 : textWidth(words, 600, wordsSize);
  const wordsFit = 76 + titleWidth + 24 + wordsWidth + 20 + chipWidth(chip) <= 1112;

  const wordsMarkup = words === '' ? '' : `<span class="ago${wordsFit ? '' : ' ago-wide'}">${escapeHtml(words)}</span>`;
  const staleMarkup = late ? `<span class="stale-chip">${escapeHtml(chipText)}</span>` : '';
  const beside = chipWidth(chip) + staleWidth + (wordsFit ? wordsWidth : 0);

  return `
      <div class="header">
        <h2 class="${smallTitleClass(title)}" data-slat="title">${escapeHtml(title)}</h2>
        <div class="tag" data-slat="tag">${wordsMarkup}${staleMarkup}${teamChipMarkup(chip)}${markBeside(beside)}</div>
      </div>`;
}

export { minutesSince };

// The teams of the cards of both teams, in the order of the Teams in the Studio. Only teams that are switched on
// are in it.
export function teamsForBoth(content) {
  return teamsOf(content);
}

// The label at the start of a row of the cards of both teams: PRIME in gold and NOVA in light purple. The class
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
export function markerMarkup(rows, noun, longWordsInBar = false) {
  const pages = pagesOf(rows);
  if (rows <= rowsPerPage) return '';

  // The tasks panel of the one task board says 1 OF 2 and, where the main panel is wide enough (the bar layout), the count of
  // rows after it, so the words stay clear of the numbers at the left of a panel 1152 wide
  const squares = [];
  const words = [];
  for (let page = 1; page <= pages; page++) {
    squares.push(`<span class="square square-${page}"></span>`);
    words.push(longWordsInBar ? `<span class="place place-${page}">${page} OF ${pages}<span class="place-more"> · ${rows} ${noun}</span></span>` : `<span class="place place-${page}">${page} OF ${pages} · ${rows} ${noun}</span>`);
  }
  return `<div class="marker"><div class="squares">${squares.join('')}</div>${words.join('')}</div>`;
}


// When there is nothing to draw

// The sentence a card says when the cards have no rows, and why. content.settings.mondayBoards are the
// boards that were chosen in Dashboard Settings, and content.monday is the status the Teletraan computer wrote.
export function noRowsSentence(content) {
  const settings = content && content.settings ? content.settings : {};
  const boards = Array.isArray(settings.mondayBoards) ? settings.mondayBoards : [];

  if (boards.length === 0) return 'No board is chosen yet.';
  if (!content.monday || content.monday.lastSyncAt === '') return 'Waiting for the first sync from the board.';
  return 'Nothing on the chosen boards is showing yet.';
}


// The pieces of the panels of the one task board (core/monday-views.js says what is in them)

// A status as a colored chip with its word, in the five colors. The word is there for anyone who cannot tell
// the colors apart.
export function chipMarkup(status) {
  return `<span class="chip chip-${status}">${boardStatusWords[status] || ''}</span>`;
}

// The five statuses with their colors, as the legend at the foot of the chart panels: a square and the word of each
export function legendMarkup() {
  return `<div class="legend">${['up-next', 'in-progress', 'in-review', 'blocked', 'done'].map(status => `<span class="key"><i class="swatch chip-${status}"></i>${boardStatusWords[status]}</span>`).join('')}</div>`;
}

// The numbers along the bottom of a panel: a 72px number with its word beside it. facts is [{ label, value }] and
// value is text or a number.
export function countersMarkup(facts) {
  return `<div class="facts">${facts.map(fact => `<div class="fact"><span class="fact-number">${escapeHtml(String(fact.value))}</span><span class="fact-label">${escapeHtml(fact.label)}</span></div>`).join('')}</div>`;
}

// The sentence a panel of the board says when the screen shows it with nothing to draw (a preview of a department
// with no task). The Screens leave such a row out.
export function boardEmptyMarkup(content) {
  return `<p class="empty">${escapeHtml(content && content.monday && content.monday.lastSyncAt ? 'No task of the board is showing here.' : 'Waiting for the first read of the board.')}</p>`;
}
