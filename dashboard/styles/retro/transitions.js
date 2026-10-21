// The swap of the retro theme: the pull apart and re-form of core/swap-plan.js. A theme that moves
// differently exports its own numbers under the same names. core/style-loader.js loads this file by the
// id of the theme.

import { swapReform, swapShape, swapTimes } from '../../core/swap-plan.js';
import { cornersOf, easePop, jointTimes, movedStops, reformTimes, squareShadeStops, squareStops } from '../../core/reform-plan.js';

export const swapVariant = { name: 'pull-apart', times: swapTimes, reform: swapReform, shape: swapShape };

// The kit of the theme for the panel and view transitions (core/reform-draw.js, docs/transitions.md): a classic cartoon. It is the
// playful theme, so it moves the way a cartoon does, on the same skeleton as every kit:
//
//   anticipation   the stage squashes down and the screws dip before they pop; a joint and a square wind up before the move
//   squash/stretch squares squash, stretch while they turn and squash again on landing; the stage squashes as the frame locks
//   bounce         joints, squares, screws and the star settle with smaller and smaller overshoots (the spring ease)
//   comic marks    poof clouds at the corners, a jagged starburst, spinning stars, speed lines, motion streaks and sparkles
//   curtain        a band with a scalloped edge wipes across the panel as the squares turn
//   wobble         the whole stage jiggles on the wind-up, the launch and the landing
//
// The colors are in tokens.css (--retro-*) and the styles are in reform-kit.css. Only transform and opacity move.
const spring = 'cubic-bezier(.34,1.56,.64,1)';
const sparkleMs = [2500, 2640, 2820]; // the sparkles pop in as the frame locks, and are gone before the screws seat
const round = value => Math.round(value * 10) / 10;

// The drawing of each piece of hardware, on a 40 x 40 grid. The class says the color: ink is the outline, pop the body, paper the highlight.
const pieces = {
  screw: '<svg viewBox="0 0 40 40"><polygon class="rr-ink" points="20,1 37,10 37,30 20,39 3,30 3,10"/><polygon class="rr-pop" points="20,6 32,13 32,27 20,34 8,27 8,13"/><rect class="rr-ink" x="9" y="17" width="22" height="6"/></svg>',
  latch: '<svg viewBox="0 0 40 40"><rect class="rr-ink" x="1" y="10" width="38" height="20" rx="6"/><rect class="rr-pop" x="5" y="14" width="30" height="12" rx="3"/><circle class="rr-ink" cx="11" cy="20" r="3.5"/></svg>',
  brace: '<svg viewBox="0 0 40 40"><rect class="rr-ink" x="0" y="12" width="40" height="16"/><rect class="rr-pop" x="4" y="16" width="32" height="8"/><rect class="rr-paper" x="7" y="17.5" width="12" height="2.5"/></svg>',
  rivet: '<svg viewBox="0 0 40 40"><circle class="rr-ink" cx="20" cy="20" r="18"/><circle class="rr-pop" cx="20" cy="20" r="12"/><circle class="rr-paper" cx="16" cy="16" r="4"/></svg>',
  gear: '<svg viewBox="0 0 40 40"><polygon class="rr-ink" points="20,0 25,8 34,6 32,15 40,20 32,25 34,34 25,32 20,40 15,32 6,34 8,25 0,20 8,15 6,6 15,8"/><circle class="rr-pop" cx="20" cy="20" r="10"/><circle class="rr-ink" cx="20" cy="20" r="4"/></svg>',
  piston: '<svg viewBox="0 0 40 40" preserveAspectRatio="none"><rect class="rr-ink" x="0" y="0" width="40" height="40"/><rect class="rr-pop" x="4" y="8" width="32" height="24"/></svg>',
  tooth: '<svg viewBox="0 0 40 40" preserveAspectRatio="none"><path class="rr-ink" d="M2 40 L10 2 L30 2 L38 40 Z"/><path class="rr-pop" d="M10 40 L14 9 L26 9 L30 40 Z"/></svg>',
  chassis: '',
};

