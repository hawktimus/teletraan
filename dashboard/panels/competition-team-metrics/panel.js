// The metrics of the team on the screen, a page at a time: the season so far, the ratings from Match13, the points a match in
// auto, teleop and endgame, the next match, the matches still to play, the last three results and the events of the season. The
// numbers are joined in core/team-metrics.js from frc-status (The Blue Alliance) and the Match13 file, and a number that neither
// has is written NOT YET. The colors are the team's, because the page follows the team on the screen.

import { cardState, emptyMarkup, pageMarkup, pagedChartsMarkup, textAt } from '../../core/competition-draw.js';
import { currentMatch13 } from '../../core/match13.js';
import { describe, lines, rowParts, subText, tagFor } from '../../core/team-metrics-draw.js';
import { metricsFor, pagesOf } from '../../core/team-metrics.js';

const NOT_ENOUGH = 'Not enough matches yet.';

function titleOf(entry) {
  const code = entry.team.toUpperCase();
  return code.length <= 10 ? code : 'TEAM ' + entry.number;
}

function pagesFor(state) {
  return pagesOf(state.entry ? metricsFor(state.frc, state.entry.team) : null);
}

function chartPages(pages, state, title) {
  return pages.map(page => ({
    description: describe(title, page),
    parts: [textAt(0, lines.sub, subText(page, state), 'sub')].concat(rowParts(page.rows)),
  }));
}

export function scrollPages(content) {
  return Math.max(1, pagesFor(cardState(content, new Date())).length);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const pages = pagesFor(state);
  const title = state.entry ? titleOf(state.entry) : 'TEAM';
  const tag = tagFor(state.frc, currentMatch13(), now);

  if (pages.length === 0) return pageMarkup('competition-team-metrics', title, tag, emptyMarkup(NOT_ENOUGH));
  return pageMarkup('competition-team-metrics', title, tag, pagedChartsMarkup(chartPages(pages, state, title)), pages.length);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
