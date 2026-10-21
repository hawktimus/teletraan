// The swap of the foundry theme: the pull apart and re-form of core/swap-plan.js. A theme that moves
// differently exports its own numbers under the same names. core/style-loader.js loads this file by the
// id of the theme.

import { swapReform, swapShape, swapTimes } from '../../core/swap-plan.js';
import { easePop, movedStops, plateStops, reformTimes, windowOf } from '../../core/reform-plan.js';

export const swapVariant = { name: 'pull-apart', times: swapTimes, reform: swapReform, shape: swapShape };

// The kit of the theme for the panel and view transitions (core/reform-draw.js). It is the machinery of a fort, in gunmetal and
// hazard yellow (reform-kit.css in this folder draws every piece): hex bolts, hook latches, gusset straps, rivets and real cogs
// on the frame, and in every region deadbolts that are drawn back out of the four edges before anything folds and slammed home last
// (with a seat and a settle), a hand wheel at the top right with a clamp ring round it, hydraulic rams (a cylinder and a rod that
// is pushed out of it) on the corner diagonals, and a gauge at each bottom corner. The large panel also has two bulkhead shutters
// that close over it from the sides (a locking bar is driven across the seam) and open again, and (in the panel transition) a train of
// seven cogs that mesh and turn under it. The squares are steel plates that slide out of their rack, turn over and are slammed back. The
// straps and the chassis are the gunmetal of the theme. Times are milliseconds of the skeleton of three seconds.
//
// The sequence: the structure unlocks (the bolts spin out and the deadbolts are drawn back, the hooks open, the clamp ring loosens
// and the rams push out), the shutters close and open, the plates slide away and turn while the cogs turn through the change,
// and then everything locks: the bars are slammed home and settle, the rams draw back, the ring clamps and the bolts drive in.
const slam = 'cubic-bezier(.7,0,1,.5)';
const settleMs = 70; // a bar that is slammed home goes on by a few pixels and comes back in this long

// A cog: a polygon with this many teeth, on a 40 by 40 grid
function cogPoints(teeth, outer, inner) {
  const points = [];
  for (let step = 0; step < teeth * 4; step += 1) {
    const angle = Math.PI * 2 * (step - 0.5) / (teeth * 4);
    const radius = step % 4 === 1 || step % 4 === 2 ? outer : inner;
    points.push(Math.round((20 + Math.cos(angle) * radius) * 10) / 10 + ',' + Math.round((20 + Math.sin(angle) * radius) * 10) / 10);
  }
  return points.join(' ');
}

// A cog with a rim, a face, a ring and four holes round the hub
function cogMarkup(teeth) {
  return '<svg viewBox="0 0 40 40"><polygon class="fk-rim" points="' + cogPoints(teeth, 19.6, 15) + '"/><polygon class="fk-face" points="' + cogPoints(teeth, 17.4, 13.2) + '"/>' +
    '<circle class="fk-dark" cx="20" cy="20" r="10.5"/><circle class="fk-face" cx="20" cy="20" r="8.2"/>' +
    '<circle class="fk-dark" cx="20" cy="13" r="1.9"/><circle class="fk-dark" cx="20" cy="27" r="1.9"/><circle class="fk-dark" cx="13" cy="20" r="1.9"/><circle class="fk-dark" cx="27" cy="20" r="1.9"/>' +
    '<circle class="fk-hub" cx="20" cy="20" r="3.6"/></svg>';
}