// A jagged comic burst on a grid centered on 0: 14 spikes of uneven length, so it reads as a hit and not as a badge
const spikes = [1, 0.78, 0.96, 0.7, 1, 0.82, 0.92, 0.74, 1, 0.8, 0.94, 0.72, 0.98, 0.76];

function burstPoints(outer, inner) {
  const points = [];
  for (let index = 0; index < spikes.length * 2; index += 1) {
    const radius = index % 2 === 0 ? outer * spikes[index / 2] : inner;
    const angle = (Math.PI * index) / spikes.length;
    points.push(Math.round(Math.cos(angle) * radius * 10) / 10 + ',' + Math.round(Math.sin(angle) * radius * 10) / 10);
  }
  return points.join(' ');
}

function starMarkup() {
  return '<svg viewBox="-300 -300 600 600"><polygon class="rr-ink rr-line" points="' + burstPoints(290, 150) + '"/><polygon class="rr-pop" points="' + burstPoints(240, 124) + '"/><polygon class="rr-hot" points="' + burstPoints(160, 84) + '"/><polygon class="rr-paper" points="' + burstPoints(88, 46) + '"/></svg>';
}

// A poof: a cloud with a scalloped edge of nine bumps, with a hot core
function cloudPath(radius, bump, count) {
  let path = '';
  for (let index = 0; index <= count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const at = Math.round(Math.cos(angle) * radius * 10) / 10 + ' ' + Math.round(Math.sin(angle) * radius * 10) / 10;
    path += index === 0 ? 'M' + at : ' A' + bump + ' ' + bump + ' 0 0 1 ' + at;
  }
  return path + ' Z';
}

const poofMarkup = '<svg viewBox="-40 -40 80 80"><path class="rr-paper rr-line" d="' + cloudPath(24, 9.5, 9) + '"/><path class="rr-hot" d="' + cloudPath(11, 5, 7) + '"/></svg>';

// A five point star of line art, for the stars that spin out of the burst
function fivePoints(outer, inner) {
  const points = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * index) / 5 - Math.PI / 2;
    points.push(Math.round(Math.cos(angle) * radius * 10) / 10 + ',' + Math.round(Math.sin(angle) * radius * 10) / 10);
  }
  return points.join(' ');
}

const smallStarMarkup = '<svg viewBox="-20 -20 40 40"><polygon class="rr-ink rr-line" points="' + fivePoints(18, 8) + '"/><polygon class="rr-pop" points="' + fivePoints(18, 8) + '"/></svg>';

const sparklePoints = '0,-18 4,-4 18,0 4,4 0,18 -4,4 -18,0 -4,-4';
const sparkleMarkup = '<svg viewBox="-20 -20 40 40"><polygon class="rr-ink rr-line" points="' + sparklePoints + '"/><polygon class="rr-pop" points="' + sparklePoints + '"/></svg>';

// The scalloped edge of a curtain, on a strip as tall as the curtain: bumps that lean right (lean 1) or left (lean -1). It is drawn in
// pixels, so the bumps are round at any height. x = 0 is the edge of the curtain's body.
function scallopMarkup(height, lean) {
  const count = Math.max(1, Math.round(height / 70));
  const radius = height / count / 2;
  const width = Math.ceil(radius) + 4;
  let path = 'M0 0';
  for (let index = 1; index <= count; index += 1) path += ' A' + round(radius) + ' ' + round(radius) + ' 0 0 ' + (lean > 0 ? 1 : 0) + ' 0 ' + round(index * 2 * radius);
  const place = lean > 0 ? 'left:100%' : 'left:-' + width + 'px';
  return '<svg viewBox="' + (lean > 0 ? 0 : -width) + ' 0 ' + width + ' ' + Math.round(height) + '" style="position:absolute;top:0;height:100%;width:' + width + 'px;' + place + ';"><path class="rr-pop" d="' + path + ' Z"/><path class="rr-scallop" d="' + path + '"/></svg>';
}

