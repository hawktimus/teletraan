// The colours and the drawings of the competition-day pack (part of seasons/competition-day.js).

import { round, shape, ball, polar, block } from '../../core/svg-pieces.js';

export const gold = '#f7c531';
export const goldShade = '#c99a2e';
export const white = '#f6f6fb';
export const whiteShade = '#c4c2d6';
export const violet = '#6c18b6'; // the team purple of the tabs
export const violetLit = '#8a3fe0'; // a lighter violet that reads on the black ground
export const violetShade = '#4b1090';
const red = '#e0443e';
const redShade = '#a82a27';
export const steel = '#8b8fa8';
const steelShade = '#5d6179';
const dark = '#2c2a40';
const darkLit = '#45425f';
const hole = '#0a0710';


// Small helpers that write svg. They only make text: nothing here moves.

// An octagon, the faceted stand-in for a circle
function octagon(cx, cy, r, fill) {
  const s = r * 0.38;
  return shape([[cx - s, cy - r], [cx + s, cy - r], [cx + r, cy - s], [cx + r, cy + s], [cx + s, cy + r], [cx - s, cy + r], [cx - r, cy + s], [cx - r, cy - s]], fill);
}

// A chequered pattern. The base is the dark colour and the light squares are one
// path, so a long strip is still only two shapes. Squares are size pixels wide.
export function chequer(x, y, columns, rows, size, darkColour, lightColour) {
  let squares = '';
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if ((row + column) % 2 === 0) {
        squares += 'M' + (x + column * size) + ' ' + (y + row * size) + 'h' + size + 'v' + size + 'h-' + size + 'z';
      }
    }
  }
  return block(x, y, columns * size, rows * size, darkColour) + '<path d="' + squares + '" fill="' + lightColour + '"/>';
}


// The pieces that spin, draw and swing

// A gear: teeth round a rim, six spokes in a second tone so the turning shows,
// and a hole. The rim takes the lit colour and the spokes the shaded one.
export function gear(size, teeth, lit, shade) {
  const c = size / 2;
  const pitch = 2 * Math.PI / teeth;
  const rim = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch;
    rim.push(polar(c, c * 0.8, a - pitch * 0.3));
    rim.push(polar(c, c, a - pitch * 0.17));
    rim.push(polar(c, c, a + pitch * 0.17));
    rim.push(polar(c, c * 0.8, a + pitch * 0.3));
  }

  let wedges = '';
  for (let i = 1; i < 6; i += 2) {
    wedges += shape([[c, c], polar(c, c * 0.66, i * Math.PI / 3), polar(c, c * 0.66, (i + 1) * Math.PI / 3)], shade);
  }
  return shape(rim, lit) + wedges + octagon(c, c, c * 0.2, hole);
}

// A burst of short lines fanning up from the bottom middle. The 'draw' motion
// draws them one after another and wipes them away, so each line is a path with
// pathLength="1" and stroke-dasharray="1", as motion.css asks.
export function spark(size, colours) {
  const angles = [-62, -31, 0, 31, 62];
  const lengths = [0.5, 0.74, 0.88, 0.74, 0.5];
  const x = size / 2;
  const y = size - 1.5;
  let lines = '';

  angles.forEach((degrees, index) => {
    const a = degrees * Math.PI / 180;
    const from = [x + size * 0.2 * Math.sin(a), y - size * 0.2 * Math.cos(a)];
    const to = [x + size * lengths[index] * Math.sin(a), y - size * lengths[index] * Math.cos(a)];
    lines += '<path d="M' + round(from[0]) + ' ' + round(from[1]) + 'L' + round(to[0]) + ' ' + round(to[1]) + '" pathLength="1" stroke-dasharray="1" fill="none" stroke="' + colours[index % colours.length] + '" stroke-width="2"/>';
  });
  return lines;
}

// The start lights: red octagons with a pale facet, laid over the five sockets of
// the gantry (see gantry below, which is the same 140 by 22). The housing round
// them is still. The lights are shared out in three groups, and each group is a
// piece of its own, so the groups can come on one after another and not all
// together: the first and fourth light, then the second and fifth, then the third.
export function startLights(places) {
  return places.map(place => '<g transform="translate(' + (14 + place * 24) + ' 3)">' +
    ball(8, 8, 8, '#ff4d45', '#c42b2b') + shape([[3.6, 4], [6, 2.6], [7, 3.8], [4.6, 5.4]], '#ffb3ad') + '</g>').join('');
}

