// The swap of the foundry theme: the pull apart and re-form of core/swap-plan.js. A theme that moves
// differently exports its own numbers under the same names. core/style-loader.js loads this file by the
// id of the theme.

import { swapReform, swapShape, swapTimes } from '../../core/swap-plan.js';
import { easePop, movedStops, plateStops, reformTimes } from '../../core/reform-plan.js';

export const swapVariant = { name: 'pull-apart', times: swapTimes, reform: swapReform, shape: swapShape };

// The kit of the theme for the panel and view transitions (core/reform-draw.js). Everything it draws is its own, in steel and
// hazard yellow: hex bolts, hasps, gusset straps, rivets, real cogs, rams and teeth, and in every region deadbolts that are drawn
// back out of the four edges before anything folds and slammed home last, a hand wheel at the top right, rams on the corner
// diagonals, and a gauge at each bottom corner. The squares are steel plates that slide out of their rack, turn over and are
// slammed back. The straps and the chassis are the steel of the theme (reform-kit.css in this folder). Times are milliseconds of
// the skeleton of three seconds. It borrows nothing from another theme's kit.
const slam = 'cubic-bezier(.7,0,1,.5)';

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

// The pieces are drawn on their own grids and sized by the engine; the colors are classes of reform-kit.css
const pieces = {
  screw: '<svg viewBox="0 0 40 40"><polygon class="fk-rim" points="20,1 37,10.5 37,29.5 20,39 3,29.5 3,10.5"/><polygon class="fk-steel" points="20,6 32.5,13 32.5,27 20,34 7.5,27 7.5,13"/><circle class="fk-dark" cx="20" cy="20" r="5"/></svg>',
  latch: '<svg viewBox="0 0 40 40"><rect class="fk-rim" x="1" y="11" width="38" height="18" rx="2"/><rect class="fk-steel" x="4" y="14" width="32" height="12"/><rect class="fk-hazard" x="4" y="14" width="9" height="12"/><circle class="fk-dark" cx="30" cy="20" r="3"/></svg>',
  brace: '<svg viewBox="0 0 40 40"><rect class="fk-rim" x="0" y="13" width="40" height="14"/><rect class="fk-steel" x="3" y="16" width="34" height="8"/><path class="fk-hazard" d="M7 24 L11 16 H16 L12 24 Z M19 24 L23 16 H28 L24 24 Z"/></svg>',
  rivet: '<svg viewBox="0 0 40 40"><circle class="fk-rim" cx="20" cy="20" r="18"/><circle class="fk-steel" cx="20" cy="20" r="12"/><circle class="fk-hi" cx="16" cy="16" r="4"/></svg>',
  gear: '<svg viewBox="0 0 40 40"><polygon class="fk-rim" points="' + cogPoints(10, 19.5, 15) + '"/><circle class="fk-steel" cx="20" cy="20" r="11"/><circle class="fk-dark" cx="20" cy="20" r="4"/><circle class="fk-dark" cx="20" cy="11" r="2"/><circle class="fk-dark" cx="20" cy="29" r="2"/><circle class="fk-dark" cx="11" cy="20" r="2"/><circle class="fk-dark" cx="29" cy="20" r="2"/></svg>',
  piston: '<svg viewBox="0 0 40 40" preserveAspectRatio="none"><rect class="fk-rim" x="0" y="0" width="40" height="40"/><rect class="fk-steel" x="2" y="5" width="36" height="30"/><rect class="fk-hazard" x="2" y="5" width="8" height="30"/></svg>',
  tooth: '<svg viewBox="0 0 40 40" preserveAspectRatio="none"><path class="fk-rim" d="M2 40 L2 3 L38 40 Z"/><path class="fk-steel" d="M7 36 L7 13 L29 36 Z"/></svg>',
  deadbolt: '<svg viewBox="0 0 120 18" preserveAspectRatio="none"><rect class="fk-bolt-rim" x="0" y="0" width="120" height="18" rx="3"/><rect class="fk-bolt-body" x="3" y="3" width="114" height="12" rx="2"/><rect class="fk-bolt-cap" x="0" y="0" width="16" height="18"/></svg>',
  wheel: '<svg viewBox="-40 -40 80 80"><circle class="fk-wheel-rim" r="34"/><circle class="fk-wheel-ring" r="34"/><circle class="fk-wheel-inner" r="26"/><path class="fk-wheel-spoke" d="M0 0L30 0M0 0L15 26M0 0L-15 26M0 0L-30 0M0 0L-15 -26M0 0L15 -26"/><circle class="fk-wheel-hub" r="7"/></svg>',
  ram: '<svg viewBox="0 0 86 48"><rect class="fk-ram-body" x="1" y="15" width="45" height="18" rx="3"/><rect class="fk-ram-rod" x="44" y="20" width="40" height="8"/></svg>',
  gauge: '<svg viewBox="0 0 40 40"><circle class="fk-gauge-rim" cx="20" cy="20" r="18"/><circle class="fk-gauge-face" cx="20" cy="20" r="14"/><path class="fk-gauge-ticks" d="M8 28L11 25M6 20H10M8 12L11 15M20 6V10M32 12L29 15M34 20H30M32 28L29 25"/></svg>',
  needle: '<svg viewBox="0 0 40 40"><path class="fk-needle" d="M20 20V7"/><circle class="fk-needle-hub" cx="20" cy="20" r="3.5"/></svg>',
};