function part(className, rect, markup = '') {
  const element = document.createElement('div');
  element.className = 'rr-part ' + className;
  element.style.cssText = 'left:' + Math.round(rect.x) + 'px;top:' + Math.round(rect.y) + 'px;width:' + Math.round(rect.w) + 'px;height:' + Math.round(rect.h) + 'px;';
  if (markup) element.innerHTML = markup;
  return element;
}


// The tracks of the common parts that this kit changes

// A joint winds up, swings past its fold and bounces back with smaller and smaller overshoots, folding and unfolding
function overshootJoints(tracks) {
  const turnFor = axis => (axis === 'h' ? 'rotateY' : 'rotateX');

  tracks.list.forEach(item => {
    if (item.property !== 'transform' || item.retro || !item.element.classList.contains('reform-seg')) return;
    item.retro = true;

    let joint = 0;
    for (let up = item.element.parentElement; up && up.classList.contains('reform-seg'); up = up.parentElement) joint += 1;
    const chain = item.element.closest('.reform-chain');
    const axis = chain.classList.contains('reform-chain-h') ? 'h' : 'v';
    const turn = turnFor(axis);
    const times = jointTimes(axis, joint);
    const total = reformTimes.totalMs;
    const at = degrees => turn + '(' + degrees + 'deg)';

    item.stops = [
      [0, at(0)],
      [times.foldStart - 60, at(0), 'ease-out'],
      [times.foldStart, at(-14), 'ease-in'], // anticipation: back before the fold
      [times.foldEnd, at(208), 'ease-out'],
      [times.foldEnd + 55, at(172), 'ease-in-out'],
      [times.foldEnd + 110, at(187), 'ease-in-out'],
      [times.foldEnd + 160, at(177), 'ease-in-out'],
      [times.foldEnd + 210, at(180)],
      [times.unfoldStart - 60, at(180), 'ease-out'],
      [times.unfoldStart, at(194), 'ease-in'],
      [times.unfoldEnd, at(-28), 'ease-out'],
      [times.unfoldEnd + 55, at(13), 'ease-in-out'],
      [times.unfoldEnd + 110, at(-6), 'ease-in-out'],
      [times.unfoldEnd + 160, at(2), 'ease-in-out'],
      [times.unfoldEnd + 210, at(0)],
      [total, at(0)],
    ];
  });
}

// A square squashes down and leans back (anticipation), launches stretched, turns over, lands squashed and bounces to rest with
// smaller and smaller squash and stretch. The stops of the plan give where it is (it may be on its way to a new place), and this
// keeps that and changes the turn.
const squareShape = /^(translate3d\([^,]*,[^,]*,)[^)]*\) (rotate[XY])\(([-\d.]+)deg\) scale\(([^)]*)\) scale\(([-\d.]+)\)$/;

function squashed(stops) {
  const start = stops[1][0];
  const make = (stop, tilt, angle, sx, sy) => {
    const found = squareShape.exec(stop[1]);
    return found[1] + '0px) rotateZ(' + tilt + 'deg) ' + found[2] + '(' + angle + 'deg) scale(' + found[4] + ') scale(' + sx + ',' + sy + ')';
  };

  return [
    [0, make(stops[1], 0, 0, 1, 1)],
    [start, make(stops[1], 0, 0, 1, 1), 'ease-out'],
    [start + 80, make(stops[1], -4, 0, 1.16, 0.8), spring],
    [start + 190, make(stops[2], 4, 90, 0.8, 1.22), 'ease-in'],
    [start + 300, make(stops[3], -3, 180, 1.2, 0.78), 'ease-out'],
    [start + 340, make(stops[3], 2, 180, 0.94, 1.08), 'ease-in-out'],
    [start + 380, make(stops[3], -1, 180, 1.03, 0.98), 'ease-in-out'],
    [start + 420, make(stops[3], 0, 180, 0.99, 1.01), 'ease-in-out'],
    [start + 450, make(stops[3], 0, 180, 1, 1)],
    [stops[4][0], make(stops[4], 0, 180, 1, 1)],
  ];
}

