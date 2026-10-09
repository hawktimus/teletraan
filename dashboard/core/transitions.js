// Chooses how the next page change looks. Two things are chosen, for each
// frame, every time its page changes:
//
//   the style   'slat' (the slats turn over and the frame halves lift) or
//               'mechanical' (the frame breaks into plates and bars and
//               rebuilds)
//   the finish  'gold' or 'silver', the metal of the frame after the change
//
// These are plain functions with no page in them, so tools/test-effects.mjs can
// test them. frame.js calls them and keeps the memory they need: the style and
// the finish the frame had last.
//
// To add a third style, see docs/page-transitions.md.
//
// The second half of this file is not a page change. It plans how the frames fall
// and come back at the end of the red eyes and the blue screen (planPile).

import { defaultSettings } from '../config.js';

// setting is the Page change style from Dashboard Settings, and last is the
// style this frame used last time, or null if it has had no change yet.
// Alternate takes turns. The first change is the mechanical one, so a new
// screen shows the new look early.
export function chooseStyle(setting, last) {
  if (setting === 'slat' || setting === 'mechanical') return setting;
  return last === 'mechanical' ? 'slat' : 'mechanical';
}

// mode is the Frame finish from Dashboard Settings, chance is Silver chance
// (percent) and last is the finish this frame has now, or null for a frame that
// has none yet. random is where the luck comes from: it is a function that gives
// a number from 0 up to but not including 1, like Math.random. Passing it in is
// what lets a test pick the number.
//
//   gold, silver   that finish every time
//   alternate      gold first, then silver, then gold ...
//   mostly-gold    silver when the number falls in the first chance percent of the
//                  way from 0 to 1, otherwise gold. With 10, that is one change in ten.
export function chooseFinish(mode, chance, last, random) {
  if (mode === 'gold' || mode === 'silver') return mode;
  if (mode === 'alternate') return last === 'gold' ? 'silver' : 'gold';

  // mostly-gold, and anything unknown is treated as it, because it is the default
  const percent = typeof chance === 'number' && isFinite(chance) ? chance : defaultSettings.silverChance;
  return random() * 100 < percent ? 'silver' : 'gold';
}


// The frames fall and come back
//
// At the end of the red eyes and the blue screen every piece of metal on the screen (the
// pieces of the frames, the halves of the frames that are not cut up, and every bolt) lets go
// at its own moment, tips, turns and falls into a pile along the bottom edge. A cube rises out
// of the pile. On its second pulse the pieces lift in the opposite order and fly back to
// their places. docs/hidden-transitions.md explains it, core/hidden-pile.js measures the pieces
// on the page and hands them to planPile(), and frame.css does the moving.

// The most pieces that fall. Past it the smallest ones are folded into the piece they ride on.
export const pieceLimit = 40;

// Milliseconds at normal speed. fallMs is the one time that core/hidden-run.js and
// --hidden-seconds in tokens.css also have (flySeconds). frame.css has the times of the cube and
// of one piece flying back, and tools/test-pile.mjs holds the two together.
//   fallMs     from the start to the last piece at rest in the pile
//   letGoMs    a piece lets go at a random moment from 0 to this
//   cubeAtMs   the cube starts to rise
//   cube       its parts, counted from the moment it starts: it rises, turns once, then pulses
//              twice (opacity 1 to .4 to 1)
//   liftAtMs   the second pulse starts and the first piece lifts
//   flyMs      one piece flying back
//   gapMs      from one piece lifting to the next
//   totalMs    the three parts are over by this time at the latest
export const pileTimes = {
  fallMs: 1600,
  letGoMs: 400,
  cubeAtMs: 1000,
  cube: { riseMs: 600, turnAfterMs: 300, turnMs: 800, pulseAfterMs: 600, pulseMs: 400 },
  liftAtMs: 2000,
  flyMs: 500,
  gapMs: 60,
  totalMs: 5000,
};

// Pixels and degrees. The pile lies in the bottom band of the screen. Pieces tip back by
// between tipLeast and tipMost and turn in the plane by up to twistMost either way. lens is the
// perspective in frame.css, and bounceHeight is the one bounce a piece makes.
export const pileShape = {
  screenWidth: 1920,
  screenHeight: 1080,
  bandHeight: 120,
  sideMargin: 120,
  tipLeast: 20,
  tipMost: 70,
  twistMost: 25,
  lens: 1600,
  bounceHeight: 30,
};

// Where a piece is: x and y pixels from its place, tipped back by tip degrees, turned in the
// plane by twist degrees and scaled
export const inPlace = { x: 0, y: 0, tip: 0, twist: 0, scale: 1 };

// A small generator that gives the same numbers for the same seed, so a run can be played again
// and a test can say which one it means. The numbers come from 0 up to but not including 1.
export function seededRandom(seed) {
  let state = seed >>> 0;

  return function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function round(number, places) {
  const scale = Math.pow(10, places);
  return Math.round(number * scale) / scale;
}

// The box a piece fills on the screen in a pose, in pixels from the middle of the piece. This is
// the same maths as the transform in frame.css (piece-fall): scale, tip about the horizontal
// axis, turn in the plane, then the perspective of the lens.
export function boxInPose(width, height, pose) {
  const tip = pose.tip * Math.PI / 180;
  const twist = pose.twist * Math.PI / 180;
  const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };

  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(corner => {
    const x = corner[0] * width / 2 * pose.scale;
    const y = corner[1] * height / 2 * pose.scale;
    const tippedY = y * Math.cos(tip);
    const nearer = 1 / (1 - y * Math.sin(tip) / pileShape.lens); // the bottom edge comes towards the viewer
    const turnedX = (x * Math.cos(twist) - tippedY * Math.sin(twist)) * nearer;
    const turnedY = (x * Math.sin(twist) + tippedY * Math.cos(twist)) * nearer;

    box.left = Math.min(box.left, turnedX);
    box.right = Math.max(box.right, turnedX);
    box.top = Math.min(box.top, turnedY);
    box.bottom = Math.max(box.bottom, turnedY);
  });
  return box;
}

