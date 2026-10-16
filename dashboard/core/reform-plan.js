// The plan of the reform transitions (docs/transitions.md): the panel transition (reform) and the view
// transition (reformView). These are plain functions with no page in them, so tests/reform.test.mjs can run them.
// core/reform-run.js measures the page, hands the rectangles to the functions here and plays the answer.
//
// Both run on one skeleton of three seconds. Every time below is in milliseconds of that skeleton. The run
// stretches all of them by transitionSeconds / 3 (reformScale).
//
//      0 to  400   loosen   screws spin out and lift, latches open, braces slide out, rivets pop up from the corners
//    400 to 1050   fold     top and bottom edges, then left and right, fold in on themselves from both ends
//   1100 to 1900   turn     the content turns over as a grid of squares, in a wave from the top left corner
//   1950 to 2600   unfold   left and right, then top and bottom, in reverse
//   2450 to 3000   tighten  rivets seat, braces slide in, latches shut, screws spin in last
//
// A track is a list of stops [time, value, easing]. The run turns each track into the keyframes of one animation that
// lasts the whole skeleton, so every part of the transition is locked to the same clock.

export const reformTimes = {
  totalMs: 3000,
  loosen: [0, 400],
  fold: [400, 1050],
  turn: [1100, 1900],
  unfold: [1950, 2600],
  tighten: [2450, 3000],
  coverOldOut: 1100, // the flat copy of the old content goes when the first square starts to turn
  coverNewIn: [1900, 2000], // and the flat copy of the new content comes when the last one has seated
  rideEnd: 2050, // the hawk is standing again as the other team's by here
};

export const reformSeconds = { min: 2, max: 4, start: 3 };

// How many times longer than the skeleton a transition of this many seconds is
export function reformScale(seconds) {
  const wanted = typeof seconds === 'number' && isFinite(seconds) ? seconds : reformSeconds.start;
  return Math.min(reformSeconds.max, Math.max(reformSeconds.min, wanted)) / reformSeconds.start;
}

// The squares of each kind of region: columns and rows
export const grids = {
  main: { cols: 12, rows: 6 },
  side: { cols: 3, rows: 8 },
  wide: { cols: 6, rows: 6 },
  banner: { cols: 16, rows: 1 },
  ticker: { cols: 16, rows: 1 },
};

// The regions of the page that turn in a view transition, by the id of the element, and the grid of each. A region
// the layout does not have has no size and is left out (reformRegions).
export const regionIds = [
  ['region-banner', 'banner'],
  ['region-strip', 'banner'],
  ['region-sidebar', 'side'],
  ['region-column', 'side'],
  ['region-grid1', 'main'],
  ['region-right', 'wide'],
  ['region-ticker', 'ticker'],
];

// The grid of a region of the stage, from its shape: a thin and tall one is a column, a thin and wide one is a strip
export function gridNameOf(id, rect) {
  const found = regionIds.find(item => item[0] === id);
  if (found) return found[1];
  return rect.w >= rect.h * 6 ? 'banner' : rect.h > rect.w * 1.5 ? 'side' : 'main';
}

export function strapThickness(rect) {
  return Math.max(8, Math.min(18, Math.round(Math.min(rect.w, rect.h) / 4)));
}

// The window the content turns in: the rectangle inside the straps
export function windowOf(rect) {
  const edge = strapThickness(rect);
  return { x: rect.x + edge, y: rect.y + edge, w: rect.w - 2 * edge, h: rect.h - 2 * edge, edge: edge };
}


// A small pseudo random number from a seed, so a run has the same jitter when it is played again in a test
export function randomOf(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// The squares of a region: a rectangle of the window each, the time its turn starts, and the axis it turns on
export const squareTurnMs = 380;

export function squaresOf(rect, gridName, seed) {
  const grid = grids[gridName] || grids.main;
  const box = windowOf(rect);
  const random = randomOf(seed);
  const span = reformTimes.turn[1] - reformTimes.turn[0] - squareTurnMs - 40; // the room left for the wave and the jitter
  const squares = [];

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const across = grid.cols > 1 ? col / (grid.cols - 1) : 0;
      const down = grid.rows > 1 ? row / (grid.rows - 1) : 0;
      const wave = grid.rows > 1 ? across * 0.55 + down * 0.45 : across;
      const left = Math.round(box.x + box.w * col / grid.cols);
      const right = Math.round(box.x + box.w * (col + 1) / grid.cols);
      const top = Math.round(box.y + box.h * row / grid.rows);
      const bottom = Math.round(box.y + box.h * (row + 1) / grid.rows);

      squares.push({
        col: col,
        row: row,
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
        startMs: Math.round(reformTimes.turn[0] + span * wave + random() * 40),
        axis: (col + row) % 2 === 0 ? 'y' : 'x',
      });
    }
  }
  return squares;
}


