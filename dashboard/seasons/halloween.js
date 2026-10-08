// The Halloween pack. Like the Christmas pack (christmas.js) it is plain data: a
// list of shapes, a scene, a mark and lists of pieces. docs/seasonal-packs.md explains
// every part, and "How to add a pack" there lists the steps.
//
// What it draws:
//   - a jack-o'-lantern in place of the slashes at the right of every panel header (mark)
//   - twelve small pieces that cross the whole screen over the panels: bats gliding
//     across, ghosts rising, candy corn and dry leaves tumbling down, and embers
//     floating up (over)
//   - in the empty places: two ghosts rising behind the panels in the margins,
//     candy corn falling down the margins and the gap between the columns,
//     cobwebs in the top corners of the screen and a web in the cut corner of the
//     large panel that draws itself, holds, and wipes away, spiders hanging on
//     threads from the top edge and from the school name, and bunting in the gap
//     above the ticker (back and front)
//   - a scene along the bottom edge: jack-o'-lanterns, tombstones, bare trees, a
//     fence and a haunted house. The carved faces and the windows flicker (scene)
//
// The pack holds no keyframes and no animation code: a piece names a motion
// ('rise', 'sway', 'draw'...) and seasons/motion.css plays it, and only in full
// motion. The colours are written out here and not taken from the theme, so a
// pumpkin stays orange whatever theme is on. The accent colours of the screen's
// own text are in themes/overlays/halloween.css.
//
// Every shape is flat polygons with hard edges, in the faceted style of the
// logo, with a lit side and a shaded side. There is no blur, no glow, no shadow
// and no gradient.

const orange = '#ff8a1f';
const orangeLit = '#ffa43f';
const orangeShade = '#d95a0e';
const carve = '#2b1207'; // a carved hole, seen dark
const flame = '#ffe27a'; // the same hole with a candle in it
const stemLit = '#6ab648';
const stemShade = '#40802c';
const stone = '#9d92cc';
const stoneShade = '#70659d';
const stoneCut = '#453c6e';
const wood = '#7560bd';
const woodShade = '#54448e';
const hillFar = '#2a1f52';
const dirt = '#33266a';
const grass = '#5a49a3';
const ghostLit = '#f6f0ff';
const ghostShade = '#cdc1ee';
const ghostDark = '#2c2347';
const batLit = '#a68cf4';
const batShade = '#7b5fdc';
const webLine = '#d4c9f2';
const spiderLit = '#8870da';
const spiderShade = '#644cb0';
const houseLit = '#55449a';
const houseShade = '#3f3277';
const roofLit = '#6a58b6';
const roofShade = '#483b86';
const windowLit = '#ffd24a';


// Small helpers that write svg. They only make text: nothing here moves.

function round(number) {
  return Math.round(number * 10) / 10;
}

function polygon(points, fill) {
  return '<polygon points="' + points + '" fill="' + fill + '"/>';
}

// A polygon from a list of [x, y] pairs
function shape(pairs, fill) {
  return polygon(pairs.map(pair => round(pair[0]) + ',' + round(pair[1])).join(' '), fill);
}

// A rectangle, written as a polygon
function block(x, y, width, height, fill) {
  return shape([[x, y], [x + width, y], [x + width, y + height], [x, y + height]], fill);
}

// The same pairs seen in a mirror that stands at x = width / 2, listed in reverse
// so the points still go round the same way
function mirror(pairs, width) {
  return pairs.map(pair => [width - pair[0], pair[1]]).reverse();
}

// A thin four sided piece from (x1, y1) to (x2, y2), wider at the start. It is
// meant for things that point up: the left half is lit and the right half in shade.
function limb(x1, y1, x2, y2, width1, width2, lit, shade) {
  const length = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
  const nx = -(y2 - y1) / length;
  const ny = (x2 - x1) / length;
  const right = [[x1 + nx * width1 / 2, y1 + ny * width1 / 2], [x2 + nx * width2 / 2, y2 + ny * width2 / 2]];
  const left = [[x1 - nx * width1 / 2, y1 - ny * width1 / 2], [x2 - nx * width2 / 2, y2 - ny * width2 / 2]];
  return shape([left[0], [x1, y1], [x2, y2], left[1]], lit) + shape([[x1, y1], right[0], right[1], [x2, y2]], shade);
}

