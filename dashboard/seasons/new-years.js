// The New Year's pack. It follows christmas.js, the model for every pack:
// docs/seasonal-packs.md explains each part.
//
// What it draws:
//   - a firework burst in place of the slashes at the right of every panel
//     header: gold and silver rays round a bright middle (mark)
//   - confetti, stars and two balloons that fall, tumble and rise across the whole
//     screen over the panels, and two sparkles in the margins that twinkle (over)
//   - in the empty places: fireworks, lines that draw themselves out from a point
//     and wipe away, in the margins and over the skyline
//   - a night skyline along the bottom edge, with a ball on a tall pole and
//     lit windows, a third of which twinkle
//   - a foil fringe along the top edge, whose strands shimmer in three groups
//   - bunting in the gap above the ticker
//   - two party hats and a folded streamer in one cut corner, and a clock at
//     midnight in the other
//
// The pack is data. It holds no keyframes and no animation code: a piece names a
// motion ('flutter', 'draw', 'twinkle'...) and seasons/motion.css plays it, and only
// in full motion. In calm and none motion every firework rests fully drawn, and the
// over layer is not drawn at all.
//
// Every shape is flat polygons with hard edges, in the faceted style of the logo.
// There is no blur, no glow, no shadow and no gradient. There is no text of any
// kind. The colours of the screen's own text are in themes/overlays/new-years.css.

const gold = '#ffd666';
const goldShade = '#d9a43a';
const silver = '#eef2fa';
const silverShade = '#a7b3cd';
const ice = '#7cc8ff';
const iceShade = '#4a92d8';
const rose = '#ff7f9f';
const roseShade = '#d4506f';
const cream = '#fff4d6';
const navy = '#2a3560';

// Each colour comes with its shaded side, and they take turns
const tones = [[gold, goldShade], [silver, silverShade], [ice, iceShade], [rose, roseShade]];


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

// A five pointed star made of ten triangles from the middle, each arm with a lit
// side and a shaded side
function star(cx, cy, outer, inner, lit, shade) {
  const point = (radius, step) => {
    const angle = -Math.PI / 2 + step * Math.PI / 5;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  };
  let markup = '';
  for (let arm = 0; arm < 5; arm++) {
    const tip = point(outer, arm * 2);
    markup += shape([[cx, cy], point(inner, arm * 2 - 1), tip], lit) + shape([[cx, cy], tip, point(inner, arm * 2 + 1)], shade);
  }
  return markup;
}


// Fireworks. A burst is a ring of lines that run out from the middle, long and
// short ones taking turns. The "draw" motion draws each line from its inner end to
// its outer end, holds it, then wipes it away from the inner end, so the line
// seems to fly outward. The motion works on lines that have pathLength="1" and
// stroke-dasharray="1" (motion.css), which is why every line below has both. At
// rest the lines are whole, so calm motion shows the finished burst.
function burst(longColour, shortColour) {
  let lines = '';
  for (let i = 0; i < 12; i++) {
    const angle = Math.PI / 12 + i * Math.PI / 6;
    const isLong = i % 2 === 0;
    const from = isLong ? 4 : 7;
    const to = isLong ? 13.6 : 11;
    const x = radius => round(14 + radius * Math.cos(angle));
    const y = radius => round(14 + radius * Math.sin(angle));

    // The bursts are drawn only 20 to 30 px wide, so the lines are thick enough to show
    lines += '<line x1="' + x(from) + '" y1="' + y(from) + '" x2="' + x(to) + '" y2="' + y(to) + '" pathLength="1" stroke-dasharray="1" stroke="' +
      (isLong ? longColour : shortColour) + '" stroke-width="2.4"/>';
  }
  return { viewBox: '0 0 28 28', markup: lines };
}


// The skyline along the bottom edge. The scene is 1920 wide and 26 high, and its
// y runs from -4 (the top edge of the strip) to 22 (the bottom of the screen). Left
// of x 270 the ticker's tag comes within 12 px of the top, so there (y under 12)
// the buildings stay low.

// The lit windows are shared out three ways: two thirds are still and go in the
// scene, and one third is a shape of its own so that it can twinkle
const windowsStill = [];
const windowsTwinkle = [];
let windowCount = 0;

// A window is a small square. They are gold, with an occasional white one.
function addWindow(x, y) {
  const colour = windowCount % 5 === 0 ? silver : gold;
  const markup = shape([[x, y], [x + 2.4, y], [x + 2.4, y + 2.8], [x, y + 2.8]], colour);
  [windowsStill, windowsStill, windowsTwinkle][windowCount % 3].push(markup);
  windowCount += 1;
}