// The pieces are drawn on their own grids and sized by the engine; the colors are classes of reform-kit.css
const pieces = {
  screw: '<svg viewBox="0 0 40 40"><polygon class="fk-rim" points="20,1 37,10.5 37,29.5 20,39 3,29.5 3,10.5"/><polygon class="fk-face" points="20,5.5 33,13 33,27 20,34.5 7,27 7,13"/><path class="fk-lit" d="M7 27V13L20 5.5H33"/><circle class="fk-dark" cx="20" cy="20" r="5.5"/><path class="fk-slot" d="M16.5 20H23.5"/></svg>',
  latch: '<svg viewBox="0 0 40 40"><path class="fk-hook" d="M2 13H27Q38 13 38 23Q38 33 28 33H22V27H28Q31 27 31 23Q31 19 27 19H2Z"/><path class="fk-lit" d="M3 18V14H27Q35 14 37 20"/><rect class="fk-cap" x="2" y="13" width="8" height="6"/><circle class="fk-dark" cx="6" cy="16" r="1.7"/></svg>',
  brace: '<svg viewBox="0 0 40 40"><rect class="fk-rim" x="0" y="12" width="40" height="16"/><rect class="fk-plate" x="2.5" y="14.5" width="35" height="11"/><path class="fk-lit" d="M2.5 25.5V14.5H37.5"/><path class="fk-hazard" d="M7 25.5L11 14.5H16L12 25.5Z M19 25.5L23 14.5H28L24 25.5Z"/></svg>',
  rivet: '<svg viewBox="0 0 40 40"><circle class="fk-rim" cx="20" cy="20" r="18"/><circle class="fk-face" cx="20" cy="20" r="13"/><path class="fk-lit" d="M10.5 24A11 11 0 0 1 24 10.5"/></svg>',
  gear: cogMarkup(10),
  cog: cogMarkup(12),
  cogs: cogMarkup(9),
  piston: '<svg viewBox="0 0 40 40" preserveAspectRatio="none"><rect class="fk-rim" x="0" y="0" width="40" height="40"/><rect class="fk-plate" x="2" y="5" width="36" height="30"/><path class="fk-seam" d="M16 5V35M28 5V35"/><rect class="fk-hazard" x="2" y="5" width="6" height="30"/></svg>',
  tooth: '<svg viewBox="0 0 40 40" preserveAspectRatio="none"><path class="fk-rim" d="M2 40 L2 3 L38 40 Z"/><path class="fk-plate" d="M7 36 L7 13 L29 36 Z"/></svg>',
  deadbolt: '<svg viewBox="0 0 120 18" preserveAspectRatio="none"><rect class="fk-rim" x="0" y="0" width="120" height="18" rx="3"/><rect class="fk-bar" x="2.5" y="2.5" width="115" height="13" rx="2"/><path class="fk-lit" d="M4 4.5H116"/><path class="fk-seam" d="M34 3V15M64 3V15M94 3V15"/><rect class="fk-cap" x="0" y="0" width="16" height="18"/></svg>',
  wheel: '<svg viewBox="-40 -40 80 80"><circle class="fk-wheel-rim" r="34"/><circle class="fk-wheel-ring" r="34"/><circle class="fk-wheel-inner" r="26"/><path class="fk-wheel-spoke" d="M0 0L30 0M0 0L15 26M0 0L-15 26M0 0L-30 0M0 0L-15 -26M0 0L15 -26"/><path class="fk-lit" d="M-27 -21A34 34 0 0 1 -6 -33.5"/><circle class="fk-wheel-hub" r="7"/></svg>',
  ring: '<svg viewBox="-50 -50 100 100"><circle class="fk-ring-dark" r="44"/><circle class="fk-ring" r="44"/><path class="fk-lit" d="M-32 -30A44 44 0 0 1 -8 -43"/><rect class="fk-ring-ear" x="38" y="-11" width="14" height="22" rx="2"/><circle class="fk-dark" cx="45" cy="-4" r="2.4"/><circle class="fk-dark" cx="45" cy="4" r="2.4"/></svg>',
  ram: '<svg viewBox="0 0 86 48"><rect class="fk-ram-body" x="1" y="14" width="48" height="20" rx="3"/><path class="fk-seam" d="M17 14V34M35 14V34"/><path class="fk-lit" d="M4 16.5H46"/><circle class="fk-dark" cx="8" cy="24" r="3.2"/></svg>',
  rod: '<svg viewBox="0 0 86 48"><rect class="fk-ram-rod" x="46" y="20" width="38" height="8"/><path class="fk-lit" d="M47 22.5H82"/><rect class="fk-cap" x="80" y="16" width="5" height="16"/></svg>',
  gauge: '<svg viewBox="0 0 40 40"><circle class="fk-gauge-rim" cx="20" cy="20" r="18"/><circle class="fk-gauge-face" cx="20" cy="20" r="14"/><path class="fk-gauge-ticks" d="M8 28L11 25M6 20H10M8 12L11 15M20 6V10M32 12L29 15M34 20H30M32 28L29 25"/></svg>',
  needle: '<svg viewBox="0 0 40 40"><path class="fk-needle" d="M20 20V7"/><circle class="fk-needle-hub" cx="20" cy="20" r="3.5"/></svg>',
  leaf: '<span class="fk-leaf-plate"></span>',
};
pieces.seam = pieces.deadbolt;

