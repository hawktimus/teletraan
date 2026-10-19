// What the two Monday panels share: the page with its header, the status chip, the numbers along the bottom and the
// sentence a panel says when it has nothing to show. They are plain functions that return markup, so
// tests/monday-panels.test.mjs can run them. core/monday-views.js decides what the panels draw.

import { everyMinutesOf, stale, staleWords } from './monday.js';
import { statusWords } from './monday-views.js';
import { smallTitleClass } from './team-title.js';
import { escapeHtml, hasText } from './text.js';
import { markBeside } from './marks.js';
import { textWidth } from './text-width.js';

// How long ago the board was read, as words: 4 MIN AGO, 3 HR AGO, 2 DAYS AGO. A sample says SAMPLE, and nothing is said
// when the time is not known.
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

// The words at the right end of the header are 44px
const wordsSize = 44;

// The header: the title at the left and, at the right end, the team the row names (PRIME or NOVA, nothing for both teams),
// how long ago the board was read and the slashes. When the board has not been read for twice the read interval, or Sanity
// cannot be reached, an amber chip STALE · N MIN stands in the place of the age. The title room ends at the slanted end of
// the tab, so the team is not part of the title: PROGRAMMING TASKS · PRIME would not fit there.
export function boardHeader(title, team, content, now) {
  const status = content ? content.monday : null;
  const late = stale(status, now, everyMinutesOf(content));
  const words = [team, late ? '' : agoWords(status, now)].filter(hasText).join(' · ');
  const chip = late ? staleWords(status, now) : '';

  const wordsMarkup = words === '' ? '' : `<span class="ago">${escapeHtml(words)}</span>`;
  const staleMarkup = late ? `<span class="stale-chip">${escapeHtml(chip)}</span>` : '';
  const beside = (words === '' ? 0 : textWidth(words, 600, wordsSize)) + (late ? textWidth(chip, 700, 30) + 28 : 0);

  return `
      <div class="header">
        <h2 class="${smallTitleClass(title)}" data-slat="title">${escapeHtml(title)}</h2>
        <div class="tag" data-slat="tag">${wordsMarkup}${staleMarkup}${markBeside(beside)}</div>
      </div>`;
}

// The page of a panel: the header as markup, and the body, which is one slat. A panel that scrolls says so with
// data-scroll-page, which frame.js changes and the page marker follows.
export function pageMarkup(panelId, header, inner, scrolls = false) {
  const scroll = scrolls ? ' data-scroll-page="1"' : '';

  return `
    <section class="page monday ${panelId}"${scroll}>${header}

      <div class="body" data-slat="item">${inner}</div>
    </section>`;
}

// A status as a coloured chip with its word, in the five colours. The word is there for anyone who cannot tell the
// colours apart.
export function chipMarkup(status) {
  return `<span class="chip chip-${status}">${escapeHtml(statusWords[status] || '')}</span>`;
}

// The numbers along the bottom of a panel: a 72px number with its word beside it. facts is [{ label, value }].
export function countersMarkup(facts) {
  return `<div class="facts">${facts.map(fact => `<div class="fact"><span class="fact-number">${escapeHtml(String(fact.value))}</span><span class="fact-label">${escapeHtml(fact.label)}</span></div>`).join('')}</div>`;
}

// The sentence a panel says when the screen shows it with nothing to draw (a preview of a department with no task). The
// rotation leaves such a row out.
export function boardEmptyMarkup(content) {
  return `<p class="empty">${escapeHtml(content && content.monday && content.monday.lastSyncAt ? 'No task of the board is showing here.' : 'Waiting for the first read of the board.')}</p>`;
}
