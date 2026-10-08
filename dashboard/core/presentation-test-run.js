// Runs the sample talk when the Studio's "Run presentation test" button asks for it
// (docs/hidden-transitions.md). Deciding when to run it is in core/presentation-test.js,
// which has no page in it. This file gives it the real screen: the one clock, localStorage,
// the sample content file, and what else has the screen.

import * as frame from '../frame.js';
import { sampleFolder } from '../config.js';
import { startTestTalk } from './presentation-run.js';
import { makePresentationTestRunner } from './presentation-test.js';
import { normalizeSample } from './sanity.js';
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
    console.error('The presentation test cannot ask ' + path + ' about ' + name, error);
    return () => false;
  }
}

// The talk in data/sample/content.json, read from the folder the dashboard is served from,
// so the test needs no internet
async function loadSampleTalk() {
  const response = await fetch(sampleFolder + 'content.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load the sample content (status ' + response.status + ')');

  return normalizeSample(await response.json()).presentations[0] || null;
}

// getContent() returns the newest content. Start this after the talk screen
// (core/presentation-run.js), the demo runner and the hidden transitions, which it asks about.
export async function startPresentationTestRunner(getContent) {
  const demoRunning = await askOptional('./demo-runner.js', 'demoRunning');
  const nightIsUp = await askOptional('./night-screen.js', 'nightIsUp');
  const hiddenPlaying = await askOptional('./hidden-run.js', 'hiddenPlaying');

  const runner = makePresentationTestRunner({
    getContent: getContent,
    storage: savedStorage(),
    takeoverRunning: takeoverRunning,
    demoRunning: demoRunning,
    nightIsUp: nightIsUp,
    hiddenPlaying: hiddenPlaying,
    loadSampleTalk: loadSampleTalk,
    startTalk: startTestTalk,
  });

  frame.onSecond(runner.look);
}