// Tracks

// Turns a track into keyframes. A stop is [time, value, easing]; the easing is the one to the next stop.
export function framesOf(property, stops, totalMs = reformTimes.totalMs) {
  const list = stops.slice();
  if (list[0][0] > 0) list.unshift([0, list[0][1]]);
  if (list[list.length - 1][0] < totalMs) list.push([totalMs, list[list.length - 1][1]]);

  return list.map(stop => {
    const frame = { offset: Math.min(1, Math.max(0, stop[0] / totalMs)) };
    frame[property] = stop[1];
    if (stop[2]) frame.easing = stop[2];
    return frame;
  });
}

// The value of a track at a time (linear between stops), for tests of the plan. Only numbers.
export function trackAt(stops, ms) {
  if (ms <= stops[0][0]) return stops[0][1];
  for (let index = 1; index < stops.length; index += 1) {
    if (ms <= stops[index][0]) {
      const before = stops[index - 1];
      const share = (ms - before[0]) / Math.max(1, stops[index][0] - before[0]);
      return before[1] + (stops[index][1] - before[1]) * share;
    }
  }
  return stops[stops.length - 1][1];
}

export const easeStandard = 'cubic-bezier(.45,0,.2,1)';
export const easePop = 'cubic-bezier(.5,0,.3,1)';

// A track that holds a value from the start to the end of the skeleton and has stops in between. Missing ends are filled in.
function closed(stops, rest) {
  const list = stops.slice();
  if (list[0][0] > 0) list.unshift([0, rest]);
  if (list[list.length - 1][0] < reformTimes.totalMs) list.push([reformTimes.totalMs, rest]);
  return list;
}

// The camera: leans in about five degrees down and three to the side while the frame is open, drifts to the other
// side during the turn, and settles as the screws go in
export function cameraStops() {
  const flat = 'rotateX(0deg) rotateY(0deg) translateZ(0px)';
  const lean = (side) => 'rotateX(5deg) rotateY(' + side * 3 + 'deg) translateZ(-30px)';

  return [[0, flat, easeStandard], [700, lean(-1), easeStandard], [1950, lean(1), easeStandard], [3000, flat]];
}

// One square turns about its axis: it drops back from the camera and parts a little as it turns, and seats. A square of a
// region that changes place (a view transition) starts where the old region had its cell, and travels to the new one while it
// turns. from is { dx, dy, sx, sy }: how far the old cell is from the new one, and how much larger it is.
export function squareStops(square, from = { dx: 0, dy: 0, sx: 1, sy: 1 }) {
  const turn = 'rotate' + square.axis.toUpperCase();
  const at = (z, angle, scale, travel) => 'translate3d(' + Math.round(from.dx * travel * 100) / 100 + 'px,' + Math.round(from.dy * travel * 100) / 100 + 'px,' + z + 'px) ' + turn + '(' + angle + 'deg) scale(' +
    Math.round((1 + (from.sx - 1) * travel) * 1000) / 1000 + ',' + Math.round((1 + (from.sy - 1) * travel) * 1000) / 1000 + ') scale(' + scale + ')';
  const half = square.startMs + squareTurnMs / 2;

  return [
    [0, at(0, 0, 1, 1)],
    [square.startMs, at(0, 0, 1, 1), easeStandard],
    [half, at(-110, 90, 0.93, 0.5), easeStandard],
    [square.startMs + squareTurnMs, at(0, 180, 1, 0)],
    [reformTimes.totalMs, at(0, 180, 1, 0)],
  ];
}

// The shade of a square: dark as it turns away, clear as it faces back
export function squareShadeStops(square) {
  return closed([[square.startMs, 0, 'ease-in'], [square.startMs + squareTurnMs / 2, 0.55, 'ease-out'], [square.startMs + squareTurnMs, 0]], 0);
}


// The folding edges