// A deadbolt: pops in, is drawn back along the edge (dx, dy), waits, is slammed home, and goes. turn is 0 for a bolt on the top or
// bottom edge and 90 for one on a side. order staggers them a little.
function deadboltStops(order, dx, dy, turn) {
  const at = (x, y, size) => 'translate(' + x + 'px,' + y + 'px) rotate(' + turn + 'deg) scale(' + size + ')';

  return [
    [0, at(0, 0, 0), easePop], [90, at(0, 0, 1), 'ease-out'],
    [100 + order * 8, at(0, 0, 1), easePop], [330 + order * 8, at(dx, dy, 1)],
    [2480 + order * 14, at(dx, dy, 1), slam], [2700 + order * 14, at(0, 0, 1)],
    [2880, at(0, 0, 1), easePop], [3000, at(0, 0, 0)],
  ];
}

export function deadbolts(rect) {
  const list = [];
  const across = Math.min(120, Math.round(rect.w / 4 * 0.8));
  const down = Math.min(120, Math.round(rect.h / 3 * 0.8));
  const slide = 44;

  // The bolts of one edge are drawn back the same way, and the opposite edge the other way, so the four edges turn like a pinwheel
  [0.25, 0.5, 0.75].forEach(fraction => list.push({ edge: 'top', x: rect.x + rect.w * fraction, y: rect.y + 7, long: across, turn: 0, dx: -slide, dy: 0 }));
  [0.25, 0.5, 0.75].forEach(fraction => list.push({ edge: 'bottom', x: rect.x + rect.w * fraction, y: rect.y + rect.h - 7, long: across, turn: 0, dx: slide, dy: 0 }));
  [1 / 3, 2 / 3].forEach(fraction => list.push({ edge: 'left', x: rect.x + 7, y: rect.y + rect.h * fraction, long: down, turn: 90, dx: 0, dy: -slide }));
  [1 / 3, 2 / 3].forEach(fraction => list.push({ edge: 'right', x: rect.x + rect.w - 7, y: rect.y + rect.h * fraction, long: down, turn: 90, dx: 0, dy: slide }));

  return list.map((bolt, order) => ({
    role: 'deadbolt', own: true, edge: bolt.edge, x: bolt.x, y: bolt.y, w: bolt.long, h: 18,
    stops: deadboltStops(order, bolt.dx, bolt.dy, bolt.turn),
  }));
}

export function wheelOf(rect, strip) {
  const stops = [[0, 'rotate(0deg)', 'ease-in-out'], [400, 'rotate(-540deg)'], [2500, 'rotate(-540deg)', 'ease-in-out'], [3000, 'rotate(0deg)']];
  return { role: 'wheel', x: rect.x + rect.w - 70, y: strip ? rect.y + 22 : rect.y - 10, w: 80, h: 80, stops: stops };
}

