// The list of the transitions the large panel can play at a page change, by kind (docs/transitions.md). The two kinds
// that core/rotation.js names, reform and reformView, are here. The swap (core/swap-run.js) and the hidden transitions
// (core/hidden-run.js) are older and stay where they are; core/swap-run-play.js asks this file first.

import { playPanel } from './reform-panel.js';
import { reformKind, reformRunning } from './reform-run.js';

// The kinds. play(swapPage, context) draws the transition, calls swapPage() while the page is covered, and resolves with how
// many milliseconds it took to come back, or 0 when it did not start.
export const transitionKinds = {
  reform: { name: 'panel', play: playPanel },
};

// Asked at each page change of the large panel, with the page on screen and the page to come. Answers null, which is the old
// way of changing (the page change, or the swap), or { play(swapPage) }. A transition is drawn in full motion only, never while
// something else has the screen, and never while another one plays. A look that is waiting to go on, a preview, a team or a
// theme, is the swap's, and so is a Monday card.
export function reformOffer(context) {
  if (context.motion !== 'full' || context.busy || reformRunning()) return null;

  const kind = reformKind();
  const found = transitionKinds[kind];
  if (!found) return null;
  if (kind === 'reform' && (context.looked || context.monday)) return null;
  if (kind === 'reformView' && !context.looked) return null;

  return { play: swapPage => found.play(swapPage, context) };
}