// A thin line. A line that is to draw itself needs pathLength and a dash of 1,
// which is what the draw motion works on (seasons/motion.css)
function line(points, width, draws) {
  const dash = draws ? ' pathLength="1" stroke-dasharray="1"' : '';
  return '<polyline points="' + points.map(pair => round(pair[0]) + ',' + round(pair[1])).join(' ') + '" fill="none" stroke="' + webLine + '" stroke-width="' + width + '"' + dash + '/>';
}


// Jack-o'-lanterns

// A pumpkin standing on the ground y 20, as wide as width. Three facets: the
// left rib lit, the middle plain and the right rib in shade, with a stem on top.
function pumpkinBody(cx, width) {
  const r = width / 2;
  const h = width * 0.82;
  const top = 20 - h;
  const base = 20;

  return shape([[cx - r * 0.5, top], [cx + r * 0.5, top], [cx + r, top + h * 0.22], [cx + r, base - h * 0.22], [cx + r * 0.55, base], [cx - r * 0.55, base], [cx - r, base - h * 0.22], [cx - r, top + h * 0.22]], orange) +
    shape([[cx - r * 0.5, top], [cx - r * 0.2, top + h * 0.04], [cx - r * 0.3, base], [cx - r * 0.55, base], [cx - r, base - h * 0.22], [cx - r, top + h * 0.22]], orangeLit) +
    shape([[cx + r * 0.2, top + h * 0.04], [cx + r * 0.5, top], [cx + r, top + h * 0.22], [cx + r, base - h * 0.22], [cx + r * 0.55, base], [cx + r * 0.3, base]], orangeShade) +
    shape([[cx - 1.4, top - 3.2], [cx, top - 3.2], [cx, top + 0.6], [cx - 1.6, top + 0.6]], stemLit) +
    shape([[cx, top - 3.2], [cx + 1.4, top - 3.2], [cx + 1.6, top + 0.6], [cx, top + 0.6]], stemShade);
}

// The carved face of a pumpkin: two triangle eyes, a nose and a toothy grin. It is
// drawn dark in the scene, and again in a lit colour in the flicker pieces.
function pumpkinFace(cx, width, fill) {
  const r = width / 2;
  const h = width * 0.82;
  const top = 20 - h;

  return shape([[cx - r * 0.6, top + h * 0.42], [cx - r * 0.14, top + h * 0.42], [cx - r * 0.37, top + h * 0.2]], fill) +
    shape([[cx + r * 0.14, top + h * 0.42], [cx + r * 0.6, top + h * 0.42], [cx + r * 0.37, top + h * 0.2]], fill) +
    shape([[cx - r * 0.1, top + h * 0.55], [cx + r * 0.1, top + h * 0.55], [cx, top + h * 0.46]], fill) +
    shape([[cx - r * 0.66, top + h * 0.62], [cx + r * 0.66, top + h * 0.62], [cx + r * 0.5, top + h * 0.82], [cx + r * 0.3, top + h * 0.72], [cx + r * 0.1, top + h * 0.86], [cx - r * 0.12, top + h * 0.72], [cx - r * 0.32, top + h * 0.86], [cx - r * 0.5, top + h * 0.78]], fill);
}

// The middle of each pumpkin and its width. A third number of 1 gives it a carved
// face. Left of x 270 the ticker's tag comes close, so the pumpkins there are small.
const pumpkins = [
  [58, 10, 0], [122, 12, 0], [196, 10, 0],
  [352, 22, 1], [546, 16, 1], [572, 10, 0],
  [733, 24, 1], [820, 15, 1], [840, 9, 0], [1002, 14, 1], [1030, 9, 0],
  [1210, 12, 1], [1290, 22, 1], [1316, 12, 0], [1400, 10, 0], [1510, 18, 1],
  [1752, 24, 1], [1788, 12, 0], [1868, 16, 1],
];

// The faces that are carved, with the groups they flicker in (every other one)
const faced = [];
pumpkins.forEach(item => {
  if (item[2] === 1) faced.push(item);
});


// Tombstones, trees, a fence and a house

