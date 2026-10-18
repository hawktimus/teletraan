// The swap of the cybertron theme: the pull apart and re-form of core/swap-plan.js. A theme that moves
// differently exports its own numbers under the same names. core/style-loader.js loads this file by the
// id of the theme.

import { swapReform, swapShape, swapTimes } from '../../core/swap-plan.js';
import { chainsOf, easePop, relocateMs, reformTimes, squareTurnMs, windowOf } from '../../core/reform-plan.js';

export const swapVariant = { name: 'pull-apart', times: swapTimes, reform: swapReform, shape: swapShape };

// The kit of the theme for the panel and view transitions (core/reform-draw.js). The same skeleton as every theme, with
// power cores in place of screws, brackets that retract, bolts of light and conduits along the edges, a scan bar over the
// turn, squares that collapse to a line of light, and a neon grid for the chassis. The look of each piece is
// styles/cybertron/reform-kit.css, and every color of it is a token.

const total = reformTimes.totalMs;
const round = value => Math.round(value * 100) / 100;
const px = value => round(value) + 'px';

// the pieces are drawn on a 40 x 40 grid and sized by the engine
const pieces = {
  screw: '<svg viewBox="0 0 40 40"><circle class="ck-halo" cx="20" cy="20" r="18"/><circle class="ck-ring" cx="20" cy="20" r="14"/><path class="ck-spokes" d="M20 6 V14 M20 26 V34 M6 20 H14 M26 20 H34"/><circle class="ck-hot" cx="20" cy="20" r="5"/></svg>',
  brace: '<svg viewBox="0 0 40 40"><rect class="ck-plate" x="0" y="15" width="40" height="10"/><path class="ck-edge" d="M4 20 H36 M4 12 V28 M36 12 V28"/></svg>',
};

// A power core spins up and swells where the screw was: twice the turns of a screw, held large while the frame is open
function coreStops() {
  const at = (scale, turns) => 'scale(' + scale + ') rotate(' + turns + 'deg)';
  return [[0, at(1, 0), easePop], [300, at(1.5, 180), 'linear'], [1100, at(1.5, 540), 'linear'], [2700, at(1.5, 1260), easePop], [total, at(1, 1440)]];
}

// A bracket retracts to nothing, keeping the slant of the brace it replaces, and comes back at the end
function bracketStops(item) {
  const found = /rotate\((-?[0-9.]+)deg\)/.exec(String(item.stops[0][1]));
  const slant = 'rotate(' + (found ? found[1] : 45) + 'deg)';
  return [[0, slant + ' scale(1)'], [300, slant + ' scale(1)', easePop], [550, slant + ' scale(0)'], [2300, slant + ' scale(0)', easePop], [2860, slant + ' scale(1)'], [total, slant + ' scale(1)']];
}

// The latches, rivets, gears, pistons and teeth of the other kits are left out: the bolts and the conduits take their place
const left = { latch: true, rivet: true, gear: true, piston: true, tooth: true };

function hardware(item) {
  if (left[item.role]) return null;
  if (item.role === 'screw') return coreStops();
  if (item.role === 'brace') return bracketStops(item);
  return undefined;
}

// A square collapses to a line of light, flips as a line and opens back out. The shade of the square is the light.
function squares(square, from) {
  const along = square.axis === 'y'; // a square that turns on y collapses across, one that turns on x collapses down
  const at = (angle, line, travel) => 'translate3d(' + round(from.dx * travel) + 'px,' + round(from.dy * travel) + 'px,0px) rotate' + square.axis.toUpperCase() + '(' + angle + 'deg) scale(' +
    round(1 + (from.sx - 1) * travel) + ',' + round(1 + (from.sy - 1) * travel) + ') scale(' + (along ? line : 1) + ',' + (along ? 1 : line) + ')';
  const t = square.startMs;
  const line = 0.07;

  return {
    transform: [[0, at(0, 1, 1)], [t, at(0, 1, 1), 'ease-in'], [t + 110, at(0, line, 0.7)], [t + 270, at(180, line, 0.25), 'ease-out'], [t + squareTurnMs, at(180, 1, 0)], [total, at(180, 1, 0)]],
    shade: [[0, 0], [t, 0, 'ease-in'], [t + 110, 1], [t + 270, 1, 'ease-out'], [t + squareTurnMs, 0], [total, 0]],
  };
}


// The bolts, the conduits and the scan bar of one region

function make(className, style) {
  const element = document.createElement('div');
  element.className = className;
  element.style.cssText = style;
  return element;
}

const dashLength = 110; // the bolt of light
const lineWidth = 3;

// where the chain meets its corner, and the way it runs to the middle
function cornerOf(chain) {
  const start = chain.from === 'start';
  const run = start ? 1 : -1;
  return chain.axis === 'h' ? { x: start ? chain.x : chain.x + chain.length, y: chain.y + chain.thickness / 2, run: run } : { x: chain.x + chain.thickness / 2, y: start ? chain.y : chain.y + chain.length, run: run };
}

