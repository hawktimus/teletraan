// The Christmas pack. It is the model for the other packs: copy this file, keep
// the shape of it, and change the pictures, the places and the numbers.
// docs/seasonal-packs.md explains every part.
//
// What it draws:
//   - a fir tree in place of the slashes at the right of every panel header (mark)
//   - twelve snowflakes of three sizes that fall and sway across the whole screen,
//     over the panels (over)
//   - in the empty places: a lit string along the top edge, and two more in the
//     gap above the ticker, holly in one cut corner and a bell in the other, and
//     a snowy scene along the bottom edge: hills, trees, presents, a snowman and
//     two lamp posts (front and scene)
//
// The pack is data. It holds no keyframes and no animation code: a piece names a
// motion ('fall', 'twinkle', 'sway'...) and seasons/motion.css plays it, and
// only in full motion. The colours are written out here and not taken from the
// theme, because a tree should stay green whatever theme is on. The accent
// colours of the screen's own text are in themes/overlays/christmas.css.
//
// Every shape is flat polygons with hard edges, in the faceted style of the
// logo. There is no blur, no glow, no shadow and no gradient.

const snow = '#f4f7ff';
const snowMid = '#c9d6f2';
const snowFar = '#8fa3d6';
const treeLit = '#2f9e63';
const treeShade = '#1f7a4a';
const red = '#e0443e';
const redShade = '#a82a27';
const gold = '#f4c552';
const goldShade = '#c99a2e';
const blue = '#5b9bf0';
const brown = '#7a5233';
const wire = '#3f8f63';
const cap = '#2d4a3a';

// The bulbs take these colours in turn
const bulbColours = ['#ff5a52', '#ffd05a', '#6fe39a', '#6aa8ff'];


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

// An octagon, the faceted stand-in for a circle, with its right half in shade
function ball(cx, cy, r, lit, shade) {
  const s = r * 0.38;
  const whole = [[cx - s, cy - r], [cx + s, cy - r], [cx + r, cy - s], [cx + r, cy + s], [cx + s, cy + r], [cx - s, cy + r], [cx - r, cy + s], [cx - r, cy - s]];
  const half = [[cx, cy - r], [cx + s, cy - r], [cx + r, cy - s], [cx + r, cy + s], [cx + s, cy + r], [cx, cy + r]];
  return shape(whole, lit) + shape(half, shade);
}


// A string of lights hung in swags along a strip. The wire and the little caps
// are still. The bulbs are shared out in groups, and each group is a shape of
// its own so the pieces can twinkle one after another. Returns the wire shape
// and one bulb shape for each group.
//   width, height  the size of the strip
//   swags          how many dips along the strip
//   base           how far down the wire hangs from its two ends
//   sag            how much further the middle of a swag dips
//   scale          1 for the top strip, smaller for the thin ones
//   groups         how many groups of bulbs
function lightString(width, height, swags, base, sag, scale, groups) {
  const box = '0 0 ' + width + ' ' + height;
  const length = width / swags;
  const points = [];
  const caps = [];
  const bulbs = [];
  for (let group = 0; group < groups; group++) bulbs.push('');

  for (let swag = 0; swag < swags; swag++) {
    for (let step = 0; step <= 8; step++) {
      const t = step / 8;
      points.push(round(swag * length + t * length) + ',' + round(base + sag * Math.sin(Math.PI * t)));
    }

    for (let k = 1; k <= 3; k++) {
      const t = k / 4;
      const x = swag * length + t * length;
      const y = base + sag * Math.sin(Math.PI * t);
      const n = swag * 3 + (k - 1);
      const a = 1.6 * scale; // half the width of the cap
      const b = 3.2 * scale; // half the width of the bulb

      caps.push(shape([[x - a, y], [x + a, y], [x + a, y + 2 * scale], [x - a, y + 2 * scale]], cap));
      bulbs[n % groups] += shape([[x - b, y + 2 * scale], [x + b, y + 2 * scale], [x + b, y + 6 * scale], [x, y + 9.5 * scale], [x - b, y + 6 * scale]], bulbColours[n % bulbColours.length]);
    }
  }

  const line = '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + wire + '" stroke-width="' + round(1.5 * scale) + '"/>';
  return {
    wire: { viewBox: box, markup: line + caps.join('') },
    bulbs: bulbs.map(markup => ({ viewBox: box, markup: markup })),
  };
}