// Each edge is two chains of four segments, hinged at three knuckle pins, folding in from both ends toward the middle.
// Top and bottom edges fold first and unfold last, left and right fold last and unfold first. Each joint turns a half
// turn. joint is 1 to 3 from the corner, and the outer joint folds first.
const foldJoint = {
  h: { fold: [[400, 680], [470, 750], [540, 820]], unfold: [[2250, 2510], [2310, 2570], [2340, 2600]] },
  v: { fold: [[640, 900], [710, 980], [780, 1050]], unfold: [[1950, 2210], [2020, 2280], [2090, 2350]] },
};

// the joints are listed from the corner: joint 1 is the one nearest the corner, which folds last and unfolds first
export function jointTimes(axis, joint) {
  const times = foldJoint[axis];
  const folds = times.fold[3 - joint];
  const unfolds = times.unfold[joint - 1];

  return { foldStart: folds[0], foldEnd: folds[1], unfoldStart: unfolds[0], unfoldEnd: unfolds[1] };
}

export function jointStops(axis, joint) {
  const times = jointTimes(axis, joint);
  const turn = axis === 'h' ? 'rotateY' : 'rotateX';

  return closed([
    [times.foldStart, turn + '(0deg)', easeStandard],
    [times.foldEnd, turn + '(180deg)'],
    [times.unfoldStart, turn + '(180deg)', easeStandard],
    [times.unfoldEnd, turn + '(0deg)'],
  ], turn + '(0deg)');
}

// The light on a segment: it darkens as the segment turns away, and clears as it faces back
export function jointShadeStops(axis, joint) {
  const times = jointTimes(axis, joint);
  const middle = (a, b) => Math.round((a + b) / 2);

  return closed([
    [times.foldStart, 0, 'ease-in'],
    [middle(times.foldStart, times.foldEnd), 0.6, 'ease-out'],
    [times.foldEnd, 0.15],
    [times.unfoldStart, 0.15, 'ease-in'],
    [middle(times.unfoldStart, times.unfoldEnd), 0.6, 'ease-out'],
    [times.unfoldEnd, 0],
  ], 0);
}

// The chains of a region. Each is { edge, from, axis, x, y, length, thickness, segments, tx, ty }: the box the chain
// fills at rest, for a horizontal edge the left or right half of it. Segments are of equal length.
export function chainsOf(rect) {
  const edge = strapThickness(rect);
  const halfW = rect.w / 2;
  const halfH = (rect.h - 2 * edge) / 2;
  const chains = [];

  [['top', rect.y], ['bottom', rect.y + rect.h - edge]].forEach(([name, y]) => {
    chains.push({ edge: name, from: 'start', axis: 'h', x: rect.x, y: y, length: halfW, thickness: edge });
    chains.push({ edge: name, from: 'end', axis: 'h', x: rect.x + halfW, y: y, length: halfW, thickness: edge });
  });
  [['left', rect.x], ['right', rect.x + rect.w - edge]].forEach(([name, x]) => {
    chains.push({ edge: name, from: 'start', axis: 'v', x: x, y: rect.y + edge, length: halfH, thickness: edge });
    chains.push({ edge: name, from: 'end', axis: 'v', x: x, y: rect.y + edge + halfH, length: halfH, thickness: edge });
  });
  return chains.map(chain => Object.assign({ segments: 4, segment: chain.length / 4 }, chain));
}


// The hardware

// The four corners of a region, each with the direction to the middle and the diagonal the brace slides along
export function cornersOf(rect) {
  const edge = strapThickness(rect);
  const place = (name, x, y, sx, sy) => ({ name: name, x: x, y: y, sx: sx, sy: sy });

  return [
    place('tl', rect.x + edge / 2, rect.y + edge / 2, 1, 1),
    place('tr', rect.x + rect.w - edge / 2, rect.y + edge / 2, -1, 1),
    place('bl', rect.x + edge / 2, rect.y + rect.h - edge / 2, 1, -1),
    place('br', rect.x + rect.w - edge / 2, rect.y + rect.h - edge / 2, -1, -1),
  ];
}

// The rivets along the inside of an edge: two runs, from the two corners to the middle. A run pops in order, one a
// little after the one before it, and seats in the opposite order.
export function rivetsOf(rect) {
  const edge = strapThickness(rect);
  const rivets = [];
  const fractions = [0.14, 0.3];

  [['top', 'h'], ['bottom', 'h'], ['left', 'v'], ['right', 'v']].forEach(([name, axis]) => {
    [0, 1].forEach(end => {
      fractions.forEach((fraction, order) => {
        const along = end === 0 ? fraction : 1 - fraction;
        const x = axis === 'h' ? rect.x + rect.w * along : name === 'left' ? rect.x + edge * 1.5 : rect.x + rect.w - edge * 1.5;
        const y = axis === 'v' ? rect.y + rect.h * along : name === 'top' ? rect.y + edge * 1.5 : rect.y + rect.h - edge * 1.5;
        rivets.push({ edge: name, x: x, y: y, order: order });
      });
    });
  });
  return rivets;
}

