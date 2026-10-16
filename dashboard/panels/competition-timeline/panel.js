// The season timeline: a line from today to the last of the coming dates with a numbered dot for each date,
// and under it a legend with a row for each dot. The dates are the next date of the countdown, each event of
// the team that is not over, and the state championship (core/competition.js, timelineMarkers). It runs all
// season. The line and the dots are plain SVG, drawn once. The only words on the line are TODAY at the left dot
// and the label of the countdown above its dot. The legend is HTML, so that a long name is cut off with an
// ellipsis at its real width. Six dots at the most, and +N more events says how many more there are.

import { bodySize, cardState, daysText, emptyMarkup, pageMarkup, tagTextFor, textAt } from '../../core/competition-draw.js';
import { timelineDates, timelineMarkers } from '../../core/competition.js';
import { shortDate } from '../../core/frc.js';
import { escapeHtml } from '../../core/text.js';
import { textWidth } from '../../core/text-width.js';

// The line is drawn in a strip across the top of the body, 140 high, with the legend under it. The dots are
// between LINE_LEFT and LINE_RIGHT: a numbered dot is 60 wide, and today's dot is 44.
const TRACK = { y: 96, height: 140, left: 32, right: 1064, dot: 30, today: 22 };
const LABEL_Y = 50;
const LABEL_GAP = 16;

// Neighbouring dots are at least this far apart, which leaves 16 between two numbered dots
const MIN_GAP = 76;

// The horizontal place of each dot, from the days left to each. The first is today, at the left end.
// A dot is as far along the line as its date is along the season, but never closer than MIN_GAP to the
// one before it. When that pushes the last dot past the right end, the dots are pulled back from the right.
export function dotPositions(days) {
  const furthest = Math.max(1, ...days);
  const places = days.map(day => TRACK.left + (day / furthest) * (TRACK.right - TRACK.left));

  for (let index = 1; index < places.length; index++) {
    places[index] = Math.max(places[index], places[index - 1] + MIN_GAP);
  }
  if (places.length > 1 && places[places.length - 1] > TRACK.right) {
    places[places.length - 1] = TRACK.right;
    for (let index = places.length - 2; index >= 0; index--) {
      places[index] = Math.min(places[index], places[index + 1] - MIN_GAP);
    }
  }
  return places.map(place => Math.round(place));
}

// What the legend says at the right of a row: NOW while the event is on, TODAY on the day, otherwise the days left
export function daysLabel(marker) {
  if (marker.now) return 'NOW';
  return marker.days === 0 ? 'TODAY' : daysText(marker.days);
}

// The second line of a row of the legend: the city and the day, or only the day for a date with no city
function whereText(marker) {
  const day = shortDate(marker.date);
  return marker.city ? marker.city + ' · ' + day : day;
}

// The place of the label of the countdown over its dot. It is centred on the dot, kept inside the body
// and clear of TODAY, which is at the left end. The left end of the text.
export function labelLeft(center, width, todayRight) {
  const centred = center - width / 2;
  return Math.round(Math.max(Math.min(centred, bodySize.width - width), todayRight + LABEL_GAP));
}

// The dots and the line, as an SVG the width of the body. markers are the ones that get a dot, at most six.
function trackMarkup(markers, today) {
  const places = dotPositions([0].concat(markers.map(marker => marker.days)));
  const parts = [`<line class="axis" x1="${places[0]}" y1="${TRACK.y}" x2="${places[places.length - 1]}" y2="${TRACK.y}"/>`];
  const todayWidth = textWidth('TODAY', 700, 44);

  parts.push(`<circle class="dot dot-today" cx="${places[0]}" cy="${TRACK.y}" r="${TRACK.today}"/>`);
  parts.push(textAt(0, LABEL_Y, 'TODAY', 'label'));

  markers.forEach((marker, index) => {
    const x = places[index + 1];
    const on = marker.now ? ' on' : '';

    parts.push(`<circle class="dot dot-${marker.kind}${on}" cx="${x}" cy="${TRACK.y}" r="${TRACK.dot}"/>`);
    parts.push(textAt(x, TRACK.y + 15, String(index + 1), 'number', 'middle'));

    if (marker.kind === 'countdown') {
      const width = textWidth(marker.name, 700, 44);
      parts.push(textAt(labelLeft(x, width, todayWidth), LABEL_Y, marker.name, 'label'));
    }
  });

  const description = 'The season timeline from ' + shortDate(today) + ': ' + markers.map((marker, index) => (index + 1) + ' ' + marker.name + ' ' + shortDate(marker.date)).join(', ');
  return `<svg class="chart" width="${bodySize.width}" height="${TRACK.height}" viewBox="0 0 ${bodySize.width} ${TRACK.height}" role="img" aria-label="${escapeHtml(description)}">${parts.join('')}</svg>`;
}

// A row of the legend: the number of its dot, the name of the event on one line, the city and the day, and the days left
function entryMarkup(marker, index) {
  return `<div class="entry"><span class="entry-number">${index + 1}</span><span class="event">${escapeHtml(marker.name)}</span><span class="where">${escapeHtml(whereText(marker))}</span><span class="days">${daysLabel(marker)}</span></div>`;
}

function moreMarkup(extra) {
  if (extra === 0) return '';
  return `<div class="more">+${extra} more ${extra === 1 ? 'event' : 'events'}</div>`;
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const markers = state.entry ? timelineMarkers(content, state.entry, now, Infinity) : [];
  const shown = markers.slice(0, timelineDates);
  const inner = markers.length === 0
    ? emptyMarkup('No dates are coming up yet.')
    : trackMarkup(shown, state.today) + `<div class="legend">${shown.map(entryMarkup).join('')}</div>` + moreMarkup(markers.length - shown.length);

  return pageMarkup('competition-timeline', 'SEASON', tagTextFor(state.frc, now), inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