const topLights = lightString(1920, 26, 12, 2, 9, 1, 3);
const stringA = lightString(836, 14, 8, 1, 3, 0.7, 2);
const stringB = lightString(654, 14, 6, 1, 3, 0.7, 2);


// The scene along the bottom edge. It is 1920 wide and 26 high, and its y runs
// from -4 (the top edge of the strip) to 22 (the bottom of the screen), so the
// ground is at the bottom and the trees have 4 px of headroom. Left of x 270
// the ticker's tag comes within 12 px of the top, so there (y under 8) the hills
// stay low and nothing stands on them.

// A hilltop edge made of straight facets: one point every step pixels, with a
// height that rolls between the limits. low is the lowest the top may be for
// x under 270.
function hill(fill, middle, swing, step, phase, low) {
  const pairs = [[0, 22]];
  for (let x = 0; x <= 1920; x += step) {
    const y = middle + swing * Math.sin(x / 137 + phase) + swing * 0.6 * Math.sin(x / 47 + phase * 2);
    pairs.push([x, x < 270 ? Math.max(y, low) : y]);
  }
  pairs.push([1920, 22]);
  return shape(pairs, fill);
}

// A tree standing on y 18: two tiers, the left half of each lit and the right half in shade
function tree(x, height) {
  const w = height * 0.36;
  const top = 18 - height;
  const lowerTop = 18 - height * 0.62;
  const upperBase = 18 - height * 0.4;
  const u = w * 0.7;

  return shape([[x - 1.5, 16], [x + 1.5, 16], [x + 1.5, 20], [x - 1.5, 20]], brown) +
    shape([[x - w, 18], [x, 18], [x, lowerTop]], treeLit) +
    shape([[x, 18], [x + w, 18], [x, lowerTop]], treeShade) +
    shape([[x - u, upperBase], [x, upperBase], [x, top]], treeLit) +
    shape([[x, upperBase], [x + u, upperBase], [x, top]], treeShade) +
    shape([[x - 1.3, top + 3], [x + 1.3, top + 3], [x, top]], snow);
}

// Small dark trees on the far hill, to fill the gaps between the big ones. They
// stand on y 16, and their places come from a sum so nobody has to type them.
function farTrees() {
  let markup = '';
  for (let i = 0; i < 40; i++) {
    const x = 284 + i * 41 + (i * i * 7) % 17;
    const h = 9 + (i * 5) % 4;
    markup += shape([[x - h * 0.34, 16], [x, 16], [x, 16 - h]], '#237a4d') + shape([[x, 16], [x + h * 0.34, 16], [x, 16 - h]], '#1a5d3b');
  }
  return markup;
}

// A wrapped present standing on y 20, with a ribbon and a bow
function present(x, size, boxColour, ribbon) {
  const top = 20 - size;
  const mid = x + size / 2;
  return shape([[x, top], [x + size, top], [x + size, 20], [x, 20]], boxColour) +
    shape([[mid - 0.7, top], [mid + 0.7, top], [mid + 0.7, 20], [mid - 0.7, 20]], ribbon) +
    shape([[mid - 2.6, top - 2.2], [mid - 0.3, top - 2.2], [mid, top], [mid - 2.6, top]], ribbon) +
    shape([[mid + 0.3, top - 2.2], [mid + 2.6, top - 2.2], [mid + 2.6, top], [mid, top]], ribbon);
}

// A snowman standing on y 20: three balls, a scarf and a nose
function snowman(x) {
  const k = 1.2; // how much bigger than the first drawing
  const up = y => 20 - (20 - y) * k; // a height above the feet, scaled
  const wide = n => n * k;

  return ball(x, up(17.2), wide(3.6), snow, snowMid) +
    ball(x, up(10.8), wide(2.8), snow, snowMid) +
    ball(x, up(5.6), wide(2.1), snow, snowMid) +
    shape([[x - wide(2.8), up(9)], [x + wide(2.8), up(9)], [x + wide(2.8), up(7.6)], [x - wide(2.8), up(7.6)]], red) +
    shape([[x + wide(1.4), up(9)], [x + wide(2.8), up(9)], [x + wide(2.8), up(12)], [x + wide(1.4), up(12)]], redShade) +
    shape([[x, up(6.6)], [x + wide(3.4), up(6)], [x, up(5.4)]], '#f09a3e') +
    shape([[x - wide(1.2), up(5.4)], [x - wide(0.4), up(5.4)], [x - wide(0.4), up(4.6)], [x - wide(1.2), up(4.6)]], '#2a2f45');
}

