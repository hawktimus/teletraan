// The next match: its number and time, the three teams on each alliance with their EPA, which side
// is the team's own, and the chance that red wins as one bar split red and blue. The match is the nextMatch
// part of the team's entry in frc-status. During an event it is the first card (core/competition.js).
// The win chance and the EPA of a team are left out when the Mini did not find them, and a sentence
// says so where the bar would be.

import { cardState, chartMarkup, clockText, cut, emptyMarkup, epaOf, numberFor, pageMarkup, tagTextFor, textAt, whenText } from '../../core/competition-draw.js';

// The two columns, one for each alliance. The blue one starts after the red one and the gap. Each has a
// band with its colour and then a row for each team: the number and the EPA on one line and the nickname
// under them.
const COLUMN_WIDTH = 532;
const BLUE_LEFT = 564;
const BAND_TOP = 104;
const BAND_HEIGHT = 48;
const ROW_FIRST = 156;
const ROW_HEIGHT = 88;
const TEAMS = 3;
const NICKNAME_FITS = 18;

// The bar of the win chance, with the two chances written above it
const ODDS_TOP = 462;
const ODDS_HEIGHT = 46;

function columnParts(color, people, left, entry, ours) {
  const parts = [
    `<rect class="band band-${color}" x="${left}" y="${BAND_TOP}" width="${COLUMN_WIDTH}" height="${BAND_HEIGHT}"/>`,
    textAt(left + COLUMN_WIDTH / 2, BAND_TOP + 38, color.toUpperCase() + (ours ? ': OUR SIDE' : ''), 'band-text', 'middle'),
  ];

  people.slice(0, TEAMS).forEach((person, index) => {
    const top = ROW_FIRST + index * ROW_HEIGHT;
    const epa = epaOf(person, entry);
    const own = person.number === entry.number;

    if (own) parts.push(`<rect class="ours" x="${left + 2}" y="${top + 2}" width="${COLUMN_WIDTH - 4}" height="${ROW_HEIGHT - 4}"/>`);
    parts.push(textAt(left + 16, top + 46, person.number, 'team'));
    if (epa !== null) parts.push(textAt(left + COLUMN_WIDTH - 16, top + 44, numberFor(epa), 'epa', 'end'));
    if (person.nickname) parts.push(textAt(left + 16, top + 82, cut(person.nickname, NICKNAME_FITS), 'nickname'));
  });
  return parts;
}

// The bar: red from the left as far as the chance of red, blue the rest. The numbers are whole percents
// that add up to 100.
export function oddsParts(redWinProbability) {
  if (redWinProbability === null) return [textAt(0, 490, 'No win chance for this match yet.', 'note')];

  const red = Math.round(redWinProbability * 100);
  const redWidth = Math.round(redWinProbability * 1096);
  return [
    textAt(0, 454, 'RED ' + red + '%', 'odds-red'),
    textAt(1096, 454, 'BLUE ' + (100 - red) + '%', 'odds-blue', 'end'),
    `<rect class="share share-red" x="0" y="${ODDS_TOP}" width="${redWidth}" height="${ODDS_HEIGHT}"/>`,
    `<rect class="share share-blue" x="${redWidth}" y="${ODDS_TOP}" width="${1096 - redWidth}" height="${ODDS_HEIGHT}"/>`,
  ];
}

function chart(entry, state) {
  const match = entry.nextMatch;
  const moment = match.time === '' ? null : new Date(match.time);
  const parts = [textAt(0, 90, match.label || '-', 'match')];

  if (moment) parts.push(textAt(1096, 84, whenText(state.zone, moment, state.today), 'when', 'end'));
  parts.push.apply(parts, columnParts('red', match.red, 0, entry, match.alliance === 'red'));
  parts.push.apply(parts, columnParts('blue', match.blue, BLUE_LEFT, entry, match.alliance === 'blue'));
  parts.push.apply(parts, oddsParts(match.redWinProbability));

  const when = moment ? ' at ' + clockText(state.zone, moment) : '';
  return chartMarkup('Next match ' + match.label + when, parts);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const entry = state.entry && state.entry.nextMatch ? state.entry : null;
  const inner = entry ? chart(entry, state) : emptyMarkup('No match is scheduled yet.');

  return pageMarkup('competition-next-match', 'MATCH', tagTextFor(state.frc, now), inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
