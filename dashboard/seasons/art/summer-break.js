// The colours and the drawings of the summer-break pack (part of seasons/summer-break.js).

import { round, shape, polar, block } from '../../core/svg-pieces.js';

export const seaDeep = '#0d5f87';
export const seaFar = '#1a7fb0';
export const seaMid = '#2aa9c8';
export const seaNear = '#6fe0dc';
const foam = '#f2fffd';
const sand = '#f5d98f';
const sandShade = '#dcb468';
const castle = '#e8c372';
const castleShade = '#c79a4a';
export const sun = '#ffd447';
const sunRay = '#ffc93a';
export const sunShade = '#ffb02e';
export const coral = '#ff6f59';
const coralShade = '#d94a3a';
const palm = '#34b96f';
const palmShade = '#1f8a52';
const trunk = '#a0703f';
const trunkShade = '#744a28';
const white = '#f4f9ff';
const whiteShade = '#bcd3ea';
const ink = '#4d5b73';


// Small helpers that write svg. They only make text: nothing here moves.

// The eight corners of an octagon, the faceted stand-in for a circle
function octagonPoints(cx, cy, r) {
  const s = r * 0.38;
  return [[cx - s, cy - r], [cx + s, cy - r], [cx + r, cy - s], [cx + r, cy + s], [cx + s, cy + r], [cx - s, cy + r], [cx - r, cy + s], [cx - r, cy - s]];
}

function octagon(cx, cy, r, fill) {
  return shape(octagonPoints(cx, cy, r), fill);
}

// A beach ball: eight panels round a white cap
export function beachBall(cx, cy, r) {
  const ring = octagonPoints(cx, cy, r);
  const colours = [coral, white, sun, white, seaMid, white, coral, white];
  let panels = '';
  ring.forEach((point, index) => {
    panels += shape([[cx, cy], point, ring[(index + 1) % ring.length]], colours[index]);
  });
  return panels + octagon(cx, cy, r * 0.24, white);
}

// A leaf from (ax, ay) to its tip (tx, ty): a kite with its upper half lit and its lower half in shade
function leaf(ax, ay, tx, ty, width, lit, shade) {
  const length = Math.sqrt((tx - ax) * (tx - ax) + (ty - ay) * (ty - ay));
  const mx = ax + (tx - ax) * 0.45;
  const my = ay + (ty - ay) * 0.45;
  let nx = -(ty - ay) / length * width / 2;
  let ny = (tx - ax) / length * width / 2;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return shape([[ax, ay], [mx + nx, my + ny], [tx, ty]], lit) + shape([[ax, ay], [mx - nx, my - ny], [tx, ty]], shade);
}

// A palm tree standing at (x, baseY): a slim trunk leaning towards its crown, leaves
// to the tips given, and two coconuts. The leaves are 18 px across at height 18.
export function palmTree(x, baseY, height, lean, tips) {
  const cx = x + lean;
  const cy = baseY - height;
  const scale = height / 18;
  let leaves = '';
  tips.forEach(tip => {
    leaves += leaf(cx, cy, cx + tip[0] * scale, cy + tip[1] * scale, 4 * scale, palm, palmShade);
  });

  return shape([[x - 1.4, baseY], [x, baseY], [cx, cy], [cx - 0.9, cy]], trunk) +
    shape([[x, baseY], [x + 1.4, baseY], [cx + 0.9, cy], [cx, cy]], trunkShade) +
    leaves + octagon(cx - 1, cy + 1.6, 1.1, trunkShade) + octagon(cx + 1.1, cy + 1.8, 1.1, trunk);
}

const allLeaves = [[-10, 3.5], [-8, -2.5], [-2, -5.5], [6, -4.5], [10, 2.5]];
export const upLeaves = [[-8, -2.5], [-2, -5.5], [6, -4.5]];

// A beach umbrella: a fan of striped panels over a pole, with a towel at its foot
export function umbrella(x, width, apexY, edgeY, footY) {
  const left = x - width / 2;
  const step = width / 6;
  let panels = '';
  for (let k = 0; k < 6; k++) {
    panels += shape([[x, apexY], [left + k * step, edgeY], [left + (k + 1) * step, edgeY]], k % 2 === 0 ? coral : white);
  }
  return block(x - 0.5, apexY, 1, footY - apexY, whiteShade) + panels +
    shape([[left, edgeY], [left + width, edgeY], [left + width - 1, edgeY + 1.2], [left + 1, edgeY + 1.2]], coralShade) +
    octagon(x, apexY - 0.4, 1, sun);
}