function squares(square, move) {
  return { transform: squashed(squareStops(square, move)), shade: squareShadeStops(square) };
}

// The stage wobbles: it squashes down on the wind-up, stretches on the launch, jiggles as the squares go and lands squashed. A few
// pixels and a quarter of a degree at the most
function jolt() {
  const at = (y, sx, sy, turn) => 'translate(0px,' + y + 'px) scale(' + sx + ',' + sy + ') rotate(' + turn + 'deg)';

  return [
    [0, at(0, 1, 1, 0)], [40, at(0, 1, 1, 0), 'ease-out'],
    [300, at(4, 1.006, 0.992, 0), 'ease-in'], [400, at(-5, 0.996, 1.01, 0), 'ease-in-out'], [520, at(0, 1, 1, 0)],
    [1180, at(0, 1, 1, 0), 'ease-in-out'], [1290, at(-3, 0.997, 1.006, -0.25), 'ease-in-out'], [1400, at(0, 1.002, 0.998, 0.25), 'ease-in-out'], [1520, at(0, 1, 1, 0)],
    [1830, at(0, 1, 1, 0), 'ease-out'], [1890, at(5, 1.007, 0.99, 0.15), 'ease-in-out'], [1960, at(-2, 0.998, 1.004, -0.1), 'ease-in-out'], [2040, at(0, 1, 1, 0)],
    [2640, at(0, 1, 1, 0), 'ease-in'], [2740, at(6, 1.007, 0.99, 0), 'ease-out'], [2800, at(-3, 0.997, 1.006, 0), 'ease-in-out'], [2880, at(0, 1, 1, 0)],
    [3000, at(0, 1, 1, 0)],
  ];
}

// The hardware pops on springs. The screws dip before they pop out and before they go in; the rest keeps its plan with the spring ease
function screwStops() {
  const at = (lift, size, turn) => 'translate(0px,' + lift + 'px) scale(' + size + ') rotate(' + turn + 'deg)';
  const seated = at(0, 1, 0);

  return [
    [0, seated, 'ease-in'], [70, at(4, 0.8, 0), spring], [390, at(-26, 1.7, -760), 'ease-in-out'], [470, at(-12, 1.25, -716), 'ease-in-out'], [540, at(-14, 1.35, -720)],
    [2450, at(-14, 1.35, -720), 'ease-in-out'], [2540, at(-30, 1.6, -740), 'ease-in'], [2660, at(3, 0.8, -4), 'ease-out'], [2710, at(-2, 1.1, 0), 'ease-in-out'], [2735, seated], [3000, seated],
  ];
}

function hardware(item) {
  if (item.role === 'screw') return screwStops();
  return item.stops.map(stop => [stop[0], stop[1], stop[2] === easePop ? spring : stop[2]]);
}


// The parts that only this kit has

// A part with one track, placed in a layer. delta is the move of a region that changes place.
function pop(layer, tracks, className, rect, markup, stops, delta) {
  const element = part(className, rect, markup);
  layer.appendChild(element);
  tracks.add(element, 'transform', movedStops(stops, delta));
  return element;
}

const hold = 'scale(0) rotate(0deg)';