// A lamp post standing on y 20. The glass is dull here. The lit glass is a piece
// of its own (the lamps shape below), which twinkles.
function lamp(x) {
  return shape([[x - 0.8, 4], [x + 0.8, 4], [x + 0.8, 21], [x - 0.8, 21]], '#7f8fb0') +
    shape([[x - 3.4, -2.4], [x + 3.4, -2.4], [x + 4.4, -0.8], [x + 4.4, 4], [x - 4.4, 4], [x - 4.4, -0.8]], '#4b5877') +
    shape([[x - 2.6, -1], [x + 2.6, -1], [x + 2.6, 2.8], [x - 2.6, 2.8]], '#7a6a3e');
}

// The lit glass of the lamps, as one shape as wide as the scene
function lampLight(xs) {
  return xs.map(x => shape([[x - 2.6, -1], [x + 2.6, -1], [x + 2.6, 2.8], [x - 2.6, 2.8]], '#ffe9a0')).join('');
}

// x of the middle and the height of each tree
const trees = [
  [312, 18], [346, 13], [388, 21], [560, 16], [592, 19], [700, 14], [734, 18], [770, 13],
  [1110, 19], [1146, 14], [1290, 16], [1326, 21], [1364, 14], [1560, 18], [1596, 13],
  [1700, 17], [1736, 21], [1774, 14], [1860, 18], [1896, 13],
];

// x of the left side, the size, the colour of the box and the colour of the ribbon
const presents = [
  [470, 8, red, gold], [482, 6, blue, snow], [494, 7, gold, red],
  [908, 8, blue, gold], [920, 6, red, snow],
  [1440, 8, gold, red], [1452, 6, blue, gold], [1660, 7, red, gold],
];

const lamps = [425, 1500];
const snowmen = [1010];

const sceneMarkup =
  hill(snowFar, 13, 2, 48, 0, 11.5) +
  farTrees() +
  trees.map(item => tree(item[0], item[1])).join('') +
  hill(snowMid, 16.2, 1.4, 40, 1, 12.5) +
  presents.map(item => present(item[0], item[1], item[2], item[3])).join('') +
  snowmen.map(snowman).join('') +
  lamps.map(lamp).join('') +
  hill(snow, 19.2, 0.8, 32, 2, 17.5);


// The mark: a fir tree, 60 by 76, which is the biggest a mark may be (markBox in
// core/marks.js). Three tiers, each lit on the left and in shade on the right,
// with a darker band under each tier so the tiers read as separate. The star is
// the accent colour of the screen: shapes inside <g class="double-slash"> are
// painted by base.css with --yellow, which the Christmas overlay makes mint, so
// the star follows the colours of the pack. The greens and the red are fixed.

const markLit = '#43c47c';
const markShade = '#2a9a5e';
const markBand = '#1f7a4a';
const markTrunk = '#8a5a36';

// One tier of the tree: a triangle from the apex (its top, a y) down to the base
// (a y), reaching half pixels left and right of the middle at x 30, with its
// darker band along the bottom
function tier(apex, base, half) {
  const edgeAt = y => half * (y - apex) / (base - apex); // how far the slanting side is from the middle at height y
  const band = base - 5;
  return shape([[30, apex], [30, base], [30 - half, base]], markLit) +
    shape([[30, apex], [30 + half, base], [30, base]], markShade) +
    shape([[30 - edgeAt(band), band], [30 + edgeAt(band), band], [30 + half, base], [30 - half, base]], markBand);
}

// A small faceted bauble: a diamond, lit on the left and in shade on the right
function bauble(x, y) {
  const r = 4.4;
  return shape([[x, y - r], [x, y + r], [x - r, y]], red) + shape([[x, y - r], [x + r, y], [x, y + r]], redShade);
}

const treeMarkup =
  shape([[25, 68], [35, 68], [35, 76], [25, 76]], markTrunk) +
  tier(38, 68, 28) +
  tier(24, 52, 21) +
  tier(12, 34, 14) +
  bauble(29, 27) + bauble(39, 44) + bauble(20, 60) +
  '<g class="double-slash"><polygon points="30,0 32.2,4.8 37,7 32.2,9.2 30,14 27.8,9.2 23,7 27.8,4.8"/></g>';

const mark = { viewBox: '0 0 60 76', markup: treeMarkup };


// The shapes the pieces use, each drawn once