// A deadbolt: pops in, is drawn back along the edge (dx, dy), waits, is slammed home with a seat (it goes on by 3 pixels and
// settles back) and goes. turn is 0 for a bolt on the top or bottom edge and 90 for one on a side. order staggers them a little.
function deadboltStops(order, dx, dy, turn) {
  const at = (x, y, size) => 'translate(' + x + 'px,' + y + 'px) rotate(' + turn + 'deg) scale(' + size + ')';
  const ox = dx === 0 ? 0 : -Math.sign(dx) * 3;
  const oy = dy === 0 ? 0 : -Math.sign(dy) * 3;

  return [
    [0, at(0, 0, 0), easePop], [90, at(0, 0, 1), 'ease-out'],
    [100 + order * 8, at(0, 0, 1), easePop], [330 + order * 8, at(dx, dy, 1)],
    [2480 + order * 14, at(dx, dy, 1), slam], [2650 + order * 14, at(ox, oy, 1), 'ease-out'], [2650 + order * 14 + settleMs, at(0, 0, 1)],
    [2880, at(0, 0, 1), easePop], [3000, at(0, 0, 0)],
  ];
}

export function deadbolts(rect, few = false) {
  const list = [];
  const across = Math.min(120, Math.round(rect.w / 4 * 0.8));
  const down = Math.min(120, Math.round(rect.h / 3 * 0.8));
  const slide = 44;

  // The bolts of one edge are drawn back the same way, and the opposite edge the other way, so the four edges turn like a pinwheel
  const fractions = few ? [1 / 3, 2 / 3] : [0.25, 0.5, 0.75];
  fractions.forEach(fraction => list.push({ edge: 'top', x: rect.x + rect.w * fraction, y: rect.y + 7, long: across, turn: 0, dx: -slide, dy: 0 }));
  fractions.forEach(fraction => list.push({ edge: 'bottom', x: rect.x + rect.w * fraction, y: rect.y + rect.h - 7, long: across, turn: 0, dx: slide, dy: 0 }));
  [1 / 3, 2 / 3].forEach(fraction => list.push({ edge: 'left', x: rect.x + 7, y: rect.y + rect.h * fraction, long: down, turn: 90, dx: 0, dy: -slide }));
  [1 / 3, 2 / 3].forEach(fraction => list.push({ edge: 'right', x: rect.x + rect.w - 7, y: rect.y + rect.h * fraction, long: down, turn: 90, dx: 0, dy: slide }));

  return list.map((bolt, order) => ({
    role: 'deadbolt', own: true, edge: bolt.edge, x: bolt.x, y: bolt.y, w: bolt.long, h: 18,
    stops: deadboltStops(order, bolt.dx, bolt.dy, bolt.turn),
  }));
}

// The hand wheel at the top right: it is turned open by one and a half turns and shut again at the end
export function wheelOf(rect, strip) {
  const stops = [[0, 'rotate(0deg)', 'ease-in-out'], [400, 'rotate(-540deg)'], [2500, 'rotate(-540deg)', 'ease-in-out'], [3000, 'rotate(0deg)']];
  return { role: 'wheel', x: rect.x + rect.w - 70, y: strip ? rect.y + 22 : rect.y - 10, w: 80, h: 80, stops: stops };
}

// The clamp ring round the wheel: it opens (turns back and swells) as the structure unlocks, and clamps shut, with a settle, at the end
export function ringOf(rect, strip) {
  const wheel = wheelOf(rect, strip);
  const at = (turn, size) => 'rotate(' + turn + 'deg) scale(' + size + ')';
  const stops = [[0, at(0, 1), easePop], [350, at(-70, 1.22)], [2420, at(-70, 1.22), slam], [2760, at(6, 0.97), 'ease-out'], [2840, at(0, 1)]];

  return { role: 'ring', x: wheel.x, y: wheel.y, w: 106, h: 106, stops: stops };
}

