// The Thanksgiving pack. Like the Christmas pack (christmas.js) it is plain data:
// a list of shapes, a scene, a mark and lists of pieces. docs/seasonal-packs.md
// explains every part, and "How to add a pack" there lists the steps.
//
// What it draws:
//   - a turkey with a fan of tail feathers in place of the slashes at the right of
//     every panel header (mark)
//   - twelve pieces that tumble down across the whole screen, over the panels:
//     maple, oak and ginkgo leaves and an acorn, in reds, oranges, golds and browns (over)
//   - in the empty places: two big faint leaves falling behind the panels in the
//     margins, a leaf falling down each margin and the gap between the columns, a
//     vine along the top edge with four leaves hanging from it (two swing in a
//     breeze), and a thinner vine in each gap above the ticker with a leaf blowing
//     along it (back and front)
//   - a spray of leaves and acorns in the cut corner of the large panel, and a
//     hanging acorn in the cut corner of the countdown
//   - a harvest scene along the bottom edge: a line of autumn trees, corn stalks,
//     pumpkins, hay bales, wheat, scarecrows and a turkey (scene)
//
// The pack holds no keyframes and no animation code: a piece names a motion
// ('fall', 'sway', 'drift') and seasons/motion.css plays it, and only in full
// motion. The colours are written out here and not taken from the theme, so a
// leaf stays red whatever theme is on. The accent colours of the screen's own
// text are in themes/overlays/thanksgiving.css.
//
// Every shape is flat polygons with hard edges, in the faceted style of the
// logo, with a lit side and a shaded side. There is no blur, no glow, no shadow
// and no gradient.

// Each leaf colour is a pair: the lit side and the shaded side
const red = ['#e0502f', '#ab321a'];
const orange = ['#f4982e', '#c46c14'];
const gold = ['#f8c748', '#cd9b2b'];
const brown = ['#b07842', '#7f5026'];
const olive = ['#a8b63f', '#788628'];
const leafColours = [red, orange, gold, olive, brown];
const farColours = [['#7a3d24', '#5b2c1a'], ['#86671f', '#684e17'], ['#666a26', '#4c4f1b'], ['#7a362a', '#5c291f'], ['#8a5a26', '#6a4419']];

const trunk = '#7e5430';
const trunkShade = '#5c3c21';
const stemBrown = '#6e4825';
const pumpkinLit = '#ffa63f';
const pumpkin = '#f58b25';
const pumpkinShade = '#cd6414';
const hayLit = '#f2c455';
const hayShade = '#c99629';
const hayCut = '#8c5c16';
const hayLight = '#fbe28f';
const hillFar = '#2e2012';
const soil = '#4a3319';
const stubble = '#cfa13c';
const huskLit = '#a8b63f';
const huskShade = '#788628';
const kernel = '#f6cf4f';
const skin = '#e9c48c';
const feather = '#c2704f';


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

// A drawing placed in another: moved to (x, y), turned by angle degrees about its
// own middle, and scaled so that it is size wide. width and height are the size
// the drawing was made at.
function put(markup, x, y, size, angle, width, height) {
  return '<g transform="translate(' + round(x) + ' ' + round(y) + ') scale(' + round(size / width * 100) / 100 + ') rotate(' + angle + ' ' + width / 2 + ' ' + height / 2 + ')">' + markup + '</g>';
}

// A leaf made of two halves. rightHalf lists the right half from the top of the
// middle line to the bottom of it, in a drawing width wide. The left half is its
// mirror, lit, and the right half is in shade.
function leafHalves(rightHalf, width, colours) {
  return shape(mirror(rightHalf, width), colours[0]) + shape(rightHalf, colours[1]);
}


// The leaves. Each is a drawing with its size, and its stem at the bottom.

// A maple leaf with five points
const maple = { width: 24, height: 24, make: colours => leafHalves(
  [[12, 0], [14.2, 5], [17.6, 3], [17.2, 8.4], [23.4, 9], [19.6, 13], [21.4, 17.6], [15.4, 16.6], [12.9, 19.2], [12, 19.2]], 24, colours) +
  block(11.3, 19, 1.4, 5, stemBrown) };

// An oak leaf, long, with rounded lobes
const oak = { width: 16, height: 28, make: colours => leafHalves(
  [[8, 0], [10.6, 1.6], [11.6, 4], [10.2, 5.6], [13.6, 7.6], [11.6, 10.4], [14.4, 12.8], [11.4, 15.2], [13.4, 18], [10, 19.6], [8.8, 22], [8, 22]], 16, colours) +
  block(7.4, 21.5, 1.2, 6.5, stemBrown) };