// A snowflake: three bars crossing at 60 degrees, with a small hexagon in the middle
const snowflakeMarkup = (function () {
  const bar = [[-13, 0], [-10, -3], [10, -3], [13, 0], [10, 3], [-10, 3]];
  const turned = degrees => {
    const a = degrees * Math.PI / 180;
    return bar.map(point => [14 + point[0] * Math.cos(a) - point[1] * Math.sin(a), 14 + point[0] * Math.sin(a) + point[1] * Math.cos(a)]);
  };
  const middle = [0, 1, 2, 3, 4, 5].map(i => [14 + 5.2 * Math.cos(i * Math.PI / 3), 14 + 5.2 * Math.sin(i * Math.PI / 3)]);
  return shape(turned(0), snow) + shape(turned(60), snow) + shape(turned(120), snow) + shape(middle, snowMid);
}());

const snowflake = { viewBox: '0 0 28 28', markup: snowflakeMarkup };

// A gold star
const star = {
  viewBox: '0 0 14 14',
  markup: polygon('7,0 8.9,5.1 14,7 8.9,8.9 7,14 5.1,8.9 0,7 5.1,5.1', gold) +
    polygon('7,3.4 8.2,5.8 10.6,7 8.2,8.2 7,10.6 5.8,8.2 3.4,7 5.8,5.8', '#ffe8a3'),
};

// A bell on a red ribbon, hung from the top of its zone
const bell = {
  viewBox: '0 0 22 28',
  markup: shape([[9.5, 0], [12.5, 0], [12.5, 4], [9.5, 4]], red) +
    shape([[8, 4], [14, 4], [15, 7], [7, 7]], gold) +
    shape([[11, 7], [7, 7], [5, 13], [3, 19], [1, 23], [11, 23]], gold) +
    shape([[11, 7], [15, 7], [17, 13], [19, 19], [21, 23], [11, 23]], goldShade) +
    shape([[1, 23], [21, 23], [21, 25], [1, 25]], '#e0b040') +
    shape([[9.2, 25], [12.8, 25], [14, 26.5], [12.8, 28], [9.2, 28], [8, 26.5]], red),
};

// A sprig of holly: two spiky leaves, each lit on top and in shade below, and three berries
const leafTop = [[0, 0], [4, -4], [7, -3], [10, -6], [13, -4], [17, -6], [20, -3], [24, -2], [28, 0]];
const leafBottom = [[0, 0], [4, 4], [7, 3], [10, 6], [13, 4], [17, 6], [20, 3], [24, 2], [28, 0]];

function leaf(transform) {
  return '<g transform="' + transform + '">' + shape(leafTop, treeLit) + shape(leafBottom, treeShade) + '</g>';
}

const holly = {
  viewBox: '0 0 72 28',
  markup: leaf('translate(35 14) rotate(190) scale(1.1)') +
    leaf('translate(37 14) rotate(-10) scale(1.1)') +
    ball(33, 16.5, 3.2, red, redShade) + ball(39, 16.5, 3.2, red, redShade) + ball(36, 11.8, 3.2, red, redShade),
};

const shapes = {
  'snowflake': snowflake,
  'star': star,
  'bell': bell,
  'holly': holly,
  'wire-top': topLights.wire,
  'lights-top-0': topLights.bulbs[0],
  'lights-top-1': topLights.bulbs[1],
  'lights-top-2': topLights.bulbs[2],
  'wire-a': stringA.wire,
  'lights-a-0': stringA.bulbs[0],
  'lights-a-1': stringA.bulbs[1],
  'wire-b': stringB.wire,
  'lights-b-0': stringB.bulbs[0],
  'lights-b-1': stringB.bulbs[1],
  'lamps': { viewBox: '0 -4 1920 26', markup: lampLight(lamps) },
};