// Screws: out two turns and up toward the camera in loosen, in two turns last in tighten
export function screwStops() {
  const lifted = 'translate3d(0px,-14px,90px) rotate(-720deg)';
  const seated = 'translate3d(0px,0px,0px) rotate(0deg)';

  return [[0, seated, easePop], [380, lifted], [2750, lifted, easePop], [3000, seated]];
}

export function latchStops(turned) {
  const open = 'rotate(' + turned + 'deg)';
  return [[100, 'rotate(0deg)', easePop], [400, open], [2650, open, easePop], [2800, 'rotate(0deg)']];
}

export function braceStops(corner, distance = 22) {
  const angle = corner.sx * corner.sy > 0 ? 45 : -45;
  const out = 'translate(' + corner.sx * distance + 'px,' + corner.sy * distance + 'px) rotate(' + angle + 'deg)';
  const rest = 'translate(0px,0px) rotate(' + angle + 'deg)';

  return [[0, rest], [100, rest, easePop], [400, out], [2550, out, easePop], [2750, rest], [3000, rest]];
}

export function rivetStops(order) {
  const up = 'translateY(-8px) scale(1.3) rotate(180deg)';
  const down = 'translateY(0px) scale(1) rotate(0deg)';
  const popAt = order * 70;

  return [[popAt, down, easePop], [popAt + 160, up], [2450 + (1 - order) * 90, up, easePop], [2450 + (1 - order) * 90 + 220, down]];
}

export function gearStops(direction) {
  return [[0, 'rotate(0deg)', 'ease-in-out'], [400, 'rotate(' + direction * 540 + 'deg)'], [2450, 'rotate(' + direction * 540 + 'deg)', 'ease-in-out'], [3000, 'rotate(' + direction * 1080 + 'deg)']];
}

export function pistonStops(axis) {
  const scale = size => (axis === 'h' ? 'scaleX(' + size + ')' : 'scaleY(' + size + ')');

  return [[400, scale(0.1), easePop], [700, scale(1)], [2300, scale(1), easePop], [2600, scale(0.1)]];
}

export function toothStops() {
  return [[0, 'scaleY(1)'], [400, 'scaleY(1)', easePop], [700, 'scaleY(0.1)'], [2300, 'scaleY(0.1)', easePop], [2600, 'scaleY(1)']];
}

// The chassis, a dark lattice of struts that shows between the squares: it is there for the turn only
export function chassisStops() {
  return [[0, 0], [1000, 0, 'linear'], [1100, 1], [1900, 1, 'linear'], [2000, 0], [3000, 0]];
}

export function coverOldStops() {
  return [[0, 1], [reformTimes.coverOldOut - 40, 1, 'linear'], [reformTimes.coverOldOut, 0], [3000, 0]];
}

// The flat copy of the new content. A cover that fills the whole stage (the view transition) lies over the real frames too, so
// it goes in the last part and shows the real page, which is in place by then (fadeOut).
export function coverNewStops(fadeOut = false) {
  const stops = [[0, 0], [reformTimes.coverNewIn[0], 0, 'linear'], [reformTimes.coverNewIn[1], 1]];
  if (!fadeOut) return stops.concat([[3000, 1]]);
  return stops.concat([[reformTimes.tighten[0], 1, 'linear'], [3000, 0]]);
}

// The cross fade of the metal chassis frame over the real frame at the start, and back at the end
export function strapFadeStops() {
  return [[0, 0, 'linear'], [400, 1], [2450, 1, 'linear'], [3000, 0]];
}

