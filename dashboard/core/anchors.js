// The places a subtheme can draw in (docs/subthemes.md). An anchor is a named box of the
// 1920 x 1080 screen that holds no text. Each layout has its own boxes, and a theme can
// publish boxes of its own: Original and Cybertron draw the same arrangement, and Retro
// copies Original until it is designed.
//
// The boxes sit in the margins and gaps between the frames, and in the cut corners of
// the large panel and the countdown, which core/season.js measured on a full render.
// The text blocks next to them are what a box must stay clear of, and
// tests/subthemes.test.mjs checks both. Measure again if a frame moves.

export const anchorNames = ['banner-left', 'banner-right', 'countdown-top', 'ticker-end', 'side-bottom', 'main-corner'];

export const screenBox = { x: 0, y: 0, width: 1920, height: 1080 };

function box(x, y, width, height) {
  return { x: x, y: y, width: width, height: height };
}

// The standard layout (General). The banner starts at y 24 and its first text at y 28
const standard = {
  'banner-left': box(40, 0, 200, 26),
  'banner-right': box(1680, 0, 200, 26),
  'countdown-top': box(1198, 238, 52, 34),
  'ticker-end': box(1700, 1058, 220, 22),
  'side-bottom': box(1890, 700, 30, 176),
  'main-corner': box(0, 240, 96, 28),
};

// The bar layout (Prime, Nova and Family). The banner is full to its edges, so the boxes
// that belong to it are in the margin above it
const bar = {
  'banner-left': box(32, 0, 200, 14),
  'banner-right': box(1688, 0, 200, 14),
  'countdown-top': box(1260, 0, 200, 14),
  'ticker-end': box(1688, 1052, 200, 28),
  'side-bottom': box(32, 954, 336, 20),
  'main-corner': box(1688, 194, 200, 20),
};

// Where the text is, for the test. Text of the standard layout is in the banner, in the
// large panel below its cut corner, in the right column and in the ticker
export const textBlocks = {
  standard: [box(40, 28, 1840, 204), box(40, 268, 1152, 696), box(1224, 272, 656, 692), box(40, 984, 1840, 72)],
  bar: [box(32, 32, 1856, 160), box(32, 216, 336, 736), box(404, 216, 1484, 736), box(32, 976, 1856, 72)],
};

export const layoutsWithAnchors = ['standard', 'bar'];

// The boxes of each theme, by layout. A theme that is not here has the boxes of Original.
const original = { standard: standard, bar: bar };
export const anchorsByTheme = {
  original: original,
  cybertron: original,
  retro: original,
  foundry: original,
};

// The box of one anchor, or null for a layout with no anchors (the sidebar layout) or a name that is not one
export function anchorBox(theme, layout, name) {
  const table = anchorsByTheme[theme] || anchorsByTheme.original;
  const boxes = table[layout];
  return boxes && boxes[name] ? boxes[name] : null;
}

// A picture of this size, the most it grows, placed in the box: scaled down to fit and
// centred. The box is the least of its sides, so a small box makes a small picture.
export function fitInBox(boxOfAnchor, size) {
  const side = Math.max(1, Math.min(size, boxOfAnchor.width, boxOfAnchor.height));
  return {
    size: side,
    x: boxOfAnchor.x + Math.round((boxOfAnchor.width - side) / 2),
    y: boxOfAnchor.y + Math.round((boxOfAnchor.height - side) / 2),
  };
}

// ---------------------------------------------------------------------------------------------
// The frame anchors: the places the shipped subthemes draw (core/subtheme-presets.js). They are
// worked out from the boxes of the frames, so a frame that moves is changed in one place (frames
// below) and every subtheme follows. A frame anchor is a box with a kind:
//   bar     a strip along an edge of a frame, on the frame's metal and the gap next to it
//   cut     the corner a frame leaves out. The box is the two legs of the cut, and `corner` says
//           which corner of the box the cut is at (tl, tr, bl or br)
//   bolt    the bolt at the end of a cut, with the margin beside it
//   column  the gap between the main panel and the side column, or a margin of the screen
// None of them reaches into the inside of a frame, where the text is. contentPolygons gives that
// inside, and tests/subthemes-part5.test.mjs checks every anchor against it.
//
// The team trim corner-cut-tr (Nova) cuts the other two corners, so `flipped` swaps tl with tr
// and br with bl. `mirrored` is the bar layout with the side column on the right (Nova).

export const frameAnchorNames = [
  'banner-bar-top', 'banner-bar-bottom', 'main-bar-top', 'side-bar-top', 'panel-b-bar-top',
  'ticker-bar-top', 'ticker-bar-bottom', 'main-header-gap',
  'banner-cut', 'corner-bolt', 'corner-cut-main-a', 'corner-cut-main-b', 'corner-cut-aux-a', 'corner-cut-aux-b',
  'gap-column', 'margin-left', 'margin-right', 'side-corner',
];

