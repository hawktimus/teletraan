// The times and eases of a swap, and the pull apart (part of swap-plan.js).

import { boxInPose, mergeSmall, seededRandom } from './transitions.js';

export const swapTimes = {
  fadeMs: 250,         // the content fades out in the first of these, and in during the last
  delayMostMs: 180,    // a piece starts after a delay of its own, 0 to this
  pullMs: 450,         // a piece is fully out by this time, counted from the start of the swap
  switchMs: 450,       // the look goes on and the new pieces take over: every piece is out and at rest
  reformEndMs: 1250,   // every piece is home and the content is back
  landMs: 150,         // the icon that travelled and the logo cross-fade, after the pieces are home
};

// The re-form: a piece leaves for its place after a delay of its own, 0 to reformDelayMostMs after the look
// went on, and is home at reformEndMs. When the look goes on late, because the other areas were late, the travel
// still takes travelLeastMs after the last delay. The dip is the moment of the switch: the old pieces fade to
// dipLeast of their strength in the dipBeforeMs before it, and the new ones come back to full in the dipAfterMs
// after it. A piece never goes out of sight, so the screen is never empty.
export const swapReform = {
  reformDelayMostMs: 150,
  travelLeastMs: 300,
  dipLeast: 0.4,
  dipBeforeMs: 100,
  dipAfterMs: 140,
};

export const swapShape = {
  screenWidth: 1920,
  screenHeight: 1080,
  outwardShare: 0.18,  // how far from the middle of the screen a piece moves, as a share of its distance from it
  tipLeast: 20,
  tipMost: 70,
  twistMost: 25,
};

// The easing of the first assembly (--ease-in in tokens.css). frame.css and this file say it twice,
// and tests/swap.test.mjs holds the two together. The swap does not use it: it starts too fast to follow.
export const standardEase = [0.2, 0.8, 0.2, 1];
export const standardEaseText = 'cubic-bezier(.2, .8, .2, 1)';

// The easing of the pull and of the travel. Both start slowly and end softly: a piece that has just come to
// rest leaves again from rest, and settles into its place. tests/swap-smooth.test.mjs checks their shape.
export const pullEase = [0.25, 0, 0.15, 1];
export const pullEaseText = 'cubic-bezier(.25, 0, .15, 1)';
export const reformEase = [0.35, 0, 0.15, 1];
export const reformEaseText = 'cubic-bezier(.35, 0, .15, 1)';

// Where a piece is: x and y pixels from its place, tipped back by tip degrees, turned in the plane by
// twist degrees, and sx and sy times as wide and as high
export const restPose = { x: 0, y: 0, tip: 0, twist: 0, sx: 1, sy: 1 };

export function round(number, places) {
  const scale = Math.pow(10, places);
  return Math.round(number * scale) / scale + 0; // + 0 turns -0 into 0
}

export function middleOf(piece) {
  return { x: piece.left + piece.width / 2, y: piece.top + piece.height / 2 };
}

// The height of a cubic Bezier curve with the end points (0, 0) and (1, 1), at a time from 0 to 1:
// what the browser does for cubic-bezier(x1, y1, x2, y2)
export function bezierAt(curve, time) {
  if (time <= 0) return 0;
  if (time >= 1) return 1;

  const [x1, y1, x2, y2] = curve;
  const along = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;

  let low = 0;
  let high = 1;
  for (let step = 0; step < 40; step++) {
    const middle = (low + high) / 2;
    if (along(x1, x2, middle) < time) low = middle;
    else high = middle;
  }
  return along(y1, y2, (low + high) / 2);
}


// Pulling apart

// The pose a piece is pulled out to: moved out from the middle of the screen by outwardShare of its
// distance from it, and then moved back in, or made smaller, as far as it takes for all of it to
// be on the screen. A piece that already reaches past an edge of the screen may keep what it reaches.
export function outPose(piece, tip, twist) {
  const middle = middleOf(piece);
  const edge = {
    left: Math.min(0, piece.left),
    top: Math.min(0, piece.top),
    right: Math.max(swapShape.screenWidth, piece.left + piece.width),
    bottom: Math.max(swapShape.screenHeight, piece.top + piece.height),
  };
  let x = (middle.x - swapShape.screenWidth / 2) * swapShape.outwardShare;
  let y = (middle.y - swapShape.screenHeight / 2) * swapShape.outwardShare;
  let scale = 1;

  for (let step = 0; step < 8; step++) {
    const box = boxInPose(piece.width, piece.height, { tip: tip, twist: twist, scale: scale });
    const wide = box.right - box.left;
    const high = box.bottom - box.top;

    if (wide > edge.right - edge.left || high > edge.bottom - edge.top) {
      scale *= Math.min((edge.right - edge.left) / wide, (edge.bottom - edge.top) / high) * 0.98;
      continue;
    }
    if (middle.x + x + box.left < edge.left) x = edge.left - middle.x - box.left;
    if (middle.x + x + box.right > edge.right) x = edge.right - middle.x - box.right;
    if (middle.y + y + box.top < edge.top) y = edge.top - middle.y - box.top;
    if (middle.y + y + box.bottom > edge.bottom) y = edge.bottom - middle.y - box.bottom;
    break;
  }

  const size = Math.floor(Math.max(scale, 0.02) * 1000) / 1000;
  return { x: round(x, 1), y: round(y, 1), tip: tip, twist: twist, sx: size, sy: size };
}