// One building standing on y 22: a lit left face and a shaded right face. The roof
// is 'flat', 'peak' (a crown of two facets), 'slant' (one face lower than the
// other) or 'step' (a narrower block on top).
function building(x, width, top, lit, shade, roof) {
  const mid = x + width * 0.55;
  const dip = roof === 'slant' ? 3 : (roof === 'peak' ? 2 : 0);
  const rise = roof === 'peak' ? 1 : 0;

  let markup = shape([[x, 22], [x, top + dip], [mid, top - rise], [mid, 22]], lit) +
    shape([[mid, 22], [mid, top - rise], [x + width, top + (roof === 'peak' ? 2 : 0)], [x + width, 22]], shade);

  if (roof === 'step') markup += shape([[x + width * 0.25, top], [x + width * 0.25, top - 3], [mid, top - 3], [mid, top]], lit) +
    shape([[mid, top], [mid, top - 3], [x + width * 0.75, top - 3], [x + width * 0.75, top]], shade);
  return markup;
}

// A thin spire on the top of a building
function spire(x, top, height, fill) {
  return shape([[x - 0.9, top], [x + 0.9, top], [x, top - height]], fill);
}

// A row of buildings from one end of the screen to the other. Their widths,
// heights and roofs come from sums, so nobody has to type fifty buildings.
//   tallest, lowest  the highest and lowest top, as a y
//   narrowest        the least width
//   spread           how many different widths there are
//   offset           where the row starts, so two rows do not line up
//   windows          true to light windows in the row
function skylineRow(lit, shade, tallest, lowest, narrowest, spread, offset, windows) {
  const roofs = ['flat', 'peak', 'slant', 'step'];
  let markup = '';
  let x = offset;

  for (let i = 0; x < 1920; i++) {
    const width = narrowest + (i * 11 + offset) % spread;
    const top = Math.max(tallest + (i * 7 + offset) % (lowest - tallest + 1), x < 270 ? 12 : 0);
    markup += building(x, width, top, lit, shade, roofs[(i * 5 + offset) % 4]);

    if (windows && width >= 14) {
      for (let row = 0; top + 3 + row * 4 < 19; row++) {
        for (let col = 0; 3 + col * 4 < width - 3; col++) {
          if ((i + row * 3 + col * 5) % 3 === 0) addWindow(x + 3 + col * 4, top + 3 + row * 4);
        }
      }
    }
    x += width;
  }
  return markup;
}

// The tall towers, each with a spire: x, width, the y of the top, and the height of the spire
const towers = [
  [372, 12, 5, 4], [606, 14, 2, 5], [1032, 16, 1, 5], [1290, 12, 4, 3], [1730, 14, 3, 4],
];

function towersMarkup() {
  return towers.map(item => building(item[0], item[1], item[2], '#5a76bd', '#455fa0', 'flat') +
    spire(item[0] + item[1] * 0.55, item[2], item[3], '#a9bbe0')).join('');
}

// The ball on its pole, standing on a building. It is a silver ball with facets,
// and a thin pole under it.
const poleX = 1568;
const poleTower = building(poleX - 9, 18, 9, '#5a76bd', '#455fa0', 'flat') +
  shape([[poleX - 0.6, 9], [poleX + 0.6, 9], [poleX + 0.6, 2.5], [poleX - 0.6, 2.5]], silverShade) +
  ball(poleX, -0.4, 3.4, silver, silverShade);

// The windows are made while the rows are drawn, so the rows come first and the
// still windows are laid on top of them
const farRow = skylineRow('#27356a', '#1c284f', 3, 10, 20, 17, 0, false);
const nearRow = skylineRow('#4a65ab', '#3a528f', 8, 15, 22, 19, 9, true);

const sceneMarkup =
  farRow +
  nearRow +
  towersMarkup() +
  poleTower +
  windowsStill.join('') +
  shape([[0, 21], [1920, 21], [1920, 22], [0, 22]], '#27356a');


