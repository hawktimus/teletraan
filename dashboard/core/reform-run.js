// What the two reform transitions share (docs/transitions.md): the layer they draw in, the kit of the theme, the clock that
// every part is locked to, the lock that lets one transition play at a time, and the offer that core/swap-run-play.js asks at
// each page change of the large panel.
//
// core/reform-panel.js plays the panel transition (kind reform) and core/reform-view.js the view transition (kind reformView).
// Both are drawn over the page, with the real page changed underneath while it is covered, and both are plain page changes
// in calm motion and with none: no 3D is drawn then.

import * as frame from '../frame.js';
import { setBusy } from './busy.js';
import { countsOf } from './reform-draw.js';
import { cameraStops, framesOf, reformScale, reformTimes, windowsOf } from './reform-plan.js';

let secondsOf = () => 3; // transitionSeconds of Dashboard Settings, 2 to 4 (core/rotation.js, transitionSecondsOf)
let kindOf = () => ''; // the kind the rotation says the next change is (core/rotation.js, transitionKindNow). None plays until the views have started
let running = false;
let layerNow = null;

// views-run.js gives the length and the kind once, when it starts
export function startReforms(getSeconds, getKind) {
  secondsOf = getSeconds;
  kindOf = getKind;
  if (typeof requestAnimationFrame === 'function') setTimeout(sampleScreen, firstSampleMs);
}

// ?reform=off on the address turns both transitions off: the older page change and swap play instead, which is how to compare them
export function reformOff() {
  try {
    return new URLSearchParams(window.location.search).get('reform') === 'off';
  } catch (error) {
    return false;
  }
}

export function reformKind() {
  return kindOf();
}

// How fast the screen draws now: the length of the last frames, while no transition plays. A screen that cannot hold 25 frames
// a second (a median frame over 40 ms) gets the plain change, because a transition would only make it worse. Nothing is
// known about a screen that has not been watched for a second yet, and it is not slow.
//
// The frames are counted in a burst of 40 frames every 10 seconds, the first one 12 seconds after the start (the start is slow on any
// computer, and the first change is 20 seconds after it), and not all the time: a page that asks for a frame at every refresh to see
// how fast the screen is keeps the screen drawing at every refresh, even when nothing else moves. A burst that was not interrupted
// replaces the last one.
const lastFrames = [];
const firstSampleMs = 12000;
const sampleEveryMs = 10000;
const burstFrames = 40;

// (a timeout that asks again, and not an interval: the page keeps its number of intervals, docs/performance.md)
function sampleScreen() {
  setTimeout(sampleScreen, sampleEveryMs);
  if (running) return;

  const gaps = [];
  let lastAt = 0;
  const step = now => {
    if (running) return;
    if (lastAt > 0 && now - lastAt < 1000) gaps.push(now - lastAt);
    lastAt = now;
    if (gaps.length < burstFrames) {
      requestAnimationFrame(step);
    } else {
      lastFrames.length = 0;
      lastFrames.push(...gaps);
    }
  };
  requestAnimationFrame(step);
}

export function screenIsSlow() {
  if (lastFrames.length < 30) return false;

  const sorted = lastFrames.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] > 40;
}

// A screen that holds 25 frames a second but not 40 (a median frame over 26 ms) gets the squares without the cells, pins and barrels,
// which are a third of what a run draws. ?reform=lite on the address asks for the same.
export function reformIsLite() {
  try {
    if (new URLSearchParams(window.location.search).get('reform') === 'lite') return true;
  } catch (error) {
    // no address, no choice
  }
  if (lastFrames.length < 30) return false;

  const sorted = lastFrames.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] > 26;
}

export function reformRunning() {
  return running;
}

// How many times longer than the skeleton this run is: the length of Dashboard Settings and the Speed setting
export function scaleNow() {
  return reformScale(secondsOf()) * frame.pace();
}

// The layer the run draws in: one camera over the stage, under the alert and the talk
export function layerOf() {
  if (layerNow && layerNow.isConnected) return layerNow;

  const layer = document.createElement('div');
  layer.id = 'reform';
  layer.hidden = true;
  layer.innerHTML = '<div class="reform-camera"></div>';
  document.getElementById('stage').after(layer);
  layerNow = layer;
  return layer;
}

