// Puts the page right after the browser stopped painting it.
//
// The TV is switched off, or to another input, and comes back. Chromium kept the page's timers running and stopped
// giving it frames, so whatever transition was playing stopped half way: plates open, a flat copy of the old panel over
// the new one, the camera part way through its move. When frames come back, nothing finishes it, because the run that
// started it is long gone. What is on the wall then is the half-drawn screen: black at the top, a solid block over the
// lower half, pieces of frame.
//
// This file listens for every sign that the page was away and is back, and in every case does the same six things:
//   1  cancel every transition that is still running
//   2  take off the classes and inline styles a transition leaves behind
//   3  put the layer the transitions draw in back to empty and hidden
//   4  force one full repaint, so nothing stale is left on the screen
//   5  read the files on the computer again, so the dots and the pill tell the truth rather than what was true before
//   6  start the rotation again at the top of the panel that is showing
//
// It is deliberately blunt. A screen in a meeting room must come back by itself, and a settled screen one panel early
// is better than a half-drawn one nobody is in the room to fix.
//
// computer/scripts/page-command.py recover asks for the same thing over the debugging port, which is how the computer
// can ask the page to settle without reloading it and without anything going black.

import { forceEnd } from './reform-run.js';
import { onStall } from './frames.js';
import { isBusy, setBusy } from './busy.js';

// A recovery no oftener than this, so a burst of events is one recovery and not six
export const quietMs = 2000;
// The classes and attributes a transition may leave on the page
const movingAttributes = ['moving', 'swapping', 'reforming'];

let lastAt = 0;
let restartRotation = () => {};
let rereadFiles = () => {};

// shell.js gives these when it starts: how to start the rotation again at the current panel, and how to read the files
// the computer writes. Both are optional; a recovery still settles the picture without them.
export function startRecovery({ restart, reread } = {}) {
  if (typeof restart === 'function') restartRotation = restart;
  if (typeof reread === 'function') rereadFiles = reread;

  listen();
  onStall(seconds => recover('frames stopped for ' + seconds + ' seconds'));

  try {
    window.__teletraanRecover = why => {
      recover(typeof why === 'string' ? why : 'the computer asked');
      return true;
    };
  } catch (error) {
    // the page recovers on its own events too; this is only the computer's way in
  }
}

// Everything a half-finished transition can leave behind. Nothing here knows which transition it was, on purpose: this
// has to work for a run whose own code is no longer on the stack.
function clearTransitionMarks() {
  const page = document.documentElement;
  movingAttributes.forEach(name => {
    if (name in page.dataset) delete page.dataset[name];
  });

  // Every reason that was holding the effects is let go: the run that set them cannot, because it is gone
  ['transition', 'swap', 'reform', 'hidden'].forEach(reason => setBusy(false, reason));

  // The flat copies a transition lays over the real panels, and anything it hid
  document.querySelectorAll('#reform, .swap-copy, .reform-light').forEach(element => {
    if (element.id === 'reform') return; // forceEnd empties and hides this one
    element.remove();
  });
  document.querySelectorAll('[style*="opacity"]').forEach(element => {
    // Only the elements a transition writes on are touched: the areas and the stage, never a panel's own styling
    if (element.matches('.area, #stage, .region')) element.style.removeProperty('opacity');
  });
}

// One full repaint. Reading a layout value after a change makes the browser do the work now rather than at some later
// frame that may not come.
//
// The nudge is opacity, not a transform: the house rules allow transform and opacity only, and a 3D transform such as
// translateZ would ask the graphics chip of a 2014 machine for a layer it cannot paint. A step of a thousandth is
// invisible across a room and is still a change the browser has to draw.
function repaint() {
  const stage = document.getElementById('stage');
  if (!stage) return;

  stage.style.setProperty('opacity', '0.999');
  void stage.offsetHeight;
  stage.style.removeProperty('opacity');
  void stage.offsetHeight;
}

// The whole recovery. why says what asked for it, for the log and for ?debug=1.
export function recover(why) {
  const now = Date.now();
  if (now - lastAt < quietMs) return false;
  lastAt = now;

  console.warn('Putting the page right: ' + why);
  try {
    forceEnd();
    clearTransitionMarks();
    repaint();
  } catch (error) {
    console.error('The page could not be settled', error);
  }

  try {
    rereadFiles();
  } catch (error) {
    console.error('The files on the computer could not be read again', error);
  }

  try {
    restartRotation();
  } catch (error) {
    console.error('The rotation could not be started again', error);
  }

  try {
    document.documentElement.dataset.recovered = String(now);
  } catch (error) {
    // only ?debug=1 reads this
  }
  return true;
}

// Became visible, came back from the page cache, got the focus back, or changed size. Each of them means the page may
// have been away while something was playing.
function listen() {
  const whenVisible = () => {
    if (document.visibilityState === 'visible') recover('the page became visible again');
  };
  document.addEventListener('visibilitychange', whenVisible);
  window.addEventListener('pageshow', event => recover(event.persisted ? 'the page came back from the cache' : 'the page was shown'));
  window.addEventListener('focus', () => {
    // The focus comes back for many harmless reasons, so this one only acts when something is still holding the screen
    if (isBusy()) recover('the page got the focus back while a transition was still running');
  });
  window.addEventListener('resize', () => recover('the screen changed size'));
  window.addEventListener('orientationchange', () => recover('the screen turned'));
}

// For the tests
export function forgetRecovery() {
  lastAt = 0;
  restartRotation = () => {};
  rereadFiles = () => {};
}
