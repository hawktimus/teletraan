// The swap: the one move the screen makes for every change of style, team or Monday panel, and for
// entering or leaving the Monday block (docs/layouts.md, "The swap"). These are plain functions with
// no page in them, so tests/swap.test.mjs can run them. core/swap-run.js measures the pieces on the
// page, hands them to the functions here and plays the answer.
//
// The pieces pull apart, the look goes on while they are apart, and they re-form in the new look. It is
// one gesture: a piece leaves its place slowly, gathers speed, comes to rest at the far end of the pull,
// and from rest leaves for its new place the same way. The pull and the travel have the same kind of
// easing, slow at the start and soft at the end, so nothing jumps at the moment between them.
// Every time is in milliseconds at normal speed, from the start of the swap:
//
//      0       the page content starts to fade out (250). Each piece starts after a delay of its own,
//              0 to 180, and moves out from the middle of the screen by 18 percent of its distance
//              from it, tipping back and turning in the plane. No piece leaves the screen
//    450       every piece is out and at rest. The look goes on (style, team, layout, the next pages) and
//              the pieces of the new look take over from the old ones, at the pose they had. For
//              a moment around it the pieces are a little fainter, so that a new shape or color
//              does not jump (swapReform)
//    450 to 1250   each piece, after a delay of its own, 0 to 150, travels to its place in the new look
//              and untips, and is home by 1250. The metal, the neon color and the corners are the new
//              look's from the first moment of this part
//   1000 to 1250   the page content fades in, over the last of the travel
//
// The icon of the logo goes with the pieces, from its old place to the new one, and is a bird for a moment only when a
// team or a style changes (hawkMotionFor and planHawk below).
//
// A piece is { id, kind, region, index, left, top, width, height, parent } on the 1920 x 1080 screen.
// kind is 'plate', 'box' or 'bolt'. region is the id of the part of the screen it is in and index its
// number there, which is how an old piece and a new one are matched.

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

function round(number, places) {
  const scale = Math.pow(10, places);
  return Math.round(number * scale) / scale + 0; // + 0 turns -0 into 0
}

