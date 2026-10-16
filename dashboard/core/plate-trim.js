// The trimmed frames of a team and the bar marks: wear, neon inset and the lines of a bar (part of plate.js).

import { boxOf, giveRivets, otherCorners, rivetRadius, slantOf, tenth } from './plate-shapes.js';

// The large or the small frame with the top right and bottom left corners cut in place of the top left and
// bottom right (corner is 'tr'), and with a slanted tab in place of the notch (notch is 'slant'). The sizes are
// worked out from the Prime frame given, so the cut corners and the header are the ones written there
export function trimmedFrame(prime, corner, notch) {
  const box = boxOf(prime);
  const { left, top, right, bottom, cutX, cutY } = box;
  const header = prime.body[0][1];
  const tabEnd = notch === 'slant' ? slantOf(prime.seams[1], prime.slantTop) : prime.seams[1];
  const cutTopRight = corner === 'tr';

  const shape = Object.assign({}, prime, {
    headerLeft: [cutTopRight ? [left, top] : prime.outline[2]].concat(tabEnd, [[left, header]], cutTopRight ? [] : [prime.outline[1]]),
    headerRight: [tabEnd[0]].concat(cutTopRight ? [[right - cutX, top], [right, top + cutY]] : [[right, top]], [[right, header]], tabEnd.slice(1).reverse()),
    seams: [prime.seams[0], tabEnd],
  });
  if (cutTopRight) {
    Object.assign(shape, otherCorners(box), {
      body: [[left, header], [right, header], [right, bottom], [left + cutX, bottom], [left, bottom - cutY]],
    });
  }

  shape.pieces = trimmedPieces(prime, shape, box, header);
  giveRivets(shape);
  return shape;
}

// The pieces of the frame for the mechanical page change: the list of the Prime frame, in the same order. The
// header plates and the line of the notch follow the shape. With the other corners cut, so do the plates of the
// body and the four pieces that hold a corner. A piece keeps the name of the place it holds, so the piece called
// corner-top-left is the top left corner even when it is square, and frame.css moves it as it always has. The
// screws are in the pieces that hold the corners that are cut
function trimmedPieces(prime, shape, box, header) {
  const { left, top, right, bottom, cutX, cutY } = box;
  const lineOf = name => prime.pieces.find(piece => piece.name === name).line;
  const bodyLeft = prime.pieces.find(piece => piece.name === 'plate-body-left');
  const middle = bodyLeft ? bodyLeft.points[1][0] : 0;
  const leftFrom = lineOf('corner-top-left')[0][1];
  const topTo = lineOf('corner-top-left')[3][0];
  const tabAt = lineOf('edge-top-left')[1][0];
  const rightFrom = lineOf('edge-right')[0][1];
  const rightTo = lineOf('edge-right')[1][1];
  const bottomFrom = lineOf('edge-bottom')[0][0];
  const bottomTo = lineOf('edge-bottom')[1][0];

  const changed = {
    'plate-header-left': { points: shape.headerLeft },
    'plate-header-right': { points: shape.headerRight },
    'seam-notch': { line: shape.seams[1] },
  };
  const swapped = shape.outline === prime.outline ? {} : {
    'plate-body': { name: 'plate-body', fill: 'body', points: shape.body },
    'plate-body-left': { name: 'plate-body-left', fill: 'body', points: [[left, header], [middle, header], [middle, bottom], [left + cutX, bottom], [left, bottom - cutY]] },
    'plate-body-right': { name: 'plate-body-right', fill: 'body', points: [[middle, header], [right, header], [right, bottom], [middle, bottom]] },
    'edge-top-right': { name: 'edge-top-right', line: [[tabAt, top], [right - cutX, top], [right, top + cutY], [right, rightFrom]], screws: 'b' },
    'edge-bottom-left': { name: 'edge-bottom-left', line: [[left, leftFrom], [left, bottom - cutY], [left + cutX, bottom], [bottomFrom, bottom]], screws: 'a' },
    'corner-top-left': { name: 'corner-top-left', line: [[left, leftFrom], [left, top], [topTo, top]] },
    'corner-bottom-right': { name: 'corner-bottom-right', line: [[right, rightTo], [right, bottom], [bottomTo, bottom]] },
  };

  return prime.pieces.map(piece => swapped[piece.name] || (changed[piece.name] ? Object.assign({}, piece, changed[piece.name]) : piece));
}