// The frames of each layout: the box the layout gives the frame and the legs of its cuts. The
// standard layout's legs are the ones the frames draw (core/plate.js, areas.js), but the banner's
// are a little shorter, to stay off the logo. The bar layout's are a little longer than the cuts it
// draws, which are 35 pixels or less, so that a piece in a cut has room to be seen. The text of
// those layouts starts clear of them.
const frames = {
  standard: {
    banner: { box: box(17, 15, 1886, 230), cutX: 46, cutY: 46 },
    main: { box: box(44, 260, 1144, 700), cutX: 80, cutY: 64 },
    side: { box: box(1228, 260, 648, 312), cutX: 60, cutY: 48 },
    panelB: { box: box(1228, 596, 648, 364) },
    ticker: { box: box(40, 984, 1840, 72) },
  },
  bar: {
    banner: { box: box(36, 36, 1848, 152), cutX: 54, cutY: 54 },
    main: { box: box(408, 220, 1476, 728), cutX: 52, cutY: 52 },
    ticker: { box: box(33, 977, 1854, 75), cutX: 40, cutY: 40 },
  },
};
// The main panel of the bar layout when the side column is on the right
const barMainMirrored = box(36, 220, 1476, 728);

function framesOf(layout, mirrored) {
  const found = frames[layout];
  if (!found) return null;
  if (layout === 'bar' && mirrored) return Object.assign({}, found, { main: Object.assign({}, found.main, { box: barMainMirrored }) });
  return found;
}

function flipCorner(corner, flipped) {
  if (!flipped) return corner;
  return { tl: 'tr', tr: 'tl', bl: 'br', br: 'bl' }[corner];
}

// The box of a cut: its two legs, at the corner of the frame the trim cuts
function cutBox(frame, corner, flipped) {
  const where = flipCorner(corner, flipped);
  const x = where === 'tl' || where === 'bl' ? frame.box.x : frame.box.x + frame.box.width - frame.cutX;
  const y = where === 'tl' || where === 'tr' ? frame.box.y : frame.box.y + frame.box.height - frame.cutY;
  return Object.assign(box(x, y, frame.cutX, frame.cutY), { kind: 'cut', corner: where });
}

function tag(found, kind) {
  return Object.assign(found, { kind: kind });
}

// The anchors of one layout: { name: { x, y, width, height, kind, corner? } }. The bar layout has no
// side-bar-top or panel-b-bar-top. A layout with no frame anchors (sidebar) gives null.
export function frameAnchors(layout, options) {
  const flags = options || {};
  const mirrored = flags.mirrored === true;
  const flipped = flags.flipped === true;
  const found = framesOf(layout, mirrored);
  if (!found) return null;

  if (layout === 'standard') {
    return {
      'banner-bar-top': tag(box(40, 0, 1840, 27), 'bar'),
      'banner-bar-bottom': tag(box(40, 236, 1840, 20), 'bar'),
      'main-bar-top': tag(box(44, 238, 1144, 22), 'bar'),
      'side-bar-top': tag(box(1228, 238, 648, 22), 'bar'),
      'panel-b-bar-top': tag(box(1228, 576, 648, 20), 'bar'),
      'ticker-bar-top': tag(box(44, 952, 1832, 34), 'bar'),
      'ticker-bar-bottom': tag(box(40, 1054, 1840, 26), 'bar'),
      'main-header-gap': tag(box(868, 272, 216, 40), 'bar'),
      'banner-cut': cutBox(found.banner, 'tl', false), // the logo is always at the left of this banner
      'corner-bolt': tag(box(1880, 196, 40, 64), 'bolt'),
      'corner-cut-main-a': cutBox(found.main, 'tl', flipped),
      'corner-cut-main-b': cutBox(found.main, 'br', flipped),
      'corner-cut-aux-a': cutBox(found.side, 'tl', flipped),
      'corner-cut-aux-b': cutBox(found.side, 'br', flipped),
      'gap-column': tag(box(1196, 256, 24, 708), 'column'),
      'margin-left': tag(box(0, 24, 38, 1032), 'column'),
      'margin-right': tag(box(1882, 270, 38, 700), 'column'),
      'side-corner': tag(box(1882, 872, 38, 104), 'column'),
    };
  }

  const gapX = mirrored ? 1524 : 372;
  const outerLeft = mirrored ? 1890 : 0;
  return {
    'banner-bar-top': tag(box(96, 8, 1752, 36), 'bar'),
    'banner-bar-bottom': tag(box(96, 190, 1752, 22), 'bar'),
    'main-bar-top': tag(box(mirrored ? 96 : 464, 192, 1380, 30), 'bar'),
    'ticker-bar-top': tag(box(96, 944, 1752, 36), 'bar'),
    'ticker-bar-bottom': tag(box(60, 1046, 1800, 34), 'bar'),
    'main-header-gap': tag(box(mirrored ? 880 : 1240, 240, 400, 40), 'bar'),
    'banner-cut': cutBox(found.banner, 'tl', flipped),
    'corner-bolt': tag(box(mirrored ? 6 : 1860, 160, 54, 54), 'bolt'),
    'corner-cut-main-a': cutBox(found.main, 'tl', flipped),
    'corner-cut-main-b': cutBox(found.main, 'br', flipped),
    'corner-cut-aux-a': cutBox(found.ticker, 'tl', flipped),
    'corner-cut-aux-b': cutBox(found.ticker, 'br', flipped),
    'gap-column': tag(box(gapX, 216, 24, 736), 'column'),
    'margin-left': tag(box(0, 32, 30, 1016), 'column'),
    'margin-right': tag(box(1890, 32, 30, 1016), 'column'),
    'side-corner': tag(box(outerLeft, 884, 30, 92), 'column'),
  };
}