// Poof clouds at the corners of a region: they pop out as the screws do and puff again as the frame locks
function poofs(region, layer, tracks, count) {
  const from = region.from;
  const here = cornersOf(from);
  const there = cornersOf(region.to);
  const size = Math.round(Math.max(52, Math.min(150, Math.min(from.w, from.h) * 0.36)));

  [0, 3, 1, 2].slice(0, count).forEach(index => {
    const corner = here[index];
    const x = corner.x + corner.sx * size * 0.35;
    const y = corner.y + corner.sy * size * 0.35;
    const move = { dx: Math.round(there[index].x - corner.x), dy: Math.round(there[index].y - corner.y) };
    const late = index * 28;
    const turn = corner.sx * 10;
    pop(layer, tracks, 'rr-poof', { x: Math.max(0, x - size / 2), y: Math.max(0, y - size / 2), w: size, h: size }, poofMarkup, [
      [0, hold, spring], [late + 20, hold, spring], [late + 120, 'scale(1.35) rotate(' + -turn + 'deg)', 'ease-in-out'], [late + 200, 'scale(0.9) rotate(' + turn / 2 + 'deg)', 'ease-in-out'],
      [late + 270, 'scale(1.08) rotate(0deg)', 'ease-in'], [late + 400, 'scale(1) rotate(0deg)', 'ease-in'], [late + 470, 'scale(0) rotate(' + turn + 'deg)'],
      [2640 + late, hold, spring], [2730 + late, 'scale(1.3) rotate(' + turn + 'deg)', 'ease-in-out'], [2800 + late, 'scale(0.9) rotate(0deg)', 'ease-in-out'], [2860 + late, 'scale(1.05) rotate(0deg)', 'ease-in'],
      [2940 + late, 'scale(0) rotate(' + -turn + 'deg)'], [reformTimes.totalMs, 'scale(0) rotate(' + -turn + 'deg)'],
    ], move);
  });
}