// The mark: a sun rising out of the sea, 60 by 76, which is the biggest a mark may
// be (markBox in core/marks.js). Twelve rays in two tones round a faceted disc,
// and three bands of zigzag water in front of it. The first and the last band are
// inside <g class="double-slash">, so they take the accent colour of the screen,
// which the Summer Break overlay makes aqua. The sun and the middle band keep their
// own colours.

const markDiscLit = '#ffe66b';
const markDiscShade = '#ffc93a';
const markRayLong = '#ff9a2e';
const markRayShort = '#ffb02e';

// A point on a circle round the sun's middle. The angle is 0 straight up and grows clockwise.
function aroundSun(radius, angle) {
  return [30 + radius * Math.sin(angle), 29 - radius * Math.cos(angle)];
}

function sunMark() {
  let rays = '';
  for (let k = 0; k < 12; k++) {
    const angle = k * Math.PI / 6;
    const long = k % 2 === 0;
    rays += shape([aroundSun(15, angle - 0.21), aroundSun(long ? 29 : 24, angle), aroundSun(15, angle + 0.21)], long ? markRayLong : markRayShort);
  }

  // The disc is twelve sided: its left half is lit and its right half in shade
  const lit = [];
  const shade = [];
  for (let k = 0; k <= 6; k++) {
    shade.push(aroundSun(14, k * Math.PI / 6));
    lit.push(aroundSun(14, Math.PI + k * Math.PI / 6));
  }
  return rays + shape(lit, markDiscLit) + shape(shade, markDiscShade);
}

// A band of water across the mark: a zigzag with a crest every 15 px, drawn between its top
// edge and a second zigzag thickness lower. startsHigh says whether the crest or the trough comes first.
function waveBand(top, thickness, amplitude, startsHigh, fill) {
  const upper = [];
  const lower = [];
  for (let k = 0; k <= 8; k++) {
    const y = top + ((k % 2 === 0) === startsHigh ? 0 : amplitude);
    upper.push([k * 7.5, y]);
    lower.push([k * 7.5, y + thickness]);
  }
  return shape(upper.concat(lower.reverse()), fill);
}

export const mark = {
  viewBox: '0 0 60 76',
  markup: sunMark() +
    waveBand(56.5, 5.5, 3.5, false, '#2a8fd0') +
    '<g class="double-slash">' + waveBand(47, 5.5, 3.5, true, seaMid) + waveBand(66, 5.5, 3.5, true, seaMid) + '</g>',
};


// The pieces that move

// A gull seen from the front with its wings up: a bold M, 40 by 18. Each wing is
// white above and pale blue below, with a dark tip. The right wing is the left
// one turned over.
function mirrored(pairs) {
  return pairs.map(pair => [40 - pair[0], pair[1]]);
}

const wingAbove = [[20, 8.6], [10.5, 0.4], [0, 7.6], [10.5, 3.8]];
const wingBelow = [[20, 8.6], [10.5, 3.8], [0, 7.6], [1.4, 10.4], [10.5, 6.4], [20, 12.6]];
const wingTip = [[0, 7.6], [4.4, 4.4], [5.8, 7], [1.4, 10.4]];

export const gull = {
  viewBox: '0 0 40 18',
  markup: shape(wingAbove, white) + shape(wingBelow, whiteShade) + shape(wingTip, ink) +
    shape(mirrored(wingAbove), white) + shape(mirrored(wingBelow), whiteShade) + shape(mirrored(wingTip), ink) +
    shape([[18, 8], [22, 8], [22.8, 14.6], [20, 18], [17.2, 14.6]], white) + shape([[20, 8], [22, 8], [22.8, 14.6], [20, 18]], whiteShade),
};

// A sun sparkle: a four pointed star in two tones with a small pale diamond in its
// middle, 24 by 24
export const sparkle = {
  viewBox: '0 0 24 24',
  markup: shape([[12, 0], [9, 9], [0, 12], [9, 15], [12, 24], [12, 12]], '#ffe27a') +
    shape([[12, 0], [15, 9], [24, 12], [15, 15], [12, 24], [12, 12]], sun) +
    shape([[12, 7], [17, 12], [12, 17], [7, 12]], '#fff6c2'),
};