// A ginkgo leaf, a fan with a notched edge
const ginkgo = { width: 24, height: 24, make: colours => leafHalves(
  [[12, 3.2], [14.4, 0.6], [18, 1.4], [21.6, 3.8], [23.6, 8.4], [12.6, 20]], 24, colours) +
  block(11.4, 19.5, 1.2, 4.5, stemBrown) };

// A plain pointed leaf
const elm = { width: 14, height: 26, make: colours => leafHalves(
  [[7, 0], [11, 5], [12.6, 11], [10.6, 17], [7, 21]], 14, colours) +
  block(6.4, 20.5, 1.2, 5.5, stemBrown) };

// An acorn: a round cap with a pointed nut under it
const acorn = { width: 14, height: 18, make: () =>
  shape([[7, 0], [8.2, 0], [8, 1.6], [6, 1.6]], stemBrown) +
  shape([[2.6, 6.6], [3.2, 3], [7, 1.6], [7, 6.6]], '#8a5a2e') +
  shape([[7, 1.6], [10.8, 3], [11.4, 6.6], [7, 6.6]], '#654120') +
  shape([[3, 6.6], [7, 6.6], [7, 17.6], [3.8, 12.4]], '#d19445') +
  shape([[7, 6.6], [11, 6.6], [10.2, 12.4], [7, 17.6]], '#a46c28') };

// A leaf turned upside down about its middle, so that its stem is at the top and
// it can hang from it
function hanging(leaf, colours) {
  return { width: leaf.width, height: leaf.height, make: () => '<g transform="rotate(180 ' + leaf.width / 2 + ' ' + leaf.height / 2 + ')">' + leaf.make(colours) + '</g>' };
}

function drawn(leaf, colours) {
  return { viewBox: '0 0 ' + leaf.width + ' ' + leaf.height, markup: leaf.make(colours) };
}

// A small leaf for the vines, as a lit and a shaded triangle, starting at (x, y) and
// reaching length in the direction of angle degrees
function miniLeaf(x, y, length, angle, colours) {
  const a = angle * Math.PI / 180;
  const along = (distance, across) => [x + distance * Math.cos(a) - across * Math.sin(a), y + distance * Math.sin(a) + across * Math.cos(a)];
  const tip = along(length, 0);
  return shape([[x, y], along(length * 0.45, -length * 0.3), tip], colours[0]) +
    shape([[x, y], tip, along(length * 0.45, length * 0.3)], colours[1]);
}

// A mini pumpkin hanging by its stem, width wide, with the stem at (cx, top)
function gourd(cx, top, width, colours) {
  const h = width * 0.8;
  return shape([[cx - width * 0.5, top + h * 0.3], [cx - width * 0.25, top + 1.6], [cx + width * 0.25, top + 1.6], [cx + width * 0.5, top + h * 0.3], [cx + width * 0.4, top + h], [cx - width * 0.4, top + h]], colours[0]) +
    shape([[cx, top + 1.6], [cx + width * 0.25, top + 1.6], [cx + width * 0.5, top + h * 0.3], [cx + width * 0.4, top + h], [cx, top + h]], colours[1]) +
    block(cx - 0.5, top, 1, 2, stemBrown);
}


// The vines. A vine runs along a strip, and a leaf grows from it every so often.

// A vine along a strip width by height. The vine is at y base and wanders by wave.
// A leaf starts every gap pixels, alternately above and below, and a gourd hangs
// every gourdGap. size is the length of the leaves.
function vine(width, height, base, wave, gap, size, gourdGap, gourdSize) {
  const points = [];
  const at = x => base + wave * Math.sin(x / 31);
  for (let x = 0; x <= width; x += 8) points.push(round(x) + ',' + round(at(x)));

  let leaves = '';
  let n = 0;
  for (let x = gap / 2; x < width; x += gap) {
    const y = at(x);
    const down = n % 2 === 0;
    leaves += miniLeaf(x, y, size, down ? 55 + (n % 3) * 8 : -30 - (n % 3) * 6, leafColours[n % leafColours.length]);
    n += 1;
  }

  let gourds = '';
  for (let x = gourdGap; x < width - 20; x += gourdGap) {
    gourds += gourd(x, at(x), gourdSize, n % 2 === 0 ? [pumpkin, pumpkinShade] : [gold[0], gold[1]]);
    n += 1;
  }
  return {
    viewBox: '0 0 ' + width + ' ' + height,
    markup: '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + trunk + '" stroke-width="1.8"/>' + leaves + gourds,
  };
}


