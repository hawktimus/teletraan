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
import { framesOf, reformScale, reformTimes, cameraStops } from './reform-plan.js';

let secondsOf = () => 3; // transitionSeconds of Dashboard Settings, 2 to 4 (core/rotation.js, transitionSecondsOf)
let kindOf = () => ''; // the kind the rotation says the next change is (core/rotation.js, transitionKindNow). None plays until the views have started
let running = false;
let layerNow = null;

// views-run.js gives the length and the kind once, when it starts
export function startReforms(getSeconds, getKind) {
  secondsOf = getSeconds;
  kindOf = getKind;
}

export function reformKind() {
  return kindOf();
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

// The kit of the theme that is on the page. A theme that has no kit file gets the Original one.
export async function kitNow() {
  const id = document.documentElement.dataset.style || 'original';
  try {
    return (await import('../styles/' + id + '/transitions.js')).kit;
  } catch (error) {
    console.error('Could not load the transition kit of the ' + id + ' theme. The Original kit plays.', error);
    return (await import('../styles/original/transitions.js')).kit;
  }
}

export function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

// Starts every track of a run on one clock. A part made late starts part way through, and a test that sets the time of all of
// them sets the same time everywhere.
export function playTracks(run, scale, extra = []) {
  const duration = reformTimes.totalMs * scale;
  const start = document.timeline.currentTime;
  const animations = [];
  const begin = (element, property, stops) => {
    const animation = element.animate(framesOf(property, stops), { duration: duration, fill: 'both', easing: 'linear' });
    animation.startTime = start;
    animations.push(animation);
  };

  run.tracks.list.forEach(item => begin(item.element, item.property, item.stops));
  begin(layerOf().firstElementChild, 'transform', cameraStops());
  extra.forEach(item => begin(item.element, item.property, item.stops));
  return { animations: animations, start: start, duration: duration, at: () => (document.timeline.currentTime - start) / scale };
}

// Resolves when the run has lasted this many milliseconds
export function until(clock, normalMs, scale) {
  const left = clock.start + normalMs * scale - document.timeline.currentTime;
  return left > 0 ? new Promise(resolve => setTimeout(resolve, left)) : Promise.resolve();
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