// Rams sit outside the corners and point away from the middle. Each is a cylinder that stays and a rod that is pushed out of it: 34 pixels
// while the frame is open. Both turn about the point where the cylinder meets the corner. The element is 86 by 48 and turns about the
// point 23, 24 of it (reform-kit.css).
export function ramsOf(rect) {
  const corners = [[1, 1, 225], [-1, 1, 315], [1, -1, 135], [-1, -1, 45]];
  const list = [];

  corners.forEach(([sx, sy, angle]) => {
    const rest = 'rotate(' + angle + 'deg) translateX(0px)';
    const out = 'rotate(' + angle + 'deg) translateX(34px)';
    const pivotX = sx > 0 ? rect.x + 17 : rect.x + rect.w - 57;
    const pivotY = sy > 0 ? rect.y - 6 : rect.y + rect.h + 6;

    list.push({ role: 'ram', x: pivotX + 20, y: pivotY, w: 86, h: 48, stops: [[0, rest]] });
    list.push({ role: 'rod', x: pivotX + 20, y: pivotY, w: 86, h: 48, stops: [[0, rest], [300, rest, easePop], [760, out], [1950, out, easePop], [2620, rest, slam], [2700, 'rotate(' + angle + 'deg) translateX(-3px)', 'ease-out'], [2770, rest]] });
  });
  return list;
}

// A gauge at each bottom corner: a face that stays, and a needle that sweeps across and back while the mechanism runs
export function gaugesOf(rect) {
  const list = [];
  const rest = 'rotate(-135deg)';
  const sweep = [[0, rest], [600, 'rotate(120deg)', 'ease-in-out'], [1100, 'rotate(135deg)', 'ease-in-out'], [1600, 'rotate(105deg)', 'ease-in-out'], [2000, 'rotate(130deg)', 'ease-in-out'], [2300, 'rotate(135deg)', easePop], [3000, rest]];

  [rect.x + 80, rect.x + rect.w - 80].forEach(x => {
    const y = rect.y + rect.h + 18;
    list.push({ role: 'gauge', x: x, y: y, w: 40, h: 40, stops: [[0, 'rotate(0deg)']] });
    list.push({ role: 'needle', x: x, y: y, w: 40, h: 40, stops: sweep });
  });
  return list;
}

// A train of cogs under the large panel, in mesh: two sizes, one after the other, each turning the other way from the one before it,
// the small one faster by the ratio of the teeth. They turn through the whole change.
export function trainOf(rect, count) {
  const big = 92;
  const small = 66;
  const pitch = (big + small) / 2 * 0.93;
  const left = rect.x + rect.w / 2 - pitch * (count - 1) / 2;
  const list = [];

  for (let index = 0; index < count; index += 1) {
    const isBig = index % 2 === 0;
    const size = isBig ? big : small;
    const turn = (isBig ? 540 : 720) * (isBig ? 1 : -1);
    const at = angle => 'rotate(' + angle + 'deg)';
    list.push({ role: isBig ? 'cog' : 'cogs', x: left + pitch * index, y: rect.y + rect.h + 52, w: size, h: size, stops: [[0, at(0), 'ease-in-out'], [1500, at(turn / 2), 'ease-in-out'], [3000, at(turn)]] });
  }
  return list;
}

// The two bulkhead shutters of the large panel: a leaf from each side closes over the window (0.45 to 0.95) with a settle where
// they meet, a locking bar is driven down across the seam, and then the bar is drawn back and the leaves open (1.05 to 1.45), before
// the squares have turned. A leaf is a clip the size of half the window and the plate that slides in it.
function leafStops(side) {
  const out = 'translateX(' + side * 102 + '%)';
  const home = 'translateX(0%)';
  const bounce = 'translateX(' + side * 1.6 + '%)';

  return [[0, out], [450, out, 'cubic-bezier(.45,0,.55,1)'], [940, home, slam], [985, bounce, 'ease-out'], [1030, home], [1060, home, 'cubic-bezier(.45,0,.2,1)'], [1450, out]];
}

