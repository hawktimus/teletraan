// The swap: the one move the screen makes for every change of style, team or Monday panel, and for
// entering or leaving the Monday block (docs/layouts.md, "The swap"). These are plain functions with
// no page in them, so tools/test-swap.mjs can run them. core/swap-run.js measures the pieces on the
// page, hands them to the functions here and plays the answer.
//
// The pieces pull apart, the look goes on while they are apart, and they re-form in the new look.
// Every time is in milliseconds at normal speed, from the start of the swap:
//
//      0       the page content starts to fade out (250). Each piece starts after a delay of its own,
//              0 to 180, and moves out from the middle of the screen by 18 percent of its distance
//              from it, tipping back and turning in the plane. No piece leaves the screen
//    350       every piece is nearly out. The look goes on (style, team, the next pages) and the
//              pieces of the new look take over from the old ones, at the pose they had
//    350 to 1250   each piece travels to its place in the new look and untips, with the easing of
//              the first assembly. The metal, the neon color and the corners are the new look's from
//              the first moment of this part
//   1000 to 1250   the page content fades in
//
// The hawk flies beside it, from the old place of the logo to the new one in 2000 (planHawk below).
//
// A piece is { id, kind, region, index, left, top, width, height, parent } on the 1920 x 1080 screen.
// kind is 'plate', 'box' or 'bolt'. region is the id of the part of the screen it is in and index its
// number there, which is how an old piece and a new one are matched.

import { boxInPose, mergeSmall, seededRandom } from './transitions.js';

