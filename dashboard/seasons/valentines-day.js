// The Valentine's Day pack. It follows christmas.js, the model for every pack:
// docs/seasonal-packs.md explains each part.
//
// What it draws:
//   - a heart with an arrow through it in place of the slashes at the right of
//     every panel header (mark)
//   - faceted hearts and love letters that rise across the whole screen over the
//     panels, and two small hearts in the margins that twinkle (over)
//   - in the empty places: a garland of hearts hung along the top edge, and small
//     ones in the gap above the ticker
//   - a ribbon along the bottom edge with hearts tucked into it and three bows.
//     Two arrows fly across it now and then, and two hearts beat
//   - a heart with an arrow through it in one cut corner, and a bow that swings in
//     the other
//
// The pack is data. It holds no keyframes and no animation code: a piece names a
// motion ('rise', 'pulse', 'sweep'...) and seasons/motion.css plays it, and only
// in full motion. In calm and none motion the beating hearts rest where their x and
// y put them, the arrows stay put in the middle of their paths, and the over layer
// is not drawn at all. The colours of the screen's own text are in
// themes/overlays/valentines-day.css.
//
// Every shape is flat polygons with hard edges, in the faceted style of the logo.
// There is no blur, no glow, no shadow and no gradient. There is no text.

// Each heart tone is a lit left half, a shaded right half and a small bright facet
const pink = { lit: '#ff7aa5', shade: '#d63a68', light: '#ffc2d6' };
const red = { lit: '#f4527a', shade: '#c42a50', light: '#ff9ab0' };
const pale = { lit: '#ffc2d6', shade: '#ea8fb0', light: '#fff1f6' };
const coral = { lit: '#ff8c7c', shade: '#d4574f', light: '#ffc2b8' };
const tones = [pink, red, pale, coral];

const ribbonLit = '#c93565';
const ribbonShade = '#9d2650';
const ribbonEdge = '#ff8fb3';
const thread = '#e08aa6';
const cream = '#fff1e0';
const creamShade = '#d8c3a6';


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

// A heart on a grid 24 wide and 22 high, with its point at the bottom: two lobes
// and a point, cut in half down the middle, with a bright facet on the left lobe
function heart(tone) {
  return shape([[12, 22], [0.5, 10.5], [0.5, 6], [4.5, 0.8], [9, 0.8], [12, 4.5]], tone.lit) +
    shape([[12, 22], [12, 4.5], [15, 0.8], [19.5, 0.8], [23.5, 6], [23.5, 10.5]], tone.shade) +
    shape([[3, 6.5], [5.5, 3.2], [8, 3.2], [6.2, 7]], tone.light);
}

// A heart hanging with its top edge at y, centred on x, this wide
function hungHeart(x, y, width, tone) {
  return '<g transform="translate(' + round(x - width / 2) + ' ' + round(y) + ') scale(' + (width / 24).toFixed(3) + ')">' + heart(tone) + '</g>';
}

// A heart standing on its point at (x, y), this wide, leaning by tilt degrees
function standingHeart(x, y, width, tilt, tone) {
  return '<g transform="translate(' + round(x) + ' ' + round(y) + ') rotate(' + tilt + ') scale(' + (width / 24).toFixed(3) + ') translate(-12 -22)">' + heart(tone) + '</g>';
}

