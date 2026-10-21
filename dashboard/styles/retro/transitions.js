// The swap of the retro theme: the pull apart and re-form of core/swap-plan.js. A theme that moves
// differently exports its own numbers under the same names. core/style-loader.js loads this file by the
// id of the theme.

import { swapReform, swapShape, swapTimes } from '../../core/swap-plan.js';
import { cornersOf, jointTimes, movedStops, reformTimes, squareShadeStops, squareStops, squareTurnMs } from '../../core/reform-plan.js';

export const swapVariant = { name: 'pull-apart', times: swapTimes, reform: swapReform, shape: swapShape };

// The kit of the theme for the panel and view transitions (core/reform-draw.js, docs/transitions.md): comic book hardware drawn
// with a thick ink line, a halftone chassis, and the parts that only this kit has. It moves on the same skeleton as every kit.
//
//   every joint swings past the fold and springs back   bolts pop with a burst of action lines
//   speed lines streak past both sides of the frame     a spiky star flashes behind the squares as they flip
//   squares squash before the flip and stretch after    sparkles pop around the frame as it locks
//
// The colors are in tokens.css (--retro-*) and the styles are in reform-kit.css. Only transform and opacity move.
const spring = 'cubic-bezier(.34,1.56,.64,1)';
const sparkleMs = [2500, 2640, 2820]; // the sparkles pop in as the frame locks, and are gone before the screws seat

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

// A spiky star on a grid centered on 0, with 12 points
function starPoints(outer, inner) {
  const points = [];
  for (let index = 0; index < 24; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * index) / 12;
    points.push(Math.round(Math.cos(angle) * radius * 10) / 10 + ',' + Math.round(Math.sin(angle) * radius * 10) / 10);
  }
  return points.join(' ');
}

function starMarkup() {
  return '<svg viewBox="-300 -300 600 600"><polygon class="rr-ink rr-line" points="' + starPoints(290, 160) + '"/><polygon class="rr-pop" points="' + starPoints(240, 134) + '"/><polygon class="rr-paper" points="' + starPoints(150, 84) + '"/></svg>';
}

function burstMarkup() {
  let rays = '';
  for (let index = 0; index < 8; index += 1) {
    const angle = (Math.PI * index) / 4;
    const at = radius => Math.round(Math.cos(angle) * radius * 10) / 10 + ' ' + Math.round(Math.sin(angle) * radius * 10) / 10;
    const line = 'M' + at(15) + ' L' + at(27);
    rays += '<path class="rr-ray-ink" d="' + line + '"/><path class="rr-ray-paper" d="' + line + '"/>';
  }
  return '<svg viewBox="-40 -40 80 80">' + rays + '</svg>';
}

const sparklePoints = '0,-18 4,-4 18,0 4,4 0,18 -4,4 -18,0 -4,-4';
const sparkleMarkup = '<svg viewBox="-20 -20 40 40"><polygon class="rr-ink rr-line" points="' + sparklePoints + '"/><polygon class="rr-pop" points="' + sparklePoints + '"/></svg>';

function part(className, rect, markup = '') {
  const element = document.createElement('div');
  element.className = 'rr-part ' + className;
  element.style.cssText = 'left:' + Math.round(rect.x) + 'px;top:' + Math.round(rect.y) + 'px;width:' + Math.round(rect.w) + 'px;height:' + Math.round(rect.h) + 'px;';
  if (markup) element.innerHTML = markup;
  return element;
}


// The tracks of the common parts that this kit changes

// A joint swings 26 degrees past its fold and springs back, folding and unfolding
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

    item.stops = [
      [0, turn + '(0deg)'],
      [times.foldStart, turn + '(0deg)', 'ease-in-out'],
      [times.foldEnd, turn + '(206deg)', 'ease-out'],
      [times.foldEnd + 70, turn + '(180deg)', 'linear'],
      [times.unfoldStart, turn + '(180deg)', 'ease-in-out'],
      [times.unfoldEnd, turn + '(-26deg)', 'ease-out'],
      [times.unfoldEnd + 70, turn + '(0deg)'],
      [total, turn + '(0deg)'],
    ];
  });
}

// A square squashes flat, turns over on a spring and ends stretched, then settles. The stops of the plan give where it is (it
// may be on its way to a new place), and this keeps that and changes the turn.
const squareShape = /^(translate3d\([^,]*,[^,]*,)[^)]*\) (rotate[XY])\(([-\d.]+)deg\) scale\(([^)]*)\) scale\(([-\d.]+)\)$/;

function squashed(stops) {
  const start = stops[1][0];
  const make = (stop, angle, sx, sy) => {
    const found = squareShape.exec(stop[1]);
    return found[1] + '0px) ' + found[2] + '(' + angle + 'deg) scale(' + found[4] + ') scale(' + sx + ',' + sy + ')';
  };

  return [
    [0, make(stops[1], 0, 1, 1)],
    [start, make(stops[1], 0, 1, 1), 'ease-out'],
    [start + 90, make(stops[1], 0, 1.12, 0.84), spring],
    [start + squareTurnMs - 100, make(stops[2], 180, 0.84, 1.14), 'ease-out'],
    [start + squareTurnMs, make(stops[3], 180, 1, 1)],
    [stops[4][0], make(stops[4], 180, 1, 1)],
  ];
}

