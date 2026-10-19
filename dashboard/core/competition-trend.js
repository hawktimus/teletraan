// The season trend of the EPA: a line through the daily snapshots, drawn once, with the first and last day under it, the
// lowest and highest rating at the side, and the last rating written next to the last point. The preview card has it on a
// page of its own and so does the recap. The numbers are pixels in the body of a card (1096 x 512).
//
// The line is one SVG polyline. Nothing moves: the card arrives and the line is already there.

import { shortDate } from './frc.js';
import { epaSeries } from './competition-scouting.js';
import { numberFor, textAt } from './competition-draw.js';

// The room of the line inside the body. The axis labels are 28px, and the last value is 44px.
const LEFT = 120;
const RIGHT = 960;
const TOP = 96;
const BOTTOM = 420;

// The most points the line has; the snapshots are one a day, 120 at most, so all of them fit
export const trendMostPoints = 120;

// Whether the snapshots make a line: two ratings are the least
export function hasTrend(snapshots) {
  return epaSeries(snapshots).length >= 2;
}

// The points of the line, as pixel pairs, and the lowest and highest rating. Dates are spread by their days and not
// evenly, so a gap of a week is a gap in the line. A line that does not rise or fall is drawn in the middle.
export function trendPoints(series) {
  const days = text => Date.UTC(Number(text.slice(0, 4)), Number(text.slice(5, 7)) - 1, Number(text.slice(8, 10))) / 86400000;
  const low = Math.min(...series.map(item => item.epa));
  const high = Math.max(...series.map(item => item.epa));
  const first = days(series[0].date);
  const span = days(series[series.length - 1].date) - first;

  const points = series.map((item, index) => {
    const along = span === 0 ? index / (series.length - 1) : (days(item.date) - first) / span;
    const x = Math.round(LEFT + along * (RIGHT - LEFT));
    const y = high === low ? Math.round((TOP + BOTTOM) / 2) : Math.round(BOTTOM - ((item.epa - low) / (high - low)) * (BOTTOM - TOP));
    return { x: x, y: y };
  });
  return { points: points, low: low, high: high };
}

// The parts of the trend page: a heading, the line, its axis labels and the last value. snapshots are the daily
// snapshots of the team. The page is only drawn when hasTrend() says there is a line.
export function trendParts(snapshots, heading) {
  const series = epaSeries(snapshots).slice(-trendMostPoints);
  const shape = trendPoints(series);
  const last = shape.points[shape.points.length - 1];
  const lastLabel = numberFor(series[series.length - 1].epa);

  const parts = [
    textAt(0, 52, heading, 'sub'),
    textAt(LEFT - 12, TOP + 8, numberFor(shape.high), 'axis', 'end'),
    textAt(LEFT - 12, BOTTOM + 8, numberFor(shape.low), 'axis', 'end'),
    `<line class="axis-line" x1="${LEFT}" y1="${BOTTOM + 24}" x2="${RIGHT}" y2="${BOTTOM + 24}"/>`,
    `<polyline class="trend-line" points="${shape.points.map(point => point.x + ',' + point.y).join(' ')}"/>`,
    `<circle class="trend-dot" cx="${last.x}" cy="${last.y}" r="8"/>`,
    textAt(LEFT, BOTTOM + 62, shortDate(series[0].date), 'axis'),
    textAt(RIGHT, BOTTOM + 62, shortDate(series[series.length - 1].date), 'axis', 'end'),
    textAt(1096, Math.max(52, Math.min(last.y + 16, BOTTOM)), lastLabel, 'last', 'end'),
  ];
  return parts;
}
