// Draws the parts of a reform transition as elements (docs/transitions.md). core/reform-plan.js says where each part is
// and how it moves; this file makes the elements and names the tracks. The look of the hardware (screws, latches,
// braces, rivets, gears, pistons, teeth and the chassis) is the kit of the theme (styles/<theme>/transitions.js). Nothing
// here moves anything: a part and its track go into a list, and core/reform-run.js plays the list.
//
// The layer of a run, from the back:
//
//   .reform-layer-back for each region: the dark chassis, then the squares. A square is a box with a face (old content), a
//                      back (new content) and a shade
//   .reform-covers     the flat copy of the old content over the squares until the turn starts, and the flat copy
//                      of the new content over them from the moment the last has seated
//   .reform-layer-front for each region: the four folding edges (each two chains of four segments) and the hardware
//
// A region is { role, from, to, grid, seed }. from is where it is now and to where it will be. They are the same for a
// panel transition. In a view transition the side column and the main panel swap sides, and a layout can change, so the
// region is drawn where it is and moves to its new place while it is folded and hidden (movedStops in reform-plan.js).

import { slice } from './reform-bake.js';
import {
  chainsOf, chassisStops, coverEdgesStops, coverNewStops, coverOldStops, easePop, hardwareList, isStrip, jointShadeStops, jointStops, movedStops, reformTimes, relocateMs,
  squareShadeStops, squareStops, squaresOf, windowOf,
} from './reform-plan.js';

const growMs = 260; // the edges and the hardware come out of the corners in this long, and go back into them in this long
const cameraOrigin = { x: 960, y: 486 }; // 50% 45% of the screen, which is the origin of the perspective
const chassisDepth = 200; // the chassis is this far behind the squares, and is made larger to look the size of the window

function make(className, style = '', markup = '') {
  const element = document.createElement('div');
  element.className = className;
  if (style) element.style.cssText = style;
  if (markup) element.innerHTML = markup;
  return element;
}

const round = value => Math.round(value * 100) / 100;
const px = value => round(value) + 'px';
const box = rect => 'left:' + px(rect.x) + ';top:' + px(rect.y) + ';width:' + px(rect.w) + ';height:' + px(rect.h) + ';';

// The list of what moves: { element, property, stops }
export function makeTracks() {
  const list = [];
  return { list: list, add: (element, property, stops, windowed = false) => list.push({ element: element, property: property, stops: stops, windowed: windowed }) };
}


// The folding edges

// One chain: its segments nest, each hinged on the pin at the free end of the one before it. A chain of a region that
// changes place is moved, and stretched along its length, by a track of its own.
function chainElement(chain, there, tracks) {
  const along = chain.axis === 'h';
  const fromStart = chain.from === 'start';
  const origin = along ? (fromStart ? '0' : '100%') + ' 50%' : '50% ' + (fromStart ? '0' : '100%');
  const root = make('reform-chain reform-chain-' + chain.axis, box({ x: chain.x, y: chain.y, w: along ? chain.length : chain.thickness, h: along ? chain.thickness : chain.length }) + 'transform-origin:' + origin + ';');
  const length = chain.segment;
  let parent = root;

  for (let index = 1; index <= chain.segments; index += 1) {
    // the first segment is fixed to the corner and the others hang on the pin at the end of the one before
    const style = along
      ? (fromStart ? 'left:' : 'right:') + (index === 1 ? '0' : px(length)) + ';top:0;width:' + px(length) + ';height:' + px(chain.thickness) + ';transform-origin:' + (fromStart ? '0' : '100%') + ' 50%;'
      : 'left:0;' + (fromStart ? 'top:' : 'bottom:') + (index === 1 ? '0' : px(length)) + ';width:' + px(chain.thickness) + ';height:' + px(length) + ';transform-origin:50% ' + (fromStart ? '0' : '100%') + ';';
    const segment = make('reform-seg', style);
    const joint = index - 1;

    if (joint >= 1) {
      const shade = make('reform-shade');
      segment.appendChild(shade);
      tracks.add(segment, 'transform', jointStops(chain.axis, joint));
      tracks.add(shade, 'opacity', jointShadeStops(chain.axis, joint));
    }
    parent.appendChild(segment);
    parent = segment;
  }

  // The chain grows out of its corner as the transition starts and goes back into it at the end, which is how it comes and
  // goes: a group that fades is drawn into a surface of its own every frame, and a part that grows is only moved
  const scale = size => (along ? 'scaleX(' : 'scaleY(') + round(size) + ')';
  const place = there ? { x: round(there.x - chain.x), y: round(there.y - chain.y), by: there.length / chain.length } : { x: 0, y: 0, by: 1 };
  const here = 'translate(0px,0px) ' + scale(1);
  const gone = 'translate(0px,0px) ' + scale(0);
  const moved = 'translate(' + place.x + 'px,' + place.y + 'px) ' + scale(place.by);
  const goneThere = 'translate(' + place.x + 'px,' + place.y + 'px) ' + scale(0);
  const stops = [[0, gone, easePop], [growMs, here], [relocateMs - 1, here, 'linear'], [relocateMs, moved], [reformTimes.totalMs - growMs, moved, easePop], [reformTimes.totalMs, goneThere]];

  tracks.add(root, 'transform', stops);
  return root;
}