// A bolt runs out from its corner along the edge in loosen and back in tighten. It is a short bar, one on each chain, that is gone (scale 0) at rest.
// A region that changes place is moved by the step between the two places while the squares hide it (relocateMs).
function boltOf(chain, there, tracks) {
  const here = cornerOf(chain);
  const to = cornerOf(there);
  const horizontal = chain.axis === 'h';
  const width = dashLength;
  const thickness = 5;
  const before = Math.max(0, chain.length - width);
  const after = Math.max(0, there.length - width);
  const dx = to.x - here.x;
  const dy = to.y - here.y;
  const shift = (run, along, step) => horizontal ? 'translate(' + px(run * along + step.x) + ',' + px(step.y) + ')' : 'translate(' + px(step.x) + ',' + px(run * along + step.y) + ')';
  const at = (along, scale, moved) => shift(here.run, along, moved ? { x: dx, y: dy } : { x: 0, y: 0 }) + ' scale(' + scale + ')';
  const reverse = here.run < 0 ? ' ck-bolt-back' : '';
  const style = horizontal
    ? 'left:' + px(here.run > 0 ? chain.x : chain.x + chain.length - width) + ';top:' + px(here.y - thickness / 2) + ';width:' + px(width) + ';height:' + px(thickness) + ';'
    : 'left:' + px(here.x - thickness / 2) + ';top:' + px(here.run > 0 ? chain.y : chain.y + chain.length - width) + ';width:' + px(thickness) + ';height:' + px(width) + ';';
  const element = make('reform-bolt ck-bolt ck-bolt-' + chain.axis + reverse, style);

  tracks.add(element, 'transform', [
    [0, at(0, 0, false)], [50, at(0, 1, false), 'linear'], [1060, at(before, 1, false)], [1110, at(before, 0, false)],
    [relocateMs - 1, at(before, 0, false), 'linear'], [relocateMs, at(0, 0, true)],
    [1950, at(0, 0, true)], [2000, at(0, 1, true), 'linear'], [2900, at(after, 1, true)], [2950, at(after, 0, true)], [total, at(after, 0, true)],
  ]);
  return element;
}

// A conduit is a thin line along the edge that charges from the corner to the middle in loosen and drains in tighten
function conduitOf(chain, there, tracks) {
  const here = cornerOf(chain);
  const to = cornerOf(there);
  const horizontal = chain.axis === 'h';
  const style = horizontal
    ? 'left:' + px(chain.x) + ';top:' + px(here.y - lineWidth / 2) + ';width:' + px(chain.length) + ';height:' + lineWidth + 'px;transform-origin:' + (here.run > 0 ? '0' : '100%') + ' 50%;'
    : 'left:' + px(here.x - lineWidth / 2) + ';top:' + px(chain.y) + ';width:' + lineWidth + 'px;height:' + px(chain.length) + ';transform-origin:50% ' + (here.run > 0 ? '0' : '100%') + ';';
  const element = make('reform-conduit ck-conduit', style);
  const scale = size => (horizontal ? 'scaleX(' : 'scaleY(') + round(size) + ')';
  const by = there.length / chain.length;
  const move = 'translate(' + px(to.x - here.x) + ',' + px(to.y - here.y) + ') ';
  const rest = 'translate(0px,0px) ';

  tracks.add(element, 'transform', [
    [0, rest + scale(0), easePop], [420, rest + scale(1)], [relocateMs - 1, rest + scale(1), 'linear'], [relocateMs, move + scale(by)],
    [2450, move + scale(by), easePop], [2950, move + scale(0)], [total, move + scale(0)],
  ]);
  return element;
}

// The scan bar sweeps down the window of the region while the squares turn. It is clipped to the window, so its trail never
// lies over a neighbor, and it is off the window (above it) when it is not sweeping.
function scanOf(rect, tracks) {
  const win = windowOf(rect);
  const trail = 140;
  const clip = make('ck-scan-window', 'left:' + px(win.x) + ';top:' + px(win.y) + ';width:' + px(win.w) + ';height:' + px(win.h) + ';');
  const bar = make('reform-scan ck-scan', 'left:0;top:' + px(-trail) + ';width:' + px(win.w) + ';height:' + trail + 'px;');
  const at = down => 'translateY(' + px(down) + ')';

  clip.appendChild(bar);
  tracks.add(bar, 'transform', [[0, at(0)], [1050, at(0), 'linear'], [1950, at(win.h + trail)], [total, at(win.h + trail)]]);
  return clip;
}

// What the kit adds to a region: bolts and conduits on each edge chain, and the scan bar over the window
function extras(region, tracks, strip) {
  const group = make('ck-extras', '');
  const there = chainsOf(region.to, strip);

  chainsOf(region.from, strip).forEach((chain, index) => {
    group.appendChild(conduitOf(chain, there[index], tracks));
    group.appendChild(boltOf(chain, there[index], tracks));
  });
  group.appendChild(scanOf(region.to, tracks));
  return group;
}

export const kit = {
  id: 'cybertron',
  draw: role => pieces[role] === undefined ? '' : pieces[role],
  hardware: hardware,
  squares: squares,
  extras: extras,
};