// The scene along the bottom edge. It is 1920 wide and 26 high, and its y runs
// from -4 (the top edge of the strip) to 22 (the bottom of the screen), so the
// ground is at the bottom and the tall things have 4 px of headroom. Left of x 270
// the ticker's tag comes within 12 px of the top, so there (y under 8) nothing
// stands, and the ground stays low.

// A ridge made of straight facets: one point every step pixels, with a height
// that rolls between the limits. low is the lowest the top may be for x under 270.
function ridge(fill, middle, swing, step, phase, low) {
  const height = x => {
    const y = middle + swing * Math.sin(x / 127 + phase) + swing * 0.6 * Math.sin(x / 43 + phase * 2);
    return x < 270 ? Math.max(y, low) : y;
  };
  const pairs = [[0, 22]];
  for (let x = 0; x < 1920; x += step) pairs.push([x, height(x)]);
  pairs.push([1920, height(1920)]); // the last step is short, so the ridge ends level and not on a slope
  pairs.push([1920, 22]);
  return shape(pairs, fill);
}

// A tree in autumn colours, standing on the far ridge (y 18): a short trunk and a
// round crown of straight facets, lit on the left and in shade on the right. The
// colours are duller than the leaves in front, so the trees read as far away.
function autumnTree(x, radius, colours) {
  const cy = 17 - radius * 0.9;
  const s = radius * 0.45;
  const crown = [[x - s, cy - radius], [x + s, cy - radius], [x + radius, cy - s], [x + radius, cy + s], [x + s, cy + radius * 0.8], [x - s, cy + radius * 0.8], [x - radius, cy + s], [x - radius, cy - s]];
  const half = [[x, cy - radius], [x + s, cy - radius], [x + radius, cy - s], [x + radius, cy + s], [x + s, cy + radius * 0.8], [x, cy + radius * 0.8]];
  return block(x - 0.9, cy, 1.8, 18 - cy, trunk) + shape(crown, colours[0]) + shape(half, colours[1]);
}

// The line of trees along the far ridge. They are small and low left of x 270.
function treeLine() {
  let markup = '';
  for (let i = 0; i < 184; i++) {
    const x = 6 + i * 10.4;
    const radius = x < 270 ? 2.2 + (i % 2) * 0.5 : 2.8 + (i * 7) % 3 * 0.7;
    markup += autumnTree(x, radius, farColours[(i * 3) % farColours.length]);
  }
  return markup;
}

// A pumpkin standing on the ground y 20, as wide as width: a lit left rib, a
// plain middle and a right rib in shade, with a short stem
function pumpkinAt(cx, width, colours) {
  const r = width / 2;
  const h = width * 0.78;
  const top = 20 - h;
  const base = 20;
  const lit = colours ? colours[0] : pumpkinLit;
  const mid = colours ? colours[1] : pumpkin;
  const dark = colours ? colours[2] : pumpkinShade;

  return shape([[cx - r * 0.5, top], [cx + r * 0.5, top], [cx + r, top + h * 0.22], [cx + r, base - h * 0.22], [cx + r * 0.55, base], [cx - r * 0.55, base], [cx - r, base - h * 0.22], [cx - r, top + h * 0.22]], mid) +
    shape([[cx - r * 0.5, top], [cx - r * 0.2, top + h * 0.04], [cx - r * 0.3, base], [cx - r * 0.55, base], [cx - r, base - h * 0.22], [cx - r, top + h * 0.22]], lit) +
    shape([[cx + r * 0.2, top + h * 0.04], [cx + r * 0.5, top], [cx + r, top + h * 0.22], [cx + r, base - h * 0.22], [cx + r * 0.55, base], [cx + r * 0.3, base]], dark) +
    shape([[cx - 1.2, top - 2.6], [cx + 1.2, top - 2.6], [cx + 1.6, top + 0.6], [cx - 1.6, top + 0.6]], stemBrown);
}

// A square hay bale standing on y base, with two straps and a few bright straws
function bale(x, base, width, height) {
  const top = base - height;
  return block(x, top, width, height, hayLit) +
    block(x + width * 0.78, top, width * 0.22, height, hayShade) +
    block(x + width * 0.22, top, 1, height, hayCut) +
    block(x + width * 0.56, top, 1, height, hayCut) +
    block(x + 1.5, top + height * 0.3, 3, 0.8, hayLight) +
    block(x + width * 0.3, top + height * 0.65, 3.4, 0.8, hayLight);
}