function strapsOf(from, to, tracks, strip) {
  const straps = make('reform-straps');
  const there = chainsOf(to, strip);

  chainsOf(from, strip).forEach((chain, index) => {
    const moves = Math.abs(there[index].x - chain.x) > 0.5 || Math.abs(there[index].y - chain.y) > 0.5 || Math.abs(there[index].length - chain.length) > 0.5;
    straps.appendChild(chainElement(chain, moves ? there[index] : null, tracks));
  });
  return straps;
}


// The hardware

// A piece of hardware grows from nothing as the transition starts, and shrinks to nothing at the end. Every transform of its track
// gets scale(1) in front, so the track has the same functions all through and the browser can blend it.
function grown(stops) {
  const first = stops[0][1];
  const last = stops[stops.length - 1][1];
  const middle = stops.filter(stop => stop[0] > growMs && stop[0] < reformTimes.totalMs - growMs).map(stop => [stop[0], 'scale(1) ' + stop[1], stop[2]]);

  return [[0, 'scale(0) ' + first, easePop], [growMs, 'scale(1) ' + first]].concat(middle, [[reformTimes.totalMs - growMs, 'scale(1) ' + last, easePop], [reformTimes.totalMs, 'scale(0) ' + last]]);
}

function hardwareOf(from, to, tracks, kit, strip) {
  const layer = make('reform-hardware');
  const there = hardwareList(to, strip);

  hardwareList(from, strip).forEach((item, index) => {
    const target = there[index];
    // a kit may move a piece its own way (stops), or leave it out (null)
    const own = kit.hardware ? kit.hardware(item) : undefined;
    if (own === null) return;
    const element = make('reform-part reform-' + item.role, box({ x: item.x - item.w / 2, y: item.y - item.h / 2, w: item.w, h: item.h }), kit.draw(item.role));
    if (item.axis) element.dataset.axis = item.axis;
    layer.appendChild(element);
    tracks.add(element, 'transform', grown(movedStops(own || item.stops, { dx: round(target.x - item.x), dy: round(target.y - item.y) })));
  });
  return layer;
}


// A run

function squaresFor(region, tracks, kit) {
  const to = squaresOf(region.to, region.grid, region.seed);
  const from = squaresOf(region.from, region.grid, region.seed);

  return to.map((square, index) => {
    const before = from[index];
    // a square scales about its middle, so it moves by the distance between the middles of the two cells
    const move = { dx: before.x + before.w / 2 - (square.x + square.w / 2), dy: before.y + before.h / 2 - (square.y + square.h / 2), sx: before.w / square.w, sy: before.h / square.h };
    const element = make('reform-square', box(square));
    const face = make('reform-face');
    const back = make('reform-back ' + (square.axis === 'y' ? 'reform-back-y' : 'reform-back-x'));
    const shade = make('reform-shade');

    element.append(face, back, shade);
    element.hidden = true; // it is shown when it has its content (fillSquares), a few at a time
    // a kit may turn its squares its own way: { transform, shade } (styles/cybertron/transitions.js)
    const own = kit.squares ? kit.squares(square, move) : null;
    tracks.add(element, 'transform', own ? own.transform : squareStops(square, move));
    tracks.add(shade, 'opacity', own ? own.shade : squareShadeStops(square));
    return { square: square, before: before, element: element, face: face, back: back };
  });
}

