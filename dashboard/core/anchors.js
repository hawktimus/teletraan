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