// Three bales stacked: two below and one on top
function haystack(x) {
  return bale(x, 20, 11, 7) + bale(x + 11, 20, 11, 7) + bale(x + 5.5, 13, 11, 7);
}

// A round bale seen from its end: rings of straight facets
function roundBale(cx, radius) {
  const ring = (r, fill) => {
    const s = r * 0.41;
    return shape([[cx - s, 20 - radius * 2 + (radius - r)], [cx + s, 20 - radius * 2 + (radius - r)], [cx + r, 20 - radius - s], [cx + r, 20 - radius + s], [cx + s, 20 - (radius - r)], [cx - s, 20 - (radius - r)], [cx - r, 20 - radius + s], [cx - r, 20 - radius - s]], fill);
  };
  return ring(radius, hayShade) + ring(radius * 0.78, hayLit) + ring(radius * 0.52, hayShade) + ring(radius * 0.28, hayLit);
}

// A stalk of corn standing on y 21: a thin stem, three pairs of long leaves that
// droop, and an ear in a green husk
function cornStalk(x, height, side) {
  const top = 21 - height;
  let markup = limb(x, 21, x, top, 1.6, 0.8, huskLit, huskShade);
  for (let i = 0; i < 3; i++) {
    const y = 21 - height * (0.3 + i * 0.22);
    const reach = 8 - i * 1.4;
    markup += shape([[x, y], [x - reach, y + 3.4], [x, y + 1.6]], huskLit) + shape([[x, y], [x + reach, y + 3.4], [x, y + 1.6]], huskShade);
  }
  const e = 21 - height * 0.52;
  return markup + shape([[x + side, e + 4], [x + side * 3.6, e - 1.4], [x + side * 4.6, e - 0.4], [x + side * 1.6, e + 5]], huskShade) +
    shape([[x + side * 2.4, e + 1], [x + side * 3.6, e - 1.4], [x + side * 4.6, e - 0.4], [x + side * 3.2, e + 1.8]], kernel);
}

// A sheaf of wheat standing on y 21: stalks that fan out, a head on each, and a tie
function wheatSheaf(x, height) {
  let markup = '';
  [-22, -11, 0, 11, 22].forEach(angle => {
    const a = angle * Math.PI / 180;
    const tx = x + Math.sin(a) * height;
    const ty = 21 - Math.cos(a) * height;
    markup += limb(x, 21, tx, ty, 0.9, 0.7, '#dcb54e', '#b08a2c');
    const hx = Math.sin(a) * 4.6;
    const hy = Math.cos(a) * 4.6;
    markup += shape([[tx - 1.1 * Math.cos(a), ty - 1.1 * Math.sin(a)], [tx, ty], [tx + hx, ty - hy]], hayLit) +
      shape([[tx, ty], [tx + 1.1 * Math.cos(a), ty + 1.1 * Math.sin(a)], [tx + hx, ty - hy]], hayShade);
  });
  return markup + block(x - 2.2, 21 - height * 0.4, 4.4, 1.2, hayCut);
}

// A scarecrow standing on y 21: a post and a cross bar, a red shirt, a round head
// and a straw hat, with straw at the ends of the arms
function scarecrow(x) {
  return block(x - 0.7, 8, 1.4, 14, trunk) +
    block(x - 7.2, 10.4, 14.4, 1.4, trunk) +
    shape([[x - 3.2, 10], [x, 10], [x, 17], [x - 3.6, 17]], red[0]) +
    shape([[x, 10], [x + 3.2, 10], [x + 3.6, 17], [x, 17]], red[1]) +
    block(x - 3.4, 12.6, 6.8, 0.9, '#f4e2b4') +
    shape([[x - 2.4, 4], [x + 2.4, 4], [x + 2.8, 6.6], [x, 8.4], [x - 2.8, 6.6]], skin) +
    block(x - 4.6, 3.4, 9.2, 1, '#9a6b2c') +
    shape([[x - 2.6, 3.4], [x - 2, -0.4], [x + 2, -0.4], [x + 2.6, 3.4]], '#c99a3a') +
    shape([[x - 7.2, 10.4], [x - 9.2, 9.2], [x - 8.6, 11.6], [x - 9.4, 12.4], [x - 7.2, 11.8]], hayLit) +
    shape([[x + 7.2, 10.4], [x + 9.2, 9.2], [x + 8.6, 11.6], [x + 9.4, 12.4], [x + 7.2, 11.8]], hayLit);
}

