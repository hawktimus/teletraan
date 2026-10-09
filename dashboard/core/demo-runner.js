// Plays a demo when the Test the screen page in the Studio asks for one (docs/demo.md).
// Deciding when to play and the order of the steps are in core/demo.js, which
// has no page in it. This file gives it the real screen: the one clock, the
// pauses, localStorage, and what is happening with alerts.

import * as frame from '../frame.js';
import { demoScreens } from './demo-screens.js';
import { makeDemoRunner } from './demo.js';
import { pauseRotation, resumeRotation } from './schedule.js';
import { alertsStarted, takeoverRunning } from './takeover.js';

// Even asking for localStorage can throw, for example when the browser has storage switched off
function savedStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

let runner = null;

// True while a demo plays. The hidden transitions (core/hidden-run.js) ask, so
// they never play over one.
export function demoRunning() {
  return runner !== null && runner.isRunning();
}

// getContent() returns the newest content. Start this after startTakeovers, so
// that on a second when an alert comes due, the alert has the screen before the
// demo looks.
export function startDemoRunner(getContent) {
  runner = makeDemoRunner({
    getContent: getContent,
    screens: demoScreens,
    storage: savedStorage(),
    pauseRotation: pauseRotation,
    resumeRotation: resumeRotation,
    pauseEffects: frame.setEffectsPaused,
    takeoverRunning: takeoverRunning,
    alertsStarted: alertsStarted,
    wait: frame.wait,
  });

  frame.onSecond(runner.look);
}