// How small a piece has to be to lie inside the band when it is tipped and turned this much:
// 1 for a piece that fits already
function scaleToFit(piece, tip, twist) {
  let scale = 1;

  for (let step = 0; step < 8; step++) {
    const box = boxInPose(piece.width, piece.height, { tip: tip, twist: twist, scale: scale });
    const high = box.bottom - box.top;
    if (high <= pileShape.bandHeight) break;
    scale *= pileShape.bandHeight / high * 0.98;
  }
  return Math.floor(Math.max(scale, 0.02) * 1000) / 1000;
}

// Folds pieces into the piece they ride on until no more than limit are left, the smallest first.
// A piece is { id, left, top, width, height, parent }, where parent is the id of the piece it rides
// on (a bolt rides on the bar it is bolted to) or '' for a piece that rides on nothing. A piece with
// no parent is never folded in. Returns { kept, merged }, both in the order the pieces came.
export function mergeSmall(pieces, limit = pieceLimit) {
  const kept = pieces.slice();
  const merged = [];

  while (kept.length > limit) {
    const ridingOn = kept.filter(piece => piece.parent !== '' && kept.some(other => other.id === piece.parent));
    if (ridingOn.length === 0) break;

    const smallest = ridingOn.reduce((least, piece) => (piece.width * piece.height < least.width * least.height ? piece : least));
    kept.splice(kept.indexOf(smallest), 1);
    merged.push(smallest);
  }
  return { kept: kept, merged: merged };
}

// Plans the fall and the lift. pieces is a list of { id, left, top, width, height, parent } on the
// 1920 x 1080 screen (see mergeSmall), and seed is a whole number: the same pieces and the same seed
// always give the same plan. Returns
//   pieces    one entry for each piece that falls, in the order they came, with
//               rank   0 for the first piece to let go. The pile is laid out from left to right in this order
//               pose   how it lies in the pile
//               fall   { from, to, delayMs, ms }  the break: from its place to the pile
//               lift   { from, to, delayMs, ms }  the reassembly: from the pile to its place. The last to
//                      fall lifts first, and the first to fall is the last one back
//             Every delay counts from the start of its own part
//   merged    the ids of the pieces folded into another, which do not fall by themselves
//   fellMs    when the last piece is at rest, counted from the start of the break
//   lockedMs  when the last piece is back in its place, counted from the same moment
export function planPile(pieces, seed) {
  const random = seededRandom(seed);
  const { kept, merged } = mergeSmall(pieces);
  const count = kept.length;
  const shape = pileShape;

  // The numbers each piece draws, in the order the pieces came
  const drawn = kept.map((piece, index) => ({
    piece: piece,
    index: index,
    delayMs: Math.floor(random() * (pileTimes.letGoMs + 1)),
    tip: round(shape.tipLeast + random() * (shape.tipMost - shape.tipLeast), 1),
    twist: round((random() * 2 - 1) * shape.twistMost, 1),
  }));
  const fallen = drawn.slice().sort((a, b) => a.delayMs - b.delayMs || a.index - b.index);

  const slot = (shape.screenWidth - 2 * shape.sideMargin) / Math.max(count, 1);
  const gapMs = count > 1 ? Math.min(pileTimes.gapMs, (pileTimes.totalMs - pileTimes.liftAtMs - pileTimes.flyMs) / (count - 1)) : 0;

  const placed = {};
  fallen.forEach((item, rank) => {
    const piece = item.piece;
    const scale = scaleToFit(piece, item.tip, item.twist);
    const box = boxInPose(piece.width, piece.height, { tip: item.tip, twist: item.twist, scale: scale });

    // The middle of the piece comes to rest in its place in the row, at a height where all of it is inside the band
    const middleX = shape.sideMargin + (rank + 0.5) * slot + (random() * 2 - 1) * slot / 4;
    const highest = shape.screenHeight - shape.bandHeight - box.top;
    const lowest = shape.screenHeight - box.bottom;
    const middleY = highest + random() * Math.max(0, lowest - highest);

    const pose = {
      x: round(middleX - (piece.left + piece.width / 2), 1),
      y: round(middleY - (piece.top + piece.height / 2), 1),
      tip: item.tip,
      twist: item.twist,
      scale: scale,
    };
    placed[piece.id] = {
      id: piece.id,
      rank: rank,
      pose: pose,
      fall: { from: inPlace, to: pose, delayMs: item.delayMs, ms: pileTimes.fallMs - pileTimes.letGoMs },
      lift: { from: pose, to: inPlace, delayMs: round((count - 1 - rank) * gapMs, 1), ms: pileTimes.flyMs },
    };
  });
  const entries = kept.map(piece => placed[piece.id]);

  return {
    pieces: entries,
    merged: merged.map(piece => piece.id),
    fellMs: entries.reduce((latest, entry) => Math.max(latest, entry.fall.delayMs + entry.fall.ms), 0),
    lockedMs: entries.reduce((latest, entry) => Math.max(latest, pileTimes.liftAtMs + entry.lift.delayMs + entry.lift.ms), pileTimes.liftAtMs),
  };
}
