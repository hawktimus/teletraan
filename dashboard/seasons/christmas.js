// The Christmas pack. It is the model for the other packs: copy this file, keep
// the shape of it, and change the pictures, the places and the numbers.
// docs/seasonal-packs.md explains every part.
//
// What it draws, in the empty places of the screen:
//   - snow falling behind the panels (back) and down the margins (front)
//   - a lit string along the top edge, and two more in the gap above the ticker
//   - holly in one cut corner and a bell in the other
//   - a snowy scene along the bottom edge: hills, trees, presents, a snowman and
//     two lamp posts
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


// The scene along the bottom edge. It is 1920 wide and 22 high. Left of x 270
// the ticker's tag comes within 8 px of its top, so there the hills stay low and
// nothing stands on them.

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
    const h = 8 + (i * 5) % 4;
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
  return ball(x, 17.2, 3.6, snow, snowMid) +
    ball(x, 10.8, 2.8, snow, snowMid) +
    ball(x, 5.6, 2.1, snow, snowMid) +
    shape([[x - 2.8, 7.6], [x + 2.8, 7.6], [x + 2.8, 9], [x - 2.8, 9]], red) +
    shape([[x + 1.4, 9], [x + 2.8, 9], [x + 2.8, 12], [x + 1.4, 12]], redShade) +
    shape([[x, 5.4], [x + 3.4, 6], [x, 6.6]], '#f09a3e') +
    shape([[x - 1.2, 4.6], [x - 0.4, 4.6], [x - 0.4, 5.4], [x - 1.2, 5.4]], '#2a2f45');
}

// A lamp post standing on y 20. The glass is dull here. The lit glass is a piece
// of its own (the lamps shape below), which twinkles.
function lamp(x) {
  return shape([[x - 0.8, 7], [x + 0.8, 7], [x + 0.8, 21], [x - 0.8, 21]], '#7f8fb0') +
    shape([[x - 3.4, 0.6], [x + 3.4, 0.6], [x + 4.4, 2.2], [x + 4.4, 7], [x - 4.4, 7], [x - 4.4, 2.2]], '#4b5877') +
    shape([[x - 2.6, 2], [x + 2.6, 2], [x + 2.6, 5.8], [x - 2.6, 5.8]], '#7a6a3e');
}

// The lit glass of the lamps, as one shape as wide as the scene
function lampLight(xs) {
  return xs.map(x => shape([[x - 2.6, 2], [x + 2.6, 2], [x + 2.6, 5.8], [x - 2.6, 5.8]], '#ffe9a0')).join('');
}

// x of the middle and the height of each tree
const trees = [
  [312, 15], [346, 11], [388, 17], [560, 13], [592, 16], [700, 12], [734, 15], [770, 11],
  [1110, 16], [1146, 12], [1290, 13], [1326, 17], [1364, 12], [1560, 15], [1596, 11],
  [1700, 14], [1736, 17], [1774, 12], [1860, 15], [1896, 11],
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


// The shapes the pieces use, each drawn once

// A snowflake, a four pointed star, and a plainer one for the thin places
const flake = {
  viewBox: '0 0 24 24',
  markup: polygon('12,0 14.6,9.4 24,12 14.6,14.6 12,24 9.4,14.6 0,12 9.4,9.4', snow),
};

const flakeDot = {
  viewBox: '0 0 16 16',
  markup: polygon('5,0 11,0 16,5 16,11 11,16 5,16 0,11 0,5', '#dfe8ff'),
};

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
  'flake': flake,
  'flake-dot': flakeDot,
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
  'lamps': { viewBox: '0 0 1920 22', markup: lampLight(lamps) },
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

  // 1920 wide and 22 high. Drawn in the "ground" zone along the bottom edge.
  scene: { viewBox: '0 0 1920 22', markup: sceneMarkup },

  // Snow drifting down behind the panels. It is seen in the gaps between them
  // and in the margins. Slow and faint, so it never competes with the text.
  back: [
    { shape: 'flake', x: 160, y: 140, size: 26, opacity: 0.5, motion: 'fall', seconds: 46, delay: -12, travel: 1500 },
    { shape: 'flake-dot', x: 420, y: 700, size: 16, opacity: 0.5, motion: 'fall', seconds: 38, delay: -30, travel: 1400 },
    { shape: 'flake', x: 760, y: 360, size: 20, opacity: 0.45, motion: 'fall', seconds: 52, delay: -5, travel: 1500 },
    { shape: 'flake', x: 1010, y: 880, size: 28, opacity: 0.5, motion: 'fall', seconds: 44, delay: -22, travel: 1500 },
    { shape: 'flake-dot', x: 1330, y: 240, size: 14, opacity: 0.55, motion: 'fall', seconds: 36, delay: -16, travel: 1400 },
    { shape: 'flake', x: 1620, y: 560, size: 22, opacity: 0.45, motion: 'fall', seconds: 50, delay: -40, travel: 1500 },
    { shape: 'flake', x: 1790, y: 900, size: 18, opacity: 0.5, motion: 'fall', seconds: 42, delay: -8, travel: 1500 },
  ],

  front: [
    // Snow down the margins and the gap between the two columns
    { zone: 'left', shape: 'flake-dot', x: 8, y: 110, size: 12, motion: 'fall', seconds: 20, delay: -4, travel: 800 },
    { zone: 'left', shape: 'flake', x: 4, y: 360, size: 16, motion: 'fall', seconds: 26, delay: -15, travel: 800 },
    { zone: 'left', shape: 'flake-dot', x: 12, y: 580, size: 10, motion: 'fall', seconds: 17, delay: -9, travel: 800 },
    { zone: 'right', shape: 'flake', x: 6, y: 150, size: 16, motion: 'fall', seconds: 24, delay: -3, travel: 900 },
    { zone: 'right', shape: 'flake-dot', x: 12, y: 430, size: 12, motion: 'fall', seconds: 19, delay: -12, travel: 900 },
    { zone: 'right', shape: 'flake', x: 8, y: 690, size: 14, motion: 'fall', seconds: 28, delay: -20, travel: 900 },
    { zone: 'gutter', shape: 'flake-dot', x: 4, y: 150, size: 10, motion: 'fall', seconds: 16, delay: -6, travel: 420 },

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
