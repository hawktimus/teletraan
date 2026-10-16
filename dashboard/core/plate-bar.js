// The shape of a bar frame and its options (part of plate.js).

import { barBracketOutset, barConduitInset, barNeonInset, hazardHeight, hazardPath, offsetOutline, offsetPoint, slashCount, slashPath, slashPitch, slashSlant, slashWidth, thinEdge, tickPath, wearOf, weldGap } from './plate-trim.js';
import { halves, largeHeader, pathData, rivetsOf, shapes, slantDegrees, tabTop, tenth, toPoints } from './plate-shapes.js';

// The shape of one bar frame. options:
//   width, height   the size of the box the frame is drawn for
//   chamfer         how far the cut corners reach along each edge
//   step            how far the step drops (and the corner at its far end)
//   run             how far from its corner the step starts
//   bolts           the points of the outline that carry a bolt
//   legs            how long the brackets are: down the side and along the top. A frame
//                   with no legs has no brackets
//   header          { bottom, tabTop, tabBottom, slantTop } for a frame with a header band and a
//                   tab, or nothing
//   seams           the heights of the plate seams across the body
//   hazard, conduit, slashes, pieces, still   which of those the frame has. A frame that is
//                   still has no part the page change lifts (the ticker). pieces is true for
//                   the pieces of the main panel, or { top, right, bottom, left }: where the
//                   bars of the edge end, along the top, down the right side and along the
//                   bottom (each a pair of numbers) and down the left side (one)
//   headerLine      a neon line along the foot of the header, with a row of ticks over it
//   weld            the x of a vertical weld seam under the header
//   rivets          true for a row of rivets along every long straight edge
//   wear            the length of the arcs of rust at the two bottom corners
//   corner          'tr' for the top right and bottom left corners cut, with the steps at the top left and
//                   the bottom right: the frame turned across, the way the team trim has it (the Cut
//                   corners field of a team). Its outline has the same ten points in another order
//   slant           true for a header tab that ends in one slant of 60 degrees
//   thin            true for the thin edge of the ticker (base.css, "The thin plate edge"): the line of
//                   the frame is thinEdge.line in from the box, the neon thinEdge.neon in from the line,
//                   and the brackets thinEdge.bracket outside it
export function makeBarShape(options) {
  const lineAt = options.thin ? thinEdge.line : 4;
  const neonAt = options.thin ? thinEdge.neon : barNeonInset;
  const left = lineAt;
  const top = lineAt;
  const right = options.width - lineAt;
  const bottom = options.height - lineAt;
  const chamfer = options.chamfer;
  const step = options.step;
  const run = options.run;
  const turned = options.corner === 'tr';

  const outline = turned ? [
    [left + chamfer, bottom],
    [left, bottom - chamfer],
    [left, top + step],
    [left + run - step, top + step],
    [left + run, top],
    [right - chamfer, top],
    [right, top + chamfer],
    [right, bottom - step],
    [right - run + step, bottom - step],
    [right - run, bottom],
  ] : [
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
  const inner = offsetOutline(outline, neonAt);

  // The numbers in this function are the places in the outline with the top left and bottom right corners cut,
  // which are the points 0 to 9 in the notes at the top of "The frames of the bar layout". at() is the place of
  // the same point in the frame that is turned across: what is point 7 there is point 0 here, and point 1 is 6
  const at = index => (turned ? (17 - index) % 10 : index);

  // Bolts are shared out between the halves like screws. The one on point 0 is where
  // the halves meet, and goes with the second half so each has the same number
  const bolts = { a: [], b: [] };
  options.bolts.forEach(index => bolts[at(index) === 0 || at(index) > split ? 'b' : 'a'].push(outline[at(index)]));

  const shape = {
    width: options.width,
    height: options.height,
    bar: true,
    still: options.still === true,
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
    const tabTopAt = options.slant && header.slantTop !== undefined ? header.slantTop : header.tabTop;
    const tabBottom = options.slant ? tenth(tabTopAt - (header.bottom - top) / Math.tan(slantDegrees * Math.PI / 180)) : header.tabBottom;
    shape.tab = turned ?
      [outline[2], outline[3], outline[4], [tabTopAt, top], [tabBottom, header.bottom], [left, header.bottom]] :
      [outline[1], outline[2], [tabTopAt, top], [tabBottom, header.bottom], [left, header.bottom]];
    shape.headerLeft = shape.tab;
    shape.headerRight = turned ?
      [[tabBottom, header.bottom], [tabTopAt, top], outline[5], outline[6], [right, header.bottom]] :
      [[tabBottom, header.bottom], [tabTopAt, top], outline[3], outline[4], outline[5], [right, header.bottom]];
    shape.body = turned ?
      [[left, header.bottom], [right, header.bottom], outline[7], outline[8], outline[9], outline[0], outline[1]] :
      [[left, header.bottom], [right, header.bottom], outline[6], outline[7], outline[8], outline[9], outline[0]];

    if (options.hazard) {
      shape.art.hazard = hazardPath(left + barNeonInset, right - barNeonInset, header.bottom, header.bottom + hazardHeight);
      conduit.push([[left + barNeonInset, header.bottom + hazardHeight + 1.5], [right - barNeonInset, header.bottom + hazardHeight + 1.5]]);
    }
    if (options.headerLine) {
      // the ticks start 60 past the slanted end of the tab and stop 20 short of the end of the line
      shape.art.headerLine = pathData([[[left + barNeonInset, header.bottom], [right - barNeonInset, header.bottom]]]);
      shape.art.ticks = tickPath(tabBottom + 60, right - barNeonInset - 20, header.bottom - 2);
    }
  } else {
    shape.body = outline;
  }

  if (options.conduit) {
    conduit.push([1, 2, 3].map(index => offsetPoint(outline, outline[at(index)], barConduitInset)));
    conduit.push([6, 7, 8].map(index => offsetPoint(outline, outline[at(index)], barConduitInset)));
  }
  shape.art.conduit = pathData(conduit);

  // The row of slashes ends 12 short of the foot of the cut corner at the bottom, or starts 12 past it
  const slashRow = (slashCount - 1) * slashPitch + slashSlant + slashWidth;
  if (options.slashes) shape.art.slashes = slashPath(turned ? outline[0][0] + 12 : outline[7][0] - 12 - slashRow, bottom - barConduitInset - 6);
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
  if (options.wear) shape.wear = wearOf(outline, options.wear, turned);

  // The brackets stand outside the two cut corners. Along the top and the bottom they reach toward the middle
  shape.bracketLines = [];
  if (options.legs) {
    const out = index => offsetPoint(outline, outline[at(index)], -(options.thin ? thinEdge.bracket : barBracketOutset));
    const toward = turned ? -1 : 1;
    const down = out(1);
    const across = out(2);
    const up = out(6);
    const back = out(7);
    shape.bracketLines = [
      [[down[0], tenth(down[1] + options.legs[0])], down, across, [tenth(across[0] + toward * options.legs[1]), across[1]]],
      [[up[0], tenth(up[1] - options.legs[0])], up, back, [tenth(back[0] - toward * options.legs[1]), back[1]]],
    ];
    shape.art.brackets = pathData(shape.bracketLines);
  }

  if (options.pieces) shape.pieces = barPieces(shape, options.pieces === true ? undefined : options.pieces, turned);
  return shape;
}

// The details of the armor header tab: the team's plate color inset in it, the dark
// bevel round it and the bright line along its lit edges (up and left). The line is
// every point but the last, which is the one at the foot of the left side
export function tabMarkup(shape) {
  const inside = offsetOutline(shape.tab, 14);
  const lit = offsetOutline(shape.tab, 6);

  return `<polygon class="tab-inset" points="${toPoints(inside)}"/>` +
    `<polygon class="tab-bevel" points="${toPoints(shape.tab)}"/>` +
    `<polyline class="tab-line" points="${toPoints(lit.slice(0, shape.tab.length - 1))}"/>`;
}

// What Cybertron and Minimal draw on a bar frame besides its edge, each in the class of
// its own style. Each part is one path, and a frame that has none of a part leaves it out. The
// header line has the two wider and fainter lines of a team with Glow behind it, hidden
// unless the team has it (base.css)
export function decorMarkup(shape) {
  const art = shape.art;
  const path = (style, name, data) => (data ? `<path class="art-${style} art-${name}" d="${data}"/>` : '');

  return path('cybertron', 'seams', art.seams) + path('cybertron', 'hazard', art.hazard) + path('cybertron', 'conduit', art.conduit) +
    path('cybertron', 'slashes', art.slashes) + path('cybertron', 'brackets', art.brackets) +
    path('minimal', 'weld-dark', art.weldDark) + path('minimal', 'weld-light', art.weldLight) +
    path('glow', 'glow-header-2', art.headerLine) + path('glow', 'glow-header-1', art.headerLine) +
    path('minimal', 'header-line', art.headerLine) + path('minimal', 'ticks', art.ticks);
}


// Where the bars of the edge end on a frame of the size of the bar layout's main panel.
// Every mark is a point on an edge of the outline, so the bars meet the corner pieces exactly
const barMarks = { top: [230, 750], right: [170, 520], bottom: [480, 1230], left: 230 };

// The pieces of the main panel's frame for the mechanical page change: the plates,
// the decoration, and the edge cut into bars. Every piece has the name of the
// large frame's piece it stands for, so frame.css moves it the same way, and the
// decoration is a plate of its own. A bar is a line made of points of the outline
// (or of points on one of its edges) and has the neon line inside it, found the same
// way, and the bolts that are on it. Each bolt is in one piece only. With the top right
// and bottom left corners cut (turned) the pieces keep the names of the places they
// hold, so the piece called corner-top-left is the top left corner, which has the step
function barPieces(shape, marks = barMarks, turned = false) {
  const outline = shape.outline;
  const left = 4;
  const top = 4;
  const right = shape.width - 4;
  const bottom = shape.height - 4;
  const middle = Math.round(shape.width / 2);
  const header = shape.tab[shape.tab.length - 1][1];

  // A piece carries the bolts of its corners that the frame has: Minimal has four of the six
  const bolted = shape.screws.a.concat(shape.screws.b);
  const has = point => bolted.some(bolt => bolt[0] === point[0] && bolt[1] === point[1]);
  const bar = (name, line, bolts) => ({
    name: name,
    line: line,
    neon: line.map(point => offsetPoint(outline, point, barNeonInset)),
    screws: (bolts || []).filter(has),
  });

  const tab = { name: 'plate-header-left', fill: 'header-left', points: shape.headerLeft, art: () => tabMarkup(shape) };
  const headerRight = { name: 'plate-header-right', fill: 'header-right', points: shape.headerRight };
  const decor = { name: 'plate-decor', box: [[0, 0], [shape.width, shape.height]], art: () => decorMarkup(shape) };
  const topLeftBar = bar('edge-top-left', [[marks.top[0], top], [marks.top[1], top]]);
  const rightBar = bar('edge-right', [[right, marks.right[0]], [right, marks.right[1]]]);
  const bottomBar = bar('edge-bottom', [[marks.bottom[0], bottom], [marks.bottom[1], bottom]]);

  if (turned) {
    return [
      tab,
      headerRight,
      { name: 'plate-body-left', fill: 'body', points: [[left, header], [middle, header], [middle, bottom], outline[0], outline[1]] },
      { name: 'plate-body-right', fill: 'body', points: [[middle, header], [right, header], outline[7], outline[8], outline[9], [middle, bottom]] },
      decor,
      topLeftBar,
      bar('edge-top-right', [[marks.top[1], top], outline[5], outline[6], [right, marks.right[0]]], [outline[5], outline[6]]),
      rightBar,
      bottomBar,
      bar('edge-bottom-left', [[left, marks.left], outline[1], outline[0], [marks.bottom[0], bottom]], [outline[1], outline[0]]),
      bar('corner-top-left', [[left, marks.left], outline[2], outline[3], outline[4], [marks.top[0], top]], [outline[2]]),
      bar('corner-bottom-right', [[right, marks.right[1]], outline[7], outline[8], outline[9], [marks.bottom[1], bottom]], [outline[7]]),
    ];
  }

  return [
    tab,
    headerRight,
    { name: 'plate-body-left', fill: 'body', points: [[left, header], [middle, header], [middle, bottom], outline[8], outline[9], outline[0]] },
    { name: 'plate-body-right', fill: 'body', points: [[middle, header], [right, header], outline[6], outline[7], [middle, bottom]] },
    decor,
    topLeftBar,
    bar('edge-top-right', [[marks.top[1], top], outline[3], outline[4], outline[5], [right, marks.right[0]]], [outline[5]]),
    rightBar,
    bottomBar,
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
export const barOptions = {
  'bar-main': {
    width: 1427, height: 708, chamfer: 56, step: 24, run: 150,
    bolts: [1, 2, 5, 6, 7, 0], legs: [60, 70],
    header: largeHeader,
    hazard: true, seams: [264, 408, 552], conduit: true, slashes: true, pieces: true,
  },
  'bar-banner': {
    width: 1856, height: 160, chamfer: 56, step: 24, run: 150,
    bolts: [1, 2, 5, 6, 7, 0], legs: [60, 70], conduit: true, slashes: true,
  },
  'bar-ticker': {
    width: 1856, height: 77, chamfer: 32, step: 16, run: 100,
    bolts: [2, 7], legs: [40, 50], still: true, thin: true,
  },

  // The same three for Minimal: cut corners of 34 (20 on the ticker), a bolt at each of the
  // four joints, one neon line, rivets and rust at two corners. The main panel also has the
  // weld seam, 36 clear of the 1152 the pages are written for, and the line with ticks along
  // the foot of its header. None has the hazard stripe, the
  // conduit, the slashes, the brackets or the plate seams, which are Cybertron's
  'bar-main-minimal': {
    width: 1427, height: 708, chamfer: 34, step: 16, run: 100,
    bolts: [1, 2, 6, 7], rivets: true, wear: 70,
    header: largeHeader,
    headerLine: true, weld: 1188, pieces: true,
  },
  'bar-banner-minimal': {
    width: 1856, height: 160, chamfer: 34, step: 16, run: 100,
    bolts: [1, 2, 6, 7], rivets: true, wear: 56,
  },
  'bar-ticker-minimal': {
    width: 1856, height: 77, chamfer: 20, step: 10, run: 60,
    bolts: [1, 2, 6, 7], rivets: true, wear: 28, still: true, thin: true,
  },

  // The frames of Cybertron, for the layouts of Original (core/style.js, forcedLayout). Each is
  // the size of the frame of the standard layout that it stands for, so the pages are drawn
  // as they are in Original: the large frame 1152 by 708 with its header 120 high, the small
  // frame 656 by 372 with its header 84, and the ticker 1840 by 72. The banner is 1840 by
  // 228, which is 16 higher than the banner of Original: the stage of Cybertron is laid out
  // for it (styles/cybertron.css), so that the logo, the name and the clock are inside the
  // steel and the neon. The banner and the ticker have the smaller cut corners. The large and
  // the small frame have all of Cybertron's decoration and the pieces of the mechanical page
  // change
  'cybertron-grid1': {
    width: 1152, height: 708, chamfer: 56, step: 24, run: 150,
    bolts: [1, 2, 5, 6, 7, 0], legs: [60, 70],
    header: largeHeader,
    hazard: true, seams: [264, 408, 552], conduit: true, slashes: true,
    pieces: { top: [230, 750], right: [170, 520], bottom: [480, 930], left: 230 },
  },
  'cybertron-grid2': {
    width: 656, height: 372, chamfer: 56, step: 24, run: 120,
    bolts: [1, 2, 5, 6, 7, 0], legs: [40, 50],
    header: { bottom: 84, tabTop: 480, tabBottom: 462 },
    hazard: true, seams: [160, 252], conduit: true, slashes: true,
    pieces: { top: [160, 480], right: [100, 240], bottom: [260, 500], left: 140 },
  },
  'cybertron-banner': {
    width: 1840, height: 228, chamfer: 32, step: 16, run: 100,
    bolts: [1, 2, 5, 6, 7, 0], legs: [40, 50], conduit: true,
  },
  'cybertron-ticker': {
    width: 1840, height: 77, chamfer: 32, step: 16, run: 100,
    bolts: [2, 7], legs: [40, 50], still: true, thin: true,
  },
};

export const barFrames = {};
Object.keys(barOptions).forEach(kind => {
  barFrames[kind] = makeBarShape(barOptions[kind]);
});

Object.assign(shapes, barFrames);