// Plans the pull apart of the pieces on the screen. The same pieces and the same seed always give the
// same plan. Returns
//   pieces   one entry for each piece that moves, in the order they came, { id, rank, delayMs, ms, out }.
//            rank is 0 for the piece that starts first. ms is how long the piece takes, from its own
//            start to the end of the pull (pullMs), and out is the pose it is pulled to
//   merged   the ids of the pieces folded into the one they ride on (a bolt on its plate), which do not move by themselves
export function planPull(pieces, seed) {
  const random = seededRandom(seed);
  const { kept, merged } = mergeSmall(pieces);

  const entries = kept.map((piece, index) => {
    const delayMs = Math.floor(random() * (swapTimes.delayMostMs + 1));
    const tip = round(swapShape.tipLeast + random() * (swapShape.tipMost - swapShape.tipLeast), 1);
    const twist = round((random() * 2 - 1) * swapShape.twistMost, 1);

    return { id: piece.id, index: index, delayMs: delayMs, ms: swapTimes.pullMs - delayMs, out: outPose(piece, tip, twist) };
  });

  const started = entries.slice().sort((a, b) => a.delayMs - b.delayMs || a.index - b.index);
  return {
    pieces: entries.map(entry => ({ id: entry.id, rank: started.indexOf(entry), delayMs: entry.delayMs, ms: entry.ms, out: entry.out })),
    merged: merged.map(piece => piece.id),
  };
}

// How far along its pull a piece is at a time, from 0 (in place) to 1 (out), with the easing of the pull
export function pullProgress(entry, ms) {
  if (ms <= entry.delayMs) return 0;
  if (ms >= entry.delayMs + entry.ms) return 1;
  return bezierAt(pullEase, (ms - entry.delayMs) / entry.ms);
}

// The pose of a piece at a time
export function poseAt(entry, ms) {
  const progress = pullProgress(entry, ms);
  const out = entry.out;

  return {
    x: round(out.x * progress, 2),
    y: round(out.y * progress, 2),
    tip: round(out.tip * progress, 2),
    twist: round(out.twist * progress, 2),
    sx: round(1 + (out.sx - 1) * progress, 4),
    sy: round(1 + (out.sy - 1) * progress, 4),
  };
}


// Re-forming

// How much bigger or smaller one piece may be than the one it takes over from, in either direction, for the two to be
// of a like size. A piece that takes over from one that is bigger or smaller than this would be stretched too far.
export const likeSize = 2;

// How many times bigger the bigger of two sizes is than the smaller, never less than 1
export function ratio(a, b) {
  return Math.max(a, b, 1) / Math.max(Math.min(a, b), 1);
}

// How much the size of a piece differs from another's, as a number that is 0 for the same size and grows with
// the difference: the sum of the logarithms of the two ratios, the width's and the height's
export function sizeGap(piece, other) {
  return Math.log(ratio(piece.width, other.width)) + Math.log(ratio(piece.height, other.height));
}

// The box that all the pieces of a part of the screen fill, by the id of the part. A piece's place in its part, from 0 to 1 across
// and down, says what it is: the left edge, the top, the body, whichever look it is in
export function boxesOfRegions(pieces) {
  const boxes = {};
  pieces.forEach(piece => {
    const box = boxes[piece.region] || (boxes[piece.region] = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    box.left = Math.min(box.left, piece.left);
    box.top = Math.min(box.top, piece.top);
    box.right = Math.max(box.right, piece.left + piece.width);
    box.bottom = Math.max(box.bottom, piece.top + piece.height);
  });
  return boxes;
}

export function placeInRegion(piece, boxes) {
  const box = boxes[piece.region];
  const middle = middleOf(piece);
  return { x: (middle.x - box.left) / Math.max(box.right - box.left, 1), y: (middle.y - box.top) / Math.max(box.bottom - box.top, 1) };
}