// A tombstone standing on y 21: a round topped slab, the left half lit and the
// right half in shade, with a cross or two lines cut into it. A lean turns it
// a little about its foot.
function tomb(cx, width, height, cut, lean) {
  const half = width / 2;
  const top = 21 - height;

  const slab = shape([[cx - half, 21], [cx - half, top + half * 0.8], [cx - half * 0.6, top + half * 0.2], [cx, top], [cx, 21]], stone) +
    shape([[cx, top], [cx + half * 0.6, top + half * 0.2], [cx + half, top + half * 0.8], [cx + half, 21], [cx, 21]], stoneShade);

  let carving = '';
  if (cut === 'cross') {
    carving = block(cx - 0.5, top + half * 0.7, 1, height * 0.5, stoneCut) + block(cx - half * 0.45, top + half * 1.1, half * 0.9, 1, stoneCut);
  } else {
    carving = block(cx - half * 0.5, top + half * 0.9, half, 1, stoneCut) + block(cx - half * 0.5, top + half * 0.9 + 3, half, 1, stoneCut);
  }
  return lean === 0 ? slab + carving : '<g transform="rotate(' + lean + ' ' + cx + ' 21)">' + slab + carving + '</g>';
}

// A bare tree standing on y 21. dir is 1 or -1 and says which way the top leans.
function bareTree(x, height, dir) {
  const s = dir;
  const y = fraction => 21 - height * fraction;

  return limb(x, 21, x + s * 0.8, y(0.45), 4.6, 2.8, wood, woodShade) +
    limb(x + s * 0.8, y(0.45), x + s * 2.4, y(1), 2.8, 0.8, wood, woodShade) +
    limb(x + s * 0.4, y(0.3), x - s * height * 0.34, y(0.62), 2.4, 0.8, wood, woodShade) +
    limb(x - s * height * 0.16, y(0.46), x - s * height * 0.4, y(0.5), 1.6, 0.6, wood, woodShade) +
    limb(x + s * 1, y(0.52), x + s * height * 0.36, y(0.8), 2.4, 0.8, wood, woodShade) +
    limb(x + s * height * 0.2, y(0.68), x + s * height * 0.44, y(0.7), 1.6, 0.6, wood, woodShade);
}

// An iron fence along the ground from x0 to x1: posts with pointed tops and two rails
function fence(x0, x1) {
  let markup = block(x0, 14, x1 - x0, 1, stoneShade) + block(x0, 18, x1 - x0, 1, stoneShade);
  for (let x = x0 + 2; x < x1; x += 5) {
    markup += shape([[x - 0.9, 21], [x - 0.9, 12], [x, 9.4], [x + 0.9, 12], [x + 0.9, 21]], stone);
  }
  return markup;
}

// The haunted house: a gabled roof, a tower with a pointed top, a door and
// windows. The windows are dark here. They are lit in the flicker pieces.
const houseWindows = [[7, 13, 3.2, 4.4], [16, 13, 3.2, 4.4], [37, 8.4, 2.8, 4.2]]; // x, y, width, height from the house's left edge

function house(x) {
  return shape([[x, 21], [x + 38, 21], [x + 38, 10], [x, 10]], houseLit) +
    shape([[x + 19, 21], [x + 38, 21], [x + 38, 10], [x + 19, 10]], houseShade) +
    shape([[x - 3, 10], [x + 19, 0.6], [x + 19, 10]], roofLit) +
    shape([[x + 19, 0.6], [x + 41, 10], [x + 19, 10]], roofShade) +
    shape([[x + 30, 21], [x + 44, 21], [x + 44, 6], [x + 30, 6]], houseShade) +
    shape([[x + 30, 21], [x + 37, 21], [x + 37, 6], [x + 30, 6]], houseLit) +
    shape([[x + 28.5, 6], [x + 37, -3.6], [x + 45.5, 6]], roofShade) +
    shape([[x + 28.5, 6], [x + 37, -3.6], [x + 37, 6]], roofLit) +
    block(x + 9, 0.6, 3, 5, houseShade) +
    shape([[x + 23, 21], [x + 23, 16.6], [x + 25, 14.8], [x + 27, 16.6], [x + 27, 21]], carve) +
    houseWindows.map(item => block(x + item[0], item[1], item[2], item[3], carve)).join('');
}

function houseLights(x) {
  return houseWindows.map(item => block(x + item[0], item[1], item[2], item[3], windowLit)).join('');
}


// The scene along the bottom edge. It is 1920 wide and 26 high, and its y runs
// from -4 (the top edge of the strip) to 22 (the bottom of the screen), so the
// ground is at the bottom and the pumpkins have 4 px of headroom. Left of x 270
// the ticker's tag comes within 12 px of the top, so there (y under 8) nothing
// stands, and the ground stays low.