// The static parts of a whole transition. The covers, the faces and the backs get their content later (the fill functions
// below). cover is { from, to }: the rectangle each flat copy fills.
export function drawRun(regions, cover, kit) {
  const tracks = makeTracks();
  const back = make('reform-layer-back');
  const front = make('reform-layer-front');
  const drawn = [];

  regions.forEach(region => {
    const windowFrom = windowOf(region.from);
    const windowTo = windowOf(region.to);
    const wide = { x: Math.min(windowFrom.x, windowTo.x), y: Math.min(windowFrom.y, windowTo.y) };
    wide.w = Math.max(windowFrom.x + windowFrom.w, windowTo.x + windowTo.w) - wide.x;
    wide.h = Math.max(windowFrom.y + windowFrom.h, windowTo.y + windowTo.h) - wide.y;

    // behind the squares, and larger by the depth, so that it covers the window as the squares do
    const chassis = make('reform-chassis', box(wide) + 'transform-origin:' + px(cameraOrigin.x - wide.x) + ' ' + px(cameraOrigin.y - wide.y) + ';transform:translateZ(' + -chassisDepth + 'px) scale(' + round((1600 + chassisDepth) / 1600) + ');', kit.draw('chassis'));
    tracks.add(chassis, 'opacity', chassisStops());
    const squares = squaresFor(region, tracks, kit);
    const grid = make('reform-grid');

    squares.forEach(item => grid.appendChild(item.element));
    back.append(chassis, grid);
    // a strip in the old place or in the new is a strip in both, so that the pieces of the two places match one by one
    const strip = isStrip(region.from) || isStrip(region.to);
    front.append(strapsOf(region.from, region.to, tracks, strip), hardwareOf(region.from, region.to, tracks, kit, strip));
    // a kit may add parts of its own to a region: extras(region, tracks, strip, behind) gives an element or null. behind.chassis is the
    // element a part of the kit can be put after, to lie behind the squares
    const extra = kit.extras ? kit.extras(region, tracks, strip, { chassis: chassis }) : null;
    if (extra) front.append(extra);
    drawn.push({ region: region, squares: squares });
  });

  const covers = make('reform-covers');
  // a kit may shake the stage (kit.jolt(), the stops of a transform)
  if (kit.jolt) [back, covers, front].forEach(layer => tracks.add(layer, 'transform', kit.jolt()));
  const coverOld = make('reform-cover reform-old', box(cover.from));
  const coverNew = make('reform-cover reform-new', box(cover.to));
  // the old frames, until the edges that fold have covered them (the view transition, whose old page is a copy)
  const coverEdges = cover.edges === true ? make('reform-cover reform-edges', box(cover.from)) : null;
  covers.append(...[coverEdges, coverOld, coverNew].filter(item => item !== null));
  if (coverEdges) tracks.add(coverEdges, 'opacity', coverEdgesStops(), true);
  tracks.add(coverOld, 'opacity', coverOldStops(), true);
  tracks.add(coverNew, 'opacity', coverNewStops(cover.fadeOut === true), true);

  return { tracks: tracks, back: back, covers: covers, front: front, drawn: drawn, coverOld: coverOld, coverNew: coverNew, coverEdges: coverEdges, cover: cover };
}

// The flat copies of the old and the new content
export function fillCover(run, which, copy) {
  const place = which === 'old' ? run.cover.from : run.cover.to;
  (which === 'old' ? run.coverOld : run.coverNew).appendChild(slice(copy, place));
}

// The faces (the old content) and the backs (the new content) of the squares. The squares stay hidden: a square that is shown is
// drawn every frame, and this is done long before the turn. It is made in turns of budgetMs, with a frame given to the screen
// between them. A face is cut from the old copy at the cell of the old region and is made to fit the square.
export async function fillSquares(run, before, after, budgetMs, wait) {
  const items = run.drawn.reduce((all, region) => all.concat(region.squares), []);
  let turnEnds = performance.now() + budgetMs;

  for (const item of items) {
    const cell = item.before;
    const holder = slice(before, cell);
    const fit = item.square.w / cell.w;
    const fitDown = item.square.h / cell.h;
    if (Math.abs(fit - 1) > 0.001 || Math.abs(fitDown - 1) > 0.001) holder.style.cssText += 'transform-origin:0 0;transform:scale(' + round(fit) + ',' + round(fitDown) + ');';
    item.face.appendChild(holder);
    item.back.appendChild(slice(after, item.square));
    if (performance.now() > turnEnds) {
      await wait();
      turnEnds = performance.now() + budgetMs;
    }
  }
}

// The squares are shown shortly before the turn, the ones that turn first first, a few in a frame: a square that is shown is drawn
// once and then only moved, and many at once are a long frame.
export async function revealSquares(run, perFrame, wait) {
  const items = run.drawn.reduce((all, region) => all.concat(region.squares), []).sort((a, b) => a.square.startMs - b.square.startMs);

  for (let index = 0; index < items.length; index += 1) {
    items[index].element.hidden = false;
    if ((index + 1) % perFrame === 0) await wait();
  }
}

// How many elements a run holds, and how many have a track of their own
export function countsOf(run) {
  const all = new Set([run.back, run.covers, run.front]);
  [run.back, run.covers, run.front].forEach(top => top.querySelectorAll('*').forEach(element => all.add(element)));

  return { elements: all.size, animated: new Set(run.tracks.list.map(item => item.element)).size, tracks: run.tracks.list.length };
}