// A turkey standing on y 21, facing right: a fan of seven tail feathers, a round
// brown body, a neck and a small head with a red wattle and an orange beak, and two legs
function turkey(x) {
  const cx = x - 3; // the middle of the fan
  const cy = 13.6;
  const colours = [brown, red, orange, gold, orange, red, brown];
  let markup = '';

  colours.forEach((pair, i) => {
    const angle = (-78 + i * 26) * Math.PI / 180;
    const wide = 12 * Math.PI / 180;
    const narrow = 7 * Math.PI / 180;
    const point = (radius, turn) => [cx + radius * Math.sin(turn), cy - radius * Math.cos(turn)];
    const middle = point(3, angle);
    const tip = point(15.5, angle);
    markup += shape([point(3, angle - narrow), point(13.6, angle - wide), tip, middle], pair[0]) +
      shape([middle, tip, point(13.6, angle + wide), point(3, angle + narrow)], pair[1]);
  });

  return markup +
    shape([[x - 6, 15.5], [x - 4, 11.6], [x + 1, 11], [x + 5, 13], [x + 6, 16], [x + 4, 19.4], [x - 4, 19.4]], '#8c5a2e') +
    shape([[x - 6, 15.5], [x + 6, 16], [x + 4, 19.4], [x - 4, 19.4]], '#69401f') +
    shape([[x + 2.5, 12.4], [x + 4.2, 7.2], [x + 6.2, 7.4], [x + 5.8, 13.4]], feather) +
    shape([[x + 3.8, 5], [x + 6.8, 4.6], [x + 7.4, 7.4], [x + 4.2, 7.6]], feather) +
    shape([[x + 7.2, 5.4], [x + 9.6, 6.2], [x + 7.2, 6.9]], '#f0a028') +
    shape([[x + 5.2, 7.6], [x + 6.8, 7.5], [x + 6.2, 10]], '#d8322a') +
    block(x + 5.5, 5.4, 0.8, 0.8, '#2a1a10') +
    block(x - 1.6, 19.4, 0.9, 1.8, '#c08a28') + block(x + 1.4, 19.4, 0.9, 1.8, '#c08a28');
}

// Fallen leaves on the ground, as little diamonds in the leaf colours. Their
// places come from a sum so nobody has to type them.
function fallenLeaves() {
  let markup = '';
  for (let i = 0; i < 50; i++) {
    const x = 9 + i * 38.3 + (i * i * 5) % 11;
    const y = 18.6 + (i * 3) % 3;
    const colours = leafColours[(i * 2) % leafColours.length];
    markup += shape([[x, y], [x + 1.8, y - 1.3], [x + 3.8, y]], colours[0]) + shape([[x, y], [x + 3.8, y], [x + 1.9, y + 1.1]], colours[1]);
  }
  return markup;
}

// Short golden stubble along the top of the soil
function stubbleRow() {
  let markup = '';
  for (let i = 0; i < 120; i++) {
    const x = 3 + i * 16;
    markup += shape([[x, 19.2], [x + 0.6, 17.2 - (i * 5) % 2], [x + 1.2, 19.2]], stubble);
  }
  return markup;
}

// What stands on the ground. Left of x 270 only low things.
const sceneMarkup =
  ridge(hillFar, 12, 1.4, 40, 0, 11) +
  treeLine() +
  ridge(soil, 19.4, 0.5, 33, 2, 18) +
  stubbleRow() +
  [[70, 10], [150, 12], [222, 10]].map(item => pumpkinAt(item[0], item[1])).join('') +
  [[300, 22, 1], [309, 20, -1], [318, 23, 1], [1176, 22, -1], [1185, 24, 1], [1194, 21, -1], [1706, 23, 1], [1715, 21, -1], [1724, 24, 1]].map(item => cornStalk(item[0], item[1], item[2])).join('') +
  haystack(384) +
  [[470, 18], [494, 13], [510, 9]].map(item => pumpkinAt(item[0], item[1])).join('') +
  wheatSheaf(580, 16) +
  scarecrow(662) +
  roundBale(738, 7) + roundBale(756, 6) +
  pumpkinAt(826, 15, ['#ffb85a', '#f0a43a', '#c9822a']) +
  turkey(940) +
  [[1010, 14], [1032, 20], [1058, 11]].map(item => pumpkinAt(item[0], item[1])).join('') +
  haystack(1100) +
  wheatSheaf(1260, 15) +
  [[1330, 18], [1354, 12]].map(item => pumpkinAt(item[0], item[1])).join('') +
  roundBale(1420, 7) +
  scarecrow(1486) +
  [[1560, 20], [1586, 12], [1604, 9]].map(item => pumpkinAt(item[0], item[1])).join('') +
  wheatSheaf(1650, 16) +
  haystack(1790) +
  [[1850, 18], [1874, 12]].map(item => pumpkinAt(item[0], item[1])).join('') +
  fallenLeaves();