function mainParts(region, tracks, chassis, lean) {
  const from = region.from;
  const to = region.to;
  const delta = { dx: Math.round(to.x + to.w / 2 - from.x - from.w / 2), dy: Math.round(to.y + to.h / 2 - from.y - from.h / 2) };
  const layer = document.createElement('div');
  layer.className = 'rr-layer';
  const middle = { x: from.x + from.w / 2, y: from.y + from.h / 2 };

  // the starburst behind the squares and above the chassis: it pops with a bounce, wobbles while the squares turn and pops out
  const size = Math.round(Math.min(from.w, from.h) * 0.95);
  const star = part('rr-star', { x: middle.x - size / 2, y: middle.y - size / 2, w: size, h: size }, starMarkup());
  chassis.after(star);
  tracks.add(star, 'transform', movedStops([
    [0, 'scale(0) rotate(0deg)'], [1040, 'scale(0) rotate(0deg)', spring], [1130, 'scale(1.3) rotate(8deg)', 'ease-in-out'], [1210, 'scale(0.86) rotate(-6deg)', 'ease-in-out'],
    [1290, 'scale(1.1) rotate(5deg)', 'ease-in-out'], [1370, 'scale(0.97) rotate(-3deg)', 'ease-in-out'], [1450, 'scale(1.02) rotate(2deg)', 'ease-in-out'], [1540, 'scale(1) rotate(0deg)', 'ease-in-out'],
    [1700, 'scale(1.08) rotate(0deg)', 'ease-in'], [1800, 'scale(0) rotate(40deg)'], [reformTimes.totalMs, 'scale(0) rotate(40deg)'],
  ], delta));

  poofs(region, layer, tracks, lean ? 2 : 4);

  // stars spin out of the burst and back into it
  [[-0.3, -0.26], [0.3, -0.22], [-0.26, 0.26], [0.28, 0.24]].slice(0, lean ? 2 : 4).forEach(([across, down], index) => {
    const reach = 'translate(' + Math.round(from.w * across) + 'px,' + Math.round(from.h * down) + 'px)';
    const far = 'translate(' + Math.round(from.w * across * 1.15) + 'px,' + Math.round(from.h * down * 1.15) + 'px)';
    const late = index * 45;
    pop(layer, tracks, 'rr-flystar', { x: middle.x - 36, y: middle.y - 36, w: 72, h: 72 }, smallStarMarkup, [
      [0, 'translate(0px,0px) scale(0) rotate(0deg)'], [1100 + late, 'translate(0px,0px) scale(0) rotate(0deg)', spring], [1320 + late, reach + ' scale(1.25) rotate(360deg)', 'ease-in-out'],
      [1560 + late, far + ' scale(0.95) rotate(520deg)', 'ease-in'], [1700 + late, far + ' scale(0) rotate(640deg)'], [reformTimes.totalMs, far + ' scale(0) rotate(640deg)'],
    ], delta);
  });

  // speed lines on both sides while the edges fold and while they unfold
  const rows = [[0.2, 96], [0.45, 126], [0.72, 104]];
  rows.forEach(([share, length], index) => {
    [['left', from.x + 4 - length, '100% 50%'], ['right', from.x + from.w - 4, '0% 50%']].forEach(([side, x, origin], sideIndex) => {
      const left = Math.max(0, Math.min(1920 - length, x));
      const line = part('rr-speed', { x: left, y: from.y + from.h * share + sideIndex * 22 - 6, w: length, h: 12 });
      line.style.transformOrigin = origin;
      layer.appendChild(line);
      const shift = index * 20 + sideIndex * 20;
      tracks.add(line, 'transform', movedStops([[0, 'scaleX(0)'], [350 + shift, 'scaleX(0)', 'linear'], [500 + shift, 'scaleX(1)', 'linear'], [1060 + shift / 2, 'scaleX(0)', 'linear'], [1950 + shift, 'scaleX(0)', 'linear'], [2100 + shift, 'scaleX(1)', 'linear'], [2710 + shift / 2, 'scaleX(0)'], [reformTimes.totalMs, 'scaleX(0)']], delta));
    });
  });

  // motion streaks race across the panel as the squares turn
  if (!lean) {
    [0.16, 0.4, 0.62, 0.86].forEach((share, index) => {
      const length = 280;
      const begin = 1160 + index * 110;
      const streak = part('rr-speed', { x: from.x, y: from.y + from.h * share - 6, w: length, h: 12 });
      const there = Math.round(from.w - length);
      streak.style.transformOrigin = '0% 50%';
      layer.appendChild(streak);
      tracks.add(streak, 'transform', movedStops([
        [0, 'translateX(0px) scaleX(0)'], [begin, 'translateX(0px) scaleX(0)', 'linear'], [begin + 30, 'translateX(0px) scaleX(1)', 'ease-in'],
        [begin + 260, 'translateX(' + there + 'px) scaleX(1.3)', 'ease-out'], [begin + 330, 'translateX(' + there + 'px) scaleX(0)'], [reformTimes.totalMs, 'translateX(' + there + 'px) scaleX(0)'],
      ], delta));
    });
  }

  // a curtain with a scalloped edge wipes across the panel, inside a clip of the size of the panel, as the squares turn
  const clip = document.createElement('div');
  clip.className = 'rr-wipe';
  clip.style.cssText = 'left:' + Math.round(from.x) + 'px;top:' + Math.round(from.y) + 'px;width:' + Math.round(from.w) + 'px;height:' + Math.round(from.h) + 'px;';
  const bandWidth = 150;
  const band = part('rr-band', { x: 0, y: 0, w: bandWidth, h: from.h }, scallopMarkup(from.h, 1));
  const out = -bandWidth - 40;
  const end = Math.round(from.w + 70);
  clip.appendChild(band);
  layer.appendChild(clip);
  tracks.add(band, 'transform', [
    [0, 'translateX(' + out + 'px) scaleX(1)'], [1060, 'translateX(' + out + 'px) scaleX(1)', 'ease-in-out'], [1170, 'translateX(' + (out - 50) + 'px) scaleX(0.9)', 'ease-in'],
    [1760, 'translateX(' + end + 'px) scaleX(1.25)'], [reformTimes.totalMs, 'translateX(' + end + 'px) scaleX(1.25)'],
  ]);
  tracks.add(clip, 'transform', movedStops([[0, 'translate(0px,0px)'], [reformTimes.totalMs, 'translate(0px,0px)']], delta));

  // sparkles around the frame as it locks
  const spots = [[from.x + 80, from.y - 34], [from.x + from.w - 80, from.y - 34], [from.x + 120, from.y + from.h + 30], [from.x + from.w - 120, from.y + from.h + 30], [from.x + from.w / 2, from.y - 34], [from.x + from.w / 2, from.y + from.h + 30]];
  spots.slice(0, lean ? 4 : 6).forEach(([x, y], index) => {
    const at = { x: Math.max(20, Math.min(1860, x - 20)), y: Math.max(20, Math.min(1020, y - 20)), w: 40, h: 40 };
    const late = index * 40;
    pop(layer, tracks, 'rr-sparkle', at, sparkleMarkup, [
      [0, hold], [sparkleMs[0] + late, hold, spring], [sparkleMs[1] + late, 'scale(1.4) rotate(45deg)', 'ease-in-out'], [sparkleMs[1] + late + 60, 'scale(0.85) rotate(60deg)', 'ease-in-out'],
      [sparkleMs[1] + late + 110, 'scale(1.15) rotate(75deg)', 'ease-in'], [sparkleMs[2] + late, 'scale(0) rotate(90deg)'], [reformTimes.totalMs, 'scale(0) rotate(90deg)'],
    ], delta);
  });

  return layer;
}