export function leavesOf(rect) {
  const win = windowOf(rect);
  const half = Math.round(win.w / 2);
  const rightWidth = win.w - half;
  const list = [];
  const still = [[0, 'translate(0px,0px)']];

  list.push({ role: 'leaf', own: true, x: win.x + (half + 1) / 2, y: win.y + win.h / 2, w: half + 1, h: win.h, stops: still, inner: leafStops(-1) });
  list.push({ role: 'leaf', own: true, x: win.x + half + rightWidth / 2, y: win.y + win.h / 2, w: rightWidth, h: win.h, stops: still, inner: leafStops(1), right: true });

  // the locking bar across the seam where they meet: pops in above it, is driven down across it, is drawn back
  const at = (y, size) => 'translate(0px,' + y + 'px) rotate(90deg) scale(' + size + ')';
  list.push({
    role: 'seam', own: true, x: win.x + half, y: win.y + win.h / 2, w: Math.round(win.h * 0.86), h: 22,
    stops: [[0, at(-60, 0)], [840, at(-60, 0), easePop], [870, at(-60, 1)], [940, at(-60, 1), slam], [985, at(4, 1), 'ease-out'], [1030, at(0, 1)], [1060, at(0, 1), 'ease-in-out'], [1160, at(-60, 1), easePop], [1200, at(-60, 0)], [3000, at(-60, 0)]],
  });
  return list;
}

// What a region gets that the Original kit does not give it. A thin strip (the banner and the ticker) has no room for the rams and
// the gauges and keeps the deadbolts, the wheel and its ring. options.mode is 'panel' (the panel transition, the default) or 'view'
// (the view transition draws four regions at once, so it leaves the gauges out); options.main is true for the large panel, which
// alone has the shutters, and the panel transition the train of cogs.
export function partsOf(rect, strip, options = {}) {
  const view = options.mode === 'view';
  const main = !strip && (view ? options.main === true : options.main !== false);
  // the view draws four regions at once and has room for 500 animated elements: a strip has two bolts on each long edge and no ring,
  // and only the large panel has the ring and the shutters
  const list = deadbolts(rect, view && strip).concat(view && (strip || !options.main) ? [wheelOf(rect, strip)] : [ringOf(rect, strip), wheelOf(rect, strip)]);
  if (strip) return list;

  list.push(...ramsOf(rect));
  if (!view) list.push(...gaugesOf(rect));
  if (main) list.push(...leavesOf(rect));
  if (main && !view) list.push(...trainOf(rect, 7));
  return list;
}

// The pieces that are not bolts come out of nothing as the transition starts and go back into nothing at the end, as the pieces of
// the Original kit do (every transform gets scale(1) in front, so the track has the same functions all through)
const growMs = 260;
function grown(stops) {
  const first = stops[0][1];
  const last = stops[stops.length - 1][1];
  const middle = stops.filter(stop => stop[0] > growMs && stop[0] < reformTimes.totalMs - growMs).map(stop => [stop[0], 'scale(1) ' + stop[1], stop[2]]);

  return [[0, 'scale(0) ' + first, easePop], [growMs, 'scale(1) ' + first]].concat(middle, [[reformTimes.totalMs - growMs, 'scale(1) ' + last, easePop], [reformTimes.totalMs, 'scale(0) ' + last]]);
}

// The hook of core/reform-draw.js: one element with the parts of a region, and their tracks. A region that changes place (a view
// transition) takes its parts along while its edges are folded.
function extras(region, tracks, strip) {
  const layer = document.createElement('div');
  const options = { mode: String(region.grid).startsWith('view') ? 'view' : 'panel', main: region.role === 'main' };
  const there = partsOf(region.to, strip, options);
  const round = value => Math.round(value * 100) / 100;

  layer.className = 'reform-hardware';
  partsOf(region.from, strip, options).forEach((item, index) => {
    const element = document.createElement('div');
    element.className = 'reform-part reform-' + item.role + (item.right ? ' reform-right' : '');
    element.style.cssText = 'left:' + round(item.x - item.w / 2) + 'px;top:' + round(item.y - item.h / 2) + 'px;width:' + round(item.w) + 'px;height:' + round(item.h) + 'px;';
    element.innerHTML = pieces[item.role];
    layer.appendChild(element);
    const moved = movedStops(item.stops, { dx: round(there[index].x - item.x), dy: round(there[index].y - item.y) });
    tracks.add(element, 'transform', item.own === true ? moved : grown(moved));
    if (item.inner) tracks.add(element.firstElementChild, 'transform', item.inner);
  });
  return layer;
}

// The stage is shaken when the bolts first break, when the shutters meet and again when the bolts lock: a few pixels, transform only
function jolt() {
  const at = (x, y) => 'translate(' + x + 'px,' + y + 'px)';

  return [
    [0, at(0, 0)], [100, at(0, 0), 'linear'], [110, at(3, 2)], [140, at(-2, -1)], [170, at(0, 0)],
    [945, at(0, 0), 'linear'], [955, at(-3, 2)], [985, at(2, -1)], [1015, at(0, 0)],
    [2830, at(0, 0), 'linear'], [2840, at(5, 3)], [2880, at(-4, -2)], [2920, at(0, 0)], [3000, at(0, 0)],
  ];
}