// The inside of the frames, where the text is, as a list of polygons: the text of the banner, the title
// of the main panel, its body, the countdown, the side column and the ticker. Each is the area of its
// frame inside the metal, with the cuts of the trim taken off a little wider than the metal's own
// (`room` below). tests/subthemes-part5.test.mjs checks that no frame anchor reaches into one. The
// numbers are the boxes the text has on a full render of the sample.
const room = 7;

function areaPolygon(rect, cuts) {
  const at = {};
  cuts.forEach(cut => { at[cut.corner] = cut; });
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const points = [];

  if (at.tl) points.push([left, top + at.tl.y], [left + at.tl.x, top]); else points.push([left, top]);
  if (at.tr) points.push([right - at.tr.x, top], [right, top + at.tr.y]); else points.push([right, top]);
  if (at.br) points.push([right, bottom - at.br.y], [right - at.br.x, bottom]); else points.push([right, bottom]);
  if (at.bl) points.push([left + at.bl.x, bottom], [left, bottom - at.bl.y]); else points.push([left, bottom]);
  return points;
}

function wide(frame) {
  return { x: frame.cutX + room, y: frame.cutY + room };
}

// The two cuts of a frame at the corners the trim cuts, with the legs made wider
function bothCuts(frame, flipped) {
  const legs = wide(frame);
  return [Object.assign({ corner: flipped ? 'tr' : 'tl' }, legs), Object.assign({ corner: flipped ? 'bl' : 'br' }, legs)];
}

// The cut of the bottom corner only, for the body of a panel whose header is above it
function bottomCut(frame, flipped) {
  return [Object.assign({ corner: flipped ? 'bl' : 'br' }, wide(frame))];
}

export function contentPolygons(layout, options) {
  const flags = options || {};
  const flipped = flags.flipped === true;
  const mirrored = flags.mirrored === true;
  const found = framesOf(layout, mirrored);
  if (!found) return [];

  if (layout === 'standard') {
    return [
      areaPolygon(box(40, 42, 219, 176), []),
      areaPolygon(box(287, 28, 1592, 208), []),
      areaPolygon(box(44, 262, 792, 114), flipped ? [] : [Object.assign({ corner: 'tl' }, wide(found.main))]),
      areaPolygon(box(52, 380, 1128, 572), bottomCut(found.main, flipped)),
      areaPolygon(box(1240, 272, 624, 288), bothCuts(found.side, flipped)),
      areaPolygon(box(1240, 608, 624, 340), bothCuts(found.side, flipped)),
      areaPolygon(box(52, 996, 1816, 48), []),
    ];
  }

  const main = found.main.box;
  const column = mirrored ? box(1564, 228, 312, 712) : box(44, 228, 312, 712);
  return [
    areaPolygon(box(mirrored ? 70 : 60, 48, 1790, 128), bothCuts(found.banner, flipped)),
    areaPolygon(box(main.x + 4, main.y + 8, 800, 112), flipped ? [] : [Object.assign({ corner: 'tl' }, wide(found.main))]),
    areaPolygon(box(main.x + 12, main.y + 128, main.width - 24, main.height - 140), bottomCut(found.main, flipped)),
    areaPolygon(column, []),
    areaPolygon(box(44, 988, 1832, 48), bothCuts(found.ticker, flipped)),
  ];
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

// The box of one frame anchor for a theme, a layout and the flags. A theme can publish its own
// boxes in anchorsByTheme.<theme>.frame. Null for a layout with no frame anchors, an anchor the
// layout does not have or a name that is not one.
export function frameAnchorBox(theme, layout, name, options) {
  const table = anchorsByTheme[theme] && anchorsByTheme[theme].frame ? anchorsByTheme[theme].frame : frameAnchors;
  const all = table(layout, options);
  return all && all[name] ? all[name] : null;
}
