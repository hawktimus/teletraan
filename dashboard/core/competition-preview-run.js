// Shows the competition cards on sample data when the Studio's "Preview competition" button asks for
// it (docs/frc-feed.md). Deciding when to start and when to stop is in core/competition-preview.js,
// which has no page in it. This file gives it the real screen: the one clock, localStorage, the sample
// content file, and what else has the screen.

import * as frame from '../frame.js';
import { sampleFolder } from '../config.js';
import { makeCompetitionPreviewRunner } from './competition-preview.js';
import { previewCompetition } from './competition.js';
import { normalizeSample } from './sanity.js';
import { moveOn } from './schedule.js';
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
    console.error('The competition preview cannot ask ' + path + ' about ' + name, error);
    return () => false;
  }
}

// The competition data in data/sample/content.json, read from the folder the dashboard is served
// from, so the preview needs no internet
async function loadSampleFrc() {
  const response = await fetch(sampleFolder + 'content.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load the sample content (status ' + response.status + ')');

  return normalizeSample(await response.json()).frc;
}

// The large panel moves on to its next page at once, so the first card comes within a second and the
// ordinary list is back as soon as the time is up
function startPreview(frc, until) {
  previewCompetition(frc, until);
  moveOn(['grid1']);
}

function endPreview() {
  previewCompetition(null, 0);
  moveOn(['grid1']);
}

// getContent() returns the newest content. Start this after the takeovers, the talk screen, the demo
// runner and the hidden transitions, which it asks about.
export async function startCompetitionPreviewRunner(getContent) {
  const demoRunning = await askOptional('./demo-runner.js', 'demoRunning');
  const nightIsUp = await askOptional('./night-screen.js', 'nightIsUp');
  const hiddenPlaying = await askOptional('./hidden-run.js', 'hiddenPlaying');

  const runner = makeCompetitionPreviewRunner({
    getContent: getContent,
    storage: savedStorage(),
    takeoverRunning: takeoverRunning,
    demoRunning: demoRunning,
    nightIsUp: nightIsUp,
    hiddenPlaying: hiddenPlaying,
    loadSampleFrc: loadSampleFrc,
    startPreview: startPreview,
    endPreview: endPreview,
  });

  frame.onSecond(runner.look);
}