// A chequered banner hanging from a short bar. It swings about the middle of the bar.
export const banner = {
  viewBox: '0 0 24 20',
  markup: block(0, 0, 24, 2, steel) + chequer(2, 2, 5, 4, 4, violet, white),
};

// Confetti: a skewed strip, lit on its left and in shade on its right
export function confetti(lit, shade) {
  return shape([[1, 0], [9, 3], [8, 16], [0, 13]], lit) + shape([[5, 1.5], [9, 3], [8, 16], [4, 14.5]], shade);
}


// The cloth of a chequered flag, in columns of squares. The cloth waves, so each
// column is lifted or dropped by the numbers in wave: how far each vertical edge
// is moved down, counted from the pole to the tip, so one more number than there
// are columns. A column that tilts up towards the tip catches the light and a
// column that tilts down is in shade, which is what makes the waves show.
// colours is { first: [lit, shade], second: [lit, shade] }, the two kinds of square.
function cloth(left, top, columnWidth, rowHeight, rows, wave, colours) {
  let squares = '';
  for (let column = 0; column < wave.length - 1; column++) {
    const side = wave[column + 1] <= wave[column] ? 0 : 1; // 0 is the lit colour, 1 the shaded one
    const x0 = left + column * columnWidth;
    const x1 = x0 + columnWidth;

    for (let row = 0; row < rows; row++) {
      const colour = (row + column) % 2 === 0 ? colours.first[side] : colours.second[side];
      const y0 = top + row * rowHeight;
      squares += shape([[x0, y0 + wave[column]], [x1, y0 + wave[column + 1]], [x1, y0 + rowHeight + wave[column + 1]], [x0, y0 + rowHeight + wave[column]]], colour);
    }
  }
  return squares;
}

const whiteSquares = [white, '#b9b4d8'];
export const violetSquares = ['#9a55ec', '#6a22c0'];
export const goldSquares = ['#ffd84d', goldShade];


// The mark: a chequered flag on a gold pole, 60 by 76, which is the biggest a mark
// may be (markBox in core/marks.js). The pole, its ball and its foot are inside
// <g class="double-slash">, so they take the accent colour of the screen, which the
// Competition Day overlay makes gold. The chequers are violet and white and stay
// so. The small gear at the foot is a fixed gold.

const markWave = [0, 3.2, 0.6, -3.2, -0.8];

const markMarkup =
  cloth(8, 8, 12.5, 14, 3, markWave, { first: whiteSquares, second: violetSquares }) +
  '<g transform="translate(36 54)">' + gear(22, 8, gold, goldShade) + '</g>' +
  '<g class="double-slash">' +
  block(4, 6, 4, 66, gold) + octagon(6, 4.2, 4.2, gold) +
  shape([[0, 76], [14, 76], [11.5, 71], [2.5, 71]], gold) +
  '</g>';

export const mark = { viewBox: '0 0 60 76', markup: markMarkup };


// The pieces over the panels. Each is a small flat shape that falls, drifts or
// rises across the whole screen: gears, little chequered flags, chequer tiles,
// confetti and glints. They are drawn at their own size, 18 to 44 px.

// A gear for the over layer: the same drawing as the corner gears, in its own colours
export function bigGear(size, teeth, lit, shade) {
  return { viewBox: '0 0 ' + size + ' ' + size, markup: gear(size, teeth, lit, shade) };
}

// A little flag on a stick, 28 wide and 34 high, with a ball on top of the stick
export function flagOnStick(squares, stick) {
  return block(1, 3, 2, 31, stick) + octagon(2, 2.4, 2.4, stick) +
    cloth(3, 4, 7.5, 6.5, 2, [0, 1.6, -0.4, -1.8], { first: whiteSquares, second: squares });
}

// A square of chequered cloth torn off a flag: four squares, each cut into a lit
// and a shaded half along its diagonal, 20 by 20
export function tile(second) {
  let markup = '';
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 2; column++) {
      const colours = (row + column) % 2 === 0 ? whiteSquares : second;
      const x = column * 10;
      const y = row * 10;
      markup += shape([[x, y], [x + 10, y], [x, y + 10]], colours[0]) + shape([[x + 10, y], [x + 10, y + 10], [x, y + 10]], colours[1]);
    }
  }
  return markup;
}