// The foil fringe along the top edge: strands hang from the rail, each with a
// pointed tip, a lit side and a shaded side. The strands are shared out in three
// groups, so the groups can shimmer one after another. The rail is a shape of
// its own and stays still.
function fringe() {
  const groups = ['', '', ''];
  for (let i = 0; i < 128; i++) {
    const x = 3 + i * 15;
    const length = 12 + (i * 7) % 11;
    const tone = tones[i % 4];

    groups[i % 3] += shape([[x, 1], [x + 3.5, 1], [x + 3.5, length], [x, length - 2.5]], tone[0]) +
      shape([[x + 3.5, 1], [x + 7, 1], [x + 7, length - 2.5], [x + 3.5, length]], tone[1]);
  }
  return groups.map(markup => ({ viewBox: '0 0 1920 26', markup: markup }));
}

const fringeGroups = fringe();
const rail = {
  viewBox: '0 0 1920 26',
  markup: shape([[0, 0], [1920, 0], [1920, 2], [0, 2]], silver) + shape([[0, 2], [1920, 2], [1920, 3], [0, 3]], silverShade),
};


// Bunting hung in swags: a thin line with a flag every few steps, each flag a
// triangle with a lit half and a shaded half. The flags take the four colours in turn.
//   width, height  the size of the strip
//   swags          how many dips along the strip
//   base, sag      how far down the line hangs from its two ends, and how much further the middle dips
//   perSwag        flags in each swag
function bunting(width, height, swags, base, sag, perSwag) {
  const length = width / swags;
  const points = [];
  let flags = '';

  for (let swag = 0; swag < swags; swag++) {
    for (let step = 0; step <= 8; step++) {
      const t = step / 8;
      points.push(round(swag * length + t * length) + ',' + round(base + sag * Math.sin(Math.PI * t)));
    }
    for (let k = 1; k <= perSwag; k++) {
      const t = k / (perSwag + 1);
      const x = swag * length + t * length;
      const y = base + sag * Math.sin(Math.PI * t);
      const tone = tones[(swag * perSwag + k) % tones.length];

      flags += shape([[x - 4.6, y], [x, y], [x, y + 10]], tone[0]) + shape([[x, y], [x + 4.6, y], [x, y + 10]], tone[1]);
    }
  }

  const line = '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + silverShade + '" stroke-width="1"/>';
  return { viewBox: '0 0 ' + width + ' ' + height, markup: line + flags };
}


// A party hat: a cone, lit on its left and shaded on its right, with two bands
// and a ball on the tip. It stands on y = baseY and leans by tilt degrees.
function hat(cx, baseY, height, halfWidth, tilt, tone, band) {
  const half = y => halfWidth * (y - (baseY - height)) / height; // how far the cone reaches from its middle at that y
  const slice = (top, bottom, lit, shade) =>
    shape([[cx - half(top), top], [cx, top], [cx, bottom], [cx - half(bottom), bottom]], lit) +
    shape([[cx, top], [cx + half(top), top], [cx + half(bottom), bottom], [cx, bottom]], shade);

  const tip = baseY - height;
  return '<g transform="rotate(' + tilt + ' ' + cx + ' ' + baseY + ')">' +
    slice(tip, baseY, tone[0], tone[1]) +
    slice(tip + height * 0.3, tip + height * 0.45, band[0], band[1]) +
    slice(tip + height * 0.65, tip + height * 0.8, band[0], band[1]) +
    shape([[cx - halfWidth - 1, baseY], [cx + halfWidth + 1, baseY], [cx + halfWidth + 1, baseY + 1.4], [cx - halfWidth - 1, baseY + 1.4]], band[1]) +
    ball(cx, tip, 2.5, silver, silverShade) +
    '</g>';
}

// A folded paper streamer: strips that climb and fall, a lit one then a shaded one.
// It runs between y 16 and y 26.
function streamer(x, count) {
  let markup = '';
  for (let k = 0; k < count; k++) {
    const x0 = x + k * 6;
    markup += k % 2 === 0
      ? shape([[x0, 22], [x0 + 6, 16], [x0 + 6, 20], [x0, 26]], rose)
      : shape([[x0, 16], [x0 + 6, 22], [x0 + 6, 26], [x0, 20]], roseShade);
  }
  return markup;
}

// Two hats leaning together and a folded streamer, in the cut corner of the large
// panel. The star that swells is a piece of its own, above the streamer.
const party = {
  viewBox: '0 0 96 28',
  markup: hat(15, 24.4, 20, 8.5, -10, tones[0], tones[1]) +
    hat(38, 24.4, 18, 8, 12, tones[2], tones[3]) +
    streamer(60, 6),
};

