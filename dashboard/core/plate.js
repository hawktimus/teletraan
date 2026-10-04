// Builds the plates that panels are made from: flat purple shapes with a
// polished metal edge. Measurements are pixels on the 1920x1080 screen. The
// frame line sits 4px inside the edge of its panel.
//
// An edge is one shape drawn five times (shadow, rim, face, shade, ridge),
// and its colours come from tokens.css. The shape of each frame is added once
// to the hidden defs in index.html, the first time a plate of that kind is
// built, and every later plate points at it with <use>. The gradients and the
// bolt are in index.html too. The five layer classes are described in
// base.css.
//
// The frame round a plate is drawn in two halves, each in its own svg:
//   half a: the left side, the top left corner and the top
//   half b: the right side, the bottom right corner and the bottom
// They meet at the top right and the bottom left. Each half carries the bolts
// of its own corners, so it can move on its own as one piece.
//
// Every piece is labelled with data-part so frame.js can move it. The panel
// sizes here are repeated in base.css and in each panel's own stylesheet.
// Change them together.
//
// There are three ways to get a frame. areaMarkup() is the frame of an area
// that stays on screen while its pages change (the large panel and the small
// panel). plateMarkup() is the whole plate of a panel that sits outside the
// areas and draws its own, the countdown. frameMarkup() is the full screen
// frame of the alert and the announcement.

// the large panel on the left (1152 x 708)
const grid1 = {
  width: 1152,
  height: 708,
  body: [[4, 120], [1148, 120], [1148, 640], [1068, 704], [4, 704]],
  headerLeft: [[84, 4], [664, 4], [648, 52], [688, 52], [665.3, 120], [4, 120], [4, 68]],
  headerRight: [[664, 4], [1148, 4], [1148, 120], [665.3, 120], [688, 52], [648, 52]],
  // The frame, clockwise from the bottom left. The halves meet at point
  // number split (counting from 0) and at the first point.
  outline: [[4, 704], [4, 68], [84, 4], [1148, 4], [1148, 640], [1068, 704]],
  split: 3,
  // the line under the header, and the bolt shape between the two header plates
  seams: [
    [[4, 120], [1148, 120]],
    [[664, 4], [648, 52], [688, 52], [665.3, 120]],
  ],
  // bolts on the ends of the cut corners, shared out between the halves
  bolts: { a: [[4, 68], [84, 4]], b: [[1148, 640], [1068, 704]] },
  glintDelay: 2, // seconds after the panel has arrived
};

// the small panel under the countdown (656 x 372)
const grid2 = {
  width: 656,
  height: 372,
  body: [[4, 84], [652, 84], [652, 320], [592, 368], [4, 368]],
  headerLeft: [[64, 4], [480, 4], [453.3, 84], [4, 84], [4, 52]],
  headerRight: [[480, 4], [652, 4], [652, 84], [453.3, 84]],
  outline: [[4, 368], [4, 52], [64, 4], [652, 4], [652, 320], [592, 368]],
  split: 3,
  seams: [
    [[4, 84], [652, 84]],
    [[480, 4], [453.3, 84]],
  ],
  bolts: { a: [[4, 52], [64, 4]], b: [[652, 320], [592, 368]] },
  glintDelay: 8,
};

// the countdown (656 x 320). It has no header, its frame is red, and its
// top edge is cut into teeth like a jaw. The first tooth starts clear of the
// bolt, which covers the top edge up to about x = 88.
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
    red: true,
    // the plate is flat along the top. The teeth are only in the frame.
    body: [[64, 4], [652, 4], [652, 268], [592, 316], [4, 316], [4, 52]],
    outline: outline,
    split: split,
    bolts: { a: [[64, 4]], b: [[592, 316]] },
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
  bolts: { a: [[64, 120], [120, 72]], b: [[1856, 960], [1800, 1008]] },
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