// A bow with two loops, a knot and two tails. Its knot is at (cx, cy) and it is 26
// wide. Each loop has a lit outer part and a shaded inner part.
function bow(cx, cy, lit, shade) {
  const left = [[cx - 2, cy - 2.5], [cx - 13, cy - 8], [cx - 13, cy + 5], [cx - 2, cy + 2.5]];
  const right = [[cx + 2, cy - 2.5], [cx + 13, cy - 8], [cx + 13, cy + 5], [cx + 2, cy + 2.5]];
  return shape(left, lit) +
    shape([[cx - 2, cy - 2.5], [cx - 7, cy - 5], [cx - 7, cy + 3.5], [cx - 2, cy + 2.5]], shade) +
    shape(right, shade) +
    shape([[cx + 2, cy - 2.5], [cx + 7, cy - 5], [cx + 7, cy + 3.5], [cx + 2, cy + 2.5]], lit) +
    shape([[cx - 2.5, cy + 2], [cx, cy + 2], [cx - 4.5, cy + 12], [cx - 7, cy + 11]], lit) +
    shape([[cx, cy + 2], [cx + 2.5, cy + 2], [cx + 7, cy + 11], [cx + 4.5, cy + 12]], shade) +
    shape([[cx - 3, cy - 3.2], [cx + 3, cy - 3.2], [cx + 3, cy + 3.2], [cx - 3, cy + 3.2]], lit) +
    shape([[cx, cy - 3.2], [cx + 3, cy - 3.2], [cx + 3, cy + 3.2], [cx, cy + 3.2]], shade);
}


// A string of hearts hung in swags along a strip: a thin line, and a heart every few steps
//   width, height  the size of the strip
//   swags          how many dips along the strip
//   base, sag      how far down the line hangs from its two ends, and how much further the middle dips
//   perSwag        hearts in each swag
//   size           how wide each heart is
function heartString(width, height, swags, base, sag, perSwag, size) {
  const length = width / swags;
  const points = [];
  let hearts = '';

  for (let swag = 0; swag < swags; swag++) {
    for (let step = 0; step <= 8; step++) {
      const t = step / 8;
      points.push(round(swag * length + t * length) + ',' + round(base + sag * Math.sin(Math.PI * t)));
    }
    for (let k = 1; k <= perSwag; k++) {
      const t = k / (perSwag + 1);
      const y = base + sag * Math.sin(Math.PI * t);
      hearts += hungHeart(swag * length + t * length, y + 0.5, size, tones[(swag * perSwag + k) % tones.length]);
    }
  }

  const line = '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + thread + '" stroke-width="1.2"/>';
  return { viewBox: '0 0 ' + width + ' ' + height, markup: line + hearts };
}


// The scene along the bottom edge. It is 1920 wide and 26 high, and its y runs from
// -4 (the top edge of the strip) to 22 (the bottom of the screen). A ribbon runs
// along the bottom and hearts are tucked into it. Left of x 270 the ticker's tag
// comes within 12 px of the top, so there (y under 12) nothing stands up from the
// ribbon.

// The ribbon: folds that lean one way, a lit one then a shaded one, under a bright edge
function ribbon() {
  let markup = '';
  for (let x = -4; x < 1920; x += 36) {
    markup += shape([[x, 16], [x + 18, 16], [x + 14, 22], [x - 4, 22]], ribbonLit) +
      shape([[x + 18, 16], [x + 36, 16], [x + 32, 22], [x + 14, 22]], ribbonShade);
  }
  return markup + shape([[0, 16], [1920, 16], [1920, 17.4], [0, 17.4]], ribbonEdge);
}

// Where the two beating hearts are. No heart is tucked in there.
const beatingHearts = [860, 1500];

// Hearts tucked into the ribbon, one every 37 px or so, from x 280 on. Their widths,
// leans and colours come from sums, so nobody has to type forty hearts. The ribbon
// is drawn after them, so it covers their points.
function tuckedHearts() {
  let markup = '';
  for (let i = 0; i < 44; i++) {
    const x = 284 + i * 37 + (i * i * 5) % 11;
    if (beatingHearts.some(beating => Math.abs(x - beating) < 22)) continue;

    const width = 13 + (i * 5) % 7;
    const lean = ((i * 7) % 5 - 2) * 6;
    markup += standingHeart(x, 19, width, lean, tones[(i * 3) % tones.length]);
  }
  return markup;
}

// Three bows on the ribbon, their knots at these x
const bows = [470, 1050, 1640];

