// Last season at a glance, for the weeks before the first event: the record of the whole season, the rank
// at each event, and the EPA after each event as a short line. It is all in the lastSeason part of the
// team's entry, which the Mini keeps when the year changes (docs/frc-feed.md). In Auto it is hidden once
// the first event of the new season starts (core/competition.js).

import { cardState, chartMarkup, cut, emptyMarkup, numberFor, pageMarkup, tagTextFor, textAt } from '../../core/competition-draw.js';
import { recordText } from '../../core/frc.js';

// Four rows of 56 px fill the middle of the body, and the EPA line is under them
const MAX_EVENTS = 4;
const ROW_FIRST = 164;
const ROW_HEIGHT = 56;
const NAME_FITS = 16;

// The line of the EPA runs between these places, in the body
const LINE_LEFT = 250;
const LINE_RIGHT = 846;
const LINE_TOP = 424;
const LINE_BOTTOM = 482;

// The record of all the events together, or null when no event has a record
export function seasonRecord(events) {
  const records = events.map(event => event.record).filter(record => record !== null);
  if (records.length === 0) return null;

  const sum = name => records.reduce((total, record) => total + (record[name] || 0), 0);
  return { wins: sum('wins'), losses: sum('losses'), ties: sum('ties') };
}

// The EPA after each event, in the order of the events, for the events that have one
export function epaSeries(events) {
  return events.map(event => event.epa).filter(epa => epa !== null);
}

// The points of the EPA line: evenly along the line, and as high as the EPA is between the lowest and the
// highest. A line that does not rise or fall is in the middle.
export function linePoints(series) {
  const low = Math.min(...series);
  const high = Math.max(...series);

  return series.map((epa, index) => {
    const x = Math.round(LINE_LEFT + (index / (series.length - 1)) * (LINE_RIGHT - LINE_LEFT));
    const y = high === low ? (LINE_TOP + LINE_BOTTOM) / 2 : LINE_BOTTOM - ((epa - low) / (high - low)) * (LINE_BOTTOM - LINE_TOP);
    return x + ',' + Math.round(y);
  });
}

function rankText(event) {
  if (event.rank === null) return 'RANK -';
  return 'RANK ' + event.rank + (event.teamsRanked === null ? '' : ' / ' + event.teamsRanked);
}

function rowFor(event, index) {
  const baseline = ROW_FIRST + index * ROW_HEIGHT + 40;
  return [
    textAt(0, baseline, cut(event.name || event.city, NAME_FITS), 'name'),
    textAt(690, baseline, recordText(event.record), 'record', 'end'),
    textAt(1096, baseline, rankText(event), 'rank', 'end'),
  ];
}

// The EPA after each event as a line, with the first and the last number at its ends. One number is
// written and not drawn, since a line needs two.
function epaParts(series) {
  if (series.length === 0) return [];
  if (series.length === 1) return [textAt(0, 476, 'EPA ' + numberFor(series[0]), 'name')];

  return [
    textAt(0, 476, 'EPA ' + numberFor(series[0]), 'name'),
    `<polyline class="line" points="${linePoints(series).join(' ')}"/>`,
    textAt(1096, 476, numberFor(series[series.length - 1]), 'rank', 'end'),
  ];
}

function chart(lastSeason) {
  const events = lastSeason.events.slice().sort((first, second) => (first.startDate < second.startDate ? -1 : 1));
  const shown = events.slice(0, MAX_EVENTS);
  const series = epaSeries(events).slice(0, 12);
  const record = seasonRecord(events);

  const parts = [
    textAt(0, 44, 'RECORD', 'label'),
    textAt(0, 140, record ? recordText(record) : '-', 'big'),
    textAt(560, 44, 'EVENTS', 'label'),
    textAt(560, 140, String(events.length), 'big'),
  ];
  shown.forEach((event, index) => parts.push.apply(parts, rowFor(event, index)));
  parts.push.apply(parts, epaParts(series));

  return chartMarkup('Last season: record ' + (record ? recordText(record) : 'not known') + ', ' + events.length + ' events', parts);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const lastSeason = state.entry ? state.entry.lastSeason : null;
  const title = lastSeason && lastSeason.season !== null ? String(lastSeason.season) : 'LAST YR';
  const inner = lastSeason ? chart(lastSeason) : emptyMarkup('There are no results from last season yet.');

  return pageMarkup('competition-last-season', title, tagTextFor(state.frc, now) || 'LAST SEASON', inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