// A clock at midnight, in the cut corner of the countdown. It has no numbers, only
// four marks and two hands pointing straight up.
const clock = {
  viewBox: '0 0 34 34',
  markup: ball(17, 17, 16, gold, goldShade) +
    ball(17, 17, 12.5, cream, '#eddfb4') +
    shape([[16.2, 6], [17.8, 6], [17.8, 8.6], [16.2, 8.6]], navy) +
    shape([[25.4, 16.2], [28, 16.2], [28, 17.8], [25.4, 17.8]], navy) +
    shape([[16.2, 25.4], [17.8, 25.4], [17.8, 28], [16.2, 28]], navy) +
    shape([[6, 16.2], [8.6, 16.2], [8.6, 17.8], [6, 17.8]], navy) +
    shape([[16.1, 10], [17.9, 10], [17.9, 17.9], [16.1, 17.9]], navy) +
    shape([[15.6, 12.4], [18.4, 12.4], [18.4, 17.9], [15.6, 17.9]], roseShade) +
    ball(17, 17, 1.8, navy, navy),
};


// The mark: a firework burst, 60 by 60, in place of the slashes in every panel
// header (a mark may be up to 60 by 76: markBox in core/marks.js). Sixteen rays run
// out from the middle: eight long gold ones and, between them, eight short silver
// ones, each with a small diamond beyond its tip, in ice blue and rose in turn.
// Every ray is a thin kite cut along its middle into a lit side and a shaded side.
// The lit side is the one that faces the upper left, so the light comes from the
// same place for every ray. The middle is a cream octagon with a core in the accent
// colour of the screen: shapes inside <g class="double-slash"> are painted by
// base.css with --yellow, which the New Year's overlay makes gold.

const markMiddle = 30;

// A point on a ray: this far along it from the middle of the burst, and this far to its side
function rayPoint(angle, along, across) {
  return [
    markMiddle + along * Math.cos(angle) - across * Math.sin(angle),
    markMiddle + along * Math.sin(angle) + across * Math.cos(angle),
  ];
}

// One ray: from inner (the distance of its root from the middle) out to tip, and
// widest (half a width, halfWidth, at that distance). tone is [lit, shade].
function ray(angle, inner, widest, tip, halfWidth, tone) {
  const side = Math.sin(angle) - Math.cos(angle) > 0 ? 1 : -1; // the side that faces the upper left
  const start = rayPoint(angle, inner, 0);
  const end = rayPoint(angle, tip, 0);
  return shape([start, rayPoint(angle, widest, halfWidth * side), end], tone[0]) +
    shape([start, end, rayPoint(angle, widest, -halfWidth * side)], tone[1]);
}

// The corners of an octagon, as the text of a points attribute
function octagonPoints(cx, cy, r) {
  const s = r * 0.38;
  return [[cx - s, cy - r], [cx + s, cy - r], [cx + r, cy - s], [cx + r, cy + s], [cx + s, cy + r], [cx - s, cy + r], [cx - r, cy + s], [cx - r, cy - s]]
    .map(pair => round(pair[0]) + ',' + round(pair[1])).join(' ');
}

function burstMark() {
  let long = '';
  let short = '';
  let sparks = '';
  for (let k = 0; k < 16; k++) {
    const angle = -Math.PI / 2 + k * Math.PI / 8;
    if (k % 2 === 0) {
      long += ray(angle, 6, 14.5, 29.5, 4.2, tones[0]);
    } else {
      short += ray(angle, 6, 11.5, 21.5, 3.2, tones[1]);
      sparks += ray(angle, 22.6, 26.4, 30, 3.1, k % 4 === 1 ? tones[2] : tones[3]);
    }
  }
  // the short rays are laid over the long ones, so the rays do not cut into each other
  return long + short + sparks + ball(markMiddle, markMiddle, 10, cream, '#e6d3a0') +
    '<g class="double-slash"><polygon points="' + octagonPoints(markMiddle, markMiddle, 6) + '"/></g>';
}

const mark = { viewBox: '0 0 60 60', markup: burstMark() };


// The shapes of the over layer. Each has a lit half and a shaded half, and each is
// drawn once and used by several pieces. tone is [lit, shade], one of tones above.

// A slip of confetti, a twisted ribbon and a diamond
function slip(tone) {
  return { viewBox: '0 0 24 10', markup: shape([[0, 1.5], [12, 0], [12, 8.5], [0, 10]], tone[0]) + shape([[12, 0], [24, 1.5], [24, 10], [12, 8.5]], tone[1]) };
}