// The mark: a turkey seen from the front, 60 by 76, which is the biggest a mark may
// be (markBox in core/marks.js). Nine tail feathers in autumn colours fan out behind
// a round brown body with a pale head, a red wattle and an orange beak. Each feather
// is lit on the left and in shade on the right. The lit half of the middle feather is
// in <g class="double-slash">, which base.css paints with --yellow, the accent colour
// that the Thanksgiving overlay makes amber.

const fanMiddle = { x: 30, y: 52 }; // where the feathers start

// A point at a distance from the middle of the fan, at an angle from straight up
function fanPoint(distance, degrees) {
  const a = degrees * Math.PI / 180;
  return [fanMiddle.x + distance * Math.sin(a), fanMiddle.y - distance * Math.cos(a)];
}

// One tail feather: a kite from a narrow base, out to its widest at 60 percent of
// its length, and on to a point. The inner kite is a second colour at the tip.
function tailFeather(degrees, length, colours, tipColours) {
  const base = fanPoint(7, degrees);
  const left = fanPoint(length * 0.6, degrees - 14);
  const right = fanPoint(length * 0.6, degrees + 14);
  const tip = fanPoint(length, degrees);
  const eyeNear = fanPoint(length * 0.56, degrees);
  const eyeLeft = fanPoint(length * 0.72, degrees - 6);
  const eyeRight = fanPoint(length * 0.72, degrees + 6);
  const eyeFar = fanPoint(length * 0.9, degrees);

  return shape([base, left, tip], colours[0]) + shape([base, tip, right], colours[1]) +
    shape([eyeNear, eyeLeft, eyeFar], tipColours[0]) + shape([eyeNear, eyeFar, eyeRight], tipColours[1]);
}

const turkeyBody = '#9a6232';
const turkeyBodyShade = '#74461f';
const turkeyBreast = '#c99358';
const turkeyBreastShade = '#a9743a';
const turkeyHead = '#f2d7ae';
const turkeyHeadShade = '#d2ab78';
const beak = '#f0a028';
const wattle = '#d8322a';
const legs = '#c08a28';

// The feathers, outer ones first so that the middle ones lie on top: the angle from
// straight up, the length, the colours of the lit and shaded half, and the colours
// of the kite at the tip
const tail = [
  [-80, 27, brown, gold],
  [80, 27, brown, gold],
  [-60, 31, olive, brown],
  [60, 31, olive, brown],
  [-40, 36, red, gold],
  [40, 36, red, gold],
  [-20, 41, orange, red],
  [20, 41, orange, red],
];

const turkeyMark =
  tail.map(item => tailFeather(item[0], item[1], item[2], item[3])).join('') +
  '<g class="double-slash">' + shape([fanPoint(7, 0), fanPoint(27, -14), fanPoint(45, 0)], gold[0]) + '</g>' +
  shape([fanPoint(7, 0), fanPoint(45, 0), fanPoint(27, 14)], gold[1]) +
  shape([fanPoint(25, 0), fanPoint(32.4, -6), fanPoint(40.5, 0)], red[0]) + shape([fanPoint(25, 0), fanPoint(40.5, 0), fanPoint(32.4, 6)], red[1]) +
  // the legs and feet
  block(23.4, 68, 2.6, 6, legs) + block(34, 68, 2.6, 6, legs) +
  shape([[19, 76], [26.2, 76], [25, 72]], legs) + shape([[33.8, 76], [41, 76], [35, 72]], legs) +
  // the body
  shape([[23, 37], [30, 37], [30, 70], [22, 70], [15, 60], [15, 45]], turkeyBody) +
  shape([[30, 37], [37, 37], [45, 45], [45, 60], [38, 70], [30, 70]], turkeyBodyShade) +
  shape([[30, 43], [23, 52], [30, 65]], turkeyBreast) + shape([[30, 43], [30, 65], [37, 52]], turkeyBreastShade) +
  // the head, with its beak and wattle
  shape([[30, 20], [25, 22.4], [23.4, 28], [26, 34.6], [30, 35]], turkeyHead) + shape([[30, 20], [35, 22.4], [36.6, 28], [34, 34.6], [30, 35]], turkeyHeadShade) +
  shape([[27.6, 29], [32.4, 29], [30, 36]], beak) +
  shape([[30, 34.4], [34.4, 34.4], [32.4, 42]], wattle) +
  block(26.2, 24.4, 2.2, 2.2, '#2a1a10') + block(31.6, 24.4, 2.2, 2.2, '#2a1a10');