// A ridge made of straight facets: one point every step pixels, with a height
// that rolls between the limits. low is the lowest the top may be for x under 270.
function ridge(fill, middle, swing, step, phase, low) {
  const height = x => {
    const y = middle + swing * Math.sin(x / 113 + phase) + swing * 0.6 * Math.sin(x / 41 + phase * 2);
    return x < 270 ? Math.max(y, low) : y;
  };
  const pairs = [[0, 22]];
  for (let x = 0; x < 1920; x += step) pairs.push([x, height(x)]);
  pairs.push([1920, height(1920)]); // the last step is short, so the ridge ends level and not on a slope
  pairs.push([1920, 22]);
  return shape(pairs, fill);
}

// A row of grass blades along the top of the ground: little triangles in two heights
function blades() {
  let markup = '';
  for (let i = 0; i < 150; i++) {
    const x = 6 + i * 12.7;
    const tall = 3 + (i * 7) % 3;
    markup += shape([[x, 19.4], [x + 1.4, 19.4 - tall], [x + 2.8, 19.4]], grass);
  }
  return markup;
}

// x of the middle, the height, the way the top leans
const trees = [
  [318, 24, 1], [612, 22, -1], [790, 20, 1], [1180, 24, -1], [1450, 22, 1], [1655, 20, -1], [1835, 24, 1],
];

// x of the middle, the width, the height, what is cut in it, the lean in degrees
const tombs = [
  [78, 8, 8, 'lines', 0], [168, 8, 9, 'cross', 0],
  [296, 9, 11, 'cross', 0], [412, 10, 13, 'lines', 0], [440, 8, 10, 'cross', -7],
  [652, 9, 11, 'lines', 5], [676, 11, 14, 'cross', 0],
  [858, 9, 12, 'cross', 0], [880, 8, 9, 'lines', -6],
  [1126, 10, 13, 'lines', 0], [1240, 9, 11, 'cross', -3], [1260, 8, 9, 'lines', 5],
  [1560, 9, 11, 'cross', 4], [1584, 11, 14, 'lines', 0], [1700, 9, 12, 'cross', -4],
];

const fences = [[466, 530], [920, 980], [1348, 1420], [1610, 1650]];

const housePlace = 1050;

const sceneMarkup =
  ridge(hillFar, 12, 2, 38, 0, 11.5) +
  trees.map(item => bareTree(item[0], item[1], item[2])).join('') +
  house(housePlace) +
  fences.map(item => fence(item[0], item[1])).join('') +
  tombs.map(item => tomb(item[0], item[1], item[2], item[3], item[4])).join('') +
  ridge(dirt, 19.2, 0.7, 29, 1, 17.5) +
  blades() +
  pumpkins.map(item => pumpkinBody(item[0], item[1])).join('') +
  faced.map(item => pumpkinFace(item[0], item[1], carve)).join('');

// The lit faces, in two groups so the candles do not flicker together. The
// lit windows of the house go with the second group.
function lit(group) {
  let markup = group === 1 ? houseLights(housePlace) : '';
  faced.forEach((item, index) => {
    if (index % 2 === group) markup += pumpkinFace(item[0], item[1], flame);
  });
  return markup;
}


// The mark: a jack-o'-lantern, 60 by 76, which is the biggest a mark may be (markBox
// in core/marks.js). Five ribs, lit on the left and in shade on the right, a green
// stem, and a carved face with a candle burning inside it. Each hole is dark with a
// smaller lit shape in it, so the face still reads from across the room. The lit
// rib at the far left is in <g class="double-slash">, which base.css paints with
// --yellow, the accent colour that the Halloween overlay makes pale orange.

const ribLit = '#ffa43f';
const ribPlain = '#ff8a1f';
const ribShade = '#e0690f';
const ribFarShade = '#b94a08';

// The ribs on the right half of the pumpkin, in a drawing 60 wide. The ribs on the
// left half are their mirror.
const ribRight = [[37, 18], [44, 15], [50, 19.4], [54, 44], [49, 70], [37, 73], [43, 44]];
const ribFarRight = [[50, 19.4], [55, 23], [60, 39], [58, 58], [49, 70], [54, 44]];
const ribMiddle = [[23, 18], [30, 21], [37, 18], [43, 44], [37, 73], [23, 73], [17, 44]];

// The carved holes: two slanted eyes, a nose and a grin with teeth
const holes = [
  [[10, 43], [25, 41], [20, 27]],
  [[35, 41], [50, 43], [40, 27]],
  [[26.5, 50], [33.5, 50], [30, 43.5]],
  [[8, 52], [52, 52], [47, 62], [41, 58], [36, 66], [30, 59], [24, 66], [19, 58], [13, 62]],
];