export const swapTimes = {
  fadeMs: 250,         // the content fades out in the first of these, and in during the last
  delayMostMs: 180,    // a piece starts after a delay of its own, 0 to this
  pullMs: 450,         // a piece is fully out by this time, counted from the start of the swap
  switchMs: 350,       // the look goes on and the new pieces take over
  reformEndMs: 1250,   // every piece is home and the content is back
  hawkMs: 2000,        // the hawk lands
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
// and tools/test-swap.mjs holds the two together.
export const standardEase = [0.2, 0.8, 0.2, 1];
export const standardEaseText = 'cubic-bezier(.2, .8, .2, 1)';

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

// How far along its pull a piece is at a time, from 0 (in place) to 1 (out), with the standard easing
export function pullProgress(entry, ms) {
  if (ms <= entry.delayMs) return 0;
  if (ms >= entry.delayMs + entry.ms) return 1;
  return bezierAt(standardEase, (ms - entry.delayMs) / entry.ms);
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

// Which old piece each new piece takes over from, as { newId: oldId }. A new piece takes the old
// piece of its kind that is in the same part of the screen and has the same number there. Those that
// are left take the nearest old piece of their kind, which may be taken already, and then the nearest
// of any kind. A new piece with no old piece to take over from has the empty string.
export function matchPieces(olds, news) {
  const partner = {};
  const taken = {};
  const place = piece => piece.kind + '|' + piece.region + '|' + piece.index;
  const byPlace = {};
  olds.forEach(piece => { byPlace[place(piece)] = piece; });

  news.forEach(piece => {
    const same = byPlace[place(piece)];
    if (same && !taken[same.id]) {
      partner[piece.id] = same.id;
      taken[same.id] = true;
    }
  });

  news.filter(piece => !(piece.id in partner)).forEach(piece => {
    const middle = middleOf(piece);
    const distance = other => Math.hypot(middleOf(other).x - middle.x, middleOf(other).y - middle.y);
    const nearest = list => list.reduce((best, other) => (best === null || distance(other) < distance(best) ? other : best), null);

    const found = nearest(olds.filter(other => other.kind === piece.kind)) || nearest(olds);
    partner[piece.id] = found ? found.id : '';
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

// Plans the re-form. pull is what planPull gave for the old pieces, olds and news are the pieces before
// and after the look went on, and atMs is when the look went on (swapTimes.switchMs). seed is for a new piece
// that has no old one to take over from. Returns
//   pieces   one entry for each new piece that moves, { id, partner, from, to, delayMs, ms }. from is where it
//            starts, to is restPose for every one of them, and ms is the time left until reformEndMs
//   merged   the ids of the new pieces that ride on another
export function planReform(pull, olds, news, atMs, seed) {
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
    return { id: piece.id, partner: old ? old.id : '', from: from, to: restPose, delayMs: 0, ms: swapTimes.reformEndMs - atMs };
  });
  return { pieces: pieces, merged: merged.map(piece => piece.id) };
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

export const hawkShape = {
  arcHeight: 300,      // how high the arc of a flight rises above the line between the two places
  hopHeight: 120,      // and the hop of a hawk that stays where it is
  sameSpot: 24,        // two places closer than this are the same place
  flapMs: 320,         // one beat of the wings
  wingShare: 0.35,     // how far the wings go, as a share of the beat the flying logo makes
  tiltMost: 20,        // degrees of tilt, nose up in the climb and nose down in the descent
  steps: 16,           // the arc is written as this many straight pieces
  colorAt: 0.5,        // the colors change at the top of the arc
  easing: 'cubic-bezier(.45, 0, .55, 1)',
};

// The easing of the hawk along its line: slow at the start and the end
function smooth(time) {
  return bezierAt([0.45, 0, 0.55, 1], time);
}

// Plans the flight of the hawk. from and to are the box of the logo before and after, { x, y, width,
// height }, with x and y the middle of the box on the screen. durationMs is how long the flight takes
// and lift how many pixels higher than the old place it starts, because the hawk hovers and lifts while the
// new place is not yet known. It rises in one arc and settles. When the place is the same, or nearly,
// it hops and lands. The hawk faces the way it flies. The top of the arc is 300 pixels above the line
// between the places (a hop 120) when the whole hawk stays on the screen. Where the logo is too near the
// top for that, as in the banner, the arc dips down instead, and where there is no room either way it is
// as high as the room is.
// Returns { hop, direction, durationMs, rise, height, apexMs, keyframes }. direction is 1 when it flies
// to the right and -1 to the left. rise is how far the top of the arc is above the line between the two
// places, negative for a dip, and height is its size without the sign. Each keyframe is { offset, x, y,
// tilt, scale }: x and y are pixels from the old place, tilt is degrees nose up (negative is nose
// down), and scale is the size compared with the old box.
export function planHawk(from, to, durationMs = swapTimes.hawkMs, lift = 0) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const hop = distance < hawkShape.sameSpot;
  const direction = to.x < from.x ? -1 : 1;
  const wanted = hop ? hawkShape.hopHeight : hawkShape.arcHeight;

  const line = (from.y + to.y) / 2;
  const half = Math.max(from.height, to.height) / 2;
  const above = line - half;
  const below = swapShape.screenHeight - (line + half);
  let rise = wanted;
  if (above < wanted) rise = below >= wanted ? -wanted : above >= below ? Math.max(above, 0) : -Math.max(below, 0);
  rise = round(rise, 1);

  // The lift is half of it at the top of the arc, so the arc is that much lower and the top is where it was asked to be
  const arc = rise - lift / 2;
  const keyframes = [];
  for (let step = 0; step <= hawkShape.steps; step++) {
    const time = step / hawkShape.steps;
    const along = smooth(time);
    const climb = (1 - 2 * time) * (rise < 0 ? -1 : 1); // 1 while it climbs, 0 at the top and -1 while it comes down

    keyframes.push({
      offset: round(time, 4),
      x: round((to.x - from.x) * along, 1),
      y: round((to.y - from.y) * along - lift * (1 - along) - 4 * arc * time * (1 - time), 1),
      tilt: round(hawkShape.tiltMost * climb * (hop ? 0.5 : 1), 1),
      scale: round(1 + (to.width / Math.max(from.width, 1) - 1) * along, 3),
    });
  }
  return { hop: hop, direction: direction, durationMs: durationMs, rise: rise, height: Math.abs(rise), apexMs: hawkShape.colorAt * durationMs, keyframes: keyframes };
}

// The transform of one keyframe of the flight. The picture of the hawk looks to the right, so a hawk flying
// to the left is turned over (scaleX(-1)), and the nose-up tilt is a turn the other way for it.
export function hawkTransform(keyframe, direction) {
  return 'translate(' + keyframe.x + 'px, ' + keyframe.y + 'px) rotate(' + round(-direction * keyframe.tilt, 1) + 'deg) scale(' + keyframe.scale + ') scaleX(' + direction + ')';
}

// The wings. frame.css has the flap of the flying logo (flap-near and flap-far): from the resting wing
// to 138 degrees and back. The swap beats at wingShare of that, once every flapMs. The lens and the view
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

// When the content of the page fades, as { out, in } where each is { delayMs, ms }
export function contentFade() {
  return {
    out: { delayMs: 0, ms: swapTimes.fadeMs },
    in: { delayMs: swapTimes.reformEndMs - swapTimes.fadeMs, ms: swapTimes.fadeMs },
  };
}

// How long the whole swap takes: the pieces and the content, or the hawk if there is one
export function swapMs(withHawk) {
  return withHawk ? Math.max(swapTimes.reformEndMs, swapTimes.hawkMs) : swapTimes.reformEndMs;
}