// A glint: a four pointed star, lit on its
// left half and in shade on its right half, 24 by 24
export function glint(lit, shade) {
  return shape([[12, 0], [9, 9], [0, 12], [9, 15], [12, 24], [12, 12]], lit) +
    shape([[12, 0], [15, 9], [24, 12], [15, 15], [12, 24], [12, 12]], shade);
}


// The top edge. A line of pennants, gold, white and violet in turn, with the
// middle left clear for the gantry.
export function bunting() {
  const colours = [[gold, goldShade], [white, whiteShade], [violetLit, violetShade]];
  let pennants = '';
  let count = 0;

  for (let x = 14; x < 1900; x += 38) {
    if (x > 790 && x < 1120) continue;
    const colour = colours[count % colours.length];
    count += 1;
    pennants += shape([[x, 1], [x + 16, 1], [x + 8, 17]], colour[0]) + shape([[x + 8, 1], [x + 16, 1], [x + 8, 17]], colour[1]);
  }
  return '<polyline points="0,1 1920,1" fill="none" stroke="' + steel + '" stroke-width="1.6"/>' + pennants;
}

// The housing of the start lights. Five dark sockets; the lights are pieces of
// their own, laid over the sockets, so they can come on one after another.
export function gantry() {
  const body = shape([[4, 0], [136, 0], [140, 4], [140, 18], [136, 22], [4, 22], [0, 18], [0, 4]], dark) +
    shape([[4, 0], [136, 0], [140, 4], [0, 4]], darkLit) +
    block(4, 0, 132, 2, gold);
  let sockets = '';
  for (let k = 0; k < 5; k++) sockets += octagon(22 + k * 24, 11, 8.6, hole);
  return body + sockets;
}


// The corners and the gap between the columns

// A spanner: an open jaw on the left and a ring on the right
export const wrench = {
  viewBox: '0 0 38 14',
  markup: shape([[0, 2], [6, 0], [12, 2], [12, 12], [6, 14], [0, 12]], steel) +
    shape([[6, 0], [12, 2], [12, 12], [6, 14]], steelShade) +
    block(0, 5, 6, 4, hole) +
    block(12, 5, 18, 4, steel) + block(12, 7.6, 18, 1.4, steelShade) +
    ball(31, 7, 6.6, steel, steelShade) + octagon(31, 7, 2.6, hole),
};

// The dashed line of a pit lane, in the gap between the two columns
export function laneDashes() {
  let dashes = '';
  for (let y = 10; y < 320; y += 30) dashes += block(8, y, 4, 16, gold);
  return dashes;
}


// The ticker. A chequered ribbon between two thin gold lines, as wide as its zone.
export function ribbon(width) {
  return block(0, 2, width, 1.4, gold) +
    chequer(0, 3.4, Math.ceil(width / 3), 2, 3, violet, white) +
    block(0, 9.4, width, 1.4, goldShade);
}


// The bottom edge: a pit lane. The scene is 1920 wide and 26 high, and its y runs
// from -4 (the top edge of the strip) to 22 (the bottom of the screen). A
// chequered kerb fills y 16 to 22. The pieces below are drawn to stand on y 19, and
// the scene moves them up 3 px (see sceneMarkup) so that they stand on the kerb.
// Left of x 270 the ticker's tag comes within 12 px of the top, so there (y under
// 8) the scene is only the kerb.

const kerb = 19;

// A stack of tyres, each with a gold band, standing on the kerb
function tyres(x, count) {
  let stack = '';
  for (let k = 0; k < count; k++) {
    const top = kerb - 4 * (k + 1);
    stack += shape([[x - 7, top + 0.8], [x - 6.2, top], [x + 6.2, top], [x + 7, top + 0.8], [x + 7, top + 3.2], [x + 6.2, top + 4], [x - 6.2, top + 4], [x - 7, top + 3.2]], dark) +
      shape([[x - 7, top + 0.8], [x - 6.2, top], [x + 6.2, top], [x + 7, top + 0.8], [x + 7, top + 2], [x - 7, top + 2]], darkLit) +
      block(x - 6, top + 1.7, 12, 0.8, gold);
  }
  return stack;
}

// A traffic cone with a white band, in the team gold
function cone(x) {
  const half = y => 1.2 + (y - 7) * 0.25;
  return block(x - 5, kerb - 1.6, 10, 1.6, dark) +
    shape([[x - half(17.4), 17.4], [x + half(17.4), 17.4], [x + 1.2, 7], [x - 1.2, 7]], gold) +
    shape([[x, 7], [x + 1.2, 7], [x + half(17.4), 17.4], [x, 17.4]], goldShade) +
    shape([[x - half(11), 11], [x + half(11), 11], [x + half(14), 14], [x - half(14), 14]], white);
}