// A polygon shrunk towards its middle, for the lit part inside a hole
function shrink(pairs, factor) {
  let cx = 0;
  let cy = 0;
  pairs.forEach(pair => {
    cx += pair[0] / pairs.length;
    cy += pair[1] / pairs.length;
  });
  return pairs.map(pair => [cx + (pair[0] - cx) * factor, cy + (pair[1] - cy) * factor]);
}

const pumpkinMark =
  '<g class="double-slash">' + shape(mirror(ribFarRight, 60), orangeLit) + '</g>' +
  shape(mirror(ribRight, 60), ribLit) +
  shape(ribMiddle, ribPlain) +
  shape(ribRight, ribShade) +
  shape(ribFarRight, ribFarShade) +
  shape([[26, 20], [27, 7], [33, 2], [33, 21]], stemLit) +
  shape([[33, 2], [38, 7], [36, 20], [33, 21]], stemShade) +
  holes.map(pairs => shape(pairs, carve)).join('') +
  holes.map(pairs => shape(shrink(pairs, 0.58), flame)).join('');

const mark = { viewBox: '0 0 60 76', markup: pumpkinMark };


// The shapes the pieces use, each drawn once

// A ghost: a sheet with a ragged hem, the left half lit and the right half in shade
const ghost = {
  viewBox: '0 0 24 30',
  markup: shape([[12, 0], [5, 2], [1.5, 8], [1.5, 26], [5, 30], [8.5, 26], [12, 30]], ghostLit) +
    shape([[12, 0], [19, 2], [22.5, 8], [22.5, 26], [19, 30], [15.5, 26], [12, 30]], ghostShade) +
    shape([[6.4, 10], [9.2, 9.4], [9.6, 13.8], [7, 14.6]], ghostDark) +
    shape([[14.4, 9.4], [17.2, 10], [17, 14.6], [14.4, 13.8]], ghostDark) +
    shape([[10, 17], [14, 17], [14.6, 21], [12, 22.4], [9.4, 21]], ghostDark),
};

// A bat with its wings spread: the near edges of the wings lit, the scalloped
// edges in shade. The right wing is listed, the left is its mirror.
const wingLit = [[22, 7], [28, 2], [35, 2.6], [39.5, 6], [31.5, 9.5], [22, 12]];
const wingShade = [[22, 12], [31.5, 9.5], [39.5, 6], [36, 8.8], [34.5, 13.6], [31, 10.8], [28, 15.4], [25.4, 11.6], [22, 14]];

const bat = {
  viewBox: '0 0 44 20',
  markup: shape(wingLit, batLit) + shape(mirror(wingLit, 44), batLit) +
    shape(wingShade, batShade) + shape(mirror(wingShade, 44), batShade) +
    shape([[19.4, 7.4], [19.8, 2.6], [21, 4.4], [23, 4.4], [24.2, 2.6], [24.6, 7.4], [23.4, 9.8], [20.6, 9.8]], batLit) +
    shape([[20.2, 9.8], [23.8, 9.8], [24.4, 16], [22, 19], [19.6, 16]], batShade),
};

// The same bat with its wings raised, so the bats over the panels are not all one
// pose. Only the wings differ.
const wingUpLit = [[22, 9], [26, 3.4], [31.5, 0.8], [37.5, 0.6], [42, 2.4], [33.5, 6], [22, 12]];
const wingUpShade = [[22, 12], [33.5, 6], [42, 2.4], [40.6, 8], [41, 13], [37, 10.4], [34, 15.6], [30.6, 11.6], [27, 16.4], [24.8, 12.4], [22, 14]];

const batUp = {
  viewBox: '0 0 44 22',
  markup: shape(wingUpLit, batLit) + shape(mirror(wingUpLit, 44), batLit) +
    shape(wingUpShade, batShade) + shape(mirror(wingUpShade, 44), batShade) +
    shape([[19.4, 9.4], [19.8, 4.6], [21, 6.4], [23, 6.4], [24.2, 4.6], [24.6, 9.4], [23.4, 11.8], [20.6, 11.8]], batLit) +
    shape([[20.2, 11.8], [23.8, 11.8], [24.4, 18], [22, 21], [19.6, 18]], batShade),
};

// An ember: a small four pointed spark, orange with a bright middle
const ember = {
  viewBox: '0 0 14 14',
  markup: polygon('7,0 8.9,5.1 14,7 8.9,8.9 7,14 5.1,8.9 0,7 5.1,5.1', orange) +
    polygon('7,3.4 8.2,5.8 10.6,7 8.2,8.2 7,10.6 5.8,8.2 3.4,7 5.8,5.8', flame),
};

