// Builds the plates that panels are made from: flat purple shapes with a
// polished metal edge. Measurements are pixels on the 1920x1080 screen. The
// frame line sits 4px inside the edge of its panel.
//
// An edge is one shape drawn five times (shadow, rim, face, shade, ridge),
// and its colours come from tokens.css. The shape of each frame is added once
// to the hidden defs in index.html, the first time a plate of that kind is
// built, and every later plate points at it with <use>. The gradients and the
// screw are in index.html too. The five layer classes are described in
// base.css.
//
// The frame round a plate is drawn in two halves, each in its own svg:
//   half a: the left side, the top left corner and the top
//   half b: the right side, the bottom right corner and the bottom
// They meet at the top right and the bottom left. Each half carries the screws
// of its own corners, so it can move on its own as one piece.
//
// Every piece is labelled with data-part so frame.js can move it. The panel
// sizes here are repeated in base.css and in each panel's own stylesheet.
// Change them together.
//
// The Original style adds two things to the frames of the large panel, the small
// panel and the countdown: rivets along their long straight edges, and a small
// stamped id in the bottom right corner (HP-01, HP-02, HP-03). Both are always
// in the markup. base.css draws them only while the style is Original, and
// nothing about them moves. The rivets are in the halves of the frame and in its
// pieces, so they go where the frame goes. The id is under the page.
//
// The frames of the steel styles are made by makeBarShape() below ("The frames of the
// bar layout"): the steel edge, a neon line just inside it, hex bolts where the screws
// are, and what only a style draws. All of it is in the markup, and base.css and the
// style's own stylesheet show what the style has.
//
// Cybertron has four of them on the layouts of Original, the standard layout and the
// sidebar layout: the large frame, the small frame, the banner and the ticker
// (cybertron-grid1 and the other three, "The frames of Cybertron"). They have the sizes
// of the frames they stand in for, so nothing about the layout changes. Its countdown is
// the war clock, in its wide form (warHousingMarkup, "The war clock's housing").
//
// The Minimal style has three frames of its own in the bar layout, the main panel, the
// banner and the ticker, cut less deep (bar-main-minimal and the other two). It adds to
// them the rivets that Original has, and rust at two corners, a weld seam, and a row of
// ticks along the foot of the header. It has no stamped id, which is Original's. The style
// whose frames the page draws is chosen when the page starts (core/style.js, shapesFor),
// and when a style with other frames goes on later the frames are drawn again
// (core/areas.js, redrawFrames). frameKind() gives the name of the frame for a style.
//
// There are three ways to get a frame. areaMarkup() is the frame of an area
// that stays on screen while its pages change (the large panel, the small
// panel, the ticker of Cybertron, and the main panel and the ticker of the bar
// layout). It also holds the same frame cut into pieces, hidden, for the
// mechanical page change. plateMarkup() is the whole plate of a panel that sits
// outside the areas and draws its own, the countdown, the banner of Cybertron and
// the banner of the bar layout. frameMarkup() is the full screen frame of the
// alert and the announcement.

// the large panel on the left (1152 x 708)
const grid1 = {
  width: 1152,
  height: 708,
  number: '01', // the number in the stamped id
  body: [[4, 120], [1148, 120], [1148, 640], [1068, 704], [4, 704]],
  headerLeft: [[84, 4], [664, 4], [648, 52], [688, 52], [665.3, 120], [4, 120], [4, 68]],
  headerRight: [[664, 4], [1148, 4], [1148, 120], [665.3, 120], [688, 52], [648, 52]],
  // The frame, clockwise from the bottom left. The halves meet at point
  // number split (counting from 0) and at the first point.
  outline: [[4, 704], [4, 68], [84, 4], [1148, 4], [1148, 640], [1068, 704]],
  split: 3,
  // the line under the header, and the notch shape between the two header plates
  seams: [
    [[4, 120], [1148, 120]],
    [[664, 4], [648, 52], [688, 52], [665.3, 120]],
  ],
  // screws on the ends of the cut corners, shared out between the halves
  screws: { a: [[4, 68], [84, 4]], b: [[1148, 640], [1068, 704]] },
  glintDelay: 2, // seconds after the panel has arrived
};

// the small panel under the countdown (656 x 372)
const grid2 = {
  width: 656,
  height: 372,
  number: '03',
  body: [[4, 84], [652, 84], [652, 320], [592, 368], [4, 368]],
  headerLeft: [[64, 4], [480, 4], [453.3, 84], [4, 84], [4, 52]],
  headerRight: [[480, 4], [652, 4], [652, 84], [453.3, 84]],
  outline: [[4, 368], [4, 52], [64, 4], [652, 4], [652, 320], [592, 368]],
  split: 3,
  seams: [
    [[4, 84], [652, 84]],
    [[480, 4], [453.3, 84]],
  ],
  screws: { a: [[4, 52], [64, 4]], b: [[652, 320], [592, 368]] },
  glintDelay: 8,
};

// The pieces a large or small frame breaks into for the mechanical page
// change, listed from the back to the front. Together they are the whole
// frame: the plates, the two lines under the header, and the edge cut into
// bars. A piece is one of
//   points + fill   a plate: the polygon, and which fill class paints it
//   line            a bar of the frame: the line it follows, drawn as an edge
// A bar may also have screws: 'a' or 'b', the screws of that half of the frame.
// Bars end in a straight run, on a whole number, so neighbours meet exactly
// and the rebuilt frame looks like the one at rest. The name is what frame.css
// moves it by (data-piece), so grid1 and grid2 share their names.
grid1.pieces = [
  { name: 'plate-header-left', fill: 'header-left', points: grid1.headerLeft },
  { name: 'plate-header-right', fill: 'header-right', points: grid1.headerRight },
  { name: 'plate-body-left', fill: 'body', points: [[4, 120], [576, 120], [576, 704], [4, 704]] },
  { name: 'plate-body-right', fill: 'body', points: [[576, 120], [1148, 120], [1148, 640], [1068, 704], [576, 704]] },
  { name: 'seam-line', line: [[4, 120], [1148, 120]] },
  { name: 'seam-notch', line: grid1.seams[1] },
  { name: 'edge-top-left', line: [[230, 4], [664, 4]] },
  { name: 'edge-top-right', line: [[664, 4], [1148, 4], [1148, 170]] },
  { name: 'edge-right', line: [[1148, 170], [1148, 520]] },
  { name: 'edge-bottom', line: [[480, 704], [930, 704]] },
  { name: 'edge-bottom-left', line: [[4, 230], [4, 704], [480, 704]] },
  { name: 'corner-top-left', line: [[4, 230], [4, 68], [84, 4], [230, 4]], screws: 'a' },
  { name: 'corner-bottom-right', line: [[1148, 520], [1148, 640], [1068, 704], [930, 704]], screws: 'b' },
];