// A red tool box on the kerb with a gold handle
function toolbox(x) {
  return block(x, 12.5, 14, 6.5, red) + block(x, 16, 14, 3, redShade) + block(x, 12.5, 14, 1.4, '#ff6a62') +
    block(x + 4, 10.8, 6, 1.4, steel) + block(x + 4, 14.6, 6, 1, gold);
}

// A tower with three lights: green is lit, red and amber are out
function lightTower(x) {
  return block(x - 0.7, 11, 1.4, 8, steel) + block(x - 3, 0, 6, 12, dark) + block(x - 3, 0, 6, 1.4, darkLit) +
    block(x - 2, 1.8, 4, 2.6, '#6b2a2c') + block(x - 2, 5, 4, 2.6, '#6b5a2a') + block(x - 2, 8.2, 4, 2.6, '#4be08a');
}

// A flag on a pole, chequered
function flagPole(x) {
  return block(x - 0.7, 3, 1.4, 16, steel) + chequer(x + 0.7, 3.4, 3, 2, 3.2, violet, white);
}

// A robot with gold bumpers, drawn with its top left corner at (ox, oy). It is 26 wide and 10 high.
function robot(ox, oy) {
  return block(ox + 4, oy + 1.6, 8, 4.4, steel) + block(ox + 4, oy + 1.6, 8, 1.4, white) +
    shape([[ox + 12, oy + 3], [ox + 20, oy + 0.4], [ox + 21, oy + 1.8], [ox + 13, oy + 4.6]], steelShade) +
    shape([[ox + 19.2, oy], [ox + 22.8, oy], [ox + 22.8, oy + 2.8], [ox + 20.4, oy + 2.8]], gold) +
    block(ox + 1, oy + 6, 24, 1.6, dark) +
    block(ox, oy + 7, 26, 3, gold) + block(ox, oy + 9, 26, 1, goldShade) + block(ox + 10, oy + 7.6, 6, 1.6, white);
}

// The race car, facing right: 28 wide and 11 high, with its wheels on the bottom edge
export const car = {
  viewBox: '0 0 28 11',
  markup: block(1.5, 3, 1, 3, steel) + block(0, 1.6, 6, 1.4, violetLit) +
    shape([[1, 8.2], [1.5, 5.6], [9, 5.2], [12, 3.2], [17, 3.2], [19.5, 5.2], [26.5, 5.8], [27.8, 8.2]], gold) +
    shape([[1, 8.2], [27.8, 8.2], [27.2, 6.8], [1.2, 6.8]], goldShade) +
    shape([[3, 5.9], [25, 5.9], [25, 6.7], [3, 6.7]], white) +
    shape([[12.8, 3.9], [16.4, 3.9], [17.4, 5], [11.9, 5]], dark) + octagon(14.6, 3.2, 1.5, white) +
    octagon(6, 8, 3, dark) + octagon(6, 8, 1.2, steel) + octagon(22, 8, 3, dark) + octagon(22, 8, 1.2, steel),
};

// The same robot, rolling along the pit lane
export const rover = { viewBox: '0 0 26 10', markup: robot(0, 0) };

// x of the left side of each tool box and robot, and the centres of the rest.
// The car rests at x 860 and the rolling robot at x 1230, so keep those places clear.
const pit = [
  tyres(322, 3), cone(344), flagPole(374),
  toolbox(520), tyres(552, 2), robot(580, 9), lightTower(626),
  cone(702), cone(718), flagPole(760),
  tyres(960, 3), tyres(976, 2), toolbox(1010), robot(1040, 9), lightTower(1084),
  flagPole(1304), tyres(1334, 3), cone(1358), toolbox(1384),
  robot(1500, 9), tyres(1544, 2), lightTower(1572),
  cone(1680), flagPole(1704), tyres(1744, 3), tyres(1760, 2),
  toolbox(1850), tyres(1884, 2),
];

// The kerb is two rows of 3 px squares along the whole bottom edge (6 px high), and
// the pit stands on top of it, so the group is lifted by 3 px: the pieces above were
// drawn to stand on y 19, and they now stand on y 16
export const sceneMarkup = chequer(0, kerb - 3, 640, 2, 3, violet, white) + '<g transform="translate(0 -3)">' + pit.join('') + '</g>';