// Every piece of hardware of a region, in a fixed order, so the same piece of the old rectangle and of the new one
// (a view transition that moves a region) are the same index. role is the drawing the kit gives it.
export function hardwareList(rect) {
  const edge = strapThickness(rect);
  const list = [];

  cornersOf(rect).forEach((corner, index) => {
    list.push({ role: 'brace', x: corner.x + corner.sx * edge * 1.1, y: corner.y + corner.sy * edge * 1.1, w: edge * 2.4, h: edge * 2.4, stops: braceStops(corner) });
    list.push({ role: 'latch', x: corner.x + corner.sx * edge * 2.4, y: corner.y, w: edge * 1.6, h: edge * 1.6, stops: latchStops(corner.sx * -70) });
    list.push({ role: 'gear', x: corner.x + corner.sx * edge * 3.4, y: corner.y + corner.sy * edge * 3.4, w: edge * 2.4, h: edge * 2.4, stops: gearStops(index % 2 === 0 ? 1 : -1) });
    list.push({ role: 'screw', x: corner.x, y: corner.y, w: edge * 1.9, h: edge * 1.9, stops: screwStops() });
  });
  rivetsOf(rect).forEach(rivet => list.push({ role: 'rivet', x: rivet.x, y: rivet.y, w: edge * 0.8, h: edge * 0.8, stops: rivetStops(rivet.order) }));

  [['top', 'h', rect.x + rect.w / 2, rect.y + edge * 1.9], ['bottom', 'h', rect.x + rect.w / 2, rect.y + rect.h - edge * 1.9],
    ['left', 'v', rect.x + edge * 1.9, rect.y + rect.h / 2], ['right', 'v', rect.x + rect.w - edge * 1.9, rect.y + rect.h / 2]].forEach(([name, axis, x, y]) => {
    const long = edge * 3;
    const thin = edge * 0.6;
    list.push({ role: 'piston', axis: axis, x: x, y: y, w: axis === 'h' ? long : thin, h: axis === 'h' ? thin : long, stops: pistonStops(axis) });
    list.push({ role: 'tooth', axis: axis, edge: name, x: axis === 'h' ? x + edge * 3 : x, y: axis === 'h' ? y : y + edge * 3, w: edge * 1.1, h: edge * 1.1, stops: toothStops() });
  });
  return list;
}

// The moment a region that changes place does it, while its edges are folded and the squares hide it
export const relocateMs = 1500;

// A track of a transform, with the move of a region that changes place added: until relocateMs the part is where it was, and
// from relocateMs it is where it goes, by delta ({ dx, dy } and, for a chain, the scale along its length). The tracks hold
// one value around that time, so the step is not seen.
export function movedStops(stops, delta, more = '') {
  const here = delta.dx === 0 && delta.dy === 0 && !delta.scale ? null : delta;
  if (!here) return stops;

  const before = 'translate(0px,0px) ' + (delta.scale ? delta.scale(1) + ' ' : '');
  const after = 'translate(' + delta.dx + 'px,' + delta.dy + 'px) ' + (delta.scale ? delta.scale(delta.by) + ' ' : '');
  const list = [];
  let held = stops[0][1];

  stops.forEach(stop => {
    if (stop[0] <= relocateMs) held = stop[1];
    list.push([stop[0], (stop[0] < relocateMs ? before : after) + stop[1], stop[2]]);
  });
  list.push([relocateMs - 1, before + held, 'linear']);
  list.push([relocateMs, after + held]);
  list.sort((a, b) => a[0] - b[0]);
  return list;
}

// The real thing under the overlay is out of sight from when the edges have covered it until they uncover it again. It is
// opacity on the same clock as every other part, so a test can set the time and see it.
export function hiddenStops() {
  return [[0, 1], [reformTimes.fold[0] - 1, 1, 'linear'], [reformTimes.fold[0], 0], [reformTimes.tighten[0], 0, 'linear'], [reformTimes.tighten[0] + 1, 1], [reformTimes.totalMs, 1]];
}

// How many parts of one region move (a part is an element that has an animation of its own)
export function partsOf(rect, gridName) {
  const grid = grids[gridName] || grids.main;

  return { squares: grid.cols * grid.rows * 2, chains: chainsOf(rect).length * 6, hardware: hardwareList(rect).length, covers: 3 };
}


// Which transition a page change of the large panel gets, from the kind the rotation noted and what the screen is doing. It is
// the name of the kind, or '' for the older way of changing (the page change, or the swap). A transition is drawn in full
// motion only, never while something else has the screen or another one plays. A look that is waiting to go on (a preview,
// a team, a theme) and a Monday card are the swap's, and a view transition only goes with a look that is held for it.
export function kindToPlay(kind, context) {
  if (context.motion !== 'full' || context.busy || context.running) return '';
  if (kind === 'reform') return context.looked || context.monday ? '' : 'reform';
  if (kind === 'reformView') return context.looked ? 'reformView' : '';
  return '';
}