// A dry leaf with ragged points, in rust. The left half is lit and the right half in shade.
const dryRight = [[8, 0], [10.6, 3.2], [13.2, 2.4], [12.4, 7], [15.8, 8.6], [12.6, 12.4], [14.2, 17], [10.4, 15.8], [8.8, 21], [8, 21]];

const dryLeaf = {
  viewBox: '0 0 16 24',
  markup: shape(mirror(dryRight, 16), '#e0782a') + shape(dryRight, '#a8480f') +
    shape([[7.4, 20.6], [8.6, 20.6], [8.6, 24], [7.4, 24]], '#5e2b0b'),
};

// Candy corn: three bands, white, orange and yellow, each with a lit left half
// and a shaded right half
function candyCorn() {
  const bands = [[0, 5, '#fff5dc', '#e5d6b0'], [5, 10.5, '#ff9d33', '#d97812'], [10.5, 16, '#ffd84d', '#d9b02e']];
  return bands.map(band => {
    const w0 = band[0] * 0.375;
    const w1 = band[1] * 0.375;
    return shape([[6 - w0, band[0]], [6, band[0]], [6, band[1]], [6 - w1, band[1]]], band[2]) +
      shape([[6, band[0]], [6 + w0, band[0]], [6 + w1, band[1]], [6, band[1]]], band[3]);
  }).join('');
}

// A spider: a fat body with an orange mark, a small head and eight legs
function spiderAt(cx, cy) {
  const legs = [[-1, -2.4, -4.6, -2.2], [-2, -0.8, -5.2, 1.2], [-2, 0.8, -4.8, 3.6], [-1, 2, -3.6, 5.4]]; // inner x, inner y, outer x, outer y, for the left side
  let markup = '';
  legs.forEach(leg => {
    markup += '<polyline points="' + round(cx + leg[0]) + ',' + round(cy + leg[1] * 0.4) + ' ' + round(cx + leg[0] * 2) + ',' + round(cy + leg[1]) + ' ' + round(cx + leg[2]) + ',' + round(cy + leg[3]) + '" fill="none" stroke="' + spiderLit + '" stroke-width="0.9"/>';
    markup += '<polyline points="' + round(cx - leg[0]) + ',' + round(cy + leg[1] * 0.4) + ' ' + round(cx - leg[0] * 2) + ',' + round(cy + leg[1]) + ' ' + round(cx - leg[2]) + ',' + round(cy + leg[3]) + '" fill="none" stroke="' + spiderShade + '" stroke-width="0.9"/>';
  });

  return markup +
    shape([[cx - 1.6, cy - 4.4], [cx + 1.6, cy - 4.4], [cx + 2, cy - 2.2], [cx - 2, cy - 2.2]], spiderLit) +
    shape([[cx - 3.4, cy - 2.4], [cx, cy - 2.4], [cx, cy + 4.4], [cx - 2.2, cy + 4.4], [cx - 3.4, cy + 1.6]], spiderLit) +
    shape([[cx, cy - 2.4], [cx + 3.4, cy - 2.4], [cx + 3.4, cy + 1.6], [cx + 2.2, cy + 4.4], [cx, cy + 4.4]], spiderShade) +
    shape([[cx - 0.9, cy - 0.6], [cx + 0.9, cy - 0.6], [cx + 0.5, cy + 0.4], [cx + 0.9, cy + 1.6], [cx - 0.9, cy + 1.6], [cx - 0.5, cy + 0.4]], orange);
}

// A spider hanging on a thread from the top of its shape. The thread is as long as
// drop, and the shape is as tall as the thread and the spider together.
function hangingSpider(drop) {
  return {
    viewBox: '0 0 14 ' + (drop + 10),
    markup: '<polyline points="7,0 7,' + drop + '" fill="none" stroke="' + webLine + '" stroke-width="1"/>' + spiderAt(7, drop + 4.6),
  };
}

