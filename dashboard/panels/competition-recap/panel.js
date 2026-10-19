// The recap, for the week after an event (Before and after, docs/frc-feed.md). Page one is how the event went: the final rank,
// the record, the ranking points, what the EPA did over the event and the district points gained. Page two lists the awards, when
// there are any. The last page is the EPA of the team over the season.
//
// All of it comes from what the Teletraan computer already keeps: the event's rank and record, the awards, and the daily snapshots.
// The change in EPA and in district points is the last snapshot of the event less the last one before it, so it is a dash when the
// snapshots do not reach back that far.

import { cardState, cut, emptyMarkup, numberFor, pageMarkup, pagedChartsMarkup, rangeText, tagTextFor, textAt } from '../../core/competition-draw.js';
import { recapEventOf, recapHasData } from '../../core/competition.js';
import { changeOver, signed } from '../../core/competition-scouting.js';
import { hasTrend, trendParts } from '../../core/competition-trend.js';
import { eventName, recordText } from '../../core/frc.js';

const NAME_FITS = 20;
const AWARD_FITS = 38;
const AWARDS_SHOWN = 6;
const COLUMN = 556;
const LABEL_FIRST = 128;
const ROW_HEIGHT = 130;

// A label over a value, in one of the two columns of three rows
function stat(index, label, value) {
  const left = index % 2 === 0 ? 0 : COLUMN;
  const top = LABEL_FIRST + Math.floor(index / 2) * ROW_HEIGHT;
  return [textAt(left, top, label, 'label'), textAt(left, top + 62, value, 'value')];
}

function rankText(event) {
  if (event.rank === null) return '-';
  return event.rank + (event.teamsRanked === null ? '' : ' OF ' + event.teamsRanked);
}

function resultsPage(entry, event) {
  const awards = entry.awards.filter(award => award.event === event.key);
  const points = changeOver(entry.snapshots, event, 'districtPoints');
  const parts = [
    textAt(0, 52, cut(eventName(event), NAME_FITS), 'name'),
    textAt(1096, 52, rangeText(event.startDate, event.endDate), 'where', 'end'),
  ];
  [
    ['FINAL RANK', rankText(event)],
    ['RECORD', event.record ? recordText(event.record) : '-'],
    ['RANKING POINTS', numberFor(event.rankingPoints)],
    ['EPA CHANGE', signed(changeOver(entry.snapshots, event, 'epa'))],
    ['DISTRICT POINTS', points === null ? '-' : signed(Math.round(points))],
    ['AWARDS', String(awards.length)],
  ].forEach((item, index) => parts.push.apply(parts, stat(index, item[0], item[1])));

  return { description: 'Recap of ' + eventName(event) + ': rank ' + rankText(event), parts: parts, awards: awards };
}

function awardsPage(awards) {
  const parts = [textAt(0, 52, 'AWARDS', 'sub')];
  awards.slice(0, AWARDS_SHOWN).forEach((award, index) => parts.push(textAt(0, 124 + index * 62, cut(award.name, AWARD_FITS), 'award')));
  if (awards.length > AWARDS_SHOWN) parts.push(textAt(0, 124 + AWARDS_SHOWN * 62, '+' + (awards.length - AWARDS_SHOWN) + ' more', 'where'));
  return { description: 'Awards: ' + awards.length, parts: parts };
}

function pagesFor(content, now) {
  const state = cardState(content, now);
  const entry = state.entry;
  const event = entry ? recapEventOf(entry, state.today) : null;
  if (!event || !recapHasData(entry, event)) return null;

  const first = resultsPage(entry, event);
  const pages = [first];
  if (first.awards.length > 0) pages.push(awardsPage(first.awards));
  if (hasTrend(entry.snapshots)) pages.push({ description: 'EPA over the season', parts: trendParts(entry.snapshots, 'EPA OVER THE SEASON') });
  return { pages: pages, state: state };
}

export function scrollPages(content) {
  const built = pagesFor(content, new Date());
  return built ? built.pages.length : 1;
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const built = pagesFor(content, now);
  if (!built) return pageMarkup('competition-recap', 'RECAP', tagTextFor(cardState(content, now).frc, now), emptyMarkup('There is no event to look back on yet.'));

  return pageMarkup('competition-recap', 'RECAP', tagTextFor(built.state.frc, now), pagedChartsMarkup(built.pages), built.pages.length);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