const sceneMarkup =
  tuckedHearts() +
  ribbon() +
  bows.map(x => bow(x, 12, tones[0].lit, tones[0].shade)).join('');


// The mark: a heart with an arrow through it, 60 by 76, which is the biggest a mark
// may be (markBox in core/marks.js). The heart is cut into four facets that go from
// light at the upper left to dark at the lower right, and a bright facet on the left
// lobe takes the accent colour of the screen: shapes inside <g class="double-slash">
// are painted by base.css with --yellow, which the Valentine's overlay makes pink.
// The arrow is drawn first and the heart over it, so it seems to go in at the lower
// left and come out at the upper right: gold head, cream shaft, pale feathers.

const markLightest = '#ff93b2';
const markLit = '#ff5a82';
const markShade = '#ee4270';
const markDarkest = '#bf2a55';

// The heart on the grid of the heart shape above (24 wide, 22 high), made bigger
function markHeart() {
  const upperLeft = [[12, 4.5], [9, 0.8], [4.5, 0.8], [0.5, 6], [12, 11.5]];
  const lowerLeft = [[0.5, 6], [0.5, 10.5], [12, 22], [12, 11.5]];
  const upperRight = [[12, 4.5], [15, 0.8], [19.5, 0.8], [23.5, 6], [12, 11.5]];
  const lowerRight = [[23.5, 6], [23.5, 10.5], [12, 22], [12, 11.5]];

  return '<g transform="translate(2.4 17) scale(2.3)">' +
    shape(upperLeft, markLightest) + shape(lowerLeft, markLit) + shape(upperRight, markShade) + shape(lowerRight, markDarkest) +
    '<g class="double-slash"><polygon points="3.2,6.4 5.6,3.2 8.2,3.2 6.6,6.8"/></g>' +
    '</g>';
}

// The arrow. It is drawn lying along a line (x runs along the shaft from the tail
// to the point, y across it) and turned about a point near the middle of the heart,
// so that it climbs to the upper right. All of it stays inside the 60 by 76 box.
const arrowTurn = -50 * Math.PI / 180;

function arrowPoint(x, y) {
  return [31 + x * Math.cos(arrowTurn) - y * Math.sin(arrowTurn), 40 + x * Math.sin(arrowTurn) + y * Math.cos(arrowTurn)];
}

function arrowPart(pairs, fill) {
  return shape(pairs.map(pair => arrowPoint(pair[0], pair[1])), fill);
}

function markArrow() {
  return arrowPart([[-36, -2], [41, -2], [41, 0], [-36, 0]], cream) +
    arrowPart([[-36, 0], [41, 0], [41, 2], [-36, 2]], creamShade) +
    arrowPart([[-36, -7.5], [-29, -7.5], [-23, -2], [-30, -2]], pale.lit) +
    arrowPart([[-30, 2], [-23, 2], [-29, 7.5], [-36, 7.5]], pink.lit) +
    arrowPart([[26, -7], [41, 0], [31, 0]], '#ffe08a') +
    arrowPart([[31, 0], [41, 0], [26, 7]], '#e0a830');
}

const mark = { viewBox: '0 0 60 76', markup: markArrow() + markHeart() };


// The arrow that flies along the bottom: a cream shaft, feathers on the left and a
// red head on the right. 90 wide and 12 high.
const arrow = {
  viewBox: '0 0 90 12',
  markup: shape([[8, 5], [80, 5], [80, 6], [8, 6]], cream) +
    shape([[8, 6], [80, 6], [80, 7], [8, 7]], creamShade) +
    shape([[80, 1], [90, 6], [80, 6]], red.lit) +
    shape([[80, 6], [90, 6], [80, 11]], red.shade) +
    shape([[0, 1], [6, 1], [10, 6], [4, 6]], pale.lit) +
    shape([[4, 6], [10, 6], [6, 11], [0, 11]], pink.lit),
};

