// The season timeline: a line from today to the last of the coming dates, with a dot for each date and
// the days left under or over it. The dates are the next date of the countdown, each event of the team
// that is not over, and the state championship (core/competition.js, timelineMarkers). It runs all
// season. The line and the dots are plain SVG, drawn once in a body of 1096 x 512.

import { cardState, chartMarkup, cut, daysText, emptyMarkup, pageMarkup, tagTextFor, textAt } from '../../core/competition-draw.js';
import { timelineMarkers } from '../../core/competition.js';
import { shortDate } from '../../core/frc.js';

// The line is drawn at the middle of the body. Its dots are between LINE_LEFT and LINE_RIGHT, which
// leaves room for the text of the first and the last, 124 px each side of its dot.
const LINE_Y = 256;
const LINE_LEFT = 124;
const LINE_RIGHT = 972;

// Neighbouring dots are at least this far apart. The text of one dot is on one side of the line and the
// text of the next on the other, so two on the same side are twice as far apart, enough for 9 letters.
const MIN_GAP = 120;
const NAME_FITS = 9;

// Where the text goes: the days next to the line and the name beyond them. Above the line for the
// dots 0, 2, 4 and so on (today is 0), and below it for the others.
const above = { near: 206, far: 154, stemFrom: 238, stemTo: 218 };
const below = { near: 336, far: 388, stemFrom: 274, stemTo: 294 };

// The horizontal place of each dot, from the days left to each. The first is today, at the left end.
// A dot is as far along the line as its date is along the season, but never closer than MIN_GAP to the
// one before it. When that pushes the last dot past the right end, the dots are pulled back from the right.
export function dotPositions(days) {
  const furthest = Math.max(1, ...days);
  const places = days.map(day => LINE_LEFT + (day / furthest) * (LINE_RIGHT - LINE_LEFT));

  for (let index = 1; index < places.length; index++) {
    places[index] = Math.max(places[index], places[index - 1] + MIN_GAP);
  }
  if (places.length > 1 && places[places.length - 1] > LINE_RIGHT) {
    places[places.length - 1] = LINE_RIGHT;
    for (let index = places.length - 2; index >= 0; index--) {
      places[index] = Math.min(places[index], places[index + 1] - MIN_GAP);
    }
  }
  return places.map(place => Math.round(place));
}

function daysLabel(marker) {
  if (marker.now) return 'NOW';
  return marker.days === 0 ? 'TODAY' : daysText(marker.days);
}

// Today first, then the coming dates. A dot has the days text next to the line and the name beyond it.
function dotsFor(markers, today) {
  const dots = [{ kind: 'today', days: 0, big: 'TODAY', small: shortDate(today) }];
  markers.forEach(marker => dots.push({ kind: marker.kind, days: marker.days, big: daysLabel(marker), small: cut(marker.label, NAME_FITS), now: marker.now }));
  return dots;
}

function chart(markers, today) {
  const dots = dotsFor(markers, today);
  const places = dotPositions(dots.map(dot => dot.days));
  const parts = [`<line class="axis" x1="${LINE_LEFT}" y1="${LINE_Y}" x2="${places[places.length - 1]}" y2="${LINE_Y}"/>`];

  dots.forEach((dot, index) => {
    const side = index % 2 === 0 ? above : below;
    const on = dot.now ? ' on' : '';

    parts.push(`<line class="stem" x1="${places[index]}" y1="${side.stemFrom}" x2="${places[index]}" y2="${side.stemTo}"/>`);
    parts.push(`<circle class="dot dot-${dot.kind}${on}" cx="${places[index]}" cy="${LINE_Y}" r="14"/>`);
    parts.push(textAt(places[index], side.near, dot.big, 'days', 'middle'));
    if (dot.small) parts.push(textAt(places[index], side.far, dot.small, 'name', 'middle'));
  });

  return chartMarkup('The season timeline: ' + dots.map(dot => dot.big + (dot.small ? ' ' + dot.small : '')).join(', '), parts);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const markers = state.entry ? timelineMarkers(content, state.entry, now) : [];
  const inner = markers.length === 0 ? emptyMarkup('No dates are coming up yet.') : chart(markers, state.today);

  return pageMarkup('competition-timeline', 'SEASON', tagTextFor(state.frc, now), inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