// A sailboat on its way: a coral hull, a white sail and a sunny one
export const boat = {
  viewBox: '0 0 26 14',
  markup: shape([[2, 10], [24, 10], [21, 13.4], [5, 13.4]], coral) + shape([[3.6, 12], [22.4, 12], [21, 13.4], [5, 13.4]], coralShade) +
    block(12.5, 1, 1, 9.5, '#8a6a40') +
    shape([[11.8, 1.4], [11.8, 9.6], [4, 9.6]], white) + shape([[14.2, 2.6], [14.2, 9.6], [22, 9.6]], sun) +
    shape([[12.5, 1], [16, 1.9], [12.5, 2.8]], coral),
};

// A bubble: an octagon drawn as a ring, with a very faint fill and a pale facet.
// The fill is so thin that a word shows through it as through the ring.
export const bubble = {
  viewBox: '0 0 24 24',
  markup: '<polygon points="' + octagonPoints(12, 12, 10.2).map(pair => round(pair[0]) + ',' + round(pair[1])).join(' ') + '" fill="#bff6ef" fill-opacity="0.16" stroke="#bff6ef" stroke-width="2.6" stroke-linejoin="round"/>' +
    shape([[6.2, 9.2], [9, 6.2], [10.8, 7.6], [8, 10.6]], '#f2fffd'),
};

// The rays of the sun, twelve points in two tones so the turning shows
export function rays() {
  let points = '';
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6;
    points += shape([polar(17, 8.6, a - 0.2), polar(17, 16.6, a), polar(17, 8.6, a + 0.2)], k % 2 === 0 ? sunRay : sunShade);
  }
  return points;
}

// The fronds of a palm hang from the middle of the top edge of the piece, and
// swing about that point
export const frondLeft = { viewBox: '0 0 22 12', markup: leaf(11, 0, 0.5, 10.5, 4.4, palm, palmShade) };
export const frondRight = { viewBox: '0 0 22 12', markup: leaf(11, 0, 21.5, 10.5, 4.4, palm, palmShade) };


// The top edge: a line of small swallow-tailed flags in coral, white, sun and sea
// colours, each lit on its left half and in shade on its right half
export function topBunting() {
  const colours = [[coral, coralShade], [white, whiteShade], [sun, sunShade], [seaMid, seaFar]];
  let flags = '';
  for (let k = 0; k < 50; k++) {
    const x = 8 + k * 38.4;
    const colour = colours[k % colours.length];
    flags += shape([[x, 1], [x + 7, 1], [x + 7, 17], [x, 17]], colour[0]) +
      shape([[x + 7, 1], [x + 14, 1], [x + 11, 9], [x + 14, 17], [x + 7, 17]], colour[1]);
  }
  return '<polyline points="0,1 1920,1" fill="none" stroke="' + ink + '" stroke-width="1.6"/>' + flags;
}

// A thin line of water for the gaps above the ticker, in short zigzags
export function waterLine(width) {
  const points = [];
  for (let x = 0; x <= width; x += 12) points.push(round(x) + ',' + round(x / 12 % 2 === 0 ? 11.2 : 12.8));
  return '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + seaMid + '" stroke-width="1.8"/>';
}


// The bottom edge. The scene is 1920 wide and 26 high, and its y runs from -4
// (the top edge of the strip) to 22 (the bottom of the screen). The sea is drawn
// in three layers that swell up and down, with the sand over them. Left of
// x 270 the ticker's tag comes within 12 px of the top, so there (y under 8) the
// scene is only low sea and sand, and the waves are kept at y 10 or lower even
// when they swell up.

// One layer of sea: a crest made of straight facets that rolls between middle +/- swing.
// With foam, a little white wedge sits on the top of each crest.
export function wave(fill, middle, swing, step, phase, withFoam) {
  const pairs = [[0, 22]];
  for (let x = 0; x <= 1920; x += step) {
    pairs.push([x, middle + swing * Math.sin(x / 61 + phase) + swing * 0.5 * Math.sin(x / 23 + phase * 2)]);
  }
  pairs.push([1920, 22]);

  let markup = shape(pairs, fill);
  if (withFoam) {
    for (let i = 2; i < pairs.length - 2; i++) {
      const peak = pairs[i][1] < pairs[i - 1][1] && pairs[i][1] < pairs[i + 1][1];
      if (peak) markup += shape([[pairs[i][0] - 6, pairs[i][1] + 1.6], [pairs[i][0], pairs[i][1] - 0.8], [pairs[i][0] + 6, pairs[i][1] + 1.6]], foam);
    }
  }
  return markup;
}

