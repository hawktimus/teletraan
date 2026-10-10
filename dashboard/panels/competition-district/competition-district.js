// The district points: the points of the team in the district, as a big number, and a bar that fills
// as the points come up to the cutoff for the state championship. The points come from the districtPoints
// part of the team's entry in frc-status. The cutoff is empty until the script on the Mini has been told how
// many teams the state championship takes (docs/frc-feed.md, "The district cutoff"), and then the bar is left
// out and a sentence says so.

import { cardState, chartMarkup, emptyMarkup, pageMarkup, tagTextFor, textAt } from '../../core/competition-draw.js';

// The bar and its lane. The lane is 6 px bigger than the bar on every side.
const LANE = { left: 0, top: 290, width: 1096, height: 64 };
const FILL = { left: 6, top: 296, width: 1084, height: 52 };

// How full the bar is, from 0 to 1. A cutoff of 0 or less leaves it full.
export function fillOf(total, cutoff) {
  if (cutoff <= 0) return 1;
  return Math.min(1, Math.max(0, total / cutoff));
}

// What is under the middle of the bar: the points still to find, or that the team is there
export function standingText(total, cutoff) {
  if (total > cutoff) return 'ABOVE THE CUTOFF';
  if (total === cutoff) return 'AT THE CUTOFF';
  return Math.round((cutoff - total) * 10) / 10 + ' TO GO';
}

function barParts(points) {
  if (points.cutoff === null) return [textAt(0, 340, 'The cutoff is not known yet.', 'note')];

  const width = Math.round(FILL.width * fillOf(points.total, points.cutoff));
  return [
    `<rect class="lane" x="${LANE.left}" y="${LANE.top}" width="${LANE.width}" height="${LANE.height}"/>`,
    `<rect class="fill" x="${FILL.left}" y="${FILL.top}" width="${width}" height="${FILL.height}"/>`,
    textAt(0, 420, '0', 'note'),
    textAt(548, 420, standingText(points.total, points.cutoff), 'standing', 'middle'),
    textAt(1096, 420, 'CUTOFF ' + points.cutoff, 'note', 'end'),
  ];
}

function chart(points) {
  const parts = [
    textAt(0, 44, 'POINTS', 'label'),
    textAt(0, 230, String(points.total), 'total'),
  ];
  if (points.rank !== null) parts.push(textAt(420, 230, 'RANK ' + points.rank, 'rank'));
  parts.push.apply(parts, barParts(points));

  const cutoff = points.cutoff === null ? 'cutoff not known' : 'cutoff ' + points.cutoff;
  return chartMarkup('District points: ' + points.total + ', ' + cutoff, parts);
}

// The page as markup, for the time given. now is a Date.
export function markupFor(content, now) {
  const state = cardState(content, now);
  const points = state.entry ? state.entry.districtPoints : null;
  const inner = points ? chart(points) : emptyMarkup('There are no district points yet.');

  return pageMarkup('competition-district', 'DISTRICT', tagTextFor(state.frc, now), inner);
}

export function mount(host, content) {
  host.innerHTML = markupFor(content, new Date());
}