const mark = { viewBox: '0 0 60 76', markup: turkeyMark };


// The shapes the pieces use, each drawn once

// A spray of leaves and acorns for the cut corner of the large panel: a twig
// rising to the right, with leaves along it and two acorns hanging
const spray = {
  viewBox: '0 0 96 28',
  markup: limb(2, 25, 74, 8, 2.6, 1, trunk, trunkShade) +
    put(maple.make(red), 8, 7, 15, -20, 24, 24) +
    put(oak.make(orange), 26, 4, 7, 55, 16, 28) +
    put(maple.make(gold), 36, 3, 15, 25, 24, 24) +
    put(ginkgo.make(orange), 52, 6, 14, -30, 24, 24) +
    put(oak.make(olive), 66, 3, 7, -20, 16, 28) +
    put(acorn.make(), 24, 16, 8, 0, 14, 18) +
    put(acorn.make(), 56, 12, 8, 0, 14, 18) +
    put(maple.make(brown), 76, 3, 16, 15, 24, 24),
};

// An acorn and a leaf hanging from one stem, for the cut corner of the countdown
const cluster = {
  viewBox: '0 0 22 34',
  markup: block(10.5, 0, 1, 12, stemBrown) +
    put(acorn.make(), 6, 11, 10, 0, 14, 18) +
    put(hanging(elm, olive).make(), 13, 1, 7, 0, 14, 26),
};