// The countdown with the top right and bottom left corners cut. The teeth of its jaw are the Prime teeth turned
// across the frame, so the last tooth is as clear of the screw at the top right as the first one is of the screw
// at the top left
export function trimmedCountdown(prime) {
  const box = boxOf(prime);
  const { left, top, right, bottom, cutX, cutY } = box;
  const jaw = prime.outline.slice(2, prime.outline.length - 2).map(point => [left + right - point[0], point[1]]).reverse();
  const outline = [[left + cutX, bottom], [left, bottom - cutY]].concat(jaw, [[right, top + cutY], [right, bottom]]);

  const shape = Object.assign({}, prime, {
    body: [[left, top], [right - cutX, top], [right, top + cutY], [right, bottom], [left + cutX, bottom], [left, bottom - cutY]],
    outline: outline,
    split: outline.length - 3, // the top right corner, where the jaw ends
    screws: { a: [[left + cutX, bottom]], b: [[right - cutX, top]] },
  });
  giveRivets(shape);
  return shape;
}

// The frame of the full screen alert and announcement with the top right and bottom left corners cut
export function trimmedScreenFrame(prime) {
  return Object.assign({}, prime, otherCorners(boxOf(prime)));
}

// True when the point is on the line, which goes through the points
export function liesOn(point, line) {
  return line.slice(1).some((to, index) => {
    const from = line[index];
    const cross = (to[0] - from[0]) * (point[1] - from[1]) - (to[1] - from[1]) * (point[0] - from[0]);
    const between = axis => point[axis] >= Math.min(from[axis], to[axis]) - .05 && point[axis] <= Math.max(from[axis], to[axis]) + .05;
    return Math.abs(cross) < 1 && between(0) && between(1);
  });
}

// Every rivet of a row is a circle in one path, so a row is one element. The
// row of a half is labelled, so frame.css can bring it in once the frame is drawn.
// The class is rivets, which base.css shows for Original and Minimal only, unless
// the caller names another.
export function rivetsMarkup(centers, labelled, name = 'rivets') {
  if (centers.length === 0) return '';

  const size = 2 * rivetRadius;
  const circles = centers.map(center => `M${tenth(center[0] - rivetRadius)} ${center[1]}a${rivetRadius} ${rivetRadius} 0 1 0 ${size} 0a${rivetRadius} ${rivetRadius} 0 1 0 -${size} 0`).join('');
  return `<path class="${name}"${labelled ? ' data-part="rivets"' : ''} d="${circles}"/>`;
}


// The rust of a frame: a soft smudge under each arc, then the arcs, which are all one path.
// They are on the steel, so they are in the half of the frame that has the bottom corners
// and in the pieces that have them (class art-minimal, which styles/minimal.css paints).
// The rust in a half is one group with its own part, so it comes in once the lines are drawn
export function wearMarkup(items, labelled) {
  if (!items || items.length === 0) return '';

  const smudges = items.map(item => `<circle class="art-minimal art-smudge" cx="${item.smudge[0]}" cy="${item.smudge[1]}" r="${wearRadius}"/>`).join('');
  const rust = smudges + `<path class="art-minimal art-wear" d="${items.map(item => item.arc).join('')}"/>`;
  return labelled ? `<g data-part="wear">${rust}</g>` : rust;
}


// The frames of the bar layout

