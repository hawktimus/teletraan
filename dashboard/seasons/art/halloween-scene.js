// The colours and the scene of the halloween pack: pumpkins, tombs, trees and the house (part of seasons/halloween.js).

import { round, shape, block, limb } from '../../core/svg-pieces.js';

export const orange = '#ff8a1f';
export const orangeLit = '#ffa43f';
export const orangeShade = '#d95a0e';
export const carve = '#2b1207'; // a carved hole, seen dark
export const flame = '#ffe27a'; // the same hole with a candle in it
export const stemLit = '#6ab648';
export const stemShade = '#40802c';
const stone = '#9d92cc';
export const stoneShade = '#70659d';
const stoneCut = '#453c6e';
const wood = '#7560bd';
const woodShade = '#54448e';
const hillFar = '#2a1f52';
const dirt = '#33266a';
const grass = '#5a49a3';
export const ghostLit = '#f6f0ff';
export const ghostShade = '#cdc1ee';
export const ghostDark = '#2c2347';
export const batLit = '#a68cf4';
export const batShade = '#7b5fdc';
export const webLine = '#d4c9f2';
export const spiderLit = '#8870da';
export const spiderShade = '#644cb0';
const houseLit = '#55449a';
const houseShade = '#3f3277';
const roofLit = '#6a58b6';
const roofShade = '#483b86';
const windowLit = '#ffd24a';


// Small helpers that write svg. They only make text: nothing here moves.

// A thin line. A line that is to draw itself needs pathLength and a dash of 1,
// which is what the draw motion works on (seasons/motion.css)
export function line(points, width, draws) {
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
export function pumpkinFace(cx, width, fill) {
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
export const faced = [];
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

export function houseLights(x) {
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

export const housePlace = 1050;

export const sceneMarkup =
  ridge(hillFar, 12, 2, 38, 0, 11.5) +
  trees.map(item => bareTree(item[0], item[1], item[2])).join('') +
  house(housePlace) +
  fences.map(item => fence(item[0], item[1])).join('') +
  tombs.map(item => tomb(item[0], item[1], item[2], item[3], item[4])).join('') +
  ridge(dirt, 19.2, 0.7, 29, 1, 17.5) +
  blades() +
  pumpkins.map(item => pumpkinBody(item[0], item[1])).join('') +
  faced.map(item => pumpkinFace(item[0], item[1], carve)).join('');