// A cobweb in a corner: a quarter web in a box width by height. The spokes start
// at the corner and the strands bow in toward it between the spokes. draws says
// whether its lines can draw themselves.
function cornerWeb(width, height, draws) {
  const angles = [0, 22, 45, 68, 90];
  const reach = [0.3, 0.52, 0.74, 0.96];
  const x0 = 1;
  const y0 = 1;
  const at = (angle, far) => [x0 + far * (width - 2) * Math.cos(angle * Math.PI / 180), y0 + far * (height - 2) * Math.sin(angle * Math.PI / 180)];
  let markup = '';

  angles.forEach(angle => {
    markup += line([[x0, y0], at(angle, 1)], 1, draws);
  });
  reach.forEach(far => {
    const points = [at(angles[0], far)];
    for (let i = 1; i < angles.length; i++) {
      points.push(at((angles[i - 1] + angles[i]) / 2, far * 0.9));
      points.push(at(angles[i], far));
    }
    markup += line(points, 1, draws);
  });
  return { viewBox: '0 0 ' + width + ' ' + height, markup: markup };
}

// A string of bunting for a gap that is 14 px tall: a rope that sags between the
// posts, and pennants hanging from it in orange and violet, each lit on the left
// and in shade on the right
function bunting(width) {
  const length = 60;
  const swags = Math.floor(width / length);
  const span = width / swags;
  const points = [];
  let flags = '';
  let count = 0;

  for (let swag = 0; swag < swags; swag++) {
    for (let step = 0; step <= 6; step++) {
      const t = step / 6;
      points.push(round(swag * span + t * span) + ',' + round(1 + 3 * Math.sin(Math.PI * t)));
    }
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      const x = swag * span + t * span;
      const y = 1 + 3 * Math.sin(Math.PI * t);
      const colours = count % 2 === 0 ? [orangeLit, orangeShade] : [batLit, batShade];
      flags += shape([[x - 4.5, y], [x, y], [x, y + 8.4]], colours[0]) + shape([[x, y], [x + 4.5, y], [x, y + 8.4]], colours[1]);
      count += 1;
    }
  }
  return {
    viewBox: '0 0 ' + width + ' 14',
    markup: '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + stoneShade + '" stroke-width="1.2"/>' + flags,
  };
}

const shapes = {
  'ghost': ghost,
  'bat': bat,
  'bat-up': batUp,
  'ember': ember,
  'dry-leaf': dryLeaf,
  'candy-corn': { viewBox: '0 0 12 16', markup: candyCorn() },
  'spider-short': hangingSpider(5),
  'spider-long': hangingSpider(6),
  'spider-corner': hangingSpider(8),
  'web-top-left': cornerWeb(64, 26, false),
  'web-top-right': { viewBox: '0 0 64 26', markup: '<g transform="translate(64 0) scale(-1 1)">' + cornerWeb(64, 26, false).markup + '</g>' },
  'web-draw': cornerWeb(96, 28, true),
  'bunting-a': bunting(836),
  'bunting-b': bunting(654),
  'flicker-0': { viewBox: '0 -4 1920 26', markup: lit(0) },
  'flicker-1': { viewBox: '0 -4 1920 26', markup: lit(1) },
};


// The pack. A piece is
//   shape    which of the shapes above
//   x, y     where its top left corner rests, in pixels. In the back layer these
//            are screen pixels. In the front layer they are measured from the
//            top left corner of the piece's zone
//   size     how wide it is, in pixels. The height follows from the shape
//   zone     (front only) which zone it is in: the list is at the top of core/season.js
//   motion   (optional) which motion: see the list at the top of seasons/motion.css
//   seconds  how long one round of the motion takes. A piece with a motion needs it
//   delay    (optional) seconds before the first round. Negative starts it part way in
//   travel   (optional) how far a travelling motion goes, in pixels
//   opacity  (optional) 0 to 1, for a piece that should be fainter
// A piece with no motion stays still.

