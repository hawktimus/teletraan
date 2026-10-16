// The mark and the small pieces of the halloween pack: ghost, bats, spiders and the web (part of seasons/halloween.js).

import { round, polygon, shape, mirror } from '../../core/svg-pieces.js';
import { batLit, batShade, carve, faced, flame, ghostDark, ghostLit, ghostShade, houseLights, housePlace, line, orange, orangeLit, orangeShade, pumpkinFace, spiderLit, spiderShade, stemLit, stemShade, stoneShade, webLine } from './halloween-scene.js';

// The lit faces, in two groups so the candles do not flicker together. The
// lit windows of the house go with the second group.
export function lit(group) {
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

export const mark = { viewBox: '0 0 60 76', markup: pumpkinMark };


// The shapes the pieces use, each drawn once

// A ghost: a sheet with a ragged hem, the left half lit and the right half in shade
export const ghost = {
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

export const bat = {
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

export const batUp = {
  viewBox: '0 0 44 22',
  markup: shape(wingUpLit, batLit) + shape(mirror(wingUpLit, 44), batLit) +
    shape(wingUpShade, batShade) + shape(mirror(wingUpShade, 44), batShade) +
    shape([[19.4, 9.4], [19.8, 4.6], [21, 6.4], [23, 6.4], [24.2, 4.6], [24.6, 9.4], [23.4, 11.8], [20.6, 11.8]], batLit) +
    shape([[20.2, 11.8], [23.8, 11.8], [24.4, 18], [22, 21], [19.6, 18]], batShade),
};

// An ember: a small four pointed spark, orange with a bright middle
export const ember = {
  viewBox: '0 0 14 14',
  markup: polygon('7,0 8.9,5.1 14,7 8.9,8.9 7,14 5.1,8.9 0,7 5.1,5.1', orange) +
    polygon('7,3.4 8.2,5.8 10.6,7 8.2,8.2 7,10.6 5.8,8.2 3.4,7 5.8,5.8', flame),
};

// A dry leaf with ragged points, in rust. The left half is lit and the right half in shade.
const dryRight = [[8, 0], [10.6, 3.2], [13.2, 2.4], [12.4, 7], [15.8, 8.6], [12.6, 12.4], [14.2, 17], [10.4, 15.8], [8.8, 21], [8, 21]];

export const dryLeaf = {
  viewBox: '0 0 16 24',
  markup: shape(mirror(dryRight, 16), '#e0782a') + shape(dryRight, '#a8480f') +
    shape([[7.4, 20.6], [8.6, 20.6], [8.6, 24], [7.4, 24]], '#5e2b0b'),
};

// Candy corn: three bands, white, orange and yellow, each with a lit left half
// and a shaded right half
export function candyCorn() {
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
export function hangingSpider(drop) {
  return {
    viewBox: '0 0 14 ' + (drop + 10),
    markup: '<polyline points="7,0 7,' + drop + '" fill="none" stroke="' + webLine + '" stroke-width="1"/>' + spiderAt(7, drop + 4.6),
  };
}

// A cobweb in a corner: a quarter web in a box width by height. The spokes start
// at the corner and the strands bow in toward it between the spokes. draws says
// whether its lines can draw themselves.
export function cornerWeb(width, height, draws) {
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
export function bunting(width) {
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
