// The list of the transitions the large panel can play at a page change, by kind (docs/transitions.md). The two kinds
// that core/rotation.js names, reform and reformView, are here. The swap (core/swap-run.js) and the hidden transitions
// (core/hidden-run.js) are older and stay where they are; core/swap-run-play.js asks this file first.

import { playPanel } from './reform-panel.js';
import { playView } from './reform-view.js';
import { kindToPlay } from './reform-plan.js';
import { reformKind, reformRunning } from './reform-run.js';

// The kinds. play(swapPage, context) draws the transition, calls swapPage() while the page is covered, and resolves with how
// many milliseconds it took to come back, or 0 when it did not start.
export const transitionKinds = {
  reform: { name: 'panel', play: playPanel },
  reformView: { name: 'view', play: playView },
};

// Asked at each page change of the large panel, with the page on screen and the page to come. Answers null, which is the old
// way of changing (the page change, or the swap), or { play(swapPage) }. kindToPlay in core/reform-plan.js decides.
export function reformOffer(context) {
  const kind = kindToPlay(reformKind(), Object.assign({ running: reformRunning() }, context));
  const found = transitionKinds[kind];

  return found ? { play: swapPage => found.play(swapPage, context) } : null;
}