export const pack = {
  shapes: shapes,

  // 1920 wide and 26 high, from y -4 to 22. Drawn in the "ground" zone along the bottom edge.
  scene: { viewBox: '0 -4 1920 26', markup: sceneMarkup },

  // The picture that replaces the slashes in every panel header
  mark: mark,

  // Over the panels: twelve small pieces that cross the whole screen. Four bats
  // glide across at their own heights and speeds, two ghosts rise, two pieces of
  // candy corn and two dry leaves tumble down, and two embers float up. Each takes
  // 28 to 72 seconds for a trip, so it is only over a letter for a moment, and
  // each is faint enough (opacity .7 to .85) that a word shows through it. The
  // delays are spread (golden ratio steps round each piece's own round) so the
  // first screen already has pieces in flight. A bat's x and y are the middle of
  // its path: it starts 1150 px left of x and ends 1150 px right of it.
  over: [
    { shape: 'dry-leaf', x: 110, y: 500, size: 32, opacity: 0.8, motion: 'flutter', seconds: 30, delay: -18.5, travel: 1300 },
    { shape: 'ghost', x: 290, y: 510, size: 40, opacity: 0.7, motion: 'rise', seconds: 46, delay: -10.9, travel: 1300 },
    { shape: 'bat', x: 898, y: 150, size: 44, opacity: 0.85, motion: 'drift', seconds: 52, delay: -44.4, travel: 2300 },
    { shape: 'candy-corn', x: 560, y: 506, size: 28, opacity: 0.85, motion: 'flutter', seconds: 34, delay: -16, travel: 1300 },
    { shape: 'ember', x: 770, y: 520, size: 26, opacity: 0.85, motion: 'rise', seconds: 28, delay: -2.5, travel: 1300 },
    { shape: 'bat-up', x: 941, y: 410, size: 36, opacity: 0.85, motion: 'drift', seconds: 64, delay: -45.3, travel: 2300 },
    { shape: 'candy-corn', x: 1190, y: 512, size: 24, opacity: 0.85, motion: 'flutter', seconds: 40, delay: -13, travel: 1300 },
    { shape: 'bat', x: 941, y: 690, size: 42, opacity: 0.85, motion: 'drift', seconds: 58, delay: -54.8, travel: 2300 },
    { shape: 'ghost', x: 1490, y: 514, size: 32, opacity: 0.7, motion: 'rise', seconds: 54, delay: -30.3, travel: 1300 },
    { shape: 'dry-leaf', x: 1690, y: 506, size: 26, opacity: 0.8, motion: 'flutter', seconds: 38, delay: -6.8, travel: 1300 },
    { shape: 'bat-up', x: 947, y: 900, size: 34, opacity: 0.85, motion: 'drift', seconds: 72, delay: -57.5, travel: 2300 },
    { shape: 'ember', x: 1830, y: 522, size: 22, opacity: 0.85, motion: 'rise', seconds: 34, delay: -14.1, travel: 1300 },
  ],

  // Pieces behind the panels. They show only in the margins and in the gap between
  // the two columns, where two ghosts rise slowly, so in calm motion they hover there.
  back: [
    { shape: 'ghost', x: 2, y: 860, size: 30, opacity: 0.5, motion: 'rise', seconds: 70, delay: -24, travel: 1300 },
    { shape: 'ghost', x: 1888, y: 400, size: 28, opacity: 0.5, motion: 'rise', seconds: 80, delay: -52, travel: 1300 },
  ],

  front: [
    // Cobwebs in the top corners of the screen. They stay still.
    { zone: 'top', shape: 'web-top-left', x: 0, y: 0, size: 64 },
    { zone: 'top', shape: 'web-top-right', x: 1856, y: 0, size: 64 },

    // Spiders on threads from the top edge, swinging a little
    { zone: 'top', shape: 'spider-short', x: 330, y: 0, size: 22, motion: 'sway', seconds: 4.4, delay: -1 },
    { zone: 'top', shape: 'spider-long', x: 1560, y: 0, size: 22, motion: 'sway', seconds: 5.2, delay: -3 },

    // Bunting in the two gaps above the ticker
    { zone: 'string-a', shape: 'bunting-a', x: 0, y: 0, size: 836 },
    { zone: 'string-b', shape: 'bunting-b', x: 0, y: 0, size: 654 },

    // A web in the cut corner of the large panel that draws itself, holds, and wipes away
    { zone: 'corner-a', shape: 'web-draw', x: 0, y: 0, size: 96, motion: 'draw', seconds: 20, delay: -4 },

    // A spider that swings from the school name above the countdown
    { zone: 'corner-b', shape: 'spider-corner', x: 16, y: 0, size: 20, motion: 'sway', seconds: 4.8, delay: -2 },

    // Candy corn falling down the margins and the gap between the columns
    { zone: 'left', shape: 'candy-corn', x: 6, y: 120, size: 12, motion: 'fall', seconds: 22, delay: -5, travel: 800 },
    { zone: 'right', shape: 'candy-corn', x: 8, y: 160, size: 12, motion: 'fall', seconds: 24, delay: -3, travel: 900 },
    { zone: 'gutter', shape: 'candy-corn', x: 4, y: 140, size: 10, motion: 'fall', seconds: 18, delay: -8, travel: 420 },

    // The scene's candles and windows flicker, in two groups so they are not in step
    { zone: 'ground', shape: 'flicker-0', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 3.2, delay: -1 },
    { zone: 'ground', shape: 'flicker-1', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 4.1, delay: -2.6 },
  ],
};
