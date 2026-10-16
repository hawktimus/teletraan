// The results strip: the last 8 matches the team played, oldest first, each a chip in the colour of the
// alliance the team was on, with the score and a tick when it won. A lost match is the same chip, dimmer.
// It comes from the results part of the team's entry in frc-status (docs/frc-feed.md).

import { cardState, chartMarkup, emptyMarkup, pageMarkup, tagTextFor, textAt } from '../../core/competition-draw.js';

// Four chips in a row and two rows. 4 x 256 and 3 gaps of 24 are the 1096 of the body.
const CHIP_WIDTH = 256;
const CHIP_HEIGHT = 200;
const CHIP_GAP = 24;
const PER_ROW = 4;
const MOST = 8;

// The two scores of a chip, ours big and the other one under it. A score the Mini did not find is a dash.
export function scoresText(result) {
  return {
    ours: result.scoreFor === null ? '-' : String(result.scoreFor),
    against: result.scoreAgainst === null ? 'vs -' : 'vs ' + result.scoreAgainst,
  };
}

// How many matches were won, lost and tied
export function tally(results) {
  return {
    won: results.filter(result => result.won === true).length,
    lost: results.filter(result => result.won === false).length,
    tied: results.filter(result => result.won === null).length,
  };
}

function chipParts(result, index) {
  const left = (index % PER_ROW) * (CHIP_WIDTH + CHIP_GAP);
  const top = Math.floor(index / PER_ROW) * (CHIP_HEIGHT + CHIP_GAP);
  const color = result.alliance || 'none';
  const lost = result.won === false ? ' lost' : '';

  const scores = scoresText(result);
  const parts = [
    `<rect class="chip chip-${color}${lost}" x="${left}" y="${top}" width="${CHIP_WIDTH}" height="${CHIP_HEIGHT}" rx="8"/>`,
    textAt(left + 16, top + 52, result.label || '-', 'chip-label'),
    textAt(left + CHIP_WIDTH / 2, top + 122, scores.ours, 'chip-score', 'middle'),
    textAt(left + CHIP_WIDTH / 2, top + 176, scores.against, 'chip-against', 'middle'),
  ];
  if (result.won === true) parts.push(`<path class="check" d="M${left + 204} ${top + 32} l14 14 l28 -32"/>`);
  if (result.won === null) parts.push(textAt(left + CHIP_WIDTH - 16, top + 52, 'TIE', 'chip-label', 'end'));
  return parts;
}

function chart(results) {
  const shown = results.slice(-MOST);
  const count = tally(shown);
  const parts = [];

  shown.forEach((result, index) => parts.push.apply(parts, chipParts(result, index)));
  parts.push(textAt(0, 490, count.won + ' WON   ' + count.lost + ' LOST' + (count.tied > 0 ? '   ' + count.tied + ' TIED' : ''), 'summary'));

  return chartMarkup('The last ' + shown.length + ' matches: ' + count.won + ' won, ' + count.lost + ' lost', parts);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const results = state.entry ? state.entry.results : [];
  const inner = results.length > 0 ? chart(results) : emptyMarkup('No matches have been played yet.');

  return pageMarkup('competition-results', 'RESULTS', tagTextFor(state.frc, now), inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
