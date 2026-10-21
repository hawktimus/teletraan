// Which motion the screen plays, and how heavy it is (docs/transitions.md, "Full, Light and Calm").
//
// The Motion setting has three values: full, light and calm. Full plays every transition of the theme. Light plays one
// simple change at each panel and view change, with a few parts, and keeps the idle sweeps still. Calm only fades.
// Every computer plays what the setting says, the Teletraan computer too. ?motion= on the address wins over the setting.
//
// A Full screen that cannot keep up gives itself up: when two transitions in a row miss their frame budget it plays
// Light from then on, until the page is loaded again.

import { motions } from '../config.js';

const askable = motions.concat(['none']);

// What to play, as one word of frame.setMotion: full, light, calm or none.
//   asked        ?motion= from the address, or ''
//   setting      motion from Dashboard Settings
export function motionToPlay({ asked, setting }) {
  if (askable.includes(asked)) return asked;
  return motions.includes(setting) ? setting : 'full';
}

// The word for frame.setMotion, from the address and the settings of the content. A setting that is not there yet is the
// starting one.
export function motionOf(params, settings) {
  const given = settings || {};
  return motionToPlay({ asked: params.get('motion') || '', setting: given.motion });
}

// The frame budget of a transition

export const budget = { slowMs: 34, slowShare: 0.2, worstMs: 200, missesInARow: 2 };

// Did this transition keep up? gaps are the milliseconds between the frames while it played. It missed when more than a
// fifth of its frames took longer than two refreshes of a 60 Hz screen, or one frame took over 200 ms.
export function missedBudget(gaps) {
  if (gaps.length < 10) return false;

  const slow = gaps.filter(gap => gap > budget.slowMs).length;
  return slow / gaps.length > budget.slowShare || Math.max(...gaps) > budget.worstMs;
}

let misses = 0;
let degraded = false;
const listeners = [];

// A Full transition ended with these frame gaps. Returns true the moment the screen gives up Full.
export function noteRun(gaps) {
  if (degraded) return false;

  misses = missedBudget(gaps) ? misses + 1 : 0;
  if (misses < budget.missesInARow) return false;

  degraded = true;
  console.warn('Two transitions in a row missed their frame budget, so this screen plays Light transitions from now on.');
  listeners.forEach(listener => listener());
  return true;
}

export function isDegraded() {
  return degraded;
}

// frame-pages.js asks to be told, so that it can write the new weight on the page
export function onDegraded(listener) {
  listeners.push(listener);
}

// For the tests
export function forgetRuns() {
  misses = 0;
  degraded = false;
}

// Counts the frames of a transition while it plays. stop() gives the gaps. It asks for a frame only while it runs.
export function watchFrames() {
  const gaps = [];
  let last = 0;
  let wanted = true;

  const step = now => {
    if (!wanted) return;
    if (last > 0) gaps.push(now - last);
    last = now;
    requestAnimationFrame(step);
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(step);
  return { stop: () => { wanted = false; return gaps; } };
}