// A bar frame is a plate with the same outline for all three, a rectangle with
// ten corners: a cut corner at the top left and the bottom right, and a step
// at the top right and the bottom left, which is the cut corners turned half
// way round. The line of the frame is 4px inside the edge of its box, as it is
// for the other frames. The points of the outline run clockwise from the bottom
// left:
//
//   0  bottom left corner, one step above the bottom line
//   1  foot of the top left cut corner      2  top of it
//   3  start of the step at the top right   4  end of it
//   5  top right corner, one step below the top line
//   6  top of the bottom right cut corner   7  foot of it
//   8  start of the step at the bottom left 9  end of it
//
// The neon line, the line of pink conduit and the pink brackets are made by moving
// points of the outline in or out (offsetPoint), so they follow it round every
// corner. The sizes below are the ones in docs/layouts.md ("Frames"), and
// tests/layouts.test.mjs holds them to the numbers of the layout.
export const barNeonInset = 10; // the neon line, from the line of the edge
export const barConduitInset = 16; // the pink conduit line, just inside the neon
export const barBracketOutset = 22; // the pink brackets, outside the edge

// The ticker's frames have the thin edge (base.css, "The thin plate edge"). Their line is 1 in from the
// box, which keeps the outer edge of the metal where the thick edge had it, and the neon is 7 in
// from the line, against the metal. The frame is 5 higher than the row of 72, so the text of the ticker,
// which is 53 high with its descenders, has the neon 2 clear on both sides. The pink brackets are 18
// outside the line, so the lower one stays on the screen.
export const thinEdge = { line: 1, neon: 7, bracket: 18 };
export const hazardHeight = 12; // the stripe under the header
const hazardPitch = 44;
const hazardWidth = 22;
export const slashCount = 6;
export const slashPitch = 40;
export const slashWidth = 22;
export const slashSlant = 10;
const slashHeight = 14;
const tickPitch = 18; // Minimal: the ticks along the foot of the header
const tickWidth = 4;
const tickHeight = 10;
export const weldGap = 4; // the light line of the weld seam is this far from the dark one
export const wearRadius = 26; // the smudge of rust under an arc

function unit(from, to) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

// The unit vector from an edge into the frame. The outline runs clockwise on the
// screen, so the inside is on the right of the way it runs.
function inward(from, to) {
  const direction = unit(from, to);
  return [-direction[1], direction[0]];
}

// A point of the outline (or a point on one of its edges) moved distance into the
// frame, or out of it when the distance is negative. A corner moves along the line
// that is half way between its two edges, so both edges stay distance away.
export function offsetPoint(outline, point, distance) {
  const count = outline.length;
  const same = (one, other) => Math.abs(one[0] - other[0]) < .05 && Math.abs(one[1] - other[1]) < .05;
  const corner = outline.findIndex(vertex => same(vertex, point));

  if (corner !== -1) {
    const before = inward(outline[(corner + count - 1) % count], outline[corner]);
    const after = inward(outline[corner], outline[(corner + 1) % count]);
    const scale = distance / (1 + before[0] * after[0] + before[1] * after[1]);
    return [tenth(point[0] + (before[0] + after[0]) * scale), tenth(point[1] + (before[1] + after[1]) * scale)];
  }

  const edge = outline.findIndex((vertex, index) => liesOn(point, [vertex, outline[(index + 1) % count]]));
  if (edge === -1) throw new Error('The point ' + point.join(',') + ' is not on the outline');

  const normal = inward(outline[edge], outline[(edge + 1) % count]);
  return [tenth(point[0] + normal[0] * distance), tenth(point[1] + normal[1] * distance)];
}

export function offsetOutline(outline, distance) {
  return outline.map(point => offsetPoint(outline, point, distance));
}

