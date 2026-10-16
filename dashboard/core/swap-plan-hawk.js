// The hawk of a swap: its path, its flap and the fade of the content (part of swap-plan.js).

import { bezierAt, reformEase, round, swapTimes } from './swap-plan-pull.js';

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
