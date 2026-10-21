// The list of the transitions the large panel can play at a page change, by kind (docs/transitions.md). The two kinds
// that core/rotation.js names, reform and reformView, are here. The swap (core/swap-run.js) and the hidden transitions
// (core/hidden-run.js) are older and stay where they are; core/swap-run-play.js asks this file first.

import * as frame from '../frame.js';
import { playPanel } from './reform-panel.js';
import { playView } from './reform-view.js';
import { playPanelLight, playViewLight } from './reform-light.js';
import { kindToPlay } from './reform-plan.js';
import { reformKind, reformOff, reformRunning, screenIsSlow } from './reform-run.js';
import { noteRun, watchFrames } from './motion.js';

// The kinds. play(swapPage, context) draws the transition, calls swapPage() while the page is covered, and resolves with how
// many milliseconds it took to come back, or 0 when it did not start.
export const transitionKinds = {
  reform: { name: 'panel', play: playPanel, light: playPanelLight },
  reformView: { name: 'view', play: playView, light: playViewLight },
};

// Plays a Full transition and counts its frames. A transition that did not start (it took 0 ms) is not counted.
async function playWatched(play, swapPage, context) {
  const watch = watchFrames();
  const took = await play(swapPage, context);
  const gaps = watch.stop();

  if (took > 0) noteRun(gaps);
  return took;
}

// Asked at each page change of the large panel, with the page on screen and the page to come. Answers null, which is the old
// way of changing (the page change, or the swap), or { play(swapPage) }. kindToPlay in core/reform-plan.js decides.
export function reformOffer(context) {
  const light = frame.weightNow() === 'light';
  const kind = kindToPlay(reformKind(), Object.assign({ running: reformRunning(), slow: screenIsSlow(), off: reformOff(), light: light }, context));
  const found = transitionKinds[kind];
  if (!found) return null;

  // Light draws two plates and a few parts. Full draws the whole machine and watches its own frames, so that a screen that
  // cannot keep up gives it up (core/motion.js). A hidden transition that is due goes before it (core/areas.js)
  if (light) return { play: swapPage => found.light(swapPage, context) };
  return { play: swapPage => playWatched(found.play, swapPage, context) };
}