// The kit of the theme that is on the page. A theme that has no kit file gets the plain one, which changes plainly and draws
// nothing of another theme (core/reform-plain.js).
export async function kitNow() {
  const id = document.documentElement.dataset.style || 'original';
  try {
    return (await import('../styles/' + id + '/transitions.js')).kit;
  } catch (error) {
    console.error('Could not load the transition kit of the ' + id + ' theme. The plain kit plays.', error);
    return (await import('./reform-plain.js')).kit;
  }
}

export function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

// Starts every track of a run on one clock: one animation for each track, as long as the transition, all with the same start time, so
// a part that is made late starts part way through and a test that sets the time of all of them sets the same time everywhere.
// An animation that comes and goes while the transition plays changes the layers the screen is drawn from, and a frame is
// long when that happens, so every part has its animation from the first frame to the last, except the flat copies of the
// content, which are drawn into a surface each frame while they have one (a track with windows). restore() takes back what was
// written on the real elements of the page (extra).
export function playTracks(run, scale, extra = []) {
  const duration = reformTimes.totalMs * scale;
  const start = document.timeline.currentTime;
  const animations = [];
  const written = [];

  const begin = (element, property, stops, real, windowed) => {
    const frames = framesOf(property, stops);
    if (real || windowed) {
      element.style.setProperty(property, String(frames[0][property]));
      if (real) written.push([element, property]);
    }
    // a track with windows is played as one animation for each of its changes, and keeps its value between them
    const parts = windowed ? windowsOf(stops).map(window => ({ delay: window.from, length: window.to - window.from, frames: framesOf(property, window.stops.map(stop => [stop[0] - window.from, stop[1], stop[2]]), window.to - window.from) })) : [{ delay: 0, length: reformTimes.totalMs, frames: frames }];

    parts.forEach(part => {
      const animation = element.animate(part.frames, { delay: part.delay * scale, duration: part.length * scale, fill: windowed ? 'forwards' : 'both', easing: 'linear' });
      animation.id = 'reform';
      animation.startTime = start;
      animations.push(animation);
    });
  };

  run.tracks.list.forEach(item => begin(item.element, item.property, item.stops, false, item.windowed === true));
  begin(layerOf().firstElementChild, 'transform', cameraStops(), false, false);
  extra.forEach(item => begin(item.element, item.property, item.stops, item.element.closest('#reform') === null, false));
  return {
    animations: animations,
    start: start,
    duration: duration,
    at: () => (document.timeline.currentTime - start) / scale,
    restore: () => written.forEach(([element, property]) => element.style.removeProperty(property)),
  };
}

// Resolves when the run has lasted this many milliseconds. A test that looks at a run with its animations held sets
// window.__reformHold, and the run stays on the screen until it lets go (tests/motion/reform.mjs).
export async function until(clock, normalMs, scale) {
  const left = clock.start + normalMs * scale - document.timeline.currentTime;
  if (left > 0) await new Promise(resolve => setTimeout(resolve, left));
  while (window.__reformHold === true && normalMs >= reformTimes.totalMs) await new Promise(resolve => setTimeout(resolve, 50));
}

// Takes the lock for a run, and gives back the way to let it go. hold(on) stops and starts the clock of the rotation.
export function takeRun(reason, hold) {
  if (running) return null;

  running = true;
  setBusy(true, reason);
  hold(true);
  return () => {
    hold(false);
    setBusy(false, reason);
    running = false;
  };
}

// The counts of a run that is built, on the layer, for the tests and for ?debug=1. The elements are all the elements of the
// parts, and the animated ones are those that have an animation of their own.
export function markReady(run) {
  const counts = countsOf(run);
  const layer = layerOf();

  layer.dataset.ready = '1';
  layer.dataset.elements = String(counts.elements);
  layer.dataset.animated = String(counts.animated);
  layer.dataset.regions = JSON.stringify(run.drawn.map(item => ({ role: item.region.role, from: item.region.from, to: item.region.to, grid: item.region.grid })));
}

// The layer shows while a run plays and is empty after it
export function mount(run) {
  const layer = layerOf();
  const camera = layer.firstElementChild;

  camera.replaceChildren(run.back, run.covers, run.front);
  layer.hidden = false;
  return () => {
    delete layer.dataset.ready;
    (run.animations || []).forEach(animation => animation.cancel());
    camera.replaceChildren();
    layer.hidden = true;
  };
}