// Called for each region after its chains are made, so the joints of this region are in the list. The large panel gets all of the
// comic parts, and the other regions of a view only two poofs.
function extras(region, tracks, strip, behind) {
  overshootJoints(tracks);
  const lean = String(region.grid).startsWith('view-');
  if (region.role === 'main') return mainParts(region, tracks, behind.chassis, lean);

  const layer = document.createElement('div');
  layer.className = 'rr-layer';
  poofs(region, layer, tracks, 2);
  return layer;
}

// The Light transition (core/reform-light.js): two curtains with scalloped edges slam shut over the region from its two sides, squash
// and rebound, a starburst pops where they meet, and they pull back, squash and fly open. The plates of the engine lie under the
// curtains, in the same colors, so the region is covered whatever the curtains do. A part is { cls, markup, x, y, w, h, close, open }.
function light(width, height) {
  const half = Math.floor(width / 2);
  const reach = [half + 1, width - half];
  const list = [-1, 1].map((side, index) => {
    // side is the way the curtain comes from, -1 the left and 1 the right. A move toward the middle is positive for the left curtain.
    const move = (distance, sx, sy) => ({ transform: 'translateX(' + Math.round(-side * distance) + 'px) scale(' + sx + ',' + sy + ')' });
    const off = reach[index] + 24;
    return {
      cls: 'rr-light-curtain rr-light-' + (side < 0 ? 'left' : 'right'), markup: scallopMarkup(height, side < 0 ? 1 : -1), x: side < 0 ? 0 : half, y: 0, w: reach[index], h: height,
      close: [move(-off, 1.12, 0.97), Object.assign(move(22, 0.95, 1.04), { offset: 0.5 }), Object.assign(move(-10, 1.02, 0.99), { offset: 0.7 }), Object.assign(move(4, 0.99, 1.005), { offset: 0.86 }), move(0, 1, 1)],
      open: [move(0, 1, 1), Object.assign(move(14, 0.95, 1.04), { offset: 0.2 }), Object.assign(move(-reach[index] * 0.35, 1.1, 0.98), { offset: 0.55 }), move(-off, 1.12, 0.97)],
    };
  });

  const size = Math.round(Math.min(width, height) * 0.8);
  list.push({
    cls: 'rr-light-star', markup: starMarkup(), x: Math.round(width / 2 - size / 2), y: Math.round(height / 2 - size / 2), w: size, h: size,
    close: [{ transform: 'scale(0) rotate(0deg)' }, { transform: 'scale(0) rotate(0deg)', offset: 0.5 }, { transform: 'scale(1.3) rotate(10deg)', offset: 0.68 }, { transform: 'scale(0.86) rotate(-5deg)', offset: 0.8 }, { transform: 'scale(1.06) rotate(3deg)', offset: 0.9 }, { transform: 'scale(1) rotate(0deg)' }],
    open: [{ transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(1.3) rotate(15deg)', offset: 0.25 }, { transform: 'scale(0) rotate(80deg)', offset: 0.5 }, { transform: 'scale(0) rotate(80deg)' }],
  });
  return list;
}

export const kit = {
  id: 'retro',
  draw: role => (pieces[role] === undefined ? '' : pieces[role]),
  squares: squares,
  hardware: hardware,
  jolt: jolt,
  extras: extras,
  light: light,
};