// Shapes drawn once

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
  define(kind + '-outline', `<polygon id="${kind}-outline" pathLength="1" points="${toPoints(shape.outline)}"/>`);
  if (shape.seams) {
    define(kind + '-seams', `<path id="${kind}-seams" pathLength="1" d="${pathData(shape.seams)}"/>`);
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
const shadowOnly = ['edge-shadow'];
const withoutShadow = ['edge-rim', 'edge-face', 'edge-shade', 'edge-ridge'];
const allLayers = shadowOnly.concat(withoutShadow);

function edgeLayers(id, part, names = allLayers) {
  const layers = names
    .map(layer => `<use class="${layer}" href="#${id}"/>`)
    .join('');

  return part ? `<g data-part="${part}">${layers}</g>` : layers;
}

// A bolt centred on a corner: its shadow, and the head. Both pop in
// together. The two are separate so a turning head never turns its shadow.
// --n is the bolt's number, for the pop in delay in frame.css.
function boltShadowMarkup(index) {
  return `<use class="bolt-shadow" data-part="stud" data-index="${index}" style="--n: ${index}" href="#bolt-shadow-shape"/>`;
}

function boltHeadMarkup(index) {
  return `<use class="bolt" data-part="stud" data-index="${index}" style="--n: ${index}" href="#bolt-shape"/>`;
}

function boltPair(center, index) {
  return `<g transform="translate(${center[0]} ${center[1]})">${boltShadowMarkup(index)}${boltHeadMarkup(index)}</g>`;
}

// One half of a frame: its five layers, then its bolts. drawPart is the
// data-part that frame.js draws line by line.
function halfMarkup(kind, side, shape, red, drawPart, firstBolt) {
  const bolts = shape.bolts[side].map((center, index) => boltPair(center, firstBolt + index)).join('');

  return `<svg class="plate${red}" data-part="frame-${side}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">
    ${edgeLayers(kind + '-' + side, drawPart)}
    ${bolts}
  </svg>`;
}

// The two halves of a frame, one after the other
function frameHalves(kind, shape, red, drawPart) {
  return halfMarkup(kind, 'a', shape, red, drawPart, 0) +
    halfMarkup(kind, 'b', shape, red, drawPart, shape.bolts.a.length);
}

// One svg of the frame of an area that stays on screen: the shadow of one
// half, or the bars and bolt heads of one half. There are four in all. When
// the halves lift off, each shadow travels further than its bars, and that
// growing gap is what reads as depth. Because each of the four is a whole
// svg, the browser moves it as a picture and does not draw its lines again.
// The shadows come first, so both shadows are under both halves' bars.
function areaLayer(kind, shape, side, firstBolt, shadow) {
  const bolts = shape.bolts[side].map((center, index) => {
    const bolt = shadow ? boltShadowMarkup(firstBolt + index) : boltHeadMarkup(firstBolt + index);
    return `<g transform="translate(${center[0]} ${center[1]})">${bolt}</g>`;
  }).join('');
  const layers = edgeLayers(kind + '-' + side, 'outline', shadow ? shadowOnly : withoutShadow);
  const part = (shadow ? 'shadow-' : 'frame-') + side;

  return `<svg class="plate${shadow ? ' shadow-layer' : ''}" data-part="${part}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">
    ${layers}
    ${bolts}
  </svg>`;
}

function areaHalves(kind, shape) {
  const firstInB = shape.bolts.a.length;

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
  let svg = `<svg class="plate${red}" width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}">`;
  svg += `<polygon class="body" data-part="body" points="${toPoints(shape.body)}"/>`;

  if (shape.headerLeft) {
    svg += `<polygon class="header-left" data-part="header-left" points="${toPoints(shape.headerLeft)}"/>`;
    svg += `<polygon class="header-right" data-part="header-right" points="${toPoints(shape.headerRight)}"/>`;
  }
  if (shape.seams) svg += edgeLayers(kind + '-seams', 'seam');
  return svg + '</svg>';
}


// What panels call

// The whole plate of a panel that sits outside the areas and draws its own:
// the fills, the frame in two halves that draw line by line, and the glint.
// kind is 'countdown'.
export function plateMarkup(kind) {
  const shape = shapes[kind];
  const red = shape.red ? ' red-metal' : '';
  defineFrame(kind, shape);

  return fillsMarkup(kind, shape, red) + frameHalves(kind, shape, red, 'outline') + glintMarkup(kind, shape, red);
}

// The frame of the large or the small panel area, drawn once for as long as
// the screen is up. It holds no page content. kind is 'grid1' or 'grid2'.
export function areaMarkup(kind) {
  const shape = shapes[kind];
  defineFrame(kind, shape);

  return fillsMarkup(kind, shape, '') + areaHalves(kind, shape) + glintMarkup(kind, shape, '');
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

// The team plate in the banner (520 x 76)
export function teamPlateMarkup() {
  const points = [[4, 4], [516, 4], [516, 40], [476, 72], [4, 72]];
  return edgedShape('team-plate-shape', points, 'team-fill', 'team-plate-art', 520, 76);
}

// The slanted label at the left end of the ticker. A longer word needs a
// wider tag, so the width is passed in.
export function tagMarkup(width = 208) {
  const right = width - 4;
  const points = [[25.3, 4], [right - 21.3, 4], [right, 68], [4, 68]];
  return edgedShape('tag-' + width, points, 'tag-fill', 'tag-plate', width, 72);
}