// The arrow through the heart, in the cut corner of the large panel. The arrow
// leans up to the right, and the heart that beats is laid over its middle: it is a
// piece of its own (heart-pink).
const arrowThrough = {
  viewBox: '0 0 96 28',
  markup: '<g transform="rotate(-8 48 14)">' +
    shape([[4, 13], [90, 13], [90, 14], [4, 14]], cream) +
    shape([[4, 14], [90, 14], [90, 15], [4, 15]], creamShade) +
    shape([[88, 9.5], [96, 14], [88, 14]], red.lit) +
    shape([[88, 14], [96, 14], [88, 18.5]], red.shade) +
    shape([[0, 9], [6, 9], [10, 14], [4, 14]], pale.lit) +
    shape([[4, 14], [10, 14], [6, 19], [0, 19]], pink.lit) +
    '</g>',
};

// A bow that hangs from a ribbon, in the cut corner of the countdown. The shape
// is 26 wide and 30 high, and the "sway" motion swings it about the top edge.
const hangingBow = {
  viewBox: '0 0 26 30',
  markup: shape([[12.2, 0], [13.8, 0], [13.8, 8], [12.2, 8]], thread) + bow(13, 12, pink.lit, pink.shade),
};

// A love letter for the over layer, 40 wide and 28 high: a pink envelope whose flap
// comes to a point, with a fold along each side and the bottom, and a red heart for
// a seal. It is pink and not cream so that it does not look grey over a dark panel.
const letter = {
  viewBox: '0 0 40 28',
  markup: shape([[0, 0], [40, 0], [40, 28], [0, 28]], '#ffd3e0') +
    shape([[0, 0], [20, 16], [0, 28]], '#ffb3c8') +
    shape([[40, 0], [40, 28], [20, 16]], '#f58aa8') +
    shape([[0, 28], [20, 16], [40, 28]], '#ff9ebb') +
    shape([[0, 0], [20, 0], [20, 17]], '#ffe3ec') +
    shape([[20, 0], [40, 0], [20, 17]], '#ffc2d6') +
    hungHeart(20, 10, 14, red),
};