// The stripes of the hazard band: slanted bars from x to x, between two heights
export function hazardPath(from, to, top, bottom) {
  const slant = bottom - top;
  let data = '';
  for (let x = from; x + slant + hazardWidth <= to; x += hazardPitch) {
    data += `M${x} ${bottom}L${x + slant} ${top}L${x + slant + hazardWidth} ${top}L${x + hazardWidth} ${bottom}Z`;
  }
  return data;
}

// A row of slashes, the first one at x, standing on y
export function slashPath(x, bottom) {
  let data = '';
  for (let index = 0; index < slashCount; index++) {
    const left = x + index * slashPitch;
    data += `M${left} ${bottom}L${left + slashSlant} ${bottom - slashHeight}L${left + slashSlant + slashWidth} ${bottom - slashHeight}L${left + slashWidth} ${bottom}Z`;
  }
  return data;
}

// A row of ticks, each one a small bar standing on the line at y, from x to x
export function tickPath(from, to, y) {
  let data = '';
  for (let x = from; x + tickWidth <= to; x += tickPitch) {
    data += `M${x} ${y - tickHeight}h${tickWidth}v${tickHeight}h-${tickWidth}Z`;
  }
  return data;
}

// The LINK 04 readout of Cybertron's tall frames, drawn as line art and not as text: the glyphs are strokes on a
// grid of 8 by 14, 13 apart, and it is a decorative mark that says nothing a reader needs. x and y are the top left
const linkGlyphs = {
  L: 'M0 0V14H8',
  I: 'M4 0V14',
  N: 'M0 14V0L8 14V0',
  K: 'M0 0V14M8 0L0 8M2.5 6L8 14',
  0: 'M0 0H8V14H0Z',
  4: 'M6 14V0L0 10H8',
};
export const linkMarkWidth = 93;

export function linkMarkPath(x, y) {
  let data = '';
  let left = x;
  'LINK 04'.split('').forEach(letter => {
    if (linkGlyphs[letter]) data += linkGlyphs[letter].replace(/([MLHV])([-\d. ]*)/g, (all, command, numbers) => {
      const values = numbers.trim().split(/\s+/).filter(Boolean).map(Number);
      if (command === 'H') return 'H' + (left + values[0]);
      if (command === 'V') return 'V' + (y + values[0]);
      return command + values.map((value, index) => (index % 2 === 0 ? left + value : y + value)).join(' ');
    });
    left += letter === ' ' ? 14 : 13;
  });
  return data;
}

// The rust at the two bottom corners of a frame, drawn as stroked arcs with a soft
// smudge under each, which is a radial gradient (index.html, wear-rust). One arc stands on
// the left edge just above the step, bulging into the frame, and one on the bottom edge
// just before the cut corner, bulging up. span is how long an arc is along its edge. The
// anchor is a point on the edge, which is how a piece of the page change finds its own.
// A frame with the top right and bottom left corners cut (turned is true) has them the other
// way round: one on the right edge above the step, and one on the bottom edge after the cut
export function wearOf(outline, span, turned) {
  const bulge = Math.round(span / 3);
  const side = turned ? -1 : 1; // which way the arc on the edge bulges
  const edge = outline[turned ? 7 : 0];
  const end = edge[1] - 8;
  const start = end - span;
  const across = tenth((start + end) / 2);

  const foot = outline[turned ? 0 : 7];
  const first = turned ? foot[0] + 36 : foot[0] - 36 - span; // clear of the bolt at the foot of the cut corner
  const last = first + span;
  const along = tenth((first + last) / 2);
  const line = foot[1] - 2;

  return [
    { anchor: [edge[0], across], arc: `M${edge[0] + 2 * side} ${start}Q${edge[0] + side * (2 + 2 * bulge)} ${across} ${edge[0] + 2 * side} ${end}`, smudge: [edge[0] + 8 * side, across] },
    { anchor: [along, foot[1]], arc: `M${first} ${line}Q${along} ${line - 2 * bulge} ${last} ${line}`, smudge: [along, foot[1] - 8] },
  ];
}
