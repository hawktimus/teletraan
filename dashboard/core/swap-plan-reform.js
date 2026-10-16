// Matching the old pieces to the new ones and the re-form (part of swap-plan.js).

import { mergeSmall, seededRandom } from './transitions.js';
import { bezierAt, boxesOfRegions, likeSize, middleOf, outPose, placeInRegion, poseAt, ratio, reformEase, restPose, round, sizeGap, swapReform, swapShape, swapTimes } from './swap-plan-pull.js';

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