// The shapes the pieces use, each drawn once. The four hearts are for the pieces
// that float and beat, one for each tone.
const shapes = {
  'heart-pink': { viewBox: '0 0 24 22', markup: heart(pink) },
  'heart-red': { viewBox: '0 0 24 22', markup: heart(red) },
  'heart-pale': { viewBox: '0 0 24 22', markup: heart(pale) },
  'heart-coral': { viewBox: '0 0 24 22', markup: heart(coral) },
  'arrow': arrow,
  'letter': letter,
  'arrow-through': arrowThrough,
  'bow': hangingBow,
  'garland-top': heartString(1920, 26, 15, 1.5, 6, 3, 15),
  'garland-a': heartString(836, 14, 8, 1, 3, 4, 9.5),
  'garland-b': heartString(654, 14, 6, 1, 3, 4, 9.5),
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

  // Over the panels: eight hearts and two love letters that rise across the whole
  // screen, and two small hearts that twinkle in the margins, where there is no text.
  // A trip takes 22 to 50 seconds, so a piece is only over a letter for a moment, and
  // each is faint enough (opacity .65 to .85) that the word shows through it. The
  // biggest hearts are the faintest and the quickest, the smallest the clearest and
  // the slowest, as if the big ones were closer. The pieces are spread over the width
  // of the screen (each in a column of its own) and over the stages of their trips
  // (golden ratio steps, so there is no pattern), so the first screen already has
  // pieces at every height and the screen is never empty and never crowded. This
  // layer carries all of the rising hearts: none rise behind the panels or in the
  // margins, because a pack may only move about 24 pieces in all.
  over: [
    { shape: 'heart-pink', x: 70, y: 520, size: 44, opacity: 0.7, motion: 'rise', seconds: 22, delay: -4.4, travel: 1300 },
    { shape: 'heart-pale', x: 295, y: 525, size: 28, opacity: 0.85, motion: 'rise', seconds: 40, delay: -32.7, travel: 1300 },
    { shape: 'letter', x: 455, y: 530, size: 44, opacity: 0.8, motion: 'rise', seconds: 34, delay: -14.8, travel: 1300 },
    { shape: 'heart-pink', x: 681, y: 520, size: 36, opacity: 0.75, motion: 'rise', seconds: 30, delay: -1.6, travel: 1300 },
    { shape: 'heart-red', x: 843, y: 525, size: 40, opacity: 0.7, motion: 'rise', seconds: 26, delay: -17.5, travel: 1300 },
    { shape: 'heart-coral', x: 1003, y: 530, size: 44, opacity: 0.65, motion: 'rise', seconds: 24, delay: -7, travel: 1300 },
    { shape: 'heart-pale', x: 1234, y: 520, size: 32, opacity: 0.8, motion: 'rise', seconds: 36, delay: -32.7, travel: 1300 },
    { shape: 'letter', x: 1395, y: 525, size: 36, opacity: 0.85, motion: 'rise', seconds: 44, delay: -23.2, travel: 1300 },
    { shape: 'heart-coral', x: 1630, y: 530, size: 24, opacity: 0.85, motion: 'rise', seconds: 48, delay: -6.9, travel: 1300 },
    { shape: 'heart-red', x: 1788, y: 520, size: 30, opacity: 0.8, motion: 'rise', seconds: 50, delay: -38.1, travel: 1300 },
    { shape: 'heart-pale', x: 2, y: 520, size: 26, opacity: 0.85, motion: 'twinkle', seconds: 3.2, delay: -1 },
    { shape: 'heart-pink', x: 1894, y: 700, size: 24, opacity: 0.85, motion: 'twinkle', seconds: 3.8, delay: -2.4 },
  ],

  front: [
    // Hearts that beat, one in each margin
    { zone: 'left', shape: 'heart-red', x: 3, y: 330, size: 22, motion: 'pulse', seconds: 3, delay: -1 },
    { zone: 'right', shape: 'heart-red', x: 3, y: 430, size: 22, motion: 'pulse', seconds: 3, delay: -2 },

    // The garland along the top edge, and the small ones above the ticker. They stay still.
    { zone: 'top', shape: 'garland-top', x: 0, y: 0, size: 1920 },
    { zone: 'string-a', shape: 'garland-a', x: 0, y: 0, size: 836 },
    { zone: 'string-b', shape: 'garland-b', x: 0, y: 0, size: 654 },

    // An arrow through a heart in the cut corner of the large panel. The heart beats.
    { zone: 'corner-a', shape: 'arrow-through', x: 0, y: 0, size: 96 },
    { zone: 'corner-a', shape: 'heart-pink', x: 38, y: 4, size: 20, motion: 'pulse', seconds: 3, delay: 0 },

    // A bow that swings in the cut corner of the countdown
    { zone: 'corner-b', shape: 'bow', x: 13, y: 2, size: 26, motion: 'sway', seconds: 5.5, delay: -2 },

    // Along the ribbon: two hearts that beat, and two arrows that fly past now and
    // then. An arrow rests in the middle of its path, and a round is long, so most
    // of the time it is out of sight.
    { zone: 'ground', shape: 'heart-pink', x: 851, y: 3, size: 18, motion: 'pulse', seconds: 3, delay: -1.5 },
    { zone: 'ground', shape: 'heart-red', x: 1491, y: 3, size: 18, motion: 'pulse', seconds: 3, delay: -0.5 },
    { zone: 'ground', shape: 'arrow', x: 640, y: 0, size: 90, motion: 'sweep', seconds: 21, delay: -3, travel: 900 },
    { zone: 'ground', shape: 'arrow', x: 1320, y: 0, size: 90, motion: 'sweep', seconds: 27, delay: -14, travel: 900 },
  ],
};