function strip(tone) {
  return { viewBox: '0 0 12 22', markup: shape([[0, 2.5], [6, 0], [6, 19.5], [0, 22]], tone[0]) + shape([[6, 0], [12, 2.5], [12, 22], [6, 19.5]], tone[1]) };
}

function diamond(tone) {
  return { viewBox: '0 0 16 16', markup: shape([[8, 0], [0, 8], [8, 16]], tone[0]) + shape([[8, 0], [16, 8], [8, 16]], tone[1]) };
}

// A five pointed star, 28 by 28
function bigStar(tone) {
  return { viewBox: '0 0 28 28', markup: star(14, 15, 14, 5.8, tone[0], tone[1]) };
}

// A four pointed sparkle that twinkles where it is, 28 by 28
function sparkle(tone) {
  return {
    viewBox: '0 0 28 28',
    markup: shape([[14, 0], [14, 28], [11.6, 16.4], [0, 14], [11.6, 11.6]], tone[0]) +
      shape([[14, 0], [16.4, 11.6], [28, 14], [16.4, 16.4], [14, 28]], tone[1]),
  };
}

// A balloon on a string, 30 by 56: a faceted oval, a knot, and a bright facet at the top left
function balloon(tone, bright) {
  return {
    viewBox: '0 0 30 56',
    markup: shape([[15, 0.5], [7, 3.5], [2, 11], [2.5, 21], [8, 29], [15, 33]], tone[0]) +
      shape([[15, 0.5], [23, 3.5], [28, 11], [27.5, 21], [22, 29], [15, 33]], tone[1]) +
      shape([[7.5, 5.5], [11.5, 4], [9.5, 11.5], [5.5, 14]], bright) +
      shape([[15, 33], [12.2, 36.8], [17.8, 36.8]], tone[1]) +
      '<polyline points="15,36.8 13.2,41.5 16.8,46 13.2,50.5 15,55.5" fill="none" stroke="' + silverShade + '" stroke-width="1.2"/>',
  };
}