// The sand: a lit top and a darker band along the bottom
function sandy() {
  const top = [[0, 22]];
  for (let x = 0; x <= 1920; x += 48) top.push([x, 17.6 + 0.5 * Math.sin(x / 83)]);
  top.push([1920, 22]);

  const low = [[0, 22]];
  for (let x = 0; x <= 1920; x += 40) low.push([x, 20.2 + 0.4 * Math.sin(x / 51 + 1)]);
  low.push([1920, 22]);
  return shape(top, sand) + shape(low, sandShade);
}

// A sandcastle with two towers and a keep, standing on y 18.4
function sandcastle(x) {
  return block(x, 14.4, 13, 4, castleShade) + block(x - 1.5, 10.4, 4.5, 8, castle) + block(x + 10, 10.4, 4.5, 8, castle) +
    block(x + 4, 11.8, 5, 6.6, castle) +
    block(x - 1.5, 9.2, 1.5, 1.2, castle) + block(x + 1.5, 9.2, 1.5, 1.2, castle) +
    block(x + 10, 9.2, 1.5, 1.2, castle) + block(x + 13, 9.2, 1.5, 1.2, castle) +
    block(x + 4, 10.6, 1.5, 1.2, castle) + block(x + 7.5, 10.6, 1.5, 1.2, castle) +
    block(x + 6.4, 6, 0.6, 5, white) + shape([[x + 7, 6], [x + 11, 7.4], [x + 7, 8.8]], coral) +
    block(x + 5.8, 15.4, 1.8, 3, seaDeep);
}

// A surfboard stuck upright in the sand
function surfboard(x, lit, shade) {
  return shape([[x, 4], [x - 2, 7.5], [x - 2, 15], [x, 18.4]], lit) + shape([[x, 4], [x + 2, 7.5], [x + 2, 15], [x, 18.4]], shade) +
    block(x - 2, 10, 4, 1.6, white);
}

// A striped towel lying on the sand
function towel(x, width) {
  const stripe = at => shape([[x + width * at, 17.8], [x + width * (at + 0.1), 17.8], [x + width * (at + 0.1) - 1, 19.8], [x + width * at - 1, 19.8]], white);
  return shape([[x, 17.8], [x + width, 17.8], [x + width - 1, 19.8], [x - 1, 19.8]], coral) + stripe(0.3) + stripe(0.6);
}

// A little crab with two claws and eyes on stalks
function crab(x) {
  return shape([[x - 2.6, 17.6], [x - 1.6, 16.2], [x + 1.6, 16.2], [x + 2.6, 17.6], [x + 1.6, 18.8], [x - 1.6, 18.8]], coral) +
    shape([[x - 4.2, 15.6], [x - 2.4, 15], [x - 2.6, 16.8]], coralShade) + shape([[x + 4.2, 15.6], [x + 2.4, 15], [x + 2.6, 16.8]], coralShade) +
    block(x - 1.4, 15, 0.8, 1.4, white) + block(x + 0.6, 15, 0.8, 1.4, white);
}

// x of the foot, the height and how far the crown leans
const palms = [[330, 16, 3], [640, 14, -2], [1130, 17, 3], [1480, 15, -3], [1830, 16, 2]];

// x of the middle and the width
const umbrellas = [[470, 20], [1350, 18], [1700, 20]];

export const beachMarkup =
  sandy() +
  palms.map(item => palmTree(item[0], 18.4, item[1], item[2], allLeaves)).join('') +
  umbrellas.map(item => umbrella(item[0], item[1], 4.2, 9.4, 18.8)).join('') +
  [900, 1590].map(sandcastle).join('') +
  surfboard(760, seaMid, seaFar) + surfboard(1020, coral, coralShade) + surfboard(1260, sun, sunShade) +
  [[150, 14], [215, 12], [560, 14], [1230, 14], [1760, 14]].map(item => towel(item[0], item[1])).join('') +
  crab(1060) + crab(1650);