grid2.pieces = [
  { name: 'plate-header-left', fill: 'header-left', points: grid2.headerLeft },
  { name: 'plate-header-right', fill: 'header-right', points: grid2.headerRight },
  { name: 'plate-body', fill: 'body', points: grid2.body },
  { name: 'seam-line', line: [[4, 84], [652, 84]] },
  { name: 'seam-notch', line: grid2.seams[1] },
  { name: 'edge-top-left', line: [[160, 4], [480, 4]] },
  { name: 'edge-top-right', line: [[480, 4], [652, 4], [652, 100]] },
  { name: 'edge-right', line: [[652, 100], [652, 240]] },
  { name: 'edge-bottom', line: [[260, 368], [500, 368]] },
  { name: 'edge-bottom-left', line: [[4, 140], [4, 368], [260, 368]] },
  { name: 'corner-top-left', line: [[4, 140], [4, 52], [64, 4], [160, 4]], screws: 'a' },
  { name: 'corner-bottom-right', line: [[652, 240], [652, 320], [592, 368], [500, 368]], screws: 'b' },
];

// the countdown (656 x 320). It has no header, its frame is red, and its
// top edge is cut into teeth like a jaw. The first tooth starts clear of the
// screw, which covers the top edge up to about x = 88.
const countdown = (function () {
  const top = [[64, 4]];
  for (let x = 100; x < 628; x += 24) {
    top.push([x, 4], [x + 12, 14]);
  }
  top.push([628, 4], [652, 4]);

  const outline = [[4, 316], [4, 52]].concat(top, [[652, 268], [592, 316]]);
  const split = outline.length - 3; // the top right corner, (652, 4)

  return {
    width: 656,
    height: 320,
    number: '02',
    red: true,
    // the plate is flat along the top. The teeth are only in the frame.
    body: [[64, 4], [652, 4], [652, 268], [592, 316], [4, 316], [4, 52]],
    outline: outline,
    split: split,
    screws: { a: [[64, 4]], b: [[592, 316]] },
    glintDelay: 5,
  };
})();

const shapes = { grid1: grid1, grid2: grid2, countdown: countdown };

// the frame of the full screen alert and announcement
const screenFrame = {
  width: 1920,
  height: 1080,
  outline: [[64, 1008], [64, 120], [120, 72], [1856, 72], [1856, 960], [1800, 1008]],
  split: 3,
  screws: { a: [[64, 120], [120, 72]], b: [[1856, 960], [1800, 1008]] },
};

// [[1, 2], [3, 4]] becomes "1,2 3,4", which is how SVG wants a list of points
function toPoints(list) {
  return list.map(point => point.join(',')).join(' ');
}

// A list of lines becomes one path: "M4 120L1148 120M664 4L648 52"
function pathData(lines) {
  return lines.map(points => 'M' + points.map(point => point.join(' ')).join('L')).join('');
}

// The two halves of an outline, each as a list of points
function halves(shape) {
  return {
    a: shape.outline.slice(0, shape.split + 1),
    b: shape.outline.slice(shape.split).concat([shape.outline[0]]),
  };
}


// Rivets and the stamped id

// A long straight edge carries a row of rivets, one every 90px, the row centred on
// the edge. An edge under 180px has none, which leaves out the cut corners, where
// the screws are, and the teeth of the countdown. A rivet is a dot of radius 5.
const rivetGap = 90;
const rivetRadius = 5;
const rivetEdgeLeast = 2 * rivetGap;

// The stamped id is a box 112px wide and 20px high, with its text at the right. It
// stands 34px left of the foot of the cut corner, which keeps it clear of the
// screw there, and 14px above the bottom line of the frame.
const idWidth = 112;
const idHeight = 20;

function tenth(number) {
  return Math.round(number * 10) / 10;
}

// The centres of the rivets along the edge from one point to another
export function rivetsAlong(from, to) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (length < rivetEdgeLeast) return [];

  const count = Math.floor(length / rivetGap);
  const margin = (length - (count - 1) * rivetGap) / 2;

  return Array.from({ length: count }, (item, index) => {
    const along = (margin + index * rivetGap) / length;
    return [tenth(from[0] + (to[0] - from[0]) * along), tenth(from[1] + (to[1] - from[1]) * along)];
  });
}

// The rivets along every edge of a line that goes through the points
export function rivetsOf(points) {
  return points.slice(1).reduce((all, point, index) => all.concat(rivetsAlong(points[index], point)), []);
}

// Each half of a frame carries the rivets of its own edges, so they lift with it
[grid1, grid2, countdown].forEach(shape => {
  const half = halves(shape);
  shape.rivets = { a: rivetsOf(half.a), b: rivetsOf(half.b) };
});