const shapes = {
  'rect-gold': slip(tones[0]),
  'rect-rose': slip(tones[3]),
  'rect-ice': slip(tones[2]),
  'strip-rose': strip(tones[3]),
  'strip-ice': strip(tones[2]),
  'diamond-silver': diamond(tones[1]),
  'star-gold': bigStar(tones[0]),
  'star-silver': bigStar(tones[1]),
  'sparkle-gold': sparkle(tones[0]),
  'sparkle-silver': sparkle(tones[1]),
  'balloon-gold': balloon(tones[0], cream),
  'balloon-silver': balloon(tones[1], '#ffffff'),
  'burst-gold': burst(gold, silver),
  'burst-silver': burst(silver, ice),
  'burst-rose': burst(rose, gold),
  'burst-ice': burst(ice, silver),
  'rail': rail,
  'fringe-0': fringeGroups[0],
  'fringe-1': fringeGroups[1],
  'fringe-2': fringeGroups[2],
  'bunting-a': bunting(836, 14, 8, 0.8, 2, 4),
  'bunting-b': bunting(654, 14, 6, 0.8, 2, 4),
  'party': party,
  'clock': clock,
  'star': { viewBox: '0 0 14 14', markup: star(7, 7.6, 7, 3, gold, goldShade) },
  'windows': { viewBox: '0 -4 1920 26', markup: windowsTwinkle.join('') },
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

  // Over the panels: ten pieces that fall, tumble or rise across the whole screen, and
  // two sparkles that twinkle in the margins, where there is no text. Confetti,
  // stars and a diamond flutter or fall, slowly: a trip takes 26 to 48 seconds, so a
  // piece is only over a letter for a moment, and each is faint enough (opacity .7
  // to .85, the bigger the fainter) that the word shows through it. Two balloons rise,
  // the slowest pieces of all. The pieces are spread over the width of the screen (each in a column of its
  // own) and over the stages of their trips (golden ratio steps, so there is no
  // pattern), so the first screen already has pieces at every height and the screen
  // is never empty and never crowded. This layer carries all of the confetti: none
  // falls behind the panels or in the margins, because a pack may only move about
  // 24 pieces in all.
  over: [
    { shape: 'star-gold', x: 70, y: 520, size: 44, opacity: 0.7, motion: 'flutter', seconds: 30, delay: -6, travel: 1300 },
    { shape: 'rect-rose', x: 293, y: 525, size: 44, opacity: 0.75, motion: 'flutter', seconds: 36, delay: -29.4, travel: 1300 },
    { shape: 'strip-ice', x: 459, y: 530, size: 28, opacity: 0.8, motion: 'flutter', seconds: 42, delay: -18.3, travel: 1300 },
    { shape: 'balloon-gold', x: 680, y: 520, size: 40, opacity: 0.75, motion: 'rise', seconds: 46, delay: -2.5, travel: 1400 },
    { shape: 'diamond-silver', x: 846, y: 525, size: 32, opacity: 0.8, motion: 'fall', seconds: 34, delay: -22.9, travel: 1300 },
    { shape: 'rect-gold', x: 1005, y: 530, size: 40, opacity: 0.75, motion: 'flutter', seconds: 26, delay: -7.5, travel: 1300 },
    { shape: 'star-silver', x: 1232, y: 520, size: 36, opacity: 0.75, motion: 'flutter', seconds: 38, delay: -34.5, travel: 1300 },
    { shape: 'strip-rose', x: 1404, y: 525, size: 24, opacity: 0.8, motion: 'flutter', seconds: 48, delay: -25.3, travel: 1300 },
    { shape: 'rect-ice', x: 1619, y: 530, size: 36, opacity: 0.8, motion: 'flutter', seconds: 40, delay: -5.8, travel: 1300 },
    { shape: 'balloon-silver', x: 1782, y: 520, size: 36, opacity: 0.75, motion: 'rise', seconds: 54, delay: -41.2, travel: 1400 },
    { shape: 'sparkle-gold', x: 0, y: 640, size: 30, opacity: 0.85, motion: 'twinkle', seconds: 3.4, delay: -1 },
    { shape: 'sparkle-silver', x: 1892, y: 420, size: 28, opacity: 0.85, motion: 'twinkle', seconds: 4.2, delay: -2.5 },
  ],

  front: [
    // Fireworks in the margins. They start at different times, so there is nearly
    // always one drawing and one fading. The gap between the two columns is 20 px
    // wide, too narrow for a firework to show, so it has none.
    { zone: 'left', shape: 'burst-gold', x: 0, y: 110, size: 30, motion: 'draw', seconds: 6.5, delay: -1 },
    { zone: 'left', shape: 'burst-ice', x: 0, y: 470, size: 30, motion: 'draw', seconds: 7.5, delay: -4.5 },
    { zone: 'right', shape: 'burst-rose', x: 0, y: 210, size: 30, motion: 'draw', seconds: 7, delay: -2.5 },
    { zone: 'right', shape: 'burst-silver', x: 0, y: 590, size: 30, motion: 'draw', seconds: 6, delay: -5 },

    // The foil fringe along the top edge: the rail stays, and the three groups of
    // strands shimmer one after another
    { zone: 'top', shape: 'rail', x: 0, y: 0, size: 1920 },
    { zone: 'top', shape: 'fringe-0', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 4.5, delay: 0 },
    { zone: 'top', shape: 'fringe-1', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 4.5, delay: -1.5 },
    { zone: 'top', shape: 'fringe-2', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 4.5, delay: -3 },

    // Bunting in the gap above the ticker
    { zone: 'string-a', shape: 'bunting-a', x: 0, y: 0, size: 836 },
    { zone: 'string-b', shape: 'bunting-b', x: 0, y: 0, size: 654 },

    // Two hats and a streamer in the cut corner of the large panel, with a star that swells
    { zone: 'corner-a', shape: 'party', x: 0, y: 0, size: 96 },
    { zone: 'corner-a', shape: 'star', x: 76, y: 0, size: 14, motion: 'pulse', seconds: 4, delay: -1 },

    // The clock in the cut corner of the countdown
    { zone: 'corner-b', shape: 'clock', x: 11, y: 2, size: 30 },

    // Along the skyline: a third of the windows twinkle, and two fireworks
    { zone: 'ground', shape: 'windows', x: 0, y: 0, size: 1920, motion: 'twinkle', seconds: 5, delay: -1 },
    { zone: 'ground', shape: 'burst-gold', x: 840, y: 1, size: 24, motion: 'draw', seconds: 7, delay: -2 },
    { zone: 'ground', shape: 'burst-rose', x: 1300, y: 1, size: 24, motion: 'draw', seconds: 6.5, delay: -5 },
  ],
};