const shapes = {
  'maple-red': drawn(maple, red),
  'maple-orange': drawn(maple, orange),
  'maple-gold': drawn(maple, gold),
  'maple-brown': drawn(maple, brown),
  'oak-orange': drawn(oak, orange),
  'oak-brown': drawn(oak, brown),
  'oak-red': drawn(oak, red),
  'oak-gold': drawn(oak, gold),
  'ginkgo-gold': drawn(ginkgo, gold),
  'ginkgo-orange': drawn(ginkgo, orange),
  'acorn': drawn(acorn, null),
  'hang-maple-red': drawn(hanging(maple, red), null),
  'hang-oak-orange': drawn(hanging(oak, orange), null),
  'hang-ginkgo-gold': drawn(hanging(ginkgo, gold), null),
  'hang-elm-olive': drawn(hanging(elm, olive), null),
  'blown-leaf-red': { viewBox: '0 0 12 8', markup: miniLeaf(0.5, 4, 11, 0, red) },
  'blown-leaf-gold': { viewBox: '0 0 12 8', markup: miniLeaf(0.5, 4, 11, 0, gold) },
  'vine-top': vine(1920, 26, 9, 1.5, 30, 11, 330, 10),
  'vine-a': vine(836, 14, 6, 1, 26, 7, 190, 6),
  'vine-b': vine(654, 14, 6, 1, 26, 7, 170, 6),
  'spray': spray,
  'hang-cluster': cluster,
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

  // The corner art a rule gets when it picks none of its own (core/corner-art.js)
  defaults: { cornerArt: 'leaves' },

  // Leaves falling over the panels: eleven of three shapes (maple, oak and ginkgo)
  // and an acorn, in reds, oranges, golds and browns, each tumbling and swaying down
  // on its own slow round. A leaf takes 26 to 46 seconds to cross the screen, so it
  // is only over a letter for a moment, and it is faint enough (opacity .7 to .85)
  // that a word shows through it. The big ones are the faintest and fall fastest.
  // The delays are spread (golden ratio steps round each leaf's own round) so the
  // first screen already has leaves at every height.
  over: [
    { shape: 'maple-red', x: 70, y: 480, size: 44, opacity: 0.72, motion: 'flutter', seconds: 28, delay: -17.3, travel: 1300 },
    { shape: 'oak-orange', x: 215, y: 470, size: 30, opacity: 0.8, motion: 'flutter', seconds: 44, delay: -10.4, travel: 1300 },
    { shape: 'ginkgo-gold', x: 380, y: 490, size: 40, opacity: 0.75, motion: 'flutter', seconds: 30, delay: -25.6, travel: 1300 },
    { shape: 'maple-orange', x: 560, y: 495, size: 38, opacity: 0.78, motion: 'flutter', seconds: 34, delay: -16, travel: 1300 },
    { shape: 'oak-brown', x: 720, y: 470, size: 28, opacity: 0.85, motion: 'flutter', seconds: 46, delay: -4.1, travel: 1300 },
    { shape: 'ginkgo-orange', x: 890, y: 490, size: 38, opacity: 0.78, motion: 'flutter', seconds: 34, delay: -24.1, travel: 1300 },
    { shape: 'maple-brown', x: 1050, y: 490, size: 44, opacity: 0.72, motion: 'flutter', seconds: 26, delay: -8.5, travel: 1300 },
    { shape: 'oak-red', x: 1230, y: 470, size: 30, opacity: 0.8, motion: 'flutter', seconds: 42, delay: -39.6, travel: 1300 },
    { shape: 'maple-gold', x: 1400, y: 490, size: 40, opacity: 0.75, motion: 'flutter', seconds: 30, delay: -16.9, travel: 1300 },
    { shape: 'acorn', x: 1560, y: 500, size: 28, opacity: 0.85, motion: 'flutter', seconds: 44, delay: -7.9, travel: 1300 },
    { shape: 'oak-gold', x: 1700, y: 470, size: 28, opacity: 0.85, motion: 'flutter', seconds: 46, delay: -36.7, travel: 1300 },
    { shape: 'maple-red', x: 1845, y: 490, size: 38, opacity: 0.78, motion: 'flutter', seconds: 32, delay: -13.3, travel: 1300 },
  ],

  // Big, faint leaves falling behind the panels. They show only in the margins, and
  // go behind the frames' edges as they fall. The resting places are in the margins
  // too, so in calm motion they look like leaves that have settled at the edges.
  // Slow, so they never compete with the text.
  back: [
    { shape: 'maple-red', x: 4, y: 600, size: 30, opacity: 0.55, motion: 'fall', seconds: 54, delay: -20, travel: 1500 },
    { shape: 'ginkgo-gold', x: 1888, y: 520, size: 28, opacity: 0.55, motion: 'fall', seconds: 48, delay: -33, travel: 1500 },
  ],

  front: [
    // A leaf falling down each margin and the gap between the columns
    { zone: 'left', shape: 'maple-orange', x: 8, y: 130, size: 14, motion: 'fall', seconds: 24, delay: -6, travel: 800 },
    { zone: 'right', shape: 'maple-red', x: 8, y: 480, size: 14, motion: 'fall', seconds: 22, delay: -15, travel: 900 },
    { zone: 'gutter', shape: 'maple-gold', x: 5, y: 120, size: 10, motion: 'fall', seconds: 17, delay: -7, travel: 420 },

    // A vine along the top edge, with four leaves hanging from it. The two big ones swing
    { zone: 'top', shape: 'vine-top', x: 0, y: 0, size: 1920 },
    { zone: 'top', shape: 'hang-maple-red', x: 300, y: 8, size: 17, motion: 'sway', seconds: 4.6, delay: -1 },
    { zone: 'top', shape: 'hang-oak-orange', x: 880, y: 8, size: 10 },
    { zone: 'top', shape: 'hang-ginkgo-gold', x: 1330, y: 8, size: 17, motion: 'sway', seconds: 5, delay: -2 },
    { zone: 'top', shape: 'hang-elm-olive', x: 1740, y: 7, size: 10 },

    // A thinner vine in each gap above the ticker, with a leaf blowing along it
    { zone: 'string-a', shape: 'vine-a', x: 0, y: 0, size: 836 },
    { zone: 'string-a', shape: 'blown-leaf-red', x: 420, y: 5, size: 11, motion: 'drift', seconds: 26, delay: -10, travel: 1100 },
    { zone: 'string-b', shape: 'vine-b', x: 0, y: 0, size: 654 },
    { zone: 'string-b', shape: 'blown-leaf-gold', x: 330, y: 5, size: 11, motion: 'drift', seconds: 22, delay: -6, travel: 900 },

    // Leaves and acorns in the cut corner of the large panel, and an acorn that
    // swings in the cut corner of the countdown
    { zone: 'corner-a', shape: 'spray', x: 0, y: 0, size: 96 },
    { zone: 'corner-b', shape: 'hang-cluster', x: 15, y: 0, size: 22, motion: 'sway', seconds: 5, delay: -1.5 },
  ],
};