function squares(square, move) {
  return { transform: squashed(squareStops(square, move)), shade: squareShadeStops(square) };
}


// The parts that only this kit has, for the large panel of a page

function mainParts(region, tracks, chassis) {
  const from = region.from;
  const to = region.to;
  const delta = { dx: Math.round(to.x + to.w / 2 - from.x - from.w / 2), dy: Math.round(to.y + to.h / 2 - from.y - from.h / 2) };
  const layer = document.createElement('div');
  layer.className = 'rr-layer';

  // the star behind the squares and above the chassis
  const size = Math.round(Math.min(from.w, from.h) * 0.95);
  const star = part('rr-star', { x: from.x + from.w / 2 - size / 2, y: from.y + from.h / 2 - size / 2, w: size, h: size }, starMarkup());
  chassis.after(star);
  tracks.add(star, 'transform', movedStops([[0, 'scale(0) rotate(0deg)'], [1050, 'scale(0) rotate(0deg)', spring], [1220, 'scale(1.1) rotate(15deg)', spring], [1320, 'scale(0.9) rotate(30deg)', 'ease-in'], [1700, 'scale(0) rotate(60deg)'], [reformTimes.totalMs, 'scale(0) rotate(60deg)']], delta));

  // bolts pop with action lines as the screws come out, and again as they go in
  const there = cornersOf(to);
  cornersOf(from).forEach((corner, index) => {
    const burst = part('rr-burst', { x: corner.x - 48, y: corner.y - 48, w: 96, h: 96 }, burstMarkup());
    const move = { dx: Math.round(there[index].x - corner.x), dy: Math.round(there[index].y - corner.y) };
    layer.appendChild(burst);
    tracks.add(burst, 'transform', movedStops([[0, 'scale(0) rotate(0deg)', spring], [120, 'scale(1.2) rotate(20deg)', 'ease-in'], [300, 'scale(0) rotate(40deg)'], [2700, 'scale(0) rotate(-20deg)', spring], [2820, 'scale(1.2) rotate(-20deg)', 'ease-in'], [reformTimes.totalMs, 'scale(0) rotate(0deg)']], move));
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

  // sparkles around the frame as it locks
  const spots = [[from.x + 80, from.y - 34], [from.x + from.w - 80, from.y - 34], [from.x + 120, from.y + from.h + 30], [from.x + from.w - 120, from.y + from.h + 30]];
  spots.forEach(([x, y], index) => {
    const at = { x: Math.max(20, Math.min(1860, x - 20)), y: Math.max(20, Math.min(1020, y - 20)), w: 40, h: 40 };
    const sparkle = part('rr-sparkle', at, sparkleMarkup);
    const late = index * 40;
    layer.appendChild(sparkle);
    tracks.add(sparkle, 'transform', movedStops([[0, 'scale(0) rotate(0deg)'], [sparkleMs[0] + late, 'scale(0) rotate(0deg)', spring], [sparkleMs[1] + late, 'scale(1.3) rotate(45deg)', 'ease-in'], [sparkleMs[2] + late, 'scale(0) rotate(90deg)'], [reformTimes.totalMs, 'scale(0) rotate(90deg)']], delta));
  });

  return layer;
}

// Called for each region after its chains are made, so the joints of this region are in the list
function extras(region, tracks, strip, behind) {
  overshootJoints(tracks);
  return region.role === 'main' ? mainParts(region, tracks, behind.chassis) : null;
}

// The Light transition (core/reform-light.js): two comic panels with a thick ink line slam shut over the region, a spiky star
// flashes where they meet, and two speed lines streak in from the sides. A part is { cls, markup, x, y, w, h, close, open }.
function light(width, height) {
  const size = Math.round(Math.min(width, height) * 0.8);
  const list = [{
    cls: 'rr-light-star', markup: starMarkup(), x: Math.round(width / 2 - size / 2), y: Math.round(height / 2 - size / 2), w: size, h: size,
    close: [{ transform: 'scale(0) rotate(0deg)' }, { transform: 'scale(0) rotate(0deg)', offset: 0.6 }, { transform: 'scale(1.1) rotate(15deg)' }],
    open: [{ transform: 'scale(1.1) rotate(15deg)' }, { transform: 'scale(0) rotate(40deg)', offset: 0.4 }, { transform: 'scale(0) rotate(40deg)' }],
  }];

  [0.3, 0.7].forEach(share => {
    const length = Math.round(Math.min(width * 0.3, 200));
    list.push({
      cls: 'rr-light-speed', x: 0, y: Math.round(height * share - 6), w: length, h: 12,
      close: [{ transform: 'translateX(' + -length + 'px)' }, { transform: 'translateX(' + Math.round(width / 2 - length / 2) + 'px)' }],
      open: [{ transform: 'translateX(' + Math.round(width / 2 - length / 2) + 'px)' }, { transform: 'translateX(' + width + 'px)' }],
    });
  });
  return list;
}

export const kit = {
  id: 'retro',
  draw: role => (pieces[role] === undefined ? '' : pieces[role]),
  squares: squares,
  extras: extras,
  light: light,
};