// A ram sits outside a corner and points away from the middle. Its pivot is at the corner of the region and the rod pushes out 26
// pixels while the frame is open. The element is 86 by 48 and turns about the point 23, 24 of it (reform-kit.css).
export function ramsOf(rect) {
  const corners = [[1, 1, 225], [-1, 1, 315], [1, -1, 135], [-1, -1, 45]];

  return corners.map(([sx, sy, angle]) => {
    const rest = 'rotate(' + angle + 'deg) translateX(0px)';
    const out = 'rotate(' + angle + 'deg) translateX(26px)';
    const pivotX = sx > 0 ? rect.x + 17 : rect.x + rect.w - 57;
    const pivotY = sy > 0 ? rect.y - 6 : rect.y + rect.h + 6;
    const stops = [[0, rest], [300, rest, easePop], [1060, out], [1950, out, easePop], [2610, rest]];

    return { role: 'ram', x: pivotX + 20, y: pivotY, w: 86, h: 48, stops: stops };
  });
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

// What a region gets that the Original kit does not give it. A thin strip (the banner and the ticker) has no room for the rams and
// the gauges and keeps the deadbolts and the wheel.
export function partsOf(rect, strip) {
  const list = deadbolts(rect).concat([wheelOf(rect, strip)]);
  return strip ? list : list.concat(ramsOf(rect), gaugesOf(rect));
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
  const there = partsOf(region.to, strip);
  const round = value => Math.round(value * 100) / 100;

  layer.className = 'reform-hardware';
  partsOf(region.from, strip).forEach((item, index) => {
    const element = document.createElement('div');
    element.className = 'reform-part reform-' + item.role;
    element.style.cssText = 'left:' + round(item.x - item.w / 2) + 'px;top:' + round(item.y - item.h / 2) + 'px;width:' + round(item.w) + 'px;height:' + round(item.h) + 'px;';
    element.innerHTML = pieces[item.role];
    layer.appendChild(element);
    const moved = movedStops(item.stops, { dx: round(there[index].x - item.x), dy: round(there[index].y - item.y) });
    tracks.add(element, 'transform', item.own === true ? moved : grown(moved));
  });
  return layer;
}

// The stage is shaken when the bolts first break and again when they lock: a few pixels, transform only
function jolt() {
  const at = (x, y) => 'translate(' + x + 'px,' + y + 'px)';

  return [
    [0, at(0, 0)], [100, at(0, 0), 'linear'], [110, at(3, 2)], [140, at(-2, -1)], [170, at(0, 0)],
    [2830, at(0, 0), 'linear'], [2840, at(5, 3)], [2880, at(-4, -2)], [2920, at(0, 0)], [3000, at(0, 0)],
  ];
}

// A steel plate slides out of its rack along the line it turns on, turns over while it is out and is slammed back in (plateStops in
// core/reform-plan.js, which holds the 3D that a kit file may not). The plates of a region that changes place travel while they turn.
function squares(square, move) {
  return plateStops(square, move, slam);
}


// The Light transition (core/reform-light.js): two hazard striped steel doors close over the region, two deadbolts are driven
// across the seam where they meet and two cogs turn in the corners. A part is { cls, markup, x, y, w, h, close, open }.
function light(width, height) {
  const long = Math.round(Math.min(width * 0.2, 140));
  const cog = Math.round(Math.max(14, Math.min(56, height * 0.22)));
  const edge = Math.round(cog * 0.3);
  const list = [0.3, 0.7].map(share => ({
    cls: 'fk-light-bolt', markup: pieces.deadbolt, x: Math.round(width / 2 - long / 2), y: Math.round(height * share - 9), w: long, h: 18,
    close: [{ transform: 'translateX(-44px) scaleX(0)' }, { transform: 'translateX(-44px) scaleX(0)', offset: 0.6 }, { transform: 'translateX(0px) scaleX(1)' }],
    open: [{ transform: 'translateX(0px) scaleX(1)' }, { transform: 'translateX(-44px) scaleX(1)', offset: 0.35 }, { transform: 'translateX(-44px) scaleX(0)' }],
  }));

  [[edge, edge, 1], [width - edge - cog, height - edge - cog, -1]].forEach(([x, y, direction]) => list.push({
    cls: 'fk-light-gear', markup: pieces.gear, x: x, y: y, w: cog, h: cog,
    close: [{ transform: 'rotate(0deg) scale(0)' }, { transform: 'rotate(' + direction * 270 + 'deg) scale(1)' }],
    open: [{ transform: 'rotate(' + direction * 270 + 'deg) scale(1)' }, { transform: 'rotate(' + direction * 540 + 'deg) scale(0)' }],
  }));
  return list;
}

export const kit = {
  id: 'foundry',
  // no cells with lock pins: its own deadbolts, rams and gauges already fill the frame
  draw: role => pieces[role] === undefined ? '' : pieces[role],
  squares: squares,
  extras: extras,
  partsOf: partsOf,
  jolt: jolt,
  light: light,
};
