// Holds a look on the screen when the Studio's "Preview ..." buttons ask for it
// (docs/hidden-transitions.md). Deciding when to start and what to hold is in
// core/preview.js, which has no page in it. This file gives it the real screen: the one
// clock, localStorage, and what else has the screen.

import * as frame from '../frame.js';
import { makePreviewRunner } from './preview.js';
import { moveOn } from './schedule.js';
import { checkTheme } from './theme-apply.js';
import { overlayShown } from './theme.js';
import { takeoverRunning } from './takeover.js';

// Even asking for localStorage can throw, for example when the browser has storage switched off
function savedStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

// The demo, the night screen and the hidden transitions are optional parts of the
// screen. If one did not start, it is never in the way.
async function askOptional(path, name) {
  try {
    return (await import(path))[name];
  } catch (error) {
    console.error('The preview cannot ask ' + path + ' about ' + name, error);
    return () => false;
  }
}

// A style or a pack goes on at the next moment the large frame is apart (core/areas.js), so
// the pages are asked to move on at once. A team is followed by core/team-run.js, which asks
// for the same.
function lookAgain(held) {
  if (held.style === '' && held.pack === '') return;

  checkTheme();
  moveOn(['grid1', 'grid2', 'ticker']);
}

// getContent() returns the newest content. Start this after the takeovers, the demo runner and
// the hidden transitions, which it asks about.
export async function startPreviewRunner(getContent) {
  const demoRunning = await askOptional('./demo-runner.js', 'demoRunning');
  const nightIsUp = await askOptional('./night-screen.js', 'nightIsUp');
  const hiddenPlaying = await askOptional('./hidden-run.js', 'hiddenPlaying');

  const runner = makePreviewRunner({
    getContent: getContent,
    storage: savedStorage(),
    takeoverRunning: takeoverRunning,
    demoRunning: demoRunning,
    nightIsUp: nightIsUp,
    hiddenPlaying: hiddenPlaying,
    packOnScreen: overlayShown,
    lookAgain: lookAgain,
  });

  frame.onSecond(runner.look);
}