// A steel plate slides out of its rack along the line it turns on, turns over while it is out and is slammed back in (plateStops in
// core/reform-plan.js, which holds the 3D that a kit file may not). The plates of a region that changes place travel while they turn.
function squares(square, move) {
  return plateStops(square, move, slam);
}


// The Light transition (core/reform-light.js): two bulkhead shutters with a hazard striped lip close over the region, two deadbolts are
// driven across the seam where they meet (with a seat and a settle), a hand wheel turns on the seam and a pair of cogs in mesh turn
// below it. A part is { cls, markup, x, y, w, h, close, open }. The bolts, the wheel and the cogs are the pieces of the heavy
// transitions, so it is the same vocabulary with fewer parts: at most 7 of them in a region.
function light(width, height, role) {
  const big = role === 'main' || role === 'side';
  const long = Math.round(Math.min(width * 0.2, 140));
  const list = [0.3, 0.7].map(share => ({
    cls: 'fk-light-bolt', markup: pieces.deadbolt, x: Math.round(width / 2 - long / 2), y: Math.round(height * share - 9), w: long, h: 18,
    close: [{ transform: 'translateX(-44px) scaleX(0)' }, { transform: 'translateX(-44px) scaleX(0)', offset: 0.55 }, { transform: 'translateX(4px) scaleX(1)', offset: 0.9 }, { transform: 'translateX(0px) scaleX(1)' }],
    open: [{ transform: 'translateX(0px) scaleX(1)' }, { transform: 'translateX(-44px) scaleX(1)', offset: 0.35 }, { transform: 'translateX(-44px) scaleX(0)' }],
  }));

  if (big && height >= 360) {
    const wheel = Math.round(Math.min(76, width * 0.2));
    list.push({
      cls: 'fk-light-wheel', markup: pieces.wheel, x: Math.round(width / 2 - wheel / 2), y: Math.round(height / 2 - wheel / 2), w: wheel, h: wheel,
      close: [{ transform: 'rotate(0deg) scale(0)' }, { transform: 'rotate(-270deg) scale(1)' }],
      open: [{ transform: 'rotate(-270deg) scale(1)' }, { transform: 'rotate(-540deg) scale(0)' }],
    });
  }

  // a pair of cogs in mesh below the seam, or one cog on a strip
  const first = big ? Math.round(Math.min(72, height * 0.12)) : Math.round(Math.max(14, Math.min(44, height * 0.26)));
  const second = Math.round(first * 0.72);
  const pitch = (first + second) / 2 * 0.93;
  const turn = (direction, ratio) => ({
    close: [{ transform: 'rotate(0deg) scale(0)' }, { transform: 'rotate(' + direction * 270 * ratio + 'deg) scale(1)' }],
    open: [{ transform: 'rotate(' + direction * 270 * ratio + 'deg) scale(1)' }, { transform: 'rotate(' + direction * 540 * ratio + 'deg) scale(0)' }],
  });

  if (big) {
    list.push(Object.assign({ cls: 'fk-light-gear', markup: pieces.cog, x: Math.round(width / 2 - pitch / 2 - first / 2), y: Math.round(height - first - 14), w: first, h: first }, turn(1, 1)));
    list.push(Object.assign({ cls: 'fk-light-gear', markup: pieces.cogs, x: Math.round(width / 2 + pitch / 2 - second / 2), y: Math.round(height - first - 14 + (first - second) / 2), w: second, h: second }, turn(-1, 1.33)));
  } else {
    list.push(Object.assign({ cls: 'fk-light-gear', markup: pieces.cog, x: Math.round(width / 2 - first / 2), y: Math.round(height / 2 - first / 2), w: first, h: first }, turn(1, 1)));
  }
  return list;
}

export const kit = {
  id: 'foundry',
  // no cells with lock pins: its own deadbolts, rams, shutters and cogs already fill the frame
  draw: role => pieces[role] === undefined ? '' : pieces[role],
  squares: squares,
  extras: extras,
  partsOf: partsOf,
  jolt: jolt,
  light: light,
};
