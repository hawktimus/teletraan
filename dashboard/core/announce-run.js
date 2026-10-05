// Plays the announcements when the Studio's "Play announcements" button asks for
// them (docs/hidden-transitions.md). Deciding when to play and in what order is in
// core/announce.js, which has no page in it. This file gives it the real screen:
// the one clock, the pauses, localStorage, and what else has the screen.

import * as frame from '../frame.js';
import { makeAnnounceRunner } from './announce.js';
import { pauseRotation, resumeRotation } from './schedule.js';
import { alertsStarted, runAnnouncement, takeoverRunning } from './takeover.js';

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
    console.error('The announcements cannot ask ' + path + ' about ' + name, error);
    return () => false;
  }
}

// getContent() returns the newest content. Start this after the takeovers, the demo
// runner and the hidden transitions, which it asks about.
export async function startAnnounceRunner(getContent) {
  const demoRunning = await askOptional('./demo-runner.js', 'demoRunning');
  const nightIsUp = await askOptional('./night-screen.js', 'nightIsUp');
  const hiddenPlaying = await askOptional('./hidden-run.js', 'hiddenPlaying');

  const runner = makeAnnounceRunner({
    getContent: getContent,
    storage: savedStorage(),
    pauseRotation: pauseRotation,
    resumeRotation: resumeRotation,
    takeoverRunning: takeoverRunning,
    demoRunning: demoRunning,
    nightIsUp: nightIsUp,
    hiddenPlaying: hiddenPlaying,
    alertsStarted: alertsStarted,
    playAnnouncement: (config, shouldStop) => runAnnouncement(config, getContent, shouldStop),
  });

  frame.onSecond(runner.look);
}