// The pack. A piece is
//   shape    which of the shapes above
//   x, y     where its top left corner rests, in pixels. In the back and over
//            layers these are screen pixels, and the middle of the path of a
//            travelling piece. In the front layer they are measured from the
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

  // The corner art a rule gets when it picks none of its own (core/corner-art.js)
  defaults: { cornerArt: 'snowflakes' },

  // Snow over the panels: twelve flakes of three sizes (22, 32 and 44), each
  // falling and swaying on its own slow round. A flake takes 24 to 52 seconds to
  // cross the screen, so it is only over a letter for a moment, and it is faint
  // enough (opacity .7 to .85) that a word shows through it. The big ones are
  // the faintest and fall fastest, the small ones are the clearest and slowest,
  // which gives the snow some depth. The delays are spread (golden ratio steps
  // round each flake's own round) so the first screen already has flakes at every
  // height. This layer carries all of the snow: none falls behind the panels or
  // in the margins, because a pack may only move about 24 pieces in all.
  over: [
    { shape: 'snowflake', x: 70, y: 529, size: 22, opacity: 0.85, motion: 'flutter', seconds: 44, delay: -3.1, travel: 1300 },
    { shape: 'snowflake', x: 235, y: 518, size: 44, opacity: 0.7, motion: 'flutter', seconds: 24, delay: -16.5, travel: 1300 },
    { shape: 'snowflake', x: 390, y: 524, size: 32, opacity: 0.78, motion: 'flutter', seconds: 34, delay: -10.4, travel: 1300 },
    { shape: 'snowflake', x: 575, y: 529, size: 22, opacity: 0.85, motion: 'flutter', seconds: 50, delay: -46.2, travel: 1300 },
    { shape: 'snowflake', x: 735, y: 524, size: 32, opacity: 0.78, motion: 'flutter', seconds: 38, delay: -20.6, travel: 1300 },
    { shape: 'snowflake', x: 905, y: 518, size: 44, opacity: 0.7, motion: 'flutter', seconds: 28, delay: -4.5, travel: 1300 },
    { shape: 'snowflake', x: 1075, y: 529, size: 22, opacity: 0.85, motion: 'flutter', seconds: 46, delay: -35.8, travel: 1300 },
    { shape: 'snowflake', x: 1245, y: 524, size: 32, opacity: 0.78, motion: 'flutter', seconds: 32, delay: -12.7, travel: 1300 },
    { shape: 'snowflake', x: 1395, y: 518, size: 44, opacity: 0.7, motion: 'flutter', seconds: 26, delay: -9.8, travel: 1300 },
    { shape: 'snowflake', x: 1565, y: 529, size: 22, opacity: 0.85, motion: 'flutter', seconds: 52, delay: -32.9, travel: 1300 },
    { shape: 'snowflake', x: 1715, y: 524, size: 32, opacity: 0.78, motion: 'flutter', seconds: 36, delay: -9, travel: 1300 },
    { shape: 'snowflake', x: 1850, y: 518, size: 44, opacity: 0.7, motion: 'flutter', seconds: 30, delay: -26.1, travel: 1300 },
  ],

  front: [
    // The lit string along the top edge: the wire stays, and the three groups of
    // bulbs twinkle one after another
    { zone: 'top', shape: 'wire-top', x: 0, y: 0, size: 1920 },
    { zone: 'top', shape: 'lights-top-0', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 3.6, delay: 0 },
    { zone: 'top', shape: 'lights-top-1', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 3.6, delay: -1.2 },
    { zone: 'top', shape: 'lights-top-2', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 3.6, delay: -2.4 },

    // Two thinner strings in the gap above the ticker
    { zone: 'string-a', shape: 'wire-a', x: 0, y: 0, size: 836 },
    { zone: 'string-a', shape: 'lights-a-0', x: 0, y: 0, size: 836, motion: 'twinkle', seconds: 3, delay: 0 },
    { zone: 'string-a', shape: 'lights-a-1', x: 0, y: 0, size: 836, motion: 'twinkle', seconds: 3, delay: -1.5 },
    { zone: 'string-b', shape: 'wire-b', x: 0, y: 0, size: 654 },
    { zone: 'string-b', shape: 'lights-b-0', x: 0, y: 0, size: 654, motion: 'twinkle', seconds: 3, delay: -0.7 },
    { zone: 'string-b', shape: 'lights-b-1', x: 0, y: 0, size: 654, motion: 'twinkle', seconds: 3, delay: -2.2 },

    // Holly in the cut corner of the large panel, with a star that swells
    { zone: 'corner-a', shape: 'holly', x: 4, y: 0, size: 72 },
    { zone: 'corner-a', shape: 'star', x: 78, y: 7, size: 14, motion: 'pulse', seconds: 4, delay: -1 },

    // A bell that swings in the cut corner of the countdown
    { zone: 'corner-b', shape: 'bell', x: 15, y: 0, size: 22, motion: 'sway', seconds: 5, delay: -1.5 },

    // The glass of the lamp posts in the scene, lit
    { zone: 'ground', shape: 'lamps', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 6, delay: -2 },
  ],
};
