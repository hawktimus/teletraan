// The forecast: how Match13 expects the event to end for each of our teams. A row for each team has the most
// likely finishing rank, the range from the 5th to the 95th percentile of the simulation drawn as a bar on a
// rank axis, the average ranking points and, in words, the chance of the top 8. The numbers come from
// match13.json (core/match13.js, docs/match13.md).

import { bodySize, chartMarkup, emptyMarkup, dataNow, eventTitle, ordinal, pageMarkup, teamLabel, textAt } from '../../core/match13-draw.js';
import { forecastEvent } from '../../core/match13.js';
import { cut } from '../../core/competition-draw.js';

const AXIS = { left: 500, right: 1080, top: 86 };
const ROW = { first: 70, height: 196 };
const TOP = 8;

// The chance of the top 8 in words. The simulation gives three points of the finish, not every one, so a
// number would claim more than the file knows.
export function topEightWords(row) {
  if (row.p95 <= TOP) return 'TOP 8: VERY LIKELY';
  if (row.p50 <= TOP) return 'TOP 8: LIKELY';
  if (row.p5 <= TOP) return 'TOP 8: POSSIBLE';
  return 'TOP 8: UNLIKELY';
}

// Where a rank sits on the axis. The axis runs from rank 1 to the last rank of the event.
function xOf(rank, last) {
  const span = Math.max(1, last - 1);
  return Math.round(AXIS.left + (Math.min(Math.max(rank, 1), last) - 1) / span * (AXIS.right - AXIS.left));
}

// The ranks written under the axis: the first, the cut of the top 8 and the last
export function ticksFor(last) {
  const ticks = [1];
  if (last > TOP + 1) ticks.push(TOP);
  if (last > 1) ticks.push(last);
  return ticks;
}

function rowParts(row, label, top, last) {
  const low = xOf(row.p5, last);
  const high = Math.max(xOf(row.p95, last), low + 14);
  const middle = xOf(row.p50, last);
  const y = top + AXIS.top;
  const range = row.p5 === row.p95 ? 'SETTLED AT ' + ordinal(row.p50) : 'RANGE ' + ordinal(row.p5) + ' TO ' + ordinal(row.p95);
  const parts = [
    textAt(0, top + 44, label, 'name'),
    textAt(0, top + 124, ordinal(row.p50), 'rank'),
    textAt(200, top + 124, 'MOST LIKELY', 'note'),
    textAt(0, top + 180, range, 'range'),
    textAt(AXIS.left, top + 44, topEightWords(row), 'chance'),
    `<line class="axis" x1="${AXIS.left}" y1="${y}" x2="${AXIS.right}" y2="${y}"/>`,
    `<line class="cut" x1="${xOf(TOP, last)}" y1="${y - 26}" x2="${xOf(TOP, last)}" y2="${y + 26}"/>`,
    `<rect class="span" x="${low}" y="${y - 18}" width="${high - low}" height="36"/>`,
    `<circle class="middle" cx="${middle}" cy="${y}" r="14"/>`,
  ];
  ticksFor(last).forEach(rank => {
    const x = xOf(rank, last);
    parts.push(textAt(x, top + AXIS.top + 52, String(rank), 'tick', rank === 1 ? 'start' : rank === last ? 'end' : 'middle'));
  });
  parts.push(textAt(AXIS.left, top + 180, Math.round(row.meanRps) + ' RANKING POINTS', 'points'));
  return parts;
}

function dateText(simmedAt, generatedAt) {
  const moment = new Date(typeof simmedAt === 'number' ? simmedAt : Date.parse(generatedAt));
  if (isNaN(moment.getTime())) return '';
  return moment.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function chart(data, found, content, now) {
  const numbers = data.ours.map(team => team.number);
  const rows = found.sim.teams.filter(row => numbers.includes(row.teamNumber)).sort((first, second) => numbers.indexOf(first.teamNumber) - numbers.indexOf(second.teamNumber));
  const last = Math.max(found.sim.teamCount || 0, ...found.sim.teams.map(row => row.p95), TOP + 1);
  const parts = [textAt(0, 44, cut('HOW WE EXPECT ' + eventTitle(content, found.key, now).toUpperCase() + ' TO END', 42), 'event')];
  const words = [];

  rows.forEach((row, index) => {
    parts.push(...rowParts(row, teamLabel(data.ours, row.teamNumber), ROW.first + index * ROW.height, last));
    words.push(teamLabel(data.ours, row.teamNumber) + ' most likely ' + ordinal(row.p50));
  });

  const when = dateText(found.sim.simmedAt, data.generatedAt);
  const runs = found.sim.iterations === null ? '' : found.sim.iterations + ' runs';
  parts.push(textAt(0, bodySize.height - 12, ['Match13 simulation', runs, when].filter(part => part !== '').join(', '), 'source'));

  return chartMarkup('Forecast for the event: ' + words.join(', '), parts);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const data = dataNow();
  const found = forecastEvent(data);
  const inner = found ? chart(data, found, content, now) : emptyMarkup('Match13 has no forecast for this event yet.');

  return pageMarkup('competition-forecast', 'FORECAST', data, now, inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