// True when the point is on the line, which goes through the points
function liesOn(point, line) {
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
function rivetsMarkup(centers, labelled, name = 'rivets') {
  if (centers.length === 0) return '';

  const size = 2 * rivetRadius;
  const circles = centers.map(center => `M${tenth(center[0] - rivetRadius)} ${center[1]}a${rivetRadius} ${rivetRadius} 0 1 0 ${size} 0a${rivetRadius} ${rivetRadius} 0 1 0 -${size} 0`).join('');
  return `<path class="${name}"${labelled ? ' data-part="rivets"' : ''} d="${circles}"/>`;
}

// The id of a panel. Its letters come from the team (--team-initials, set by
// core/teams.js) and its number from the shape, and base.css writes both. Only the
// frames of Original have one: a bar frame has no number.
function idMarkup(shape) {
  const foot = shape.outline[shape.outline.length - 1]; // the foot of the bottom right cut corner
  const left = foot[0] - 34 - idWidth;
  const top = foot[1] - 14 - idHeight;

  return `<span class="plate-id" data-part="plate-id" data-number="${shape.number}" style="left: ${left}px; top: ${top}px; width: ${idWidth}px;"></span>`;
}


// The rust of a frame: a soft smudge under each arc, then the arcs, which are all one path.
// They are on the steel, so they are in the half of the frame that has the bottom corners
// and in the pieces that have them (class art-minimal, which styles/minimal.css paints).
// The rust in a half is one group with its own part, so it comes in once the lines are drawn
function wearMarkup(items, labelled) {
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
// tools/test-layouts.mjs holds them to the numbers of the layout.
const barNeonInset = 10; // the neon line, from the line of the edge
const barConduitInset = 16; // the pink conduit line, just inside the neon
const barBracketOutset = 22; // the pink brackets, outside the edge
const hazardHeight = 12; // the stripe under the header
const hazardPitch = 44;
const hazardWidth = 22;
const slashCount = 6;
const slashPitch = 40;
const slashWidth = 22;
const slashSlant = 10;
const slashHeight = 14;
const tickPitch = 18; // Minimal: the ticks along the foot of the header
const tickWidth = 4;
const tickHeight = 10;
const weldGap = 4; // the light line of the weld seam is this far from the dark one
const wearRadius = 26; // the smudge of rust under an arc

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
function hazardPath(from, to, top, bottom) {
  const slant = bottom - top;
  let data = '';
  for (let x = from; x + slant + hazardWidth <= to; x += hazardPitch) {
    data += `M${x} ${bottom}L${x + slant} ${top}L${x + slant + hazardWidth} ${top}L${x + hazardWidth} ${bottom}Z`;
  }
  return data;
}

// A row of slashes, the first one at x, standing on y
function slashPath(x, bottom) {
  let data = '';
  for (let index = 0; index < slashCount; index++) {
    const left = x + index * slashPitch;
    data += `M${left} ${bottom}L${left + slashSlant} ${bottom - slashHeight}L${left + slashSlant + slashWidth} ${bottom - slashHeight}L${left + slashWidth} ${bottom}Z`;
  }
  return data;
}

// A row of ticks, each one a small bar standing on the line at y, from x to x
function tickPath(from, to, y) {
  let data = '';
  for (let x = from; x + tickWidth <= to; x += tickPitch) {
    data += `M${x} ${y - tickHeight}h${tickWidth}v${tickHeight}h-${tickWidth}Z`;
  }
  return data;
}

// The rust at the two bottom corners of a frame, drawn as stroked arcs with a soft
// smudge under each, which is a radial gradient (index.html, wear-rust). One arc stands on
// the left edge just above the step, bulging into the frame, and one on the bottom edge
// just before the cut corner, bulging up. span is how long an arc is along its edge. The
// anchor is a point on the edge, which is how a piece of the page change finds its own.
function wearOf(outline, span) {
  const bulge = Math.round(span / 3);
  const edge = outline[0];
  const end = edge[1] - 8;
  const start = end - span;
  const across = tenth((start + end) / 2);

  const foot = outline[7];
  const last = foot[0] - 36; // clear of the bolt at the foot of the cut corner
  const first = last - span;
  const along = tenth((first + last) / 2);
  const line = foot[1] - 2;

  return [
    { anchor: [edge[0], across], arc: `M${edge[0] + 2} ${start}Q${edge[0] + 2 + 2 * bulge} ${across} ${edge[0] + 2} ${end}`, smudge: [edge[0] + 8, across] },
    { anchor: [along, foot[1]], arc: `M${first} ${line}Q${along} ${line - 2 * bulge} ${last} ${line}`, smudge: [along, foot[1] - 8] },
  ];
}

// The shape of one bar frame. options:
//   width, height   the size of the box the frame is drawn for
//   chamfer         how far the cut corners reach along each edge
//   step            how far the step drops (and the corner at its far end)
//   run             how far from its corner the step starts
//   bolts           the points of the outline that carry a bolt
//   legs            how long the brackets are: down the side and along the top. A frame
//                   with no legs has no brackets
//   header          { bottom, tabTop, tabBottom } for a frame with a header band and a
//                   tab, or nothing
//   seams           the heights of the plate seams across the body
//   hazard, conduit, slashes, pieces, still   which of those the frame has. A frame that is
//                   still has no part the page change lifts (the ticker). pieces is true for
//                   the pieces of the main panel, or { top, right, bottom, left }: where the
//                   bars of the edge end, along the top, down the right side and along the
//                   bottom (each a pair of numbers) and down the left side (one)
//   wide            false for a frame with only the one neon line. Without it, a frame has
//                   the two wider and fainter ones as well
//   headerLine      a neon line along the foot of the header, with a row of ticks over it
//   weld            the x of a vertical weld seam under the header
//   rivets          true for a row of rivets along every long straight edge
//   wear            the length of the arcs of rust at the two bottom corners
export function makeBarShape(options) {
  const left = 4;
  const top = 4;
  const right = options.width - 4;
  const bottom = options.height - 4;
  const chamfer = options.chamfer;
  const step = options.step;
  const run = options.run;

  const outline = [
    [left, bottom - step],
    [left, top + chamfer],
    [left + chamfer, top],
    [right - run, top],
    [right - run + step, top + step],
    [right, top + step],
    [right, bottom - chamfer],
    [right - chamfer, bottom],
    [left + run, bottom],
    [left + run - step, bottom - step],
  ];
  const split = 5;
  const inner = offsetOutline(outline, barNeonInset);

  // Bolts are shared out between the halves like screws. The one on point 0 is where
  // the halves meet, and goes with the second half so each has the same number
  const bolts = { a: [], b: [] };
  options.bolts.forEach(index => bolts[index === 0 || index > split ? 'b' : 'a'].push(outline[index]));

  const shape = {
    width: options.width,
    height: options.height,
    bar: true,
    still: options.still === true,
    wide: options.wide !== false,
    outline: outline,
    split: split,
    neon: { a: inner.slice(0, split + 1), b: inner.slice(split).concat([inner[0]]) },
    screws: bolts,
    pieces: [],
    art: {},
  };

  const conduit = [];
  if (options.header) {
    const header = options.header;
    shape.tab = [outline[1], outline[2], [header.tabTop, top], [header.tabBottom, header.bottom], [left, header.bottom]];
    shape.headerLeft = shape.tab;
    shape.headerRight = [[header.tabBottom, header.bottom], [header.tabTop, top], outline[3], outline[4], outline[5], [right, header.bottom]];
    shape.body = [[left, header.bottom], [right, header.bottom], outline[6], outline[7], outline[8], outline[9], outline[0]];

    if (options.hazard) {
      shape.art.hazard = hazardPath(left + barNeonInset, right - barNeonInset, header.bottom, header.bottom + hazardHeight);
      conduit.push([[left + barNeonInset, header.bottom + hazardHeight + 1.5], [right - barNeonInset, header.bottom + hazardHeight + 1.5]]);
    }
    if (options.headerLine) {
      // the ticks start 60 past the slanted end of the tab and stop 20 short of the end of the line
      shape.art.headerLine = pathData([[[left + barNeonInset, header.bottom], [right - barNeonInset, header.bottom]]]);
      shape.art.ticks = tickPath(header.tabBottom + 60, right - barNeonInset - 20, header.bottom - 2);
    }
  } else {
    shape.body = outline;
  }

  if (options.conduit) {
    conduit.push([1, 2, 3].map(index => offsetPoint(outline, outline[index], barConduitInset)));
    conduit.push([6, 7, 8].map(index => offsetPoint(outline, outline[index], barConduitInset)));
  }
  shape.art.conduit = pathData(conduit);

  if (options.slashes) shape.art.slashes = slashPath(outline[7][0] - 12 - ((slashCount - 1) * slashPitch + slashSlant + slashWidth), bottom - barConduitInset - 6);
  if (options.seams) shape.art.seams = pathData(options.seams.map(y => [[left + barNeonInset, y], [right - barNeonInset, y]]));

  if (options.weld) {
    const from = (options.header ? options.header.bottom : top) + barNeonInset + 4;
    const to = bottom - barNeonInset - 4;
    shape.art.weldDark = pathData([[[options.weld, from], [options.weld, to]]]);
    shape.art.weldLight = pathData([[[options.weld + weldGap, from], [options.weld + weldGap, to]]]);
  }

  if (options.rivets) {
    const half = halves(shape);
    shape.rivets = { a: rivetsOf(half.a), b: rivetsOf(half.b) };
  }
  if (options.wear) shape.wear = wearOf(outline, options.wear);

  // The brackets stand outside the two cut corners
  shape.bracketLines = [];
  if (options.legs) {
    const out = index => offsetPoint(outline, outline[index], -barBracketOutset);
    const down = out(1);
    const across = out(2);
    const up = out(6);
    const back = out(7);
    shape.bracketLines = [
      [[down[0], tenth(down[1] + options.legs[0])], down, across, [tenth(across[0] + options.legs[1]), across[1]]],
      [[up[0], tenth(up[1] - options.legs[0])], up, back, [tenth(back[0] - options.legs[1]), back[1]]],
    ];
    shape.art.brackets = pathData(shape.bracketLines);
  }

  if (options.pieces) shape.pieces = barPieces(shape, options.pieces === true ? undefined : options.pieces);
  return shape;
}

// Where the bars of the edge end on a frame of the size of the bar layout's main panel.
// Every mark is a point on an edge of the outline, so the bars meet the corner pieces exactly
const barMarks = { top: [230, 750], right: [170, 520], bottom: [480, 1230], left: 230 };

// The pieces of the main panel's frame for the mechanical page change: the plates,
// the decoration, and the edge cut into bars. Every piece has the name of the
// large frame's piece it stands for, so frame.css moves it the same way, and the
// decoration is a plate of its own. A bar is a line made of points of the outline
// (or of points on one of its edges) and has the neon line inside it, found the same
// way, and the bolts that are on it. Each bolt is in one piece only.
function barPieces(shape, marks = barMarks) {
  const outline = shape.outline;
  const left = 4;
  const top = 4;
  const right = shape.width - 4;
  const bottom = shape.height - 4;
  const middle = Math.round(shape.width / 2);
  const header = shape.tab[4][1];

  // A piece carries the bolts of its corners that the frame has: Minimal has four of the six
  const bolted = shape.screws.a.concat(shape.screws.b);
  const has = point => bolted.some(bolt => bolt[0] === point[0] && bolt[1] === point[1]);
  const bar = (name, line, bolts) => ({
    name: name,
    line: line,
    neon: line.map(point => offsetPoint(outline, point, barNeonInset)),
    screws: (bolts || []).filter(has),
  });

  return [
    { name: 'plate-header-left', fill: 'header-left', points: shape.headerLeft, art: () => tabMarkup(shape) },
    { name: 'plate-header-right', fill: 'header-right', points: shape.headerRight },
    { name: 'plate-body-left', fill: 'body', points: [[left, header], [middle, header], [middle, bottom], outline[8], outline[9], outline[0]] },
    { name: 'plate-body-right', fill: 'body', points: [[middle, header], [right, header], outline[6], outline[7], [middle, bottom]] },
    { name: 'plate-decor', box: [[0, 0], [shape.width, shape.height]], art: () => decorMarkup(shape) },
    bar('edge-top-left', [[marks.top[0], top], [marks.top[1], top]]),
    bar('edge-top-right', [[marks.top[1], top], outline[3], outline[4], outline[5], [right, marks.right[0]]], [outline[5]]),
    bar('edge-right', [[right, marks.right[0]], [right, marks.right[1]]]),
    bar('edge-bottom', [[marks.bottom[0], bottom], [marks.bottom[1], bottom]]),
    bar('edge-bottom-left', [[left, marks.left], outline[0], outline[9], outline[8], [marks.bottom[0], bottom]], [outline[0]]),
    bar('corner-top-left', [[left, marks.left], outline[1], outline[2], [marks.top[0], top]], [outline[1], outline[2]]),
    bar('corner-bottom-right', [[right, marks.right[1]], outline[6], outline[7], [marks.bottom[1], bottom]], [outline[6], outline[7]]),
  ];
}

// The three frames of the bar layout with the cut corners of 56 and 32 (--style-chamfer in
// styles/cybertron.css is the 56), which a bar page gets when its style has no frames of its own.
// Minimal has its own, the same three after these (styles/minimal.css), and Cybertron has the
// layout of its theme, so it has its own below. The main panel is drawn for
// the area of the bar layout, 1427 by 708 (areaWidth in core/layout.js, and
// --bar-area-width), and its header is the same 116 high as the large frame's. The
// banner and the ticker are the sizes of their regions (1856 by 160 and 1856 by 72), and
// the ticker has no room for conduit or slashes, which would cross its text.
const barFrames = {
  'bar-main': makeBarShape({
    width: 1427, height: 708, chamfer: 56, step: 24, run: 150,
    bolts: [1, 2, 5, 6, 7, 0], legs: [60, 70],
    header: { bottom: 120, tabTop: 664, tabBottom: 642 },
    hazard: true, seams: [264, 408, 552], conduit: true, slashes: true, pieces: true,
  }),
  'bar-banner': makeBarShape({
    width: 1856, height: 160, chamfer: 56, step: 24, run: 150,
    bolts: [1, 2, 5, 6, 7, 0], legs: [60, 70], conduit: true, slashes: true,
  }),
  'bar-ticker': makeBarShape({
    width: 1856, height: 72, chamfer: 32, step: 16, run: 100,
    bolts: [2, 7], legs: [40, 50], still: true,
  }),

  // The same three for Minimal: cut corners of 34 (20 on the ticker), a bolt at each of the
  // four joints, one neon line, rivets and rust at two corners. The main panel also has the
  // weld seam, 36 clear of the 1152 the pages are written for, and the line with ticks along
  // the foot of its header. None has a stamped id, and none has the hazard stripe, the
  // conduit, the slashes, the brackets or the plate seams, which are Cybertron's
  'bar-main-minimal': makeBarShape({
    width: 1427, height: 708, chamfer: 34, step: 16, run: 100,
    bolts: [1, 2, 6, 7], wide: false, rivets: true, wear: 70,
    header: { bottom: 120, tabTop: 664, tabBottom: 642 },
    headerLine: true, weld: 1188, pieces: true,
  }),
  'bar-banner-minimal': makeBarShape({
    width: 1856, height: 160, chamfer: 34, step: 16, run: 100,
    bolts: [1, 2, 6, 7], wide: false, rivets: true, wear: 56,
  }),
  'bar-ticker-minimal': makeBarShape({
    width: 1856, height: 72, chamfer: 20, step: 10, run: 60,
    bolts: [1, 2, 6, 7], wide: false, rivets: true, wear: 28, still: true,
  }),

  // The frames of Cybertron, for the layouts of Original (core/style.js, forcedLayout). Each is
  // the size of the frame of the standard layout that it stands for, so the pages are drawn
  // as they are in Original: the large frame 1152 by 708 with its header 120 high, the small
  // frame 656 by 372 with its header 84, and the ticker 1840 by 72. The banner is 1840 by
  // 228, which is 16 higher than the banner of Original: the stage of Cybertron is laid out
  // for it (styles/cybertron.css), so that the logo, the name and the clock are inside the
  // steel and the neon. The banner and the ticker have the smaller cut corners. The large and
  // the small frame have all of Cybertron's decoration and the pieces of the mechanical page
  // change
  'cybertron-grid1': makeBarShape({
    width: 1152, height: 708, chamfer: 56, step: 24, run: 150,
    bolts: [1, 2, 5, 6, 7, 0], legs: [60, 70],
    header: { bottom: 120, tabTop: 664, tabBottom: 642 },
    hazard: true, seams: [264, 408, 552], conduit: true, slashes: true,
    pieces: { top: [230, 750], right: [170, 520], bottom: [480, 930], left: 230 },
  }),
  'cybertron-grid2': makeBarShape({
    width: 656, height: 372, chamfer: 56, step: 24, run: 120,
    bolts: [1, 2, 5, 6, 7, 0], legs: [40, 50],
    header: { bottom: 84, tabTop: 480, tabBottom: 462 },
    hazard: true, seams: [160, 252], conduit: true, slashes: true,
    pieces: { top: [160, 480], right: [100, 240], bottom: [260, 500], left: 140 },
  }),
  'cybertron-banner': makeBarShape({
    width: 1840, height: 228, chamfer: 32, step: 16, run: 100,
    bolts: [1, 2, 5, 6, 7, 0], legs: [40, 50], conduit: true,
  }),
  'cybertron-ticker': makeBarShape({
    width: 1840, height: 72, chamfer: 32, step: 16, run: 100,
    bolts: [2, 7], legs: [40, 50], still: true,
  }),
};

export function barShape(kind) {
  return barFrames[kind] || null;
}

// The frame a region draws in a layout: the large panel, the ticker and the banner have the
// bar frames in the bar layout, and the ticker has no frame in the others (core/areas.js)
// unless the style is Cybertron, which has a frame for each region the standard layout
// has and the sidebar layout shares. shapes is the corners the style has (core/style.js,
// shapesFor): '', 'cybertron' or 'minimal'
const barKinds = { grid1: 'bar-main', ticker: 'bar-ticker', banner: 'bar-banner' };
const cybertronKinds = { grid1: 'cybertron-grid1', grid2: 'cybertron-grid2', ticker: 'cybertron-ticker', banner: 'cybertron-banner' };

export function frameKind(region, layout, shapes = '') {
  if (layout !== 'bar') return shapes === 'cybertron' && cybertronKinds[region] ? cybertronKinds[region] : region;
  if (!barKinds[region]) return region;

  const own = barKinds[region] + '-' + shapes;
  return shapes && barFrames[own] ? own : barKinds[region];
}

// How far a bar frame reaches from the corner of its box, in the units it is drawn
// in: the box itself, the bolts and the shadow of the edge round the outline, and the
// brackets. A frame has to be placed so that this stays on the screen.
export function frameExtent(kind) {
  const shape = barFrames[kind];
  const reach = 19; // the bolt is the widest part, 19 from its centre
  const xs = shape.outline.map(point => point[0]);
  const ys = shape.outline.map(point => point[1]);
  const bracket = shape.bracketLines.reduce((all, line) => all.concat(line), []);
  const wear = (shape.wear || []).map(item => item.smudge);

  return {
    left: Math.min.apply(null, xs.map(x => x - reach).concat(bracket.map(point => point[0] - 2), wear.map(point => point[0] - wearRadius))),
    top: Math.min.apply(null, ys.map(y => y - reach).concat(bracket.map(point => point[1] - 2), wear.map(point => point[1] - wearRadius))),
    right: Math.max.apply(null, xs.map(x => x + reach).concat(bracket.map(point => point[0] + 2), wear.map(point => point[0] + wearRadius))),
    bottom: Math.max.apply(null, ys.map(y => y + reach).concat(bracket.map(point => point[1] + 2), wear.map(point => point[1] + wearRadius))),
  };
}

Object.assign(shapes, barFrames);


// Shapes drawn once

// A gradient takes its colours from the place it sits in the page, not from the
// shape that uses it. index.html draws the three edge gradients once, for gold
// (data-metal="gold" on each), and this makes the same three for silver, so the
// stops are only written once. tokens.css points each frame at the gradients of
// its own metal. shell.js calls it once, before anything is drawn.
export function makeSilverGradients() {
  document.querySelectorAll('linearGradient[data-metal="gold"]').forEach(gold => {
    const silverId = gold.id.replace('gold', 'silver');
    if (document.getElementById(silverId)) return;

    const silver = gold.cloneNode(true);
    silver.id = silverId;
    silver.setAttribute('data-metal', 'silver');
    gold.parentNode.appendChild(silver);
  });
}

// Adds a shape to the hidden defs unless it is already there, and gives its id back
function define(id, markup) {
  if (!document.getElementById(id)) {
    document.getElementById('metal-shapes').insertAdjacentHTML('beforeend', markup);
  }
  return id;
}

// pathLength="1" makes a line count as length 1 however long it really is.
// frame.css relies on that to draw every line, and to run the glint, the
// same way. Square ends let the two halves of a frame meet in a clean corner.
function defineFrame(kind, shape) {
  const half = halves(shape);

  define(kind + '-a', `<polyline id="${kind}-a" pathLength="1" stroke-linecap="square" points="${toPoints(half.a)}"/>`);
  define(kind + '-b', `<polyline id="${kind}-b" pathLength="1" stroke-linecap="square" points="${toPoints(half.b)}"/>`);
  if (!shape.bar) define(kind + '-outline', `<polygon id="${kind}-outline" pathLength="1" points="${toPoints(shape.outline)}"/>`); // the glint runs on it, and a bar frame has none
  if (shape.seams) {
    define(kind + '-seams', `<path id="${kind}-seams" pathLength="1" d="${pathData(shape.seams)}"/>`);
  }
  if (shape.neon) {
    define(kind + '-neon-a', `<polyline id="${kind}-neon-a" pathLength="1" stroke-linecap="square" points="${toPoints(shape.neon.a)}"/>`);
    define(kind + '-neon-b', `<polyline id="${kind}-neon-b" pathLength="1" stroke-linecap="square" points="${toPoints(shape.neon.b)}"/>`);
  }
}

// A closed shape with a flat fill and a metal edge round it, as an svg. The
// shape is drawn once, in the defs, and the edge points at it. A tag, the
// team plate and a card are all made this way.
function edgedShape(id, points, fillClass, svgClass, width, height) {
  define(id, `<polygon id="${id}" points="${toPoints(points)}"/>`);

  return `<svg class="${svgClass}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <polygon class="${fillClass}" points="${toPoints(points)}"/>
    ${edgeLayers(id)}
  </svg>`;
}

// A straight line of the given length, drawn once. A row bar points at it.
function defineBar(length) {
  return define('bar-' + length, `<line id="bar-${length}" pathLength="1" x1="0" y1="0" x2="${length}" y2="0"/>`);
}


// The five layers of an edge, back to front, all pointing at one shape. When
// part is given they are wrapped in a group with that data-part, so frame.css
// draws the five together as one animation. No layer sets a dash pattern of
// its own, which is what lets the group's dash reach all of them. A frame
// that keeps its shadow in an svg of its own asks for just some of the layers.
// A bar frame adds its neon lines after the five, in the same group, so they
// are drawn with them (neonLayers, and the extra markup the group is given).
const shadowOnly = ['edge-shadow'];
const withoutShadow = ['edge-rim', 'edge-face', 'edge-shade', 'edge-ridge'];
const allLayers = shadowOnly.concat(withoutShadow);

function edgeLayers(id, part, names = allLayers, extra = '') {
  const layers = names
    .map(layer => `<use class="${layer}" href="#${id}"/>`)
    .join('') + extra;

  return part ? `<g data-part="${part}">${layers}</g>` : layers;
}

// The neon line, and the two wider and fainter ones behind it, all on one inset shape. A
// frame with wide false (Minimal's) has only the line
const neonNames = ['edge-neon-wide-2', 'edge-neon-wide-1', 'edge-neon'];

function neonLayers(id, wide = true) {
  return (wide ? neonNames : neonNames.slice(-1)).map(layer => `<use class="${layer}" href="#${id}"/>`).join('');
}

// A screw centred on a corner: its shadow, and the head. They arrive, unscrew
// and screw back in together. The two are separate shapes so a turning head
// never turns its shadow. --n is the screw's number, for the delay in frame.css.
// The bar frames have a hex bolt in place of each screw. It has no shadow of its own.
function screwShadowMarkup(index, bolt) {
  if (bolt) return '';
  return `<use class="screw-shadow" data-part="stud" data-index="${index}" style="--n: ${index}" href="#screw-shadow-shape"/>`;
}

function screwHeadMarkup(index, bolt) {
  return `<use class="screw" data-part="stud" data-index="${index}" style="--n: ${index}" href="#${bolt ? 'bolt-shape' : 'screw-shape'}"/>`;
}

function screwPair(center, index, bolt) {
  return `<g transform="translate(${center[0]} ${center[1]})">${screwShadowMarkup(index, bolt)}${screwHeadMarkup(index, bolt)}</g>`;
}

// One half of a frame: its five layers, then its screws. drawPart is the
// data-part that frame.js draws line by line.
function halfMarkup(kind, side, shape, red, drawPart, firstScrew) {
  const screws = shape.screws[side].map((center, index) => screwPair(center, firstScrew + index, shape.bar)).join('');
  const rivets = shape.rivets ? rivetsMarkup(shape.rivets[side], true) : '';
  const neon = shape.neon ? neonLayers(kind + '-neon-' + side, shape.wide) : '';
  const wear = side === 'b' ? wearMarkup(shape.wear, true) : '';

  return `<svg class="plate${red}" data-part="frame-${side}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">
    ${edgeLayers(kind + '-' + side, drawPart, allLayers, neon)}
    ${rivets}
    ${wear}
    ${screws}
  </svg>`;
}

// The two halves of a frame, one after the other
function frameHalves(kind, shape, red, drawPart) {
  return halfMarkup(kind, 'a', shape, red, drawPart, 0) +
    halfMarkup(kind, 'b', shape, red, drawPart, shape.screws.a.length);
}

// One svg of the frame of an area that stays on screen: the shadow of one
// half, or the bars and screw heads of one half. There are four in all. When
// the halves lift off, each shadow travels further than its bars, and that
// growing gap is what reads as depth. Because each of the four is a whole
// svg, the browser moves it as a picture and does not draw its lines again.
// The shadows come first, so both shadows are under both halves' bars.
//
// A bar frame that is still (the ticker) has other names for its four, so the page
// change does not lift it, and it has no shadow for its bolts, which have none.
function areaLayer(kind, shape, side, firstScrew, shadow) {
  const screws = shadow && shape.bar ? '' : shape.screws[side].map((center, index) => {
    const screw = shadow ? screwShadowMarkup(firstScrew + index) : screwHeadMarkup(firstScrew + index, shape.bar);
    return `<g transform="translate(${center[0]} ${center[1]})">${screw}</g>`;
  }).join('');
  const neon = !shadow && shape.neon ? neonLayers(kind + '-neon-' + side, shape.wide) : '';
  const layers = edgeLayers(kind + '-' + side, 'outline', shadow ? shadowOnly : withoutShadow, neon);
  const rivets = shadow || !shape.rivets ? '' : rivetsMarkup(shape.rivets[side], true);
  const wear = shadow || side !== 'b' ? '' : wearMarkup(shape.wear, true);
  const part = (shape.still ? 'still-' : '') + (shadow ? 'shadow-' : 'frame-') + side;

  return `<svg class="plate${shadow ? ' shadow-layer' : ''}" data-part="${part}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">
    ${layers}
    ${rivets}
    ${wear}
    ${screws}
  </svg>`;
}

function areaHalves(kind, shape) {
  const firstInB = shape.screws.a.length;

  return areaLayer(kind, shape, 'a', 0, true) +
    areaLayer(kind, shape, 'b', firstInB, true) +
    areaLayer(kind, shape, 'a', 0, false) +
    areaLayer(kind, shape, 'b', firstInB, false);
}

// The bright dash that runs round a frame now and then. It is in an svg of
// its own, so while it moves nothing else on the panel is redrawn.
function glintMarkup(kind, shape, red) {
  return `<svg class="plate glint-layer${red}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">
    <use class="glint" href="#${kind}-outline" style="--glint-delay: ${shape.glintDelay}s"/>
  </svg>`;
}

// The fills of a plate and its seams, in one svg. They stay where they are
// when the frame's halves lift.
function fillsMarkup(kind, shape, red) {
  let svg = `<svg class="plate fills${red}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">`;
  svg += `<polygon class="body" data-part="body" points="${toPoints(shape.body)}"/>`;

  if (shape.headerLeft) {
    svg += `<polygon class="header-left" data-part="header-left" points="${toPoints(shape.headerLeft)}"/>`;
    svg += `<polygon class="header-right" data-part="header-right" points="${toPoints(shape.headerRight)}"/>`;
  }
  if (shape.seams) svg += edgeLayers(kind + '-seams', 'seam');
  return svg + '</svg>';
}


// The fills of a bar frame, in one svg like the other frames': the body, and for the
// main panel the header with its tab, then the decoration. The decoration is one group
// with its own part, so it comes in after the lines are drawn (frame.css and
// frame.js). The tab is a group of its own with its details, so they slide in with it.
function barFillsMarkup(shape) {
  let svg = `<svg class="plate fills" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">`;
  svg += `<polygon class="body" data-part="body" points="${toPoints(shape.body)}"/>`;

  if (shape.tab) {
    svg += `<g data-part="header-left"><polygon class="header-left" points="${toPoints(shape.headerLeft)}"/>${tabMarkup(shape)}</g>`;
    svg += `<polygon class="header-right" data-part="header-right" points="${toPoints(shape.headerRight)}"/>`;
  }
  const decor = decorMarkup(shape);
  return svg + (decor ? `<g data-part="decor">${decor}</g>` : '') + '</svg>';
}

// The details of the armor header tab: the team's plate color inset in it, the dark
// bevel round it and the bright line along its lit edges (up and left)
function tabMarkup(shape) {
  const inside = offsetOutline(shape.tab, 14);
  const lit = offsetOutline(shape.tab, 6);

  return `<polygon class="tab-inset" points="${toPoints(inside)}"/>` +
    `<polygon class="tab-bevel" points="${toPoints(shape.tab)}"/>` +
    `<polyline class="tab-line" points="${toPoints(lit.slice(0, 4))}"/>`;
}

// What Cybertron and Minimal draw on a bar frame besides its edge, each in the class of
// its own style. Each part is one path, and a frame that has none of a part leaves it out
function decorMarkup(shape) {
  const art = shape.art;
  const path = (style, name, data) => (data ? `<path class="art-${style} art-${name}" d="${data}"/>` : '');

  return path('cybertron', 'seams', art.seams) + path('cybertron', 'hazard', art.hazard) + path('cybertron', 'conduit', art.conduit) +
    path('cybertron', 'slashes', art.slashes) + path('cybertron', 'brackets', art.brackets) +
    path('minimal', 'weld-dark', art.weldDark) + path('minimal', 'weld-light', art.weldLight) +
    path('minimal', 'header-line', art.headerLine) + path('minimal', 'ticks', art.ticks);
}


// One piece of a frame, as an svg of its own just big enough to hold it. Its
// viewBox is the piece's rectangle of the panel, not the whole panel, so every
// point (and every gradient, which is measured in the same units) is where it
// is in the full frame. The piece is placed at that rectangle, so it sits
// exactly over the frame at rest, and moves as a picture of its own. Room is
// left round the points for the width of the edge, its shadow and a screw.
const pieceRoom = 32;

function pieceMarkup(kind, shape, piece, rivets, wear) {
  const points = piece.line || piece.points || piece.box;
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const left = Math.floor(Math.min.apply(null, xs) - pieceRoom);
  const top = Math.floor(Math.min.apply(null, ys) - pieceRoom);
  const width = Math.ceil(Math.max.apply(null, xs) + pieceRoom) - left;
  const height = Math.ceil(Math.max.apply(null, ys) + pieceRoom) - top;

  let art;
  if (piece.line) {
    const id = kind + '-piece-' + piece.name;
    define(id, `<polyline id="${id}" points="${toPoints(piece.line)}"/>`);
    let neon = '';
    if (piece.neon) {
      define(id + '-neon', `<polyline id="${id}-neon" points="${toPoints(piece.neon)}"/>`);
      neon = neonLayers(id + '-neon', shape.wide);
    }
    art = edgeLayers(id, undefined, allLayers, neon) + (rivets ? rivetsMarkup(rivets, false) : '') + wearMarkup(wear);
  } else {
    art = (piece.fill ? `<polygon class="${piece.fill}" points="${toPoints(piece.points)}"/>` : '') + (piece.art ? piece.art() : '');
  }

  // The screws are numbered as they are in the frame at rest, a's first. A piece
  // names its screws by half ('a' or 'b'), or lists the ones it has (the bar frames)
  let screws = '';
  if (piece.screws && piece.screws.length !== 0) {
    const all = shape.screws.a.concat(shape.screws.b);
    const centers = typeof piece.screws === 'string' ? shape.screws[piece.screws] : piece.screws;
    const numbered = centers.map(center => ({ center: center, index: all.findIndex(other => other[0] === center[0] && other[1] === center[1]) }));
    const at = center => `translate(${center[0]} ${center[1]})`;
    screws = numbered.map(item => `<g transform="${at(item.center)}">${screwShadowMarkup(item.index, shape.bar)}</g>`).join('') +
      numbered.map(item => `<g transform="${at(item.center)}">${screwHeadMarkup(item.index, shape.bar)}</g>`).join('');
  }

  return `<svg class="plate piece" data-piece="${piece.name}" style="left: ${left}px; top: ${top}px;" width="${width}" height="${height}" viewBox="${left} ${top} ${width} ${height}">
    ${art}
    ${screws}
  </svg>`;
}

// A rivet, and a patch of rust, goes in the first piece that has its place on the frame,
// so none is drawn twice
function piecesMarkup(kind, shape) {
  const unplaced = shape.rivets ? shape.rivets.a.concat(shape.rivets.b) : [];
  const unworn = (shape.wear || []).slice();

  return shape.pieces.map(piece => {
    const mine = piece.line ? unplaced.filter(center => liesOn(center, piece.line)) : [];
    mine.forEach(center => unplaced.splice(unplaced.indexOf(center), 1));
    const worn = piece.line ? unworn.filter(item => liesOn(item.anchor, piece.line)) : [];
    worn.forEach(item => unworn.splice(unworn.indexOf(item), 1));
    return pieceMarkup(kind, shape, piece, mine, worn);
  }).join('');
}


// The war clock's housing

// The war clock (panels/countdown, docs/layouts.md, "The war clock") is drawn in two forms.
// The narrow one is 700 by 120, in the banner of the bar layout (Minimal). The wide one is
// 616 by 200, in the countdown's place in Cybertron. The housing of each is a plate of steel
// with the same edge as the frames: the line 4 inside the box, a cut corner at the top left
// and the bottom right (22 on the narrow one and 34 on the wide one), four rivets, one weld
// seam across the middle and rust at the bottom left and the top right. Everything in it is still.
const warForms = {
  narrow: {
    box: { width: 700, height: 120, chamfer: 22 },
    id: 'war-housing-shape',
    rivets: [[30, 22], [672, 22], [30, 92], [672, 92]],
    seam: { y: 63, from: 16, to: 684 }, // between the label and the date. The light line is weldGap below the dark one
    rust: {
      patches: [{ cx: 50, cy: 100 }, { cx: 650, cy: 20 }],
      patchRadius: { x: 56, y: 16 },
      arcs: 'M6 72Q28 90 6 108M650 6Q668 24 686 6',
    },
  },
  wide: {
    box: { width: 616, height: 200, chamfer: 34 },
    id: 'war-housing-wide-shape',
    rivets: [[30, 38], [586, 38], [30, 178], [572, 178]], // the last one is clear of the cut corner
    seam: { y: 64, from: 16, to: 600 }, // between the label and the two plates
    rust: {
      patches: [{ cx: 56, cy: 172 }, { cx: 560, cy: 24 }],
      patchRadius: { x: 56, y: 16 },
      arcs: 'M6 128Q28 148 6 168M536 6Q554 24 572 6',
    },
  },
};

function warOutline(box) {
  const left = 4;
  const top = 4;
  const right = box.width - 4;
  const bottom = box.height - 4;
  const cut = box.chamfer;

  return [[left, bottom], [left, top + cut], [left + cut, top], [right, top], [right, bottom - cut], [right - cut, bottom]];
}

// form is 'narrow' (the default) or 'wide'
export function warHousingMarkup(form = 'narrow') {
  const housing = warForms[form] || warForms.narrow;
  const box = housing.box;
  const outline = warOutline(box);
  const id = define(housing.id, `<polygon id="${housing.id}" points="${toPoints(outline)}"/>`);
  const seam = [[[housing.seam.from, housing.seam.y], [housing.seam.to, housing.seam.y]]];
  const light = [[[housing.seam.from, housing.seam.y + weldGap], [housing.seam.to, housing.seam.y + weldGap]]];
  const patchRadius = housing.rust.patchRadius;
  const patch = item => `<ellipse class="war-smudge" cx="${item.cx}" cy="${item.cy}" rx="${patchRadius.x}" ry="${patchRadius.y}"/>`;

  return `<svg class="war-housing" width="${box.width}" height="${box.height}" viewBox="0 0 ${box.width} ${box.height}">
    <polygon class="war-housing-fill" points="${toPoints(outline)}"/>
    <path class="war-weld-dark" d="${pathData(seam)}"/>
    <path class="war-weld-light" d="${pathData(light)}"/>
    ${edgeLayers(id)}
    <g class="war-rust">${housing.rust.patches.map(patch).join('')}<path class="war-wear" d="${housing.rust.arcs}"/></g>
    ${rivetsMarkup(housing.rivets, false, 'war-rivet')}
  </svg>`;
}


// What panels call

// The whole plate of a panel that sits outside the areas and draws its own:
// the fills, the frame in two halves that draw line by line, and the glint.
// kind is 'countdown', or a banner of the bar layout ('bar-banner', or 'bar-banner-minimal'), or the banner of Cybertron ('cybertron-banner'), which have no glint and no id.
export function plateMarkup(kind) {
  const shape = shapes[kind];
  const red = shape.red ? ' red-metal' : '';
  defineFrame(kind, shape);

  if (shape.bar) return barFillsMarkup(shape) + frameHalves(kind, shape, red, 'outline');
  return fillsMarkup(kind, shape, red) + idMarkup(shape) + frameHalves(kind, shape, red, 'outline') + glintMarkup(kind, shape, red);
}

// The frame of the large or the small panel area, drawn once for as long as
// the screen is up. It holds no page content. kind is 'grid1' or 'grid2', or what frameKind
// gives for a steel style: 'cybertron-grid1', 'cybertron-grid2' and 'cybertron-ticker', or in the
// bar layout 'bar-main' or 'bar-ticker'. After the frame come its
// pieces, which are the same frame cut up and stay hidden until a mechanical page
// change shows them in its place (frame.css). A bar frame has no glint and no id.
export function areaMarkup(kind) {
  const shape = shapes[kind];
  defineFrame(kind, shape);

  if (shape.bar) return barFillsMarkup(shape) + areaHalves(kind, shape) + piecesMarkup(kind, shape);
  return fillsMarkup(kind, shape, '') + idMarkup(shape) + areaHalves(kind, shape) + glintMarkup(kind, shape, '') + piecesMarkup(kind, shape);
}

// The frame behind the full screen alert and announcement: the plate, then
// the frame in two halves. options.red makes the frame red.
export function frameMarkup(options = {}) {
  const red = options.red ? ' red-metal' : '';
  defineFrame('screen', screenFrame);

  return `<svg class="plate${red}" width="1920" height="1080" viewBox="0 0 1920 1080">
    <polygon class="body" points="${toPoints(screenFrame.outline)}"/>
  </svg>` + frameHalves('screen', screenFrame, red, 'frame');
}

// A bar of light that sweeps across the panel once while it assembles.
// It is cut to the panel's outline so it never shows outside the plate.
export function scanMarkup(kind) {
  const shape = shapes[kind];
  const clip = shape.outline.map(point => point[0] + 'px ' + point[1] + 'px').join(', ');

  return `<div class="scan-clip" style="width: ${shape.width}px; height: ${shape.height}px; clip-path: polygon(${clip});">
    <div class="scan" data-part="scan" style="height: ${shape.height}px; --sweep: ${shape.width}px;"></div>
  </div>`;
}

// A thin metal bar between two rows, as its own svg, for a panel that places
// it with its own stylesheet. It is length wide and 20 high, and the line
// runs through the middle. In the stylesheet, give .row-bar a left and a top
// (it is positioned like a plate), for example 14px from the left and the
// bottom of the row minus 10px. The bar is part of its row, so it turns over
// with the row when the page changes.
export function rowBarMarkup(length) {
  return `<svg class="row-bar" width="${length}" height="20" viewBox="0 0 ${length} 20">
    <g class="thin" transform="translate(0 10)">${edgeLayers(defineBar(length))}</g>
  </svg>`;
}

// A card with a purple fill and a thin metal edge, and the bottom right
// corner cut. It is placed like a plate: at the top left of its parent, which
// should be position: relative and width by height big.
export function cardMarkup(width, height) {
  const points = [[2, 2], [width - 2, 2], [width - 2, height - 34], [width - 42, height - 2], [2, height - 2]];
  return edgedShape('card-' + width + 'x' + height, points, 'card-fill', 'card-outline thin', width, height);
}

// The team plate in the banner (520 x 76). The sidebar layout draws it at
// another width, and each width is its own shape, so the id carries the width
// (the 520 one keeps the id it has always had).
export function teamPlateMarkup(width = 520) {
  const points = [[4, 4], [width - 4, 4], [width - 4, 40], [width - 44, 72], [4, 72]];
  const id = width === 520 ? 'team-plate-shape' : 'team-plate-shape-' + width;
  return edgedShape(id, points, 'team-fill', 'team-plate-art', width, 76);
}

// The slanted label at the left end of the ticker. A longer word needs a
// wider tag, so the width is passed in.
export function tagMarkup(width = 208) {
  const right = width - 4;
  const points = [[25.3, 4], [right - 21.3, 4], [right, 68], [4, 68]];
  return edgedShape('tag-' + width, points, 'tag-fill', 'tag-plate', width, 72);
}