function middleOf(piece) {
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
const likeSize = 2;

// How many times bigger the bigger of two sizes is than the smaller, never less than 1
function ratio(a, b) {
  return Math.max(a, b, 1) / Math.max(Math.min(a, b), 1);
}

// How much the size of a piece differs from another's, as a number that is 0 for the same size and grows with
// the difference: the sum of the logarithms of the two ratios, the width's and the height's
function sizeGap(piece, other) {
  return Math.log(ratio(piece.width, other.width)) + Math.log(ratio(piece.height, other.height));
}

// The box that all the pieces of a part of the screen fill, by the id of the part. A piece's place in its part, from 0 to 1 across
// and down, says what it is: the left edge, the top, the body, whichever look it is in
function boxesOfRegions(pieces) {
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

function placeInRegion(piece, boxes) {
  const box = boxes[piece.region];
  const middle = middleOf(piece);
  return { x: (middle.x - box.left) / Math.max(box.right - box.left, 1), y: (middle.y - box.top) / Math.max(box.bottom - box.top, 1) };
}

// Which old piece each new piece takes over from, as { newId: oldId }. A new piece takes the old piece of its kind
// that is in the same part of the screen and has the same number there, when the two are of a like size: the frames of
// one style are drawn the same way every time, so the same number is the same piece. Those that are left, and the ones
// whose old piece is a very different size (the pieces of another style's frame are numbered another way), take the old
// piece of their kind that is most like them in size and in place within its part of the screen, and one that nobody has taken yet is
// preferred. A kind with no old piece takes the nearest old piece of any kind. A new piece with no old piece
// to take over from has the empty string.
export function matchPieces(olds, news) {
  const partner = {};
  const taken = {};
  const place = piece => piece.kind + '|' + piece.region + '|' + piece.index;
  const byPlace = {};
  olds.forEach(piece => { byPlace[place(piece)] = piece; });
  const alike = (piece, other) => ratio(piece.width, other.width) <= likeSize && ratio(piece.height, other.height) <= likeSize;

  news.forEach(piece => {
    const same = byPlace[place(piece)];
    if (same && !taken[same.id] && alike(piece, same)) {
      partner[piece.id] = same.id;
      taken[same.id] = true;
    }
  });

  const oldBoxes = boxesOfRegions(olds);
  const newBoxes = boxesOfRegions(news);
  const bigFirst = (a, b) => b.width * b.height - a.width * a.height;

  news.filter(piece => !(piece.id in partner)).sort(bigFirst).forEach(piece => {
    const middle = middleOf(piece);
    const distance = other => Math.hypot(middleOf(other).x - middle.x, middleOf(other).y - middle.y);
    const nearest = list => list.reduce((best, other) => (best === null || distance(other) < distance(best) ? other : best), null);
    const here = placeInRegion(piece, newBoxes);
    const unlike = other => {
      const there = placeInRegion(other, oldBoxes);
      return sizeGap(piece, other) + 2 * (Math.abs(here.x - there.x) + Math.abs(here.y - there.y)) + (piece.region === other.region ? 0 : 1.5) + (taken[other.id] ? 0.8 : 0);
    };
    const mostLike = list => list.reduce((best, other) => (best === null || unlike(other) < unlike(best) ? other : best), null);

    const ofKind = olds.filter(other => other.kind === piece.kind);
    const found = ofKind.length > 0 ? mostLike(ofKind) : nearest(olds);
    partner[piece.id] = found ? found.id : '';
    if (found) taken[found.id] = true;
  });
  return partner;
}

// The pose a new piece starts from so that it looks exactly like the old piece did: the same middle, the
// same size, the same tip and turn. It is the pose of the old piece, worked out for the box of the new one.
function carried(oldPiece, pose, newPiece) {
  const from = middleOf(oldPiece);
  const to = middleOf(newPiece);

  return {
    x: round(from.x + pose.x - to.x, 2),
    y: round(from.y + pose.y - to.y, 2),
    tip: pose.tip,
    twist: pose.twist,
    sx: round(pose.sx * oldPiece.width / Math.max(newPiece.width, 1), 4),
    sy: round(pose.sy * oldPiece.height / Math.max(newPiece.height, 1), 4),
  };
}

// Where each old piece goes. The pieces that a new piece took over from go to it. The pieces that none took over
// from, because the new look has fewer in that part of the screen, go to the nearest new piece of their kind, or
// of any kind: they are folded into it, which is what the dip hides. Returns { oldId: newId }, with an entry for every
// old piece when there is a new piece at all, and the empty string when there is not.
export function destinationsOf(olds, news, partner) {
  const destination = {};
  news.forEach(piece => {
    if (partner[piece.id] && !(partner[piece.id] in destination)) destination[partner[piece.id]] = piece.id;
  });

  olds.filter(piece => !(piece.id in destination)).forEach(piece => {
    const middle = middleOf(piece);
    const distance = other => Math.hypot(middleOf(other).x - middle.x, middleOf(other).y - middle.y);
    const nearest = list => list.reduce((best, other) => (best === null || distance(other) < distance(best) ? other : best), null);

    const found = nearest(news.filter(other => other.kind === piece.kind)) || nearest(news);
    destination[piece.id] = found ? found.id : '';
  });
  return destination;
}

// Plans the re-form. pull is what planPull gave for the old pieces, olds and news are the pieces before and after
// the look went on, and atMs is when the look went on (swapTimes.switchMs). seed is for a new piece that has no
// old one to take over from, and for the delays. Returns
//   pieces   one entry for each new piece that moves, { id, partner, from, to, delayMs, ms, fadesIn }. from is where it
//            starts, to is restPose for every one of them, delayMs is when it leaves, 0 to reformDelayMostMs after
//            the look went on, and ms is the time left from then until reformEndMs. fadesIn is true for a piece
//            with no old piece to take over from, which comes into sight as it goes
//   merged   the ids of the new pieces that ride on another
//   destinations   where each old piece goes (destinationsOf)
// endMs is when every piece is home: reformEndMs, unless the look went on so late that there is too little time left
export function planReform(pull, olds, news, atMs, seed, endMs = swapTimes.reformEndMs) {
  const random = seededRandom(seed);
  const partner = matchPieces(olds, news);
  const { kept, merged } = mergeSmall(news);
  const oldById = {};
  const pullById = {};
  olds.forEach(piece => { oldById[piece.id] = piece; });
  pull.pieces.forEach(entry => { pullById[entry.id] = entry; });

  const pieces = kept.map(piece => {
    const old = oldById[partner[piece.id]];
    const entry = old ? pullById[old.id] : undefined;
    const delayMs = Math.floor(random() * (swapReform.reformDelayMostMs + 1));
    let from;

    if (old && entry) {
      from = carried(old, poseAt(entry, atMs), piece);
    } else if (old && pullById[old.parent]) {
      from = carried(old, poseAt(pullById[old.parent], atMs), piece); // it rode on a piece, and went with it
    } else if (old) {
      from = carried(old, restPose, piece);
    } else {
      const tip = round(swapShape.tipLeast + random() * (swapShape.tipMost - swapShape.tipLeast), 1);
      const twist = round((random() * 2 - 1) * swapShape.twistMost, 1);
      from = outPose(piece, tip, twist);
    }
    return { id: piece.id, partner: old ? old.id : '', from: from, to: restPose, delayMs: delayMs, ms: endMs - atMs - delayMs, fadesIn: !old };
  });
  return { pieces: pieces, merged: merged.map(piece => piece.id), destinations: destinationsOf(olds, news, partner) };
}

// How far along its travel a new piece is at a time counted from the start of the swap, from 0 (where the old
// piece was) to 1 (home), with the easing of the travel. atMs is when the look went on.
export function reformProgress(entry, atMs, ms) {
  const start = atMs + entry.delayMs;
  if (ms <= start) return 0;
  if (ms >= start + entry.ms) return 1;
  return bezierAt(reformEase, (ms - start) / entry.ms);
}

// The pose of a new piece at a time counted from the start of the swap, in the new piece's own terms
export function reformPoseAt(entry, atMs, ms) {
  const progress = reformProgress(entry, atMs, ms);
  const from = entry.from;

  return {
    x: round(from.x * (1 - progress), 2),
    y: round(from.y * (1 - progress), 2),
    tip: round(from.tip * (1 - progress), 2),
    twist: round(from.twist * (1 - progress), 2),
    sx: round(from.sx + (1 - from.sx) * progress, 4),
    sy: round(from.sy + (1 - from.sy) * progress, 4),
  };
}

// When the last piece is home, counted from the start of the swap
export function reformEnd(reform, atMs) {
  return reform.pieces.reduce((latest, entry) => Math.max(latest, atMs + entry.delayMs + entry.ms), atMs);
}

// The transform of a pose. Every pose is written with the same functions in the same order, which is
// what lets the browser blend one into another. perspective is the lens of the piece (pileShape.lens
// in core/transitions.js), and zoom is how many pixels of the screen one pixel of the piece is: it is 1
// except in the frames that the sidebar layout and the bar layout scale to fit.
export function poseTransform(pose, zoom = 1) {
  return 'translate(' + round(pose.x / zoom, 1) + 'px, ' + round(pose.y / zoom, 1) + 'px) perspective(1600px) rotateZ(' + pose.twist + 'deg) rotateX(' + pose.tip + 'deg) scale(' + pose.sx + ', ' + pose.sy + ')';
}

// The keyframes of an animation from one pose to another, for element.animate()
export function poseFrames(from, to, zoom = 1) {
  return [{ transform: poseTransform(from, zoom) }, { transform: poseTransform(to, zoom) }];
}


// The hawk
//
// The logo is copied for the swap and the copy moves, over everything, while the logo itself waits out of sight. How
// much of a bird the copy is depends on what the swap does (the pieces and the look are the same for all of them):
//   none    calm motion and no motion have no pieces, so no icon moves
//   slight  a team or a style changes: the icon goes to its new place with the pieces, and as the new look goes on it
//           flutters for hawkShape.birdMs: the emblem turns into the hawk, the wings beat twice, and the emblem is back
//           before the icon lands. The path rises a little in the middle, so the flutter is a small hop
//   carry   a Monday card is on either side and the team stays: the icon goes to its new place with the pieces, as
//           it is, lower in the bar layout and higher when it comes back. It is never a bird
// The bird that changes and flies every few minutes is another thing: the flying hawk of frame.js.
export const hawkShape = {
  hopHeight: 40,       // how high the path of a slight swap rises in the middle
  birdMs: 600,         // how long the icon is a hawk in a slight swap, counted from the moment the look goes on
  beats: 2,            // wing beats in it
  fadeMs: 100,         // the emblem turns into the hawk, and back, in this long
  wingShare: 0.35,     // how far the wings go, as a share of the beat the flying logo makes
  steps: 16,           // the path is written as this many straight pieces
  colorAt: 0.5,        // the colors of the new look come at the middle of the travel
  easing: 'cubic-bezier(.45, 0, .55, 1)',
};

// What the icon does in a swap. swap is { motion, team, fromMonday, intoMonday }: the motion setting, whether the team
// changes, and whether the page that leaves or the page that comes is a Monday card. Only full motion has pieces, so
// calm motion and no motion have no icon (none). Going into a Monday card, or from one card to the next, carries the icon. Coming
// out of one carries it too, unless the team changes there: Prime to Nova and Nova to Prime are slight wherever they
// happen. A style or a look that changes alone is slight as well.
export function hawkMotionFor(swap) {
  if (swap.motion !== 'full') return 'none';
  if (swap.intoMonday) return 'carry';
  if (swap.team) return 'slight';
  if (swap.fromMonday) return 'carry';
  return 'slight';
}

// Plans the path of the icon. from and to are the box of the logo before and after, { x, y, width, height }, with x and
// y the middle of the box on the screen. durationMs is how long it travels, from the moment the look goes on to the moment
// the pieces are home, and hop is how many pixels the path rises in the middle (0 for a path that is straight), less when
// the logo is too near the top of the screen for that. The icon travels with the easing of the pieces. Returns
// { direction, durationMs, rise, apexMs, keyframes }. direction is 1 when it goes to the right and -1 to the left, and
// the picture of the hawk, which looks to the right, is turned over for the left. Each keyframe is { offset, x, y, scale }:
// x and y are pixels from the old place and scale is the size compared with the old box.
export function planHawk(from, to, durationMs, hop = 0) {
  const direction = to.x < from.x ? -1 : 1;
  const room = Math.max(0, Math.min(from.y - from.height / 2, to.y - to.height / 2));
  const rise = round(Math.min(hop, room), 1);
  const keyframes = [];

  for (let step = 0; step <= hawkShape.steps; step++) {
    const time = step / hawkShape.steps;
    const along = bezierAt(reformEase, time);

    keyframes.push({
      offset: round(time, 4),
      x: round((to.x - from.x) * along, 1),
      y: round((to.y - from.y) * along - 4 * rise * time * (1 - time), 1),
      scale: round(1 + (to.width / Math.max(from.width, 1) - 1) * along, 3),
    });
  }
  return { direction: direction, durationMs: durationMs, rise: rise, apexMs: hawkShape.colorAt * durationMs, keyframes: keyframes };
}

// The transform of one keyframe of the path. A hawk going to the left is turned over (scaleX(-1)).
export function hawkTransform(keyframe, direction) {
  return 'translate(' + keyframe.x + 'px, ' + keyframe.y + 'px) scale(' + keyframe.scale + ') scaleX(' + direction + ')';
}

// How the emblem and the hawk trade places in a slight swap, as the opacity of each over birdMs: the emblem goes out
// in fadeMs, the hawk is there, and the hawk goes out in the last fadeMs as the emblem comes back
export function birdFades() {
  const edge = hawkShape.fadeMs / hawkShape.birdMs;

  return {
    emblem: [{ opacity: 1 }, { opacity: 0, offset: edge }, { opacity: 0, offset: 1 - edge }, { opacity: 1 }],
    hawk: [{ opacity: 0 }, { opacity: 1, offset: edge }, { opacity: 1, offset: 1 - edge }, { opacity: 0 }],
  };
}

// The wings. frame.css has the flap of the flying logo (flap-near and flap-far): from the resting wing
// to 138 degrees and back. The swap beats at wingShare of that, hawkShape.beats times in birdMs. The lens and the view
// are the ones the logo's parts have in frame.css (.logo .drawing).
const lens = 'perspective(2400px)';
const view = 'rotateX(-14deg) rotateY(-24deg)';

function wingFrame(share, rest, beat, shoulder, axis) {
  const angle = round(rest + (beat - rest) * share, 1);
  return lens + ' ' + view + ' translate(' + shoulder[0] + 'px, ' + shoulder[1] + 'px) rotate3d(' + axis + ', ' + angle + 'deg) translate(' + (-shoulder[0]) + 'px, ' + (-shoulder[1]) + 'px)';
}

export function flapFrames(share = hawkShape.wingShare) {
  const near = amount => wingFrame(amount, -18, 138, [-30, -137], '320, -50, 0');
  const far = amount => wingFrame(amount, 18, -138, [140, -161], '160, -18, 0');

  return {
    near: [{ transform: near(0) }, { transform: near(share), offset: 0.58 }, { transform: near(0) }],
    far: [{ transform: far(0) }, { transform: far(share), offset: 0.58 }, { transform: far(0) }],
  };
}


// The content

// When the content of the page fades, as { out, in } where each is { delayMs, ms }. The content comes back over
// the last of the travel, which ends at endMs
export function contentFade(endMs = swapTimes.reformEndMs) {
  return {
    out: { delayMs: 0, ms: swapTimes.fadeMs },
    in: { delayMs: endMs - swapTimes.fadeMs, ms: swapTimes.fadeMs },
  };
}

// How long the whole swap takes: the pieces and the content, and the landing of the icon if there is one
export function swapMs(withIcon) {
  return withIcon ? swapTimes.reformEndMs + swapTimes.landMs : swapTimes.reformEndMs;
}
