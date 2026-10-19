// The event preview, for the two weeks before an event (Before and after, docs/frc-feed.md). Page one is the event: its
// name, city and days, the time left to its first day, how many teams come and where each of our teams would rank by
// EPA. Page two is the strength of the field: the best eight teams by EPA with ours marked, and the average. Page three is
// the EPA of the team over the season, when there are snapshots to draw it from. The card scrolls from page to page the way
// the Events panel does (scrollPages, and scrollCard in frame.js).
//
// Nothing is made up. A rating the Teletraan computer did not find is a dash, and a page it has nothing for is left out.

import { cardState, cut, emptyMarkup, leftText, numberFor, pageMarkup, pagedChartsMarkup, rangeText, tagTextFor, textAt, untilDay } from '../../core/competition-draw.js';
import { previewEventOf } from '../../core/competition.js';
import { fieldStrength } from '../../core/competition-scouting.js';
import { hasTrend, trendParts } from '../../core/competition-trend.js';
import { eventName } from '../../core/frc.js';

const NAME_FITS = 22;
const CITY_FITS = 18;
const NICKNAME_FITS = 18;
const ROW_FIRST = 104;
const ROW_HEIGHT = 49;

// The words under the countdown, and the lines for our teams at the foot of page one
function eventPage(event, strength, state) {
  const left = untilDay(state.zone, state.now, state.today, event.startDate);
  const parts = [
    textAt(0, 72, cut(eventName(event), NAME_FITS), 'name'),
    textAt(0, 132, [cut(event.city, CITY_FITS), rangeText(event.startDate, event.endDate)].filter(Boolean).join(' · '), 'where'),
    textAt(0, 196, 'TO THE FIRST DAY', 'caption'),
    textAt(0, 290, event.startDate > state.today ? leftText(left) : 'NOW', 'countdown'),
  ];

  if (strength) {
    parts.push(textAt(0, 356, strength.count + (strength.count === 1 ? ' TEAM' : ' TEAMS') + ' COMING', 'count'));
    strength.lines.slice(0, 2).forEach((line, index) => parts.push(textAt(0, 424 + index * 56, line.text, 'rank-line' + (line.code ? ' is-' + line.code : ''))));
  }
  return { description: 'Event preview: ' + eventName(event) + ', ' + rangeText(event.startDate, event.endDate), parts: parts };
}

// The best eight, one under the other with our teams marked in their colors, and the average under them
function fieldPage(strength) {
  const parts = [textAt(0, 52, 'FIELD STRENGTH BY ' + strength.unit.toUpperCase(), 'sub')];

  strength.top.forEach((team, index) => {
    const top = ROW_FIRST + index * ROW_HEIGHT;
    const mark = team.code ? ' is-' + team.code : '';

    if (team.code) parts.push(`<rect class="ours ours-${team.code}" x="2" y="${top - 38}" width="1092" height="48"/>`);
    parts.push(textAt(12, top, String(team.rank), 'place' + mark));
    parts.push(textAt(80, top, team.number, 'team' + mark));
    parts.push(textAt(300, top, cut(team.nickname, NICKNAME_FITS), 'nickname'));
    parts.push(textAt(1084, top, numberFor(team.epa), 'epa' + mark, 'end'));
  });

  parts.push(textAt(0, 500, strength.average === null ? 'NO AVERAGE YET' : 'FIELD AVERAGE ' + numberFor(strength.average) + ' ' + strength.unit.toUpperCase(), 'average'));
  parts.push(textAt(1096, 500, 'Ratings: ' + strength.source, 'chip', 'end'));
  return { description: 'Field strength: the best teams by EPA, average ' + numberFor(strength.average), parts: parts };
}

function pagesFor(content, now) {
  const state = cardState(content, now);
  const entry = state.entry;
  const event = entry ? previewEventOf(entry, state.today) : null;
  if (!event) return null;

  const strength = fieldStrength(state.frc, entry, event.key);
  const pages = [eventPage(event, strength, state)];
  if (strength && strength.top.length > 0) pages.push(fieldPage(strength));
  if (hasTrend(entry.snapshots)) pages.push({ description: 'EPA over the season', parts: trendParts(entry.snapshots, 'EPA OVER THE SEASON') });
  return { pages: pages, state: state };
}

// How many pages the card has to hold for (core/schedule-run.js reads this)
export function scrollPages(content) {
  const built = pagesFor(content, new Date());
  return built ? built.pages.length : 1;
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const built = pagesFor(content, now);
  if (!built) return pageMarkup('competition-preview', 'PREVIEW', tagTextFor(cardState(content, now).frc, now), emptyMarkup('There is no event coming up.'));

  return pageMarkup('competition-preview', 'PREVIEW', tagTextFor(built.state.frc, now), pagedChartsMarkup(built.pages), built.pages.length);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
