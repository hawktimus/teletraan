// Our matches, for the day or two before an event once the schedule is posted (Before and after, docs/frc-feed.md). Page one is the
// first match, the time left to it, the expected record and the hardest and easiest match. Page two has those two matches in
// full: our alliance with the EPA of each team against the opponents, and a line about the best opponent. The pages after
// that list the qualification matches in time order, six to a page, with the chance of winning each.
//
// The chance is Statbotics' when the Teletraan computer read one. Otherwise it is worked out from the EPA of the two
// alliances and ESTIMATE is written beside it. Before the schedule is posted the card says so in one sentence.

import { cardState, clockText, cut, emptyMarkup, leftText, numberFor, pageMarkup, pagedChartsMarkup, tagTextFor, textAt, untilMoment, whenText } from '../../core/competition-draw.js';
import { matchesView } from '../../core/competition-scouting.js';
import { scheduleIsPosted } from '../../core/competition.js';
import { weekdayName } from '../../core/frc.js';
import { dateIn } from '../../core/theme.js';

const PER_PAGE = 6;
const ROW_FIRST = 52;
const ROW_HEIGHT = 80;
const NOTE_FITS = 17;

const percentText = row => (row.percent === null ? '-' : row.percent + '%');

// 1234 41, 5678 38
function teamsText(people) {
  return people.map(person => person.number + ' ' + (person.epa === null ? '-' : Math.round(person.epa))).join(', ');
}

function summaryPage(view, state) {
  const parts = [];
  const first = view.first;

  if (first) {
    const moment = new Date(first.time);
    const left = untilMoment(state.now, moment);
    parts.push(textAt(0, 62, 'FIRST MATCH ' + first.label, 'lead'));
    parts.push(textAt(1096, 62, whenText(state.zone, moment, state.today), 'when', 'end'));
    parts.push(textAt(0, 124, moment.getTime() <= state.now.getTime() ? 'NOW' : 'IN ' + leftText(left), 'countdown'));
  } else {
    parts.push(textAt(0, 62, view.rows.length + ' MATCHES, NO TIMES YET', 'lead'));
  }

  parts.push(textAt(0, 212, view.record ? 'Expected record ' + view.record.wins + ' ' + (view.record.wins === 1 ? 'win' : 'wins') + ', ' + view.record.losses + ' ' + (view.record.losses === 1 ? 'loss' : 'losses') : 'No expected record yet', 'record'));
  if (view.anyEstimate) parts.push(textAt(0, 252, 'ESTIMATE (EST): THE CHANCE IS WORKED OUT FROM EPA', 'chip'));

  if (view.hardest && view.easiest) {
    parts.push(textAt(0, 352, 'HARDEST ' + view.hardest.label, 'kind'));
    parts.push(textAt(1096, 352, percentText(view.hardest), 'percent', 'end'));
    parts.push(textAt(0, 432, 'EASIEST ' + view.easiest.label, 'kind'));
    parts.push(textAt(1096, 432, percentText(view.easiest), 'percent', 'end'));
  }
  return { description: 'Our matches: ' + view.rows.length + ' qualification matches', parts: parts };
}

// One match in full: the head, our alliance, the opponents and the note
function blockParts(title, row, top, state) {
  const match = row.match;
  const moment = row.time === '' ? null : new Date(row.time);
  const parts = [
    textAt(0, top, title + ' ' + row.label, 'kind'),
    textAt(1096, top, percentText(row) + (row.estimate ? ' ESTIMATE' : ''), 'percent', 'end'),
    textAt(0, top + 50, 'WITH ' + teamsText(match.partners), 'alliance'),
    textAt(0, top + 100, 'VS ' + teamsText(match.opponents), 'alliance'),
  ];
  if (moment) parts.push(textAt(560, top, clockText(state.zone, moment), 'when', 'middle'));
  if (row.note) parts.push(textAt(0, top + 150, cut(row.note, 40), 'note'));
  return parts;
}

function detailPage(view, state) {
  const parts = blockParts('HARDEST', view.hardest, 56, state).concat(blockParts('EASIEST', view.easiest, 290, state));
  return { description: 'The hardest and the easiest match', parts: parts };
}

function listPage(rows, state, number, count) {
  const parts = [];

  rows.forEach((row, index) => {
    const top = ROW_FIRST + index * ROW_HEIGHT;
    const moment = row.time === '' ? null : new Date(row.time);

    parts.push(textAt(0, top, row.label, 'label'));
    if (moment) {
      parts.push(textAt(135, top - 2, weekdayName(dateIn(state.zone, moment)), 'chip'));
      parts.push(textAt(215, top, clockText(state.zone, moment), 'time'));
    }
    parts.push(textAt(445, top, percentText(row), 'percent'));
    if (row.estimate) parts.push(textAt(560, top - 2, 'EST', 'chip'));
    if (row.note) parts.push(textAt(640, top, cut(row.note, NOTE_FITS), 'note'));
    if (index < rows.length - 1) parts.push(`<line class="rule" x1="0" y1="${top + 24}" x2="1096" y2="${top + 24}"/>`);
  });
  return { description: 'Our qualification matches, page ' + number + ' of ' + count, parts: parts };
}

function pagesFor(content, now) {
  const state = cardState(content, now);
  const view = state.entry ? matchesView(state.entry) : null;
  if (!view) return null;

  const pages = [summaryPage(view, state)];
  if (view.hardest && view.easiest) pages.push(detailPage(view, state));
  const lists = Math.ceil(view.rows.length / PER_PAGE);
  for (let page = 0; page < lists; page++) pages.push(listPage(view.rows.slice(page * PER_PAGE, (page + 1) * PER_PAGE), state, page + 1, lists));
  return { pages: pages, state: state };
}

export function scrollPages(content) {
  const built = pagesFor(content, new Date());
  return built ? built.pages.length : 1;
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const built = state.entry && scheduleIsPosted(state.entry) ? pagesFor(content, now) : null;
  const tag = tagTextFor(state.frc, now);

  if (!built) return pageMarkup('competition-matches', 'MATCHES', tag, emptyMarkup('The match schedule is not posted yet.'));
  return pageMarkup('competition-matches', 'MATCHES', tag, pagedChartsMarkup(built.pages), built.pages.length);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
